import { Link } from '@tanstack/react-router'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/features/cart/hooks'
import { formatEth } from '@/shared/lib/eth'

/**
 * Checkout entry point, prepared for the payment stage: shows what will be ordered (the cart as
 * the API returned it). Buyer data, wallet/network, the quote and the order are not implemented
 * yet, so confirming is visibly unavailable — no purchase is ever presented as done.
 */
export function CheckoutPage() {
  const { data: cart } = useCart()
  const unavailableId = useId()

  return (
    <section aria-labelledby="checkout-title" className="mx-auto max-w-2xl py-6 md:py-10" data-testid="checkout-page">
      <h1 id="checkout-title" className="text-lg font-semibold md:text-xl">
        Finalizar compra
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">Revise os itens do seu carrinho.</p>

      {cart && (
        <>
          <ul aria-label="Itens do pedido" className="mt-6 divide-y rounded-lg bg-card px-4" data-testid="checkout-items">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Edição {item.editionName} · {item.quantity} × {formatEth(item.unitPriceEth)}
                  </span>
                </span>
                <span className="shrink-0 text-primary">{formatEth(item.lineTotalEth)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatEth(cart.subtotalEth)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Taxa de rede (estimada)</dt>
              <dd>{formatEth(cart.networkFeeEth)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <dt>Total estimado</dt>
              <dd className="text-primary" data-testid="checkout-total">
                {formatEth(cart.totalEth)}
              </dd>
            </div>
          </dl>
        </>
      )}

      <p id={unavailableId} className="mt-6 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs" role="note">
        Dados do colecionador, carteira, rede, cotação final e confirmação do pedido: indisponíveis nesta versão.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button aria-disabled="true" aria-describedby={unavailableId} className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60">
          Confirmar compra
        </Button>
        <Button asChild variant="outline">
          <Link to="/cart">Voltar ao carrinho</Link>
        </Button>
      </div>
    </section>
  )
}
