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

export function MonthlyReportTable({
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
          ลองเปลี่ยนคำค้นหาหรือบริษัท
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
                      font-bold
                      text-[#17379c]
                    "
                  >
                    {formatQuotationNo(
                      quotation.quotation_no,
                    )}
                  </td>

                  <td
                    className="
                      max-w-[420px]
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

                  <td
                    className="
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