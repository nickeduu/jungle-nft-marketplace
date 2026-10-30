import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import type { NftSummary } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/eth'
import { cn } from '@/shared/lib/utils'

/** Catalog card (Figma: desktop-01-inicio / mobile-01-inicio). */
export function NftCard({ nft, priority = false, className }: { nft: NftSummary; priority?: boolean; className?: string }) {
  const soldOut = nft.totalAvailable === 0
  const rare = nft.tags.includes('rare')
  return (
    <li
      className={cn(
        'group relative rounded-xl bg-surface-raised p-2.5 transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-accent',
        className,
      )}
      data-testid="nft-card"
      data-nft-id={nft.id}
      data-category={nft.category}
      data-network={nft.network}
      data-price={nft.fromPriceEth}
      data-available={nft.totalAvailable}
    >
      <div className="relative">
        <img
          src={nft.imageUrl}
          alt=""
          width={400}
          height={400}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="aspect-square w-full rounded-lg bg-muted object-cover"
        />
        {rare && (
          <span className="absolute top-2 left-0 rounded-r-sm bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
            RARO
          </span>
        )}
        {soldOut && (
          <span className="absolute top-2 right-2 rounded-sm bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground">
            Esgotado
          </span>
        )}
      </div>
      <h3 className="mt-3 truncate px-0.5 text-sm">
        {/* Stretched link: the whole card is clickable with a single focusable element. */}
        <Link
          to="/nfts/$nftId"
          params={{ nftId: nft.id }}
          className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
        >
          {nft.name}
        </Link>
      </h3>
      <p className="px-0.5 pb-1 text-sm font-semibold text-primary" data-testid="nft-card-price">
        <span className="sr-only">A partir de </span>
        {formatEth(nft.fromPriceEth)}
      </p>
    </li>
  )
}

/** Same footprint as NftCard (image + two text lines) to avoid layout shift. */
export function NftCardSkeleton({ className }: { className?: string }) {
  return (
    <li className={cn('rounded-xl bg-surface-raised p-2.5', className)} aria-hidden="true">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-1 h-5 w-1/3" />
    </li>
  )
}
