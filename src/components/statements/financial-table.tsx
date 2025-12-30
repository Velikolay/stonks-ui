"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StatementData,
  FinancialDataService,
  FinancialFiling,
} from "@/lib/services/financial-data";
import {
  AdminService,
  ConceptNormalizationOverride,
  StatementType,
} from "@/lib/services/admin";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FinancialChart } from "../charts/financial-chart";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import {
  ConceptNormalizationForm,
  OverrideFormData,
  WeightOption,
  UnitOption,
} from "@/components/admin/concept-normalization-form";

// Memoized placeholder constants - defined outside component to prevent recreation
const PARENT_PLACEHOLDER = "e.g., us-gaap:OperatingExpenses";
const ABSTRACT_PLACEHOLDER = "e.g., us-gaap:OperatingExpensesAbstract";

// Extract OverrideDialog as a separate component to prevent recreation
interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  title: string;
  description: string;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  submitDisabled: boolean;
  formData: OverrideFormData;
  setFormData: React.Dispatch<React.SetStateAction<OverrideFormData>>;
  error: string | null;
}

const OverrideDialogComponent = React.memo(function OverrideDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  onSubmit,
  onCancel,
  submitLabel,
  submitDisabled,
  formData,
  setFormData,
  error,
}: OverrideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">
            {error}
          </div>
        )}
        <ConceptNormalizationForm
          mode={mode}
          formData={formData}
          setFormData={setFormData}
          parentConceptPlaceholder={PARENT_PLACEHOLDER}
          abstractConceptPlaceholder={ABSTRACT_PLACEHOLDER}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

interface FinancialTableProps {
  data: StatementData | null;
  loading: boolean;
  filings?: FinancialFiling[];
  adminMode?: boolean;
  statement?: StatementType;
  showAllMetrics?: boolean;
}

