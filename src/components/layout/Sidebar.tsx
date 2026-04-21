import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Sparkles,
  CalendarDays,
  BarChart2,
  Settings,
  ListTodo,
  LogOut,
  Kanban,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store'

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD as string | undefined

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily', icon: CalendarDays, label: 'Reporte Diario' },
  { to: '/sprint', icon: BarChart2, label: 'Reporte Sprint' },
  { to: '/board', icon: Kanban, label: 'Tablero' },
  { to: '/backlog', icon: ListTodo, label: 'Backlog' },
]
const workNav  = [{ to: '/create', icon: Sparkles, label: 'Crear Ticket' }]
const otherNav = [{ to: '/settings', icon: Settings, label: 'Configuración' }]

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  const { isDarkMode, setSidebarOpen } = useAppStore()
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 w-full group',
          isActive
            ? 'bg-primary-600 text-white shadow-sm'
            : isDarkMode
              ? 'text-slate-400 hover:bg-white/6 hover:text-white'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={clsx('w-4 h-4 flex-shrink-0 transition-colors',
            isActive
              ? 'text-white'
              : isDarkMode
                ? 'text-slate-500 group-hover:text-slate-200'
                : 'text-gray-400 group-hover:text-gray-600'
          )} />
          <span>{label}</span>
          {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar() {
  const { workspace, user, isDarkMode, clearWorkspace, setUser, simpleAuthSession, setSimpleAuth, sidebarOpen, setSidebarOpen } = useAppStore()
  const navigate = useNavigate()

  const projectKey = workspace?.jira_project_key
  const userEmail  = user?.email ?? workspace?.jira_email ?? null
  const initials   = projectKey
    ? projectKey.slice(0, 2).toUpperCase()
    : userEmail
      ? userEmail.slice(0, 2).toUpperCase()
      : 'GS'

  const labelClass = `text-[10px] font-bold uppercase tracking-[0.12em] px-3 mb-2 ${
    isDarkMode ? 'text-slate-500' : 'text-gray-400'
  }`

  const showLogout = (supabase && user) || (!supabase && APP_PASSWORD && simpleAuthSession)

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut()
      setUser(null)
    } else {
      setSimpleAuth(false)
    }
    clearWorkspace()
    setSidebarOpen(false)
    navigate('/login')
  }

  const sidebarBg = isDarkMode ? 'bg-[#0d1117] border-[#1e2535]' : 'bg-white border-gray-100'

  return (
    <aside className={clsx(
      'fixed inset-y-0 left-0 w-60 flex flex-col z-30 border-r transition-transform duration-200',
      sidebarBg,
      // Mobile: slide in/out. Desktop: always visible.
      sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    )}>

      {/* Logo + mobile close button */}
      <div className={`flex items-center gap-3 px-5 py-5 border-b ${isDarkMode ? 'border-[#1e2535]' : 'border-gray-100'}`}>
        <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg">
          <ListTodo className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Jira AI</p>
          <p className={`text-[10px] leading-tight ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>Powered by Claude</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className={clsx(
            'md:hidden w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0',
            isDarkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-white/8' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className={labelClass + ' block'}>Menú</p>
        {mainNav.map((item) => <NavItem key={item.to} {...item} />)}

        <p className={labelClass + ' block mt-5 pt-1'}>Herramientas</p>
        {workNav.map((item) => <NavItem key={item.to} {...item} />)}

        <p className={labelClass + ' block mt-5 pt-1'}>Otros</p>
        {otherNav.map((item) => <NavItem key={item.to} {...item} />)}
      </nav>

      {/* User profile + logout */}
      <div className={`px-3 py-3 border-t ${isDarkMode ? 'border-[#1e2535]' : 'border-gray-100'} space-y-1`}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl`}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600
                          flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold leading-tight truncate ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              {projectKey ? `Proyecto ${projectKey}` : 'GetSellers AI'}
            </p>
            <p className={`text-[10px] truncate leading-tight mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
              {userEmail ?? 'Sin configurar'}
            </p>
          </div>
        </div>

        {showLogout && (
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
              isDarkMode
                ? 'text-slate-500 hover:bg-red-900/20 hover:text-red-400'
                : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        )}
      </div>
    </aside>
  )
}
