"use client";

import { useEffect, useMemo, useState } from "react";

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
  projectName?: string;
  initialItems?: QuotationLineItem[];
  initialRemarks?: string | null;
  initialDiscount?: number | string | null;
  initialVatRate?: number | string | null;
  initialTotal?: number | string | null;
  isNew: boolean;
};

const INITIAL_LINE_COUNT = 12;
const MAX_LINE_COUNT = 500;

function numberText(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function asNumber(value: string): number {
  const number = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function conciseNumber(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
}

function formatPrice(value: string): string {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return "";

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return value;

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function hasDescription(value: string): boolean {
  return value.replace(/^\s*-\s*/, "").trim().length > 0;
}

function makeDraft(item?: QuotationLineItem, index = 0): DraftItem {
  return {
    key: item?.id ?? `new-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    description: item?.description ?? "",
    unitPrice: formatPrice(numberText(item?.unit_price)),
    quantity: numberText(item?.quantity),
    unit: (item?.unit ?? "").toUpperCase(),
    showItemNumber: item?.show_item_number ?? true,
  };
}

export function QuotationLineItemsEditor({
  projectName = "",
  initialItems = [],
  initialRemarks,
  initialDiscount,
  initialVatRate,
  initialTotal,
  isNew,
}: Props) {
  const [items, setItems] = useState<DraftItem[]>(() => {
    const savedItems = [...initialItems]
      .sort((a, b) => a.line_no - b.line_no)
      .map(makeDraft);
    const blankItems = Array.from({ length: Math.max(0, INITIAL_LINE_COUNT - savedItems.length) }, (_, index) => ({
      ...makeDraft(undefined, savedItems.length + index),
      showItemNumber: savedItems.length + index !== 0,
    }));
    return [...savedItems, ...blankItems];
  });
  const [remarks, setRemarks] = useState(initialRemarks ?? "");
  const [discount, setDiscount] = useState(numberText(initialDiscount ?? 0));
  const [vatPercent, setVatPercent] = useState(() => conciseNumber(Number(initialVatRate ?? 0.07) * 100));
  const [lastProjectDescription, setLastProjectDescription] = useState(projectName.trim());
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);

  useEffect(() => {
    const nextProjectDescription = projectName.trim();

    setItems((current) => {
      const firstItem = current[0];
      if (!firstItem) return current;

      const wasFilledFromProject = firstItem.description === lastProjectDescription;
      if (firstItem.description.trim() && !wasFilledFromProject) return current;
      if (firstItem.description === nextProjectDescription) return current;

      return current.map((item, index) => index === 0
        ? { ...item, description: nextProjectDescription }
        : item);
    });

    setLastProjectDescription(nextProjectDescription);
  }, [lastProjectDescription, projectName]);

  const totals = useMemo(() => {
    const discountAmount = asNumber(discount);
    const vatRate = Math.max(0, asNumber(vatPercent)) / 100;
    const hasAmounts = items.some((item) => item.unitPrice.trim() || item.quantity.trim());
    const subtotal = !isNew && !hasAmounts
      ? Number(initialTotal ?? 0) / (1 + vatRate) + discountAmount
      : items.reduce((sum, item) => sum + asNumber(item.unitPrice) * asNumber(item.quantity), 0);
    const beforeVat = Math.max(0, subtotal - discountAmount);
    const vat = beforeVat * vatRate;
    return { subtotal, discountAmount, vatRate, vat, grandTotal: beforeVat + vat };
  }, [items, discount, vatPercent, initialTotal, isNew]);

  const serializedItems = JSON.stringify(
    items
      .filter((item) => hasDescription(item.description) || item.unitPrice.trim() || item.quantity.trim() || item.unit.trim())
      .map((item, index) => ({
        line_no: index + 1,
        description: item.description.trim(),
        unit_price: item.unitPrice.replace(/,/g, "").trim() || null,
        quantity: item.quantity.replace(/,/g, "").trim() || null,
        unit: item.unit.trim() || null,
        show_item_number: item.showItemNumber,
      })),
  );
  const hasItemAmounts = items.some((item) => item.unitPrice.trim() !== "" || item.quantity.trim() !== "");
  const submittedTotal = !isNew && !hasItemAmounts
    ? Number(initialTotal ?? 0).toFixed(2)
    : totals.grandTotal.toFixed(2);

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  function addItem(showItemNumber: boolean) {
    setItems((current) => {
      if (current.length >= MAX_LINE_COUNT) return current;

      const activeIndex = activeItemKey
        ? current.findIndex((item) => item.key === activeItemKey)
        : -1;
      const lastFilledIndex = current.reduce(
        (lastIndex, item, index) => hasDescription(item.description) ? index : lastIndex,
        -1,
      );
      const insertAt = activeIndex >= 0
        ? activeIndex + 1
        : Math.max(0, lastFilledIndex + 1);
      const nextItem = {
        ...makeDraft(undefined, current.length),
        showItemNumber,
      };

      return [
        ...current.slice(0, insertAt),
        nextItem,
        ...current.slice(insertAt),
      ];
    });
  }

  function addDetailAfter(itemKey: string) {
    setItems((current) => {
      if (current.length >= MAX_LINE_COUNT) return current;

      const itemIndex = current.findIndex((item) => item.key === itemKey);
      if (itemIndex < 0) return current;

      return [
        ...current.slice(0, itemIndex + 1),
        { ...makeDraft(undefined, current.length), description: "- ", showItemNumber: false },
        ...current.slice(itemIndex + 1),
      ];
    });
  }

  function removeDetail(itemKey: string) {
    setItems((current) => current.filter((item) => item.key !== itemKey));
    setActiveItemKey((current) => current === itemKey ? null : current);
  }

  return (
    <section>
      <input type="hidden" name="line_items_json" value={serializedItems} />
      <input type="hidden" name="total_amount" value={submittedTotal} />
      <input type="hidden" name="discount_amount" value={totals.discountAmount.toFixed(2)} />
      <input type="hidden" name="vat_rate" value={totals.vatRate.toFixed(4)} />
      <input type="hidden" name="remarks" value={remarks} />

      <div className="flex flex-wrap items-end justify-between gap-3 border-x border-t border-[#1e293b] bg-[#f7f8ff] px-3 py-2">
        <div>
          <h3 className="text-sm font-bold text-[#172033]">รายการสินค้าและบริการ</h3>
        </div>
        <button type="button" onClick={() => addItem(true)} disabled={items.length >= MAX_LINE_COUNT} className="inline-flex items-center gap-1 border border-[#5270a9] bg-white px-3 py-1 text-xs font-bold text-[#003b84] transition hover:bg-[#eaf0ff] disabled:cursor-not-allowed disabled:opacity-45">+ เพิ่มรายการ</button>
      </div>

      <div className="overflow-x-auto border-x border-b border-[#1e293b]">
        <table className="w-full min-w-[780px] border-collapse text-sm">
          <thead className="bg-[#d8d8f7] text-xs font-bold text-[#172033]">
            <tr>
              <th className="w-14 border-r border-[#1e293b] px-2 py-1.5 text-center">Item</th>
              <th className="border-r border-[#1e293b] px-2 py-1.5 text-center">Description</th>
              <th className="w-28 border-r border-[#1e293b] px-2 py-1.5 text-center">Unit Price</th>
              <th className="w-20 border-r border-[#1e293b] px-2 py-1.5 text-center">Qty</th>
              <th className="w-24 border-r border-[#1e293b] px-2 py-1.5 text-center">Unit</th>
              <th className="w-28 px-2 py-1.5 text-center">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const lineTotal = asNumber(item.unitPrice) * asNumber(item.quantity);
              const displayNumber = items.slice(0, index + 1).filter((entry) => entry.showItemNumber).length;
              const canAddDetail = index > 0 && hasDescription(item.description);
              const isDetailLine = index > 0 && !item.showItemNumber;
              return (
                <tr key={item.key} className="group border-t border-[#1e293b] align-top">
                  <td className="border-r border-[#1e293b] p-0 text-center">
                    <div className="flex min-h-8 items-stretch">
                      <button type="button" onClick={() => updateItem(item.key, { showItemNumber: !item.showItemNumber })} title="คลิกเพื่อซ่อน/แสดงลำดับ (ใช้กับหัวข้อ)" className="flex min-w-0 flex-1 items-center justify-center px-1 text-xs text-[#172033] outline-none hover:bg-[#eef3ff] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]">
                        {item.showItemNumber ? displayNumber : ""}
                      </button>
                      {canAddDetail && <button type="button" onClick={() => addDetailAfter(item.key)} disabled={items.length >= MAX_LINE_COUNT} title="เพิ่มรายละเอียดใต้บรรทัดนี้" aria-label="เพิ่มรายละเอียดใต้บรรทัดนี้" className="w-5 border-l border-[#d0d5dd] text-xs font-bold text-[#5573c9] outline-none transition hover:bg-[#eaf0ff] hover:text-[#17379c] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346] disabled:cursor-not-allowed disabled:opacity-35">+</button>}
                    </div>
                  </td>
                  <td className="border-r border-[#1e293b] p-0"><textarea value={item.description} onFocus={() => setActiveItemKey(item.key)} onKeyDown={(event) => {
                    if (isDetailLine && event.key === "Backspace" && /^(?:-)?$/.test(item.description.trim())) {
                      event.preventDefault();
                      removeDetail(item.key);
                    }
                  }} onChange={(event) => updateItem(item.key, { description: event.currentTarget.value })} rows={1} placeholder={index === 0 ? "หัวข้องานจาก Project" : isDetailLine ? "รายละเอียดเพิ่มเติมของรายการ" : "รายละเอียดสินค้า / ขอบเขตงาน"} className="block min-h-8 w-full resize-y border-0 bg-transparent px-2 py-1 leading-5 outline-none placeholder:text-[#9aa4b2] hover:bg-[#fffdf0] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></td>
                  <td className="border-r border-[#1e293b] p-0"><input value={item.unitPrice} onFocus={() => setActiveItemKey(item.key)} onChange={(event) => updateItem(item.key, { unitPrice: event.currentTarget.value })} onBlur={(event) => updateItem(item.key, { unitPrice: formatPrice(event.currentTarget.value) })} inputMode="decimal" placeholder="0.00" className="h-8 w-full border-0 bg-transparent px-2 text-right outline-none placeholder:text-[#9aa4b2] hover:bg-[#fffdf0] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></td>
                  <td className="border-r border-[#1e293b] p-0"><input value={item.quantity} onFocus={() => setActiveItemKey(item.key)} onChange={(event) => updateItem(item.key, { quantity: event.currentTarget.value })} onBlur={(event) => {
                    const value = event.currentTarget.value.replace(/,/g, "").trim();
                    const quantity = Number(value);
                    if (value && Number.isFinite(quantity) && quantity >= 0) updateItem(item.key, { quantity: conciseNumber(Math.round(quantity * 1000) / 1000) });
                  }} inputMode="decimal" placeholder="0" className="h-8 w-full border-0 bg-transparent px-2 text-right outline-none placeholder:text-[#9aa4b2] hover:bg-[#fffdf0] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></td>
                  <td className="border-r border-[#1e293b] p-0"><input value={item.unit} onFocus={() => setActiveItemKey(item.key)} onChange={(event) => updateItem(item.key, { unit: event.currentTarget.value.toUpperCase() })} className="h-8 w-full border-0 bg-transparent px-2 uppercase outline-none hover:bg-[#fffdf0] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></td>
                  <td className="px-2 py-1 text-right font-semibold text-[#172033]">{lineTotal ? lineTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_330px]">
        <div className="border-x border-b border-[#1e293b] p-0">
          <label htmlFor="remarks" className="flex min-h-[126px] cursor-text items-start gap-2 p-2 text-sm"><strong className="shrink-0 text-[#df001b]">หมายเหตุ</strong><textarea id="remarks" value={remarks} onChange={(event) => setRemarks(event.currentTarget.value)} rows={3} className="min-h-[92px] w-full resize-y border-0 bg-transparent px-1 py-0 outline-none hover:bg-[#fffdf0] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></label>
        </div>
        <div className="border-r border-b border-[#1e293b] bg-white">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup><col /><col className="w-[136px]" /></colgroup>
            <tbody>
              <tr className="h-8 border-b border-[#1e293b]"><th scope="row" className="border-r border-[#1e293b] px-3 text-left font-bold">Total</th><td className="px-3 text-right font-bold tabular-nums">{totals.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
              <tr className="h-8 border-b border-[#1e293b]"><th scope="row" className="border-r border-[#1e293b] px-3 text-left font-bold">DISCOUNT</th><td className="p-0"><input value={discount} onChange={(event) => setDiscount(event.currentTarget.value)} inputMode="decimal" placeholder="0.00" aria-label="Discount" className="h-8 w-full border-0 bg-transparent px-3 text-right font-normal outline-none tabular-nums hover:bg-[#fffdf0] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></td></tr>
              <tr className="h-8 border-b border-[#1e293b]"><th scope="row" className="border-r border-[#1e293b] px-3 text-left font-bold">SUB TOTAL</th><td className="px-3 text-right font-bold tabular-nums">{Math.max(0, totals.subtotal - totals.discountAmount).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
              <tr className="h-8 border-b border-[#1e293b]"><th scope="row" className="border-r border-[#1e293b] px-3 text-left font-bold">Vat <span className="float-right inline-flex items-center font-bold"><input value={vatPercent} onChange={(event) => setVatPercent(event.currentTarget.value)} onBlur={(event) => setVatPercent(conciseNumber(Number(event.currentTarget.value)))} inputMode="decimal" aria-label="VAT percentage" className="h-8 w-12 border-0 bg-transparent px-1 text-right font-bold outline-none hover:bg-[#fffdf0] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]" />%</span></th><td className="px-3 text-right font-bold tabular-nums">{totals.vat.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
              <tr className="h-8 bg-[#d8d8f7]"><th scope="row" className="border-r border-[#1e293b] px-3 text-left text-base font-bold">Grand Total</th><td className="bg-white px-3 text-right text-base font-bold tabular-nums">{totals.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
