import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useLogout } from '../hooks'

/** Shown on /login and /register to a signed-in user: continue, open the profile or sign out. */
export function SignedInPanel({ name, email, redirect }: { name: string; email: string; redirect: string | undefined }) {
  const logout = useLogout()
  const navigate = useNavigate()
  return (
    <div className="space-y-4 text-center text-sm" data-testid="signed-in-panel">
      <p>
        Você está conectado como <strong>{name}</strong>
        <br />
        <span className="text-muted-foreground">{email}</span>
      </p>
      <div className="flex flex-col gap-2">
        <Button className="h-11 rounded-lg" onClick={() => void navigate({ href: redirect ?? '/' })}>
          Continuar navegando
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-lg">
          <Link to="/profile">Ver meu perfil</Link>
        </Button>
        <Button
          variant="ghost"
          className="h-11 rounded-lg"
          aria-disabled={logout.isPending || undefined}
          onClick={() => {
            if (!logout.isPending) logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })
          }}
        >
          Sair
        </Button>
      </div>
    </div>
  )
}
