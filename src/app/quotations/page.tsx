import Link from "next/link";

import { Plus } from "lucide-react";

import {
  getAvailableQuotationYears,
  getCustomerOptions,
  getQuotations,
} from "@/lib/queries/quotations";

import { QuotationFilters } from "@/components/quotations/QuotationFilters";

import { QuotationTable } from "@/components/quotations/QuotationTable";

import { QuotationPagination } from "@/components/quotations/QuotationPagination";

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
  value: string | undefined,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

export default async function QuotationsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const search =
    params.search?.trim() ?? "";

  const year =
    parseNumber(params.year);

  const month =
    parseNumber(params.month);

  const page =
    parseNumber(params.page) ?? 1;

  const customerId =
    params.customer ?? "";

  /*
   * โหลดข้อมูลพร้อมกันเพื่อลดเวลารอ
   *
   * - รายการใบเสนอราคา
   * - รายชื่อลูกค้า
   * - ปีที่มีข้อมูล
   */
  const [
    result,
    customers,
    years,
  ] = await Promise.all([
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

  /*
   * เก็บ Filter เดิมไว้ตอนเปลี่ยนหน้า
   */
  const paginationParams: Record<
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
    <div className="mx-auto max-w-[1600px]">
      {/* =====================================================
       * Header
       * =================================================== */}
      <div
        className="
          mb-6
          flex
          flex-col
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
              flex
              items-center
              gap-2
              text-sm
              font-semibold
              text-[#df001b]
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

            QUOTATION MANAGEMENT
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
            จัดการใบเสนอราคา
          </h1>

          <p
            className="
              mt-2
              text-sm
              text-[#667085]
            "
          >
            ค้นหา ดู และจัดการข้อมูลใบเสนอราคาทั้งหมดของบริษัท
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
          <Plus size={18} />

          เพิ่มใบเสนอราคา
        </Link>
      </div>

      {/* =====================================================
       * Filter
       * =================================================== */}
      <QuotationFilters
        search={search}
        year={year}
        month={month}
        customerId={customerId}
        years={years}
        customers={customers}
      />

      {/* =====================================================
       * Table Header
       * =================================================== */}
      <div
        className="
          my-5
          flex
          flex-col
          justify-between
          gap-2
          sm:flex-row
          sm:items-center
        "
      >
        <div>
          <h2
            className="
              text-lg
              font-bold
              text-[#172033]
            "
          >
            รายการใบเสนอราคา
          </h2>

          <p
            className="
              mt-1
              text-sm
              text-[#667085]
            "
          >
            ข้อมูลจากฐานข้อมูลใบเสนอราคาของบริษัท
          </p>
        </div>

        <span
          className="
            text-sm
            text-[#667085]
          "
        >
          ทั้งหมด{" "}
          <strong
            className="
              font-semibold
              text-[#172033]
            "
          >
            {result.total.toLocaleString(
              "th-TH",
            )}
          </strong>{" "}
          รายการ
        </span>
      </div>

      {/* =====================================================
       * Table
       * =================================================== */}
      <QuotationTable
        quotations={result.items}
      />

      {/* =====================================================
       * Pagination
       * =================================================== */}
      <QuotationPagination
        page={result.page}
        totalPages={
          result.totalPages
        }
        total={result.total}
        params={
          paginationParams
        }
      />
    </div>
  );
}