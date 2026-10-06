"use client";

import {
  AlertTriangle,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";

import {
  useState,
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  deleteQuotation,
} from "@/app/quotations/actions";

type Props = {
  quotationId: string;

  quotationNo:
    | string
    | null;

  customerId?:
    | string
    | null;
};

export function DeleteQuotationButton({
  quotationId,
  quotationNo,
  customerId,
}: Props) {
  const router =
    useRouter();

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    pending,
    startTransition,
  ] = useTransition();

  function handleDelete() {
    setError(null);

    startTransition(
      async () => {
        const result =
          await deleteQuotation(
            quotationId,
            customerId,
          );

        if (
          !result.success
        ) {
          setError(
            result.error ??
              "ไม่สามารถลบข้อมูลได้",
          );

          return;
        }

        setOpen(false);

        router.refresh();
      },
    );
  }

  return (
    <>
      {/* =====================================================
       * Delete Button
       * =================================================== */}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        title="ลบใบเสนอราคา"
        className="
          inline-flex
          h-8
          w-8
          items-center
          justify-center
          rounded-lg
          text-[#98a2b3]
          transition
          hover:bg-[#fff1f2]
          hover:text-[#df001b]
        "
      >
        <Trash2
          size={17}
        />
      </button>

      {/* =====================================================
       * Confirm Modal
       * =================================================== */}
      {open && (
        <div
          className="
            fixed
            inset-0
            z-[150]
            flex
            items-center
            justify-center
            bg-[#101828]/45
            p-4
            backdrop-blur-[2px]
          "
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget &&
              !pending
            ) {
              setOpen(false);
            }
          }}
        >
          <div
            className="
              dialog-enter
              w-full
              max-w-[430px]
              overflow-hidden
              rounded-2xl
              border
              border-[#e5e7eb]
              bg-white
              shadow-[0_24px_70px_rgba(16,24,40,0.25)]
            "
          >
            {/* Header */}
            <div
              className="
                flex
                items-start
                justify-between
                gap-4
                px-6
                pt-6
              "
            >
              <div
                className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[#fff1f2]
                  text-[#df001b]
                "
              >
                <AlertTriangle
                  size={21}
                />
              </div>

              <button
                type="button"
                disabled={
                  pending
                }
                onClick={() => {
                  setOpen(false);
                }}
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-lg
                  text-[#98a2b3]
                  transition
                  hover:bg-[#f2f4f7]
                  hover:text-[#344054]
                  disabled:opacity-50
                "
              >
                <X
                  size={18}
                />
              </button>
            </div>

            {/* Content */}
            <div
              className="
                px-6
                pb-6
                pt-4
              "
            >
              <h2
                className="
                  text-lg
                  font-bold
                  text-[#172033]
                "
              >
                ลบใบเสนอราคานี้?
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  leading-6
                  text-[#667085]
                "
              >
                ใบเสนอราคา{" "}
                <strong
                  className="
                    font-semibold
                    text-[#172033]
                  "
                >
                  {quotationNo
                    ? `Q${quotationNo.replace(
                        /^Q/i,
                        "",
                      )}`
                    : "-"}
                </strong>{" "}
                จะถูกย้ายไปยังถังขยะ
                และจะไม่ถูกนำไปคำนวณในภาพรวมและรายงาน
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-[#98a2b3]
                "
              >
                สามารถทำระบบกู้คืนจากถังขยะได้ภายหลัง
              </p>

              {error && (
                <div
                  className="
                    mt-4
                    rounded-lg
                    border
                    border-[#f1c7cc]
                    bg-[#fff5f6]
                    px-3
                    py-2.5
                    text-sm
                    text-[#b80017]
                  "
                >
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="
                flex
                justify-end
                gap-3
                border-t
                border-[#eaecf0]
                bg-[#fafbfc]
                px-6
                py-4
              "
            >
              <button
                type="button"
                disabled={
                  pending
                }
                onClick={() => {
                  setOpen(false);
                }}
                className="
                  h-10
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
                ยกเลิก
              </button>

              <button
                type="button"
                disabled={
                  pending
                }
                onClick={
                  handleDelete
                }
                className="
                  inline-flex
                  h-10
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  bg-[#df001b]
                  px-4
                  text-sm
                  font-semibold
                  text-white
                  transition
                  hover:bg-[#bd0017]
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {pending ? (
                  <LoaderCircle
                    size={16}
                    className="
                      animate-spin
                    "
                  />
                ) : (
                  <Trash2
                    size={16}
                  />
                )}

                {pending
                  ? "กำลังลบ..."
                  : "ลบใบเสนอราคา"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
