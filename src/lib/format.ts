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
    value === ""
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