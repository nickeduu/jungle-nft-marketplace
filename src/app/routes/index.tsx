import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

/** Temporary home: the full catalog is built in the next stage. */
export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <section className="py-16">
      <h1 className="text-3xl font-semibold">NFT Marketplace</h1>
      <p className="mt-2 text-muted-foreground">Fundação técnica — demonstração da integração.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/nfts/$nftId" params={{ nftId: 'nft-distant-galaxy' }}>
            Ver NFT de demonstração
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/nfts/$nftId" params={{ nftId: 'nao-existe' }}>
            NFT inexistente
          </Link>
        </Button>
      </div>
    </section>
  )
}
