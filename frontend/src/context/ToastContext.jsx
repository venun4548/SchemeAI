import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((type, message, title) => {
    const id = ++idCounter
    setToasts((ts) => [...ts, { id, type, message, title }])
    setTimeout(() => remove(id), 5000)
  }, [remove])

  const toast = useMemo(
    () => ({
      success: (m, t) => push('success', m, t),
      error: (m, t) => push('error', m, t),
      info: (m, t) => push('info', m, t),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card px-4 py-3 shadow-lift flex items-start gap-3 ${
              t.type === 'error' ? 'border-red-200' : t.type === 'success' ? 'border-brand-200' : ''
            }`}
          >
            <span
              className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                t.type === 'error' ? 'bg-red-500' : t.type === 'success' ? 'bg-brand-500' : 'bg-blue-500'
              }`}
            />
            <div className="min-w-0">
              {t.title && <p className="text-sm font-semibold text-ink">{t.title}</p>}
              <p className="text-sm text-muted">{t.message}</p>
            </div>
            <button onClick={() => remove(t.id)} className="ml-auto text-muted hover:text-ink" aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
