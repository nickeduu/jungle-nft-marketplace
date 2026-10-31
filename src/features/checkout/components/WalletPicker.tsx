import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError } from '@/services/api/http'
import { NETWORK_LABELS, WALLET_CONNECTOR_LABELS, type Wallet, type WalletsResponse } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { useConnectWallet, useDisconnectWallet } from '@/features/wallets/api'

const shortAddress = (address: string) => (address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address)

/**
 * "Carteira e rede" (Figma desktop-04 / mobile-04): the user's registered wallets as radios and a
 * simulated connection of the selected one (the connector may refuse; it can be disconnected).
 */
export function WalletPicker({
  data,
  selectedId,
  onSelect,
  error,
}: {
  data: WalletsResponse
  selectedId: string | null
  onSelect: (wallet: Wallet) => void
  error: string | undefined
}) {
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const [connectionError, setConnectionError] = useState('')
  const selected = data.wallets.find((w) => w.id === selectedId)
  const connected = selected !== undefined && data.connectedWalletId === selected.id

  if (data.wallets.length === 0) {
    return (
      <p className="mt-2 text-sm text-muted-foreground" role="alert">
        Você não tem carteiras cadastradas.{' '}
        <Link to="/wallets" className="text-primary underline underline-offset-4">
          Cadastrar carteira
        </Link>
      </p>
    )
  }

  return (
    <fieldset aria-describedby={error ? 'wallet-error' : undefined}>
      <legend className="text-sm font-semibold">Carteira</legend>
      <div className="mt-2 space-y-2">
        {data.wallets.map((wallet) => (
          <label
            key={wallet.id}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-xs has-checked:border-primary has-focus-visible:ring-2 has-focus-visible:ring-ring',
            )}
            data-testid="wallet-option"
          >
            <input
              type="radio"
              name="wallet"
              value={wallet.id}
              checked={wallet.id === selectedId}
              onChange={() => {
                setConnectionError('')
                onSelect(wallet)
              }}
              className="size-4 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{wallet.label}</span>
              <span className="block text-muted-foreground">
                {shortAddress(wallet.address)} · Rede {NETWORK_LABELS[wallet.network]}
              </span>
            </span>
            <span className="text-muted-foreground">{WALLET_CONNECTOR_LABELS[wallet.connector]}</span>
            {data.connectedWalletId === wallet.id && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Conectada</span>}
          </label>
        ))}
      </div>

      {selected && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span data-testid="wallet-connection" data-connected={connected}>
            {connected ? `${selected.label} conectada via ${WALLET_CONNECTOR_LABELS[selected.connector]}.` : `${selected.label} não está conectada.`}
          </span>
          {connected ? (
            <button
              type="button"
              aria-disabled={disconnect.isPending || undefined}
              onClick={() => !disconnect.isPending && disconnect.mutate()}
              className="text-primary underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              aria-disabled={connect.isPending || undefined}
              aria-busy={connect.isPending || undefined}
              onClick={() => {
                if (connect.isPending) return
                setConnectionError('')
                connect.mutate(selected.slot, {
                  onError: (e) =>
                    setConnectionError(e instanceof ApiError && e.code === 'WALLET_REJECTED' ? e.message : 'Não foi possível conectar a carteira. Tente novamente.'),
                })
              }}
              className="rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-busy:opacity-70"
            >
              {connect.isPending ? 'Conectando…' : `Conectar ${WALLET_CONNECTOR_LABELS[selected.connector]}`}
            </button>
          )}
        </div>
      )}
      <p role="alert" className="mt-2 text-xs text-danger empty:hidden" data-testid="wallet-feedback">
        {connectionError || error}
      </p>
      <p id="wallet-error" className="sr-only">
        {error}
      </p>
    </fieldset>
  )
}
