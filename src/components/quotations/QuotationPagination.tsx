import Link from "next/link";

type Props = {
  page: number;

  totalPages: number;

  total: number;

  params:
    Record<
      string,
      string
    >;
};

export function QuotationPagination({
  page,
  totalPages,
  total,
  params,
}: Props) {
  function createHref(
    targetPage: number,
  ) {
    const searchParams =
      new URLSearchParams(
        params,
      );

    searchParams.set(
      "page",
      String(
        targetPage,
      ),
    );

    return `/quotations?${searchParams.toString()}`;
  }

  return (
    <div
      className="
        mt-4
        flex flex-col
        items-center
        justify-between
        gap-3
        sm:flex-row
      "
    >
      <div
        className="
          text-sm
          text-[#667085]
        "
      >
        ทั้งหมด{" "}
        <strong
          className="
            text-[#172033]
          "
        >
          {total.toLocaleString(
            "th-TH",
          )}
        </strong>{" "}
        รายการ
      </div>

      <div
        className="
          flex items-center
          gap-2
        "
      >
        {page > 1 ? (
          <Link
            href={createHref(
              page - 1,
            )}
            className="
              rounded-lg
              border
              border-[#d0d5dd]
              bg-white
              px-4 py-2
              text-sm
            "
          >
            ก่อนหน้า
          </Link>
        ) : (
          <span
            className="
              cursor-not-allowed
              rounded-lg
              border
              border-[#e5e7eb]
              bg-[#f8f9fc]
              px-4 py-2
              text-sm
              text-[#98a2b3]
            "
          >
            ก่อนหน้า
          </span>
        )}

        <span
          className="
            px-2
            text-sm
            text-[#475467]
          "
        >
          {page} /{" "}
          {totalPages}
        </span>

        {page <
        totalPages ? (
          <Link
            href={createHref(
              page + 1,
            )}
            className="
              rounded-lg
              border
              border-[#d0d5dd]
              bg-white
              px-4 py-2
              text-sm
            "
          >
            ถัดไป
          </Link>
        ) : (
          <span
            className="
              cursor-not-allowed
              rounded-lg
              border
              border-[#e5e7eb]
              bg-[#f8f9fc]
              px-4 py-2
              text-sm
              text-[#98a2b3]
            "
          >
            ถัดไป
          </span>
        )}
      </div>
    </div>
  );
}