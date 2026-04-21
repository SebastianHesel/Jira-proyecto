import { useState, useCallback } from 'react'
import axios from 'axios'
import { Sparkles, ChevronRight, Edit3, CheckCircle, AlertCircle, ExternalLink, ImagePlus, X, Layers } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PriorityBadge, TypeBadge } from '../components/ui/Badge'
import { LoadingOverlay, Spinner } from '../components/ui/Spinner'
import { analyzeAndExpand, analyzeAndExpandWithLayers, checkClarification } from '../lib/openai'
import type { ImageAttachment } from '../lib/openai'
import { createIssue, createSubTask } from '../lib/jira'
import { saveJiraIssue, saveTicketRequest } from '../lib/supabase'
import { useAppStore, getJiraConfig } from '../store'
import type { GeneratedTicket, GeneratedSubTask, IssueType, Priority } from '../types'

type Step = 'input' | 'clarifying' | 'loading' | 'preview' | 'success' | 'error'

const ISSUE_TYPES: IssueType[] = ['Epic', 'Story', 'Task', 'Bug', 'Sub-task']
const PRIORITIES: Priority[] = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
const STORY_POINTS = [1, 2, 3, 5, 8, 13]
const MAX_IMAGES = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

// ─── Image helpers ────────────────────────────────────────────────────────────

interface ImageFile extends ImageAttachment {
  name: string
  previewUrl: string
}

