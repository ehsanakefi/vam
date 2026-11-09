"use client";

import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Pencil,
  Plus,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  Input,
  Modal,
  PageTitle,
  Progress,
} from "@/components/ui";
import { compactMoney, fa } from "@/lib/utils";
import { createPeriod, editPeriod } from "./actions";

interface PeriodItem {
  id: string;
  title: string;
  budget: number;
  consumed: number;
  active: boolean;
  startDate: string;
  endDate: string;
  startDateIso: string; // اضافه شد
  endDateIso: string; // اضافه شد
}

export default function PeriodsView({
  initialPeriods,
}: {
  initialPeriods: PeriodItem[];
}) {
  // استفاده از یک state برای مدیریت باز بودن مودال (چه برای ایجاد چه ویرایش)
  // اگر null باشد یعنی مودال بسته است
  const [editingPeriod, setEditingPeriod] = useState<PeriodItem | null>(null);
  // حالت جداگانه برای ایجاد
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const res = editingPeriod
      ? await editPeriod(editingPeriod.id, formData)
      : await createPeriod(formData);

    setLoading(false);
    if (res.success) {
      toast.success(res.message);
      setEditingPeriod(null);
      setIsCreateOpen(false);
    } else {
      toast.error(res.message);
    }
  }

  return (
    <>
      <PageTitle
        title="دوره‌ها و مدیریت بودجه"
        description="تعریف چرخه‌های پرداخت و پایش مصرف منابع صندوق"
        action={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4 ml-1.5" />
            دوره جدید
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {initialPeriods.map((period) => {
          const percent = Math.min(
            100,
            Math.round((period.consumed / (period.budget || 1)) * 100),
          );

          return (
            <Card
              key={period.id}
              className={
                period.active ? "ring-2 ring-teal-600 ring-offset-2" : ""
              }
            >
              <div className="flex items-start justify-between">
                <span
                  className={`icon-box ${
                    period.active
                      ? "bg-teal-50 text-teal-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <WalletCards className="size-5" />
                </span>
                <div className="flex gap-2 items-center">
                  {/* دکمه ویرایش داخل کارت منتقل شد */}
                  <button
                    onClick={() => setEditingPeriod(period)}
                    className="p-2 text-slate-400 hover:text-teal-600 transition-colors"
                  >
                    <Pencil className="size-4" />
                  </button>
                  {period.active ? (
                    <span className="status status-approved inline-flex items-center gap-1 text-xs">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      دوره فعال
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">پایان‌یافته</span>
                  )}
                </div>
              </div>

              <h2 className="mt-5 text-lg font-bold">{period.title}</h2>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <CalendarDays className="size-4" />
                {period.startDate} تا {period.endDate}
              </div>

              <div className="mt-7">
                <div className="mb-2 flex justify-between text-sm">
                  <span>مصرف بودجه</span>
                  <strong>{fa.format(percent)}٪</strong>
                </div>
                <Progress
                  value={percent}
                  tone={percent > 90 ? "amber" : "teal"}
                />
                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>{compactMoney(period.consumed)} مصرف</span>
                  <span>از {compactMoney(period.budget)}</span>
                </div>
              </div>
            </Card>
          );
        })}

        {initialPeriods.length === 0 && (
          <div className="col-span-full p-12 text-center text-sm text-slate-400">
            هنوز دوره‌ای در سامانه تعریف نشده است.
          </div>
        )}
      </div>

      {(isCreateOpen || editingPeriod) && (
        <Modal
          title={editingPeriod ? "ویرایش دوره" : "ایجاد دوره تسهیلات جدید"}
          onClose={() => {
            setEditingPeriod(null);
            setIsCreateOpen(false);
          }}
        >
          <form
            key={editingPeriod ? editingPeriod.id : "create"}
            className="space-y-4"
            onSubmit={handleSubmit}
          >
            <Field
              name="title"
              label="عنوان دوره"
              placeholder="مثلاً دوره بهار ۱۴۰۴"
              defaultValue={editingPeriod?.title}
              required
            />
            <Field
              name="allocatedBudget"
              label="بودجه تخصیص‌یافته (تومان)"
              placeholder="15000000000"
              type="number"
              defaultValue={editingPeriod?.budget.toString()}
              required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                name="startDate"
                label="تاریخ شروع"
                type="date"
                defaultValue={
                  editingPeriod?.startDateIso ||
                  new Date().toISOString().split("T")[0]
                }
                required
              />
              <Field
                name="endDate"
                label="تاریخ پایان"
                type="date"
                defaultValue={
                  editingPeriod?.endDateIso ||
                  new Date().toISOString().split("T")[0]
                }
                required
              />
            </div>

            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editingPeriod ? editingPeriod.active : true}
                className="size-4 accent-teal-600 rounded"
              />
              این دوره به‌عنوان دوره فعال تنظیم شود
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingPeriod(null);
                  setIsCreateOpen(false);
                }}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? "در حال ذخیره..."
                  : editingPeriod
                    ? "ذخیره تغییرات"
                    : "ایجاد دوره"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Field({
  label,
  placeholder,
  name,
  type = "text",
  required = false,
  defaultValue,
}: {
  label: string;
  placeholder?: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <Input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
      />
    </label>
  );
}
