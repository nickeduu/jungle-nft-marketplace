import { socketHandler } from '@/mocks/socket/server'
import { authHandlers } from './auth'
import { controlHandlers } from './control'
import { favoriteHandlers } from './favorites'
import { nftHandlers } from './nfts'

export const handlers = [...controlHandlers, ...authHandlers, ...favoriteHandlers, ...nftHandlers, socketHandler]
