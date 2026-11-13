"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { calculateMemberScore } from "@/lib/scoring";
import { LoanType } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import crypto from "crypto";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

const LOAN_TYPES = [LoanType.long_term, LoanType.short_term] as const;

// --- توابع کمکی محاسبه دقیق سابقه عضویت به شمسی ---
function iranToday(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());

  const numberPart = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return new Date(
    Date.UTC(numberPart("year"), numberPart("month") - 1, numberPart("day")),
  );
}

function jalaliDateToUtc(year: number, month: number, day: number): Date {
  const { gy, gm, gd } = toGregorian(year, month, day);
  return new Date(Date.UTC(gy, gm - 1, gd));
}

function jalaliYearsSince(start: Date, today: Date): number {
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(today.getTime()) ||
    start > today
  ) {
    return 0;
  }

  const from = toJalaali(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    start.getUTCDate(),
  );
  const current = toJalaali(
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
    today.getUTCDate(),
  );

  const anniversary = (year: number) =>
    jalaliDateToUtc(
      year,
      from.jm,
      Math.min(from.jd, jalaaliMonthLength(year, from.jm)),
    );

  let completedYears = current.jy - from.jy;
  if (today < anniversary(from.jy + completedYears)) {
    completedYears--;
  }

  const last = anniversary(from.jy + completedYears);
  const next = anniversary(from.jy + completedYears + 1);

  return (
    completedYears +
    (today.getTime() - last.getTime()) / (next.getTime() - last.getTime())
  );
}

/**
 * منطق سابقه عضویت:
 * - کمتر از ۱ سال: هر دو false
 * - بین ۱ تا ۳ سال: کوتاه مدت true، بلندمدت false
 * - بالای ۳ سال (شامل خود ۳ سال): هر دو true
 */
function getMembershipEligibility(membershipDate: Date | null, today: Date) {
  if (!membershipDate) {
    return {
      fundMembershipYears: 0,
      hasShortLoan: false,
      hasLongLoan: false,
    };
  }

  const years = jalaliYearsSince(new Date(membershipDate), today);

  return {
    fundMembershipYears: years,
    hasShortLoan: years >= 1,
    hasLongLoan: years >= 3,
  };
}

async function acquireQueueLock(periodId: string): Promise<string | null> {
  const owner = crypto.randomUUID();
  const staleBefore = new Date(Date.now() - 15_000);

  try {
    await db.queueLock
      .deleteMany({
        where: {
          periodId,
          lockedAt: { lt: staleBefore },
        },
      })
      .catch(() => undefined);

    await db.queueLock.create({
      data: { periodId, owner },
    });
    return owner;
  } catch {
    return null;
  }
}

async function releaseQueueLock(periodId: string, owner: string) {
  await db.queueLock
    .deleteMany({ where: { periodId, owner } })
    .catch(() => undefined);
}

/**
 * ایجاد درخواست پیش‌فرض برای افراد واجد شرایط و مرتب‌سازی صف
 */
