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
    text.includes("سوم ر اهنمائي") ||
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
import type { Prisma } from "@prisma/client";
import {
  MEMBER_IMPORT_TYPES,
  type MemberImportType,
} from "@/lib/member-import-types";

type ImportPatch = Partial<
  Pick<
    Prisma.MemberUncheckedCreateInput,
    | "firstName"
    | "lastName"
    | "fullName"
    | "memberDeposit"
    | "employerDeposit"
    | "evaluationScore1"
    | "evaluationScore2"
    | "evaluationScore3"
    | "educationLevel"
    | "maritalStatus"
    | "childrenCount"
    | "veteranStatus"
    | "workExperienceYears"
    | "fundMembershipYears"
    | "hasShortLoan"
    | "hasLongLoan"
  >
>;

class ImportValidationError extends Error {}

function invalid(row: number, message: string): never {
  throw new ImportValidationError(`ردیف ${row}: ${message}`);
}

function text(value: unknown): string {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .trim();
}

function label(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/[\s\u200c]/g, "");
}

function numericText(value: unknown): string {
  return text(value)
    .replace(/[٬،,\s]/g, "")
    .replace(/٫/g, ".");
}

function decimalValue(value: unknown, row: number): number {
  const raw = numericText(value);
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    invalid(row, "مقدار عددی معتبر نیست.");
  }

  const result = Number(raw);
  if (!Number.isFinite(result)) {
    invalid(row, "مقدار عددی خارج از محدوده است.");
  }
  return result;
}

function depositValue(value: unknown, row: number): bigint {
  const raw = numericText(value);
  console.log("%%%%%%%%%%", raw, value);
  if (!/^\d+$/.test(raw)) {
    invalid(row, "مبلغ باید عدد صحیح و غیرمنفی باشد.");
  }

  const result = BigInt(raw);
  if (result > 9223372036854775807n) {
    invalid(row, "مبلغ از محدوده مجاز دیتابیس بزرگ‌تر است.");
  }
  return result;
}

function educationValue(
  value: unknown,
  row: number,
): NonNullable<ImportPatch["educationLevel"]> {
  const v = label(value);

  if (v === "below_diploma" || /زیر|کمتر|ابتدایی|راهنمایی|سیکل/.test(v))
    return "below_diploma";
  if (v === "associate" || /کاردانی|فوقدیپلم/.test(v)) return "associate";
  if (v === "master" || /ارشد|فوقلیسانس/.test(v)) return "master";
  if (v === "phd" || /دکتر/.test(v)) return "phd";
  if (v === "bachelor" || /کارشناسی|لیسانس/.test(v)) return "bachelor";
  if (v === "diploma" || /دیپلم/.test(v)) return "diploma";

  return invalid(row, "مقطع تحصیلی ناشناخته است.");
}

function maritalValue(
  value: unknown,
  row: number,
): NonNullable<ImportPatch["maritalStatus"]> {
  const v = label(value);
  if (v === "married" || v.includes("متاهل")) return "married";
  if (v === "single" || v.includes("مجرد")) return "single";
  return invalid(row, "وضعیت تأهل ناشناخته است.");
}

function veteranValue(
  value: unknown,
  row: number,
): NonNullable<ImportPatch["veteranStatus"]> {
  const v = label(value);

  if (v === "none" || v === "عادی" || v === "خیر" || v.includes("غیرایثارگر")) {
    return "none";
  }

  const level = v.match(/(?:level[_-]?|سطح)([123])/);
  if (level) {
    return `level_${level[1]}` as "level_1" | "level_2" | "level_3";
  }

  // وقتی فایل فقط «ایثارگر» گفته و سطحی مشخص نکرده است.
  if (/ایثارگر|جانباز|رزمنده|رزمندگان|خانوادهشهدا/.test(v)) {
    return "level_1";
  }

  return invalid(row, "وضعیت ایثارگری ناشناخته است.");
}

function booleanValue(value: unknown, row: number): boolean {
  const v = label(value);
  if (["بله", "دارد", "1", "true", "yes"].includes(v)) return true;
  if (["خیر", "ندارد", "0", "false", "no"].includes(v)) return false;
  return invalid(row, "برای این فایل مقدار «بله» یا «خیر» وارد کنید.");
}

