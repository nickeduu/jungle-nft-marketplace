import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { profileQuery } from '@/features/auth/api'
import { FormField } from '@/features/auth/components/FormField'
import { useSession } from '@/features/auth/session'
import { useWallets } from '@/features/wallets/api'
import { ApiError } from '@/services/api/http'
import { NETWORK_LABELS, NETWORKS, type CreateOrderRequest, type Network, type Quote } from '@/shared/contracts'
import { validateEmail } from '@/shared/lib/account-rules'
import { validateFullName } from '@/shared/lib/wallet-rules'
import { privateKeys } from '@/shared/query-keys'
import { checkoutAttempt, createOrder, pendingOrdersQuery, quoteQuery, type CheckoutAttempt } from './api'
import { QuoteSummary } from './components/QuoteSummary'
import { WalletPicker } from './components/WalletPicker'

type Field = 'fullName' | 'email' | 'wallet' | 'network'

/**
 * Payment (Figma desktop-04 / mobile-04). The API quote is the reference: when it changes (price,
 * stock, coupon or fee) the user must acknowledge the new values before confirming. Orders are
 * created once per attempt (Idempotency-Key, see api.ts); success is shown only by the order page,
 * from the API's answer.
 */
export function CheckoutPage() {
  const { user } = useSession()
  if (!user) return null
  return <Checkout userId={user.id} />
}

