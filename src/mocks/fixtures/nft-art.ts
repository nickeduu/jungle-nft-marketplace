/**
 * Traits of the original ape artworks, one character per NFT (keyed by NFT id).
 *
 * Single source for both sides: `scripts/generate-nft-art.ts` draws the artworks from these
 * traits (public/images/nfts/<id>/), and the fixtures derive the "Acessório"/"Paleta"
 * attributes from the same entry, so the metadata always matches the picture.
 * Pure data with erasable types only: Node runs this file directly (type stripping).
 */

export type ApeFur = 'chestnut' | 'charcoal' | 'golden' | 'ivory' | 'rust' | 'onyx' | 'silver' | 'cocoa' | 'tawny'
export type ApeOutfit = 'varsity' | 'hoodie' | 'blazer' | 'tee' | 'bomber' | 'kimono' | 'vest' | 'spacesuit'
export type ApeAccessory =
  | 'glasses'
  | 'shades'
  | 'bucket-hat'
  | 'beanie'
  | 'cap'
  | 'headphones'
  | 'necklace'
  | 'beads'
  | 'earring'
  | 'crown'
  | 'flower-crown'
  | 'helmet'
export type ApeEyes = 'calm' | 'sleepy' | 'wide' | 'smug'
export type ApeMouth = 'smile' | 'smirk' | 'neutral' | 'grin'
export type ApeHair = 'tuft' | 'spiky' | 'slick' | 'mohawk' | 'none'
export type ApeScene = 'plain' | 'halo' | 'space' | 'jungle'

export interface ApeTraits {
  fur: ApeFur
  outfit: ApeOutfit
  /** Main garment colour; the background tint is derived from it. */
  outfitColor: string
  /** Secondary colour: sleeves, collar, turtleneck, inner shirt. */
  trimColor: string
  /** Accessories in drawing order; the first one is the "Acessório" attribute. */
  accessories: ApeAccessory[]
  /** Colour of the first accessory (lens, hat, headphones, gem…). */
  accessoryColor: string
  eyes: ApeEyes
  mouth: ApeMouth
  hair: ApeHair
  scene: ApeScene
  /** Attribute values shown on the detail page (pt-BR). */
  accessoryLabel: string
  paletteLabel: string
}

const t = (traits: ApeTraits) => traits

