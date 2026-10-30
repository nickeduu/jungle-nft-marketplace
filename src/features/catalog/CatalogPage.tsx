import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { SlidersHorizontal } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ApiError } from '@/services/api/http'
import type { NftSort, NftTab } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { nftListQuery } from './api'
import { CatalogFilters } from './components/CatalogFilters'
import { CatalogPagination } from './components/CatalogPagination'
import { FeaturedSidebarCard } from './components/FeaturedSidebarCard'
import { HomeHero } from './components/HomeHero'
import { NftCard, NftCardSkeleton } from './components/NftCard'
import { SearchBox } from './components/SearchBox'
import { CATALOG_PAGE_SIZE, DEFAULT_SORT, hasActiveFilters, toListParams, type CatalogSearch } from './search-params'

/** A change to URL state; `undefined` removes the key. */
export type CatalogPatch = Partial<CatalogSearch>

interface CatalogPageProps {
  search: CatalogSearch
  /** Applies a patch to the URL and resets pagination. */
  onChange: (patch: CatalogPatch, options?: { replace?: boolean }) => void
  onClear: () => void
}

const TABS: Array<{ id: NftTab | undefined; label: string }> = [
  { id: undefined, label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

const SORT_LABELS: Record<NftSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  'name-asc': 'Nome (A–Z)',
}

export function CatalogPage({ search, onChange, onClear }: CatalogPageProps) {
  const params = toListParams(search)
  const query = useQuery(nftListQuery(params))
  const sortId = useId()

  const filters = <CatalogFilters search={search} onChange={onChange} onClear={onClear} />

  return (
    <>
      {/* Mobile: search + filters button above the hero (Figma mobile-01-inicio). */}
      <div className="mt-4 flex gap-3 md:hidden">
        <SearchBox id="catalog-search-mobile" value={search.q ?? ''} onSearch={(q) => onChange({ q: q || undefined }, { replace: true })} />
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" className="size-11 shrink-0 rounded-xl" aria-label="Abrir filtros">
              <SlidersHorizontal className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto bg-card p-5">
            <SheetHeader className="p-0">
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>Os resultados atualizam a cada alteração.</SheetDescription>
            </SheetHeader>
            <SortSelect id={`${sortId}-mobile`} value={search.sort ?? DEFAULT_SORT} onChange={(sort) => onChange({ sort })} />
            {filters}
          </SheetContent>
        </Sheet>
      </div>

      <HomeHero />

      <section id="catalogo" aria-labelledby="catalog-title" className="mt-8 scroll-mt-4 md:mt-14">
        <h2 id="catalog-title" className="sr-only">
          Catálogo de NFTs
        </h2>
        <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="hidden space-y-4 self-start lg:block">
            <aside aria-label="Filtros" className="rounded-xl bg-card p-4">
              {filters}
            </aside>
            <FeaturedSidebarCard />
          </div>

          <div>
            <div className="mb-4 hidden md:block">
              <SearchBox id="catalog-search" value={search.q ?? ''} onSearch={(q) => onChange({ q: q || undefined }, { replace: true })} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
              <nav aria-label="Abas do catálogo">
                <ul className="flex gap-4 overflow-x-auto text-sm">
                  {TABS.map((tab) => {
                    const active = search.tab === tab.id
                    return (
                      <li key={tab.label}>
                        <Link
                          from="/"
                          to="/"
                          search={(prev) => ({ ...prev, tab: tab.id, page: undefined })}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'block border-b-2 pb-1 whitespace-nowrap',
                            active ? 'border-primary text-primary' : 'border-transparent hover:text-primary',
                          )}
                          activeOptions={{ includeSearch: false }}
                        >
                          {tab.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
              <div className="hidden items-center gap-2 md:flex">
                <SortSelect id={sortId} value={search.sort ?? DEFAULT_SORT} onChange={(sort) => onChange({ sort })} />
                <div className="lg:hidden">
                  <TabletFilters>{filters}</TabletFilters>
                </div>
              </div>
            </div>

            <ResultsSummary
              total={query.data?.totalItems}
              isFetching={query.isFetching}
              isPlaceholder={query.isPlaceholderData}
              isError={query.isError}
            />

            {query.isPending ? (
              <CardGrid busy>
                {Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => (
                  <NftCardSkeleton key={i} />
                ))}
              </CardGrid>
            ) : query.isError ? (
              <CatalogError error={query.error} onRetry={() => void query.refetch()} />
            ) : query.data.items.length === 0 ? (
              <EmptyState filtered={hasActiveFilters(search)} outOfRange={(search.page ?? 1) > query.data.totalPages} onClear={onClear} />
            ) : (
              <>
                <CardGrid busy={query.isPlaceholderData}>
                  {query.data.items.map((nft, i) => (
                    <NftCard key={nft.id} nft={nft} priority={i < 3} />
                  ))}
                </CardGrid>
                <CatalogPagination page={query.data.page} totalPages={query.data.totalPages} />
              </>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function SortSelect({ id, value, onChange }: { id: string; value: NftSort; onChange: (sort: NftSort | undefined) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="whitespace-nowrap text-muted-foreground">
        Ordenar por:
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const next = event.target.value as NftSort
          onChange(next === DEFAULT_SORT ? undefined : next)
        }}
        className="rounded-md border bg-background px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {(Object.keys(SORT_LABELS) as NftSort[]).map((sort) => (
          <option key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </option>
        ))}
      </select>
    </div>
  )
}

function TabletFilters({ children }: { children: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtros
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto bg-card p-5">
        <SheetHeader className="p-0">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Os resultados atualizam a cada alteração.</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}

function CardGrid({ children, busy }: { children: React.ReactNode; busy: boolean }) {
  return (
    <ul
      aria-busy={busy}
      data-testid="catalog-grid"
      className={cn(
        // Mobile: 2 columns staggered like the Figma mosaic.
        'mt-4 grid grid-cols-2 gap-3 max-md:[&>li:nth-child(even)]:mt-8 md:grid-cols-3 md:gap-5',
        busy && 'opacity-60 transition-opacity',
      )}
    >
      {children}
    </ul>
  )
}

function ResultsSummary({
  total,
  isFetching,
  isPlaceholder,
  isError,
}: {
  total: number | undefined
  isFetching: boolean
  isPlaceholder: boolean
  isError: boolean
}) {
  return (
    <p className="mt-3 min-h-5 text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="results-summary">
      {isError
        ? ''
        : total === undefined
        ? 'Carregando NFTs…'
        : `${total} ${total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}${isFetching && isPlaceholder ? ' — atualizando…' : ''}`}
    </p>
  )
}

function CatalogError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const invalid = error instanceof ApiError && error.code === 'VALIDATION_ERROR'
  return (
    <div role="alert" className="mt-6 rounded-xl bg-card p-8 text-center" data-testid="catalog-error">
      <h3 className="font-semibold">{invalid ? 'Filtros inválidos' : 'Não foi possível carregar os NFTs'}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button className="mt-4" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}

function EmptyState({ filtered, outOfRange, onClear }: { filtered: boolean; outOfRange: boolean; onClear: () => void }) {
  return (
    <div className="mt-6 rounded-xl bg-card p-8 text-center" data-testid="catalog-empty">
      <h3 className="font-semibold">{outOfRange ? 'Esta página não existe' : 'Nenhum NFT encontrado'}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {outOfRange
          ? 'A página solicitada está além dos resultados disponíveis.'
          : filtered
            ? 'Tente outros termos ou remova alguns filtros.'
            : 'Ainda não há NFTs disponíveis no catálogo.'}
      </p>
      {outOfRange ? (
        <Button asChild className="mt-4">
          <Link from="/" to="/" search={(prev) => ({ ...prev, page: undefined })}>
            Ir para a primeira página
          </Link>
        </Button>
      ) : (
        filtered && (
          <Button className="mt-4" onClick={onClear}>
            Limpar filtros
          </Button>
        )
      )}
    </div>
  )
}
