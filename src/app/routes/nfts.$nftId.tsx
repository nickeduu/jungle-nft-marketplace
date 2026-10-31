import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { nftDetailQuery } from '@/features/nft-detail/api'
import { NftDetailPage } from '@/features/nft-detail/NftDetailPage'
import { validateNftDetailSearch } from '@/features/nft-detail/search-params'

/** NFT detail. The selected edition lives in the URL (`?edition=`). */
export const Route = createFileRoute('/nfts/$nftId')({
  validateSearch: validateNftDetailSearch,
  // Mobile: the page has its own top bar and fixed purchase bar (Figma mobile-02), no bottom nav.
  staticData: { hideMobileNav: true },
  // Non-blocking prefetch, in parallel with the page chunk (see routes/index.tsx).
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(nftDetailQuery(params.nftId))
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { nftId } = Route.useParams()
  const { edition } = Route.useSearch()
  const navigate = Route.useNavigate()

  // Replace: switching editions should not stack history entries between the catalog and the NFT.
  const onEditionChange = useCallback(
    (editionId: string) => void navigate({ search: { edition: editionId }, replace: true, resetScroll: false }),
    [navigate],
  )

  // Keyed by NFT: navigating to another NFT ("Mais desta coleção") resets gallery and quantity.
  return <NftDetailPage key={nftId} nftId={nftId} editionId={edition} onEditionChange={onEditionChange} />
}
