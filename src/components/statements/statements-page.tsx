"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  FinancialDataService,
  StatementData,
  FinancialFiling,
} from "@/lib/services/financial-data";
import { CompaniesService } from "@/lib/services/companies";
import { FinancialTable } from "./financial-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StatementType, STATEMENT_TYPES } from "@/lib/services/protocol";
import { isForeignUnit } from "@/lib/format-financial-amount";

interface StatementsPageProps {
  ticker: string;
}

type Granularity = "yearly" | "quarterly";

// Helper functions to convert between URL-friendly values and display values
const statementToUrlValue = (statement: StatementType): string => {
  const mapping: Record<StatementType, string> = {
    "Income Statement": "income-statement",
    "Balance Sheet": "balance-sheet",
    "Cash Flow Statement": "cash-flow-statement",
    "Comprehensive Income": "comprehensive-income",
    "Statement of Equity": "statement-of-equity",
  };
  return mapping[statement];
};

const usdInUrl = (): boolean =>
  new URLSearchParams(window.location.search).get("currency") === "usd";

const writeUsdParam = (inUsd: boolean) => {
  const params = new URLSearchParams(window.location.search);
  if (inUsd) {
    params.set("currency", "usd");
  } else {
    params.delete("currency");
  }
  const query = params.toString();
  const newUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.pushState(
    { ...window.history.state, as: newUrl, url: newUrl },
    "",
    newUrl
  );
};

const urlValueToStatement = (value: string): StatementType | null => {
  const mapping: Record<string, StatementType> = {
    "income-statement": "Income Statement",
    "balance-sheet": "Balance Sheet",
    "cash-flow-statement": "Cash Flow Statement",
    "comprehensive-income": "Comprehensive Income",
    "statement-of-equity": "Statement of Equity",
  };
  return mapping[value] || null;
};

