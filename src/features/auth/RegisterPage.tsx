import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { Button } from '@/components/ui/button'
import {
  normalizeUsername,
  validateEmail,
  validateNewPassword,
  validatePasswordConfirmation,
  validateUsername,
} from '@/shared/lib/account-rules'
import { AuthCard } from './components/AuthCard'
import { FormField } from './components/FormField'
import { SignedInPanel } from './components/SignedInPanel'
import { apiFieldErrors, focusFirstInvalid, formErrorMessage, type FieldErrors } from './form-errors'
import { useRegister } from './hooks'
import type { AuthSearch } from './search-params'
import { useSession } from './session'

type Field = 'username' | 'email' | 'password' | 'confirmation'
const API_FIELDS = ['username', 'email', 'password'] as const

function validate(values: Record<Field, string>): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const checks: Array<[Field, string | null]> = [
    ['username', validateUsername(values.username)],
    ['email', validateEmail(values.email)],
    ['password', validateNewPassword(values.password)],
    ['confirmation', validatePasswordConfirmation(values.password, values.confirmation)],
  ]
  for (const [field, message] of checks) if (message) errors[field] = message
  return errors
}

/**
 * Registration (Figma mobile-06 "Criar perfil de colecionador" / desktop-07). Creates the
 * account on the API, which also opens the session; then returns to `redirect` (or the home).
 */
export function RegisterPage({ search }: { search: AuthSearch }) {
  const { user } = useSession()
  const registerAccount = useRegister()
  const navigate = useNavigate()
  const notify = useFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<Record<Field, string>>({ username: '', email: '', password: '', confirmation: '' })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [formError, setFormError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  // Bumped on each submit that ends with field errors: focus moves only then, never while typing.
  const [focusRequest, setFocusRequest] = useState(0)

  useEffect(() => {
    if (focusRequest > 0) focusFirstInvalid(formRef.current)
  }, [focusRequest])

  if (user && !registerAccount.isSuccess) {
    return (
      <AuthCard mode="register" redirect={search.redirect} title="Você já entrou">
        <SignedInPanel name={user.name} email={user.email} redirect={search.redirect} />
      </AuthCard>
    )
  }

  function update(field: Field, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (submitted) setErrors(validate(next))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (registerAccount.isPending) return
    setSubmitted(true)
    setFormError('')
    const clientErrors = validate(values)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) {
      setFocusRequest((n) => n + 1)
      return
    }

    registerAccount.mutate(
      { username: normalizeUsername(values.username), email: values.email.trim(), password: values.password },
      {
        onSuccess: (session) => {
          notify(`Conta criada. Bem-vindo(a), ${session.user.name}.`, 'success')
          void navigate({ href: search.redirect ?? '/', replace: true })
        },
        onError: (error) => {
          const fieldErrors = apiFieldErrors(error, API_FIELDS)
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
      mode="register"
      redirect={search.redirect}
      title="Criar perfil de colecionador"
      footer={
        <>
          Já tem uma conta?{' '}
          <Link to="/login" search={{ redirect: search.redirect, reason: undefined }} className="underline underline-offset-4 hover:text-foreground">
            Entre
          </Link>
        </>
      }
    >
      <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-4">
        <FormField
          label="Nome de usuário"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          placeholder="Nome de usuário"
          hint="3 a 20 caracteres: letras, números, ponto ou sublinhado."
          value={values.username}
          error={errors.username}
          onChange={(e) => update('username', e.target.value)}
        />
        <FormField
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Digite seu e-mail"
          value={values.email}
          error={errors.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <FormField
          label="Senha"
          type="password"
          name="new-password"
          autoComplete="new-password"
          placeholder="Senha"
          hint="Mínimo de 8 caracteres, com letras e números."
          value={values.password}
          error={errors.password}
          onChange={(e) => update('password', e.target.value)}
        />
        <FormField
          label="Confirmar senha"
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          placeholder="Confirmar senha"
          value={values.confirmation}
          error={errors.confirmation}
          onChange={(e) => update('confirmation', e.target.value)}
        />
        {formError && (
          <p role="alert" className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm">
            {formError}
          </p>
        )}
        <Button type="submit" aria-disabled={registerAccount.isPending || undefined} className="h-12 w-full rounded-lg text-sm font-semibold">
          {registerAccount.isPending ? 'Criando perfil…' : 'Criar perfil'}
        </Button>
      </form>
    </AuthCard>
  )
}
