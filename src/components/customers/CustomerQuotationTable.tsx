import {
  displayOrDash,
  formatBaht,
  formatBoqNo,
  formatQuotationNo,
  formatThaiDate,
} from "@/lib/format";

import type {
  QuotationListItem,
} from "@/types/database";

type Props = {
  quotations:
    QuotationListItem[];
};

export function CustomerQuotationTable({
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
          px-6
          py-16
          text-center
        "
      >
        <p
          className="
            text-sm
            font-semibold
            text-[#344054]
          "
        >
          ไม่พบใบเสนอราคา
        </p>

        <p
          className="
            mt-1
            text-sm
            text-[#98a2b3]
          "
        >
          ลองเปลี่ยนคำค้นหาหรือช่วงเวลา
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
            min-w-[1150px]
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
                ชื่องาน
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
                PO
              </th>

              <th className="px-4 py-3">
                ผู้ติดต่อ
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
                  {/* Date */}
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

                  {/* Quotation */}
                  <td
                    className="
                      whitespace-nowrap
                      px-4
                      py-4
                      text-sm
                      font-bold
                      text-[#17379c]
                    "
                  >
                    {formatQuotationNo(
                      quotation.quotation_no,
                    )}
                  </td>

                  {/* Project */}
                  <td
                    className="
                      max-w-[420px]
                      px-4
                      py-4
                    "
                  >
                    <p
                      className="
                        text-sm
                        font-semibold
                        leading-5
                        text-[#172033]
                      "
                    >
                      {displayOrDash(
                        quotation.project_name,
                      )}
                    </p>
                  </td>

                  {/* BOQ */}
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

                  {/* Amount */}
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

                  {/* PO */}
                  <td
                    className="
                      whitespace-nowrap
                      px-4
                      py-4
                      text-sm
                      text-[#475467]
                    "
                  >
                    {displayOrDash(
                      quotation.po,
                    )}
                  </td>

                  {/* Contact */}
                  <td
                    className="
                      min-w-[180px]
                      px-4
                      py-4
                    "
                  >
                    <div
                      className="
                        text-sm
                        text-[#344054]
                      "
                    >
                      {displayOrDash(
                        quotation.attention,
                      )}
                    </div>

                    <div
                      className="
                        mt-1
                        text-xs
                        text-[#98a2b3]
                      "
                    >
                      {displayOrDash(
                        quotation.email,
                      )}
                    </div>
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