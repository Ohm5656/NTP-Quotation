"use client";

import { ListPlus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { QuotationLineItem } from "@/types/database";

type DraftItem = {
  key: string;
  description: string;
  unitPrice: string;
  quantity: string;
  unit: string;
  showItemNumber: boolean;
};

type Props = {
  initialItems?: QuotationLineItem[];
  initialRemarks?: string | null;
  initialDiscount?: number | string | null;
  initialVatRate?: number | string | null;
  initialTotal?: number | string | null;
  isNew: boolean;
};

function numberText(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function asNumber(value: string): number {
  const number = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function makeDraft(item?: QuotationLineItem, index = 0): DraftItem {
  return {
    key: item?.id ?? `new-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    description: item?.description ?? "",
    unitPrice: numberText(item?.unit_price),
    quantity: numberText(item?.quantity),
    unit: item?.unit ?? "",
    showItemNumber: item?.show_item_number ?? true,
  };
}

export function QuotationLineItemsEditor({
  initialItems = [],
  initialRemarks,
  initialDiscount,
  initialVatRate,
  initialTotal,
  isNew,
}: Props) {
  const [items, setItems] = useState<DraftItem[]>(() => {
    if (initialItems.length) return initialItems.map(makeDraft);
    return isNew ? [makeDraft()] : [];
  });
  const [remarks, setRemarks] = useState(initialRemarks ?? "ยืนราคา 30 วันนับจากวันเสนอราคา");
  const [discount, setDiscount] = useState(numberText(initialDiscount ?? 0));
  const [vatPercent, setVatPercent] = useState(String(Number(initialVatRate ?? 0.07) * 100));

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + asNumber(item.unitPrice) * asNumber(item.quantity), 0);
    const discountAmount = asNumber(discount);
    const beforeVat = Math.max(0, subtotal - discountAmount);
    const vatRate = Math.max(0, asNumber(vatPercent)) / 100;
    const vat = beforeVat * vatRate;
    return { subtotal, discountAmount, vatRate, vat, grandTotal: beforeVat + vat };
  }, [items, discount, vatPercent]);

  const serializedItems = JSON.stringify(
    items
      .filter((item) => item.description.trim())
      .map((item, index) => ({
        line_no: index + 1,
        description: item.description.trim(),
        unit_price: asNumber(item.unitPrice) || null,
        quantity: asNumber(item.quantity) || null,
        unit: item.unit.trim() || null,
        show_item_number: item.showItemNumber,
      })),
  );
  const hasItemDetails = items.some((item) => item.description.trim());
  const submittedTotal = !isNew && !hasItemDetails
    ? Number(initialTotal ?? 0).toFixed(2)
    : totals.grandTotal.toFixed(2);

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  function addItem(showItemNumber: boolean) {
    setItems((current) => [
      ...current,
      { ...makeDraft(undefined, current.length), showItemNumber },
    ]);
  }

  return (
    <section>
      <input type="hidden" name="line_items_json" value={serializedItems} />
      <input type="hidden" name="total_amount" value={submittedTotal} />
      <input type="hidden" name="discount_amount" value={totals.discountAmount.toFixed(2)} />
      <input type="hidden" name="vat_rate" value={totals.vatRate.toFixed(4)} />
      <input type="hidden" name="remarks" value={remarks} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#172033]">รายการสินค้าและบริการ</h3>
          <p className="mt-1 text-xs text-[#667085]">กรอกรายการที่จะปรากฏในตารางของใบเสนอราคา</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={items.length >= 12} onClick={() => addItem(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#17379c] px-3 text-xs font-semibold text-white transition hover:bg-[#10266f] disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={15} /> เพิ่มรายการ
          </button>
          <button type="button" disabled={items.length >= 12} onClick={() => addItem(false)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d0d5dd] bg-white px-3 text-xs font-semibold text-[#475467] transition hover:bg-[#f8f9fc] disabled:cursor-not-allowed disabled:opacity-50">
            <ListPlus size={15} /> เพิ่มหัวข้อ
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#d0d5dd]">
        <table className="w-full min-w-[780px] border-collapse text-sm">
          <thead className="bg-[#eef2ff] text-xs font-semibold text-[#344054]">
            <tr>
              <th className="w-14 px-2 py-2.5 text-center">ลำดับ</th>
              <th className="px-2 py-2.5 text-left">รายละเอียด</th>
              <th className="w-28 px-2 py-2.5 text-right">ราคาต่อหน่วย</th>
              <th className="w-20 px-2 py-2.5 text-right">จำนวน</th>
              <th className="w-24 px-2 py-2.5 text-left">หน่วย</th>
              <th className="w-28 px-2 py-2.5 text-right">จำนวนเงิน</th>
              <th className="w-10 px-1 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const lineTotal = asNumber(item.unitPrice) * asNumber(item.quantity);
              return (
                <tr key={item.key} className="border-t border-[#eaecf0] align-top">
                  <td className="px-2 py-2 text-center">
                    <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-[#667085]" title="ซ่อนเลขลำดับสำหรับหัวข้อหรือข้อความประกอบ">
                      <input type="checkbox" checked={item.showItemNumber} onChange={(event) => updateItem(item.key, { showItemNumber: event.currentTarget.checked })} className="accent-[#17379c]" />
                      {item.showItemNumber ? index + 1 : "–"}
                    </label>
                  </td>
                  <td className="px-2 py-2"><textarea value={item.description} onChange={(event) => updateItem(item.key, { description: event.currentTarget.value })} rows={1} placeholder="รายละเอียดสินค้า / ขอบเขตงาน" className="min-h-9 w-full resize-y rounded-md border border-[#d0d5dd] px-2 py-1.5 outline-none focus:border-[#17379c] focus:ring-2 focus:ring-[#17379c]/10" /></td>
                  <td className="px-2 py-2"><input value={item.unitPrice} onChange={(event) => updateItem(item.key, { unitPrice: event.currentTarget.value })} inputMode="decimal" placeholder="0.00" className="h-9 w-full rounded-md border border-[#d0d5dd] px-2 text-right outline-none focus:border-[#17379c] focus:ring-2 focus:ring-[#17379c]/10" /></td>
                  <td className="px-2 py-2"><input value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: event.currentTarget.value })} inputMode="decimal" placeholder="0" className="h-9 w-full rounded-md border border-[#d0d5dd] px-2 text-right outline-none focus:border-[#17379c] focus:ring-2 focus:ring-[#17379c]/10" /></td>
                  <td className="px-2 py-2"><input value={item.unit} onChange={(event) => updateItem(item.key, { unit: event.currentTarget.value })} placeholder="SET" className="h-9 w-full rounded-md border border-[#d0d5dd] px-2 outline-none focus:border-[#17379c] focus:ring-2 focus:ring-[#17379c]/10" /></td>
                  <td className="px-2 py-2 text-right font-semibold text-[#17379c]">{lineTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-1 py-2"><button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))} aria-label="ลบรายการ" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#98a2b3] transition hover:bg-[#fff1f2] hover:text-[#df001b]"><Trash2 size={16} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_330px]">
        <div>
          <label htmlFor="remarks" className="mb-2 block text-sm font-semibold text-[#344054]">หมายเหตุ</label>
          <textarea id="remarks" value={remarks} onChange={(event) => setRemarks(event.currentTarget.value)} rows={3} placeholder="เช่น ยืนราคา 30 วันนับจากวันเสนอราคา" className="w-full resize-y rounded-lg border border-[#d0d5dd] px-3 py-2.5 text-sm outline-none focus:border-[#17379c] focus:ring-2 focus:ring-[#17379c]/10" />
        </div>
        <div className="rounded-xl border border-[#d0d5dd] bg-[#f8f9fc] p-4">
          <label className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-[#344054]">ส่วนลด <input value={discount} onChange={(event) => setDiscount(event.currentTarget.value)} inputMode="decimal" className="h-9 w-32 rounded-md border border-[#d0d5dd] bg-white px-2 text-right font-normal outline-none focus:border-[#17379c]" /></label>
          <div className="flex items-center justify-between border-t border-[#d0d5dd] py-2 text-sm"><span>ยอดก่อน VAT</span><strong>{(totals.subtotal - totals.discountAmount).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
          <label className="flex items-center justify-between gap-3 py-1 text-sm">VAT <input value={vatPercent} onChange={(event) => setVatPercent(event.currentTarget.value)} inputMode="decimal" className="h-9 w-20 rounded-md border border-[#d0d5dd] bg-white px-2 text-right outline-none focus:border-[#17379c]" /></label>
          <div className="flex items-center justify-between border-t border-[#d0d5dd] pt-3 text-base font-bold text-[#17379c]"><span>ยอดรวมสุทธิ</span><span>{totals.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        </div>
      </div>
    </section>
  );
}
