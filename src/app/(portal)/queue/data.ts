// src/app/(portal)/queue/data.ts
import { db } from "@/lib/db";

export async function getQueueData(selectedPeriodId?: string) {
  // ۱. پیدا کردن دوره (یا بر اساس ID ارسالی از URL یا دوره فعال)
  let targetPeriod = null;

  if (selectedPeriodId) {
    targetPeriod = await db.loanPeriod.findUnique({
      where: { id: selectedPeriodId },
    });
  }

  if (!targetPeriod) {
    targetPeriod = await db.loanPeriod.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // اگر هیچ دوره‌ای در دیتابیس نبود
  if (!targetPeriod) {
    return { items: [], departments: [], activePeriodId: "" };
  }

  // ۲. استخراج درخواست‌های مربوط به همین دوره انتخاب‌شده
  const applications = await db.loanApplication.findMany({
    where: { periodId: targetPeriod.id },
    orderBy: [{ rank: "asc" }, { score: "desc" }],
    include: {
      member: true,
    },
  });

  const departments = Array.from(
    new Set(
      applications
        .map((app) => app.member?.department)
        .filter((d): d is string => Boolean(d)),
    ),
  );

  const items = applications.map((app) => ({
    id: app.id,
    periodId: app.periodId,
    memberId: app.memberId,
    loanType: app.loanType ?? "long_term",
    requestedAmount: Number(app.requestedAmount ?? 0n),
    approvedAmount: app.approvedAmount ? Number(app.approvedAmount) : null,
    score: app.score ?? 0,
    rank: app.rank ?? 0,
    status: app.status,
    isEmergency: app.isEmergency ?? false,
    appliedAt: app.appliedAt.toISOString(),
    hasActiveLoan: app.hasActiveLoan,
    scoreBreakdown: app.scoreBreakdown,
    member: {
      id: app.member.id,
      employeeCode: app.member.employeeCode,
      fullName: app.member.fullName,
      department: app.member.department || "تعریف نشده",
      nationalId: app.member.nationalId,
      maritalStatus: app.member.maritalStatus,
      childrenCount: app.member.childrenCount ?? 0,
      educationLevel: app.member.educationLevel,
      veteranStatus: app.member.veteranStatus,
      memberDeposit: Number(app.member.memberDeposit ?? 0n),
      employerDeposit: Number(app.member.employerDeposit ?? 0n),
      hasShortLoan: app.member.hasShortLoan,
      hasLongLoan: app.member.hasLongLoan,
    },
  }));

  return {
    items,
    departments,
    activePeriodId: targetPeriod.id,
  };
}
