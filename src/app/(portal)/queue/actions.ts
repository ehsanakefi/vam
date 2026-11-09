// src/app/(portal)/queue/actions.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { calculateMemberScore } from "@/lib/scoring";
import { LoanType } from "@prisma/client";

const LOAN_TYPES = [LoanType.long_term, LoanType.short_term] as const;

/**
 * ایجاد درخواست پیش‌فرض برای هر دو نوع وام به ازای تمام اعضا
 * و رتبه‌بندی مجزا در دو صف مستقل
 */
export async function syncAndRecalculateQueue(periodId?: string) {
  try {
    // ۱. دریافت دوره فعال
    const activePeriod = periodId
      ? await db.loanPeriod.findFirst({
          where: { id: periodId, isActive: true },
        })
      : await db.loanPeriod.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        });

    if (!activePeriod) {
      return { success: false, message: "هیچ دوره فعالی یافت نشد." };
    }

    // ۲. خواندن تمام اعضای فعال سامانه
    const members = await db.member.findMany({
      where: { status: "active" },
    });

    if (members.length === 0) {
      return { success: false, message: "هیچ عضوی در سامانه ثبت نشده است." };
    }

    // ۳. درخواست‌های موجود در این دوره را استخراج می‌کنیم
    const existingApps = await db.loanApplication.findMany({
      where: { periodId: activePeriod.id },
      select: { memberId: true, loanType: true },
    });

    const existingKeys = new Set(
      existingApps.map((app) => `${app.memberId}:${app.loanType}`),
    );

    // ۴. ایجاد درخواست‌های ناموجود برای هر دو صف (کوتاه‌مدت و بلندمدت)
    // دقت: در SQLite گزینه skipDuplicates وجود ندارد، چون قبلاً با Set چک کرده‌ایم نیازی به آن نیست.
    const missingApps: {
      periodId: string;
      memberId: string;
      loanType: LoanType;
      requestedAmount: bigint;
      status: "queued";
      hasActiveLoan: boolean;
    }[] = [];

    for (const loanType of LOAN_TYPES) {
      for (const m of members) {
        if (!existingKeys.has(`${m.id}:${loanType}`)) {
          // تعیین وضعیت وام تسویه‌نشده متناسب با نوع وام
          const hasActiveLoan =
            loanType === "long_term" ? m.hasLongLoan : m.hasShortLoan;

          missingApps.push({
            periodId: activePeriod.id,
            memberId: m.id,
            loanType,
            requestedAmount: 50_000_000n, // مبلغ پیش‌فرض درخواست
            status: "queued",
            hasActiveLoan: Boolean(hasActiveLoan),
          });
        }
      }
    }

    if (missingApps.length > 0) {
      // ثبت دسته‌ای بدون skipDuplicates (محدودیت تعداد متغیر در SQLite رعایت شده است)
      for (let i = 0; i < missingApps.length; i += 80) {
        await db.loanApplication.createMany({
          data: missingApps.slice(i, i + 80),
        });
      }
    }

    // ۵. واکشی کلیه درخواست‌های دوره همراه با اطلاعات عضو و ارزیابی‌ها
    const applications = await db.loanApplication.findMany({
      where: { periodId: activePeriod.id },
      include: {
        member: {
          include: {
            evaluations: {
              take: 3,
              orderBy: { year: "desc" },
            },
          },
        },
      },
    });

    // ۶. پردازش و امتیازدهی مستقل برای هر یک از دو نوع وام
    const updatePromises: any[] = [];

    for (const currentLoanType of LOAN_TYPES) {
      const typeApps = applications.filter(
        (app) => app.loanType === currentLoanType,
      );

      // محاسبه حداکثر سرمایه کل برای نرمال‌سازی فاکتور سرمایه
      let maxTotalDeposit = 0;
      for (const app of typeApps) {
        const dep = Number(
          (app.member.memberDeposit ?? 0n) + (app.member.employerDeposit ?? 0n),
        );
        if (dep > maxTotalDeposit) maxTotalDeposit = dep;
      }

      // محاسبه نمره تک‌تک افراد
      const scored = typeApps.map((app) => {
        // جمع‌آوری نمرات ارزشیابی (ترکیب جدول ارزیابی یا فیلدهای اکسل evaluationScore1..3)
        let evalScores: { score: number }[] = [];
        if (app.member.evaluations && app.member.evaluations.length > 0) {
          evalScores = app.member.evaluations.map((e) => ({ score: e.score }));
        } else {
          if (app.member.evaluationScore1 != null)
            evalScores.push({ score: app.member.evaluationScore1 });
          if (app.member.evaluationScore2 != null)
            evalScores.push({ score: app.member.evaluationScore2 });
          if (app.member.evaluationScore3 != null)
            evalScores.push({ score: app.member.evaluationScore3 });
        }

        const breakdown = calculateMemberScore(
          {
            id: app.member.id,
            fullName: app.member.fullName,
            employeeCode: app.member.employeeCode,
            maritalStatus: app.member.maritalStatus ?? "single",
            childrenCount: app.member.childrenCount ?? 0,
            veteranStatus: app.member.veteranStatus ?? "none",
            educationLevel: app.member.educationLevel ?? "bachelor",
            hireDate: app.member.hireDate ?? new Date(),
            membershipDate: app.member.membershipDate ?? new Date(),
            memberDeposit: app.member.memberDeposit ?? 0n,
            employerDeposit: app.member.employerDeposit ?? 0n,
            evaluations: evalScores,
            hasActiveLoan: app.hasActiveLoan,
          },
          maxTotalDeposit,
        );

        return {
          id: app.id,
          status: app.status,
          hasActiveLoan: app.hasActiveLoan,
          previousRank: app.rank,
          breakdown,
        };
      });

      // منطق مرتب‌سازی صف مستقل:
      // ۱) اولویت با در صف‌ها (queued)
      // ۲) در صف‌ها: اولویت با کسانی که وام فعال ندارند (hasActiveLoan === false)
      // ۳) امتیاز بالاتر جلوتر
      // ۴) کسانی که وضعیتشان رد شده یا تایید شده، در انتهای صف قرار می‌گیرند
      scored.sort((a, b) => {
        const aQueued = a.status === "queued";
        const bQueued = b.status === "queued";

        if (aQueued !== bQueued) return aQueued ? -1 : 1;

        if (aQueued) {
          if (a.hasActiveLoan !== b.hasActiveLoan) {
            return a.hasActiveLoan ? 1 : -1;
          }
          const diff = b.breakdown.totalScore - a.breakdown.totalScore;
          if (diff !== 0) return diff;
        }

        // در صورت برابری امتیاز یا برای افراد تعیین‌تکلیف‌شده (approved/rejected)
        return (
          (a.previousRank ?? Number.MAX_SAFE_INTEGER) -
            (b.previousRank ?? Number.MAX_SAFE_INTEGER) ||
          a.id.localeCompare(b.id)
        );
      });

      // ذخیره رتبه‌های ۱ تا N مستقل برای این صف
      scored.forEach((item, index) => {
        updatePromises.push(
          db.loanApplication.update({
            where: { id: item.id },
            data: {
              rank: index + 1,
              score: item.breakdown.totalScore,
              scoreBreakdown: JSON.stringify(item.breakdown),
            },
          }),
        );
      });
    }

    if (updatePromises.length > 0) {
      await db.$transaction(updatePromises);
    }

    revalidatePath("/queue");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `دو صف مستقل (کوتاه‌مدت و بلندمدت) با موفقیت به‌روزرسانی و مرتب شدند.`,
    };
  } catch (error) {
    console.error("Queue recalculation error:", error);
    return {
      success: false,
      message: "خطا در همگام‌سازی یا محاسبه صف‌های وام.",
    };
  }
}

