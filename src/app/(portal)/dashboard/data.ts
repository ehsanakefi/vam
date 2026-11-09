// src/app/dashboard/data.ts
import { db } from "@/lib/db";

export async function getDashboardData(requestedPeriodId?: string) {
  // ۱. پیدا کردن دوره هدف (بر اساس آی‌دی ارسالی یا دوره فعال سیستم)
  let targetPeriod = null;

  if (requestedPeriodId) {
    targetPeriod = await db.loanPeriod.findUnique({
      where: { id: requestedPeriodId },
    });
  }

  // اگر دوره مشخص نشده بود یا در دیتابیس وجود نداشت، آخرین دوره فعال
  if (!targetPeriod) {
    targetPeriod = await db.loanPeriod.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // در صورتی که دوره فعالی هم نبود، آخرین دوره تعریف‌شده در سامانه
  if (!targetPeriod) {
    targetPeriod = await db.loanPeriod.findFirst({
      orderBy: { createdAt: "desc" },
    });
  }

  const periodId = targetPeriod?.id;

  // تاریخ ۷ روز قبل برای درخواست‌های جدید هفته اخیر
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // ۲. اجرای کوئری‌های آماری دوره انتخابی
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

    // اضطراری‌های در صف
    periodId
      ? db.loanApplication.count({
          where: { periodId, isEmergency: true, status: "queued" },
        })
      : 0,

    // ۵ نفر اول صف همین دوره
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

    // تمام درخواست‌های همین دوره برای رسم نمودارها
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
    const dept = app.member?.department || "سایر";
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
    const s = app.score ?? 0;
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

  // تبدیل مقادیر BigInt به Number برای عدم بروز خطای سریالایز در Client Components
  return {
    period: targetPeriod
      ? {
          id: targetPeriod.id,
          title: targetPeriod.title,
          isActive: targetPeriod.isActive,
          budget: Number(targetPeriod.allocatedBudget ?? 0n),
          consumed: Number(targetPeriod.consumedBudget ?? 0n),
        }
      : {
          id: "",
          title: "دوره‌ای یافت نشد",
          isActive: false,
          budget: 0,
          consumed: 0,
        },
    stats: {
      activeApplicants: activeApplicantsCount,
      newThisWeek: newThisWeekCount,
      emergency: emergencyCount,
    },
    topQueue: topQueue.map((item) => ({
      id: item.id,
      rank: item.rank ?? 0,
      score: item.score ?? 0,
      status: item.status,
      requestedAmount: Number(item.requestedAmount ?? 0n),
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
