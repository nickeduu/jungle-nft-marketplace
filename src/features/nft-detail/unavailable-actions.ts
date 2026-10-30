/**
 * Purchase-related actions that depend on later stages (session, cart, checkout). They stay
 * visible as in the Figma but explain, on activation, why they are unavailable — never a fake success.
 */
export type UnavailableAction = 'buy' | 'cart' | 'favorite'

export const UNAVAILABLE_MESSAGES: Record<UnavailableAction, string> = {
  buy: 'Compra indisponível nesta versão: requer login e carrinho.',
  cart: 'Carrinho indisponível nesta versão.',
  favorite: 'Favoritos indisponíveis nesta versão: requer login.',
}

export const UNAVAILABLE_HINT = 'Indisponível nesta versão: compra, carrinho e favoritos exigem login.'
