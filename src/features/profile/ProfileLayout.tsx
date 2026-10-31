import { Link, useNavigate } from '@tanstack/react-router'
import { Heart, LogOut, User, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLogout } from '@/features/auth/hooks'
import { cn } from '@/shared/lib/utils'

const itemClass =
  'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring md:rounded-none md:border-l-2 md:border-transparent md:px-4'

/**
 * Account area (Figma desktop-08: "Meu perfil" side menu): profile, wallets and favorites;
 * activity, offers, downloads and support are out of
 * scope (README) and are not shown. Mobile: the menu becomes a horizontal row above the content.
 */
export function ProfileLayout({ active, children }: { active: 'profile' | 'wallets' | 'favorites'; children: ReactNode }) {
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-1 gap-6 py-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10 md:py-10">
      {/* min-w-0: a grid item defaults to its content width; the scrollable row would widen the page. */}
      <nav aria-label="Meu perfil" className="min-w-0 md:self-start md:rounded-lg md:bg-card md:py-3">
        <p className="hidden px-4 pb-2 text-sm font-semibold md:block">Meu perfil</p>
        <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-0 md:pb-0">
          <li>
            <Link
              to="/profile"
              aria-current={active === 'profile' ? 'page' : undefined}
              className={cn(itemClass, 'hover:text-primary aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary md:aria-[current=page]:border-primary')}
            >
              <User className="size-3.5" aria-hidden="true" />
              Dados do perfil
            </Link>
          </li>
          <li>
            <Link
              to="/wallets"
              aria-current={active === 'wallets' ? 'page' : undefined}
              className={cn(itemClass, 'hover:text-primary aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary md:aria-[current=page]:border-primary')}
            >
              <Wallet className="size-3.5" aria-hidden="true" />
              Carteiras
            </Link>
          </li>
          <li>
            <Link
              to="/favorites"
              aria-current={active === 'favorites' ? 'page' : undefined}
              className={cn(itemClass, 'hover:text-primary aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary md:aria-[current=page]:border-primary')}
            >
              <Heart className="size-3.5" aria-hidden="true" />
              Lista de interesse
            </Link>
          </li>
          <li className="md:mt-2 md:border-t md:pt-2">
            <button
              type="button"
              aria-disabled={logout.isPending || undefined}
              onClick={() => {
                if (!logout.isPending) logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })
              }}
              className={cn(itemClass, 'w-full text-primary hover:bg-accent')}
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              {logout.isPending ? 'Saindo…' : 'Sair'}
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
