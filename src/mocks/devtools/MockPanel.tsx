import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Nft } from '@/shared/contracts'
import { addEth } from '@/shared/lib/eth'

/**
 * Demo-only controls for the simulated backend. It calls the MSW control endpoints,
 * which mutate the mock store and emit `nft.updated` through Socket.IO. The page
 * then updates via socket.io-client → Query cache, never through this component.
 */
export function MockPanel({ nft }: { nft: Nft }) {
  const [busy, setBusy] = useState(false)
  const edition = nft.editions[0]
  if (!edition) return null

  async function call(path: string, body?: unknown) {
    setBusy(true)
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/__mock${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? null : JSON.stringify(body),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside aria-label="Controles da simulação" className="mt-10 rounded-lg border border-dashed p-4 text-sm">
      <p className="font-medium">Simulação (MSW)</p>
      <p className="text-muted-foreground">Altera o backend simulado; a tela recebe o evento via Socket.IO.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void call(`/nfts/${nft.id}/editions/${edition.id}`, {
              priceEth: addEth(edition.priceEth, '0.01'),
              available: Math.max(edition.available - 1, 0),
            })
          }
        >
          Emitir nft.updated
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void call('/socket/disconnect')}>
          Derrubar conexão
        </Button>
      </div>
    </aside>
  )
}
