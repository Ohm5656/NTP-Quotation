import {
  CalendarDays,
} from "lucide-react";

import {
  getMonthlyReportYears,
} from "@/lib/queries/monthly-reports";

import {
  ReportFolderCard,
} from "@/components/reports/ReportFolderCard";

import {
  formatBaht,
} from "@/lib/format";

export default async function MonthlyReportsPage() {
  const years =
    await getMonthlyReportYears();

  return (
    <div
      className="
        mx-auto
        max-w-[1600px]
      "
    >
      {/* Header */}
      <div className="mb-7">
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

          MONTHLY REPORT
        </div>

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
                tracking-tight
                text-[#172033]
                md:text-3xl
              "
            >
              รายงานรายเดือน
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-[#667085]
              "
            >
              เลือกปีเพื่อดูรายงานใบเสนอราคาแยกตามเดือน
            </p>
          </div>
        </div>
      </div>

      {/* Folder Section */}
      <div
        className="
          mb-4
          flex
          items-end
          justify-between
          gap-3
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
            ปีทั้งหมด
          </h2>

          <p
            className="
              mt-1
              text-sm
              text-[#667085]
            "
          >
            ข้อมูลจากใบเสนอราคาที่ยังใช้งานอยู่ในระบบ
          </p>
        </div>

        <span
          className="
            text-sm
            text-[#667085]
          "
        >
          {years.length} ปี
        </span>
      </div>

      {years.length ===
      0 ? (
        <div
          className="
            rounded-xl
            border
            border-dashed
            border-[#d0d5dd]
            bg-white
            py-16
            text-center
            text-sm
            text-[#667085]
          "
        >
          ยังไม่มีข้อมูลรายงาน
        </div>
      ) : (
        <div
          className="
            grid
            gap-4
            md:grid-cols-2
            xl:grid-cols-3
          "
        >
          {years.map(
            (year) => (
              <ReportFolderCard
                key={
                  year.buddhistYear
                }
                href={
                  `/reports/monthly/${year.buddhistYear}`
                }
                title={
                  String(
                    year.buddhistYear,
                  )
                }
                subtitle={
                  `${year.monthCount} เดือนที่มีข้อมูล`
                }
                meta={
                  `${year.quotationCount.toLocaleString(
                    "th-TH",
                  )} ใบเสนอราคา • ${formatBaht(
                    year.totalAmount,
                  )}`
                }
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}