async function fileToImageFile(file: File): Promise<ImageFile | null> {
  if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) return null
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [header, data] = result.split(',')
      const mediaType = header.split(':')[1].split(';')[0] as ImageAttachment['mediaType']
      resolve({ data, mediaType, name: file.name, previewUrl: URL.createObjectURL(file) })
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateTicket() {
  const { workspace, isDarkMode } = useAppStore()

  const [step, setStep] = useState<Step>('input')
  const [userInput, setUserInput] = useState('')
  const [context, setContext] = useState('')
  const [images, setImages] = useState<ImageFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [createLayers, setCreateLayers] = useState(false)
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [ticket, setTicket] = useState<GeneratedTicket | null>(null)
  const [feTask, setFeTask] = useState<GeneratedSubTask | null>(null)
  const [beTask, setBeTask] = useState<GeneratedSubTask | null>(null)
  const [createdKey, setCreatedKey] = useState('')
  const [createdSubKeys, setCreatedSubKeys] = useState<[string, string] | null>(null)
  const [error, setError] = useState('')

  // ── Image handlers ───────────────────────────────────────────────────────

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files) return
    const results = await Promise.all(Array.from(files).map(fileToImageFile))
    setImages((prev) => {
      const valid = results.filter(Boolean) as ImageFile[]
      return [...prev, ...valid].slice(0, MAX_IMAGES)
    })
  }, [])

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  // ── Step handlers ────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!userInput.trim()) return
    setStep('loading')
    setError('')
    try {
      const check = await checkClarification(userInput, images)
      if (check.needs_clarification && check.questions.length) {
        setQuestions(check.questions)
        setStep('clarifying')
      } else {
        await generateTicket(userInput, context)
      }
    } catch {
      setError('Error al analizar la descripción. Verifica tu API key de Claude (Anthropic).')
      setStep('error')
    }
  }

  async function handleClarifySubmit() {
    setStep('loading')
    const enrichedInput = userInput + '\n\nRespuestas adicionales:\n' +
      questions.map((q, i) => `${q}: ${answers[i] ?? 'N/A'}`).join('\n')
    try {
      await generateTicket(enrichedInput, context)
    } catch {
      setError('Error al generar el ticket.')
      setStep('error')
    }
  }

  async function generateTicket(input: string, ctx: string) {
    if (createLayers) {
      const result = await analyzeAndExpandWithLayers(input, ctx, images)
      setTicket(result.main)
      setFeTask(result.frontend)
      setBeTask(result.backend)
    } else {
      const result = await analyzeAndExpand(input, ctx, images)
      setTicket(result)
      setFeTask(null)
      setBeTask(null)
    }
    setStep('preview')
  }

  async function handleCreate() {
    if (!ticket) return
    setStep('loading')
    try {
      if (workspace) {
        const cfg = getJiraConfig(workspace)
        const result = await createIssue(cfg, ticket)
        await saveJiraIssue({
          jira_issue_key: result.key,
          jira_issue_id: result.id,
          title: ticket.title,
          issue_type: ticket.issue_type,
          priority: ticket.priority,
          story_points: ticket.story_points,
          sprint_name: ticket.sprint_suggestion,
          status: 'To Do',
          labels_json: ticket.labels,
          created_at: new Date().toISOString(),
        })
        setCreatedKey(result.key)

        // Create FE + BE sub-tasks if in layers mode
        if (feTask && beTask) {
          const [feResult, beResult] = await Promise.all([
            createSubTask(cfg, feTask, result.key),
            createSubTask(cfg, beTask, result.key),
          ])
          setCreatedSubKeys([feResult.key, beResult.key])
        }
      } else {
        const mockKey = 'MOCK-' + Math.floor(Math.random() * 9000 + 1000)
        setCreatedKey(mockKey)
        if (feTask && beTask) {
          const n = Math.floor(Math.random() * 9000 + 1000)
          setCreatedSubKeys([`MOCK-${n + 1}`, `MOCK-${n + 2}`])
        }
      }
      await saveTicketRequest({
        user_input: userInput,
        context_json: { context, answers },
        final_payload_json: ticket,
        status: 'created',
        created_at: new Date().toISOString(),
      })
      setStep('success')
    } catch (err: unknown) {
      console.error('[CreateTicket] Jira create error:', err)
      let detail = ''
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const data   = err.response?.data
        // Extract Jira error detail — try all known formats
        if (data?.errorMessages?.length)
          detail = data.errorMessages.join(' · ')
        else if (data?.errors && Object.keys(data.errors as object).length)
          detail = Object.values(data.errors as Record<string, string>).filter(Boolean).join(' · ')
        else if (data?.message)
          detail = data.message
        else if (typeof data === 'string' && data.length < 300)
          detail = data
        // Friendly guidance for known HTTP codes
        if (!detail) {
          if (status === 403)
            detail = 'HTTP 403 — Sin permiso para crear issues. Asegúrate de que tu API Token tenga acceso de escritura al proyecto en Jira.'
          else if (status === 401)
            detail = 'HTTP 401 — Credenciales inválidas. Verifica email y API Token en Configuración.'
          else if (status === 404)
            detail = 'HTTP 404 — Proyecto no encontrado. Revisa la clave del proyecto en Configuración.'
          else if (status)
            detail = `HTTP ${status}`
        }
      } else if (err instanceof Error) {
        detail = err.message
      }
      setError(detail || 'Error al crear el issue en Jira. Verifica las credenciales en Configuración.')
      setStep('error')
    }
  }

  function reset() {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    setStep('input')
    setUserInput('')
    setContext('')
    setImages([])
    setIsDragging(false)
    setQuestions([])
    setAnswers({})
    setTicket(null)
    setFeTask(null)
    setBeTask(null)
    setCreatedKey('')
    setCreatedSubKeys(null)
    setError('')
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const dropzoneBorder = isDragging
    ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-900/20'
    : isDarkMode
      ? 'border-[#2d3548] hover:border-primary-600/50 bg-[#1a2030]'
      : 'border-gray-200 hover:border-primary-400/50 bg-gray-50/50'

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Crear Ticket con AI" breadcrumb="Herramientas" subtitle="Describe tu tarea y Claude la estructura automáticamente" />

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Step indicator */}
          <StepIndicator current={step} />

          {/* ── STEP: Input ── */}
          {step === 'input' && (
            <div className="card p-6 space-y-5">
              <div>
                <label className="label">Descripción de la tarea *</label>
                <textarea
                  className="textarea min-h-[120px]"
                  placeholder="Ej: Necesitamos mejorar el onboarding del usuario nuevo para reducir abandono en el paso de verificación"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Contexto adicional <span className="text-gray-400 normal-case font-normal">(opcional)</span></label>
                <textarea
                  className="textarea min-h-[80px]"
                  placeholder="Agrega información de negocio, restricciones, usuarios afectados, etc."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>

              {/* ── FE/BE Layers toggle ── */}
              <div
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
                  createLayers
                    ? isDarkMode
                      ? 'bg-primary-900/20 border-primary-700/50'
                      : 'bg-primary-50 border-primary-200'
                    : isDarkMode
                      ? 'bg-[#1a2030] border-[#2d3548] hover:border-primary-700/40'
                      : 'bg-gray-50 border-gray-200 hover:border-primary-200'
                }`}
                onClick={() => setCreateLayers((v) => !v)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    createLayers
                      ? 'bg-primary-600 text-white'
                      : isDarkMode ? 'bg-[#1e2535] text-slate-500' : 'bg-white border border-gray-200 text-gray-400'
                  }`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold leading-tight ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>
                      Separar en tareas Front + Back
                    </p>
                    <p className={`text-xs mt-0.5 leading-tight ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                      Claude genera la historia principal + sub-tareas para cada capa
                    </p>
                  </div>
                </div>
                {/* Toggle switch */}
                <div
                  className={`w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    createLayers ? 'bg-primary-600' : isDarkMode ? 'bg-[#2d3548]' : 'bg-gray-200'
                  }`}
                >
                  <span className={`block w-4 h-4 bg-white rounded-full shadow-sm mt-1 transition-transform duration-200 ${
                    createLayers ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </div>
              </div>

              {/* ── Image upload zone ── */}
              <div>
                <label className="label">
                  Imágenes de referencia{' '}
                  <span className="text-gray-400 normal-case font-normal">(opcional · máx. {MAX_IMAGES})</span>
                </label>

                <div
                  className={`border-2 border-dashed rounded-xl transition-all duration-150 cursor-pointer select-none ${dropzoneBorder}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('ct-image-upload')?.click()}
                >
                  <input
                    id="ct-image-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                    onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
                  />

                  {images.length === 0 ? (
                    <div className="flex flex-col items-center gap-2.5 py-8 px-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-[#1e2535]' : 'bg-white border border-gray-100'}`}>
                        <ImagePlus className={`w-5 h-5 ${isDarkMode ? 'text-slate-500' : 'text-gray-300'}`} />
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          Arrastra imágenes o haz clic para seleccionar
                        </p>
                        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>
                          PNG, JPG, WEBP, GIF — Claude usará las imágenes como contexto visual
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex flex-wrap gap-3" onClick={(e) => e.stopPropagation()}>
                      {images.map((img, i) => (
                        <div key={i} className="relative group flex-shrink-0">
                          <img
                            src={img.previewUrl}
                            alt={img.name}
                            className={`w-24 h-24 object-cover rounded-xl border ${isDarkMode ? 'border-[#2d3548]' : 'border-gray-200'}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <p className={`mt-1.5 text-[10px] truncate max-w-[96px] ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>
                            {img.name}
                          </p>
                        </div>
                      ))}
                      {images.length < MAX_IMAGES && (
                        <div
                          className={`w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                            isDarkMode
                              ? 'border-[#2d3548] hover:border-primary-600/50 text-slate-600 hover:text-slate-400'
                              : 'border-gray-200 hover:border-primary-400/50 text-gray-300 hover:text-gray-400'
                          }`}
                          onClick={() => document.getElementById('ct-image-upload')?.click()}
                        >
                          <ImagePlus className="w-5 h-5" />
                          <span className="text-[10px] font-medium">Agregar</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {images.length > 0 && (
                  <p className={`text-xs mt-1.5 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                    {images.length} imagen{images.length !== 1 ? 'es' : ''} adjunta{images.length !== 1 ? 's' : ''} · Claude las analizará junto a tu descripción
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  className="btn-primary gap-2"
                  onClick={handleAnalyze}
                  disabled={!userInput.trim()}
                >
                  <Sparkles className="w-4 h-4" />
                  Analizar con Claude
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: Clarifying ── */}
          {step === 'clarifying' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-700/40 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Claude necesita un poco más de contexto</p>
              </div>
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={i}>
                    <label className="label">{q}</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Tu respuesta..."
                      value={answers[i] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              {images.length > 0 && (
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                    Imágenes adjuntas ({images.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {images.map((img, i) => (
                      <img key={i} src={img.previewUrl} alt={img.name} className={`w-16 h-16 object-cover rounded-xl border ${isDarkMode ? 'border-[#2d3548]' : 'border-gray-200'}`} />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button className="btn-secondary" onClick={reset}>Volver</button>
                <button className="btn-primary" onClick={handleClarifySubmit}>
                  <Sparkles className="w-4 h-4" />
                  Generar Ticket
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: Loading ── */}
          {step === 'loading' && (
            <div className="card p-8">
              <LoadingOverlay message={
                createLayers
                  ? 'Claude está generando la historia + sub-tareas de Front y Back...'
                  : 'Claude está generando tu ticket...'
              } />
            </div>
          )}

          {/* ── STEP: Preview ── */}
          {step === 'preview' && ticket && (
            <div className="space-y-4">
              {/* Main ticket */}
              <TicketPreview
                ticket={ticket}
                onChange={setTicket}
                onConfirm={handleCreate}
                onBack={reset}
                hasLayers={!!(feTask && beTask)}
                feTask={feTask}
                beTask={beTask}
                onChangeFe={setFeTask}
                onChangeBe={setBeTask}
              />
            </div>
          )}

          {/* ── STEP: Success ── */}
          {step === 'success' && (
            <div className="card p-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {createdSubKeys ? '¡Historia y sub-tareas creadas!' : '¡Ticket creado!'}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  <IssueKeyBadge label="Historia" issueKey={createdKey} color="primary" />
                  {createdSubKeys && (
                    <>
                      <IssueKeyBadge label="Frontend" issueKey={createdSubKeys[0]} color="blue" />
                      <IssueKeyBadge label="Backend" issueKey={createdSubKeys[1]} color="violet" />
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                  {createdSubKeys
                    ? 'Los issues fueron creados exitosamente en Jira con sus sub-tareas enlazadas'
                    : 'El issue fue creado exitosamente en Jira'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                {workspace?.jira_base_url && (
                  <a
                    href={`${workspace.jira_base_url}/browse/${createdKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver en Jira
                  </a>
                )}
                <button className="btn-primary" onClick={reset}>
                  <Sparkles className="w-4 h-4" />
                  Crear otro ticket
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: Error ── */}
          {step === 'error' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl px-4 py-4">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>
                  {error.includes('403') && (
                    <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-1">
                      Pasos a verificar: (1) Ve a Jira → Configuración del proyecto → Permisos y asegúrate de que tu usuario tenga permiso "Crear Issues". (2) Genera un nuevo API Token en{' '}
                      <a href="https://id.atlassian.com/manage/api-tokens" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                        id.atlassian.com/manage/api-tokens
                      </a>{' '}
                      y actualízalo en Configuración.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <a
                  href="/settings"
                  className="btn-secondary text-sm gap-1.5"
                >
                  Ir a Configuración
                </a>
                <button className="btn-primary text-sm" onClick={reset}>Intentar de nuevo</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Issue key badge ──────────────────────────────────────────────────────────

function IssueKeyBadge({ label, issueKey, color }: { label: string; issueKey: string; color: 'primary' | 'blue' | 'violet' }) {
  const colors = {
    primary: 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-primary-100 dark:border-primary-900/50',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/40',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-100 dark:border-violet-900/40',
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-[10px] font-bold uppercase tracking-widest ${
        color === 'primary' ? 'text-primary-500' : color === 'blue' ? 'text-blue-500' : 'text-violet-500'
      }`}>{label}</span>
      <span className={`font-mono font-bold px-2.5 py-1 rounded-lg text-sm border ${colors[color]}`}>
        {issueKey}
      </span>
    </div>
  )
}

// ─── Ticket Preview / Editor ──────────────────────────────────────────────────

function TicketPreview({
  ticket,
  onChange,
  onConfirm,
  onBack,
  hasLayers,
  feTask,
  beTask,
  onChangeFe,
  onChangeBe,
}: {
  ticket: GeneratedTicket
  onChange: (t: GeneratedTicket) => void
  onConfirm: () => void
  onBack: () => void
  hasLayers: boolean
  feTask: GeneratedSubTask | null
  beTask: GeneratedSubTask | null
  onChangeFe: (t: GeneratedSubTask) => void
  onChangeBe: (t: GeneratedSubTask) => void
}) {
  const { isDarkMode } = useAppStore()
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    await onConfirm()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 font-medium">
        <Edit3 className="w-4 h-4 text-gray-400 dark:text-slate-500" />
        <span>Revisa y edita antes de crear en Jira</span>
        {hasLayers && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 font-semibold">
            <Layers className="w-3.5 h-3.5" />
            Historia + sub-tareas FE/BE
          </span>
        )}
      </div>

      {/* Main ticket */}
      <div className={`card p-6 space-y-5 ${hasLayers ? `border-l-4 ${isDarkMode ? 'border-l-primary-600' : 'border-l-primary-500'}` : ''}`}>
        {hasLayers && (
          <div className="flex items-center gap-2 -mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400">Historia Principal</span>
          </div>
        )}

        {/* Type + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tipo de issue</label>
            <select
              className="input"
              value={ticket.issue_type}
              onChange={(e) => onChange({ ...ticket, issue_type: e.target.value as IssueType })}
            >
              {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prioridad</label>
            <select
              className="input"
              value={ticket.priority}
              onChange={(e) => onChange({ ...ticket, priority: e.target.value as Priority })}
            >
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex gap-2 flex-wrap">
          <TypeBadge type={ticket.issue_type} />
          <PriorityBadge priority={ticket.priority} />
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#1e2535] text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-[#2d3548]">
            {ticket.story_points} pts
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-900/50">
            {ticket.sprint_suggestion}
          </span>
        </div>

        {/* Title */}
        <div>
          <label className="label">Título</label>
          <input
            type="text"
            className="input text-sm font-semibold"
            value={ticket.title}
            onChange={(e) => onChange({ ...ticket, title: e.target.value })}
          />
        </div>

        {/* Description */}
        <div>
          <label className="label">Descripción</label>
          <textarea
            className="textarea min-h-[120px]"
            value={ticket.description}
            onChange={(e) => onChange({ ...ticket, description: e.target.value })}
          />
        </div>

        {/* Story Points */}
        <div>
          <label className="label">Story Points</label>
          <div className="flex gap-2 flex-wrap">
            {STORY_POINTS.map((sp) => (
              <button
                key={sp}
                onClick={() => onChange({ ...ticket, story_points: sp })}
                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-150 ${
                  ticket.story_points === sp
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#1e2535] text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-[#243044]'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>
        </div>

        {/* Acceptance Criteria */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Criterios de Aceptación</label>
            <span className="text-xs text-gray-400 dark:text-slate-500 font-normal">{ticket.acceptance_criteria.length} criterios</span>
          </div>
          <div className="space-y-2">
            {ticket.acceptance_criteria.map((ac, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs flex-shrink-0">✓</span>
                <input
                  className="input flex-1"
                  value={ac}
                  onChange={(e) => {
                    const updated = [...ticket.acceptance_criteria]
                    updated[i] = e.target.value
                    onChange({ ...ticket, acceptance_criteria: updated })
                  }}
                />
                <button
                  type="button"
                  title="Eliminar criterio"
                  onClick={() => {
                    const updated = ticket.acceptance_criteria.filter((_, idx) => idx !== i)
                    onChange({ ...ticket, acceptance_criteria: updated })
                  }}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-xl text-gray-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...ticket, acceptance_criteria: [...ticket.acceptance_criteria, ''] })}
            className="mt-2.5 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold flex items-center gap-1 transition-colors"
          >
            + Agregar criterio
          </button>
        </div>

        {/* Labels */}
        {ticket.labels.length > 0 && (
          <div>
            <label className="label">Labels</label>
            <div className="flex flex-wrap gap-1.5">
              {ticket.labels.map((l) => (
                <span key={l} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#1e2535] text-gray-700 dark:text-slate-400 border border-gray-100 dark:border-[#2d3548]">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Risks */}
        {ticket.risks.length > 0 && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-700/40 rounded-xl">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Riesgos detectados</p>
            {ticket.risks.map((r, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400 mt-1">· {r}</p>
            ))}
          </div>
        )}
      </div>

      {/* ── Sub-tasks ── */}
      {hasLayers && feTask && beTask && (
        <>
          <SubTaskPreview
            subTask={feTask}
            onChange={onChangeFe}
            layer="frontend"
          />
          <SubTaskPreview
            subTask={beTask}
            onChange={onChangeBe}
            layer="backend"
          />
        </>
      )}

      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onBack} disabled={loading}>Volver</button>
        <button className="btn-primary" onClick={handleConfirm} disabled={loading}>
          {loading ? <Spinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
          {loading
            ? hasLayers ? 'Creando historia y sub-tareas...' : 'Creando en Jira...'
            : hasLayers ? 'Crear historia + FE + BE en Jira' : 'Crear en Jira'
          }
        </button>
      </div>
    </div>
  )
}

// ─── Sub-task Preview / Editor ────────────────────────────────────────────────

function SubTaskPreview({
  subTask,
  onChange,
  layer,
}: {
  subTask: GeneratedSubTask
  onChange: (t: GeneratedSubTask) => void
  layer: 'frontend' | 'backend'
}) {
  const { isDarkMode } = useAppStore()
  const isFe = layer === 'frontend'

  const accentBorder = isFe
    ? isDarkMode ? 'border-l-blue-500' : 'border-l-blue-500'
    : isDarkMode ? 'border-l-violet-500' : 'border-l-violet-500'

  const labelColor = isFe
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-violet-600 dark:text-violet-400'

  const acBg = isFe
    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'

  return (
    <div className={`card p-6 space-y-4 border-l-4 ${accentBorder}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold uppercase tracking-widest ${labelColor}`}>
          Sub-tarea · {isFe ? 'Frontend' : 'Backend'}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          isFe
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            : 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
        }`}>
          {isFe ? '[FE]' : '[BE]'}
        </span>
      </div>

      {/* Title */}
      <div>
        <label className="label">Título</label>
        <input
          type="text"
          className="input text-sm font-semibold"
          value={subTask.title}
          onChange={(e) => onChange({ ...subTask, title: e.target.value })}
        />
      </div>

      {/* Description */}
      <div>
        <label className="label">Descripción</label>
        <textarea
          className="textarea min-h-[90px]"
          value={subTask.description}
          onChange={(e) => onChange({ ...subTask, description: e.target.value })}
        />
      </div>

      {/* Story Points */}
      <div>
        <label className="label">Story Points</label>
        <div className="flex gap-2 flex-wrap">
          {STORY_POINTS.map((sp) => (
            <button
              key={sp}
              onClick={() => onChange({ ...subTask, story_points: sp })}
              className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-150 ${
                subTask.story_points === sp
                  ? isFe
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-violet-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-[#1e2535] text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-[#243044]'
              }`}
            >
              {sp}
            </button>
          ))}
        </div>
      </div>

      {/* Acceptance Criteria */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Criterios de Aceptación</label>
          <span className="text-xs text-gray-400 dark:text-slate-500 font-normal">{subTask.acceptance_criteria.length} criterios</span>
        </div>
        <div className="space-y-2">
          {subTask.acceptance_criteria.map((ac, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${acBg}`}>✓</span>
              <input
                className="input flex-1"
                value={ac}
                onChange={(e) => {
                  const updated = [...subTask.acceptance_criteria]
                  updated[i] = e.target.value
                  onChange({ ...subTask, acceptance_criteria: updated })
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const updated = subTask.acceptance_criteria.filter((_, idx) => idx !== i)
                  onChange({ ...subTask, acceptance_criteria: updated })
                }}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-xl text-gray-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...subTask, acceptance_criteria: [...subTask.acceptance_criteria, ''] })}
          className={`mt-2.5 text-xs font-semibold flex items-center gap-1 transition-colors ${
            isFe
              ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
              : 'text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300'
          }`}
        >
          + Agregar criterio
        </button>
      </div>
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { key: 'input', label: 'Descripción' },
    { key: 'clarifying', label: 'Aclaración' },
    { key: 'preview', label: 'Revisar' },
    { key: 'success', label: 'Listo' },
  ]

  const order = ['input', 'clarifying', 'loading', 'preview', 'success']
  const currentIdx = order.indexOf(current)

  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => {
        const stepIdx = order.indexOf(s.key)
        const isDone = stepIdx < currentIdx
        const isActive = s.key === current || (current === 'loading' && stepIdx === currentIdx - 1)
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
              isDone ? 'bg-emerald-500 text-white' :
              isActive ? 'bg-primary-600 text-white shadow-sm' :
              'bg-gray-200 dark:bg-[#1e2535] text-gray-400 dark:text-slate-600'
            }`}>
              {isDone ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium transition-colors ${
              isActive ? 'text-gray-800 dark:text-white' :
              isDone ? 'text-gray-400 dark:text-slate-500' :
              'text-gray-300 dark:text-slate-600'
            }`}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-6 h-px mx-1 transition-colors ${isDone ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-gray-200 dark:bg-[#1e2535]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
