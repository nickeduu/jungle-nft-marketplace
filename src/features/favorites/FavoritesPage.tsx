import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/NftCard'
import { useSession } from '@/features/auth/session'
import { ProfileLayout } from '@/features/profile/ProfileLayout'
import { favoritesQuery } from './api'

/** "Lista de interesse" (Figma desktop-08 menu): the signed-in user's favorites. */
export function FavoritesPage() {
  const { user } = useSession()
  return (
    <ProfileLayout active="favorites">
      <h1 className="text-lg font-semibold">Lista de interesse</h1>
      {user && <FavoriteList userId={user.id} />}
    </ProfileLayout>
  )
}

const grid = 'mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3'

function FavoriteList({ userId }: { userId: string }) {
  const favorites = useQuery(favoritesQuery(userId))

  if (favorites.isPending) {
    return (
      <ul className={grid} aria-busy="true" aria-label="Carregando favoritos" data-testid="favorites-skeleton">
        {[0, 1, 2].map((i) => (
          <NftCardSkeleton key={i} />
        ))}
      </ul>
    )
  }
  if (favorites.isError) {
    return (
      <div role="alert" className="mt-6 text-sm">
        <p>Não foi possível carregar seus favoritos.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void favorites.refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }
  if (favorites.data.items.length === 0) {
    return (
      <div className="mt-6 text-sm text-muted-foreground" data-testid="favorites-empty">
        <p>Você ainda não favoritou nenhum NFT.</p>
        <Button asChild className="mt-4">
          <Link to="/" hash="catalogo">
            Explorar o catálogo
          </Link>
        </Button>
      </div>
    )
  }
  return (
    <>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="favorites-count">
        {favorites.data.items.length === 1 ? '1 NFT favoritado' : `${favorites.data.items.length} NFTs favoritados`}
      </p>
      <ul className={grid} data-testid="favorites-list">
        {favorites.data.items.map((nft) => (
          <NftCard key={nft.id} nft={nft} />
        ))}
      </ul>
    </>
  )
}
