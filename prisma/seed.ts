// prisma/seed.ts
import "dotenv/config";
import {
  AdminRole,
  ApplicationStatus,
  EducationLevel,
  LoanType,
  MaritalStatus,
  MemberStatus,
  PrismaClient,
  VeteranStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

type RawMember = readonly [
  name: string,
  department: string,
  education: EducationLevel,
  maritalStatus: MaritalStatus,
  childrenCount: number,
  veteranStatus: VeteranStatus,
  totalScore: number,
  isEmergency: boolean,
];

const rawMembers: RawMember[] = [
  [
    "احسان مرادی",
    "فناوری اطلاعات",
    EducationLevel.master,
    MaritalStatus.married,
    2,
    VeteranStatus.none,
    94.5,
    false,
  ],
  [
    "زهرا سلیمانی",
    "مالی و حسابداری",
    EducationLevel.bachelor,
    MaritalStatus.married,
    1,
    VeteranStatus.level_3,
    91.0,
    true,
  ],
  [
    "محمدحسین رضایی",
    "بهره‌برداری و فنی",
    EducationLevel.master,
    MaritalStatus.married,
    3,
    VeteranStatus.level_1,
    88.5,
    true,
  ],
  [
    "فاطمه کریمی",
    "منابع انسانی",
    EducationLevel.bachelor,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    85.0,
    false,
  ],
  [
    "علی صادقی",
    "حراست و انتظامات",
    EducationLevel.diploma,
    MaritalStatus.married,
    2,
    VeteranStatus.level_1,
    82.5,
    true,
  ],
  [
    "مریم احمدی",
    "اداری و پشتیبانی",
    EducationLevel.bachelor,
    MaritalStatus.married,
    1,
    VeteranStatus.none,
    79.0,
    false,
  ],
  [
    "رضا قاسمی",
    "فناوری اطلاعات",
    EducationLevel.bachelor,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    76.5,
    false,
  ],
  [
    "نرگس موسوی",
    "مالی و حسابداری",
    EducationLevel.master,
    MaritalStatus.married,
    2,
    VeteranStatus.level_3,
    73.0,
    true,
  ],
  [
    "مهدی باقری",
    "بهره‌برداری و فنی",
    EducationLevel.associate,
    MaritalStatus.married,
    1,
    VeteranStatus.none,
    70.0,
    false,
  ],
  [
    "سارا حسینی",
    "منابع انسانی",
    EducationLevel.master,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    67.5,
    false,
  ],
  [
    "علیرضا نجفی",
    "حراست و انتظامات",
    EducationLevel.diploma,
    MaritalStatus.married,
    3,
    VeteranStatus.none,
    64.0,
    false,
  ],
  [
    "زینب ابراهیمی",
    "اداری و پشتیبانی",
    EducationLevel.bachelor,
    MaritalStatus.married,
    2,
    VeteranStatus.none,
    61.5,
    true,
  ],
  [
    "حسین توکلی",
    "بهره‌برداری و فنی",
    EducationLevel.bachelor,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    58.0,
    false,
  ],
  [
    "امیرمحمد میرزایی",
    "فناوری اطلاعات",
    EducationLevel.master,
    MaritalStatus.married,
    1,
    VeteranStatus.none,
    55.0,
    false,
  ],
  [
    "سمیه عباسی",
    "مالی و حسابداری",
    EducationLevel.bachelor,
    MaritalStatus.married,
    2,
    VeteranStatus.none,
    52.5,
    false,
  ],
  [
    "وحید اکبری",
    "بهره‌برداری و فنی",
    EducationLevel.diploma,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    49.0,
    false,
  ],
  [
    "الهام حیدری",
    "منابع انسانی",
    EducationLevel.bachelor,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    46.5,
    false,
  ],
  [
    "پیمان نوری",
    "حراست و انتظامات",
    EducationLevel.associate,
    MaritalStatus.married,
    1,
    VeteranStatus.none,
    42.0,
    false,
  ],
  [
    "فرزانه یوسفی",
    "اداری و پشتیبانی",
    EducationLevel.bachelor,
    MaritalStatus.married,
    1,
    VeteranStatus.none,
    39.5,
    true,
  ],
  [
    "محمود داوودی",
    "بهره‌برداری و فنی",
    EducationLevel.diploma,
    MaritalStatus.married,
    2,
    VeteranStatus.none,
    36.0,
    false,
  ],
  [
    "رویا رستمی",
    "فناوری اطلاعات",
    EducationLevel.bachelor,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    32.5,
    false,
  ],
  [
    "بهزاد رحیمی",
    "مالی و حسابداری",
    EducationLevel.bachelor,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    28.0,
    false,
  ],
  [
    "سعید خسروی",
    "حراست و انتظامات",
    EducationLevel.diploma,
    MaritalStatus.married,
    1,
    VeteranStatus.none,
    23.5,
    false,
  ],
  [
    "مونا کاظمی",
    "اداری و پشتیبانی",
    EducationLevel.diploma,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    18.0,
    false,
  ],
  [
    "آرش طاهری",
    "بهره‌برداری و فنی",
    EducationLevel.diploma,
    MaritalStatus.single,
    0,
    VeteranStatus.none,
    12.5,
    false,
  ],
];

function currentJalaliYear(date: Date): number {
  const year = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    year: "numeric",
    timeZone: "Asia/Tehran",
  })
    .formatToParts(date)
    .find((part) => part.type === "year")?.value;

  const result = Number(year);
  if (!Number.isInteger(result)) {
    throw new Error("محاسبه سال شمسی ناموفق بود.");
  }
  return result;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("اجرای Seed پاک‌کننده در محیط production مجاز نیست.");
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD را با حداقل ۱۲ کاراکتر تنظیم کنید.");
  }

  const now = new Date();
  const jalaliYear = currentJalaliYear(now);
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // همه عملیات یا کامل ثبت می‌شوند یا در صورت خطا بازگردانده می‌شوند.
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.loanApplication.deleteMany();
      await tx.performanceEvaluation.deleteMany();
      await tx.loanPeriod.deleteMany();
      await tx.member.deleteMany();
      await tx.session.deleteMany();
      await tx.user.deleteMany();

      await tx.user.create({
        data: {
          username: "admin",
          fullName: "مدیر سامانه",
          passwordHash: hashedPassword,
          role: AdminRole.super_admin,
          isActive: true,
        },
      });

      const period = await tx.loanPeriod.create({
        data: {
          title: `تسهیلات رفاهی آزمایشی ${jalaliYear}`,
          allocatedBudget: 5_000_000_000n,
          consumedBudget: 0n,
          startDate: new Date(now.getTime() - 30 * DAY),
          endDate: new Date(now.getTime() + 30 * DAY),
          isActive: true,
        },
      });

      let paidAmount = 0n;

      for (let i = 0; i < rawMembers.length; i++) {
        const [
          name,
          department,
          education,
          maritalStatus,
          childrenCount,
          veteranStatus,
          totalScore,
          isEmergency,
        ] = rawMembers[i];

        const index = i + 1;
        const requestedAmount = BigInt((50 + (i % 11) * 10) * 1_000_000);
        const isAwarded = i < 3;
        const isApproved = i < 5;

        if (isAwarded) paidAmount += requestedAmount;

        await tx.member.create({
          data: {
            employeeCode: String(1000 + index),
            nationalId: `00${index}9876543`.slice(-10), // شناسه آزمایشی
            fullName: name,
            department,
            educationLevel: education,
            maritalStatus,
            childrenCount,
            veteranStatus,
            hireDate: new Date("2018-05-15T00:00:00Z"),
            membershipDate: new Date("2019-01-10T00:00:00Z"),

            // موجودی‌های آزمایشی مستقل از درصدهای ۵ و ۷
            memberDeposit: BigInt((15 + (i % 10)) * 1_000_000),
            employerDeposit: BigInt((20 + (i % 10)) * 1_000_000),

            previousLoansCount: i % 3,
            previousLoansSum: BigInt((i % 3) * 50_000_000),
            status: MemberStatus.active,

            // سه سال شمسی پیش از سال جاری؛ داده‌ها صرفاً آزمایشی‌اند.
            evaluations: {
              create: [1, 2, 3].map((yearsAgo) => ({
                year: jalaliYear - yearsAgo,
                score: 85 + (i % 13) - yearsAgo,
              })),
            },

            applications: {
              create: {
                period: { connect: { id: period.id } },
                loanType:
                  i % 2 === 0 ? LoanType.short_term : LoanType.long_term,
                hasActiveLoan: isAwarded,
                requestedAmount,
                approvedAmount: isApproved ? requestedAmount : null,
                score: totalScore,
                rank: index,
                status: isAwarded
                  ? ApplicationStatus.awarded
                  : isApproved
                    ? ApplicationStatus.approved
                    : ApplicationStatus.queued,
                isEmergency,
                appliedAt: new Date(
                  now.getTime() - (i % 5 === 0 ? 2 : 10) * DAY,
                ),
                awardedAt: isAwarded ? new Date(now.getTime() - DAY) : null,
              },
            },
          },
        });
      }

      await tx.loanPeriod.update({
        where: { id: period.id },
        data: { consumedBudget: paidAmount },
      });

      return { periodTitle: period.title, paidAmount };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  console.log(`✅ ادمین و ${rawMembers.length} عضو ایجاد شدند.`);
  console.log(`✅ دوره: ${result.periodTitle}`);
  console.log(
    `✅ بودجه مصرف‌شده برای وام‌های پرداختی: ${result.paidAmount} تومان`,
  );
}

main()
  .catch((error) => {
    console.error("❌ خطا در اجرای Seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