export async function syncAndRecalculateQueue(periodId?: string) {
  console.log(
    "\n==================== [START syncAndRecalculateQueue] ====================",
  );
  console.log("➡️ Received periodId argument:", periodId);

  try {
    await requireAuth();

    const activePeriod = periodId
      ? await db.loanPeriod.findFirst({
          where: { id: periodId, isActive: true },
        })
      : await db.loanPeriod.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        });

    if (!activePeriod) {
      console.error("❌ Active period NOT found in database!");
      return { success: false, message: "هیچ دوره فعالی یافت نشد." };
    }

    console.log("✅ Active Period Identified:", {
      id: activePeriod.id,
      title: (activePeriod as any).title ?? "بدون عنوان",
      isActive: activePeriod.isActive,
    });

    const lockOwner = await acquireQueueLock(activePeriod.id);
    if (!lockOwner) {
      console.warn("⚠️ Queue Lock could not be acquired (Lock busy).");
      return {
        success: false,
        message: "عملیات دیگری در حال انجام است. لطفاً چند لحظه صبر کنید.",
      };
    }
    console.log("🔒 Lock acquired successfully by owner:", lockOwner);

    try {
      const today = iranToday();
      console.log("📅 Tehran Today Date:", today.toISOString());

      // ۱. اعضای فعال سامانه
      const members = await db.member.findMany({
        where: { status: "active" },
      });

      console.log(`👥 Total active members found in DB: ${members.length}`);

      if (members.length === 0) {
        console.warn("⚠️ No active members exist in database.");
        return { success: false, message: "هیچ عضوی در سامانه ثبت نشده است." };
      }

      // ۲. به‌روزرسانی پرچم‌های واجد شرایط بودن در جدول اعضا (Member)
      const memberEligibilityMap = new Map<
        string,
        ReturnType<typeof getMembershipEligibility>
      >();

      const memberUpdates = [];
      let eligibleShortCount = 0;
      let eligibleLongCount = 0;

      for (const m of members) {
        const eligibility = getMembershipEligibility(m.membershipDate, today);
        memberEligibilityMap.set(m.id, eligibility);

        if (eligibility.hasShortLoan) eligibleShortCount++;
        if (eligibility.hasLongLoan) eligibleLongCount++;

        if (
          m.hasShortLoan !== eligibility.hasShortLoan ||
          m.hasLongLoan !== eligibility.hasLongLoan
        ) {
          memberUpdates.push(
            db.member.update({
              where: { id: m.id },
              data: {
                hasShortLoan: eligibility.hasShortLoan,
                hasLongLoan: eligibility.hasLongLoan,
                fundMembershipYears: eligibility.fundMembershipYears,
              },
            }),
          );
        }
      }

      console.log("📊 Eligibility summary:", {
        eligibleForShortTerm: eligibleShortCount,
        eligibleForLongTerm: eligibleLongCount,
        membersNeedingUpdate: memberUpdates.length,
      });

      if (memberUpdates.length > 0) {
        await db.$transaction(memberUpdates);
        console.log(
          `✅ Updated ${memberUpdates.length} members with new loan eligibility flags.`,
        );
      }

      // ۳. بررسی درخواست‌های موجود در این دوره
      const existingApps = await db.loanApplication.findMany({
        where: { periodId: activePeriod.id },
        select: { id: true, memberId: true, loanType: true, status: true },
      });

      console.log(
        `📑 Existing loan applications in this period (ID: ${activePeriod.id}): ${existingApps.length}`,
      );

      const existingKeys = new Set(
        existingApps.map((app) => `${app.memberId}:${app.loanType}`),
      );

      // ۴. ایجاد درخواست برای اعضای مجاز
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
          const eligibility = memberEligibilityMap.get(m.id)!;
          const isEligible =
            loanType === "short_term"
              ? eligibility.hasShortLoan
              : eligibility.hasLongLoan;

          if (isEligible && !existingKeys.has(`${m.id}:${loanType}`)) {
            missingApps.push({
              periodId: activePeriod.id,
              memberId: m.id,
              loanType,
              requestedAmount: 50_000_000n,
              status: "queued",
              hasActiveLoan: false,
            });
          }
        }
      }

      console.log(
        `➕ New missing applications to insert: ${missingApps.length}`,
      );

      if (missingApps.length > 0) {
        for (let i = 0; i < missingApps.length; i += 80) {
          await db.loanApplication.createMany({
            data: missingApps.slice(i, i + 80),
          });
        }
        console.log(
          `✅ Successfully inserted ${missingApps.length} new applications into DB.`,
        );
      }

      // ۵. واکشی کلیه درخواست‌ها برای رتبه‌بندی
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

      console.log(
        `📋 Total applications retrieved for scoring: ${applications.length}`,
      );

      const updatePromises: any[] = [];

      for (const currentLoanType of LOAN_TYPES) {
        const typeApps = applications.filter((app) => {
          if (app.loanType !== currentLoanType) return false;
          if (app.status !== "queued") return true;

          const eligibility = getMembershipEligibility(
            app.member.membershipDate,
            today,
          );
          return currentLoanType === "short_term"
            ? eligibility.hasShortLoan
            : eligibility.hasLongLoan;
        });

        console.log(
          `  🔹 ${currentLoanType} -> Total apps matching filter: ${typeApps.length}`,
        );

        let maxTotalDeposit = 0;
        for (const app of typeApps) {
          const dep = Number(
            (app.member.memberDeposit ?? 0n) +
              (app.member.employerDeposit ?? 0n),
          );
          if (dep > maxTotalDeposit) maxTotalDeposit = dep;
        }

        const scored = typeApps.map((app) => {
          let evalScores: { score: number }[] = [];
          if (app.member.evaluations && app.member.evaluations.length > 0) {
            evalScores = app.member.evaluations.map((e) => ({
              score: e.score,
            }));
          } else {
            if (app.member.evaluationScore1 != null)
              evalScores.push({ score: app.member.evaluationScore1 });
            if (app.member.evaluationScore2 != null)
              evalScores.push({ score: app.member.evaluationScore2 });
            if (app.member.evaluationScore3 != null)
              evalScores.push({ score: app.member.evaluationScore3 });
          }

          const eligibility = getMembershipEligibility(
            app.member.membershipDate,
            today,
          );

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
              fundMembershipYears: eligibility.fundMembershipYears,
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

          return (
            (a.previousRank ?? Number.MAX_SAFE_INTEGER) -
              (b.previousRank ?? Number.MAX_SAFE_INTEGER) ||
            a.id.localeCompare(b.id)
          );
        });

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

      console.log(
        `💾 Total rank updates ready to write: ${updatePromises.length}`,
      );

      if (updatePromises.length > 0) {
        await db.$transaction(updatePromises);
        console.log(
          `✅ Successfully committed ${updatePromises.length} rank updates via transaction.`,
        );
      }

      revalidatePath("/queue");
      revalidatePath("/dashboard");

      console.log("🎉 syncAndRecalculateQueue completed successfully.");
      console.log(
        "==================== [END syncAndRecalculateQueue] ====================\n",
      );

      return {
        success: true,
        message: `دو صف مستقل با توجه به سابقه عضویت به‌روزرسانی شدند.`,
        timestamp: Date.now(),
      };
    } finally {
      await releaseQueueLock(activePeriod.id, lockOwner);
      console.log("🔓 Lock released.");
    }
  } catch (error) {
    console.error("💥 Queue recalculation error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "خطا در همگام‌سازی یا محاسبه صف‌های وام.",
    };
  }
}

