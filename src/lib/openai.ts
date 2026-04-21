import type { GeneratedTicket, GeneratedTicketWithLayers } from '../types'

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string
const MODEL = 'claude-sonnet-4-6'

// ─── Image attachments ────────────────────────────────────────────────────────

export interface ImageAttachment {
  data: string // base64-encoded, no data-URI prefix
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

// ─── Core fetch (via Vite proxy → https://api.anthropic.com) ─────────────────

async function callClaude(
  system: string,
  userMessage: string,
  maxTokens = 2048,
  images?: ImageAttachment[],
): Promise<string> {
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY no configurada')

  // Build content: image blocks first (if any), then text
  const content: unknown = images?.length
    ? [
        ...images.map((img) => ({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.data },
        })),
        { type: 'text', text: userMessage },
      ]
    : userMessage

  const res = await fetch('/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const block = data.content.find((b) => b.type === 'text')
  if (!block) throw new Error('Respuesta vacía de Claude')

  // Strip markdown fences if present
  return block.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

// Contexto permanente del producto
const PRODUCT_CONTEXT = `
Contexto del producto:
- Plataforma: aplicación web (solo web, no mobile).
- Etapa: MVP — no existen métricas ni datos analíticos todavía.
- Rol del usuario: Product Manager. Define el QUÉ y el POR QUÉ. El equipo de desarrollo define el CÓMO y la solución técnica.
- El PM no sabe de implementación técnica; las preguntas sobre arquitectura, tecnología o solución técnica van al dev, no al PM.
- La prioridad del ticket se asigna en el siguiente paso de la herramienta, no en las preguntas.
`

const EXPAND_SYSTEM = `Eres un experto en metodologías Scrum trabajando junto a un Product Manager.
Convierte la descripción en un ticket de Jira profesional y ejecutable para el equipo de desarrollo.

${PRODUCT_CONTEXT}

Devuelve ÚNICAMENTE JSON válido con esta estructura:
{
  "issue_type": "Epic|Story|Task|Bug|Sub-task",
  "title": "título conciso y accionable",
  "summary": "resumen de una línea",
  "description": "descripción detallada del problema y comportamiento esperado. Si es una mejora o exploración técnica, indícalo claramente para que el dev proponga la solución.",
  "acceptance_criteria": ["criterio observable y comprobable 1", "criterio observable 2"],
  "definition_of_done": ["punto 1", "punto 2"],
  "priority": "Highest|High|Medium|Low|Lowest",
  "story_points": 5,
  "labels": ["label1"],
  "components": ["componente1"],
  "dependencies": [],
  "risks": [],
  "sprint_suggestion": "Sprint actual",
  "clarification_questions": []
}

Reglas:
- story_points solo puede ser: 1, 2, 3, 5, 8 o 13
- Nunca preguntes por métricas, plataforma, solución técnica ni prioridad
- Si la descripción menciona exploración técnica o algo que el dev debe investigar, usa issue_type "Task" y deja que los criterios de aceptación reflejen el output esperado (ej: propuesta documentada)
- Usa español para el contenido
- No incluyas markdown, solo JSON puro`

const CLARIFY_SYSTEM = `Eres asistente de un Product Manager que crea tickets de Jira.

${PRODUCT_CONTEXT}

Analiza si falta información ESENCIAL para que el equipo de desarrollo pueda entender y ejecutar el ticket.

Solo pregunta cuando genuinamente falte algo crítico del QUÉ o el POR QUÉ. Nunca preguntes sobre:
- Métricas o datos (están en etapa MVP sin analítica)
- Solución técnica o implementación (eso lo decide el dev)
- Plataforma (siempre es web)
- Prioridad (se asigna después)
- Detalles de arquitectura o tecnología

SÍ puedes preguntar si falta:
- Qué problema experimenta el usuario (si no está claro)
- Quién es el usuario afectado (si hay varios perfiles distintos y no está claro)
- Cuál es el comportamiento actual vs el esperado (solo para bugs)
- Si hay un diseño o referencia visual en Figma (solo si aplica)
- Si hay una fecha límite o dependencia bloqueante (solo si parece urgente)

Si la descripción es suficientemente clara para que un dev pueda ejecutarla, responde directamente sin preguntar.

Devuelve ÚNICAMENTE JSON:
- Si realmente falta algo crítico: {"needs_clarification": true, "questions": ["pregunta concreta 1"]}
- Si hay suficiente información: {"needs_clarification": false, "questions": []}
Máximo 2 preguntas. Sin markdown, solo JSON.`

// ─── Layers prompt ────────────────────────────────────────────────────────────

const LAYERS_SYSTEM = `Eres un experto en metodologías Scrum trabajando junto a un Product Manager.
Convierte la descripción en un ticket de Jira profesional Y genera dos sub-tareas separadas: una para el equipo de Frontend y otra para el equipo de Backend.

${PRODUCT_CONTEXT}

Devuelve ÚNICAMENTE JSON válido con esta estructura:
{
  "main": {
    "issue_type": "Story",
    "title": "título conciso de la historia de usuario",
    "summary": "resumen de una línea",
    "description": "descripción detallada del problema y comportamiento esperado",
    "acceptance_criteria": ["criterio observable 1", "criterio observable 2"],
    "definition_of_done": ["PR revisado y aprobado", "QA en staging"],
    "priority": "Medium",
    "story_points": 8,
    "labels": ["label1"],
    "components": ["componente1"],
    "dependencies": [],
    "risks": [],
    "sprint_suggestion": "Sprint actual",
    "clarification_questions": []
  },
  "frontend": {
    "title": "[FE] descripción específica de la tarea de frontend",
    "description": "Qué debe implementar el desarrollador frontend: componentes de UI, interacciones, validaciones, llamadas a API, estados de carga y error.",
    "acceptance_criteria": ["criterio visual/interacción 1", "criterio 2"],
    "story_points": 3,
    "labels": ["frontend"]
  },
  "backend": {
    "title": "[BE] descripción específica de la tarea de backend",
    "description": "Qué debe implementar el desarrollador backend: endpoints REST, lógica de negocio, modelos de datos, validaciones, integraciones externas.",
    "acceptance_criteria": ["endpoint documentado en Swagger", "criterio de datos/lógica 2"],
    "story_points": 3,
    "labels": ["backend"]
  }
}

Reglas críticas:
- story_points solo puede ser: 1, 2, 3, 5, 8 o 13
- El título del main NO debe llevar prefijo
- El título de frontend DEBE empezar con "[FE]"
- El título de backend DEBE empezar con "[BE]"
- Los ACs de frontend deben ser específicos a UI/UX (no menciones API interna)
- Los ACs de backend deben ser específicos a API/datos/lógica (no menciones UI)
- Nunca preguntes por métricas, plataforma, solución técnica ni prioridad
- Usa español para todo el contenido
- Sin markdown, solo JSON puro`

// ─── Public functions (mismas firmas, sin cambios en el resto del proyecto) ───

export async function analyzeAndExpand(
  userInput: string,
  context?: string,
  images?: ImageAttachment[],
): Promise<GeneratedTicket> {
  const input = context ? `${userInput}\n\nContexto adicional: ${context}` : userInput
  if (!apiKey) return getMockTicket(userInput)

  const raw = await callClaude(EXPAND_SYSTEM, input, 2048, images)
  return JSON.parse(raw) as GeneratedTicket
}

export async function analyzeAndExpandWithLayers(
  userInput: string,
  context?: string,
  images?: ImageAttachment[],
): Promise<GeneratedTicketWithLayers> {
  const input = context ? `${userInput}\n\nContexto adicional: ${context}` : userInput
  if (!apiKey) {
    const main = getMockTicket(userInput)
    return {
      main,
      frontend: {
        title: `[FE] ${main.title}`,
        description: 'Implementar la interfaz de usuario: componentes, estados, llamadas a API.',
        acceptance_criteria: ['UI responsive implementada', 'Estados de carga y error manejados'],
        story_points: 3,
        labels: ['frontend'],
      },
      backend: {
        title: `[BE] ${main.title}`,
        description: 'Implementar endpoints y lógica de negocio: validaciones, base de datos, respuesta JSON.',
        acceptance_criteria: ['Endpoint documentado', 'Validaciones implementadas', 'Tests unitarios'],
        story_points: 3,
        labels: ['backend'],
      },
    }
  }

  const raw = await callClaude(LAYERS_SYSTEM, input, 3500, images)
  return JSON.parse(raw) as GeneratedTicketWithLayers
}

export async function checkClarification(
  userInput: string,
  images?: ImageAttachment[],
): Promise<{
  needs_clarification: boolean
  questions: string[]
}> {
  if (!apiKey) return { needs_clarification: false, questions: [] }

  const raw = await callClaude(CLARIFY_SYSTEM, userInput, 512, images)
  return JSON.parse(raw)
}

export async function generateDailySummary(tickets: unknown[]): Promise<string> {
  if (!apiKey) return `Resumen diario: ${tickets.length} tickets creados hoy. Configura VITE_ANTHROPIC_API_KEY para resúmenes reales.`

  return callClaude(
    'Genera un resumen diario ejecutivo claro y breve. Destaca prioridades altas, responsables, dependencias y riesgos. Máximo 3 párrafos. Sin markdown.',
    JSON.stringify(tickets),
    800
  )
}

export async function generateSprintSummary(sprintName: string, tickets: unknown[]): Promise<string> {
  if (!apiKey) return `Resumen de "${sprintName}": ${tickets.length} tickets.`

  return callClaude(
    'Genera un resumen ejecutivo del sprint para un equipo Scrum. Incluye logros, riesgos, bloqueadores y recomendaciones. Máximo 4 párrafos. Sin markdown.',
    JSON.stringify({ sprint: sprintName, tickets }),
    1000
  )
}

export async function generateWhatsAppSummary(weekData: unknown): Promise<string> {
  if (!apiKey) return 'Configura VITE_ANTHROPIC_API_KEY para resúmenes reales.'

  return callClaude(
    'Resumen semanal para WhatsApp, lenguaje ejecutivo. Incluye total tickets, prioridades altas, avance por sprint, bloqueadores y próximos focos. Máximo 1200 caracteres. Sin markdown.',
    JSON.stringify(weekData),
    600
  )
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

function getMockTicket(input: string): GeneratedTicket {
  return {
    issue_type: 'Story',
    title: `Mejora: ${input.substring(0, 60)}`,
    summary: 'Historia generada en modo demo — configura VITE_ANTHROPIC_API_KEY',
    description: `**Contexto**\n${input}\n\n**Alcance**\nVerificar dependencias con el equipo antes de comenzar.`,
    acceptance_criteria: [
      'El usuario completa el flujo sin errores',
      'El sistema responde en menos de 2 segundos',
    ],
    definition_of_done: ['PR revisado', 'Tests >80% cobertura', 'QA en staging'],
    priority: 'Medium',
    story_points: 5,
    labels: ['frontend'],
    components: ['Web App'],
    dependencies: [],
    risks: [],
    sprint_suggestion: 'Sprint actual',
    clarification_questions: [],
  }
}
