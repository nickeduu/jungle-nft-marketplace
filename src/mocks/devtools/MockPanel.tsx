import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { NftEdition } from '@/shared/contracts'
import { addEth } from '@/shared/lib/eth'

/**
 * Demo-only controls for the simulated backend, in a drawer so they never take space in the
 * page layout. They call the MSW control endpoints, which mutate the mock store and emit
 * `nft.updated` through Socket.IO. The page then updates via socket.io-client → Query cache,
 * never through this component.
 */
export function MockPanel({ nftId, edition }: { nftId: string; edition: NftEdition }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  async function call(label: string, path: string, body?: unknown) {
    setBusy(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/__mock${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? null : JSON.stringify(body),
      })
      setResult(response.ok ? `${label}: enviado.` : `${label}: falhou (HTTP ${response.status}).`)
    } catch {
      setResult(`${label}: falha de rede.`)
    } finally {
      setBusy(false)
    }
  }

  const editionPath = `/nfts/${nftId}/editions/${edition.id}`

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-10 text-xs text-muted-foreground">
          <FlaskConical aria-hidden="true" />
          Simulação (MSW)
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="gap-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Simulação (MSW)</SheetTitle>
          <SheetDescription>
            Altera o backend simulado da edição {edition.name}; a página recebe o evento <code>nft.updated</code> via Socket.IO.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 p-4">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void call('Preço +0,01 e estoque −1', editionPath, {
                priceEth: addEth(edition.priceEth, '0.01'),
                available: Math.max(edition.available - 1, 0),
              })
            }
          >
            Preço +0,01 e estoque −1
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void call('Estoque = 1', editionPath, { available: 1 })}>
            Reduzir estoque para 1
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void call('Esgotar edição', editionPath, { available: 0 })}>
            Esgotar edição
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void call('Repor estoque', editionPath, { available: edition.available + 5 })}>
            Repor estoque (+5)
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void call('Derrubar conexão', '/socket/disconnect')}>
            Derrubar conexão Socket.IO
          </Button>
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {result}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
