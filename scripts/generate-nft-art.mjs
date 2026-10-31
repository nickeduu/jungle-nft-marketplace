/**
 * Draws the original ape artworks (vector, deterministic) and exports them as WebP.
 *
 *   npm run art                 # every NFT
 *   npm run art -- --only=nft-001,nft-002 --preview   # subset; also writes the SVG sources
 *
 * Traits come from src/mocks/fixtures/nft-art.ts (the same entries the fixtures use for the
 * attributes). Output: public/images/nfts/<id>/<view>.webp (800 px) + <view>-sm.webp (400 px).
 * Rasterization and WebP encoding run in Playwright's Chromium (already a dev dependency).
 * No randomness: the same traits always produce the same pixels on the same Chromium.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { APE_VIEWS, apeTraits } from '../src/mocks/fixtures/nft-art.ts'

const OUT = 'public/images/nfts'
const SIZES = [
  { suffix: '', px: 800, quality: 0.8 },
  { suffix: '-sm', px: 400, quality: 0.78 },
]

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const only = args.only ? new Set(args.only.split(',')) : null

// ── colour helpers ──────────────────────────────────────────────────────────
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
/** Linear mix: t = 0 → a, t = 1 → b. */
const mix = (a, b, t) => toHex(toRgb(a).map((v, i) => v + (toRgb(b)[i] - v) * t))
const lighten = (c, t) => mix(c, '#ffffff', t)
const darken = (c, t) => mix(c, '#000000', t)
const luminance = (c) => {
  const [r, g, b] = toRgb(c).map((v) => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Small deterministic PRNG (mulberry32) seeded from the NFT id: stable fur strands. */
function prng(seedText) {
  let seed = [...seedText].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let x = seed
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const FURS = {
  chestnut: { fur: '#6e4529', skin: '#cfa47c', iris: '#3b2414' },
  charcoal: { fur: '#45423f', skin: '#9a948d', iris: '#2b211b' },
  golden: { fur: '#c97a2c', skin: '#ecc9a0', iris: '#7a4a18' },
  ivory: { fur: '#e4d8c4', skin: '#c9a284', iris: '#4a3324' },
  rust: { fur: '#9c4220', skin: '#dcae8a', iris: '#4a2412' },
  onyx: { fur: '#232021', skin: '#4f4946', iris: '#2a1d16' },
  silver: { fur: '#9a9da1', skin: '#45413f', iris: '#3a2a20' },
  cocoa: { fur: '#432a19', skin: '#a8805f', iris: '#2e1b10' },
  tawny: { fur: '#a8743f', skin: '#e3c19b', iris: '#5a3a1a' },
}

const GOLD = '#d8b04a'
const INK = '#1d1713'

// ── scene ───────────────────────────────────────────────────────────────────
function background(tr, view, p, rand) {
  const base = mix(tr.outfitColor, '#f4ecd8', 0.8)
  if (view === 'night' || tr.scene === 'space') {
    const deep = tr.scene === 'space' ? '#0d1330' : mix(tr.outfitColor, '#0f0b07', 0.82)
    const glow = tr.scene === 'space' ? '#3b3f8f' : mix(tr.outfitColor, '#2a1f14', 0.45)
    let stars = ''
    for (let i = 0; i < 46; i++) {
      const x = rand() * 800
      const y = rand() * 560
      stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + rand() * 2.2).toFixed(1)}" fill="#fff" opacity="${(0.35 + rand() * 0.6).toFixed(2)}"/>`
    }
    const nebula =
      tr.scene === 'space'
        ? `<ellipse cx="620" cy="170" rx="230" ry="120" fill="#b05cc8" opacity=".22" transform="rotate(-25 620 170)"/><ellipse cx="170" cy="560" rx="260" ry="110" fill="#3fa0d8" opacity=".18" transform="rotate(20 170 560)"/><circle cx="660" cy="120" r="44" fill="#e9c27a"/><circle cx="648" cy="108" r="44" fill="${deep}" opacity=".55"/>`
        : ''
    return `<defs><radialGradient id="${p}bg" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${glow}"/><stop offset="1" stop-color="${deep}"/></radialGradient></defs><rect width="800" height="800" fill="url(#${p}bg)"/>${nebula}${stars}`
  }
  if (view === 'outtake') {
    const a = mix(tr.outfitColor, '#f4ecd8', 0.68)
    const b = mix(tr.outfitColor, '#f4ecd8', 0.8)
    let stripes = ''
    for (let i = -800; i < 800; i += 80) stripes += `<path d="M${i} 800 L${i + 800} 0 L${i + 840} 0 L${i + 40} 800 Z" fill="${a}"/>`
    return `<rect width="800" height="800" fill="${b}"/>${stripes}`
  }
  if (tr.scene === 'jungle') {
    const leaf = (x, y, r, s, c) =>
      `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 0 C 40 -60 120 -60 160 0 C 120 60 40 60 0 0 Z M0 0 L160 0" fill="${c}" stroke="${darken(c, 0.25)}" stroke-width="4"/>`
    return (
      `<defs><radialGradient id="${p}bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#d7f5e4"/><stop offset="1" stop-color="#6fbf9e"/></radialGradient></defs><rect width="800" height="800" fill="url(#${p}bg)"/>` +
      leaf(-30, 120, 20, 1.6, '#3f9a78') +
      leaf(830, 160, 160, 1.5, '#2f8a6a') +
      leaf(-20, 420, -15, 1.3, '#4fae86') +
      leaf(820, 470, 200, 1.4, '#3f9a78') +
      [90, 700, 150, 640, 60].map((x, i) => `<circle cx="${x}" cy="${[260, 330, 620, 640, 520][i]}" r="${[9, 7, 6, 10, 5][i]}" fill="#eafff4" opacity=".8"/>`).join('')
    )
  }
  const edge = darken(base, 0.12)
  const halo = tr.scene === 'halo' ? `<circle cx="400" cy="380" r="285" fill="${mix(tr.outfitColor, '#f4ecd8', 0.6)}"/>` : ''
  return `<defs><radialGradient id="${p}bg" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="${lighten(base, 0.35)}"/><stop offset="1" stop-color="${edge}"/></radialGradient></defs><rect width="800" height="800" fill="url(#${p}bg)"/>${halo}`
}

// ── body ────────────────────────────────────────────────────────────────────
const TORSO = 'M70 800 C 80 650 180 585 300 566 L 500 566 C 620 585 720 650 730 800 Z'

function outfit(tr, p) {
  const c = tr.outfitColor
  const trim = tr.trimColor
  const dark = darken(c, 0.22)
  const shade = `<path d="${TORSO}" fill="url(#${p}torsoShade)"/>`
  const defs = `<defs><radialGradient id="${p}torsoShade" cx="50%" cy="20%" r="85%"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>`
  const base = `<path d="${TORSO}" fill="${c}"/>`
  switch (tr.outfit) {
    case 'varsity':
      return (
        defs +
        base +
        `<path d="M70 800 C 80 650 180 585 285 568 C 250 640 238 720 236 800 Z" fill="${trim}"/><path d="M730 800 C 720 650 620 585 515 568 C 550 640 562 720 564 800 Z" fill="${trim}"/>` +
        `<path d="M330 566 L 400 700 L 470 566 Z" fill="#f6f1e6"/>` +
        `<path d="M318 566 L 400 716 L 482 566" fill="none" stroke="${trim}" stroke-width="22" stroke-linejoin="round"/><path d="M318 566 L 400 716 L 482 566" fill="none" stroke="${c}" stroke-width="7" stroke-linejoin="round"/>` +
        [740, 785].map((y) => `<circle cx="400" cy="${y}" r="8" fill="${trim}" stroke="${dark}" stroke-width="3"/>`).join('') +
        `<circle cx="520" cy="690" r="34" fill="${trim}"/><text x="520" y="704" font-family="Georgia, serif" font-size="40" font-weight="700" text-anchor="middle" fill="${c}">K</text>` +
        shade
      )
    case 'hoodie':
      return (
        defs +
        `<path d="M250 600 C 240 500 560 500 550 600 C 520 640 280 640 250 600 Z" fill="${dark}"/>` +
        base +
        `<path d="M290 575 C 330 625 470 625 510 575 C 470 600 330 600 290 575 Z" fill="${darken(c, 0.35)}"/>` +
        `<path d="M372 612 C 370 660 364 700 360 735" fill="none" stroke="${trim}" stroke-width="7" stroke-linecap="round"/><path d="M428 612 C 430 660 436 700 440 735" fill="none" stroke="${trim}" stroke-width="7" stroke-linecap="round"/>` +
        `<rect x="353" y="728" width="14" height="24" rx="5" fill="${darken(trim, 0.15)}"/><rect x="433" y="728" width="14" height="24" rx="5" fill="${darken(trim, 0.15)}"/>` +
        `<path d="M290 800 C 300 770 500 770 510 800" fill="none" stroke="${dark}" stroke-width="5"/>` +
        shade
      )
    case 'blazer':
      return (
        defs +
        base +
        `<path d="M330 560 L 400 800 L 470 560 Z" fill="${trim}"/>` +
        `<rect x="330" y="520" width="140" height="70" rx="26" fill="${trim}"/><path d="M340 548 H460 M340 566 H460" stroke="${darken(trim, 0.2)}" stroke-width="4"/>` +
        `<path d="M318 572 L 290 650 L 336 664 L 312 720 L 400 800 L 340 600 Z" fill="${dark}"/><path d="M482 572 L 510 650 L 464 664 L 488 720 L 400 800 L 460 600 Z" fill="${dark}"/>` +
        `<path d="M520 700 h 60" stroke="${darken(c, 0.35)}" stroke-width="5" stroke-linecap="round"/>` +
        shade
      )
    case 'tee':
      return (
        defs +
        base +
        `<path d="M318 568 C 340 630 460 630 482 568" fill="none" stroke="${trim}" stroke-width="16" stroke-linecap="round"/>` +
        // Banana print.
        `<path d="M352 690 C 362 744 438 760 470 708 C 440 732 386 726 366 682 Z" fill="${trim}"/><path d="M352 690 l-6 -12 l14 2 Z" fill="${darken(trim, 0.35)}"/>` +
        shade
      )
    case 'bomber':
      return (
        defs +
        base +
        `<path d="M300 566 C 330 616 470 616 500 566 L 520 580 C 480 650 320 650 280 580 Z" fill="${trim}"/>` +
        [0, 1, 2].map((i) => `<path d="M${300 + i * 6} ${590 + i * 8} C 340 ${636 + i * 6} 460 ${636 + i * 6} ${500 - i * 6} ${590 + i * 8}" fill="none" stroke="${darken(trim, 0.25)}" stroke-width="2"/>`).join('') +
        `<path d="M400 628 V800" stroke="${darken(c, 0.3)}" stroke-width="10"/><path d="M400 628 V800" stroke="#c9c9c9" stroke-width="4" stroke-dasharray="4 5"/><rect x="392" y="650" width="16" height="26" rx="4" fill="#d9d9d9"/>` +
        `<path d="M170 700 L 200 690" stroke="#c9c9c9" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M70 800 H730 V788 H70 Z" fill="${trim}"/>` +
        shade
      )
    case 'kimono':
      return (
        defs +
        base +
        `<path d="M330 566 L 400 660 L 470 566 Z" fill="${lighten(trim, 0.3)}"/>` +
        `<path d="M300 566 L 470 800 L 520 800 L 340 566 Z" fill="${trim}"/><path d="M500 566 L 330 800 L 280 800 L 460 566 Z" fill="${darken(trim, 0.08)}"/>` +
        `<path d="M200 740 h 400" stroke="${dark}" stroke-width="28"/>` +
        shade
      )
    case 'vest':
      return (
        defs +
        `<path d="${TORSO}" fill="${trim}"/>` +
        `<path d="M110 800 C 120 680 200 610 300 586 L 360 800 Z" fill="${c}"/><path d="M690 800 C 680 680 600 610 500 586 L 440 800 Z" fill="${c}"/>` +
        [660, 720, 780].map((y) => `<path d="M${130 + (y - 660) * -0.1} ${y} L ${338 - (800 - y) * 0.08} ${y + 6} M${670 + (y - 660) * 0.1} ${y} L ${462 + (800 - y) * 0.08} ${y + 6}" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>`).join('') +
        `<path d="M322 566 C 345 620 455 620 478 566" fill="none" stroke="${darken(trim, 0.15)}" stroke-width="10"/>` +
        shade
      )
    case 'spacesuit':
      return (
        defs +
        base +
        `<rect x="330" y="660" width="140" height="90" rx="14" fill="${darken(c, 0.12)}"/>` +
        [0, 1, 2].map((i) => `<circle cx="${362 + i * 38}" cy="690" r="10" fill="${['#e2574c', '#f2c94c', '#5fc27e'][i]}"/>`).join('') +
        `<rect x="348" y="716" width="104" height="14" rx="7" fill="${trim}"/>` +
        `<path d="M140 720 L 230 700" stroke="${trim}" stroke-width="18" stroke-linecap="round"/><path d="M660 720 L 570 700" stroke="${trim}" stroke-width="18" stroke-linecap="round"/>` +
        shade
      )
  }
  return base
}

function neck(fur, p) {
  return (
    `<defs><linearGradient id="${p}neck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${darken(fur, 0.55)}"/><stop offset=".45" stop-color="${darken(fur, 0.2)}"/><stop offset="1" stop-color="${darken(fur, 0.1)}"/></linearGradient></defs>` +
    `<path d="M336 470 L 330 590 C 360 610 440 610 470 590 L 464 470 Z" fill="url(#${p}neck)"/>`
  )
}

function chestJewel(tr, kind) {
  const color = tr.accessories[0] === kind ? tr.accessoryColor : GOLD
  if (kind === 'beads') {
    let beads = ''
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (0.08 + (0.84 * i) / 14)
      beads += `<circle cx="${(400 - Math.cos(a) * 92).toFixed(1)}" cy="${(572 + Math.sin(a) * 92).toFixed(1)}" r="10" fill="${color}" stroke="${darken(color, 0.35)}" stroke-width="2"/>`
    }
    return beads + `<path d="M400 668 l-14 34 h28 Z" fill="${darken(color, 0.1)}"/>`
  }
  const gem = tr.accessories[0] === 'necklace' ? tr.accessoryColor : tr.outfit === 'varsity' ? darken(tr.outfitColor, 0.05) : '#4fb08a'
  return (
    `<path d="M328 572 Q 400 676 472 572" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/><path d="M328 572 Q 400 676 472 572" fill="none" stroke="${darken(GOLD, 0.35)}" stroke-width="2" stroke-dasharray="3 7"/>` +
    `<path d="M400 640 l-18 22 l18 26 l18 -26 Z" fill="${gem}" stroke="${GOLD}" stroke-width="5" stroke-linejoin="round"/><path d="M394 652 l6 -6 l6 6" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>`
  )
}

