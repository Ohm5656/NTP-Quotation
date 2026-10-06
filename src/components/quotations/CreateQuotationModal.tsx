"use client";

import {
  Plus,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import {
  QuotationCreateForm,
} from "@/components/quotations/QuotationCreateForm";

import type {
  CustomerOption,
} from "@/types/database";

type Props = {
  customers:
    CustomerOption[];

  defaultDate: string;
};

export function CreateQuotationModal({
  customers,
  defaultDate,
}: Props) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    mounted,
    setMounted,
  ] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /*
   * ปิด Modal ทันที
   * ไม่ถามยืนยัน
   */
  const closeModal =
    useCallback(() => {
      setOpen(false);
    }, []);

  /*
   * กด ESC เพื่อปิด
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        closeModal();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    open,
    closeModal,
  ]);

  /*
   * ป้องกันหน้าเว็บด้านหลัง Scroll
   * ระหว่างเปิด Modal
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  function handleSuccess() {
    setOpen(false);
  }

  return (
    <>
      {/* =====================================================
       * ปุ่มเปิด Modal
       * =================================================== */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="
          inline-flex
          h-11
          items-center
          justify-center
          gap-2
          rounded-lg
          bg-[#df001b]
          px-5
          text-sm
          font-semibold
          text-white
          shadow-[0_8px_20px_rgba(223,0,27,0.15)]
          transition
          hover:bg-[#bd0017]
          hover:shadow-[0_10px_24px_rgba(223,0,27,0.22)]
          active:translate-y-px
        "
      >
        <Plus
          size={18}
          strokeWidth={2}
        />

        เพิ่มใบเสนอราคา
      </button>

      {/* =====================================================
       * Modal
       * =================================================== */}
      {open && mounted && createPortal(
        <div
          className="
            fixed
            inset-0
            z-[100]
            grid
            place-items-center
            bg-[#101828]/55
            p-4
            backdrop-blur-[2px]
            sm:p-8
          "
          /*
           * คลิกพื้นที่มืดด้านนอก
           * = ปิดทันที
           */
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-quotation-title"
            className="
              dialog-enter
              relative
              flex
              max-h-[calc(100dvh-2rem)]
              w-full
              max-w-[1050px]
              flex-col
              overflow-hidden
              rounded-2xl
              border
              border-white/20
              bg-white
              shadow-[0_30px_80px_rgba(16,24,40,0.30)]
            "
            onMouseDown={(
              event,
            ) => {
              event.stopPropagation();
            }}
          >
            {/* =============================================
             * Modal Header
             * =========================================== */}
            <div
              className="
                flex
                shrink-0
                items-start
                justify-between
                gap-4
                border-b
                border-[#eaecf0]
                bg-white
                px-6
                py-5
              "
            >
              <div>
                <div
                  className="
                    mb-1.5
                    inline-flex
                    items-center
                    gap-2
                    text-xs
                    font-bold
                    tracking-wide
                    text-[#df001b]
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

                  NEW QUOTATION
                </div>

                <h2
                  id="create-quotation-title"
                  className="
                    text-xl
                    font-bold
                    text-[#172033]
                  "
                >
                  เพิ่มใบเสนอราคา
                </h2>

                <p
                  className="
                    mt-1
                    text-sm
                    text-[#667085]
                  "
                >
                  เพิ่มข้อมูลใหม่เข้าสู่ระบบใบเสนอราคาของบริษัท
                </p>
              </div>

              {/* ปุ่ม X */}
              <button
                type="button"
                onClick={
                  closeModal
                }
                aria-label="ปิด"
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  text-[#667085]
                  transition
                  hover:bg-[#f2f4f7]
                  hover:text-[#172033]
                "
              >
                <X
                  size={20}
                />
              </button>
            </div>

            {/* =============================================
             * Form
             * =========================================== */}
            <QuotationCreateForm
              customers={
                customers
              }
              defaultDate={
                defaultDate
              }
              mode="modal"
              onCancel={
                closeModal
              }
              onSuccess={
                handleSuccess
              }
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
