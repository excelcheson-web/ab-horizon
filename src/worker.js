import * as sendOtp from '../functions/api/send-otp.js'
import * as sendAlert from '../functions/api/send-alert.js'
import * as submitTransfer from '../functions/api/transfers/submit.js'

const API_ROUTES = {
  '/api/send-otp': sendOtp,
  '/api/send-alert': sendAlert,
  '/api/transfers/submit': submitTransfer,
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}

async function handleApiRequest(request, env, ctx) {
  const url = new URL(request.url)
  const route = API_ROUTES[url.pathname]
  if (!route) return json({ error: 'API route not found' }, 404)
  if (request.method === 'OPTIONS') return json({ ok: true })

  const handler = request.method === 'POST'
    ? route.onRequestPost
    : route.onRequest

  if (!handler) return json({ error: 'Method not allowed' }, 405)
  return handler({ request, env, ctx, params: {} })
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, ctx)
    }

    return env.ASSETS.fetch(request)
  },
}
