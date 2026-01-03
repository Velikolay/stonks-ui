"use client";

import React from "react";
import ReactECharts from "echarts-for-react";
import { FinancialDataPoint } from "@/lib/services/financial-data";

interface MiniTrendChartProps {
  data: FinancialDataPoint[];
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function MiniTrendChart({
  data,
  onClick,
  className,
  style,
}: MiniTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`w-16 h-8 bg-muted rounded flex items-center justify-center cursor-pointer ${className || ""}`}
        onClick={onClick}
      >
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Extract dates and values
  const dates = sortedData.map(point => point.date);
  const values = sortedData.map(point => point.value);

  // Determine if trend is positive or negative
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const isPositive = lastValue >= firstValue;

  // Calculate color based on trend
  const lineColor = isPositive ? "#22c55e" : "#ef4444"; // green or red
  const areaColor = isPositive
    ? "rgba(34, 197, 94, 0.1)"
    : "rgba(239, 68, 68, 0.1)";

  const option = {
    grid: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      containLabel: false,
    },
    xAxis: {
      type: "category",
      show: false,
      data: dates,
    },
    yAxis: {
      type: "value",
      show: false,
    },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        symbol: "none",
        lineStyle: {
          color: lineColor,
          width: 2,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: areaColor,
              },
              {
                offset: 1,
                color: "rgba(0, 0, 0, 0)",
              },
            ],
          },
        },
      },
    ],
    animation: false,
  };

  return (
    <div
      className={`w-16 h-8 cursor-pointer hover:opacity-80 transition-opacity ${className || ""}`}
      onClick={onClick}
    >
      <ReactECharts
        option={option}
        style={style}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
