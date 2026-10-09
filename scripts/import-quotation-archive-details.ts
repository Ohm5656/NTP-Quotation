import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Completes existing historical quotations without replacing their established
 * header values, and creates only the October 2569 quotations missing from the
 * system. It consumes the reviewed, read-only archive audit report.
 *
 * Default: dry run. Use --commit to perform database writes.
 */

type ArchiveLineItem = {
  row: number;
  showItemNumber: boolean;
  description: string;
  unitPrice: number | null;
  quantity: number | null;
  unit: string | null;
  amount: number | null;
};

type ArchiveQuotation = {
  archive: string;
  sourceFile: string;
  worksheet: string;
  quotationNo: string | null;
  quotationDate: string | null;
  sourceDateRaw: string | null;
  customerName: string | null;
  customerAddress: string | null;
  customerTaxId: string | null;
  boqNo: string | null;
  projectName: string | null;
  totalAmount: number | null;
  paymentTerm: string | null;
  attention: string | null;
  email: string | null;
  po: string | null;
  remarks: string | null;
  lineItems: ArchiveLineItem[];
  parseWarnings: string[];
};

type AuditReport = {
  parsedQuotations: ArchiveQuotation[];
};

type DatabaseQuotation = {
  id: string;
  quotation_no: string | null;
  quotation_date: string | null;
  source_date_raw: string | null;
  boq_no: string | null;
  customer_id: string | null;
  customer_name_raw: string | null;
  project_name: string | null;
  total_amount: number | string | null;
  po: string | null;
  payment_term: string | null;
  remarks: string | null;
  attention: string | null;
  email: string | null;
  deleted_at: string | null;
};

type Customer = {
  id: string;
  name: string;
  tax_id: string | null;
  address: string | null;
  contact: string | null;
  payment_term: string | null;
};

type ExistingLineItem = {
  quotation_id: string;
};

