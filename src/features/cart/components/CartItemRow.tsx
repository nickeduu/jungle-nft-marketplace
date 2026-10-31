import { Link } from '@tanstack/react-router'
import { AlertTriangle, Minus, Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { NftImage } from '@/features/nft-detail/components/NftImage'
import type { CartItem } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/eth'
import { cn } from '@/shared/lib/utils'
import { describeItem, useRemoveCartItem, useUpdateCartQuantity } from '../hooks'

/** Desktop columns (Figma desktop-03): NFT | Preço | Quantidade | Total | remove. */
export const CART_COLUMNS = 'md:grid-cols-[minmax(0,1fr)_7rem_8.5rem_7.5rem_2.5rem]'

/**
 * One cart line. Desktop: a table-like row; mobile (Figma mobile-03): a card with image, name,
 * edition, line total and the quantity stepper. Quantity changes and removal are optimistic.
 * Notices from the API (sold out, quantity reduced by stock, price changed) are announced.
 */
export function CartItemRow({ item, cartKey }: { item: CartItem; cartKey: readonly unknown[] }) {
  const update = useUpdateCartQuantity()
  const remove = useRemoveCartItem()
  const label = describeItem(item)
  const unavailable = item.status === 'unavailable'
  const canDecrease = !unavailable && item.quantity > 1
  const canIncrease = !unavailable && item.quantity < item.maxQuantity
  // The new value is on screen at once (optimistic) but not presented as saved until the API confirms.
  const saving = update.isPending || remove.isPending

  const setQuantity = (quantity: number) => update.mutate({ item, cartKey, quantity })

  return (
    <li
      data-testid="cart-item"
      data-item-id={item.id}
      data-status={item.status}
      aria-busy={saving || undefined}
      className="rounded-2xl bg-card p-3 md:rounded-lg md:px-4"
    >
      <div className={cn('grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:gap-x-4', CART_COLUMNS)}>
        <div className="contents md:flex md:min-w-0 md:items-center md:gap-3">
          <NftImage
            src={item.imageUrl}
            alt=""
            width={72}
            height={72}
            loading="lazy"
            decoding="async"
            className={cn('row-span-2 size-[4.5rem] rounded-xl bg-muted object-cover md:size-12 md:rounded-md', unavailable && 'opacity-50')}
          />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold md:truncate">
              <Link
                to="/nfts/$nftId"
                params={{ nftId: item.nftId }}
                search={{ edition: item.editionId }}
                className="hover:text-primary focus-visible:underline"
              >
                {item.name}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground md:truncate">
              Edição: {item.editionName}
              <span className="hidden md:inline"> · {item.collection}</span>
            </p>
            <p className="text-xs text-muted-foreground md:hidden">{item.collection}</p>
            <p className="hidden text-[11px] text-muted-foreground md:block">ID do token: {item.tokenId}</p>
          </div>
        </div>

        <p className="hidden text-sm text-primary md:block" data-testid="cart-item-price">
          <span className="sr-only">Preço unitário: </span>
          {formatEth(item.unitPriceEth)}
        </p>

        <div
          role="group"
          aria-label={`Quantidade de ${label}`}
          className="col-start-3 row-start-1 flex items-center gap-2 md:col-start-auto md:row-start-auto"
        >
          <StepButton label={`Diminuir quantidade de ${label}`} disabled={!canDecrease} onClick={() => setQuantity(item.quantity - 1)}>
            <Minus className="size-3.5" aria-hidden="true" />
          </StepButton>
          <output className="w-6 text-center text-sm font-semibold tabular-nums" data-testid="cart-item-quantity">
            {item.quantity}
          </output>
          <StepButton label={`Aumentar quantidade de ${label}`} disabled={!canIncrease} onClick={() => setQuantity(item.quantity + 1)}>
            <Plus className="size-3.5" aria-hidden="true" />
          </StepButton>
        </div>

        <p className="col-start-2 row-start-2 text-base font-semibold text-primary md:col-start-auto md:row-start-auto md:text-sm" data-testid="cart-item-total">
          <span className="sr-only">Total do item: </span>
          {formatEth(item.lineTotalEth)}
        </p>

        <button
          type="button"
          aria-label={`Remover ${label}`}
          aria-disabled={remove.isPending || undefined}
          onClick={() => {
            if (!remove.isPending) remove.mutate({ item, cartKey })
          }}
          className="col-start-3 row-start-2 grid size-9 place-items-center justify-self-end rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:col-start-auto md:row-start-auto"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-1 text-right text-[11px] text-muted-foreground empty:hidden" data-testid="cart-item-saving">
        {saving && 'Salvando…'}
      </p>

      {/* Always rendered, so screen readers announce notices that appear after a realtime update. */}
      <div role="status" className="empty:hidden" data-testid="cart-item-notices">
        {unavailable && <Notice>Esgotado: esta edição não está mais disponível. Remova o item para finalizar a compra.</Notice>}
        {!unavailable && item.quantityAdjustedFrom !== null && (
          <Notice>
            Quantidade ajustada de {item.quantityAdjustedFrom} para {item.quantity}: estoque reduzido.
          </Notice>
        )}
        {item.previousPriceEth !== null && (
          <Notice>
            Preço atualizado: era {formatEth(item.previousPriceEth)}, agora {formatEth(item.unitPriceEth)}.
          </Notice>
        )}
      </div>
    </li>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
      <AlertTriangle className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:cursor-not-allowed aria-disabled:opacity-40 md:size-7"
    >
      {children}
    </button>
  )
}
