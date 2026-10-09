import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import dotenv from "dotenv";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Complete only blank customer profile fields from the original quotation
 * workbooks. A profile is a convenient default for new documents; individual
 * quotations keep their own contact and email and are never overwritten here.
 *
 * Default: dry run. Use --commit to write changes.
 */

type ArchiveQuotation = {
  quotationNo: string | null;
  quotationDate: string | null;
  customerAddress: string | null;
  customerTaxId: string | null;
  attention: string | null;
  email: string | null;
  paymentTerm: string | null;
  parseWarnings: string[];
  sourceFile: string;
};

type AuditReport = { parsedQuotations: ArchiveQuotation[] };

type DatabaseQuotation = {
  quotation_no: string | null;
  quotation_date: string | null;
  customer_id: string | null;
  email: string | null;
  deleted_at: string | null;
};

type Customer = {
  id: string;
  name: string;
  tax_id: string | null;
  address: string | null;
  contact: string | null;
  email: string | null;
  payment_term: string | null;
};

const commit = process.argv.includes("--commit");
const auditPath = path.join(process.cwd(), "reports", "quotation-archive-audit.json");
const resultPath = path.join(process.cwd(), "reports", "customer-profile-backfill-result.json");
const spreadsheetProfilePath = path.join(process.cwd(), "templates", "excel", "customer-profiles.xlsx");

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function blank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

function normalizeQuotationNo(value: string | null | undefined): string | null {
  const text = String(value ?? "");
  const number = text.match(/(?:Q\s*)?(\d{7})(?!\d)/i)?.[1];
  if (!number) return null;
  const revision = text.match(/(?:REV(?:ISION)?\.?|R)\s*0*(\d+)\b/i)?.[1];
  return revision ? `${number} Rev.${revision.padStart(2, "0")}` : number;
}

