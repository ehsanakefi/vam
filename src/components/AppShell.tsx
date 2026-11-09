// src/components/AppShell.tsx
"use client";

import { useState, Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "./ui";
import { PeriodSelector, PeriodOption } from "./PeriodSelector";

const navItems = [
  { path: "/dashboard", label: "داشبورد مدیریتی", icon: LayoutDashboard },
  { path: "/queue", label: "صف اولویت‌بندی", icon: WalletCards },
  { path: "/members", label: "پرسنل و اعضا", icon: Users },
  { path: "/periods", label: "دوره‌ها و بودجه", icon: CalendarRange },
];

interface AppShellProps {
  children: ReactNode;
  periods?: PeriodOption[];
}

// بدنه اصلی شل که از هوک‌های کلاینتی استفاده می‌کند
function AppShellContent({ children, periods = [] }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const searchParams = useSearchParams();
  const currentPeriodId = searchParams.get("periodId");

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const handleLogout = () => {
    router.push("/login");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-72 flex-col border-l border-slate-200 bg-slate-950 text-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-24 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-teal-400 text-slate-950">
              <WalletCards className="size-6" />
            </div>
            <div>
              <p className="font-bold">راهکار وام</p>
              <p className="text-xs text-slate-400">پرتال رفاه کارکنان</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-white lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <p className="mb-3 px-3 pt-3 text-xs font-medium text-slate-500">
            منوی اصلی
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            // حفظ periodId در لینک در صورت وجود
            const href = currentPeriodId
              ? `${item.path}?periodId=${currentPeriodId}`
              : item.path;

            return (
              <Link
                key={item.path}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 text-sm font-semibold transition duration-200 ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="m-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-teal-400 font-bold text-slate-950">
              م‌ن
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">مدیر سامانه</p>
              <p className="text-xs text-slate-400">super_admin</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 transition hover:text-rose-400"
              title="خروج از سامانه"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pr-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              className="lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </Button>

            {/* کامپوننت انتخاب دوره */}
            <PeriodSelector periods={periods} />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" aria-label="اعلان‌ها" className="relative">
              <Bell className="size-5" />
              <span className="absolute left-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-screen-2xl p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

// خروجی کامپوننت احاطه‌شده با Suspense جهت پشتیبانی از useSearchParams
export function AppShell(props: AppShellProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <AppShellContent {...props} />
    </Suspense>
  );
}
