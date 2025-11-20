"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FinancialDataService,
  StatementData,
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
  const router = useRouter();

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
  });
  const [loading, setLoading] = useState<{
    [key in StatementType]: boolean;
  }>({
    "Income Statement": false,
    "Balance Sheet": false,
    "Cash Flow Statement": false,
  });

  const statements: StatementType[] = useMemo(
    () => ["Income Statement", "Balance Sheet", "Cash Flow Statement"],
    []
  );

  // Update URL query parameters when state changes
  const updateQueryParams = useCallback(
    (newGranularity: Granularity, newActiveTab: StatementType) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("granularity", newGranularity);
      params.set("statement", statementToUrlValue(newActiveTab));
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchStatementData = useCallback(
    async (statement: StatementType, targetGranularity: Granularity) => {
      setLoading(prev => ({ ...prev, [statement]: true }));

      try {
        const data = await FinancialDataService.getStatementData(
          ticker,
          statement,
          targetGranularity
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

  // Track which statement+granularity combos we've initiated fetches for
  const fetchingRef = useRef<Set<string>>(new Set());

  // Clear fetching ref when granularity or ticker changes
  useEffect(() => {
    fetchingRef.current.clear();
  }, [granularity, ticker]);

  // Fetch data when component mounts or when granularity/ticker changes
  // Only fetch if data doesn't exist for the current granularity
  useEffect(() => {
    statements.forEach(statement => {
      const cacheKey = `${statement}-${granularity}-${ticker}`;

      // Only fetch if:
      // 1. We don't have cached data for this statement + granularity combo
      // 2. We're not currently loading it
      // 3. We haven't already initiated a fetch for this combo
      if (
        statementData[statement][granularity] === null &&
        !loading[statement] &&
        !fetchingRef.current.has(cacheKey)
      ) {
        fetchingRef.current.add(cacheKey);
        fetchStatementData(statement, granularity).finally(() => {
          // Remove from fetching set after fetch completes (success or error)
          fetchingRef.current.delete(cacheKey);
        });
      }
    });
    // Note: We intentionally don't include statementData/loading in deps to avoid
    // re-running when data loads. The effect only needs to run when granularity/ticker changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, ticker, fetchStatementData, statements]);

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
              updateQueryParams(newGranularity, activeTab);
            }}
          >
            Yearly
          </Button>
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
