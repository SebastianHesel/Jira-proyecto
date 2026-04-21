import axios from 'axios'
import type { GeneratedTicket, GeneratedSubTask, JiraSprint } from '../types'

interface JiraConfig {
  baseUrl: string
  email: string
  apiToken: string
  projectKey: string
}

// Route all Jira calls through the Vite proxy (/api/jira → Atlassian) to avoid CORS
const JIRA_PROXY = '/api/jira'

function makeHeaders(email: string, apiToken: string) {
  const encoded = btoa(`${email}:${apiToken}`)
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

// ─── Connection test ──────────────────────────────────────────────────────────

export async function testConnection(cfg: JiraConfig): Promise<void> {
  // Hit the configured project directly: one call verifies credentials, scope, and project access.
  // - 200 → all good
  // - 401 → bad email/token
  // - 403 → token missing scopes
  // - 404 → wrong project key or no access to the project
  const url = `${JIRA_PROXY}/rest/api/3/project/${encodeURIComponent(cfg.projectKey)}`

  try {
    await axios.get(url, { headers: makeHeaders(cfg.email, cfg.apiToken) })
  } catch (err: unknown) {
    if (!axios.isAxiosError(err) || !err.response) throw err

    const status = err.response.status
    const detail = extractJiraErrorMessage(err.response.data)

    if (status === 401) {
      throw new Error(
        `HTTP 401 — Credenciales rechazadas. Verifica que el email (${cfg.email}) y el API token sean correctos.`
      )
    }
    if (status === 403) {
      throw new Error(
        `HTTP 403 — El token no tiene permisos suficientes. ` +
        `Agrega los scopes: read:project:jira, read:issue:jira, write:issue:jira, ` +
        `read:board-scope:jira-software, read:sprint:jira-software, write:sprint:jira-software.`
      )
    }
    if (status === 404) {
      throw new Error(
        `Proyecto "${cfg.projectKey}" no encontrado. ${detail ? `(${detail}) ` : ''}` +
        `Verifica que el project key sea correcto y que tu cuenta tenga acceso al proyecto.`
      )
    }
    throw new Error(`HTTP ${status}${detail ? `: ${detail}` : ''}`)
  }
}

/** Extract a human-readable error message from a Jira error response body. */
function extractJiraErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return typeof data === 'string' ? data : ''
  const d = data as { errorMessages?: string[]; errors?: Record<string, string>; message?: string }
  if (d.errorMessages?.length) return d.errorMessages.join(' · ')
  if (d.errors && Object.keys(d.errors).length) return Object.values(d.errors).join(' · ')
  return d.message ?? ''
}

// ─── Sprints ──────────────────────────────────────────────────────────────────

export async function getSprints(cfg: JiraConfig): Promise<JiraSprint[]> {
  // Use the shared cached board discovery to avoid duplicate board requests
  const boardId = await findBoardId(cfg)
  if (boardId === null) return []

  try {
    const sprintsUrl = `${JIRA_PROXY}/rest/agile/1.0/board/${boardId}/sprint`
    const { data: sprintData } = await axios.get(sprintsUrl, {
      headers: makeHeaders(cfg.email, cfg.apiToken),
      params: { state: 'active,future,closed' },
    })
    return (sprintData as { values: Array<{ id: number; name: string; state: string; startDate?: string; endDate?: string }> }).values.map(
      (s) => ({
        id: s.id,
        name: s.name,
        state: s.state as JiraSprint['state'],
        startDate: s.startDate ?? null,
        endDate: s.endDate ?? null,
      })
    )
  } catch {
    // Kanban boards don't have sprints — return empty
    return []
  }
}

// ─── Issue metadata ───────────────────────────────────────────────────────────

export async function getIssueTypes(cfg: JiraConfig) {
  const url = `${JIRA_PROXY}/rest/api/3/issuetype`
  const { data } = await axios.get(url, { headers: makeHeaders(cfg.email, cfg.apiToken) })
  return data as Array<{ id: string; name: string; subtask: boolean }>
}

export async function getPriorities(cfg: JiraConfig) {
  const url = `${JIRA_PROXY}/rest/api/3/priority`
  const { data } = await axios.get(url, { headers: makeHeaders(cfg.email, cfg.apiToken) })
  return data as Array<{ id: string; name: string }>
}

export async function getComponents(cfg: JiraConfig) {
  const url = `${JIRA_PROXY}/rest/api/3/project/${cfg.projectKey}/components`
  const { data } = await axios.get(url, { headers: makeHeaders(cfg.email, cfg.apiToken) })
  return data as Array<{ id: string; name: string }>
}

// ─── Create issue ─────────────────────────────────────────────────────────────

export interface CreateIssueResult {
  id: string
  key: string
  self: string
}

