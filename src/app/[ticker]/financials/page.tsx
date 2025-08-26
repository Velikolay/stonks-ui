import { FinancialsPage } from "@/components/financials/financials-page";

interface FinancialsPageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export default async function Page({ params }: FinancialsPageProps) {
  const { ticker } = await params;
  return <FinancialsPage ticker={ticker.toUpperCase()} />;
}
