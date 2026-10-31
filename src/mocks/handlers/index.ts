import { socketHandler } from '@/mocks/socket/server'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { checkoutHandlers } from './checkout'
import { controlHandlers } from './control'
import { favoriteHandlers } from './favorites'
import { nftHandlers } from './nfts'
import { walletHandlers } from './wallets'

export const handlers = [...controlHandlers, ...authHandlers, ...favoriteHandlers, ...cartHandlers, ...walletHandlers, ...checkoutHandlers, ...nftHandlers, socketHandler]
