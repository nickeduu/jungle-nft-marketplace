import { http, passthrough } from 'msw'
import { socketHandler } from '@/mocks/socket/server'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { checkoutHandlers } from './checkout'
import { controlHandlers } from './control'
import { favoriteHandlers } from './favorites'
import { nftHandlers } from './nfts'
import { walletHandlers } from './wallets'

const apiBase = import.meta.env.VITE_API_BASE_URL

/**
 * The worker forwards every request of the page to these handlers — JS chunks, artworks and
 * fonts included. MSW 2 parses handlers in sequence (cookies + path matching) until one
 * matches, so a non-API request would go through all of them before falling through.
 * This first handler lets those requests pass straight to the network.
 */
const staticAssets = http.all(({ request }) => !new URL(request.url).pathname.startsWith(apiBase), () => passthrough())

/**
 * API paths are disjoint, so their order only affects cost: the busiest endpoints come first
 * and the test-only control endpoints last.
 */
export const handlers = [staticAssets, ...nftHandlers, ...authHandlers, ...cartHandlers, ...favoriteHandlers, ...walletHandlers, ...checkoutHandlers, ...controlHandlers, socketHandler]
