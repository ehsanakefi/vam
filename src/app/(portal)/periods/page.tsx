// src/app/periods/page.tsx
import { db } from "@/lib/db";
import PeriodsView from "./PeriodsView";

export default async function PeriodsPage() {
  const periodsData = await db.loanPeriod.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  // مپ کردن فیلدها و تبدیل BigInt / DateTime
  const periods = periodsData.map((p) => {
    const startShamsi = new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
    }).format(p.startDate);

    const endShamsi = new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
    }).format(p.endDate);

    return {
      id: p.id,
      title: p.title,
      budget: Number(p.allocatedBudget),
      consumed: Number(p.consumedBudget),
      active: p.isActive,
      startDate: startShamsi,
      endDate: endShamsi,
    };
  });

  return <PeriodsView initialPeriods={periods} />;
}
