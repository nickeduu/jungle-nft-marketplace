import { NftImage } from '@/features/nft-detail/components/NftImage'
import { NETWORK_LABELS, type Quote } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/eth'

/** "Seus NFTs" + values of the API quote (Figma desktop-04). The quote is what the order will use. */
export function QuoteSummary({ quote }: { quote: Quote }) {
  return (
    <div data-testid="quote-summary">
      <h2 className="flex justify-between border-b pb-2 text-sm font-semibold">
        Seus NFTs <span className="text-xs font-normal text-muted-foreground">Subtotal</span>
      </h2>
      <ul className="mt-3 space-y-2" aria-label="Itens do pedido" data-testid="checkout-items">
        {quote.lines.map((line) => (
          <li key={`${line.nftId}:${line.editionId}`} className="flex items-center gap-3 rounded-lg bg-card p-2 text-xs">
            <NftImage src={line.imageUrl} alt="" width={40} height={40} loading="lazy" className="size-10 rounded-md bg-muted object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{line.name}</span>
              <span className="text-muted-foreground">
                Edição {line.editionName} · {line.quantity} × {formatEth(line.unitPriceEth)}
              </span>
            </span>
            <span className="font-semibold text-primary">{formatEth(line.lineTotalEth)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1.5 text-sm">
        <Row label="Subtotal" value={formatEth(quote.subtotalEth)} />
        <Row label={quote.coupon ? `Desconto (${quote.coupon.code})` : 'Desconto do lançamento'} value={`(-) ${formatEth(quote.discountEth)}`} testId="quote-discount" />
        <Row label={`Taxa de rede (${NETWORK_LABELS[quote.network]})`} value={formatEth(quote.networkFeeEth)} testId="quote-fee" />
        <div className="flex items-baseline justify-between border-t pt-2 font-semibold">
          <dt>Total</dt>
          <dd className="text-primary" data-testid="checkout-total">
            {formatEth(quote.totalEth)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd data-testid={testId}>{value}</dd>
    </div>
  )
}
