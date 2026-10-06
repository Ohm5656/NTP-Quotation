import "server-only";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin";

import type {
  TrashQuotationItem,
} from "@/types/trash";

const PAGE_SIZE = 25;

export type TrashFilters = {
  search?: string;
  page?: number;
};

export type TrashResult = {
  items:
    TrashQuotationItem[];

  total: number;

  page: number;

  pageSize: number;

  totalPages: number;
};

function cleanSearch(
  value: string,
) {
  return value
    .replace(
      /[,()%"]/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function normalizeQuotationSearch(
  value: string,
) {
  return (
    value
      .trim()
      .replace(
        /^Q/i,
        "",
      ) ||
    value
  );
}

function normalizeBoqSearch(
  value: string,
) {
  return (
    value
      .trim()
      .replace(
        /^BOQ/i,
        "",
      ) ||
    value
  );
}

export async function getTrashQuotations(
  filters:
    TrashFilters,
): Promise<TrashResult> {
  const supabase =
    createAdminSupabaseClient();

  const page =
    Math.max(
      1,
      filters.page ??
        1,
    );

  const from =
    (page - 1) *
    PAGE_SIZE;

  const to =
    from +
    PAGE_SIZE -
    1;

  let query =
    supabase
      .from(
        "quotations",
      )
      .select(
        `
          id,
          quotation_no,
          quotation_date,
          boq_no,
          customer_id,
          customer_name_raw,
          project_name,
          total_amount,
          po,
          attention,
          email,
          deleted_at
        `,
        {
          count: "exact",
        },
      )
      .not(
        "deleted_at",
        "is",
        null,
      );

  const originalSearch =
    filters.search?.trim() ??
    "";

  const search =
    cleanSearch(
      originalSearch,
    );

  if (search) {
    const quotationSearch =
      normalizeQuotationSearch(
        search,
      );

    const boqSearch =
      normalizeBoqSearch(
        search,
      );

    query =
      query.or(
        [
          `quotation_no.ilike.%${quotationSearch}%`,
          `boq_no.ilike.%${boqSearch}%`,
          `customer_name_raw.ilike.%${search}%`,
          `project_name.ilike.%${search}%`,
          `po.ilike.%${search}%`,
          `attention.ilike.%${search}%`,
          `email.ilike.%${search}%`,
        ].join(","),
      );
  }

  const {
    data,
    error,
    count,
  } =
    await query
      .order(
        "deleted_at",
        {
          ascending:
            false,
        },
      )
      .range(
        from,
        to,
      );

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดข้อมูลถังขยะได้: ${error.message}`,
    );
  }

  const total =
    count ?? 0;

  return {
    items:
      (data ??
        []) as TrashQuotationItem[],

    total,

    page,

    pageSize:
      PAGE_SIZE,

    totalPages:
      Math.max(
        1,
        Math.ceil(
          total /
            PAGE_SIZE,
        ),
      ),
  };
}