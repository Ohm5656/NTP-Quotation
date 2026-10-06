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
  MonthlyCustomerOption,
} from "@/lib/queries/monthly-reports";

type Props = {
  year: number;

  month: number;

  search: string;

  customerId: string;

  customers:
    MonthlyCustomerOption[];
};

export function MonthlyReportFilters({
  year,
  month,
  search,
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
    setSelectedCustomer(
      customerId,
    );
  }, [customerId]);

  const createUrl =
    useCallback(
      (
        nextSearch:
          string,
        nextCustomer:
          string,
      ) => {
        const params =
          new URLSearchParams();

        const trimmed =
          nextSearch.trim();

        if (trimmed) {
          params.set(
            "search",
            trimmed,
          );
        }

        if (
          nextCustomer
        ) {
          params.set(
            "customer",
            nextCustomer,
          );
        }

        const query =
          params.toString();

        const base =
          `/reports/monthly/${year}/${month}`;

        return query
          ? `${base}?${query}`
          : base;
      },
      [
        year,
        month,
      ],
    );

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
                createUrl(
                  searchValue,
                  selectedCustomer,
                ),
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
    selectedCustomer,
    router,
    createUrl,
  ]);

  function changeCustomer(
    value: string,
  ) {
    setSelectedCustomer(
      value,
    );

    startTransition(
      () => {
        router.replace(
          createUrl(
            searchValue,
            value,
          ),
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
          lg:grid-cols-[2fr_1fr]
        "
      >
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
              placeholder="ค้นหาวันที่, Q, BOQ, บริษัท, ชื่องาน, ราคา, PO, ผู้ติดต่อ..."
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
                outline-none
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
            rounded-lg
            border
            border-[#d0d5dd]
            bg-white
            px-3
            text-sm
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