import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import type { Workspace } from '../types'

interface AppStore {
  // ── Auth (Supabase) ─────────────────────────────────────────────────────────
  user: User | null
  authLoading: boolean
  setUser: (user: User | null) => void
  setAuthLoading: (v: boolean) => void

  // ── Auth (Simple — when Supabase not configured) ────────────────────────────
  simpleAuthSession: boolean
  setSimpleAuth: (v: boolean) => void

  // ── Workspace / Jira config ─────────────────────────────────────────────────
  workspace: Workspace | null
  setWorkspace: (ws: Workspace) => void
  clearWorkspace: () => void
  isConfigured: boolean

  // ── UI ──────────────────────────────────────────────────────────────────────
  isDarkMode: boolean
  toggleDarkMode: () => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Auth (never persisted — session comes from Supabase)
      user: null,
      authLoading: true,
      setUser: (user) => set({ user }),
      setAuthLoading: (authLoading) => set({ authLoading }),

      // Simple auth (persisted — used when Supabase is not configured)
      simpleAuthSession: false,
      setSimpleAuth: (simpleAuthSession) => set({ simpleAuthSession }),

      // Workspace
      workspace: null,
      isConfigured: false,
      setWorkspace: (ws) =>
        set({
          workspace: ws,
          isConfigured: !!(ws.jira_base_url && ws.jira_api_token && ws.jira_email),
        }),
      clearWorkspace: () => set({ workspace: null, isConfigured: false }),

      // UI
      isDarkMode: false,
      toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: 'jira-ai-scrum-workspace',
      // Persist workspace, UI prefs, and simple auth session
      partialize: (state) => ({
        workspace: state.workspace,
        isConfigured: state.isConfigured,
        isDarkMode: state.isDarkMode,
        simpleAuthSession: state.simpleAuthSession,
      }),
    }
  )
)

// ─── Jira config helper ───────────────────────────────────────────────────────

export function getJiraConfig(workspace: Workspace) {
  return {
    baseUrl: workspace.jira_base_url,
    email: workspace.jira_email,
    apiToken: workspace.jira_api_token,
    projectKey: workspace.jira_project_key,
  }
}

// ─── WhatsApp config helper ───────────────────────────────────────────────────

export function getWhatsAppConfig(workspace: Workspace) {
  return {
    provider: workspace.whatsapp_provider as 'twilio' | 'meta',
    destination_phone: workspace.destination_phone,
    twilio_account_sid: workspace.whatsapp_phone_number_id,
    twilio_auth_token: workspace.whatsapp_access_token,
    twilio_from_number: workspace.whatsapp_phone_number_id,
    meta_phone_number_id: workspace.whatsapp_phone_number_id,
    meta_access_token: workspace.whatsapp_access_token,
  }
}
