import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { profileQuery } from '@/features/auth/api'
import { useSession } from '@/features/auth/session'
import { ProfileForm, PasswordForm } from './components/ProfileForms'
import { ProfileLayout } from './ProfileLayout'

/**
 * "Perfil do colecionador" (Figma desktop-08): summary from `GET /api/profile` (private, keyed by
 * user id), then the edit form (name, username, e-mail, avatar) and the password change.
 */
export function ProfilePage() {
  const { user } = useSession()
  return (
    <ProfileLayout active="profile">
      <h1 className="text-lg font-semibold">Perfil do colecionador</h1>
      {/* The guard guarantees a session; during sign-out the page unmounts. */}
      {user && <ProfileDetails userId={user.id} />}
    </ProfileLayout>
  )
}

function ProfileDetails({ userId }: { userId: string }) {
  const profile = useQuery(profileQuery(userId))

  if (profile.isPending) {
    return (
      <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Carregando perfil" data-testid="profile-skeleton">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }
  if (profile.isError) {
    return (
      <div role="alert" className="mt-6 text-sm">
        <p>Não foi possível carregar o perfil.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void profile.refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  const { name, username, email, id, avatarUrl } = profile.data
  return (
    <>
    <div className="mt-6 space-y-6" data-testid="profile-details">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt={`Avatar de ${name}`} className="size-14 rounded-full object-cover" data-testid="profile-avatar" />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-14 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground uppercase"
          >
            {name.slice(0, 1)}
          </span>
        )}
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">@{username}</p>
        </div>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Nome de exibição" value={name} />
        <Detail label="Nome de usuário" value={username} />
        <Detail label="E-mail" value={email} />
        <Detail label="ID do colecionador" value={id} />
      </dl>
      <Button asChild variant="outline">
        <Link to="/favorites">
          <Heart aria-hidden="true" />
          Ver lista de interesse
        </Link>
      </Button>
    </div>
    {/* Keyed by the saved data: after a save the forms restart from what the API stored. */}
    <div className="mt-10 space-y-10 border-t pt-6">
      <ProfileForm key={JSON.stringify(profile.data)} user={profile.data} />
      <PasswordForm />
    </div>
    </>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all">{value}</dd>
    </div>
  )
}
