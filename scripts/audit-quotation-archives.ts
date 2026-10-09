import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import dotenv from "dotenv";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Read-only inspection of the historical quotation ZIP archives.
 *
 * This script deliberately never inserts, updates, or deletes data.  It creates
 * a JSON report only, which is the approval input for the later import script.
 *
 * Run: npm run audit:quotation-archives
 */

type ArchiveDefinition = {
  buddhistYear: number;
  filePath: string;
};

type SourceCell = {
  sheet: string;
  address: string;
};

type ParsedLine = {
  row: number;
  showItemNumber: boolean;
  description: string;
  unitPrice: number | null;
  quantity: number | null;
  unit: string | null;
  amount: number | null;
};

type ParsedQuotation = {
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
  lineItems: ParsedLine[];
  fieldCells: Partial<Record<Exclude<keyof ParsedQuotation, "fieldCells" | "lineItems" | "archive" | "sourceFile" | "worksheet">, SourceCell>>;
  parseWarnings: string[];
};

type ExistingQuotation = {
  id: string;
  quotation_no: string | null;
  quotation_date: string | null;
  boq_no: string | null;
  customer_name_raw: string | null;
  project_name: string | null;
  total_amount: number | null;
  po: string | null;
  payment_term: string | null;
  remarks: string | null;
  attention: string | null;
  email: string | null;
  source_file: string | null;
  source_sheet: string | null;
  source_row: number | null;
  deleted_at: string | null;
};

type Conflict = {
  quotationNo: string;
  databaseId: string;
  databaseSource: string;
  archive: string;
  sourceFile: string;
  worksheet: string;
  field: string;
  sourceCell: string | null;
  databaseValue: string | number | null;
  fileValue: string | number | null;
};

const downloadsDirectory = "C:/Users/NTP/Downloads";

const archives: ArchiveDefinition[] = [
  { buddhistYear: 2566, filePath: path.join(downloadsDirectory, "Quotation 2566.zip") },
  { buddhistYear: 2567, filePath: path.join(downloadsDirectory, "Quotation 2567.zip") },
  { buddhistYear: 2568, filePath: path.join(downloadsDirectory, "Quotation 2568.zip") },
  { buddhistYear: 2569, filePath: path.join(downloadsDirectory, "Quotation 2569.zip") },
];

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function unwrap(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || value instanceof Date) return value;
  if ("result" in value) return value.result;
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return value.text;
  return value;
}

function cellText(cell: ExcelJS.Cell): string {
  const value = unwrap(cell.value);
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return cell.text || value.toISOString();
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return cell.text.trim() || String(value);
  return cell.text.trim();
}

