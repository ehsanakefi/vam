// src/app/dashboard/DashboardView.tsx
"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Clock3,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, Button, PageTitle, Progress } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { compactMoney, fa, money, today } from "@/lib/utils";
import { useRouter } from "next/navigation";

const chartColors = ["#0f766e", "#14b8a6", "#5eead4", "#99f6e4", "#ccfbf1"];

export default function DashboardView({ data }: { data: any }) {
  const router = useRouter();
  const current = data.period;
  const used = Math.min(
    100,
    Math.round((current.consumed / (current.budget || 1)) * 100),
  );

  return (
    <>
      <PageTitle
        title="نمای کلی تسهیلات"
        description={today()}
        action={
          <Button variant="secondary" onClick={() => router.refresh()}>
            <RefreshCw className="size-4 ml-1.5" />
            به‌روزرسانی داده‌ها
          </Button>
        }
      />

      {/* کارتهای آمار کلیدی */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="sm:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="metric-label">بودجه کل دوره ({current.title})</p>
              <p className="metric-value">
                {compactMoney(current.budget)} <small>تومان</small>
              </p>
            </div>
            <span className="icon-box bg-teal-50 text-teal-700">
              <Banknote className="size-5" />
            </span>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs">
              <span>مصرف شده: {compactMoney(current.consumed)}</span>
              <span className="font-bold text-teal-700">
                {fa.format(used)}٪
              </span>
            </div>
            <Progress value={used} tone={used > 90 ? "amber" : "teal"} />
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {compactMoney(Math.max(0, current.budget - current.consumed))} تومان
            مانده تا پایان دوره
          </p>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="metric-label">متقاضیان فعال</p>
              <p className="metric-value">
                {fa.format(data.stats.activeApplicants)} <small>نفر</small>
              </p>
            </div>
            <span className="icon-box bg-amber-50 text-amber-700">
              <Clock3 className="size-5" />
            </span>
          </div>
          <p className="metric-trend mt-5">
            {fa.format(data.stats.newThisWeek)} درخواست جدید در این هفته
          </p>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="metric-label">درخواست اضطراری</p>
              <p className="metric-value">
                {fa.format(data.stats.emergency)} <small>مورد</small>
              </p>
            </div>
            <span className="icon-box bg-rose-50 text-rose-700">
              <AlertTriangle className="size-5" />
            </span>
          </div>
          <p className="mt-5 text-xs font-medium text-rose-600">
            {fa.format(data.stats.emergency)} مورد نیازمند بررسی فوری
          </p>
        </Card>
      </div>

      {/* نمودارها */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="section-heading flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                توزیع درخواست‌ها بر اساس واحد
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                مقایسه تعداد متقاضیان در دوره فعال
              </p>
            </div>
            <UsersRound className="size-5 text-slate-400" />
          </div>
          <div className="mt-5 h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.departmentData}
                layout="vertical"
                margin={{ left: 15, right: 15 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  type="number"
                  tick={{ fontFamily: "Vazirmatn, sans-serif", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={90}
                  tick={{ fontFamily: "Vazirmatn, sans-serif", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    fontFamily: "Vazirmatn, sans-serif",
                    direction: "rtl",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#0f766e"
                  radius={[0, 8, 8, 0]}
                  barSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="section-heading flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">پراکندگی امتیازها</h2>
              <p className="text-xs text-slate-400 mt-1">
                تعداد متقاضی در بازه امتیازی
              </p>
            </div>
            <ShieldCheck className="size-5 text-slate-400" />
          </div>
          <div className="mt-5 h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.scoreData}>
                <XAxis
                  dataKey="range"
                  tick={{ fontFamily: "Vazirmatn, sans-serif", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    fontFamily: "Vazirmatn, sans-serif",
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 3, 3]}>
                  {data.scoreData.map((_: any, index: number) => (
                    <Cell
                      key={index}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* جدول صف اولویت‌بندی */}
      <Card className="mt-4 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6">
          <div>
            <h2 className="font-bold text-slate-900">صف اولویت‌بندی اخیر</h2>
            <p className="mt-1 text-xs text-slate-500">
              پنج متقاضی با بالاترین امتیاز
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link
              href="/applications"
              className="inline-flex items-center gap-1.5"
            >
              مشاهده همه
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>رتبه</th>
                <th>متقاضی</th>
                <th>واحد</th>
                <th>مبلغ درخواستی</th>
                <th>امتیاز</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {data.topQueue.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-6 text-slate-400 text-sm"
                  >
                    هنوز درخواستی در این دوره ثبت نشده است.
                  </td>
                </tr>
              ) : (
                data.topQueue.map((item: any) => (
                  <tr key={item.id}>
                    <td>
                      <span className="rank">{fa.format(item.rank || 0)}</span>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-900">
                        {item.member.fullName}
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.member.employeeCode}
                      </div>
                    </td>
                    <td>{item.member.department}</td>
                    <td>{money(item.requestedAmount)}</td>
                    <td>
                      <strong className="text-teal-700">
                        {fa.format(item.score)}
                      </strong>
                      <span className="text-xs text-slate-400"> / ۱۰۰</span>
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
