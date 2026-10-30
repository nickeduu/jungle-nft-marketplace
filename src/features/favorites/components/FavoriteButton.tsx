import { useLocation, useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useSession } from '@/features/auth/session'
import { cn } from '@/shared/lib/utils'
import { useFavoriteIds, useToggleFavorite } from '../hooks'

/**
 * Favorite toggle (aria-pressed). `icon`: round heart (catalog cards, mobile detail header);
 * `labeled`: "♡ Favoritar" (desktop detail, Figma desktop-02).
 * Visitors are sent to the login and come back to this page afterwards. While the request is
 * in flight — or the user's list is still loading, so the current state is unknown — the button
 * stays focusable but ignores clicks (aria-disabled; aria-busy during the request).
 */
export function FavoriteButton({
  nftId,
  nftName,
  variant,
  className,
}: {
  nftId: string
  nftName: string
  variant: 'icon' | 'labeled'
  className?: string
}) {
  const { user, isPending: sessionPending } = useSession()
  const { ids, isLoading: listLoading } = useFavoriteIds()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const location = useLocation()

  const pressed = user !== null && ids.has(nftId)
  const busy = toggle.isPending || sessionPending || listLoading

  function onClick() {
    if (busy) return
    if (!user) {
      void navigate({ to: '/login', search: { redirect: location.href, reason: undefined } })
      return
    }
    toggle.mutate({ userId: user.id, nftId, nftName, favorite: !pressed })
  }

  const icon = <Heart className={cn('size-4', pressed && 'fill-primary text-primary')} aria-hidden="true" />

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-busy={toggle.isPending || undefined}
      aria-disabled={busy || undefined}
      title={user ? undefined : 'Entre para favoritar'}
      onClick={onClick}
      data-testid="favorite-button"
      className={cn(
        'outline-none focus-visible:ring-2 focus-visible:ring-ring aria-busy:cursor-progress',
        variant === 'icon'
          ? 'grid size-10 place-items-center rounded-full border border-border bg-card/90 text-primary transition-colors hover:border-primary'
          : 'inline-flex h-9 items-center gap-2 rounded-md border border-primary/70 px-4 text-xs transition-colors hover:bg-accent aria-pressed:bg-primary/10 aria-pressed:text-primary',
        className,
      )}
    >
      {icon}
      {variant === 'icon' ? (
        <span className="sr-only">Favoritar {nftName}</span>
      ) : (
        <>
          Favoritar<span className="sr-only"> {nftName}</span>
        </>
      )}
    </button>
  )
}
