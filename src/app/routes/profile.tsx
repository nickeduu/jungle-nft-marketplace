import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '@/features/auth/guards'
import { ProfilePage } from '@/features/profile/ProfilePage'

/** Private: visitors are redirected to /login?redirect=/profile. */
export const Route = createFileRoute('/profile')({
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location.href),
  component: ProfilePage,
})
