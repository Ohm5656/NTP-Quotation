import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { normalizeCustomerProfileKey } from "../src/lib/customer-profile-links";

dotenv.config({ path: ".env.local" });
const commit = process.argv.includes("--commit");
type Item = { line_no: number; description: string; unit_price: number | null; quantity: number | null; unit: string | null; show_item_number: boolean };
type Quote = { id: string; quotation_no: string | null; project_name: string | null; customer_name_raw: string | null; total_amount: number | null; discount_amount: number; vat_rate: number; quotation_line_items: Item[] };
type Source = { quotationNo: string; sourceFile: string; archive: string; worksheet: string; projectName: string | null; customerName: string | null; totalAmount: number | null; lineItems: { description: string; unitPrice: number | null; quantity: number | null; unit: string | null; showItemNumber: boolean }[] };
function text(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return "";
  return cell.text.replace(/\s+/g, " ").trim();
}
function numeric(cell: ExcelJS.Cell): number | null {
  const value = cell.type === ExcelJS.ValueType.Formula ? cell.result : cell.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function identity(value: string | null): string {
  const base = value?.match(/(?:^|\D)(?:Q\s*)?(\d{7})(?!\d)/i)?.[1];
  if (!base) return value?.replace(/^Q\s*/i, "") ?? "";
  const rev = value?.match(/(?:rev\.?|r\.?)\s*0*(\d+)\b/i)?.[1];
  return rev ? `${base} Rev.${rev.padStart(2, "0")}` : base;
}
function key(value: string | null): string { return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase(); }
function sum(items: Item[]): number { return items.reduce((total, item) => total + Number(item.unit_price ?? 0) * Number(item.quantity ?? 0), 0); }
function equal(a: number, b: number): boolean { return Math.abs(a - b) < .02; }
async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { parsedQuotations: sources } = JSON.parse(await readFile("reports/quotation-archive-audit.json", "utf8")) as { parsedQuotations: Source[] };
  const quotes: Quote[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("quotations").select("id,quotation_no,project_name,customer_name_raw,total_amount,discount_amount,vat_rate,quotation_line_items(line_no,description,unit_price,quantity,unit,show_item_number)").is("deleted_at", null).order("id").range(from, from + 499);
    if (error) throw error;
    quotes.push(...data as Quote[]);
    if (data.length < 500) break;
  }
  const archives = new Map<string, JSZip>();
  const sourcesByNo = new Map<string, Source[]>();
  for (const source of sources) {
    const filename = path.basename(source.sourceFile);
    const no = /(?:rev\.?|r\.?)\s*\d+\b/i.test(filename) ? identity(filename) : source.quotationNo;
    const group = sourcesByNo.get(no) ?? [];
    group.push(source); sourcesByNo.set(no, group);
  }
  const updates: { id: string; q: string | null; source: string; before: { discount_amount: number; vat_rate: number }; after: { discount_amount: number; vat_rate: number }; itemsToFill: Item[]; sourceGrandTotal: number | null }[] = [];
  const missingDetails: { q: string | null; id: string; reason: string; files: string[] }[] = [];
  const conflicts: { q: string | null; source: string; reason: string; sourceAmount?: number | null; existingAmount?: number; calculatedAmount?: number }[] = [];
  let matchedSources = 0;
  for (const quote of quotes) {
    let candidates = sourcesByNo.get(identity(quote.quotation_no)) ?? [];
    if (candidates.length > 1) {
      const company = candidates.filter((source) => normalizeCustomerProfileKey(source.customerName) === normalizeCustomerProfileKey(quote.customer_name_raw));
      if (company.length) candidates = company;
      const project = candidates.filter((source) => key(source.projectName) === key(quote.project_name));
      if (project.length) candidates = project;
      const amount = candidates.filter((source) => equal(Number(source.totalAmount), Number(quote.total_amount)) || equal(source.lineItems.reduce((sum, item) => sum + (item.unitPrice ?? 0) * (item.quantity ?? 0), 0), Number(quote.total_amount)));
      if (amount.length) candidates = amount;
    }
    if (candidates.length !== 1) {
      if (!quote.quotation_line_items.length) missingDetails.push({ q: quote.quotation_no, id: quote.id, reason: candidates.length ? "Multiple source versions need review" : "No matching source workbook", files: candidates.map((row) => row.sourceFile) });
      continue;
    }
    const source = candidates[0];
    const items: Item[] = source.lineItems.filter((item) => item.description.trim()).map((item, index) => ({
      line_no: index + 1, description: item.description.trim(), unit_price: item.unitPrice,
      quantity: item.quantity, unit: item.unit, show_item_number: item.showItemNumber,
    }));
    if (!items.length) continue;
    const existingSum = sum(quote.quotation_line_items);
    const sourceSum = sum(items);
    const duplicateDatabaseNumber = quotes.filter((row) => identity(row.quotation_no) === identity(quote.quotation_no)).length > 1;
    if (!quote.quotation_line_items.length && duplicateDatabaseNumber && !equal(sourceSum, Number(quote.total_amount)) && !equal(Number(source.totalAmount), Number(quote.total_amount))) {
      missingDetails.push({ q: quote.quotation_no, id: quote.id, reason: "Duplicate quotation number has a different amount; needs review", files: [source.sourceFile] });
      continue;
    }
    if (quote.quotation_line_items.length && !equal(existingSum, sourceSum)) {
      conflicts.push({ q: quote.quotation_no, source: source.sourceFile, reason: "Existing item amounts differ from source; kept for review", sourceAmount: sourceSum, existingAmount: existingSum });
      continue;
    }
    if (!quote.quotation_line_items.length && key(source.projectName) !== key(quote.project_name)
      && !equal(sourceSum, Number(quote.total_amount)) && !equal(Number(source.totalAmount), Number(quote.total_amount))) {
      missingDetails.push({ q: quote.quotation_no, id: quote.id, reason: "Source identity needs review", files: [source.sourceFile] });
      continue;
    }
    let zip = archives.get(source.archive);
    if (!zip) { zip = await JSZip.loadAsync(await readFile(path.join("C:/Users/NTP/Downloads", source.archive))); archives.set(source.archive, zip); }
    const entry = zip.file(source.sourceFile);
    if (!entry) throw new Error(`Source not found: ${source.sourceFile}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await entry.async("nodebuffer") as never);
    const sheet = workbook.getWorksheet(source.worksheet)!;
    let amountColumn = 0;
    let discount: number | null = null;
    let rate: number | null = null;
    for (let row = 1; row <= sheet.rowCount; row++) {
      for (let col = 1; col <= sheet.columnCount; col++) if (/^amount$/i.test(text(sheet.getCell(row, col)))) { amountColumn = col; break; }
      if (amountColumn) break;
    }
    if (!amountColumn) {
      conflicts.push({ q: quote.quotation_no, source: source.sourceFile, reason: "Amount column is missing from this source form" });
      continue;
    }
    for (let row = 1; row <= sheet.rowCount; row++) for (let col = 1; col <= sheet.columnCount; col++) {
      const label = text(sheet.getCell(row, col));
      if (/^discount\b/i.test(label)) discount = numeric(sheet.getCell(row, amountColumn)) ?? 0;
      if (/^vat\b/i.test(label)) {
        const inlineRate = label.match(/(\d+(?:\.\d+)?)\s*%/)?.[1];
        if (inlineRate) rate = Number(inlineRate) / 100;
        for (let index = col + 1; index < amountColumn && rate === null; index++) {
          const candidate = numeric(sheet.getCell(row, index));
          if (candidate !== null && candidate >= 0 && candidate <= 1) rate = candidate;
        }
      }
    }
    if (!amountColumn || discount === null || rate === null) {
      conflicts.push({ q: quote.quotation_no, source: source.sourceFile, reason: "Discount/VAT fields are not explicit in this form" });
      continue;
    }
    const calculatedGrandTotal = Math.round(Math.max(0, sourceSum - discount) * (1 + rate) * 100) / 100;
    if (source.totalAmount !== null && !equal(calculatedGrandTotal, Math.round(source.totalAmount * 100) / 100)) {
      conflicts.push({ q: quote.quotation_no, source: source.sourceFile, reason: "Source item calculation differs from its cached grand total; needs review", sourceAmount: source.totalAmount, calculatedAmount: calculatedGrandTotal });
      continue;
    }
    matchedSources++;
    const itemsToFill = quote.quotation_line_items.length ? [] : items;
    if (itemsToFill.length || !equal(quote.discount_amount, discount) || Math.abs(quote.vat_rate - rate) > .00001) updates.push({
      id: quote.id, q: quote.quotation_no, source: source.sourceFile,
      before: { discount_amount: quote.discount_amount, vat_rate: quote.vat_rate },
      after: { discount_amount: discount, vat_rate: rate }, itemsToFill, sourceGrandTotal: source.totalAmount,
    });
    if (matchedSources % 100 === 0) console.log(`Checked ${matchedSources} source financial sections`);
  }
  const result = { generatedAt: new Date().toISOString(), mode: commit ? "COMMIT" : "DRY RUN", summary: {
    quotesRead: quotes.length, financialSourcesVerified: matchedSources, rowsToUpdate: updates.length,
    missingDetailsToFill: updates.filter((row) => row.itemsToFill.length).length,
    missingDetailsUnresolved: missingDetails.length, existingDataConflicts: conflicts.length,
  }, updates, missingDetails, conflicts };
  await writeFile(`reports/quotation-financial-repair-${commit ? "commit" : "dry-run"}.json`, JSON.stringify(result, null, 2) + "\n");
  if (commit) {
    await writeFile(`reports/financial-repair-backup-${Date.now()}.json`, JSON.stringify(quotes, null, 2) + "\n");
    for (const update of updates) {
      if (update.itemsToFill.length) {
        const { error } = await supabase.from("quotation_line_items").insert(update.itemsToFill.map((item) => ({ ...item, quotation_id: update.id })));
        if (error) throw error;
      }
      const { error } = await supabase.from("quotations").update(update.after).eq("id", update.id);
      if (error) throw error;
      const { data: verified, error: verifyError } = await supabase.from("quotations").select("discount_amount,vat_rate,quotation_line_items(line_no)").eq("id", update.id).single();
      if (verifyError) throw verifyError;
      if (!equal(Number(verified.discount_amount), update.after.discount_amount) || Math.abs(Number(verified.vat_rate) - update.after.vat_rate) > .00001
        || (update.itemsToFill.length && verified.quotation_line_items.length !== update.itemsToFill.length)) throw new Error(`Financial verification failed for ${update.q}`);
    }
  }
  console.log(JSON.stringify(result.summary, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
