import {
  AlertTriangle,
  Building2,
} from "lucide-react";

import {
  getCustomerSummaries,
  getDashboardTotals,
} from "@/lib/queries/dashboard";

import {
  formatBaht,
} from "@/lib/format";

import {
  CustomerCard,
} from "@/components/dashboard/CustomerCard";

import {
  SummaryCard,
} from "@/components/dashboard/SummaryCard";

export default async function DashboardPage() {
  const [
    customers,
    totals,
  ] = await Promise.all([
    getCustomerSummaries(),
    getDashboardTotals(),
  ]);

  const totalCustomers =
    customers.length;

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* =====================================================
       * Page Header
       * =================================================== */}
      <div
        className="
          mb-7
          flex flex-col
          justify-between
          gap-4
          xl:flex-row
          xl:items-end
        "
      >
        <div>
          <div
            className="
              mb-2
              flex items-center
              gap-2
              text-sm
              font-semibold
              text-[#df001b]
            "
          >
            <span
              className="
                h-2 w-2
                rounded-full
                bg-[#df001b]
              "
            />

            QUOTATION OVERVIEW
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
            ภาพรวมลูกค้า
          </h1>

          <p
            className="
              mt-2
              text-sm
              text-[#667085]
            "
          >
            ภาพรวมใบเสนอราคาแยกตามบริษัทและสาขาของลูกค้า
          </p>
        </div>
      </div>

      {/* =====================================================
       * Summary
       *
       * สำคัญ:
       * จำนวนใบเสนอราคาและยอดรวม
       * อ่านจาก quotations โดยตรง
       * ไม่ได้ SUM จาก Customer Card
       *
       * เพื่อให้รายการที่ Customer ว่าง
       * ยังถูกนับในยอดรวมด้วย
       * =================================================== */}
      <div
        className="
          grid
          gap-4
          md:grid-cols-3
        "
      >
        <SummaryCard
          label="บริษัท / สาขาลูกค้า"
          value={
            totalCustomers.toLocaleString(
              "th-TH",
            )
          }
          subtext="ตามข้อมูลที่บันทึกในระบบ"
        />

        <SummaryCard
          label="ใบเสนอราคาทั้งหมด"
          value={
            totals.quotation_count.toLocaleString(
              "th-TH",
            )
          }
          subtext="ไม่รวมรายการในถังขยะ"
        />

        <SummaryCard
          label="มูลค่าที่เสนอทั้งหมด"
          value={
            formatBaht(
              totals.total_quoted_amount,
            )
          }
          subtext="ยอดรวมใบเสนอราคาทั้งหมด"
        />
      </div>

      {/* =====================================================
       * Missing Customer Warning
    
      )}

      {/* =====================================================
       * Customers
       * =================================================== */}
      <section className="mt-8">
        <div
          className="
            mb-4
            flex
            items-end
            justify-between
            gap-4
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
              ลูกค้าทั้งหมด
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-[#667085]
              "
            >
              เรียงตามมูลค่าใบเสนอราคาสูงสุด
            </p>
          </div>

          <span
            className="
              text-sm
              text-[#667085]
            "
          >
            {customers.length.toLocaleString(
              "th-TH",
            )}{" "}
            รายการ
          </span>
        </div>

        {customers.length ===
        0 ? (
          <div
            className="
              rounded-xl
              border
              border-dashed
              border-[#d0d5dd]
              bg-white
              p-12
              text-center
            "
          >
            <Building2
              className="
                mx-auto
                mb-3
                text-[#98a2b3]
              "
              size={30}
            />

            <p
              className="
                text-sm
                text-[#667085]
              "
            >
              ยังไม่มีข้อมูลลูกค้า
            </p>
          </div>
        ) : (
          <div
            className="
              grid
              gap-4
              md:grid-cols-2
              xl:grid-cols-3
              2xl:grid-cols-4
            "
          >
            {customers.map(
              (customer) => (
                <CustomerCard
                  key={
                    customer.customer_id
                  }
                  customer={
                    customer
                  }
                />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}