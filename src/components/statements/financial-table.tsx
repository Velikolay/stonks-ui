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
import { FinancialChart } from "../charts/financial-chart";

interface FinancialTableProps {
  data: StatementData | null;
  loading: boolean;
  debug?: boolean;
}

export function FinancialTable({
  data,
  loading,
  debug = false,
}: FinancialTableProps) {
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
  const [collapsedAbstracts, setCollapsedAbstracts] = useState<Set<string>>(
    new Set()
  );

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
      return value.toFixed(2);
    }
  };

  // Create a hierarchical structure from the abstracts array
  const createHierarchicalStructure = () => {
    const structure: Array<{
      type: "header" | "metric";
      level: number;
      text: string;
      metric?: (typeof data.metrics)[0];
      abstractId?: string;
      parentAbstractId?: string;
      concept?: string;
    }> = [];

    // Define tree node type
    type TreeNode = {
      children: Map<string, TreeNode>;
      metrics: Array<(typeof data.metrics)[0]>;
      concept?: string;
    };

    // Build a tree structure to avoid duplicate headers
    const tree = new Map<string, TreeNode>();

    // Build the tree structure
    data.metrics.forEach(metric => {
      const abstracts = metric.abstracts || [];

      // Navigate to the deepest level and add the metric
      let current = tree;
      for (let i = 0; i < abstracts.length; i++) {
        const segment = abstracts[i];
        if (!current.has(segment)) {
          current.set(segment, {
            concept: metric.abstract_concepts?.[i],
            metrics: [],
            children: new Map(),
          });
        }
        current = current.get(segment)!.children;
      }

      // Add metric to the deepest level
      if (current.has("__metrics__")) {
        current.get("__metrics__")!.metrics.push(metric);
      } else {
        current.set("__metrics__", {
          metrics: [metric],
          children: new Map(),
        });
      }
    });

    // Flatten the tree structure into a flat array
    const flattenTree = (
      node: Map<string, TreeNode>,
      level: number = 0,
      parentAbstractId?: string
    ) => {
      for (const [key, value] of node) {
        if (key === "__metrics__") {
          // Add all metrics at this level
          value.metrics.forEach((metric: (typeof data.metrics)[0]) => {
            structure.push({
              type: "metric",
              level: level,
              text: metric.normalized_label,
              metric,
              parentAbstractId,
              concept: metric.concept,
            });
          });
        } else {
          const abstractId = `${parentAbstractId ? parentAbstractId + "|" : ""}${key}`;

          // Add header for this level
          structure.push({
            type: "header",
            level: level,
            text: key,
            abstractId,
            parentAbstractId,
            concept: value.concept,
          });

          // Recursively process children
          flattenTree(value.children, level + 1, abstractId);
        }
      }
    };

    flattenTree(tree);
    return structure;
  };

  const hierarchicalStructure = createHierarchicalStructure();

  // Handle abstract collapse/expand
  const toggleAbstract = (abstractId: string) => {
    setCollapsedAbstracts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(abstractId)) {
        newSet.delete(abstractId);
      } else {
        newSet.add(abstractId);
      }
      return newSet;
    });
  };

  // Check if an item should be visible (not collapsed)
  const isItemVisible = (item: (typeof hierarchicalStructure)[0]) => {
    if (item.type === "metric") {
      // Check if any parent abstract is collapsed
      let currentParentId = item.parentAbstractId;
      while (currentParentId) {
        if (collapsedAbstracts.has(currentParentId)) {
          return false;
        }
        // Find the parent's parent
        const parentItem = hierarchicalStructure.find(
          h => h.abstractId === currentParentId
        );
        currentParentId = parentItem?.parentAbstractId;
      }
      return true;
    }
    return true; // Headers are always visible
  };

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
          {hierarchicalStructure.filter(isItemVisible).map((item, index) => {
            if (item.type === "header") {
              return (
                <TableRow key={`header-${index}`} className="bg-muted/50">
                  <TableCell
                    className="font-semibold text-base py-3 whitespace-normal cursor-pointer hover:bg-muted/70"
                    style={{
                      paddingLeft: `${item.level * 24 + 16}px`,
                      position: "relative",
                      zIndex: 1,
                    }}
                    colSpan={sortedDates.length + 2}
                    onClick={() =>
                      item.abstractId && toggleAbstract(item.abstractId)
                    }
                  >
                    <div
                      style={{ maxWidth: "300px", wordWrap: "break-word" }}
                      className="flex items-center gap-2"
                    >
                      <span
                        className={`text-sm transition-transform ${collapsedAbstracts.has(item.abstractId || "") ? "rotate-0" : "rotate-90"}`}
                      >
                        ▶
                      </span>
                      <div className="flex flex-col">
                        <span>{item.text}</span>
                        {debug && item.concept && (
                          <span className="text-xs text-muted-foreground/60 font-normal mt-0.5">
                            {item.concept}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            } else {
              return (
                <TableRow key={`metric-${index}`}>
                  <TableCell
                    className="font-medium"
                    style={{ paddingLeft: `${item.level * 24 + 16}px` }}
                  >
                    <div
                      className="flex flex-col"
                      style={{ maxWidth: "300px", wordWrap: "break-word" }}
                    >
                      <div>
                        {item.text}
                        {item.metric?.axis && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({item.metric.axis})
                          </span>
                        )}
                      </div>
                      {debug && item.concept && (
                        <span className="text-xs text-muted-foreground/60 font-normal mt-0.5">
                          {item.concept}
                        </span>
                      )}
                    </div>
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
