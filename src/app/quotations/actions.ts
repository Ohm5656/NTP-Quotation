"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin";

export type CreateQuotationState = {
  success?: boolean;

  createdQuotationId?: string;

  error?: string;

  fieldErrors?: {
    quotationNo?: string;
    quotationDate?: string;
    projectName?: string;
    totalAmount?: string;
    email?: string;
  };
};

/* =========================================================
 * Helpers
 * ======================================================= */

function getString(
  formData: FormData,
  name: string,
): string {
  const value =
    formData.get(name);

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value.trim();
}

function optionalString(
  formData: FormData,
  name: string,
): string | null {
  const value =
    getString(
      formData,
      name,
    );

  if (
    !value ||
    value === "-"
  ) {
    return null;
  }

  return value;
}

/**
 * Q6909032 -> 6909032
 * 6909032  -> 6909032
 */
function normalizeQuotationNo(
  value: string,
): string {
  return value
    .trim()
    .replace(
      /^Q/i,
      "",
    );
}

/**
 * BOQ6909010 -> 6909010
 * 6909010    -> 6909010
 */
function normalizeBoqNo(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    value
      .trim()
      .replace(
        /^BOQ/i,
        "",
      );

  return normalized ||
    null;
}

/* =========================================================
 * Date
 *
 * รับ:
 * 06/10/2569
 *
 * Database:
 * 2026-10-06
 * ======================================================= */

function parseThaiDate(
  value: string,
): string | null {
  const match =
    value.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    );

  if (!match) {
    return null;
  }

  const day =
    Number(match[1]);

  const month =
    Number(match[2]);

  let year =
    Number(match[3]);

  /*
   * พ.ศ. -> ค.ศ.
   */
  if (
    year >= 2400 &&
    year <= 2700
  ) {
    year -= 543;
  }

  /*
   * รองรับ ค.ศ. ด้วย
   */
  if (
    year < 1900 ||
    year > 2300
  ) {
    return null;
  }

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  const valid =
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() + 1 ===
      month &&
    date.getUTCDate() ===
      day;

  if (!valid) {
    return null;
  }

  return [
    String(year).padStart(
      4,
      "0",
    ),

    String(month).padStart(
      2,
      "0",
    ),

    String(day).padStart(
      2,
      "0",
    ),
  ].join("-");
}

/* =========================================================
 * Amount
 * ======================================================= */

function parseAmount(
  value: string,
): number | null {
  const normalized =
    value
      .replace(
        /฿/g,
        "",
      )
      .replace(
        /,/g,
        "",
      )
      .replace(
        /\s/g,
        "",
      );

  if (!normalized) {
    return null;
  }

  const amount =
    Number(normalized);

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount < 0
  ) {
    return null;
  }

  return (
    Math.round(
      amount * 100,
    ) / 100
  );
}

type ParsedLineItem = {
  line_no: number;
  description: string;
  unit_price: number | null;
  quantity: number | null;
  unit: string | null;
  show_item_number: boolean;
};

function parseLineItems(formData: FormData): ParsedLineItem[] | null {
  const raw = getString(formData, "line_items_json");
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed.slice(0, 12).map((item, index) => {
      if (!item || typeof item !== "object") throw new Error("Invalid line item");
      const record = item as Record<string, unknown>;
      const description = typeof record.description === "string" ? record.description.trim() : "";
      if (!description) throw new Error("Missing description");

      const amountValue = record.unit_price === null || record.unit_price === undefined ? "" : String(record.unit_price);
      const quantityValue = record.quantity === null || record.quantity === undefined ? "" : String(record.quantity);
      const unitPrice = parseAmount(amountValue);
      const quantity = parseAmount(quantityValue);
      if ((amountValue && unitPrice === null) || (quantityValue && quantity === null)) throw new Error("Invalid amount");

      return {
        line_no: index + 1,
        description,
        unit_price: unitPrice,
        quantity,
        unit: typeof record.unit === "string" && record.unit.trim() ? record.unit.trim() : null,
        show_item_number: record.show_item_number !== false,
      };
    });
  } catch {
    return null;
  }
}

function calculateQuotationTotal(
  lineItems: ParsedLineItem[],
  discountAmount: number,
  vatRate: number,
): number {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + (item.unit_price ?? 0) * (item.quantity ?? 0),
    0,
  );
  const beforeVat = Math.max(0, subtotal - discountAmount);
  return Math.round((beforeVat + beforeVat * vatRate) * 100) / 100;
}

/* =========================================================
 * Customer
 * ======================================================= */

type CustomerProfileInput = {
  address: string | null;
  taxId: string | null;
  contact: string | null;
  paymentTerm: string | null;
};

