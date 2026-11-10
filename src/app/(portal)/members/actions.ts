"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { EducationLevel, MaritalStatus, VeteranStatus } from "@prisma/client";

// ۱. افزودن عضو جدید
export async function createMember(formData: FormData) {
  try {
    const data = Object.fromEntries(formData);

    await db.member.create({
      data: {
        employeeCode: data.employeeCode as string,
        fullName: data.fullName as string,
        nationalId: data.nationalId as string,
        department: data.department as string,
        maritalStatus: data.maritalStatus as any,
        childrenCount: Number(data.childrenCount),
        educationLevel: data.educationLevel as any,
        // savingsBalance: Number(data.savingsBalance), // فرض بر این است که دیتابیس شما این فیلد را دارد
        status: "active", // مقدار پیش‌فرض
        hireDate: new Date(data.hireDate as string),
        membershipDate: new Date(data.membershipDate as string),
      },
    });

    revalidatePath("/members");
    return { success: true, message: "عضو با موفقیت ثبت شد." };
  } catch (error) {
    return { success: false, message: "خطا در ثبت عضو: " + error };
  }
}

// ۲. ویرایش عضو
export async function updateMember(id: string, formData: FormData) {
  try {
    const data = Object.fromEntries(formData);

    await db.member.update({
      where: { id },
      data: {
        fullName: data.fullName as string,
        department: data.department as string,
        maritalStatus: data.maritalStatus as any,
        childrenCount: Number(data.childrenCount),
        educationLevel: data.educationLevel as any,
        // savingsBalance: Number(data.savingsBalance),
        veteranStatus: data.veteranStatus as any,
      },
    });

    revalidatePath("/members");
    return { success: true, message: "اطلاعات با موفقیت به‌روزرسانی شد." };
  } catch (error) {
    return { success: false, message: "خطا در ویرایش: " + error };
  }
}

// ۳. حذف عضو
export async function deleteMember(id: string) {
  try {
    await db.member.delete({ where: { id } });
    revalidatePath("/members");
    return { success: true, message: "عضو با موفقیت حذف شد." };
  } catch (error) {
    return { success: false, message: "خطا در حذف: " + error };
  }
}

// ۴. تغییر وضعیت
export async function toggleMemberStatus(
  id: string,
  status: "active" | "suspended" | "resigned",
) {
  try {
    await db.member.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/members");
    return { success: true, message: "وضعیت تغییر یافت." };
  } catch (error) {
    return { success: false, message: "خطا در تغییر وضعیت." };
  }
}

// کمکی برای مپ کردن مقطع تحصیلی با در نظر گرفتن انواع املاها
function parseEducation(val: string): EducationLevel {
  if (!val) return "bachelor";
  const text = val.trim();
  if (text.includes("ارشد") || text.includes("فوق لیسانس")) return "master";
  if (text.includes("دکترا") || text.includes("دکتری")) return "phd";
  if (text.includes("کاردانی") || text.includes("فوق ديپلم"))
    return "associate";
  if (
    text.includes("ديپلم") ||
    text.includes("دیپلم") ||
    text.includes("ر اهنمائي")
  )
    return "diploma";
  return "bachelor";
}

// کمکی برای مپ کردن وضعیت تاهل
function parseMarital(val: string): MaritalStatus {
  if (!val) return "single";
  const text = val.trim();
  if (text.includes("متاهل")) return "married";
  return "single";
}

// کمکی برای مپ کردن وضعیت ایثارگری بر اساس انام Prisma (none, level_1, level_2, level_3)
function parseVeteranStatus(val: string): VeteranStatus {
  if (!val) return "none";
  const clean = val.trim();
  // اگر شامل غیر ایثارگر باشد
  if (clean.includes("غير ايثارگر") || clean.includes("غیر ایثارگر")) {
    return "none";
  }
  // اگر متن طولانی جانبادی/رزمندگان باشد (سطح ۱ یا پیش‌فرضِ ایثارگر)
  if (
    clean.includes("جانباز") ||
    clean.includes("رزمندگان") ||
    clean.includes("ايثارگر")
  ) {
    return "level_1"; // یا سطح متناسب با منطق سیستم شما
  }
  return "none";
}

