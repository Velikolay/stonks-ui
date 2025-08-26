const API_BASE_URL = "http://localhost:8000";

export interface FinancialMetric {
  label: string;
  normalized_label: string;
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

    // Filter out invalid metrics
    return metrics.filter(
      (metric: FinancialMetric) =>
        metric &&
        metric.normalized_label &&
        metric.normalized_label.trim() !== "" &&
        metric.label &&
        metric.label.trim() !== ""
    );
  }

  static async getFinancialData(
    ticker: string,
    normalizedLabel: string,
    granularity: "yearly" | "quarterly"
  ): Promise<FinancialData> {
    const response = await fetch(
      `${API_BASE_URL}/financials/?ticker=${ticker}&granularity=${granularity}&normalized_labels=${encodeURIComponent(normalizedLabel)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch financial data: ${response.statusText}`);
    }

    const rawData = await response.json();

    // Transform the API response to our expected format
    // Assuming the API returns data in a format like: { [date]: value }
    const data: FinancialDataPoint[] = Object.entries(rawData).map(
      ([date, value]) => ({
        date,
        value:
          typeof value === "number" ? value : parseFloat(value as string) || 0,
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
