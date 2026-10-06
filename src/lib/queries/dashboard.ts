import "server-only";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin";

import type {
  CustomerSummary,
  DashboardTotals,
} from "@/types/database";

export async function getCustomerSummaries(): Promise<
  CustomerSummary[]
> {
  const supabase =
    createAdminSupabaseClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "customer_quotation_summary",
    )
    .select(
      `
        customer_id,
        customer_name,
        quotation_count,
        total_quoted_amount,
        first_quotation_date,
        latest_quotation_date
      `,
    )
    .order(
      "total_quoted_amount",
      {
        ascending: false,
      },
    );

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดข้อมูลลูกค้าได้: ${error.message}`,
    );
  }

  return (data ?? []).map(
    (item) => ({
      customer_id:
        item.customer_id,

      customer_name:
        item.customer_name,

      quotation_count:
        Number(
          item.quotation_count ??
            0,
        ),

      total_quoted_amount:
        Number(
          item.total_quoted_amount ??
            0,
        ),

      first_quotation_date:
        item.first_quotation_date,

      latest_quotation_date:
        item.latest_quotation_date,
    }),
  );
}

export async function getDashboardTotals(): Promise<
  DashboardTotals
> {
  const supabase =
    createAdminSupabaseClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "quotation_dashboard_totals",
    )
    .select(
      `
        quotation_count,
        total_quoted_amount,
        unassigned_customer_count,
        unassigned_customer_amount
      `,
    )
    .single();

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดข้อมูลสรุปได้: ${error.message}`,
    );
  }

  return {
    quotation_count:
      Number(
        data.quotation_count ??
          0,
      ),

    total_quoted_amount:
      Number(
        data.total_quoted_amount ??
          0,
      ),

    unassigned_customer_count:
      Number(
        data.unassigned_customer_count ??
          0,
      ),

    unassigned_customer_amount:
      Number(
        data.unassigned_customer_amount ??
          0,
      ),
  };
}