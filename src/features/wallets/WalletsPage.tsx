import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/features/auth/components/FormField'
import { apiFieldErrors, formErrorMessage } from '@/features/auth/form-errors'
import { useSession } from '@/features/auth/session'
import { ProfileLayout } from '@/features/profile/ProfileLayout'
import {
  NETWORK_LABELS,
  NETWORKS,
  WALLET_CONNECTOR_LABELS,
  WALLET_CONNECTORS,
  type Network,
  type UpsertWalletRequest,
  type Wallet,
  type WalletConnector,
  type WalletSlot,
} from '@/shared/contracts'
import { validateWallet } from '@/shared/lib/wallet-rules'
import { useSaveWallet, useWallets } from './api'

const SLOT_TITLES: Record<WalletSlot, string> = { primary: 'Carteira principal', secondary: 'Carteira secundária' }
const FIELDS = ['label', 'address', 'network', 'connector'] as const

/** "Carteiras" (Figma desktop-09): principal and secondary wallets used at checkout. Fictitious only. */
export function WalletsPage() {
  const { user } = useSession()
  return (
    <ProfileLayout active="wallets">
      <h1 className="text-lg font-semibold">Carteiras</h1>
      <p className="mt-1 text-xs text-muted-foreground">Estas carteiras ficam disponíveis no pagamento. Endereços fictícios (simulação).</p>
      {user && <WalletSlots userId={user.id} />}
    </ProfileLayout>
  )
}

function WalletSlots({ userId }: { userId: string }) {
  const wallets = useWallets(userId)
  if (wallets.isPending) {
    return (
      <div className="mt-6 space-y-4" aria-busy="true" aria-label="Carregando carteiras" data-testid="wallets-skeleton">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (wallets.isError) {
    return (
      <div role="alert" className="mt-6 text-sm">
        <p>Não foi possível carregar as carteiras.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void wallets.refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }
  const bySlot = (slot: WalletSlot) => wallets.data.wallets.find((w) => w.slot === slot)
  return (
    <div className="mt-6 space-y-8">
      {(['primary', 'secondary'] as const).map((slot) => (
        <WalletForm key={`${slot}-${bySlot(slot)?.updatedAt ?? 'new'}`} slot={slot} wallet={bySlot(slot)} />
      ))}
    </div>
  )
}

type Values = { label: string; address: string; network: Network | ''; connector: WalletConnector | '' }

function WalletForm({ slot, wallet }: { slot: WalletSlot; wallet: Wallet | undefined }) {
  const save = useSaveWallet()
  const notify = useFeedback()
  const [editing, setEditing] = useState(slot === 'primary' || Boolean(wallet))
  const [values, setValues] = useState<Values>({
    label: wallet?.label ?? '',
    address: wallet?.address ?? '',
    network: wallet?.network ?? '',
    connector: wallet?.connector ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<(typeof FIELDS)[number], string>>>({})
  const titleId = `wallet-${slot}-title`

  function submit(event: FormEvent) {
    event.preventDefault()
    if (save.isPending) return
    const clientErrors = validateWallet(values)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return
    save.mutate(
      { slot, body: values as UpsertWalletRequest },
      {
        onSuccess: () => notify(`${SLOT_TITLES[slot]} salva.`, 'success'),
        onError: (error) => {
          const fieldErrors = apiFieldErrors(error, FIELDS)
          if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors)
          else notify(formErrorMessage(error), 'error')
        },
      },
    )
  }

  const set = (field: keyof Values, value: string) => setValues((current) => ({ ...current, [field]: value }))

  return (
    <section aria-labelledby={titleId} data-testid={`wallet-${slot}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={titleId} className="text-sm font-semibold">
          {SLOT_TITLES[slot]}
        </h2>
        {!editing && (
          <Button variant="link" size="sm" onClick={() => setEditing(true)}>
            Adicionar
          </Button>
        )}
      </div>
      {!editing ? (
        <p className="mt-1 text-xs text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-3 grid gap-4 sm:grid-cols-2" aria-labelledby={titleId}>
          <FormField label="Apelido da carteira" value={values.label} error={errors.label} onChange={(e) => set('label', e.target.value)} />
          <SelectField label="Tipo de carteira" value={values.connector} error={errors.connector} onChange={(v) => set('connector', v)}>
            <option value="">Selecione uma carteira</option>
            {WALLET_CONNECTORS.map((c) => (
              <option key={c} value={c}>
                {WALLET_CONNECTOR_LABELS[c]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Rede" value={values.network} error={errors.network} onChange={(v) => set('network', v)}>
            <option value="">Selecione uma rede</option>
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {NETWORK_LABELS[n]}
              </option>
            ))}
          </SelectField>
          <FormField
            label="Endereço da carteira"
            value={values.address}
            error={errors.address}
            placeholder={values.network === 'solana' ? 'Endereço base58' : 'Endereço 0x da carteira'}
            onChange={(e) => set('address', e.target.value)}
          />
          <div className="sm:col-span-2">
            <Button type="submit" aria-disabled={save.isPending || undefined}>
              {save.isPending ? 'Salvando…' : 'Salvar carteira'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

function SelectField({
  label,
  value,
  error,
  onChange,
  children,
}: {
  label: string
  value: string
  error: string | undefined
  onChange: (value: string) => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground/90">
        {label}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1.5 block h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
        >
          {children}
        </select>
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
