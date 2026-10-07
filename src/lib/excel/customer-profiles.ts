import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

export type CustomerProfile = {
  name: string;
  taxId: string;
  address: string;
  contact: string;
  paymentTerm: string;
};

const PROFILE_PATH = path.join(
  process.cwd(),
  "templates",
  "excel",
  "customer-profiles.xlsx",
);

export function normalizeCustomerName(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("th")
    .replace(/[.(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  return String(value).trim();
}

export async function getCustomerProfiles(): Promise<CustomerProfile[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await readFile(PROFILE_PATH)) as never);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const profiles: CustomerProfile[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const name = cellText(row.getCell(2).value);
    if (!name) continue;

    profiles.push({
      taxId: cellText(row.getCell(1).value),
      name,
      address: cellText(row.getCell(3).value),
      contact: cellText(row.getCell(4).value),
      paymentTerm: cellText(row.getCell(5).value),
    });
  }
  return profiles;
}

export function findCustomerProfile(
  profiles: CustomerProfile[],
  customerName: string | null | undefined,
): CustomerProfile | undefined {
  const normalized = normalizeCustomerName(customerName);
  if (!normalized) return undefined;
  return profiles.find((profile) => normalizeCustomerName(profile.name) === normalized);
}

export function defaultPaymentTerm(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  return /วัน|เครดิต|ชำระ/i.test(text) ? text : `เครดิต ${text} วัน`;
}
