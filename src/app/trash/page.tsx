import Link from "next/link";

import {
  Trash2,
} from "lucide-react";

import {
  getTrashQuotations,
} from "@/lib/queries/trash";

import {
  TrashFilters,
} from "@/components/trash/TrashFilters";

import {
  TrashTable,
} from "@/components/trash/TrashTable";

type PageProps = {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
};

function parsePage(
  value:
    | string
    | undefined,
) {
  if (!value) {
    return 1;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return 1;
  }

  return Math.max(
    1,
    parsed,
  );
}

export default async function TrashPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const search =
    params.search?.trim() ??
    "";

  const page =
    parsePage(
      params.page,
    );

  const result =
    await getTrashQuotations({
      search,
      page,
    });

  function createPageUrl(
    targetPage: number,
  ) {
    const url =
      new URLSearchParams();

    if (search) {
      url.set(
        "search",
        search,
      );
    }

    url.set(
      "page",
      String(
        targetPage,
      ),
    );

    return `/trash?${url.toString()}`;
  }

  return (
    <div
      className="
        mx-auto
        max-w-[1600px]
      "
    >
      {/* Header */}
      <div className="mb-6">
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

          TRASH
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
              h-10
              w-10
              items-center
              justify-center
              rounded-lg
              bg-[#fff1f2]
              text-[#df001b]
            "
          >
            <Trash2
              size={20}
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
              ถังขยะ
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-[#667085]
              "
            >
              ใบเสนอราคาที่ถูกลบสามารถกู้คืนกลับเข้าสู่ระบบได้
            </p>
          </div>
        </div>
      </div>

      {/* Notice */}
      <div
        className="
          mb-5
          rounded-xl
          border
          border-[#e5e7eb]
          bg-white
          px-4
          py-3
          text-sm
          text-[#667085]
        "
      >
        รายการในหน้านี้ยังไม่ได้ถูกลบออกจากฐานข้อมูลจริง
        เมื่อกู้คืนแล้วจะกลับไปแสดงในภาพรวม รายงาน และหน้าจัดการใบเสนอราคาอีกครั้ง
      </div>

      <TrashFilters
        search={
          search
        }
      />

      <div
        className="
          my-5
          flex
          items-center
          justify-between
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
            ใบเสนอราคาที่ถูกลบ
          </h2>

          <p
            className="
              mt-1
              text-sm
              text-[#667085]
            "
          >
            เรียงตามเวลาที่ลบล่าสุด
          </p>
        </div>

        <p
          className="
            text-sm
            text-[#667085]
          "
        >
          ทั้งหมด{" "}

          <strong
            className="
              font-bold
              text-[#df001b]
            "
          >
            {result.total.toLocaleString(
              "th-TH",
            )}
          </strong>{" "}

          รายการ
        </p>
      </div>

      <TrashTable
        quotations={
          result.items
        }
      />

      {/* Pagination */}
      {result.totalPages >
        1 && (
        <div
          className="
            mt-4
            flex
            items-center
            justify-between
          "
        >
          <span
            className="
              text-sm
              text-[#667085]
            "
          >
            หน้า{" "}
            {result.page}{" "}
            จาก{" "}
            {
              result.totalPages
            }
          </span>

          <div
            className="
              flex
              gap-2
            "
          >
            {result.page >
              1 ? (
              <Link
                href={createPageUrl(
                  result.page -
                    1,
                )}
                className="
                  rounded-lg
                  border
                  border-[#d0d5dd]
                  bg-white
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-[#344054]
                "
              >
                ก่อนหน้า
              </Link>
            ) : (
              <span
                className="
                  rounded-lg
                  border
                  border-[#e5e7eb]
                  bg-[#f8f9fc]
                  px-4
                  py-2
                  text-sm
                  text-[#98a2b3]
                "
              >
                ก่อนหน้า
              </span>
            )}

            {result.page <
            result.totalPages ? (
              <Link
                href={createPageUrl(
                  result.page +
                    1,
                )}
                className="
                  rounded-lg
                  border
                  border-[#d0d5dd]
                  bg-white
                  px-4
                  py-2
                  text-sm
                  font-medium
                  text-[#344054]
                "
              >
                ถัดไป
              </Link>
            ) : (
              <span
                className="
                  rounded-lg
                  border
                  border-[#e5e7eb]
                  bg-[#f8f9fc]
                  px-4
                  py-2
                  text-sm
                  text-[#98a2b3]
                "
              >
                ถัดไป
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}