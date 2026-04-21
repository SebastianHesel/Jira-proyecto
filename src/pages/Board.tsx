import { useState, useEffect, useMemo } from 'react'
import { differenceInDays, parseISO, format, addDays, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Element4,
  TrendDown,
  People,
  ArrowDown2,
  More,
  Add,
  Flag as FlagIcon,
  MessageText,
  Paperclip as PaperclipIcon,
  Link21,
} from 'iconsax-react'
import { Header } from '../components/layout/Header'
import { LoadingOverlay } from '../components/ui/Spinner'
import { useJiraSprints, useJiraSprintIssues } from '../hooks/useJiraData'
import { useAppStore } from '../store'
import type { JiraIssue, JiraSprint } from '../types'

type Tab = 'kanban' | 'burndown' | 'capacidad'


// ─── Status → Kanban column mapping ──────────────────────────────────────────

type ColId = 'todo' | 'blocked' | 'inprogress' | 'partial' | 'review' | 'approved' | 'done'

function getColId(status: string): ColId {
  const s = status.toLowerCase().trim()
  if (/blocked|hold|impediment|bloqueado/.test(s))                             return 'blocked'
  if (/completado|done|closed|resolved|finished|released|deployed/.test(s))    return 'done'
  if (/aprobado|approved/.test(s))                                              return 'approved'
  if (/partial/.test(s))                                                        return 'partial'
  if (/review|testing|qa|test|validat|under.?review/.test(s))                  return 'review'
  if (/progress|dev|working|started|doing|en.?curso|curso/.test(s))            return 'inprogress'
  return 'todo' // To Do / Por Hacer / default
}

const COLUMNS: { id: ColId; label: string; dot: string; dotDark: string; countBg: string; countBgDark: string }[] = [
  { id: 'todo',       label: 'To Do',               dot: '#f59e0b', dotDark: '#fbbf24', countBg: '#f59e0b', countBgDark: '#92400e' },
  { id: 'blocked',    label: 'Blocked',              dot: '#ef4444', dotDark: '#f87171', countBg: '#ef4444', countBgDark: '#7f1d1d' },
  { id: 'inprogress', label: 'En Curso',             dot: '#3b82f6', dotDark: '#60a5fa', countBg: '#3b82f6', countBgDark: '#1e3a5f' },
  { id: 'partial',    label: 'Partially Completed',  dot: '#06b6d4', dotDark: '#22d3ee', countBg: '#06b6d4', countBgDark: '#0e4a5a' },
  { id: 'review',     label: 'Under Review',         dot: '#8b5cf6', dotDark: '#a78bfa', countBg: '#8b5cf6', countBgDark: '#3b1e6e' },
  { id: 'approved',   label: 'Aprobado',             dot: '#84cc16', dotDark: '#a3e635', countBg: '#84cc16', countBgDark: '#1a2d00' },
  { id: 'done',       label: 'Completado',           dot: '#10b981', dotDark: '#34d399', countBg: '#10b981', countBgDark: '#064e3b' },
]

