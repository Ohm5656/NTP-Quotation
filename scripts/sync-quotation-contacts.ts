import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Synchronize quotation-specific contact name and email from the original
 * workbook. Customer contacts are deliberately not changed: one customer can
 * have different contacts on different quotations.
 *
 * Default: dry run. Use --commit to write changes.
 */

type ArchiveQuotation = {
  quotationNo: string | null;
  sourceFile: string;
  attention: string | null;
  email: string | null;
  parseWarnings: string[];
};

type AuditReport = {
  parsedQuotations: ArchiveQuotation[];
};

type DatabaseQuotation = {
  id: string;
  quotation_no: string | null;
  attention: string | null;
  email: string | null;
  deleted_at: string | null;
};

const commit = process.argv.includes("--commit");
const auditPath = path.join(process.cwd(), "reports", "quotation-archive-audit.json");
const resultPath = path.join(process.cwd(), "reports", "quotation-contact-sync-result.json");

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function normalizeQuotationNo(value: string | null | undefined): string | null {
  const text = String(value ?? "");
  const number = text.match(/(?:Q\s*)?(\d{7})(?!\d)/i)?.[1];
  if (!number) return null;
  const revision = text.match(/(?:REV(?:ISION)?\.?|R)\s*0*(\d+)\b/i)?.[1];
  return revision ? `${number} Rev.${revision.padStart(2, "0")}` : number;
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("en-US");
}

function cleanContact(value: string | null): string | null {
  const cleaned = (value ?? "")
    .replace(/\s*(?:e-?mail|email)\s*:?\s*[^\s]+@[^\s]+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function sourceEmail(source: ArchiveQuotation): string | null {
  return source.email
    ?? source.attention?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
    ?? null;
}

async function loadQuotations(supabase: import("@supabase/supabase-js").SupabaseClient): Promise<DatabaseQuotation[]> {
  const rows: DatabaseQuotation[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await supabase
      .from("quotations")
      .select("id, quotation_no, attention, email, deleted_at")
      .range(from, from + 999);
    if (error) throw new Error(`Unable to load quotations: ${error.message}`);
    const page = (data ?? []) as DatabaseQuotation[];
    rows.push(...page);
    if (page.length < 1_000) return rows;
  }
}

async function main(): Promise<void> {
  const audit = JSON.parse(await readFile(auditPath, "utf8")) as AuditReport;
  const supabase = createClient(
    requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const quotations = await loadQuotations(supabase);

  const sourcesByNumber = new Map<string, ArchiveQuotation[]>();
  for (const source of audit.parsedQuotations) {
    if (!source.quotationNo || source.parseWarnings.length > 0) continue;
    const group = sourcesByNumber.get(source.quotationNo) ?? [];
    group.push(source);
    sourcesByNumber.set(source.quotationNo, group);
  }

  const quotationsByNumber = new Map<string, DatabaseQuotation[]>();
  for (const quotation of quotations.filter((item) => item.deleted_at === null)) {
    const number = normalizeQuotationNo(quotation.quotation_no);
    if (!number) continue;
    const group = quotationsByNumber.get(number) ?? [];
    group.push(quotation);
    quotationsByNumber.set(number, group);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    mode: commit ? "COMMIT" : "DRY RUN",
    summary: {
      quotationsUpdated: 0,
      namesUpdated: 0,
      emailsUpdated: 0,
      skippedDuplicateSourceNumbers: 0,
      skippedDuplicateDatabaseNumbers: 0,
    },
    updates: [] as { quotationNo: string; quotationId: string; fields: string[]; before: { attention: string | null; email: string | null }; after: { attention: string | null; email: string | null }; sourceFile: string }[],
    skipped: [] as { quotationNo: string; reason: string; files: string[] }[],
  };

  for (const [quotationNo, sources] of sourcesByNumber) {
    if (sources.length !== 1) {
      result.summary.skippedDuplicateSourceNumbers += 1;
      result.skipped.push({ quotationNo, reason: "Multiple source workbooks use this quotation number.", files: sources.map((source) => source.sourceFile) });
      continue;
    }
    const matches = quotationsByNumber.get(quotationNo) ?? [];
    if (matches.length !== 1) {
      if (matches.length > 1) {
        result.summary.skippedDuplicateDatabaseNumbers += 1;
        result.skipped.push({ quotationNo, reason: "Multiple active database records use this quotation number.", files: [sources[0].sourceFile] });
      }
      continue;
    }

    const source = sources[0];
    const quotation = matches[0];
    const contact = cleanContact(source.attention);
    const email = sourceEmail(source);
    const changes: Record<string, string> = {};
    if (contact && normalize(contact) !== normalize(quotation.attention)) changes.attention = contact;
    if (email && normalize(email) !== normalize(quotation.email)) changes.email = email;
    if (Object.keys(changes).length === 0) continue;

    if (commit) {
      const { error } = await supabase.from("quotations").update(changes).eq("id", quotation.id);
      if (error) throw new Error(`Unable to update ${quotationNo}: ${error.message}`);
    }
    result.summary.quotationsUpdated += 1;
    if (changes.attention) result.summary.namesUpdated += 1;
    if (changes.email) result.summary.emailsUpdated += 1;
    result.updates.push({
      quotationNo,
      quotationId: quotation.id,
      fields: Object.keys(changes),
      before: { attention: quotation.attention, email: quotation.email },
      after: { attention: changes.attention ?? quotation.attention, email: changes.email ?? quotation.email },
      sourceFile: source.sourceFile,
    });
  }

  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`${commit ? "Contact sync" : "Contact sync dry run"} complete — ${resultPath}`);
  console.log(JSON.stringify(result.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
