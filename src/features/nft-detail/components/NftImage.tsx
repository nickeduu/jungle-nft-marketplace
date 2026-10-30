import { useState, type ComponentProps } from 'react'

export const FALLBACK_NFT_IMAGE = '/images/placeholder-nft.svg'

/** <img> that swaps to the neutral placeholder when the artwork fails to load. */
export function NftImage({ src, onError, ...props }: ComponentProps<'img'>) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>()
  const failed = src !== undefined && failedSrc === src
  return (
    <img
      {...props}
      src={failed ? FALLBACK_NFT_IMAGE : src}
      data-fallback={failed || undefined}
      onError={(event) => {
        if (!failed) setFailedSrc(src)
        onError?.(event)
      }}
    />
  )
}
