"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
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
import {
  approveApplicationAction,
  rejectApplicationAction,
  syncAndRecalculateQueue,
} from "./actions";

type LoanType = "long_term" | "short_term";

const column = createColumnHelper<QueueItem>();

interface QueuePageProps {
  initialItems: QueueItem[];
  departments: string[];
  activePeriodId: string;
}

function csvCell(value: unknown): string {
  let text = String(value ?? "");

  // جلوگیری از اجرای فرمول هنگام باز کردن CSV در Excel.
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;

  return `"${text.replaceAll('"', '""')}"`;
}

export default function QueueView({
  initialItems,
  departments,
  activePeriodId,
}: QueuePageProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [loanType, setLoanType] = useState<LoanType>("long_term");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "rank", desc: false },
  ]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      long_term: initialItems.filter((item) => item.loanType === "long_term")
        .length,
      short_term: initialItems.filter((item) => item.loanType === "short_term")
        .length,
    }),
    [initialItems],
  );

  const filteredData = useMemo(() => {
    const trimmed = search.trim().toLowerCase();

    return initialItems.filter((item) => {
      const matchType = item.loanType === loanType;
      const matchDept =
        department === "all" || item.member.department === department;
      const matchStatus = status === "all" || item.status === status;
      const matchSearch =
        !trimmed ||
        item.member.fullName.toLowerCase().includes(trimmed) ||
        String(item.member.employeeCode).includes(trimmed);

      return matchType && matchDept && matchStatus && matchSearch;
    });
  }, [initialItems, loanType, department, status, search]);

  async function handleDecision(
    item: QueueItem,
    decision: "approved" | "rejected",
  ) {
    if (busy || item.status !== "queued") return;

    setBusy(item.id);
    toast.loading("در حال ثبت تصمیم...", { id: "queue-action" });

    try {
      const result =
        decision === "approved"
          ? await approveApplicationAction(item.id)
          : await rejectApplicationAction(item.id);

      if (!result.success) {
        toast.error(result.error ?? "ثبت تصمیم ناموفق بود.", {
          id: "queue-action",
        });
        router.refresh();
        return;
      }

      toast.success(
        decision === "approved"
          ? "وام تأیید شد و عضو به انتهای صف همین نوع وام رفت."
          : "درخواست رد شد و عضو به انتهای صف همین نوع وام رفت.",
        { id: "queue-action" },
      );

      setSelected(null);
      router.refresh();
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.", { id: "queue-action" });
    } finally {
      setBusy(null);
    }
  }

  async function handleRecalculate() {
    if (busy) return;

    setBusy("recalculate");
    toast.loading("در حال محاسبه دو صف...", { id: "queue-scoring" });

    try {
      const result = await syncAndRecalculateQueue(activePeriodId);

      if (result.success) {
        toast.success(result.message, { id: "queue-scoring" });
        router.refresh();
      } else {
        toast.error(result.message, { id: "queue-scoring" });
      }
    } catch {
      toast.error("ارتباط با سرور برقرار نشد.", { id: "queue-scoring" });
    } finally {
      setBusy(null);
    }
  }

  const columns = useMemo(
    () => [
      column.accessor("rank", {
        header: "رتبه",
        cell: (info) => (
          <span className="rank">{fa.format(info.getValue() ?? 0)}</span>
        ),
      }),
      column.accessor((row) => row.member.employeeCode, {
        id: "employeeCode",
        header: "کد پرسنلی",
        cell: (info) => {
          const value = String(info.getValue());
          const number = Number(value);
          return Number.isNaN(number) ? value : fa.format(number);
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
            {fa.format(info.getValue() ?? 0)}
          </span>
        ),
      }),
      column.accessor("isEmergency", {
        header: "اولویت",
        cell: (info) =>
          info.getValue() ? (
            <span className="status status-rejected inline-flex items-center gap-1 text-xs">
              <Siren className="size-3.5 text-rose-600" />
              اضطراری
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
        cell: ({ row }) => {
          const item = row.original;
          const disabled = busy !== null || item.status !== "queued";

          return (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                onClick={() => setSelected(item)}
                aria-label="مشاهده"
                title="مشاهده"
              >
                <Eye className="size-4" />
              </Button>

              <Button
                variant="ghost"
                className="text-emerald-700 hover:text-emerald-800"
                title="تأیید وام"
                aria-label="تأیید وام"
                disabled={disabled}
                onClick={() => handleDecision(item, "approved")}
              >
                <ShieldCheck className="size-4" />
              </Button>

              <Button
                variant="ghost"
                className="text-rose-600 hover:text-rose-700"
                title="رد یا انصراف از وام"
                aria-label="رد یا انصراف از وام"
                disabled={disabled}
                onClick={() => handleDecision(item, "rejected")}
              >
                <XCircle className="size-4" />
              </Button>
            </div>
          );
        },
      }),
    ],
    [busy],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 6 } },
  });

  function handleExport() {
    const rows = table.getPrePaginationRowModel().rows;

    const lines = [
      [
        "رتبه",
        "کد پرسنلی",
        "نام و نام خانوادگی",
        "واحد",
        "مبلغ درخواستی",
        "امتیاز",
        "وضعیت",
      ]
        .map(csvCell)
        .join(","),
      ...rows.map(({ original: item }) =>
        [
          item.rank,
          item.member.employeeCode,
          item.member.fullName,
          item.member.department,
          item.requestedAmount,
          item.score,
          item.status,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];

    const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `queue-${loanType}.csv`;
    link.click();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <PageTitle
        title="صف امتیازدهی و اولویت‌بندی"
        description="بررسی و تصمیم‌گیری درباره درخواست‌های دوره فعال"
        action={
          <>
            <Button variant="secondary" onClick={handleExport}>
              <Download className="size-4 ml-1.5" />
              دریافت خروجی
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={handleRecalculate}
            >
              <Calculator className="size-4 ml-1.5" />
              محاسبه مجدد امتیازات و صف
            </Button>
          </>
        }
      />

      <div
        className="flex border-b border-slate-200"
        role="tablist"
        aria-label="نوع وام"
      >
        {(
          [
            ["long_term", "وام بلندمدت"],
            ["short_term", "وام کوتاه‌مدت"],
          ] as const
        ).map(([type, label]) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={loanType === type}
            onClick={() => {
              setLoanType(type);
              table.setPageIndex(0);
            }}
            className={`border-b-2 px-4 py-3 text-sm ${
              loanType === type
                ? "border-teal-700 font-bold text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label} ({fa.format(counts[type])})
          </button>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-3.5 size-4 text-slate-400" />
            <Input
              className="pr-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جست‌وجوی نام یا کد پرسنلی..."
            />
          </div>

          <select
            className="input lg:w-48"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
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
            onChange={(event) => setStatus(event.target.value)}
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
                  className="cursor-pointer transition-colors hover:bg-slate-50/75"
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

          {table.getRowModel().rows.length === 0 && (
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
