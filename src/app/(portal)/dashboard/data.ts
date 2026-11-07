// src/app/dashboard/data.ts
import { db } from "@/lib/db";

export async function getDashboardData() {
  // ۱. دوره فعال وام
  const currentPeriod = await db.loanPeriod.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const periodId = currentPeriod?.id;

  // تاریخ ۷ روز قبل برای درخواست‌های جدید هفته
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // ۲. اجرای کوئری‌های آماری دوره فعلی
  const [
    activeApplicantsCount,
    newThisWeekCount,
    emergencyCount,
    topQueue,
    allApplications,
  ] = await Promise.all([
    // تعداد در صف
    periodId
      ? db.loanApplication.count({
          where: { periodId, status: "queued" },
        })
      : 0,

    // درخواست‌های جدید این هفته
    periodId
      ? db.loanApplication.count({
          where: { periodId, appliedAt: { gte: oneWeekAgo } },
        })
      : 0,

    // اضطراری‌های فعال
    periodId
      ? db.loanApplication.count({
          where: { periodId, isEmergency: true, status: "queued" },
        })
      : 0,

    // ۵ نفر اول صف
    periodId
      ? db.loanApplication.findMany({
          where: { periodId },
          orderBy: [{ rank: "asc" }, { score: "desc" }],
          take: 5,
          include: {
            member: {
              select: {
                fullName: true,
                employeeCode: true,
                department: true,
              },
            },
          },
        })
      : [],

    // خواندن تمام درخواست‌ها برای ساخت نمودارها
    periodId
      ? db.loanApplication.findMany({
          where: { periodId },
          select: {
            score: true,
            member: { select: { department: true } },
          },
        })
      : [],
  ]);

  // ۳. محاسبه نمودار واحدها (Department Distribution)
  const deptCounts: Record<string, number> = {};
  allApplications.forEach((app) => {
    const dept = app.member.department || "سایر";
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  const departmentData = Object.entries(deptCounts).map(([name, count]) => ({
    name,
    count,
  }));

  // ۴. محاسبه نمودار بازه‌های امتیازی (Score Distribution)
  const scoreBuckets: Record<string, number> = {
    "۰ - ۲۰": 0,
    "۲۱ - ۴۰": 0,
    "۴۱ - ۶۰": 0,
    "۶۱ - ۸۰": 0,
    "۸۱ - ۱۰۰": 0,
  };

  allApplications.forEach((app) => {
    const s = app.score;
    if (s <= 20) scoreBuckets["۰ - ۲۰"]++;
    else if (s <= 40) scoreBuckets["۲۱ - ۴۰"]++;
    else if (s <= 60) scoreBuckets["۴۱ - ۶۰"]++;
    else if (s <= 80) scoreBuckets["۶۱ - ۸۰"]++;
    else scoreBuckets["۸۱ - ۱۰۰"]++;
  });

  const scoreData = Object.entries(scoreBuckets).map(([range, count]) => ({
    range,
    count,
  }));

  // نکته مهم: فیلدهای BigInt پریسما را به Number تبدیل می‌کنیم تا به Client Component پاس داده شوند
  return {
    period: currentPeriod
      ? {
          title: currentPeriod.title,
          budget: Number(currentPeriod.allocatedBudget),
          consumed: Number(currentPeriod.consumedBudget),
        }
      : { title: "دوره‌ای یافت نشد", budget: 0, consumed: 0 },
    stats: {
      activeApplicants: activeApplicantsCount,
      newThisWeek: newThisWeekCount,
      emergency: emergencyCount,
    },
    topQueue: topQueue.map((item) => ({
      id: item.id,
      rank: item.rank,
      score: item.score,
      status: item.status,
      requestedAmount: Number(item.requestedAmount),
      member: {
        fullName: item.member.fullName,
        employeeCode: item.member.employeeCode,
        department: item.member.department || "—",
      },
    })),
    departmentData,
    scoreData,
  };
}
