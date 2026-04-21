import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { RefreshCw, MessageSquare, Ticket, AlertTriangle, Zap } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PriorityBadge, TypeBadge, StatusBadge } from '../components/ui/Badge'
import { StatsCard } from '../components/ui/StatsCard'
import { LoadingOverlay } from '../components/ui/Spinner'
import { generateDailySummary } from '../lib/openai'
import { useJiraTodayIssues } from '../hooks/useJiraData'
import { useAppStore } from '../store'
import type { Priority } from '../types'

const PRIORITY_ORDER: Priority[] = ['Highest', 'High', 'Medium', 'Low', 'Lowest']

export function DailyReport() {
  const { isConfigured, isDarkMode } = useAppStore()
  const { issues, loading } = useJiraTodayIssues()
  const [summary, setSummary] = useState('')
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [filter, setFilter] = useState<'all' | Priority>('all')

  async function handleGenerateSummary() {
    setGeneratingSummary(true)
    const text = await generateDailySummary(issues)
    setSummary(text)
    setGeneratingSummary(false)
  }

  const filtered = filter === 'all' ? issues : issues.filter((i) => i.priority === filter)
  const highCount = issues.filter((i) => i.priority === 'High' || i.priority === 'Highest').length
  const inProgress = issues.filter((i) => i.status === 'In Progress').length

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Reporte Diario"
        breadcrumb="Reportes"
        subtitle={format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
      />

      <main className="flex-1 p-6 space-y-5 overflow-auto">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <StatsCard
            title="Tickets Hoy"
            value={loading ? '…' : issues.length}
            subtitle="Creados desde Jira"
            icon={Ticket}
            iconColor="text-primary-600 dark:text-primary-400"
            iconBg="bg-primary-50 dark:bg-primary-900/30"
          />
          <StatsCard
            title="Alta Prioridad"
            value={loading ? '…' : highCount}
            subtitle="Requieren atención"
            icon={AlertTriangle}
            iconColor="text-orange-500 dark:text-orange-400"
            iconBg="bg-orange-50 dark:bg-orange-900/30"
          />
          <StatsCard
            title="En Progreso"
            value={loading ? '…' : inProgress}
            subtitle="Asignados"
            icon={Zap}
            iconColor="text-emerald-600 dark:text-emerald-400"
            iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          />
        </div>

        {/* AI Summary */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Resumen ejecutivo</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500">Generado por Claude AI</p>
              </div>
            </div>
            <button
              className="btn-secondary text-xs gap-1.5"
              onClick={handleGenerateSummary}
              disabled={generatingSummary || issues.length === 0}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingSummary ? 'animate-spin' : ''}`} />
              {summary ? 'Regenerar' : 'Generar resumen'}
            </button>
          </div>
          {generatingSummary && <LoadingOverlay message="Generando resumen con Claude..." />}
          {!generatingSummary && summary && (
            <div className="bg-gray-50/70 dark:bg-[#1a2030] rounded-xl p-4 border border-transparent dark:border-[#1e2535]">
              <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{summary}</p>
            </div>
          )}
          {!generatingSummary && !summary && (
            <p className="text-sm text-gray-400 dark:text-slate-500 italic text-center py-4">
              {issues.length === 0 && !loading
                ? 'No hay tickets creados hoy para resumir.'
                : 'Haz clic en "Generar resumen" para obtener un análisis ejecutivo.'}
            </p>
          )}
        </div>

        {/* Issue list */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-[#1e2535]">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Tickets del día</h2>
              {!loading && (
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{filtered.length} tickets encontrados</p>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['all', ...PRIORITY_ORDER] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all duration-150 ${
                    filter === p
                      ? 'bg-primary-600 text-white shadow-sm'
                      : isDarkMode
                        ? 'bg-[#1e2535] text-slate-400 hover:bg-[#243044]'
                        : 'bg-gray-100/80 text-gray-500 hover:bg-gray-200/80'
                  }`}
                >
                  {p === 'all' ? 'Todos' : p}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <LoadingOverlay message="Cargando tickets desde Jira..." />
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">
              {isConfigured
                ? filter === 'all' ? 'No hay tickets creados hoy' : `No hay tickets con prioridad "${filter}" hoy`
                : 'Conecta Jira en Configuración para ver datos reales'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 dark:border-[#1e2535]">
                    {['Clave', 'Título', 'Tipo', 'Prioridad', 'Estado', 'Responsable', 'Pts'].map((h) => (
                      <th
                        key={h}
                        className={`table-th ${h === 'Pts' ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[#1e2535]">
                  {filtered.map((issue) => (
                    <tr key={issue.id} className="hover:bg-gray-50/50 dark:hover:bg-white/4 transition-colors">
                      <td className="table-td">
                        <span className="font-mono text-xs text-primary-600 dark:text-primary-400 whitespace-nowrap bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-lg">
                          {issue.jira_issue_key}
                        </span>
                      </td>
                      <td className="table-td">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 max-w-xs truncate">{issue.title}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{issue.sprint_name}</p>
                      </td>
                      <td className="table-td"><TypeBadge type={issue.issue_type as never} /></td>
                      <td className="table-td"><PriorityBadge priority={issue.priority as never} /></td>
                      <td className="table-td"><StatusBadge status={issue.status as never} /></td>
                      <td className="table-td text-xs text-gray-500 dark:text-slate-400 max-w-[120px] truncate">{issue.assignee || '—'}</td>
                      <td className="table-td text-right text-xs font-semibold text-gray-600 dark:text-slate-400">
                        {issue.story_points != null ? (
                          <span className="bg-gray-100 dark:bg-[#1e2535] px-2 py-1 rounded-lg">{issue.story_points}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
