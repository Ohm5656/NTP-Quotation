import "server-only";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin";

import type {
  CustomerOption,
  QuotationListItem,
} from "@/types/database";

const PAGE_SIZE = 25;

export type QuotationFilters = {
  search?: string;
  year?: number;
  month?: number;
  customerId?: string;
  page?: number;
};

export type QuotationListResult = {
  items: QuotationListItem[];

  total: number;

  page: number;

  pageSize: number;

  totalPages: number;
};

function cleanSearch(
  value: string,
): string {
  return value
    .replace(
      /[,()%]/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function createDateRange(
  buddhistYear: number,
  month?: number,
) {
  const gregorianYear =
    buddhistYear - 543;

  if (
    month &&
    month >= 1 &&
    month <= 12
  ) {
    const start =
      `${gregorianYear}-${String(
        month,
      ).padStart(
        2,
        "0",
      )}-01`;

    const next =
      new Date(
        Date.UTC(
          gregorianYear,
          month,
          1,
        ),
      )
        .toISOString()
        .slice(
          0,
          10,
        );

    return {
      start,
      end: next,
    };
  }

  return {
    start:
      `${gregorianYear}-01-01`,

    end:
      `${gregorianYear + 1}-01-01`,
  };
}

export async function getQuotations(
  filters: QuotationFilters,
): Promise<QuotationListResult> {
  const supabase =
    createAdminSupabaseClient();

  const page =
    Math.max(
      1,
      filters.page ?? 1,
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
          source_row
        `,
        {
          count: "exact",
        },
      )
      .is(
        "deleted_at",
        null,
      );

  const search =
    cleanSearch(
      filters.search ??
        "",
    );

  if (search) {
    query =
      query.or(
        [
          `quotation_no.ilike.%${search}%`,
          `boq_no.ilike.%${search}%`,
          `customer_name_raw.ilike.%${search}%`,
          `project_name.ilike.%${search}%`,
          `po.ilike.%${search}%`,
          `attention.ilike.%${search}%`,
          `email.ilike.%${search}%`,
        ].join(","),
      );
  }

  if (
    filters.customerId ===
    "__blank__"
  ) {
    query =
      query.is(
        "customer_id",
        null,
      );
  } else if (
    filters.customerId
  ) {
    query =
      query.eq(
        "customer_id",
        filters.customerId,
      );
  }

  if (
    filters.year &&
    Number.isFinite(
      filters.year,
    )
  ) {
    const range =
      createDateRange(
        filters.year,
        filters.month,
      );

    query =
      query
        .gte(
          "quotation_date",
          range.start,
        )
        .lt(
          "quotation_date",
          range.end,
        );
  }

  const {
    data,
    error,
    count,
  } =
    await query
      .order(
        "quotation_date",
        {
          ascending:
            false,

          nullsFirst:
            false,
        },
      )
      .order(
        "source_row",
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
      `ไม่สามารถโหลดใบเสนอราคาได้: ${error.message}`,
    );
  }

  const total =
    count ?? 0;

  return {
    items:
      (data ??
        []) as QuotationListItem[],

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

export async function getCustomerOptions(): Promise<
  CustomerOption[]
> {
  const supabase =
    createAdminSupabaseClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "customers",
    )
    .select(
      "id, name",
    )
    .order(
      "name",
      {
        ascending:
          true,
      },
    );

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดรายชื่อลูกค้าได้: ${error.message}`,
    );
  }

  return data ?? [];
}

export async function getAvailableQuotationYears(): Promise<
  number[]
> {
  const supabase =
    createAdminSupabaseClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "quotations",
    )
    .select(
      "quotation_date",
    )
    .is(
      "deleted_at",
      null,
    )
    .not(
      "quotation_date",
      "is",
      null,
    )
    .range(
      0,
      4999,
    );

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดปีได้: ${error.message}`,
    );
  }

  const years =
    new Set<number>();

  for (
    const row of
      data ?? []
  ) {
    if (
      !row.quotation_date
    ) {
      continue;
    }

    const gregorianYear =
      Number(
        row.quotation_date.slice(
          0,
          4,
        ),
      );

    if (
      Number.isFinite(
        gregorianYear,
      )
    ) {
      years.add(
        gregorianYear +
          543,
      );
    }
  }

  return [
    ...years,
  ].sort(
    (a, b) =>
      b - a,
  );
}