async function resolveCustomer(
  customerInput: string,
  profile: CustomerProfileInput,
): Promise<{
  id: string | null;
  name: string | null;
}> {
  const normalizedName =
    customerInput.trim();

  if (
    !normalizedName ||
    normalizedName === "-"
  ) {
    return {
      id: null,
      name: null,
    };
  }

  const supabase =
    createAdminSupabaseClient();

  /*
   * หาลูกค้าเดิมก่อน
   */
  const {
    data: existingCustomer,
    error: existingError,
  } = await supabase
    .from(
      "customers",
    )
    .select(
      "id, name",
    )
    .eq(
      "name",
      normalizedName,
    )
    .maybeSingle();

  if (existingError) {
    throw new Error(
      existingError.message,
    );
  }

  if (existingCustomer) {
    await saveCustomerProfile(
      supabase,
      existingCustomer.id,
      profile,
    );

    return {
      id:
        existingCustomer.id,

      name:
        existingCustomer.name,
    };
  }

  /*
   * ถ้าไม่มี สร้าง Customer ใหม่
   */
  const {
    data: createdCustomer,
    error: createError,
  } = await supabase
    .from(
      "customers",
    )
    .insert({
      name: normalizedName,
      ...(profile.address ? { address: profile.address } : {}),
      ...(profile.taxId ? { tax_id: profile.taxId } : {}),
      ...(profile.contact ? { contact: profile.contact } : {}),
      ...(profile.paymentTerm ? { payment_term: profile.paymentTerm } : {}),
    })
    .select(
      "id, name",
    )
    .single();

  if (createError) {
    throw new Error(
      createError.message,
    );
  }

  return {
    id:
      createdCustomer.id,

    name:
      createdCustomer.name,
  };
}

/* =========================================================
 * Create Quotation
 * ======================================================= */

export async function createQuotation(
  _previousState:
    CreateQuotationState,
  formData: FormData,
): Promise<CreateQuotationState> {
  const quotationNoRaw =
    getString(
      formData,
      "quotation_no",
    );

  const quotationDateRaw =
    getString(
      formData,
      "quotation_date",
    );

  const customerInput =
    String(
      formData.get(
        "customer_name",
      ) ?? "",
    );

  const projectName =
    getString(
      formData,
      "project_name",
    );

  const totalAmountRaw =
    getString(
      formData,
      "total_amount",
    );

  const email =
    optionalString(
      formData,
      "email",
    );

  const paymentTerm = optionalString(formData, "payment_term");
  const customerProfile: CustomerProfileInput = {
    address: optionalString(formData, "customer_address"),
    taxId: optionalString(formData, "customer_tax_id"),
    contact: optionalString(formData, "attention"),
    paymentTerm,
  };
  const lineItems = parseLineItems(formData);
  const remarks = optionalString(formData, "remarks");
  const discountAmount = parseAmount(getString(formData, "discount_amount")) ?? 0;
  const vatRate = parseAmount(getString(formData, "vat_rate")) ?? 0.07;

  const fieldErrors:
    CreateQuotationState["fieldErrors"] =
      {};

  /* =======================================================
   * Validation
   * ===================================================== */

  if (!quotationNoRaw) {
    fieldErrors.quotationNo =
      "กรุณากรอกเลขใบเสนอราคา";
  }

  const quotationNo =
    normalizeQuotationNo(
      quotationNoRaw,
    );

  const quotationDate =
    parseThaiDate(
      quotationDateRaw,
    );

  if (!quotationDateRaw) {
    fieldErrors.quotationDate =
      "กรุณากรอกวันที่";
  } else if (
    !quotationDate
  ) {
    fieldErrors.quotationDate =
      "รูปแบบวันที่ไม่ถูกต้อง เช่น 06/10/2569";
  }

  if (!projectName) {
    fieldErrors.projectName =
      "กรุณากรอกชื่องาน";
  }

  if (lineItems === null || lineItems.length === 0) {
    return {
      success: false,
      error: "กรุณาเพิ่มรายละเอียดสินค้า หรือบริการอย่างน้อย 1 รายการ",
    };
  }

  const enteredTotalAmount =
    parseAmount(
      totalAmountRaw,
    );

  if (!totalAmountRaw) {
    fieldErrors.totalAmount =
      "กรุณากรอกมูลค่า";
  } else if (
    enteredTotalAmount === null
  ) {
    fieldErrors.totalAmount =
      "มูลค่าไม่ถูกต้อง";
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  ) {
    fieldErrors.email =
      "รูปแบบ E-mail ไม่ถูกต้อง";
  }

  if (
    Object.keys(
      fieldErrors,
    ).length > 0
  ) {
    return {
      success: false,

      fieldErrors,
    };
  }

  const totalAmount = calculateQuotationTotal(lineItems, discountAmount, vatRate);

  /* =======================================================
   * Customer
   * ===================================================== */

  let customer: {
    id: string | null;
    name: string | null;
  };

  try {
    customer =
      await resolveCustomer(
        customerInput,
        customerProfile,
      );
  } catch (error) {
    return {
      success: false,

      error:
        error instanceof
        Error
          ? `ไม่สามารถบันทึกลูกค้าได้: ${error.message}`
          : "ไม่สามารถบันทึกลูกค้าได้",
    };
  }

  /* =======================================================
   * Optional fields
   * ===================================================== */

  const boqNo =
    normalizeBoqNo(
      optionalString(
        formData,
        "boq_no",
      ),
    );

  const po =
    optionalString(
      formData,
      "po",
    );

  const attention =
    optionalString(
      formData,
      "attention",
    );

  /* =======================================================
   * Insert
   * ===================================================== */

  const supabase =
    createAdminSupabaseClient();

  const {
    data: createdQuotation,
    error,
  } =
    await supabase
      .from(
        "quotations",
      )
      .insert({
        quotation_no:
          quotationNo,

        quotation_date:
          quotationDate,

        /*
         * เก็บค่าที่กรอกไว้
         * เพื่อสามารถตรวจย้อนหลังได้
         */
        source_date_raw:
          quotationDateRaw,

        boq_no:
          boqNo,

        customer_id:
          customer.id,

        customer_name_raw:
          customer.name,

        project_name:
          projectName,

        total_amount:
          totalAmount,

        po,

        payment_term: paymentTerm,

        remarks,

        discount_amount: discountAmount,

        vat_rate: vatRate,

        attention,

        email,

        /*
         * ข้อมูลที่สร้างจาก Web
         */
        source_file:
          "WEB",

        source_sheet:
          "MANUAL",

        source_row:
          null,

        source_row_hash:
          null,

        deleted_at:
          null,
      })
      .select(
        "id",
      )
      .single();

  if (error) {
    return {
      success: false,

      error:
        `ไม่สามารถเพิ่มใบเสนอราคาได้: ${error.message}`,
    };
  }

  const { error: lineItemsError } = await supabase
    .from("quotation_line_items")
    .insert(lineItems.map((item) => ({ ...item, quotation_id: createdQuotation.id })));

  if (lineItemsError) {
    await supabase.from("quotations").delete().eq("id", createdQuotation.id);
    return {
      success: false,
      error: `ไม่สามารถบันทึกรายการสินค้าได้: ${lineItemsError.message}`,
    };
  }

  /* =======================================================
   * Refresh
   * ===================================================== */

  revalidatePath(
    "/",
  );

  revalidatePath(
    "/quotations",
  );

  revalidatePath(
    "/customers",
  );

  if (customer.id) {
     revalidatePath(
        `/customers/${customer.id}`,
     );
    }

  revalidatePath(
    "/reports/monthly",
  );

  revalidatePath(
    "/reports/yearly",
  );

  return {
    success: true,

    createdQuotationId:
      createdQuotation.id,
  };
}

