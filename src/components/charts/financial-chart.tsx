"use client";

import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { FinancialData } from "@/lib/services/financial-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DimensionStack,
  PeriodLeaf,
  StackCut,
  StackSegment,
  resolveDimensionStack,
  viewForCut,
} from "./dimension-stack";

interface FinancialChartProps {
  data: FinancialData;
  selectedSeries?: string[];
  onSeriesChange?: (selectedSeries: string[]) => void;
  showGrowthLine?: boolean;
  onGrowthLineToggle?: (show: boolean) => void;
  title?: string;
  description?: string;
  availableDimensions?: string[];
  selectedDimension?: string | null;
  onDimensionChange?: (dimension: string | null) => void;
}

const GROUP_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#6366f1",
  "#84cc16",
];

const CONCEPT_COLOR = "#94a3b8";
const FRAME_SERIES = "Segment groups";

interface DisplaySeries extends StackSegment {
  color: string;
  data: Array<{
    date: string;
    value: number;
    fiscal_quarter?: number;
  }>;
}

interface LegendGroup {
  name: string;
  color: string;
  nested: boolean;
  conceptTotal: boolean;
  leaves: Array<{ name: string; color: string }>;
}

export function FinancialChart({
  data,
  selectedSeries = [],
  onSeriesChange,
  showGrowthLine = false,
  onGrowthLineToggle,
  title,
  description,
  availableDimensions = [],
  selectedDimension = null,
  onDimensionChange,
}: FinancialChartProps) {
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

  const formatAxisDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: data.granularity === "quarterly" ? "short" : undefined,
    });

  const fullStack = resolveDimensionStack(data, selectedDimension);
  const cutKey = fullStack.cuts.map(cut => cut.id).join("\n");
  const [cutChoice, setCutChoice] = useState<{
    key: string;
    id: string | null;
  }>({ key: "", id: null });
  const chosenCutId = cutChoice.key === cutKey ? cutChoice.id : null;
  const stack = viewForCut(fullStack, chosenCutId);
  const activeCutId =
    fullStack.cuts.find(cut => cut.id === chosenCutId)?.id ??
    fullStack.defaultCutId;
  const legendGroups = buildLegendGroups(stack);
  const displaySeries = toDisplaySeries(stack, legendGroups);

  const selectionMatches = selectedSeries.some(name =>
    displaySeries.some(series => series.name === name || series.group === name)
  );
  const activeSelection = selectionMatches ? selectedSeries : [];
  const hasSelection = activeSelection.length > 0;

  const isSeriesActive = (series: DisplaySeries) =>
    !hasSelection ||
    activeSelection.includes(series.name) ||
    activeSelection.includes(series.group);

  const isGroupActive = (group: LegendGroup) =>
    !hasSelection ||
    activeSelection.includes(group.name) ||
    group.leaves.some(leaf => activeSelection.includes(leaf.name));

  const labelToDate = new Map(
    stack.dates.map(date => [formatAxisDate(date), date])
  );
  const conceptNames = new Set(
    displaySeries
      .filter(series => series.conceptTotal)
      .map(series => series.name)
  );

  const visibleSeries = hasSelection
    ? displaySeries.filter(isSeriesActive)
    : displaySeries;
  const growthData = calculateGrowthRates(
    stack.dates,
    visibleSeries,
    data.granularity
  );

  const isSingleSeries = displaySeries.length === 1;
  const frameColors: string[] = [];
  const frames = buildFrames(stack, legendGroups, isGroupActive, frameColors);

  const option: Record<string, unknown> = {
    color: displaySeries.map(series => series.color),
    grid: {
      left: 12,
      right: 12,
      top: 16,
      bottom: 8,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: stack.dates.map(formatAxisDate),
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
        params: Array<{ axisValue?: string }> | { axisValue?: string }
      ) => {
        const list = Array.isArray(params) ? params : [params];
        const label = list[0]?.axisValue;
        if (!label) return "";
        const date = labelToDate.get(label);
        if (!date) return "";
        return renderTooltip({
          label,
          leaves: stack.periods[date] ?? [],
          groups: legendGroups,
          conceptNames,
          dimension: selectedDimension,
          formatValue,
          growth: growthForLabel(growthData, label, formatAxisDate),
          activeSelection,
        });
      },
    },
    legend: { show: false },
    series: [
      ...displaySeries.map(series => {
        const active = isSeriesActive(series);
        const seriesData = stack.dates.map(date => {
          const point = series.data.find(item => item.date === date);
          const hasValue = !!point && point.value !== 0;
          const seriesWithData = !isSingleSeries
            ? displaySeries.filter(candidate => {
                const candidatePoint = candidate.data.find(
                  item => item.date === date
                );
                return !!candidatePoint && candidatePoint.value !== 0;
              })
            : [];
          const topSeries =
            seriesWithData.length > 0
              ? seriesWithData[seriesWithData.length - 1]
              : null;
          const shouldRound =
            isSingleSeries || (hasValue && topSeries?.name === series.name);
          const isNegative = (point?.value || 0) < 0;
          const borderRadius = shouldRound
            ? isNegative
              ? [0, 0, 4, 4]
              : [4, 4, 0, 0]
            : [0, 0, 0, 0];

          return {
            value: point?.value || 0,
            itemStyle: { borderRadius },
          };
        });

        return {
          name: series.name,
          type: "bar",
          stack: isSingleSeries ? undefined : "total",
          data: seriesData,
          itemStyle: {
            color: series.color,
            opacity: active ? 1 : 0.28,
          },
          emphasis: {
            itemStyle: {
              opacity: active ? 0.85 : 0.4,
            },
          },
        };
      }),
      ...(frames.length > 0
        ? [
            {
              name: FRAME_SERIES,
              type: "custom",
              silent: true,
              z: 5,
              tooltip: { show: false },
              renderItem: (
                _params: unknown,
                api: {
                  value: (dim: number) => number;
                  coord: (data: number[]) => number[];
                  barLayout: (opt: { count: number }) => Array<{
                    offset: number;
                    width: number;
                  }>;
                }
              ) => {
                const categoryIndex = api.value(0);
                const y0 = api.value(1);
                const y1 = api.value(2);
                const color = frameColors[api.value(3)] ?? "#64748b";
                const active = api.value(4) === 1;
                const layout = api.barLayout({ count: 1 })?.[0];
                if (!layout) return;
                const bottom = api.coord([categoryIndex, y0]);
                const top = api.coord([categoryIndex, y1]);
                const height = Math.abs(bottom[1] - top[1]);
                if (height < 2) return;
                const pad = 2;
                return {
                  type: "rect" as const,
                  shape: {
                    x: bottom[0] + layout.offset - pad,
                    y: Math.min(bottom[1], top[1]),
                    width: layout.width + pad * 2,
                    height,
                  },
                  style: {
                    fill: "transparent",
                    stroke: color,
                    lineWidth: 1.5,
                    opacity: active ? 1 : 0.25,
                  },
                };
              },
              data: frames,
            },
          ]
        : []),
      {
        name: "YoY Growth",
        type: "line",
        yAxisIndex: 1,
        data: growthData.map(point => ({
          value: point.growth,
          itemStyle: {
            color:
              point.growth !== null
                ? point.growth >= 0
                  ? "#10b981"
                  : "#ef4444"
                : "#dc2626",
          },
        })),
        lineStyle: {
          color: "#dc2626",
          width: 4,
          type: "solid",
          opacity: showGrowthLine ? 1 : 0,
        },
        smooth: 0.3,
        symbol: "circle",
        symbolSize: 5,
        itemStyle: {
          color: "#dc2626",
          borderColor: "#ffffff",
          borderWidth: 1,
          opacity: showGrowthLine ? 1 : 0,
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
        silent: !showGrowthLine,
      },
    ],
  };

  const toggleSelection = (name: string) => {
    if (!onSeriesChange) return;
    if (selectedSeries.length === 1 && selectedSeries[0] === name) {
      onSeriesChange([]);
    } else {
      onSeriesChange([name]);
    }
  };

  const chooseCut = (cutId: string, segmentName?: string) => {
    setCutChoice({ key: cutKey, id: cutId });
    if (!onSeriesChange) return;
    const sameSegment =
      cutId === activeCutId &&
      !!segmentName &&
      selectedSeries.length === 1 &&
      selectedSeries[0] === segmentName;
    if (sameSegment || !segmentName) {
      onSeriesChange([]);
      return;
    }
    onSeriesChange([segmentName]);
  };

  return (
    <div className="w-full">
      {(title ||
        description ||
        (availableDimensions && availableDimensions.length > 0)) && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {title && (
              <h3 className="text-lg font-semibold leading-none mb-1.5">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {availableDimensions && availableDimensions.length > 0 && (
            <Select
              value={selectedDimension || "all"}
              onValueChange={value => {
                if (onDimensionChange) {
                  onDimensionChange(value === "all" ? null : value);
                }
              }}
              disabled={!onDimensionChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Dimensions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-muted-foreground">
                  Dimensions
                </SelectItem>
                {availableDimensions.map(dimension => (
                  <SelectItem key={dimension} value={dimension}>
                    {dimension}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <div className="w-full h-96 mt-6">
        <ReactECharts
          option={option}
          notMerge
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
        />
      </div>
      {fullStack.cuts.length > 1 ? (
        <ExclusiveCutLegend
          cuts={fullStack.cuts}
          activeCutId={activeCutId}
          activeGroups={legendGroups}
          activeSelection={activeSelection}
          isGroupActive={isGroupActive}
          isLeafActive={name =>
            !hasSelection ||
            activeSelection.includes(name) ||
            displaySeries.some(
              series =>
                series.name === name && activeSelection.includes(series.group)
            )
          }
          onChooseCut={chooseCut}
          showGrowthLine={showGrowthLine}
          onGrowthLineToggle={onGrowthLineToggle}
        />
      ) : (
        <ChartLegend
          groups={legendGroups}
          activeSelection={activeSelection}
          isGroupActive={isGroupActive}
          isLeafActive={name =>
            !hasSelection ||
            activeSelection.includes(name) ||
            displaySeries.some(
              series =>
                series.name === name && activeSelection.includes(series.group)
            )
          }
          onToggle={toggleSelection}
          showGrowthLine={showGrowthLine}
          onGrowthLineToggle={onGrowthLineToggle}
        />
      )}
    </div>
  );
}

function buildLegendGroups(stack: { segments: StackSegment[] }): LegendGroup[] {
  const groups: LegendGroup[] = [];
  for (const segment of stack.segments) {
    const last = groups[groups.length - 1];
    if (!last || last.name !== segment.group) {
      groups.push({
        name: segment.group,
        color: "",
        nested: segment.nested,
        conceptTotal: segment.conceptTotal,
        leaves: [],
      });
    } else {
      last.nested = last.nested || segment.nested;
    }
    groups[groups.length - 1].leaves.push({ name: segment.name, color: "" });
  }

  groups.forEach((group, index) => {
    const base = group.conceptTotal ? CONCEPT_COLOR : paletteColor(index);
    group.color = base;
    const shades = group.nested
      ? familyShades(base, group.leaves.length)
      : group.leaves.map(() => base);
    group.leaves.forEach((leaf, leafIndex) => {
      leaf.color = shades[leafIndex] ?? base;
    });
  });

  return groups;
}

function toDisplaySeries(
  stack: DimensionStack,
  groups: LegendGroup[]
): DisplaySeries[] {
  const colors = new Map<string, string>();
  for (const group of groups) {
    for (const leaf of group.leaves) colors.set(leaf.name, leaf.color);
  }

  return stack.segments.map(segment => ({
    ...segment,
    color: colors.get(segment.name) ?? CONCEPT_COLOR,
    data: stack.dates.map(date => ({
      date,
      value: stack.values[date]?.[segment.name] ?? 0,
      fiscal_quarter: stack.fiscalQuarter[date],
    })),
  }));
}

function buildFrames(
  stack: DimensionStack,
  groups: LegendGroup[],
  isGroupActive: (group: LegendGroup) => boolean,
  frameColors: string[]
): number[][] {
  const groupByName = new Map(groups.map(group => [group.name, group]));
  const frames: number[][] = [];

  stack.dates.forEach((date, categoryIndex) => {
    const period = new Map(
      (stack.periods[date] ?? []).map(leaf => [leaf.name, leaf])
    );
    let cursor = 0;
    let index = 0;
    while (index < stack.segments.length) {
      const groupName = stack.segments[index].group;
      let end = index;
      let groupSum = 0;
      const nonzero: string[] = [];
      while (
        end < stack.segments.length &&
        stack.segments[end].group === groupName
      ) {
        const value = stack.values[date]?.[stack.segments[end].name] ?? 0;
        groupSum += value;
        if (value !== 0) nonzero.push(stack.segments[end].name);
        end += 1;
      }

      const framed =
        nonzero.length >= 2 &&
        nonzero.every(name => {
          const leaf = period.get(name);
          return !!leaf && leaf.nested && leaf.group === groupName;
        });
      if (framed && groupSum !== 0) {
        const legendGroup = groupByName.get(groupName);
        const color = legendGroup?.color ?? "#64748b";
        let paletteIndex = frameColors.indexOf(color);
        if (paletteIndex === -1) {
          paletteIndex = frameColors.push(color) - 1;
        }
        const active = legendGroup && isGroupActive(legendGroup) ? 1 : 0;
        frames.push([
          categoryIndex,
          cursor,
          cursor + groupSum,
          paletteIndex,
          active,
        ]);
      }

      cursor += groupSum;
      index = end;
    }
  });

  return frames;
}

function ExclusiveCutLegend({
  cuts,
  activeCutId,
  activeGroups,
  activeSelection,
  isGroupActive,
  isLeafActive,
  onChooseCut,
  showGrowthLine,
  onGrowthLineToggle,
}: {
  cuts: StackCut[];
  activeCutId: string | null;
  activeGroups: LegendGroup[];
  activeSelection: string[];
  isGroupActive: (group: LegendGroup) => boolean;
  isLeafActive: (name: string) => boolean;
  onChooseCut: (cutId: string, segmentName?: string) => void;
  showGrowthLine: boolean;
  onGrowthLineToggle?: (show: boolean) => void;
}) {
  const conceptGroups = activeGroups.filter(group => group.conceptTotal);

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3 mt-3 px-1">
      {cuts.map(cut => {
        const active = cut.id === activeCutId;
        const groups = active
          ? activeGroups.filter(group => !group.conceptTotal)
          : buildLegendGroups({
              segments: cut.segments.filter(segment => !segment.conceptTotal),
            });
        return (
          <div
            key={cut.id}
            className={cn(
              "flex max-w-xs flex-col gap-1.5 rounded-md border px-2 py-1.5",
              active
                ? "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/40"
                : "border-slate-200 dark:border-slate-700"
            )}
          >
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onChooseCut(cut.id)}
              className={cn(
                "flex items-start gap-1.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200",
                !active && "opacity-60"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border",
                  active
                    ? "border-slate-800 bg-slate-800 dark:border-slate-100 dark:bg-slate-100"
                    : "border-slate-400 bg-transparent"
                )}
              />
              <span>{cut.label}</span>
            </button>
            <div
              className={cn(
                "flex flex-col gap-1 pl-4",
                !active && "opacity-60"
              )}
            >
              {groups.map(group => (
                <CutGroupButtons
                  key={group.name}
                  group={group}
                  activeSelection={activeSelection}
                  groupActive={!active || isGroupActive(group)}
                  isLeafActive={name => !active || isLeafActive(name)}
                  onToggle={name => onChooseCut(cut.id, name)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {conceptGroups.map(group => {
        const leaf = group.leaves[0];
        if (!leaf || !activeCutId) return null;
        return (
          <LegendButton
            key={leaf.name}
            label={leaf.name}
            color={leaf.color}
            active={isLeafActive(leaf.name)}
            selected={activeSelection.includes(leaf.name)}
            onClick={() => onChooseCut(activeCutId, leaf.name)}
          />
        );
      })}
      {onGrowthLineToggle && (
        <LegendButton
          label="YoY Growth"
          color="#dc2626"
          active={showGrowthLine}
          selected={showGrowthLine}
          onClick={() => onGrowthLineToggle(!showGrowthLine)}
          swatch="line"
        />
      )}
    </div>
  );
}

function CutGroupButtons({
  group,
  activeSelection,
  groupActive,
  isLeafActive,
  onToggle,
}: {
  group: LegendGroup;
  activeSelection: string[];
  groupActive: boolean;
  isLeafActive: (name: string) => boolean;
  onToggle: (name: string) => void;
}) {
  if (!group.nested) {
    const leaf = group.leaves[0];
    if (!leaf) return null;
    return (
      <LegendButton
        label={leaf.name}
        color={leaf.color}
        active={isLeafActive(leaf.name)}
        selected={activeSelection.includes(leaf.name)}
        onClick={() => onToggle(leaf.name)}
      />
    );
  }

  return (
    <div
      className="flex flex-col gap-1 border-l-2 pl-2"
      style={{ borderColor: group.color }}
    >
      <LegendButton
        label={group.name}
        color={group.color}
        active={groupActive}
        selected={activeSelection.includes(group.name)}
        emphasis
        onClick={() => onToggle(group.name)}
      />
      {group.leaves.map(leaf => (
        <LegendButton
          key={leaf.name}
          label={leaf.name}
          color={leaf.color}
          active={isLeafActive(leaf.name)}
          selected={activeSelection.includes(leaf.name)}
          nested
          onClick={() => onToggle(leaf.name)}
        />
      ))}
    </div>
  );
}

function ChartLegend({
  groups,
  activeSelection,
  isGroupActive,
  isLeafActive,
  onToggle,
  showGrowthLine,
  onGrowthLineToggle,
}: {
  groups: LegendGroup[];
  activeSelection: string[];
  isGroupActive: (group: LegendGroup) => boolean;
  isLeafActive: (name: string) => boolean;
  onToggle: (name: string) => void;
  showGrowthLine: boolean;
  onGrowthLineToggle?: (show: boolean) => void;
}) {
  if (groups.length === 0 && !onGrowthLineToggle) return null;

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3 mt-3 px-1">
      {groups.map(group => {
        const groupActive = isGroupActive(group);
        const groupSelected = activeSelection.includes(group.name);
        if (!group.nested) {
          const leaf = group.leaves[0];
          if (!leaf) return null;
          return (
            <LegendButton
              key={leaf.name}
              label={leaf.name}
              color={leaf.color}
              active={isLeafActive(leaf.name)}
              selected={activeSelection.includes(leaf.name)}
              onClick={() => onToggle(leaf.name)}
            />
          );
        }

        return (
          <div
            key={group.name}
            className="flex flex-col gap-1 border-l-2 pl-2"
            style={{ borderColor: group.color }}
          >
            <LegendButton
              label={group.name}
              color={group.color}
              active={groupActive}
              selected={groupSelected}
              emphasis
              onClick={() => onToggle(group.name)}
            />
            {group.leaves.map(leaf => (
              <LegendButton
                key={leaf.name}
                label={leaf.name}
                color={leaf.color}
                active={isLeafActive(leaf.name)}
                selected={activeSelection.includes(leaf.name)}
                nested
                onClick={() => onToggle(leaf.name)}
              />
            ))}
          </div>
        );
      })}
      {onGrowthLineToggle && (
        <LegendButton
          label="YoY Growth"
          color="#dc2626"
          active={showGrowthLine}
          selected={showGrowthLine}
          onClick={() => onGrowthLineToggle(!showGrowthLine)}
          swatch="line"
        />
      )}
    </div>
  );
}

function LegendButton({
  label,
  color,
  active,
  selected,
  nested = false,
  emphasis = false,
  swatch = "square",
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  selected: boolean;
  nested?: boolean;
  emphasis?: boolean;
  swatch?: "square" | "line";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-1.5 text-left text-xs select-none",
        emphasis
          ? "font-medium text-slate-700 dark:text-slate-200"
          : "text-slate-500 dark:text-slate-400",
        nested && "pl-1",
        !active && "opacity-40"
      )}
    >
      {swatch === "line" ? (
        <span
          className="inline-block w-3.5 h-0.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : (
        <span
          className={cn(
            "inline-block w-2.5 h-2.5 rounded-sm shrink-0",
            selected && "ring-1 ring-offset-1 ring-slate-400"
          )}
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </button>
  );
}

function renderTooltip({
  label,
  leaves,
  groups,
  conceptNames,
  dimension,
  formatValue,
  growth,
  activeSelection,
}: {
  label: string;
  leaves: PeriodLeaf[];
  groups: LegendGroup[];
  conceptNames: Set<string>;
  dimension: string | null;
  formatValue: (value: number) => string;
  growth: number | null;
  activeSelection: string[];
}): string {
  const colors = new Map<string, string>();
  const groupColors = new Map<string, string>();
  for (const group of groups) {
    groupColors.set(group.name, group.color);
    for (const leaf of group.leaves) colors.set(leaf.name, leaf.color);
  }

  const rows: Array<
    | {
        kind: "group";
        name: string;
        value: number;
        color: string;
        leaves: PeriodLeaf[];
      }
    | { kind: "leaf"; leaf: PeriodLeaf }
  > = [];

  let index = 0;
  while (index < leaves.length) {
    const leaf = leaves[index];
    if (leaf.nested) {
      const grouped = [leaf];
      let next = index + 1;
      while (
        next < leaves.length &&
        leaves[next].nested &&
        leaves[next].group === leaf.group
      ) {
        grouped.push(leaves[next]);
        next += 1;
      }
      rows.push({
        kind: "group",
        name: leaf.group,
        value: grouped.reduce((sum, item) => sum + item.value, 0),
        color: groupColors.get(leaf.group) ?? "#64748b",
        leaves: grouped,
      });
      index = next;
    } else {
      rows.push({ kind: "leaf", leaf });
      index += 1;
    }
  }

  const total = rows.reduce(
    (sum, row) => sum + (row.kind === "group" ? row.value : row.leaf.value),
    0
  );
  const unsplit =
    dimension &&
    rows.length > 0 &&
    rows.every(row => row.kind === "leaf" && conceptNames.has(row.leaf.name));

  const emphasized = (name: string, group?: string) =>
    activeSelection.length > 0 &&
    (activeSelection.includes(name) ||
      (group != null && activeSelection.includes(group)));

  let html = `<div style="padding: 8px;">
      <div style="font-weight: 600; color: #1e293b; margin-bottom: 8px;">${escapeHtml(label)}</div>`;

  if (unsplit) {
    html += `<div style="color: #64748b; margin-bottom: 6px;">No ${escapeHtml(dimension)} breakdown for this period</div>`;
  }

  for (const row of rows) {
    if (row.kind === "group") {
      html += tooltipRow({
        color: row.color,
        label: row.name,
        value: formatValue(row.value),
        share: shareLabel(row.value, total),
        strong: true,
        emphasized: emphasized(row.name),
      });
      for (const leaf of row.leaves) {
        if (leaf.value === 0) continue;
        html += tooltipRow({
          color: colors.get(leaf.name) ?? row.color,
          label: leaf.name,
          value: formatValue(leaf.value),
          indent: true,
          emphasized: emphasized(leaf.name, row.name),
        });
      }
    } else if (row.leaf.value !== 0) {
      html += tooltipRow({
        color: colors.get(row.leaf.name) ?? "#64748b",
        label: row.leaf.name,
        value: formatValue(row.leaf.value),
        share: shareLabel(row.leaf.value, total),
        emphasized: emphasized(row.leaf.name),
      });
    }
  }

  html += `
      <div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px; font-weight: 600; color: #1e293b;">
        Total: ${formatValue(total)}
      </div>`;

  if (growth !== null) {
    const growthColor = growth >= 0 ? "#10b981" : "#ef4444";
    html += `
      <div style="display: flex; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
        <span style="display: inline-block; width: 10px; height: 10px; background-color: #dc2626; margin-right: 8px; border-radius: 2px;"></span>
        <span style="color: ${growthColor}; font-weight: 600;">YoY Growth: ${growth.toFixed(1)}%</span>
      </div>`;
  }

  html += `</div>`;
  return html;
}

function tooltipRow({
  color,
  label,
  value,
  share,
  indent = false,
  strong = false,
  emphasized = false,
}: {
  color: string;
  label: string;
  value: string;
  share?: string;
  indent?: boolean;
  strong?: boolean;
  emphasized?: boolean;
}): string {
  const weight = strong || emphasized ? "600" : "400";
  return `
    <div style="display: flex; align-items: center; margin-bottom: 4px; padding-left: ${indent ? 16 : 0}px;">
      <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; margin-right: 8px; border-radius: 2px; flex-shrink: 0;"></span>
      <span style="color: #64748b; font-weight: ${weight};">${escapeHtml(label)}: ${value}${share ? ` · ${share}` : ""}</span>
    </div>`;
}

function shareLabel(value: number, total: number): string | undefined {
  if (total === 0) return undefined;
  return `${((value / total) * 100).toFixed(1)}%`;
}

function growthForLabel(
  growthData: Array<{ date: string; growth: number | null }>,
  label: string,
  formatAxisDate: (date: string) => string
): number | null {
  const point = growthData.find(item => formatAxisDate(item.date) === label);
  return point?.growth ?? null;
}

function calculateGrowthRates(
  dates: string[],
  series: DisplaySeries[],
  granularity: "yearly" | "quarterly"
): Array<{ date: string; growth: number | null }> {
  const growthData: Array<{ date: string; growth: number | null }> = [];

  for (let i = 0; i < dates.length; i++) {
    const currentDate = dates[i];
    let currentTotal = 0;
    series.forEach(item => {
      const point = item.data.find(candidate => candidate.date === currentDate);
      if (point) currentTotal += point.value;
    });

    let previousTotal = 0;
    let foundPrevious = false;

    if (granularity === "yearly") {
      if (i > 0) {
        foundPrevious = true;
        const previousDate = dates[i - 1];
        series.forEach(item => {
          const point = item.data.find(
            candidate => candidate.date === previousDate
          );
          if (point) previousTotal += point.value;
        });
      }
    } else {
      const currentQuarter = series[0]?.data.find(
        candidate => candidate.date === currentDate
      )?.fiscal_quarter;
      const currentYear = new Date(currentDate).getFullYear();

      for (let j = 0; j < i; j++) {
        const compareDate = dates[j];
        const compareYear = new Date(compareDate).getFullYear();
        const compareQuarter = series[0]?.data.find(
          candidate => candidate.date === compareDate
        )?.fiscal_quarter;
        if (
          compareYear === currentYear - 1 &&
          compareQuarter === currentQuarter &&
          currentQuarter !== undefined &&
          compareQuarter !== undefined
        ) {
          foundPrevious = true;
          series.forEach(item => {
            const point = item.data.find(
              candidate => candidate.date === compareDate
            );
            if (point) previousTotal += point.value;
          });
          break;
        }
      }
    }

    if (currentTotal === 0 && previousTotal === 0) {
      growthData.push({ date: currentDate, growth: null });
      continue;
    }

    if (foundPrevious && previousTotal !== 0) {
      const growth =
        ((currentTotal - previousTotal) / Math.abs(previousTotal)) * 100;
      const cappedGrowth = Math.max(-1000, Math.min(1000, growth));
      growthData.push({ date: currentDate, growth: cappedGrowth });
    } else {
      growthData.push({ date: currentDate, growth: null });
    }
  }

  return growthData;
}

function paletteColor(index: number): string {
  if (index < GROUP_PALETTE.length) return GROUP_PALETTE[index];
  return hslToHex((index * 47) % 360, 62, 48);
}

function familyShades(base: string, count: number): string[] {
  if (count <= 1) return [base];
  const { h, s } = hexToHsl(base);
  const saturation = Math.max(55, Math.min(78, s));
  return Array.from({ length: count }, (_, index) => {
    const lightness = 42 + (26 * index) / (count - 1);
    return hslToHex(h, saturation, lightness);
  });
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = hex.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: lightness * 100 };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return { h: hue, s: saturation * 100, l: lightness * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (h < 60) [red, green, blue] = [chroma, x, 0];
  else if (h < 120) [red, green, blue] = [x, chroma, 0];
  else if (h < 180) [red, green, blue] = [0, chroma, x];
  else if (h < 240) [red, green, blue] = [0, x, chroma];
  else if (h < 300) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  const channel = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
