import type { Network, Nft, NftAttribute, NftCategory, NftEdition, NftRating, NftReview, NftTag } from '@/shared/contracts'
import { NETWORK_LABELS } from '@/shared/contracts'
import { addEth } from '@/shared/lib/eth'
import { apeImages, apeTraits } from './nft-art'

/**
 * Deterministic seed data: fixed ids, prices, stock, tags and dates, so tests and visual
 * baselines are stable. No randomness — generated items derive from their index.
 * Labels follow the Figma sidebar; "Emerald Ape #042" reproduces the Figma detail frame.
 * Each NFT has its own original ape character (public/images/nfts/<id>/, drawn by
 * scripts/generate-nft-art.mjs from ./nft-art.ts); the "Acessório" and "Paleta" attributes
 * come from the same traits.
 */
export const categoryFixtures: NftCategory[] = [
  { id: 'digital-art', label: 'Arte digital' },
  { id: 'photography', label: 'Fotografia' },
  { id: 'music', label: 'Música' },
  { id: '3d-art', label: 'Arte 3D' },
  { id: 'collectibles', label: 'Colecionáveis' },
  { id: 'generative', label: 'Generativa' },
  { id: 'games', label: 'Jogos' },
  { id: 'subscriptions', label: 'Assinaturas' },
  { id: 'utility', label: 'Utilidade' },
]

export const networkLabels: Record<Network, string> = NETWORK_LABELS

const AVATAR = '/images/placeholder-avatar.svg'
const NETWORK_CYCLE: Network[] = ['ethereum', 'polygon', 'solana']
const ROYALTY_PERCENT = 5

/** Accessory and palette attributes of the NFT's character, plus its rarity. */
function artAttributes(nftId: string, rarity: 'Raro' | 'Comum'): NftAttribute[] {
  const traits = apeTraits[nftId]
  if (!traits) throw new Error(`Missing artwork traits for ${nftId}`)
  return [
    { trait: 'Acessório', value: traits.accessoryLabel },
    { trait: 'Paleta', value: traits.paletteLabel },
    { trait: 'Raridade', value: rarity },
  ]
}

const creators = ['Animakid', 'NebulaKid', 'Keepitreal', 'MrFox', 'Shroomie', 'Robotica']

const names = [
  'Emerald Ape #042', 'Sage Nomad #009', 'Neon Vessel #552', 'Cosmic Bloom #118', 'Violet Nomad #314',
  'Ivory Baron #088', 'Golden Beat #207', 'Golden Frequency #071', 'Golden Signal #160', 'Copper Monk #233',
  'Velvet Ape #019', 'Amber Drifter #401', 'Jade Sentinel #077', 'Rust Pilot #128', 'Onyx Dreamer #305',
  'Saffron Echo #064', 'Cobalt Rider #219', 'Pearl Oracle #150', 'Ember Scout #093', 'Moss Wanderer #276',
  'Crimson Bard #188', 'Silver Tide #047', 'Bronze Keeper #362', 'Indigo Rebel #011', 'Hazel Vision #245',
  'Ochre Signal #133', 'Tawny Baron #099', 'Lilac Nomad #327', 'Mint Frequency #056', 'Umber Ape #412',
]

const collections = ['Kurio Apes', 'Kurio Editions', 'Golden Sounds', 'Nomad Club']

/** Prices as exact decimal strings (never computed with floats). */
const prices = ['1.19', '1.69', '1.99', '1.29', '1.39', '1.79', '0.99', '0.39', '0.39', '2.45', '0.02', '12.3']

const reviewers = ['Lia Moreno', 'Caio Tanaka', 'Marina Duarte', 'Rafa Okoye', 'Bea Lindqvist', 'Téo Ramos', 'Nina Sato', 'Gui Ferraz']
const reviewComments = [
  'Arte impecável e procedência clara. A edição chegou à carteira em minutos.',
  'Os detalhes em alta resolução valem a compra. Recomendo a coleção.',
  'Gostei do acesso aos lançamentos exclusivos para colecionadores.',
  'Ótimo trabalho do criador; metadados completos e verificados.',
  'Peça bonita, mas esperava mais atributos raros nesta edição.',
]

function seededDate(index: number): string {
  // One day apart, newest = highest index.
  return new Date(Date.UTC(2026, 0, 1 + index, 12)).toISOString()
}

