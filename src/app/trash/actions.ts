"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin";

export async function restoreQuotation(
  quotationId: string,
  customerId?:
    | string
    | null,
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!quotationId) {
    return {
      success: false,
      error:
        "ไม่พบรหัสใบเสนอราคา",
    };
  }

  const supabase =
    createAdminSupabaseClient();

  const updatedAt =
    new Date().toISOString();

  const {
    error,
  } = await supabase
    .from(
      "quotations",
    )
    .update({
      deleted_at:
        null,

      updated_at:
        updatedAt,
    })
    .eq(
      "id",
      quotationId,
    )
    .not(
      "deleted_at",
      "is",
      null,
    );

  if (error) {
    return {
      success: false,

      error:
        `ไม่สามารถกู้คืนใบเสนอราคาได้: ${error.message}`,
    };
  }

  /*
   * Refresh ทุกหน้าที่เกี่ยวข้อง
   */
  revalidatePath(
    "/",
  );

  revalidatePath(
    "/quotations",
  );

  revalidatePath(
    "/trash",
  );

  if (customerId) {
    revalidatePath(
      `/customers/${customerId}`,
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
  };
}