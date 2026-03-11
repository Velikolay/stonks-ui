"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CompanySearchResponse } from "@/lib/services/companies";
import { StatementType, STATEMENT_TYPES } from "@/lib/services/protocol";
import {
  AdminService,
  FinancialFactsOverride,
  ImportSummary,
} from "@/lib/services/admin";
import { CompanySelector } from "@/components/company-selector";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  FinancialFactsOverridesForm,
  FinancialFactsOverrideFormData,
} from "@/components/admin/financial-facts-overrides-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  formData: FinancialFactsOverrideFormData;
  setFormData: React.Dispatch<
    React.SetStateAction<FinancialFactsOverrideFormData>
  >;
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
}: OverrideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FinancialFactsOverridesForm
          mode={mode}
          formData={formData}
          setFormData={setFormData}
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

type SortableColumn =
  | "id"
  | "concept"
  | "statement"
  | "axis"
  | "member"
  | "label"
  | "form_type"
  | "from_period"
  | "to_period"
  | "to_concept"
  | "to_axis"
  | "to_member"
  | "to_member_label"
  | "to_weight"
  | "is_global"
  | "updated_at";

interface SortableTableHeadProps {
  column: SortableColumn;
  label: string;
  sortColumn: SortableColumn | null;
  sortDirection: "asc" | "desc";
  onSort: (column: SortableColumn) => void;
  className?: string;
}

function SortableTableHead({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
  className = "",
}: SortableTableHeadProps) {
  return (
    <TableHead
      className={`cursor-pointer hover:bg-muted/50 ${className}`}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-2">
        {label}
        {sortColumn === column ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
  );
}

function normalizeDateCell(value?: string | null) {
  if (!value) return null;
  // API might return date-only or datetime; show date part if possible.
  const dateOnly = value.includes("T") ? value.split("T")[0] : value;
  return dateOnly;
}

/** Renders null as — (wildcard), "" as (empty), else the value. */
function formatOptionalString(value: string | null | undefined) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (value === "") {
    return (
      <span className="text-muted-foreground italic" title="Empty string">
        (empty)
      </span>
    );
  }
  return value;
}

