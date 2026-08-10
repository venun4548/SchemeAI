import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { useToast } from '../context/ToastContext'

const QUICK_ACTIONS = [
  { label: 'Find Schemes', prompt: 'What government schemes are available?' },
  { label: 'Check Eligibility', prompt: 'Am I eligible for this scheme?' },
  { label: 'Required Documents', prompt: 'What documents do I need?' },
  { label: 'Application Help', prompt: 'How do I apply for a scheme?' },
  { label: 'Ask a Question', prompt: 'What can you do?' },
]

const THINKING_STEPS = [
  'Understanding your question',
  'Checking your profile',
  'Searching the database',
  'Preparing your answer',
]

const WELCOME =
  "Hello! I'm SchemeAI Assistant. I can help you with government schemes, eligibility, documents, application steps and tracking.\n\nHow can I help you today?"

const STORAGE_KEY = 'schemeai_chat_conversation_id'

const VOICE_LANGUAGES = [
  { code: 'en', label: 'English', lang: 'en-IN' },
  { code: 'hi', label: 'Hindi', lang: 'hi-IN' },
  { code: 'te', label: 'Telugu', lang: 'te-IN' },
  { code: 'ta', label: 'Tamil', lang: 'ta-IN' },
  { code: 'kn', label: 'Kannada', lang: 'kn-IN' },
  { code: 'mr', label: 'Marathi', lang: 'mr-IN' },
  { code: 'bn', label: 'Bengali', lang: 'bn-IN' },
  { code: 'gu', label: 'Gujarati', lang: 'gu-IN' },
  { code: 'pa', label: 'Punjabi', lang: 'pa-IN' },
  { code: 'ml', label: 'Malayalam', lang: 'ml-IN' },
  { code: 'or', label: 'Odia', lang: 'or-IN' },
  { code: 'as', label: 'Assamese', lang: 'as-IN' },
  { code: 'ur', label: 'Urdu', lang: 'ur-IN' },
  { code: 'sd', label: 'Sindhi', lang: 'sd-IN' },
  { code: 'kok', label: 'Konkani', lang: 'kok-IN' },
  { code: 'mni', label: 'Manipuri', lang: 'mni-IN' },
  { code: 'ne', label: 'Nepali', lang: 'ne-IN' },
  { code: 'brx', label: 'Bodo', lang: 'brx-IN' },
  { code: 'doi', label: 'Dogri', lang: 'doi-IN' },
  { code: 'ks', label: 'Kashmiri', lang: 'ks-IN' },
  { code: 'mai', label: 'Maithili', lang: 'mai-IN' },
  { code: 'sat', label: 'Santhali', lang: 'sat-IN' },
  { code: 'sa', label: 'Sanskrit', lang: 'sa-IN' }
]

function RichText({ text }) {
  const parts = String(text || '').split('**')
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">{p}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  )
}

