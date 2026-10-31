import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { NftImage } from '@/features/nft-detail/components/NftImage'
import { cn } from '@/shared/lib/utils'
import { highlightsQuery } from '../api'

/**
 * Home hero with highlighted NFTs (Figma: desktop-01-inicio / mobile-01-inicio).
 * Desktop: text left, artwork right. Mobile: everything inside a gradient card.
 */
export function HomeHero() {
  const highlights = useQuery(highlightsQuery())
  const [index, setIndex] = useState(0)
  const items = highlights.data ?? []
  const current = items[Math.min(index, Math.max(items.length - 1, 0))]

  return (
    <section
      aria-labelledby="hero-title"
      className="relative mt-4 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#5a3d22,#2a1c12_70%)] p-5 md:mt-10 md:rounded-none md:bg-none md:p-0"
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 md:grid-cols-[1fr_minmax(0,28rem)] md:gap-10">
        <div>
          <p className="text-xs md:text-sm">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="mt-2 text-lg leading-snug font-semibold tracking-wide uppercase md:mt-4 md:text-4xl md:leading-tight">
            {/* Figma uses a shorter headline on mobile; only one variant is rendered/announced. */}
            <span className="md:hidden">Seja dono da cultura digital</span>
            <span className="hidden md:inline">
              Seja dono do futuro
              <br />
              da arte digital
            </span>
          </h1>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground md:mt-4 md:text-sm">
            <span className="md:hidden">Descubra NFTs selecionados de criadores do mundo todo.</span>
            <span className="hidden md:inline">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara,
              apoie artistas e tenha uma parte da cultura da internet.
            </span>
          </p>
          <a
            href="#catalogo"
            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase md:mt-6 md:rounded-sm md:bg-primary md:px-4 md:py-2 md:text-primary-foreground"
          >
            Explorar
            <ArrowRight className="size-3.5 md:hidden" aria-hidden="true" />
          </a>
        </div>

        <div className="w-32 md:w-full">
          {highlights.isPending ? (
            <Skeleton className="aspect-square w-full rounded-2xl" />
          ) : current ? (
            <Link
              to="/nfts/$nftId"
              params={{ nftId: current.id }}
              className="group relative block overflow-hidden rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <NftImage
                src={current.imageUrl}
                alt={`Destaque: ${current.name}`}
                width={480}
                height={480}
                sizes="(min-width: 768px) 448px, 128px"
                fetchPriority="high"
                className="aspect-square w-full bg-muted object-cover"
              />
            </Link>
          ) : (
            // No highlights (error or empty): keep the footprint, show nothing interactive.
            <div className="aspect-square w-full rounded-2xl bg-muted" aria-hidden="true" />
          )}
        </div>
      </div>

      {items.length > 1 && (
        <div className="mt-3 flex justify-center md:mt-5" role="group" aria-label="Destaques">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Destaque ${i + 1} de ${items.length}: ${item.name}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className="grid size-6 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className={cn('size-2 rounded-full transition-colors', i === index ? 'bg-primary' : 'bg-primary/35')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
