"use client";

import ReactECharts from "echarts-for-react";
import { FinancialData } from "@/lib/services/financial-data";

interface FinancialChartProps {
  data: FinancialData;
}

export function FinancialChart({ data }: FinancialChartProps) {
  // Format the data for the chart
  const chartData = data.data.map(point => ({
    date: point.date,
    value: point.value,
    // Format the date for display
    formattedDate: new Date(point.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: data.granularity === "quarterly" ? "short" : undefined,
    }),
  }));

  // Format the value for display in tooltip
  const formatValue = (value: number) => {
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  const option = {
    grid: {
      left: '10%',
      right: '10%',
      top: '10%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: chartData.map(item => item.formattedDate),
      axisLine: {
        lineStyle: {
          color: '#64748b'
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#64748b',
        fontSize: 12
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: '#64748b'
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#64748b',
        fontSize: 12,
        formatter: (value: number) => formatValue(value)
      },
      splitLine: {
        lineStyle: {
          color: '#e2e8f0',
          type: 'dashed'
        }
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e2e8f0',
      textStyle: {
        color: '#1e293b'
      },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const data = params[0];
        return `
          <div style="padding: 8px;">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
              ${data.name}
            </div>
            <div style="color: #64748b;">
              ${formatValue(data.value)}
            </div>
          </div>
        `;
      }
    },
    series: [
      {
        type: 'bar',
        data: chartData.map(item => item.value),
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            opacity: 0.8
          }
        }
      }
    ]
  };

  return (
    <div className="w-full h-96">
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
