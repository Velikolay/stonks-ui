import { ChartsPage } from "@/components/charts/charts-page";

interface ChartsPageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export default async function Page({ params }: ChartsPageProps) {
  const { ticker } = await params;
  return <ChartsPage ticker={ticker.toUpperCase()} />;
}
