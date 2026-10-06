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
  customerId: string;

  search: string;

  year?: number;

  month?: number;

  years: number[];
};

type Overrides = {
  search?: string;
  year?: string;
  month?: string;
};

export function CustomerQuotationFilters({
  customerId,
  search,
  year,
  month,
  years,
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

  useEffect(() => {
    setSearchValue(
      search,
    );
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

        if (!nextYear) {
          nextMonth = "";
        }

        const trimmed =
          nextSearch.trim();

        if (trimmed) {
          params.set(
            "search",
            trimmed,
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

        const query =
          params.toString();

        const base =
          `/customers/${customerId}`;

        return query
          ? `${base}?${query}`
          : base;
      },
      [
        customerId,
        searchValue,
        selectedYear,
        selectedMonth,
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

    const timeout =
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
        timeout,
      );
    };
  }, [
    searchValue,
    search,
    router,
    createUrl,
  ]);

  function changeYear(
    value: string,
  ) {
    setSelectedYear(
      value,
    );

    if (!value) {
      setSelectedMonth(
        "",
      );
    }

    startTransition(
      () => {
        router.replace(
          createUrl({
            year:
              value,

            month:
              value
                ? selectedMonth
                : "",
          }),
          {
            scroll:
              false,
          },
        );
      },
    );
  }

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
          lg:grid-cols-[2fr_0.8fr_0.8fr]
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
              placeholder="ค้นหาวันที่, Q, BOQ, ชื่องาน, ราคา, PO, ผู้ติดต่อ..."
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
              px-1
              text-[11px]
              text-[#98a2b3]
            "
          >
            ค้นหาอัตโนมัติจากวันที่ ชื่องาน ราคา เลขใบเสนอราคา BOQ PO และผู้ติดต่อ
          </p>
        </div>

        {/* Year */}
        <select
          value={
            selectedYear
          }
          onChange={(
            event,
          ) => {
            changeYear(
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
            focus:border-[#17379c]
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
              number,
              name,
            ]) => (
              <option
                key={
                  number
                }
                value={
                  number
                }
              >
                {name}
              </option>
            ),
          )}
        </select>
      </div>
    </div>
  );
}