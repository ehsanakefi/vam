import { getDashboardData } from "./data";
import DashboardView from "./DashboardView"; // نام کامپوننت ویوی داشبورد شما

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ periodId?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { periodId } = await searchParams;
  const data = await getDashboardData(periodId);

  return <DashboardView data={data} />;
}
