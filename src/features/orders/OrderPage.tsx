import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/session'
import { orderQuery } from '@/features/checkout/api'
import { NftImage } from '@/features/nft-detail/components/NftImage'
import { ApiError } from '@/services/api/http'
import { NETWORK_LABELS, WALLET_CONNECTOR_LABELS, type Order } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/eth'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`

/**
 * Order status and receipt. The status comes only from the API (GET + private `order.updated`
 * through Socket.IO): "confirmed" is shown when the API says so. The receipt renders the order
 * snapshot — later catalog changes never alter it. Refresh, reconnection and reopening the app
 * recover the same order (the URL holds its id).
 */
export function OrderPage({ orderId }: { orderId: string }) {
  const { user } = useSession()
  if (!user) return null
  return <OrderView userId={user.id} orderId={orderId} />
}

function OrderView({ userId, orderId }: { userId: string; orderId: string }) {
  const order = useQuery(orderQuery(userId, orderId))

  if (order.isPending) {
    return (
      <div className="mx-auto max-w-xl py-10" aria-busy="true" aria-label="Carregando pedido" data-testid="order-skeleton">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    )
  }
  if (order.isError) {
    const notFound = order.error instanceof ApiError && order.error.code === 'NOT_FOUND'
    return (
      <div role="alert" className="py-16 text-center">
        <h1 className="text-xl font-semibold">{notFound ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}</h1>
        {!notFound && (
          <Button className="mt-4" onClick={() => void order.refetch()}>
            Tentar novamente
          </Button>
        )}
      </div>
    )
  }

  const data = order.data
  return (
    <section aria-labelledby="order-title" className="mx-auto max-w-2xl py-6 md:py-10" data-testid="order-page" data-status={data.status}>
      {/* The status line is a live region: pending → confirmed/refused is announced. */}
      <div role="status" className="text-center" data-testid="order-status">
        {data.status === 'pending' && (
          <>
            <Clock className="mx-auto size-10 text-primary motion-safe:animate-pulse" aria-hidden="true" />
            <h1 id="order-title" className="mt-3 text-lg font-semibold">
              Aguardando confirmação do pagamento
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Pedido {data.id}. Você pode fechar ou recarregar esta página: o pedido continua sendo processado e não será duplicado.
            </p>
          </>
        )}
        {data.status === 'confirmed' && (
          <>
            <CheckCircle2 className="mx-auto size-10 text-primary" aria-hidden="true" />
            <h1 id="order-title" className="mt-3 text-lg font-semibold">
              Seus NFTs agora estão na sua carteira
            </h1>
          </>
        )}
        {data.status === 'rejected' && (
          <>
            <XCircle className="mx-auto size-10 text-danger" aria-hidden="true" />
            <h1 id="order-title" className="mt-3 text-lg font-semibold">
              Pagamento recusado
            </h1>
            <p className="mt-1 text-sm" data-testid="order-rejection">
              {data.rejectionReason}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Nada foi cobrado e seus itens continuam no carrinho.</p>
          </>
        )}
      </div>

      <Receipt order={data} />

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        {data.status === 'rejected' && (
          <Button asChild>
            <Link to="/cart">Voltar ao carrinho</Link>
          </Button>
        )}
        <Button asChild variant={data.status === 'rejected' ? 'outline' : 'default'}>
          <Link to="/" hash="catalogo">
            Continuar explorando
          </Link>
        </Button>
      </div>
    </section>
  )
}

/** Figma desktop-05: transaction header, item table, fee and total — all from the order snapshot. */
function Receipt({ order }: { order: Order }) {
  const [explorerOpen, setExplorerOpen] = useState(false)
  return (
    <div className="mt-6 rounded-xl border bg-card" data-testid="order-receipt">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl border-b text-xs sm:grid-cols-4">
        <Head label="ID da transação" value={order.txHash ? short(order.txHash) : '—'} testId="order-tx" />
        <Head label="Data" value={dateFormat.format(new Date(order.createdAt))} />
        <Head label="Total" value={formatEth(order.totalEth)} testId="order-total" />
        <Head label="Carteira" value={`${order.walletLabel} (${WALLET_CONNECTOR_LABELS[order.walletConnector]})`} />
      </dl>
      <div className="p-4">
        <h2 className="text-sm font-semibold">Detalhes da transação</h2>
        <ul className="mt-3 space-y-2" aria-label="Itens comprados" data-testid="order-items">
          {order.lines.map((line) => (
            <li key={`${line.nftId}:${line.editionId}`} className="flex items-center gap-3 text-xs">
              <NftImage src={line.imageUrl} alt="" width={40} height={40} className="size-10 rounded-md bg-muted object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{line.name}</span>
                <span className="text-muted-foreground">
                  ID do token: {line.tokenId} · Edição {line.editionName} · {line.quantity} × {formatEth(line.unitPriceEth)}
                </span>
              </span>
              <span className="shrink-0 text-right font-semibold text-primary">{formatEth(line.lineTotalEth)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
          <Row label="Subtotal" value={formatEth(order.subtotalEth)} />
          <Row label={order.coupon ? `Desconto (${order.coupon.code})` : 'Desconto'} value={`(-) ${formatEth(order.discountEth)}`} />
          <Row label={`Taxa de rede (${NETWORK_LABELS[order.network]})`} value={formatEth(order.networkFeeEth)} />
          <Row label="Total" value={formatEth(order.totalEth)} strong />
        </dl>
        {order.status === 'confirmed' && order.txHash && (
          <div className="mt-4 text-center text-xs text-muted-foreground">
            <p>
              Transação confirmada na rede {NETWORK_LABELS[order.network]} (simulação). A propriedade foi registrada para a carteira{' '}
              {short(order.walletAddress)}.
            </p>
            <Button size="sm" className="mt-3" aria-expanded={explorerOpen} aria-controls="explorer-panel" onClick={() => setExplorerOpen((v) => !v)}>
              Ver no explorador (simulado)
            </Button>
            {explorerOpen && (
              <dl id="explorer-panel" className="mx-auto mt-3 max-w-md space-y-1 rounded-md border bg-background p-3 text-left break-all" data-testid="explorer-panel">
                <Row label="Hash" value={order.txHash} />
                <Row label="Rede" value={NETWORK_LABELS[order.network]} />
                <Row label="Estado" value="Confirmada" />
                <p className="pt-1 text-[11px]">Referência simulada: não existe em uma blockchain real.</p>
              </dl>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Head({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="bg-card px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold" data-testid={testId}>
        {value}
      </dd>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between gap-4 font-semibold' : 'flex justify-between gap-4'}>
      <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd className={strong ? 'text-primary' : ''}>{value}</dd>
    </div>
  )
}
