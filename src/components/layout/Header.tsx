import { Bell, Search, ChevronRight, Moon, Sun, Menu } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAppStore } from '../../store'

interface HeaderProps {
  title: string
  subtitle?: string
  breadcrumb?: string
}

export function Header({ title, subtitle, breadcrumb }: HeaderProps) {
  const { workspace, isDarkMode, toggleDarkMode, setSidebarOpen } = useAppStore()
  const today = format(new Date(), "d MMM yyyy", { locale: es })
  const initials = workspace?.jira_project_key
    ? workspace.jira_project_key.slice(0, 2).toUpperCase()
    : 'GS'

  const iconBtn = `w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
    isDarkMode
      ? 'text-slate-400 hover:bg-white/8 hover:text-slate-200'
      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
  }`

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-7 flex-shrink-0 sticky top-0 z-10 backdrop-blur-sm">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setSidebarOpen(true)}
        className={`md:hidden mr-2 w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors ${
          isDarkMode ? 'text-slate-400 hover:bg-white/8 hover:text-slate-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        }`}
        title="Abrir menú"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Left: breadcrumb + title + subtitle */}
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        {breadcrumb && (
          <>
            <span className={`text-sm font-medium flex-shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
              {breadcrumb}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-gray-300'}`} />
          </>
        )}
        <h1 className={`text-sm font-semibold flex-shrink-0 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          {title}
        </h1>
        {subtitle && (
          <>
            <span className={`mx-0.5 flex-shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-gray-300'}`}>·</span>
            <span className={`text-xs truncate ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
              {subtitle}
            </span>
          </>
        )}
      </div>

      {/* Right: date + actions */}
      <div className="flex items-center gap-1 flex-shrink-0 ml-3">
        <span className={`text-xs mr-1 capitalize whitespace-nowrap ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
          {today}
        </span>

        <button
          onClick={toggleDarkMode}
          className={iconBtn}
          title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <button className={iconBtn} title="Buscar">
          <Search className="w-3.5 h-3.5" />
        </button>

        <button className={`${iconBtn} relative`} title="Notificaciones">
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-500" />
        </button>

        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-[10px] font-bold shadow-sm ml-1">
          {initials}
        </div>
      </div>
    </header>
  )
}
