// src/app/(portal)/layout.tsx
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // واکشی لیست دوره‌ها به ترتیب از جدیدترین
  const periods = await db.loanPeriod.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      isActive: true,
    },
  });

  return <AppShell periods={periods}>{children}</AppShell>;
}
