import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

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
  attention: string | null;
  email: string | null;
  source_row?: number | null;
};

const TEMPLATE_DIR = path.join(process.cwd(), "templates", "excel");

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

  sheet.getCell("C10").value = profile?.name ?? quotation.customer_name_raw ?? "";
  sheet.getCell("C11").value = addressLineOne;
  sheet.getCell("C12").value = addressLineTwo;
  sheet.getCell("C13").value = profile?.taxId ? `เลขประจำตัวผู้เสียภาษี : ${profile.taxId}` : "เลขประจำตัวผู้เสียภาษี :";
  sheet.getCell("C14").value = quotation.attention?.trim() || profile?.contact || "";
  sheet.getCell("F10").value = dateOrBlank(quotation.quotation_date);
  sheet.getCell("F11").value = quotation.quotation_no ?? "";
  sheet.getCell("F12").value = quotation.boq_no ?? "";
  sheet.getCell("F13").value = paymentTerm;
  sheet.getCell("C15").value = quotation.project_name ?? "";

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