export async function createIssue(
  cfg: JiraConfig,
  ticket: GeneratedTicket,
  sprintId?: number
): Promise<CreateIssueResult> {
  const url = `${JIRA_PROXY}/rest/api/3/issue`

  // Build description in Atlassian Document Format (ADF)
  const description = buildADF(ticket)

  // Jira labels cannot contain spaces — replace with hyphens
  const safeLabels = (ticket.labels ?? []).map((l) => l.replace(/\s+/g, '-'))

  const body: Record<string, unknown> = {
    fields: {
      project: { key: cfg.projectKey },
      summary: ticket.title,
      description,
      issuetype: { name: ticket.issue_type },
      priority: { name: ticket.priority },
      labels: safeLabels,
      // story points: Jira Cloud uses customfield_10016 (standard field ID)
      ...(ticket.story_points && { customfield_10016: ticket.story_points }),
    },
  }

  const { data } = await axios.post(url, body, {
    headers: makeHeaders(cfg.email, cfg.apiToken),
  })

  const result = data as CreateIssueResult

  // Assign to sprint if provided
  if (sprintId) {
    await assignToSprint(cfg, result.id, sprintId)
  }

  return result
}

export async function createSubTask(
  cfg: JiraConfig,
  subTask: GeneratedSubTask,
  parentKey: string,
  sprintId?: number,
): Promise<CreateIssueResult> {
  const url = `${JIRA_PROXY}/rest/api/3/issue`

  const description = {
    version: 1,
    type: 'doc',
    content: [
      makeParagraph(subTask.description),
      ...(subTask.acceptance_criteria.length
        ? [makeHeading('Criterios de Aceptación', 3), ...subTask.acceptance_criteria.map(makeBullet)]
        : []),
    ],
  }

  const safeLabels = (subTask.labels ?? []).map((l) => l.replace(/\s+/g, '-'))

  const body: Record<string, unknown> = {
    fields: {
      project: { key: cfg.projectKey },
      summary: subTask.title,
      description,
      issuetype: { name: 'Subtask' },
      parent: { key: parentKey },
      labels: safeLabels,
      ...(subTask.story_points && { customfield_10016: subTask.story_points }),
    },
  }

  const { data } = await axios.post(url, body, {
    headers: makeHeaders(cfg.email, cfg.apiToken),
  })

  const result = data as CreateIssueResult

  if (sprintId) {
    await assignToSprint(cfg, result.id, sprintId)
  }

  return result
}

async function assignToSprint(cfg: JiraConfig, issueId: string, sprintId: number) {
  const url = `${JIRA_PROXY}/rest/agile/1.0/sprint/${sprintId}/issue`
  await axios.post(
    url,
    { issues: [issueId] },
    { headers: makeHeaders(cfg.email, cfg.apiToken) }
  )
}

// ─── Raw Jira issue → JiraIssue mapper ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIssue(raw: any): import('../types').JiraIssue {
  const f = raw.fields ?? {}
  const sprintField = Array.isArray(f.customfield_10020)
    ? f.customfield_10020[f.customfield_10020.length - 1]
    : f.customfield_10020

  return {
    id: raw.id,
    jira_issue_key: raw.key,
    jira_issue_id: raw.id,
    title: f.summary ?? '',
    issue_type: f.issuetype?.name ?? 'Task',
    priority: f.priority?.name ?? 'Medium',
    story_points: f.customfield_10016 ?? f.story_points ?? null,
    sprint_name: sprintField?.name ?? 'Backlog',
    assignee: f.assignee?.displayName ?? '',
    status: f.status?.name ?? 'To Do',
    labels: f.labels ?? [],
    components: (f.components ?? []).map((c: { name: string }) => c.name),
    created_at: f.created ?? raw.fields?.created ?? new Date().toISOString(),
  }
}

// ─── Board discovery (cached + deduplicated per project) ─────────────────────

const boardIdCache = new Map<string, number>()
const pendingBoardRequests = new Map<string, Promise<number | null>>()

async function findBoardId(cfg: JiraConfig): Promise<number | null> {
  const cacheKey = `${cfg.baseUrl.replace(/\/$/, '')}:${cfg.projectKey}`
  if (boardIdCache.has(cacheKey)) return boardIdCache.get(cacheKey)!

  // Deduplicate concurrent requests — reuse in-flight promise instead of firing again
  if (pendingBoardRequests.has(cacheKey)) return pendingBoardRequests.get(cacheKey)!

  const promise = (async () => {
    const { data } = await axios.get(`${JIRA_PROXY}/rest/agile/1.0/board`, {
      headers: makeHeaders(cfg.email, cfg.apiToken),
      params: { projectKeyOrId: cfg.projectKey },
    })
    const boards = (data as { values: Array<{ id: number; type: string }> }).values
    if (!boards?.length) return null
    const board = boards.find((b) => b.type === 'scrum') ?? boards[0]
    boardIdCache.set(cacheKey, board.id)
    return board.id
  })().finally(() => pendingBoardRequests.delete(cacheKey))

  pendingBoardRequests.set(cacheKey, promise)
  return promise
}

