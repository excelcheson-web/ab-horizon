// Cloudflare Pages Function – Send transaction alert via Resend
// Route: /api/send-alert  (POST only)

export async function onRequestPost({ request, env }) {
  const RESEND_API_KEY = env.RESEND_API_KEY
  const FROM_EMAIL     = env.FROM_EMAIL || 'Optima Credit Union <noreply@optimacreditunion.com>'

  if (!RESEND_API_KEY) {
    return json({ error: 'Email service not configured' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { email, alertType, amount, newBalance } = body

  if (!email || !alertType || !amount) {
    return json({ error: 'Missing required fields' }, 400)
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email format' }, 400)
  }

  const isCredit    = alertType === 'credit'
  const subject     = isCredit
    ? `Optima Credit Union – Credit Alert: +$${amount}`
    : `Optima Credit Union – Debit Alert: -$${amount}`
  const accentColor = isCredit ? '#16a34a' : '#dc2626'
  const accentBg    = isCredit ? '#f0fdf4' : '#fef2f2'
  const icon        = isCredit ? '↓' : '↑'
  const label       = isCredit ? 'CREDIT' : 'DEBIT'
  const signed      = isCredit ? `+$${amount}` : `-$${amount}`
  const timestamp   = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const ref = Math.random().toString(36).slice(2, 10).toUpperCase()

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:#0d1b4b;border:1px solid #c9a23a;margin-bottom:12px;">
          <span style="font-size:22px;font-weight:900;color:#e5c96e;letter-spacing:-0.03em;font-family:Georgia,serif;">O</span>
        </div>
        <h1 style="font-size:20px;font-weight:700;color:#0d1b4b;margin:0;">Optima Credit Union</h1>
        <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">Transaction Alert</p>
      </div>

      <div style="background:${accentBg};border-radius:16px;padding:32px 24px;text-align:center;border:1px solid ${accentColor}22;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:${accentColor}18;margin-bottom:14px;">
          <span style="font-size:24px;color:${accentColor};font-weight:700;">${icon}</span>
        </div>
        <p style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:${accentColor};margin:0 0 6px;text-transform:uppercase;">${label} ALERT</p>
        <div style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:36px;font-weight:800;color:${accentColor};padding:8px 0;">
          ${signed}
        </div>
        <hr style="border:none;border-top:1px solid ${accentColor}22;margin:20px 0;"/>
        <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
          <tr>
            <td style="text-align:left;padding:7px 0;font-weight:600;color:#6b7280;">New Balance</td>
            <td style="text-align:right;padding:7px 0;font-family:monospace;font-weight:700;color:#0d1b4b;">$${newBalance}</td>
          </tr>
          <tr>
            <td style="text-align:left;padding:7px 0;font-weight:600;color:#6b7280;">Date & Time</td>
            <td style="text-align:right;padding:7px 0;color:#374151;">${timestamp} ET</td>
          </tr>
          <tr>
            <td style="text-align:left;padding:7px 0;font-weight:600;color:#6b7280;">Reference</td>
            <td style="text-align:right;padding:7px 0;font-family:monospace;color:#374151;">${ref}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top:20px;padding:14px 16px;background:#fdf8ec;border-radius:10px;border-left:3px solid #c9a23a;">
        <p style="font-size:12px;color:#7a5c10;margin:0;">
          If you did not authorize this transaction, please contact our fraud team immediately at
          <strong>1-800-555-0199</strong> or freeze your card from the app.
        </p>
      </div>

      <p style="font-size:11px;color:#d1d5db;text-align:center;margin-top:24px;">
        © ${new Date().getFullYear()} Optima Credit Union. All rights reserved.
      </p>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject, html }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return json({ error: err.message || 'Failed to send email' }, res.status)
    }

    const data = await res.json()
    return json({ success: true, id: data.id }, 200)
  } catch {
    return json({ error: 'Email service unavailable' }, 502)
  }
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405)
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
