// src/app/dashboard/page.tsx
import { getDashboardData } from "./data";
import DashboardView from "./DashboardView";

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardView data={data} />;
}
