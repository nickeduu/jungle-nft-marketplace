/**
 * Artworks are published as 800 px WebP with a 400 px `-sm` sibling (public/images/nfts).
 * Returns the matching `srcset`, or undefined for any other URL (served as is).
 */
export function nftSrcSet(src: string | undefined): string | undefined {
  if (!src?.endsWith('.webp')) return undefined
  return `${src.replace(/\.webp$/, '-sm.webp')} 400w, ${src} 800w`
}
