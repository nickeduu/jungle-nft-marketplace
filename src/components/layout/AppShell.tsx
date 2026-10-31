import { Link, useLocation, useRouterState } from '@tanstack/react-router'
import { Heart, House, LogIn, Search, ShoppingCart, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSession } from '@/features/auth/session'
import { useCartCount } from '@/features/cart/hooks'
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
  // Routes with their own mobile bottom bar (NFT detail) opt out of the bottom navigation.
  const hideMobileNav = useRouterState({ select: (state) => state.matches.some((match) => match.staticData.hideMobileNav) })
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
      <main id="conteudo" className={cn('mx-auto max-w-6xl px-4 pb-28 sm:px-6 md:pb-12', hideMobileNav && 'pb-12')}>
        {children}
      </main>
      <SiteFooter />
      {!hideMobileNav && <MobileNav />}
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
          <CartLink iconClassName="size-4" className="relative text-foreground hover:text-primary data-[status=active]:text-primary" />
          <AccountControls />
        </div>
      </div>
    </header>
  )
}

/**
 * Visitor: "Entrar" (returns to the current page after login). Signed in: favorites and profile.
 * While a stored token is being validated, a placeholder keeps the layout (no "Entrar" flash).
 */
function AccountControls() {
  const { user, isPending } = useSession()
  const location = useLocation()
  if (isPending) return <span aria-hidden="true" className="h-7 w-20 rounded-md bg-muted" />
  if (!user) {
    const onAuthPage = location.pathname === '/login' || location.pathname === '/register'
    return (
      <Link
        to="/login"
        search={{ redirect: onAuthPage ? undefined : location.href, reason: undefined }}
        className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
      >
        <LogIn className="size-3.5" aria-hidden="true" />
        Entrar
      </Link>
    )
  }
  return (
    <>
      <Link to="/favorites" aria-label="Lista de interesse" className="text-foreground hover:text-primary data-[status=active]:text-primary">
        <Heart className="size-4" aria-hidden="true" />
      </Link>
      <Link
        to="/profile"
        className="inline-flex max-w-40 items-center gap-1.5 rounded-md border border-primary/60 px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
        data-testid="account-link"
      >
        <User className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{user.name.split(' ')[0]}</span>
        <span className="sr-only"> — meu perfil</span>
      </Link>
    </>
  )
}

/**
 * Cart icon with the number of units (Figma: badge on the cart). The count comes from the cart
 * query of the current owner (user or visitor), so it follows adds/changes/removals and refresh.
 */
function CartLink({ className, iconClassName }: { className: string; iconClassName: string }) {
  const count = useCartCount()
  return (
    <Link to="/cart" className={className} data-testid="cart-link">
      <ShoppingCart className={iconClassName} aria-hidden="true" />
      <span className="sr-only">Carrinho{count > 0 ? `, ${count} ${count === 1 ? 'item' : 'itens'}` : ''}</span>
      {count > 0 && (
        <span
          aria-hidden="true"
          data-testid="cart-count-badge"
          className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

/** Figma mobile: icons only (labels stay available to assistive technology). */
function MobileNav() {
  const activeItem = 'grid size-11 place-items-center text-foreground data-[status=active]:text-primary'
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
        <li>
          <Link to="/favorites" className={activeItem}>
            <Heart className="size-5" aria-hidden="true" />
            <span className="sr-only">Lista de interesse</span>
          </Link>
        </li>
        <li>
          <CartLink iconClassName="size-5" className={cn(activeItem, 'relative')} />
        </li>
        <li>
          {/* Private route: visitors are redirected to the login and come back here. */}
          <Link to="/profile" className={activeItem}>
            <User className="size-5" aria-hidden="true" />
            <span className="sr-only">Perfil</span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}
