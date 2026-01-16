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
import {
  FinancialDataService,
  FinancialMetric,
} from "@/lib/services/financial-data";
import { STATEMENT_TYPES } from "@/lib/services/protocol";

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

interface ChartsPageProps {
  ticker: string;
}

export function ChartsPage({ ticker }: ChartsPageProps) {
  const [allMetrics, setAllMetrics] = useState<FinancialMetric[]>([]);
  const [availableMetrics, setAvailableMetrics] = useState<FinancialMetric[]>(
    []
  );
  const [selectedMetric, setSelectedMetric] = useState<FinancialMetric | null>(
    null
  );
  const [availableDimensions, setAvailableDimensions] = useState<string[]>([]);
  const [selectedDimension, setSelectedDimension] = useState<string | null>(
    null
  );
  const [granularity, setGranularity] = useState<"yearly" | "quarterly">(
    "quarterly"
  );
  const [financialData, setFinancialData] = useState<FinancialData | null>(
    null
  );
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [showGrowthLine, setShowGrowthLine] = useState<boolean>(false);
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

        // Store all metrics for dimension extraction
        const filteredMetrics = metrics.filter(
          metric =>
            metric.normalized_label && metric.normalized_label.trim() !== ""
        );
        setAllMetrics(filteredMetrics);

        // Remove duplicates and filter out empty normalized_labels
        // Consider normalized_label and statement for uniqueness (for display in selector)
        const uniqueMetrics = filteredMetrics.filter(
          (metric, index, self) =>
            index ===
            self.findIndex(
              m =>
                m.normalized_label === metric.normalized_label &&
                m.statement === metric.statement
            )
        );

        setAvailableMetrics(uniqueMetrics);

        // Auto-select first metric if none selected
        if (uniqueMetrics.length > 0 && !selectedMetric) {
          const firstMetric = uniqueMetrics[0];
          setSelectedMetric(firstMetric);
        }
      } catch {
        setError("Failed to load available metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [ticker, granularity, selectedMetric]);

  // Extract available dimensions when metric changes
  useEffect(() => {
    if (!selectedMetric) {
      setAvailableDimensions([]);
      setSelectedDimension(null);
      return;
    }

    // Find all metrics with the same normalized_label and statement
    const matchingMetrics = allMetrics.filter(
      m =>
        m.normalized_label === selectedMetric.normalized_label &&
        m.statement === selectedMetric.statement
    );

    // Extract unique axes/dimensions
    const dimensions = matchingMetrics
      .map(m => m.axis)
      .filter((axis): axis is string => !!axis && axis.trim() !== "")
      .filter((axis, index, self) => self.indexOf(axis) === index)
      .sort();

    setAvailableDimensions(dimensions);

    // Don't auto-select - let user choose or clear
  }, [selectedMetric, allMetrics]);

  // Fetch financial data when metric, dimension, or granularity changes
  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!selectedMetric) return;

      try {
        setLoading(true);
        setError(null);

        const data = await FinancialDataService.getFinancialData(
          ticker,
          selectedMetric.normalized_label,
          granularity,
          selectedDimension || undefined,
          selectedMetric.statement
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
  }, [ticker, selectedMetric, selectedDimension, granularity]);

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
            {ticker} Charts
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Financial charts and performance data
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
                  value={selectedMetric ? selectedMetric.id : ""}
                  onValueChange={value => {
                    const metric = availableMetrics.find(m => m.id === value);
                    setSelectedMetric(metric || null);
                  }}
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
                      STATEMENT_TYPES.filter(
                        statement => groupedMetrics[statement]?.length > 0
                      ).map(statement => (
                        <div key={statement}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">
                            {statement}
                          </div>
                          {groupedMetrics[statement].map((metric, index) => {
                            const uniqueKey = `${metric.normalized_label}-${index}`;

                            return (
                              <SelectItem
                                key={uniqueKey}
                                value={metric.id}
                                className="pl-6"
                              >
                                {metric.normalized_label}
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
            <CardContent className="pt-6">
              <FinancialChart
                data={financialData}
                selectedSeries={selectedSeries}
                onSeriesChange={setSelectedSeries}
                showGrowthLine={showGrowthLine}
                onGrowthLineToggle={setShowGrowthLine}
                title={
                  selectedMetric
                    ? selectedDimension
                      ? `${selectedMetric.normalized_label} (${selectedDimension})`
                      : selectedMetric.normalized_label
                    : "No metric selected"
                }
                description={`${ticker} - ${granularity.charAt(0).toUpperCase() + granularity.slice(1)} Data`}
                availableDimensions={availableDimensions}
                selectedDimension={selectedDimension}
                onDimensionChange={setSelectedDimension}
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