export async function importMembersFromExcel(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, message: "فایلی انتخاب نشده است." };
    }

    const bytes = await file.arrayBuffer();
    const XLSX = await import("xlsx");

    const workbook = XLSX.read(bytes, { type: "array" });
    const sheetName = workbook.SheetNames[0]; // شیت Combined
    if (!sheetName) {
      return { success: false, message: "فایل اکسل فاقد شیت معتبر است." };
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

    let importedCount = 0;

    for (const r of rows) {
      const employeeCode = String(r["ID"] || "").trim();
      if (!employeeCode) continue;

      const firstName = String(r["نام"] || "").trim();
      const lastName = String(r["نام  خانو ادگي"] || "").trim();
      const fullName =
        `${firstName} ${lastName}`.trim() || `کاربر ${employeeCode}`;

      const keys = Object.keys(r);

      // یافتن کلیدهای پس‌انداز با ایمنی در برابر فاصله‌ها
      const savings5Key =
        keys.find((k) => k.includes("ذخيره 5")) ||
        "ذخيره 5 % درصد پس انداز تا ماه جاري";
      const savings7Key =
        keys.find((k) => k.includes("ذخيره 7")) ||
        "ذخيره 7%  درصدپس انداز (کارفرما) تا ماه جاري";

      const memberDeposit = BigInt(Math.floor(Number(r[savings5Key] || 0)));
      const employerDeposit = BigInt(Math.floor(Number(r[savings7Key] || 0)));

      // امتیازات ارزشیابی
      const score1 = Number(r["امتیاز ارزشیابی"] || 0);
      const score2 = Number(r["امتیاز ارزشیابی_Score2"] || 0);
      const score3 = Number(r["امتیاز ارزشیابی_Score3"] || 0);

      const educationLevel = parseEducation(String(r["مقطع تحصيلي"] || ""));

      const maritalKey =
        keys.find((k) => k.includes("وضعیت تاهل")) || "وضعیت تاهل ";
      const maritalStatus = parseMarital(String(r[maritalKey] || ""));

      const childrenKey =
        keys.find((k) => k.includes("تعداد اولاد")) || "تعداد اولاد ";
      const childrenCount = Number(r[childrenKey] || 0);

      const veteranKey =
        keys.find((k) => k.includes("ایثارگری")) || "ایثارگری ";
      const rawVeteran = String(r[veteranKey] || "");
      const veteranStatus = parseVeteranStatus(rawVeteran);

      // سابقه کار و صندوق
      const workHistory = Number(r["سابقه کار"] || 0);
      const fundMembership = Number(r["سابقه عضویت در صندوق"] || 0);

      // وام‌ها
      const hasShortLoan = String(r["Has_ShortLoan"] || "").trim() === "بله";
      const hasLongLoan = String(r["Has_LongLoan"] || "").trim() === "بله";

      await db.member.upsert({
        where: { employeeCode },
        update: {
          fullName,
          memberDeposit,
          employerDeposit,
          educationLevel,
          maritalStatus,
          childrenCount,
          veteranStatus,
          workExperienceYears: workHistory || null,
          fundMembershipYears: fundMembership || null,
          evaluationScore1: score1 || null,
          evaluationScore2: score2 || null,
          evaluationScore3: score3 || null,
          hasShortLoan,
          hasLongLoan,
        },
        create: {
          employeeCode,
          fullName,
          memberDeposit,
          employerDeposit,
          educationLevel,
          maritalStatus,
          childrenCount,
          veteranStatus,
          workExperienceYears: workHistory || null,
          fundMembershipYears: fundMembership || null,
          evaluationScore1: score1 || null,
          evaluationScore2: score2 || null,
          evaluationScore3: score3 || null,
          hasShortLoan,
          hasLongLoan,
          hireDate: new Date(),
          membershipDate: new Date(),
        },
      });

      importedCount++;
    }

    revalidatePath("/members");
    return {
      success: true,
      message: `${importedCount} پرونده با موفقیت از فایل اکسل درون‌ریزی/به‌روزرسانی شد.`,
    };
  } catch (error: any) {
    console.error("Excel import error:", error);
    return {
      success: false,
      message: error?.message || "خطا در پردازش فایل اکسل.",
    };
  }
}
