"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  EducationLevel,
  LoanType,
  MaritalStatus,
  VeteranStatus,
} from "@prisma/client";
import {
  isValidJalaaliDate,
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
} from "jalaali-js";
import type { Prisma } from "@prisma/client";
import {
  MEMBER_IMPORT_TYPES,
  type MemberImportType,
} from "@/lib/member-import-types";
import { requireAuth } from "@/lib/auth-guard";
import { syncAndRecalculateQueue } from "../queue/actions";

// ==========================================
// توابع کمکی تاریخ شمسی و انطباق با تقویم ایران
// ==========================================

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

function excelJalaliDate(value: unknown, row: number, today: Date): Date {
  let raw = text(value);

  // در صورتی که تاریخ به صورت اعشار یا عدد سریالی اکسل ذخیره شده باشد
  if (/^\d{5}$/.test(raw)) {
    // تبدیل سریال عددی روز اکسل در صورت وقوع
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(excelEpoch.getTime() + Number(raw) * 86400000);
    const jDate = toJalaali(
      jsDate.getUTCFullYear(),
      jsDate.getUTCMonth() + 1,
      jsDate.getUTCDate(),
    );
    raw = `${jDate.jy}/${jDate.jm}/${jDate.jd}`;
  }

  // پشتیبانی از فرمت‌های 1375.1.2 یا 1375/01/12 یا 1375-1-12
  const match = /^(\d{4})([./-])(\d{1,2})\2(\d{1,2})$/.exec(raw);
  if (!match) {
    invalid(
      row,
      "تاریخ را شمسی معتبر وارد کنید؛ مانند 1398/05/01 یا 1375.01.12",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[3]);
  const day = Number(match[4]);

  if (!isValidJalaaliDate(year, month, day)) {
    invalid(row, "تاریخ شمسی در تقویم معتبر نیست.");
  }

  const date = jalaliDateToUtc(year, month, day);
  if (date > today) {
    invalid(row, "تاریخ شروع نمی‌تواند در آینده باشد.");
  }

  return date;
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

  const fraction =
    next.getTime() === last.getTime()
      ? 0
      : (today.getTime() - last.getTime()) / (next.getTime() - last.getTime());

  return Math.max(0, completedYears + fraction);
}

/**
 * تعیین پرچم‌های واجد شرایط بودن وام بر اساس سابقه عضویت:
 * - کمتر از ۱ سال: هر دو وام غیرفعال
 * - بین ۱ تا ۳ سال: فقط وام کوتاه‌مدت فعال
 * - ۳ سال تمام و بیشتر: هر دو وام فعال
 */
function loanFlagsForMembership(membershipDate: Date, today: Date) {
  const years = jalaliYearsSince(membershipDate, today);

  return {
    fundMembershipYears: Math.round(years * 100) / 100,
    hasShortLoan: years >= 1,
    hasLongLoan: years >= 3, // اصلاح: ۳ سال تمام و بیشتر
  };
}

// ==========================================
// اکشن‌های CRUD اعضا
// ==========================================

export async function createMember(formData: FormData) {
  try {
    await requireAuth();
    const data = Object.fromEntries(formData);
    const today = iranToday();

    const hireDateStr = data.hireDate as string;
    const membershipDateStr = data.membershipDate as string;

    const hireDate = hireDateStr ? new Date(hireDateStr) : today;
    const membershipDate = membershipDateStr
      ? new Date(membershipDateStr)
      : today;

    const workExperienceYears = jalaliYearsSince(hireDate, today);
    const loanFlags = loanFlagsForMembership(membershipDate, today);

    await db.member.create({
      data: {
        employeeCode: String(data.employeeCode).trim(),
        firstName: data.firstName ? String(data.firstName).trim() : null,
        lastName: data.lastName ? String(data.lastName).trim() : null,
        fullName: String(
          data.fullName || `${data.firstName || ""} ${data.lastName || ""}`,
        ).trim(),
        nationalId: data.nationalId ? String(data.nationalId).trim() : null,
        department: data.department ? String(data.department).trim() : null,
        maritalStatus: (data.maritalStatus as MaritalStatus) || "single",
        childrenCount: Number(data.childrenCount) || 0,
        educationLevel: (data.educationLevel as EducationLevel) || "bachelor",
        veteranStatus: (data.veteranStatus as VeteranStatus) || "none",
        status: "active",
        hireDate,
        workExperienceYears: Math.round(workExperienceYears * 100) / 100,
        membershipDate,
        ...loanFlags,
      },
    });

    revalidatePath("/members");
    return { success: true, message: "عضو با موفقیت ثبت شد." };
  } catch (error) {
    return { success: false, message: "خطا در ثبت عضو: " + String(error) };
  }
}

export async function updateMember(id: string, formData: FormData) {
  try {
    await requireAuth();
    const data = Object.fromEntries(formData);

    await db.member.update({
      where: { id },
      data: {
        fullName: data.fullName ? String(data.fullName).trim() : undefined,
        department: data.department
          ? String(data.department).trim()
          : undefined,
        maritalStatus: data.maritalStatus as MaritalStatus,
        childrenCount:
          data.childrenCount !== undefined
            ? Number(data.childrenCount)
            : undefined,
        educationLevel: data.educationLevel as EducationLevel,
        veteranStatus: data.veteranStatus as VeteranStatus,
      },
    });

    revalidatePath("/members");
    return { success: true, message: "اطلاعات با موفقیت به‌روزرسانی شد." };
  } catch (error) {
    return { success: false, message: "خطا در ویرایش: " + String(error) };
  }
}

export async function deleteMember(id: string) {
  try {
    await requireAuth();
    await db.member.delete({ where: { id } });
    revalidatePath("/members");
    return { success: true, message: "عضو با موفقیت حذف شد." };
  } catch (error) {
    return { success: false, message: "خطا در حذف: " + String(error) };
  }
}

export async function toggleMemberStatus(
  id: string,
  status: "active" | "suspended" | "resigned",
) {
  await requireAuth();
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

// ==========================================
// پارسرها و نرمال‌سازی داده‌های اکسل
// ==========================================

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

  if (/ایثارگر|جانباز|رزمنده|رزمندگان|خانوادهشهدا/.test(v)) {
    return "level_1";
  }

  return invalid(row, "وضعیت ایثارگری ناشناخته است.");
}

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
    | "hireDate"
    | "membershipDate"
  >
>;
// اصلاح تابع patchForRow
function patchForRow(
  type: MemberImportType,
  cells: unknown[],
  row: number,
  today: Date,
): ImportPatch {
  // ۱. حالت تک‌ستونه برای فایل‌های وام
  if (type === ("shortLoan" as any)) {
    return { hasShortLoan: true };
  }
  if (type === ("longLoan" as any)) {
    return { hasLongLoan: true };
  }

  // ۲. حالت سه‌ستونه برای نام و نام خانوادگی
  if (type === "names") {
    const firstName = text(cells[1]);
    const lastName = text(cells[2]);

    if (!firstName || !lastName) {
      invalid(row, "نام و نام خانوادگی هر دو الزامی هستند.");
    }

    return {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
    };
  }

  // ۳. برای سایر فایل‌های دو ستونه:
  const value = cells[1];
  if (text(value) === "") {
    invalid(row, "مقدار ستون داده (دوم) خالی است.");
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
      if (!Number.isInteger(count) || count < 0 || count > 20) {
        invalid(row, "تعداد فرزندان باید عدد صحیح بین ۰ تا ۲۰ باشد.");
      }
      return { childrenCount: count };
    }

    case "veteranStatus":
      return { veteranStatus: veteranValue(value, row) };

    case "workExperienceYears": {
      const hireDate = excelJalaliDate(value, row, today);
      const years = jalaliYearsSince(hireDate, today);
      return {
        hireDate,
        workExperienceYears: Math.round(years * 100) / 100,
      };
    }

    case "fundMembershipYears": {
      const membershipDate = excelJalaliDate(value, row, today);
      return {
        membershipDate,
        ...loanFlagsForMembership(membershipDate, today),
      };
    }
  }

  return {};
}

