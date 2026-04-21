import { useState, useMemo } from 'react'
import { parseISO, format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowDown2,
  ArrowRight2,
  More,
  Add,
  Flag as FlagIcon,
  Calendar,
  RowVertical,
  TickSquare,
} from 'iconsax-react'
import { Header } from '../components/layout/Header'
import { LoadingOverlay } from '../components/ui/Spinner'
import { useJiraSprints, useJiraSprintIssues, useJiraBacklog } from '../hooks/useJiraData'
import { useAppStore } from '../store'
import type { JiraIssue } from '../types'

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<string, { bg: string; text: string; bgDark: string; textDark: string; flag: string }> = {
  Highest: { bg: '#fef2f2', text: '#b91c1c', bgDark: '#450a0a', textDark: '#f87171', flag: '#ef4444' },
  High:    { bg: '#fff7ed', text: '#c2410c', bgDark: '#431407', textDark: '#fb923c', flag: '#f97316' },
  Medium:  { bg: '#fefce8', text: '#a16207', bgDark: '#3a2a00', textDark: '#facc15', flag: '#eab308' },
  Low:     { bg: '#f5f3ff', text: '#6d28d9', bgDark: '#2e1065', textDark: '#a78bfa', flag: '#8b5cf6' },
  Lowest:  { bg: '#f0fdf4', text: '#15803d', bgDark: '#052e16', textDark: '#4ade80', flag: '#22c55e' },
}

const TYPE_CFG: Record<string, { bg: string; text: string; bgDark: string; textDark: string }> = {
  Epic:      { bg: '#f5f3ff', text: '#6d28d9', bgDark: '#2e1065', textDark: '#a78bfa' },
  Story:     { bg: '#eff6ff', text: '#1d4ed8', bgDark: '#1e3a5f', textDark: '#60a5fa' },
  Task:      { bg: '#f0fdf4', text: '#15803d', bgDark: '#052e16', textDark: '#4ade80' },
  Bug:       { bg: '#fef2f2', text: '#b91c1c', bgDark: '#450a0a', textDark: '#f87171' },
  'Sub-task':{ bg: '#f8fafc', text: '#475569', bgDark: '#1e2535', textDark: '#94a3b8' },
}

// ─── Table row ────────────────────────────────────────────────────────────────

