import { StatementType } from "@/lib/services/protocol";

const API_BASE_URL = "http://localhost:8000";

// In-memory cache (dedupes concurrent requests too)
const availableMetricsCache = new Map<string, Promise<FinancialMetric[]>>();

interface RawFinancialMetric {
  normalized_label: string;
  statement: StatementType;
  count: number;
  axis?: string;
}

interface RawMetricValue {
  period_end: string;
  value: string | number;
  fiscal_quarter?: number;
}

interface RawMetricSeries {
  member?: string;
  normalized_label?: string;
  values?: RawMetricValue[];
  /** Alternative ways to split this series. Omitted unless labels were requested. */
  breakdowns?: DimensionBreakdown[];
}

function parseBreakdowns(
  breakdowns: DimensionBreakdown[] | undefined
): DimensionBreakdown[] | undefined {
  if (!breakdowns?.length) return undefined;
  const parsed: DimensionBreakdown[] = [];
  for (const breakdown of breakdowns) {
    if (!breakdown.axis || !breakdown.members?.length) continue;
    const members: string[] = [];
    const seen = new Set<string>();
    for (const member of breakdown.members) {
      if (!member || seen.has(member)) continue;
      seen.add(member);
      members.push(member);
    }
    if (members.length > 0) {
      parsed.push({ axis: breakdown.axis, members });
    }
  }
  return parsed.length > 0 ? parsed : undefined;
}

function parseMetricSeries(raw: RawMetricSeries[]): FinancialDataSeries[] {
  return raw.map(item => {
    const data: FinancialDataPoint[] = (item.values || []).map(value => ({
      date: value.period_end,
      value:
        typeof value.value === "number"
          ? value.value
          : parseFloat(value.value) || 0,
      fiscal_quarter: value.fiscal_quarter,
    }));

    data.sort((a, b) => a.date.localeCompare(b.date));

    return {
      name: item.member || item.normalized_label || "Total",
      data,
      breakdowns: parseBreakdowns(item.breakdowns),
    };
  });
}

export class FinancialMetric {
  id: string;
  normalized_label: string;
  statement: StatementType;
  axis?: string;
  count: number;

  constructor(data: RawFinancialMetric) {
    this.id = `${data.normalized_label}-${data.statement}-${data.axis || "no-axis"}`;
    this.normalized_label = data.normalized_label;
    this.statement = data.statement;
    this.axis = data.axis;
    this.count = data.count;
  }
}

/** One way to split the series it is attached to. Entries on the same series are alternatives. */
export interface DimensionBreakdown {
  axis: string;
  members: string[];
}

export interface FinancialDataPoint {
  date: string;
  value: number;
  fiscal_quarter?: number;
}

export interface FinancialDataSeries {
  name: string;
  data: FinancialDataPoint[];
  /**
   * Alternative splits of this series. Present when the request asked for
   * labels. Member amounts are on the axis response, matched by name and period.
   */
  breakdowns?: DimensionBreakdown[];
}

export interface FinancialData {
  ticker: string;
  metric: string;
  granularity: "yearly" | "quarterly";
  series: FinancialDataSeries[]; // Always use series-based approach
  /**
   * Undimensioned concept total. Present when `series` is one axis of that
   * concept, so the chart can tell which members add up to it.
   */
  total?: FinancialDataSeries;
}

export interface StatementData {
  ticker: string;
  statement: StatementType;
  granularity: "yearly" | "quarterly";
  metrics: Array<{
    normalized_label: string;
    axis?: string;
    abstracts?: string[];
    data: FinancialDataPoint[];
    concept?: string;
    abstract_concepts?: string[];
  }>;
}

export interface FinancialFiling {
  id: number;
  company_id: number;
  source: string;
  filing_number: string;
  form_type: string;
  filing_date: string;
  fiscal_period_end: string;
  fiscal_year: number;
  fiscal_quarter: number;
  public_url: string | null;
}

