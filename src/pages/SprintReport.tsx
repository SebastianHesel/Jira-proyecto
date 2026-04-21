import { useState, useEffect, useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { MessageSquare, RefreshCw, ShieldAlert, Zap, CheckCircle, Ticket, AlertTriangle, TrendingUp } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { LoadingOverlay } from '../components/ui/Spinner'
import { generateSprintSummary } from '../lib/openai'
import { useJiraSprints, useJiraSprintIssues, useJiraBacklog, useAllProjectIssues } from '../hooks/useJiraData'
import { useAppStore } from '../store'
import type { JiraIssue } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countBy(items: JiraIssue[], key: keyof JiraIssue): Record<string, number> {
  return items.reduce((acc, item) => {
    const val = String(item[key] ?? '—')
    acc[val] = (acc[val] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
}

type View = 'sprint' | 'backlog'

// ─── Color palettes ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'To Do':             '#f59e0b',
  'Blocked':           '#ef4444',
  'En Curso':          '#3b82f6',
  'In Progress':       '#3b82f6',
  'Partially Completed': '#06b6d4',
  'Under Review':      '#8b5cf6',
  'Aprobado':          '#84cc16',
  'Approved':          '#84cc16',
  'Done':              '#10b981',
  'Completado':        '#10b981',
  'Closed':            '#10b981',
}

const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#ef4444',
  High:    '#f97316',
  Medium:  '#eab308',
  Low:     '#8b5cf6',
  Lowest:  '#94a3b8',
}

const TYPE_COLORS: Record<string, string> = {
  Epic:       '#7c3aed',
  Story:      '#10b981',
  Task:       '#3b82f6',
  Bug:        '#ef4444',
  'Sub-task': '#94a3b8',
}

function getStatusColor(s: string) {
  return STATUS_COLORS[s] ?? '#94a3b8'
}
function getPriorityColor(p: string) {
  return PRIORITY_COLORS[p] ?? '#94a3b8'
}
function getTypeColor(t: string) {
  return TYPE_COLORS[t] ?? '#94a3b8'
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, isDarkMode }: { active?: boolean; payload?: { name: string; value: number; payload: { pct?: string } }[]; isDarkMode: boolean }) {
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div style={{
      background: isDarkMode ? '#1a2030' : '#ffffff',
      border: `1px solid ${isDarkMode ? '#2d3548' : '#e5e7eb'}`,
      borderRadius: 10,
      padding: '8px 12px',
      fontSize: 12,
      color: isDarkMode ? '#e2e8ef' : '#111827',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    }}>
      <span style={{ fontWeight: 700 }}>{name}</span>
      <span style={{ marginLeft: 8, color: isDarkMode ? '#94a3b8' : '#6b7280' }}>
        {value} {p.pct ? `· ${p.pct}` : ''}
      </span>
    </div>
  )
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({
  data, title, subtitle, isDarkMode,
}: {
  data: { name: string; value: number; color: string; pct: string }[]
  title: string
  subtitle?: string
  isDarkMode: boolean
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const cardBg  = isDarkMode ? 'bg-[#0f1724] border-[#1e2535]' : 'bg-white border-gray-100'
  const mutedCl = isDarkMode ? 'text-slate-500' : 'text-gray-400'

  return (
    <div className={`card p-5 border ${cardBg}`}>
      <div className="mb-4">
        <h3 className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>{title}</h3>
        {subtitle && <p className={`text-xs mt-0.5 ${mutedCl}`}>{subtitle}</p>}
      </div>

      {total === 0 ? (
        <p className={`text-center text-xs py-8 italic ${mutedCl}`}>Sin datos</p>
      ) : (
        <div className="flex gap-4 items-center">
          {/* Pie */}
          <div style={{ width: 110, height: 110, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={52}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip isDarkMode={isDarkMode} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5 min-w-0">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className={`text-xs truncate flex-1 font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>{d.name}</span>
                <span className={`text-xs font-bold flex-shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({
  pct, done, total, isDarkMode,
}: {
  pct: number; done: number; total: number; isDarkMode: boolean
}) {
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const cardBg = isDarkMode ? 'bg-[#0f1724] border-[#1e2535]' : 'bg-white border-gray-100'
  const mutedCl = isDarkMode ? 'text-slate-500' : 'text-gray-400'

  return (
    <div className={`card p-5 border ${cardBg} flex flex-col items-center justify-center gap-3`}>
      <h3 className={`text-sm font-bold self-start ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>Progreso del Sprint</h3>

      <div className="relative" style={{ width: 130, height: 130 }}>
        <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="65" cy="65" r={r} fill="none"
            stroke={isDarkMode ? '#1e2535' : '#f1f5f9'} strokeWidth="10" />
          <circle cx="65" cy="65" r={r} fill="none"
            stroke="#10b981" strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            {Math.round(pct)}%
          </span>
          <span className={`text-[10px] font-medium ${mutedCl}`}>completado</span>
        </div>
      </div>

      <div className="flex gap-5 w-full justify-center">
        <div className="text-center">
          <p className={`text-xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{done}</p>
          <p className={`text-[10px] ${mutedCl}`}>listos</p>
        </div>
        <div className={`w-px self-stretch ${isDarkMode ? 'bg-[#1e2535]' : 'bg-gray-100'}`} />
        <div className="text-center">
          <p className={`text-xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{total - done}</p>
          <p className={`text-[10px] ${mutedCl}`}>pendientes</p>
        </div>
        <div className={`w-px self-stretch ${isDarkMode ? 'bg-[#1e2535]' : 'bg-gray-100'}`} />
        <div className="text-center">
          <p className={`text-xl font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{total}</p>
          <p className={`text-[10px] ${mutedCl}`}>total</p>
        </div>
      </div>
    </div>
  )
}

// ─── Assignee stacked bar ─────────────────────────────────────────────────────

function AssigneeChart({ issues, isDarkMode }: { issues: JiraIssue[]; isDarkMode: boolean }) {
  const cardBg = isDarkMode ? 'bg-[#0f1724] border-[#1e2535]' : 'bg-white border-gray-100'
  const mutedCl = isDarkMode ? 'text-slate-500' : 'text-gray-400'
  const gridColor = isDarkMode ? '#1e2535' : '#f3f4f6'
  const labelColor = isDarkMode ? '#64748b' : '#9ca3af'

  const data = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    issues.forEach(i => {
      const name = (i.assignee || 'Sin asignar').split(' ')[0]
      if (!map[name]) map[name] = {}
      const s = i.status
      map[name][s] = (map[name][s] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => {
        const ta = Object.values(a).filter(v => typeof v === 'number').reduce((s: number, v) => s + (v as number), 0)
        const tb = Object.values(b).filter(v => typeof v === 'number').reduce((s: number, v) => s + (v as number), 0)
        return (tb as number) - (ta as number)
      })
  }, [issues])

  const allStatuses = useMemo(() => {
    const set = new Set<string>()
    issues.forEach(i => set.add(i.status))
    return Array.from(set)
  }, [issues])

  if (data.length === 0) {
    return (
      <div className={`card p-5 border ${cardBg}`}>
        <p className={`text-xs italic text-center py-8 ${mutedCl}`}>Sin datos de responsables</p>
      </div>
    )
  }

  return (
    <div className={`card p-5 border ${cardBg}`}>
      <div className="mb-4">
        <h3 className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>Carga por Responsable</h3>
        <p className={`text-xs mt-0.5 ${mutedCl}`}>Tickets por estado y persona</p>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
          barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: labelColor }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: labelColor, fontWeight: 600 }}
            axisLine={false} tickLine={false} width={72} />
          <Tooltip content={<ChartTooltip isDarkMode={isDarkMode} />} cursor={{ fill: isDarkMode ? '#ffffff08' : '#00000005' }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 12, color: labelColor }}
          />
          {allStatuses.map(s => (
            <Bar key={s} dataKey={s} name={s} stackId="a" fill={getStatusColor(s)} radius={0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Priority bar chart ───────────────────────────────────────────────────────

function PriorityChart({ data, isDarkMode }: { data: Record<string, number>; isDarkMode: boolean }) {
  const cardBg = isDarkMode ? 'bg-[#0f1724] border-[#1e2535]' : 'bg-white border-gray-100'
  const mutedCl = isDarkMode ? 'text-slate-500' : 'text-gray-400'
  const total = Object.values(data).reduce((s, v) => s + v, 0)

  const items = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
    .filter(p => data[p])
    .map(p => ({ label: p, count: data[p], color: getPriorityColor(p), pct: total ? Math.round(data[p] / total * 100) : 0 }))

  return (
    <div className={`card p-5 border ${cardBg}`}>
      <div className="mb-4">
        <h3 className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>Por Prioridad</h3>
        <p className={`text-xs mt-0.5 ${mutedCl}`}>{total} tickets totales</p>
      </div>

      {items.length === 0 ? (
        <p className={`text-xs italic text-center py-6 ${mutedCl}`}>Sin datos</p>
      ) : (
        <div className="space-y-3">
          {items.map(({ label, count, color, pct }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>{label}</span>
                </div>
                <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>{count} <span className={`font-normal ${mutedCl}`}>({pct}%)</span></span>
              </div>
              <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#1e2535]' : 'bg-gray-100'}`}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SprintReport page ────────────────────────────────────────────────────────

export function SprintReport() {
  const { isConfigured, isDarkMode } = useAppStore()
  const { sprints, loading: loadingSprints } = useJiraSprints()
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null)
  const [view, setView] = useState<View>('sprint')
  const [summary, setSummary] = useState('')
  const [generatingSummary, setGeneratingSummary] = useState(false)

  const { issues: sprintIssues, loading: loadingIssues } = useJiraSprintIssues(selectedSprintId)
  const { issues: backlogIssues, loading: loadingBacklog } = useJiraBacklog()
  const { issues: allIssues, loading: loadingAll } = useAllProjectIssues()

  const hasNoSprints = !loadingSprints && sprints.length === 0

  useEffect(() => {
    if (!loadingSprints) {
      if (sprints.length) setSelectedSprintId(sprints[0].id)
      else setView('backlog')
    }
  }, [loadingSprints, sprints.length])

  const issues = view === 'sprint' ? sprintIssues : hasNoSprints ? allIssues : backlogIssues
  const loading = view === 'sprint' ? loadingIssues : hasNoSprints ? loadingAll : loadingBacklog
  const selectedSprint = sprints.find((s) => s.id === selectedSprintId)

  const byType     = countBy(issues, 'issue_type')
  const byPriority = countBy(issues, 'priority')
  const byStatus   = countBy(issues, 'status')
  const byAssignee = countBy(issues, 'assignee')

  const blockers  = issues.filter(i => /blocked/i.test(i.status))
  const doneCount = issues.filter(i => /done|completado|closed|resolved|finished/i.test(i.status)).length
  const highPrio  = issues.filter(i => i.priority === 'High' || i.priority === 'Highest').length
  const totalPts  = issues.reduce((s, i) => s + (i.story_points ?? 0), 0)
  const donePct   = issues.length ? Math.round(doneCount / issues.length * 100) : 0

  // Donut data
  const statusDonut = Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, color: getStatusColor(name), pct: `${Math.round(value / issues.length * 100)}%` }))

  const typeDonut = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, color: getTypeColor(name), pct: `${Math.round(value / issues.length * 100)}%` }))

  async function handleGenerateSummary() {
    setGeneratingSummary(true)
    const label = view === 'backlog' ? 'Backlog' : (selectedSprint?.name ?? 'Sprint')
    const text = await generateSprintSummary(label, issues)
    setSummary(text)
    setGeneratingSummary(false)
  }

  const toggleBg = isDarkMode ? 'bg-[#161b27] border-[#1e2535]' : 'bg-white border-gray-100'
  const muted    = isDarkMode ? 'text-slate-400' : 'text-gray-500'
  const cardBg   = isDarkMode ? 'bg-[#0f1724] border-[#1e2535]' : 'bg-white border-gray-100'

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Reporte por Sprint" breadcrumb="Reportes" subtitle="Datos reales desde Jira" />

      <main className="flex-1 p-6 space-y-5 overflow-auto">

        {/* ── Controls ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-1 rounded-xl p-1 shadow-sm border ${toggleBg}`}>
            {!hasNoSprints && (
              <button
                onClick={() => { setView('sprint'); setSummary('') }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  view === 'sprint'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : isDarkMode ? 'text-slate-400 hover:text-slate-200 bg-transparent' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 bg-transparent'
                }`}
              >
                Por Sprint
              </button>
            )}
            <button
              onClick={() => { setView('backlog'); setSummary('') }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                view === 'backlog'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : isDarkMode ? 'text-slate-400 hover:text-slate-200 bg-transparent' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 bg-transparent'
              }`}
            >
              {hasNoSprints ? 'Todos los issues' : 'Backlog'}
            </button>
          </div>

          {view === 'sprint' && (
            !loadingSprints ? (
              <select
                className="input w-52 !py-2"
                value={selectedSprintId ?? ''}
                onChange={e => { setSelectedSprintId(Number(e.target.value)); setSummary('') }}
              >
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.state === 'active' ? '🟢' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`text-sm ${muted}`}>Cargando sprints…</span>
            )
          )}

          {!isConfigured && (
            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl px-3 py-1.5">
              Conecta Jira en Configuración para ver datos reales
            </span>
          )}
        </div>

        {loading ? (
          <div className="card p-16"><LoadingOverlay message="Cargando datos desde Jira…" /></div>
        ) : (
          <>
            {/* ── KPI cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Ticket,        iconBg: 'bg-primary-50 dark:bg-primary-900/30',  iconCl: 'text-primary-600 dark:text-primary-400',  label: 'Total Tickets',   val: issues.length,  sub: view === 'backlog' ? 'En backlog' : selectedSprint?.name ?? '' },
                { icon: AlertTriangle, iconBg: 'bg-orange-50 dark:bg-orange-900/30',    iconCl: 'text-orange-500 dark:text-orange-400',    label: 'Alta Prioridad',  val: highPrio,       sub: 'High + Highest' },
                { icon: CheckCircle,   iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',  iconCl: 'text-emerald-600 dark:text-emerald-400',  label: 'Completados',     val: doneCount,      sub: issues.length ? `${donePct}% del total` : '0%' },
                { icon: TrendingUp,    iconBg: 'bg-violet-50 dark:bg-violet-900/30',    iconCl: 'text-violet-600 dark:text-violet-400',    label: 'Story Points',    val: totalPts,       sub: 'pts asignados' },
              ].map(({ icon: Icon, iconBg, iconCl, label, val, sub }) => (
                <div key={label} className={`card p-4 border ${cardBg}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${muted}`}>{label}</p>
                      <p className={`text-3xl font-extrabold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{val}</p>
                      <p className={`text-xs mt-1 ${muted}`}>{sub}</p>
                    </div>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
                      <Icon className={`w-4.5 h-4.5 ${iconCl}`} size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Charts row 1: progress ring + status donut + type donut ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ProgressRing pct={donePct} done={doneCount} total={issues.length} isDarkMode={isDarkMode} />
              <DonutChart
                title="Por Estado"
                subtitle="Distribución de tickets"
                data={statusDonut}
                isDarkMode={isDarkMode}
              />
              <DonutChart
                title="Por Tipo"
                subtitle="Historia, Tarea, Bug…"
                data={typeDonut}
                isDarkMode={isDarkMode}
              />
            </div>

            {/* ── Charts row 2: assignee stacked + priority bars ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <AssigneeChart issues={issues} isDarkMode={isDarkMode} />
              </div>
              <PriorityChart data={byPriority} isDarkMode={isDarkMode} />
            </div>

            {/* ── Blockers + AI Summary ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* AI Summary */}
              <div className={`card p-5 border ${cardBg}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Resumen ejecutivo</h2>
                      <p className={`text-xs ${muted}`}>Generado por Claude AI</p>
                    </div>
                  </div>
                  <button
                    className="btn-secondary text-xs gap-1.5"
                    onClick={handleGenerateSummary}
                    disabled={generatingSummary || issues.length === 0}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generatingSummary ? 'animate-spin' : ''}`} />
                    {summary ? 'Regenerar' : 'Generar'}
                  </button>
                </div>
                {generatingSummary && <LoadingOverlay message="Generando resumen…" />}
                {!generatingSummary && summary && (
                  <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-[#1a2030] border-[#1e2535]' : 'bg-gray-50 border-transparent'}`}>
                    <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>{summary}</p>
                  </div>
                )}
                {!generatingSummary && !summary && (
                  <p className={`text-sm italic text-center py-6 ${muted}`}>
                    Haz clic en "Generar" para un análisis ejecutivo con AI.
                  </p>
                )}
              </div>

              {/* Blockers */}
              <div className={`card p-5 border ${cardBg}`}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Bloqueadores</h2>
                    <p className={`text-xs ${muted}`}>
                      {blockers.length > 0 ? `${blockers.length} requieren atención` : 'Sin bloqueadores activos'}
                    </p>
                  </div>
                  {blockers.length > 0 && (
                    <span className="ml-auto w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {blockers.length}
                    </span>
                  )}
                </div>
                {blockers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className={`text-xs ${muted}`}>¡Sin bloqueadores! El sprint va bien 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blockers.map(b => (
                      <div key={b.id} className="flex items-start gap-3 p-3 bg-red-50/60 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                        <span className="font-mono text-xs text-red-600 dark:text-red-400 flex-shrink-0 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-lg mt-0.5">
                          {b.jira_issue_key}
                        </span>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>{b.title}</p>
                          <p className={`text-xs mt-0.5 ${muted}`}>{b.assignee || 'Sin asignar'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Assignees summary ── */}
            {Object.keys(byAssignee).length > 0 && (
              <div className={`card p-5 border ${cardBg}`}>
                <h2 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Resumen por Responsable</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(byAssignee).sort((a, b) => b[1] - a[1]).map(([person, count]) => {
                    const personIssues = issues.filter(i => i.assignee === person)
                    const personDone = personIssues.filter(i => /done|completado|closed|resolved/i.test(i.status)).length
                    const pct = count > 0 ? Math.round(personDone / count * 100) : 0
                    const initials = (person || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                    return (
                      <div key={person} className={`flex items-center gap-3 p-3.5 rounded-xl border ${isDarkMode ? 'bg-[#161b27] border-[#1e2535]' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>{person || 'Sin asignar'}</p>
                          <p className={`text-[10px] ${muted}`}>{count} tickets · {pct}% listo</p>
                          <div className={`mt-1.5 w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#1e2535]' : 'bg-gray-200'}`}>
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Full table ── */}
            <div className={`card border ${cardBg}`}>
              <div className={`flex items-center gap-2.5 px-5 py-4 border-b ${isDarkMode ? 'border-[#1e2535]' : 'border-gray-50'}`}>
                <div>
                  <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {view === 'backlog' ? 'Backlog' : selectedSprint?.name ?? 'Sprint'}
                  </h2>
                  <p className={`text-xs ${muted}`}>{issues.length} tickets</p>
                </div>
              </div>

              {issues.length === 0 ? (
                <div className={`text-center py-14 text-sm ${muted}`}>
                  {isConfigured ? 'No hay tickets en esta vista' : 'Conecta Jira en Configuración para ver tickets reales'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${isDarkMode ? 'border-[#1e2535]' : 'border-gray-50'}`}>
                        {['Clave', 'Título', 'Tipo', 'Prioridad', 'Estado', 'Responsable', 'Pts'].map(h => (
                          <th key={h} className={`table-th ${h === 'Pts' ? 'text-right' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-[#1e2535]' : 'divide-gray-50'}`}>
                      {issues.map(issue => (
                        <tr key={issue.id} className="hover:bg-gray-50/50 dark:hover:bg-white/4 transition-colors">
                          <td className="table-td">
                            <span className="font-mono text-xs text-primary-600 dark:text-primary-400 whitespace-nowrap bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-lg">
                              {issue.jira_issue_key}
                            </span>
                          </td>
                          <td className="table-td">
                            <p className={`text-sm font-medium max-w-xs truncate ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>{issue.title}</p>
                            {issue.sprint_name && <p className={`text-xs mt-0.5 ${muted}`}>{issue.sprint_name}</p>}
                          </td>
                          <td className="table-td">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: getTypeColor(issue.issue_type) + '22', color: getTypeColor(issue.issue_type) }}>
                              {issue.issue_type}
                            </span>
                          </td>
                          <td className="table-td">
                            <span className="flex items-center gap-1.5 text-xs font-semibold"
                              style={{ color: getPriorityColor(issue.priority) }}>
                              <span className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: getPriorityColor(issue.priority) }} />
                              {issue.priority}
                            </span>
                          </td>
                          <td className="table-td">
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: getStatusColor(issue.status) + '22', color: getStatusColor(issue.status) }}>
                              {issue.status}
                            </span>
                          </td>
                          <td className={`table-td text-xs max-w-[120px] truncate ${muted}`}>{issue.assignee || '—'}</td>
                          <td className="table-td text-right">
                            {issue.story_points != null ? (
                              <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${isDarkMode ? 'bg-[#1e2535] text-slate-400' : 'bg-gray-100 text-gray-600'}`}>
                                {issue.story_points}
                              </span>
                            ) : <span className={`text-xs ${muted}`}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
