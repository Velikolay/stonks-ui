import { StatementsPage } from "@/components/statements/statements-page";

interface StatementsPageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export default async function Page({ params }: StatementsPageProps) {
  const { ticker } = await params;
  return <StatementsPage ticker={ticker.toUpperCase()} />;
}