async function decideApplication(
  applicationId: string,
  newStatus: "approved" | "rejected",
) {
  try {
    await requireAuth();

    const app = await db.loanApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        periodId: true,
        loanType: true,
        status: true,
        period: { select: { isActive: true } },
      },
    });

    if (!app) return { success: false, error: "درخواست یافت نشد." };
    if (!app.period.isActive)
      return { success: false, error: "دوره فعال نیست." };
    if (app.status !== "queued") {
      return {
        success: false,
        error: "این درخواست قبلاً تعیین تکلیف شده است.",
      };
    }

    const lastInQueue = await db.loanApplication.findFirst({
      where: { periodId: app.periodId, loanType: app.loanType },
      orderBy: { rank: "desc" },
      select: { rank: true },
    });

    const fallbackRank = (lastInQueue?.rank ?? 0) + 1;

    const result = await db.loanApplication.updateMany({
      where: { id: applicationId, status: "queued" },
      data: { status: newStatus, rank: fallbackRank },
    });

    if (result.count === 0) {
      return {
        success: false,
        error: "درخواست توسط کاربر دیگری تغییر یافته است.",
      };
    }

    try {
      const recalculateRes = await syncAndRecalculateQueue(app.periodId);
      if (!recalculateRes.success) throw new Error(recalculateRes.message);
    } catch (recalcError) {
      await db.loanApplication
        .updateMany({
          where: { id: applicationId, status: newStatus },
          data: { status: "queued", rank: null },
        })
        .catch(() => {});

      return {
        success: false,
        error: "خطا در مرتب‌سازی صف؛ تغییرات بازگردانده شد.",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "خطا در ثبت تصمیم.",
    };
  }
}

export async function approveApplicationAction(applicationId: string) {
  return decideApplication(applicationId, "approved");
}

export async function rejectApplicationAction(applicationId: string) {
  return decideApplication(applicationId, "rejected");
}

export async function canStartNewPeriod(): Promise<{
  allowed: boolean;
  pendingCount: number;
}> {
  await requireAuth();

  const activePeriod = await db.loanPeriod.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!activePeriod) return { allowed: true, pendingCount: 0 };

  const queuedCount = await db.loanApplication.count({
    where: {
      periodId: activePeriod.id,
      status: "queued",
    },
  });

  return {
    allowed: queuedCount === 0,
    pendingCount: queuedCount,
  };
}

// --- بخش بارگذاری اکسل افراد دریافت‌کننده وام (تأیید شده) ---

class LoanImportError extends Error {}

function employeeCodeFromCell(value: unknown): string {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .trim();
}

function importError(row: number, message: string): never {
  throw new LoanImportError(`ردیف ${row}: ${message}`);
}

