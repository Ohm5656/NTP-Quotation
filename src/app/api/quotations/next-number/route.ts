import { NextResponse } from "next/server";
import { getNextQuotationNumber } from "@/lib/queries/quotations";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  try {
    return NextResponse.json({ quotationNo: await getNextQuotationNumber(date) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to get quotation number" }, { status: 400 });
  }
}
