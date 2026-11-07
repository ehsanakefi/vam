// src/app/queue/actions.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { calculateMemberScore } from "@/lib/scoring";

export async function recalculateQueueScores(periodId: string) {
  try {
    // ۱. دریافت دوره و درخواست‌های ثبت‌شده در آن
    const applications = await db.loanApplication.findMany({
      where: { periodId },
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

    if (applications.length === 0) {
      return {
        success: false,
        message: "هیچ درخواستی در این دوره وجود ندارد.",
      };
    }

    // ۲. محاسبه حداکثر سرمایه (برای نرمال‌سازی تا ۲۰ امتیاز)
    let maxTotalDeposit = 0;
    for (const app of applications) {
      const totalSavings = Number(
        app.member.memberDeposit + app.member.employerDeposit,
      );
      if (totalSavings > maxTotalDeposit) {
        maxTotalDeposit = totalSavings;
      }
    }

    // ۳. محاسبه نمرات هر فرد
    const scoredList = applications.map((app) => {
      const breakdown = calculateMemberScore(
        {
          id: app.member.id,
          fullName: app.member.fullName,
          employeeCode: app.member.employeeCode,
          maritalStatus: app.member.maritalStatus,
          childrenCount: app.member.childrenCount,
          veteranStatus: app.member.veteranStatus,
          educationLevel: app.member.educationLevel,
          hireDate: app.member.hireDate,
          membershipDate: app.member.membershipDate,
          memberDeposit: app.member.memberDeposit,
          employerDeposit: app.member.employerDeposit,
          evaluations: app.member.evaluations,
          hasActiveLoan: app.hasActiveLoan,
        },
        maxTotalDeposit,
      );

      return {
        applicationId: app.id,
        loanType: app.loanType,
        hasActiveLoan: app.hasActiveLoan,
        membershipScore: breakdown.membershipScore,
        totalScore: breakdown.totalScore,
        breakdown,
      };
    });

    // ۴. اولویت‌بندی بر اساس قوانین شیت‌های پایتون:
    // قانون: کسانی که وام فعال ندارند اولویت دارند بر کسانی که وام فعال دارند
    // و بین هر دسته، سورت نزولی بر اساس امتیاز نهایی
    scoredList.sort((a, b) => {
      if (a.hasActiveLoan !== b.hasActiveLoan) {
        return a.hasActiveLoan ? 1 : -1; // بدون وام فعال در اولویت جلوتر
      }
      return b.totalScore - a.totalScore; // امتیاز بالاتر جلوتر
    });

    // ۵. به‌روزرسانی رتبه‌ها و نمرات در دیتابیس با تراکنش
    await db.$transaction(
      scoredList.map((item, index) =>
        db.loanApplication.update({
          where: { id: item.applicationId },
          data: {
            rank: index + 1, // رتبه ۱، ۲، ۳، ...
            score: item.totalScore,
            scoreBreakdown: JSON.stringify(item.breakdown),
          },
        }),
      ),
    );

    revalidatePath("/queue");
    revalidatePath("/dashboard");
    return {
      success: true,
      message: `امتیازها و صف اولویت ${scoredList.length} متقاضی با موفقیت بازنویسی شد.`,
    };
  } catch (error) {
    console.error("Scoring error:", error);
    return { success: false, message: "خطا در محاسبه امتیازات و صف." };
  }
}
