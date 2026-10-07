"use client";

import {
  Building2,
  CalendarDays,
  FileText,
  Mail,
  Save,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import {
  useActionState,
  useEffect,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createQuotation,
  type CreateQuotationState,
  updateQuotation,
} from "@/app/quotations/actions";

import {
  formatThaiDate,
} from "@/lib/format";

import {
  QuotationLineItemsEditor,
} from "@/components/quotations/QuotationLineItemsEditor";

import type {
  CustomerOption,
  QuotationListItem,
} from "@/types/database";

type Props = {
  customers:
    CustomerOption[];

  customerProfiles?: Array<{
    name: string;
    contact: string;
    paymentTerm: string;
  }>;

  paymentTerms?: string[];

  contacts?: string[];

  defaultDate: string;

  quotation?: QuotationListItem;

  mode?:
    | "page"
    | "modal";

  onCancel?: () => void;

  onSuccess?: () => void;

  onDirtyChange?: (
    dirty: boolean,
  ) => void;
};

const initialState:
  CreateQuotationState = {
    success: false,
  };

function FieldError({
  message,
}: {
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p
      className="
        mt-1.5
        text-xs
        font-medium
        text-[#df001b]
      "
    >
      {message}
    </p>
  );
}

export function QuotationCreateForm({
  customers,
  customerProfiles = [],
  paymentTerms = [],
  contacts = [],
  defaultDate,
  quotation,
  mode = "page",
  onCancel,
  onSuccess,
  onDirtyChange,
}: Props) {
  const router =
    useRouter();

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    quotation
      ? updateQuotation.bind(
          null,
          quotation.id,
          quotation.customer_id,
        )
      : createQuotation,
    initialState,
  );

  const isEditing = Boolean(quotation);

  const paymentTermOptions = Array.from(new Set([
    "เครดิต 0 วัน",
    "เครดิต 15 วัน",
    "เครดิต 30 วัน",
    ...paymentTerms,
    ...customerProfiles.map((profile) => {
      const value = profile.paymentTerm.trim();
      return value && !/วัน|เครดิต|ชำระ/i.test(value) ? `เครดิต ${value} วัน` : value;
    }),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, "th"));

  const contactOptions = Array.from(new Set([
    ...contacts,
    ...customerProfiles.map((profile) => profile.contact.trim()),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, "th"));

  function applyCustomerProfile(customerName: string) {
    const profile = customerProfiles.find((item) => item.name === customerName);
    if (!profile) return;

    const attention = document.getElementById("attention") as HTMLInputElement | null;
    const paymentTerm = document.getElementById("payment_term") as HTMLInputElement | null;
    if (attention && !attention.value.trim() && profile.contact) attention.value = profile.contact;
    if (paymentTerm && !paymentTerm.value.trim() && profile.paymentTerm) {
      paymentTerm.value = /วัน|เครดิต|ชำระ/i.test(profile.paymentTerm)
        ? profile.paymentTerm
        : `เครดิต ${profile.paymentTerm} วัน`;
    }
  }

  /*
   * หลังบันทึกสำเร็จ
   */
  useEffect(() => {
    if (!state.success) {
      return;
    }

    onDirtyChange?.(
      false,
    );

    /*
     * Modal:
     * ปิดแล้ว refresh หน้าเดิม
     * Search / Filter จะยังอยู่
     */
    if (
      mode ===
      "modal"
    ) {
      onSuccess?.();

      router.refresh();

      return;
    }

    /*
     * หน้า /new สำรอง
     */
    router.push(
      "/quotations",
    );

    router.refresh();
  }, [
    state.success,
    mode,
    onSuccess,
    onDirtyChange,
    router,
  ]);

  function handleCancel() {
    if (onCancel) {
      onCancel();

      return;
    }

    router.push(
      "/quotations",
    );
  }

  const isModal =
    mode === "modal";

  return (
    <form
      action={
        formAction
      }
      onChangeCapture={() => {
        onDirtyChange?.(
          true,
        );
      }}
      className={
        isModal
          ? `
              flex
              min-h-0
              flex-1
              flex-col
              overflow-hidden
              bg-white
            `
          : `
              overflow-hidden
              rounded-2xl
              border
              border-[#e5e7eb]
              bg-white
              shadow-[0_2px_8px_rgba(16,24,40,0.04)]
            `
      }
    >
      {/* =====================================================
       * Page mode header
       *
       * Modal มี Header ของตัวเองแล้ว
       * =================================================== */}
      {!isModal && (
        <div
          className="
            relative
            border-b
            border-[#eaecf0]
            px-6
            py-5
            md:px-7
          "
        >
          <div
            className="
              absolute
              bottom-0
              left-0
              top-0
              w-1
              bg-[#df001b]
            "
          />

          <div
            className="
              flex
              items-start
              gap-3
            "
          >
            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-[#eef2ff]
                text-[#17379c]
              "
            >
              <FileText
                size={20}
              />
            </div>

            <div>
              <h2
                className="
                  text-lg
                  font-bold
                  text-[#172033]
                "
              >
                ข้อมูลใบเสนอราคา
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-[#667085]
                "
              >
                กรอกข้อมูลตามใบเสนอราคาของบริษัท
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
       * Error
       * =================================================== */}
      {state.error && (
        <div
          className="
            mx-6
            mt-4
            shrink-0
            rounded-lg
            border
            border-[#f1c7cc]
            bg-[#fff5f6]
            px-4
            py-3
            text-sm
            font-medium
            text-[#b80017]
          "
        >
          {state.error}
        </div>
      )}

      {/* =====================================================
       * Scrollable Body
       * =================================================== */}
      <div
        className={
          isModal
            ? `
                flex-1
                space-y-7
                overflow-y-auto
                px-6
                py-5
                md:px-7
              `
            : `
                space-y-8
                p-6
                md:p-7
              `
        }
      >
        {/* =================================================
         * Document
         * =============================================== */}
        <section>
          <div
            className="
              mb-4
              flex
              items-center
              gap-2
            "
          >
            <CalendarDays
              size={18}
              className="
                text-[#17379c]
              "
            />

            <h3
              className="
                text-sm
                font-bold
                text-[#172033]
              "
            >
              ข้อมูลเอกสาร
            </h3>
          </div>

          <div
            className="
              grid
              gap-5
              md:grid-cols-2
              xl:grid-cols-3
            "
          >
            {/* Date */}
            <div>
              <label
                htmlFor="quotation_date"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#344054]
                "
              >
                วันที่

                <span
                  className="
                    ml-1
                    text-[#df001b]
                  "
                >
                  *
                </span>
              </label>

              <input
                id="quotation_date"
                name="quotation_date"
                type="text"
                defaultValue={
                  quotation?.quotation_date
                    ? formatThaiDate(
                        quotation.quotation_date,
                      )
                    : defaultDate
                }
                placeholder="06/10/2569"
                inputMode="numeric"
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
                  transition
                  focus:border-[#17379c]
                  focus:ring-2
                  focus:ring-[#17379c]/10
                "
              />

              <p
                className="
                  mt-1.5
                  text-[11px]
                  text-[#98a2b3]
                "
              >
                วัน / เดือน / พ.ศ.
              </p>

              <FieldError
                message={
                  state
                    .fieldErrors
                    ?.quotationDate
                }
              />
            </div>

            {/* Quotation */}
            <div>
              <label
                htmlFor="quotation_no"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#344054]
                "
              >
                เลขใบเสนอราคา

                <span
                  className="
                    ml-1
                    text-[#df001b]
                  "
                >
                  *
                </span>
              </label>

              <div className="relative">
                <div
                  className="
                    absolute
                    bottom-0
                    left-0
                    top-0
                    flex
                    w-11
                    items-center
                    justify-center
                    rounded-l-lg
                    border-r
                    border-[#d0d5dd]
                    bg-[#f8f9fc]
                    text-sm
                    font-bold
                    text-[#17379c]
                  "
                >
                  Q
                </div>

                <input
                  id="quotation_no"
                  name="quotation_no"
                  type="text"
                  defaultValue={
                    quotation?.quotation_no ??
                    ""
                  }
                  placeholder="6909033"
                  autoComplete="off"
                  className="
                    h-11
                    w-full
                    rounded-lg
                    border
                    border-[#d0d5dd]
                    bg-white
                    pl-14
                    pr-3
                    text-sm
                    font-medium
                    text-[#172033]
                    outline-none
                    transition
                    focus:border-[#17379c]
                    focus:ring-2
                    focus:ring-[#17379c]/10
                  "
                />
              </div>

              <FieldError
                message={
                  state
                    .fieldErrors
                    ?.quotationNo
                }
              />
            </div>

            {/* BOQ */}
            <div>
              <label
                htmlFor="boq_no"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#344054]
                "
              >
                BOQ
              </label>

              <div className="relative">
                <div
                  className="
                    absolute
                    bottom-0
                    left-0
                    top-0
                    flex
                    w-[58px]
                    items-center
                    justify-center
                    rounded-l-lg
                    border-r
                    border-[#d0d5dd]
                    bg-[#f8f9fc]
                    text-xs
                    font-bold
                    text-[#17379c]
                  "
                >
                  BOQ
                </div>

                <input
                  id="boq_no"
                  name="boq_no"
                  type="text"
                  defaultValue={
                    quotation?.boq_no ??
                    ""
                  }
                  placeholder="6909011"
                  autoComplete="off"
                  className="
                    h-11
                    w-full
                    rounded-lg
                    border
                    border-[#d0d5dd]
                    bg-white
                    pl-[70px]
                    pr-3
                    text-sm
                    text-[#172033]
                    outline-none
                    transition
                    focus:border-[#17379c]
                    focus:ring-2
                    focus:ring-[#17379c]/10
                  "
                />
              </div>
            </div>
          </div>
        </section>

        <div
          className="
            h-px
            bg-[#eaecf0]
          "
        />

        {/* =================================================
         * Customer / Project
         * =============================================== */}
        <section>
          <div
            className="
              mb-4
              flex
              items-center
              gap-2
            "
          >
            <Building2
              size={18}
              className="
                text-[#17379c]
              "
            />

            <h3
              className="
                text-sm
                font-bold
                text-[#172033]
              "
            >
              ลูกค้าและงาน
            </h3>
          </div>

          <div
            className="
              grid
              gap-5
              md:grid-cols-2
            "
          >
            {/* Customer */}
            <div>
              <label
                htmlFor="customer_name"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#344054]
                "
              >
                บริษัท / สาขาลูกค้า
              </label>

              <input
                id="customer_name"
                name="customer_name"
                type="text"
                list="customer-options"
                onChange={(event) => applyCustomerProfile(event.currentTarget.value)}
                defaultValue={
                  quotation?.customer_name_raw ??
                  ""
                }
                placeholder="เลือกหรือพิมพ์บริษัทใหม่"
                autoComplete="off"
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
                  transition
                  focus:border-[#17379c]
                  focus:ring-2
                  focus:ring-[#17379c]/10
                "
              />

              <datalist
                id="customer-options"
              >
                {customers.map(
                  (
                    customer,
                  ) => (
                    <option
                      key={
                        customer.id
                      }
                      value={
                        customer.name
                      }
                    />
                  ),
                )}
                {customerProfiles.map((profile) => (
                  <option key={`profile-${profile.name}`} value={profile.name} />
                ))}
              </datalist>

              <p
                className="
                  mt-1.5
                  text-[11px]
                  text-[#98a2b3]
                "
              >
                เลือกลูกค้าเดิม
                หรือพิมพ์ชื่อลูกค้าใหม่ได้
              </p>
            </div>

            {/* Project */}
            <div>
              <label
                htmlFor="project_name"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#344054]
                "
              >
                ชื่องาน

                <span
                  className="
                    ml-1
                    text-[#df001b]
                  "
                >
                  *
                </span>
              </label>

              <textarea
                id="project_name"
                name="project_name"
                rows={3}
                defaultValue={
                  quotation?.project_name ??
                  ""
                }
                placeholder="กรอกชื่องาน / รายละเอียดงาน"
                className="
                  min-h-[92px]
                  w-full
                  resize-y
                  rounded-lg
                  border
                  border-[#d0d5dd]
                  bg-white
                  px-3
                  py-2.5
                  text-sm
                  leading-6
                  text-[#172033]
                  outline-none
                  transition
                  focus:border-[#17379c]
                  focus:ring-2
                  focus:ring-[#17379c]/10
                "
              />

              <FieldError
                message={
                  state
                    .fieldErrors
                    ?.projectName
                }
              />
            </div>
          </div>
        </section>

        <div
          className="
            h-px
            bg-[#eaecf0]
          "
        />

        <QuotationLineItemsEditor
          initialItems={quotation?.quotation_line_items}
          initialRemarks={quotation?.remarks}
          initialDiscount={quotation?.discount_amount}
          initialVatRate={quotation?.vat_rate}
          initialTotal={quotation?.total_amount}
          isNew={!quotation}
        />

        <div
          className="
            h-px
            bg-[#eaecf0]
          "
        />

        {/* =================================================
         * Amount / PO
         * =============================================== */}
        <section>
          <div
            className="
              mb-4
              flex
              items-center
              gap-2
            "
          >
            <Wallet
              size={18}
              className="
                text-[#17379c]
              "
            />

            <h3
              className="
                text-sm
                font-bold
                text-[#172033]
              "
            >
              มูลค่าและ PO
            </h3>
          </div>

          <div
            className="
              grid
              gap-5
              md:grid-cols-2
              xl:grid-cols-3
            "
          >
            {/* Amount is calculated from quotation lines. */}
            <div className="hidden">
              <label
                htmlFor="total_amount"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#344054]
                "
              >
                มูลค่า

                <span
                  className="
                    ml-1
                    text-[#df001b]
                  "
                >
                  *
                </span>
              </label>

              <div className="relative">
                <span
                  className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-sm
                    font-bold
                    text-[#17379c]
                  "
                >
                  ฿
                </span>

                <input
                  id="total_amount"
                  name="total_amount"
                  type="text"
                  defaultValue={
                    quotation?.total_amount ??
                    ""
                  }
                  inputMode="decimal"
                  placeholder="0.00"
                  autoComplete="off"
                  className="
                    h-11
                    w-full
                    rounded-lg
                    border
                    border-[#d0d5dd]
                    bg-white
                    pl-8
                    pr-14
                    text-right
                    text-sm
                    font-semibold
                    text-[#172033]
                    outline-none
                    transition
                    focus:border-[#17379c]
                    focus:ring-2
                    focus:ring-[#17379c]/10
                  "
                />

                <span
                  className="
                    absolute
                    right-3
                    top-1/2
                    -translate-y-1/2
                    text-xs
                    text-[#98a2b3]
                  "
                >
                  บาท
                </span>
              </div>

              <FieldError
                message={
                  state
                    .fieldErrors
                    ?.totalAmount
                }
              />
            </div>

            {/* PO */}
            <div>
              <label
                htmlFor="po"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#344054]
                "
              >
                PO
              </label>

              <input
                id="po"
                name="po"
                type="text"
                defaultValue={
                  quotation?.po ??
                  ""
                }
                placeholder="เช่น PX6900126"
                autoComplete="off"
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
                  transition
                  focus:border-[#17379c]
                  focus:ring-2
                  focus:ring-[#17379c]/10
                "
              />
            </div>

            <div>
              <label
                htmlFor="payment_term"
                className="mb-2 block text-sm font-semibold text-[#344054]"
              >
                เงื่อนไขชำระเงิน
              </label>

              <input
                id="payment_term"
                name="payment_term"
                type="text"
                list="payment-term-options"
                defaultValue={quotation?.payment_term ?? ""}
                placeholder="เช่น เครดิต 15 วัน"
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 text-sm text-[#172033] outline-none transition focus:border-[#17379c] focus:ring-2 focus:ring-[#17379c]/10"
              />

              <datalist id="payment-term-options">
                {paymentTermOptions.map((term) => (
                  <option key={term} value={term} />
                ))}
              </datalist>

              <p className="mt-1.5 text-[11px] text-[#98a2b3]">
                พิมพ์ใหม่ได้ และระบบจะจำไว้ให้เลือกครั้งต่อไป
              </p>
            </div>
          </div>
        </section>

        <div
          className="
            h-px
            bg-[#eaecf0]
          "
        />

        {/* =================================================
         * Contact
         * =============================================== */}
        <section>
          <div
            className="
              mb-4
              flex
              items-center
              gap-2
            "
          >
            <UserRound
              size={18}
              className="
                text-[#17379c]
              "
            />

            <h3
              className="
                text-sm
                font-bold
                text-[#172033]
              "
            >
              ผู้ติดต่อ
            </h3>
          </div>

          <div
            className="
              grid
              gap-5
              md:grid-cols-2
            "
          >
            {/* Attention */}
            <div>
              <label
                htmlFor="attention"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#344054]
                "
              >
                ชื่อผู้ติดต่อ
              </label>

              <div className="relative">
                <UserRound
                  size={17}
                  className="
                    pointer-events-none
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-[#98a2b3]
                  "
                />

                <input
                  id="attention"
                  name="attention"
                  type="text"
                  list="contact-options"
                  defaultValue={
                    quotation?.attention ??
                    ""
                  }
                  placeholder="ชื่อผู้ติดต่อ"
                  autoComplete="off"
                  className="
                    h-11
                    w-full
                    rounded-lg
                    border
                    border-[#d0d5dd]
                    bg-white
                    pl-10
                    pr-3
                    text-sm
                    text-[#172033]
                    outline-none
                    transition
                    focus:border-[#17379c]
                    focus:ring-2
                    focus:ring-[#17379c]/10
                  "
                />
              </div>
              <datalist id="contact-options">
                {contactOptions.map((contact) => (
                  <option key={contact} value={contact} />
                ))}
              </datalist>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#344054]
                "
              >
                E-mail
              </label>

              <div className="relative">
                <Mail
                  size={17}
                  className="
                    pointer-events-none
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-[#98a2b3]
                  "
                />

                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={
                    quotation?.email ??
                    ""
                  }
                  placeholder="example@company.com"
                  autoComplete="email"
                  className="
                    h-11
                    w-full
                    rounded-lg
                    border
                    border-[#d0d5dd]
                    bg-white
                    pl-10
                    pr-3
                    text-sm
                    text-[#172033]
                    outline-none
                    transition
                    focus:border-[#17379c]
                    focus:ring-2
                    focus:ring-[#17379c]/10
                  "
                />
              </div>

              <FieldError
                message={
                  state
                    .fieldErrors
                    ?.email
                }
              />
            </div>
          </div>
        </section>
      </div>

      {/* =====================================================
       * Footer
       *
       * Modal: อยู่ค้างด้านล่าง
       * =================================================== */}
      <div
        className="
          flex
          shrink-0
          flex-col-reverse
          justify-between
          gap-3
          border-t
          border-[#eaecf0]
          bg-[#fafbfc]
          px-6
          py-4
          sm:flex-row
          sm:items-center
          md:px-7
        "
      >
        <button
          type="button"
          onClick={
            handleCancel
          }
          disabled={
            pending
          }
          className="
            inline-flex
            h-11
            items-center
            justify-center
            gap-2
            rounded-lg
            border
            border-[#d0d5dd]
            bg-white
            px-4
            text-sm
            font-semibold
            text-[#475467]
            transition
            hover:bg-[#f8f9fc]
            disabled:opacity-50
          "
        >
          <X
            size={17}
          />

          ยกเลิก
        </button>

        <button
          type="submit"
          disabled={
            pending
          }
          className="
            inline-flex
            h-11
            items-center
            justify-center
            gap-2
            rounded-lg
            bg-[#17379c]
            px-6
            text-sm
            font-semibold
            text-white
            shadow-sm
            transition
            hover:bg-[#10266f]
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <Save
            size={17}
          />

          {pending
            ? "กำลังบันทึก..."
            : isEditing
              ? "บันทึกการแก้ไข"
              : "บันทึกใบเสนอราคา"}
        </button>
      </div>
    </form>
  );
}
