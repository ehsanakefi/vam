// src/app/periods/actions.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createPeriod(formData: FormData) {
  try {
    const title = formData.get("title") as string;
    const allocatedBudgetRaw = formData.get("allocatedBudget") as string;
    const startDateRaw = formData.get("startDate") as string;
    const endDateRaw = formData.get("endDate") as string;
    const isActive = formData.get("isActive") === "on";

    // پاکسازی ارقام از کاما یا فاصله‌های احتمالی
    const cleanBudget = allocatedBudgetRaw.replace(/[,،\s]/g, "");
    const allocatedBudget = BigInt(cleanBudget || 0);

    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw);

    // اگر این دوره فعال انتخاب شده، سایر دوره‌ها غیرفعال شوند
    await db.$transaction(async (tx) => {
      if (isActive) {
        await tx.loanPeriod.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      await tx.loanPeriod.create({
        data: {
          title,
          allocatedBudget,
          consumedBudget: BigInt(0),
          startDate,
          endDate,
          isActive,
        },
      });
    });

    revalidatePath("/periods");
    revalidatePath("/dashboard");
    return { success: true, message: "دوره جدید با موفقیت تعریف شد." };
  } catch (error) {
    console.error("Error creating period:", error);
    return { success: false, message: "خطا در ثبت دوره جدید." };
  }
}
export async function editPeriod(id: string, formData: FormData) {
  try {
    const title = formData.get("title") as string;
    const allocatedBudgetRaw = formData.get("allocatedBudget") as string;
    const startDateRaw = formData.get("startDate") as string;
    const endDateRaw = formData.get("endDate") as string;
    const isActive = formData.get("isActive") === "on";

    const cleanBudget = allocatedBudgetRaw.replace(/[,،\s]/g, "");
    const allocatedBudget = BigInt(cleanBudget || 0);

    await db.$transaction(async (tx) => {
      // اگر دوره جدید فعال شده، سایر دوره‌ها غیرفعال شوند
      if (isActive) {
        await tx.loanPeriod.updateMany({
          where: { id: { not: id }, isActive: true },
          data: { isActive: false },
        });
      }

      await tx.loanPeriod.update({
        where: { id },
        data: {
          title,
          allocatedBudget,
          startDate: new Date(startDateRaw),
          endDate: new Date(endDateRaw),
          isActive,
        },
      });
    });

    revalidatePath("/periods");
    return { success: true, message: "دوره با موفقیت ویرایش شد." };
  } catch (error) {
    console.error("Error updating period:", error);
    return { success: false, message: "خطا در ویرایش دوره." };
  }
}