export function StatementsPage({ ticker }: StatementsPageProps) {
  const searchParams = useSearchParams();

  // Initialize state from URL query parameters
  const getInitialGranularity = (): Granularity => {
    const granularity = searchParams.get("granularity");
    return granularity === "quarterly" || granularity === "yearly"
      ? granularity
      : "yearly";
  };

  const getInitialActiveTab = (): StatementType => {
    const statement = searchParams.get("statement");
    const parsed = statement ? urlValueToStatement(statement) : null;
    return parsed || "Income Statement";
  };

  const adminMode = searchParams.get("mode") === "admin";

  const [activeTab, setActiveTab] = useState<StatementType>(
    getInitialActiveTab()
  );
  const [granularity, setGranularity] = useState<Granularity>(
    getInitialGranularity()
  );
  // Cache data by both statement type and granularity
  const [statementData, setStatementData] = useState<{
    [key in StatementType]: {
      yearly: StatementData | null;
      quarterly: StatementData | null;
    };
  }>({
    "Income Statement": { yearly: null, quarterly: null },
    "Balance Sheet": { yearly: null, quarterly: null },
    "Cash Flow Statement": { yearly: null, quarterly: null },
    "Comprehensive Income": { yearly: null, quarterly: null },
    "Statement of Equity": { yearly: null, quarterly: null },
  });
  const [loading, setLoading] = useState<{
    [key in StatementType]: boolean;
  }>({
    "Income Statement": false,
    "Balance Sheet": false,
    "Cash Flow Statement": false,
    "Comprehensive Income": false,
    "Statement of Equity": false,
  });
  const [filings, setFilings] = useState<FinancialFiling[]>([]);
  const [companyId, setCompanyId] = useState<number>(0);
  const [showAllMetrics, setShowAllMetrics] = useState<boolean>(false);
  const [foreignIssuer, setForeignIssuer] = useState(false);
  const [displayInUsd, setDisplayInUsd] = useState(
    () => searchParams.get("currency") === "usd"
  );

  const statements: StatementType[] = useMemo(() => STATEMENT_TYPES, []);

  // Update URL query parameters when state changes
  // Use window.history.pushState to create history entries (back button will work)
  // This avoids triggering Next.js navigation/chunk reloads while maintaining browser history
  const updateQueryParams = useCallback(
    (newGranularity: Granularity, newActiveTab: StatementType) => {
      const params = new URLSearchParams(window.location.search);
      params.set("granularity", newGranularity);
      params.set("statement", statementToUrlValue(newActiveTab));

      // Use pushState to create a new history entry (back button will work)
      // This updates URL without triggering Next.js router navigation
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState(
        { ...window.history.state, as: newUrl, url: newUrl },
        "",
        newUrl
      );
    },
    []
  );

  // Sync state with URL on mount or when URL changes (but avoid infinite loops)
  useEffect(() => {
    const urlGranularity = getInitialGranularity();
    const urlActiveTab = getInitialActiveTab();

    if (urlGranularity !== granularity) {
      setGranularity(urlGranularity);
    }
    if (urlActiveTab !== activeTab) {
      setActiveTab(urlActiveTab);
    }
    const urlUsd = searchParams.get("currency") === "usd";
    if (urlUsd !== displayInUsd) {
      setDisplayInUsd(urlUsd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Listen for browser back/forward button to sync state
  useEffect(() => {
    const handlePopState = () => {
      // When user navigates with back/forward, searchParams will update
      // and the effect above will sync the state
      // Force a re-read of searchParams by triggering a state update
      const urlGranularity = getInitialGranularity();
      const urlActiveTab = getInitialActiveTab();

      if (urlGranularity !== granularity) {
        setGranularity(urlGranularity);
      }
      if (urlActiveTab !== activeTab) {
        setActiveTab(urlActiveTab);
      }
      const urlUsd = usdInUrl();
      if (urlUsd !== displayInUsd) {
        setDisplayInUsd(urlUsd);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, activeTab, displayInUsd]);

  const fetchStatementData = useCallback(
    async (
      statement: StatementType,
      targetGranularity: Granularity,
      isAdminMode: boolean,
      inUsd: boolean
    ) => {
      setLoading(prev => ({ ...prev, [statement]: true }));

      try {
        // Convert adminMode to debug parameter for the backend
        const debug = isAdminMode;
        const data = await FinancialDataService.getStatementData(
          ticker,
          statement,
          targetGranularity,
          debug,
          inUsd ? "usd" : undefined
        );
        setStatementData(prev => ({
          ...prev,
          [statement]: {
            ...prev[statement],
            [targetGranularity]: data,
          },
        }));
      } catch {
        // Silently handle error - data will remain null
        setStatementData(prev => ({
          ...prev,
          [statement]: {
            ...prev[statement],
            [targetGranularity]: null,
          },
        }));
      } finally {
        setLoading(prev => ({ ...prev, [statement]: false }));
      }
    },
    [ticker]
  );

  useEffect(() => {
    let cancelled = false;
    setForeignIssuer(false);
    setDisplayInUsd(usdInUrl());
    // Quarterly rows can be empty, so the filing currency is read from the
    // yearly income statement.
    const detectCurrency = async () => {
      try {
        const statement = await FinancialDataService.getStatementData(
          ticker,
          "Income Statement",
          "yearly"
        );
        if (cancelled) return;
        if (statement.metrics.some(metric => isForeignUnit(metric.unit))) {
          setForeignIssuer(true);
        }
      } catch {
        // A later statement response can still set the flag.
      }
    };
    detectCurrency();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Converted amounts are labeled USD, so remember a foreign filing currency
  // from whichever response still carries it.
  useEffect(() => {
    const foreign = statements.some(statement =>
      (["yearly", "quarterly"] as const).some(period => {
        const data = statementData[statement][period];
        return (
          data?.ticker === ticker &&
          data.metrics.some(metric => isForeignUnit(metric.unit))
        );
      })
    );
    if (foreign) setForeignIssuer(true);
  }, [statementData, statements, ticker]);

  // Fetch filings when component mounts or when ticker changes
  useEffect(() => {
    const fetchFilings = async () => {
      try {
        const filingsData = await FinancialDataService.getFilings(ticker);
        setFilings(filingsData);
      } catch {
        // Silently handle error - filings will remain empty
        setFilings([]);
      }
    };

    fetchFilings();
  }, [ticker]);

  // Resolve company id by ticker (used for company-level overrides)
  useEffect(() => {
    let cancelled = false;
    const fetchCompany = async () => {
      try {
        const company = await CompaniesService.getCompanyByTicker(ticker);
        if (!cancelled) {
          setCompanyId(company?.id ?? 0);
        }
      } catch {
        if (!cancelled) {
          setCompanyId(0);
        }
      }
    };
    fetchCompany();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    if (!foreignIssuer || granularity === "yearly") return;
    setGranularity("yearly");
    updateQueryParams("yearly", activeTab);
  }, [foreignIssuer, granularity, activeTab, updateQueryParams]);

  // Fetch data when component mounts or when granularity/ticker/adminMode changes
  // Only fetch if data doesn't exist for the current granularity
  // Note: We need to refetch when adminMode changes since it affects the API response
  useEffect(() => {
    statements.forEach(statement => {
      // Always fetch to ensure we have the correct data for the current adminMode
      fetchStatementData(statement, granularity, adminMode, displayInUsd);
    });
    // Note: We intentionally don't include statementData in deps to avoid
    // re-running when data loads. The effect only needs to run when granularity/ticker/adminMode changes.
  }, [
    granularity,
    ticker,
    adminMode,
    displayInUsd,
    fetchStatementData,
    statements,
  ]);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Financial Statements - {ticker}
        </h1>

        {/* Granularity Toggle and Display Options */}
        <div className="flex gap-4 items-center mb-4">
          <div className="flex gap-2">
            <Button
              variant={granularity === "yearly" ? "default" : "outline"}
              onClick={() => {
                const newGranularity = "yearly";
                setGranularity(newGranularity);
                updateQueryParams(newGranularity, activeTab);
              }}
            >
              Yearly
            </Button>
            {!foreignIssuer && (
              <Button
                variant={granularity === "quarterly" ? "default" : "outline"}
                onClick={() => {
                  const newGranularity = "quarterly";
                  setGranularity(newGranularity);
                  updateQueryParams(newGranularity, activeTab);
                }}
              >
                Quarterly
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 border-l pl-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-all-metrics"
                checked={showAllMetrics}
                onCheckedChange={setShowAllMetrics}
              />
              <Label htmlFor="show-all-metrics" className="cursor-pointer">
                Display All Metrics
              </Label>
            </div>
            {foreignIssuer && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="statements-display-in-usd"
                  checked={displayInUsd}
                  onCheckedChange={inUsd => {
                    setDisplayInUsd(inUsd);
                    writeUsdParam(inUsd);
                  }}
                />
                <Label
                  htmlFor="statements-display-in-usd"
                  className="cursor-pointer"
                >
                  USD
                </Label>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(value: string) => {
            const newActiveTab = value as StatementType;
            setActiveTab(newActiveTab);
            updateQueryParams(granularity, newActiveTab);
          }}
        >
          <TabsList className="flex w-full flex-wrap gap-2 h-auto">
            {statements.map(statement => (
              <TabsTrigger
                key={statement}
                value={statement}
                className="flex-1 min-w-[180px]"
              >
                {statement}
              </TabsTrigger>
            ))}
          </TabsList>

          {statements.map(statement => (
            <TabsContent key={statement} value={statement}>
              <Card>
                <CardHeader>
                  <CardTitle>{statement}</CardTitle>
                </CardHeader>
                <CardContent>
                  <FinancialTable
                    data={statementData[statement][granularity]}
                    loading={loading[statement]}
                    filings={filings}
                    companyId={companyId}
                    adminMode={adminMode}
                    statement={statement}
                    showAllMetrics={showAllMetrics}
                    currency={displayInUsd ? "usd" : undefined}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
