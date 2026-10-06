import Link from "next/link";

import type {
  CustomerOption,
} from "@/types/database";

const months = [
  [1, "มกราคม"],
  [2, "กุมภาพันธ์"],
  [3, "มีนาคม"],
  [4, "เมษายน"],
  [5, "พฤษภาคม"],
  [6, "มิถุนายน"],
  [7, "กรกฎาคม"],
  [8, "สิงหาคม"],
  [9, "กันยายน"],
  [10, "ตุลาคม"],
  [11, "พฤศจิกายน"],
  [12, "ธันวาคม"],
] as const;

type Props = {
  search: string;

  year?: number;

  month?: number;

  customerId: string;

  years: number[];

  customers:
    CustomerOption[];
};

export function QuotationFilters({
  search,
  year,
  month,
  customerId,
  years,
  customers,
}: Props) {
  return (
    <form
      method="GET"
      className="
        rounded-xl
        border
        border-[#e5e7eb]
        bg-white
        p-4
      "
    >
      <div
        className="
          grid
          gap-3
          lg:grid-cols-[2fr_1fr_1fr_1.5fr_auto]
        "
      >
        <input
          type="search"
          name="search"
          defaultValue={
            search
          }
          placeholder="ค้นหาเลขที่, บริษัท, ชื่องาน, BOQ, PO..."
          className="
            h-11
            rounded-lg
            border
            border-[#d0d5dd]
            bg-white
            px-3
            text-sm
            outline-none
            transition
            focus:border-[#17379c]
          "
        />

        <select
          name="year"
          defaultValue={
            year ?? ""
          }
          className="
            h-11
            rounded-lg
            border
            border-[#d0d5dd]
            bg-white
            px-3
            text-sm
          "
        >
          <option value="">
            ทุกปี
          </option>

          {years.map(
            (item) => (
              <option
                key={
                  item
                }
                value={
                  item
                }
              >
                พ.ศ.{" "}
                {item}
              </option>
            ),
          )}
        </select>

        <select
          name="month"
          defaultValue={
            month ?? ""
          }
          disabled={
            !year
          }
          className="
            h-11
            rounded-lg
            border
            border-[#d0d5dd]
            bg-white
            px-3
            text-sm
            disabled:bg-[#f2f4f7]
            disabled:text-[#98a2b3]
          "
        >
          <option value="">
            ทุกเดือน
          </option>

          {months.map(
            ([
              value,
              label,
            ]) => (
              <option
                key={
                  value
                }
                value={
                  value
                }
              >
                {label}
              </option>
            ),
          )}
        </select>

        <select
          name="customer"
          defaultValue={
            customerId
          }
          className="
            h-11
            min-w-0
            rounded-lg
            border
            border-[#d0d5dd]
            bg-white
            px-3
            text-sm
          "
        >
          <option value="">
            ทุกบริษัท
          </option>

          <option
            value="__blank__"
          >
            - ไม่ระบุลูกค้า
          </option>

          {customers.map(
            (customer) => (
              <option
                key={
                  customer.id
                }
                value={
                  customer.id
                }
              >
                {
                  customer.name
                }
              </option>
            ),
          )}
        </select>

        <div
          className="
            flex gap-2
          "
        >
          <button
            type="submit"
            className="
              h-11
              rounded-lg
              bg-[#17379c]
              px-5
              text-sm
              font-semibold
              text-white
              transition
              hover:bg-[#10266f]
            "
          >
            ค้นหา
          </button>

          <Link
            href="/quotations"
            className="
              flex h-11
              items-center
              rounded-lg
              border
              border-[#d0d5dd]
              px-4
              text-sm
              font-medium
              text-[#475467]
            "
          >
            ล้าง
          </Link>
        </div>
      </div>
    </form>
  );
}