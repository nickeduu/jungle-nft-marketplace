import { useQuery } from '@tanstack/react-query'
import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MockPanel } from '@/mocks/devtools/MockPanel'
import { ApiError } from '@/services/api/http'
import type { Nft, NftEdition } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/eth'
import { nftDetailQuery } from './api'
import { EditionPicker } from './components/EditionPicker'
import { MoreFromCollection } from './components/MoreFromCollection'
import { NftDetailTabs } from './components/NftDetailTabs'
import { NftGallery } from './components/NftGallery'
import { PurchasePanel } from './components/PurchasePanel'
import { RatingSummary } from './components/RatingSummary'
import { ShareActions } from './components/ShareActions'
import { resolveEdition } from './search-params'
import { UNAVAILABLE_MESSAGES, type UnavailableAction } from './unavailable-actions'

interface NftDetailPageProps {
  nftId: string
  /** `?edition=` from the URL (may be missing or unknown). */
  editionId: string | undefined
  onEditionChange: (editionId: string) => void
}

/** NFT detail (Figma: desktop-02-detalhe-nft / mobile-02-detalhe-nft). */
export function NftDetailPage({ nftId, editionId, onEditionChange }: NftDetailPageProps) {
  const query = useQuery(nftDetailQuery(nftId))

  return (
    <section className="pt-4 md:pt-6" aria-busy={query.isPending}>
      {query.isPending ? (
        <NftDetailSkeleton />
      ) : query.isError ? (
        <NftDetailError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <NftDetailContent
          nft={query.data}
          isRefreshing={query.isFetching}
          editionId={editionId}
          onEditionChange={onEditionChange}
        />
      )}
    </section>
  )
}

/** Same footprint as the loaded page (gallery + info column) to avoid layout shift. */
function NftDetailSkeleton() {
  return (
    <div data-testid="nft-detail-skeleton">
      <Skeleton className="mb-4 hidden h-4 w-40 md:block" />
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="flex flex-col-reverse gap-3 md:flex-row md:gap-4">
          <div className="flex gap-2 md:w-20 md:flex-col">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="size-16 shrink-0 rounded-lg md:size-[4.5rem]" />
            ))}
          </div>
          <Skeleton className="aspect-square w-full flex-1 rounded-2xl" />
        </div>
        <div className="space-y-4 rounded-3xl bg-card p-5 md:rounded-none md:bg-transparent md:p-0">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      {/* Tabs and "Mais desta coleção": reserve their height so the footer does not jump in. */}
      <Skeleton className="mt-12 h-6 w-72" />
      <Skeleton className="mt-4 h-56 w-full" />
      <Skeleton className="mt-12 h-6 w-48" />
      <div className="mt-4 flex gap-4 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="aspect-[4/5] w-40 shrink-0 rounded-xl sm:w-44 md:w-48" />
        ))}
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

