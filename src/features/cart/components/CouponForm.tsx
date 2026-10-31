import { useId, useState, type FormEvent } from 'react'
import { ApiError } from '@/services/api/http'
import type { Coupon } from '@/shared/contracts'
import { useCartCoupon } from '../hooks'

/**
 * "Código promocional" (Figma desktop-03 / mobile-03). The API validates the code (invalid or
 * expired → message on the field); the discount appears only after it accepted the coupon.
 */
export function CouponForm({ coupon }: { coupon: Coupon | null }) {
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const mutation = useCartCoupon()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.isPending) return
    if (!code.trim()) {
      setError('Informe o código.')
      return
    }
    setError('')
    mutation.mutate(code.trim(), {
      onSuccess: () => setCode(''),
      onError: (e) => setError(e instanceof ApiError && e.status !== null && e.status < 500 ? e.message : 'Não foi possível aplicar o cupom. Tente novamente.'),
    })
  }

  if (coupon) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-xs" data-testid="cart-coupon">
        <span>
          Cupom <strong>{coupon.code}</strong> aplicado ({coupon.percentOff}% de desconto)
        </span>
        <button
          type="button"
          aria-disabled={mutation.isPending || undefined}
          onClick={() => !mutation.isPending && mutation.mutate(null)}
          className="text-primary underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Remover cupom
        </button>
      </div>
    )
  }

  return (
    <form className="mt-4" onSubmit={submit} noValidate>
      <label htmlFor={id} className="text-xs font-medium">
        Código promocional
      </label>
      <div className="mt-1.5 flex">
        <input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError('')
          }}
          autoCapitalize="characters"
          placeholder="Digite o código promocional..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-9 min-w-0 flex-1 rounded-l-md border border-r-0 bg-background px-3 text-xs uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
        />
        <button
          type="submit"
          aria-busy={mutation.isPending || undefined}
          className="h-9 rounded-r-md bg-primary px-3 text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-busy:opacity-70"
        >
          {mutation.isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  )
}
