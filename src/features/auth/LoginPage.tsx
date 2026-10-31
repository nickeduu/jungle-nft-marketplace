import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { Button } from '@/components/ui/button'
import { validateEmail } from '@/shared/lib/account-rules'
import { AuthCard } from './components/AuthCard'
import { FormField } from './components/FormField'
import { SignedInPanel } from './components/SignedInPanel'
import { apiFieldErrors, focusFirstInvalid, formErrorMessage, type FieldErrors } from './form-errors'
import { guestCartMessage, useLogin } from './hooks'
import type { AuthSearch } from './search-params'
import { useSession } from './session'

type Field = 'email' | 'password'
const FIELDS = ['email', 'password'] as const

function validate(values: Record<Field, string>): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const email = validateEmail(values.email)
  if (email) errors.email = email
  if (!values.password) errors.password = 'Informe a senha.'
  return errors
}

/** Login (Figma mobile-05 / desktop-06). After signing in, returns to `redirect` (or the home). */
export function LoginPage({ search }: { search: AuthSearch }) {
  const { user } = useSession()
  const login = useLogin()
  const navigate = useNavigate()
  const notify = useFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<Record<Field, string>>({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  // Bumped on each submit that ends with field errors: focus moves only then, never while typing.
  const [focusRequest, setFocusRequest] = useState(0)

  useEffect(() => {
    if (focusRequest > 0) focusFirstInvalid(formRef.current)
  }, [focusRequest])

  // Already signed in (not this form's own sign-in, which navigates away when it settles).
  if (user && login.isIdle) {
    return (
      <AuthCard mode="login" redirect={search.redirect} title="Você já entrou">
        <SignedInPanel name={user.name} email={user.email} redirect={search.redirect} />
      </AuthCard>
    )
  }

  function update(field: Field, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    // After the first attempt, errors follow the input (they disappear once fixed).
    if (submitted) setErrors(validate(next))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (login.isPending) return
    setSubmitted(true)
    setFormError('')
    const clientErrors = validate(values)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) {
      setFocusRequest((n) => n + 1)
      return
    }

    login.mutate(
      { email: values.email.trim(), password: values.password },
      {
        onSuccess: ({ session, guestCart }) => {
          notify(`Bem-vindo(a), ${session.user.name}.`, 'success')
          const cartNotice = guestCartMessage(guestCart)
          if (cartNotice) notify(cartNotice.message, cartNotice.tone)
          void navigate({ href: search.redirect ?? '/', replace: true })
        },
        onError: (error) => {
          const fieldErrors = apiFieldErrors(error, FIELDS)
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors)
            setFocusRequest((n) => n + 1)
          } else {
            setFormError(formErrorMessage(error))
          }
        },
      },
    )
  }

  return (
    <AuthCard
      mode="login"
      redirect={search.redirect}
      title="Entrar"
      footer={
        <>
          Novo na Kurio?{' '}
          <Link to="/register" search={{ redirect: search.redirect, reason: undefined }} className="underline underline-offset-4 hover:text-foreground">
            Crie uma conta
          </Link>
        </>
      }
    >
      {search.reason === 'expired' && (
        <p role="status" className="mb-4 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-xs">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-4" aria-describedby={formError ? 'login-error' : undefined}>
        <FormField
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="contato@email.com"
          value={values.email}
          error={errors.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <div>
          <FormField
            label="Senha"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            value={values.password}
            error={errors.password}
            onChange={(e) => update('password', e.target.value)}
          />
          <p className="mt-2 text-right">
            <button
              type="button"
              aria-disabled="true"
              title="Indisponível nesta versão"
              onClick={() => notify('Recuperação de senha indisponível nesta versão.', 'info')}
              className="text-xs text-primary/80 outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed"
            >
              Esqueceu a senha?
            </button>
          </p>
        </div>
        {formError && (
          <p id="login-error" role="alert" className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm">
            {formError}
          </p>
        )}
        <Button type="submit" aria-disabled={login.isPending || undefined} className="h-12 w-full rounded-lg text-sm font-semibold">
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthCard>
  )
}
