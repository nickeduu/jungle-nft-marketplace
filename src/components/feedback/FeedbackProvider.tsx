import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export type FeedbackTone = 'success' | 'error' | 'info'

interface FeedbackMessage {
  id: number
  message: string
  tone: FeedbackTone
}

type Notify = (message: string, tone?: FeedbackTone) => void

const FeedbackContext = createContext<Notify>(() => {})

const DISMISS_MS = 6_000

/**
 * App-wide feedback for mutations and session events (toast-like, no extra dependency).
 * The live regions always exist in the DOM, so screen readers announce new messages:
 * errors via role="alert", the rest via role="status".
 * Toasts never block the page: taps/clicks go through them (only "close" is interactive).
 * Mobile: bottom, above the bottom navigation; desktop: top, below the header.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<FeedbackMessage[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setMessages((current) => current.filter((m) => m.id !== id)), [])
  const notify = useCallback<Notify>((message, tone = 'info') => {
    const id = nextId.current++
    // Keep at most 3; a repeated message replaces the previous one.
    setMessages((current) => [...current.filter((m) => m.message !== message), { id, message, tone }].slice(-3))
  }, [])

  const errors = messages.filter((m) => m.tone === 'error')
  const others = messages.filter((m) => m.tone !== 'error')

  return (
    <FeedbackContext value={notify}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:top-20 md:bottom-auto">
        <div role="alert" className="flex w-full flex-col items-center gap-2">
          {errors.map((m) => (
            <Toast key={m.id} message={m} onDismiss={dismiss} />
          ))}
        </div>
        <div role="status" className="flex w-full flex-col items-center gap-2">
          {others.map((m) => (
            <Toast key={m.id} message={m} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </FeedbackContext>
  )
}

function Toast({ message, onDismiss }: { message: FeedbackMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(message.id), DISMISS_MS)
    return () => clearTimeout(timer)
  }, [message.id, onDismiss])

  return (
    <div
      data-testid="feedback-toast"
      data-tone={message.tone}
      className={cn(
        'flex w-full max-w-md items-start gap-3 rounded-lg border bg-popover px-4 py-3 text-sm shadow-lg',
        message.tone === 'error' && 'border-destructive',
        message.tone === 'success' && 'border-primary/60',
      )}
    >
      <p className="flex-1">{message.message}</p>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => onDismiss(message.id)}
        className="pointer-events-auto grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback() {
  return useContext(FeedbackContext)
}

