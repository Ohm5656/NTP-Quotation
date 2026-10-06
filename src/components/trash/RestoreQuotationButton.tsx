"use client";

import {
  LoaderCircle,
  RotateCcw,
} from "lucide-react";

import {
  useTransition,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  restoreQuotation,
} from "@/app/trash/actions";

type Props = {
  quotationId: string;

  customerId?:
    | string
    | null;
};

export function RestoreQuotationButton({
  quotationId,
  customerId,
}: Props) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  function restore() {
    startTransition(
      async () => {
        const result =
          await restoreQuotation(
            quotationId,
            customerId,
          );

        if (
          !result.success
        ) {
          alert(
            result.error ??
              "ไม่สามารถกู้คืนข้อมูลได้",
          );

          return;
        }

        router.refresh();
      },
    );
  }

  return (
    <button
      type="button"
      onClick={
        restore
      }
      disabled={
        pending
      }
      className="
        inline-flex
        h-9
        items-center
        justify-center
        gap-2
        rounded-lg
        border
        border-[#b9c4ef]
        bg-[#eef2ff]
        px-3
        text-xs
        font-semibold
        text-[#17379c]
        transition
        hover:border-[#17379c]
        hover:bg-[#e3e9ff]
        disabled:cursor-not-allowed
        disabled:opacity-60
      "
    >
      {pending ? (
        <LoaderCircle
          size={15}
          className="
            animate-spin
          "
        />
      ) : (
        <RotateCcw
          size={15}
        />
      )}

      {pending
        ? "กำลังกู้คืน..."
        : "กู้คืน"}
    </button>
  );
}