function NftDetailContent({
  nft,
  isRefreshing,
  editionId,
  onEditionChange,
}: {
  nft: Nft
  isRefreshing: boolean
  editionId: string | undefined
  onEditionChange: (editionId: string) => void
}) {
  const announcement = useVersionAnnouncement(nft)
  const edition = resolveEdition(nft.editions, editionId)
  const aboutId = useId()

  // The URL is the single source of truth for the edition: a missing or unknown `?edition=`
  // is replaced by the resolved one, so later stock changes never switch editions silently.
  const resolvedId = edition?.id
  useEffect(() => {
    if (resolvedId && resolvedId !== editionId) onEditionChange(resolvedId)
  }, [resolvedId, editionId, onEditionChange])

  const [actionNotice, setActionNotice] = useState<{ message: string; id: number } | null>(null)
  const onUnavailable = useCallback(
    (action: UnavailableAction) =>
      setActionNotice((previous) => ({ message: UNAVAILABLE_MESSAGES[action], id: (previous?.id ?? 0) + 1 })),
    [],
  )

  return (
    <article
      data-testid="nft-detail"
      data-version={nft.version}
      // Mobile: room for the fixed purchase bar, so it never hides the end of the page.
      className="pb-[calc(14rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      <MobileTopBar onFavorite={() => onUnavailable('favorite')} />
      <Breadcrumb name={nft.name} />

      <div className="grid gap-5 md:mt-4 md:grid-cols-2 md:gap-10">
        <NftGallery name={nft.name} images={nft.images} />

        <div className="rounded-3xl bg-card p-5 md:rounded-none md:bg-transparent md:p-0">
          <div className="flex items-start justify-between gap-3 md:flex-col md:gap-1.5">
            <h1 className="text-xl font-semibold md:text-2xl">{nft.name}</h1>
            <div className="flex shrink-0 items-center gap-4 md:w-full md:border-b md:pb-2">
              {edition && (
                <p className="hidden text-lg font-semibold text-primary md:block" data-testid="selected-edition-price">
                  {formatEth(edition.priceEth)}
                </p>
              )}
              <RatingSummary rating={nft.rating} />
            </div>
          </div>

          <div className="mt-4 space-y-4 md:mt-5">
            <section aria-labelledby={aboutId}>
              <h2 id={aboutId} className="sr-only text-sm font-semibold md:not-sr-only">
                Sobre este NFT:
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground md:mt-1 md:text-sm">{nft.description}</p>
            </section>

            {edition && (
              <div>
                <EditionPicker editions={nft.editions} selectedId={edition.id} onSelect={onEditionChange} />
                <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground" data-testid="selected-edition-stock">
                  <span>{stockLabel(edition)}</span>
                  {isRefreshing && <span aria-hidden="true">Atualizando…</span>}
                </p>
              </div>
            )}
            <p role="status" className="text-xs text-primary empty:hidden" data-testid="realtime-announcement">
              {announcement}
            </p>

            {edition && (
              <PurchasePanel key={edition.id} edition={edition} actionNotice={actionNotice} onUnavailable={onUnavailable} />
            )}

            <dl className="space-y-1.5 text-xs text-muted-foreground md:text-sm">
              <DetailRow label="ID do token" value={nft.tokenId} />
              <DetailRow label="Coleção" value={nft.collection} />
              <DetailRow label="Criador" value={nft.creator.name} />
              <DetailRow label="Atributos" value={nft.attributes.map((attribute) => attribute.value).join(', ')} />
            </dl>

            <ShareActions title={nft.name} />
          </div>
        </div>
      </div>

      <NftDetailTabs nft={nft} />
      <MoreFromCollection nftId={nft.id} collection={nft.collection} />

      {import.meta.env.VITE_ENABLE_MOCKS === 'true' && edition && <MockPanel nftId={nft.id} edition={edition} />}
    </article>
  )
}

function stockLabel(edition: NftEdition) {
  if (edition.available === 0) return `Edição ${edition.name}: esgotada`
  if (edition.supply === null) return `Edição aberta: ${edition.available} disponíveis`
  return `Edição ${edition.name}: ${edition.available} de ${edition.supply} disponíveis`
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-1.5">
      <dt>{label}:</dt>
      <dd className="text-foreground/90">{value}</dd>
    </div>
  )
}

function Breadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="Trilha de navegação" className="hidden text-xs md:block">
      <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        <li>
          <Link to="/" className="hover:text-primary">
            Início
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link to="/" hash="catalogo" className="hover:text-primary">
            Mercado
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="text-foreground">
          {name}
        </li>
      </ol>
    </nav>
  )
}

/** Mobile header (Figma mobile-02): back and favorite. */
function MobileTopBar({ onFavorite }: { onFavorite: () => void }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const circle =
    'grid size-10 place-items-center rounded-full border border-border bg-card text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <div className="mb-3 flex items-center justify-between md:hidden">
      <button
        type="button"
        aria-label="Voltar"
        className={circle}
        onClick={() => (canGoBack ? router.history.back() : void router.navigate({ to: '/' }))}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Favoritar"
        aria-disabled="true"
        title={UNAVAILABLE_MESSAGES.favorite}
        className={`${circle} aria-disabled:opacity-70`}
        onClick={onFavorite}
      >
        <Heart className="size-5" aria-hidden="true" />
      </button>
    </div>
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
