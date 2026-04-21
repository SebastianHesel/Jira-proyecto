import { Link } from 'react-router-dom'
import { Ticket, AlertTriangle, Zap, ArrowRight, CheckCircle2, BarChart2, TrendingUp, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Header } from '../components/layout/Header'
import { StatsCard } from '../components/ui/StatsCard'
import { PriorityBadge, TypeBadge, StatusBadge } from '../components/ui/Badge'
import { LoadingOverlay } from '../components/ui/Spinner'
import { useJiraSprints, useJiraSprintIssues, useJiraTodayIssues } from '../hooks/useJiraData'
import { useAppStore } from '../store'
import { useEffect, useState } from 'react'

export function Dashboard() {
  const { isConfigured, isDarkMode } = useAppStore()
  const { sprints } = useJiraSprints()
  const [activeSprint, setActiveSprint] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    if (sprints.length) {
      const active = sprints.find((s) => s.state === 'active') ?? sprints[0]
      setActiveSprint({ id: active.id, name: active.name })
    }
  }, [sprints])

  const { issues: sprintIssues, loading: loadingSprint } = useJiraSprintIssues(activeSprint?.id ?? null)
  const { issues: todayIssues, loading: loadingToday } = useJiraTodayIssues()

  const highPriorityCount = sprintIssues.filter((i) => i.priority === 'High' || i.priority === 'Highest').length
  const blockers = sprintIssues.filter((i) => i.status === 'Blocked').length
  const inProgress = sprintIssues.filter((i) => i.status === 'In Progress').length
  const done = sprintIssues.filter((i) => i.status === 'Done').length
  const byStatus: Record<string, number> = sprintIssues.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1; return acc
  }, {} as Record<string, number>)
  const progress = sprintIssues.length ? Math.round((done / sprintIssues.length) * 100) : 0

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Dashboard" breadcrumb="GetSellers" subtitle={activeSprint?.name} />

      <main className="flex-1 p-6 space-y-5">

        {/* Config warning */}
        {!isConfigured && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 rounded-2xl">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Configuración incompleta</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Conecta tu cuenta de Jira.{' '}
                <Link to="/settings" className="underline font-semibold">Ir a configuración →</Link>
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Tickets Sprint" value={loadingSprint ? '…' : sprintIssues.length}
            subtitle={activeSprint?.name} icon={Ticket}
            iconColor="text-violet-600 dark:text-violet-400" iconBg="bg-violet-50 dark:bg-violet-900/30" />
          <StatsCard title="Alta Prioridad" value={loadingSprint ? '…' : highPriorityCount}
            subtitle="High + Highest" icon={AlertTriangle}
            iconColor="text-orange-500 dark:text-orange-400" iconBg="bg-orange-50 dark:bg-orange-900/30" />
          <StatsCard title="En Progreso" value={loadingSprint ? '…' : inProgress}
            subtitle="Asignados actualmente" icon={Zap}
            iconColor="text-emerald-600 dark:text-emerald-400" iconBg="bg-emerald-50 dark:bg-emerald-900/30" />
          <StatsCard title="Bloqueadores" value={loadingSprint ? '…' : blockers}
            subtitle="Requieren atención" icon={BarChart2}
            iconColor="text-red-500 dark:text-red-400" iconBg="bg-red-50 dark:bg-red-900/30" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Tickets creados hoy */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-[#1e2535]">
              <div>
                <h2 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Tickets creados hoy</h2>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                  {!loadingToday && `${todayIssues.length} tickets · `}{format(new Date(), "d 'de' MMMM", { locale: es })}
                </p>
              </div>
              <Link to="/daily" className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 px-3 py-1.5 rounded-xl">
                Ver reporte <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loadingToday ? (
              <LoadingOverlay message="Cargando desde Jira..." />
            ) : todayIssues.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-gray-400">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-[#1e2535] flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-gray-300 dark:text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No hay tickets hoy</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Crea el primero con AI</p>
                </div>
                <Link to="/create" className="btn-primary text-xs">
                  <Sparkles className="w-3.5 h-3.5" /> Crear ticket
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-[#1e2535]">
                {todayIssues.slice(0, 8).map((issue) => (
                  <div key={issue.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-white/4 transition-colors">
                    <TypeBadge type={issue.issue_type as never} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500">{issue.jira_issue_key}</span>
                        <PriorityBadge priority={issue.priority as never} />
                      </div>
                      <p className={`text-sm font-medium truncate mt-0.5 ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>{issue.title}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {issue.assignee && (
                        <span className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block truncate max-w-[90px]">{issue.assignee}</span>
                      )}
                      <StatusBadge status={issue.status as never} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Quick actions */}
            <div className="card p-5">
              <p className={`text-[11px] font-bold uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>Acciones rápidas</p>
              <div className="space-y-2">
                <Link to="/create" className="btn-primary w-full justify-center">
                  <Sparkles className="w-4 h-4" /> Nuevo Ticket con AI
                </Link>
                <Link to="/daily" className="btn-secondary w-full justify-center">Ver Reporte Diario</Link>
                <Link to="/sprint" className="btn-secondary w-full justify-center">Ver Reporte Sprint</Link>
              </div>
            </div>

            {/* Sprint progress */}
            {activeSprint && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>Progreso</p>
                    <p className={`text-sm font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{activeSprint.name}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/40 px-2.5 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" /> {progress}%
                  </span>
                </div>

                {loadingSprint ? <LoadingOverlay message="" /> : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-gray-400 dark:text-slate-500 font-medium">Completados</span>
                        <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>{done} / {sprintIssues.length}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-[#1e2535] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, #7c3aed, #a78bfa)'
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Por hacer', count: byStatus['To Do'] ?? 0, color: 'text-gray-600 dark:text-slate-400', bg: 'bg-gray-50 dark:bg-[#1e2535]' },
                        { label: 'En curso', count: byStatus['In Progress'] ?? 0, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                        { label: 'Listo', count: done, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                      ].map(({ label, count, color, bg }) => (
                        <div key={label} className={`${bg} rounded-xl p-2.5 text-center`}>
                          <p className={`text-xl font-extrabold ${color}`}>{count}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 font-medium leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