function cellNumber(cell: ExcelJS.Cell): number | null {
  const value = unwrap(cell.value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const compact = cellText(cell).replace(/[,\s฿]/g, "");
  if (!compact || !/^-?\d+(?:\.\d+)?$/.test(compact)) return null;
  const parsed = Number(compact);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedText(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("en-US");
}

function normalizeQuotationNo(value: string | null, sourceFile: string): string | null {
  const fileName = path.basename(sourceFile);
  // The filename is the safest identity when the old workbook was revised but
  // its visible quotation cell was not updated. It also handles Q6601003Rev.01
  // (no separator before Rev).
  const number = fileName.match(/(?:Q\s*)?(\d{7})(?!\d)/i)?.[1]
    ?? value?.match(/(?:Q\s*)?(\d{7})(?!\d)/i)?.[1];
  if (!number) return null;

  const revision = `${value ?? ""} ${fileName}`.match(/(?:REV(?:ISION)?\.?|R)\s*0*(\d+)\b/i)?.[1];
  return revision ? `${number} Rev.${revision.padStart(2, "0")}` : number;
}

function normalizeBoq(value: string | null): string | null {
  const text = value?.trim();
  if (!text || text === "-") return null;
  return text.replace(/^BOQ\s*/i, "").replace(/\s+/g, " ").trim() || null;
}

function toIsoDate(value: unknown, displayValue: string): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    let year = value.getFullYear();
    if (year >= 2400) year -= 543;
    return `${year.toString().padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const text = displayValue.trim();
  const matched = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (!matched) return null;
  const [, day, month, rawYear] = matched;
  let year = Number(rawYear);
  if (year < 100) year += 2500;
  if (year >= 2400) year -= 543;
  if (year < 1900 || Number(month) > 12 || Number(day) > 31) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cellFor(sheet: ExcelJS.Worksheet, row: number, column: number): SourceCell {
  return { sheet: sheet.name, address: sheet.getCell(row, column).address };
}

function isKnownLabel(value: string): boolean {
  return /^(?:date|quotation\s*no|customer|address|attention|project|item|description|unit\s*price|quantity|qty|unit|amount|total|discount|sub\s*total|grand\s*total|vat|boq|po|หมายเหตุ|เงื่อนไข)/i.test(value.trim());
}

function findLabel(sheet: ExcelJS.Worksheet, pattern: RegExp): { row: number; column: number } | null {
  for (let row = 1; row <= sheet.rowCount; row += 1) {
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      if (pattern.test(cellText(sheet.getCell(row, column)))) return { row, column };
    }
  }
  return null;
}

function rightValue(sheet: ExcelJS.Worksheet, label: { row: number; column: number }): { value: string; cell: SourceCell } | null {
  const labelText = cellText(sheet.getCell(label.row, label.column));
  for (let column = label.column + 1; column <= Math.min(sheet.columnCount, label.column + 6); column += 1) {
    const cell = sheet.getCell(label.row, column);
    const value = cellText(cell);
    if (!value || value === labelText || isKnownLabel(value)) continue;
    return { value, cell: cellFor(sheet, label.row, column) };
  }
  return null;
}

function rightNumber(sheet: ExcelJS.Worksheet, label: { row: number; column: number }): { value: number; cell: SourceCell } | null {
  const labelText = cellText(sheet.getCell(label.row, label.column));
  for (let column = label.column + 1; column <= Math.min(sheet.columnCount, label.column + 6); column += 1) {
    const cell = sheet.getCell(label.row, column);
    if (cellText(cell) === labelText) continue;
    const value = cellNumber(cell);
    if (value !== null) return { value, cell: cellFor(sheet, label.row, column) };
  }
  return null;
}

function findTotal(sheet: ExcelJS.Worksheet): { value: number; cell: SourceCell } | null {
  const labels = [/^grand\s*total/i, /^total/i, /^รวมทั้งสิ้น/i];
  for (const pattern of labels) {
    const label = findLabel(sheet, pattern);
    if (label) {
      const value = rightNumber(sheet, label);
      if (value !== null) return value;
    }
  }
  return null;
}

function findRows(sheet: ExcelJS.Worksheet): ParsedLine[] {
  let headerRow = 0;
  let descriptionColumn = 0;
  let itemColumn = 0;
  let unitPriceColumn = 0;
  let quantityColumn = 0;
  let unitColumn = 0;
  let amountColumn = 0;

  for (let row = 1; row <= sheet.rowCount && !headerRow; row += 1) {
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      if (!/^description$/i.test(cellText(sheet.getCell(row, column)))) continue;
      headerRow = row;
      descriptionColumn = column;
      for (let headerColumn = 1; headerColumn <= sheet.columnCount; headerColumn += 1) {
        const header = cellText(sheet.getCell(row, headerColumn));
        if (/^item$/i.test(header)) itemColumn = headerColumn;
        if (/^unit\s*price$/i.test(header)) unitPriceColumn = headerColumn;
        if (/^(?:quantity|qty)$/i.test(header)) quantityColumn = headerColumn;
        if (/^unit$/i.test(header)) unitColumn = headerColumn;
        if (/^amount$/i.test(header)) amountColumn = headerColumn;
      }
      break;
    }
  }

  if (!headerRow || !descriptionColumn) return [];

  const lineItems: ParsedLine[] = [];
  for (let row = headerRow + 1; row <= sheet.rowCount; row += 1) {
    const rowText = Array.from({ length: sheet.columnCount }, (_, index) => cellText(sheet.getCell(row, index + 1))).join(" ");
    if (/\b(?:grand\s*total|sub\s*total|discount|vat|total)\b|หมายเหตุ|เงื่อนไขการชำระเงิน/i.test(rowText)) break;
    const description = cellText(sheet.getCell(row, descriptionColumn));
    const price = unitPriceColumn ? cellNumber(sheet.getCell(row, unitPriceColumn)) : null;
    const quantity = quantityColumn ? cellNumber(sheet.getCell(row, quantityColumn)) : null;
    const unit = unitColumn ? cellText(sheet.getCell(row, unitColumn)) || null : null;
    const amount = amountColumn ? cellNumber(sheet.getCell(row, amountColumn)) : null;
    if (!description && price === null && quantity === null && !unit && amount === null) continue;
    const item = itemColumn ? cellText(sheet.getCell(row, itemColumn)) : "";
    lineItems.push({
      row,
      showItemNumber: Boolean(item),
      description,
      unitPrice: price,
      quantity,
      unit,
      amount,
    });
  }
  return lineItems;
}

function parseQuotation(workbook: ExcelJS.Workbook, archive: string, sourceFile: string): ParsedQuotation {
  const sheet = workbook.getWorksheet("Quotation") ?? workbook.worksheets.find((candidate) => candidate.rowCount > 0) ?? workbook.worksheets[0];
  if (!sheet) throw new Error("Workbook has no usable worksheet");

  const warnings: string[] = [];
  const fieldCells: ParsedQuotation["fieldCells"] = {};
  const textField = (key: keyof ParsedQuotation["fieldCells"], pattern: RegExp) => {
    const label = findLabel(sheet, pattern);
    const found = label ? rightValue(sheet, label) : null;
    if (found) fieldCells[key] = found.cell;
    return found?.value ?? null;
  };

  const quotationLabel = findLabel(sheet, /^(?:quotation\s*no|เลขที่ใบเสนอราคา)/i);
  const quotationFound = quotationLabel ? rightValue(sheet, quotationLabel) : null;
  if (quotationFound) fieldCells.quotationNo = quotationFound.cell;
  const quotationNo = normalizeQuotationNo(quotationFound?.value ?? null, sourceFile);
  if (!quotationNo) warnings.push("No quotation number found");

  const dateLabel = findLabel(sheet, /^date\s*:/i);

  let customerName = textField("customerName", /^(?:customer|ลูกค้า)\s*:?$/i);
  const boqNo = textField("boqNo", /^(?:อ้างอิง\s*)?BOQ\s*:?$/i);
  const projectName = textField("projectName", /^project\s*:?$/i);
  let paymentTerm = textField("paymentTerm", /^(?:เงื่อนไขการชำระเงิน|payment\s*term)\s*:?$/i);
  let attention = textField("attention", /^(?:attention|ผู้ติดต่อ)\s*:?$/i);
  const po = textField("po", /^po\s*:?$/i);

  let quotationDate: string | null = null;
  let sourceDateRaw: string | null = null;
  if (dateLabel) {
    const found = rightValue(sheet, dateLabel);
    if (found) {
      const column = sheet.getCell(dateLabel.row, dateLabel.column + 1);
      let dateCell = column;
      for (let index = dateLabel.column + 1; index <= Math.min(sheet.columnCount, dateLabel.column + 6); index += 1) {
        const candidate = sheet.getCell(dateLabel.row, index);
        if (cellText(candidate) === found.value) { dateCell = candidate; break; }
      }
      sourceDateRaw = cellText(dateCell) || null;
      quotationDate = toIsoDate(unwrap(dateCell.value), sourceDateRaw ?? "");
      fieldCells.quotationDate = { sheet: sheet.name, address: dateCell.address };
      fieldCells.sourceDateRaw = fieldCells.quotationDate;
      if (!quotationDate) warnings.push(`Date could not be parsed: ${sourceDateRaw}`);
    }
  }

  const addressLabel = findLabel(sheet, /^(?:address|ที่อยู่)\s*:?$/i);
  let customerAddress: string | null = null;
  if (addressLabel) {
    const firstLine = rightValue(sheet, addressLabel);
    if (firstLine) {
      const parts = [firstLine.value];
      const addressColumn = sheet.getCell(addressLabel.row, addressLabel.column + 1).col;
      for (let row = addressLabel.row + 1; row <= Math.min(sheet.rowCount, addressLabel.row + 2); row += 1) {
        const part = cellText(sheet.getCell(row, addressColumn));
        if (part && !isKnownLabel(part) && part !== firstLine.value) parts.push(part);
      }
      customerAddress = parts.join("\n");
      fieldCells.customerAddress = firstLine.cell;
    }
  }

  let customerTaxId: string | null = null;
  // Rows above the customer section are NTP's own company and tax information,
  // not the customer's. Historical forms keep customer tax data from row 7 onward.
  for (let row = 7; row <= Math.min(sheet.rowCount, 16) && !customerTaxId; row += 1) {
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      const text = cellText(sheet.getCell(row, column));
      if (!/เลขประจำตัวผู้เสียภาษี|tax\s*id/i.test(text)) continue;
      const inLabel = text.match(/(?:เลขประจำตัวผู้เสียภาษี|tax\s*id)\s*:?\s*([0-9\-]{10,})/i)?.[1];
      const afterLabel = rightValue(sheet, { row, column });
      const candidate = inLabel ?? afterLabel?.value ?? "";
      const taxId = candidate.match(/[0-9][0-9\-]{9,}/)?.[0] ?? null;
      if (taxId) {
        customerTaxId = taxId;
        fieldCells.customerTaxId = inLabel ? cellFor(sheet, row, column) : afterLabel!.cell;
        break;
      }
    }
  }

  const total = findTotal(sheet);
  if (total) fieldCells.totalAmount = total.cell;
  const remarks = textField("remarks", /^(?:หมายเหตุ|remark(?:s)?)\s*:?$/i);

  let email: string | null = null;
  for (let row = 7; row <= Math.min(sheet.rowCount, 18) && !email; row += 1) {
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      const cell = sheet.getCell(row, column);
      const found = cellText(cell).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
      if (found) {
        email = found;
        fieldCells.email = cellFor(sheet, row, column);
        break;
      }
    }
  }

  // The current worksheet links address, contact and tax id from its Customer
  // sheet. These cells do not have labels, so resolve them by the selected name.
  const customerSheet = workbook.getWorksheet("Customer");
  if (sheet.name === "Quotation" && customerSheet && customerName) {
    for (let row = 2; row <= customerSheet.rowCount; row += 1) {
      if (normalizedText(cellText(customerSheet.getCell(row, 1))) !== normalizedText(customerName)) continue;

      const addressLines = [cellText(customerSheet.getCell(row, 2)), cellText(customerSheet.getCell(row, 3))].filter(Boolean);
      if (!customerAddress && addressLines.length > 0) {
        customerAddress = addressLines.join("\n");
        fieldCells.customerAddress = cellFor(customerSheet, row, 2);
      }

      const taxText = cellText(customerSheet.getCell(row, 4));
      const taxId = taxText.match(/[0-9][0-9\-]{9,}/)?.[0] ?? null;
      if (!customerTaxId && taxId) {
        customerTaxId = taxId;
        fieldCells.customerTaxId = cellFor(customerSheet, row, 4);
      }

      const contact = cellText(customerSheet.getCell(row, 5));
      if (!attention && contact) {
        attention = contact;
        fieldCells.attention = cellFor(customerSheet, row, 5);
      }

      const contactEmail = cellText(customerSheet.getCell(row, 6)).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
      if (!email && contactEmail) {
        email = contactEmail;
        fieldCells.email = cellFor(customerSheet, row, 6);
      }

      const savedPaymentTerm = cellText(customerSheet.getCell(row, 10));
      if (!paymentTerm && savedPaymentTerm) {
        paymentTerm = savedPaymentTerm;
        fieldCells.paymentTerm = cellFor(customerSheet, row, 10);
      }
      break;
    }
  }

  return {
    archive,
    sourceFile,
    worksheet: sheet.name,
    quotationNo,
    quotationDate,
    sourceDateRaw,
    customerName,
    customerAddress,
    customerTaxId,
    boqNo: normalizeBoq(boqNo),
    projectName,
    totalAmount: total?.value ?? null,
    paymentTerm,
    attention,
    email,
    po,
    remarks,
    lineItems: findRows(sheet),
    fieldCells,
    parseWarnings: warnings,
  };
}

async function loadExistingQuotations(): Promise<ExistingQuotation[]> {
  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const results: ExistingQuotation[] = [];
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("quotations")
      .select("id, quotation_no, quotation_date, boq_no, customer_name_raw, project_name, total_amount, po, payment_term, remarks, attention, email, source_file, source_sheet, source_row, deleted_at")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Unable to read quotations: ${error.message}`);
    const page = (data ?? []) as ExistingQuotation[];
    results.push(...page);
    if (page.length < pageSize) return results;
  }
}