// ==========================================
// پردازش و ورود فایل اکسل
// ==========================================

export async function importMembersFromExcel(formData: FormData) {
  try {
    await requireAuth();
    const file = formData.get("file");
    const selectedType = formData.get("importType");

    if (!(file instanceof File) || file.size === 0) {
      return { success: false, message: "فایل اکسل انتخاب نشده است." };
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      return {
        success: false,
        message: "فقط فایل اکسل با فرمت xlsx یا xls پذیرفته می‌شود.",
      };
    }

    if (
      typeof selectedType !== "string" ||
      !MEMBER_IMPORT_TYPES.some((item) => item.value === selectedType)
    ) {
      return { success: false, message: "نوع فایل درون‌ریزی را انتخاب کنید." };
    }

    const type = selectedType as MemberImportType;
    const today = iranToday();

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const ref = worksheet?.["!ref"];

    if (!ref) {
      return { success: false, message: "شیت اول فایل خالی است." };
    }

    const firstRow = XLSX.utils.decode_range(ref).s.r + 1;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    const parsed: Array<{
      rowNumber: number;
      employeeCode: string;
      patch: ImportPatch;
    }> = [];
    const seen = new Set<string>();

    const isSingleColumn =
      type === ("shortLoan" as any) || type === ("longLoan" as any);
    const expectedColumns = type === "names" ? 3 : isSingleColumn ? 1 : 2;

    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i];
      if (!cells || cells.every((cell) => text(cell) === "")) continue;

      const rowNumber = firstRow + i;
      const employeeCode = text(cells[0]);

      if (!employeeCode) invalid(rowNumber, "کد پرسنلی ستون اول خالی است.");
      if (seen.has(employeeCode)) {
        invalid(
          rowNumber,
          `کد پرسنلی ${employeeCode} در ردیف‌های همین فایل تکراری است.`,
        );
      }

      // بررسی ستون‌های اضافی:
      if (cells.slice(expectedColumns).some((cell) => text(cell) !== "")) {
        invalid(
          rowNumber,
          `این فایل باید دقیقاً ${expectedColumns} ستون داشته باشد.`,
        );
      }

      seen.add(employeeCode);
      parsed.push({
        rowNumber,
        employeeCode,
        patch: patchForRow(type, cells, rowNumber, today),
      });
    }

    if (parsed.length === 0) {
      return {
        success: false,
        message: "هیچ ردیف داده معتبری در فایل یافت نشد.",
      };
    }

    const canCreate = type === "names";

    const existing = await db.member.findMany({
      where: { employeeCode: { in: parsed.map((p) => p.employeeCode) } },
      select: { employeeCode: true },
    });
    const existingCodes = new Set(existing.map((m) => m.employeeCode));

    const toCreate = parsed.filter(
      (p) => canCreate && !existingCodes.has(p.employeeCode),
    );
    const toUpdate = parsed.filter((p) => existingCodes.has(p.employeeCode));
    const skipped = parsed.length - toCreate.length - toUpdate.length;

    if (toCreate.length === 0 && toUpdate.length === 0) {
      return {
        success: false,
        message: `هیچ‌کدام از ${parsed.length} کد پرسنلی فایل در سامانه وجود ندارند. لطفاً ابتدا فایل «نام و نام خانوادگی» را بارگذاری کنید.`,
      };
    }

    // اجرای ترکنش دسته‌ای با ساختار پایدار
    await db.$transaction([
      ...toUpdate.map(({ employeeCode, patch }) =>
        db.member.update({
          where: { employeeCode },
          data: patch,
        }),
      ),
      ...toCreate.map(({ employeeCode, patch }) =>
        db.member.create({
          data: {
            employeeCode,
            status: "active",
            ...patch,
          } as Prisma.MemberUncheckedCreateInput,
        }),
      ),
    ]);
    let approvedLoanCount = 0;
    const isLoanApproval =
      (type as string) === "shortLoan" || (type as string) === "longLoan";

    if (isLoanApproval) {
      // الف) پیدا کردن دوره فعال
      const activePeriod = await db.loanPeriod.findFirst({
        where: { isActive: true },
      });

      if (activePeriod) {
        // ب) استخراج شناسه اعضایی که در فایل حضور داشتند
        const updatedMembers = await db.member.findMany({
          where: { employeeCode: { in: parsed.map((p) => p.employeeCode) } },
          select: { id: true },
        });
        const memberIds = updatedMembers.map((m) => m.id);

        const targetLoanType =
          (type as string) === "longLoan"
            ? LoanType.long_term
            : LoanType.short_term;

        // ج) تغییر وضعیت درخواست‌ها در صف به approved
        const updateResult = await db.loanApplication.updateMany({
          where: {
            periodId: activePeriod.id,
            loanType: targetLoanType,
            memberId: { in: memberIds },
            status: "queued",
          },
          data: {
            status: "approved",
          },
        });

        approvedLoanCount = updateResult.count;

        // د) افزودن یک وام به سابقه وام‌های قبلی اعضا
        await db.member.updateMany({
          where: { id: { in: memberIds } },
          data: {
            previousLoansCount: {
              increment: 1,
            },
          },
        });

        // ه) بازمحاسبه و مرتب‌سازی مجدد صف افراد باقیمانده
        try {
          await syncAndRecalculateQueue(activePeriod.id);
        } catch (queueErr) {
          console.error("Queue recalculation failed:", queueErr);
        }
      }
    }
    revalidatePath("/members");
    revalidatePath("/queue");
    const currentLabel = MEMBER_IMPORT_TYPES.find(
      (item) => item.value === type,
    )?.label;

    // پیام خروجی هوشمند
    if (isLoanApproval) {
      const loanTitle =
        (type as string) === "longLoan" ? "بلندمدت" : "کوتاه‌مدت";
      return {
        success: true,
        message: `${approvedLoanCount} فقره وام ${loanTitle} از صف تأیید شد و رتبه‌بندی صف به‌روزرسانی گردید.`,
      };
    }

    return {
      success: true,
      message:
        `${toUpdate.length} عضو به‌روزرسانی شد` +
        (toCreate.length ? `، ${toCreate.length} عضو جدید افزوده شد` : "") +
        (skipped ? `، ${skipped} کد عضویت ناشناخته نادیده گرفته شد` : "") +
        ` (نوع فایل: ${currentLabel}).`,
    };
    // const currentLabel = MEMBER_IMPORT_TYPES.find(
    //   (item) => item.value === type,
    // )?.label;

    // return {
    //   success: true,
    //   message:
    //     `${toUpdate.length} عضو به‌روزرسانی شد` +
    //     (toCreate.length ? `، ${toCreate.length} عضو جدید افزوده شد` : "") +
    //     (skipped ? `، ${skipped} کد عضویت ناشناخته نادیده گرفته شد` : "") +
    //     ` (نوع فایل: ${currentLabel}).`,
    // };
  } catch (error) {
    console.error("Excel import error:", error);

    return {
      success: false,
      message:
        error instanceof ImportValidationError
          ? error.message
          : "درون‌ریزی انجام نشد؛ ساختار فایل اکسل یا اتصال پایگاه داده را بررسی نمایید.",
    };
  }
}
