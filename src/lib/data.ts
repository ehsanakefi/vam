import type { LoanPeriod, Member, QueueItem, ScoreBreakdown } from '@/types/loan'

const names = [
  ['مریم احمدی', 'فناوری اطلاعات'],
  ['علی رضایی', 'مالی'],
  ['نگار کریمی', 'منابع انسانی'],
  ['امیرحسین محمدی', 'عملیات'],
  ['سارا موسوی', 'بازرگانی'],
  ['رضا اکبری', 'فناوری اطلاعات'],
  ['فاطمه حسینی', 'مالی'],
  ['محمد صادقی', 'عملیات'],
  ['زهرا مرادی', 'منابع انسانی'],
  ['کیان نادری', 'بازرگانی'],
  ['الهام توکلی', 'مالی'],
  ['آرش رستمی', 'فناوری اطلاعات'],
]

export const members: Member[] = names.map(([fullName, department], index) => ({
  id: `m-${index + 1}`,
  employeeCode: `${1240 + index}`,
  nationalId: `00${18274630 + index}`,
  fullName,
  department,
  maritalStatus: index % 3 === 0 ? 'single' : 'married',
  childrenCount: index % 4,
  veteranStatus: index === 3 ? 'veteran' : index === 7 ? 'family' : 'none',
  educationLevel: (['bachelor', 'master', 'associate', 'phd'] as const)[index % 4],
  hireDate: `139${index % 8}/0${(index % 8) + 1}/12`,
  membershipDate: `140${index % 4}/0${(index % 7) + 1}/01`,
  performanceScore: 82 + (index % 17),
  savingsBalance: 310_000_000 + index * 27_000_000,
  employeeSavings: 125_000_000 + index * 11_000_000,
  employerSavings: 185_000_000 + index * 16_000_000,
  previousLoansCount: index % 4,
  previousLoansSum: (index % 4) * 180_000_000,
  status: index === 8 ? 'suspended' : index === 10 ? 'resigned' : 'active',
}))

const breakdown = (index: number): ScoreBreakdown => {
  const values = {
    marital: index % 3 === 0 ? 2 : 6,
    children: index % 4,
    veteran: index === 3 ? 9 : index === 7 ? 6 : 0,
    education: 6 + (index % 5),
    workHistory: 18 + (index % 12),
    membership: 6 + (index % 6),
    performance: index % 2 ? 1 : 0.8,
    capital: 11 + (index % 9),
  }
  return { ...values, total: Math.round(Object.values(values).reduce((sum, value) => sum + value, 0)) }
}

const statuses = ['queued', 'queued', 'approved', 'awarded', 'queued', 'rejected'] as const

export const queue: QueueItem[] = members.slice(0, 10).map((member, index) => {
  const scoreBreakdown = breakdown(index)
  return {
    id: `a-${index + 1}`,
    periodId: 'p-1',
    memberId: member.id,
    member,
    requestedAmount: 500_000_000 + (index % 4) * 150_000_000,
    approvedAmount: index % 3 === 2 ? 450_000_000 : undefined,
    score: Math.min(96, scoreBreakdown.total + 14),
    rank: index + 1,
    scoreBreakdown,
    status: statuses[index % statuses.length],
    isEmergency: index === 0 || index === 6,
    appliedAt: `1403/11/${12 + index}`,
  }
})

export const periods: LoanPeriod[] = [
  { id: 'p-1', title: 'دوره زمستان ۱۴۰۳', budget: 12_000_000_000, consumed: 7_350_000_000, startDate: '۱۴۰۳/۱۰/۰۱', endDate: '۱۴۰۳/۱۲/۲۹', active: true },
  { id: 'p-2', title: 'دوره پاییز ۱۴۰۳', budget: 9_500_000_000, consumed: 9_120_000_000, startDate: '۱۴۰۳/۰۷/۰۱', endDate: '۱۴۰۳/۰۹/۳۰', active: false },
  { id: 'p-3', title: 'دوره تابستان ۱۴۰۳', budget: 8_000_000_000, consumed: 7_680_000_000, startDate: '۱۴۰۳/۰۴/۰۱', endDate: '۱۴۰۳/۰۶/۳۱', active: false },
]

export const departmentData = [
  { name: 'فناوری', count: 28 },
  { name: 'عملیات', count: 23 },
  { name: 'مالی', count: 18 },
  { name: 'بازرگانی', count: 14 },
  { name: 'منابع انسانی', count: 9 },
]

export const scoreData = [
  { range: '۴۰–۵۰', count: 6 },
  { range: '۵۰–۶۰', count: 14 },
  { range: '۶۰–۷۰', count: 24 },
  { range: '۷۰–۸۰', count: 31 },
  { range: '۸۰–۹۰', count: 19 },
  { range: '۹۰+', count: 7 },
]
