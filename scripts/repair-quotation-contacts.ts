import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { normalizeCustomerProfileKey } from "../src/lib/customer-profile-links";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const commit = process.argv.includes("--commit");
const reportDirectory = path.join(process.cwd(), "reports");

type Source = {
  quotationNo: string | null; customerName: string | null; projectName: string | null;
  totalAmount: number | null; attention: string | null; email: string | null;
  sourceFile: string; quotationDate: string | null;
  fieldCells: { attention?: { sheet: string; address: string } };
};
type Quote = {
  id: string; quotation_no: string | null; customer_id: string | null; customer_name_raw: string | null;
  attention: string | null; email: string | null; project_name: string | null; total_amount: number | null;
  quotation_date: string | null; source_row: number | null; deleted_at: string | null;
};
type Customer = { id: string; name: string; contact: string | null; email: string | null };
type RegisterRow = { quotationNo: string; customerName: string; contact: string | null; email: string | null; row: number };

function key(value: string | null | undefined): string {
  return (value ?? "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}
function personKey(value: string | null | undefined): string {
  return key(value).replace(/^(?:คุณ\s*|k\.?\s*)/, "");
}
function number(value: string | null): string {
  const base = value?.match(/(?:^|\D)(?:Q\s*)?(\d{7})(?!\d)/i)?.[1] ?? "";
  if (!base) return key(value).replace(/^q\s*/, "");
  const revision = value?.match(/(?:Rev\.?|R\.?)\s*0*(\d+)\b/i)?.[1];
  return revision ? `${base} Rev.${revision.padStart(2, "0")}` : base;
}
function contact(value: string | null): string | null {
  return value?.replace(/\s*(?:e-?mail)\s*:?.*$/i, "").replace(/\s+/g, " ").trim() || null;
}
function email(value: string | null): string | null {
  return value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase() ?? null;
}
function text(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (typeof value === "object" && value && "text" in value) return String(value.text ?? "");
  if (typeof value === "object" && value && "result" in value) return String(value.result ?? "");
  return cell.text;
}
async function loadAll<T>(supabase: import("@supabase/supabase-js").SupabaseClient, table: string, columns: string): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    result.push(...page);
    if (page.length < 1000) return result;
  }
}

