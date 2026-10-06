import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
  path: path.resolve(
    process.cwd(),
    ".env.local",
  ),
});

const EXPECTED_ROWS = 1_543;

const EXPECTED_TOTAL_CENTS =
  32_778_659_090;

const EXPECTED_CUSTOMERS = 97;

const EXPECTED_BLANK_DATES = 5;

const EXPECTED_DUPLICATES = {
  "6606006": 2,
  "6607011": 2,
  "6610015": 2,
  "6712025": 2,
};

function requireEnv(
  name: string,
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `Missing ${name}`,
    );
  }

  return value;
}

async function main() {
  const supabase =
    createClient(
      requireEnv(
        "NEXT_PUBLIC_SUPABASE_URL",
      ),

      requireEnv(
        "SUPABASE_SERVICE_ROLE_KEY",
      ),

      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,
        },
      },
    );

  const sourceFile =
    path.basename(
      process.env
        .QUOTATION_EXCEL_PATH ??
        "./data/ข้อมูลใบเสนอราคา.xlsx",
    );

  const allRows: Array<{
    quotation_no:
      | string
      | null;

    quotation_date:
      | string
      | null;

    customer_name_raw:
      | string
      | null;

    total_amount:
      | number
      | string
      | null;

    source_row:
      | number
      | null;

    source_row_hash:
      | string
      | null;
  }> = [];

  const pageSize = 1000;

  for (
    let from = 0;
    ;
    from += pageSize
  ) {
    const to =
      from +
      pageSize -
      1;

    const {
      data,
      error,
    } = await supabase
      .from("quotations")
      .select(
        [
          "quotation_no",
          "quotation_date",
          "customer_name_raw",
          "total_amount",
          "source_row",
          "source_row_hash",
        ].join(","),
      )
      .eq(
        "source_file",
        sourceFile,
      )
      .eq(
        "source_sheet",
        "ใบเสนอราคา",
      )
      .order(
        "source_row",
        {
          ascending: true,
        },
      )
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    allRows.push(...data);

    if (
      data.length <
      pageSize
    ) {
      break;
    }
  }

  const totalCents =
    allRows.reduce(
      (sum, row) => {
        const amount =
          Number(
            row.total_amount ??
              0,
          );

        return (
          sum +
          Math.round(
            amount * 100,
          )
        );
      },
      0,
    );

  const customerNames =
    new Set(
      allRows
        .map(
          (row) =>
            row.customer_name_raw,
        )
        .filter(
          (
            value,
          ): value is string =>
            value !== null,
        ),
    );

  const blankDates =
    allRows.filter(
      (row) =>
        row.quotation_date ===
        null,
    ).length;

  const missingHashes =
    allRows.filter(
      (row) =>
        !row.source_row_hash,
    ).length;

  const quotationCounts =
    new Map<string, number>();

  allRows.forEach((row) => {
    if (!row.quotation_no) {
      return;
    }

    quotationCounts.set(
      row.quotation_no,
      (quotationCounts.get(
        row.quotation_no,
      ) ?? 0) + 1,
    );
  });

  const duplicateMap =
    Object.fromEntries(
      [...quotationCounts.entries()]
        .filter(
          ([, count]) =>
            count > 1,
        ),
    );

  console.log("");
  console.log(
    "========= DATABASE CHECK =========",
  );

  console.log(
    "Rows:",
    allRows.length,
  );

  console.log(
    "Total:",
    (
      totalCents / 100
    ).toLocaleString(
      "en-US",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      },
    ),
  );

  console.log(
    "Customers:",
    customerNames.size,
  );

  console.log(
    "Blank dates:",
    blankDates,
  );

  console.log(
    "Duplicate quotation numbers:",
    duplicateMap,
  );

  console.log(
    "Missing hashes:",
    missingHashes,
  );

  if (
    allRows.length !==
    EXPECTED_ROWS
  ) {
    throw new Error(
      "Row count mismatch",
    );
  }

  if (
    totalCents !==
    EXPECTED_TOTAL_CENTS
  ) {
    throw new Error(
      "Total amount mismatch",
    );
  }

  if (
    customerNames.size !==
    EXPECTED_CUSTOMERS
  ) {
    throw new Error(
      "Customer count mismatch",
    );
  }

  if (
    blankDates !==
    EXPECTED_BLANK_DATES
  ) {
    throw new Error(
      "Blank date count mismatch",
    );
  }

  if (missingHashes !== 0) {
    throw new Error(
      "Some imported rows do not have source hashes",
    );
  }

  for (
    const [
      quotationNo,
      expectedCount,
    ] of Object.entries(
      EXPECTED_DUPLICATES,
    )
  ) {
    if (
      quotationCounts.get(
        quotationNo,
      ) !== expectedCount
    ) {
      throw new Error(
        `Duplicate verification failed for ${quotationNo}`,
      );
    }
  }

  console.log("");
  console.log(
    "✅ Database matches the verified Excel source.",
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "❌ Verification failed",
  );

  console.error(error);

  process.exit(1);
});