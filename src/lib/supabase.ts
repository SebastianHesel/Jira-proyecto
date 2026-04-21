import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars — running in mock mode')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// ─── Workspace helpers ────────────────────────────────────────────────────────

export async function getWorkspace(id: string) {
  if (!supabase) return null
  const { data } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

export async function upsertWorkspace(workspace: Record<string, unknown>) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('workspaces')
    .upsert(workspace)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Ticket request helpers ───────────────────────────────────────────────────

export async function saveTicketRequest(payload: Record<string, unknown>) {
  if (!supabase) return { id: crypto.randomUUID(), ...payload }
  const { data, error } = await supabase
    .from('ticket_requests')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Jira issue helpers ───────────────────────────────────────────────────────

export async function saveJiraIssue(issue: Record<string, unknown>) {
  if (!supabase) return issue
  const { data, error } = await supabase
    .from('jira_issues')
    .insert(issue)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getTodayIssues() {
  if (!supabase) return []
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('jira_issues')
    .select('*')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getIssuesBySprint(sprintName: string) {
  if (!supabase) return []
  const { data } = await supabase
    .from('jira_issues')
    .select('*')
    .eq('sprint_name', sprintName)
    .order('created_at', { ascending: false })
  return data ?? []
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export async function logAudit(action: string, payload: unknown) {
  if (!supabase) return
  await supabase.from('audit_logs').insert({ action, payload_json: payload })
}
