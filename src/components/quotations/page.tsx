import Link from "next/link";

import {
  Plus,
} from "lucide-react";

import {
  getAvailableQuotationYears,
  getCustomerOptions,
  getQuotations,
} from "@/lib/queries/quotations";

import {
  QuotationFilters,
} from "@/components/quotations/QuotationFilters";

import {
  QuotationTable,
} from "@/components/quotations/QuotationTable";

import {
  QuotationPagination,
} from "@/components/quotations/QuotationPagination";

type PageProps = {
  searchParams: Promise<{
    search?: string;
    year?: string;
    month?: string;
    customer?: string;
    page?: string;
  }>;
};

function parseNumber(
  value:
    | string
    | undefined,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : undefined;
}

export default async function QuotationsPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const search =
    params.search ??
    "";

  const year =
    parseNumber(
      params.year,
    );

  const month =
    parseNumber(
      params.month,
    );

  const page =
    parseNumber(
      params.page,
    ) ?? 1;

  const customerId =
    params.customer ??
    "";

  const [
    result,
    customers,
    years,
  ] =
    await Promise.all([
      getQuotations({
        search,
        year,
        month,
        page,
        customerId,
      }),

      getCustomerOptions(),

      getAvailableQuotationYears(),
    ]);

  const paginationParams:
    Record<
      string,
      string
    > = {};

  if (search) {
    paginationParams.search =
      search;
  }

  if (year) {
    paginationParams.year =
      String(year);
  }

  if (
    month &&
    year
  ) {
    paginationParams.month =
      String(month);
  }

  if (customerId) {
    paginationParams.customer =
      customerId;
  }

  return (
    <div
      className="
        mx-auto
        max-w-[1600px]
      "
    >
      <div
        className="
          mb-6
          flex flex-col
          justify-between
          gap-4
          sm:flex-row
          sm:items-end
        "
      >
        <div>
          <div
            className="
              mb-2
              text-sm
              font-semibold
              text-[#df001b]
            "
          >
            QUOTATION MANAGEMENT
          </div>

          <h1
            className="
              text-2xl
              font-bold
              text-[#172033]
              md:text-3xl
            "
          >
            จัดการใบเสนอราคา
          </h1>

          <p
            className="
              mt-2
              text-sm
              text-[#667085]
            "
          >
            ค้นหาและจัดการข้อมูลใบเสนอราคาทั้งหมดของบริษัท
          </p>
        </div>

        <Link
          href="/quotations/new"
          className="
            inline-flex
            h-11
            items-center
            justify-center
            gap-2
            rounded-lg
            bg-[#df001b]
            px-5
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-[#b80017]
          "
        >
          <Plus
            size={18}
          />

          เพิ่มใบเสนอราคา
        </Link>
      </div>

      <QuotationFilters
        search={search}
        year={year}
        month={month}
        customerId={
          customerId
        }
        years={years}
        customers={
          customers
        }
      />

      <div
        className="
          my-5
          flex
          items-center
          justify-between
        "
      >
        <h2
          className="
            text-lg
            font-bold
            text-[#172033]
          "
        >
          รายการใบเสนอราคา
        </h2>

        <span
          className="
            text-sm
            text-[#667085]
          "
        >
          {result.total.toLocaleString(
            "th-TH",
          )}{" "}
          รายการ
        </span>
      </div>

      <QuotationTable
        quotations={
          result.items
        }
        customers={
          customers
        }
      />

      <QuotationPagination
        page={
          result.page
        }
        totalPages={
          result.totalPages
        }
        total={
          result.total
        }
        params={
          paginationParams
        }
      />
    </div>
  );
}
