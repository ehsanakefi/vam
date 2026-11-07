"use server"; // 👈 حتماً باید خط اول باشد تا در سرور اجرا شود نه مرورگر

import { db } from "@/lib/db"; // یا مسیر دیتابیس خودتان
import { revalidatePath } from "next/cache";

// کمکی برای مپ کردن مقطع تحصیلی ...
function parseEducation(val: string): EducationLevel {
  // ... کدهای قبلی
}

function parseMarital(val: string): MaritalStatus {
  // ... کدهای قبلی
}

export async function importMembersFromExcel(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, message: "فایلی انتخاب نشده است." };
    }

    // ۱. خواندن بایت‌ها
    const bytes = await file.arrayBuffer();

    // ۲. ایمپورت داینامیک پکیج اکسل (حل قطعی مشکل باندلر و توربوپک)
    const XLSX = await import("xlsx");

    // ۳. پارس بافر اکسل
    const workbook = XLSX.read(bytes, { type: "array" });

    const sheetName = workbook.SheetNames[0];
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
      const savings5Key =
        keys.find((k) => k.includes("ذخيره 5")) ||
        "ذخيره 5 % درصد پس انداز تا ماه جاري";
      const savings7Key =
        keys.find((k) => k.includes("ذخيره 7")) ||
        "ذخيره 7%  درصدپس انداز (کارفرما) تا ماه جاري";

      const savingsBalance = BigInt(Math.floor(Number(r[savings5Key] || 0)));
      const employerSavings = BigInt(Math.floor(Number(r[savings7Key] || 0)));

      const educationLevel = parseEducation(String(r["مقطع تحصيلي"] || ""));

      const maritalKey =
        keys.find((k) => k.includes("وضعیت تاهل")) || "وضعیت تاهل ";
      const maritalStatus = parseMarital(String(r[maritalKey] || ""));

      const childrenKey =
        keys.find((k) => k.includes("تعداد اولاد")) || "تعداد اولاد ";
      const childrenCount = Number(r[childrenKey] || 0);

      const veteranKey =
        keys.find((k) => k.includes("ایثارگری")) || "ایثارگری ";
      const rawVeteran = r[veteranKey];
      const veteranStatus =
        rawVeteran && String(rawVeteran).trim() !== ""
          ? String(rawVeteran).trim()
          : "غير ايثارگر";

      await db.member.upsert({
        where: { employeeCode },
        update: {
          fullName,
          memberDeposit: savingsBalance, // 👈 فیلد اصلاح شده به جای savingsBalance
          employerDeposit: employerSavings, // 👈 واریزی ۷٪ کارفرما
          educationLevel: educationLevel || undefined,
          maritalStatus: maritalStatus || undefined,
          childrenCount,
          veteranStatus: veteranStatus as any,
          // workExperienceYears: workHistory || null,
          // fundMembershipYears: fundMembership || null,
          // evaluationScore1: score1 || null,
          // evaluationScore2: score2 || null,
          // evaluationScore3: score3 || null,
          // hasShortLoan,
          // hasLongLoan,
        },
        create: {
          employeeCode,
          fullName,
          memberDeposit: savingsBalance, // 👈 فیلد اصلاح شده به جای savingsBalance
          employerDeposit: employerSavings, // 👈 واریزی ۷٪ کارفرما
          educationLevel: educationLevel || "bachelor",
          maritalStatus: maritalStatus || "single",
          childrenCount,
          veteranStatus: veteranStatus as any,
          // workExperienceYears: workHistory || null,
          // fundMembershipYears: fundMembership || null,
          // evaluationScore1: score1 || null,
          // evaluationScore2: score2 || null,
          // evaluationScore3: score3 || null,
          // hasShortLoan,
          // hasLongLoan,
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
