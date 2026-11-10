import { db } from "@/lib/db";
import { unstable_noStore as noStore } from "next/cache";

export async function getMembersForView() {
  noStore(); // تضمین می‌کند همیشه داده تازه خوانده می‌شود

  const rawMembers = await db.member.findMany({
    orderBy: { createdAt: "desc" },
  });

  // انجام عملیات مپینگ در اینجا برای تمیز ماندن صفحه
  return rawMembers.map((m) => ({
    id: m.id,
    employeeCode: m.employeeCode,
    nationalId: m.nationalId ?? "",
    fullName: m.fullName,
    department: m.department || "تعیین‌نشده",
    maritalStatus: m.maritalStatus,
    childrenCount: m.childrenCount,
    veteranStatus: m.veteranStatus,
    educationLevel: m.educationLevel,
    // savingsBalance: Number(m.savingsBalance ? m.savingsBalance : 0),
    previousLoansCount: m.previousLoansCount,
    previousLoansSum: Number(m.previousLoansSum),
    status: m.status,
    hireDate: m.hireDate ? m.hireDate.toISOString().split("T")[0] : "",
    membershipDate: m.membershipDate
      ? m.membershipDate.toISOString().split("T")[0]
      : "",
  }));
}
