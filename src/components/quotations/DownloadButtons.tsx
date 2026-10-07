"use client";

import { Download, FileSpreadsheet } from "lucide-react";

export function DownloadQuotationButton({ id, quotationNo }: { id: string; quotationNo: string | null }) {
  return (
    <a
      href={`/api/quotations/${id}/excel`}
      title="ดาวน์โหลดฟอร์มใบเสนอราคา"
      aria-label={`ดาวน์โหลดฟอร์มใบเสนอราคา ${quotationNo ?? ""}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#16803f] transition hover:bg-[#edf9f0] hover:text-[#0d652e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16803f]/35"
    >
      <FileSpreadsheet size={17} />
    </a>
  );
}

export function DownloadAllQuotationsButton() {
  return (
    <a
      href="/api/quotations/export"
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#15803d] bg-white px-4 text-sm font-semibold text-[#126b33] transition hover:bg-[#edf9f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803d]/30"
    >
      <Download size={17} />
      ดาวน์โหลดทั้งหมด
    </a>
  );
}
