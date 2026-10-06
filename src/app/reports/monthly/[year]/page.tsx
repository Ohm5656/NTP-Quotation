import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
} from "lucide-react";

import {
  notFound,
} from "next/navigation";

import {
  getMonthlyReportMonths,
} from "@/lib/queries/monthly-reports";

import {
  ReportFolderCard,
} from "@/components/reports/ReportFolderCard";

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
};

export default async function MonthlyYearPage({
  params,
}: PageProps) {
  const {
    year: yearParam,
  } =
    await params;

  const year =
    Number(
      yearParam,
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

  const months =
    await getMonthlyReportMonths(
      year,
    );

  const activeMonths =
    months.filter(
      (month) =>
        month.hasData,
    );

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
            transition
            hover:text-[#17379c]
          "
        >
          รายงานรายเดือน
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

      {/* Header */}
      <div className="mb-7">
        <Link
          href="/reports/monthly"
          className="
            mb-4
            inline-flex
            items-center
            gap-1
            text-sm
            font-medium
            text-[#667085]
            hover:text-[#17379c]
          "
        >
          <ArrowLeft
            size={16}
          />

          กลับไปเลือกปี
        </Link>

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
              รายงานรายเดือน พ.ศ.{" "}
              {year}
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-[#667085]
              "
            >
              มีข้อมูลใบเสนอราคาแล้ว{" "}
              {
                activeMonths.length
              }{" "}
              เดือน
            </p>
          </div>
        </div>
      </div>

      {/* Months */}
      <div
        className="
          grid
          gap-4
          md:grid-cols-2
          xl:grid-cols-3
        "
      >
        {months.map(
          (month) => (
            <ReportFolderCard
              key={
                month.month
              }
              href={
                month.hasData
                  ? `/reports/monthly/${year}/${month.month}`
                  : undefined
              }
              disabled={
                !month.hasData
              }
              title={
                monthNames[
                  month.month
                ]
              }
              subtitle={
                month.hasData
                  ? `${month.quotationCount.toLocaleString(
                      "th-TH",
                    )} ใบเสนอราคา • ${month.customerCount} ลูกค้า`
                  : "ไม่มีข้อมูล"
              }
              meta={
                month.hasData
                  ? formatBaht(
                      month.totalAmount,
                    )
                  : undefined
              }
            />
          ),
        )}
      </div>
    </div>
  );
}