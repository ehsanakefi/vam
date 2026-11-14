// src/app/login/actions.ts
"use server";

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "true";

  if (!username || !password) {
    return {
      success: false,
      error: "نام کاربری و رمز عبور الزامی است.",
    };
  }

  const user = await db.user.findFirst({
    where: {
      username,
      isActive: true,
    },
  });

  if (!user) {
    return {
      success: false,
      error: "نام کاربری یا رمز عبور اشتباه است.",
    };
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    return {
      success: false,
      error: "نام کاربری یا رمز عبور اشتباه است.",
    };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const durationSeconds = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  const expiresAt = new Date(Date.now() + durationSeconds * 1000);

  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  const cookieStore = await cookies();

  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    expires: expiresAt,
    maxAge: durationSeconds,
    path: "/",
  });

  return { success: true };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (token) {
    await db.session.deleteMany({
      where: { token },
    });
  }

  // حذف کوکی نشست
  cookieStore.delete("session_token");

  // در Server Action از redirect استفاده می‌شود، نه useRouter
  redirect("/login");
}
