import Link from "next/link";

import {
  ChevronLeft,
} from "lucide-react";

import {
  getCustomerOptions,
  getContactOptions,
  getPaymentTermOptions,
  getNextQuotationNumber,
} from "@/lib/queries/quotations";

import {
  NewQuotationForm,
} from "@/components/quotations/NewQuotationForm";
import { getCustomerProfiles } from "@/lib/excel/customer-profiles";

function getCurrentThaiDate(): string {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Asia/Bangkok",

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",
      },
    );

  const parts =
    formatter.formatToParts(
      new Date(),
    );

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day",
    )?.value ?? "";

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month",
    )?.value ?? "";

  const gregorianYear =
    Number(
      parts.find(
        (part) =>
          part.type ===
          "year",
      )?.value ??
        0,
    );

  const buddhistYear =
    gregorianYear +
    543;

  return `${day}/${month}/${buddhistYear}`;
}

export default async function NewQuotationPage() {
  const defaultDate =
    getCurrentThaiDate();
  const [customers, customerProfiles, contacts, paymentTerms, suggestedQuotationNo] = await Promise.all([
    getCustomerOptions(), getCustomerProfiles(), getContactOptions(), getPaymentTermOptions(), getNextQuotationNumber(defaultDate),
  ]);

  return (
    <div
      className="
        mx-auto
        max-w-[1200px]
      "
    >
      <Link
        href="/quotations"
        className="
          mb-5
          inline-flex
          items-center
          gap-1
          text-sm
          font-medium
          text-[#667085]
          transition
          hover:text-[#17379c]
        "
      >
        <ChevronLeft
          size={17}
        />

        กลับไปจัดการใบเสนอราคา
      </Link>

      <div className="mb-6">
        <div
          className="
            mb-2
            inline-flex
            items-center
            gap-2
            rounded-full
            bg-[#fff1f2]
            px-3
            py-1
            text-xs
            font-bold
            tracking-wide
            text-[#c80019]
          "
        >
          <span
            className="
              h-2
              w-2
              rounded-full
              bg-[#df001b]
            "
          />

          NEW QUOTATION
        </div>

        <h1
          className="
            text-2xl
            font-bold
            tracking-tight
            text-[#172033]
            md:text-3xl
          "
        >
          เพิ่มใบเสนอราคา
        </h1>

        <p
          className="
            mt-2
            text-sm
            text-[#667085]
          "
        >
          เพิ่มข้อมูลใบเสนอราคาใหม่เข้าสู่ระบบ
        </p>
      </div>

      <NewQuotationForm
        customers={
          customers
        }
        defaultDate={
          defaultDate
        }
        customerProfiles={customerProfiles}
        contacts={contacts}
        paymentTerms={paymentTerms}
        suggestedQuotationNo={suggestedQuotationNo}
      />
    </div>
  );
}
