import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '@/features/auth/guards'
import { FavoritesPage } from '@/features/favorites/FavoritesPage'

/** Private: visitors are redirected to /login?redirect=/favorites. */
export const Route = createFileRoute('/favorites')({
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location.href),
  component: FavoritesPage,
})
