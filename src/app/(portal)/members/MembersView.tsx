// src/app/members/MembersView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Plus,
  Search,
  UserRound,
  UsersRound,
  X,
  Trash2,
  Edit3,
  Eye,
} from "lucide-react";
import { MEMBER_IMPORT_TYPES } from "@/lib/member-import-types";

import { toast } from "sonner";
import { MemberStatusBadge } from "@/components/StatusBadge";
import { Button, Card, Input, Modal, PageTitle } from "@/components/ui";
import { educationLabel, fa, money } from "@/lib/utils";
import {
  createMember,
  deleteMember,
  importMembersFromExcel,
  toggleMemberStatus,
  updateMember,
} from "./actions";

export interface MemberItem {
  id: string;
  employeeCode: string;
  nationalId: string | null;
  fullName: string;
  department: string | null;
  educationLevel: string | null;
  maritalStatus: string | null;
  veteranStatus?: string | null;
  childrenCount: number | null;
  savingsBalance?: number | bigint;
  previousLoansCount: number;
  status: string;
  hireDate?: string | Date;
  membershipDate?: string | Date;
}

export default function MembersView({
  initialMembers,
}: {
  initialMembers: MemberItem[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberItem[]>(initialMembers || []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState<"add" | "import" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImportType, setSelectedImportType] = useState("");

  // عضو انتخاب‌شده برای سایدبار راست
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setMembers(initialMembers || []);
  }, [initialMembers]);

  // فیلتر کردن
  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchStatus = status === "all" || member.status === status;
      const matchSearch =
        !trimmed ||
        member.fullName.toLowerCase().includes(trimmed) ||
        String(member.employeeCode).includes(trimmed);

      return matchStatus && matchSearch;
    });
  }, [members, search, status]);

  // افزودن عضو جدید
  async function handleAddMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const res = await createMember(formData);
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message);
      setModal(null);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  // ذخیره ویرایش
  async function handleUpdateMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedMember) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const res = await updateMember(selectedMember.id, formData);
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message);

      const updatedFullName = formData.get("fullName") as string;
      const updatedDepartment = (formData.get("department") as string) || null;

      setMembers((prev) =>
        prev.map((m) =>
          m.id === selectedMember.id
            ? {
                ...m,
                fullName: updatedFullName,
                department: updatedDepartment,
                maritalStatus:
                  (formData.get("maritalStatus") as string) || null,
                childrenCount: Number(formData.get("childrenCount") || 0),
                educationLevel:
                  (formData.get("educationLevel") as string) || null,
                veteranStatus:
                  (formData.get("veteranStatus") as string) || "none",
              }
            : m,
        ),
      );

      setIsEditing(false);
      setSelectedMember(null);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  // حذف عضو
  async function handleDeleteMember(id: string, name: string) {
    if (
      !confirm(
        `آیا از حذف پرونده «${name}» اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`,
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    const res = await deleteMember(id);
    setIsSubmitting(false);

    if (res.success) {
      toast.success(res.message);
      setMembers((prev) => prev.filter((m) => m.id !== id));
      if (selectedMember?.id === id) {
        setSelectedMember(null);
      }
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  // تغییر وضعیت
  async function handleStatusChange(statusVal: string) {
    if (!selectedMember) return;
    const res = await toggleMemberStatus(selectedMember.id, statusVal as any);
    if (res.success) {
      toast.success("وضعیت عضو با موفقیت تغییر کرد.");
      setSelectedMember((prev) =>
        prev ? { ...prev, status: statusVal } : null,
      );
      setMembers((prev) =>
        prev.map((m) =>
          m.id === selectedMember.id ? { ...m, status: statusVal } : m,
        ),
      );
      router.refresh();
    } else {
      toast.error(res.message || "خطا در تغییر وضعیت");
    }
  }

  return (
    <div className="relative">
      <PageTitle
        title="پرسنل و اعضای صندوق"
        description={`${fa.format(members.length)} پرونده ثبت‌شده در سامانه`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModal("import")}>
              <FileSpreadsheet className="size-4 ml-1.5" />
              ورود از اکسل
            </Button>
            <Button onClick={() => setModal("add")}>
              <Plus className="size-4 ml-1.5" />
              عضو جدید
            </Button>
          </div>
        }
      />
      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-3.5 size-4 text-slate-400" />
          <Input
            className="pr-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجو با نام یا کد پرسنلی"
          />
        </div>
        <select
          className="input sm:w-48"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">همه اعضا</option>
          <option value="active">فعال</option>
          <option value="suspended">تعلیق</option>
          <option value="resigned">خاتمه همکاری</option>
        </select>
      </Card>
      {/* شبکه کارت‌ها */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((member) => {
          const numCode = Number(member.employeeCode);
          const formattedCode = isNaN(numCode)
            ? member.employeeCode
            : fa.format(numCode);

          return (
            <Card
              key={member.id}
              className="flex flex-col justify-between transition-all duration-200 hover:shadow-md"
            >
              <div>
                <div className="flex items-start gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700 font-bold">
                    <UserRound className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-bold text-slate-900">
                          {member.fullName}
                        </h2>
                        <p className="mt-1 text-xs text-slate-400">
                          کد پرسنلی: {formattedCode}
                        </p>
                      </div>
                      <MemberStatusBadge status={member.status as any} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">واحد سازمانی</p>
                    <p className="mt-0.5 font-medium">
                      {member.department || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">تحصیلات</p>
                    <p className="mt-0.5 font-medium">
                      {member.educationLevel
                        ? ((educationLabel as Record<string, string>)[
                            member.educationLevel
                          ] ?? member.educationLevel)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">موجودی صندوق</p>
                    <p className="mt-0.5 font-medium text-teal-700 font-semibold">
                      {money(Number(member.savingsBalance || 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">وام‌های پیشین</p>
                    <p className="mt-0.5 font-medium">
                      {fa.format(member.previousLoansCount)} فقره
                    </p>
                  </div>
                </div>
              </div>

              {/* بخش دکمه‌های مستقیم روی کارت */}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setSelectedMember(member);
                    setIsEditing(false);
                  }}
                >
                  <Eye className="size-3.5 ml-1" />
                  جزئیات و منو
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  className="px-2.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  title="ویرایش"
                  onClick={() => {
                    setSelectedMember(member);
                    setIsEditing(true);
                  }}
                >
                  <Edit3 className="size-3.5" />
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  className="px-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  title="حذف"
                  onClick={() => handleDeleteMember(member.id, member.fullName)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center text-sm text-slate-400">
            هیچ عضوی با مشخصات وارد شده یافت نشد.
          </div>
        )}
      </div>
      {/* منوی کشویی سمت راست (Right Slide-over Drawer) */}
      {selectedMember && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedMember(null)}
          />

          <aside
            dir="rtl"
            className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200"
          >
            {/* هدر پنل */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-teal-600 text-white font-bold">
                  <UserRound className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedMember.fullName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    کد پرسنلی: {selectedMember.employeeCode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700 transition shadow-xs"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* نوار وضعیت عملیات سریع بالای پنل */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-2.5 bg-slate-50">
              <span className="text-xs text-slate-500">وضعیت عضو:</span>
              <select
                className="input text-xs py-1 px-2.5 bg-white font-medium"
                value={selectedMember.status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="active">فعال</option>
                <option value="suspended">تعلیق</option>
                <option value="resigned">خاتمه همکاری</option>
              </select>
            </div>

            {/* بدنه اسکرول‌پذیر پنل */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!isEditing ? (
                /* ۱. حالت نمایش جزئیات کامل */
                <>
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400">
                      اطلاعات هویتی و شغلی
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoBox
                        label="کد ملی"
                        value={selectedMember.nationalId ?? "—"}
                      />
                      <InfoBox
                        label="واحد سازمانی"
                        value={selectedMember.department || "ثبت نشده"}
                      />
                      <InfoBox
                        label="وضعیت تأهل"
                        value={
                          selectedMember.maritalStatus === "married"
                            ? "متأهل"
                            : "مجرد"
                        }
                      />
                      <InfoBox
                        label="تعداد فرزندان"
                        value={`${fa.format(selectedMember.childrenCount ?? 0)} فرزند`}
                      />
                      <InfoBox
                        label="تحصیلات"
                        value={
                          selectedMember.educationLevel
                            ? ((educationLabel as Record<string, string>)[
                                selectedMember.educationLevel
                              ] ?? selectedMember.educationLevel)
                            : "—"
                        }
                      />
                      <InfoBox
                        label="ایثارگری"
                        value={
                          selectedMember.veteranStatus === "veteran"
                            ? "ایثارگر"
                            : selectedMember.veteranStatus === "family"
                              ? "خانواده شهدا"
                              : "عادی"
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400">
                      اطلاعات مالی و صندوق
                    </h4>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">موجودی پس‌انداز:</span>
                        <span className="font-bold text-teal-700 text-base">
                          {money(Number(selectedMember.savingsBalance || 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-slate-200/80 pt-2.5">
                        <span className="text-slate-500">
                          وام‌های قبلی دریافتی:
                        </span>
                        <span className="font-semibold text-slate-800">
                          {fa.format(selectedMember.previousLoansCount)} فقره
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* ۲. حالت فرم ویرایش */
                <form
                  id="drawer-edit-form"
                  onSubmit={handleUpdateMember}
                  className="space-y-4"
                >
                  <Field
                    name="fullName"
                    label="نام و نام خانوادگی"
                    defaultValue={selectedMember.fullName}
                    required
                  />
                  <Field
                    name="department"
                    label="واحد سازمانی"
                    defaultValue={selectedMember.department || ""}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">
                        وضعیت تأهل
                      </label>
                      <select
                        name="maritalStatus"
                        defaultValue={selectedMember.maritalStatus ?? "single"}
                        className="input w-full text-sm"
                      >
                        <option value="single">مجرد</option>
                        <option value="married">متأهل</option>
                      </select>
                    </div>

                    <Field
                      name="childrenCount"
                      label="تعداد فرزندان"
                      type="number"
                      defaultValue={String(selectedMember.childrenCount)}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      مدرک تحصیلی
                    </label>
                    <select
                      name="educationLevel"
                      defaultValue={selectedMember.educationLevel ?? "diploma"}
                      className="input w-full text-sm"
                    >
                      <option value="diploma">دیپلم</option>
                      <option value="associate">کاردانی</option>
                      <option value="bachelor">کارشناسی</option>
                      <option value="master">کارشناسی ارشد</option>
                      <option value="phd">دکتری</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      وضعیت ایثارگری
                    </label>
                    <select
                      name="veteranStatus"
                      defaultValue={selectedMember.veteranStatus || "none"}
                      className="input w-full text-sm"
                    >
                      <option value="none">عادی</option>
                      <option value="veteran">ایثارگر / جانباز</option>
                      <option value="family">خانواده معظم شهدا</option>
                    </select>
                  </div>
                </form>
              )}
            </div>

            {/* فوتر پنل کشویی */}
            <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-between gap-2">
              {!isEditing ? (
                <>
                  <Button onClick={() => setIsEditing(true)} className="flex-1">
                    <Edit3 className="size-4 ml-1.5" />
                    ویرایش پرونده
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleDeleteMember(
                        selectedMember.id,
                        selectedMember.fullName,
                      )
                    }
                    disabled={isSubmitting}
                    className="text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                  >
                    <Trash2 className="size-4 ml-1.5" />
                    حذف
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsEditing(false)}
                    disabled={isSubmitting}
                  >
                    انصراف
                  </Button>
                  <Button
                    type="submit"
                    form="drawer-edit-form"
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? "در حال ذخیره..." : "ذخیره تغییرات"}
                  </Button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* مدال افزودن عضو جدید */}
      {modal === "add" && (
        <Modal title="افزودن عضو جدید" onClose={() => setModal(null)}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={handleAddMember}
          >
            <Field
              name="fullName"
              label="نام و نام خانوادگی"
              placeholder="مثلاً نیلوفر احمدی"
              required
            />
            <Field
              name="employeeCode"
              label="کد پرسنلی"
              placeholder="۱۲۵۸"
              required
            />
            <Field
              name="nationalId"
              label="کد ملی"
              placeholder="۰۰۱۲۳۴۵۶۷۸"
              required
            />
            <Field
              name="department"
              label="واحد سازمانی"
              placeholder="فناوری اطلاعات"
              required
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                وضعیت تأهل
              </label>
              <select name="maritalStatus" className="input w-full">
                <option value="single">مجرد</option>
                <option value="married">متأهل</option>
              </select>
            </div>

            <Field
              name="childrenCount"
              label="تعداد فرزندان"
              type="number"
              placeholder="0"
              defaultValue="0"
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                مدرک تحصیلی
              </label>
              <select name="educationLevel" className="input w-full">
                <option value="diploma">دیپلم</option>
                <option value="associate">کاردانی</option>
                <option value="bachelor">کارشناسی</option>
                <option value="master">کارشناسی ارشد</option>
                <option value="phd">دکتری</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                وضعیت ایثارگری
              </label>
              <select name="veteranStatus" className="input w-full">
                <option value="none">عادی</option>
                <option value="veteran">ایثارگر / جانباز</option>
                <option value="family">خانواده معظم شهدا و ایثارگران</option>
              </select>
            </div>

            <Field
              name="hireDate"
              label="تاریخ استخدام"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              required
            />

            <Field
              name="membershipDate"
              label="تاریخ عضویت در صندوق"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              required
            />

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal(null)}
                disabled={isSubmitting}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "در حال ثبت..." : "ثبت عضو"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "import" && (
        <Modal
          title="ورود اطلاعات از اکسل"
          onClose={() => {
            if (!isSubmitting) setModal(null);
          }}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              setIsSubmitting(true);
              try {
                const res = await importMembersFromExcel(formData);

                if (res.success) {
                  toast.success(res.message);
                  setModal(null);
                  setSelectedImportType("");
                  router.refresh();
                } else {
                  toast.error(res.message);
                }
              } catch {
                toast.error("ارتباط با سرور برقرار نشد.");
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                این فایل مربوط به کدام اطلاعات است؟
              </label>

              <select
                name="importType"
                className="input w-full"
                required
                value={selectedImportType}
                onChange={(e) => setSelectedImportType(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">نوع فایل را انتخاب کنید</option>
                {MEMBER_IMPORT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center">
              <FileSpreadsheet className="mx-auto mb-3 size-10 text-teal-700" />

              <p className="font-bold text-slate-800">
                {selectedImportType === "names"
                  ? "ساختار: ستون A کد پرسنلی، ستون B نام، ستون C نام خانوادگی"
                  : "ساختار: ستون A کد پرسنلی، ستون B مقدار"}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                فایل بدون هدر باشد؛ داده‌ها از ردیف اول شروع می‌شوند.
              </p>

              <input
                key={selectedImportType}
                type="file"
                name="file"
                accept=".xlsx,.xls"
                required
                disabled={!selectedImportType || isSubmitting}
                className="mt-4 block w-full cursor-pointer text-sm text-slate-500
            file:mr-4 file:rounded-xl file:border-0 file:bg-teal-50
            file:px-4 file:py-2 file:text-sm file:font-semibold
            file:text-teal-700 hover:file:bg-teal-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal(null)}
                disabled={isSubmitting}
              >
                انصراف
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || !selectedImportType}
              >
                {isSubmitting ? "در حال پردازش..." : "آپلود و درون‌ریزی"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
      <span className="block text-[11px] text-slate-400">{label}</span>
      <span className="mt-1 block font-medium text-slate-800 text-sm">
        {value}
      </span>
    </div>
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
