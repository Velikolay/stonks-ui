const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  TWD: "NT$",
  KRW: "₩",
};

/** Symbol for a fact unit such as `eur` or `eurPerShare`. Share counts have none. */
export function currencyMark(unit: string | undefined): string {
  if (!unit) return "$";
  const lowered = unit.trim().toLowerCase();
  if (lowered === "shares" || lowered === "pure" || lowered === "number") {
    return "";
  }
  const code = lowered.match(/^([a-z]{3})(?:pershare)?$/)?.[1]?.toUpperCase();
  if (!code) return "";
  return SYMBOLS[code] ?? `${code} `;
}

/** Chart axis and tooltip. Two decimals, with a trillions step. */
export function formatChartAmount(
  value: number,
  unit: string | undefined
): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const mark = currencyMark(unit);
  if (absValue >= 1e12) {
    return `${sign}${mark}${(absValue / 1e12).toFixed(2)}T`;
  }
  if (absValue >= 1e9) {
    return `${sign}${mark}${(absValue / 1e9).toFixed(2)}B`;
  }
  if (absValue >= 1e6) {
    return `${sign}${mark}${(absValue / 1e6).toFixed(2)}M`;
  }
  if (absValue >= 1e3) {
    return `${sign}${mark}${(absValue / 1e3).toFixed(2)}K`;
  }
  return `${sign}${mark}${absValue.toFixed(2)}`;
}

/** Statement cell. One decimal on scaled amounts, a dash for zero. */
export function formatStatementAmount(
  value: number,
  unit: string | undefined
): string {
  if (value === 0) return "—";
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const mark = currencyMark(unit);
  if (absValue >= 1e12) {
    return `${sign}${mark}${(absValue / 1e12).toFixed(1)}T`;
  }
  if (absValue >= 1e9) {
    return `${sign}${mark}${(absValue / 1e9).toFixed(1)}B`;
  }
  if (absValue >= 1e6) {
    return `${sign}${mark}${(absValue / 1e6).toFixed(1)}M`;
  }
  if (absValue >= 1e3) {
    return `${sign}${mark}${(absValue / 1e3).toFixed(1)}K`;
  }
  return `${sign}${mark}${absValue.toFixed(2)}`;
}
