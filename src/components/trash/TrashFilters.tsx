"use client";

import {
  LoaderCircle,
  Search,
} from "lucide-react";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

type Props = {
  search: string;
};

export function TrashFilters({
  search,
}: Props) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    value,
    setValue,
  ] = useState(
    search,
  );

  useEffect(() => {
    setValue(
      search,
    );
  }, [search]);

  useEffect(() => {
    if (
      value ===
      search
    ) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          const params =
            new URLSearchParams();

          const trimmed =
            value.trim();

          if (trimmed) {
            params.set(
              "search",
              trimmed,
            );
          }

          const query =
            params.toString();

          startTransition(
            () => {
              router.replace(
                query
                  ? `/trash?${query}`
                  : "/trash",
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
    value,
    search,
    router,
  ]);

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
          relative
          max-w-[650px]
        "
      >
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
            value
          }
          onChange={(
            event,
          ) => {
            setValue(
              event.target
                .value,
            );
          }}
          placeholder="ค้นหาเลขใบเสนอราคา, บริษัท, ชื่องาน, BOQ, PO..."
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
    </div>
  );
}