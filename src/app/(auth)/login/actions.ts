// src/app/login/actions.ts
"use server";

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function loginAction(formData: FormData) {
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;
  const remember = formData.get("remember") === "true";

  if (!username || !password) {
    return { success: false, error: "نام کاربری و رمز عبور الزامی است." };
  }

  // ۱. بررسی کاربر در دیتابیس
  const user = await db.user.findUnique({
    where: { username, isActive: true },
  });

  if (!user) {
    return { success: false, error: "نام کاربری یا رمز عبور اشتباه است." };
  }

  // ۲. بررسی صحت پسورد هش‌شده با bcrypt
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return { success: false, error: "نام کاربری یا رمز عبور اشتباه است." };
  }

  // ۳. ایجاد توکن امن
  const token = crypto.randomBytes(32).toString("hex");
  const duration = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // ۳۰ روز یا ۱ روز
  const expiresAt = new Date(Date.now() + duration);

  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  // ۴. تنظیم کوکی امن
  const cookieStore = await cookies();
  cookieStore.set("session_token", token, {
    httpOnly: true, // غیرقابل دسترسی از طریق اسکریپت‌های کلاینت (ضد XSS)
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // محافظت در برابر CSRF
    expires: expiresAt,
    path: "/",
  });

  return { success: true };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (token) {
    await db.session.deleteMany({ where: { token } });
  }

  cookieStore.delete("session_token");
}
