import { createFileRoute } from '@tanstack/react-router'
import { requireCheckoutReadyCart } from '@/features/checkout/guards'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'

/** Private, and only with a cart ready for checkout (otherwise back to /cart). */
export const Route = createFileRoute('/checkout')({
  beforeLoad: ({ context, location }) => requireCheckoutReadyCart(context.queryClient, location.href),
  component: CheckoutPage,
})