const commit = process.argv.includes("--commit");
const reportPath = path.join(process.cwd(), "reports", "quotation-archive-audit.json");
const resultPath = path.join(process.cwd(), "reports", "quotation-archive-import-result.json");

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function isBlank(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function normalizeQuotationNo(value: string | null | undefined): string | null {
  const text = String(value ?? "");
  const number = text.match(/(?:Q\s*)?(\d{7})(?!\d)/i)?.[1];
  if (!number) return null;
  const revision = text.match(/(?:REV(?:ISION)?\.?|R)\s*0*(\d+)\b/i)?.[1];
  return revision ? `${number} Rev.${revision.padStart(2, "0")}` : number;
}

function normalizedName(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("en-US");
}

function profileFrom(source: ArchiveQuotation) {
  return {
    tax_id: source.customerTaxId,
    address: source.customerAddress,
    contact: source.attention,
    payment_term: source.paymentTerm,
  };
}

async function loadAll<T>(
  supabase: ReturnType<typeof createClient<any>>,
  table: "quotations" | "customers" | "quotation_line_items",
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Unable to load ${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function isOctober2569(source: ArchiveQuotation): boolean {
  return source.archive === "Quotation 2569.zip"
    && source.quotationNo?.startsWith("6910") === true
    && source.quotationDate?.startsWith("2026-10") === true;
}

async function main(): Promise<void> {
  const audit = JSON.parse(await readFile(reportPath, "utf8")) as AuditReport;
  const supabase = createClient(
    requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const [quotations, customers, lineItems] = await Promise.all([
    loadAll<DatabaseQuotation>(supabase, "quotations", "id, quotation_no, quotation_date, source_date_raw, boq_no, customer_id, customer_name_raw, project_name, total_amount, po, payment_term, remarks, attention, email, deleted_at"),
    loadAll<Customer>(supabase, "customers", "id, name, tax_id, address, contact, payment_term"),
    loadAll<ExistingLineItem>(supabase, "quotation_line_items", "quotation_id"),
  ]);

  const quotationByNumber = new Map<string, DatabaseQuotation[]>();
  for (const quotation of quotations.filter((item) => item.deleted_at === null)) {
    const number = normalizeQuotationNo(quotation.quotation_no);
    if (!number) continue;
    const matches = quotationByNumber.get(number) ?? [];
    matches.push(quotation);
    quotationByNumber.set(number, matches);
  }

  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const customerByName = new Map(customers.map((customer) => [normalizedName(customer.name), customer]));
  const lineItemCount = new Map<string, number>();
  for (const item of lineItems) {
    lineItemCount.set(item.quotation_id, (lineItemCount.get(item.quotation_id) ?? 0) + 1);
  }

  const sourceByNumber = new Map<string, ArchiveQuotation[]>();
  for (const source of audit.parsedQuotations) {
    if (!source.quotationNo || source.parseWarnings.length > 0) continue;
    const sources = sourceByNumber.get(source.quotationNo) ?? [];
    sources.push(source);
    sourceByNumber.set(source.quotationNo, sources);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    mode: commit ? "COMMIT" : "DRY RUN",
    policy: {
      existingHeaders: "Preserve existing non-empty header values; fill blanks only.",
      existingLineItems: "Insert archive line items only when the quotation currently has no line items.",
      newRecords: "Create only October 2569 quotations (Q6910xxx, including revisions).",
    },
    summary: {
      archiveSourcesConsidered: 0,
      existingQuotationsCompleted: 0,
      existingHeadersFilled: 0,
      existingLineItemsInserted: 0,
      octoberQuotationsCreated: 0,
      octoberLineItemsInserted: 0,
      customerProfilesFilled: 0,
      skippedAmbiguousDatabaseNumbers: 0,
      skippedDuplicateArchiveNumbers: 0,
      skippedInvalidArchiveRows: 0,
    },
    existingUpdates: [] as { quotationNo: string; quotationId: string; fields: string[]; lineItems: number; sourceFile: string }[],
    createdOctoberQuotations: [] as { quotationNo: string; quotationId: string | null; lineItems: number; sourceFile: string }[],
    skipped: [] as { quotationNo: string | null; reason: string; files: string[] }[],
  };

  const ensureCustomer = async (source: ArchiveQuotation, existingCustomerId: string | null): Promise<Customer | null> => {
    if (!source.customerName) return existingCustomerId ? customerById.get(existingCustomerId) ?? null : null;

    let customer = existingCustomerId ? customerById.get(existingCustomerId) ?? null : null;
    if (!customer) customer = customerByName.get(normalizedName(source.customerName)) ?? null;

    const profile = profileFrom(source);
    if (!customer) {
      if (!commit) return null;
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: source.customerName,
          ...(profile.tax_id ? { tax_id: profile.tax_id } : {}),
          ...(profile.address ? { address: profile.address } : {}),
          ...(profile.contact ? { contact: profile.contact } : {}),
          ...(profile.payment_term ? { payment_term: profile.payment_term } : {}),
        })
        .select("id, name, tax_id, address, contact, payment_term")
        .single();
      if (error) throw new Error(`Unable to create customer ${source.customerName}: ${error.message}`);
      customer = data as Customer;
      customerById.set(customer.id, customer);
      customerByName.set(normalizedName(customer.name), customer);
      result.summary.customerProfilesFilled += 1;
      return customer;
    }

    const profileUpdates: Record<string, string> = {};
    if (isBlank(customer.tax_id) && profile.tax_id) profileUpdates.tax_id = profile.tax_id;
    if (isBlank(customer.address) && profile.address) profileUpdates.address = profile.address;
    if (isBlank(customer.contact) && profile.contact) profileUpdates.contact = profile.contact;
    if (isBlank(customer.payment_term) && profile.payment_term) profileUpdates.payment_term = profile.payment_term;
    if (Object.keys(profileUpdates).length === 0) return customer;

    if (commit) {
      const { data, error } = await supabase
        .from("customers")
        .update(profileUpdates)
        .eq("id", customer.id)
        .select("id, name, tax_id, address, contact, payment_term")
        .single();
      if (error) throw new Error(`Unable to complete customer ${customer.name}: ${error.message}`);
      customer = data as Customer;
      customerById.set(customer.id, customer);
      customerByName.set(normalizedName(customer.name), customer);
    }
    result.summary.customerProfilesFilled += 1;
    return customer;
  };

  const insertLineItems = async (quotationId: string, source: ArchiveQuotation): Promise<number> => {
    const items = source.lineItems
      .filter((item) => item.description.trim())
      .map((item, index) => ({
        quotation_id: quotationId,
        line_no: index + 1,
        description: item.description.trim(),
        unit_price: item.unitPrice,
        quantity: item.quantity,
        unit: item.unit?.trim() || null,
        show_item_number: item.showItemNumber,
      }));
    if (items.length === 0) return 0;
    if (commit) {
      const { error } = await supabase.from("quotation_line_items").insert(items);
      if (error) throw new Error(`Unable to add line items for ${source.quotationNo}: ${error.message}`);
    }
    lineItemCount.set(quotationId, items.length);
    return items.length;
  };

  for (const [quotationNo, sources] of sourceByNumber) {
    if (sources.length !== 1) {
      result.summary.skippedDuplicateArchiveNumbers += 1;
      result.skipped.push({ quotationNo, reason: "Multiple archive files use this exact quotation number; no automatic merge.", files: sources.map((source) => source.sourceFile) });
      continue;
    }

    const source = sources[0];
    result.summary.archiveSourcesConsidered += 1;
    const matches = quotationByNumber.get(quotationNo) ?? [];

    if (matches.length > 1) {
      result.summary.skippedAmbiguousDatabaseNumbers += 1;
      result.skipped.push({ quotationNo, reason: "Multiple active database rows use this quotation number; no automatic merge.", files: [source.sourceFile] });
      continue;
    }

    if (matches.length === 1) {
      const existing = matches[0];
      const customer = await ensureCustomer(source, existing.customer_id);
      const updates: Record<string, string> = {};
      if (!existing.customer_id && customer) updates.customer_id = customer.id;
      if (isBlank(existing.boq_no) && source.boqNo) updates.boq_no = source.boqNo;
      if (isBlank(existing.payment_term) && source.paymentTerm) updates.payment_term = source.paymentTerm;
      if (isBlank(existing.remarks) && source.remarks) updates.remarks = source.remarks;
      if (isBlank(existing.attention) && source.attention) updates.attention = source.attention;
      if (isBlank(existing.email) && source.email) updates.email = source.email;

      if (commit && Object.keys(updates).length > 0) {
        const { error } = await supabase.from("quotations").update(updates).eq("id", existing.id);
        if (error) throw new Error(`Unable to complete ${quotationNo}: ${error.message}`);
      }

      const hasLineItems = (lineItemCount.get(existing.id) ?? 0) > 0;
      const insertedLineItems = hasLineItems ? 0 : await insertLineItems(existing.id, source);
      if (Object.keys(updates).length > 0 || insertedLineItems > 0) {
        result.summary.existingQuotationsCompleted += 1;
        result.summary.existingHeadersFilled += Object.keys(updates).length;
        result.summary.existingLineItemsInserted += insertedLineItems;
        result.existingUpdates.push({ quotationNo, quotationId: existing.id, fields: Object.keys(updates), lineItems: insertedLineItems, sourceFile: source.sourceFile });
      }
      continue;
    }

    if (!isOctober2569(source)) continue;
    if (!source.quotationDate || !source.customerName || !source.projectName || source.totalAmount === null) {
      result.summary.skippedInvalidArchiveRows += 1;
      result.skipped.push({ quotationNo, reason: "October source is missing a required field (date, customer, project, or total).", files: [source.sourceFile] });
      continue;
    }

    const customer = await ensureCustomer(source, null);
    if (!customer && commit) throw new Error(`Unable to resolve customer for ${quotationNo}`);
    let quotationId: string | null = null;
    if (commit) {
      const { data, error } = await supabase
        .from("quotations")
        .insert({
          quotation_no: quotationNo,
          quotation_date: source.quotationDate,
          source_date_raw: source.sourceDateRaw,
          boq_no: source.boqNo,
          customer_id: customer?.id ?? null,
          customer_name_raw: source.customerName,
          project_name: source.projectName,
          total_amount: source.totalAmount,
          po: source.po,
          payment_term: source.paymentTerm,
          remarks: source.remarks,
          discount_amount: 0,
          vat_rate: 0.07,
          attention: source.attention,
          email: source.email,
          source_file: `${source.archive}/${source.sourceFile}`,
          source_sheet: source.worksheet,
          source_row: null,
          source_row_hash: null,
          deleted_at: null,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Unable to create ${quotationNo}: ${error.message}`);
      quotationId = data.id;
    }

    const newLineItems = quotationId ? await insertLineItems(quotationId, source) : source.lineItems.filter((item) => item.description.trim()).length;
    result.summary.octoberQuotationsCreated += 1;
    result.summary.octoberLineItemsInserted += newLineItems;
    result.createdOctoberQuotations.push({ quotationNo, quotationId, lineItems: newLineItems, sourceFile: source.sourceFile });
  }

  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`\n${commit ? "Import" : "Dry run"} complete — report: ${resultPath}`);
  console.log(JSON.stringify(result.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
