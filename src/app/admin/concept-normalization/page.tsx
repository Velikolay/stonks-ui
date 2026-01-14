"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AdminService,
  ConceptNormalizationOverride,
  ImportSummary,
} from "@/lib/services/admin";
import { StatementType, STATEMENT_TYPES } from "@/lib/services/protocol";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  Upload,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  X,
} from "lucide-react";
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

type SortableColumn =
  | "concept"
  | "statement"
  | "normalized_label"
  | "is_abstract"
  | "parent_concept"
  | "abstract_concept"
  | "weight"
  | "unit"
  | "description"
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

export default function ConceptNormalizationPage() {
  const [overrides, setOverrides] = useState<ConceptNormalizationOverride[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statementFilter, setStatementFilter] = useState<StatementType | "all">(
    "all"
  );
  const [editingOverride, setEditingOverride] =
    useState<ConceptNormalizationOverride | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<ConceptNormalizationOverride | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [refreshConcurrent, setRefreshConcurrent] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<OverrideFormData>({
    concept: "",
    statement: "Income Statement" as StatementType,
    normalized_label: "",
    is_abstract: false,
    parent_concept: "",
    abstract_concept: "",
    weight: "1" as WeightOption,
    unit: "usd" as UnitOption,
    description: "",
  });

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AdminService.listOverrides(
        statementFilter === "all" ? undefined : statementFilter
      );
      setOverrides(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch overrides"
      );
    } finally {
      setLoading(false);
    }
  }, [statementFilter]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const handleCreate = () => {
    setFormData({
      concept: "",
      statement: "Income Statement" as StatementType,
      normalized_label: "",
      is_abstract: false,
      parent_concept: "",
      abstract_concept: "",
      weight: "1" as WeightOption,
      unit: "usd" as UnitOption,
      description: "",
    });
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (override: ConceptNormalizationOverride) => {
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

  const handleDelete = (override: ConceptNormalizationOverride) => {
    setDeleteTarget(override);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateSubmit = async () => {
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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await AdminService.deleteOverride(
        deleteTarget.concept,
        deleteTarget.statement
      );
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
      const blob = await AdminService.exportOverrides(
        statementFilter === "all" ? undefined : statementFilter
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `concept-normalization-overrides${
        statementFilter !== "all"
          ? `-${statementFilter.replace(/\s+/g, "-")}`
          : ""
      }.csv`;
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
      const result = await AdminService.importOverrides(
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
      await AdminService.refreshFinancials(refreshConcurrent);
      setRefreshSuccess(
        `Financials refreshed successfully (${refreshConcurrent ? "concurrent" : "synchronous"} mode)`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh financials"
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSortValue = (
    override: ConceptNormalizationOverride,
    column: typeof sortColumn
  ): string | number | Date | null => {
    if (!column) return null;
    switch (column) {
      case "concept":
        return override.concept.toLowerCase();
      case "statement":
        return override.statement.toLowerCase();
      case "normalized_label":
        return override.normalized_label.toLowerCase();
      case "is_abstract":
        return override.is_abstract ? 1 : 0;
      case "parent_concept":
        return (override.parent_concept || "").toLowerCase();
      case "abstract_concept":
        return (override.abstract_concept || "").toLowerCase();
      case "weight":
        return override.weight ?? null;
      case "unit":
        return (override.unit || "").toLowerCase();
      case "description":
        return (override.description || "").toLowerCase();
      case "updated_at":
        return override.updated_at
          ? new Date(override.updated_at).getTime()
          : 0;
      default:
        return null;
    }
  };

  const sortedOverrides = [...overrides].sort((a, b) => {
    if (!sortColumn) return 0;
    const aValue = getSortValue(a, sortColumn);
    const bValue = getSortValue(b, sortColumn);

    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const filteredOverrides = sortedOverrides;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Concept Normalization
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-400">
                  Manage concept normalization overrides
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
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="statement-filter">Statement Type</Label>
                  <Select
                    value={statementFilter}
                    onValueChange={value =>
                      setStatementFilter(value as StatementType | "all")
                    }
                  >
                    <SelectTrigger id="statement-filter">
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
                <div className="flex items-center gap-2 border-l pl-4 ml-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="refresh-concurrent"
                      checked={refreshConcurrent}
                      onChange={e => setRefreshConcurrent(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label
                      htmlFor="refresh-concurrent"
                      className="cursor-pointer"
                    >
                      Concurrent
                    </Label>
                  </div>
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
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Overrides</CardTitle>
              <CardDescription>
                {filteredOverrides.length} override
                {filteredOverrides.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-lg">Loading...</div>
                </div>
              ) : filteredOverrides.length === 0 ? (
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
                          column="concept"
                          label="Concept"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[300px]"
                        />
                        <SortableTableHead
                          column="statement"
                          label="Statement"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="normalized_label"
                          label="Normalized Label"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="is_abstract"
                          label="Is Abstract"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="parent_concept"
                          label="Parent Concept"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[300px]"
                        />
                        <SortableTableHead
                          column="abstract_concept"
                          label="Abstract Concept"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[300px]"
                        />
                        <SortableTableHead
                          column="weight"
                          label="Weight"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="text-right"
                        />
                        <SortableTableHead
                          column="unit"
                          label="Unit"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="description"
                          label="Description"
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
                      {filteredOverrides.map((override, index) => (
                        <TableRow
                          key={`${override.concept}-${override.statement}-${index}`}
                        >
                          <TableCell className="font-mono text-xs max-w-[300px] break-words whitespace-normal">
                            {override.concept}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {override.statement}
                          </TableCell>
                          <TableCell className="font-medium whitespace-normal break-words">
                            {override.normalized_label}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {override.is_abstract ? (
                              <span className="text-green-600 dark:text-green-400">
                                Yes
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[300px] break-words whitespace-normal">
                            {override.parent_concept || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[300px] break-words whitespace-normal">
                            {override.abstract_concept || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-normal">
                            {override.weight === null ||
                            override.weight === undefined ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              override.weight
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[140px] break-words whitespace-normal">
                            {override.unit || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs break-words whitespace-normal">
                            {override.description || (
                              <span className="text-muted-foreground">—</span>
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
        title="Create Concept Normalization Override"
        description="Create a new override to map a financial concept to a normalized label."
        onSubmit={handleCreateSubmit}
        onCancel={() => setIsCreateDialogOpen(false)}
        submitLabel="Create"
        submitDisabled={
          !formData.concept || !formData.normalized_label || !formData.statement
        }
        formData={formData}
        setFormData={setFormData}
      />

      {/* Edit Dialog */}
      <OverrideDialogComponent
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        mode="edit"
        title="Edit Concept Normalization Override"
        description={`Update the override for ${editingOverride?.concept} in ${editingOverride?.statement}.`}
        onSubmit={handleEditSubmit}
        onCancel={() => setIsEditDialogOpen(false)}
        submitLabel="Save Changes"
        submitDisabled={!formData.normalized_label}
        formData={formData}
        setFormData={setFormData}
      />

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Override</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the override for{" "}
              <span className="font-mono">{deleteTarget?.concept}</span> in{" "}
              {deleteTarget?.statement}? This action cannot be undone.
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
              Upload a CSV file to import concept normalization overrides. The
              CSV should have headers: concept, statement, normalized_label,
              is_abstract, parent_concept, abstract_concept, weight, unit,
              description.
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
                      {importResult.errors.map((error, idx) => (
                        <li key={idx}>
                          Row {error.row}: {error.message}
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
