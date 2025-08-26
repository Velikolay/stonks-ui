"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialDataService } from "@/lib/services/financial-data";

export function ApiTest() {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testMetricsEndpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await FinancialDataService.getAvailableMetrics("AAPL", "quarterly");
      setMetrics(JSON.stringify(result, null, 2));
    } catch (_err) {
      setError("Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  };

  const testDataEndpoint = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await FinancialDataService.getFinancialData("AAPL", "revenue", "quarterly");
      setData(JSON.stringify(result, null, 2));
    } catch (_err) {
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>API Test</CardTitle>
          <CardDescription>Test the financial data endpoints</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={testMetricsEndpoint} disabled={loading}>
              Test Metrics Endpoint
            </Button>
            <Button onClick={testDataEndpoint} disabled={loading}>
              Test Data Endpoint
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {loading && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-600">Loading...</p>
            </div>
          )}

          {metrics && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold mb-2">Metrics Response:</h3>
              <pre className="text-sm overflow-auto">{metrics}</pre>
            </div>
          )}

          {data && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold mb-2">Data Response:</h3>
              <pre className="text-sm overflow-auto">{data}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
