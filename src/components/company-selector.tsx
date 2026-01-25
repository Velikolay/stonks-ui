"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CompaniesService,
  type CompanySearchResponse,
} from "@/lib/services/companies";

function formatCompany(company: CompanySearchResponse): string {
  return `${company.name}${company.ticker ? ` (${company.ticker})` : ""}`;
}

export interface CompanySelectorProps {
  value: CompanySearchResponse | null;
  onChange: (company: CompanySearchResponse | null) => void;

  label?: string;
  placeholder?: string;
  inputId?: string;

  includeNullOption?: boolean;
  nullOptionLabel?: string;

  /**
   * If enabled: submitting (Enter) or leaving the input while empty
   * will set the selection to null (e.g. "Global" in override pages).
   */
  emptyQuerySetsNull?: boolean;

  disabled?: boolean;
  className?: string;

  onError?: (message: string) => void;
}

export function CompanySelector({
  value,
  onChange,
  label = "Company",
  placeholder = "Search by name or ticker…",
  inputId = "company-search",
  includeNullOption = false,
  nullOptionLabel = "Clear",
  emptyQuerySetsNull = false,
  disabled = false,
  className = "",
  onError,
}: CompanySelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySearchResponse[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    return formatCompany(value);
  }, [value]);

  // Keep input text aligned with selection.
  useEffect(() => {
    setQuery(selectedLabel ?? "");
  }, [selectedLabel]);

  // Debounced search
  useEffect(() => {
    if (!open || disabled) return;
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }
    // If the input matches the selected company label, don't re-search.
    // This prevents an extra request right after selection.
    if (selectedLabel && trimmed === selectedLabel.trim()) {
      return;
    }

    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await CompaniesService.searchCompanies(trimmed, 20);
        setResults(data);
      } catch (err) {
        onError?.(
          err instanceof Error ? err.message : "Failed to search companies"
        );
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [disabled, onError, open, query, selectedLabel]);

  return (
    <div className={className}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={e => {
            if (!emptyQuerySetsNull) return;
            if (e.key !== "Enter") return;
            if (query.trim().length !== 0) return;

            e.preventDefault();
            onChange(null);
            setResults([]);
            setOpen(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // allow click selection inside dropdown
            window.setTimeout(() => {
              if (emptyQuerySetsNull && query.trim().length === 0) {
                onChange(null);
                setResults([]);
              }
              setOpen(false);
            }, 150);
          }}
        />

        {open && (query.trim().length > 0 || loading) && (
          <div className="absolute z-50 mt-2 w-full rounded-md border bg-background shadow-lg">
            <div className="p-2 border-b flex items-center justify-between gap-2">
              {includeNullOption ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    onChange(null);
                    setQuery("");
                    setOpen(false);
                  }}
                  disabled={disabled}
                >
                  {nullOptionLabel}
                </Button>
              ) : (
                <div />
              )}
              {loading && (
                <span className="text-xs text-muted-foreground">
                  Searching…
                </span>
              )}
            </div>

            <div className="max-h-64 overflow-auto">
              {results.length === 0 && !loading ? (
                <div className="p-3 text-sm text-muted-foreground">
                  No matches
                </div>
              ) : (
                results.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 focus:bg-muted/50 outline-none"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      onChange(c);
                      setQuery(formatCompany(c));
                      setOpen(false);
                    }}
                    disabled={disabled}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      id: {c.id}
                      {c.ticker ? ` • ${c.ticker}` : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
