import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListTodo, Mail, Lock, Eye, EyeOff, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store'

type Tab = 'login' | 'register'

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD as string | undefined
const APP_EMAIL    = import.meta.env.VITE_APP_EMAIL    as string | undefined

export function Login() {
  const { isDarkMode, setSimpleAuth } = useAppStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // ── Simple auth (no Supabase, but VITE_APP_PASSWORD is set) ──────────────
      if (!supabase && APP_PASSWORD) {
        const emailOk = APP_EMAIL ? email === APP_EMAIL : true
        if (emailOk && password === APP_PASSWORD) {
          setSimpleAuth(true)
          navigate('/', { replace: true })
        } else {
          setError('Email o contraseña incorrectos.')
        }
        return
      }

      // ── Supabase auth ────────────────────────────────────────────────────────
      if (tab === 'login') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) throw error
        // Auth state change in App.tsx handles the redirect
      } else {
        const { error } = await supabase!.auth.signUp({ email, password })
        if (error) throw error
        setSuccess('¡Cuenta creada! Revisa tu email para confirmar tu cuenta.')
        setTab('login')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      // Translate common Supabase errors to Spanish
      if (msg.includes('Invalid login credentials')) setError('Email o contraseña incorrectos.')
      else if (msg.includes('User already registered')) setError('Este email ya está registrado. Inicia sesión.')
      else if (msg.includes('Password should be at least')) setError('La contraseña debe tener al menos 6 caracteres.')
      else if (msg.includes('Unable to validate email')) setError('Email inválido.')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // When using simple auth, hide the Register tab
  const useSimpleAuth = !supabase && !!APP_PASSWORD

  const bg = isDarkMode ? 'bg-[#0d1117]' : 'bg-gray-50'
  const cardBg = isDarkMode ? 'bg-[#161b27] border-[#1e2535]' : 'bg-white border-gray-100'
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900'
  const textMuted = isDarkMode ? 'text-slate-400' : 'text-gray-500'
  const labelColor = isDarkMode ? 'text-slate-400' : 'text-gray-600'

  return (
    <div className={`min-h-screen ${bg} flex items-center justify-center p-4`}>
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto shadow-lg shadow-primary-600/30">
            <ListTodo className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>Jira AI Scrum</h1>
            <p className={`text-sm mt-1 ${textMuted}`}>Powered by Claude · GetSellers</p>
          </div>
        </div>

        {/* Card */}
        <div className={`rounded-2xl border shadow-sm p-6 space-y-5 ${cardBg}`}
          style={{ boxShadow: isDarkMode ? '0 1px 4px 0 rgb(0 0 0 / 0.4)' : '0 1px 4px 0 rgb(0 0 0 / 0.06)' }}>

          {/* Tabs — hidden in simple-auth mode (no register) */}
          {!useSimpleAuth && (
            <div className={`flex rounded-xl p-1 ${isDarkMode ? 'bg-[#0d1117]' : 'bg-gray-100'}`}>
              {(['login', 'register'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); setSuccess('') }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
                    tab === t
                      ? 'bg-primary-600 text-white shadow-sm'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'login' ? 'Iniciar sesión' : 'Registrarse'}
                </button>
              ))}
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${labelColor}`}>
                Email
              </label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`} />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${labelColor}`}>
                Contraseña {tab === 'register' && <span className={`font-normal normal-case ${textMuted}`}>(mín. 6 caracteres)</span>}
              </label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full justify-center py-2.5 text-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {tab === 'login' ? 'Entrando...' : 'Creando cuenta...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Footer — only show tab switcher when Supabase auth is active */}
        {!useSimpleAuth && (
          <p className={`text-center text-xs ${textMuted}`}>
            {tab === 'login' ? (
              <>¿No tienes cuenta?{' '}
                <button onClick={() => { setTab('register'); setError('') }} className="text-primary-500 hover:text-primary-400 font-semibold transition-colors">
                  Regístrate
                </button>
              </>
            ) : (
              <>¿Ya tienes cuenta?{' '}
                <button onClick={() => { setTab('login'); setError('') }} className="text-primary-500 hover:text-primary-400 font-semibold transition-colors">
                  Inicia sesión
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
