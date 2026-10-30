import { createFileRoute } from '@tanstack/react-router'
import { NftDetailPage } from '@/features/nft-detail/NftDetailPage'

export const Route = createFileRoute('/nfts/$nftId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { nftId } = Route.useParams()
  return <NftDetailPage nftId={nftId} />
}
