// Cloudflare Pages Function – Send OTP via Resend
// Route: /api/send-otp  (POST only)

export async function onRequestPost({ request, env }) {
  const RESEND_API_KEY = env.RESEND_API_KEY
  const FROM_EMAIL     = env.FROM_EMAIL || '[BANK NAME] <noreply@[bankdomain].com>'

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
    ? '[BANK NAME] – Transfer Verification Code'
    : '[BANK NAME] – Email Verification Code'

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#1a56db,#0a2540);margin-bottom:12px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,3 22,8 2,8" fill="rgba(255,255,255,0.95)"/>
            <rect x="4" y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.9)"/>
            <rect x="9" y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.9)"/>
            <rect x="14" y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.9)"/>
            <rect x="19" y="9" width="2.5" height="9" rx="0.5" fill="rgba(255,255,255,0.9)"/>
            <rect x="2" y="18" width="20" height="2.5" rx="0.5" fill="rgba(255,255,255,0.95)"/>
          </svg>
        </div>
        <h1 style="font-size:20px;font-weight:700;color:#0a2540;margin:0;">[BANK NAME]</h1>
        <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">Secure Banking Platform</p>
      </div>

      <div style="background:#f0f4ff;border-radius:16px;padding:32px 24px;text-align:center;border:1px solid #dbeafe;">
        <p style="font-size:15px;color:#374151;margin:0 0 20px;font-weight:500;">
          ${type === 'transfer' ? 'Your transfer verification code:' : 'Your one-time verification code:'}
        </p>
        <div style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:38px;font-weight:800;letter-spacing:0.35em;color:#1a56db;padding:16px 0;">
          ${code}
        </div>
        <p style="font-size:13px;color:#9ca3af;margin:20px 0 0;">
          This code expires in <strong>10 minutes</strong>. Never share it with anyone.
        </p>
      </div>

      <div style="margin-top:24px;padding:16px;background:#fef9ec;border-radius:10px;border-left:3px solid #f59e0b;">
        <p style="font-size:12px;color:#92400e;margin:0;">
          <strong>Security notice:</strong> [BANK NAME] will never ask for this code by phone or email.
          If you didn't request this, please secure your account immediately.
        </p>
      </div>

      <p style="font-size:11px;color:#d1d5db;text-align:center;margin-top:24px;">
        © ${new Date().getFullYear()} [Bank Name Placeholder]. All rights reserved.
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
