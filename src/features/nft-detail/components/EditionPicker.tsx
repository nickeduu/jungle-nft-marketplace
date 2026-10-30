import type { NftEdition } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/eth'
import { cn } from '@/shared/lib/utils'

/**
 * Edition chips (Figma: "1/1 · 1/10 · 1/50 · ABERTA"). Native radios: arrow keys move the
 * selection and skip sold-out editions. Price and stock are part of each option's accessible
 * name (aria-label: a deterministic "1/50, 1.19 ETH, 3 disponíveis"); sold-out chips are struck through and disabled (not only dimmed).
 */
export function EditionPicker({
  editions,
  selectedId,
  onSelect,
}: {
  editions: NftEdition[]
  selectedId: string
  onSelect: (editionId: string) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Edição:</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {editions.map((edition) => {
          const soldOut = edition.available === 0
          const price = formatEth(edition.priceEth)
          const availability = soldOut ? 'Esgotado' : `${edition.available} disponíveis`
          return (
            <label
              key={edition.id}
              data-testid={`edition-${edition.id}`}
              data-selected={edition.id === selectedId || undefined}
              className={cn(
                'cursor-pointer rounded-full border border-border px-3 py-1 text-xs uppercase transition-colors hover:border-primary/70',
                'has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary',
                'has-focus-visible:ring-2 has-focus-visible:ring-ring',
                'has-disabled:cursor-not-allowed has-disabled:text-muted-foreground has-disabled:line-through has-disabled:hover:border-border',
              )}
              title={soldOut ? 'Edição esgotada' : undefined}
            >
              <input
                type="radio"
                name="edition"
                value={edition.id}
                checked={edition.id === selectedId}
                disabled={soldOut}
                onChange={() => onSelect(edition.id)}
                aria-label={`${edition.name}, ${price}, ${availability}`}
                className="sr-only"
              />
              {edition.name}
              {/* Per-edition data for the selected-state views and tests; announced via aria-label. */}
              <span hidden>
                <span data-testid="edition-price">{price}</span>
                <span data-testid="edition-availability">{availability}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