// ── head ────────────────────────────────────────────────────────────────────
function head(tr, p, rand, expr) {
  const f = FURS[tr.fur]
  const fur = f.fur
  const furLight = lighten(fur, 0.22)
  const furDark = darken(fur, 0.3)
  const skin = f.skin
  const skinLight = lighten(skin, 0.18)
  const skinDark = darken(skin, 0.25)
  const skinDeep = darken(skin, 0.55)
  const defs =
    `<defs>` +
    `<radialGradient id="${p}fur" cx="40%" cy="28%" r="80%"><stop offset="0" stop-color="${furLight}"/><stop offset=".55" stop-color="${fur}"/><stop offset="1" stop-color="${furDark}"/></radialGradient>` +
    `<radialGradient id="${p}skin" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="${skinLight}"/><stop offset="1" stop-color="${skin}"/></radialGradient>` +
    `<radialGradient id="${p}muzzle" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${skinLight}"/><stop offset=".7" stop-color="${skin}"/><stop offset="1" stop-color="${skinDark}"/></radialGradient>` +
    `</defs>`

  // Ears behind the skull.
  const ears = [-1, 1]
    .map((s) => {
      const x = 400 + s * 168
      return `<ellipse cx="${x}" cy="350" rx="54" ry="60" fill="url(#${p}fur)"/><ellipse cx="${x + s * 4}" cy="352" rx="32" ry="38" fill="${skinDark}"/><ellipse cx="${x + s * 2}" cy="352" rx="18" ry="24" fill="${skinDeep}" opacity=".35"/>`
    })
    .join('')

  // Skull with cheek tufts, plus fur strands for texture.
  const cheeks = [-1, 1]
    .map((s) => {
      const pts = [
        [232, 372], [204, 392], [228, 400], [200, 424], [232, 424], [214, 452], [258, 430],
      ]
      return `<path d="M${pts.map(([x, y]) => `${400 + s * (400 - x) * -1} ${y}`).join(' L ')} Z" fill="${fur}"/>`
    })
    .join('')
  let strands = ''
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (1.05 + rand() * 0.9)
    const r = 120 + rand() * 45
    const x = 400 + Math.cos(a) * r * 1.0
    const y = 320 + Math.sin(a) * r * 1.02
    const len = 14 + rand() * 16
    strands += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q ${(Math.cos(a) * len * 0.5 + 4).toFixed(1)} ${(Math.sin(a) * len * 0.5).toFixed(1)} ${(Math.cos(a) * len).toFixed(1)} ${(Math.sin(a) * len).toFixed(1)}" fill="none" stroke="${i % 3 ? furDark : furLight}" stroke-width="3" stroke-linecap="round" opacity=".45"/>`
  }
  const skull = `${cheeks}<ellipse cx="400" cy="318" rx="172" ry="178" fill="url(#${p}fur)"/>${strands}`

  const hairColor = tr.hair === 'mohawk' ? lighten(tr.outfitColor, 0.15) : fur
  const hair = {
    none: '',
    tuft: `<path d="M352 158 Q 362 96 392 132 Q 404 78 422 130 Q 452 98 448 160 Z" fill="${hairColor}"/><path d="M392 132 Q 398 118 404 134" fill="none" stroke="${furDark}" stroke-width="3" opacity=".5"/>`,
    spiky: `<path d="M282 214 L 290 140 L 322 182 L 336 110 L 366 166 L 390 92 L 416 164 L 446 106 L 466 172 L 500 128 L 512 196 L 520 214 Z" fill="${hairColor}"/>`,
    slick: `<path d="M260 230 C 280 120 420 92 530 150 C 560 170 566 200 556 236 C 520 170 420 150 330 186 C 300 198 276 214 260 230 Z" fill="${darken(fur, 0.12)}"/><path d="M300 196 C 380 140 470 140 530 180" fill="none" stroke="${furLight}" stroke-width="4" opacity=".5"/>`,
    mohawk: `<path d="M366 196 L 352 120 L 378 136 L 374 70 L 400 100 L 408 52 L 424 100 L 448 76 L 440 136 L 460 128 L 434 196 Z" fill="${hairColor}" stroke="${darken(hairColor, 0.3)}" stroke-width="4" stroke-linejoin="round"/>`,
  }[tr.hair]

  // Face mask (heart shape around the eyes) and muzzle.
  const face =
    `<path d="M400 236 C 452 200 540 220 544 300 C 548 352 508 376 470 378 L 330 378 C 292 376 252 352 256 300 C 260 220 348 200 400 236 Z" fill="url(#${p}skin)"/>` +
    `<ellipse cx="400" cy="414" rx="120" ry="90" fill="url(#${p}muzzle)"/>` +
    `<path d="M300 466 C 340 500 460 500 500 466" fill="none" stroke="${skinDark}" stroke-width="4" opacity=".35"/>`

  // Brow ridge; a raised left brow for the smug expression.
  const browLift = expr.eyes === 'smug' ? -10 : 0
  const brow = `<path d="M286 ${270 + browLift} C 326 ${238 + browLift} 372 ${246 + browLift} 400 262 C 428 246 474 238 514 270 C 508 286 470 280 442 284 C 422 286 410 290 400 294 C 390 290 378 286 358 284 C 330 280 292 ${286 + browLift} 286 ${270 + browLift} Z" fill="${skinDark}"/>`

  const lids = { calm: [0.38, 0.38], sleepy: [0.58, 0.58], wide: [0.08, 0.08], smug: [0.22, 0.5], wink: [0.3, 1] }[expr.eyes]
  const eyes = [
    [350, lids[0]],
    [450, lids[1]],
  ]
    .map(([cx, lid], i) => {
      const cy = 312
      const rx = 27
      const ry = 22
      const top = cy - ry
      const lidY = top + lid * ry * 2
      const id = `${p}eye${i}`
      if (lid >= 1) return `<path d="M${cx - rx} ${cy} Q ${cx} ${cy + 12} ${cx + rx} ${cy}" fill="none" stroke="${skinDeep}" stroke-width="6" stroke-linecap="round"/>`
      return (
        `<clipPath id="${id}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>` +
        `<g clip-path="url(#${id})"><rect x="${cx - rx}" y="${top}" width="${rx * 2}" height="${ry * 2}" fill="#fbf7ef"/>` +
        `<circle cx="${cx + 3}" cy="${cy + 3}" r="15" fill="${f.iris}"/><circle cx="${cx + 3}" cy="${cy + 3}" r="8" fill="#0d0907"/><circle cx="${cx + 8}" cy="${cy - 3}" r="4.5" fill="#fff"/>` +
        `<rect x="${cx - rx}" y="${top - 2}" width="${rx * 2}" height="${(lidY - top + 2).toFixed(1)}" fill="${skinDark}"/></g>` +
        `<path d="M${cx - rx} ${lidY.toFixed(1)} Q ${cx} ${(lidY - 4).toFixed(1)} ${cx + rx} ${lidY.toFixed(1)}" fill="none" stroke="${skinDeep}" stroke-width="4" stroke-linecap="round"/>` +
        `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${skinDeep}" stroke-width="2.5" opacity=".6"/>`
      )
    })
    .join('')

  const nose =
    `<path d="M384 330 C 380 352 378 366 384 376 M416 330 C 420 352 422 366 416 376" fill="none" stroke="${skinDark}" stroke-width="4" stroke-linecap="round" opacity=".6"/>` +
    `<ellipse cx="383" cy="388" rx="10" ry="6.5" transform="rotate(-24 383 388)" fill="${skinDeep}"/><ellipse cx="417" cy="388" rx="10" ry="6.5" transform="rotate(24 417 388)" fill="${skinDeep}"/>`

  const mouth = {
    smile: `<path d="M332 438 Q 400 478 468 438" fill="none" stroke="${skinDeep}" stroke-width="6" stroke-linecap="round"/><path d="M326 432 q 6 4 8 12 M474 432 q -6 4 -8 12" fill="none" stroke="${skinDeep}" stroke-width="4" stroke-linecap="round"/>`,
    smirk: `<path d="M340 446 Q 400 460 462 430" fill="none" stroke="${skinDeep}" stroke-width="6" stroke-linecap="round"/><path d="M466 424 q -2 8 -8 12" fill="none" stroke="${skinDeep}" stroke-width="4" stroke-linecap="round"/>`,
    neutral: `<path d="M344 446 Q 400 454 456 446" fill="none" stroke="${skinDeep}" stroke-width="6" stroke-linecap="round"/>`,
    grin: `<path d="M330 432 Q 400 500 470 432 Q 400 452 330 432 Z" fill="#3a1a12" stroke="${skinDeep}" stroke-width="5" stroke-linejoin="round"/><path d="M344 438 Q 400 452 456 438 L 452 450 Q 400 462 348 450 Z" fill="#f8f2e6"/>`,
  }[expr.mouth]

  return { defs, ears, skull, hair, face: face + brow + eyes + nose + mouth }
}

