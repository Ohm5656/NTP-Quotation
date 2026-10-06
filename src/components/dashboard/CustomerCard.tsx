import Link from "next/link";

import {
  Building2,
  ChevronRight,
} from "lucide-react";

import {
  formatBaht,
  formatThaiDate,
} from "@/lib/format";

import type {
  CustomerSummary,
} from "@/types/database";

type CustomerCardProps = {
  customer:
    CustomerSummary;
};

export function CustomerCard({
  customer,
}: CustomerCardProps) {
  return (
    <Link
      href={`/customers/${customer.customer_id}`}
      className="
        group
        block
        rounded-xl
        border border-[#e5e7eb]
        bg-white
        p-5
        transition
        hover:border-[#b9c4ef]
        hover:shadow-sm
      "
    >
      <div
        className="
          mb-5
          flex items-start
          justify-between
          gap-4
        "
      >
        <div
          className="
            flex h-10 w-10
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-[#eef2ff]
            text-[#17379c]
          "
        >
          <Building2
            size={20}
          />
        </div>

        <ChevronRight
          size={19}
          className="
            text-[#98a2b3]
            transition
            group-hover:
            translate-x-0.5
            group-hover:
            text-[#17379c]
          "
        />
      </div>

      <h2
        className="
          min-h-[48px]
          text-[15px]
          font-semibold
          leading-6
          text-[#172033]
        "
      >
        {
          customer.customer_name
        }
      </h2>

      <div
        className="
          mt-5
          border-t
          border-[#f0f1f3]
          pt-4
        "
      >
        <div
          className="
            flex items-center
            justify-between
            gap-3
          "
        >
          <span
            className="
              text-xs
              text-[#667085]
            "
          >
            มูลค่าที่เสนอ
          </span>

          <span
            className="
              text-sm
              font-bold
              text-[#17379c]
            "
          >
            {formatBaht(
              customer
                .total_quoted_amount,
            )}
          </span>
        </div>

        <div
          className="
            mt-3
            flex items-center
            justify-between
            gap-3
          "
        >
          <span
            className="
              text-xs
              text-[#667085]
            "
          >
            ใบเสนอราคา
          </span>

          <span
            className="
              text-sm
              font-semibold
              text-[#344054]
            "
          >
            {
              customer.quotation_count
            }{" "}
            รายการ
          </span>
        </div>

        <div
          className="
            mt-3
            flex items-center
            justify-between
            gap-3
          "
        >
          <span
            className="
              text-xs
              text-[#667085]
            "
          >
            ล่าสุด
          </span>

          <span
            className="
              text-xs
              font-medium
              text-[#344054]
            "
          >
            {formatThaiDate(
              customer
                .latest_quotation_date,
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}