export default function FinancialFactsOverridesPage() {
  const [overrides, setOverrides] = useState<FinancialFactsOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState<number>(0);
  const [selectedCompany, setSelectedCompany] =
    useState<CompanySearchResponse | null>(null);

  const [statementFilter, setStatementFilter] = useState<StatementType | "all">(
    "all"
  );
  const [conceptFilter, setConceptFilter] = useState<string>("");

  const [editingOverride, setEditingOverride] =
    useState<FinancialFactsOverride | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<FinancialFactsOverride | null>(null);

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);

  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<FinancialFactsOverrideFormData>({
    concept: "",
    statement: "Income Statement" as StatementType,
    axis: "",
    member: "",
    label: "",
    form_type: "",
    from_period: "",
    to_period: "",
    to_concept: "",
    to_axis: "",
    to_member: "",
    to_member_label: "",
    to_weight: "__none__",
    dimension_wildcard_enabled: false,
  });

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AdminService.listFinancialFactsOverrides(
        companyId,
        statementFilter === "all" ? undefined : statementFilter,
        conceptFilter.trim() ? conceptFilter.trim() : undefined
      );
      setOverrides(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch overrides"
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, statementFilter, conceptFilter]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const handleCreate = () => {
    setFormData({
      concept: "",
      statement: "Income Statement" as StatementType,
      axis: "",
      member: "",
      label: "",
      form_type: "",
      from_period: "",
      to_period: "",
      to_concept: "",
      to_axis: "",
      to_member: "",
      to_member_label: "",
      to_weight: "__none__",
      dimension_wildcard_enabled: false,
    });
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (override: FinancialFactsOverride) => {
    setEditingOverride(override);
    setFormData({
      concept: override.concept,
      statement: override.statement,
      axis: override.axis || "",
      member: override.member || "",
      label: override.label || "",
      form_type: override.form_type || "",
      from_period: normalizeDateCell(override.from_period) || "",
      to_period: normalizeDateCell(override.to_period) || "",
      to_concept: override.to_concept,
      to_axis: override.to_axis || "",
      to_member: override.to_member || "",
      to_member_label: override.to_member_label || "",
      to_weight:
        override.to_weight === -1
          ? "-1"
          : override.to_weight === 1
            ? "1"
            : "__none__",
      dimension_wildcard_enabled:
        override.axis == null && override.member == null,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (override: FinancialFactsOverride) => {
    setDeleteTarget(override);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateSubmit = async () => {
    try {
      await AdminService.createFinancialFactsOverride({
        company_id: companyId,
        concept: formData.concept.trim(),
        statement: formData.statement,
        axis: formData.dimension_wildcard_enabled
          ? null
          : formData.axis.trim(),
        member: formData.dimension_wildcard_enabled
          ? null
          : formData.member.trim(),
        label: formData.label.trim() || null,
        form_type: formData.form_type.trim() || null,
        from_period: formData.from_period || null,
        to_period: formData.to_period || null,
        to_concept: formData.to_concept.trim(),
        to_axis: formData.to_axis.trim() || null,
        to_member: formData.to_member.trim() || null,
        to_member_label: formData.to_member_label.trim() || null,
        to_weight:
          formData.to_weight === "__none__"
            ? null
            : parseFloat(formData.to_weight),
      });
      setIsCreateDialogOpen(false);
      fetchOverrides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create override"
      );
    }
  };

  const handleEditSubmit = async () => {
    if (!editingOverride) return;
    try {
      await AdminService.updateFinancialFactsOverride(editingOverride.id, {
        axis: formData.dimension_wildcard_enabled
          ? null
          : formData.axis.trim(),
        member: formData.dimension_wildcard_enabled
          ? null
          : formData.member.trim(),
        label: formData.label.trim() || null,
        form_type: formData.form_type.trim() || null,
        from_period: formData.from_period || null,
        to_period: formData.to_period || null,
        to_concept: formData.to_concept.trim(),
        to_axis: formData.to_axis.trim() || null,
        to_member: formData.to_member.trim() || null,
        to_member_label: formData.to_member_label.trim() || null,
        to_weight:
          formData.to_weight === "__none__"
            ? null
            : parseFloat(formData.to_weight),
      });
      setIsEditDialogOpen(false);
      setEditingOverride(null);
      fetchOverrides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update override"
      );
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await AdminService.deleteFinancialFactsOverride(deleteTarget.id);
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchOverrides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete override"
      );
    }
  };

  const handleExport = async () => {
    try {
      const blob = await AdminService.exportFinancialFactsOverrides({
        companyId,
        statement: statementFilter === "all" ? undefined : statementFilter,
        concept: conceptFilter.trim() ? conceptFilter.trim() : undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const companyPart = companyId === 0 ? "global" : `company-${companyId}`;
      const stmtPart =
        statementFilter === "all"
          ? "all-statements"
          : statementFilter.replace(/\s+/g, "-");
      const conceptPart = conceptFilter.trim()
        ? `concept-${conceptFilter.trim().replace(/\s+/g, "-")}`
        : "all-concepts";

      a.download = `financial-facts-overrides-${companyPart}-${stmtPart}-${conceptPart}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to export overrides"
      );
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      const result = await AdminService.importFinancialFactsOverrides(
        importFile,
        updateExisting
      );
      setImportResult(result);
      fetchOverrides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import overrides"
      );
    }
  };

  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleRefreshFinancials = async () => {
    setIsRefreshing(true);
    setError(null);
    setRefreshSuccess(null);
    try {
      const companyIds = companyId === 0 ? undefined : [companyId];
      await AdminService.refreshFinancials(companyIds);
      setRefreshSuccess("Financials refreshed successfully");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh financials"
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSortValue = useCallback(
    (
      override: FinancialFactsOverride,
      column: typeof sortColumn
    ): string | number => {
      if (!column) return 0;
      switch (column) {
        case "id":
          return override.id;
        case "concept":
          return override.concept.toLowerCase();
        case "statement":
          return override.statement.toLowerCase();
        case "axis":
          return (override.axis || "").toLowerCase();
        case "member":
          return (override.member || "").toLowerCase();
        case "label":
          return (override.label || "").toLowerCase();
        case "form_type":
          return (override.form_type || "").toLowerCase();
        case "from_period":
          return normalizeDateCell(override.from_period) || "";
        case "to_period":
          return normalizeDateCell(override.to_period) || "";
        case "to_concept":
          return override.to_concept.toLowerCase();
        case "to_axis":
          return (override.to_axis || "").toLowerCase();
        case "to_member":
          return (override.to_member || "").toLowerCase();
        case "to_member_label":
          return (override.to_member_label || "").toLowerCase();
        case "to_weight":
          return override.to_weight != null ? override.to_weight : 0;
        case "is_global":
          return override.is_global ? 1 : 0;
        case "updated_at":
          return override.updated_at
            ? new Date(override.updated_at).getTime()
            : 0;
        default:
          return 0;
      }
    },
    []
  );

  const sortedOverrides = useMemo(() => {
    const copy = [...overrides];
    if (!sortColumn) return copy;
    copy.sort((a, b) => {
      const aValue = getSortValue(a, sortColumn);
      const bValue = getSortValue(b, sortColumn);
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [getSortValue, overrides, sortColumn, sortDirection]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Financial Facts Overrides
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-400">
                  Manage financial facts overrides
                </p>
              </div>
              <Link href="/admin">
                <Button variant="outline">← Back to Admin</Button>
              </Link>
            </div>
          </div>

          {/* Success Display */}
          {refreshSuccess && (
            <Card className="mb-4 border-green-500 bg-green-50 dark:bg-green-950/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    {refreshSuccess}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRefreshSuccess(null)}
                    className="h-6 w-6 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Card className="mb-4 border-destructive">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setError(null)}
                    className="h-6 w-6 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filters & Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
                {/* Filters */}
                <div className="space-y-4">
                  <CompanySelector
                    className="w-full sm:w-[320px]"
                    value={selectedCompany}
                    onChange={company => {
                      setSelectedCompany(company);
                      setCompanyId(company?.id ?? 0);
                    }}
                    includeNullOption
                    nullOptionLabel="Global"
                    emptyQuerySetsNull
                    onError={message => setError(message)}
                  />

                  <div className="w-full sm:w-[320px]">
                    <Label htmlFor="statement-filter">Statement Type</Label>
                    <Select
                      value={statementFilter}
                      onValueChange={value =>
                        setStatementFilter(value as StatementType | "all")
                      }
                    >
                      <SelectTrigger id="statement-filter" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statements</SelectItem>
                        {STATEMENT_TYPES.map(stmt => (
                          <SelectItem key={stmt} value={stmt}>
                            {stmt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-[320px]">
                    <Label htmlFor="concept-filter">Concept</Label>
                    <Input
                      id="concept-filter"
                      value={conceptFilter}
                      onChange={e => setConceptFilter(e.target.value)}
                      placeholder="Filter by concept (optional)"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      The list updates automatically when you change this filter
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 lg:justify-end">
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Override
                  </Button>
                  <Button onClick={handleExport} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button
                    onClick={() => setIsImportDialogOpen(true)}
                    variant="outline"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                  </Button>

                  <div className="w-full flex flex-wrap items-center justify-start lg:justify-end gap-2">
                    <Button
                      onClick={handleRefreshFinancials}
                      variant="outline"
                      disabled={isRefreshing}
                    >
                      <RefreshCw
                        className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                      />
                      Refresh Financials
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Overrides</CardTitle>
              <CardDescription>
                {sortedOverrides.length} override
                {sortedOverrides.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-lg">Loading...</div>
                </div>
              ) : sortedOverrides.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-lg text-muted-foreground">
                    No overrides found
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead
                          column="id"
                          label="ID"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="w-[80px]"
                        />
                        <SortableTableHead
                          column="concept"
                          label="Concept"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[280px]"
                        />
                        <SortableTableHead
                          column="statement"
                          label="Statement"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="axis"
                          label="Axis"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[260px]"
                        />
                        <SortableTableHead
                          column="member"
                          label="Member"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[260px]"
                        />
                        <SortableTableHead
                          column="label"
                          label="Label"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[220px]"
                        />
                        <SortableTableHead
                          column="form_type"
                          label="Form Type"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="from_period"
                          label="From"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="to_period"
                          label="To"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="to_concept"
                          label="To Concept"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[280px]"
                        />
                        <SortableTableHead
                          column="to_axis"
                          label="To Axis"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[260px]"
                        />
                        <SortableTableHead
                          column="to_member"
                          label="To Member"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[260px]"
                        />
                        <SortableTableHead
                          column="to_member_label"
                          label="To Member Label"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[220px]"
                        />
                        <SortableTableHead
                          column="to_weight"
                          label="To Weight"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="is_global"
                          label="Global"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="updated_at"
                          label="Updated At"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedOverrides.map(override => (
                        <TableRow key={override.id}>
                          <TableCell className="text-sm tabular-nums">
                            {override.id}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[280px] break-words whitespace-normal">
                            {override.concept}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {override.statement}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[260px] break-words whitespace-normal">
                            {formatOptionalString(override.axis)}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[260px] break-words whitespace-normal">
                            {formatOptionalString(override.member)}
                          </TableCell>
                          <TableCell className="max-w-[220px] break-words whitespace-normal">
                            {formatOptionalString(override.label)}
                          </TableCell>
                          <TableCell className="font-mono text-xs break-words whitespace-normal">
                            {override.form_type || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-normal">
                            {normalizeDateCell(override.from_period) || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-normal">
                            {normalizeDateCell(override.to_period) || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[280px] break-words whitespace-normal">
                            {override.to_concept}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[260px] break-words whitespace-normal">
                            {formatOptionalString(override.to_axis)}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[260px] break-words whitespace-normal">
                            {formatOptionalString(override.to_member)}
                          </TableCell>
                          <TableCell className="max-w-[220px] break-words whitespace-normal">
                            {formatOptionalString(override.to_member_label)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-normal">
                            {override.to_weight != null ? (
                              override.to_weight
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {override.is_global ? (
                              <span className="text-green-600 dark:text-green-400">
                                Yes
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-normal">
                            {override.updated_at ? (
                              new Date(override.updated_at).toLocaleString()
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-normal">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(override)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(override)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Dialog */}
      <OverrideDialogComponent
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        mode="create"
        title="Create Financial Facts Override"
        description="Create a new override to normalize a financial fact (concept + dimensions) into a target concept/dimension."
        onSubmit={handleCreateSubmit}
        onCancel={() => setIsCreateDialogOpen(false)}
        submitLabel="Create"
        submitDisabled={
          !formData.concept.trim() ||
          !formData.statement ||
          !formData.to_concept
        }
        formData={formData}
        setFormData={setFormData}
      />

      {/* Edit Dialog */}
      <OverrideDialogComponent
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        mode="edit"
        title="Edit Financial Facts Override"
        description={`Update the override (id=${editingOverride?.id}).`}
        onSubmit={handleEditSubmit}
        onCancel={() => setIsEditDialogOpen(false)}
        submitLabel="Save Changes"
        submitDisabled={!formData.to_concept.trim()}
        formData={formData}
        setFormData={setFormData}
      />

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Override</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete override{" "}
              <span className="font-mono">id={deleteTarget?.id}</span>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import financial fact overrides. Suggested
              headers: id (optional), company_id, statement, concept, axis,
              member, label, form_type, from_period, to_period, to_concept,
              to_axis, to_member, to_member_label, to_weight. Note:
              update_existing only applies when an id is present in the CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-file">CSV File</Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="update-existing"
                checked={updateExisting}
                onChange={e => setUpdateExisting(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="update-existing" className="cursor-pointer">
                Update existing records
              </Label>
            </div>
            {importResult && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-semibold mb-2">Import Summary:</p>
                <p>Created: {importResult.created}</p>
                <p>Updated: {importResult.updated}</p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold text-destructive">Errors:</p>
                    <ul className="list-disc list-inside text-sm">
                      {importResult.errors.map((e, idx) => (
                        <li key={idx}>
                          Row {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportFile(null);
                setImportResult(null);
              }}
            >
              Close
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
