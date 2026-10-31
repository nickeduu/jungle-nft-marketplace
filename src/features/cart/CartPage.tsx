import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeft, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Cart } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { CART_COLUMNS, CartItemRow } from './components/CartItemRow'
import { CartSummary } from './components/CartSummary'
import { useCart } from './hooks'

const unitsLabel = (count: number) => (count === 1 ? '1 item' : `${count} itens`)

/** Cart (Figma desktop-03 / mobile-03). Works for visitors and signed-in users. */
export function CartPage() {
  const cart = useCart()
  const data: Cart | undefined = cart.data
  const { cartKey } = cart

  return (
    <section aria-labelledby="cart-title" className="py-4 md:py-8">
      <Header count={data?.itemCount} />
      {cart.isEmptyVisitor || (data && data.items.length === 0) ? (
        <EmptyCart />
      ) : cart.isError ? (
        <div role="alert" className="mt-8 text-sm">
          <p>Não foi possível carregar o carrinho.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void cart.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : !data || !cartKey ? (
        <CartSkeleton />
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-10">
          <div className="min-w-0">
            <div aria-hidden="true" className={cn('hidden border-b px-4 pb-2 text-xs font-semibold md:grid md:gap-x-4', CART_COLUMNS)}>
              <span>NFTs</span>
              <span>Preço</span>
              <span>Quantidade</span>
              <span>Total</span>
              <span />
            </div>
            <ul aria-label="Itens do carrinho" className="mt-3 space-y-3" data-testid="cart-items">
              {data.items.map((item) => (
                <CartItemRow key={item.id} item={item} cartKey={cartKey} />
              ))}
            </ul>
          </div>
          <CartSummary cart={data} />
        </div>
      )}
    </section>
  )
}

function Header({ count }: { count: number | undefined }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <>
      <nav aria-label="Trilha de navegação" className="hidden text-xs md:block">
        <ol className="flex items-center gap-1.5 text-muted-foreground">
          <li>
            <Link to="/" className="hover:text-primary">
              Início
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/" hash="catalogo" className="hover:text-primary">
              Mercado
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            Carrinho
          </li>
        </ol>
      </nav>
      <div className="flex items-center gap-3 md:mt-4">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => (canGoBack ? router.history.back() : void router.navigate({ to: '/' }))}
          className="grid size-10 place-items-center rounded-full border bg-card text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <h1 id="cart-title" className="text-lg font-semibold md:text-xl">
          Carrinho de NFTs
        </h1>
        {count !== undefined && count > 0 && (
          <p className="text-xs text-muted-foreground" data-testid="cart-count">
            {unitsLabel(count)}
          </p>
        )}
      </div>
    </>
  )
}

function EmptyCart() {
  return (
    <div className="mx-auto mt-10 flex max-w-sm flex-col items-center text-center" data-testid="cart-empty">
      <span className="grid size-20 place-items-center rounded-full bg-card text-primary" aria-hidden="true">
        <ShoppingCart className="size-9" />
      </span>
      <h2 className="mt-5 text-base font-semibold">Seu carrinho está vazio</h2>
      <p className="mt-2 text-sm text-muted-foreground">Explore o catálogo e adicione NFTs para vê-los aqui.</p>
      <Button asChild className="mt-6">
        <Link to="/" hash="catalogo">
          Explorar NFTs
        </Link>
      </Button>
    </div>
  )
}

/** Same footprint as the loaded list + summary. */
function CartSkeleton() {
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-10" aria-busy="true" aria-label="Carregando carrinho" data-testid="cart-skeleton">
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl md:h-16 md:rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-3xl md:rounded-lg" />
    </div>
  )
}