function tagsFor(index: number): NftTag[] {
  const tags: NftTag[] = []
  if (index >= names.length - 8) tags.push('new')
  if (index % 3 === 1) tags.push('trending')
  if (index % 5 === 2) tags.push('rare')
  if (index === 0 || index === 4) tags.push('featured')
  return tags
}

/** "#042" → "#0042". */
function tokenIdFrom(name: string, fallback: number): string {
  const digits = name.split('#')[1] ?? String(fallback)
  return `#${digits.padStart(4, '0')}`
}

/** Deterministic 40-hex-digit address derived from the index. */
function contractAddress(index: number): string {
  const word = ((index + 1) * 2654435761) >>> 0
  return `0x${word.toString(16).padStart(8, '0').repeat(5)}`
}

function buildReviews(nftId: string, count: number, firstDayIndex: number): NftReview[] {
  return Array.from({ length: count }, (_, j) => ({
    id: `${nftId}-review-${j + 1}`,
    author: reviewers[(firstDayIndex + j) % reviewers.length] ?? 'Colecionador',
    rating: j % 5 === 4 ? 4 : 5,
    comment: reviewComments[(firstDayIndex + j) % reviewComments.length] ?? '',
    createdAt: new Date(Date.UTC(2026, 1, 1 + j, 15)).toISOString(),
  }))
}

function summarize(reviews: NftReview[]): NftRating {
  if (reviews.length === 0) return { average: 0, count: 0 }
  const sum = reviews.reduce((total, r) => total + r.rating, 0)
  return { average: Math.round((sum * 10) / reviews.length) / 10, count: reviews.length }
}

/** Read-only collector reviews by NFT id (served by GET /api/nfts/:id/reviews). */
export const reviewFixtures: Record<string, NftReview[]> = {}

function withReviews(nft: Omit<Nft, 'rating'>, reviewCount: number, seed: number): Nft {
  const reviews = buildReviews(nft.id, reviewCount, seed)
  reviewFixtures[nft.id] = reviews
  return { ...nft, rating: summarize(reviews) }
}

function longDescriptionFor(name: string, collection: string, network: Network, creator: string): string {
  return [
    `${name} é uma obra digital finalizada à mão da coleção ${collection}. Cada atributo fica armazenado nos metadados do token e verificado na ${networkLabels[network]}.`,
    `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência na rede. ${creator} recebe ${ROYALTY_PERCENT}% de direitos autorais nas vendas secundárias.`,
  ].join('\n\n')
}

/** Content transcribed from the Figma detail frame (desktop-02 / mobile-02). */
const FIGMA_EMERALD_APE = {
  description:
    'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
  longDescription: [
    'Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.',
    'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrado na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
  ].join('\n\n'),
  rarity: 'Raro' as const,
  contractAddress: '0x7442a1c9e05b3d8f6a2c4e7b9d1f3a5c8e0b19e8',
  reviewCount: 19,
}

