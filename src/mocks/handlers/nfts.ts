import { http, HttpResponse } from 'msw'
import { applyScenario, errorResponse } from '@/mocks/scenarios'
import { nftsTable } from '@/mocks/store/db'
import type { Nft } from '@/shared/contracts'

const base = import.meta.env.VITE_API_BASE_URL

export const nftHandlers = [
  http.get<{ nftId: string }>(`${base}/nfts/:nftId`, async ({ params }) => {
    const failure = await applyScenario()
    if (failure) return failure

    const nft = nftsTable.findById(params.nftId)
    if (!nft) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json<Nft>(nft)
  }),
]
