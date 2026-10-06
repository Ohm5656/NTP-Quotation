import "server-only";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin";

import type {
  QuotationListItem,
} from "@/types/database";

const PAGE_SIZE = 25;

const FETCH_BATCH_SIZE = 1000;

type ReportSummaryRow = {
  quotation_date:
    | string
    | null;

  customer_id:
    | string
    | null;

  total_amount:
    | number
    | string
    | null;
};

/**
 * โหลดข้อมูลทั้งหมดแบบแบ่งรอบ
 *
 * Supabase จำกัดจำนวน row ต่อ request
 * จึงห้ามใช้ .range(0, 9999) แล้วคาดหวังว่าจะได้ครบ
 */
async function getAllActiveReportRows(): Promise<
  ReportSummaryRow[]
> {
  const supabase =
    createAdminSupabaseClient();

  const rows:
    ReportSummaryRow[] =
    [];

  let from = 0;

  while (true) {
    const {
      data,
      error,
    } = await supabase
      .from("quotations")
      .select(
        `
          quotation_date,
          customer_id,
          total_amount
        `,
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
      .order(
        "quotation_date",
        {
          ascending: true,
        },
      )
      .range(
        from,
        from +
          FETCH_BATCH_SIZE -
          1,
      );

    if (error) {
      throw new Error(
        `ไม่สามารถโหลดข้อมูลรายงานได้: ${error.message}`,
      );
    }

    const batch =
      (data ??
        []) as ReportSummaryRow[];

    rows.push(
      ...batch,
    );

    /*
     * ถ้าได้น้อยกว่า 1,000
     * แปลว่าเป็นชุดสุดท้าย
     */
    if (
      batch.length <
      FETCH_BATCH_SIZE
    ) {
      break;
    }

    from +=
      FETCH_BATCH_SIZE;
  }

  return rows;
}
/* =========================================================
 * Types
 * ======================================================= */

export type MonthlyYearSummary = {
  buddhistYear: number;

  monthCount: number;

  quotationCount: number;

  customerCount: number;

  totalAmount: number;
};

export type MonthlyMonthSummary = {
  month: number;

  quotationCount: number;

  customerCount: number;

  totalAmount: number;

  hasData: boolean;
};

export type MonthlyDetailSummary = {
  quotationCount: number;

  customerCount: number;

  totalAmount: number;

  averageAmount: number;
};

export type MonthlyCustomerOption = {
  id: string;

  name: string;
};

export type MonthlyReportFilters = {
  search?: string;

  customerId?: string;

  page?: number;
};

export type MonthlyReportResult = {
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
 * รองรับ
 * 30/09/2569
 * 30/09/2026
 */
function parseDateSearch(
  value: string,
): string | null {
  const match =
    value
      .trim()
      .match(
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

function getYearRange(
  buddhistYear: number,
) {
  const year =
    buddhistYear - 543;

  return {
    start:
      `${year}-01-01`,

    end:
      `${year + 1}-01-01`,
  };
}

function getMonthRange(
  buddhistYear: number,
  month: number,
) {
  const year =
    buddhistYear - 543;

  const start =
    `${year}-${String(
      month,
    ).padStart(
      2,
      "0",
    )}-01`;

  const end =
    new Date(
      Date.UTC(
        year,
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

/* =========================================================
 * Year Folder Page
 * ======================================================= */

export async function getMonthlyReportYears(): Promise<
  MonthlyYearSummary[]
> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("quotation_yearly_summary")
    .select("gregorian_year, quotation_count, customer_count, total_amount");

  if (error) {
    throw new Error(`ไม่สามารถโหลดรายงานรายปีได้: ${error.message}`);
  }

  const months = await supabase
    .from("quotation_monthly_summary")
    .select("gregorian_year, month");

  if (months.error) {
    throw new Error(`ไม่สามารถโหลดรายงานรายปีได้: ${months.error.message}`);
  }

  const monthCountByYear = new Map<number, number>();
  for (const row of months.data ?? []) {
    const year = Number(row.gregorian_year);
    monthCountByYear.set(year, (monthCountByYear.get(year) ?? 0) + 1);
  }

  return (data ?? [])
    .map((row) => ({
      buddhistYear: Number(row.gregorian_year) + 543,
      monthCount: monthCountByYear.get(Number(row.gregorian_year)) ?? 0,
      quotationCount: Number(row.quotation_count ?? 0),
      customerCount: Number(row.customer_count ?? 0),
      totalAmount: Number(row.total_amount ?? 0),
    }))
    .sort((a, b) => b.buddhistYear - a.buddhistYear);
}

/* =========================================================
 * Month Folder Page
 * ======================================================= */

export async function getMonthlyReportMonths(
  buddhistYear: number,
): Promise<
  MonthlyMonthSummary[]
> {
  const supabase =
    createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("quotation_monthly_summary")
    .select("month, quotation_count, customer_count, total_amount")
    .eq("gregorian_year", buddhistYear - 543);

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดข้อมูลปี ${buddhistYear} ได้: ${error.message}`,
    );
  }

  const byMonth = new Map((data ?? []).map((row) => [Number(row.month), row]));

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const row = byMonth.get(month);
    const quotationCount = Number(row?.quotation_count ?? 0);

    return {
      month,
      quotationCount,
      customerCount: Number(row?.customer_count ?? 0),
      totalAmount: Number(row?.total_amount ?? 0),
      hasData: quotationCount > 0,
    };
  });
}

/* =========================================================
 * Month Summary
 * ======================================================= */

export async function getMonthlyDetailSummary(
  buddhistYear: number,
  month: number,
): Promise<
  MonthlyDetailSummary
> {
  const supabase =
    createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("quotation_monthly_summary")
    .select("quotation_count, customer_count, total_amount")
    .eq("gregorian_year", buddhistYear - 543)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดข้อมูลสรุปรายเดือนได้: ${error.message}`,
    );
  }

  const quotationCount = Number(data?.quotation_count ?? 0);
  const totalAmount = Number(data?.total_amount ?? 0);

  return {
    quotationCount,
    customerCount: Number(data?.customer_count ?? 0),
    totalAmount,
    averageAmount: quotationCount > 0 ? totalAmount / quotationCount : 0,
  };
}

/* =========================================================
 * Customers in selected month
 * ======================================================= */

export async function getMonthlyCustomerOptions(
  buddhistYear: number,
  month: number,
): Promise<
  MonthlyCustomerOption[]
> {
  const supabase =
    createAdminSupabaseClient();

  const range =
    getMonthRange(
      buddhistYear,
      month,
    );

  const {
    data,
    error,
  } = await supabase
    .from(
      "quotations",
    )
    .select(
      `
        customer_id,
        customer_name_raw
      `,
    )
    .is(
      "deleted_at",
      null,
    )
    .gte(
      "quotation_date",
      range.start,
    )
    .lt(
      "quotation_date",
      range.end,
    )
    .not(
      "customer_id",
      "is",
      null,
    )
    .range(
      0,
      9999,
    );

  if (error) {
    throw new Error(
      `ไม่สามารถโหลดรายชื่อลูกค้าได้: ${error.message}`,
    );
  }

  const map =
    new Map<
      string,
      string
    >();

  for (
    const row of
      data ?? []
  ) {
    if (
      row.customer_id &&
      row.customer_name_raw
    ) {
      map.set(
        row.customer_id,
        row.customer_name_raw,
      );
    }
  }

  return [
    ...map.entries(),
  ]
    .map(
      ([
        id,
        name,
      ]) => ({
        id,
        name,
      }),
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          "th",
        ),
    );
}

/* =========================================================
 * Detail Table
 * ======================================================= */

export async function getMonthlyReportQuotations(
  buddhistYear: number,
  month: number,
  filters:
    MonthlyReportFilters,
): Promise<
  MonthlyReportResult
> {
  const supabase =
    createAdminSupabaseClient();

  const range =
    getMonthRange(
      buddhistYear,
      month,
    );

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
      )
      .gte(
        "quotation_date",
        range.start,
      )
      .lt(
        "quotation_date",
        range.end,
      );

  /* =======================================================
   * Customer
   * ===================================================== */

  if (
    filters.customerId
  ) {
    query =
      query.eq(
        "customer_id",
        filters.customerId,
      );
  }

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

        `customer_name_raw.ilike.%${search}%`,

        `project_name.ilike.%${search}%`,

        `po.ilike.%${search}%`,

        `attention.ilike.%${search}%`,

        `email.ilike.%${search}%`,
      ];

    if (
      amount !== null
    ) {
      conditions.push(
        `total_amount.eq.${amount.toFixed(
          2,
        )}`,
      );
    }

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
      `ไม่สามารถโหลดรายการรายเดือนได้: ${error.message}`,
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