async function main() {
  const audit = JSON.parse(await readFile(path.join(reportDirectory, "quotation-archive-audit.json"), "utf8")) as { parsedQuotations: Source[] };
  // Refuse the old report that extracted contact from Customer instead of C14.
  if (!audit.parsedQuotations.some((source) => source.quotationNo === "6909034" && source.fieldCells.attention?.address === "C14")) {
    throw new Error("Run the corrected archive audit first. Visible quotation contacts are required.");
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const [quotes, customers] = await Promise.all([
    loadAll<Quote>(supabase, "quotations", "id,quotation_no,customer_id,customer_name_raw,attention,email,project_name,total_amount,quotation_date,source_row,deleted_at"),
    loadAll<Customer>(supabase, "customers", "id,name,contact,email"),
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readFile(path.join(process.cwd(), "templates/excel/quotation-register.xlsx")) as never);
  const sheet = workbook.worksheets[0];
  const register: RegisterRow[] = [];
  for (let row = 2; row <= sheet.rowCount; row++) {
    const quotationNo = number(text(sheet.getCell(row, 2)));
    if (!quotationNo) continue;
    register.push({ quotationNo, customerName: text(sheet.getCell(row, 4)), contact: contact(text(sheet.getCell(row, 8))), email: email(text(sheet.getCell(row, 9))), row });
  }
  const directory = [
    ...register.map((row) => ({ customerName: row.customerName, contact: row.contact, email: row.email })),
    ...audit.parsedQuotations.map((source) => ({ customerName: source.customerName, contact: contact(source.attention), email: email(source.email) })),
  ].filter((pair) => pair.contact && pair.email);
  const sourcesByNo = new Map<string, Source[]>();
  for (const source of audit.parsedQuotations) {
    if (!source.quotationNo) continue;
    const filename = path.basename(source.sourceFile);
    const identity = /(?:rev\.?|r\.?)\s*\d+\b/i.test(filename) ? number(filename) : source.quotationNo;
    const group = sourcesByNo.get(identity) ?? [];
    group.push(source); sourcesByNo.set(identity, group);
  }
  const updates: { id: string; quotationNo: string | null; before: { attention: string | null; email: string | null }; after: { attention: string | null; email: string | null }; source: string; sourceCell: string | null }[] = [];
  const unresolved: { quotationNo: string | null; id: string; reason: string; files: string[] }[] = [];
  const expected = new Map<string, { attention: string | null; email: string | null }>();

  for (const quote of quotes.filter((row) => !row.deleted_at)) {
    const quotationNo = number(quote.quotation_no);
    const sourceGroup = sourcesByNo.get(quotationNo) ?? [];
    let candidates = sourceGroup;
    if (candidates.length > 1) {
      const sameCompany = candidates.filter((source) => normalizeCustomerProfileKey(source.customerName) === normalizeCustomerProfileKey(quote.customer_name_raw));
      if (sameCompany.length) candidates = sameCompany;
      const exact = candidates.filter((source) => key(source.projectName) === key(quote.project_name) && Math.abs(Number(source.totalAmount) - Number(quote.total_amount)) < 0.01);
      if (exact.length) candidates = exact;
    }
    const identities = new Set(candidates.map((source) => JSON.stringify([contact(source.attention), email(source.email)])));
    const source = candidates.length === 1 || identities.size === 1 ? candidates[0] : undefined;
    const registerRows = register.filter((row) => row.quotationNo === quotationNo);
    const matchingRegister = registerRows.find((row) => row.row === quote.source_row)
      ?? (registerRows.length === 1 ? registerRows[0] : undefined);
    if (sourceGroup.length > 0 && !source) {
      unresolved.push({ quotationNo: quote.quotation_no, id: quote.id, reason: "Source files disagree; identity needs review", files: sourceGroup.map((row) => row.sourceFile) });
      continue;
    }
    if (!source && !matchingRegister) {
      if (/MAYEKAWA/i.test(quote.customer_name_raw ?? "")) unresolved.push({ quotationNo: quote.quotation_no, id: quote.id, reason: "No archive or register identity found", files: [] });
      continue;
    }
    const attention = contact(source?.attention ?? null) ?? matchingRegister?.contact ?? null;
    let contactEmail = email(source?.email ?? null);
    if (!contactEmail && attention && matchingRegister && personKey(matchingRegister.contact) === personKey(attention)) contactEmail = matchingRegister.email;
    if (!contactEmail && attention) {
      const matchingPairs = directory.filter((pair) => personKey(pair.contact) === personKey(attention)
        && normalizeCustomerProfileKey(pair.customerName) === normalizeCustomerProfileKey(source?.customerName ?? quote.customer_name_raw));
      const emails = [...new Set(matchingPairs.map((pair) => pair.email!))];
      if (emails.length === 1) contactEmail = emails[0];
    }
    // Existing register notes (for example LINE instructions) and a manually
    // entered address remain attached to the same person when no source email
    // is available. Never keep an email after changing to a different person.
    if (!contactEmail && personKey(quote.attention) === personKey(attention)) contactEmail = quote.email;
    const after = { attention, email: contactEmail };
    expected.set(quote.id, after);
    if (key(quote.attention) !== key(attention) || key(quote.email) !== key(contactEmail)) updates.push({
      id: quote.id, quotationNo: quote.quotation_no,
      before: { attention: quote.attention, email: quote.email }, after,
      source: source?.sourceFile ?? `quotation-register.xlsx row ${matchingRegister!.row}`,
      sourceCell: source?.fieldCells.attention?.address ?? null,
    });
  }

  // Repair the two profiles overwritten by the blanket normalization as well.
  // A profile's default person/email must be an actual paired observation.
  const profileUpdates = customers.filter((customer) => /MAYEKAWA/i.test(customer.name)).map((customer) => {
    const recent = quotes.filter((quote) => !quote.deleted_at && quote.customer_id === customer.id && expected.get(quote.id)?.attention)
      .sort((a, b) => (b.quotation_date ?? "").localeCompare(a.quotation_date ?? "") || (b.quotation_no ?? "").localeCompare(a.quotation_no ?? ""))[0];
    const pair = recent ? expected.get(recent.id) : undefined;
    return pair && (key(customer.contact) !== key(pair.attention) || key(customer.email) !== key(pair.email))
      ? { id: customer.id, name: customer.name, before: { contact: customer.contact, email: customer.email }, after: { contact: pair.attention, email: pair.email } } : null;
  }).filter((update): update is NonNullable<typeof update> => Boolean(update));

  const result = { generatedAt: new Date().toISOString(), mode: commit ? "COMMIT" : "DRY RUN", summary: {
    quotesChecked: expected.size, quotationContactsToRepair: updates.length, customerProfilesToRepair: profileUpdates.length,
    mayekawaToRepair: updates.filter((update) => /MAYEKAWA/i.test(quotes.find((quote) => quote.id === update.id)?.customer_name_raw ?? "")).length,
    unresolved: unresolved.length,
  }, updates, profileUpdates, unresolved };
  await mkdir(reportDirectory, { recursive: true });
  const resultPath = path.join(reportDirectory, `quotation-contact-repair-${commit ? "commit" : "dry-run"}.json`);
  await writeFile(resultPath, JSON.stringify(result, null, 2) + "\n");
  if (commit) {
    await writeFile(path.join(reportDirectory, `contact-repair-backup-${Date.now()}.json`), JSON.stringify({ quotes, customers }, null, 2) + "\n");
    for (const update of updates) {
      const { error } = await supabase.from("quotations").update(update.after).eq("id", update.id);
      if (error) throw new Error(`Failed ${update.quotationNo}: ${error.message}`);
    }
    for (const update of profileUpdates) {
      const { error } = await supabase.from("customers").update(update.after).eq("id", update.id);
      if (error) throw new Error(`Failed profile ${update.name}: ${error.message}`);
    }
    const verified = await loadAll<Quote>(supabase, "quotations", "id,attention,email");
    const remaining = verified.filter((quote) => expected.has(quote.id) && (key(quote.attention) !== key(expected.get(quote.id)!.attention) || key(quote.email) !== key(expected.get(quote.id)!.email)));
    if (remaining.length) throw new Error(`Verification failed for ${remaining.length} records`);
    console.log(`Verified ${expected.size} quotation contact pairs after commit.`);
  }
  console.log(JSON.stringify(result.summary, null, 2));
  console.log(resultPath);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
