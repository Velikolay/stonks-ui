"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AdminService,
  DimensionNormalizationOverride,
  ImportSummary,
} from "@/lib/services/admin";
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
  DimensionNormalizationForm,
  DimensionOverrideFormData,
} from "@/components/admin/dimension-normalization-form";

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
  formData: DimensionOverrideFormData;
  setFormData: React.Dispatch<React.SetStateAction<DimensionOverrideFormData>>;
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
        <DimensionNormalizationForm
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
  | "axis"
  | "member"
  | "member_label"
  | "normalized_axis_label"
  | "normalized_member_label"
  | "tags"
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

export default function DimensionNormalizationPage() {
  const [overrides, setOverrides] = useState<DimensionNormalizationOverride[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingOverride, setEditingOverride] =
    useState<DimensionNormalizationOverride | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<DimensionNormalizationOverride | null>(null);
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
  const [formData, setFormData] = useState<DimensionOverrideFormData>({
    axis: "",
    member: "",
    member_label: "",
    normalized_axis_label: "",
    normalized_member_label: "",
    tags: "",
  });

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AdminService.listDimensionOverrides();
      setOverrides(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch overrides"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const handleCreate = () => {
    setFormData({
      axis: "",
      member: "",
      member_label: "",
      normalized_axis_label: "",
      normalized_member_label: "",
      tags: "",
    });
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (override: DimensionNormalizationOverride) => {
    setEditingOverride(override);
    setFormData({
      axis: override.axis,
      member: override.member === "*" ? "" : override.member,
      member_label: override.member_label === "*" ? "" : override.member_label,
      normalized_axis_label: override.normalized_axis_label,
      normalized_member_label: override.normalized_member_label || "",
      tags: override.tags?.join(", ") || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (override: DimensionNormalizationOverride) => {
    setDeleteTarget(override);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const tags = formData.tags
        ? formData.tags
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean)
        : null;

      await AdminService.createDimensionOverride({
        axis: formData.axis,
        member: formData.member.trim() || "*",
        member_label: formData.member_label.trim() || "*",
        normalized_axis_label: formData.normalized_axis_label,
        normalized_member_label: formData.normalized_member_label || null,
        tags,
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
      const tags = formData.tags
        ? formData.tags
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean)
        : null;

      // Use original values for URL (they are the identifier and cannot be changed)
      await AdminService.updateDimensionOverride(
        editingOverride.axis,
        editingOverride.member,
        editingOverride.member_label,
        {
          normalized_axis_label: formData.normalized_axis_label,
          normalized_member_label: formData.normalized_member_label || null,
          tags,
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
      await AdminService.deleteDimensionOverride(
        deleteTarget.axis,
        deleteTarget.member,
        deleteTarget.member_label
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
      const blob = await AdminService.exportDimensionOverrides();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dimension-normalization-overrides.csv`;
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
      const result = await AdminService.importDimensionOverrides(
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
    override: DimensionNormalizationOverride,
    column: typeof sortColumn
  ): string | number | Date | null => {
    if (!column) return null;
    switch (column) {
      case "axis":
        return override.axis.toLowerCase();
      case "member":
        return override.member.toLowerCase();
      case "member_label":
        return override.member_label.toLowerCase();
      case "normalized_axis_label":
        return override.normalized_axis_label.toLowerCase();
      case "normalized_member_label":
        return (override.normalized_member_label || "").toLowerCase();
      case "tags":
        return (override.tags || []).join(",").toLowerCase();
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
                  Dimension Normalization
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-400">
                  Manage dimension normalization overrides
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
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
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
                          column="axis"
                          label="Axis"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[300px]"
                        />
                        <SortableTableHead
                          column="member"
                          label="Member"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          className="max-w-[300px]"
                        />
                        <SortableTableHead
                          column="member_label"
                          label="Member Label"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="normalized_axis_label"
                          label="Normalized Axis Label"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="normalized_member_label"
                          label="Normalized Member Label"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHead
                          column="tags"
                          label="Tags"
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
                          key={`${override.axis}-${override.member}-${override.member_label}-${index}`}
                        >
                          <TableCell className="font-mono text-xs max-w-[300px] break-words">
                            {override.axis}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[300px] break-words">
                            {override.member === "*" ? (
                              <span className="text-muted-foreground italic">
                                {override.member}
                              </span>
                            ) : (
                              override.member
                            )}
                          </TableCell>
                          <TableCell>
                            {override.member_label === "*" ? (
                              <span className="text-muted-foreground italic">
                                {override.member_label}
                              </span>
                            ) : (
                              override.member_label
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {override.normalized_axis_label}
                          </TableCell>
                          <TableCell>
                            {override.normalized_member_label || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {override.tags && override.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {override.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {override.updated_at ? (
                              new Date(override.updated_at).toLocaleString()
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
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
        title="Create Dimension Normalization Override"
        description="Create a new override to map a dimension axis and member to normalized labels."
        onSubmit={handleCreateSubmit}
        onCancel={() => setIsCreateDialogOpen(false)}
        submitLabel="Create"
        submitDisabled={!formData.axis || !formData.normalized_axis_label}
        formData={formData}
        setFormData={setFormData}
      />

      {/* Edit Dialog */}
      <OverrideDialogComponent
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        mode="edit"
        title="Edit Dimension Normalization Override"
        description={`Update the override for ${editingOverride?.axis}/${editingOverride?.member}/${editingOverride?.member_label}.`}
        onSubmit={handleEditSubmit}
        onCancel={() => setIsEditDialogOpen(false)}
        submitLabel="Save Changes"
        submitDisabled={!formData.normalized_axis_label}
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
              <span className="font-mono">
                {deleteTarget?.axis}/{deleteTarget?.member}/
                {deleteTarget?.member_label}
              </span>
              ? This action cannot be undone.
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
              Upload a CSV file to import dimension normalization overrides. The
              CSV should have headers: axis, member, member_label,
              normalized_axis_label, normalized_member_label, tags.
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
