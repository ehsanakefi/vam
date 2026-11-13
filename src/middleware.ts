// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname.startsWith("/login");
  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/members") ||
    pathname.startsWith("/periods") ||
    pathname.startsWith("/applications");

  // ۱. اگر کاربر لاگین نکرده و می‌خواهد وارد صفحات پنل شود -> ریدایرکت به لاگین
  if (!token && isProtectedPage) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ۲. اگر کاربر قبلاً لاگین کرده و به صفحه لاگین مراجعه می‌کند -> ریدایرکت به داشبورد
  if (token && isLoginPage) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/members/:path*",
    "/queue/:path*",
    "/periods/:path*",
  ],
};