async function saveCustomerProfile(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  customerId: string,
  profile: CustomerProfileInput,
): Promise<void> {
  const updates = {
    ...(profile.address ? { address: profile.address } : {}),
    ...(profile.taxId ? { tax_id: profile.taxId } : {}),
    ...(profile.contact ? { contact: profile.contact } : {}),
    ...(profile.paymentTerm ? { payment_term: profile.paymentTerm } : {}),
  };

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", customerId);

  if (error) {
    throw new Error(error.message);
  }
}

/* =========================================================
 * Update Quotation
 * ======================================================= */

export async function updateQuotation(
  quotationId: string,
  previousCustomerId: string | null,
  _previousState: CreateQuotationState,
  formData: FormData,
): Promise<CreateQuotationState> {
  if (!quotationId) {
    return {
      success: false,
      error: "ไม่พบใบเสนอราคาที่ต้องการแก้ไข",
    };
  }

  const quotationNoRaw = getString(formData, "quotation_no");
  const quotationDateRaw = getString(formData, "quotation_date");
  const customerInput = String(formData.get("customer_name") ?? "");
  const projectName = getString(formData, "project_name");
  const totalAmountRaw = getString(formData, "total_amount");
  const email = optionalString(formData, "email");
  const paymentTerm = optionalString(formData, "payment_term");
  const customerProfile: CustomerProfileInput = {
    address: optionalString(formData, "customer_address"),
    taxId: optionalString(formData, "customer_tax_id"),
    contact: optionalString(formData, "attention"),
    paymentTerm,
  };
  const lineItems = parseLineItems(formData);
  const remarks = optionalString(formData, "remarks");
  const discountAmount = parseAmount(getString(formData, "discount_amount")) ?? 0;
  const vatRate = parseAmount(getString(formData, "vat_rate")) ?? 0.07;
  const fieldErrors: CreateQuotationState["fieldErrors"] = {};

  const quotationDate = parseThaiDate(quotationDateRaw);
  if (quotationDateRaw && !quotationDate) {
    fieldErrors.quotationDate = "รูปแบบวันที่ไม่ถูกต้อง เช่น 06/10/2569";
  }

  const enteredTotalAmount = parseAmount(totalAmountRaw);
  if (totalAmountRaw && enteredTotalAmount === null) {
    fieldErrors.totalAmount = "มูลค่าไม่ถูกต้อง";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "รูปแบบ E-mail ไม่ถูกต้อง";
  }

  if (lineItems === null) {
    return { success: false, error: "ข้อมูลรายการสินค้าไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" };
  }

  const totalAmount = lineItems.length
    ? calculateQuotationTotal(lineItems, discountAmount, vatRate)
    : enteredTotalAmount;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      fieldErrors,
    };
  }

  let customer: {
    id: string | null;
    name: string | null;
  };

  try {
    customer = await resolveCustomer(customerInput, customerProfile);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? `ไม่สามารถบันทึกลูกค้าได้: ${error.message}`
        : "ไม่สามารถบันทึกลูกค้าได้",
    };
  }

  const supabase = createAdminSupabaseClient();
  const {
    data: updatedQuotation,
    error,
  } = await supabase
    .from("quotations")
    .update({
      quotation_no: quotationNoRaw
        ? normalizeQuotationNo(quotationNoRaw)
        : null,
      quotation_date: quotationDateRaw
        ? quotationDate
        : null,
      boq_no: normalizeBoqNo(optionalString(formData, "boq_no")),
      customer_id: customer.id,
      customer_name_raw: customer.name,
      project_name: projectName || null,
      total_amount: totalAmount,
      po: optionalString(formData, "po"),
      payment_term: paymentTerm,
      remarks,
      discount_amount: discountAmount,
      vat_rate: vatRate,
      attention: optionalString(formData, "attention"),
      email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quotationId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: `ไม่สามารถบันทึกการแก้ไขได้: ${error.message}`,
    };
  }

  if (!updatedQuotation) {
    return {
      success: false,
      error: "ไม่พบใบเสนอราคาที่ต้องการแก้ไข หรือรายการถูกลบไปแล้ว",
    };
  }

  const { error: deleteItemsError } = await supabase
    .from("quotation_line_items")
    .delete()
    .eq("quotation_id", quotationId);

  if (deleteItemsError) {
    return { success: false, error: `ไม่สามารถอัปเดตรายการสินค้าได้: ${deleteItemsError.message}` };
  }

  if (lineItems.length) {
    const { error: insertItemsError } = await supabase
      .from("quotation_line_items")
      .insert(lineItems.map((item) => ({ ...item, quotation_id: quotationId })));

    if (insertItemsError) {
      return { success: false, error: `ไม่สามารถบันทึกรายการสินค้าได้: ${insertItemsError.message}` };
    }
  }

  revalidatePath("/");
  revalidatePath("/quotations");
  revalidatePath("/customers");
  revalidatePath("/reports/monthly");
  revalidatePath("/reports/yearly");

  if (previousCustomerId) {
    revalidatePath(`/customers/${previousCustomerId}`);
  }

  if (customer.id) {
    revalidatePath(`/customers/${customer.id}`);
  }

  return {
    success: true,
  };
}