function IssueRow({ issue, isDarkMode }: { issue: JiraIssue; isDarkMode: boolean }) {
  const [checked, setChecked] = useState(false)
  const pCfg = PRIORITY_CFG[issue.priority] ?? PRIORITY_CFG.Low
  const tCfg = TYPE_CFG[issue.issue_type] ?? TYPE_CFG.Task

  const dateStr = issue.created_at && isValid(parseISO(issue.created_at))
    ? format(parseISO(issue.created_at), 'dd MMM yyyy', { locale: es })
    : '—'

  const initials = issue.assignee
    ? issue.assignee.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : null

  const subtitle = [...(issue.labels ?? []), ...(issue.components ?? [])].join(', ') || issue.sprint_name || '—'

  const rowBg    = isDarkMode ? 'hover:bg-white/4' : 'hover:bg-gray-50/80'
  const border   = isDarkMode ? 'border-[#1e2535]' : 'border-gray-100'
  const textMain = isDarkMode ? 'text-slate-200' : 'text-gray-800'
  const textSub  = isDarkMode ? 'text-slate-500' : 'text-gray-400'

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b ${border} ${rowBg} group transition-colors cursor-pointer`}>
      {/* Drag handle */}
      <span className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${textSub}`}>
        <RowVertical size="14" color={isDarkMode ? '#475569' : '#d1d5db'} />
      </span>

      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); setChecked(c => !c) }}
        className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
          checked
            ? 'bg-primary-600 border-primary-600'
            : isDarkMode ? 'border-slate-600 hover:border-slate-400' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {checked && <TickSquare size="12" color="#fff" variant="Bold" />}
      </button>

      {/* Task name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono ${textSub}`}>{issue.jira_issue_key}</span>
          <p className={`text-[13px] font-medium truncate ${textMain} ${checked ? 'line-through opacity-50' : ''}`}>
            {issue.title}
          </p>
        </div>
        <p className={`text-xs truncate mt-0.5 ${textSub}`}>{subtitle}</p>
      </div>

      {/* People */}
      <div className="flex-shrink-0 w-24 flex justify-center">
        {initials ? (
          <div
            className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#0d1117]"
            title={issue.assignee}
          >
            {initials}
          </div>
        ) : (
          <div className={`w-7 h-7 rounded-full border-2 border-dashed ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`} />
        )}
      </div>

      {/* Type */}
      <div className="flex-shrink-0 w-24 flex justify-center">
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
          style={{ background: isDarkMode ? tCfg.bgDark : tCfg.bg, color: isDarkMode ? tCfg.textDark : tCfg.text }}
        >
          {issue.issue_type}
        </span>
      </div>

      {/* Date */}
      <div className={`flex-shrink-0 w-36 flex items-center gap-1.5 text-xs ${textSub}`}>
        <Calendar size="13" color={isDarkMode ? '#475569' : '#9ca3af'} />
        {dateStr}
      </div>

      {/* Priority */}
      <div className="flex-shrink-0 w-24 flex items-center justify-center gap-1.5">
        <FlagIcon size="13" color={pCfg.flag} variant="Bold" />
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: isDarkMode ? pCfg.bgDark : pCfg.bg, color: isDarkMode ? pCfg.textDark : pCfg.text }}
        >
          {issue.priority}
        </span>
      </div>

      {/* Menu */}
      <button className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
        isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
      }`}>
        <More size="14" color={isDarkMode ? '#64748b' : '#9ca3af'} />
      </button>
    </div>
  )
}

// ─── Sprint section ───────────────────────────────────────────────────────────

interface SprintSection {
  label: string
  state: 'active' | 'closed' | 'backlog'
  issues: JiraIssue[]
  loading?: boolean
}

const SECTION_CFG = {
  active:  { dot: '#f59e0b', dotDark: '#fbbf24', bg: '#fffbeb', text: '#b45309', bgDark: '#2d1f00', textDark: '#fbbf24' },
  closed:  { dot: '#10b981', dotDark: '#34d399', bg: '#ecfdf5', text: '#047857', bgDark: '#022c22', textDark: '#34d399' },
  backlog: { dot: '#8b5cf6', dotDark: '#a78bfa', bg: '#f5f3ff', text: '#6d28d9', bgDark: '#2e1065', textDark: '#a78bfa' },
}

function SprintGroup({ section, isDarkMode }: { section: SprintSection; isDarkMode: boolean }) {
  const [open, setOpen] = useState(true)
  const cfg = SECTION_CFG[section.state]

  const cardBg   = isDarkMode ? '#0d1117' : '#ffffff'
  const border   = isDarkMode ? '#1e2535' : '#f1f5f9'
  const headerBg = isDarkMode ? '#111827' : '#f9fafb'
  const textSub  = isDarkMode ? 'text-slate-500' : 'text-gray-400'
  const textHead = isDarkMode ? 'text-slate-400' : 'text-gray-400'

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}`, boxShadow: isDarkMode ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.05)' }}>

      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left"
        style={{ background: headerBg }}
      >
        <span className="flex-shrink-0" style={{ color: isDarkMode ? '#475569' : '#9ca3af' }}>
          {open
            ? <ArrowDown2 size="14" color={isDarkMode ? '#475569' : '#9ca3af'} />
            : <ArrowRight2 size="14" color={isDarkMode ? '#475569' : '#9ca3af'} />
          }
        </span>

        <span
          className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: isDarkMode ? cfg.bgDark : cfg.bg, color: isDarkMode ? cfg.textDark : cfg.text }}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isDarkMode ? cfg.dotDark : cfg.dot }} />
          {section.label}
        </span>

        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: isDarkMode ? cfg.dotDark : cfg.dot }}
        >
          {section.issues.length}
        </span>

        <span className={`ml-auto text-xs ${textSub}`}>
          {section.issues.filter(i => i.status === 'Done').length} / {section.issues.length} completados
        </span>
      </button>

      {open && (
        <div style={{ background: cardBg }}>
          {/* Table header */}
          <div
            className={`flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide border-b ${textHead}`}
            style={{ borderColor: border, background: isDarkMode ? '#0a0f1a' : '#fafafa' }}
          >
            <span className="w-4 flex-shrink-0" /> {/* drag */}
            <span className="w-4 flex-shrink-0" /> {/* checkbox */}
            <span className="flex-1">Nombre de tarea</span>
            <span className="w-24 text-center">Personas</span>
            <span className="w-24 text-center">Tipo</span>
            <span className="w-36">Fecha</span>
            <span className="w-24 text-center">Prioridad</span>
            <span className="w-7 flex-shrink-0" /> {/* menu */}
          </div>

          {/* Rows */}
          {section.loading ? (
            <div className="h-24"><LoadingOverlay message="Cargando..." /></div>
          ) : section.issues.length === 0 ? (
            <div className={`flex items-center justify-center py-10 text-sm ${isDarkMode ? 'text-slate-600' : 'text-gray-300'}`}>
              No hay tickets en esta sección
            </div>
          ) : (
            section.issues.map(issue => (
              <IssueRow key={issue.id} issue={issue} isDarkMode={isDarkMode} />
            ))
          )}

          {/* Add row */}
          <button className={`w-full flex items-center gap-2 px-6 py-2.5 text-xs font-medium transition-colors ${
            isDarkMode ? 'text-slate-600 hover:text-slate-400 hover:bg-white/4' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}>
            <Add size="14" color={isDarkMode ? '#334155' : '#9ca3af'} />
            Agregar ticket
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Backlog page ─────────────────────────────────────────────────────────────

export function Backlog() {
  const { isDarkMode } = useAppStore()
  const { sprints, loading: loadingSprints } = useJiraSprints()
  const { issues: backlogIssues, loading: loadingBacklog } = useJiraBacklog()

  // Pick active + up to 2 most-recent closed sprints
  const activeSprint  = sprints.find(s => s.state === 'active')
  const closedSprints = sprints.filter(s => s.state === 'closed').slice(-2)

  const { issues: activeIssues,  loading: loadingActive  } = useJiraSprintIssues(activeSprint?.id ?? null)
  const { issues: closed1Issues, loading: loadingClosed1 } = useJiraSprintIssues(closedSprints[0]?.id ?? null)
  const { issues: closed2Issues, loading: loadingClosed2 } = useJiraSprintIssues(closedSprints[1]?.id ?? null)

  // Exclude sprint issues from backlog list
  const sprintIssueIds = useMemo(() => new Set([
    ...activeIssues.map(i => i.id),
    ...closed1Issues.map(i => i.id),
    ...closed2Issues.map(i => i.id),
  ]), [activeIssues, closed1Issues, closed2Issues])

  const pureBacklog = backlogIssues.filter(i => !sprintIssueIds.has(i.id))

  const sections: SprintSection[] = [
    ...(activeSprint ? [{
      label: activeSprint.name,
      state: 'active' as const,
      issues: activeIssues,
      loading: loadingActive,
    }] : []),
    ...(closedSprints[1] ? [{
      label: closedSprints[1].name,
      state: 'closed' as const,
      issues: closed2Issues,
      loading: loadingClosed2,
    }] : []),
    ...(closedSprints[0] ? [{
      label: closedSprints[0].name,
      state: 'closed' as const,
      issues: closed1Issues,
      loading: loadingClosed1,
    }] : []),
    {
      label: 'Backlog',
      state: 'backlog' as const,
      issues: pureBacklog,
      loading: loadingBacklog,
    },
  ]

  const isLoading = loadingSprints

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Backlog" breadcrumb="Proyecto" />

      <main className="flex-1 p-6 overflow-auto">

        {/* Page heading */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Backlog de Tareas
            </h1>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
              {sections.reduce((s, g) => s + g.issues.length, 0)} tickets en total
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            <Add size="16" color="#fff" />
            Nuevo ticket
          </button>
        </div>

        {isLoading ? (
          <div className="card h-48">
            <LoadingOverlay message="Cargando backlog desde Jira..." />
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map(section => (
              <SprintGroup key={section.label} section={section} isDarkMode={isDarkMode} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
