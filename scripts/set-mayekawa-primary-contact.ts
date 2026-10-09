import path from "node:path";
import { writeFile } from "node:fs/promises";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * MAYEKAWA uses one current, company-level contact in this application.
 * This intentionally replaces historic quotation-level contacts so the
 * quotation list and the saved customer profile are consistent.
 *
 * Default: dry run. Use --commit to write the normalized data.
 */

const PRIMARY_CONTACT = "คุณฉัตรวัฒน์";
const PRIMARY_EMAIL = "chattrawat@mth.co.th";
const commit = process.argv.includes("--commit");
const resultPath = path.join(process.cwd(), "reports", "mayekawa-primary-contact-result.json");

type Customer = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
};

type Quotation = {
  id: string;
  quotation_no: string | null;
  customer_id: string | null;
  customer_name_raw: string | null;
  attention: string | null;
  email: string | null;
  deleted_at: string | null;
};

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function same(value: string | null, expected: string): boolean {
  return value?.trim().toLocaleLowerCase("en-US") === expected.toLocaleLowerCase("en-US");
}

function isMayekawa(value: string | null): boolean {
  return value?.toLocaleUpperCase("en-US").includes("MAYEKAWA") ?? false;
}

async function loadAll<T>(supabase: ReturnType<typeof createClient<any>>, table: string, select: string): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`Unable to load ${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    result.push(...page);
    if (page.length < 1_000) return result;
  }
}

async function updateQuotationBatch(
  supabase: ReturnType<typeof createClient<any>>,
  ids: string[],
): Promise<void> {
  for (let start = 0; start < ids.length; start += 250) {
    const { error } = await supabase
      .from("quotations")
      .update({ attention: PRIMARY_CONTACT, email: PRIMARY_EMAIL })
      .in("id", ids.slice(start, start + 250));
    if (error) throw new Error(`Unable to normalize MAYEKAWA quotations: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const supabase = createClient(
    requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const [customers, quotations] = await Promise.all([
    loadAll<Customer>(supabase, "customers", "id, name, contact, email"),
    loadAll<Quotation>(supabase, "quotations", "id, quotation_no, customer_id, customer_name_raw, attention, email, deleted_at"),
  ]);
  const mayekawaCustomers = customers.filter((customer) => isMayekawa(customer.name));
  const customerIds = new Set(mayekawaCustomers.map((customer) => customer.id));
  const mayekawaQuotations = quotations.filter((quotation) =>
    quotation.deleted_at === null
    && (customerIds.has(quotation.customer_id ?? "") || isMayekawa(quotation.customer_name_raw)),
  );
  const customerUpdates = mayekawaCustomers.filter((customer) =>
    !same(customer.contact, PRIMARY_CONTACT) || !same(customer.email, PRIMARY_EMAIL),
  );
  const quotationUpdates = mayekawaQuotations.filter((quotation) =>
    !same(quotation.attention, PRIMARY_CONTACT) || !same(quotation.email, PRIMARY_EMAIL),
  );

  const result = {
    generatedAt: new Date().toISOString(),
    mode: commit ? "COMMIT" : "DRY RUN",
    primaryContact: PRIMARY_CONTACT,
    primaryEmail: PRIMARY_EMAIL,
    summary: {
      matchedCustomerProfiles: mayekawaCustomers.length,
      customerProfilesToUpdate: customerUpdates.length,
      matchedActiveQuotations: mayekawaQuotations.length,
      activeQuotationsToUpdate: quotationUpdates.length,
    },
    samples: quotationUpdates.slice(0, 10).map((quotation) => ({
      quotationNo: quotation.quotation_no,
      previousAttention: quotation.attention,
      previousEmail: quotation.email,
    })),
  };

  if (commit) {
    if (customerUpdates.length > 0) {
      const { error } = await supabase
        .from("customers")
        .update({ contact: PRIMARY_CONTACT, email: PRIMARY_EMAIL })
        .in("id", customerUpdates.map((customer) => customer.id));
      if (error) throw new Error(`Unable to normalize MAYEKAWA customer profile: ${error.message}`);
    }
    await updateQuotationBatch(supabase, quotationUpdates.map((quotation) => quotation.id));
  }

  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result.summary, null, 2));
  console.log(`${commit ? "Normalized" : "Dry run"}: ${resultPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
