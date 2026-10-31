import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { Button } from '@/components/ui/button'
import { FormField } from '@/features/auth/components/FormField'
import { apiFieldErrors, formErrorMessage, type FieldErrors } from '@/features/auth/form-errors'
import type { User } from '@/shared/contracts'
import {
  validateAvatarDataUrl,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
  validatePasswordConfirmation,
  validateUsername,
} from '@/shared/lib/account-rules'
import { useChangePassword, useUpdateProfile } from '../api'

const focusFirstInvalid = (form: HTMLFormElement | null) =>
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())

type ProfileField = 'name' | 'username' | 'email' | 'avatarUrl'
const PROFILE_FIELDS = ['name', 'username', 'email', 'avatarUrl'] as const

/**
 * "Perfil do colecionador" (Figma desktop-08): display name, username, e-mail and avatar
 * (Alterar / Remover). Validated here and again by the API; saved values persist (refresh).
 */
export function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const notify = useFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState({ name: user.name, username: user.username, email: user.email })
  const [avatar, setAvatar] = useState<string | null>(user.avatarUrl)
  const [errors, setErrors] = useState<FieldErrors<ProfileField>>({})

  function pickAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const error = validateAvatarDataUrl(dataUrl)
      setErrors((current) => {
        const next = { ...current }
        if (error) next.avatarUrl = error
        else delete next.avatarUrl
        return next
      })
      if (!error) setAvatar(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (update.isPending) return
    const next: FieldErrors<ProfileField> = {}
    const checks: Array<[ProfileField, string | null]> = [
      ['name', validateDisplayName(values.name)],
      ['username', validateUsername(values.username)],
      ['email', validateEmail(values.email)],
    ]
    for (const [field, message] of checks) if (message) next[field] = message
    setErrors(next)
    if (Object.keys(next).length > 0) return focusFirstInvalid(formRef.current)
    update.mutate(
      { name: values.name.trim(), username: values.username.trim(), email: values.email.trim(), avatarUrl: avatar },
      {
        onSuccess: () => notify('Perfil atualizado.', 'success'),
        onError: (error) => {
          const fieldErrors = apiFieldErrors(error, PROFILE_FIELDS)
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors)
            focusFirstInvalid(formRef.current)
          } else notify(formErrorMessage(error), 'error')
        },
      },
    )
  }

  const set = (field: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [field]: e.target.value }))

  return (
    <form ref={formRef} noValidate onSubmit={submit} aria-labelledby="edit-profile-title" className="space-y-4" data-testid="profile-form">
      <h2 id="edit-profile-title" className="text-sm font-semibold">
        Editar dados
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nome de exibição" autoComplete="name" value={values.name} error={errors.name} onChange={set('name')} />
        <FormField label="Nome de usuário" autoComplete="username" value={values.username} error={errors.username} onChange={set('username')} />
        <FormField label="E-mail" type="email" autoComplete="email" value={values.email} error={errors.email} onChange={set('email')} />
      </div>
      <div>
        <p id="avatar-label" className="mb-1.5 text-xs font-medium text-foreground/90">
          Avatar
        </p>
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt="Prévia do avatar" className="size-12 rounded-full object-cover" data-testid="avatar-preview" />
          ) : (
            <span className="grid size-12 place-items-center rounded-full bg-muted text-xs text-muted-foreground" data-testid="avatar-preview">
              Sem foto
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-labelledby="avatar-label"
            aria-describedby={errors.avatarUrl ? 'avatar-error' : 'avatar-hint'}
            aria-invalid={errors.avatarUrl ? true : undefined}
            onChange={pickAvatar}
            data-testid="avatar-input"
          />
          <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>
            Alterar
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={!avatar} onClick={() => setAvatar(null)}>
            Remover
          </Button>
        </div>
        {errors.avatarUrl ? (
          <p id="avatar-error" role="alert" className="mt-1 text-xs text-danger">
            {errors.avatarUrl}
          </p>
        ) : (
          <p id="avatar-hint" className="mt-1 text-[11px] text-muted-foreground">
            PNG, JPEG ou WebP, até 512 KB. Salve para aplicar.
          </p>
        )}
      </div>
      <Button type="submit" aria-disabled={update.isPending || undefined}>
        {update.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmation'

/** "Alterar senha" (Figma desktop-08): current, new and confirmation. */
export function PasswordForm() {
  const change = useChangePassword()
  const notify = useFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmation: '' })
  const [errors, setErrors] = useState<FieldErrors<PasswordField>>({})

  function submit(event: FormEvent) {
    event.preventDefault()
    if (change.isPending) return
    const next: FieldErrors<PasswordField> = {}
    if (!values.currentPassword) next.currentPassword = 'Informe a senha atual.'
    const policy = validateNewPassword(values.newPassword)
    if (policy) next.newPassword = policy
    const confirmation = validatePasswordConfirmation(values.newPassword, values.confirmation)
    if (confirmation) next.confirmation = confirmation
    setErrors(next)
    if (Object.keys(next).length > 0) return focusFirstInvalid(formRef.current)
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          setValues({ currentPassword: '', newPassword: '', confirmation: '' })
          notify('Senha alterada.', 'success')
        },
        onError: (error) => {
          const fieldErrors = apiFieldErrors(error, ['currentPassword', 'newPassword'] as const)
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors)
            focusFirstInvalid(formRef.current)
          } else notify(formErrorMessage(error), 'error')
        },
      },
    )
  }

  const set = (field: PasswordField) => (e: ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [field]: e.target.value }))

  return (
    <form ref={formRef} noValidate onSubmit={submit} aria-labelledby="password-title" className="space-y-4" data-testid="password-form">
      <h2 id="password-title" className="text-sm font-semibold">
        Alterar senha
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Senha atual" type="password" autoComplete="current-password" value={values.currentPassword} error={errors.currentPassword} onChange={set('currentPassword')} />
        <FormField label="Nova senha" type="password" autoComplete="new-password" value={values.newPassword} error={errors.newPassword} onChange={set('newPassword')} />
        <FormField label="Confirmar nova senha" type="password" autoComplete="new-password" value={values.confirmation} error={errors.confirmation} onChange={set('confirmation')} />
      </div>
      <Button type="submit" aria-disabled={change.isPending || undefined}>
        {change.isPending ? 'Salvando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}