export default function ChatWidget() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [voiceLang, setVoiceLang] = useState('en')
  const scrollRef = useRef(null)
  const toast = useToast()
  const recognitionRef = useRef(null)
  const stepTimerRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, showHistory])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setConversationId(stored)
    return () => {
      recognitionRef.current?.stop?.()
      clearInterval(stepTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (user && open) loadConversations()
  }, [user, open])

  async function loadConversations() {
    if (!user) return
    try {
      const res = await api.get('/chat/conversations')
      setConversations(res.items || [])
    } catch {
      setConversations([])
    }
  }

  function openChat() {
    setOpen(true)
    if (user) loadConversations()
    if (messages.length === 0) {
      setMessages([{ role: 'ai', text: WELCOME, quickActions: true }])
    }
  }

  function resetToWelcome() {
    setConversationId(null)
    localStorage.removeItem(STORAGE_KEY)
    setMessages([{ role: 'ai', text: WELCOME, quickActions: true }])
    setShowHistory(false)
  }

  async function openConversation(id) {
    try {
      const res = await api.get(`/chat/conversations/${id}`)
      const msgs = (res.messages || []).map((m) => ({
        role: m.role,
        text: m.message,
        sources: m.sources,
        buttons: m.buttons,
        agents: m.agents_used,
        intent: m.intent,
      }))
      setMessages(msgs.length ? msgs : [{ role: 'ai', text: WELCOME, quickActions: true }])
      setConversationId(id)
      localStorage.setItem(STORAGE_KEY, id)
      setShowHistory(false)
    } catch {
      toast.error('That chat could not be loaded.')
    }
  }

  async function deleteConversation(id) {
    try {
      await api.del(`/chat/conversations/${id}`)
      if (conversationId === id) resetToWelcome()
      await loadConversations()
    } catch {
      toast.error('Could not delete that chat.')
    }
  }

  async function send(text) {
    const t = (text || input).trim()
    if (!t || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: t }])
    setBusy(true)
    setStepIdx(0)
    stepTimerRef.current = setInterval(() => setStepIdx((i) => (i + 1) % THINKING_STEPS.length), 1400)
    try {
      const res = await api.post('/chat', { 
        message: t, 
        conversation_id: conversationId,
        context: { language: voiceLang }
      })
      if (res.conversation_id) {
        setConversationId(res.conversation_id)
        localStorage.setItem(STORAGE_KEY, res.conversation_id)
      }
      setMessages((m) => [
        ...m,
        {
          role: 'ai',
          text: res.message,
          sources: res.sources,
          buttons: res.buttons,
          agents: res.agents_used,
          intent: res.intent,
        },
      ])
      if (user) loadConversations()
    } catch (e) {
      if (e.status === 429) {
        setMessages((m) => [...m, { role: 'ai', text: e.message || 'You are sending messages too quickly. Please wait a moment.' }])
      } else {
        setMessages((m) => [
          ...m,
          { role: 'ai', text: "I couldn't reach the assistant right now. Please try again in a moment." },
        ])
        toast.error('Chat request failed. Please try again.')
      }
    } finally {
      setBusy(false)
      clearInterval(stepTimerRef.current)
    }
  }

  function handleButton(btn) {
    if (btn.kind === 'link' && btn.url) {
      window.open(btn.url, '_blank', 'noopener,noreferrer')
    } else if (btn.kind === 'route' && btn.url) {
      window.location.assign(btn.url)
    } else {
      send(btn.prompt || btn.label)
    }
  }

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      toast.error('Speech recognition is not supported in this browser.')
      return
    }
    const rec = new SR()
    rec.lang = 'en-IN'
    rec.interimResults = false
    rec.onresult = (ev) => {
      const text = ev.results[0][0].transcript
      setInput(text)
      send(text)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  function speakMessage(text) {
    if (!('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(String(text || '').replace(/\*\*/g, ''))
      u.lang = (VOICE_LANGUAGES.find((l) => l.code === voiceLang) || VOICE_LANGUAGES[0]).lang
      u.rate = 1
      window.speechSynthesis.speak(u)
    } catch {
      /* ignore */
    }
  }

  if (!open) {
    return (
      <button
        onClick={openChat}
        className="fixed bottom-5 left-5 z-[90] h-14 w-14 rounded-full bg-brand text-white shadow-lift flex items-center justify-center hover:bg-brand-700 transition"
        aria-label="Open AI assistant"
        title="Ask the AI assistant"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
          <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 left-5 z-[90] w-[min(400px,calc(100vw-2rem))]">
      <div className="card shadow-lift flex flex-col overflow-hidden" style={{ maxHeight: 'min(640px, calc(100vh - 2rem))' }}>
        <div className="bg-brand text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 1l3 6 6 .9-4.5 4.4 1.1 6.7L12 16.9l-5.6 3.1 1.1-6.7L3 7.9 9 7l3-6z" />
              </svg>
            </span>
            <div>
              <div className="font-bold text-sm leading-tight">SchemeAI Assistant</div>
              <div className="text-[11px] text-brand-100 flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                AI Assistant · Online
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="h-7 w-7 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition"
              aria-label="Chat history"
              title="Previous chats"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 10.6 3.9 2.3-.8 1.3L11 13.2V6h2z" />
              </svg>
            </button>
            <button
              onClick={resetToWelcome}
              className="h-7 w-7 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition"
              aria-label="New chat"
              title="New chat"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
              </svg>
            </button>
            <button onClick={() => setOpen(false)} className="h-7 w-7 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="border-b border-line bg-white max-h-44 overflow-y-auto scrollbar-thin">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted flex items-center justify-between">
              <span>Previous chats</span>
              {!user && <span className="normal-case font-normal">Sign in to save chats</span>}
            </div>
            {conversations.length === 0 ? (
              <div className="px-3 pb-3 text-xs text-muted">{user ? 'No previous chats yet.' : 'Your chats will be saved here once you sign in.'}</div>
            ) : (
              conversations.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-cream transition group">
                  <button onClick={() => openConversation(c.id)} className="flex-1 text-left text-sm truncate">
                    {c.title}
                    <span className="block text-[10px] text-muted">{c.message_count} messages</span>
                  </button>
                  <button
                    onClick={() => deleteConversation(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 text-xs px-1"
                    aria-label="Delete chat"
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-cream" style={{ minHeight: 280 }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user' ? 'bg-brand text-white rounded-br-sm' : 'bg-white border border-line text-ink rounded-bl-sm'
                }`}
              >
                <RichText text={m.text} />

                {m.role === 'ai' && m.text && (
                  <button
                    onClick={() => speakMessage(m.text)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100 transition"
                    aria-label="Listen"
                    title={`Listen in ${(VOICE_LANGUAGES.find((l) => l.code === voiceLang) || VOICE_LANGUAGES[0]).label}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zm-6 9a6 6 0 0 0 12 0h2a8 8 0 0 1-7 7.93V22h-2v-2.07A8 8 0 0 1 4 12h2z" />
                    </svg>
                    Listen
                  </button>
                )}

                {m.quickActions && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {QUICK_ACTIONS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => send(q.prompt)}
                        className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 transition"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}

                {m.agents?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.agents.map((a) => (
                      <span
                        key={a.name}
                        title={`${a.task} · ${a.duration_ms}ms`}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                      >
                        ✓ {a.name}
                      </span>
                    ))}
                  </div>
                )}

                {m.sources?.length > 0 && (
                  <div className="mt-2 border-t border-dashed border-line pt-1.5 space-y-0.5 text-[11px] text-muted">
                    <div className="font-semibold text-ink/80">Source: Official Government Information</div>
                    {m.sources.map((s, si) =>
                      s.link ? (
                        <a
                          key={si}
                          href={s.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-brand-700 hover:underline"
                        >
                          ↗ {s.title}
                        </a>
                      ) : (
                        <div key={si}>{s.title}</div>
                      ),
                    )}
                  </div>
                )}

                {m.buttons?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.buttons.map((b) => (
                      <button
                        key={b.label}
                        onClick={() => handleButton(b)}
                        className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 transition"
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="bg-white border border-line rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted flex items-center gap-2">
                <span className="spinner !h-3.5 !w-3.5" />
                {THINKING_STEPS[stepIdx]}…
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="border-t border-line bg-white p-2">
          <div className="px-1 pb-1.5">
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              className="w-full input !py-1.5 !text-xs"
              aria-label="Listen language"
              title="Choose the language used by the Listen button"
            >
              {VOICE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  Listen in: {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input flex-1 !py-2"
              placeholder="Ask anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button
              onClick={startListening}
              className={`h-10 w-10 rounded-full flex items-center justify-center transition ${listening ? 'bg-red-500 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
              aria-label="Voice input"
              title="Speak"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
              </svg>
            </button>
            <button onClick={() => send()} className="h-10 w-10 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-700 transition" aria-label="Send">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M2 21 23 12 2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </div>
          {!user && (
            <p className="px-1 pt-1.5 text-[10px] text-muted">
              Signed-out chats are not saved. <span className="text-brand-700 font-medium">Sign in</span> for personalised answers and chat history.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
