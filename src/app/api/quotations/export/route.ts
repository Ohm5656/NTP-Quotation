import { NextResponse } from "next/server";

import { buildQuotationRegisterWorkbook, type ExportQuotation } from "@/lib/excel/workbooks";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BATCH_SIZE = 1000;

function registerOrder(quotation: ExportQuotation): [number, number, number, number, number] {
  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(quotation.quotation_date ?? "");
  const number = /(?:^|\D)(\d{2})(\d{2})(\d{3})(?:\D|$)/.exec(quotation.quotation_no ?? "");
  const year = date ? Number(date[1]) + 543 : number ? 2500 + Number(number[1]) : 9999;
  const month = date ? Number(date[2]) : number ? Number(number[2]) : 99;
  const sequence = number ? Number(number[3]) : quotation.source_row ?? Number.MAX_SAFE_INTEGER;
  const day = date ? Number(date[3]) : 0;
  return [year, month, sequence, day, quotation.source_row ?? Number.MAX_SAFE_INTEGER];
}

function compareRegisterOrder(left: ExportQuotation, right: ExportQuotation): number {
  const leftOrder = registerOrder(left);
  const rightOrder = registerOrder(right);
  for (let index = 0; index < leftOrder.length; index += 1) {
    const difference = leftOrder[index] - rightOrder[index];
    if (difference !== 0) return difference;
  }
  return (left.quotation_no ?? "").localeCompare(right.quotation_no ?? "", "th");
}

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const quotations: ExportQuotation[] = [];

  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("quotations")
      .select("id, quotation_no, quotation_date, boq_no, customer_name_raw, project_name, total_amount, po, payment_term, attention, email, source_row")
      .is("deleted_at", null)
      .order("quotation_date", { ascending: true, nullsFirst: false })
      .order("source_row", { ascending: true })
      .range(from, from + BATCH_SIZE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const batch = (data ?? []) as ExportQuotation[];
    quotations.push(...batch);
    if (batch.length < BATCH_SIZE) break;
  }

  quotations.sort(compareRegisterOrder);
  const content = await buildQuotationRegisterWorkbook(quotations);
  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=quotation-register.xlsx",
      "Cache-Control": "no-store",
    },
  });
}
