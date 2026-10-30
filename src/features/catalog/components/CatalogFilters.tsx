import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import type { NftFacets } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { facetsQuery } from '../api'
import type { CatalogPatch } from '../CatalogPage'
import type { CatalogSearch } from '../search-params'

interface CatalogFiltersProps {
  search: CatalogSearch
  onChange: (patch: CatalogPatch) => void
  onClear: () => void
}

/** Sidebar filters (Figma: Coleções, Faixa de preço, Rede). Every filter combines with the others. */
export function CatalogFilters({ search, onChange, onClear }: CatalogFiltersProps) {
  const facets = useQuery(facetsQuery())

  if (facets.isPending) return <FiltersSkeleton />
  if (facets.isError) {
    return (
      <div role="alert" className="text-sm">
        <p className="text-muted-foreground">Não foi possível carregar os filtros.</p>
        <Button variant="link" className="h-auto px-0 text-primary" onClick={() => void facets.refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  const toggle = <T extends string>(list: T[] | undefined, id: T) => {
    const next = new Set(list)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return [...next].sort()
  }

  return (
    <div className="space-y-6">
      <FacetGroup
        title="Coleções"
        items={facets.data.categories}
        selected={search.category ?? []}
        onToggle={(id) => onChange({ category: toggle(search.category, id) })}
      />

      {/* Remount when the URL bounds change so the slider reflects back/forward navigation. */}
      <PriceRange key={`${search.min ?? ''}-${search.max ?? ''}`} search={search} range={facets.data.priceRange} onChange={onChange} />

      <FacetGroup
        title="Rede"
        items={facets.data.networks}
        selected={search.network ?? []}
        onToggle={(id) => onChange({ network: toggle(search.network, id) })}
      />

      <AvailableToggle checked={search.available === true} onChange={(available) => onChange({ available: available || undefined })} />

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={onClear}>
        Limpar filtros
      </Button>
    </div>
  )
}

function FacetGroup<T extends string>({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string
  items: Array<{ id: T; label: string; count: number }>
  selected: string[]
  onToggle: (id: T) => void
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = selected.includes(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {/* Selection is not conveyed by color alone. */}
                <Check className={cn('size-3.5 shrink-0', !active && 'invisible')} aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                <span aria-label={`${item.count} itens`}>({item.count})</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const toNumber = (eth: string) => Number(eth)
/** Slider positions are display numbers; the applied filter is a 2-decimal ETH string. */
const toEth = (value: number) => value.toFixed(2).replace(/\.?0+$/, '')
const formatBr = (value: number) => value.toFixed(2).replace('.', ',')

function PriceRange({
  search,
  range,
  onChange,
}: {
  search: CatalogSearch
  range: NftFacets['priceRange']
  onChange: (patch: CatalogPatch) => void
}) {
  // Epsilon guards float artefacts (12.3 * 100 = 1230.0000000000002).
  const floor = Math.floor(toNumber(range.minEth) * 100 + 1e-9) / 100
  const ceil = Math.ceil(toNumber(range.maxEth) * 100 - 1e-9) / 100
  const [values, setValues] = useState<[number, number]>([
    search.min ? Math.max(floor, toNumber(search.min)) : floor,
    search.max ? Math.min(ceil, toNumber(search.max)) : ceil,
  ])
  const labelId = useId()

  function apply() {
    const [min, max] = values
    onChange({
      min: min > floor ? toEth(min) : undefined,
      max: max < ceil ? toEth(max) : undefined,
    })
  }

  return (
    <section aria-labelledby={labelId}>
      <h2 id={labelId} className="mb-3 text-sm font-semibold">
        Faixa de preço
      </h2>
      <Slider
        min={floor}
        max={ceil}
        step={0.01}
        minStepsBetweenThumbs={0}
        value={values}
        onValueChange={(next) => setValues([next[0] ?? floor, next[1] ?? ceil])}
        thumbLabels={['Preço mínimo', 'Preço máximo']}
      />
      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite" data-testid="price-range-label">
        Preço: {formatBr(values[0])} - {formatBr(values[1])} ETH
      </p>
      <Button type="button" size="sm" className="mt-2 h-7 px-3 text-xs" onClick={apply}>
        Aplicar
      </Button>
    </section>
  )
}

function AvailableToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <Label htmlFor={id} className="text-xs font-normal">
        Somente disponíveis
      </Label>
    </div>
  )
}

function FiltersSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-5 w-24" />
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
      <Skeleton className="mt-4 h-5 w-28" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}
