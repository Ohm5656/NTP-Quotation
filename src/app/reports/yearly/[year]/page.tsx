import Link from "next/link";

import {
  CalendarDays,
  CalendarRange,
  ChevronRight,
  FileText,
  Users,
  Wallet,
} from "lucide-react";

import {
  notFound,
} from "next/navigation";

import {
  getYearlyReportOverview,
  getYearlyReportQuotations,
} from "@/lib/queries/yearly-reports";

import {
  YearlyReportFilters,
} from "@/components/reports/YearlyReportFilters";

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
  }>;

  searchParams: Promise<{
    search?: string;

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

export default async function YearlyDetailPage({
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

  if (
    !Number.isFinite(
      year,
    ) ||
    year < 2400 ||
    year > 2700
  ) {
    notFound();
  }

  const search =
    query.search?.trim() ??
    "";

  const month =
    parseNumber(
      query.month,
    );

  const customerId =
    query.customer ??
    "";

  const page =
    parseNumber(
      query.page,
    ) ?? 1;

  const [
    overview,
    result,
  ] =
    await Promise.all([
      getYearlyReportOverview(
        year,
      ),

      getYearlyReportQuotations(
        year,
        {
          search,
          month,
          customerId,
          page,
        },
      ),
    ]);

  const paginationParams =
    new URLSearchParams();

  if (search) {
    paginationParams.set(
      "search",
      search,
    );
  }

  if (month) {
    paginationParams.set(
      "month",
      String(month),
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

    return `/reports/yearly/${year}?${params.toString()}`;
  }

  return (
    <div
      className="
        mx-auto
        max-w-[1600px]
      "
    >
      {/* =====================================================
       * Breadcrumb
       * =================================================== */}
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
          href="/reports/yearly"
          className="
            transition
            hover:text-[#17379c]
          "
        >
          รายงานรายปี
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
          พ.ศ. {year}
        </span>
      </div>

      {/* =====================================================
       * Header
       * =================================================== */}
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
            <CalendarRange
              size={22}
            />
          </div>

          <div>
            <h1
              className="
                text-2xl
                font-bold
                tracking-tight
                text-[#172033]
                md:text-3xl
              "
            >
              รายงานประจำปี พ.ศ.{" "}
              {year}
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-[#667085]
              "
            >
              ภาพรวมและรายละเอียดใบเสนอราคาตลอดทั้งปี
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
       * KPI
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
        {/* Quotation */}
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
            {overview.summary.quotationCount.toLocaleString(
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

        {/* Total */}
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
              overview.summary.totalAmount,
            )}
          </p>
        </div>

        {/* Customer */}
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
            {overview.summary.customerCount.toLocaleString(
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

        {/* Average */}
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
              overview.summary.averageAmount,
            )}
          </p>
        </div>
      </div>

      {/* =====================================================
       * Monthly Summary
       * =================================================== */}
      <section className="mb-7">
        <div className="mb-4">
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
              สรุปแต่ละเดือน
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
            จำนวนใบเสนอราคา ลูกค้า และมูลค่ารวมในแต่ละเดือน
          </p>
        </div>

        <div
          className="
            overflow-hidden
            rounded-xl
            border
            border-[#e5e7eb]
            bg-white
          "
        >
          <div className="overflow-x-auto">
            <table
              className="
                w-full
                min-w-[760px]
                border-collapse
              "
            >
              <thead className="bg-[#f8f9fc]">
                <tr
                  className="
                    text-left
                    text-xs
                    font-semibold
                    text-[#667085]
                  "
                >
                  <th className="px-5 py-3">
                    เดือน
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-right
                    "
                  >
                    ใบเสนอราคา
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-right
                    "
                  >
                    ลูกค้า
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-right
                    "
                  >
                    มูลค่ารวม
                  </th>
                </tr>
              </thead>

              <tbody>
                {overview.months.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={
                        item.month
                      }
                      className="
                        border-t
                        border-[#f0f1f3]
                      "
                    >
                      <td
                        className="
                          px-5
                          py-3.5
                          text-sm
                          font-semibold
                          text-[#172033]
                        "
                      >
                        <div
                          className="
                            flex
                            items-center
                            gap-2
                          "
                        >
                          <CalendarDays
                            size={16}
                            className="
                              text-[#13795b]
                            "
                          />

                          {
                            monthNames[
                              item.month
                            ]
                          }
                        </div>
                      </td>

                      <td
                        className="
                          px-5
                          py-3.5
                          text-right
                          text-sm
                          text-[#475467]
                        "
                      >
                        {item.quotationCount.toLocaleString(
                          "th-TH",
                        )}
                      </td>

                      <td
                        className="
                          px-5
                          py-3.5
                          text-right
                          text-sm
                          text-[#475467]
                        "
                      >
                        {item.customerCount.toLocaleString(
                          "th-TH",
                        )}
                      </td>

                      <td
                        className="
                          px-5
                          py-3.5
                          text-right
                          text-sm
                          font-semibold
                          text-[#17379c]
                        "
                      >
                        {formatBaht(
                          item.totalAmount,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =====================================================
       * Top Customers
       * =================================================== */}
      <section className="mb-7">
        <div className="mb-4">
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
              ลูกค้ามูลค่าสูงสุด
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
            10 อันดับลูกค้าที่ได้รับใบเสนอราคามูลค่ารวมสูงสุดในปีนี้
          </p>
        </div>

        <div
          className="
            grid
            gap-3
            lg:grid-cols-2
          "
        >
          {overview.topCustomers.map(
            (
              customer,
              index,
            ) => (
              <div
                key={
                  customer.customerId ??
                  `${customer.customerName}-${index}`
                }
                className="
                  flex
                  items-center
                  gap-4
                  rounded-xl
                  border
                  border-[#e5e7eb]
                  bg-white
                  p-4
                "
              >
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-[#eef2ff]
                    text-sm
                    font-bold
                    text-[#17379c]
                  "
                >
                  {index +
                    1}
                </div>

                <div
                  className="
                    min-w-0
                    flex-1
                  "
                >
                  <p
                    className="
                      truncate
                      text-sm
                      font-semibold
                      text-[#172033]
                    "
                  >
                    {
                      customer.customerName
                    }
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-[#667085]
                    "
                  >
                    {customer.quotationCount.toLocaleString(
                      "th-TH",
                    )}{" "}
                    ใบเสนอราคา
                  </p>
                </div>

                <p
                  className="
                    whitespace-nowrap
                    text-sm
                    font-bold
                    text-[#17379c]
                  "
                >
                  {formatBaht(
                    customer.totalAmount,
                  )}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      {/* =====================================================
       * Detail Filters
       * =================================================== */}
      <section>
        <div className="mb-4">
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
              รายการใบเสนอราคาทั้งปี
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
            ค้นหาและกรองข้อมูลใบเสนอราคาในปี พ.ศ.{" "}
            {year}
          </p>
        </div>

        <YearlyReportFilters
          year={year}
          search={search}
          month={month}
          customerId={
            customerId
          }
          customers={
            overview.customers
          }
        />

        <div
          className="
            my-4
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
            {month
              ? `เดือน ${
                  monthNames[
                    month
                  ]
                }`
              : "ทุกเดือน"}
          </p>

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
                    hover:bg-[#f8f9fc]
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
                    hover:bg-[#f8f9fc]
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
      </section>
    </div>
  );
}