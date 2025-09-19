"use client";

import React from "react";
import { StatementData } from "@/lib/services/financial-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FinancialTableProps {
  data: StatementData | null;
  loading: boolean;
}

export function FinancialTable({ data, loading }: FinancialTableProps) {
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[300px]">Metric</TableHead>
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
  );
}
