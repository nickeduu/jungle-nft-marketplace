import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MockPanel } from '@/mocks/devtools/MockPanel'
import { ApiError } from '@/services/api/http'
import type { Nft } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/eth'
import { nftDetailQuery } from './api'

export function NftDetailPage({ nftId }: { nftId: string }) {
  const query = useQuery(nftDetailQuery(nftId))

  return (
    <section className="py-8" aria-busy={query.isPending}>
      {query.isPending ? (
        <NftDetailSkeleton />
      ) : query.isError ? (
        <NftDetailError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <NftDetailContent nft={query.data} isRefreshing={query.isFetching} />
      )}
      {import.meta.env.VITE_ENABLE_MOCKS === 'true' && query.data && <MockPanel nft={query.data} />}
    </section>
  )
}

function NftDetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2" data-testid="nft-detail-skeleton">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}

function NftDetailError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const notFound = error instanceof ApiError && error.code === 'NOT_FOUND'
  return (
    <div role="alert" className="py-16 text-center">
      <h1 className="text-2xl font-semibold">{notFound ? 'NFT não encontrado' : 'Não foi possível carregar o NFT'}</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
      <div className="mt-6 flex justify-center gap-3">
        {!notFound && <Button onClick={onRetry}>Tentar novamente</Button>}
        <Button asChild variant="outline">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  )
}

function NftDetailContent({ nft, isRefreshing }: { nft: Nft; isRefreshing: boolean }) {
  const announcement = useVersionAnnouncement(nft)

  return (
    <article className="grid gap-8 md:grid-cols-2" data-testid="nft-detail" data-version={nft.version}>
      <img
        src={nft.images[0]}
        alt={`Arte do NFT ${nft.name}`}
        width={600}
        height={600}
        className="aspect-square w-full rounded-xl bg-muted object-cover"
      />
      <div>
        <p className="text-sm text-muted-foreground">{nft.collection}</p>
        <h1 className="text-3xl font-semibold">{nft.name}</h1>
        <p className="mt-1 text-sm">por {nft.creator.name}</p>
        <p className="mt-4 text-muted-foreground">{nft.description}</p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Edições
              {isRefreshing && <span className="text-xs font-normal text-muted-foreground">Atualizando…</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {nft.editions.map((edition) => (
                <li key={edition.id} className="flex items-center justify-between py-2" data-testid={`edition-${edition.id}`}>
                  <span>{edition.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium" data-testid="edition-price">
                      {formatEth(edition.priceEth)}
                    </span>
                    {edition.available > 0 ? (
                      <Badge variant="secondary" data-testid="edition-availability">
                        {edition.available} disponíveis
                      </Badge>
                    ) : (
                      <Badge variant="destructive" data-testid="edition-availability">
                        Esgotado
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <p className="mt-2 text-xs text-muted-foreground">Versão {nft.version}</p>
        <p role="status" aria-live="polite" className="mt-2 text-sm" data-testid="realtime-announcement">
          {announcement}
        </p>
      </div>
    </article>
  )
}

/** Announces (aria-live) when the NFT version increases while the page is open. */
function useVersionAnnouncement(nft: Nft) {
  const initialVersion = useRef(nft.version)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (nft.version > initialVersion.current) {
      setMessage('Preço ou disponibilidade atualizados em tempo real.')
    }
  }, [nft.version])
  return message
}
