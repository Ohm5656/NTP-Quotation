import {
  Trash2,
} from "lucide-react";

import {
  displayOrDash,
  formatBaht,
  formatBoqNo,
  formatQuotationNo,
  formatThaiDate,
} from "@/lib/format";

import {
  RestoreQuotationButton,
} from "@/components/trash/RestoreQuotationButton";

import type {
  TrashQuotationItem,
} from "@/types/trash";

type Props = {
  quotations:
    TrashQuotationItem[];
};

function formatDeletedAt(
  value:
    | string
    | null,
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "th-TH-u-ca-buddhist",
    {
      timeZone:
        "Asia/Bangkok",

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(date);
}

export function TrashTable({
  quotations,
}: Props) {
  if (
    quotations.length ===
    0
  ) {
    return (
      <div
        className="
          rounded-xl
          border
          border-dashed
          border-[#d0d5dd]
          bg-white
          py-16
          text-center
        "
      >
        <Trash2
          size={30}
          className="
            mx-auto
            mb-3
            text-[#98a2b3]
          "
        />

        <p
          className="
            text-sm
            font-semibold
            text-[#344054]
          "
        >
          ไม่มีใบเสนอราคาในถังขยะ
        </p>

        <p
          className="
            mt-1
            text-sm
            text-[#98a2b3]
          "
        >
          รายการที่ลบจะมาแสดงที่นี่
        </p>
      </div>
    );
  }

  return (
    <div
      className="
        overflow-hidden
        rounded-xl
        border
        border-[#e5e7eb]
        bg-white
      "
    >
      <div className="overflow-x-auto">
        <table
          className="
            w-full
            min-w-[1200px]
            border-collapse
          "
        >
          <thead className="bg-[#f8f9fc]">
            <tr
              className="
                text-left
                text-xs
                font-semibold
                text-[#667085]
              "
            >
              <th className="px-4 py-3">
                วันที่
              </th>

              <th className="px-4 py-3">
                เลขใบเสนอราคา
              </th>

              <th className="px-4 py-3">
                บริษัท / งาน
              </th>

              <th className="px-4 py-3">
                BOQ
              </th>

              <th
                className="
                  px-4
                  py-3
                  text-right
                "
              >
                มูลค่า
              </th>

              <th className="px-4 py-3">
                ลบเมื่อ
              </th>

              <th
                className="
                  px-4
                  py-3
                  text-center
                "
              >
                จัดการ
              </th>
            </tr>
          </thead>

          <tbody>
            {quotations.map(
              (
                quotation,
              ) => (
                <tr
                  key={
                    quotation.id
                  }
                  className="
                    border-t
                    border-[#f0f1f3]
                    align-top
                    transition
                    hover:bg-[#fafbff]
                  "
                >
                  <td
                    className="
                      whitespace-nowrap
                      px-4
                      py-4
                      text-sm
                      text-[#475467]
                    "
                  >
                    {formatThaiDate(
                      quotation.quotation_date,
                    )}
                  </td>

                  <td
                    className="
                      whitespace-nowrap
                      px-4
                      py-4
                      text-sm
                      font-semibold
                      text-[#17379c]
                    "
                  >
                    {formatQuotationNo(
                      quotation.quotation_no,
                    )}
                  </td>

                  <td
                    className="
                      max-w-[380px]
                      px-4
                      py-4
                    "
                  >
                    <div
                      className="
                        text-sm
                        font-semibold
                        text-[#172033]
                      "
                    >
                      {displayOrDash(
                        quotation.customer_name_raw,
                      )}
                    </div>

                    <div
                      className="
                        mt-1
                        text-xs
                        leading-5
                        text-[#667085]
                      "
                    >
                      {displayOrDash(
                        quotation.project_name,
                      )}
                    </div>
                  </td>

                  <td
                    className="
                      whitespace-nowrap
                      px-4
                      py-4
                      text-sm
                      text-[#475467]
                    "
                  >
                    {formatBoqNo(
                      quotation.boq_no,
                    )}
                  </td>

                  <td
                    className="
                      whitespace-nowrap
                      px-4
                      py-4
                      text-right
                      text-sm
                      font-bold
                      text-[#17379c]
                    "
                  >
                    {formatBaht(
                      quotation.total_amount,
                    )}
                  </td>

                  <td
                    className="
                      whitespace-nowrap
                      px-4
                      py-4
                      text-sm
                      text-[#667085]
                    "
                  >
                    {formatDeletedAt(
                      quotation.deleted_at,
                    )}
                  </td>

                  <td
                    className="
                      px-4
                      py-4
                      text-center
                    "
                  >
                    <RestoreQuotationButton
                      quotationId={
                        quotation.id
                      }
                      customerId={
                        quotation.customer_id
                      }
                    />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}