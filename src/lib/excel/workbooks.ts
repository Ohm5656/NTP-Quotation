import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";
import JSZip from "jszip";

import type {
  QuotationLineItem,
} from "@/types/database";

import {
  findCustomerProfile,
  getCustomerProfiles,
} from "@/lib/excel/customer-profiles";

export type ExportQuotation = {
  id: string;
  quotation_no: string | null;
  quotation_date: string | null;
  boq_no: string | null;
  customer_name_raw: string | null;
  project_name: string | null;
  total_amount: number | string | null;
  po: string | null;
  payment_term: string | null;
  remarks?: string | null;
  discount_amount?: number | string | null;
  vat_rate?: number | string | null;
  attention: string | null;
  email: string | null;
  source_row?: number | null;
  quotation_line_items?: QuotationLineItem[];
};

const TEMPLATE_DIR = path.join(process.cwd(), "templates", "excel");
const INITIAL_LINE_COUNT = 12;
const FIRST_LINE_ROW = 18;
const REGISTER_FIRST_DATA_ROW = 2;

const THAI_DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function finiteNumber(value: number | string | null | undefined): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function thaiIntegerText(value: number, hasHigherPlaces = false): string {
  if (value === 0) return "ศูนย์";
  if (value >= 1_000_000) {
    const millions = Math.floor(value / 1_000_000);
    const remainder = value % 1_000_000;
    return `${thaiIntegerText(millions, hasHigherPlaces)}ล้าน${remainder ? thaiIntegerText(remainder, true) : ""}`;
  }

  const text = String(value);
  return [...text].map((character, index) => {
    const digit = Number(character);
    if (!digit) return "";

    const place = text.length - index - 1;
    if (place === 0 && digit === 1 && (text.length > 1 || hasHigherPlaces)) return "เอ็ด";
    if (place === 1 && digit === 1) return "สิบ";
    if (place === 1 && digit === 2) return "ยี่สิบ";
    return `${THAI_DIGITS[digit]}${THAI_PLACES[place]}`;
  }).join("");
}

function thaiBahtText(value: number): string {
  const satangTotal = Math.round(Math.max(0, value) * 100);
  const baht = Math.floor(satangTotal / 100);
  const satang = satangTotal % 100;
  return `${thaiIntegerText(baht)}บาท${satang ? `${thaiIntegerText(satang)}สตางค์` : "ถ้วน"}`;
}

function splitRemarks(value: string | null | undefined): [string, string] {
  const lines = (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return [lines[0] ?? "", lines.slice(1).join("\n")];
}

function thaiExcelDate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]) + 543, Number(match[2]) - 1, Number(match[3])));
}

function splitAddress(address: string): [string, string] {
  const lines = address.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return [lines[0], lines.slice(1).join(" ")];
  const clean = address.replace(/\s+/g, " ").trim();
  if (!clean) return ["", ""];
  const words = clean.split(" ");
  if (words.length < 4) return [clean, ""];
  const splitAt = Math.ceil(words.length / 2);
  return [words.slice(0, splitAt).join(" "), words.slice(splitAt).join(" ")];
}

function dateOrBlank(value: string | null): Date | string {
  return thaiExcelDate(value) ?? "";
}

function thaiDateText(value: string | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${Number(match[1]) + 543}`;
}

function prefixedRegisterText(value: string | null, prefix: string): string {
  const text = value?.trim() ?? "";
  if (!text || text === "-") return "";
  return text.toUpperCase().startsWith(prefix) ? `${prefix}${text.slice(prefix.length)}` : `${prefix}${text}`;
}

function registerText(value: string | null): string {
  const text = value?.trim() ?? "";
  return text === "-" ? "" : text;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function registerCell(address: string, style: string, value: string | number | null): string {
  if (value === null || value === "") return `<c r="${address}" s="${style}"/>`;
  if (typeof value === "number") return `<c r="${address}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function registerStyleMap(templateRow: string): Record<string, string> {
  return Object.fromEntries(
    Array.from("ABCDEFGHI", (column) => {
      const match = new RegExp(`<c\\b[^>]*\\br="${column}\\d+"[^>]*\\bs="(\\d+)"`).exec(templateRow);
      if (!match) throw new Error(`Quotation register style is missing for column ${column}`);
      return [column, match[1]];
    }),
  );
}

function sharedStringItems(sharedStringsXml: string): string[] {
  const items: string[] = [];
  sharedStringsXml.replace(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g, (_match, content: string) => {
    items.push(content);
    return _match;
  });
  return items;
}

