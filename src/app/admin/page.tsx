import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Admin Panel
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Manage system configuration and data
            </p>
          </div>

          {/* Admin Sections */}
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Concept Normalization</CardTitle>
                <CardDescription>
                  Manage concept normalization overrides for financial
                  statements. Map financial concepts to normalized labels for
                  Income Statements, Balance Sheets, and Cash Flow Statements.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/concept-normalization">
                  <Button>Manage Concept Normalization</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Navigation */}
          <div className="mt-8">
            <Link href="/">
              <Button variant="outline">← Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