export const apeTraits: Record<string, ApeTraits> = {
  'nft-distant-galaxy': t({
    fur: 'silver', outfit: 'spacesuit', outfitColor: '#e6e4df', trimColor: '#3c5aa8', accessories: ['helmet'],
    accessoryColor: '#bcd3ff', eyes: 'wide', mouth: 'smile', hair: 'none', scene: 'space',
    accessoryLabel: 'Capacete', paletteLabel: 'Galáctica',
  }),
  'nft-life-on-edena': t({
    fur: 'chestnut', outfit: 'tee', outfitColor: '#2f7a62', trimColor: '#b9f2d0', accessories: ['flower-crown'],
    accessoryColor: '#7ef0c8', eyes: 'calm', mouth: 'smile', hair: 'none', scene: 'jungle',
    accessoryLabel: 'Coroa de flores', paletteLabel: 'Bioluminescente',
  }),
  'nft-001': t({ // Emerald Ape #042 (Figma detail frame)
    fur: 'chestnut', outfit: 'varsity', outfitColor: '#2f6b4a', trimColor: '#efe6d2', accessories: ['glasses', 'necklace'],
    accessoryColor: '#2d5a3f', eyes: 'calm', mouth: 'smile', hair: 'tuft', scene: 'plain',
    accessoryLabel: 'Óculos', paletteLabel: 'Esmeralda',
  }),
  'nft-002': t({ // Sage Nomad #009
    fur: 'charcoal', outfit: 'hoodie', outfitColor: '#8d74b8', trimColor: '#efe6d2', accessories: ['bucket-hat'],
    accessoryColor: '#8e9a6c', eyes: 'sleepy', mouth: 'smile', hair: 'none', scene: 'plain',
    accessoryLabel: 'Chapéu', paletteLabel: 'Sálvia',
  }),
  'nft-003': t({ // Neon Vessel #552
    fur: 'onyx', outfit: 'bomber', outfitColor: '#1c9c90', trimColor: '#1d2b2a', accessories: ['headphones', 'earring'],
    accessoryColor: '#40e0c8', eyes: 'smug', mouth: 'smirk', hair: 'mohawk', scene: 'halo',
    accessoryLabel: 'Fones', paletteLabel: 'Neon',
  }),
  'nft-004': t({ // Cosmic Bloom #118
    fur: 'silver', outfit: 'hoodie', outfitColor: '#5f4a9a', trimColor: '#e9e2f5', accessories: ['bucket-hat'],
    accessoryColor: '#7b8a5a', eyes: 'calm', mouth: 'neutral', hair: 'none', scene: 'halo',
    accessoryLabel: 'Chapéu', paletteLabel: 'Cósmica',
  }),
  'nft-005': t({ // Violet Nomad #314
    fur: 'charcoal', outfit: 'hoodie', outfitColor: '#7b5ea7', trimColor: '#f1ebf8', accessories: ['beanie', 'earring'],
    accessoryColor: '#4f3a78', eyes: 'smug', mouth: 'smirk', hair: 'none', scene: 'plain',
    accessoryLabel: 'Gorro', paletteLabel: 'Violeta',
  }),
  'nft-006': t({ // Ivory Baron #088
    fur: 'onyx', outfit: 'blazer', outfitColor: '#e6dcc4', trimColor: '#2d5b40', accessories: ['earring'],
    accessoryColor: '#d4a64a', eyes: 'smug', mouth: 'neutral', hair: 'slick', scene: 'plain',
    accessoryLabel: 'Brinco', paletteLabel: 'Marfim',
  }),
  'nft-007': t({ // Golden Beat #207
    fur: 'golden', outfit: 'tee', outfitColor: '#ece3cc', trimColor: '#3f7a52', accessories: ['headphones'],
    accessoryColor: '#3f7a52', eyes: 'calm', mouth: 'smile', hair: 'tuft', scene: 'halo',
    accessoryLabel: 'Fones', paletteLabel: 'Dourado',
  }),
  'nft-008': t({ // Golden Frequency #071
    fur: 'tawny', outfit: 'vest', outfitColor: '#d6a23c', trimColor: '#f3ead6', accessories: ['headphones', 'necklace'],
    accessoryColor: '#2a2522', eyes: 'sleepy', mouth: 'grin', hair: 'spiky', scene: 'plain',
    accessoryLabel: 'Fones', paletteLabel: 'Dourado',
  }),
  'nft-009': t({ // Golden Signal #160
    fur: 'golden', outfit: 'bomber', outfitColor: '#5f6b3a', trimColor: '#d9a441', accessories: ['cap'],
    accessoryColor: '#d9a441', eyes: 'wide', mouth: 'smile', hair: 'none', scene: 'plain',
    accessoryLabel: 'Boné', paletteLabel: 'Dourado',
  }),
  'nft-010': t({ // Copper Monk #233
    fur: 'rust', outfit: 'kimono', outfitColor: '#b8693a', trimColor: '#f0dcc0', accessories: ['beads'],
    accessoryColor: '#6b3a22', eyes: 'sleepy', mouth: 'smile', hair: 'none', scene: 'halo',
    accessoryLabel: 'Colar de contas', paletteLabel: 'Cobre',
  }),
  'nft-011': t({ // Velvet Ape #019
    fur: 'cocoa', outfit: 'blazer', outfitColor: '#7a2e46', trimColor: '#1f1a1c', accessories: ['crown'],
    accessoryColor: '#e0b44c', eyes: 'smug', mouth: 'smirk', hair: 'none', scene: 'plain',
    accessoryLabel: 'Coroa', paletteLabel: 'Veludo',
  }),
  'nft-012': t({ // Amber Drifter #401
    fur: 'tawny', outfit: 'bomber', outfitColor: '#c9822e', trimColor: '#3a2a1e', accessories: ['glasses'],
    accessoryColor: '#e09a3a', eyes: 'calm', mouth: 'smirk', hair: 'slick', scene: 'plain',
    accessoryLabel: 'Óculos', paletteLabel: 'Âmbar',
  }),
  'nft-013': t({ // Jade Sentinel #077
    fur: 'silver', outfit: 'vest', outfitColor: '#3f8f74', trimColor: '#e8efe9', accessories: ['earring'],
    accessoryColor: '#58c49c', eyes: 'calm', mouth: 'neutral', hair: 'spiky', scene: 'halo',
    accessoryLabel: 'Brinco', paletteLabel: 'Jade',
  }),
  'nft-014': t({ // Rust Pilot #128
    fur: 'rust', outfit: 'bomber', outfitColor: '#6b4a32', trimColor: '#efe2c8', accessories: ['glasses'],
    accessoryColor: '#3b4a5a', eyes: 'wide', mouth: 'grin', hair: 'tuft', scene: 'plain',
    accessoryLabel: 'Óculos', paletteLabel: 'Ferrugem',
  }),
  'nft-015': t({ // Onyx Dreamer #305
    fur: 'onyx', outfit: 'hoodie', outfitColor: '#3a3633', trimColor: '#c9c1b6', accessories: ['beanie'],
    accessoryColor: '#2a2725', eyes: 'sleepy', mouth: 'neutral', hair: 'none', scene: 'halo',
    accessoryLabel: 'Gorro', paletteLabel: 'Ônix',
  }),
  'nft-016': t({ // Saffron Echo #064
    fur: 'golden', outfit: 'kimono', outfitColor: '#e8a32e', trimColor: '#7a3b1e', accessories: ['flower-crown'],
    accessoryColor: '#f6d35a', eyes: 'calm', mouth: 'smile', hair: 'none', scene: 'plain',
    accessoryLabel: 'Coroa de flores', paletteLabel: 'Açafrão',
  }),
  'nft-017': t({ // Cobalt Rider #219
    fur: 'charcoal', outfit: 'varsity', outfitColor: '#2f56a6', trimColor: '#f0ead8', accessories: ['cap'],
    accessoryColor: '#2f56a6', eyes: 'wide', mouth: 'grin', hair: 'none', scene: 'plain',
    accessoryLabel: 'Boné', paletteLabel: 'Cobalto',
  }),
  'nft-018': t({ // Pearl Oracle #150
    fur: 'ivory', outfit: 'kimono', outfitColor: '#b9a6d6', trimColor: '#f1ece4', accessories: ['necklace'],
    accessoryColor: '#f4f0ea', eyes: 'sleepy', mouth: 'smile', hair: 'slick', scene: 'halo',
    accessoryLabel: 'Colar', paletteLabel: 'Pérola',
  }),
  'nft-019': t({ // Ember Scout #093
    fur: 'rust', outfit: 'vest', outfitColor: '#d2532c', trimColor: '#2e2a26', accessories: ['bucket-hat'],
    accessoryColor: '#c9b48a', eyes: 'wide', mouth: 'smile', hair: 'none', scene: 'plain',
    accessoryLabel: 'Chapéu', paletteLabel: 'Brasa',
  }),
  'nft-020': t({ // Moss Wanderer #276
    fur: 'chestnut', outfit: 'hoodie', outfitColor: '#5d6f3a', trimColor: '#e9e4d0', accessories: ['headphones'],
    accessoryColor: '#c98a3a', eyes: 'calm', mouth: 'smirk', hair: 'none', scene: 'plain',
    accessoryLabel: 'Fones', paletteLabel: 'Musgo',
  }),
  'nft-021': t({ // Crimson Bard #188
    fur: 'cocoa', outfit: 'blazer', outfitColor: '#a3253a', trimColor: '#f2e9dc', accessories: ['necklace', 'earring'],
    accessoryColor: '#e0b44c', eyes: 'smug', mouth: 'grin', hair: 'slick', scene: 'halo',
    accessoryLabel: 'Colar', paletteLabel: 'Carmim',
  }),
  'nft-022': t({ // Silver Tide #047
    fur: 'silver', outfit: 'bomber', outfitColor: '#56789a', trimColor: '#c8ced4', accessories: ['shades'],
    accessoryColor: '#2a5a8a', eyes: 'calm', mouth: 'smirk', hair: 'none', scene: 'plain',
    accessoryLabel: 'Óculos escuros', paletteLabel: 'Prata',
  }),
  'nft-023': t({ // Bronze Keeper #362
    fur: 'tawny', outfit: 'vest', outfitColor: '#9a6b3a', trimColor: '#efe4cf', accessories: ['crown'],
    accessoryColor: '#c58f45', eyes: 'calm', mouth: 'neutral', hair: 'none', scene: 'halo',
    accessoryLabel: 'Coroa', paletteLabel: 'Bronze',
  }),
  'nft-024': t({ // Indigo Rebel #011
    fur: 'onyx', outfit: 'bomber', outfitColor: '#3e3f8f', trimColor: '#1e1e33', accessories: ['earring', 'shades'],
    accessoryColor: '#c9c9e8', eyes: 'smug', mouth: 'smirk', hair: 'mohawk', scene: 'plain',
    accessoryLabel: 'Brinco', paletteLabel: 'Índigo',
  }),
  'nft-025': t({ // Hazel Vision #245
    fur: 'chestnut', outfit: 'tee', outfitColor: '#8e6b3e', trimColor: '#f1e6d0', accessories: ['glasses'],
    accessoryColor: '#e9f2f0', eyes: 'wide', mouth: 'smile', hair: 'spiky', scene: 'plain',
    accessoryLabel: 'Óculos', paletteLabel: 'Avelã',
  }),
  'nft-026': t({ // Ochre Signal #133
    fur: 'golden', outfit: 'hoodie', outfitColor: '#c58b2a', trimColor: '#f4ead2', accessories: ['headphones'],
    accessoryColor: '#3a3430', eyes: 'sleepy', mouth: 'smirk', hair: 'tuft', scene: 'halo',
    accessoryLabel: 'Fones', paletteLabel: 'Ocre',
  }),
  'nft-027': t({ // Tawny Baron #099
    fur: 'tawny', outfit: 'blazer', outfitColor: '#b67a45', trimColor: '#f2e8d4', accessories: ['necklace'],
    accessoryColor: '#e0b44c', eyes: 'smug', mouth: 'neutral', hair: 'slick', scene: 'plain',
    accessoryLabel: 'Colar', paletteLabel: 'Fulvo',
  }),
  'nft-028': t({ // Lilac Nomad #327
    fur: 'ivory', outfit: 'hoodie', outfitColor: '#b49ad6', trimColor: '#f5f0fa', accessories: ['bucket-hat'],
    accessoryColor: '#9a80c0', eyes: 'calm', mouth: 'smile', hair: 'none', scene: 'plain',
    accessoryLabel: 'Chapéu', paletteLabel: 'Lilás',
  }),
  'nft-029': t({ // Mint Frequency #056
    fur: 'charcoal', outfit: 'tee', outfitColor: '#8fd3b6', trimColor: '#2f5a4a', accessories: ['headphones'],
    accessoryColor: '#e9f7f0', eyes: 'calm', mouth: 'grin', hair: 'tuft', scene: 'halo',
    accessoryLabel: 'Fones', paletteLabel: 'Menta',
  }),
  'nft-030': t({ // Umber Ape #412
    fur: 'cocoa', outfit: 'varsity', outfitColor: '#5e3f2a', trimColor: '#efe2c8', accessories: ['cap', 'necklace'],
    accessoryColor: '#5e3f2a', eyes: 'smug', mouth: 'smile', hair: 'none', scene: 'plain',
    accessoryLabel: 'Boné', paletteLabel: 'Terroso',
  }),
}

/** Gallery views drawn for every character; the first one is the cover used by listings. */
export const APE_VIEWS = ['portrait', 'night', 'closeup', 'outtake'] as const

/** Public URLs of an NFT's artworks (800 px WebP; a 400 px `-sm` variant sits next to each). */
export function apeImages(nftId: string): string[] {
  return APE_VIEWS.map((view) => `/images/nfts/${nftId}/${view}.webp`)
}
