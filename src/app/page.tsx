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
import Link from "next/link";

// This function demonstrates SSR - it will run on the server
async function getServerTime() {
  // Simulate some server-side processing
  await new Promise(resolve => setTimeout(resolve, 100));
  return new Date().toLocaleString();
}

export default async function Home() {
  // This data is fetched on the server and will be included in the initial HTML
  const serverTime = await getServerTime();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Stonks UI
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              A modern Next.js app with shadcn/ui components and SSR
            </p>
          </div>

          {/* Main Content */}
          <div className="grid gap-8 md:grid-cols-2">
            {/* Server-Side Rendering Demo */}
            <Card>
              <CardHeader>
                <CardTitle>Server-Side Rendering</CardTitle>
                <CardDescription>
                  This content is rendered on the server and includes
                  server-fetched data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Server Time:
                  </p>
                  <p className="font-mono text-lg">{serverTime}</p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This timestamp was generated on the server during build time
                  or request time, demonstrating Next.js SSR capabilities.
                </p>
              </CardContent>
            </Card>

            {/* Interactive Components Demo */}
            <Card>
              <CardHeader>
                <CardTitle>Interactive Components</CardTitle>
                <CardDescription>
                  Built with shadcn/ui components and TypeScript
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1">Sign In</Button>
                  <Button variant="outline" className="flex-1">
                    Sign Up
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features Grid */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 text-center">
              Features
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Next.js 15</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Latest Next.js with App Router, Server Components, and
                    optimized performance.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">TypeScript</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Full TypeScript support with strict type checking and
                    IntelliSense.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">shadcn/ui</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Beautiful, accessible components built with Radix UI and
                    Tailwind CSS.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Financials Demo */}
          <div className="mt-12">
            <Card>
              <CardHeader>
                <CardTitle>Financial Data Demo</CardTitle>
                <CardDescription>
                  View financial metrics and charts for any stock ticker
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Link href="/AAPL/financials">
                    <Button>View AAPL Financials</Button>
                  </Link>
                  <Link href="/MSFT/financials">
                    <Button variant="outline">View MSFT Financials</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <footer className="mt-16 text-center text-slate-600 dark:text-slate-400">
            <p className="text-sm">
              Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
