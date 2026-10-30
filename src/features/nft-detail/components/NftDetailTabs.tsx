import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NETWORK_LABELS, type Nft } from '@/shared/contracts'
import { nftReviewsQuery } from '../api'
import { Stars } from './RatingSummary'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' })

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** "Detalhes do NFT" / "Avaliações de colecionadores (n)" (Figma desktop-02). */
export function NftDetailTabs({ nft }: { nft: Nft }) {
  return (
    <Tabs defaultValue="details" className="mt-12">
      <TabsList aria-label="Informações do NFT">
        <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
        <TabsTrigger value="reviews">Avaliações de colecionadores ({nft.rating.count})</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="space-y-4 text-xs leading-relaxed text-muted-foreground md:text-sm">
        {nft.longDescription.split('\n\n').map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <dl className="space-y-3">
          <div>
            <dt className="font-semibold text-foreground">Rede:</dt>
            <dd>{NETWORK_LABELS[nft.network]}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Contrato:</dt>
            <dd>
              <span title={nft.contract.address}>{shortAddress(nft.contract.address)}</span>
              <span className="sr-only"> (endereço completo: {nft.contract.address})</span> · Contrato inteligente{' '}
              {nft.contract.standard}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Direitos autorais:</dt>
            <dd>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias.</dd>
          </div>
        </dl>
      </TabsContent>
      {/* Radix mounts only the active panel: reviews are fetched when the tab is opened. */}
      <TabsContent value="reviews">
        <ReviewList nftId={nft.id} />
      </TabsContent>
    </Tabs>
  )
}

function ReviewList({ nftId }: { nftId: string }) {
  const reviews = useQuery(nftReviewsQuery(nftId))

  if (reviews.isPending) {
    return (
      <ul className="space-y-3" aria-busy="true" aria-label="Carregando avaliações" data-testid="reviews-skeleton">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-lg bg-card p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-4 w-full" />
          </li>
        ))}
      </ul>
    )
  }
  if (reviews.isError) {
    return (
      <div role="alert" className="text-sm">
        <p>Não foi possível carregar as avaliações.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void reviews.refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }
  if (reviews.data.length === 0) {
    return <p className="text-sm text-muted-foreground">Este NFT ainda não tem avaliações.</p>
  }
  return (
    <ul className="space-y-3" data-testid="review-list">
      {reviews.data.map((review) => (
        <li key={review.id} className="rounded-lg bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold">{review.author}</span>
            <Stars value={review.rating} />
            <span className="sr-only">Nota {review.rating} de 5.</span>
            <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
              {dateFormat.format(new Date(review.createdAt))}
            </time>
          </div>
          <p className="mt-1.5 text-muted-foreground">{review.comment}</p>
        </li>
      ))}
    </ul>
  )
}
