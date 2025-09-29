"use client";

import ReactECharts from "echarts-for-react";
import { FinancialData } from "@/lib/services/financial-data";

interface FinancialChartProps {
  data: FinancialData;
  selectedSeries?: string[];
  onSeriesChange?: (selectedSeries: string[]) => void;
  showGrowthLine?: boolean;
  onGrowthLineToggle?: (show: boolean) => void;
}

export function FinancialChart({
  data,
  selectedSeries = [],
  onSeriesChange,
  showGrowthLine = false,
  onGrowthLineToggle,
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
  // Always show all series, but apply blur to non-selected ones
  const allSeries = data.series;

  // Create consistent color mapping for all series based on original order
  const allColors = generateColors(data.series.length);
  const seriesColorMap = data.series.reduce(
    (acc, series, index) => {
      acc[series.name] = allColors[index];
      return acc;
    },
    {} as Record<string, string>
  );

  const isSingleSeries = allSeries.length === 1;
  const hasSelection = selectedSeries.length > 0;

  // Get all unique dates from all series
  const allDates = new Set<string>();
  allSeries.forEach(series => {
    series.data.forEach(point => allDates.add(point.date));
  });

  const sortedDates = Array.from(allDates).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  // Calculate YoY Growths for the currently visible series
  const calculateGrowthRates = () => {
    const growthData: Array<{ date: string; growth: number | null }> = [];

    // Determine which series to include in growth calculation
    const visibleSeries = hasSelection
      ? allSeries.filter(series => selectedSeries.includes(series.name))
      : allSeries;

    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = sortedDates[i];

      // Calculate total value for current date using only visible series
      let currentTotal = 0;
      visibleSeries.forEach(series => {
        const point = series.data.find(d => d.date === currentDate);
        if (point) {
          currentTotal += point.value;
        }
      });

      if (currentTotal === 0) {
        growthData.push({ date: currentDate, growth: null });
        continue;
      }

      // Find previous period for comparison
      let previousTotal = 0;
      let previousDate: string | null = null;

      if (data.granularity === "yearly") {
        // For yearly, compare with previous year
        if (i > 0) {
          previousDate = sortedDates[i - 1];
          visibleSeries.forEach(series => {
            const point = series.data.find(d => d.date === previousDate);
            if (point) {
              previousTotal += point.value;
            }
          });
        }
      } else {
        // For quarterly, compare with same fiscal quarter previous year (YoY)
        const currentPoint = visibleSeries[0]?.data.find(
          d => d.date === currentDate
        );
        const currentFiscalQuarter = currentPoint?.fiscal_quarter;
        const currentDateObj = new Date(currentDate);
        const currentYear = currentDateObj.getFullYear();

        // Find the same fiscal quarter in the previous year
        for (let j = 0; j < i; j++) {
          const compareDate = sortedDates[j];
          const compareDateObj = new Date(compareDate);
          const compareYear = compareDateObj.getFullYear();

          // Get fiscal quarter for comparison
          const comparePoint = visibleSeries[0]?.data.find(
            d => d.date === compareDate
          );
          const compareFiscalQuarter = comparePoint?.fiscal_quarter;

          // Check if it's the same fiscal quarter in the previous year
          if (
            compareYear === currentYear - 1 &&
            compareFiscalQuarter === currentFiscalQuarter &&
            currentFiscalQuarter !== undefined &&
            compareFiscalQuarter !== undefined
          ) {
            previousDate = compareDate;
            visibleSeries.forEach(series => {
              const point = series.data.find(d => d.date === compareDate);
              if (point) {
                previousTotal += point.value;
              }
            });
            break;
          }
        }
      }

      if (previousTotal > 0) {
        const growth = ((currentTotal - previousTotal) / previousTotal) * 100;
        growthData.push({ date: currentDate, growth });
      } else {
        growthData.push({ date: currentDate, growth: null });
      }
    }

    return growthData;
  };

  // Recalculate growth data whenever selected series change
  const growthData = calculateGrowthRates();

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
    yAxis: [
      {
        type: "value",
        position: "left",
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
      {
        type: "value",
        position: "right",
        axisLine: {
          lineStyle: {
            color: "#dc2626",
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: "#dc2626",
          fontSize: 12,
          fontWeight: "bold",
          formatter: (value: number) => `${value.toFixed(1)}%`,
        },
        splitLine: {
          show: false,
        },
      },
    ],
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

        // Find growth data for this date
        const growthPoint = growthData.find(g => {
          const dateStr = new Date(g.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: data.granularity === "quarterly" ? "short" : undefined,
          });
          return dateStr === date;
        });

        params.forEach(param => {
          const value = param.value || 0;
          total += value;

          // Skip growth line in the main series display
          if (param.seriesName !== "YoY Growth") {
            tooltipContent += `
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                  <span style="display: inline-block; width: 10px; height: 10px; background-color: ${param.color}; margin-right: 8px; border-radius: 2px;"></span>
                  <span style="color: #64748b;">${param.seriesName}: ${formatValue(value)}</span>
                </div>
              `;
          }
        });

        tooltipContent += `
            <div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px; font-weight: 600; color: #1e293b;">
              Total: ${formatValue(total)}
            </div>`;

        // Add growth information if available
        if (growthPoint && growthPoint.growth !== null) {
          const growthColor = growthPoint.growth >= 0 ? "#10b981" : "#ef4444";
          const growthLabel =
            data.granularity === "yearly" ? "YoY Growth" : "YoY Growth";
          tooltipContent += `
            <div style="display: flex; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
              <span style="display: inline-block; width: 10px; height: 10px; background-color: #dc2626; margin-right: 8px; border-radius: 2px;"></span>
              <span style="color: ${growthColor}; font-weight: 600;">${growthLabel}: ${growthPoint.growth.toFixed(1)}%</span>
            </div>`;
        }

        tooltipContent += `</div>`;

        return tooltipContent;
      },
    },
    legend: {
      data: [...data.series.map(s => s.name), "YoY Growth"],
      bottom: 0,
      textStyle: {
        color: "#64748b",
        fontSize: 12,
      },
      selected: {
        ...data.series.reduce(
          (acc, series) => {
            acc[series.name] =
              selectedSeries.length === 0 ||
              selectedSeries.includes(series.name);
            return acc;
          },
          {} as Record<string, boolean>
        ),
        "YoY Growth": showGrowthLine, // Toggleable growth line
      },
      // Disable legend click to prevent series from disappearing
      selector: false,
      selectorLabel: {
        show: false,
      },
    },
    series: [
      ...allSeries.map(series => {
        const isSelected =
          !hasSelection || selectedSeries.includes(series.name);
        const seriesData = sortedDates.map(date => {
          const point = series.data.find(d => d.date === date);
          const hasValue = point && point.value !== 0;

          // Determine if this series should have rounded corners
          // For single series, always round
          // For stacked series, round only if this is the topmost series with data at this date
          const seriesWithDataAtDate =
            !isSingleSeries && hasValue
              ? allSeries
                  .map((s, index) => ({
                    series: s,
                    point: s.data.find(d => d.date === date),
                    index,
                  }))
                  .filter(({ point }) => point && point.value !== 0)
              : [];

          const topSeries =
            seriesWithDataAtDate.length > 0
              ? seriesWithDataAtDate[seriesWithDataAtDate.length - 1].series
              : null;

          const shouldRound =
            isSingleSeries || (hasValue && topSeries?.name === series.name);

          // For negative values, round the bottom; for positive values, round the top
          const isNegative = (point?.value || 0) < 0;
          const borderRadius = shouldRound
            ? isNegative
              ? [0, 0, 4, 4] // Round bottom for negative values
              : [4, 4, 0, 0] // Round top for positive values
            : [0, 0, 0, 0];

          return {
            value: point?.value || 0,
            itemStyle: {
              borderRadius,
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
            opacity: isSelected ? 1.0 : 0.3, // Blur non-selected series
          },
          emphasis: {
            itemStyle: {
              opacity: isSelected ? 0.8 : 0.4, // Slightly less blur on hover
            },
          },
        };
      }),
      // Add growth line series (always present, but conditionally visible)
      {
        name: "YoY Growth",
        type: "line",
        yAxisIndex: 1, // Use the right y-axis for growth percentage
        data: growthData.map(g => ({
          value: g.growth,
          itemStyle: {
            color:
              g.growth !== null
                ? g.growth >= 0
                  ? "#10b981"
                  : "#ef4444"
                : "#dc2626",
          },
        })),
        lineStyle: {
          color: "#dc2626",
          width: 4,
          type: "solid",
          opacity: showGrowthLine ? 1 : 0, // Hide line when toggled off
        },
        smooth: 0.3, // Make the line smoother with a specific smoothness value
        symbol: "circle",
        symbolSize: 5,
        itemStyle: {
          color: "#dc2626",
          borderColor: "#ffffff",
          borderWidth: 1,
          opacity: showGrowthLine ? 1 : 0, // Hide symbols when toggled off
        },
        emphasis: {
          itemStyle: {
            color: "#dc2626",
            borderColor: "#ffffff",
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: "#dc2626",
            opacity: showGrowthLine ? 1 : 0,
          },
        },
        // Hide the entire series when toggled off
        silent: !showGrowthLine,
      },
    ],
  };

  const handleLegendClick = (params: { name: string }) => {
    const seriesName = params.name;

    // Handle growth line toggle
    if (seriesName === "YoY Growth" && onGrowthLineToggle) {
      onGrowthLineToggle(!showGrowthLine);
      return;
    }

    // Handle regular series selection
    if (onSeriesChange && data.series) {
      let newSelection: string[];

      if (selectedSeries.includes(seriesName)) {
        // If clicking on the currently selected series, show all (clear selection)
        newSelection = [];
      } else {
        // If clicking on a different series, select only that one (blur the rest)
        newSelection = [seriesName];
      }

      onSeriesChange(newSelection);
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
