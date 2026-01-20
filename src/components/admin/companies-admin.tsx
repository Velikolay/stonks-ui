"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminService,
  CompanyResponse,
  FilingEntityCreate,
  FilingEntityResponse,
  FilingEntityUpdate,
  TickerCreate,
  TickerResponse,
  TickerUpdate,
} from "@/lib/services/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, X } from "lucide-react";

type CompanyFormData = {
  name: string;
  industry: string;
};

type TickerFormData = {
  ticker: string;
  exchange: string;
  status: string;
};

type FilingEntityFormData = {
  registry: string;
  number: string;
  status: string;
};

function normalizeText(s: string) {
  return s.trim().toLowerCase();
}

function companyTickersText(c: CompanyResponse) {
  return c.tickers
    .map(t => `${t.ticker} ${t.exchange} ${t.status}`)
    .join(" ")
    .toLowerCase();
}

function companyFilingEntitiesText(c: CompanyResponse) {
  return c.filing_entities
    .map(fe => `${fe.registry} ${fe.number} ${fe.status}`)
    .join(" ")
    .toLowerCase();
}

export default function CompaniesAdmin() {
  const [companies, setCompanies] = useState<CompanyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null
  );
  const selectedCompany = useMemo(
    () => companies.find(c => c.id === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  );

  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyFormData>({
    name: "",
    industry: "",
  });

  const [isTickerDialogOpen, setIsTickerDialogOpen] = useState(false);
  const [tickerDialogMode, setTickerDialogMode] = useState<"create" | "edit">(
    "create"
  );
  const [editingTicker, setEditingTicker] = useState<TickerResponse | null>(
    null
  );
  const [tickerForm, setTickerForm] = useState<TickerFormData>({
    ticker: "",
    exchange: "",
    status: "",
  });

  const [isFilingEntityDialogOpen, setIsFilingEntityDialogOpen] =
    useState(false);
  const [filingEntityDialogMode, setFilingEntityDialogMode] = useState<
    "create" | "edit"
  >("create");
  const [editingFilingEntity, setEditingFilingEntity] =
    useState<FilingEntityResponse | null>(null);
  const [filingEntityForm, setFilingEntityForm] =
    useState<FilingEntityFormData>({
      registry: "",
      number: "",
      status: "",
    });

  const replaceCompany = useCallback((updated: CompanyResponse) => {
    setCompanies(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  }, []);

  const patchSelectedCompany = useCallback(
    (patch: (c: CompanyResponse) => CompanyResponse) => {
      setCompanies(prev =>
        prev.map(c => (c.id === selectedCompanyId ? patch(c) : c))
      );
    },
    [selectedCompanyId]
  );

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AdminService.listCompanies();
      setCompanies(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch companies"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const filteredCompanies = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return companies;
    return companies.filter(c => {
      const haystack =
        `${c.id} ${c.name ?? ""} ${c.industry ?? ""} ${companyTickersText(
          c
        )} ${companyFilingEntitiesText(c)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [companies, query]);

  const openManageCompany = (company: CompanyResponse) => {
    setSuccess(null);
    setError(null);
    setSelectedCompanyId(company.id);
    setCompanyForm({
      name: company.name,
      industry: company.industry || "",
    });
    setIsCompanyDialogOpen(true);
  };

  const closeManageCompany = () => {
    setIsCompanyDialogOpen(false);
    setSelectedCompanyId(null);
    setCompanyForm({ name: "", industry: "" });
    setEditingTicker(null);
    setEditingFilingEntity(null);
    setIsTickerDialogOpen(false);
    setIsFilingEntityDialogOpen(false);
  };

  const handleCompanyDialogOpenChange = (open: boolean) => {
    if (open) {
      setIsCompanyDialogOpen(true);
      return;
    }
    closeManageCompany();
  };

  const submitCompanyUpdate = async () => {
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    try {
      const updated = await AdminService.updateCompany(selectedCompany.id, {
        name: companyForm.name,
        industry: companyForm.industry.trim() ? companyForm.industry : null,
      });
      replaceCompany(updated);
      setSuccess("Company updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update company");
    }
  };

  const openCreateTicker = () => {
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    setTickerDialogMode("create");
    setEditingTicker(null);
    setTickerForm({ ticker: "", exchange: "", status: "" });
    setIsTickerDialogOpen(true);
  };

  const openEditTicker = (ticker: TickerResponse) => {
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    setTickerDialogMode("edit");
    setEditingTicker(ticker);
    setTickerForm({
      ticker: ticker.ticker,
      exchange: ticker.exchange,
      status: ticker.status,
    });
    setIsTickerDialogOpen(true);
  };

  const submitTicker = async () => {
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    try {
      if (tickerDialogMode === "create") {
        const created = await AdminService.addCompanyTicker(
          selectedCompany.id,
          {
            ticker: tickerForm.ticker,
            exchange: tickerForm.exchange,
            status: tickerForm.status,
          } satisfies TickerCreate
        );
        patchSelectedCompany(c => ({
          ...c,
          tickers: [...c.tickers, created].sort((a, b) =>
            a.ticker.localeCompare(b.ticker)
          ),
        }));
        setIsTickerDialogOpen(false);
        setSuccess("Ticker added successfully.");
        return;
      }

      if (!editingTicker) return;
      const updated = await AdminService.updateCompanyTicker(
        selectedCompany.id,
        editingTicker.id,
        {
          status: tickerForm.status,
        } satisfies TickerUpdate
      );
      patchSelectedCompany(c => ({
        ...c,
        tickers: c.tickers.map(t => (t.id === updated.id ? updated : t)),
      }));
      setIsTickerDialogOpen(false);
      setEditingTicker(null);
      setSuccess("Ticker updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save ticker");
    }
  };

  const deleteTicker = async (ticker: TickerResponse) => {
    if (!selectedCompany) return;
    const ok = window.confirm(
      `Delete ticker ${ticker.ticker} (${ticker.exchange})? This cannot be undone.`
    );
    if (!ok) return;
    setError(null);
    setSuccess(null);
    try {
      await AdminService.deleteCompanyTicker(selectedCompany.id, ticker.id);
      patchSelectedCompany(c => ({
        ...c,
        tickers: c.tickers.filter(t => t.id !== ticker.id),
      }));
      setSuccess("Ticker deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ticker");
    }
  };

  const openCreateFilingEntity = () => {
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    setFilingEntityDialogMode("create");
    setEditingFilingEntity(null);
    setFilingEntityForm({ registry: "", number: "", status: "" });
    setIsFilingEntityDialogOpen(true);
  };

  const openEditFilingEntity = (fe: FilingEntityResponse) => {
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    setFilingEntityDialogMode("edit");
    setEditingFilingEntity(fe);
    setFilingEntityForm({
      registry: fe.registry,
      number: fe.number,
      status: fe.status,
    });
    setIsFilingEntityDialogOpen(true);
  };

  const submitFilingEntity = async () => {
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    try {
      if (filingEntityDialogMode === "create") {
        const created = await AdminService.addCompanyFilingEntity(
          selectedCompany.id,
          {
            registry: filingEntityForm.registry,
            number: filingEntityForm.number,
            status: filingEntityForm.status,
          } satisfies FilingEntityCreate
        );
        patchSelectedCompany(c => ({
          ...c,
          filing_entities: [...c.filing_entities, created].sort((a, b) =>
            `${a.registry}:${a.number}`.localeCompare(
              `${b.registry}:${b.number}`
            )
          ),
        }));
        setIsFilingEntityDialogOpen(false);
        setSuccess("Filing entity added successfully.");
        return;
      }

      if (!editingFilingEntity) return;
      const updated = await AdminService.updateCompanyFilingEntity(
        selectedCompany.id,
        editingFilingEntity.id,
        {
          status: filingEntityForm.status,
        } satisfies FilingEntityUpdate
      );
      patchSelectedCompany(c => ({
        ...c,
        filing_entities: c.filing_entities.map(fe =>
          fe.id === updated.id ? updated : fe
        ),
      }));
      setIsFilingEntityDialogOpen(false);
      setEditingFilingEntity(null);
      setSuccess("Filing entity updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save filing entity"
      );
    }
  };

  const deleteFilingEntity = async (fe: FilingEntityResponse) => {
    if (!selectedCompany) return;
    const ok = window.confirm(
      `Delete filing entity ${fe.registry}:${fe.number}? This cannot be undone.`
    );
    if (!ok) return;
    setError(null);
    setSuccess(null);
    try {
      await AdminService.deleteCompanyFilingEntity(selectedCompany.id, fe.id);
      patchSelectedCompany(c => ({
        ...c,
        filing_entities: c.filing_entities.filter(x => x.id !== fe.id),
      }));
      setSuccess("Filing entity deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete filing entity"
      );
    }
  };

  const tickerDialogTitle =
    tickerDialogMode === "create" ? "Add Ticker" : "Edit Ticker";
  const filingEntityDialogTitle =
    filingEntityDialogMode === "create"
      ? "Add Filing Entity"
      : "Edit Filing Entity";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Companies
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-400">
                  Manage companies, tickers, and filing entities
                </p>
              </div>
              <Link href="/admin">
                <Button variant="outline">← Back to Admin</Button>
              </Link>
            </div>
          </div>

          {/* Success */}
          {success && (
            <Card className="mb-4 border-green-500 bg-green-50 dark:bg-green-950/20">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    {success}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSuccess(null)}
                    className="h-6 w-6 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error */}
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
              <CardTitle>Search</CardTitle>
              <CardDescription>
                Search by company name/industry, tickers, or filing entities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[240px]">
                  <Label htmlFor="company-search">Query</Label>
                  <Input
                    id="company-search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="e.g., Apple, AAPL, NASDAQ, SEC, 0000320193"
                  />
                </div>
                <Button variant="outline" onClick={fetchCompanies}>
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Companies</CardTitle>
              <CardDescription>
                {filteredCompanies.length} company
                {filteredCompanies.length !== 1 ? "ies" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-lg">Loading...</div>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-lg text-muted-foreground">
                    No companies found
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Tickers</TableHead>
                      <TableHead>Filing Entities</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="tabular-nums">{c.id}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          {c.industry ? (
                            c.industry
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.tickers.length > 0 ? (
                            c.tickers
                              .map(t => `${t.ticker}:${t.exchange}`)
                              .join(", ")
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.filing_entities.length > 0 ? (
                            c.filing_entities
                              .map(fe => `${fe.registry}:${fe.number}`)
                              .join(", ")
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openManageCompany(c)}
                          >
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Company Manage Dialog */}
      <Dialog
        open={isCompanyDialogOpen}
        onOpenChange={handleCompanyDialogOpenChange}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Company{selectedCompany ? `: ${selectedCompany.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              Edit company fields and manage tickers + filing entities.
            </DialogDescription>
          </DialogHeader>

          {!selectedCompany ? (
            <div className="text-sm text-muted-foreground">
              No company selected.
            </div>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company-name">Name</Label>
                      <Input
                        id="company-name"
                        value={companyForm.name}
                        onChange={e =>
                          setCompanyForm(prev => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-industry">Industry</Label>
                      <Input
                        id="company-industry"
                        value={companyForm.industry}
                        onChange={e =>
                          setCompanyForm(prev => ({
                            ...prev,
                            industry: e.target.value,
                          }))
                        }
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={submitCompanyUpdate}
                      disabled={!companyForm.name.trim()}
                    >
                      Save Company
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>Tickers</CardTitle>
                    </div>
                    <Button onClick={openCreateTicker}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Ticker
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedCompany.tickers.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No tickers yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticker</TableHead>
                          <TableHead>Exchange</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCompany.tickers.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="font-mono">
                              {t.ticker}
                            </TableCell>
                            <TableCell className="font-mono">
                              {t.exchange}
                            </TableCell>
                            <TableCell>{t.status}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditTicker(t)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteTicker(t)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>Filing Entities</CardTitle>
                    </div>
                    <Button onClick={openCreateFilingEntity}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Filing Entity
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedCompany.filing_entities.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No filing entities yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Registry</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCompany.filing_entities.map(fe => (
                          <TableRow key={fe.id}>
                            <TableCell className="font-mono">
                              {fe.registry}
                            </TableCell>
                            <TableCell className="font-mono">
                              {fe.number}
                            </TableCell>
                            <TableCell>{fe.status}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditFilingEntity(fe)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteFilingEntity(fe)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticker Dialog */}
      <Dialog open={isTickerDialogOpen} onOpenChange={setIsTickerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tickerDialogTitle}</DialogTitle>
            <DialogDescription>
              {tickerDialogMode === "create"
                ? "Create a new ticker for the selected company."
                : "Update ticker status."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ticker-ticker">Ticker</Label>
              <Input
                id="ticker-ticker"
                value={tickerForm.ticker}
                onChange={e =>
                  setTickerForm(prev => ({ ...prev, ticker: e.target.value }))
                }
                placeholder="e.g., AAPL"
                disabled={tickerDialogMode === "edit"}
                className={tickerDialogMode === "edit" ? "bg-muted" : ""}
              />
            </div>
            <div>
              <Label htmlFor="ticker-exchange">Exchange</Label>
              <Input
                id="ticker-exchange"
                value={tickerForm.exchange}
                onChange={e =>
                  setTickerForm(prev => ({ ...prev, exchange: e.target.value }))
                }
                placeholder="e.g., NASDAQ"
                disabled={tickerDialogMode === "edit"}
                className={tickerDialogMode === "edit" ? "bg-muted" : ""}
              />
            </div>
            <div>
              <Label htmlFor="ticker-status">Status</Label>
              <Input
                id="ticker-status"
                value={tickerForm.status}
                onChange={e =>
                  setTickerForm(prev => ({ ...prev, status: e.target.value }))
                }
                placeholder="e.g., active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTickerDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitTicker}
              disabled={
                !tickerForm.status.trim() ||
                (tickerDialogMode === "create" &&
                  (!tickerForm.ticker.trim() || !tickerForm.exchange.trim()))
              }
            >
              {tickerDialogMode === "create" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filing Entity Dialog */}
      <Dialog
        open={isFilingEntityDialogOpen}
        onOpenChange={setIsFilingEntityDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{filingEntityDialogTitle}</DialogTitle>
            <DialogDescription>
              {filingEntityDialogMode === "create"
                ? "Create a new filing entity for the selected company."
                : "Update filing entity status."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fe-registry">Registry</Label>
              <Input
                id="fe-registry"
                value={filingEntityForm.registry}
                onChange={e =>
                  setFilingEntityForm(prev => ({
                    ...prev,
                    registry: e.target.value,
                  }))
                }
                placeholder="e.g., SEC"
                disabled={filingEntityDialogMode === "edit"}
                className={filingEntityDialogMode === "edit" ? "bg-muted" : ""}
              />
            </div>
            <div>
              <Label htmlFor="fe-number">Number</Label>
              <Input
                id="fe-number"
                value={filingEntityForm.number}
                onChange={e =>
                  setFilingEntityForm(prev => ({
                    ...prev,
                    number: e.target.value,
                  }))
                }
                placeholder="e.g., 0000320193"
                disabled={filingEntityDialogMode === "edit"}
                className={filingEntityDialogMode === "edit" ? "bg-muted" : ""}
              />
            </div>
            <div>
              <Label htmlFor="fe-status">Status</Label>
              <Input
                id="fe-status"
                value={filingEntityForm.status}
                onChange={e =>
                  setFilingEntityForm(prev => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
                placeholder="e.g., active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsFilingEntityDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitFilingEntity}
              disabled={
                !filingEntityForm.status.trim() ||
                (filingEntityDialogMode === "create" &&
                  (!filingEntityForm.registry.trim() ||
                    !filingEntityForm.number.trim()))
              }
            >
              {filingEntityDialogMode === "create" ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
