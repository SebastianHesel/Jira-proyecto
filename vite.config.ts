import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars so the proxy target can be configured per-environment
  const env = loadEnv(mode, process.cwd(), '')
  const jiraBase = env.VITE_JIRA_BASE_URL || 'https://heselmedia.atlassian.net'

  return {
    plugins: [react()],
    server: {
      proxy: {
        // ── Anthropic / Claude API ──────────────────────────────────────────
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          headers: {
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        },

        // ── Jira Cloud ─────────────────────────────────────────────────────
        // Target is read from VITE_JIRA_BASE_URL in .env.local (fallback to heselmedia)
        '/api/jira': {
          target: jiraBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/jira/, ''),
          secure: true,
        },

        // ── WhatsApp — Twilio ──────────────────────────────────────────────
        '/api/twilio': {
          target: 'https://api.twilio.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/twilio/, ''),
          secure: true,
        },

        // ── WhatsApp — Meta Cloud API ──────────────────────────────────────
        '/api/meta': {
          target: 'https://graph.facebook.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/meta/, ''),
          secure: true,
        },
      },
    },
  }
})
