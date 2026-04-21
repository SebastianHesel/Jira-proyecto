// ─── Workspace / Settings ────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  jira_base_url: string
  jira_project_key: string
  jira_email: string
  jira_api_token: string
  timezone: string
  whatsapp_provider: 'twilio' | 'meta' | ''
  whatsapp_phone_number_id: string
  whatsapp_access_token: string
  destination_phone: string
  weekly_summary_day: number   // 0=Sun … 6=Sat
  weekly_summary_time: string  // "HH:MM"
}

// ─── Jira ─────────────────────────────────────────────────────────────────────

export type IssueType = 'Epic' | 'Story' | 'Task' | 'Bug' | 'Sub-task'
export type Priority = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest'
export type TicketStatus = 'To Do' | 'In Progress' | 'Done' | 'Blocked'

export interface JiraIssue {
  id: string
  jira_issue_key: string
  jira_issue_id: string
  title: string
  issue_type: IssueType
  priority: Priority
  story_points: number | null
  sprint_name: string
  assignee: string
  status: TicketStatus
  labels: string[]
  components: string[]
  created_at: string
}

export interface JiraProject {
  id: string
  key: string
  name: string
}

export interface JiraSprint {
  id: number
  name: string
  state: 'active' | 'future' | 'closed'
  startDate?: string | null
  endDate?: string | null
}

// ─── AI Ticket Generation ─────────────────────────────────────────────────────

export interface GeneratedTicket {
  issue_type: IssueType
  title: string
  summary: string
  description: string
  acceptance_criteria: string[]
  definition_of_done: string[]
  priority: Priority
  story_points: number
  labels: string[]
  components: string[]
  dependencies: string[]
  risks: string[]
  sprint_suggestion: string
  clarification_questions: string[]
}

export interface GeneratedSubTask {
  title: string
  description: string
  acceptance_criteria: string[]
  story_points: number
  labels: string[]
}

export interface GeneratedTicketWithLayers {
  main: GeneratedTicket
  frontend: GeneratedSubTask
  backend: GeneratedSubTask
}

export interface TicketRequest {
  id: string
  user_input: string
  context?: string
  clarification_questions: string[]
  final_payload?: GeneratedTicket
  status: 'draft' | 'clarifying' | 'preview' | 'created' | 'error'
  created_at: string
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface DailyReport {
  id: string
  report_date: string
  summary_text: string
  metrics: {
    total: number
    by_type: Record<IssueType, number>
    by_priority: Record<Priority, number>
    by_assignee: Record<string, number>
  }
  issues: JiraIssue[]
  generated_at: string
}

export interface SprintReport {
  id: string
  sprint_id: string
  sprint_name: string
  summary_text: string
  metrics: {
    total: number
    by_type: Record<string, number>
    by_priority: Record<string, number>
    by_assignee: Record<string, number>
    by_status: Record<string, number>
  }
  risks: string[]
  blockers: string[]
  issues: JiraIssue[]
  generated_at: string
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface ScheduledNotification {
  id: string
  workspace_id: string
  notification_type: 'weekly_summary' | 'daily_alert' | 'reminder'
  schedule_config: {
    day?: number
    time?: string
    interval?: string
  }
  is_active: boolean
  last_sent_at: string | null
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppStore {
  workspace: Workspace | null
  setWorkspace: (ws: Workspace) => void
  isConfigured: boolean
}
