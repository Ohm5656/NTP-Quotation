import { NextResponse } from "next/server";

import { buildQuotationWorkbook, type ExportQuotation } from "@/lib/excel/workbooks";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function fileNamePart(value: string | null): string {
  return (value ?? "quotation").replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { data, error } = await createAdminSupabaseClient()
    .from("quotations")
    .select("id, quotation_no, quotation_date, boq_no, customer_name_raw, project_name, total_amount, po, payment_term, attention, email")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

  const content = await buildQuotationWorkbook(data as ExportQuotation);
  const filename = `quotation-${fileNamePart(data.quotation_no)}.xlsx`;
  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