function cleanContact(value: string | null): string | null {
  const cleaned = (value ?? "")
    .replace(/\s*(?:e-?mail|email)\s*:?\s*[^\s]+@[^\s]+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function validEmail(value: string | null | undefined): string | null {
  const candidate = (value ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  return candidate?.trim() || null;
}

type SpreadsheetProfile = {
  name: string;
  taxId: string;
  address: string;
  contact: string;
  paymentTerm: string;
};

function spreadsheetCellText(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return "";
  return cell.text.trim() || String(cell.value).trim();
}

function profileKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("th")
    .replace(/[.(),]/g, " ")
    .replace(/\b(company|limited|ltd|co)\b/gi, " ")
    .replace(/บริษัท|บจ|บมจ/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadSpreadsheetProfiles(): Promise<SpreadsheetProfile[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(spreadsheetProfilePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const profiles: SpreadsheetProfile[] = [];
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    const name = spreadsheetCellText(sheet.getCell(row, 2));
    if (!name) continue;
    profiles.push({
      taxId: spreadsheetCellText(sheet.getCell(row, 1)),
      name,
      address: spreadsheetCellText(sheet.getCell(row, 3)),
      contact: spreadsheetCellText(sheet.getCell(row, 4)),
      paymentTerm: spreadsheetCellText(sheet.getCell(row, 5)),
    });
  }
  return profiles;
}

async function loadAll<T>(supabase: import("@supabase/supabase-js").SupabaseClient, table: "quotations" | "customers", columns: string): Promise<T[]> {
  const results: T[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`Unable to load ${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    results.push(...page);
    if (page.length < 1_000) return results;
  }
}

async function main(): Promise<void> {
  const audit = JSON.parse(await readFile(auditPath, "utf8")) as AuditReport;
  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const [quotations, customers, spreadsheetProfiles] = await Promise.all([
    loadAll<DatabaseQuotation>(supabase, "quotations", "quotation_no, quotation_date, customer_id, email, deleted_at"),
    loadAll<Customer>(supabase, "customers", "id, name, tax_id, address, contact, email, payment_term"),
    loadSpreadsheetProfiles(),
  ]);

  const spreadsheetByKey = new Map<string, SpreadsheetProfile[]>();
  for (const profile of spreadsheetProfiles) {
    const key = profileKey(profile.name);
    const profiles = spreadsheetByKey.get(key) ?? [];
    profiles.push(profile);
    spreadsheetByKey.set(key, profiles);
  }

  const sourcesByNumber = new Map<string, ArchiveQuotation[]>();
  for (const source of audit.parsedQuotations) {
    if (!source.quotationNo || source.parseWarnings.length > 0) continue;
    const group = sourcesByNumber.get(source.quotationNo) ?? [];
    group.push(source);
    sourcesByNumber.set(source.quotationNo, group);
  }

  const quotationsByNumber = new Map<string, DatabaseQuotation[]>();
  for (const quotation of quotations.filter((item) => item.deleted_at === null)) {
    const number = normalizeQuotationNo(quotation.quotation_no);
    if (!number) continue;
    const group = quotationsByNumber.get(number) ?? [];
    group.push(quotation);
    quotationsByNumber.set(number, group);
  }

  type Candidate = ArchiveQuotation & { quotationEmail: string | null; date: string };
  const candidatesByCustomer = new Map<string, Candidate[]>();
  let skippedDuplicateSources = 0;
  let skippedDuplicateDatabaseRows = 0;
  for (const [quotationNo, sourceGroup] of sourcesByNumber) {
    if (sourceGroup.length !== 1) {
      skippedDuplicateSources += 1;
      continue;
    }
    const databaseGroup = quotationsByNumber.get(quotationNo) ?? [];
    if (databaseGroup.length !== 1) {
      if (databaseGroup.length > 1) skippedDuplicateDatabaseRows += 1;
      continue;
    }
    const quotation = databaseGroup[0];
    if (!quotation.customer_id) continue;
    const source = sourceGroup[0];
    const candidates = candidatesByCustomer.get(quotation.customer_id) ?? [];
    candidates.push({ ...source, quotationEmail: quotation.email, date: source.quotationDate ?? quotation.quotation_date ?? "0000-00-00" });
    candidatesByCustomer.set(quotation.customer_id, candidates);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    mode: commit ? "COMMIT" : "DRY RUN",
    summary: {
      customersUpdated: 0,
      taxIdsFilled: 0,
      addressesFilled: 0,
      contactsFilled: 0,
      emailsFilled: 0,
      paymentTermsFilled: 0,
      skippedDuplicateSources,
      skippedDuplicateDatabaseRows,
    },
    updates: [] as { customerId: string; customerName: string; fields: string[]; sourceFile: string }[],
  };

  for (const customer of customers) {
    const candidates = [...(candidatesByCustomer.get(customer.id) ?? [])]
      .sort((left, right) => right.date.localeCompare(left.date));
    const spreadsheetMatches = spreadsheetByKey.get(profileKey(customer.name)) ?? [];
    const spreadsheet = spreadsheetMatches.length === 1 ? spreadsheetMatches[0] : null;
    if (candidates.length === 0 && !spreadsheet) continue;

    const latest = (selector: (candidate: Candidate) => string | null): { value: string; sourceFile: string } | null => {
      for (const candidate of candidates) {
        const value = selector(candidate)?.trim() ?? "";
        if (value) return { value, sourceFile: candidate.sourceFile };
      }
      return null;
    };

    const tax = latest((candidate) => candidate.customerTaxId) ?? (spreadsheet?.taxId ? { value: spreadsheet.taxId, sourceFile: spreadsheetProfilePath } : null);
    const address = latest((candidate) => candidate.customerAddress) ?? (spreadsheet?.address ? { value: spreadsheet.address, sourceFile: spreadsheetProfilePath } : null);
    const contact = latest((candidate) => cleanContact(candidate.attention)) ?? (spreadsheet?.contact ? { value: spreadsheet.contact, sourceFile: spreadsheetProfilePath } : null);
    const email = latest((candidate) => validEmail(candidate.email) ?? validEmail(candidate.quotationEmail) ?? validEmail(candidate.attention));
    const paymentTerm = latest((candidate) => candidate.paymentTerm) ?? (spreadsheet?.paymentTerm ? { value: spreadsheet.paymentTerm, sourceFile: spreadsheetProfilePath } : null);
    const updates: Record<string, string> = {};
    const sources: string[] = [];
    if (blank(customer.tax_id) && tax) { updates.tax_id = tax.value; sources.push(tax.sourceFile); result.summary.taxIdsFilled += 1; }
    if (blank(customer.address) && address) { updates.address = address.value; sources.push(address.sourceFile); result.summary.addressesFilled += 1; }
    if (blank(customer.contact) && contact) { updates.contact = contact.value; sources.push(contact.sourceFile); result.summary.contactsFilled += 1; }
    if (blank(customer.email) && email) { updates.email = email.value; sources.push(email.sourceFile); result.summary.emailsFilled += 1; }
    if (blank(customer.payment_term) && paymentTerm) { updates.payment_term = paymentTerm.value; sources.push(paymentTerm.sourceFile); result.summary.paymentTermsFilled += 1; }
    if (Object.keys(updates).length === 0) continue;

    if (commit) {
      const { error } = await supabase.from("customers").update(updates).eq("id", customer.id);
      if (error) throw new Error(`Unable to update customer ${customer.name}: ${error.message}`);
    }
    result.summary.customersUpdated += 1;
    result.updates.push({ customerId: customer.id, customerName: customer.name, fields: Object.keys(updates), sourceFile: sources[0] ?? candidates[0]?.sourceFile ?? spreadsheetProfilePath });
  }

  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`${commit ? "Customer profile backfill" : "Customer profile backfill dry run"} complete — ${resultPath}`);
  console.log(JSON.stringify(result.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
