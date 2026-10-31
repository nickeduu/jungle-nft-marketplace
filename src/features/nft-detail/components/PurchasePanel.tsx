import { Link } from '@tanstack/react-router'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useAddToCart, useCartCount } from '@/features/cart/hooks'
import { FavoriteButton } from '@/features/favorites/components/FavoriteButton'
import { ApiError } from '@/services/api/http'
import type { NftEdition } from '@/shared/contracts'
import { formatEth, multiplyEth } from '@/shared/lib/eth'
import { cn } from '@/shared/lib/utils'
import { purchaseLimit } from '../search-params'

/** aria-disabled (not `disabled`) keeps the control focusable, so keyboard focus is not lost at the limit. */
const unavailableClass = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-60'

/**
 * Quantity, total and purchase actions of the selected edition.
 * Desktop (Figma desktop-02): inline under the editions. Mobile (mobile-02): fixed bottom bar
 * with quantity, total, "Comprar NFT" and cart. One DOM for both layouts.
 * "Comprar" adds the edition × quantity to the cart (visitor or account): the API validates stock
 * and the per-order limit (including what is already in the cart); the result is announced.
 *
 * Mount with `key={edition.id}`: switching editions starts again from quantity 1.
 * Stock changes arrive through the Query cache (Socket.IO `nft.updated`); when the limit drops
 * below the chosen quantity, the quantity is adjusted and the change announced.
 */
export function PurchasePanel({ nftId, nftName, edition }: { nftId: string; nftName: string; edition: NftEdition }) {
  const limit = purchaseLimit(edition)
  const [requested, setRequested] = useState(1)
  const [stockNotice, setStockNotice] = useState('')

  // Adjusting state while rendering (instead of an effect) avoids rendering an invalid quantity.
  const [previousLimit, setPreviousLimit] = useState(limit)
  if (limit !== previousLimit) {
    setPreviousLimit(limit)
    if (limit === 0) {
      setStockNotice('Esta edição esgotou.')
    } else if (requested > limit) {
      setRequested(limit)
      setStockNotice(`Estoque reduzido: quantidade ajustada para ${limit}.`)
    }
  }

  const soldOut = limit === 0
  const quantity = soldOut ? 0 : Math.min(Math.max(requested, 1), limit)
  const addToCart = useAddToCart()
  const cartCount = useCartCount()
  const [result, setResult] = useState<{ ok: boolean; message: string; id: number } | null>(null)
  const report = (ok: boolean, message: string) => setResult((previous) => ({ ok, message, id: (previous?.id ?? 0) + 1 }))

  function buy() {
    // Repeated clicks while the request is in flight are ignored (no duplicate adds).
    if (soldOut || addToCart.isPending) return
    addToCart.mutate(
      { nftId, editionId: edition.id, quantity },
      {
        onSuccess: () => report(true, `${quantity} × ${nftName} (edição ${edition.name}) adicionado ao carrinho.`),
        onError: (error) =>
          report(
            false,
            error instanceof ApiError && error.status !== null && error.status < 500
              ? error.message
              : 'Não foi possível adicionar ao carrinho. Tente novamente.',
          ),
      },
    )
  }

  return (
    <section
      aria-label="Compra"
      data-testid="purchase-panel"
      className={cn(
        // m-0: the parent `space-y-*` margin would lift the fixed bar off the screen edge (md:my-4 restores the in-flow spacing).
        'fixed inset-x-0 bottom-0 z-40 m-0 rounded-t-3xl border-t bg-card px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.35)]',
        'md:static md:z-auto md:my-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none',
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col gap-2.5 md:max-w-none">
        <div className="flex items-center justify-between gap-4 md:justify-start">
          <div role="group" aria-label="Quantidade" className="flex items-center gap-2">
            <span aria-hidden="true" className="text-sm font-semibold md:hidden">
              Qtd.
            </span>
            <StepButton
              label="Diminuir quantidade"
              disabled={soldOut || quantity <= 1}
              onClick={() => setRequested(quantity - 1)}
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </StepButton>
            <output className="w-7 text-center font-semibold tabular-nums" aria-live="off" data-testid="quantity-value">
              {quantity}
            </output>
            <StepButton
              label="Aumentar quantidade"
              disabled={soldOut || quantity >= limit}
              onClick={() => setRequested(quantity + 1)}
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </StepButton>
          </div>
          <p className="text-lg font-semibold text-primary md:text-sm md:font-normal md:text-muted-foreground" data-testid="purchase-total">
            {soldOut ? (
              'Esgotada'
            ) : (
              <>
                <span className="sr-only md:not-sr-only">Total: </span>
                {formatEth(multiplyEth(edition.priceEth, quantity))}
              </>
            )}
          </p>
        </div>

        <p className="text-xs text-muted-foreground" data-testid="quantity-limit">
          {soldOut
            ? 'Edição esgotada.'
            : edition.available < edition.maxPerOrder
              ? `Apenas ${edition.available} disponíveis.`
              : `Máximo de ${edition.maxPerOrder} por pedido.`}
        </p>
        <p role="status" className="text-xs text-primary empty:hidden" data-testid="quantity-announcement">
          {stockNotice}
        </p>

        <div className="flex items-center gap-3 md:mt-1">
          <Button
            aria-disabled={soldOut || addToCart.isPending || undefined}
            aria-busy={addToCart.isPending || undefined}
            onClick={buy}
            className={cn(
              'h-12 flex-1 rounded-full bg-linear-to-r from-primary to-[#aa7041] text-base font-semibold md:h-9 md:flex-none md:rounded-md md:bg-none md:px-6 md:text-xs md:uppercase',
              'aria-busy:cursor-progress',
              unavailableClass,
            )}
          >
            Comprar<span className="md:hidden"> NFT</span>
          </Button>
          {/* Mobile: the favorite toggle is in the page header (Figma mobile-02). */}
          <FavoriteButton nftId={nftId} nftName={nftName} variant="labeled" className="hidden md:inline-flex" />
          {/* Mobile (Figma mobile-02): the round cart button opens the cart. */}
          <Link
            to="/cart"
            className="relative grid size-12 place-items-center rounded-full bg-muted text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
            <span className="sr-only">Abrir carrinho{cartCount > 0 ? ` (${cartCount} ${cartCount === 1 ? 'item' : 'itens'})` : ''}</span>
          </Link>
        </div>
        <p role="status" className={cn('text-xs empty:hidden', result?.ok === false ? 'text-danger' : 'text-primary')} data-testid="action-notice">
          {result && (
            <span key={result.id}>
              {result.message}
              {result.ok && (
                <>
                  {' '}
                  <Link to="/cart" className="font-semibold underline underline-offset-4">
                    Ver carrinho
                  </Link>
                </>
              )}
            </span>
          )}
        </p>
      </div>
    </section>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:size-7',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-40',
      )}
    >
      {children}
    </button>
  )
}
