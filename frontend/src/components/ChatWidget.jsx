import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { useToast } from '../context/ToastContext'

const suggestions = [
  'What schemes am I eligible for?',
  'Track my application',
  'Why am I not eligible?',
  'What documents are missing?',
  'Find a nearby office',
  'Do I have any deadlines?',
]

export default function ChatWidget() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const scrollRef = useRef(null)
  const toast = useToast()
  const recognitionRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.()
    }
  }, [])

  function openChat() {
    setOpen(true)
    if (messages.length === 0) {
      setMessages([
        {
          role: 'ai',
          text: user
            ? 'Namaste! I am your SchemeAI assistant. Ask me about schemes, applications, documents or deadlines. You can also tap the mic and speak.'
            : 'Namaste! Sign in to get the most out of me. I can still try to help — try a suggestion below.',
        },
      ])
    }
  }

  async function send(text) {
    const t = (text || input).trim()
    if (!t || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: t }])
    setBusy(true)
    try {
      if (!user) {
        setMessages((m) => [...m, { role: 'ai', text: 'Please sign in first — I need your profile to personalise answers.' }])
        return
      }
      const res = await api.post('/voice/command', { text: t, language: 'en' })
      setMessages((m) => [...m, { role: 'ai', text: res.reply }])
      speak(res.reply)
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: 'Sorry, I hit an error. Try again.' }])
      toast.error(e.message)
    } finally {
      setBusy(false)
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

  function speak(text) {
    if (!('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
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
    <div className="fixed bottom-5 left-5 z-[90] w-[min(380px,calc(100vw-2rem))]">
      <div className="card shadow-lift flex flex-col overflow-hidden" style={{ maxHeight: 'min(620px, calc(100vh - 2rem))' }}>
        <div className="bg-brand text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 1l3 6 6 .9-4.5 4.4 1.1 6.7L12 16.9l-5.6 3.1 1.1-6.7L3 7.9 9 7l3-6z" />
              </svg>
            </span>
            <div>
              <div className="font-bold text-sm leading-tight">SchemeAI Assistant</div>
              <div className="text-[11px] text-brand-100">Voice + text · 6 languages</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-cream" style={{ minHeight: 260 }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-brand text-white rounded-br-sm' : 'bg-white border border-line text-ink rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-white border border-line rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted flex items-center gap-2">
                <span className="spinner !h-3.5 !w-3.5" /> Thinking…
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="border-t border-line bg-white p-2">
          <div className="flex flex-wrap gap-1.5 px-1 pb-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="chip bg-cream text-muted hover:bg-brand-50 hover:text-brand-700 transition text-left">
                {s}
              </button>
            ))}
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
        </div>
      </div>
    </div>
  )
}