// ─── Kanban ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ColId, { dot: string; bg: string; text: string; bgDark: string; textDark: string }> = {
  todo:       { dot: '#f59e0b', bg: '#fffbeb', text: '#b45309', bgDark: '#2d1f00',  textDark: '#fbbf24' },
  blocked:    { dot: '#ef4444', bg: '#fef2f2', text: '#b91c1c', bgDark: '#450a0a',  textDark: '#f87171' },
  inprogress: { dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', bgDark: '#0f2040',  textDark: '#60a5fa' },
  partial:    { dot: '#06b6d4', bg: '#ecfeff', text: '#0e7490', bgDark: '#0c3a45',  textDark: '#22d3ee' },
  review:     { dot: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9', bgDark: '#2e1065',  textDark: '#a78bfa' },
  approved:   { dot: '#84cc16', bg: '#f7fee7', text: '#3f6212', bgDark: '#1a2d00',  textDark: '#a3e635' },
  done:       { dot: '#10b981', bg: '#ecfdf5', text: '#047857', bgDark: '#022c22',  textDark: '#34d399' },
}

const PRIORITY_CFG: Record<string, { bg: string; text: string; bgDark: string; textDark: string; flag: string }> = {
  Highest: { bg: '#fef2f2', text: '#b91c1c', bgDark: '#450a0a', textDark: '#f87171', flag: '#ef4444' },
  High:    { bg: '#fff7ed', text: '#c2410c', bgDark: '#431407', textDark: '#fb923c', flag: '#f97316' },
  Medium:  { bg: '#fefce8', text: '#a16207', bgDark: '#3a2a00', textDark: '#facc15', flag: '#eab308' },
  Low:     { bg: '#f5f3ff', text: '#6d28d9', bgDark: '#2e1065', textDark: '#a78bfa', flag: '#8b5cf6' },
  Lowest:  { bg: '#f8fafc', text: '#64748b', bgDark: '#1e2535', textDark: '#94a3b8', flag: '#94a3b8' },
}

function KanbanCard({ issue, isDarkMode }: { issue: JiraIssue; isDarkMode: boolean }) {
  const initials = issue.assignee
    ? issue.assignee.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : null

  const colId   = getColId(issue.status)
  const sCfg    = STATUS_CFG[colId]
  const pCfg    = PRIORITY_CFG[issue.priority] ?? PRIORITY_CFG.Lowest
  const dateStr = issue.created_at && isValid(parseISO(issue.created_at))
    ? format(parseISO(issue.created_at), 'dd MMM yyyy', { locale: es })
    : null
  const subtitle = [...(issue.labels ?? []), ...(issue.components ?? [])].slice(0, 3).join(' · ')

  const cardBg = isDarkMode ? '#111827' : '#ffffff'

  return (
    <div
      className="rounded-2xl cursor-pointer group transition-all duration-150 hover:shadow-lg"
      style={{
        background: cardBg,
        border: isDarkMode ? '1px solid #1e2535' : '1px solid #f1f5f9',
        boxShadow: isDarkMode ? '0 1px 6px rgba(0,0,0,0.4)' : '0 1px 6px rgba(0,0,0,0.06)',
      }}
    >
      <div className="p-5 flex flex-col gap-3.5">

        {/* Status pill + menu */}
        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: isDarkMode ? sCfg.bgDark : sCfg.bg,
              color: isDarkMode ? sCfg.textDark : sCfg.text,
            }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sCfg.dot }} />
            {issue.status}
          </span>
          <button className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1 hover:bg-black/5">
            <More size="15" color={isDarkMode ? '#64748b' : '#9ca3af'} />
          </button>
        </div>

        {/* Title + description */}
        <div className="space-y-1">
          <h3 className={`text-[14px] font-semibold leading-snug line-clamp-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            {issue.title}
          </h3>
          <p className={`text-xs line-clamp-1 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
            {subtitle || `${issue.jira_issue_key} · ${issue.issue_type}`}
          </p>
        </div>

        {/* Assignees */}
        <div className="flex items-center justify-between">
          <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>Asignees :</span>
          {initials ? (
            <div
              className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white"
              title={issue.assignee}
            >
              {initials}
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full border-2 border-dashed" style={{ borderColor: isDarkMode ? '#334155' : '#e2e8f0' }} />
          )}
        </div>

        {/* Date + Priority */}
        <div className="flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
            <FlagIcon size="13" color={pCfg.flag} variant="Bold" />
            {dateStr ?? '—'}
          </span>
          <span
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: isDarkMode ? pCfg.bgDark : pCfg.bg, color: isDarkMode ? pCfg.textDark : pCfg.text }}
          >
            {issue.priority}
          </span>
        </div>

        {/* Divider */}
        <div style={{ borderTop: isDarkMode ? '1px solid #1e2535' : '1px solid #f1f5f9' }} />

        {/* Stats */}
        <div className="flex items-center gap-4">
          <span className={`flex items-center gap-1.5 text-[11px] ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>
            <MessageText size="13" color={isDarkMode ? '#475569' : '#cbd5e1'} />
            0 Comentarios
          </span>
          <span className={`flex items-center gap-1.5 text-[11px] ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>
            <Link21 size="13" color={isDarkMode ? '#475569' : '#cbd5e1'} />
            0 Links
          </span>
          <span className={`flex items-center gap-1.5 text-[11px] ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>
            <PaperclipIcon size="13" color={isDarkMode ? '#475569' : '#cbd5e1'} />
            {issue.story_points ?? 0}/0
          </span>
        </div>

      </div>
    </div>
  )
}

function KanbanView({ issues, isDarkMode }: { issues: JiraIssue[]; isDarkMode: boolean }) {
  const grouped = useMemo(() => {
    const map: Record<ColId, JiraIssue[]> = { todo: [], blocked: [], inprogress: [], partial: [], review: [], approved: [], done: [] }
    issues.forEach(i => map[getColId(i.status)].push(i))
    return map
  }, [issues])

  return (
    <div className="flex gap-5 overflow-x-auto pb-4 min-h-0 items-start">
      {COLUMNS.map(col => {
        const cards    = grouped[col.id]
        const dotColor = isDarkMode ? col.dotDark : col.dot
        const cntBg    = isDarkMode ? col.countBgDark : col.countBg

        return (
          <div key={col.id} className="flex-shrink-0 w-[300px] flex flex-col gap-3">

            {/* Column header */}
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>{col.label}</span>
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: cntBg }}
                >
                  {cards.length}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <button className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/8' : 'hover:bg-gray-100'}`}>
                  <Add size="15" color={isDarkMode ? '#475569' : '#9ca3af'} />
                </button>
                <button className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/8' : 'hover:bg-gray-100'}`}>
                  <More size="15" color={isDarkMode ? '#475569' : '#9ca3af'} />
                </button>
              </div>
            </div>

            {/* Cards */}
            <div
              className="flex flex-col gap-3 overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 230px)', minHeight: 100 }}
            >
              {cards.length === 0 ? (
                <button
                  className={`w-full flex items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed text-xs font-medium transition-colors ${
                    isDarkMode
                      ? 'border-slate-800 text-slate-700 hover:border-slate-600 hover:text-slate-500'
                      : 'border-gray-200 text-gray-300 hover:border-gray-300 hover:text-gray-400'
                  }`}
                >
                  <Add size="14" color={isDarkMode ? '#334155' : '#d1d5db'} />
                  Agregar ticket
                </button>
              ) : (
                cards.map(issue => (
                  <KanbanCard key={issue.id} issue={issue} isDarkMode={isDarkMode} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Burndown chart ───────────────────────────────────────────────────────────

function BurndownView({ issues, sprint, isDarkMode }: { issues: JiraIssue[]; sprint: JiraSprint | undefined; isDarkMode: boolean }) {
  const today = new Date()

  const totalPoints = issues.reduce((s, i) => s + (i.story_points ?? 0), 0)
  const donePoints  = issues.filter(i => getColId(i.status) === 'done').reduce((s, i) => s + (i.story_points ?? 0), 0)
  const remaining   = totalPoints - donePoints

  const hasDateInfo = sprint?.startDate && sprint?.endDate && isValid(parseISO(sprint.startDate))
  const startDate   = hasDateInfo ? parseISO(sprint!.startDate!) : null
  const endDate     = hasDateInfo ? parseISO(sprint!.endDate!)   : null
  const totalDays   = startDate && endDate ? Math.max(differenceInDays(endDate, startDate), 1) : 14
  const elapsed     = startDate ? Math.max(0, Math.min(differenceInDays(today, startDate), totalDays)) : 0
  const daysLeft    = startDate ? Math.max(0, totalDays - elapsed) : null

  // Velocity: points done per elapsed day
  const velocity     = elapsed > 0 ? donePoints / elapsed : 0
  const projectedEnd = velocity > 0 && remaining > 0 ? Math.ceil(remaining / velocity) : null

  // SVG chart geometry
  const W = 560; const H = 240; const PAD_L = 48; const PAD_B = 36; const PAD_T = 16; const PAD_R = 20
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  function toX(day: number)    { return PAD_L + (day / totalDays) * chartW }
  function toY(pts: number)    { return PAD_T + chartH - (totalPoints > 0 ? (pts / totalPoints) * chartH : 0) }

  // Ideal line points
  const idealPoints = `${toX(0)},${toY(totalPoints)} ${toX(totalDays)},${toY(0)}`

  // Actual projected line: from today to 0 at projected completion
  const projDay   = elapsed + (projectedEnd ?? 0)
  const actPoints = totalPoints > 0
    ? `${toX(0)},${toY(totalPoints)} ${toX(elapsed)},${toY(remaining)} ${toX(Math.min(projDay, totalDays + 4))},${toY(0)}`
    : ''

  const grid  = isDarkMode ? '#1e2535' : '#f3f4f6'
  const text  = isDarkMode ? '#64748b' : '#9ca3af'
  const ideal = isDarkMode ? '#7c3aed60' : '#8b5cf640'
  const act   = isDarkMode ? '#3b82f6' : '#2563eb'
  const todayLine = isDarkMode ? '#334155' : '#e5e7eb'

  // X axis: show a label every ~3 days
  const xLabels: number[] = []
  for (let d = 0; d <= totalDays; d += Math.max(1, Math.round(totalDays / 6))) xLabels.push(d)
  if (!xLabels.includes(totalDays)) xLabels.push(totalDays)

  // Y axis: 5 ticks
  const yTicks = totalPoints > 0 ? [0, 0.25, 0.5, 0.75, 1].map(r => Math.round(r * totalPoints)) : [0]

  const cardBg = isDarkMode ? 'bg-[#161b27] border-[#1e2535]' : 'bg-white border-gray-100'
  const muted  = isDarkMode ? 'text-slate-500' : 'text-gray-400'

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total pts', value: totalPoints, sub: 'del sprint' },
          { label: 'Completado', value: `${totalPoints > 0 ? Math.round(donePoints / totalPoints * 100) : 0}%`, sub: `${donePoints} pts listos` },
          { label: 'Restante', value: remaining, sub: `${daysLeft != null ? `${daysLeft} días` : '—'}` },
          { label: 'Velocidad', value: velocity > 0 ? `${velocity.toFixed(1)} pt/d` : '—', sub: projectedEnd != null ? `Termina en ${projectedEnd}d` : 'Insuficiente datos' },
        ].map(({ label, value, sub }) => (
          <div key={label} className={`card p-4 space-y-1`}>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>{label}</p>
            <p className={`text-2xl font-extrabold leading-none ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{value}</p>
            <p className={`text-xs ${muted}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className={`card p-5 ${cardBg}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Burndown del Sprint</h3>
            <p className={`text-xs mt-0.5 ${muted}`}>
              {hasDateInfo
                ? `${format(startDate!, 'd MMM', { locale: es })} → ${format(endDate!, 'd MMM', { locale: es })} · ${totalDays} días`
                : 'Fechas del sprint no disponibles en Jira — mostrando progreso actual'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-0.5 bg-violet-400 opacity-60 rounded" />
              <span className={muted}>Ideal</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-0.5 bg-blue-500 rounded" />
              <span className={muted}>Real</span>
            </span>
          </div>
        </div>

        {totalPoints === 0 ? (
          <p className={`text-center text-sm py-12 italic ${muted}`}>Sin story points asignados en este sprint</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 240 }}>
            {/* Grid lines */}
            {yTicks.map(pt => (
              <line key={pt} x1={PAD_L} y1={toY(pt)} x2={W - PAD_R} y2={toY(pt)}
                stroke={grid} strokeWidth="1" />
            ))}

            {/* Y axis labels */}
            {yTicks.map(pt => (
              <text key={pt} x={PAD_L - 6} y={toY(pt) + 4} textAnchor="end" fontSize="10" fill={text}>{pt}</text>
            ))}

            {/* X axis labels */}
            {xLabels.map(d => (
              <text key={d} x={toX(d)} y={H - PAD_B + 14} textAnchor="middle" fontSize="10" fill={text}>
                {hasDateInfo && startDate
                  ? format(addDays(startDate, d), 'd/M')
                  : `D${d}`}
              </text>
            ))}

            {/* Axes */}
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke={grid} strokeWidth="1.5" />
            <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke={grid} strokeWidth="1.5" />

            {/* Ideal line */}
            <polyline points={idealPoints} fill="none" stroke={ideal} strokeWidth="2" strokeDasharray="6 3" />

            {/* Actual + projected line */}
            {actPoints && (
              <polyline points={actPoints} fill="none" stroke={act} strokeWidth="2.5"
                strokeDasharray={`${toX(elapsed) - PAD_L} 0 1000`} />
            )}

            {/* Today vertical marker */}
            {elapsed > 0 && elapsed < totalDays && (
              <>
                <line x1={toX(elapsed)} y1={PAD_T} x2={toX(elapsed)} y2={H - PAD_B}
                  stroke={todayLine} strokeWidth="1.5" strokeDasharray="4 3" />
                <text x={toX(elapsed)} y={PAD_T - 4} textAnchor="middle" fontSize="9" fill={text} fontWeight="600">
                  Hoy
                </text>
              </>
            )}

            {/* Current remaining dot */}
            {elapsed >= 0 && (
              <circle cx={toX(elapsed)} cy={toY(remaining)} r="5" fill={act} stroke={isDarkMode ? '#161b27' : '#fff'} strokeWidth="2" />
            )}

            {/* Ideal position dot */}
            {elapsed > 0 && (
              <circle cx={toX(elapsed)} cy={toY(Math.max(0, totalPoints * (1 - elapsed / totalDays)))}
                r="4" fill={isDarkMode ? '#7c3aed' : '#8b5cf6'} stroke={isDarkMode ? '#161b27' : '#fff'} strokeWidth="2" opacity="0.7" />
            )}
          </svg>
        )}
      </div>
    </div>
  )
}

// ─── Capacity planning ────────────────────────────────────────────────────────

function CapacityView({ issues, sprintId, isDarkMode }: { issues: JiraIssue[]; sprintId: number | null; isDarkMode: boolean }) {
  const storageKey = `capacity-${sprintId}`
  const [capacities, setCapacities] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') } catch { return {} }
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(capacities))
  }, [capacities, storageKey])

  const byAssignee = useMemo(() => {
    const map: Record<string, { issues: JiraIssue[]; total: number; done: number; inprogress: number }> = {}
    issues.forEach(i => {
      const name = i.assignee || '(Sin asignar)'
      if (!map[name]) map[name] = { issues: [], total: 0, done: 0, inprogress: 0 }
      map[name].issues.push(i)
      const pts = i.story_points ?? 0
      map[name].total += pts
      if (getColId(i.status) === 'done') map[name].done += pts
      if (getColId(i.status) === 'inprogress') map[name].inprogress += pts
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  }, [issues])

  const teamTotal    = byAssignee.reduce((s, [, d]) => s + d.total, 0)
  const teamDone     = byAssignee.reduce((s, [, d]) => s + d.done, 0)
  const muted        = isDarkMode ? 'text-slate-500' : 'text-gray-400'
  const cardBg       = isDarkMode ? 'bg-[#161b27] border-[#1e2535]' : 'bg-white border-gray-100'
  const inputClass   = `w-16 text-center text-xs font-bold rounded-lg px-2 py-1.5 border outline-none transition-colors ${
    isDarkMode
      ? 'bg-[#0d1117] border-[#2d3548] text-slate-300 focus:border-primary-600'
      : 'bg-gray-50 border-gray-200 text-gray-700 focus:border-primary-400'
  }`

  if (byAssignee.length === 0) {
    return (
      <div className={`card p-12 text-center ${cardBg}`}>
        <People size="40" color={isDarkMode ? '#64748b' : '#9ca3af'} className="mx-auto mb-3" />
        <p className={`text-sm ${muted}`}>Sin tickets asignados en este sprint</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Team summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Puntos totales', value: teamTotal },
          { label: 'Completados', value: teamDone },
          { label: 'Miembros', value: byAssignee.length },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4 space-y-1">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>{label}</p>
            <p className={`text-2xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Per-assignee cards */}
      <div className="space-y-3">
        {byAssignee.map(([name, data]) => {
          const capacity = capacities[name] ?? 0
          const usedPct  = capacity > 0 ? Math.min((data.total / capacity) * 100, 100) : 0
          const donePct  = data.total > 0 ? (data.done / data.total) * 100 : 0
          const over     = capacity > 0 && data.total > capacity
          const initials = name !== '(Sin asignar)'
            ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            : '?'

          return (
            <div key={name} className={`card p-5 border ${cardBg}`}>
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold text-white ${
                  name === '(Sin asignar)'
                    ? isDarkMode ? 'bg-slate-700' : 'bg-gray-300'
                    : 'bg-gradient-to-br from-primary-400 to-primary-700'
                }`}>
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>{name}</p>
                      <p className={`text-xs mt-0.5 ${muted}`}>
                        {data.issues.length} ticket{data.issues.length !== 1 ? 's' : ''} · {data.total} pts asignados · {data.done} pts listos
                      </p>
                    </div>
                    {/* Capacity input */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[11px] font-medium ${muted}`}>Capacidad:</span>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={capacity || ''}
                        placeholder="—"
                        onChange={e => setCapacities(prev => ({ ...prev, [name]: Math.max(0, Number(e.target.value)) }))}
                        className={inputClass}
                      />
                      <span className={`text-[11px] ${muted}`}>pts</span>
                    </div>
                  </div>

                  {/* Progress bars */}
                  <div className="space-y-1.5">
                    {/* Done progress */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] w-20 flex-shrink-0 font-medium ${muted}`}>Completado</span>
                      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#1e2535]' : 'bg-gray-100'}`}>
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${donePct}%` }} />
                      </div>
                      <span className={`text-[10px] w-8 text-right font-semibold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                        {Math.round(donePct)}%
                      </span>
                    </div>

                    {/* Capacity utilization */}
                    {capacity > 0 && (
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] w-20 flex-shrink-0 font-medium ${muted}`}>Capacidad</span>
                        <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#1e2535]' : 'bg-gray-100'}`}>
                          <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : 'bg-primary-500'}`}
                            style={{ width: `${usedPct}%` }} />
                        </div>
                        <span className={`text-[10px] w-8 text-right font-semibold ${
                          over
                            ? 'text-red-500'
                            : isDarkMode ? 'text-slate-400' : 'text-gray-500'
                        }`}>
                          {Math.round(usedPct)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Over capacity warning */}
                  {over && (
                    <p className="text-[11px] text-red-500 font-medium">
                      ⚠ Sobrecargado: {data.total - capacity} pts sobre la capacidad definida
                    </p>
                  )}

                  {/* Status breakdown chips */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {Object.entries(
                      data.issues.reduce((acc, i) => {
                        acc[i.status] = (acc[i.status] ?? 0) + 1
                        return acc
                      }, {} as Record<string, number>)
                    ).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                      <span key={status} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isDarkMode ? 'bg-[#1e2535] text-slate-400' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {status} · {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Board page ───────────────────────────────────────────────────────────────

function useRelativeTime(date: Date | null) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!date) return
    const update = () => {
      const secs = Math.floor((Date.now() - date.getTime()) / 1000)
      if (secs < 5)   setLabel('ahora mismo')
      else if (secs < 60)  setLabel(`hace ${secs}s`)
      else             setLabel(`hace ${Math.floor(secs / 60)}m`)
    }
    update()
    const t = setInterval(update, 5000)
    return () => clearInterval(t)
  }, [date])
  return label
}

export function Board() {
  const { isDarkMode } = useAppStore()
  const { sprints, loading: loadingSprints } = useJiraSprints()
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('kanban')

  useEffect(() => {
    if (sprints.length && !selectedSprintId) {
      const active = sprints.find(s => s.state === 'active') ?? sprints[0]
      setSelectedSprintId(active.id)
    }
  }, [sprints, selectedSprintId])

  const { issues, loading: loadingIssues, lastUpdated } = useJiraSprintIssues(selectedSprintId)
  const selectedSprint = sprints.find(s => s.id === selectedSprintId)
  const relativeTime = useRelativeTime(lastUpdated)

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'kanban',    label: 'Kanban',    icon: Element4 },
    { id: 'burndown',  label: 'Burndown',  icon: TrendDown },
    { id: 'capacidad', label: 'Capacidad', icon: People },
  ]

  const toggleBg = isDarkMode ? 'bg-[#161b27] border-[#1e2535]' : 'bg-white border-gray-100'
  const muted    = isDarkMode ? 'text-slate-400' : 'text-gray-500'

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Tablero"
        breadcrumb="Sprint"
        subtitle={selectedSprint?.name}
      />

      <main className="flex-1 p-6 space-y-4 overflow-auto flex flex-col">

        {/* Controls bar */}
        <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
          {/* Tab toggle */}
          <div className={`flex items-center gap-1 rounded-xl p-1 border shadow-sm ${toggleBg}`}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  tab === id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : isDarkMode
                      ? 'text-slate-400 hover:text-slate-200 bg-transparent'
                      : 'text-gray-500 hover:text-gray-700 bg-transparent'
                }`}
              >
                <Icon size="14" color={tab === id ? '#ffffff' : isDarkMode ? '#94a3b8' : '#6b7280'} />
                {label}
              </button>
            ))}
          </div>

          {/* Sprint selector */}
          {!loadingSprints && sprints.length > 0 && (
            <div className="relative">
              <select
                className="input !py-2 !pl-3 !pr-8 text-sm appearance-none cursor-pointer"
                value={selectedSprintId ?? ''}
                onChange={e => setSelectedSprintId(Number(e.target.value))}
              >
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.state === 'active' ? '(activo)' : s.state === 'closed' ? '(cerrado)' : ''}
                  </option>
                ))}
              </select>
              <ArrowDown2 size="14" color={isDarkMode ? '#64748b' : '#6b7280'} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {loadingSprints && (
            <span className={`text-sm ${muted}`}>Cargando sprints…</span>
          )}

          {/* Live indicator */}
          {lastUpdated && (
            <div className={`ml-auto flex items-center gap-1.5 text-xs ${muted}`}>
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
              </span>
              En vivo · {relativeTime}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {loadingIssues ? (
            <div className="card p-8 h-48">
              <LoadingOverlay message="Cargando issues desde Jira…" />
            </div>
          ) : tab === 'kanban' ? (
            <KanbanView issues={issues} isDarkMode={isDarkMode} />
          ) : tab === 'burndown' ? (
            <BurndownView issues={issues} sprint={selectedSprint} isDarkMode={isDarkMode} />
          ) : (
            <CapacityView issues={issues} sprintId={selectedSprintId} isDarkMode={isDarkMode} />
          )}
        </div>
      </main>
    </div>
  )
}
