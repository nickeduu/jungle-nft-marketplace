import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '@/features/auth/guards'
import { WalletsPage } from '@/features/wallets/WalletsPage'

/** Private: visitors are redirected to /login?redirect=/wallets. */
export const Route = createFileRoute('/wallets')({
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location.href),
  component: WalletsPage,
})
