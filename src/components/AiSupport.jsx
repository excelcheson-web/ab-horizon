import { useState, useRef, useEffect } from 'react'
import TDLogo from './TDLogo'

const BOT_RESPONSES = [
  { patterns: ['balance', 'how much', 'account balance'], reply: 'Your current account balance is shown on your Portfolio Overview dashboard. For detailed statements, tap the Transactions tab.' },
  { patterns: ['transfer', 'send money', 'wire', 'move money'], reply: 'To make a transfer, use the "Move Money" section on your dashboard. You can choose Quick Pay, Wire Transfer, or Scheduled payments. All transfers require OTP verification.' },
  { patterns: ['card', 'debit card', 'credit card', 'block card', 'freeze'], reply: 'You can manage your cards from the Cards tab in the bottom navigation. To freeze or unfreeze a card, toggle the switch on the card details page.' },
  { patterns: ['crypto', 'bitcoin', 'ethereum', 'solana', 'btc', 'eth'], reply: 'Your digital assets are shown in the Crypto Assets section. We support BTC, ETH, SOL, ADA, DOT, and LINK. Prices update in real-time.' },
  { patterns: ['pin', 'change pin', 'transaction pin', 'reset pin'], reply: 'To change your transaction PIN, go to Settings > Security > Transaction PIN. You\'ll need to verify your identity with an OTP first.' },
  { patterns: ['password', 'change password', 'forgot password'], reply: 'To reset your password, tap "Forgot password?" on the login screen. A reset link will be sent to your registered email.' },
  { patterns: ['otp', 'verification code', 'code not received'], reply: 'OTP codes are sent to your registered email. If you haven\'t received it, check your spam folder and try "Resend Code". Codes expire after 10 minutes.' },
  { patterns: ['loan', 'borrow', 'credit'], reply: 'We offer personal loans, home loans, and business credit lines. Visit Wealth > Loans to check your eligibility and apply.' },
  { patterns: ['savings', 'interest', 'vault'], reply: 'Your Savings Vault earns competitive interest. Current rate: 4.25% APY. You can set up automatic deposits from your Current Account.' },
  { patterns: ['support', 'agent', 'human', 'speak to someone', 'call'], reply: 'For urgent issues, call our 24/7 helpline at 1-800-SECURE. For non-urgent matters, I\'m here to help!' },
  { patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'], reply: 'Hello! Welcome to Optima Credit Union Support. How can I help you today? I can assist with transfers, account info, cards, crypto, and more.' },
  { patterns: ['thank', 'thanks', 'appreciate'], reply: 'You\'re welcome! Is there anything else I can help you with?' },
  { patterns: ['fee', 'charge', 'cost'], reply: 'Optima Credit Union offers zero-fee domestic transfers. International wires have a flat $15 fee. Crypto trades have a 0.5% spread. No monthly account maintenance fees.' },
  { patterns: ['limit', 'maximum', 'transaction limit'], reply: 'Daily transfer limits: Quick Pay $5,000, Wire Transfer $50,000, Scheduled $100,000. Contact support to request a temporary increase.' },
]

const DEFAULT_REPLY = "I'm not sure I understand. Could you rephrase that? I can help with account balances, transfers, cards, crypto, security, loans, and more."

function getBotReply(message) {
  const lower = message.toLowerCase()
  for (const entry of BOT_RESPONSES) {
    if (entry.patterns.some((p) => lower.includes(p))) {
      return entry.reply
    }
  }
  return DEFAULT_REPLY
}

const BotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <path d="M12 2v4" />
    <circle cx="9" cy="16" r="1" fill="currentColor" />
    <circle cx="15" cy="16" r="1" fill="currentColor" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const QUICK_ACTIONS = [
  'Check my balance',
  'Make a transfer',
  'Card management',
  'Crypto prices',
  'Transaction limits',
]

export default function AiSupport({ onClose }) {
  const [messages, setMessages] = useState([
    { id: 1, from: 'bot', text: "Hi there! I'm your banking assistant. How can I help you today?", time: new Date() },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  function sendMessage(text) {
    if (!text.trim()) return
    const userMsg = { id: Date.now(), from: 'profiles', text: text.trim(), time: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setTyping(true)

    // Simulate bot thinking
    setTimeout(() => {
      const reply = getBotReply(text)
      setMessages((prev) => [...prev, { id: Date.now() + 1, from: 'bot', text: reply, time: new Date() }])
      setTyping(false)
    }, 5000)
  }

  function handleSubmit(e) {
    e.preventDefault()
    sendMessage(input)
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="ai-chat-overlay">
      <div className="ai-chat">
        {/* Header */}
        <div className="ai-chat-header">
          <div className="ai-chat-header-left">
            <TDLogo size={40} className="td-logo-sm" style={{ borderRadius: '50%' }} />
            <div>
              <h3 className="ai-chat-title">Optima Credit Union Assistant</h3>
              <span className="ai-chat-status">Online</span>
            </div>
          </div>
          <button className="ai-chat-close" onClick={onClose}>×</button>
        </div>

        {/* Messages */}
        <div className="ai-chat-messages">
          {messages.map((m) => (
            <div key={m.id} className={`ai-msg ai-msg--${m.from}`}>
              {m.from === 'bot' && (
                <div className="ai-msg-avatar"><BotIcon /></div>
              )}
              <div className={`ai-msg-bubble ai-msg-bubble--${m.from}`}>
                <p className="ai-msg-text">{m.text}</p>
                <span className="ai-msg-time">{formatTime(m.time)}</span>
              </div>
            </div>
          ))}
          {typing && (
            <div className="ai-msg ai-msg--bot">
              <div className="ai-msg-avatar"><BotIcon /></div>
              <div className="ai-msg-bubble ai-msg-bubble--bot ai-typing">
                <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick actions */}
        {messages.length <= 2 && (
          <div className="ai-quick-actions">
            {QUICK_ACTIONS.map((q) => (
              <button key={q} className="ai-quick-btn" onClick={() => sendMessage(q)}>{q}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <form className="ai-chat-input-bar" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="ai-chat-input"
            type="text"
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <button className="ai-chat-send" type="submit" disabled={!input.trim()}>
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  )
}
