"use client";

import { Save, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createQuotation,
  type CreateQuotationState,
  updateQuotation,
} from "@/app/quotations/actions";
import { QuotationLineItemsEditor } from "@/components/quotations/QuotationLineItemsEditor";
import { findLinkedCustomerProfile } from "@/lib/customer-profile-links";
import { formatThaiDate } from "@/lib/format";
import type { CustomerOption, QuotationListItem } from "@/types/database";

type CustomerProfile = {
  name: string;
  taxId?: string;
  address?: string;
  contact: string;
  paymentTerm: string;
};

type Props = {
  customers: CustomerOption[];
  customerProfiles?: CustomerProfile[];
  paymentTerms?: string[];
  contacts?: string[];
  defaultDate: string;
  quotation?: QuotationListItem;
  onCancel: () => void;
  onSuccess: () => void;
};

const initialState: CreateQuotationState = { success: false };

function paymentText(value: string): string {
  if (!value) return "";
  return /วัน|เครดิต|ชำระ/i.test(value) ? value : `เครดิต ${value} วัน`;
}

export function QuotationPreviewForm({
  customers,
  customerProfiles = [],
  paymentTerms = [],
  contacts = [],
  defaultDate,
  quotation,
  onCancel,
  onSuccess,
}: Props) {
  const router = useRouter();
  const isEditing = Boolean(quotation);
  const [customerName, setCustomerName] = useState(quotation?.customer_name_raw ?? "");
  const [attention, setAttention] = useState(quotation?.attention ?? "");
  const [paymentTerm, setPaymentTerm] = useState(quotation?.payment_term ?? "");
  const [state, formAction, pending] = useActionState(
    quotation
      ? updateQuotation.bind(null, quotation.id, quotation.customer_id)
      : createQuotation,
    initialState,
  );

  const customerProfile = useMemo(
    () => findLinkedCustomerProfile(customerProfiles, customerName),
    [customerName, customerProfiles],
  );
  const customerOptions = useMemo(
    () => Array.from(new Set([...customers.map((customer) => customer.name), ...customerProfiles.map((profile) => profile.name)])).sort((a, b) => a.localeCompare(b, "th")),
    [customers, customerProfiles],
  );
  const termOptions = useMemo(
    () => Array.from(new Set(["เครดิต 0 วัน", "เครดิต 15 วัน", "เครดิต 30 วัน", ...paymentTerms, ...customerProfiles.map((profile) => paymentText(profile.paymentTerm))].filter(Boolean))).sort((a, b) => a.localeCompare(b, "th")),
    [customerProfiles, paymentTerms],
  );
  const contactOptions = useMemo(
    () => Array.from(new Set([...contacts, ...customerProfiles.map((profile) => profile.contact)].filter(Boolean))).sort((a, b) => a.localeCompare(b, "th")),
    [contacts, customerProfiles],
  );

  useEffect(() => {
    if (!state.success) return;
    onSuccess();
    router.refresh();
  }, [state.success, onSuccess, router]);

  function chooseCustomer(name: string) {
    setCustomerName(name);
    const profile = findLinkedCustomerProfile(customerProfiles, name);
    if (!profile) return;
    if (!attention.trim() && profile.contact) setAttention(profile.contact);
    if (!paymentTerm.trim() && profile.paymentTerm) setPaymentTerm(paymentText(profile.paymentTerm));
  }

  const fieldClass = "h-8 w-full border-0 border-b border-dotted border-[#5270a9] bg-[#fffef8] px-1 text-[28px] text-[#111827] outline-none transition hover:bg-[#fff8d8] focus:border-solid focus:border-[#217346] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]";

  return (
    <form action={formAction} className="min-h-0 overflow-y-auto bg-[#667085]/20 p-3 sm:p-6">
      {state.error && (
        <div className="mx-auto mb-3 max-w-[1120px] border border-[#f1b7be] bg-[#fff4f5] px-4 py-3 text-sm font-medium text-[#b80017]">
          {state.error}
        </div>
      )}

      <article className="quotation-worksheet mx-auto w-full max-w-[1120px] overflow-hidden border border-[#111827] bg-white px-3 py-4 text-[#111] shadow-[0_10px_35px_rgba(16,24,40,0.22)] sm:px-5 sm:py-5">
        <div className="mb-3 flex items-center justify-between border-b border-[#cbd5e1] pb-2 font-sans text-xs text-[#667085]">
          <span>QUOTATION WORKSHEET</span>
        </div>
        <header className="border-b border-[#0f172a] pb-3">
          <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
            <div className="flex justify-center"><img src="/ntp-logo.png" alt="NTP" className="h-[106px] w-auto object-contain" /></div>
            <div className="text-center sm:text-left">
              <p className="text-xl font-bold leading-tight sm:text-2xl">บริษัท เอ็นทีพี อิเล็คทริคแอนด์เอ็นจิเนียริ่ง จำกัด</p>
              <p className="mt-1 text-xs font-semibold">(สำนักงานใหญ่) เลขประจำตัวผู้เสียภาษี 0-1155-59027-64-1</p>
              <p className="text-lg font-bold tracking-wide">NTP ELECTRIC AND ENGINEERING CO., LTD.</p>
              <p className="mt-2 text-xs">107/83 หมู่ที่ 12 ตำบลบางปลา อำเภอบางพลี จังหวัดสมุทรปราการ 10540</p>
              <p className="worksheet-contact text-xs text-blue-700 underline">TEL:02-102-3363 FAX :081-375-2024 Email:ntpelectric2017@gmail.com</p>
            </div>
          </div>
          <div className="mt-4 text-center"><span className="inline-block rounded-lg border border-[#5270a9] bg-[#dbe4ff] px-6 py-1.5 text-xl font-bold shadow-sm">Quotation <span className="text-sm font-semibold">(ใบเสนอราคา)</span></span></div>
        </header>

        <section className="grid gap-x-8 gap-y-4 border-b border-[#0f172a] py-4 sm:grid-cols-[1fr_360px]">
          <div className="space-y-2">
            <div className="grid grid-cols-[132px_1fr] items-end gap-2"><label className="font-bold text-[#003b84]">ลูกค้า</label><input name="customer_name" value={customerName} onChange={(event) => chooseCustomer(event.currentTarget.value)} list="preview-customer-options" className={`${fieldClass} font-bold`} placeholder="เลือกบริษัท / สาขาลูกค้า" /></div>
            <datalist id="preview-customer-options">{customerOptions.map((name) => <option key={name} value={name} />)}</datalist>
            <div className="grid grid-cols-[132px_1fr] items-end gap-2"><span /><p className="min-h-5 border-b border-dotted border-[#5270a9] px-1 text-sm">{customerProfile?.address ?? "เลือกชื่อลูกค้าเพื่อดึงที่อยู่และเลขผู้เสียภาษี"}</p></div>
            <div className="grid grid-cols-[132px_1fr] items-end gap-2"><label className="text-xs font-bold text-[#003b84]">เลขประจำตัวผู้เสียภาษี :</label><p className="min-h-5 border-b border-dotted border-[#5270a9] px-1 text-xs">{customerProfile?.taxId ?? ""}</p></div>
            <div className="grid grid-cols-[132px_1fr] items-end gap-2"><label className="text-xs font-bold text-[#003b84]">ผู้ติดต่อ :</label><input name="attention" value={attention} onChange={(event) => setAttention(event.currentTarget.value)} list="preview-contact-options" className={fieldClass} placeholder="ชื่อผู้ติดต่อ" /></div>
            <datalist id="preview-contact-options">{contactOptions.map((contact) => <option key={contact} value={contact} />)}</datalist>
          </div>

          <div className="space-y-2 text-[#003b84]">
            <div className="grid grid-cols-[170px_1fr] items-end gap-2"><label className="font-bold">Date :</label><input name="quotation_date" defaultValue={quotation?.quotation_date ? formatThaiDate(quotation.quotation_date) : defaultDate} className={fieldClass} placeholder="06/10/2569" /></div>
            <div className="grid grid-cols-[170px_1fr] items-end gap-2"><label className="font-bold">Quotation No :</label><div className="flex items-end"><span className="pb-1 font-bold">Q</span><input name="quotation_no" defaultValue={quotation?.quotation_no ?? ""} className={`${fieldClass} font-bold`} placeholder="6909033" /></div></div>
            <div className="grid grid-cols-[170px_1fr] items-end gap-2"><label className="font-bold">อ้างอิง BOQ :</label><input name="boq_no" defaultValue={quotation?.boq_no ?? ""} className={fieldClass} placeholder="6909011" /></div>
            <div className="grid grid-cols-[170px_1fr] items-end gap-2"><label className="text-xs font-bold">เงื่อนไขการชำระเงิน :</label><input name="payment_term" value={paymentTerm} onChange={(event) => setPaymentTerm(event.currentTarget.value)} list="preview-payment-options" className={fieldClass} placeholder="เครดิต 15 วัน" /></div>
            <datalist id="preview-payment-options">{termOptions.map((term) => <option key={term} value={term} />)}</datalist>
          </div>
        </section>

        <section className="border-b border-[#0f172a] py-2">
          <div className="grid grid-cols-[70px_1fr] items-end gap-2"><label className="font-bold text-[#003b84]">Project :</label><input name="project_name" defaultValue={quotation?.project_name ?? ""} className={`${fieldClass} font-bold`} placeholder="ชื่อโปรเจกต์" /></div>
          <p className="mt-2 pl-[70px] text-xs">บริษัทมีความยินดีที่จะเสนอราคาสินค้า ดังต่อไปนี้ :</p>
        </section>

        <section className="pt-0">
          <QuotationLineItemsEditor
            initialItems={quotation?.quotation_line_items}
            initialRemarks={quotation?.remarks}
            initialDiscount={quotation?.discount_amount}
            initialVatRate={quotation?.vat_rate}
            initialTotal={quotation?.total_amount}
            isNew={!quotation}
          />
        </section>

        <section className="mt-4 grid gap-3 border-t border-[#0f172a] pt-3 sm:grid-cols-2">
          <label className="text-xs text-[#344054]">PO (ข้อมูลอ้างอิงภายใน)<input name="po" defaultValue={quotation?.po ?? ""} className="ml-2 h-7 w-44 border-0 border-b border-dotted border-[#98a2b3] bg-[#fffef8] px-1 outline-none hover:bg-[#fff8d8] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></label>
          <label className="text-xs text-[#344054]">E-mail ผู้ติดต่อ<input name="email" type="email" defaultValue={quotation?.email ?? ""} className="ml-2 h-7 w-52 border-0 border-b border-dotted border-[#98a2b3] bg-[#fffef8] px-1 outline-none hover:bg-[#fff8d8] focus:bg-[#fffbe6] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></label>
        </section>

        <footer className="worksheet-signature mt-5 grid grid-cols-2 border-t border-[#0f172a] pt-5 text-[18px] leading-tight">
          <div className="pl-[12%] text-left"><p>ผู้อนุมัติสั่งซื้อ..........................</p><p className="mt-3">วันที่........................................</p></div>
          <div className="text-center"><p>ผู้เสนอราคา</p><span className="inline-block pt-7">(นายณัฐพล ลุนะหา)</span><br /><span className="worksheet-signature-phone text-[16px]">T.081-3752024</span></div>
        </footer>
      </article>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col-reverse justify-between gap-3 border border-t-0 border-[#111827] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(16,24,40,0.18)] sm:flex-row sm:items-center">
        <button type="button" onClick={onCancel} disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 border border-[#d0d5dd] px-4 text-sm font-semibold text-[#475467] transition hover:bg-[#f8f9fc] disabled:opacity-50"><X size={17} />ยกเลิก</button>
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 bg-[#17379c] px-6 text-sm font-semibold text-white transition hover:bg-[#10266f] disabled:opacity-60"><Save size={17} />{pending ? "กำลังบันทึก..." : isEditing ? "บันทึกการแก้ไข" : "บันทึกใบเสนอราคา"}</button>
      </div>
    </form>
  );
}
