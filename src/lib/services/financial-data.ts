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
}

export interface FinancialData {
  ticker: string;
  metric: string;
  granularity: "yearly" | "quarterly";
  data: FinancialDataPoint[];
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

    // Debug: Log the raw response
    console.log("API Response:", metrics);
    console.log(
      "First 3 items structure:",
      metrics.slice(0, 3).map((item: unknown) => ({
        keys: Object.keys(item as Record<string, unknown>),
        values: item,
      }))
    );

    // Filter out invalid metrics
    const filteredMetrics = metrics.filter(
      (metric: FinancialMetric) =>
        metric &&
        metric.normalized_label &&
        metric.normalized_label.trim() !== ""
    );

    console.log("Filtered metrics from service:", filteredMetrics);

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
    // The API returns an array with one item containing the values
    const metricData =
      Array.isArray(rawData) && rawData.length > 0 ? rawData[0] : rawData;

    if (!metricData || !metricData.values) {
      throw new Error("Invalid data structure received from API");
    }

    const data: FinancialDataPoint[] = metricData.values.map(
      (item: { period_end: string; value: string | number }) => ({
        date: item.period_end,
        value:
          typeof item.value === "number"
            ? item.value
            : parseFloat(item.value) || 0,
      })
    );

    // Sort by date (oldest first)
    data.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return {
      ticker,
      metric: normalizedLabel,
      granularity,
      data,
    };
  }
}
