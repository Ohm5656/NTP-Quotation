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

/* =========================================================
 * Customer
 * ======================================================= */

async function resolveCustomer(
  customerInput: string,
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
      name:
        normalizedName,
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

  const totalAmount =
    parseAmount(
      totalAmountRaw,
    );

  if (!totalAmountRaw) {
    fieldErrors.totalAmount =
      "กรุณากรอกมูลค่า";
  } else if (
    totalAmount === null
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