function patchForRow(
  type: MemberImportType,
  cells: unknown[],
  row: number,
): ImportPatch {
  // ۱. حالت نام‌ها (۳ ستون)
  if (type === "names") {
    const firstName = text(cells[1]);
    const lastName = text(cells[2]);
    if (!firstName || !lastName) {
      invalid(row, "نام و نام خانوادگی هر دو الزامی هستند.");
    }
    return { firstName, lastName, fullName: `${firstName} ${lastName}` };
  }

  // ۲. حالت وام‌ها (فقط ستون ۱) - بدون نیاز به ستون دوم
  if (type === "hasShortLoan") return { hasShortLoan: true };
  if (type === "hasLongLoan") return { hasLongLoan: true };

  // ۳. بقیه موارد (سایر فایل‌ها که ستون دوم دارند)
  const value = cells[1];
  if (text(value) === "") {
    invalid(row, "مقدار ستون دوم خالی است.");
  }

  switch (type) {
    case "memberDeposit":
      return { memberDeposit: depositValue(value, row) };
    case "employerDeposit":
      return { employerDeposit: depositValue(value, row) };
    case "evaluationScore1":
      return { evaluationScore1: decimalValue(value, row) };
    case "evaluationScore2":
      return { evaluationScore2: decimalValue(value, row) };
    case "evaluationScore3":
      return { evaluationScore3: decimalValue(value, row) };
    case "educationLevel":
      return { educationLevel: educationValue(value, row) };
    case "maritalStatus":
      return { maritalStatus: maritalValue(value, row) };
    case "childrenCount": {
      const count = decimalValue(value, row);
      if (!Number.isInteger(count) || count < 0 || count > 2147483647) {
        invalid(row, "تعداد فرزندان باید عدد صحیح باشد.");
      }
      return { childrenCount: count };
    }
    case "veteranStatus":
      return { veteranStatus: veteranValue(value, row) };
    case "workExperienceYears": {
      const years = decimalValue(value, row);
      if (years < 0) invalid(row, "سابقه کار نمی‌تواند منفی باشد.");
      return { workExperienceYears: years };
    }
    case "fundMembershipYears": {
      const years = decimalValue(value, row);
      if (years < 0) invalid(row, "سابقه عضویت نمی‌تواند منفی باشد.");
      return { fundMembershipYears: years };
    }
  }
  return {}; // Default fall-through
}

export async function importMembersFromExcel(formData: FormData) {
  try {
    const file = formData.get("file");
    const selectedType = formData.get("importType");

    if (!(file instanceof File) || file.size === 0) {
      return { success: false, message: "فایل اکسل انتخاب نشده است." };
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      return {
        success: false,
        message: "فقط فایل xlsx یا xls پذیرفته می‌شود.",
      };
    }

    if (
      typeof selectedType !== "string" ||
      !MEMBER_IMPORT_TYPES.some((item) => item.value === selectedType)
    ) {
      return { success: false, message: "نوع فایل را انتخاب کنید." };
    }

    const type = selectedType as MemberImportType;
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const ref = worksheet?.["!ref"];

    if (!ref) {
      return { success: false, message: "شیت اول فایل خالی است." };
    }

    const firstRow = XLSX.utils.decode_range(ref).s.r + 1;

    // header: 1 => ردیف اول نیز داده است؛ هیچ هدر الزامی نیست.
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
    });

    const entries: Array<{ employeeCode: string; patch: ImportPatch }> = [];
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i];
      if (cells.every((cell) => text(cell) === "")) continue;

      const rowNumber = firstRow + i;
      const employeeCode = text(cells[0]);

      if (!employeeCode) invalid(rowNumber, "کد پرسنلی ستون اول خالی است.");
      if (seen.has(employeeCode)) {
        invalid(
          rowNumber,
          `کد پرسنلی ${employeeCode} در همین فایل تکراری است.`,
        );
      }

      const expectedColumns =
        type === "names"
          ? 3
          : type === "hasShortLoan" || type === "hasLongLoan"
            ? 1
            : 2;

      if (cells.slice(expectedColumns).some((cell) => text(cell) !== "")) {
        invalid(rowNumber, `این نوع فایل فقط ${expectedColumns} ستون دارد.`);
      }

      seen.add(employeeCode);
      entries.push({
        employeeCode,
        patch: patchForRow(type, cells, rowNumber),
      });
    }

    if (entries.length === 0) {
      return { success: false, message: "هیچ ردیف داده‌ای در فایل یافت نشد." };
    }

    // اعتبارسنجی همه ردیف‌ها پیش از شروع نوشتن انجام شده است.
    // تراکنش باعث می‌شود خطای دیتابیس، تغییرات همان فایل را برگرداند.
    await db.$transaction(
      async (tx) => {
        for (const { employeeCode, patch } of entries) {
          await tx.member.upsert({
            where: { employeeCode },
            update: patch,
            create: {
              employeeCode,
              fullName: `کاربر ${employeeCode}`,
              ...patch,
            },
          });
        }
      },
      { maxWait: 10000, timeout: 120000 },
    );

    revalidatePath("/members");

    return {
      success: true,
      message: `${entries.length} ردیف از فایل «${
        MEMBER_IMPORT_TYPES.find((item) => item.value === type)?.label
      }» ثبت/به‌روزرسانی شد.`,
    };
  } catch (error) {
    console.error("Excel import error:", error);

    return {
      success: false,
      message:
        error instanceof ImportValidationError
          ? error.message
          : "درون‌ریزی انجام نشد؛ فایل و اتصال دیتابیس را بررسی کنید.",
    };
  }
}
