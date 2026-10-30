import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { cn } from '@/shared/lib/utils'

const UNAVAILABLE = 'Indisponível nesta versão'

/**
 * Login/registration card. Figma: desktop-06/07 (modal with "Entrar | Criar conta" tabs and
 * subtitle), mobile-05/06 (full card with the KURIO logo, social buttons and footer link).
 * Rendered as a page (direct URL, `redirect` and the back button work) instead of a modal.
 */
export function AuthCard({
  mode,
  redirect,
  title,
  children,
  footer,
}: {
  mode: 'login' | 'register'
  redirect: string | undefined
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex justify-center py-6 md:py-12">
      <section
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-3xl border bg-popover px-5 py-8 shadow-xl sm:px-8"
      >
        <p className="text-center text-2xl font-semibold tracking-[0.25em] md:hidden" aria-hidden="true">
          KURIO
        </p>
        <nav aria-label="Acesso à conta" className="mt-6 flex justify-center gap-1 text-sm md:mt-0">
          <AuthTab to="/login" active={mode === 'login'} redirect={redirect}>
            Entrar
          </AuthTab>
          <span aria-hidden="true" className="text-muted-foreground">
            |
          </span>
          <AuthTab to="/register" active={mode === 'register'} redirect={redirect}>
            Criar conta
          </AuthTab>
        </nav>
        <h1 id="auth-title" className="mt-6 text-center text-lg font-semibold">
          {title}
        </h1>
        <p className="mt-2 hidden text-center text-xs text-muted-foreground md:block">
          Entre para gerenciar sua carteira, coleção e perfil de colecionador.
        </p>
        <div className="mt-6">{children}</div>
        <SocialLogin />
        {footer && <p className="mt-6 text-center text-sm text-primary">{footer}</p>}
      </section>
    </div>
  )
}

function AuthTab({ to, active, redirect, children }: { to: '/login' | '/register'; active: boolean; redirect: string | undefined; children: ReactNode }) {
  return (
    <Link
      to={to}
      search={{ redirect, reason: undefined }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-sm px-2 py-1 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'text-primary underline underline-offset-4' : 'text-foreground/90',
      )}
    >
      {children}
    </Link>
  )
}

/** Figma "Ou continue com" — out of scope (no real identity providers): visibly unavailable. */
function SocialLogin() {
  const notify = useFeedback()
  const providers = ['Google', 'Facebook']
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        Ou continue com
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <ul className="mt-3 space-y-2">
        {providers.map((provider) => (
          <li key={provider}>
            <button
              type="button"
              aria-disabled="true"
              title={UNAVAILABLE}
              onClick={() => notify(`Login com ${provider} indisponível nesta versão.`, 'info')}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed"
            >
              Continuar com {provider}
              <span className="sr-only"> ({UNAVAILABLE})</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
