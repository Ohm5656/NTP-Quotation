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
  items:
    QuotationListItem[];

  total: number;

  page: number;

  pageSize: number;

  totalPages: number;
};

/* =========================================================
 * Search Helpers
 * ======================================================= */

function cleanSearch(
  value: string,
): string {
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

/**
 * รองรับ:
 *
 * Q6909032
 * q6909032
 * 6909032
 *
 * Database บางรายการเก็บไม่มี Q
 */
function normalizeQuotationSearch(
  value: string,
): string {
  const cleaned =
    value.trim();

  const withoutQ =
    cleaned.replace(
      /^Q/i,
      "",
    );

  return (
    withoutQ ||
    cleaned
  );
}

/**
 * รองรับ:
 *
 * BOQ6909010
 * boq6909010
 * 6909010
 *
 * Database บางรายการเก็บไม่มี BOQ
 */
function normalizeBoqSearch(
  value: string,
): string {
  const cleaned =
    value.trim();

  const withoutBoq =
    cleaned.replace(
      /^BOQ/i,
      "",
    );

  return (
    withoutBoq ||
    cleaned
  );
}

/**
 * รองรับการค้นหาราคา:
 *
 * 402080
 * 402080.00
 * 402,080
 * 402,080.00
 * ฿402,080.00
 */
function parseAmountSearch(
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
      )
      .trim();

  if (
    !/^\d+(\.\d{1,2})?$/.test(
      normalized,
    )
  ) {
    return null;
  }

  const amount =
    Number(normalized);

  if (
    !Number.isFinite(
      amount,
    )
  ) {
    return null;
  }

  return amount;
}

/* =========================================================
 * Date
 * ======================================================= */

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

/* =========================================================
 * Quotations
 * ======================================================= */

export async function getQuotations(
  filters:
    QuotationFilters,
): Promise<QuotationListResult> {
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

  /* =======================================================
   * Search
   * ===================================================== */

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

    const amount =
      parseAmountSearch(
        originalSearch,
      );

    const conditions: string[] =
      [
        `quotation_no.ilike.%${quotationSearch}%`,

        `boq_no.ilike.%${boqSearch}%`,

        `customer_name_raw.ilike.%${search}%`,

        `project_name.ilike.%${search}%`,

        `po.ilike.%${search}%`,

        `attention.ilike.%${search}%`,

        `email.ilike.%${search}%`,
      ];

    /*
     * ถ้าข้อความที่พิมพ์
     * สามารถตีความเป็นราคาได้
     * ให้ค้น total_amount ด้วย
     */
    if (
      amount !== null
    ) {
      conditions.push(
        `total_amount.eq.${amount.toFixed(
          2,
        )}`,
      );
    }

    query =
      query.or(
        conditions.join(
          ",",
        ),
      );
  }

  /* =======================================================
   * Customer
   * ===================================================== */

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

  /* =======================================================
   * Year / Month
   * ===================================================== */

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

  /* =======================================================
   * Execute
   * ===================================================== */

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

/* =========================================================
 * Customers
 * ======================================================= */

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

/* =========================================================
 * Available Years
 * ======================================================= */

export async function getAvailableQuotationYears(): Promise<
  number[]
> {
  const supabase =
    createAdminSupabaseClient();

  const {
    data: summaryData,
    error: summaryError,
  } = await supabase
    .from(
      "quotation_yearly_summary",
    )
    .select(
      "gregorian_year",
    );

  if (!summaryError) {
    return (
      summaryData ?? []
    )
      .map(
        (row) =>
          row.gregorian_year +
          543,
      )
      .sort(
        (a, b) =>
          b - a,
      );
  }

  // Supports environments that have not yet run the reporting-view migration.
  if (
    summaryError.code !==
    "PGRST205"
  ) {
    throw new Error(
      `Unable to load quotation years: ${summaryError.message}`,
    );
  }

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
