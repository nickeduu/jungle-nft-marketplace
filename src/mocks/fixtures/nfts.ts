import type { Nft } from '@/shared/contracts'

/**
 * Deterministic seed data. Fixed ids/dates so tests and visual baselines are stable.
 * Placeholder images until the Figma assets are exported (see ARCHITECTURE.md).
 */
const SEEDED_AT = '2026-01-15T12:00:00.000Z'

export const nftFixtures: Nft[] = [
  {
    id: 'nft-distant-galaxy',
    name: 'Distant Galaxy',
    description: 'A nebula rendered in procedural light, minted as a limited series.',
    collection: 'Space Walking',
    category: 'art',
    creator: { id: 'creator-animakid', name: 'Animakid', avatarUrl: '/images/placeholder-avatar.svg' },
    images: ['/images/placeholder-nft.svg'],
    editions: [
      { id: 'ed-standard', name: 'Standard', priceEth: '1.63', available: 12, supply: 50, maxPerOrder: 5 },
      { id: 'ed-gold', name: 'Gold', priceEth: '4.2', available: 1, supply: 5, maxPerOrder: 1 },
      { id: 'ed-genesis', name: 'Genesis', priceEth: '12.5', available: 0, supply: 1, maxPerOrder: 1 },
    ],
    version: 1,
    updatedAt: SEEDED_AT,
  },
  {
    id: 'nft-life-on-edena',
    name: 'Life On Edena',
    description: 'Bioluminescent flora from an imagined exoplanet.',
    collection: 'Edena',
    category: 'photography',
    creator: { id: 'creator-nebulakid', name: 'NebulaKid', avatarUrl: '/images/placeholder-avatar.svg' },
    images: ['/images/placeholder-nft.svg'],
    editions: [{ id: 'ed-standard', name: 'Standard', priceEth: '0.33', available: 40, supply: 100, maxPerOrder: 10 }],
    version: 1,
    updatedAt: SEEDED_AT,
  },
]
