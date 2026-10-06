import "server-only";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin";

import type {
  QuotationListItem,
} from "@/types/database";

const PAGE_SIZE = 25;

const FETCH_BATCH_SIZE = 1000;

/* =========================================================
 * Types
 * ======================================================= */

export type YearlyReportSummary = {
  quotationCount: number;

  customerCount: number;

  totalAmount: number;

  averageAmount: number;
};

export type YearlyMonthSummary = {
  month: number;

  quotationCount: number;

  customerCount: number;

  totalAmount: number;
};

export type YearlyTopCustomer = {
  customerId:
    | string
    | null;

  customerName: string;

  quotationCount: number;

  totalAmount: number;
};

export type YearlyCustomerOption = {
  id: string;

  name: string;
};

export type YearlyReportOverview = {
  summary:
    YearlyReportSummary;

  months:
    YearlyMonthSummary[];

  topCustomers:
    YearlyTopCustomer[];

  customers:
    YearlyCustomerOption[];
};

export type YearlyReportFilters = {
  search?: string;

  month?: number;

  customerId?: string;

  page?: number;
};

export type YearlyReportResult = {
  items:
    QuotationListItem[];

  total: number;

  page: number;

  pageSize: number;

  totalPages: number;
};

/* =========================================================
 * Internal Row
 * ======================================================= */

type YearlySummaryRow = {
  quotation_date:
    | string
    | null;

  customer_id:
    | string
    | null;

  customer_name_raw:
    | string
    | null;

  total_amount:
    | number
    | string
    | null;
};

/* =========================================================
 * Date Range
 * ======================================================= */

function getYearRange(
  buddhistYear: number,
) {
  const gregorianYear =
    buddhistYear - 543;

  return {
    start:
      `${gregorianYear}-01-01`,

    end:
      `${gregorianYear + 1}-01-01`,
  };
}

function getMonthRange(
  buddhistYear: number,
  month: number,
) {
  const gregorianYear =
    buddhistYear - 543;

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

/* =========================================================
 * Batch Loader
 *
 * รองรับกรณีข้อมูลปีหนึ่งเกิน 1,000 rows
 * ======================================================= */

async function getAllYearRows(
  buddhistYear: number,
): Promise<
  YearlySummaryRow[]
> {
  const supabase =
    createAdminSupabaseClient();

  const range =
    getYearRange(
      buddhistYear,
    );

  const rows:
    YearlySummaryRow[] =
    [];

  let from = 0;

  while (true) {
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
          customer_id,
          customer_name_raw,
          total_amount
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
      .order(
        "quotation_date",
        {
          ascending:
            true,
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
        `ไม่สามารถโหลดข้อมูลรายปีได้: ${error.message}`,
      );
    }

    const batch =
      (data ??
        []) as YearlySummaryRow[];

    rows.push(
      ...batch,
    );

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
 *
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
 * Annual Overview
 * ======================================================= */

export async function getYearlyReportOverview(
  buddhistYear: number,
): Promise<
  YearlyReportOverview
> {
  const rows =
    await getAllYearRows(
      buddhistYear,
    );

  const customers =
    new Set<string>();

  const monthMap =
    new Map<
      number,
      {
        quotationCount:
          number;

        customers:
          Set<string>;

        totalAmount:
          number;
      }
    >();

  for (
    let month = 1;
    month <= 12;
    month++
  ) {
    monthMap.set(
      month,
      {
        quotationCount:
          0,

        customers:
          new Set(),

        totalAmount:
          0,
      },
    );
  }

  const customerMap =
    new Map<
      string,
      {
        id:
          | string
          | null;

        name: string;

        quotationCount:
          number;

        totalAmount:
          number;
      }
    >();

  let totalAmount =
    0;

  for (
    const row of rows
  ) {
    const amount =
      Number(
        row.total_amount ??
          0,
      );

    totalAmount +=
      amount;

    if (
      row.customer_id
    ) {
      customers.add(
        row.customer_id,
      );
    }

    /*
     * Month Summary
     */
    if (
      row.quotation_date
    ) {
      const month =
        Number(
          row.quotation_date.slice(
            5,
            7,
          ),
        );

      const monthGroup =
        monthMap.get(
          month,
        );

      if (monthGroup) {
        monthGroup
          .quotationCount +=
          1;

        monthGroup
          .totalAmount +=
          amount;

        if (
          row.customer_id
        ) {
          monthGroup.customers.add(
            row.customer_id,
          );
        }
      }
    }

    /*
     * Customer Summary
     */
    const customerName =
      row.customer_name_raw?.trim() ||
      "- ไม่ระบุลูกค้า";

    const customerKey =
      row.customer_id ??
      `blank:${customerName}`;

    if (
      !customerMap.has(
        customerKey,
      )
    ) {
      customerMap.set(
        customerKey,
        {
          id:
            row.customer_id,

          name:
            customerName,

          quotationCount:
            0,

          totalAmount:
            0,
        },
      );
    }

    const customerGroup =
      customerMap.get(
        customerKey,
      )!;

    customerGroup
      .quotationCount +=
      1;

    customerGroup
      .totalAmount +=
      amount;
  }

  const months =
    [
      ...monthMap.entries(),
    ].map(
      ([
        month,
        value,
      ]) => ({
        month,

        quotationCount:
          value.quotationCount,

        customerCount:
          value.customers.size,

        totalAmount:
          value.totalAmount,
      }),
    );

  const topCustomers =
    [
      ...customerMap.values(),
    ]
      .map(
        (
          customer,
        ) => ({
          customerId:
            customer.id,

          customerName:
            customer.name,

          quotationCount:
            customer.quotationCount,

          totalAmount:
            customer.totalAmount,
        }),
      )
      .sort(
        (a, b) =>
          b.totalAmount -
          a.totalAmount,
      )
      .slice(
        0,
        10,
      );

  const customerOptions =
    [
      ...customerMap.values(),
    ]
      .filter(
        (
          customer,
        ) =>
          customer.id !==
          null,
      )
      .map(
        (
          customer,
        ) => ({
          id:
            customer.id!,

          name:
            customer.name,
        }),
      )
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            "th",
          ),
      );

  return {
    summary: {
      quotationCount:
        rows.length,

      customerCount:
        customers.size,

      totalAmount,

      averageAmount:
        rows.length > 0
          ? totalAmount /
            rows.length
          : 0,
    },

    months,

    topCustomers,

    customers:
      customerOptions,
  };
}

/* =========================================================
 * Annual Quotation Table
 * ======================================================= */

export async function getYearlyReportQuotations(
  buddhistYear: number,
  filters:
    YearlyReportFilters,
): Promise<
  YearlyReportResult
> {
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

  let range =
    getYearRange(
      buddhistYear,
    );

  /*
   * ถ้าเลือกเดือน
   * จำกัด Range เป็นเดือนนั้น
   */
  if (
    filters.month &&
    filters.month >= 1 &&
    filters.month <= 12
  ) {
    range =
      getMonthRange(
        buddhistYear,
        filters.month,
      );
  }

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
      `ไม่สามารถโหลดรายการรายปีได้: ${error.message}`,
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