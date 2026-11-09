// src/components/PeriodSelector.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

export interface PeriodOption {
  id: string;
  title: string;
  isActive: boolean;
}

interface PeriodSelectorProps {
  periods: PeriodOption[];
}

export function PeriodSelector({ periods }: PeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // دوره انتخاب‌شده جاری: اگر در URL بود از URL؛ در غیر این صورت دوره فعال یا اولین رکورد
  const currentPeriodId =
    searchParams.get("periodId") ||
    periods.find((p) => p.isActive)?.id ||
    periods[0]?.id ||
    "";

  const selectedPeriod = periods.find((p) => p.id === currentPeriodId);

  const handlePeriodChange = (newPeriodId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPeriodId) {
      params.set("periodId", newPeriodId);
    } else {
      params.delete("periodId");
    }
    // تغییر URL بدون ریلود کل صفحه اما با رفرش سرورکامپوننت‌ها
    router.push(`${pathname}?${params.toString()}`);
  };

  if (periods.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
        <span className="size-2 rounded-full bg-slate-300" />
        دوره‌ای تعریف نشده
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/90 px-3.5 py-2 transition hover:bg-slate-100 focus-within:ring-2 focus-within:ring-teal-500/20">
        {/* نقطه وضعیت: اگر دوره فعال رسمی سامانه است سبز درخشان، در غیر این صورت خاکستری */}
        <span
          className={`size-2 rounded-full ${
            selectedPeriod?.isActive
              ? "bg-emerald-500 animate-pulse"
              : "bg-slate-400"
          }`}
        />

        {/* عنوان دوره جاری انتخابی مستقیماً نمایش داده می‌شود */}
        <select
          value={currentPeriodId}
          onChange={(e) => handlePeriodChange(e.target.value)}
          className="cursor-pointer appearance-none bg-transparent pr-1 pl-6 text-xs font-bold text-slate-800 outline-none"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} {p.isActive ? "(دوره جاری)" : "(بایگانی)"}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute left-3 size-3.5 text-slate-400" />
      </div>
    </div>
  );
}
