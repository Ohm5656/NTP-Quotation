import "server-only";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin";

import type {
  QuotationListItem,
} from "@/types/database";

const PAGE_SIZE = 20;

export type CustomerDetail = {
  id: string;
  name: string;
};

export type CustomerQuotationSummary = {
  quotationCount: number;
  totalAmount: number;

  firstQuotationDate:
    | string
    | null;

  latestQuotationDate:
    | string
    | null;
};

export type CustomerQuotationFilters = {
  search?: string;
  year?: number;
  month?: number;
  page?: number;
};

export type CustomerQuotationResult = {
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

function normalizeQuotationSearch(
  value: string,
): string {
  const cleaned =
    value.trim();

  return (
    cleaned.replace(
      /^Q/i,
      "",
    ) || cleaned
  );
}

function normalizeBoqSearch(
  value: string,
): string {
  const cleaned =
    value.trim();

  return (
    cleaned.replace(
      /^BOQ/i,
      "",
    ) || cleaned
  );
}

/**
 * รองรับ:
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

/**
 * รองรับ:
 *
 * 30/09/2569
 * 30/09/2026
 *
 * return:
 * 2026-09-30
 */
function parseDateSearch(
  value: string,
): string | null {
  const normalized =
    value.trim();

  const match =
    normalized.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
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

  if (
    year >= 2400 &&
    year <= 2700
  ) {
    year -= 543;
  }

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
 * Date Range
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

    const end =
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
      end,
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
 * Customer
 * ======================================================= */

export async function getCustomerById(
  customerId: string,
): Promise<CustomerDetail | null> {
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
    .eq(
      "id",
      customerId,
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดข้อมูลลูกค้าได้: ${error.message}`,
    );
  }

  return data;
}

/* =========================================================
 * Summary
 * ======================================================= */

export async function getCustomerQuotationSummary(
  customerId: string,
): Promise<CustomerQuotationSummary> {
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
      `
        quotation_date,
        total_amount
      `,
    )
    .eq(
      "customer_id",
      customerId,
    )
    .is(
      "deleted_at",
      null,
    )
    .range(
      0,
      9999,
    );

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดข้อมูลสรุปลูกค้าได้: ${error.message}`,
    );
  }

  const rows =
    data ?? [];

  let totalAmount = 0;

  const dates: string[] =
    [];

  for (
    const row of rows
  ) {
    totalAmount +=
      Number(
        row.total_amount ??
          0,
      );

    if (
      row.quotation_date
    ) {
      dates.push(
        row.quotation_date,
      );
    }
  }

  dates.sort();

  return {
    quotationCount:
      rows.length,

    totalAmount,

    firstQuotationDate:
      dates[0] ??
      null,

    latestQuotationDate:
      dates.length
        ? dates[
            dates.length -
              1
          ]
        : null,
  };
}

/* =========================================================
 * Customer Quotations
 * ======================================================= */

export async function getCustomerQuotations(
  customerId: string,
  filters:
    CustomerQuotationFilters,
): Promise<CustomerQuotationResult> {
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
      .eq(
        "customer_id",
        customerId,
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

    const date =
      parseDateSearch(
        originalSearch,
      );

    const conditions: string[] =
      [
        `quotation_no.ilike.%${quotationSearch}%`,

        `boq_no.ilike.%${boqSearch}%`,

        `project_name.ilike.%${search}%`,

        `po.ilike.%${search}%`,

        `attention.ilike.%${search}%`,

        `email.ilike.%${search}%`,
      ];

    /*
     * ราคา
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

    /*
     * วันที่
     */
    if (date) {
      conditions.push(
        `quotation_date.eq.${date}`,
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
      `ไม่สามารถโหลดใบเสนอราคาของลูกค้าได้: ${error.message}`,
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
 * Years
 * ======================================================= */

export async function getCustomerQuotationYears(
  customerId: string,
): Promise<number[]> {
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
    .eq(
      "customer_id",
      customerId,
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
      9999,
    );

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดปีของลูกค้าได้: ${error.message}`,
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

    const year =
      Number(
        row.quotation_date.slice(
          0,
          4,
        ),
      );

    if (
      Number.isFinite(
        year,
      )
    ) {
      years.add(
        year + 543,
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