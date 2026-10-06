import crypto from "node:crypto";
import path from "node:path";

import dotenv from "dotenv";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

/* =========================================================
 * Current Excel source verification
 *
 * ตรวจจากไฟล์ที่บริษัทใช้อยู่จริง:
 *
 * Sheet: ใบเสนอราคา
 * Data rows: 1,543
 * Total amount: 327,786,590.90
 * Exact customer strings: 97
 * ======================================================= */

const SOURCE_SHEET = "ใบเสนอราคา";

const EXPECTED_DATA_ROWS = 1_543;
const EXPECTED_TOTAL_CENTS = 32_778_659_090;
const EXPECTED_CUSTOMER_NAMES = 97;

const EXPECTED_HEADERS = [
  "Date.",
  "Quotation No.",
  "BOQ.",
  "Customer",
  "Project",
  "Total.",
  "PO",
  "Attention",
  "E-mail",
] as const;

const excelPath =
  process.env.QUOTATION_EXCEL_PATH ??
  "./data/ข้อมูลใบเสนอราคา.xlsx";

const commit = process.argv.includes("--commit");

/**
 * Manual date corrections confirmed from the company workbook/context.
 *
 * Important:
 * - Database still keeps source_date_raw unchanged for traceability.
 * - quotationNo is compared after removing an optional leading "Q",
 *   because Excel formatting may display Q while the imported cell value
 *   is numeric/text without Q.
 */
const MANUAL_DATE_CORRECTIONS: Record<
  number,
  {
    quotationNo: string;
    quotationDate: string;
  }
> = {
  // Excel Date = "PX"; confirmed from adjacent rows as 28/04/2023.
  170: {
    quotationNo: "6604033",
    quotationDate: "2023-04-28",
  },

  // Excel Date incorrectly stored as 27/06/1918.
  // Confirmed correct date: 19/01/2024.
  448: {
    quotationNo: "6701032",
    quotationDate: "2024-01-19",
  },

  // These six rows were stored with year 2004 in Excel.
  // The sequence and quotation period confirm September 2024.
  742: {
    quotationNo: "6709012",
    quotationDate: "2024-09-12",
  },
  743: {
    quotationNo: "6709013",
    quotationDate: "2024-09-13",
  },
  744: {
    quotationNo: "6709014",
    quotationDate: "2024-09-13",
  },
  745: {
    quotationNo: "6709015",
    quotationDate: "2024-09-14",
  },
  746: {
    quotationNo: "6709016",
    quotationDate: "2024-09-14",
  },
  747: {
    quotationNo: "6709017",
    quotationDate: "2024-09-14",
  },
};

type CellValue =
  | ExcelJS.CellValue
  | null
  | undefined;

type ExpectedPeriod = {
  year: number;
  month: number;
};

type ImportQuotation = {
  quotation_no: string | null;
  quotation_date: string | null;
  source_date_raw: string | null;

  boq_no: string | null;

  customer_name_raw: string | null;

  project_name: string | null;

  total_amount: number | null;

  po: string | null;
  attention: string | null;
  email: string | null;

  source_file: string;
  source_sheet: string;
  source_row: number;
  source_row_hash: string;
};

/* =========================================================
 * Environment
 * ======================================================= */

function requireEnvironment(
  name: string,
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

/* =========================================================
 * Cell helpers
 * ======================================================= */

function unwrapCellValue(
  value: CellValue,
): unknown {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !== "object" ||
    value instanceof Date
  ) {
    return value;
  }

  if ("result" in value) {
    return value.result;
  }

  if ("richText" in value) {
    return value.richText
      .map((item) => item.text)
      .join("");
  }

  if ("text" in value) {
    return value.text;
  }

  return value;
}

/**
 * Text fields:
 * - string จะเก็บตาม Excel
 * - ไม่ trim ชื่อลูกค้า
 * - ไม่แก้ spelling
 * - ไม่รวมสาขา
 */
