// src/lib/scoring.ts
import { EducationLevel, MaritalStatus, VeteranStatus } from "@prisma/client";

export interface ScoringMemberData {
  id: string;
  fullName: string;
  employeeCode: string;
  maritalStatus: MaritalStatus;
  childrenCount: number;
  veteranStatus: VeteranStatus;
  educationLevel: EducationLevel;
  hireDate: Date;
  membershipDate: Date;
  memberDeposit: bigint;
  employerDeposit: bigint;
  evaluations: { score: number }[]; // نمرات ارزیابی ۳ سال اخیر
  hasActiveLoan: boolean; // آیا در شیت وام‌های تسویه‌نشده هست؟
  workExperienceYears?: number | null;
  fundMembershipYears?: number | null;
}

export interface ScoreBreakdown {
  maritalScore: number;
  childrenScore: number;
  veteranScore: number;
  educationScore: number;
  workHistoryScore: number;
  membershipScore: number;
  performanceScore: number;
  depositScore: number;
  totalScore: number;
}

// ۱. محاسبه اختلاف سال از روی تاریخ میلادی/شمسی ذخیره شده
function getYearsDiff(pastDate: Date, today = new Date()): number {
  const diffTime = Math.max(0, today.getTime() - new Date(pastDate).getTime());
  return diffTime / (1000 * 60 * 60 * 24 * 365.25);
}

// ۲. محاسبه فاکتورهای مستقل
export function calculateMemberScore(
  member: ScoringMemberData,
  maxTotalDeposit: number,
): ScoreBreakdown {
  // ۱) امتیاز تاهل: متاهل ۶، مجرد ۳
  const maritalScore = member.maritalStatus === "married" ? 6 : 3;

  // ۲) امتیاز فرزندان: حداکثر ۳
  const childrenScore = Math.min(member.childrenCount, 3);

  // ۳) امتیاز ایثارگری
  let veteranScore = 0;
  switch (member.veteranStatus) {
    case "level_1": // رزمنده، جانباز زیر ۲۵، فرزند جانباز
      veteranScore = 5;
      break;
    case "level_2": // جانباز ۲۵ تا ۵۰ درصد
      veteranScore = 7;
      break;
    case "level_3": // آزاده، جانباز بالای ۵۰، خانواده درجه یک شهدا
      veteranScore = 9;
      break;
    default:
      veteranScore = 0;
  }

  // ۴) امتیاز مدرک تحصیلی
  let educationScore = 2;
  switch (member.educationLevel) {
    case "phd":
    case "master":
      educationScore = 10;
      break;
    case "bachelor":
      educationScore = 8;
      break;
    case "associate":
      educationScore = 6;
      break;
    case "diploma":
      educationScore = 4;
      break;
    case "below_diploma":
    default:
      educationScore = 2;
  }

  // ۵) سابقه کار: حداکثر ۳۰ امتیاز
  const workYears = member.workExperienceYears ?? getYearsDiff(member.hireDate);
  const workHistoryScore = Number(Math.min(workYears, 30).toFixed(2));

  // ۶) سابقه عضویت در صندوق: هر سال ۰.۴، حداکثر ۱۲ امتیاز
  const membershipYears =
    member.fundMembershipYears ?? getYearsDiff(member.membershipDate);
  const membershipScore = Number(
    Math.min(membershipYears * 0.4, 12).toFixed(2),
  );

  // ۷) امتیاز رضایت‌مندی شرکت: (مجموع نمرات ۳ سال) تقسیم بر ۹
  // اگر نمره‌ای ثبت نشده باشد ۰ فرض می‌شود
  const sumScores = member.evaluations.reduce(
    (acc, curr) => acc + curr.score,
    0,
  );
  const performanceScore = Number((sumScores / 9).toFixed(2));

  // ۸) امتیاز سرمایه (۵ درصد + ۷ درصد): نرمال‌شده تا سقف ۲۰ امتیاز
  const memberTotalSavings = Number(
    member.memberDeposit + member.employerDeposit,
  );
  const depositScore =
    maxTotalDeposit > 0
      ? Number(((memberTotalSavings / maxTotalDeposit) * 20).toFixed(2))
      : 0;

  // جمع کل امتیازها
  const totalScore = Number(
    (
      maritalScore +
      childrenScore +
      veteranScore +
      educationScore +
      workHistoryScore +
      membershipScore +
      performanceScore +
      depositScore
    ).toFixed(2),
  );

  return {
    maritalScore,
    childrenScore,
    veteranScore,
    educationScore,
    workHistoryScore,
    membershipScore,
    performanceScore,
    depositScore,
    totalScore,
  };
}
