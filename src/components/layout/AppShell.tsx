import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { useRealtimeStatus } from '@/services/realtime/RealtimeProvider'

const STATUS_LABEL = {
  connecting: 'Conectando…',
  connected: 'Tempo real conectado',
  disconnected: 'Tempo real desconectado',
} as const

export function AppShell({ children }: { children: ReactNode }) {
  const status = useRealtimeStatus()
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="font-semibold">
            NFT Marketplace
          </Link>
          <Badge variant={status === 'connected' ? 'default' : 'outline'} data-testid="realtime-status" data-status={status}>
            {STATUS_LABEL[status]}
          </Badge>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4">{children}</main>
    </div>
  )
}