// ── accessories drawn over the head ─────────────────────────────────────────
function headwear(kind, tr, p) {
  const c = kind === tr.accessories[0] ? tr.accessoryColor : tr.trimColor
  const d = darken(c, 0.22)
  switch (kind) {
    case 'glasses': {
      const clear = luminance(c) > 0.75
      const frame = clear ? '#2a221c' : tr.fur === 'onyx' ? GOLD : INK
      return (
        `<defs><linearGradient id="${p}lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(c, 0.15)}"/><stop offset="1" stop-color="${darken(c, 0.35)}"/></linearGradient></defs>` +
        [350, 450]
          .map(
            (x) =>
              `<circle cx="${x}" cy="308" r="47" fill="${clear ? '#ffffff' : `url(#${p}lens)`}" opacity="${clear ? 0.22 : 0.94}"/><path d="M${x - 30} 290 a 34 34 0 0 1 26 -20" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".55"/><circle cx="${x}" cy="308" r="47" fill="none" stroke="${frame}" stroke-width="8"/>`,
          )
          .join('') +
        `<path d="M397 304 Q 400 294 403 304" fill="none" stroke="${frame}" stroke-width="8"/><path d="M303 300 L 244 318 M497 300 L 556 318" stroke="${frame}" stroke-width="7" stroke-linecap="round"/>`
      )
    }
    case 'shades':
      return (
        [292, 408].map((x) => `<rect x="${x}" y="276" width="100" height="64" rx="16" fill="${c}"/><path d="M${x + 14} 292 h 36" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".45"/>`).join('') +
        `<path d="M282 280 H518" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M286 286 L 240 312 M514 286 L 560 312" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`
      )
    case 'bucket-hat':
      return (
        `<path d="M170 256 C 200 214 600 214 630 256 C 610 290 190 290 170 256 Z" fill="${d}"/>` +
        `<path d="M250 252 C 252 118 330 92 400 92 C 470 92 548 118 550 252 Z" fill="${c}"/>` +
        `<path d="M254 222 C 330 238 470 238 546 222 L 549 248 C 470 264 330 264 251 248 Z" fill="${darken(c, 0.35)}"/>` +
        `<path d="M300 140 C 340 112 460 112 500 140" fill="none" stroke="${lighten(c, 0.2)}" stroke-width="5" opacity=".6"/>` +
        `<circle cx="300" cy="200" r="5" fill="${lighten(c, 0.3)}"/><circle cx="500" cy="200" r="5" fill="${lighten(c, 0.3)}"/>`
      )
    case 'beanie': {
      let ribs = ''
      for (let x = 244; x <= 556; x += 16) ribs += `<path d="M${x} 230 V 272" stroke="${d}" stroke-width="4"/>`
      return (
        `<path d="M234 262 C 226 96 574 96 566 262 Z" fill="${c}"/><path d="M300 150 C 350 120 450 120 500 150" fill="none" stroke="${lighten(c, 0.18)}" stroke-width="6" opacity=".6"/>` +
        `<rect x="226" y="224" width="348" height="54" rx="27" fill="${lighten(c, 0.08)}"/>${ribs}` +
        `<circle cx="400" cy="104" r="30" fill="${lighten(c, 0.15)}"/><circle cx="392" cy="96" r="10" fill="${lighten(c, 0.35)}" opacity=".6"/>`
      )
    }
    case 'cap':
      return (
        `<path d="M238 258 C 236 104 564 104 562 258 Z" fill="${c}"/>` +
        `<path d="M400 112 V 256 M318 124 C 300 170 296 220 298 256 M482 124 C 500 170 504 220 502 256" fill="none" stroke="${d}" stroke-width="4"/>` +
        `<circle cx="400" cy="114" r="12" fill="${d}"/>` +
        `<path d="M232 252 C 320 312 480 312 568 252 C 548 280 252 280 232 252 Z" fill="${d}"/>` +
        `<circle cx="400" cy="196" r="26" fill="${tr.trimColor}"/><text x="400" y="207" font-family="Georgia, serif" font-size="30" font-weight="700" text-anchor="middle" fill="${c}">K</text>`
      )
    case 'headphones':
      return (
        `<path d="M222 330 C 210 112 590 112 578 330" fill="none" stroke="${c}" stroke-width="26" stroke-linecap="round"/><path d="M236 300 C 236 140 564 140 564 300" fill="none" stroke="${lighten(c, 0.25)}" stroke-width="6" opacity=".5"/>` +
        [-1, 1].map((s) => {
          const x = s < 0 ? 194 : 542
          return `<rect x="${x}" y="280" width="64" height="124" rx="30" fill="${c}"/><rect x="${s < 0 ? x + 38 : x}" y="292" width="26" height="100" rx="12" fill="${darken(c, 0.4)}"/><rect x="${x + 10}" y="300" width="10" height="50" rx="5" fill="${lighten(c, 0.3)}" opacity=".6"/>`
        }).join('')
      )
    case 'earring':
      return `<circle cx="220" cy="410" r="14" fill="none" stroke="${kind === tr.accessories[0] ? c : GOLD}" stroke-width="6"/><circle cx="214" cy="402" r="3" fill="#fff" opacity=".7"/>`
    case 'crown':
      return (
        `<path d="M282 214 L 296 112 L 346 168 L 400 92 L 454 168 L 504 112 L 518 214 Z" fill="${c}" stroke="${darken(c, 0.35)}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M284 196 H516" stroke="${darken(c, 0.35)}" stroke-width="5"/>` +
        [[296, 112], [400, 92], [504, 112]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${lighten(c, 0.35)}"/>`).join('') +
        [['#c0334a', 330], ['#2f7ac0', 400], ['#3fa06a', 470]].map(([g, x]) => `<circle cx="${x}" cy="176" r="11" fill="${g}" stroke="${lighten(c, 0.3)}" stroke-width="3"/>`).join('')
      )
    case 'flower-crown': {
      let out = ''
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (1.1 + (0.8 * i) / 8)
        const x = 400 + Math.cos(a) * 170
        const y = 262 + Math.sin(a) * 110
        if (i % 2) {
          out += `<ellipse cx="${x.toFixed(1)}" cy="${(y + 6).toFixed(1)}" rx="20" ry="9" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${(y + 6).toFixed(1)})" fill="#3f9a62"/>`
        }
        const petals = [0, 1, 2, 3, 4].map((k) => {
          const pa = (k / 5) * Math.PI * 2
          return `<circle cx="${(x + Math.cos(pa) * 13).toFixed(1)}" cy="${(y + Math.sin(pa) * 13).toFixed(1)}" r="11" fill="${i % 3 === 1 ? lighten(c, 0.35) : c}"/>`
        })
        out += petals.join('') + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${i % 2 ? '#fff6c8' : '#f2b84a'}"/>`
      }
      return out
    }
    default:
      return ''
  }
}

function helmet(p) {
  return (
    `<defs><radialGradient id="${p}glass" cx="35%" cy="25%" r="80%"><stop offset="0" stop-color="#ffffff" stop-opacity=".28"/><stop offset=".6" stop-color="#bcd3ff" stop-opacity=".08"/><stop offset="1" stop-color="#bcd3ff" stop-opacity=".22"/></radialGradient></defs>` +
    `<circle cx="400" cy="326" r="252" fill="url(#${p}glass)" stroke="#dfe4ee" stroke-width="16"/>` +
    `<path d="M232 230 C 260 150 330 104 410 98" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity=".55"/><path d="M220 290 C 222 270 226 258 230 248" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".4"/>`
  )
}

function helmetCollar() {
  return `<ellipse cx="400" cy="574" rx="210" ry="46" fill="#b9bec8"/><ellipse cx="400" cy="566" rx="196" ry="36" fill="#dfe3ea"/>`
}

// ── composition ─────────────────────────────────────────────────────────────
function apeSvg(id, tr, view) {
  const p = `${id.replace(/[^a-z0-9]/gi, '')}${view}`
  const rand = prng(id)
  const bgRand = prng(`${id}-bg`)
  const expr = view === 'outtake' ? { eyes: tr.eyes === 'wide' ? 'wink' : 'wide', mouth: tr.mouth === 'grin' ? 'smile' : 'grin' } : { eyes: tr.eyes, mouth: tr.mouth }
  const h = head(tr, p, rand, expr)
  const has = (a) => tr.accessories.includes(a)
  const behindHead = has('helmet') ? helmetCollar() : ''
  const jewel = ['necklace', 'beads'].filter(has).map((k) => chestJewel(tr, k)).join('')
  const overHead = tr.accessories.filter((a) => !['necklace', 'beads', 'helmet'].includes(a)).map((a) => headwear(a, tr, p)).join('')
  // Hats replace the hair; the shadow under the chin grounds the head on the body.
  const hidesHair = tr.accessories.some((a) => ['bucket-hat', 'beanie', 'cap', 'crown'].includes(a))
  // Bust framing like the Figma cards; the body is raised so the neck stays short.
  const viewBox = view === 'closeup' ? '165 115 470 470' : '60 40 680 680'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="800" height="800">` +
    background(tr, view, p, bgRand) +
    h.defs +
    `<g transform="translate(0 -34)">` +
    neck(FURS[tr.fur].fur, p) +
    outfit(tr, p) +
    behindHead +
    jewel +
    `</g>` +
    h.ears +
    h.skull +
    (hidesHair ? '' : h.hair) +
    h.face +
    overHead +
    (has('helmet') ? helmet(p) : '') +
    `</svg>`
  )
}

// ── export ──────────────────────────────────────────────────────────────────
const entries = Object.entries(apeTraits).filter(([id]) => !only || only.has(id))
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setContent('<!doctype html><html><body></body></html>')
  let bytes = 0
  for (const [id, traits] of entries) {
    const dir = join(OUT, id)
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    for (const view of APE_VIEWS) {
      const svg = apeSvg(id, traits, view)
      if (args.preview !== undefined) await writeFile(join(dir, `${view}.svg`), svg)
      const encoded = await page.evaluate(
        async ({ svg, sizes }) => {
          const img = new Image()
          img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
          await img.decode()
          return Promise.all(
            sizes.map(async ({ px, quality }) => {
              const canvas = document.createElement('canvas')
              canvas.width = px
              canvas.height = px
              const ctx = canvas.getContext('2d')
              ctx.imageSmoothingQuality = 'high'
              ctx.drawImage(img, 0, 0, px, px)
              const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
              return [...new Uint8Array(await blob.arrayBuffer())]
            }),
          )
        },
        { svg, sizes: SIZES },
      )
      for (const [i, size] of SIZES.entries()) {
        const data = Buffer.from(encoded[i])
        bytes += data.length
        await writeFile(join(dir, `${view}${size.suffix}.webp`), data)
      }
    }
    console.log(`${id}: ${APE_VIEWS.length} views × ${SIZES.length} sizes`)
  }
  console.log(`\n${entries.length} characters, ${(bytes / 1024).toFixed(0)} KiB of WebP in ${OUT}/`)
} finally {
  await browser.close()
}
