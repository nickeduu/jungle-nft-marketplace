/**
 * Purchase actions that depend on later stages (cart, checkout). They stay visible as in the
 * Figma but explain, on activation, why they are unavailable — never a fake success.
 * (Favorites are live since the session stage: see features/favorites.)
 */
export type UnavailableAction = 'buy' | 'cart'

export const UNAVAILABLE_MESSAGES: Record<UnavailableAction, string> = {
  buy: 'Compra indisponível nesta versão: requer login e carrinho.',
  cart: 'Carrinho indisponível nesta versão.',
}

export const UNAVAILABLE_HINT = 'Compra e carrinho indisponíveis nesta versão.'
