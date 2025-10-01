"use client";

import React, { useState } from "react";
import {
  StatementData,
  FinancialDataService,
} from "@/lib/services/financial-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MiniTrendChart } from "./mini-trend-chart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FinancialChart } from "../financials/financial-chart";

interface FinancialTableProps {
  data: StatementData | null;
  loading: boolean;
}

export function FinancialTable({ data, loading }: FinancialTableProps) {
  const [selectedMetric, setSelectedMetric] = useState<{
    metric: string;
    axis?: string;
    ticker: string;
    granularity: "yearly" | "quarterly";
  } | null>(null);
  const [chartData, setChartData] = useState<{
    ticker: string;
    metric: string;
    granularity: "yearly" | "quarterly";
    series: Array<{
      name: string;
      data: Array<{
        date: string;
        value: number;
      }>;
    }>;
  } | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [showGrowthLine, setShowGrowthLine] = useState<boolean>(false);

  const handleChartClick = async (metric: {
    normalized_label: string;
    axis?: string;
    data: Array<{
      date: string;
      value: number;
    }>;
  }) => {
    if (!data) return;

    setSelectedMetric({
      metric: metric.normalized_label,
      axis: metric.axis,
      ticker: data.ticker,
      granularity: data.granularity,
    });

    setChartLoading(true);
    try {
      const financialData = await FinancialDataService.getFinancialData(
        data.ticker,
        metric.normalized_label,
        data.granularity,
        metric.axis,
        data.statement
      );
      setChartData(financialData);
    } catch {
      // Handle error silently or show user-friendly message
    } finally {
      setChartLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setSelectedMetric(null);
    setChartData(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!data || !data.metrics.length) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-muted-foreground">No data available</div>
      </div>
    );
  }

  // Get all unique dates from all metrics and sort them
  const allDates = new Set<string>();
  data.metrics.forEach(metric => {
    metric.data.forEach(point => {
      allDates.add(point.date);
    });
  });

  const sortedDates = Array.from(allDates).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  // Format value for display
  const formatValue = (value: number) => {
    if (value === 0) return "—";

    const absValue = Math.abs(value);
    if (absValue >= 1e9) {
      return `${(value / 1e9).toFixed(1)}B`;
    } else if (absValue >= 1e6) {
      return `${(value / 1e6).toFixed(1)}M`;
    } else if (absValue >= 1e3) {
      return `${(value / 1e3).toFixed(1)}K`;
    } else {
      return value.toFixed(0);
    }
  };

  // Create a hierarchical structure from the abstracts array
  const createHierarchicalStructure = () => {
    const structure: Array<{
      type: "header" | "metric";
      level: number;
      text: string;
      metric?: (typeof data.metrics)[0];
    }> = [];

    // Track which headers we've already added to avoid duplicates
    const addedHeaders = new Set<string>();

    data.metrics.forEach(metric => {
      const abstracts = metric.abstracts || [];

      // Add each abstract level as a header (if not already added)
      abstracts.forEach((abstract, index) => {
        const headerKey = `${abstract}-${index}`;
        if (!addedHeaders.has(headerKey)) {
          structure.push({
            type: "header",
            level: index,
            text: abstract,
          });
          addedHeaders.add(headerKey);
        }
      });

      // Add the metric at the deepest level
      structure.push({
        type: "metric",
        level: abstracts.length,
        text: metric.normalized_label,
        metric,
      });
    });

    return structure;
  };

  const hierarchicalStructure = createHierarchicalStructure();

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Metric</TableHead>
            <TableHead className="w-[80px] text-center">Trend</TableHead>
            {sortedDates.map(date => (
              <TableHead key={date} className="text-center min-w-[100px]">
                {formatDate(date)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {hierarchicalStructure.map((item, index) => {
            if (item.type === "header") {
              return (
                <TableRow key={`header-${index}`} className="bg-muted/50">
                  <TableCell
                    className="font-semibold text-base py-3"
                    style={{ paddingLeft: `${item.level * 24 + 16}px` }}
                  >
                    {item.text}
                  </TableCell>
                  <TableCell className="text-center py-3">—</TableCell>
                  {sortedDates.map(date => (
                    <TableCell key={date} className="text-right py-3">
                      —
                    </TableCell>
                  ))}
                </TableRow>
              );
            } else {
              return (
                <TableRow key={`metric-${index}`}>
                  <TableCell
                    className="font-medium"
                    style={{ paddingLeft: `${item.level * 24 + 16}px` }}
                  >
                    {item.text}
                    {item.metric?.axis && (
                      <span className="text-sm text-muted-foreground ml-2">
                        ({item.metric.axis})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.metric && (
                      <MiniTrendChart
                        data={item.metric.data}
                        onClick={() =>
                          item.metric && handleChartClick(item.metric)
                        }
                      />
                    )}
                  </TableCell>
                  {sortedDates.map(date => {
                    const dataPoint = item.metric?.data.find(
                      d => d.date === date
                    );
                    const value = dataPoint ? dataPoint.value : 0;
                    return (
                      <TableCell key={date} className="text-right">
                        {formatValue(value)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            }
          })}
        </TableBody>
      </Table>

      <Dialog open={!!selectedMetric} onOpenChange={handleCloseDialog}>
        <DialogContent className="!max-w-[95vw] w-full">
          <DialogHeader>
            <DialogTitle>
              {selectedMetric?.metric}
              {selectedMetric?.axis && ` (${selectedMetric.axis})`}
            </DialogTitle>
          </DialogHeader>
          <div className="h-[600px]">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-lg">Loading chart...</div>
              </div>
            ) : chartData ? (
              <FinancialChart
                data={chartData}
                selectedSeries={selectedSeries}
                onSeriesChange={setSelectedSeries}
                showGrowthLine={showGrowthLine}
                onGrowthLineToggle={setShowGrowthLine}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
