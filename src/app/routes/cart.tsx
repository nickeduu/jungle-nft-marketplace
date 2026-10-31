import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/CartPage'

/** Public: visitors have a cart too (merged into the account on login). */
export const Route = createFileRoute('/cart')({
  component: CartPage,
})
