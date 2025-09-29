const API_BASE_URL = "http://localhost:8000";

export interface FinancialMetric {
  normalized_label: string;
  statement: string;
  count: number;
  axis?: string;
}

export interface FinancialDataPoint {
  date: string;
  value: number;
  fiscal_quarter?: number;
}

export interface FinancialDataSeries {
  name: string;
  data: FinancialDataPoint[];
}

export interface FinancialData {
  ticker: string;
  metric: string;
  granularity: "yearly" | "quarterly";
  series: FinancialDataSeries[]; // Always use series-based approach
}

export interface StatementData {
  ticker: string;
  statement: string;
  granularity: "yearly" | "quarterly";
  metrics: Array<{
    normalized_label: string;
    axis?: string;
    abstracts?: string[];
    data: FinancialDataPoint[];
  }>;
}

export class FinancialDataService {
  static async getAvailableMetrics(
    ticker: string,
    granularity: "yearly" | "quarterly"
  ): Promise<FinancialMetric[]> {
    const response = await fetch(
      `${API_BASE_URL}/financials/normalized-labels?ticker=${ticker}&granularity=${granularity}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    const metrics = await response.json();

    // Filter out invalid metrics
    const filteredMetrics = metrics.filter(
      (metric: FinancialMetric) =>
        metric &&
        metric.normalized_label &&
        metric.normalized_label.trim() !== ""
    );

    return filteredMetrics;
  }

  static async getFinancialData(
    ticker: string,
    normalizedLabel: string,
    granularity: "yearly" | "quarterly",
    axis?: string
  ): Promise<FinancialData> {
    const url = new URL(`${API_BASE_URL}/financials/`);
    url.searchParams.set("ticker", ticker);
    url.searchParams.set("granularity", granularity);
    url.searchParams.set("normalized_labels", normalizedLabel);
    if (axis) {
      url.searchParams.set("axis", axis);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch financial data: ${response.statusText}`);
    }

    const rawData = await response.json();

    // Transform the API response to our expected format
    // The API returns an array where each item represents a different axis member
    // Each item has: ticker, normalized_label, statement, axis, member, values

    let metricData;
    if (Array.isArray(rawData)) {
      if (rawData.length === 1) {
        // Case 1: Single item (no axis data) - normalize to series format
        const singleItem = rawData[0];
        metricData = {
          series: [
            {
              name: singleItem.normalized_label || "Total",
              values: singleItem.values || [],
            },
          ],
        };
      } else if (rawData.length > 1) {
        // Case 2: Multiple items (axis data - each item is a series)
        const series = rawData.map(
          (item: {
            member: string;
            values?: Array<{
              period_end: string;
              value: string | number;
              fiscal_quarter?: number;
            }>;
          }) => ({
            name: item.member, // Use member as the series name
            values: item.values || [],
          })
        );

        metricData = {
          series: series,
        };
      } else {
        throw new Error("Empty array received from API");
      }
    } else {
      // Case 3: Single object - normalize to series format
      metricData = {
        series: [
          {
            name: rawData.normalized_label || "Total",
            values: rawData.values || [],
          },
        ],
      };
    }

    if (!metricData) {
      throw new Error("Invalid data structure received from API");
    }

    // Validate that we have series data
    if (!metricData.series) {
      throw new Error("Invalid data structure received from API");
    }

    // Check if this is axis data with multiple series
    if (axis && metricData.series) {
      // Handle multiple series for axis data
      const series: FinancialDataSeries[] = metricData.series.map(
        (seriesItem: {
          name: string;
          values: Array<{
            period_end: string;
            value: string | number;
            fiscal_quarter?: number;
          }>;
        }) => {
          const seriesData: FinancialDataPoint[] = (
            seriesItem.values || []
          ).map(
            (item: {
              period_end: string;
              value: string | number;
              fiscal_quarter?: number;
            }) => ({
              date: item.period_end,
              value:
                typeof item.value === "number"
                  ? item.value
                  : parseFloat(item.value) || 0,
              fiscal_quarter: item.fiscal_quarter,
            })
          );

          // Sort by date (oldest first)
          seriesData.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          return {
            name: seriesItem.name,
            data: seriesData,
          };
        }
      );

      return {
        ticker,
        metric: normalizedLabel,
        granularity,
        series,
      };
    } else {
      // Handle single series data (no axis) - convert to series format
      const series: FinancialDataSeries[] = metricData.series.map(
        (seriesItem: {
          name: string;
          values: Array<{
            period_end: string;
            value: string | number;
            fiscal_quarter?: number;
          }>;
        }) => {
          const seriesData: FinancialDataPoint[] = (
            seriesItem.values || []
          ).map(
            (item: {
              period_end: string;
              value: string | number;
              fiscal_quarter?: number;
            }) => ({
              date: item.period_end,
              value:
                typeof item.value === "number"
                  ? item.value
                  : parseFloat(item.value) || 0,
              fiscal_quarter: item.fiscal_quarter,
            })
          );

          // Sort by date (oldest first)
          seriesData.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          return {
            name: seriesItem.name,
            data: seriesData,
          };
        }
      );

      return {
        ticker,
        metric: normalizedLabel,
        granularity,
        series,
      };
    }
  }

  static async getStatementData(
    ticker: string,
    statement: string,
    granularity: "yearly" | "quarterly"
  ): Promise<StatementData> {
    const url = new URL(`${API_BASE_URL}/financials/`);
    url.searchParams.set("ticker", ticker);
    url.searchParams.set("granularity", granularity);
    url.searchParams.set("statement", statement);
    url.searchParams.set("short", "true");

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
}
