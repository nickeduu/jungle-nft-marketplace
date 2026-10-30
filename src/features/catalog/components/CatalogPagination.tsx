import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/** Page numbers to show: first, last, current ±1, with gaps marked as null. */
function pageWindow(current: number, total: number): Array<number | null> {
  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const result: Array<number | null> = []
  pages.forEach((page, i) => {
    const previous = pages[i - 1]
    if (previous !== undefined && page - previous > 1) result.push(null)
    result.push(page)
  })
  return result
}

const itemClass =
  'inline-flex size-8 items-center justify-center rounded-sm border text-xs transition-colors hover:border-primary hover:text-primary'

/** Figma: small numbered squares, current filled in copper. Real links that only change `page`. */
export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const toPage = (n: number) => (n === 1 ? undefined : n)

  return (
    <nav aria-label="Paginação" className="mt-8 flex flex-wrap items-center justify-end gap-1.5">
      {page > 1 && (
        <Link from="/" to="/" search={(prev) => ({ ...prev, page: toPage(page - 1) })} className={itemClass} aria-label="Página anterior">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      )}
      {pageWindow(page, totalPages).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={n}
            from="/"
            to="/"
            search={(prev) => ({ ...prev, page: toPage(n) })}
            aria-label={`Página ${n}`}
            aria-current={n === page ? 'page' : undefined}
            className={cn(itemClass, n === page && 'border-primary bg-primary text-primary-foreground hover:text-primary-foreground')}
          >
            {n}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link from="/" to="/" search={(prev) => ({ ...prev, page: page + 1 })} className={itemClass} aria-label="Próxima página">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  )
}
