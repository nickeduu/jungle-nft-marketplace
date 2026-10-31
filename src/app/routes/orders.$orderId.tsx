import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '@/features/auth/guards'
import { OrderPage } from '@/features/orders/OrderPage'

/** Private: an order can only be read by its owner (another user's id answers 404). */
export const Route = createFileRoute('/orders/$orderId')({
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location.href),
  component: RouteComponent,
})

function RouteComponent() {
  const { orderId } = Route.useParams()
  return <OrderPage key={orderId} orderId={orderId} />
}
