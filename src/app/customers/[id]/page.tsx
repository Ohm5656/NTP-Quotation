import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Wallet,
} from "lucide-react";

import {
  notFound,
} from "next/navigation";

import {
  getCustomerById,
  getCustomerQuotationSummary,
  getCustomerQuotations,
  getCustomerQuotationYears,
} from "@/lib/queries/customers";

import {
  CustomerQuotationFilters,
} from "@/components/customers/CustomerQuotationFilters";

import {
  CustomerQuotationTable,
} from "@/components/customers/CustomerQuotationTable";

import {
  QuotationPagination,
} from "@/components/quotations/QuotationPagination";

import {
  formatBaht,
  formatThaiDate,
} from "@/lib/format";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    search?: string;
    year?: string;
    month?: string;
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

export default async function CustomerDetailPage({
  params,
  searchParams,
}: PageProps) {
  const {
    id,
  } =
    await params;

  const queryParams =
    await searchParams;

  const search =
    queryParams
      .search
      ?.trim() ??
    "";

  const year =
    parseNumber(
      queryParams.year,
    );

  const month =
    parseNumber(
      queryParams.month,
    );

  const page =
    parseNumber(
      queryParams.page,
    ) ?? 1;

  const customer =
    await getCustomerById(
      id,
    );

  if (!customer) {
    notFound();
  }

  const [
    summary,
    result,
    years,
  ] =
    await Promise.all([
      getCustomerQuotationSummary(
        id,
      ),

      getCustomerQuotations(
        id,
        {
          search,
          year,
          month,
          page,
        },
      ),

      getCustomerQuotationYears(
        id,
      ),
    ]);

  /* =======================================================
   * Pagination
   * ===================================================== */

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
    year &&
    month
  ) {
    paginationParams.month =
      String(month);
  }

  /*
   * QuotationPagination ตัวเดิม
   * hardcode /quotations
   *
   * ดังนั้นหน้านี้เราทำ pagination
   * ด้านล่างเอง
   */
  function createPageUrl(
    targetPage: number,
  ) {
    const params =
      new URLSearchParams(
        paginationParams,
      );

    params.set(
      "page",
      String(
        targetPage,
      ),
    );

    return `/customers/${id}?${params.toString()}`;
  }

  return (
    <div
      className="
        mx-auto
        max-w-[1600px]
      "
    >
      {/* =====================================================
       * Back
       * =================================================== */}
      <Link
        href="/"
        className="
          mb-5
          inline-flex
          items-center
          gap-1.5
          text-sm
          font-medium
          text-[#667085]
          transition
          hover:text-[#17379c]
        "
      >
        <ArrowLeft
          size={17}
        />

        กลับหน้าภาพรวม
      </Link>

      {/* =====================================================
       * Header
       * =================================================== */}
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

          CUSTOMER QUOTATIONS
        </div>

        <h1
          className="
            max-w-[1100px]
            text-2xl
            font-bold
            leading-tight
            tracking-tight
            text-[#172033]
            md:text-3xl
          "
        >
          {customer.name}
        </h1>

        <p
          className="
            mt-2
            text-sm
            text-[#667085]
          "
        >
          ประวัติใบเสนอราคาทั้งหมดที่เคยเสนอให้ลูกค้ารายนี้
        </p>
      </div>

      {/* =====================================================
       * Summary
       * =================================================== */}
      <div
        className="
          mb-6
          grid
          gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >
        {/* Count */}
        <div
          className="
            rounded-xl
            border
            border-[#e5e7eb]
            bg-white
            p-5
          "
        >
          <div
            className="
              mb-4
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              bg-[#eef2ff]
              text-[#17379c]
            "
          >
            <FileText
              size={19}
            />
          </div>

          <p
            className="
              text-sm
              text-[#667085]
            "
          >
            ใบเสนอราคาทั้งหมด
          </p>

          <p
            className="
              mt-2
              text-2xl
              font-bold
              text-[#172033]
            "
          >
            {summary.quotationCount.toLocaleString(
              "th-TH",
            )}{" "}
            <span
              className="
                text-sm
                font-medium
                text-[#667085]
              "
            >
              รายการ
            </span>
          </p>
        </div>

        {/* Amount */}
        <div
          className="
            rounded-xl
            border
            border-[#e5e7eb]
            bg-white
            p-5
          "
        >
          <div
            className="
              mb-4
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              bg-[#eef2ff]
              text-[#17379c]
            "
          >
            <Wallet
              size={19}
            />
          </div>

          <p
            className="
              text-sm
              text-[#667085]
            "
          >
            มูลค่าที่เสนอทั้งหมด
          </p>

          <p
            className="
              mt-2
              text-xl
              font-bold
              text-[#17379c]
              md:text-2xl
            "
          >
            {formatBaht(
              summary.totalAmount,
            )}
          </p>
        </div>

        {/* First */}
        <div
          className="
            rounded-xl
            border
            border-[#e5e7eb]
            bg-white
            p-5
          "
        >
          <div
            className="
              mb-4
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              bg-[#eef2ff]
              text-[#17379c]
            "
          >
            <CalendarDays
              size={19}
            />
          </div>

          <p
            className="
              text-sm
              text-[#667085]
            "
          >
            เสนอครั้งแรก
          </p>

          <p
            className="
              mt-2
              text-xl
              font-bold
              text-[#172033]
            "
          >
            {formatThaiDate(
              summary.firstQuotationDate,
            )}
          </p>
        </div>

        {/* Latest */}
        <div
          className="
            rounded-xl
            border
            border-[#e5e7eb]
            bg-white
            p-5
          "
        >
          <div
            className="
              mb-4
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              bg-[#fff1f2]
              text-[#df001b]
            "
          >
            <CalendarDays
              size={19}
            />
          </div>

          <p
            className="
              text-sm
              text-[#667085]
            "
          >
            ล่าสุด
          </p>

          <p
            className="
              mt-2
              text-xl
              font-bold
              text-[#172033]
            "
          >
            {formatThaiDate(
              summary.latestQuotationDate,
            )}
          </p>
        </div>
      </div>

      {/* =====================================================
       * Search
       * =================================================== */}
      <CustomerQuotationFilters
        customerId={
          id
        }
        search={
          search
        }
        year={
          year
        }
        month={
          month
        }
        years={
          years
        }
      />

      {/* =====================================================
       * Section
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
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <span
              className="
                h-5
                w-1
                rounded-full
                bg-[#df001b]
              "
            />

            <h2
              className="
                text-lg
                font-bold
                text-[#172033]
              "
            >
              ประวัติใบเสนอราคา
            </h2>
          </div>

          <p
            className="
              mt-1
              pl-3
              text-sm
              text-[#667085]
            "
          >
            เรียงจากรายการล่าสุด
          </p>
        </div>

        <p
          className="
            text-sm
            text-[#667085]
          "
        >
          พบ{" "}

          <strong
            className="
              font-bold
              text-[#17379c]
            "
          >
            {result.total.toLocaleString(
              "th-TH",
            )}
          </strong>{" "}

          รายการ
        </p>
      </div>

      {/* =====================================================
       * Table
       * =================================================== */}
      <CustomerQuotationTable
        quotations={
          result.items
        }
      />

      {/* =====================================================
       * Pagination
       * =================================================== */}
      {result.totalPages >
        1 && (
        <div
          className="
            mt-4
            flex
            items-center
            justify-between
          "
        >
          <p
            className="
              text-sm
              text-[#667085]
            "
          >
            หน้า{" "}
            {result.page}{" "}
            จาก{" "}
            {
              result.totalPages
            }
          </p>

          <div
            className="
              flex
              gap-2
            "
          >
            {result.page >
              1 ? (
              <Link
                href={createPageUrl(
                  result.page -
                    1,
                )}
                className="
                  rounded-lg
                  border
                  border-[#d0d5dd]
                  bg-white
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-[#344054]
                  transition
                  hover:bg-[#f8f9fc]
                "
              >
                ก่อนหน้า
              </Link>
            ) : (
              <span
                className="
                  cursor-not-allowed
                  rounded-lg
                  border
                  border-[#e5e7eb]
                  bg-[#f8f9fc]
                  px-4
                  py-2
                  text-sm
                  text-[#98a2b3]
                "
              >
                ก่อนหน้า
              </span>
            )}

            {result.page <
            result.totalPages ? (
              <Link
                href={createPageUrl(
                  result.page +
                    1,
                )}
                className="
                  rounded-lg
                  border
                  border-[#d0d5dd]
                  bg-white
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-[#344054]
                  transition
                  hover:bg-[#f8f9fc]
                "
              >
                ถัดไป
              </Link>
            ) : (
              <span
                className="
                  cursor-not-allowed
                  rounded-lg
                  border
                  border-[#e5e7eb]
                  bg-[#f8f9fc]
                  px-4
                  py-2
                  text-sm
                  text-[#98a2b3]
                "
              >
                ถัดไป
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}