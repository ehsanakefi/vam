// src/app/members/actions.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  MaritalStatus,
  VeteranStatus,
  EducationLevel,
  MemberStatus,
} from "@prisma/client";

// ۱. ثبت عضو جدید (همان کدی که نوشتید با هندلینگ بهتر خطا)
export async function createMember(formData: FormData) {
  try {
    const employeeCode = formData.get("employeeCode") as string;
    const nationalId = formData.get("nationalId") as string;
    const fullName = formData.get("fullName") as string;
    const department = (formData.get("department") as string) || null;

    const maritalStatus =
      (formData.get("maritalStatus") as MaritalStatus) || "single";
    const childrenCount = Number(formData.get("childrenCount") || 0);
    const veteranStatus =
      (formData.get("veteranStatus") as VeteranStatus) || "none";
    const educationLevel =
      (formData.get("educationLevel") as EducationLevel) || "bachelor";

    // دریافت تاریخ و نمره ارزیابی
    const rawHireDate = formData.get("hireDate") as string;
    const rawMembershipDate = formData.get("membershipDate") as string;
    const hireDate = rawHireDate ? new Date(rawHireDate) : new Date();
    const membershipDate = rawMembershipDate
      ? new Date(rawMembershipDate)
      : new Date();

    const performanceScore = Number(formData.get("performanceScore") || 0);
    const savingsBalance = BigInt(
      formData.get("savingsBalance")?.toString() || 0,
    );

    await db.member.create({
      data: {
        employeeCode,
        nationalId,
        fullName,
        department,
        maritalStatus,
        childrenCount,
        veteranStatus,
        educationLevel,
        hireDate,
        membershipDate,
        performanceScore,
        savingsBalance,
      },
    });

    revalidatePath("/members");
    return { success: true, message: "عضو جدید با موفقیت ثبت شد." };
  } catch (error: any) {
    if (error.code === "P2002") {
      return {
        success: false,
        message: "کد پرسنلی یا کد ملی قبلاً ثبت شده است.",
      };
    }
    return { success: false, message: "خطا در ثبت عضو." };
  }
}

// ۲. ویرایش مشخصات عضو
export async function updateMember(id: string, formData: FormData) {
  try {
    await db.member.update({
      where: { id },
      data: {
        fullName: formData.get("fullName") as string,
        department: (formData.get("department") as string) || null,
        maritalStatus: formData.get("maritalStatus") as MaritalStatus,
        childrenCount: Number(formData.get("childrenCount") || 0),
        veteranStatus: formData.get("veteranStatus") as VeteranStatus,
        educationLevel: formData.get("educationLevel") as EducationLevel,
        performanceScore: Number(formData.get("performanceScore") || 0),
        savingsBalance: BigInt(formData.get("savingsBalance")?.toString() || 0),
      },
    });

    revalidatePath("/members");
    return { success: true, message: "مشخصات با موفقیت به‌روزرسانی شد." };
  } catch (error) {
    return { success: false, message: "خطا در ویرایش اطلاعات." };
  }
}

// ۳. تغییر وضعیت عضو (فعال / تعلیق / انصراف)
export async function toggleMemberStatus(id: string, status: MemberStatus) {
  try {
    await db.member.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/members");
    return { success: true };
  } catch (error) {
    return { success: false, message: "خطا در تغییر وضعیت عضو." };
  }
}