/* =========================================================
 * Delete Quotation
 *
 * Soft Delete:
 * ไม่ลบข้อมูลออกจาก Database จริง
 * แต่ใส่ deleted_at เพื่อย้ายไปถังขยะ
 * ======================================================= */

export async function deleteQuotation(
  quotationId: string,
  customerId?: string | null,
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!quotationId) {
    return {
      success: false,
      error: "ไม่พบรหัสใบเสนอราคา",
    };
  }

  const supabase =
    createAdminSupabaseClient();

  const deletedAt =
    new Date().toISOString();

  const {
    error,
  } = await supabase
    .from("quotations")
    .update({
      deleted_at: deletedAt,
      updated_at: deletedAt,
    })
    .eq(
      "id",
      quotationId,
    )
    .is(
      "deleted_at",
      null,
    );

  if (error) {
    return {
      success: false,
      error:
        `ไม่สามารถลบใบเสนอราคาได้: ${error.message}`,
    };
  }

  /*
   * Refresh ทุกหน้าที่ใช้ข้อมูลใบเสนอราคา
   */
  revalidatePath("/");

  revalidatePath(
    "/quotations",
  );

  revalidatePath(
    "/customers",
  );

  if (customerId) {
    revalidatePath(
      `/customers/${customerId}`,
    );
  }

  revalidatePath(
    "/trash",
  );

  revalidatePath(
    "/reports/monthly",
  );

  revalidatePath(
    "/reports/yearly",
  );

  return {
    success: true,
  };
}
