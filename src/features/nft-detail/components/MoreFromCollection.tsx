import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/NftCard'
import { RELATED_PAGE_SIZE, relatedNftsQuery } from '../api'

const itemClass = 'w-40 shrink-0 snap-start sm:w-44 md:w-48'

/**
 * "Mais desta coleção" (Figma desktop-02): horizontal carousel of catalog cards from the same
 * collection, excluding the current NFT. Swipe/scroll on touch; previous/next buttons on desktop.
 */
export function MoreFromCollection({ nftId, collection }: { nftId: string; collection: string }) {
  const related = useQuery(relatedNftsQuery(collection))
  const listRef = useRef<HTMLUListElement>(null)
  const headingId = useId()
  const listId = useId()
  const items = (related.data?.items ?? []).filter((item) => item.id !== nftId).slice(0, RELATED_PAGE_SIZE - 1)

  const scroll = (direction: 1 | -1) => {
    const list = listRef.current
    if (!list) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <section aria-labelledby={headingId} className="mt-12" data-testid="more-from-collection">
      <div className="flex items-center justify-between gap-4 border-b pb-2">
        <h2 id={headingId} className="text-sm font-semibold text-primary">
          Mais desta coleção
        </h2>
        {items.length > 1 && (
          <div className="hidden gap-2 md:flex">
            <Button variant="outline" size="icon-sm" aria-controls={listId} aria-label="Ver anteriores" onClick={() => scroll(-1)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon-sm" aria-controls={listId} aria-label="Ver próximos" onClick={() => scroll(1)}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {related.isPending ? (
        <ul className="mt-4 flex gap-4 overflow-hidden" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <NftCardSkeleton key={i} className={itemClass} />
          ))}
        </ul>
      ) : related.isError ? (
        <div role="alert" className="mt-4 text-sm">
          <p>Não foi possível carregar outros NFTs desta coleção.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void related.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Não há outros NFTs desta coleção no momento.</p>
      ) : (
        <ul
          id={listId}
          ref={listRef}
          className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]"
          data-testid="related-list"
        >
          {items.map((item) => (
            <NftCard key={item.id} nft={item} className={itemClass} />
          ))}
        </ul>
      )}
    </section>
  )
}