// ─── Get issues for reports ───────────────────────────────────────────────────

/** Issues created on or after `date` (YYYY-MM-DD). Uses board endpoint to avoid 410 on search API. */
export async function getIssuesByDate(
  cfg: JiraConfig,
  date: string
): Promise<import('../types').JiraIssue[]> {
  return boardIssues(cfg, `created >= "${date}" ORDER BY created DESC`)
}

export async function getIssuesBySprintName(
  cfg: JiraConfig,
  sprintName: string
): Promise<import('../types').JiraIssue[]> {
  return boardIssues(cfg, `sprint = "${sprintName}" ORDER BY priority ASC`)
}

/** Uses the Agile sprint endpoint directly — avoids the broken /rest/api/2/search. */
export async function getIssuesBySprintId(
  cfg: JiraConfig,
  sprintId: number
): Promise<import('../types').JiraIssue[]> {
  const url = `${JIRA_PROXY}/rest/agile/1.0/sprint/${sprintId}/issue`
  const { data } = await axios.get(url, {
    headers: makeHeaders(cfg.email, cfg.apiToken),
    params: {
      maxResults: 200,
      fields: 'summary,issuetype,priority,status,assignee,labels,components,customfield_10016,customfield_10020,created',
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as { issues: any[] }).issues ?? []).map(mapIssue)
}

/** All non-done issues — shown as "Backlog" tab. */
export async function getBacklogIssues(
  cfg: JiraConfig
): Promise<import('../types').JiraIssue[]> {
  return boardIssues(cfg, 'status != Done ORDER BY created DESC')
}

/** Every issue in the project (used when there are no sprints). */
export async function getAllProjectIssues(
  cfg: JiraConfig
): Promise<import('../types').JiraIssue[]> {
  return boardIssues(cfg, '')
}

/**
 * Fetch issues through the Agile board endpoint, which works on all Jira plans
 * and does NOT return 410 Gone like the legacy /rest/api/2/search endpoint.
 *
 * `jqlSuffix` is appended after an implicit project filter, e.g.:
 *   "status != Done ORDER BY created DESC"
 */
async function boardIssues(cfg: JiraConfig, jqlSuffix: string): Promise<import('../types').JiraIssue[]> {
  const boardId = await findBoardId(cfg)
  if (boardId === null) return []

  const url = `${JIRA_PROXY}/rest/agile/1.0/board/${boardId}/issue`
  // Build JQL: suffix may be empty, a WHERE clause, or include ORDER BY — handle all cases
  const jql = jqlSuffix
    ? `project = "${cfg.projectKey}" AND ${jqlSuffix}`
    : `project = "${cfg.projectKey}" ORDER BY created DESC`
  const { data } = await axios.get(url, {
    headers: makeHeaders(cfg.email, cfg.apiToken),
    params: {
      jql,
      maxResults: 200,
      fields: 'summary,issuetype,priority,status,assignee,labels,components,customfield_10016,customfield_10020,created',
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as { issues: any[] }).issues ?? []).map(mapIssue)
}

// ─── ADF builder ─────────────────────────────────────────────────────────────

function buildADF(ticket: GeneratedTicket): unknown {
  const paragraphs = []

  paragraphs.push(makeParagraph(ticket.description))

  if (ticket.acceptance_criteria.length) {
    paragraphs.push(makeHeading('Criterios de Aceptación', 3))
    ticket.acceptance_criteria.forEach((c) => paragraphs.push(makeBullet(c)))
  }

  if (ticket.definition_of_done.length) {
    paragraphs.push(makeHeading('Definición de Terminado', 3))
    ticket.definition_of_done.forEach((d) => paragraphs.push(makeBullet(d)))
  }

  if (ticket.dependencies.length) {
    paragraphs.push(makeHeading('Dependencias', 3))
    ticket.dependencies.forEach((d) => paragraphs.push(makeBullet(d)))
  }

  if (ticket.risks.length) {
    paragraphs.push(makeHeading('Riesgos', 3))
    ticket.risks.forEach((r) => paragraphs.push(makeBullet(r)))
  }

  return { version: 1, type: 'doc', content: paragraphs }
}

function makeParagraph(text: string) {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function makeHeading(text: string, level: number) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

function makeBullet(text: string) {
  return {
    type: 'bulletList',
    content: [
      {
        type: 'listItem',
        content: [makeParagraph(text)],
      },
    ],
  }
}
