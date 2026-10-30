import { createFileRoute } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { validateAuthSearch } from '@/features/auth/search-params'

/** `/login?redirect=/favorites&reason=expired` — returns to `redirect` after signing in. */
export const Route = createFileRoute('/login')({
  validateSearch: validateAuthSearch,
  // Figma mobile-05: full-screen card without the bottom navigation.
  staticData: { hideMobileNav: true },
  component: RouteComponent,
})

function RouteComponent() {
  return <LoginPage search={Route.useSearch()} />
}
