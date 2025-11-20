"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AdminService,
  ConceptNormalizationOverride,
  StatementType,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, Plus, Pencil, Trash2 } from "lucide-react";

const STATEMENT_TYPES: StatementType[] = [
  "Income Statement",
  "Balance Sheet",
  "Cash Flow Statement",
];

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

  // Form state
  const [formData, setFormData] = useState({
    concept: "",
    statement: "Income Statement" as StatementType,
    normalized_label: "",
    is_abstract: false,
    parent_concept: "",
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
      statement: "Income Statement",
      normalized_label: "",
      is_abstract: false,
      parent_concept: "",
      description: "",
    });
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (override: ConceptNormalizationOverride) => {
    setEditingOverride(override);
    setFormData({
      concept: override.concept,
      statement: override.statement,
      normalized_label: override.normalized_label,
      is_abstract: override.is_abstract,
      parent_concept: override.parent_concept || "",
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
      await AdminService.createOverride({
        concept: formData.concept,
        statement: formData.statement,
        normalized_label: formData.normalized_label,
        is_abstract: formData.is_abstract,
        parent_concept: formData.parent_concept || null,
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
      await AdminService.updateOverride(
        editingOverride.concept,
        editingOverride.statement,
        {
          normalized_label: formData.normalized_label,
          is_abstract: formData.is_abstract,
          parent_concept: formData.parent_concept || null,
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

  const filteredOverrides = overrides;

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

          {/* Error Display */}
          {error && (
            <Card className="mb-6 border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError(null)}
                  className="mt-2"
                >
                  Dismiss
                </Button>
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
                        <TableHead className="max-w-[300px]">Concept</TableHead>
                        <TableHead>Statement</TableHead>
                        <TableHead>Normalized Label</TableHead>
                        <TableHead>Is Abstract</TableHead>
                        <TableHead className="max-w-[300px]">
                          Parent Concept
                        </TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOverrides.map((override, index) => (
                        <TableRow
                          key={`${override.concept}-${override.statement}-${index}`}
                        >
                          <TableCell className="font-mono text-xs max-w-[300px] break-words">
                            {override.concept}
                          </TableCell>
                          <TableCell>{override.statement}</TableCell>
                          <TableCell className="font-medium">
                            {override.normalized_label}
                          </TableCell>
                          <TableCell>
                            {override.is_abstract ? (
                              <span className="text-green-600 dark:text-green-400">
                                Yes
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[300px] break-words">
                            {override.parent_concept || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {override.description || (
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
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Concept Normalization Override</DialogTitle>
            <DialogDescription>
              Create a new override to map a financial concept to a normalized
              label.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-concept">Concept *</Label>
              <Input
                id="create-concept"
                value={formData.concept}
                onChange={e =>
                  setFormData({ ...formData, concept: e.target.value })
                }
                placeholder="e.g., us-gaap:Revenues"
              />
            </div>
            <div>
              <Label htmlFor="create-statement">Statement *</Label>
              <Select
                value={formData.statement}
                onValueChange={value =>
                  setFormData({
                    ...formData,
                    statement: value as StatementType,
                  })
                }
              >
                <SelectTrigger id="create-statement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATEMENT_TYPES.map(stmt => (
                    <SelectItem key={stmt} value={stmt}>
                      {stmt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-normalized-label">
                Normalized Label *
              </Label>
              <Input
                id="create-normalized-label"
                value={formData.normalized_label}
                onChange={e =>
                  setFormData({
                    ...formData,
                    normalized_label: e.target.value,
                  })
                }
                placeholder="e.g., Revenue"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="create-is-abstract"
                checked={formData.is_abstract}
                onChange={e =>
                  setFormData({ ...formData, is_abstract: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="create-is-abstract" className="cursor-pointer">
                Is Abstract
              </Label>
            </div>
            <div>
              <Label htmlFor="create-parent-concept">Parent Concept</Label>
              <Input
                id="create-parent-concept"
                value={formData.parent_concept}
                onChange={e =>
                  setFormData({ ...formData, parent_concept: e.target.value })
                }
                placeholder="e.g., us-gaap:OperatingExpenses"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must reference an existing override&apos;s (concept, statement)
                pair
              </p>
            </div>
            <div>
              <Label htmlFor="create-description">Description</Label>
              <Input
                id="create-description"
                value={formData.description}
                onChange={e =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={
                !formData.concept ||
                !formData.normalized_label ||
                !formData.statement
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Concept Normalization Override</DialogTitle>
            <DialogDescription>
              Update the override for {editingOverride?.concept} in{" "}
              {editingOverride?.statement}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Concept</Label>
              <Input value={formData.concept} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Statement</Label>
              <Input value={formData.statement} disabled className="bg-muted" />
            </div>
            <div>
              <Label htmlFor="edit-normalized-label">Normalized Label *</Label>
              <Input
                id="edit-normalized-label"
                value={formData.normalized_label}
                onChange={e =>
                  setFormData({
                    ...formData,
                    normalized_label: e.target.value,
                  })
                }
                placeholder="e.g., Revenue"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is-abstract"
                checked={formData.is_abstract}
                onChange={e =>
                  setFormData({ ...formData, is_abstract: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-is-abstract" className="cursor-pointer">
                Is Abstract
              </Label>
            </div>
            <div>
              <Label htmlFor="edit-parent-concept">Parent Concept</Label>
              <Input
                id="edit-parent-concept"
                value={formData.parent_concept}
                onChange={e =>
                  setFormData({ ...formData, parent_concept: e.target.value })
                }
                placeholder="e.g., us-gaap:OperatingExpenses"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must reference an existing override&apos;s (concept, statement)
                pair
              </p>
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={e =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!formData.normalized_label}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              is_abstract, parent_concept, description.
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
