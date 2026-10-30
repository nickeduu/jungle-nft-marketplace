import { createFileRoute } from '@tanstack/react-router'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { validateAuthSearch } from '@/features/auth/search-params'

export const Route = createFileRoute('/register')({
  validateSearch: validateAuthSearch,
  // Figma mobile-06: full-screen card without the bottom navigation.
  staticData: { hideMobileNav: true },
  component: RouteComponent,
})

function RouteComponent() {
  return <RegisterPage search={Route.useSearch()} />
}
