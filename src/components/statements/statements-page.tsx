"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  FinancialDataService,
  StatementData,
  FinancialFiling,
} from "@/lib/services/financial-data";
import { FinancialTable } from "./financial-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StatementsPageProps {
  ticker: string;
}

type StatementType =
  | "Income Statement"
  | "Balance Sheet"
  | "Cash Flow Statement";
type Granularity = "yearly" | "quarterly";

// Helper functions to convert between URL-friendly values and display values
const statementToUrlValue = (statement: StatementType): string => {
  const mapping: Record<StatementType, string> = {
    "Income Statement": "income-statement",
    "Balance Sheet": "balance-sheet",
    "Cash Flow Statement": "cash-flow-statement",
  };
  return mapping[statement];
};

const urlValueToStatement = (value: string): StatementType | null => {
  const mapping: Record<string, StatementType> = {
    "income-statement": "Income Statement",
    "balance-sheet": "Balance Sheet",
    "cash-flow-statement": "Cash Flow Statement",
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

  const getInitialDebug = (): boolean => {
    return searchParams.get("debug") === "true";
  };

  const [activeTab, setActiveTab] = useState<StatementType>(
    getInitialActiveTab()
  );
  const [granularity, setGranularity] = useState<Granularity>(
    getInitialGranularity()
  );
  const [debug, setDebug] = useState<boolean>(getInitialDebug());
  const prevDebugRef = useRef<boolean>(debug);
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
  });
  const [loading, setLoading] = useState<{
    [key in StatementType]: boolean;
  }>({
    "Income Statement": false,
    "Balance Sheet": false,
    "Cash Flow Statement": false,
  });
  const [filings, setFilings] = useState<FinancialFiling[]>([]);

  const statements: StatementType[] = useMemo(
    () => ["Income Statement", "Balance Sheet", "Cash Flow Statement"],
    []
  );

  // Update URL query parameters when state changes
  // Use window.history.pushState to create history entries (back button will work)
  // This avoids triggering Next.js navigation/chunk reloads while maintaining browser history
  const updateQueryParams = useCallback(
    (
      newGranularity: Granularity,
      newActiveTab: StatementType,
      newDebug: boolean
    ) => {
      const params = new URLSearchParams(window.location.search);
      params.set("granularity", newGranularity);
      params.set("statement", statementToUrlValue(newActiveTab));
      if (newDebug) {
        params.set("debug", "true");
      } else {
        params.delete("debug");
      }

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
    const urlDebug = getInitialDebug();

    if (urlGranularity !== granularity) {
      setGranularity(urlGranularity);
    }
    if (urlActiveTab !== activeTab) {
      setActiveTab(urlActiveTab);
    }
    if (urlDebug !== debug) {
      setDebug(urlDebug);
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
      const urlDebug = getInitialDebug();

      if (urlGranularity !== granularity) {
        setGranularity(urlGranularity);
      }
      if (urlActiveTab !== activeTab) {
        setActiveTab(urlActiveTab);
      }
      if (urlDebug !== debug) {
        setDebug(urlDebug);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, activeTab, debug]);

  const fetchStatementData = useCallback(
    async (
      statement: StatementType,
      targetGranularity: Granularity,
      debugMode: boolean
    ) => {
      setLoading(prev => ({ ...prev, [statement]: true }));

      try {
        const data = await FinancialDataService.getStatementData(
          ticker,
          statement,
          targetGranularity,
          debugMode
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

  // Fetch data when component mounts or when granularity/ticker/debug changes
  // Only fetch if data doesn't exist for the current granularity
  // Note: We need to refetch when debug changes since it affects the API response
  useEffect(() => {
    const debugChanged = prevDebugRef.current !== debug;
    prevDebugRef.current = debug;

    statements.forEach(statement => {
      // Fetch if we don't have cached data, or if debug mode changed (need fresh data)
      if (statementData[statement][granularity] === null || debugChanged) {
        fetchStatementData(statement, granularity, debug);
      }
    });
    // Note: We intentionally don't include statementData in deps to avoid
    // re-running when data loads. The effect only needs to run when granularity/ticker/debug changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, ticker, debug, fetchStatementData, statements]);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Financial Statements - {ticker}
        </h1>

        {/* Granularity Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={granularity === "yearly" ? "default" : "outline"}
            onClick={() => {
              const newGranularity = "yearly";
              setGranularity(newGranularity);
              updateQueryParams(newGranularity, activeTab, debug);
            }}
          >
            Yearly
          </Button>
          <Button
            variant={granularity === "quarterly" ? "default" : "outline"}
            onClick={() => {
              const newGranularity = "quarterly";
              setGranularity(newGranularity);
              updateQueryParams(newGranularity, activeTab, debug);
            }}
          >
            Quarterly
          </Button>
        </div>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(value: string) => {
            const newActiveTab = value as StatementType;
            setActiveTab(newActiveTab);
            updateQueryParams(granularity, newActiveTab, debug);
          }}
        >
          <TabsList className="grid w-full grid-cols-3">
            {statements.map(statement => (
              <TabsTrigger key={statement} value={statement}>
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
                    debug={debug}
                    filings={filings}
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
