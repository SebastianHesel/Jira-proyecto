import { useState, useEffect, useRef } from 'react'
import { useAppStore, getJiraConfig } from '../store'
import {
  getSprints,
  getIssuesByDate,
  getIssuesBySprintId,
  getBacklogIssues,
  getAllProjectIssues,
} from '../lib/jira'
import type { JiraIssue, JiraSprint } from '../types'

// ─── Stable Jira config selector (avoids re-fetching on unrelated store changes) ─

function useJiraConfigKey() {
  const workspace = useAppStore((s) => s.workspace)
  const isConfigured = useAppStore((s) => s.isConfigured)
  // Use a string key so effect deps stay primitive/stable
  const key = isConfigured && workspace
    ? `${workspace.jira_base_url}|${workspace.jira_email}|${workspace.jira_api_token}|${workspace.jira_project_key}`
    : null
  return { workspace, isConfigured, key }
}

// ─── Sprints ──────────────────────────────────────────────────────────────────

export function useJiraSprints() {
  const { workspace, isConfigured, key } = useJiraConfigKey()
  const [sprints, setSprints] = useState<JiraSprint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isConfigured || !workspace || !key) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    getSprints(getJiraConfig(workspace))
      .then(setSprints)
      .catch((e) => { if (e?.name !== 'AbortError') setError(e.message ?? 'Error al cargar sprints') })
      .finally(() => setLoading(false))
    return () => abortRef.current?.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { sprints, loading, error }
}

// ─── Issues by sprint (with real-time polling) ───────────────────────────────

const POLL_MS = 30_000 // 30 seconds

export function useJiraSprintIssues(sprintId: number | null) {
  const { workspace, isConfigured, key } = useJiraConfigKey()
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (!isConfigured || !workspace || !key || !sprintId) return

    let cancelled = false

    async function poll() {
      try {
        const data = await getIssuesBySprintId(getJiraConfig(workspace!), sprintId!)
        if (!cancelled) {
          setIssues(data)
          setLastUpdated(new Date())
          setError('')
        }
      } catch (e: unknown) {
        if (!cancelled && e instanceof Error) setError(e.message ?? 'Error al cargar issues')
      }
    }

    setLoading(true)
    setIssues([])
    poll().finally(() => { if (!cancelled) setLoading(false) })

    const timer = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sprintId])

  return { issues, loading, error, lastUpdated }
}

// ─── Issues today ─────────────────────────────────────────────────────────────

export function useJiraTodayIssues() {
  const { workspace, isConfigured, key } = useJiraConfigKey()
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isConfigured || !workspace || !key) return
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    getIssuesByDate(getJiraConfig(workspace), today)
      .then(setIssues)
      .catch((e) => setError(e.message ?? 'Error al cargar issues'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { issues, loading, error }
}

// ─── Backlog (issues no terminados) ──────────────────────────────────────────

export function useJiraBacklog() {
  const { workspace, isConfigured, key } = useJiraConfigKey()
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isConfigured || !workspace || !key) return
    setLoading(true)
    getBacklogIssues(getJiraConfig(workspace))
      .then(setIssues)
      .catch((e) => setError(e.message ?? 'Error al cargar backlog'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { issues, loading, error }
}

// ─── Todos los issues del proyecto ───────────────────────────────────────────

export function useAllProjectIssues() {
  const { workspace, isConfigured, key } = useJiraConfigKey()
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isConfigured || !workspace || !key) return
    setLoading(true)
    getAllProjectIssues(getJiraConfig(workspace))
      .then(setIssues)
      .catch((e) => setError(e.message ?? 'Error al cargar issues'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { issues, loading, error }
}
