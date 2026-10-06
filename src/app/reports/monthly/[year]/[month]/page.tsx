import Link from "next/link";

import {
  CalendarDays,
  ChevronRight,
  FileText,
  Users,
  Wallet,
} from "lucide-react";

import {
  notFound,
} from "next/navigation";

import {
  getMonthlyCustomerOptions,
  getMonthlyDetailSummary,
  getMonthlyReportQuotations,
} from "@/lib/queries/monthly-reports";

import {
  MonthlyReportFilters,
} from "@/components/reports/MonthlyReportFilters";

import {
  MonthlyReportTable,
} from "@/components/reports/MonthlyReportTable";

import {
  formatBaht,
} from "@/lib/format";

const monthNames = [
  "",
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

type PageProps = {
  params: Promise<{
    year: string;
    month: string;
  }>;

  searchParams: Promise<{
    search?: string;
    customer?: string;
    page?: string;
  }>;
};

function parseNumber(
  value:
    | string
    | undefined,
) {
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

export default async function MonthlyDetailPage({
  params,
  searchParams,
}: PageProps) {
  const route =
    await params;

  const query =
    await searchParams;

  const year =
    Number(
      route.year,
    );

  const month =
    Number(
      route.month,
    );

  if (
    !Number.isFinite(
      year,
    ) ||
    !Number.isFinite(
      month,
    ) ||
    year < 2400 ||
    year > 2700 ||
    month < 1 ||
    month > 12
  ) {
    notFound();
  }

  const search =
    query.search?.trim() ??
    "";

  const customerId =
    query.customer ??
    "";

  const page =
    parseNumber(
      query.page,
    ) ?? 1;

  const [
    summary,
    customers,
    result,
  ] =
    await Promise.all([
      getMonthlyDetailSummary(
        year,
        month,
      ),

      getMonthlyCustomerOptions(
        year,
        month,
      ),

      getMonthlyReportQuotations(
        year,
        month,
        {
          search,
          customerId,
          page,
        },
      ),
    ]);

  const monthName =
    monthNames[month];

  const paginationParams =
    new URLSearchParams();

  if (search) {
    paginationParams.set(
      "search",
      search,
    );
  }

  if (customerId) {
    paginationParams.set(
      "customer",
      customerId,
    );
  }

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

    return `/reports/monthly/${year}/${month}?${params.toString()}`;
  }

  return (
    <div
      className="
        mx-auto
        max-w-[1600px]
      "
    >
      {/* Breadcrumb */}
      <div
        className="
          mb-5
          flex
          flex-wrap
          items-center
          gap-2
          text-sm
          text-[#667085]
        "
      >
        <Link
          href="/reports/monthly"
          className="
            hover:text-[#17379c]
          "
        >
          รายงานรายเดือน
        </Link>

        <ChevronRight
          size={15}
        />

        <Link
          href={
            `/reports/monthly/${year}`
          }
          className="
            hover:text-[#17379c]
          "
        >
          พ.ศ. {year}
        </Link>

        <ChevronRight
          size={15}
        />

        <span
          className="
            font-semibold
            text-[#172033]
          "
        >
          {monthName}
        </span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-[#eaf6ef]
              text-[#13795b]
            "
          >
            <CalendarDays
              size={22}
            />
          </div>

          <div>
            <h1
              className="
                text-2xl
                font-bold
                text-[#172033]
                md:text-3xl
              "
            >
              {monthName} พ.ศ.{" "}
              {year}
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-[#667085]
              "
            >
              รายละเอียดใบเสนอราคาประจำเดือน
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div
        className="
          mb-6
          grid
          gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >
        <div
          className="
            rounded-xl
            border
            border-[#e5e7eb]
            bg-white
            p-5
          "
        >
          <FileText
            size={20}
            className="
              mb-4
              text-[#17379c]
            "
          />

          <p
            className="
              text-sm
              text-[#667085]
            "
          >
            ใบเสนอราคา
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

        <div
          className="
            rounded-xl
            border
            border-[#e5e7eb]
            bg-white
            p-5
          "
        >
          <Wallet
            size={20}
            className="
              mb-4
              text-[#17379c]
            "
          />

          <p
            className="
              text-sm
              text-[#667085]
            "
          >
            มูลค่ารวม
          </p>

          <p
            className="
              mt-2
              text-xl
              font-bold
              text-[#17379c]
            "
          >
            {formatBaht(
              summary.totalAmount,
            )}
          </p>
        </div>

        <div
          className="
            rounded-xl
            border
            border-[#e5e7eb]
            bg-white
            p-5
          "
        >
          <Users
            size={20}
            className="
              mb-4
              text-[#17379c]
            "
          />

          <p
            className="
              text-sm
              text-[#667085]
            "
          >
            ลูกค้า
          </p>

          <p
            className="
              mt-2
              text-2xl
              font-bold
              text-[#172033]
            "
          >
            {summary.customerCount.toLocaleString(
              "th-TH",
            )}{" "}
            <span
              className="
                text-sm
                font-medium
                text-[#667085]
              "
            >
              บริษัท
            </span>
          </p>
        </div>

        <div
          className="
            rounded-xl
            border
            border-[#e5e7eb]
            bg-white
            p-5
          "
        >
          <Wallet
            size={20}
            className="
              mb-4
              text-[#df001b]
            "
          />

          <p
            className="
              text-sm
              text-[#667085]
            "
          >
            มูลค่าเฉลี่ยต่อใบ
          </p>

          <p
            className="
              mt-2
              text-xl
              font-bold
              text-[#172033]
            "
          >
            {formatBaht(
              summary.averageAmount,
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <MonthlyReportFilters
        year={year}
        month={month}
        search={search}
        customerId={
          customerId
        }
        customers={
          customers
        }
      />

      {/* Section */}
      <div
        className="
          my-5
          flex
          items-center
          justify-between
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
            เรียงจากวันที่ล่าสุด
          </p>
        </div>

        <span
          className="
            text-sm
            text-[#667085]
          "
        >
          พบ{" "}

          <strong
            className="
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

      <MonthlyReportTable
        quotations={
          result.items
        }
      />

      {/* Pagination */}
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
          <span
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
          </span>

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
                "
              >
                ก่อนหน้า
              </Link>
            ) : (
              <span
                className="
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
                "
              >
                ถัดไป
              </Link>
            ) : (
              <span
                className="
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