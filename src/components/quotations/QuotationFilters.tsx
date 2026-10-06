"use client";

import {
  Search,
  LoaderCircle,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

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

type FilterOverrides = {
  search?: string;
  year?: string;
  month?: string;
  customer?: string;
};

export function QuotationFilters({
  search,
  year,
  month,
  customerId,
  years,
  customers,
}: Props) {
  const router =
    useRouter();

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [
    searchValue,
    setSearchValue,
  ] = useState(search);

  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    year
      ? String(year)
      : "",
  );

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    month
      ? String(month)
      : "",
  );

  const [
    selectedCustomer,
    setSelectedCustomer,
  ] = useState(
    customerId,
  );

  /*
   * Sync local state
   * เมื่อ URL / Server Props เปลี่ยน
   */
  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  useEffect(() => {
    setSelectedYear(
      year
        ? String(year)
        : "",
    );
  }, [year]);

  useEffect(() => {
    setSelectedMonth(
      month
        ? String(month)
        : "",
    );
  }, [month]);

  useEffect(() => {
    setSelectedCustomer(
      customerId,
    );
  }, [customerId]);

  /*
   * สร้าง URL ใหม่จาก Filter ปัจจุบัน
   *
   * เราไม่ใส่ page
   * เพื่อให้ทุก Search / Filter ใหม่
   * กลับไปหน้า 1 อัตโนมัติ
   */
  const createUrl =
    useCallback(
      (
        overrides:
          FilterOverrides = {},
      ) => {
        const params =
          new URLSearchParams();

        const nextSearch =
          overrides.search !==
          undefined
            ? overrides.search
            : searchValue;

        const nextYear =
          overrides.year !==
          undefined
            ? overrides.year
            : selectedYear;

        let nextMonth =
          overrides.month !==
          undefined
            ? overrides.month
            : selectedMonth;

        const nextCustomer =
          overrides.customer !==
          undefined
            ? overrides.customer
            : selectedCustomer;

        /*
         * ถ้าไม่มีปี
         * เดือนต้องไม่ถูกส่งไปด้วย
         */
        if (!nextYear) {
          nextMonth = "";
        }

        const trimmedSearch =
          nextSearch.trim();

        if (trimmedSearch) {
          params.set(
            "search",
            trimmedSearch,
          );
        }

        if (nextYear) {
          params.set(
            "year",
            nextYear,
          );
        }

        if (nextMonth) {
          params.set(
            "month",
            nextMonth,
          );
        }

        if (nextCustomer) {
          params.set(
            "customer",
            nextCustomer,
          );
        }

        const query =
          params.toString();

        return query
          ? `/quotations?${query}`
          : "/quotations";
      },
      [
        searchValue,
        selectedYear,
        selectedMonth,
        selectedCustomer,
      ],
    );

  /*
   * Live Search
   *
   * รอ 350ms หลังหยุดพิมพ์
   * เพื่อลดจำนวน Request
   */
  useEffect(() => {
    if (
      searchValue === search
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          startTransition(
            () => {
              router.replace(
                createUrl({
                  search:
                    searchValue,
                }),
                {
                  scroll:
                    false,
                },
              );
            },
          );
        },
        350,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    searchValue,
    search,
    router,
    createUrl,
  ]);

  function handleYearChange(
    value: string,
  ) {
    setSelectedYear(value);

    /*
     * ถ้ากลับเป็นทุกปี
     * ให้ล้างเดือนด้วย
     */
    if (!value) {
      setSelectedMonth("");
    }

    startTransition(
      () => {
        router.replace(
          createUrl({
            year: value,

            month: value
              ? selectedMonth
              : "",
          }),
          {
            scroll: false,
          },
        );
      },
    );
  }

  function handleMonthChange(
    value: string,
  ) {
    setSelectedMonth(value);

    startTransition(
      () => {
        router.replace(
          createUrl({
            month: value,
          }),
          {
            scroll: false,
          },
        );
      },
    );
  }

  function handleCustomerChange(
    value: string,
  ) {
    setSelectedCustomer(
      value,
    );

    startTransition(
      () => {
        router.replace(
          createUrl({
            customer:
              value,
          }),
          {
            scroll: false,
          },
        );
      },
    );
  }

  return (
    <div
      className="
        relative
        overflow-hidden
        rounded-xl
        border
        border-[#e5e7eb]
        bg-white
        p-4
        shadow-[0_1px_2px_rgba(16,24,40,0.03)]
      "
    >
      {/* NTP Red Accent */}
      <div
        className="
          absolute
          left-0
          top-0
          h-full
          w-[3px]
          bg-[#df001b]
        "
      />

      <div
        className="
          grid
          gap-3
          lg:grid-cols-[minmax(300px,2fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(240px,1.4fr)]
        "
      >
        {/* =================================================
         * Search
         * =============================================== */}
        <div>
          <div className="relative">
            <Search
              size={18}
              className="
                pointer-events-none
                absolute
                left-3.5
                top-1/2
                -translate-y-1/2
                text-[#98a2b3]
              "
            />

            <input
              type="search"
              value={
                searchValue
              }
              onChange={(
                event,
              ) =>
                setSearchValue(
                  event.target
                    .value,
                )
              }
              placeholder="ค้นหาเลขที่, บริษัท, งาน, BOQ, PO, ราคา..."
              autoComplete="off"
              className="
                h-11
                w-full
                rounded-lg
                border
                border-[#d0d5dd]
                bg-white
                pl-10
                pr-10
                text-sm
                text-[#172033]
                outline-none
                transition
                placeholder:text-[#98a2b3]
                focus:border-[#17379c]
                focus:ring-2
                focus:ring-[#17379c]/10
              "
            />

            {isPending && (
              <LoaderCircle
                size={17}
                className="
                  absolute
                  right-3.5
                  top-1/2
                  -translate-y-1/2
                  animate-spin
                  text-[#17379c]
                "
              />
            )}
          </div>

          <p
            className="
              mt-1.5
              px-1
              text-[11px]
              text-[#98a2b3]
            "
          >
            พิมพ์แล้วระบบค้นหาให้อัตโนมัติ
          </p>
        </div>

        {/* =================================================
         * Year
         * =============================================== */}
        <div>
          <select
            value={
              selectedYear
            }
            onChange={(
              event,
            ) =>
              handleYearChange(
                event.target
                  .value,
              )
            }
            className="
              h-11
              w-full
              rounded-lg
              border
              border-[#d0d5dd]
              bg-white
              px-3
              text-sm
              text-[#172033]
              outline-none
              transition
              focus:border-[#17379c]
              focus:ring-2
              focus:ring-[#17379c]/10
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
        </div>

        {/* =================================================
         * Month
         * =============================================== */}
        <div>
          <select
            value={
              selectedMonth
            }
            onChange={(
              event,
            ) =>
              handleMonthChange(
                event.target
                  .value,
              )
            }
            disabled={
              !selectedYear
            }
            className="
              h-11
              w-full
              rounded-lg
              border
              border-[#d0d5dd]
              bg-white
              px-3
              text-sm
              text-[#172033]
              outline-none
              transition
              focus:border-[#17379c]
              focus:ring-2
              focus:ring-[#17379c]/10
              disabled:cursor-not-allowed
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
        </div>

        {/* =================================================
         * Customer
         * =============================================== */}
        <div>
          <select
            value={
              selectedCustomer
            }
            onChange={(
              event,
            ) =>
              handleCustomerChange(
                event.target
                  .value,
              )
            }
            className="
              h-11
              w-full
              min-w-0
              rounded-lg
              border
              border-[#d0d5dd]
              bg-white
              px-3
              text-sm
              text-[#172033]
              outline-none
              transition
              focus:border-[#17379c]
              focus:ring-2
              focus:ring-[#17379c]/10
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
              (
                customer,
              ) => (
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
        </div>
      </div>
    </div>
  );
}