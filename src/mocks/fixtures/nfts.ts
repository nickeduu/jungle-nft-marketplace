import type { Network, Nft, NftCategory, NftEdition, NftTag } from '@/shared/contracts'

/**
 * Deterministic seed data: fixed ids, prices, stock, tags and dates, so tests and visual
 * baselines are stable. No randomness — generated items derive from their index.
 * Labels follow the Figma sidebar. Images are placeholders until the original assets
 * are available (see ARCHITECTURE.md).
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

export const networkLabels: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

const IMAGE = '/images/placeholder-nft.svg'
const AVATAR = '/images/placeholder-avatar.svg'
const NETWORK_CYCLE: Network[] = ['ethereum', 'polygon', 'solana']

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

function generated(index: number): Nft {
  const id = `nft-${String(index + 1).padStart(3, '0')}`
  const priceA = prices[index % prices.length] ?? '1'
  const priceB = prices[(index + 5) % prices.length] ?? '2'
  // Every 4th item is fully sold out; every 3rd has two editions.
  const soldOut = index % 4 === 3
  const editions: NftEdition[] = [
    { id: 'ed-standard', name: '1/50', priceEth: priceA, available: soldOut ? 0 : 3 + (index % 7), supply: 50, maxPerOrder: 5 },
  ]
  if (index % 3 === 0) {
    editions.push({ id: 'ed-gold', name: '1/10', priceEth: priceB, available: soldOut ? 0 : 1, supply: 10, maxPerOrder: 1 })
  }
  const creator = creators[index % creators.length] ?? 'Animakid'
  return {
    id,
    name: names[index] ?? `NFT ${index + 1}`,
    description: 'Um colecionável digital finalizado à mão, verificado na rede e com metadados simulados.',
    collection: collections[index % collections.length] ?? 'Kurio Apes',
    category: categoryFixtures[index % categoryFixtures.length]?.id ?? 'digital-art',
    // floor(i/2) decorrelates network from category (9 categories would align with 3 networks).
    network: NETWORK_CYCLE[Math.floor(index / 2) % NETWORK_CYCLE.length] ?? 'ethereum',
    tags: tagsFor(index),
    creator: { id: `creator-${creator.toLowerCase()}`, name: creator, avatarUrl: AVATAR },
    images: [IMAGE],
    editions,
    version: 1,
    createdAt: seededDate(index),
    updatedAt: seededDate(index),
  }
}

export const nftFixtures: Nft[] = [
  {
    id: 'nft-distant-galaxy',
    name: 'Distant Galaxy',
    description: 'A nebula rendered in procedural light, minted as a limited series.',
    collection: 'Space Walking',
    category: 'digital-art',
    network: 'ethereum',
    tags: ['featured', 'trending'],
    creator: { id: 'creator-animakid', name: 'Animakid', avatarUrl: AVATAR },
    images: [IMAGE],
    editions: [
      { id: 'ed-standard', name: 'Standard', priceEth: '1.63', available: 12, supply: 50, maxPerOrder: 5 },
      { id: 'ed-gold', name: 'Gold', priceEth: '4.2', available: 1, supply: 5, maxPerOrder: 1 },
      { id: 'ed-genesis', name: 'Genesis', priceEth: '12.5', available: 0, supply: 1, maxPerOrder: 1 },
    ],
    version: 1,
    createdAt: '2025-12-20T12:00:00.000Z',
    updatedAt: '2025-12-20T12:00:00.000Z',
  },
  {
    id: 'nft-life-on-edena',
    name: 'Life On Edena',
    description: 'Bioluminescent flora from an imagined exoplanet.',
    collection: 'Edena',
    category: 'photography',
    network: 'polygon',
    tags: [],
    creator: { id: 'creator-nebulakid', name: 'NebulaKid', avatarUrl: AVATAR },
    images: [IMAGE],
    editions: [{ id: 'ed-standard', name: 'Standard', priceEth: '0.33', available: 40, supply: 100, maxPerOrder: 10 }],
    version: 1,
    createdAt: '2025-12-19T12:00:00.000Z',
    updatedAt: '2025-12-19T12:00:00.000Z',
  },
  ...names.map((_, index) => generated(index)),
]
