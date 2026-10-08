import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import type {
  QuotationLineItem,
} from "@/types/database";

import {
  defaultPaymentTerm,
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
const MAX_LINE_COUNT = 50;
const FIRST_LINE_ROW = 18;

function thaiExcelDate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]) + 543, Number(match[2]) - 1, Number(match[3])));
}

function splitAddress(address: string): [string, string] {
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
  const paymentTerm = quotation.payment_term?.trim() || defaultPaymentTerm(profile?.paymentTerm);

  // Keep the quotation's original display name (for example, an English legal name)
  // while still using the linked profile for address and tax data.
  sheet.getCell("C10").value = quotation.customer_name_raw ?? profile?.name ?? "";
  sheet.getCell("C11").value = addressLineOne;
  sheet.getCell("C12").value = addressLineTwo;
  sheet.getCell("C13").value = profile?.taxId ? `เลขประจำตัวผู้เสียภาษี : ${profile.taxId}` : "เลขประจำตัวผู้เสียภาษี :";
  sheet.getCell("C14").value = quotation.attention?.trim() || profile?.contact || "";
  sheet.getCell("F10").value = dateOrBlank(quotation.quotation_date);
  sheet.getCell("F11").value = quotation.quotation_no ?? "";
  sheet.getCell("F12").value = quotation.boq_no ?? "";
  sheet.getCell("F13").value = paymentTerm;
  sheet.getCell("C15").value = quotation.project_name ?? "";

  const lineItems = [...(quotation.quotation_line_items ?? [])]
    .sort((a, b) => a.line_no - b.line_no)
    .slice(0, MAX_LINE_COUNT);

  const dataRowCount = Math.max(INITIAL_LINE_COUNT, lineItems.length);
  const summaryStartRow = FIRST_LINE_ROW + dataRowCount;

  if (dataRowCount > INITIAL_LINE_COUNT) {
    const extraRows = dataRowCount - INITIAL_LINE_COUNT;
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
  }

  let visibleNumber = 0;
  for (let index = 0; index < dataRowCount; index += 1) {
    const rowNumber = FIRST_LINE_ROW + index;
    const row = sheet.getRow(rowNumber);
    for (let column = 2; column <= 7; column += 1) row.getCell(column).value = null;

    const item = lineItems[index];
    if (!item) continue;
    if (item.show_item_number) visibleNumber += 1;
    const price = Number(item.unit_price ?? 0);
    const quantity = Number(item.quantity ?? 0);

    row.getCell(2).value = item.show_item_number ? visibleNumber : "";
    row.getCell(3).value = item.description;
    row.getCell(4).value = item.unit_price === null ? "" : price;
    row.getCell(5).value = item.quantity === null ? "" : quantity;
    row.getCell(6).value = item.unit ?? "";
    row.getCell(7).value = item.unit_price === null || item.quantity === null
      ? ""
      : { formula: `D${rowNumber}*E${rowNumber}`, result: price * quantity };
  }

  const discount = Number(quotation.discount_amount ?? 0);
  const vatRate = Number(quotation.vat_rate ?? 0.07);
  const totalRow = summaryStartRow;
  const discountRow = summaryStartRow + 1;
  const subtotalRow = summaryStartRow + 2;
  const vatRow = summaryStartRow + 3;
  const grandTotalRow = summaryStartRow + 4;

  sheet.getCell(`B${totalRow}`).value = quotation.remarks?.trim()
    ? `หมายเหตุ  ${quotation.remarks.trim()}`
    : "หมายเหตุ";
  sheet.getCell(`B${discountRow}`).value = paymentTerm
    ? `เงื่อนไขการชำระเงิน : ${paymentTerm}`
    : "เงื่อนไขการชำระเงิน :";
  sheet.getCell(`G${totalRow}`).value = { formula: `SUM(G${FIRST_LINE_ROW}:G${summaryStartRow - 1})` };
  sheet.getCell(`G${discountRow}`).value = discount;
  sheet.getCell(`G${subtotalRow}`).value = { formula: `SUM(G${totalRow}-G${discountRow})` };
  sheet.getCell(`E${vatRow}`).value = vatRate;
  sheet.getCell(`G${vatRow}`).value = { formula: `G${subtotalRow}*E${vatRow}` };
  sheet.getCell(`B${grandTotalRow}`).value = { formula: `BAHTTEXT(G${grandTotalRow})` };
  sheet.getCell(`C${grandTotalRow}`).value = { formula: `BAHTTEXT(G${grandTotalRow})` };
  sheet.getCell(`G${grandTotalRow}`).value = { formula: `G${subtotalRow}+G${vatRow}` };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildQuotationRegisterWorkbook(quotations: ExportQuotation[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await readFile(path.join(TEMPLATE_DIR, "quotation-register.xlsx"))) as never);
  const sheet = workbook.getWorksheet("ใบเสนอราคา") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("Quotation register template worksheet is missing");

  const firstDataRow = 2;
  const existingRows = Math.max(sheet.rowCount, firstDataRow);
  const rowsNeeded = firstDataRow + quotations.length - 1;

  for (let rowNumber = existingRows + 1; rowNumber <= rowsNeeded; rowNumber += 1) {
    copyRowFormat(sheet, firstDataRow, rowNumber);
  }

  const lastRow = Math.max(existingRows, rowsNeeded);
  for (let rowNumber = firstDataRow; rowNumber <= lastRow; rowNumber += 1) {
    for (let column = 1; column <= 9; column += 1) sheet.getRow(rowNumber).getCell(column).value = null;
  }

  quotations.forEach((quotation, index) => {
    const row = sheet.getRow(firstDataRow + index);
    row.getCell(1).value = dateOrBlank(quotation.quotation_date);
    row.getCell(2).value = quotation.quotation_no ?? "";
    row.getCell(3).value = quotation.boq_no ?? "";
    row.getCell(4).value = quotation.customer_name_raw ?? "";
    row.getCell(5).value = quotation.project_name ?? "";
    row.getCell(6).value = quotation.total_amount === null ? "" : Number(quotation.total_amount ?? 0);
    row.getCell(7).value = quotation.po ?? "";
    row.getCell(8).value = quotation.attention ?? "";
    row.getCell(9).value = quotation.email ?? "";
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
