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

import {
  DeleteQuotationButton,
} from "@/components/quotations/DeleteQuotationButton";

import {
  EditQuotationButton,
} from "@/components/quotations/EditQuotationButton";

import type {
  CustomerOption,
} from "@/types/database";

type Props = {
  quotations:
    QuotationListItem[];

  customers?:
    CustomerOption[];
};

export function QuotationTable({
  quotations,
  customers = [],
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
          text-sm
          text-[#667085]
        "
      >
        ไม่พบใบเสนอราคาตามเงื่อนไขที่เลือก
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
            min-w-[1180px]
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

              <th
                className="
                  w-[112px]
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
                  {/* วันที่ */}
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
                      font-semibold
                      text-[#17379c]
                    "
                  >
                    {formatQuotationNo(
                      quotation.quotation_no,
                    )}
                  </td>

                  {/* Customer + Project */}
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
                        line-clamp-2
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

                  {/* Actions */}
                  <td
                    className="
                      px-4
                      py-4
                      text-center
                    "
                  >
                    <div className="flex items-center justify-center gap-1">
                      <EditQuotationButton
                        quotation={quotation}
                        customers={customers}
                      />

                      <DeleteQuotationButton
                        quotationId={
                          quotation.id
                        }
                        quotationNo={
                          quotation.quotation_no
                        }
                        customerId={
                          quotation.customer_id
                        }
                      />
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
