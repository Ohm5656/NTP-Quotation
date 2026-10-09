import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin";

import {
  findLinkedCustomerProfile,
  normalizeCustomerProfileKey,
} from "@/lib/customer-profile-links";

export type CustomerProfile = {
  name: string;
  taxId: string;
  address: string;
  contact: string;
  email: string;
  paymentTerm: string;
};

const PROFILE_PATH = path.join(
  process.cwd(),
  "templates",
  "excel",
  "customer-profiles.xlsx",
);

export function normalizeCustomerName(value: string | null | undefined): string {
  return normalizeCustomerProfileKey(value);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  return String(value).trim();
}

async function getSpreadsheetCustomerProfiles(): Promise<CustomerProfile[]> {
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
      email: "",
      paymentTerm: cellText(row.getCell(5).value),
    });
  }
  return profiles;
}

async function getSavedCustomerProfiles(): Promise<CustomerProfile[]> {
  const supabase = createAdminSupabaseClient();
  const profiles: CustomerProfile[] = [];
  const batchSize = 1000;

  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabase
      .from("customers")
      .select("name, tax_id, address, contact, email, payment_term")
      .range(from, from + batchSize - 1);

    if (error) {
      throw new Error(`Unable to load saved customer details: ${error.message}`);
    }

    const batch = data ?? [];
    profiles.push(
      ...batch.map((customer) => ({
        name: customer.name?.trim() ?? "",
        taxId: customer.tax_id?.trim() ?? "",
        address: customer.address?.trim() ?? "",
        contact: customer.contact?.trim() ?? "",
        email: customer.email?.trim() ?? "",
        paymentTerm: customer.payment_term?.trim() ?? "",
      })).filter((profile) => profile.name),
    );

    if (batch.length < batchSize) {
      return profiles;
    }
  }
}

function mergeCustomerProfile(
  spreadsheetProfile: CustomerProfile,
  savedProfile: CustomerProfile | undefined,
): CustomerProfile {
  if (!savedProfile) return spreadsheetProfile;

  return {
    name: spreadsheetProfile.name,
    taxId: savedProfile.taxId || spreadsheetProfile.taxId,
    address: savedProfile.address || spreadsheetProfile.address,
    contact: savedProfile.contact || spreadsheetProfile.contact,
    email: savedProfile.email || spreadsheetProfile.email,
    paymentTerm: savedProfile.paymentTerm || spreadsheetProfile.paymentTerm,
  };
}

export async function getCustomerProfiles(): Promise<CustomerProfile[]> {
  const [spreadsheetProfiles, savedProfiles] = await Promise.all([
    getSpreadsheetCustomerProfiles(),
    getSavedCustomerProfiles(),
  ]);

  // Keep every saved display name, including English aliases. Dropping an
  // alias here also drops the contact/email the user just saved for that name.
  const mergedProfiles = savedProfiles.map((savedProfile) => {
    const template = findLinkedCustomerProfile(spreadsheetProfiles, savedProfile.name);
    return template ? { ...mergeCustomerProfile(template, savedProfile), name: savedProfile.name } : savedProfile;
  });
  for (const spreadsheetProfile of spreadsheetProfiles) {
    if (!mergedProfiles.some((profile) => normalizeCustomerName(profile.name) === normalizeCustomerName(spreadsheetProfile.name))) {
      mergedProfiles.push(spreadsheetProfile);
    }
  }

  return mergedProfiles;
}

export function findCustomerProfile(
  profiles: CustomerProfile[],
  customerName: string | null | undefined,
): CustomerProfile | undefined {
  return findLinkedCustomerProfile(profiles, customerName);
}

export function defaultPaymentTerm(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (text === "เงินสด") return "เครดิต 60 วัน";
  return /วัน|เครดิต|ชำระ/i.test(text) ? text : `เครดิต ${text} วัน`;
}
