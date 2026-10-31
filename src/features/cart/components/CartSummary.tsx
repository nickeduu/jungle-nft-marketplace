import { Link, useNavigate } from '@tanstack/react-router'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import type { Cart } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/eth'
import { CouponForm } from './CouponForm'

/**
 * "Resumo da carteira" (Figma desktop-03 / mobile-03). Every value comes from the API response
 * (or its optimistic recomputation). The coupon is validated by the API and re-checked by the
 * checkout quote. Checkout is blocked while an item is sold out.
 */
export function CartSummary({ cart }: { cart: Cart }) {
  const navigate = useNavigate()
  const titleId = useId()
  const blockedId = useId()
  const blocked = !cart.checkoutReady

  return (
    <aside aria-labelledby={titleId} className="rounded-3xl bg-card p-5 md:rounded-lg md:bg-transparent md:p-0" data-testid="cart-summary">
      <h2 id={titleId} className="border-b pb-2 text-sm font-semibold">
        Resumo da carteira
      </h2>

      <CouponForm coupon={cart.coupon} />

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Subtotal" value={formatEth(cart.subtotalEth)} testId="cart-subtotal" />
        <Row label="Desconto do lançamento" value={`(-) ${formatEth(cart.discountEth)}`} testId="cart-discount" />
        <Row label="Taxa de rede" value={formatEth(cart.networkFeeEth)} hint="Taxa estimada" testId="cart-fee" />
        <div className="flex items-baseline justify-between border-t pt-3 font-semibold">
          <dt>Total</dt>
          <dd className="text-primary" data-testid="cart-total">
            {formatEth(cart.totalEth)}
          </dd>
        </div>
      </dl>

      <Button
        className="mt-5 h-11 w-full rounded-full text-sm font-semibold md:h-9 md:rounded-md"
        aria-disabled={blocked || undefined}
        aria-describedby={blocked ? blockedId : undefined}
        onClick={() => {
          if (!blocked) void navigate({ to: '/checkout' })
        }}
      >
        Conectar e finalizar
      </Button>
      {blocked && (
        <p id={blockedId} className="mt-2 text-xs text-danger" data-testid="checkout-blocked">
          Remova os itens esgotados para continuar.
        </p>
      )}
      <p className="mt-3 text-center">
        <Link to="/" hash="catalogo" className="text-xs text-primary underline-offset-4 hover:underline">
          Continuar explorando
        </Link>
      </p>
    </aside>
  )
}

function Row({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right" data-testid={testId}>
        {value}
        {hint && <span className="block text-[11px] text-primary">{hint}</span>}
      </dd>
    </div>
  )
}
