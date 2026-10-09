"use client";

import { useRouter } from "next/navigation";
import { QuotationPreviewForm } from "./QuotationPreviewForm";
import type { CustomerOption } from "@/types/database";
import type { CustomerProfile } from "@/lib/excel/customer-profiles";
import type { ContactOption } from "@/lib/contact-options";

export function NewQuotationForm(props: {
  customers: CustomerOption[];
  customerProfiles: CustomerProfile[];
  contacts: ContactOption[];
  paymentTerms: string[];
  defaultDate: string;
  suggestedQuotationNo: string;
}) {
  const router = useRouter();
  return <QuotationPreviewForm {...props}
    onCancel={() => router.push("/quotations")}
    onSuccess={() => router.push("/quotations")}
  />;
}
