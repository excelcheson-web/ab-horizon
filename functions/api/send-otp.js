// Cloudflare Pages Function – Send OTP via Resend
// Route: /api/send-otp  (POST only)

export async function onRequestPost({ request, env }) {
  const RESEND_API_KEY = env.RESEND_API_KEY
  const FROM_EMAIL     = env.FROM_EMAIL || 'Optima Credit Union <noreply@optimaunion.com>'

  if (!RESEND_API_KEY) {
    return json({ error: 'Email service not configured' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { email, code, type } = body

  if (!email || !code) {
    return json({ error: 'Missing email or code' }, 400)
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email format' }, 400)
  }

  const subject = type === 'transfer'
    ? 'Optima Credit Union: Your transfer passcode'
    : 'Optima Credit Union: Your sign-in passcode'

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:#0d1b4b;border:1px solid #c9a23a;margin-bottom:12px;">
          <span style="font-size:22px;font-weight:900;color:#e5c96e;letter-spacing:-0.03em;font-family:Georgia,serif;">O</span>
        </div>
        <h1 style="font-size:20px;font-weight:700;color:#0d1b4b;margin:0;">Optima Credit Union</h1>
        <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">Secure Banking Platform</p>
      </div>

      <div style="background:#fdf8ec;border-radius:16px;padding:32px 24px;text-align:center;border:1px solid rgba(201,162,58,0.25);">
        <p style="font-size:15px;color:#374151;margin:0 0 20px;font-weight:500;">
          ${type === 'transfer' ? 'Your transfer verification code:' : 'Your one-time verification code:'}
        </p>
        <div style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:38px;font-weight:800;letter-spacing:0.35em;color:#c9a23a;padding:16px 0;">
          ${code}
        </div>
        <p style="font-size:13px;color:#9ca3af;margin:20px 0 0;">
          This code expires in <strong>10 minutes</strong>. Never share it with anyone.
        </p>
      </div>

      <div style="margin-top:24px;padding:16px;background:#fef9ec;border-radius:10px;border-left:3px solid #f59e0b;">
        <p style="font-size:12px;color:#92400e;margin:0;">
          <strong>Security notice:</strong> Optima Credit Union will never ask for this code by phone or email.
          If you didn't request this, please secure your account immediately.
        </p>
      </div>

      <p style="font-size:11px;color:#d1d5db;text-align:center;margin-top:24px;">
        © ${new Date().getFullYear()} Optima Credit Union. All rights reserved.
      </p>
    </div>
  `

  const text = `Optima Credit Union\n\nYour ${type === 'transfer' ? 'transfer' : 'sign-in'} passcode: ${code}\n\nThis code expires in 10 minutes. Never share it with anyone.\n\nOptima Credit Union will never ask for this code by phone or email.\n\n© ${new Date().getFullYear()} Optima Credit Union`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        reply_to: env.REPLY_TO_EMAIL || 'support@optimaunion.com',
        subject,
        html,
        text,
        tags: [{ name: 'category', value: 'transactional' }],
      }),
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

// Handle non-POST requests
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
