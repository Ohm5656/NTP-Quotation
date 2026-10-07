import { NextResponse } from "next/server";

import { buildQuotationRegisterWorkbook, type ExportQuotation } from "@/lib/excel/workbooks";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BATCH_SIZE = 1000;

export async function GET() {
  const supabase = createAdminSupabaseClient();
  const quotations: ExportQuotation[] = [];

  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("quotations")
      .select("id, quotation_no, quotation_date, boq_no, customer_name_raw, project_name, total_amount, po, payment_term, attention, email, source_row")
      .is("deleted_at", null)
      .order("quotation_date", { ascending: false, nullsFirst: false })
      .order("source_row", { ascending: false })
      .range(from, from + BATCH_SIZE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const batch = (data ?? []) as ExportQuotation[];
    quotations.push(...batch);
    if (batch.length < BATCH_SIZE) break;
  }

  const content = await buildQuotationRegisterWorkbook(quotations);
  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=quotation-register.xlsx",
      "Cache-Control": "no-store",
    },
  });
}
