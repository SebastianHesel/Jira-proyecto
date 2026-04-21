import { useState } from 'react'
import { Settings2, MessageCircle, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Spinner } from '../components/ui/Spinner'
import { useAppStore } from '../store'
import { testConnection } from '../lib/jira'
import { sendWhatsApp } from '../lib/whatsapp'
import type { Workspace } from '../types'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const DEFAULT_WORKSPACE: Workspace = {
  id: 'default',
  name: 'Mi Workspace',
  jira_base_url: '',
  jira_project_key: '',
  jira_email: '',
  jira_api_token: '',
  timezone: 'America/Mexico_City',
  whatsapp_provider: '',
  whatsapp_phone_number_id: '',
  whatsapp_access_token: '',
  destination_phone: '',
  weekly_summary_day: 1,
  weekly_summary_time: '09:00',
}

type Tab = 'jira' | 'whatsapp' | 'general'

export function Settings() {
  const { workspace, setWorkspace, isDarkMode } = useAppStore()
  const [form, setForm] = useState<Workspace>(workspace ?? DEFAULT_WORKSPACE)
  const [tab, setTab] = useState<Tab>('jira')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [showWaToken, setShowWaToken] = useState(false)

  function update(key: keyof Workspace, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)
  }

  async function handleSave() {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 400))
    setWorkspace(form)
    setSaving(false)
  }

  async function handleTestJira() {
    setTesting(true)
    setTestResult(null)
    try {
      await testConnection({
        baseUrl: form.jira_base_url,
        email: form.jira_email,
        apiToken: form.jira_api_token,
        projectKey: form.jira_project_key,
      })
      setTestResult({ ok: true, message: `Conexión exitosa. Acceso al proyecto ${form.jira_project_key} verificado.` })
    } catch (e: unknown) {
      // testConnection already formats a descriptive message — show it directly
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setTestResult({ ok: false, message: msg })
    } finally {
      setTesting(false)
    }
  }

  async function handleTestWhatsApp() {
    setTesting(true)
    setTestResult(null)
    try {
      await sendWhatsApp(
        {
          provider: form.whatsapp_provider as 'twilio' | 'meta',
          destination_phone: form.destination_phone,
          twilio_account_sid: form.whatsapp_phone_number_id,
          twilio_auth_token: form.whatsapp_access_token,
          twilio_from_number: form.whatsapp_phone_number_id,
          meta_phone_number_id: form.whatsapp_phone_number_id,
          meta_access_token: form.whatsapp_access_token,
        },
        '✅ Jira AI Scrum Assistant — mensaje de prueba exitoso.'
      )
      setTestResult({ ok: true, message: 'Mensaje enviado correctamente.' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setTestResult({ ok: false, message: `Error al enviar: ${msg}` })
    } finally {
      setTesting(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'jira', label: 'Jira' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'general', label: 'General' },
  ]

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Configuración" breadcrumb="GetSellers" subtitle="Credenciales y preferencias" />

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Tabs */}
          <div className={`flex items-center gap-1 rounded-xl p-1 shadow-sm border w-fit ${
            isDarkMode ? 'bg-[#161b27] border-[#1e2535]' : 'bg-white border-gray-100'
          }`}>
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  tab === key
                    ? 'bg-primary-600 text-white shadow-sm'
                    : isDarkMode
                      ? 'text-slate-400 hover:bg-white/8 hover:text-slate-200 bg-transparent'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 bg-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab: Jira ── */}
          {tab === 'jira' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300 mb-1">
                <Settings2 className="w-4 h-4 text-primary-600" />
                <h2 className="text-sm font-semibold">Conexión Jira Cloud</h2>
              </div>

              <div>
                <label className="label">URL base de Jira</label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://tu-empresa.atlassian.net"
                  value={form.jira_base_url}
                  onChange={(e) => update('jira_base_url', e.target.value)}
                />
                <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">Sin slash al final</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email de Jira</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="tu@empresa.com"
                    value={form.jira_email}
                    onChange={(e) => update('jira_email', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Project Key</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="PROJ"
                    value={form.jira_project_key}
                    onChange={(e) => update('jira_project_key', e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div>
                <label className="label">API Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Tu API token de Atlassian"
                    value={form.jira_api_token}
                    onChange={(e) => update('jira_api_token', e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">
                  Genera uno en: id.atlassian.com/manage-profile/security/api-tokens
                </p>
              </div>

              {testResult && (
                <div className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-medium ${
                  testResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'
                }`}>
                  {testResult.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100 dark:border-[#1e2535]">
                <button className="btn-secondary" onClick={handleTestJira} disabled={testing || !form.jira_base_url || !form.jira_api_token || !form.jira_project_key}>
                  {testing ? <Spinner size="sm" /> : null}
                  Probar conexión
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : null}
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: WhatsApp ── */}
          {tab === 'whatsapp' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-4 h-4 text-green-600" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">WhatsApp</h2>
              </div>

              <div>
                <label className="label">Proveedor</label>
                <select
                  className="input"
                  value={form.whatsapp_provider}
                  onChange={(e) => update('whatsapp_provider', e.target.value)}
                >
                  <option value="">Seleccionar proveedor</option>
                  <option value="twilio">Twilio</option>
                  <option value="meta">Meta WhatsApp Cloud API</option>
                </select>
              </div>

              {form.whatsapp_provider === 'twilio' && (
                <>
                  <div>
                    <label className="label">Account SID (Twilio)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="ACxxxxxxxxxxxxxxxx"
                      value={form.whatsapp_phone_number_id}
                      onChange={(e) => update('whatsapp_phone_number_id', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Auth Token (Twilio)</label>
                    <div className="relative">
                      <input
                        type={showWaToken ? 'text' : 'password'}
                        className="input pr-10"
                        value={form.whatsapp_access_token}
                        onChange={(e) => update('whatsapp_access_token', e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:hover:text-slate-300"
                        onClick={() => setShowWaToken(!showWaToken)}
                      >
                        {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {form.whatsapp_provider === 'meta' && (
                <>
                  <div>
                    <label className="label">Phone Number ID (Meta)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="123456789012345"
                      value={form.whatsapp_phone_number_id}
                      onChange={(e) => update('whatsapp_phone_number_id', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Access Token (Meta)</label>
                    <div className="relative">
                      <input
                        type={showWaToken ? 'text' : 'password'}
                        className="input pr-10"
                        value={form.whatsapp_access_token}
                        onChange={(e) => update('whatsapp_access_token', e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:hover:text-slate-300"
                        onClick={() => setShowWaToken(!showWaToken)}
                      >
                        {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="label">Número destino</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+5215512345678"
                  value={form.destination_phone}
                  onChange={(e) => update('destination_phone', e.target.value)}
                />
                <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">Formato internacional con +</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Día del resumen semanal</label>
                  <select
                    className="input"
                    value={form.weekly_summary_day}
                    onChange={(e) => update('weekly_summary_day', Number(e.target.value))}
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Hora de envío</label>
                  <input
                    type="time"
                    className="input"
                    value={form.weekly_summary_time}
                    onChange={(e) => update('weekly_summary_time', e.target.value)}
                  />
                </div>
              </div>

              {testResult && (
                <div className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-medium ${
                  testResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'
                }`}>
                  {testResult.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100 dark:border-[#1e2535]">
                <button className="btn-secondary" onClick={handleTestWhatsApp} disabled={testing || !form.destination_phone || !form.whatsapp_provider}>
                  {testing ? <Spinner size="sm" /> : null}
                  Enviar mensaje de prueba
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : null}
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: General ── */}
          {tab === 'general' && (
            <div className="card p-6 space-y-5">
              <div>
                <label className="label">Nombre del Workspace</label>
                <input
                  type="text"
                  className="input"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Zona horaria</label>
                <select
                  className="input"
                  value={form.timezone}
                  onChange={(e) => update('timezone', e.target.value)}
                >
                  <option value="America/Mexico_City">America/Mexico_City (CST)</option>
                  <option value="America/Bogota">America/Bogota (COT)</option>
                  <option value="America/Lima">America/Lima (PET)</option>
                  <option value="America/Santiago">America/Santiago (CLT)</option>
                  <option value="America/Buenos_Aires">America/Buenos_Aires (ART)</option>
                  <option value="America/New_York">America/New_York (ET)</option>
                  <option value="Europe/Madrid">Europe/Madrid (CET)</option>
                </select>
              </div>
              <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-[#1e2535]">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : null}
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
