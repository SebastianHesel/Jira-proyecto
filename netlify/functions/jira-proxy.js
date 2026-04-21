/**
 * Netlify Function — Jira proxy
 * Forwards /api/jira/* → JIRA_BASE_URL/*
 *
 * Set JIRA_BASE_URL in Netlify › Site configuration › Environment variables
 * Example: https://your-company.atlassian.net
 */

const JIRA_BASE = (process.env.JIRA_BASE_URL || 'https://heselmedia.atlassian.net').replace(/\/$/, '')

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,accept',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  try {
    // Use rawUrl to get the original request path (event.path is the rewritten path)
    const original = new URL(event.rawUrl)
    const jiraPath = original.pathname.replace(/^\/api\/jira/, '') || '/'
    const targetUrl = `${JIRA_BASE}${jiraPath}${original.search}`

    const forwardHeaders = { ...event.headers }
    delete forwardHeaders['host']
    delete forwardHeaders['origin']
    delete forwardHeaders['referer']
    delete forwardHeaders['x-forwarded-for']
    delete forwardHeaders['x-forwarded-host']
    delete forwardHeaders['x-forwarded-proto']
    delete forwardHeaders['x-nf-request-id']
    delete forwardHeaders['cdn-loop']
    delete forwardHeaders['via']

    const jiraHost = new URL(JIRA_BASE).host
    forwardHeaders['host'] = jiraHost

    const fetchOptions = {
      method: event.httpMethod,
      headers: forwardHeaders,
    }
    if (event.body && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
      fetchOptions.body = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body
    }

    const response = await fetch(targetUrl, fetchOptions)
    const body = await response.text()

    return {
      statusCode: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json', ...CORS },
      body,
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json', ...CORS },
      body: JSON.stringify({ error: 'Jira proxy error', detail: err.message }),
    }
  }
}