function Checkout({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const wallets = useWallets(userId)
  const profile = useQuery(profileQuery(userId))
  const pending = useQuery(pendingOrdersQuery(userId))

  const connectedWallet = wallets.data?.wallets.find((w) => w.id === wallets.data?.connectedWalletId)
  const [walletChoice, setWalletChoice] = useState<string | null>(null)
  const walletId = walletChoice ?? connectedWallet?.id ?? wallets.data?.wallets[0]?.id ?? null
  const selectedWallet = wallets.data?.wallets.find((w) => w.id === walletId)
  const [networkChoice, setNetworkChoice] = useState<Network | null>(null)
  const network: Network = networkChoice ?? selectedWallet?.network ?? 'ethereum'

  const quote = useQuery(quoteQuery(userId, network))
  // Fingerprint the user has reviewed, per network: a different one must be acknowledged again.
  const [reviewed, setReviewed] = useState<Partial<Record<Network, string>>>({})
  if (quote.data && reviewed[network] === undefined) setReviewed((r) => ({ ...r, [network]: quote.data.fingerprint }))
  const quoteChanged = quote.data !== undefined && reviewed[network] !== undefined && reviewed[network] !== quote.data.fingerprint

  const [buyer, setBuyer] = useState<{ fullName: string; email: string } | null>(null)
  const buyerValues = buyer ?? { fullName: profile.data?.name ?? '', email: profile.data?.email ?? '' }
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState('')
  const [unknownAttempt, setUnknownAttempt] = useState<CheckoutAttempt | null>(() => checkoutAttempt.get(userId))

  // Synchronous guard: a second click can arrive before React re-renders with isPending = true.
  // Released only on error: after a success the page is leaving — a click in between would start
  // a new attempt (the answered one was cleared) and create a second order.
  const sending = useRef(false)
  const order = useMutation({
    mutationFn: (attempt: CheckoutAttempt) => createOrder(attempt.body, attempt.key),
    onSuccess: (created) => {
      checkoutAttempt.clear(userId)
      queryClient.setQueryData(privateKeys.order(userId, created.id), created)
      void queryClient.invalidateQueries({ queryKey: privateKeys.orders(userId) })
      void navigate({ to: '/orders/$orderId', params: { orderId: created.id } })
    },
    onError: (error, attempt) => {
      sending.current = false
      if (!(error instanceof ApiError)) return setFormError('Erro inesperado. Tente novamente.')
      // No answer: the order may exist. Keep the attempt and offer to resend it (same key).
      if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR' || error.isTransient) {
        setUnknownAttempt(attempt)
        return setFormError('Não recebemos a confirmação do envio. Use "Verificar pedido" para retomar a mesma tentativa — nenhuma compra é duplicada.')
      }
      // Definitive refusal: nothing was created with this attempt.
      checkoutAttempt.clear(userId)
      setUnknownAttempt(null)
      if (error.code === 'PRICE_CHANGED' || error.code === 'QUOTE_EXPIRED' || error.code === 'COUPON_EXPIRED' || error.code === 'COUPON_INVALID') {
        void queryClient.invalidateQueries({ queryKey: privateKeys.quote(userId, network) })
      }
      if (error.code === 'WALLET_DISCONNECTED') void wallets.refetch()
      const fieldErrors: Partial<Record<Field, string>> = {}
      if (error.fieldErrors['buyer.fullName']) fieldErrors.fullName = error.fieldErrors['buyer.fullName']
      if (error.fieldErrors['buyer.email']) fieldErrors.email = error.fieldErrors['buyer.email']
      if (error.fieldErrors.network) fieldErrors.network = error.fieldErrors.network
      if (error.fieldErrors.walletId) fieldErrors.wallet = error.fieldErrors.walletId
      setErrors(fieldErrors)
      setFormError(error.message)
    },
  })

  function send(attempt: CheckoutAttempt) {
    if (sending.current) return
    sending.current = true
    order.mutate(attempt)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current || order.isPending || !quote.data) return
    const next: Partial<Record<Field, string>> = {}
    const nameError = validateFullName(buyerValues.fullName)
    const emailError = validateEmail(buyerValues.email)
    if (nameError) next.fullName = nameError
    if (emailError) next.email = emailError
    if (!selectedWallet) next.wallet = 'Selecione uma carteira.'
    else if (wallets.data?.connectedWalletId !== selectedWallet.id) next.wallet = 'Conecte a carteira selecionada para pagar.'
    if (selectedWallet && selectedWallet.network !== network) {
      next.network = `A carteira ${selectedWallet.label} está na rede ${NETWORK_LABELS[selectedWallet.network]}.`
    }
    setErrors(next)
    setFormError('')
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"] input')?.focus())
      return
    }
    if (quoteChanged || !selectedWallet) return
    const body: CreateOrderRequest = {
      quoteId: quote.data.id,
      quoteFingerprint: quote.data.fingerprint,
      walletId: selectedWallet.id,
      network,
      buyer: { fullName: buyerValues.fullName.trim(), email: buyerValues.email.trim() },
    }
    send(checkoutAttempt.for(userId, body))
  }

  return (
    <section aria-labelledby="checkout-title" className="py-4 md:py-8" data-testid="checkout-page">
      <nav aria-label="Trilha de navegação" className="hidden text-xs md:block">
        <ol className="flex items-center gap-1.5 text-muted-foreground">
          <li>
            <Link to="/" className="hover:text-primary">
              Início
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/cart" className="hover:text-primary">
              Carrinho
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            Pagamento
          </li>
        </ol>
      </nav>
      <h1 id="checkout-title" className="text-lg font-semibold md:mt-4 md:text-xl">
        Pagamento com carteira
      </h1>

      {pending.data && pending.data.length > 0 && (
        <p role="status" className="mt-4 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-xs" data-testid="pending-order-banner">
          Você tem um pedido aguardando confirmação.{' '}
          <Link to="/orders/$orderId" params={{ orderId: pending.data[0]!.id }} className="font-semibold underline underline-offset-4">
            Acompanhar pedido
          </Link>
        </p>
      )}
      {unknownAttempt && (
        <div role="alert" className="mt-4 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-xs" data-testid="unknown-attempt">
          <p>Há uma tentativa de compra sem resposta. Verifique antes de comprar de novo: a mesma tentativa é retomada, sem duplicar o pedido.</p>
          <Button size="sm" className="mt-2" aria-disabled={order.isPending || undefined} onClick={() => send(unknownAttempt)}>
            {order.isPending ? 'Verificando…' : 'Verificar pedido'}
          </Button>
        </div>
      )}

      <form noValidate onSubmit={submit} className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_22rem] md:gap-10">
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">Perfil do colecionador</legend>
          <FormField
            label="Nome completo"
            autoComplete="name"
            value={buyerValues.fullName}
            error={errors.fullName}
            onChange={(e) => setBuyer({ ...buyerValues, fullName: e.target.value })}
          />
          <FormField
            label="E-mail"
            type="email"
            autoComplete="email"
            value={buyerValues.email}
            error={errors.email}
            onChange={(e) => setBuyer({ ...buyerValues, email: e.target.value })}
          />
        </fieldset>

        <div className="space-y-6">
          {quote.isPending ? (
            <div aria-busy="true" aria-label="Calculando cotação" data-testid="quote-skeleton" className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : quote.isError ? (
            <QuoteError error={quote.error} onRetry={() => void quote.refetch()} />
          ) : (
            <QuoteSummary quote={quote.data} />
          )}

          {quoteChanged && quote.data && (
            <div role="alert" className="rounded-md border border-primary bg-primary/10 px-3 py-2 text-xs" data-testid="quote-changed">
              <p>Preço, disponibilidade, cupom ou taxa mudaram desde a sua revisão. Confira os novos valores acima antes de confirmar.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setReviewed((r) => ({ ...r, [network]: (quote.data as Quote).fingerprint }))}
              >
                Revisei os novos valores
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-sm font-semibold">Carteira e rede</h2>
            {wallets.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : wallets.isError ? (
              <p role="alert" className="text-xs">
                Não foi possível carregar as carteiras.
              </p>
            ) : (
              <WalletPicker
                data={wallets.data}
                selectedId={walletId}
                error={errors.wallet}
                onSelect={(wallet) => {
                  setWalletChoice(wallet.id)
                  setNetworkChoice(wallet.network)
                }}
              />
            )}
            <div>
              <label htmlFor="checkout-network" className="mb-1.5 block text-xs font-medium">
                Rede
              </label>
              <select
                id="checkout-network"
                value={network}
                onChange={(e) => setNetworkChoice(e.target.value as Network)}
                aria-invalid={errors.network ? true : undefined}
                aria-describedby={errors.network ? 'checkout-network-error' : undefined}
                className="block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
              >
                {NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {NETWORK_LABELS[n]}
                  </option>
                ))}
              </select>
              {errors.network && (
                <p id="checkout-network-error" className="mt-1 text-xs text-danger">
                  {errors.network}
                </p>
              )}
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm" data-testid="checkout-error">
              {formError}
            </p>
          )}
          <Button
            type="submit"
            className="h-12 w-full rounded-full text-sm font-semibold md:h-10 md:rounded-md"
            aria-disabled={order.isPending || quoteChanged || !quote.data || undefined}
            aria-busy={order.isPending || undefined}
          >
            {order.isPending ? 'Enviando pedido…' : 'Confirmar compra'}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">Pagamento simulado: nenhuma transação real é feita.</p>
        </div>
      </form>
    </section>
  )
}

function QuoteError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const conflict = error instanceof ApiError && error.status !== null && error.status < 500
  return (
    <div role="alert" className="rounded-md border border-destructive bg-destructive/15 px-3 py-2 text-sm" data-testid="quote-error">
      <p>{conflict ? error.message : 'Não foi possível calcular a cotação.'}</p>
      {conflict ? (
        <Link to="/cart" className="mt-2 inline-block text-xs text-primary underline underline-offset-4">
          Revisar carrinho
        </Link>
      ) : (
        <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