function inlineSharedStringCells(worksheetXml: string, sharedStrings: string[]): string {
  const sharedCellCount = (worksheetXml.match(/\bt="s"/g) ?? []).length;
  let replacedCellCount = 0;
  const inlined = worksheetXml.replace(
    /<c\b([^>]*?)\bt="s"([^>]*)><v>(\d+)<\/v><\/c>/g,
    (_cell, beforeType: string, afterType: string, indexText: string) => {
      const content = sharedStrings[Number(indexText)];
      if (content === undefined) throw new Error(`Quotation register shared string ${indexText} is missing`);
      replacedCellCount += 1;
      return `<c${beforeType}${afterType} t="inlineStr"><is>${content}</is></c>`;
    },
  );
  if (replacedCellCount !== sharedCellCount) {
    throw new Error("Quotation register contains an unsupported shared-string cell");
  }
  return inlined;
}

function copyRowFormat(worksheet: ExcelJS.Worksheet, sourceRowNumber: number, targetRowNumber: number) {
  const source = worksheet.getRow(sourceRowNumber);
  const target = worksheet.getRow(targetRowNumber);
  target.height = source.height;
  for (let column = 1; column <= 9; column += 1) {
    const sourceCell = source.getCell(column);
    const targetCell = target.getCell(column);
    targetCell.style = structuredClone(sourceCell.style);
    targetCell.numFmt = sourceCell.numFmt;
  }
}

