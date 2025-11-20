import { Suspense } from "react";
import { StatementsPage } from "@/components/statements/statements-page";

interface StatementsPageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export default async function Page({ params }: StatementsPageProps) {
  const { ticker } = await params;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StatementsPage ticker={ticker.toUpperCase()} />
    </Suspense>
  );
}
