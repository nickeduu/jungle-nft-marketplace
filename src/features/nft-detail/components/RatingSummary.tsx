import { Star } from 'lucide-react'
import type { NftRating } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'

function formatRating(average: number) {
  return average.toFixed(1)
}

/** Five stars, filled up to the rounded rating. Decorative: callers provide the text alternative. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value)
  return (
    <span className={cn('inline-flex gap-0.5', className)} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-3.5', i < filled ? 'fill-primary text-primary' : 'text-muted-foreground')} />
      ))}
    </span>
  )
}

/**
 * Rating aggregate. Desktop (Figma desktop-02): stars + "19 avaliações de colecionadores".
 * Mobile (mobile-02): bordered badge "★ 4.8 (19)". One accessible sentence for both.
 */
export function RatingSummary({ rating }: { rating: NftRating }) {
  if (rating.count === 0) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="rating-summary">
        Sem avaliações
      </p>
    )
  }
  const average = formatRating(rating.average)
  return (
    <p className="text-xs" data-testid="rating-summary">
      <span className="sr-only">
        Avaliação média {average} de 5, {rating.count} avaliações de colecionadores
      </span>
      <span aria-hidden="true" className="hidden items-center gap-1.5 md:inline-flex">
        <Stars value={rating.average} />
        {rating.count} avaliações de colecionadores
      </span>
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-1 rounded-full border border-primary/70 px-2 py-0.5 font-semibold md:hidden"
      >
        <Star className="size-3.5 fill-primary text-primary" />
        {average}
        <span className="font-normal text-muted-foreground">({rating.count})</span>
      </span>
    </p>
  )
}
