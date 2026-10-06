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

import {
  CreateQuotationModal,
} from "@/components/quotations/CreateQuotationModal";

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

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return undefined;
  }

  return parsed;
}

/**
 * วันที่ประเทศไทยปัจจุบัน
 *
 * เช่น:
 * 06/10/2569
 */
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

export default async function QuotationsPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const search =
    params.search?.trim() ??
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

  const defaultDate =
    getCurrentThaiDate();

  /*
   * Pagination จำ Filter เดิม
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
    <div
      className="
        mx-auto
        max-w-[1600px]
      "
    >
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

        {/* =================================================
         * Modal Trigger
         * =============================================== */}
        <CreateQuotationModal
          customers={
            customers
          }
          defaultDate={
            defaultDate
          }
        />
      </div>

      {/* =====================================================
       * Filter
       * =================================================== */}
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
              รายการใบเสนอราคา
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
              font-bold
              text-[#17379c]
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
        quotations={
          result.items
        }
      />

      {/* =====================================================
       * Pagination
       * =================================================== */}
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