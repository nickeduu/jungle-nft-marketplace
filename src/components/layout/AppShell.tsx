import { Link } from '@tanstack/react-router'
import { Heart, House, LogIn, Search, ShoppingCart, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useRealtimeStatus } from '@/services/realtime/RealtimeProvider'
import { cn } from '@/shared/lib/utils'
import { SiteFooter } from './SiteFooter'

const STATUS_LABEL = {
  connecting: 'Tempo real: conectando',
  connected: 'Tempo real: conectado',
  disconnected: 'Tempo real: desconectado',
} as const

/** Shown for actions of later stages / out-of-scope pages: visibly unavailable, never a fake success. */
const UNAVAILABLE = 'Indisponível nesta versão'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <DesktopHeader />
      <RealtimeIndicator />
      <main id="conteudo" className="mx-auto max-w-6xl px-4 pb-28 sm:px-6 md:pb-12">
        {children}
      </main>
      <SiteFooter />
      <MobileNav />
    </div>
  )
}

function RealtimeIndicator() {
  const status = useRealtimeStatus()
  return (
    <span className="sr-only" role="status" data-testid="realtime-status" data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  )
}

const navLinkBase = 'relative block py-5 text-sm text-foreground/90 hover:text-primary'
const navLinkActive = cn(
  navLinkBase,
  'data-[status=active]:text-primary data-[status=active]:after:absolute data-[status=active]:after:inset-x-0 data-[status=active]:after:bottom-0 data-[status=active]:after:h-0.5 data-[status=active]:after:bg-primary',
)

function DesktopHeader() {
  const status = useRealtimeStatus()
  return (
    <header className="hidden border-b md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6">
        <Link to="/" className="text-sm font-semibold tracking-[0.25em]" aria-label="Kurio — início">
          KURIO
        </Link>
        <nav aria-label="Principal">
          <ul className="flex items-center gap-8">
            <li>
              <Link to="/" className={navLinkActive} activeOptions={{ exact: true, includeSearch: false }}>
                Início
              </Link>
            </li>
            <li>
              <Link to="/" hash="catalogo" className={navLinkBase}>
                Mercado
              </Link>
            </li>
            <li>
              <span aria-disabled="true" title={UNAVAILABLE} className="text-sm text-muted-foreground">
                Criadores
              </span>
            </li>
            <li>
              <span aria-disabled="true" title={UNAVAILABLE} className="text-sm text-muted-foreground">
                Aprenda
              </span>
            </li>
          </ul>
        </nav>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            title={STATUS_LABEL[status]}
            className={cn('size-2 rounded-full', status === 'connected' ? 'bg-emerald-500' : 'bg-muted-foreground')}
          />
          <Link to="/" hash="catalogo" aria-label="Buscar NFTs" className="text-foreground hover:text-primary">
            <Search className="size-4" aria-hidden="true" />
          </Link>
          <span aria-disabled="true" title={`Carrinho — ${UNAVAILABLE}`} className="text-muted-foreground">
            <ShoppingCart className="size-4" aria-hidden="true" />
            <span className="sr-only">Carrinho (indisponível nesta versão)</span>
          </span>
          <span
            aria-disabled="true"
            title={UNAVAILABLE}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 px-2.5 py-1 text-xs text-primary/70"
          >
            <LogIn className="size-3.5" aria-hidden="true" />
            Entrar
          </span>
        </div>
      </div>
    </header>
  )
}

/** Figma mobile: icons only (labels stay available to assistive technology). */
function MobileNav() {
  const disabledItem = 'grid size-11 place-items-center text-muted-foreground/70'
  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t bg-card px-8 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="flex items-center justify-between">
        <li>
          <Link
            to="/"
            className="grid size-11 place-items-center text-foreground data-[status=active]:text-primary"
            activeOptions={{ exact: true, includeSearch: false }}
          >
            <House className="size-5" aria-hidden="true" />
            <span className="sr-only">Início</span>
          </Link>
        </li>
        <li aria-disabled="true" title={UNAVAILABLE} className={disabledItem}>
          <Heart className="size-5" aria-hidden="true" />
          <span className="sr-only">Favoritos (indisponível nesta versão)</span>
        </li>
        <li aria-disabled="true" title={UNAVAILABLE} className={disabledItem}>
          <ShoppingCart className="size-5" aria-hidden="true" />
          <span className="sr-only">Carrinho (indisponível nesta versão)</span>
        </li>
        <li aria-disabled="true" title={UNAVAILABLE} className={disabledItem}>
          <User className="size-5" aria-hidden="true" />
          <span className="sr-only">Perfil (indisponível nesta versão)</span>
        </li>
      </ul>
    </nav>
  )
}
