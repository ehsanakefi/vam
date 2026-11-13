// src/lib/auth-guard.ts
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    throw new Error("دسترسی غیرمجاز: لطفاً ابتدا وارد سامانه شوید.");
  }

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new Error("نشست منقضی شده است. لطفاً دوباره وارد شوید.");
  }

  // اگر کاربر غیرفعال شده بود
  if (!session.user.isActive) {
    throw new Error("حساب کاربری شما غیرفعال است.");
  }

  return session.user;
}
