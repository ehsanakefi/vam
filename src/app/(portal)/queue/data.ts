// src/app/queue/data.ts
import { db } from "@/lib/db";

export async function getQueueData() {
  // ۱. پیدا کردن دوره فعال
  const activePeriod = await db.loanPeriod.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!activePeriod) {
    return { items: [], departments: [] };
  }

  // ۲. استخراج درخواست‌های دوره به همراه اطلاعات پرسنلی عضو
  const applications = await db.loanApplication.findMany({
    where: { periodId: activePeriod.id },
    orderBy: [{ rank: "asc" }, { score: "desc" }],
    include: {
      member: true, // برای دسترسی کامل به اطلاعات پرسنلی در دراور
    },
  });

  // ۳. استخراج لیست یکتای واحدها برای دراپ‌داون
  const rawDepartments = await db.member.findMany({
    where: { department: { not: null } },
    select: { department: true },
    distinct: ["department"],
  });
  const departments = rawDepartments
    .map((d) => d.department)
    .filter(Boolean) as string[];

  // ۴. تبدیل BigInt به Number/String جهت ارسال امن به Client Component
  const items = applications.map((app) => ({
    id: app.id,
    rank: app.rank,
    score: app.score,
    status: app.status,
    isEmergency: app.isEmergency,
    requestedAmount: Number(app.requestedAmount),
    approvedAmount: app.approvedAmount ? Number(app.approvedAmount) : null,
    scoreBreakdown: app.scoreBreakdown ? JSON.parse(app.scoreBreakdown) : null,
    member: {
      ...app.member,
      savingsBalance: Number(app.member.savingsBalance),
      previousLoansSum: Number(app.member.previousLoansSum),
      hireDate: app.member.hireDate.toISOString(),
      membershipDate: app.member.membershipDate.toISOString(),
    },
  }));

  return { items, departments };
}
