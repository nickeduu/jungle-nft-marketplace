import { useState, type ComponentProps } from 'react'
import { nftSrcSet } from '@/shared/lib/nft-image'

export const FALLBACK_NFT_IMAGE = '/images/placeholder-nft.svg'

/**
 * <img> for NFT artworks: with `sizes`, the browser picks the 400 or 800 px file; swaps to
 * the neutral placeholder (and drops the srcset) when the artwork fails to load.
 */
export function NftImage({ src, sizes, onError, ...props }: ComponentProps<'img'>) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>()
  const failed = src !== undefined && failedSrc === src
  const srcSet = !failed && sizes ? nftSrcSet(src) : undefined
  return (
    <img
      {...props}
      src={failed ? FALLBACK_NFT_IMAGE : src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      data-fallback={failed || undefined}
      onError={(event) => {
        if (!failed) setFailedSrc(src)
        onError?.(event)
      }}
    />
  )
}
