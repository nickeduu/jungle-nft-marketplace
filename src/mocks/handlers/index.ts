import { socketHandler } from '@/mocks/socket/server'
import { controlHandlers } from './control'
import { nftHandlers } from './nfts'

export const handlers = [...controlHandlers, ...nftHandlers, socketHandler]
