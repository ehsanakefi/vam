export const MEMBER_IMPORT_TYPES = [
  { value: "names", label: "نام و نام خانوادگی" },
  { value: "memberDeposit", label: "پس‌انداز عضو (۵٪)" },
  { value: "employerDeposit", label: "پس‌انداز کارفرما (۷٪)" },
  { value: "evaluationScore1", label: "امتیاز ارزشیابی ۱" },
  { value: "evaluationScore2", label: "امتیاز ارزشیابی ۲" },
  { value: "evaluationScore3", label: "امتیاز ارزشیابی ۳" },
  { value: "educationLevel", label: "مقطع تحصیلی" },
  { value: "maritalStatus", label: "وضعیت تأهل" },
  { value: "childrenCount", label: "تعداد فرزندان" },
  { value: "veteranStatus", label: "وضعیت ایثارگری" },
  { value: "workExperienceYears", label: "سابقه کار" },
  { value: "fundMembershipYears", label: "سابقه عضویت در صندوق" },
  {
    value: "shortLoan",
    label: "حضور در فهرست وام کوتاه‌مدت دریافت کرده اند",
  },
  { value: "longLoan", label: "حضور در فهرست وام بلندمدت دریافت کرده اند" },
] as const;

export type MemberImportType = (typeof MEMBER_IMPORT_TYPES)[number]["value"];
