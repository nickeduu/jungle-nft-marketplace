import { useLocation } from '@tanstack/react-router'
import { Link2, Mail, Share2 } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@/shared/lib/utils'

const iconButton =
  'grid size-8 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/**
 * "Compartilhar este NFT" (Figma: LinkedIn, e-mail, X). The shared URL is the current one,
 * including the selected edition. Native share sheet when the browser supports the Web Share
 * API; "copy link" is always available as the fallback.
 */
export function ShareActions({ title }: { title: string }) {
  const location = useLocation()
  const labelId = useId()
  const url = `${window.location.origin}${location.href}`
  const [feedback, setFeedback] = useState<{ message: string; id: number } | null>(null)
  const canShare = typeof navigator.share === 'function'
  const notify = (message: string) => setFeedback((previous) => ({ message, id: (previous?.id ?? 0) + 1 }))

  async function share() {
    try {
      await navigator.share({ title, text: `${title} na Kurio`, url })
    } catch (error) {
      // AbortError = the user closed the share sheet: not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) notify('Não foi possível compartilhar. Use "Copiar link".')
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      notify('Link copiado.')
    } catch {
      notify('Não foi possível copiar. Copie o endereço na barra do navegador.')
    }
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="share-actions">
      <span id={labelId} className="text-sm font-semibold">
        Compartilhar este NFT:
      </span>
      <ul aria-labelledby={labelId} className="flex items-center gap-2">
        {canShare && (
          <li>
            <button type="button" className={iconButton} aria-label="Compartilhar…" title="Compartilhar" onClick={() => void share()}>
              <Share2 className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        )}
        <li>
          <button type="button" className={iconButton} aria-label="Copiar link" title="Copiar link" onClick={() => void copy()}>
            <Link2 className="size-3.5" aria-hidden="true" />
          </button>
        </li>
        <li>
          <a
            className={cn(iconButton, 'text-[11px] font-bold')}
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn"
          >
            {/* Text alternative as content (not aria-label), so the visible glyph is part of the name. */}
            <span aria-hidden="true">in</span>
            <span className="sr-only">LinkedIn (abre em nova aba)</span>
          </a>
        </li>
        <li>
          <a className={iconButton} href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`} aria-label="E-mail" title="E-mail">
            <Mail className="size-3.5" aria-hidden="true" />
          </a>
        </li>
        <li>
          <a
            className={cn(iconButton, 'text-xs font-bold')}
            href={`https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
            title="X"
          >
            <span aria-hidden="true">X</span>
            <span className="sr-only">X (abre em nova aba)</span>
          </a>
        </li>
      </ul>
      <p role="status" className="w-full text-xs text-primary empty:hidden" data-testid="share-feedback">
        {feedback && <span key={feedback.id}>{feedback.message}</span>}
      </p>
    </div>
  )
}
