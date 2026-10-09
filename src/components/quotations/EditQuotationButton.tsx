"use client";

import {
  Pencil,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import {
  QuotationPreviewForm,
} from "@/components/quotations/QuotationPreviewForm";
import type { ContactOption } from "@/lib/contact-options";

import type {
  CustomerOption,
  QuotationListItem,
} from "@/types/database";

type Props = {
  quotation: QuotationListItem;
  customers: CustomerOption[];
  customerProfiles?: Array<{ name: string; contact: string; paymentTerm: string }>;
  paymentTerms?: string[];
  contacts?: ContactOption[];
};

export function EditQuotationButton({
  quotation,
  customers,
  customerProfiles = [],
  paymentTerms = [],
  contacts = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="แก้ไขใบเสนอราคา"
        aria-label={`แก้ไขใบเสนอราคา ${quotation.quotation_no ?? ""}`}
        className="
          inline-flex h-8 w-8 items-center justify-center rounded-lg
          text-[#5573c9] transition hover:bg-[#eef2ff] hover:text-[#17379c]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17379c]/35
        "
      >
        <Pencil size={16} />
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#101828]/55 p-4 backdrop-blur-[2px] sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-quotation-title-${quotation.id}`}
            className="dialog-enter relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[1280px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_30px_80px_rgba(16,24,40,0.30)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#eaecf0] bg-white px-5 py-2.5">
              <div>
                <div className="mr-2 inline-flex items-center gap-2 text-xs font-bold tracking-wide text-[#17379c]">
                  <span className="h-2 w-2 rounded-full bg-[#17379c]" />
                  WORKSHEET
                </div>
                <h2
                  id={`edit-quotation-title-${quotation.id}`}
                  className="inline text-sm font-bold text-[#172033]"
                >
                  แก้ไขใบเสนอราคา
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f2f4f7] hover:text-[#172033]"
              >
                <X size={20} />
              </button>
            </div>

            <QuotationPreviewForm
              key={quotation.id}
              customers={customers}
              customerProfiles={customerProfiles}
              paymentTerms={paymentTerms}
              contacts={contacts}
              defaultDate=""
              quotation={quotation}
              onCancel={() => setOpen(false)}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