function generated(index: number): Nft {
  const id = `nft-${String(index + 1).padStart(3, '0')}`
  const name = names[index] ?? `NFT ${index + 1}`
  const collection = collections[index % collections.length] ?? 'Kurio Apes'
  // floor(i/2) decorrelates network from category (9 categories would align with 3 networks).
  const network = NETWORK_CYCLE[Math.floor(index / 2) % NETWORK_CYCLE.length] ?? 'ethereum'
  const creator = creators[index % creators.length] ?? 'Animakid'
  const tags = tagsFor(index)
  const priceA = prices[index % prices.length] ?? '1'
  const priceB = prices[(index + 5) % prices.length] ?? '2'
  // Every 4th item is fully sold out. Extra editions never lower the cheapest price nor
  // add stock to sold-out items, so catalog filters, facets and sorting are unaffected.
  const soldOut = index % 4 === 3
  const editions: NftEdition[] = []
  if (index % 3 === 0) {
    editions.push(
      { id: 'ed-unique', name: '1/1', priceEth: addEth(priceA, priceB), available: soldOut ? 0 : 1, supply: 1, maxPerOrder: 1 },
      { id: 'ed-gold', name: '1/10', priceEth: priceB, available: soldOut ? 0 : 1, supply: 10, maxPerOrder: 1 },
    )
  }
  editions.push({ id: 'ed-standard', name: '1/50', priceEth: priceA, available: soldOut ? 0 : 3 + (index % 7), supply: 50, maxPerOrder: 5 })
  if (index % 2 === 0) {
    editions.push({ id: 'ed-open', name: 'Aberta', priceEth: priceA, available: soldOut ? 0 : 25 + index, supply: null, maxPerOrder: 10 })
  }

  const figma = index === 0 ? FIGMA_EMERALD_APE : null
  return withReviews(
    {
      id,
      tokenId: tokenIdFrom(name, index + 1),
      name,
      description:
        figma?.description ??
        `Um colecionável digital finalizado à mão da coleção ${collection}, verificado na ${networkLabels[network]}.`,
      longDescription: figma?.longDescription ?? longDescriptionFor(name, collection, network, creator),
      collection,
      category: categoryFixtures[index % categoryFixtures.length]?.id ?? 'digital-art',
      network,
      tags,
      creator: { id: `creator-${creator.toLowerCase()}`, name: creator, avatarUrl: AVATAR },
      attributes: artAttributes(id, figma?.rarity ?? (tags.includes('rare') ? 'Raro' : 'Comum')),
      contract: { address: figma?.contractAddress ?? contractAddress(index), standard: 'ERC-721' },
      royaltyPercent: ROYALTY_PERCENT,
      images: apeImages(id),
      editions,
      version: 1,
      createdAt: seededDate(index),
      updatedAt: seededDate(index),
    },
    figma?.reviewCount ?? 3 + ((index * 7) % 20),
    index,
  )
}

export const nftFixtures: Nft[] = [
  withReviews(
    {
      id: 'nft-distant-galaxy',
      tokenId: '#0001',
      name: 'Distant Galaxy',
      description: 'Um primata astronauta flutuando diante de uma nebulosa, cunhado em série limitada.',
      longDescription: longDescriptionFor('Distant Galaxy', 'Space Walking', 'ethereum', 'Animakid'),
      collection: 'Space Walking',
      category: 'digital-art',
      network: 'ethereum',
      tags: ['featured', 'trending'],
      creator: { id: 'creator-animakid', name: 'Animakid', avatarUrl: AVATAR },
      attributes: artAttributes('nft-distant-galaxy', 'Raro'),
      contract: { address: contractAddress(100), standard: 'ERC-721' },
      royaltyPercent: ROYALTY_PERCENT,
      images: apeImages('nft-distant-galaxy'),
      editions: [
        { id: 'ed-genesis', name: '1/1', priceEth: '12.5', available: 0, supply: 1, maxPerOrder: 1 },
        { id: 'ed-gold', name: '1/10', priceEth: '4.2', available: 1, supply: 10, maxPerOrder: 1 },
        { id: 'ed-standard', name: '1/50', priceEth: '1.63', available: 12, supply: 50, maxPerOrder: 5 },
      ],
      version: 1,
      createdAt: '2025-12-20T12:00:00.000Z',
      updatedAt: '2025-12-20T12:00:00.000Z',
    },
    12,
    100,
  ),
  withReviews(
    {
      id: 'nft-life-on-edena',
      tokenId: '#0002',
      name: 'Life On Edena',
      description: 'Um explorador com coroa de flores bioluminescentes de um exoplaneta imaginário.',
      longDescription: longDescriptionFor('Life On Edena', 'Edena', 'polygon', 'NebulaKid'),
      collection: 'Edena',
      category: 'photography',
      network: 'polygon',
      tags: [],
      creator: { id: 'creator-nebulakid', name: 'NebulaKid', avatarUrl: AVATAR },
      attributes: artAttributes('nft-life-on-edena', 'Comum'),
      contract: { address: contractAddress(101), standard: 'ERC-1155' },
      royaltyPercent: ROYALTY_PERCENT,
      images: apeImages('nft-life-on-edena'),
      editions: [{ id: 'ed-standard', name: '1/100', priceEth: '0.33', available: 40, supply: 100, maxPerOrder: 10 }],
      version: 1,
      createdAt: '2025-12-19T12:00:00.000Z',
      updatedAt: '2025-12-19T12:00:00.000Z',
    },
    0,
    101,
  ),
  ...names.map((_, index) => generated(index)),
]
