import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/shared/lib/eth'
import { highlightsQuery } from '../api'

/**
 * Sidebar "NFT em destaque" card (Figma desktop-01-inicio). Uses the last highlight so it
 * differs from the hero's default. Subtitle says "Edição limitada" (true for every NFT:
 * editions have a fixed supply) instead of the Figma's "Oferta limitada", which would
 * imply a commercial promotion the API does not have.
 */
export function FeaturedSidebarCard() {
  const highlights = useQuery(highlightsQuery())
  const nft = highlights.data?.at(-1)

  if (highlights.isPending) return <Skeleton className="h-72 w-full rounded-xl" />
  if (!nft) return null

  return (
    <section aria-labelledby="featured-title" className="relative rounded-xl bg-card p-3 text-center">
      <h2 id="featured-title" className="text-sm font-semibold text-primary uppercase">
        NFT em destaque
      </h2>
      <p className="text-xs font-semibold uppercase">Edição limitada</p>
      <img
        src={nft.imageUrl}
        alt=""
        width={240}
        height={240}
        loading="lazy"
        className="mt-3 aspect-square w-full rounded-lg bg-muted object-cover"
      />
      <p className="mt-2 truncate text-sm">
        <Link
          to="/nfts/$nftId"
          params={{ nftId: nft.id }}
          className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
        >
          {nft.name}
        </Link>
      </p>
      <p className="text-sm font-semibold text-primary">{formatEth(nft.fromPriceEth)}</p>
    </section>
  )
}
