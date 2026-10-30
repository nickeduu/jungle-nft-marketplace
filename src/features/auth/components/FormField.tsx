import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/shared/lib/utils'

type InputProps = Omit<ComponentProps<'input'>, 'id' | 'aria-invalid' | 'aria-describedby'>

/**
 * Labelled input with its error message associated (aria-invalid + aria-describedby).
 * The Figma shows placeholders only; a visible label is kept for accessibility.
 */
export function FormField({
  label,
  error,
  hint,
  className,
  ...inputProps
}: InputProps & { label: string; error?: string | undefined; hint?: string }) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-foreground/90">
        {label}
      </label>
      <FieldInput id={id} invalid={Boolean(error)} describedBy={describedBy} {...inputProps} />
      {hint && !error && (
        <p id={hintId} className="mt-1 text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function FieldInput({
  id,
  invalid,
  describedBy,
  type,
  ...props
}: InputProps & { id: string; invalid: boolean; describedBy: string | undefined }) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const input = (
    <Input
      id={id}
      type={isPassword && visible ? 'text' : type}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn('h-11 rounded-lg px-4 placeholder:text-muted-foreground/80', isPassword && 'pr-11')}
      {...props}
    />
  )
  if (!isPassword) return input
  return (
    <div className="relative">
      {input}
      <button
        type="button"
        aria-label="Mostrar senha"
        aria-pressed={visible}
        aria-controls={id}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-1 my-auto grid size-9 place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}
