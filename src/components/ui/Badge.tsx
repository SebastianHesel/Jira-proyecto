import { clsx } from 'clsx'
import type { Priority, IssueType, TicketStatus } from '../../types'

// ── Priority ──────────────────────────────────────────────────────────────────
const priorityStyles: Record<Priority, { dot: string; container: string }> = {
  Highest: { dot: 'bg-red-500',    container: 'bg-red-50 dark:bg-red-900/40       text-red-700 dark:text-red-300    border border-red-100 dark:border-red-800/40' },
  High:    { dot: 'bg-orange-400', container: 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800/40' },
  Medium:  { dot: 'bg-amber-400',  container: 'bg-amber-50 dark:bg-amber-900/40   text-amber-700 dark:text-amber-300  border border-amber-100 dark:border-amber-800/40' },
  Low:     { dot: 'bg-sky-400',    container: 'bg-sky-50 dark:bg-sky-900/40       text-sky-700 dark:text-sky-300    border border-sky-100 dark:border-sky-800/40' },
  Lowest:  { dot: 'bg-gray-300 dark:bg-slate-600', container: 'bg-gray-50 dark:bg-[#1e2535] text-gray-500 dark:text-slate-400 border border-gray-100 dark:border-[#2d3548]' },
}

// ── Type ──────────────────────────────────────────────────────────────────────
const typeStyles: Record<IssueType, { dot: string; container: string }> = {
  Epic:       { dot: 'bg-violet-500', container: 'bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-800/40' },
  Story:      { dot: 'bg-emerald-500',container: 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/40' },
  Task:       { dot: 'bg-blue-500',   container: 'bg-blue-50 dark:bg-blue-900/40   text-blue-700 dark:text-blue-300   border border-blue-100 dark:border-blue-800/40' },
  Bug:        { dot: 'bg-red-500',    container: 'bg-red-50 dark:bg-red-900/40     text-red-700 dark:text-red-300    border border-red-100 dark:border-red-800/40' },
  'Sub-task': { dot: 'bg-gray-400 dark:bg-slate-600', container: 'bg-gray-50 dark:bg-[#1e2535] text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-[#2d3548]' },
}

// ── Status ────────────────────────────────────────────────────────────────────
const statusStyles: Record<TicketStatus, { dot: string; container: string }> = {
  'To Do':      { dot: 'bg-gray-400 dark:bg-slate-600',    container: 'bg-gray-50 dark:bg-[#1e2535]     text-gray-600 dark:text-slate-400   border border-gray-200 dark:border-[#2d3548]' },
  'In Progress':{ dot: 'bg-blue-500',    container: 'bg-blue-50 dark:bg-blue-900/40     text-blue-700 dark:text-blue-300   border border-blue-100 dark:border-blue-800/40' },
  Done:         { dot: 'bg-emerald-500', container: 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/40' },
  Blocked:      { dot: 'bg-red-500',     container: 'bg-red-50 dark:bg-red-900/40     text-red-700 dark:text-red-300    border border-red-100 dark:border-red-800/40' },
}

// ── Generic dot badge ─────────────────────────────────────────────────────────
function DotBadge({ dot, container, label }: { dot: string; container: string; label: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap', container)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
      {label}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const s = priorityStyles[priority] ?? priorityStyles.Low
  return <DotBadge dot={s.dot} container={s.container} label={priority} />
}

export function TypeBadge({ type }: { type: IssueType }) {
  const s = typeStyles[type] ?? typeStyles.Task
  return <DotBadge dot={s.dot} container={s.container} label={type} />
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const s = statusStyles[status] ?? statusStyles['To Do']
  return <DotBadge dot={s.dot} container={s.container} label={status} />
}

// ── Legacy Badge ──────────────────────────────────────────────────────────────
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', className)}>
      {children}
    </span>
  )
}
