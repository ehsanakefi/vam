import { BriefcaseBusiness, GraduationCap, Landmark, PiggyBank, UserRound, X } from 'lucide-react'
import type { QueueItem } from '@/types/loan'
import { educationLabel, fa, money } from '@/lib/utils'
import { Button, Progress } from './ui'
import { StatusBadge } from './StatusBadge'

const factorLabels = {
  marital: ['وضعیت تأهل', 6],
  children: ['تعداد فرزندان', 3],
  veteran: ['ایثارگری', 9],
  education: ['مدرک تحصیلی', 10],
  workHistory: ['سابقه کار', 30],
  membership: ['سابقه عضویت', 12],
  performance: ['عملکرد', 1],
  capital: ['سهم سرمایه', 20],
} as const

export function MemberDrawer({ item, onClose }: { item: QueueItem; onClose: () => void }) {
  const member = item.member
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm" onClick={onClose} />
      <aside dir="rtl" className="fixed inset-y-0 left-0 z-50 w-full max-w-2xl overflow-y-auto bg-slate-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div><p className="font-bold">پرونده متقاضی</p><p className="text-xs text-slate-500">جزئیات اطلاعات و عوامل امتیازدهی</p></div>
          <Button variant="ghost" onClick={onClose}><X className="size-5" /></Button>
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          <section className="rounded-2xl bg-slate-950 p-6 text-white">
            <div className="flex flex-wrap items-center gap-4"><div className="grid size-16 place-items-center rounded-2xl bg-teal-400 text-xl font-bold text-slate-950">{member.fullName.split(' ').map((part) => part[0]).join('')}</div><div className="flex-1"><h2 className="text-xl font-bold">{member.fullName}</h2><p className="mt-1 text-sm text-slate-400">{member.department} · کد {fa.format(Number(member.employeeCode))}</p></div><StatusBadge status={item.status} /></div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 sm:grid-cols-4"><Info label="کد ملی" value={fa.format(Number(member.nationalId))} /><Info label="تاریخ استخدام" value={member.hireDate} /><Info label="عضویت صندوق" value={member.membershipDate} /><Info label="امتیاز کل" value={`${fa.format(item.score)} از ۱۰۰`} /></div>
          </section>
          <DrawerSection icon={<UserRound />} title="اطلاعات هویتی و خانوادگی">
            <Info label="وضعیت تأهل" value={member.maritalStatus === 'married' ? 'متأهل' : 'مجرد'} /><Info label="تعداد فرزندان" value={fa.format(member.childrenCount)} /><Info label="وضعیت ایثارگری" value={member.veteranStatus === 'none' ? 'ندارد' : 'دارد'} /><Info label="مدرک تحصیلی" value={educationLabel[member.educationLevel]} />
          </DrawerSection>
          <DrawerSection icon={<BriefcaseBusiness />} title="عملکرد سازمانی">
            <div className="col-span-full"><div className="mb-2 flex justify-between text-sm"><span>امتیاز ارزیابی عملکرد</span><strong>{fa.format(member.performanceScore)} از ۱۰۰</strong></div><Progress value={member.performanceScore} tone="blue" /></div>
          </DrawerSection>
          <DrawerSection icon={<PiggyBank />} title="وضعیت مالی و سوابق">
            <Info label="پس‌انداز کارمند (۵٪)" value={money(member.employeeSavings)} /><Info label="سهم کارفرما (۷٪)" value={money(member.employerSavings)} /><Info label="مجموع موجودی صندوق" value={money(member.savingsBalance)} /><Info label="وام‌های قبلی" value={`${fa.format(member.previousLoansCount)} فقره · ${money(member.previousLoansSum)}`} />
          </DrawerSection>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-5 flex items-center gap-2"><Landmark className="size-5 text-teal-700" /><h3 className="font-bold">جزئیات ۸ عامل امتیازدهی</h3></div>
            <div className="grid gap-5 sm:grid-cols-2">
              {item.scoreBreakdown && Object.entries(factorLabels).map(([key, [label, max]]) => {
                const value = item.scoreBreakdown?.[key as keyof typeof factorLabels] || 0
                return <div key={key}><div className="mb-2 flex justify-between text-xs"><span>{label}</span><strong>{fa.format(value)} / {fa.format(max)}</strong></div><Progress value={(value / max) * 100} /></div>
              })}
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}

function DrawerSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-5 flex items-center gap-2 text-slate-900"><span className="text-teal-700">{icon}</span><h3 className="font-bold">{title}</h3></div><div className="grid grid-cols-2 gap-5 sm:grid-cols-4">{children}</div></section>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
}
