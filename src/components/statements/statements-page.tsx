"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FinancialDataService,
  StatementData,
} from "@/lib/services/financial-data";
import { FinancialTable } from "./financial-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatementsPageProps {
  ticker: string;
}

type StatementType =
  | "Income Statement"
  | "Balance Sheet"
  | "Cash Flow Statement";
type Granularity = "yearly" | "quarterly";

export function StatementsPage({ ticker }: StatementsPageProps) {
  const [activeTab, setActiveTab] = useState<StatementType>("Income Statement");
  const [granularity, setGranularity] = useState<Granularity>("yearly");
  const [statementData, setStatementData] = useState<{
    [key in StatementType]: StatementData | null;
  }>({
    "Income Statement": null,
    "Balance Sheet": null,
    "Cash Flow Statement": null,
  });
  const [loading, setLoading] = useState<{
    [key in StatementType]: boolean;
  }>({
    "Income Statement": false,
    "Balance Sheet": false,
    "Cash Flow Statement": false,
  });

  const statements: StatementType[] = useMemo(() => [
    "Income Statement",
    "Balance Sheet",
    "Cash Flow Statement",
  ], []);

  const fetchStatementData = useCallback(
    async (statement: StatementType) => {
      setLoading(prev => ({ ...prev, [statement]: true }));

      try {
        const data = await FinancialDataService.getStatementData(
          ticker,
          statement,
          granularity
        );
        setStatementData(prev => ({ ...prev, [statement]: data }));
      } catch {
        // Silently handle error - data will remain null
        setStatementData(prev => ({ ...prev, [statement]: null }));
      } finally {
        setLoading(prev => ({ ...prev, [statement]: false }));
      }
    },
    [ticker, granularity]
  );

  // Fetch data when component mounts or when granularity changes
  useEffect(() => {
    statements.forEach(statement => {
      fetchStatementData(statement);
    });
  }, [fetchStatementData, statements]);

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
            onClick={() => setGranularity("yearly")}
          >
            Yearly
          </Button>
          <Button
            variant={granularity === "quarterly" ? "default" : "outline"}
            onClick={() => setGranularity("quarterly")}
          >
            Quarterly
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {statements.map(statement => (
            <button
              key={statement}
              onClick={() => setActiveTab(statement)}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === statement
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {statement}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <Card>
        <CardHeader>
          <CardTitle>{activeTab}</CardTitle>
        </CardHeader>
        <CardContent>
          <FinancialTable
            data={statementData[activeTab]}
            loading={loading[activeTab]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