export async function buildQuotationWorkbook(quotation: ExportQuotation): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await readFile(path.join(TEMPLATE_DIR, "quotation-form.xlsx"))) as never);
  const sheet = workbook.getWorksheet("Quotation");
  if (!sheet) throw new Error("Quotation template worksheet is missing");

  const profile = findCustomerProfile(await getCustomerProfiles(), quotation.customer_name_raw);
  const [addressLineOne, addressLineTwo] = splitAddress(profile?.address ?? "");
  const paymentTerm = quotation.payment_term?.trim() ?? "";

  // Keep the quotation's original display name (for example, an English legal name)
  // while still using the linked profile for address and tax data.
  sheet.getCell("C10").value = quotation.customer_name_raw ?? profile?.name ?? "";
  sheet.getCell("C11").value = addressLineOne;
  sheet.getCell("C12").value = addressLineTwo;
  sheet.getCell("C13").value = profile?.taxId ? `เลขประจำตัวผู้เสียภาษี : ${profile.taxId}` : "เลขประจำตัวผู้เสียภาษี :";
  sheet.getCell("C14").value = quotation.attention?.trim() ?? "";
  sheet.getCell("F10").value = dateOrBlank(quotation.quotation_date);
  sheet.getCell("F11").value = prefixedRegisterText(quotation.quotation_no, "Q");
  sheet.getCell("F12").value = prefixedRegisterText(quotation.boq_no, "BOQ");
  sheet.getCell("F13").value = paymentTerm;
  sheet.getCell("C15").value = quotation.project_name ?? "";

  const lineItems = [...(quotation.quotation_line_items ?? [])]
    .sort((a, b) => a.line_no - b.line_no);

  const dataRowCount = Math.max(INITIAL_LINE_COUNT, lineItems.length);
  const summaryStartRow = FIRST_LINE_ROW + dataRowCount;

  if (dataRowCount > INITIAL_LINE_COUNT) {
    const extraRows = dataRowCount - INITIAL_LINE_COUNT;
    // ExcelJS splices cell values but does not move merged-cell ranges.
    const shiftedMerges = [...(sheet.model.merges ?? [])].filter((range) => Number(range.match(/\d+/)?.[0]) >= FIRST_LINE_ROW + INITIAL_LINE_COUNT);
    for (const range of shiftedMerges) sheet.unMergeCells(range);
    sheet.spliceRows(
      FIRST_LINE_ROW + INITIAL_LINE_COUNT,
      0,
      ...Array.from({ length: extraRows }, () => []),
    );

    for (let index = 0; index < extraRows; index += 1) {
      copyRowFormat(
        sheet,
        FIRST_LINE_ROW + INITIAL_LINE_COUNT - 1,
        FIRST_LINE_ROW + INITIAL_LINE_COUNT + index,
      );
    }
    for (const range of shiftedMerges) {
      sheet.mergeCells(range.replace(/\d+/g, (row) => String(Number(row) + extraRows)));
    }
    if (sheet.pageSetup.printArea) {
      sheet.pageSetup.printArea = sheet.pageSetup.printArea.replace(/(:[A-Z]+)(\d+)/g, (_match, column, row) => `${column}${Number(row) + extraRows}`);
    }
  }

  let visibleNumber = 0;
  for (let index = 0; index < dataRowCount; index += 1) {
    const rowNumber = FIRST_LINE_ROW + index;
    const row = sheet.getRow(rowNumber);
    for (let column = 2; column <= 7; column += 1) row.getCell(column).value = null;

    const item = lineItems[index];
    if (!item) continue;
    if (item.show_item_number) visibleNumber += 1;
    const price = finiteNumber(item.unit_price);
    const quantity = finiteNumber(item.quantity);

    row.getCell(2).value = item.show_item_number ? visibleNumber : "";
    row.getCell(3).value = item.description;
    row.getCell(4).value = item.unit_price === null ? "" : price;
    row.getCell(5).value = item.quantity === null ? "" : quantity;
    row.getCell(6).value = item.unit?.toUpperCase() ?? "";
    row.getCell(7).value = item.unit_price === null || item.quantity === null
      ? ""
      : { formula: `D${rowNumber}*E${rowNumber}`, result: price * quantity };
  }

  const hasPrices = lineItems.some((item) => item.unit_price !== null || item.quantity !== null);
  const discount = Math.max(0, roundMoney(finiteNumber(quotation.discount_amount)));
  const vatRate = Math.max(0, finiteNumber(quotation.vat_rate ?? 0.07));
  const savedTotal = roundMoney(finiteNumber(quotation.total_amount));
  const total = hasPrices ? roundMoney(lineItems.reduce((sum, item) => (
    sum + finiteNumber(item.unit_price) * finiteNumber(item.quantity)
  ), 0)) : roundMoney(savedTotal / (1 + vatRate) + discount);
  const subtotal = Math.max(0, roundMoney(total - discount));
  const vat = roundMoney(subtotal * vatRate);
  const grandTotal = hasPrices ? roundMoney(subtotal + vat) : savedTotal;
  const totalRow = summaryStartRow;
  const discountRow = summaryStartRow + 1;
  const subtotalRow = summaryStartRow + 2;
  const vatRow = summaryStartRow + 3;
  const grandTotalRow = summaryStartRow + 4;
  const [note, paymentNote] = splitRemarks(quotation.remarks);

  sheet.getCell(`B${totalRow}`).value = {
    richText: [
      { text: "หมายเหตุ  " },
      {
        text: note,
        font: {
          name: "Angsana New",
          size: 18,
          family: 1,
          color: { argb: "FF000000" },
        },
      },
    ],
  };
  sheet.getCell(`B${discountRow}`).value = paymentNote || (paymentTerm
    ? `เงื่อนไขการชำระเงิน : ${paymentTerm}`
    : "เงื่อนไขการชำระเงิน :");
  sheet.getCell(`B${totalRow}`).alignment = { ...sheet.getCell(`B${totalRow}`).alignment, wrapText: true };
  sheet.getCell(`B${discountRow}`).alignment = { ...sheet.getCell(`B${discountRow}`).alignment, wrapText: true };
  sheet.getRow(discountRow).height = Math.max(sheet.getRow(discountRow).height ?? 25.8, 25.8 * Math.max(1, paymentNote.split("\n").length));
  sheet.getCell(`G${totalRow}`).value = hasPrices ? {
    formula: `SUM(G${FIRST_LINE_ROW}:G${summaryStartRow - 1})`,
    result: total,
  } : total;
  sheet.getCell(`G${discountRow}`).value = discount;
  sheet.getCell(`G${subtotalRow}`).value = {
    formula: `SUM(G${totalRow}-G${discountRow})`,
    result: subtotal,
  };
  sheet.getCell(`E${vatRow}`).value = vatRate;
  sheet.getCell(`G${vatRow}`).value = { formula: `G${subtotalRow}*E${vatRow}`, result: vat };
  sheet.getCell(`B${grandTotalRow}`).value = {
    formula: `BAHTTEXT(G${grandTotalRow})`,
    result: thaiBahtText(grandTotal),
  };
  sheet.getCell(`C${grandTotalRow}`).value = {
    formula: `BAHTTEXT(G${grandTotalRow})`,
    result: thaiBahtText(grandTotal),
  };
  sheet.getCell(`G${grandTotalRow}`).value = {
    formula: `G${subtotalRow}+G${vatRow}`,
    result: grandTotal,
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildQuotationRegisterWorkbook(quotations: ExportQuotation[]): Promise<Buffer> {
  // Patch only the worksheet values inside the original XLSX archive. Loading and
  // saving this legacy file through ExcelJS rewrites its column metadata, which can
  // make Excel display every column at the default width. Keeping the archive intact
  // preserves the source workbook's exact fonts, colours, widths and print settings.
  const template = await readFile(path.join(TEMPLATE_DIR, "quotation-register.xlsx"));
  const archive = await JSZip.loadAsync(template);
  const worksheet = archive.file("xl/worksheets/sheet1.xml");
  if (!worksheet) throw new Error("Quotation register template worksheet is missing");

  let worksheetXml = await worksheet.async("string");
  const sheetData = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(worksheetXml);
  if (!sheetData) throw new Error("Quotation register template data is missing");

  const templateRows = sheetData[1].match(/<row\b[\s\S]*?<\/row>/g) ?? [];
  const headerRow = templateRows.find((row) => /<row\b[^>]*\br="1"(?:\s|>)/.test(row));
  const templateDataRow = templateRows.at(-1);
  if (!headerRow || !templateDataRow) {
    throw new Error("Quotation register template rows are missing");
  }

  const styles = registerStyleMap(templateDataRow);
  const templateRowTag = /^<row\b[^>]*>/.exec(templateDataRow)?.[0];
  if (!templateRowTag) throw new Error("Quotation register row format is missing");

  const dataRows = quotations.map((quotation, index) => {
    const rowNumber = REGISTER_FIRST_DATA_ROW + index;
    const rowTag = templateRowTag.replace(/\br="\d+"/, `r="${rowNumber}"`);
    const total = quotation.total_amount === null ? null : finiteNumber(quotation.total_amount);

    return `${rowTag}${[
      registerCell(`A${rowNumber}`, styles.A, thaiDateText(quotation.quotation_date)),
      registerCell(`B${rowNumber}`, styles.B, prefixedRegisterText(quotation.quotation_no, "Q")),
      registerCell(`C${rowNumber}`, styles.C, prefixedRegisterText(quotation.boq_no, "BOQ")),
      registerCell(`D${rowNumber}`, styles.D, quotation.customer_name_raw ?? ""),
      registerCell(`E${rowNumber}`, styles.E, quotation.project_name ?? ""),
      registerCell(`F${rowNumber}`, styles.F, total),
      registerCell(`G${rowNumber}`, styles.G, registerText(quotation.po)),
      registerCell(`H${rowNumber}`, styles.H, quotation.attention ?? ""),
      registerCell(`I${rowNumber}`, styles.I, quotation.email ?? ""),
    ].join("")}</row>`;
  }).join("");

  const lastRow = Math.max(1, quotations.length + 1);
  worksheetXml = worksheetXml
    .replace(/<dimension\b[^>]*\bref="[^"]*"[^>]*\/>/, `<dimension ref="A1:I${lastRow}"/>`)
    .replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${headerRow}${dataRows}</sheetData>`)
    .replace(/<hyperlinks>[\s\S]*?<\/hyperlinks>/, "")
    .replace(
      /<sheetViews>[\s\S]*?<\/sheetViews>/,
      '<sheetViews><sheetView tabSelected="1" zoomScale="113" zoomScaleNormal="113" zoomScaleSheetLayoutView="85" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>',
    );

  archive.file("xl/worksheets/sheet1.xml", worksheetXml);

  // The source workbook has three worksheets sharing one string table. Once the
  // register rows are replaced, the old table's reference counts no longer match
  // and desktop Excel treats the file as corrupt. Inline every shared string in
  // all worksheets, then remove the now-unused table and its package metadata.
  const sharedStringsFile = archive.file("xl/sharedStrings.xml");
  if (!sharedStringsFile) throw new Error("Quotation register shared strings are missing");
  const sharedStrings = sharedStringItems(await sharedStringsFile.async("string"));
  const worksheetPaths = Object.keys(archive.files)
    .filter((filePath) => /^xl\/worksheets\/sheet\d+\.xml$/.test(filePath));
  for (const worksheetPath of worksheetPaths) {
    const worksheetPart = archive.file(worksheetPath);
    if (!worksheetPart) continue;
    archive.file(
      worksheetPath,
      inlineSharedStringCells(await worksheetPart.async("string"), sharedStrings),
    );
  }
  archive.remove("xl/sharedStrings.xml");
  archive.remove("xl/calcChain.xml");

  const relationshipsFile = archive.file("xl/_rels/workbook.xml.rels");
  const contentTypesFile = archive.file("[Content_Types].xml");
  if (!relationshipsFile || !contentTypesFile) {
    throw new Error("Quotation register package metadata is missing");
  }
  archive.file(
    "xl/_rels/workbook.xml.rels",
    (await relationshipsFile.async("string"))
      .replace(/<Relationship\b[^>]*\bType="[^"]*\/(?:sharedStrings|calcChain)"[^>]*\/>/g, ""),
  );
  archive.file(
    "[Content_Types].xml",
    (await contentTypesFile.async("string"))
      .replace(/<Override\b[^>]*\bPartName="\/xl\/(?:sharedStrings|calcChain)\.xml"[^>]*\/>/g, ""),
  );

  return archive.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
