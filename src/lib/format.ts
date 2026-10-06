export function displayOrDash(
  value:
    | string
    | number
    | null
    | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  if (
    typeof value === "string" &&
    value.trim() === ""
  ) {
    return "-";
  }

  return String(value);
}

export function formatThaiDate(
  isoDate:
    | string
    | null
    | undefined,
): string {
  if (!isoDate) {
    return "-";
  }

  const match =
    isoDate.match(
      /^(\d{4})-(\d{2})-(\d{2})/,
    );

  if (!match) {
    return "-";
  }

  const gregorianYear =
    Number(match[1]);

  const buddhistYear =
    gregorianYear + 543;

  const month = match[2];
  const day = match[3];

  return `${day}/${month}/${buddhistYear}`;
}

export function formatMoney(
  amount:
    | number
    | string
    | null
    | undefined,
): string {
  if (
    amount === null ||
    amount === undefined ||
    amount === ""
  ) {
    return "-";
  }

  const value =
    Number(amount);

  if (
    !Number.isFinite(value)
  ) {
    return "-";
  }

  return new Intl.NumberFormat(
    "th-TH",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export function formatBaht(
  amount:
    | number
    | string
    | null
    | undefined,
): string {
  const formatted =
    formatMoney(amount);

  if (formatted === "-") {
    return "-";
  }

  return `฿${formatted}`;
}

/**
 * เลขใบเสนอราคา
 *
 * 6909032  -> Q6909032
 * Q6909032 -> Q6909032
 */
export function formatQuotationNo(
  value:
    | string
    | number
    | null
    | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  const text =
    String(value).trim();

  if (!text) {
    return "-";
  }

  if (
    /^Q/i.test(text)
  ) {
    return `Q${text.slice(1)}`;
  }

  return `Q${text}`;
}

/**
 * เลข BOQ
 *
 * 6909010     -> BOQ6909010
 * BOQ6909010  -> BOQ6909010
 */
export function formatBoqNo(
  value:
    | string
    | number
    | null
    | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "-";
  }

  const text =
    String(value).trim();

  if (!text) {
    return "-";
  }

  if (
    /^BOQ/i.test(text)
  ) {
    return `BOQ${text.slice(3)}`;
  }

  return `BOQ${text}`;
}