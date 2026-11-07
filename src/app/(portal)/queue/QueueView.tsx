"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  Search,
  ShieldCheck,
  Siren,
  XCircle,
} from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { Button, Card, Input, PageTitle } from "@/components/ui";
import { MemberDrawer } from "@/components/MemberDrawer";
import { StatusBadge } from "@/components/StatusBadge";
import { fa, money } from "@/lib/utils";
import type { QueueItem } from "@/types/loan";
// import { approveApplicationAction, rejectApplicationAction } from "./actions";
import { recalculateQueueScores } from "./actions";
import { Calculator } from "lucide-react";
const column = createColumnHelper<QueueItem>();

interface QueuePageProps {
  initialItems: QueueItem[];
  departments: string[];
}

export default function QueueView({
  initialItems,
  departments,
}: QueuePageProps) {
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "score", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");

  // فیلتر کردن روی داده‌های دریافتی از سرور (initialItems)
  const filteredData = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    return (initialItems || []).filter((item) => {
      const matchDept =
        department === "all" || item.member.department === department;
      const matchStatus = status === "all" || item.status === status;
      const matchSearch =
        !trimmed ||
        item.member.fullName.toLowerCase().includes(trimmed) ||
        String(item.member.employeeCode).includes(trimmed);

      return matchDept && matchStatus && matchSearch;
    });
  }, [initialItems, department, search, status]);

  const columns = useMemo(
    () => [
      column.accessor("rank", {
        header: "رتبه",
        cell: (info) => (
          <span className="rank">{fa.format(info.getValue() || 0)}</span>
        ),
      }),
      column.accessor((row) => row.member.employeeCode, {
        id: "employeeCode",
        header: "کد پرسنلی",
        cell: (info) => {
          const val = info.getValue();
          const num = Number(val);
          return isNaN(num) ? val : fa.format(num);
        },
      }),
      column.accessor((row) => row.member.fullName, {
        id: "fullName",
        header: "نام و نام خانوادگی",
        cell: (info) => <strong>{info.getValue()}</strong>,
      }),
      column.accessor((row) => row.member.department, {
        id: "department",
        header: "واحد",
      }),
      column.accessor("requestedAmount", {
        header: "مبلغ درخواستی",
        cell: (info) => money(info.getValue()),
      }),
      column.accessor("score", {
        header: "امتیاز مرکب",
        cell: (info) => (
          <span className="font-bold text-teal-700">
            {fa.format(info.getValue())}
            <small className="text-slate-400"> / ۱۰۰</small>
          </span>
        ),
      }),
      column.accessor("isEmergency", {
        header: "اولویت",
        cell: (info) =>
          info.getValue() ? (
            <span className="status status-rejected inline-flex items-center gap-1 text-xs">
              <Siren className="size-3.5 text-rose-600" /> اضطراری
            </span>
          ) : (
            <span className="text-xs text-slate-400">عادی</span>
          ),
      }),
      column.accessor("status", {
        header: "وضعیت",
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      column.display({
        id: "actions",
        header: "عملیات",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              onClick={() => setSelected(row.original)}
              aria-label="مشاهده"
            >
              <Eye className="size-4" />
            </Button>
            <Button
              variant="ghost"
              className="text-emerald-700 hover:text-emerald-800"
              onClick={async () => {
                // const res = await approveApplicationAction(row.original.id);
                // if (res.success) toast.success("درخواست با موفقیت تأیید شد");
                // else toast.error(res.error || "خطا در تایید");
              }}
              aria-label="تأیید"
            >
              <ShieldCheck className="size-4" />
            </Button>

            <Button
              variant="ghost"
              className="text-rose-600 hover:text-rose-700"
              onClick={async () => {
                // const res = await rejectApplicationAction(row.original.id);
                // if (res.success) toast.success("درخواست رد شد");
                // else toast.error(res.error || "خطا در رد درخواست");
              }}
              aria-label="رد"
            >
              <XCircle className="size-4" />
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 6 } },
  });

  return (
    <>
      <PageTitle
        title="صف امتیازدهی و اولویت‌بندی"
        description="بررسی، مقایسه و تصمیم‌گیری درباره درخواست‌های دوره فعال"
        action={
          <>
            <Button
              variant="secondary"
              onClick={() => toast.success("خروجی با موفقیت صادر شد")}
            >
              <Download className="size-4 ml-1.5" />
              دریافت خروجی
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                toast.loading("در حال محاسبه امتیازات طبق آیین‌نامه...", {
                  id: "scoring",
                });
                const res = await recalculateQueueScores(activePeriodId);
                if (res.success) {
                  toast.success(res.message, { id: "scoring" });
                } else {
                  toast.error(res.message, { id: "scoring" });
                }
              }}
            >
              <Calculator className="size-4 ml-1.5" />
              محاسبه مجدد امتیازات و صف
            </Button>
          </>
        }
      />
      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-3.5 size-4 text-slate-400" />
            <Input
              className="pr-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجوی نام یا کد پرسنلی..."
            />
          </div>

          {/* لود داینامیک واحدها از دیتابیس */}
          <select
            className="input lg:w-48"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="all">همه واحدها</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            className="input lg:w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="queued">در صف</option>
            <option value="approved">تأیید شده</option>
            <option value="awarded">پرداخت شده</option>
            <option value="rejected">رد شده</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={
                        header.column.getCanSort()
                          ? "cursor-pointer select-none"
                          : ""
                      }
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() === "asc"
                        ? " ↑"
                        : header.column.getIsSorted() === "desc"
                          ? " ↓"
                          : ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onDoubleClick={() => setSelected(row.original)}
                  className="cursor-pointer hover:bg-slate-50/75 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!table.getRowModel().rows.length && (
            <div className="p-12 text-center text-sm text-slate-400">
              نتیجه‌ای مطابق فیلترها یافت نشد.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm text-slate-500">
          <span>{fa.format(filteredData.length)} درخواست</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              قبلی
            </Button>
            <Button
              variant="secondary"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              بعدی
            </Button>
          </div>
        </div>
      </Card>

      {selected && (
        <MemberDrawer item={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
