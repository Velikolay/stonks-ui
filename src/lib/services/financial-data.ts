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

export interface FinancialDataSeries {
  name: string;
  data: FinancialDataPoint[];
}

export interface FinancialData {
  ticker: string;
  metric: string;
  granularity: "yearly" | "quarterly";
  data: FinancialDataPoint[];
  series?: FinancialDataSeries[]; // For axis data with multiple series
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
    // The API returns an array where each item represents a different axis member
    // Each item has: ticker, normalized_label, statement, axis, member, values

    let metricData;
    if (Array.isArray(rawData)) {
      if (rawData.length === 1) {
        // Case 1: Single item (no axis data)
        metricData = rawData[0];
      } else if (rawData.length > 1) {
        // Case 2: Multiple items (axis data - each item is a series)
        // Group by axis member and create series
        const series = rawData.map(
          (item: {
            member: string;
            values?: Array<{ period_end: string; value: string | number }>;
          }) => ({
            name: item.member, // Use member as the series name
            values: item.values || [],
          })
        );

        metricData = {
          values: [], // Will be calculated from series
          series: series,
        };
      } else {
        throw new Error("Empty array received from API");
      }
    } else {
      // Case 3: Single object
      metricData = rawData;
    }

    if (!metricData) {
      throw new Error("Invalid data structure received from API");
    }

    // For axis data with series, we might not have values array
    if (!metricData.values && !metricData.series) {
      throw new Error("Invalid data structure received from API");
    }

    // Check if this is axis data with multiple series
    if (axis && metricData.series) {
      // Handle multiple series for axis data
      const series: FinancialDataSeries[] = metricData.series.map(
        (seriesItem: {
          name: string;
          values: Array<{ period_end: string; value: string | number }>;
        }) => {
          const seriesData: FinancialDataPoint[] = (
            seriesItem.values || []
          ).map((item: { period_end: string; value: string | number }) => ({
            date: item.period_end,
            value:
              typeof item.value === "number"
                ? item.value
                : parseFloat(item.value) || 0,
          }));

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

      // Create combined data for the main data array (sum of all series)
      const allDates = new Set<string>();
      series.forEach(s => s.data.forEach(d => allDates.add(d.date)));

      const combinedData: FinancialDataPoint[] = Array.from(allDates).map(
        date => {
          const totalValue = series.reduce((sum, s) => {
            const point = s.data.find(d => d.date === date);
            return sum + (point?.value || 0);
          }, 0);
          return { date, value: totalValue };
        }
      );

      combinedData.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return {
        ticker,
        metric: normalizedLabel,
        granularity,
        data: combinedData,
        series,
      };
    } else {
      // Handle single series data (no axis)
      if (!metricData.values) {
        throw new Error("No values data available for single series");
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
}
