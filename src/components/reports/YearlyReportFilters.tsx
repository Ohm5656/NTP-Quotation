"use client";

import {
  LoaderCircle,
  Search,
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
  YearlyCustomerOption,
} from "@/lib/queries/yearly-reports";

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
  year: number;

  search: string;

  month?: number;

  customerId: string;

  customers:
    YearlyCustomerOption[];
};

type Overrides = {
  search?: string;

  month?: string;

  customer?: string;
};

export function YearlyReportFilters({
  year,
  search,
  month,
  customerId,
  customers,
}: Props) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    searchValue,
    setSearchValue,
  ] = useState(
    search,
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

  useEffect(() => {
    setSearchValue(
      search,
    );
  }, [search]);

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

  const createUrl =
    useCallback(
      (
        overrides:
          Overrides = {},
      ) => {
        const params =
          new URLSearchParams();

        const nextSearch =
          overrides.search !==
          undefined
            ? overrides.search
            : searchValue;

        const nextMonth =
          overrides.month !==
          undefined
            ? overrides.month
            : selectedMonth;

        const nextCustomer =
          overrides.customer !==
          undefined
            ? overrides.customer
            : selectedCustomer;

        const trimmed =
          nextSearch.trim();

        if (trimmed) {
          params.set(
            "search",
            trimmed,
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

        const base =
          `/reports/yearly/${year}`;

        return query
          ? `${base}?${query}`
          : base;
      },
      [
        year,
        searchValue,
        selectedMonth,
        selectedCustomer,
      ],
    );

  /* =======================================================
   * Live Search
   * ===================================================== */

  useEffect(() => {
    if (
      searchValue ===
      search
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

  function changeMonth(
    value: string,
  ) {
    setSelectedMonth(
      value,
    );

    startTransition(
      () => {
        router.replace(
          createUrl({
            month:
              value,
          }),
          {
            scroll:
              false,
          },
        );
      },
    );
  }

  function changeCustomer(
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
            scroll:
              false,
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
      "
    >
      <div
        className="
          absolute
          bottom-0
          left-0
          top-0
          w-[3px]
          bg-[#df001b]
        "
      />

      <div
        className="
          grid
          gap-3
          lg:grid-cols-[2fr_0.8fr_1.2fr]
        "
      >
        {/* Search */}
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
              ) => {
                setSearchValue(
                  event.target
                    .value,
                );
              }}
              placeholder="ค้นหาวันที่, Q, BOQ, บริษัท, งาน, ราคา, PO, ผู้ติดต่อ..."
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
                focus:border-[#17379c]
                focus:ring-2
                focus:ring-[#17379c]/10
              "
            />

            {pending && (
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
              text-[11px]
              text-[#98a2b3]
            "
          >
            พิมพ์แล้วระบบค้นหาให้อัตโนมัติ
          </p>
        </div>

        {/* Month */}
        <select
          value={
            selectedMonth
          }
          onChange={(
            event,
          ) => {
            changeMonth(
              event.target
                .value,
            );
          }}
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
            focus:border-[#17379c]
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

        {/* Customer */}
        <select
          value={
            selectedCustomer
          }
          onChange={(
            event,
          ) => {
            changeCustomer(
              event.target
                .value,
            );
          }}
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
            focus:border-[#17379c]
          "
        >
          <option value="">
            ทุกบริษัท
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
  );
}