function sameValue(field: string, left: string | number | null, right: string | number | null): boolean {
  if (left === null || right === null || left === "" || right === "") return left === right;
  if (field === "totalAmount") return Math.round(Number(left) * 100) === Math.round(Number(right) * 100);
  if (field === "quotationDate") return String(left).slice(0, 10) === String(right).slice(0, 10);
  if (field === "boqNo") return normalizedText(normalizeBoq(String(left))) === normalizedText(normalizeBoq(String(right)));
  return normalizedText(String(left)) === normalizedText(String(right));
}

async function main(): Promise<void> {
  const parsed: ParsedQuotation[] = [];
  const unreadableFiles: { archive: string; sourceFile: string; error: string }[] = [];

  for (const archive of archives) {
    const contents = await readFile(archive.filePath);
    const zip = await JSZip.loadAsync(contents);
    const xlsxEntries = Object.values(zip.files)
      .filter((entry) => !entry.dir && /\.xlsx$/i.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name, "th"));

    console.log(`${path.basename(archive.filePath)}: reading ${xlsxEntries.length} Excel files`);
    for (let index = 0; index < xlsxEntries.length; index += 1) {
      const entry = xlsxEntries[index];
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load((await entry.async("nodebuffer")) as never);
        parsed.push(parseQuotation(workbook, path.basename(archive.filePath), entry.name));
      } catch (error) {
        unreadableFiles.push({
          archive: path.basename(archive.filePath),
          sourceFile: entry.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if ((index + 1) % 100 === 0 || index + 1 === xlsxEntries.length) {
        console.log(`  ${index + 1}/${xlsxEntries.length}`);
      }
    }
  }

  const existing = await loadExistingQuotations();
  const existingByQuotationNo = new Map<string, ExistingQuotation[]>();
  for (const quotation of existing) {
    const normalized = normalizeQuotationNo(quotation.quotation_no, "");
    if (!normalized) continue;
    const values = existingByQuotationNo.get(normalized) ?? [];
    values.push(quotation);
    existingByQuotationNo.set(normalized, values);
  }

  const sourceByQuotationNo = new Map<string, ParsedQuotation[]>();
  for (const quotation of parsed) {
    if (!quotation.quotationNo) continue;
    const values = sourceByQuotationNo.get(quotation.quotationNo) ?? [];
    values.push(quotation);
    sourceByQuotationNo.set(quotation.quotationNo, values);
  }

  const conflicts: Conflict[] = [];
  const ambiguousExisting: { quotationNo: string; databaseIds: string[]; sourceFiles: string[] }[] = [];
  const toCreate: { quotationNo: string; sourceFile: string; sourceDate: string | null; projectName: string | null }[] = [];
  const fillableFields: { quotationNo: string; databaseId: string; field: string; sourceFile: string; sourceCell: string | null; value: string | number }[] = [];
  const compareFields: { source: keyof ParsedQuotation; database: keyof ExistingQuotation }[] = [
    { source: "quotationDate", database: "quotation_date" },
    { source: "boqNo", database: "boq_no" },
    { source: "customerName", database: "customer_name_raw" },
    { source: "projectName", database: "project_name" },
    { source: "totalAmount", database: "total_amount" },
    { source: "po", database: "po" },
    { source: "paymentTerm", database: "payment_term" },
    { source: "remarks", database: "remarks" },
    { source: "attention", database: "attention" },
    { source: "email", database: "email" },
  ];

  for (const quotation of parsed) {
    if (!quotation.quotationNo) continue;
    const matched = existingByQuotationNo.get(quotation.quotationNo) ?? [];
    if (matched.length === 0) {
      toCreate.push({ quotationNo: quotation.quotationNo, sourceFile: quotation.sourceFile, sourceDate: quotation.quotationDate, projectName: quotation.projectName });
      continue;
    }
    if (matched.length > 1) {
      ambiguousExisting.push({ quotationNo: quotation.quotationNo, databaseIds: matched.map((item) => item.id), sourceFiles: [quotation.sourceFile] });
      continue;
    }
    const database = matched[0];
    for (const { source, database: databaseField } of compareFields) {
      const sourceValue = quotation[source] as string | number | null;
      const databaseValue = database[databaseField] as string | number | null;
      if (sourceValue === null || sourceValue === "") continue;
      const sourceCell = quotation.fieldCells[source as keyof ParsedQuotation["fieldCells"]]?.address ?? null;
      if (databaseValue === null || databaseValue === "") {
        fillableFields.push({ quotationNo: quotation.quotationNo, databaseId: database.id, field: source, sourceFile: quotation.sourceFile, sourceCell, value: sourceValue });
      } else if (!sameValue(source, sourceValue, databaseValue)) {
        conflicts.push({
          quotationNo: quotation.quotationNo,
          databaseId: database.id,
          databaseSource: [database.source_file, database.source_sheet, database.source_row].filter(Boolean).join(" / ") || "WEB",
          archive: quotation.archive,
          sourceFile: quotation.sourceFile,
          worksheet: quotation.worksheet,
          field: source,
          sourceCell,
          databaseValue,
          fileValue: sourceValue,
        });
      }
    }
  }

  const duplicateSources = Array.from(sourceByQuotationNo.entries())
    .filter(([, quotations]) => quotations.length > 1)
    .map(([quotationNo, quotations]) => ({ quotationNo, files: quotations.map((quotation) => quotation.sourceFile) }));

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "READ ONLY — no database changes were made",
    summary: {
      archiveFiles: parsed.length + unreadableFiles.length,
      parsedFiles: parsed.length,
      unreadableFiles: unreadableFiles.length,
      parsedWithQuotationNumber: parsed.filter((quotation) => quotation.quotationNo).length,
      existingDatabaseQuotations: existing.length,
      createCandidates: toCreate.length,
      fillableFields: fillableFields.length,
      conflicts: conflicts.length,
      ambiguousExistingNumbers: ambiguousExisting.length,
      duplicateSourceNumbers: duplicateSources.length,
    },
    conflicts,
    createCandidates: toCreate,
    fillableFields,
    ambiguousExisting,
    duplicateSources,
    unreadableFiles,
    parseWarnings: parsed.filter((quotation) => quotation.parseWarnings.length > 0).map((quotation) => ({ sourceFile: quotation.sourceFile, warnings: quotation.parseWarnings })),
    // Kept in the report so every proposed import can be checked by file and cell.
    parsedQuotations: parsed,
  };

  const reportDirectory = path.join(process.cwd(), "reports");
  await mkdir(reportDirectory, { recursive: true });
  const reportPath = path.join(reportDirectory, "quotation-archive-audit.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const csvCell = (value: string | number | null): string => {
    const text = value === null ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };
  const conflictHeaders = [
    "quotation_no",
    "field",
    "file_value",
    "database_value",
    "source_archive",
    "source_file",
    "worksheet",
    "source_cell",
    "database_id",
    "database_source",
  ];
  const conflictCsv = [
    conflictHeaders.join(","),
    ...conflicts.map((conflict) => [
      conflict.quotationNo,
      conflict.field,
      conflict.fileValue,
      conflict.databaseValue,
      conflict.archive,
      conflict.sourceFile,
      conflict.worksheet,
      conflict.sourceCell,
      conflict.databaseId,
      conflict.databaseSource,
    ].map(csvCell).join(",")),
  ];
  const conflictPath = path.join(reportDirectory, "quotation-archive-conflicts.csv");
  await writeFile(conflictPath, `\ufeff${conflictCsv.join("\n")}\n`, "utf8");

  console.log(`\nDry run complete — report: ${reportPath}`);
  console.log(`Conflicts for review: ${conflictPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
