import type { ApplicationStatus, MemberStatus } from '@/types/loan'
import { memberStatusLabel, statusLabel } from '@/lib/utils'

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`status status-${status}`}>{statusLabel[status]}</span>
}

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return <span className={`status status-${status}`}>{memberStatusLabel[status]}</span>
}