export function FinancialTable({
  data,
  loading,
  filings = [],
  adminMode = false,
  statement,
  showAllMetrics = false,
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

  // Admin mode state
  const [overrides, setOverrides] = useState<ConceptNormalizationOverride[]>(
    []
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOverride, setEditingOverride] =
    useState<ConceptNormalizationOverride | null>(null);
  const [editingConcept, setEditingConcept] = useState<{
    concept: string;
    normalizedLabel: string;
  } | null>(null);
  const [formData, setFormData] = useState<OverrideFormData>({
    concept: "",
    statement: (statement || "Income Statement") as StatementType,
    normalized_label: "",
    is_abstract: false,
    parent_concept: "",
    abstract_concept: "",
    weight: "1" as WeightOption,
    unit: "usd" as UnitOption,
    description: "",
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch overrides when in admin mode
  const fetchOverrides = useCallback(async () => {
    if (!adminMode || !statement) return;
    try {
      const data = await AdminService.listOverrides(statement);
      setOverrides(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch overrides"
      );
    }
  }, [adminMode, statement]);

  useEffect(() => {
    if (adminMode && statement) {
      fetchOverrides();
    }
  }, [adminMode, statement, fetchOverrides]);

  // Check if an override exists for a concept
  const getOverrideForConcept = (
    concept: string | undefined
  ): ConceptNormalizationOverride | null => {
    if (!concept || !statement) return null;
    return (
      overrides.find(o => o.concept === concept && o.statement === statement) ||
      null
    );
  };

  // Handle create button click
  const handleCreateClick = (
    concept: string | undefined,
    normalizedLabel: string
  ) => {
    if (!concept || !statement) return;
    setEditingConcept({ concept, normalizedLabel });
    setFormData({
      concept,
      statement,
      normalized_label: normalizedLabel,
      is_abstract: false,
      parent_concept: "",
      abstract_concept: "",
      weight: "1" as WeightOption,
      unit: "usd" as UnitOption,
      description: "",
    });
    setIsCreateDialogOpen(true);
  };

  // Handle edit button click
  const handleEditClick = (override: ConceptNormalizationOverride) => {
    setEditingOverride(override);
    const isAbstract = override.is_abstract;
    setFormData({
      concept: override.concept,
      statement: override.statement,
      normalized_label: override.normalized_label,
      is_abstract: isAbstract,
      parent_concept: override.parent_concept || "",
      abstract_concept: override.abstract_concept || "",
      weight: (isAbstract
        ? "__none__"
        : override.weight === -1
          ? "-1"
          : override.weight === 1
            ? "1"
            : override.weight === null || override.weight === undefined
              ? "1"
              : "__none__") as WeightOption,
      unit: (isAbstract
        ? "__none__"
        : override.unit === "usd" || override.unit === "usdPerShare"
          ? override.unit
          : override.unit === null ||
              override.unit === undefined ||
              override.unit === ""
            ? "usd"
            : "__none__") as UnitOption,
      description: override.description || "",
    });
    setIsEditDialogOpen(true);
  };

  // Handle create submit
  const handleCreateSubmit = async () => {
    if (!editingConcept || !statement) return;
    try {
      const weight =
        formData.weight === "__none__" ? null : parseFloat(formData.weight);
      const unit = formData.unit === "__none__" ? null : formData.unit;

      await AdminService.createOverride({
        concept: formData.concept,
        statement: formData.statement,
        normalized_label: formData.normalized_label,
        is_abstract: formData.is_abstract,
        parent_concept: formData.parent_concept || null,
        abstract_concept: formData.abstract_concept || null,
        weight,
        unit,
        description: formData.description || null,
      });
      setIsCreateDialogOpen(false);
      setEditingConcept(null);
      fetchOverrides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create override"
      );
    }
  };

  // Handle edit submit
  const handleEditSubmit = async () => {
    if (!editingOverride || !statement) return;
    try {
      const weight =
        formData.weight === "__none__" ? null : parseFloat(formData.weight);
      const unit = formData.unit === "__none__" ? null : formData.unit;

      await AdminService.updateOverride(
        editingOverride.concept,
        editingOverride.statement,
        {
          normalized_label: formData.normalized_label,
          is_abstract: formData.is_abstract,
          parent_concept: formData.parent_concept || null,
          abstract_concept: formData.abstract_concept || null,
          weight,
          unit,
          description: formData.description || null,
        }
      );
      setIsEditDialogOpen(false);
      setEditingOverride(null);
      fetchOverrides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update override"
      );
    }
  };

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

  // Get all unique dates from all metrics for table headers
  // This ensures all periods are shown in column headers even if metrics are filtered
  const allDates = useMemo(() => {
    const dates = new Set<string>();
    if (data) {
      data.metrics.forEach(metric => {
        metric.data.forEach(point => {
          dates.add(point.date);
        });
      });
    }
    return dates;
  }, [data]);

  const sortedDates = useMemo(() => {
    return Array.from(allDates).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [allDates]);

  // Filter metrics based on sparseness and recency (compute before early returns)
  const filteredMetrics = useMemo(() => {
    if (!data || !data.metrics.length) {
      return [];
    }

    if (showAllMetrics) {
      return data.metrics;
    }

    const totalPeriods = sortedDates.length;
    if (totalPeriods === 0) {
      return data.metrics;
    }

    // Consider recent periods (last 3 periods or last 2 years for yearly data)
    const recentPeriodCount = data.granularity === "yearly" ? 2 : 4;
    const recentDates = sortedDates.slice(0, recentPeriodCount);
    const recentDatesSet = new Set(recentDates);

    // A metric is considered sparse if it has data in less than 30% of periods
    const sparsenessThreshold = 0.3;

    return data.metrics.filter(metric => {
      // Always include metrics that have data in at least one recent period
      const hasRecentData = metric.data.some(point =>
        recentDatesSet.has(point.date)
      );
      if (hasRecentData) {
        return true;
      }

      // For non-recent metrics, only include if they're not sparse
      const metricDates = new Set(metric.data.map(point => point.date));
      const dataCoverage = metricDates.size / totalPeriods;
      return dataCoverage >= sparsenessThreshold;
    });
  }, [data, showAllMetrics, sortedDates]);

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

  // Create a map from fiscal_period_end to public_url for quick lookup
  const filingUrlMap = new Map<string, string>();
  filings.forEach(filing => {
    if (filing.public_url && filing.fiscal_period_end) {
      filingUrlMap.set(filing.fiscal_period_end, filing.public_url);
    }
  });

  // Helper function to get filing URL for a date
  const getFilingUrl = (date: string): string | null => {
    if (filingUrlMap.has(date)) {
      return filingUrlMap.get(date) || null;
    }
    return null;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (data?.granularity === "yearly") {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
      });
    }
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

    // Build the tree structure using filtered metrics
    filteredMetrics.forEach(metric => {
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
            {sortedDates.map(date => {
              const filingUrl = getFilingUrl(date);
              return (
                <TableHead key={date} className="text-right min-w-[100px]">
                  {filingUrl ? (
                    <a
                      href={filingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      onClick={e => e.stopPropagation()}
                    >
                      {formatDate(date)}
                    </a>
                  ) : (
                    formatDate(date)
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {hierarchicalStructure.filter(isItemVisible).map((item, index) => {
            if (item.type === "header") {
              const override = item.concept
                ? getOverrideForConcept(item.concept)
                : null;
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
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-2">
                          <span>{item.text}</span>
                          {adminMode && item.concept && (
                            <div
                              className="flex items-center gap-1"
                              onClick={e => e.stopPropagation()}
                            >
                              {override ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleEditClick(override)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() =>
                                    handleCreateClick(item.concept, item.text)
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        {adminMode && item.concept && (
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
              const override = item.concept
                ? getOverrideForConcept(item.concept)
                : null;
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
                      <div className="flex items-center gap-2">
                        <div>
                          {item.text}
                          {item.metric?.axis && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({item.metric.axis})
                            </span>
                          )}
                        </div>
                        {adminMode && item.concept && (
                          <div className="flex items-center gap-1">
                            {override ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleEditClick(override)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() =>
                                  handleCreateClick(
                                    item.concept,
                                    item.metric?.normalized_label || item.text
                                  )
                                }
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {adminMode && item.concept && (
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

      {/* Create Override Dialog */}
      <OverrideDialogComponent
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        mode="create"
        title="Create Concept Normalization Override"
        description="Create a new override to map a financial concept to a normalized label."
        onSubmit={handleCreateSubmit}
        onCancel={() => {
          setIsCreateDialogOpen(false);
          setEditingConcept(null);
          setError(null);
        }}
        submitLabel="Create"
        submitDisabled={
          !formData.concept || !formData.normalized_label || !formData.statement
        }
        formData={formData}
        setFormData={setFormData}
        error={error}
      />

      {/* Edit Override Dialog */}
      <OverrideDialogComponent
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        mode="edit"
        title="Edit Concept Normalization Override"
        description={`Update the override for ${editingOverride?.concept} in ${editingOverride?.statement}.`}
        onSubmit={handleEditSubmit}
        onCancel={() => {
          setIsEditDialogOpen(false);
          setEditingOverride(null);
          setError(null);
        }}
        submitLabel="Save Changes"
        submitDisabled={!formData.normalized_label}
        formData={formData}
        setFormData={setFormData}
        error={error}
      />
    </>
  );
}
