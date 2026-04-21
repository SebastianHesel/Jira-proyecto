/**
 * Netlify Function — Meta WhatsApp Cloud API proxy
 * Forwards /api/meta/* → https://graph.facebook.com/*
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,accept',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  try {
    const original = new URL(event.rawUrl)
    const apiPath = original.pathname.replace(/^\/api\/meta/, '') || '/'
    const targetUrl = `https://graph.facebook.com${apiPath}${original.search}`

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
    forwardHeaders['host'] = 'graph.facebook.com'

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
      body: JSON.stringify({ error: 'Meta proxy error', detail: err.message }),
    }
  }
}