function getCellText(
  cell: ExcelJS.Cell,
): string | null {
  const value = unwrapCellValue(
    cell.value,
  );

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (typeof value === "string") {
    return value === "" ? null : value;
  }

  if (typeof value === "number") {
    const text = cell.text;

    if (text !== "") {
      return text;
    }

    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const text = cell.text;

  return text === ""
    ? null
    : text;
}

function getNumber(
  cell: ExcelJS.Cell,
): number | null {
  const value = unwrapCellValue(
    cell.value,
  );

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value)
    .replace(/,/g, "")
    .trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Invalid number "${String(value)}"`,
    );
  }

  return parsed;
}

function sourceValueToString(
  cell: ExcelJS.Cell,
): string | null {
  const value = unwrapCellValue(
    cell.value,
  );

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

/* =========================================================
 * Quotation number helper
 *
 * เช่น:
 * 6601001
 * Q6509019
 *
 * 66 = พ.ศ. 2566
 * 01 = มกราคม
 * ======================================================= */

function getExpectedPeriod(
  quotationNo: string | null,
): ExpectedPeriod | null {
  if (!quotationNo) {
    return null;
  }

  const normalized = quotationNo
    .trim()
    .replace(/^Q/i, "");

  const match =
    normalized.match(/^(\d{2})(\d{2})\d+/);

  if (!match) {
    return null;
  }

  const buddhistYear =
    2500 + Number(match[1]);

  const month = Number(match[2]);

  if (
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return {
    year: buddhistYear - 543,
    month,
  };
}

/* =========================================================
 * Date conversion
 *
 * Excel นี้มีทั้ง:
 *
 * 243257 -> 04/01/2566 ค.ศ. ใน Excel
 *            แต่ความหมายจริงคือ 04/01/2566 พ.ศ.
 *
 * 44943  -> 17/01/2023
 *
 * เรา normalize เป็น:
 * 2023-01-04
 * 2023-01-17
 *
 * Database เก็บ ค.ศ.
 * UI ค่อยแสดง พ.ศ.
 * ======================================================= */

function excelSerialToParts(
  serial: number,
): {
  year: number;
  month: number;
  day: number;
} {
  const wholeDays =
    Math.floor(serial);

  const epoch =
    Date.UTC(1899, 11, 30);

  const date = new Date(
    epoch +
      wholeDays *
        24 *
        60 *
        60 *
        1000,
  );

  let year =
    date.getUTCFullYear();

  const month =
    date.getUTCMonth() + 1;

  const day =
    date.getUTCDate();

  // ถ้า Excel ถูกกรอกเป็น พ.ศ.
  // เช่นปี Gregorian 2566
  // ให้แปลงกลับเป็น 2023
  if (
    year >= 2400 &&
    year <= 2700
  ) {
    year -= 543;
  }

  return {
    year,
    month,
    day,
  };
}

function normalizeYear(
  year: number,
  expectedYear?: number,
): number {
  // พ.ศ. 4 หลัก
  if (
    year >= 2400 &&
    year <= 2700
  ) {
    return year - 543;
  }

  // ค.ศ. 4 หลัก
  if (
    year >= 1900 &&
    year <= 2399
  ) {
    return year;
  }

  // ปี 2 หลัก
  if (
    year >= 0 &&
    year <= 99
  ) {
    if (expectedYear) {
      const possibleYears = [
        2000 + year,
        1900 + year,

        // เช่น 66 =
        // 2566 พ.ศ. = 2023
        1957 + year,
      ];

      if (
        possibleYears.includes(
          expectedYear,
        )
      ) {
        return expectedYear;
      }
    }

    // 23 -> 2023
    if (year <= 39) {
      return 2000 + year;
    }

    // 66 -> 2566 พ.ศ.
    // -> 2023 ค.ศ.
    return 1957 + year;
  }

  return year;
}

function isValidDateParts(
  year: number,
  month: number,
  day: number,
): boolean {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 ===
      month &&
    date.getUTCDate() === day
  );
}

function formatIsoDate(
  year: number,
  month: number,
  day: number,
): string {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function parseStringDate(
  input: string,
  expected:
    | ExpectedPeriod
    | null,
): string | null {
  const value = input.trim();

  if (!value) {
    return null;
  }

  const match =
    value.match(
      /^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/,
    );

  if (!match) {
    return null;
  }

  const a = Number(match[1]);
  const b = Number(match[2]);

  const rawYear =
    Number(match[3]);

  const year = normalizeYear(
    rawYear,
    expected?.year,
  );

  const candidates = [
    {
      // dd/mm/yyyy
      day: a,
      month: b,
    },
    {
      // mm/dd/yyyy
      day: b,
      month: a,
    },
  ].filter((candidate) =>
    isValidDateParts(
      year,
      candidate.month,
      candidate.day,
    ),
  );

  if (candidates.length === 0) {
    return null;
  }

  let selected =
    candidates[0];

  if (expected) {
    const sameMonth =
      candidates.find(
        (candidate) =>
          candidate.month ===
          expected.month,
      );

    if (sameMonth) {
      selected = sameMonth;
    }
  }

  return formatIsoDate(
    year,
    selected.month,
    selected.day,
  );
}

function normalizeExcelDate(
  cell: ExcelJS.Cell,
  quotationNo: string | null,
): string | null {
  const value = unwrapCellValue(
    cell.value,
  );

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const expected =
    getExpectedPeriod(
      quotationNo,
    );

  if (typeof value === "number") {
    const parts =
      excelSerialToParts(value);

    return formatIsoDate(
      parts.year,
      parts.month,
      parts.day,
    );
  }

  if (value instanceof Date) {
    let year =
      value.getUTCFullYear();

    const month =
      value.getUTCMonth() + 1;

    const day =
      value.getUTCDate();

    if (
      year >= 2400 &&
      year <= 2700
    ) {
      year -= 543;
    }

    return formatIsoDate(
      year,
      month,
      day,
    );
  }

  return parseStringDate(
    String(value),
    expected,
  );
}

/* =========================================================
 * Validation
 * ======================================================= */

function amountToCents(
  amount: number | null,
): number {
  if (amount === null) {
    return 0;
  }

  return Math.round(
    amount * 100,
  );
}

function createRowHash(
  values: unknown[],
): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(values),
    )
    .digest("hex");
}

function chunk<T>(
  values: T[],
  size: number,
): T[][] {
  const output: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    output.push(
      values.slice(
        index,
        index + size,
      ),
    );
  }

  return output;
}

/* =========================================================
 * Main
 * ======================================================= */

async function main() {
  const absoluteExcelPath =
    path.resolve(
      process.cwd(),
      excelPath,
    );

  console.log(
    `Reading Excel: ${absoluteExcelPath}`,
  );

  const workbook =
    new ExcelJS.Workbook();

  await workbook.xlsx.readFile(
    absoluteExcelPath,
  );

  const worksheet =
    workbook.getWorksheet(
      SOURCE_SHEET,
    );

  if (!worksheet) {
    throw new Error(
      `Sheet "${SOURCE_SHEET}" was not found.`,
    );
  }

  /* -------------------------------------------------------
   * Header validation
   * ----------------------------------------------------- */

  const actualHeaders =
    EXPECTED_HEADERS.map(
      (_, index) =>
        worksheet
          .getCell(1, index + 1)
          .text,
    );

  for (
    let index = 0;
    index <
    EXPECTED_HEADERS.length;
    index++
  ) {
    if (
      actualHeaders[index] !==
      EXPECTED_HEADERS[index]
    ) {
      throw new Error(
        [
          "Excel header mismatch.",
          `Column ${index + 1}`,
          `Expected: "${EXPECTED_HEADERS[index]}"`,
          `Actual: "${actualHeaders[index]}"`,
        ].join("\n"),
      );
    }
  }

  const records: ImportQuotation[] =
    [];

  const dateWarnings: string[] =
    [];

  /* -------------------------------------------------------
   * Data rows
   * ----------------------------------------------------- */

  for (
    let rowNumber = 2;
    rowNumber <=
    worksheet.rowCount;
    rowNumber++
  ) {
    const row =
      worksheet.getRow(
        rowNumber,
      );

    const values =
      Array.isArray(
        row.values,
      )
        ? row.values
        : [];

    const rowHasData =
      values
        .slice(1)
        .some(
          (value) =>
            value !== null &&
            value !== undefined &&
            value !== "",
        );

    if (!rowHasData) {
      continue;
    }

    const quotationNo =
      getCellText(
        row.getCell(2),
      );

    let quotationDate =
      normalizeExcelDate(
        row.getCell(1),
        quotationNo,
      );

    const sourceDateRaw =
      sourceValueToString(
        row.getCell(1),
      );

    /*
     * Apply only explicitly confirmed manual corrections.
     *
     * We normalize an optional "Q" prefix only for comparison.
     * The original quotation_no and source_date_raw are not changed.
     */
    const manualDateCorrection =
      MANUAL_DATE_CORRECTIONS[rowNumber];

    if (manualDateCorrection) {
      const normalizedQuotationNo =
        quotationNo
          ?.trim()
          .replace(/^Q/i, "") ??
        "";

      if (
        normalizedQuotationNo !==
        manualDateCorrection.quotationNo
      ) {
        throw new Error(
          [
            `Manual date correction safety check failed at row ${rowNumber}.`,
            `Expected quotation: ${manualDateCorrection.quotationNo}`,
            `Actual quotation: ${quotationNo ?? "-"}`,
          ].join("\n"),
        );
      }

      quotationDate =
        manualDateCorrection.quotationDate;
    }

    const boqNo =
      getCellText(
        row.getCell(3),
      );

    const customerName =
      getCellText(
        row.getCell(4),
      );

    const projectName =
      getCellText(
        row.getCell(5),
      );

    const totalAmount =
      getNumber(
        row.getCell(6),
      );

    const po =
      getCellText(
        row.getCell(7),
      );

    const attention =
      getCellText(
        row.getCell(8),
      );

    const email =
      getCellText(
        row.getCell(9),
      );

    /*
     * ใช้ Quotation No. แค่ตรวจสอบ
     * ไม่ใช้แก้ข้อมูลอัตโนมัติ
     */
    const expected =
      getExpectedPeriod(
        quotationNo,
      );

    if (
      quotationDate &&
      expected
    ) {
      const [
        year,
        month,
      ] = quotationDate
        .split("-")
        .map(Number);

      if (
        year !== expected.year ||
        month !== expected.month
      ) {
        dateWarnings.push(
          [
            `Row ${rowNumber}`,
            `Quotation ${quotationNo}`,
            `Date ${quotationDate}`,
            `Expected period ${expected.year}-${String(
              expected.month,
            ).padStart(2, "0")}`,
          ].join(" | "),
        );
      }
    }

    const sourceFile =
      path.basename(
        absoluteExcelPath,
      );

    const rowHash =
      createRowHash([
        sourceDateRaw,
        quotationNo,
        boqNo,
        customerName,
        projectName,
        totalAmount,
        po,
        attention,
        email,
      ]);

    records.push({
      quotation_no:
        quotationNo,

      quotation_date:
        quotationDate,

      source_date_raw:
        sourceDateRaw,

      boq_no:
        boqNo,

      customer_name_raw:
        customerName,

      project_name:
        projectName,

      total_amount:
        totalAmount,

      po,

      attention,

      email,

      source_file:
        sourceFile,

      source_sheet:
        SOURCE_SHEET,

      source_row:
        rowNumber,

      source_row_hash:
        rowHash,
    });
  }

  /* -------------------------------------------------------
   * Verify source file
   * ----------------------------------------------------- */

  const totalCents =
    records.reduce(
      (sum, record) =>
        sum +
        amountToCents(
          record.total_amount,
        ),
      0,
    );

  const exactCustomers =
    new Set(
      records
        .map(
          (record) =>
            record.customer_name_raw,
        )
        .filter(
          (
            value,
          ): value is string =>
            value !== null,
        ),
    );

  const blankDates =
    records.filter(
      (record) =>
        record.quotation_date ===
        null,
    ).length;

  const blankPO =
    records.filter(
      (record) =>
        record.po === null,
    ).length;

  const quotationCounts =
    new Map<string, number>();

  records.forEach(
    (record) => {
      if (
        !record.quotation_no
      ) {
        return;
      }

      quotationCounts.set(
        record.quotation_no,
        (quotationCounts.get(
          record.quotation_no,
        ) ?? 0) + 1,
      );
    },
  );

  const duplicateQuotationNos =
    [...quotationCounts.entries()]
      .filter(
        ([, count]) =>
          count > 1,
      );

  console.log("");
  console.log(
    "========= SOURCE CHECK =========",
  );

  console.log(
    `Rows: ${records.length.toLocaleString()}`,
  );

  console.log(
    `Total: ${(totalCents / 100).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}`,
  );

  console.log(
    `Exact customer names: ${exactCustomers.size}`,
  );

  console.log(
    `Blank dates: ${blankDates}`,
  );

  console.log(
    `Blank PO: ${blankPO}`,
  );

  console.log(
    "Duplicate quotation numbers:",
    duplicateQuotationNos,
  );

  if (
    records.length !==
    EXPECTED_DATA_ROWS
  ) {
    throw new Error(
      `Expected ${EXPECTED_DATA_ROWS} rows but found ${records.length}.`,
    );
  }

  if (
    totalCents !==
    EXPECTED_TOTAL_CENTS
  ) {
    throw new Error(
      [
        "Total amount does not match source verification.",
        `Expected cents: ${EXPECTED_TOTAL_CENTS}`,
        `Actual cents: ${totalCents}`,
      ].join("\n"),
    );
  }

  if (
    exactCustomers.size !==
    EXPECTED_CUSTOMER_NAMES
  ) {
    throw new Error(
      [
        "Customer count does not match source verification.",
        `Expected: ${EXPECTED_CUSTOMER_NAMES}`,
        `Actual: ${exactCustomers.size}`,
      ].join("\n"),
    );
  }

  if (dateWarnings.length) {
    console.warn("");
    console.warn(
      "Date / quotation period warnings:",
    );

    dateWarnings.forEach(
      (warning) =>
        console.warn(
          `- ${warning}`,
        ),
    );
  }

  /* -------------------------------------------------------
   * Dry run
   * ----------------------------------------------------- */

  if (!commit) {
    console.log("");
    console.log(
      "✅ Excel verification passed.",
    );

    console.log(
      "No database changes were made.",
    );

    console.log("");
    console.log(
      "Run again with:",
    );

    console.log(
      "npm run import:quotations -- --commit",
    );

    return;
  }

  /* -------------------------------------------------------
   * Supabase
   * ----------------------------------------------------- */

  const supabaseUrl =
    requireEnvironment(
      "NEXT_PUBLIC_SUPABASE_URL",
    );

  const serviceRoleKey =
    requireEnvironment(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken:
            false,

          persistSession:
            false,
        },
      },
    );

  /* -------------------------------------------------------
   * Customers
   * ----------------------------------------------------- */

  const customerNames =
    [...exactCustomers];

  for (
    const group of chunk(
      customerNames,
      100,
    )
  ) {
    const {
      error,
    } = await supabase
      .from("customers")
      .upsert(
        group.map(
          (name) => ({
            name,
          }),
        ),
        {
          onConflict:
            "name",
        },
      );

    if (error) {
      throw new Error(
        `Customer import failed: ${error.message}`,
      );
    }
  }

  const {
    data: customerRows,
    error: customerError,
  } = await supabase
    .from("customers")
    .select("id, name")
    .range(0, 9999);

  if (customerError) {
    throw new Error(
      customerError.message,
    );
  }

  const customerIdByName =
    new Map<string, string>();

  customerRows?.forEach(
    (customer) => {
      customerIdByName.set(
        customer.name,
        customer.id,
      );
    },
  );

  /* -------------------------------------------------------
   * Quotations
   * ----------------------------------------------------- */

  const quotationRows =
    records.map(
      (record) => {
        const customerId =
          record.customer_name_raw
            ? customerIdByName.get(
                record.customer_name_raw,
              ) ?? null
            : null;

        return {
          quotation_no:
            record.quotation_no,

          quotation_date:
            record.quotation_date,

          source_date_raw:
            record.source_date_raw,

          boq_no:
            record.boq_no,

          customer_id:
            customerId,

          customer_name_raw:
            record.customer_name_raw,

          project_name:
            record.project_name,

          total_amount:
            record.total_amount,

          po:
            record.po,

          attention:
            record.attention,

          email:
            record.email,

          source_file:
            record.source_file,

          source_sheet:
            record.source_sheet,

          source_row:
            record.source_row,

          source_row_hash:
            record.source_row_hash,

          deleted_at:
            null,
        };
      },
    );

  for (
    const group of chunk(
      quotationRows,
      200,
    )
  ) {
    const {
      error,
    } = await supabase
      .from("quotations")
      .upsert(
        group,
        {
          onConflict:
            "source_file,source_sheet,source_row",
        },
      );

    if (error) {
      throw new Error(
        `Quotation import failed: ${error.message}`,
      );
    }
  }

  console.log("");
  console.log(
    `✅ Imported ${quotationRows.length.toLocaleString()} quotations.`,
  );

  console.log(
    `✅ Customers: ${customerNames.length}`,
  );

  console.log(
    "✅ Import completed.",
  );
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "❌ Import failed",
    );

    console.error(error);

    process.exit(1);
  },
);
