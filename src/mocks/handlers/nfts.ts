import { http, HttpResponse } from 'msw'
import { applyScenario, errorResponse, isEmptyListScenario } from '@/mocks/scenarios'
import { reviewFixtures } from '@/mocks/fixtures/nfts'
import { nftsTable } from '@/mocks/store/db'
import type { Nft, NftFacets, NftReview, NftSummary, Paginated } from '@/shared/contracts'
import { buildFacets, highlights, parseListQuery, queryNfts } from './nft-query'

const base = import.meta.env.VITE_API_BASE_URL

/**
 * Like a real server, each handler reads the store FIRST and then pays the network latency
 * of the scenario: a response can be in transit while the data changes (and the matching
 * Socket.IO event arrives first). The client must reconcile that race (see apply-events.ts).
 */
// Static paths (facets, highlights) are registered before `/nfts/:nftId`.
export const nftHandlers = [
  http.get(`${base}/nfts/facets`, async () => {
    const body = buildFacets(nftsTable.list())
    return (await applyScenario('nft-facets')) ?? HttpResponse.json<NftFacets>(body)
  }),

  http.get(`${base}/nfts/highlights`, async () => {
    const body = highlights(isEmptyListScenario() ? [] : nftsTable.list())
    return (await applyScenario('nft-highlights')) ?? HttpResponse.json<NftSummary[]>(body)
  }),

  http.get(`${base}/nfts`, async ({ request }) => {
    const parsed = parseListQuery(new URL(request.url).searchParams)
    const body = parsed.ok ? queryNfts(isEmptyListScenario() ? [] : nftsTable.list(), parsed.query) : null

    const failure = await applyScenario('nft-list')
    if (failure) return failure
    if (!parsed.ok || !body) return errorResponse(422, 'VALIDATION_ERROR', 'Parâmetros de busca inválidos.', parsed.ok ? {} : parsed.fieldErrors)
    return HttpResponse.json<Paginated<NftSummary>>(body)
  }),

  http.get<{ nftId: string }>(`${base}/nfts/:nftId`, async ({ params }) => {
    const nft = nftsTable.findById(params.nftId)

    const failure = await applyScenario('nft-detail')
    if (failure) return failure
    if (!nft) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json<Nft>(nft)
  }),

  // Read-only collector reviews (fixtures); the aggregate lives in `Nft.rating`.
  http.get<{ nftId: string }>(`${base}/nfts/:nftId/reviews`, async ({ params }) => {
    const exists = nftsTable.findById(params.nftId) !== undefined

    const failure = await applyScenario('nft-reviews')
    if (failure) return failure
    if (!exists) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json<NftReview[]>(reviewFixtures[params.nftId] ?? [])
  }),
]
