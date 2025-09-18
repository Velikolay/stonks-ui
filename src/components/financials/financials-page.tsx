"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinancialChart } from "./financial-chart";
import { FinancialDataService } from "@/lib/services/financial-data";

interface FinancialMetric {
  normalized_label: string;
  statement: string;
  count: number;
  axis?: string;
}

interface FinancialDataPoint {
  date: string;
  value: number;
}

interface FinancialDataSeries {
  name: string;
  data: FinancialDataPoint[];
}

interface FinancialData {
  ticker: string;
  metric: string;
  granularity: "yearly" | "quarterly";
  series: FinancialDataSeries[];
}

interface FinancialsPageProps {
  ticker: string;
}

export function FinancialsPage({ ticker }: FinancialsPageProps) {
  const [availableMetrics, setAvailableMetrics] = useState<FinancialMetric[]>(
    []
  );
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [granularity, setGranularity] = useState<"yearly" | "quarterly">(
    "quarterly"
  );
  const [financialData, setFinancialData] = useState<FinancialData | null>(
    null
  );
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available metrics when component mounts or ticker changes
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const metrics = await FinancialDataService.getAvailableMetrics(
          ticker,
          granularity
        );

        // Remove duplicates and filter out empty normalized_labels
        // Consider both normalized_label and axis for uniqueness
        const uniqueMetrics = metrics
          .filter(
            (metric, index, self) =>
              index ===
              self.findIndex(
                m =>
                  m.normalized_label === metric.normalized_label &&
                  (m.axis || null) === (metric.axis || null)
              )
          )
          .filter(
            metric =>
              metric.normalized_label && metric.normalized_label.trim() !== ""
          );

        setAvailableMetrics(uniqueMetrics);

        // Auto-select first metric if none selected
        if (uniqueMetrics.length > 0 && !selectedMetric) {
          const firstMetric = uniqueMetrics[0];
          const uniqueValue = firstMetric.axis
            ? `${firstMetric.normalized_label}|${firstMetric.axis}`
            : firstMetric.normalized_label;
          setSelectedMetric(uniqueValue || `metric-0`);
        }
      } catch {
        setError("Failed to load available metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [ticker, granularity, selectedMetric]);

  // Fetch financial data when metric or granularity changes
  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!selectedMetric) return;

      try {
        setLoading(true);
        setError(null);

        // Extract normalized_label and axis from the selected value
        const [normalizedLabel, axis] = selectedMetric.includes("|")
          ? selectedMetric.split("|")
          : [selectedMetric, undefined];

        const data = await FinancialDataService.getFinancialData(
          ticker,
          normalizedLabel,
          granularity,
          axis
        );
        setFinancialData(data);

        // Show all series by default (empty array means show all)
        setSelectedSeries([]);
      } catch {
        setError("Failed to load financial data");
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, [ticker, selectedMetric, granularity]);

  const handleGranularityToggle = () => {
    setGranularity(prev => (prev === "quarterly" ? "yearly" : "quarterly"));
  };

  // Group metrics by statement and order them
  const groupedMetrics = availableMetrics.reduce(
    (groups, metric) => {
      const statement = metric.statement || "Other";
      if (!groups[statement]) {
        groups[statement] = [];
      }
      groups[statement].push(metric);
      return groups;
    },
    {} as Record<string, FinancialMetric[]>
  );

  // Define statement order (most common financial statements first)
  const statementOrder = [
    "Income Statement",
    "Balance Sheet",
    "Cash Flow Statement",
  ];

  // Sort metrics within each group by normalized_label
  Object.keys(groupedMetrics).forEach(statement => {
    groupedMetrics[statement].sort((a, b) =>
      a.normalized_label.localeCompare(b.normalized_label)
    );
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {ticker} Financials
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Financial metrics and performance data
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Data Selection</CardTitle>
            <CardDescription>
              Choose a financial metric and time granularity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Metric Selection */}
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Financial Metric
                </label>
                <Select
                  value={selectedMetric}
                  onValueChange={setSelectedMetric}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        availableMetrics.length > 0
                          ? "Select a metric"
                          : "Loading metrics..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMetrics.length > 0 ? (
                      statementOrder
                        .filter(
                          statement => groupedMetrics[statement]?.length > 0
                        )
                        .map(statement => (
                          <div key={statement}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">
                              {statement}
                            </div>
                            {groupedMetrics[statement].map((metric, index) => {
                              const displayLabel = metric.axis
                                ? `${metric.normalized_label} (${metric.axis})`
                                : metric.normalized_label;
                              const uniqueKey = metric.axis
                                ? `${metric.normalized_label}-${metric.axis}-${index}`
                                : `${metric.normalized_label}-${index}`;
                              const uniqueValue = metric.axis
                                ? `${metric.normalized_label}|${metric.axis}`
                                : metric.normalized_label;

                              return (
                                <SelectItem
                                  key={uniqueKey}
                                  value={uniqueValue || `metric-${index}`}
                                  className="pl-6"
                                >
                                  {displayLabel} ({metric.count})
                                </SelectItem>
                              );
                            })}
                          </div>
                        ))
                    ) : (
                      <SelectItem value="no-metrics" disabled>
                        No metrics available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Granularity Toggle */}
              <div className="flex items-end">
                <Button
                  variant={granularity === "quarterly" ? "default" : "outline"}
                  onClick={handleGranularityToggle}
                  className="w-full sm:w-auto"
                >
                  {granularity === "quarterly" ? "Quarterly" : "Yearly"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <CardContent className="pt-6">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        {financialData && (
          <Card>
            <CardHeader>
              <CardTitle>
                {(() => {
                  // Parse the selectedMetric value to extract normalized_label and axis
                  const [normalizedLabel, axis] = selectedMetric.includes("|")
                    ? selectedMetric.split("|")
                    : [selectedMetric, null];

                  const metric = availableMetrics.find(
                    m =>
                      m.normalized_label === normalizedLabel &&
                      (m.axis || null) === (axis || null)
                  );
                  if (metric) {
                    return metric.axis
                      ? `${metric.normalized_label} (${metric.axis})`
                      : metric.normalized_label;
                  }
                  return selectedMetric;
                })()}
              </CardTitle>
              <CardDescription>
                {ticker} -{" "}
                {granularity.charAt(0).toUpperCase() + granularity.slice(1)}{" "}
                Data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FinancialChart
                data={financialData}
                selectedSeries={selectedSeries}
                onSeriesChange={setSelectedSeries}
              />
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div>
                <span className="ml-2 text-slate-600 dark:text-slate-400">
                  Loading...
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