/**
 * ثبت تصمیم (تأیید یا رد) روی یک درخواست وام و فرستادن فرد به انتهای همان صف
 */
async function decideApplication(
  applicationId: string,
  newStatus: "approved" | "rejected",
) {
  try {
    const app = await db.loanApplication.findUnique({
      where: { id: applicationId },
      include: { period: true },
    });

    if (!app || !app.period.isActive || app.status !== "queued") {
      return { success: false, error: "این درخواست در صف فعال قرار ندارد." };
    }

    // رتبه انتهای صف جاری را پیدا می‌کنیم
    const lastInQueue = await db.loanApplication.findFirst({
      where: {
        periodId: app.periodId,
        loanType: app.loanType,
      },
      orderBy: { rank: "desc" },
      select: { rank: true },
    });

    // تغییر وضعیت به approved یا rejected و تخصیص رتبه بزرگ موقت تا در انتهای صف قرار گیرد
    await db.loanApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        rank: (lastInQueue?.rank ?? 0) + 1,
      },
    });

    // محاسبه و بازچینی مجدد صف همان دوره
    const recalculateRes = await syncAndRecalculateQueue(app.periodId);
    if (!recalculateRes.success) {
      return {
        success: false,
        error: "وضعیت ثبت شد، اما مرتب‌سازی مجدد صف با خطا روبرو شد.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Loan decision error:", error);
    return { success: false, error: "خطا در اعمال تصمیم روی درخواست وام." };
  }
}

export async function approveApplicationAction(applicationId: string) {
  return decideApplication(applicationId, "approved");
}

export async function rejectApplicationAction(applicationId: string) {
  return decideApplication(applicationId, "rejected");
}

/**
 * بررسی امکان ایجاد دوره جدید:
 * فقط زمانی مجاز است که در هیچ‌یک از دو صف، درخواست تعیین‌تکلیف‌نشده (queued) باقی نمانده باشد.
 */
export async function canStartNewPeriod(): Promise<{
  allowed: boolean;
  pendingCount: number;
}> {
  const activePeriod = await db.loanPeriod.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!activePeriod) {
    return { allowed: true, pendingCount: 0 };
  }

  const memberCount = await db.member.count({ where: { status: "active" } });
  let pendingCount = 0;

  for (const loanType of LOAN_TYPES) {
    const queuedCount = await db.loanApplication.count({
      where: {
        periodId: activePeriod.id,
        loanType,
        status: "queued",
      },
    });

    const totalApps = await db.loanApplication.count({
      where: {
        periodId: activePeriod.id,
        loanType,
      },
    });

    // درخواست‌های معلق صف + افرادی که هنوز درخواست برایشان ایجاد نشده
    pendingCount += queuedCount + Math.max(0, memberCount - totalApps);
  }

  return {
    allowed: pendingCount === 0,
    pendingCount,
  };
}