export class FinancialDataService {
  static async getAvailableMetrics(
    ticker: string,
    granularity: "yearly" | "quarterly",
    statement?: StatementType
  ): Promise<FinancialMetric[]> {
    const cacheKey = `${ticker}__${granularity}__${statement ?? ""}`;
    const cached = availableMetricsCache.get(cacheKey);
    if (cached) return cached;

    const promise = (async () => {
      const url = new URL(`${API_BASE_URL}/financials/normalized-labels`);
      url.searchParams.set("ticker", ticker);
      url.searchParams.set("granularity", granularity);
      if (statement) {
        url.searchParams.set("statement", statement);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const rawMetrics = await response.json();

      // Filter out invalid metrics and create FinancialMetric instances
      const filteredMetrics = rawMetrics
        .filter(
          (metric: RawFinancialMetric) =>
            metric &&
            metric.normalized_label &&
            metric.normalized_label.trim() !== ""
        )
        .map((metric: RawFinancialMetric) => new FinancialMetric(metric));

      return filteredMetrics;
    })();

    availableMetricsCache.set(cacheKey, promise);
    promise.catch(() => {
      // Don't permanently cache failures
      availableMetricsCache.delete(cacheKey);
    });

    return promise;
  }

  static async getFinancialData(
    ticker: string,
    normalizedLabel: string,
    granularity: "yearly" | "quarterly",
    axis?: string,
    statement?: StatementType
  ): Promise<FinancialData> {
    // A dimension response is the axis members. The concept series, fetched
    // alongside it, lists each way those members can split the concept.
    // A member series can list its own splits, used to drill into that member.
    const [memberRaw, totalRaw] = await Promise.all([
      this.fetchMetricSeries(
        ticker,
        normalizedLabel,
        granularity,
        statement,
        axis
      ),
      axis
        ? this.fetchMetricSeries(
            ticker,
            normalizedLabel,
            granularity,
            statement
          )
        : Promise.resolve(null),
    ]);

    const series = parseMetricSeries(memberRaw);
    const total = totalRaw ? parseMetricSeries(totalRaw)[0] : undefined;

    return {
      ticker,
      metric: normalizedLabel,
      granularity,
      series,
      total,
    };
  }

  private static async fetchMetricSeries(
    ticker: string,
    normalizedLabel: string,
    granularity: "yearly" | "quarterly",
    statement?: StatementType,
    axis?: string
  ): Promise<RawMetricSeries[]> {
    const url = new URL(`${API_BASE_URL}/financials/`);
    url.searchParams.set("ticker", ticker);
    url.searchParams.set("granularity", granularity);
    url.searchParams.set("normalized_labels", normalizedLabel);
    if (statement) {
      url.searchParams.set("statement", statement);
    }
    if (axis) {
      url.searchParams.set("axis", axis);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch financial data: ${response.statusText}`);
    }

    const rawData = await response.json();

    // The API returns an array where each item is one axis member
    // (or the undimensioned concept when no axis is requested).
    if (Array.isArray(rawData)) {
      if (rawData.length === 0) {
        throw new Error("Empty array received from API");
      }
      return axis ? rawData : rawData.slice(0, 1);
    }

    return [rawData];
  }

  static async getStatementData(
    ticker: string,
    statement: StatementType,
    granularity: "yearly" | "quarterly",
    debug?: boolean
  ): Promise<StatementData> {
    const url = new URL(`${API_BASE_URL}/financials/`);
    url.searchParams.set("ticker", ticker);
    url.searchParams.set("granularity", granularity);
    url.searchParams.set("statement", statement);
    url.searchParams.set("short", "true");
    if (debug) {
      url.searchParams.set("debug", "true");
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch statement data: ${response.statusText}`);
    }

    const rawData = await response.json();

    // Transform the API response to our expected format
    // The API returns an array where each item represents a different metric
    // Each item has: ticker, normalized_label, statement, axis, member, values

    const metrics = rawData.map(
      (item: {
        normalized_label: string;
        axis?: string;
        member?: string;
        abstracts?: string[];
        concept?: string;
        abstract_concepts?: string[];
        values?: Array<{
          period_end: string;
          value: string | number;
          fiscal_quarter?: number;
        }>;
      }) => {
        const data: FinancialDataPoint[] = (item.values || []).map(
          (valueItem: {
            period_end: string;
            value: string | number;
            fiscal_quarter?: number;
          }) => ({
            date: valueItem.period_end,
            value:
              typeof valueItem.value === "number"
                ? valueItem.value
                : parseFloat(valueItem.value) || 0,
            fiscal_quarter: valueItem.fiscal_quarter,
          })
        );

        // Sort by date (oldest first)
        data.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        return {
          normalized_label: item.normalized_label,
          axis: item.axis,
          abstracts: item.abstracts,
          concept: item.concept,
          abstract_concepts: item.abstract_concepts,
          data,
        };
      }
    );

    return {
      ticker,
      statement,
      granularity,
      metrics,
    };
  }

  static async getFilings(
    ticker: string,
    formType?: string
  ): Promise<FinancialFiling[]> {
    const url = new URL(`${API_BASE_URL}/financials/filings`);
    url.searchParams.set("ticker", ticker);
    if (formType) {
      url.searchParams.set("form_type", formType);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch filings: ${response.statusText}`);
    }

    const filings = await response.json();
    return filings;
  }
}
