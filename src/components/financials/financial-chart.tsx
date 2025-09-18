"use client";

import ReactECharts from "echarts-for-react";
import { FinancialData } from "@/lib/services/financial-data";

interface FinancialChartProps {
  data: FinancialData;
  selectedSeries?: string[];
  onSeriesChange?: (selectedSeries: string[]) => void;
}

export function FinancialChart({
  data,
  selectedSeries = [],
  onSeriesChange,
}: FinancialChartProps) {

  // Format the value for display in tooltip
  const formatValue = (value: number) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";

    if (absValue >= 1e12) {
      return `${sign}$${(absValue / 1e12).toFixed(2)}T`;
    } else if (absValue >= 1e9) {
      return `${sign}$${(absValue / 1e9).toFixed(2)}B`;
    } else if (absValue >= 1e6) {
      return `${sign}$${(absValue / 1e6).toFixed(2)}M`;
    } else if (absValue >= 1e3) {
      return `${sign}$${(absValue / 1e3).toFixed(2)}K`;
    } else {
      return `${sign}$${absValue.toFixed(2)}`;
    }
  };

  // Generate colors for series
  const generateColors = (count: number) => {
    const colors = [
      "#3b82f6",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#ec4899",
      "#6366f1",
    ];
    return colors.slice(0, count);
  };

  // Always use series-based approach - data.series is required
  const filteredSeries =
    selectedSeries.length > 0
      ? data.series.filter(s => selectedSeries.includes(s.name))
      : data.series;

  // Create consistent color mapping for all series based on original order
  const allColors = generateColors(data.series.length);
  const seriesColorMap = data.series.reduce(
    (acc, series, index) => {
      acc[series.name] = allColors[index];
      return acc;
    },
    {} as Record<string, string>
  );

  const isSingleSeries = filteredSeries.length === 1;

  // Get all unique dates from all series
  const allDates = new Set<string>();
  filteredSeries.forEach(series => {
    series.data.forEach(point => allDates.add(point.date));
  });

  const sortedDates = Array.from(allDates).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const option: Record<string, unknown> = {
    color: data.series.map(s => seriesColorMap[s.name]), // Always use all series for color array
      grid: {
        left: "10%",
        right: "10%",
        top: "10%",
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: sortedDates.map(date =>
          new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: data.granularity === "quarterly" ? "short" : undefined,
          })
        ),
        axisLine: {
          lineStyle: {
            color: "#64748b",
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: "#64748b",
          fontSize: 12,
        },
      },
      yAxis: {
        type: "value",
        axisLine: {
          lineStyle: {
            color: "#64748b",
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: "#64748b",
          fontSize: 12,
          formatter: (value: number) => formatValue(value),
        },
        splitLine: {
          lineStyle: {
            color: "#e2e8f0",
            type: "dashed",
          },
        },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderColor: "#e2e8f0",
        textStyle: {
          color: "#1e293b",
        },
        formatter: (
          params: Array<{
            seriesName: string;
            value: number;
            color: string;
            axisValue: string;
          }>
        ) => {
          const date = params[0].axisValue;
          let total = 0;
          let tooltipContent = `<div style="padding: 8px;">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 8px;">${date}</div>`;

          params.forEach(param => {
            const value = param.value || 0;
            total += value;
            tooltipContent += `
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; background-color: ${param.color}; margin-right: 8px; border-radius: 2px;"></span>
                <span style="color: #64748b;">${param.seriesName}: ${formatValue(value)}</span>
              </div>
            `;
          });

          tooltipContent += `
            <div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px; font-weight: 600; color: #1e293b;">
              Total: ${formatValue(total)}
            </div>
          </div>`;

          return tooltipContent;
        },
      },
      legend: {
        data: data.series.map(s => s.name),
        bottom: 0,
        textStyle: {
          color: "#64748b",
          fontSize: 12,
        },
        selected: data.series.reduce(
          (acc, series) => {
            acc[series.name] =
              selectedSeries.length === 0 ||
              selectedSeries.includes(series.name);
            return acc;
          },
          {} as Record<string, boolean>
        ),
        // Disable legend click to prevent series from disappearing
        selector: false,
        selectorLabel: {
          show: false,
        },
      },
      series: filteredSeries.map(series => {
        const seriesData = sortedDates.map(date => {
          const point = series.data.find(d => d.date === date);
          return {
            value: point?.value || 0,
            itemStyle: {
              // Apply rounding based on display mode
              borderRadius: isSingleSeries
                ? [4, 4, 0, 0] // Single series: rounded top
                : filteredSeries.indexOf(series) === filteredSeries.length - 1
                  ? [4, 4, 0, 0]
                  : [0, 0, 0, 0], // Stacked: only top element rounded
            },
          };
        });

        return {
          name: series.name,
          type: "bar",
          stack: isSingleSeries ? undefined : "total", // No stacking for single series
          data: seriesData,
          itemStyle: {
            color: seriesColorMap[series.name], // Explicitly set color for each series
          },
          emphasis: {
            itemStyle: {
              opacity: 0.8,
            },
          },
        };
      }),
    };

  const handleLegendClick = (params: { name: string }) => {
    if (onSeriesChange && data.series) {
      const seriesName = params.name;
      let newSelection: string[];

      if (selectedSeries.includes(seriesName)) {
        // If clicking on a selected series, remove it
        newSelection = selectedSeries.filter(name => name !== seriesName);
      } else {
        // If clicking on an unselected series, add it
        newSelection = [...selectedSeries, seriesName];
      }

      // If no series selected, show all (empty array means show all)
      onSeriesChange(newSelection.length === 0 ? [] : newSelection);
    }
  };

  return (
    <div className="w-full h-96">
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        onEvents={{
          legendselectchanged: handleLegendClick,
        }}
      />
    </div>
  );
}
