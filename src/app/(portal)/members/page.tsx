import { connection } from "next/server";
import { db } from "@/lib/db";
import MembersView from "./MembersView";

export default async function MembersPage() {
  // اجرای صفحه به درخواست واقعی کاربر وابسته باشد
  await connection();

  const rawMembers = await db.member.findMany({
    orderBy: { createdAt: "desc" },
  });

  // تبدیل مقادیر BigInt و Date به انواع داده قابل انتقال به Client Component
  const members = rawMembers.map((m) => ({
    id: m.id,
    employeeCode: m.employeeCode,
    nationalId: m.nationalId,
    fullName: m.fullName,
    department: m.department || "تعیین‌نشده",
    maritalStatus: m.maritalStatus,
    childrenCount: m.childrenCount,
    veteranStatus: m.veteranStatus,
    educationLevel: m.educationLevel,
    savingsBalance: Number(m.savingsBalance),
    previousLoansCount: m.previousLoansCount,
    previousLoansSum: Number(m.previousLoansSum),
    status: m.status,
    hireDate: m.hireDate.toISOString().split("T")[0],
    membershipDate: m.membershipDate.toISOString().split("T")[0],
  }));

  return <MembersView initialMembers={members} />;
}