export async function importApprovedLoansFromExcel(formData: FormData) {
  try {
    await requireAuth();

    const file = formData.get("file");
    const type = formData.get("loanType");
    const selectedPeriodId = formData.get("periodId");

    if (
      !(file instanceof File) ||
      file.size === 0 ||
      !/\.(xlsx|xls)$/i.test(file.name)
    ) {
      return { success: false, message: "فایل اکسل معتبر انتخاب کنید." };
    }
    if (type !== LoanType.short_term && type !== LoanType.long_term) {
      return { success: false, message: "نوع وام نامعتبر است." };
    }

    const period = await db.loanPeriod.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!period || (selectedPeriodId && selectedPeriodId !== period.id)) {
      return {
        success: false,
        message: "درون‌ریزی فقط برای دورهٔ فعالِ در حال نمایش مجاز است.",
      };
    }

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const ref = sheet?.["!ref"];

    if (!ref || XLSX.utils.decode_range(ref).s.c !== 0) {
      return {
        success: false,
        message: "شیت اول خالی است یا اطلاعات در ستون اول نیست.",
      };
    }

    const firstRow = XLSX.utils.decode_range(ref).s.r + 1;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
    });

    const header = employeeCodeFromCell(rows[0]?.[0]).replace(
      /[\s\u200c]/g,
      "",
    );
    const startIndex = header.includes("پرسنلی") ? 1 : 0;

    const codes: string[] = [];
    const seen = new Set<string>();

    for (let i = startIndex; i < rows.length; i++) {
      const row = firstRow + i;
      const cells = rows[i];
      if (cells.every((v) => employeeCodeFromCell(v) === "")) continue;

      const code = employeeCodeFromCell(cells[0]);
      if (!code) importError(row, "کد پرسنلی خالی است.");
      if (seen.has(code)) importError(row, `کد پرسنلی ${code} تکراری است.`);

      seen.add(code);
      codes.push(code);
    }

    if (codes.length === 0) {
      return { success: false, message: "کد پرسنلی در فایل یافت نشد." };
    }

    const members = await db.member.findMany({
      where: { employeeCode: { in: codes }, status: "active" },
      select: { id: true, employeeCode: true },
    });
    const memberByCode = new Map(members.map((m) => [m.employeeCode, m.id]));

    for (const code of codes) {
      if (!memberByCode.has(code)) {
        throw new LoanImportError(`کد ${code} در اعضای فعال سامانه یافت نشد.`);
      }
    }

    // ۱. ابتدا همگام‌سازی دوره برای ایجاد درخواست‌های احتمالی
    const initialSyncResult = await syncAndRecalculateQueue(period.id);

    if (!initialSyncResult.success) {
      return {
        success: false,
        message: initialSyncResult.message,
      };
    }

    // ۲. یافتن درخواست‌های متناظر
    const memberIds = members.map((m) => m.id);
    const apps = await db.loanApplication.findMany({
      where: {
        periodId: period.id,
        loanType: type,
        memberId: { in: memberIds },
      },
      select: { id: true, memberId: true, status: true },
    });

    const appByMemberId = new Map(apps.map((a) => [a.memberId, a]));

    // ۳. تأیید درخواست‌ها با تراکنش
    const approvedCount = await db.$transaction(
      async (tx) => {
        let count = 0;
        for (const code of codes) {
          const memId = memberByCode.get(code)!;
          let app = appByMemberId.get(memId);

          if (!app) {
            await tx.loanApplication.create({
              data: {
                periodId: period.id,
                memberId: memId,
                loanType: type,
                requestedAmount: 50_000_000n,
                status: "approved",
                hasActiveLoan: true,
              },
            });
            count++;
            continue;
          }

          if (app.status === "approved") continue;

          await tx.loanApplication.update({
            where: { id: app.id },
            data: { status: "approved", hasActiveLoan: true },
          });
          count++;
        }
        return count;
      },
      { maxWait: 10000, timeout: 120000 },
    );

    // ۴. بازچینی نهایی صف
    const finalSyncResult = await syncAndRecalculateQueue(period.id);

    if (!finalSyncResult.success) {
      return {
        success: false,
        message:
          finalSyncResult.message ||
          "تأییدها ثبت شدند، اما مرتب‌سازی نهایی صف انجام نشد.",
      };
    }

    return {
      success: true,
      message: `${approvedCount} نفر برای وام ${
        type === "long_term" ? "بلندمدت" : "کوتاه‌مدت"
      } در وضعیت تأیید قرار گرفتند و صف مرتب شد.`,
    };
  } catch (error) {
    console.error("Loan Excel import error:", error);
    return {
      success: false,
      message:
        error instanceof LoanImportError
          ? error.message
          : "درون‌ریزی فایل ناموفق بود.",
    };
  }
}
