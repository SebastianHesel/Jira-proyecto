import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { CreateTicket } from './pages/CreateTicket'
import { DailyReport } from './pages/DailyReport'
import { SprintReport } from './pages/SprintReport'
import { Settings } from './pages/Settings'
import { Login } from './pages/Login'
import { Board } from './pages/Board'
import { Backlog } from './pages/Backlog'
import { supabase } from './lib/supabase'
import { useAppStore } from './store'

// ─── Authenticated shell ──────────────────────────────────────────────────────

function Layout({ children }: { children: React.ReactNode }) {
  const { isDarkMode, sidebarOpen, setSidebarOpen } = useAppStore()

  useEffect(() => {
    const root = document.documentElement
    if (isDarkMode) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [isDarkMode])

  return (
    <div className="main-layout flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar />
      <div className="flex-1 flex flex-col ml-0 md:ml-60 overflow-auto">
        {children}
      </div>
    </div>
  )
}

// Password configured in env var (set in Netlify for production)
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD as string | undefined

// ─── Route guard ──────────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, authLoading, simpleAuthSession } = useAppStore()

  // While Supabase is checking the session, show a minimal spinner
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0d1117]">
        <div className="w-8 h-8 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  // Supabase configured → use Supabase session
  if (supabase) {
    if (!user) return <Navigate to="/login" replace />
    return <>{children}</>
  }

  // No Supabase, but app password is set → use simple session
  if (APP_PASSWORD) {
    if (!simpleAuthSession) return <Navigate to="/login" replace />
    return <>{children}</>
  }

  // No auth configured at all → allow access (local dev mode)
  return <>{children}</>
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { setUser, setAuthLoading, isDarkMode } = useAppStore()

  // Apply dark mode class immediately (before Supabase resolves)
  useEffect(() => {
    const root = document.documentElement
    if (isDarkMode) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [isDarkMode])

  // Initialize Supabase auth session
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    // Check existing session (e.g. returning user)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    // Listen for login / logout / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected */}
        <Route path="/" element={
          <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
        } />
        <Route path="/create" element={
          <ProtectedRoute><Layout><CreateTicket /></Layout></ProtectedRoute>
        } />
        <Route path="/daily" element={
          <ProtectedRoute><Layout><DailyReport /></Layout></ProtectedRoute>
        } />
        <Route path="/sprint" element={
          <ProtectedRoute><Layout><SprintReport /></Layout></ProtectedRoute>
        } />
        <Route path="/board" element={
          <ProtectedRoute><Layout><Board /></Layout></ProtectedRoute>
        } />
        <Route path="/backlog" element={
          <ProtectedRoute><Layout><Backlog /></Layout></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
