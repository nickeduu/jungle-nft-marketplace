import { ZoomIn } from 'lucide-react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/shared/lib/utils'
import { FALLBACK_NFT_IMAGE, NftImage } from './NftImage'

/**
 * Gallery (Figma desktop-02: thumbnails column + main image with zoom; mobile-02: main image).
 * WAI-ARIA tabbed-carousel pattern via Radix Tabs: thumbnails are tabs (←/→, Home, End,
 * automatic activation), the main image is the tab panel. Mobile shows the thumbnails in a
 * row below the image.
 */
export function NftGallery({ name, images }: { name: string; images: string[] }) {
  const sources = images.length > 0 ? images : [FALLBACK_NFT_IMAGE]
  const [index, setIndex] = useState(0)
  const total = sources.length
  const altFor = (i: number) => `${name} — imagem ${i + 1} de ${total}`

  return (
    <TabsPrimitive.Root
      value={String(index)}
      onValueChange={(value) => setIndex(Number(value))}
      activationMode="automatic"
      className="flex flex-col-reverse gap-3 md:flex-row md:items-start md:gap-4"
      data-testid="nft-gallery"
    >
      {total > 1 && (
        <TabsPrimitive.List
          aria-label={`Imagens de ${name}`}
          className="flex gap-2 overflow-x-auto p-1 md:w-20 md:shrink-0 md:flex-col md:overflow-visible md:p-0.5"
        >
          {sources.map((src, i) => (
            <TabsPrimitive.Trigger
              key={src + i}
              value={String(i)}
              aria-label={`Ver imagem ${i + 1} de ${total}`}
              data-testid="gallery-thumbnail"
              className={cn(
                'size-16 shrink-0 overflow-hidden rounded-lg border-2 border-transparent opacity-70 transition outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring md:size-[4.5rem]',
                'data-[state=active]:border-primary data-[state=active]:opacity-100',
              )}
            >
              <NftImage src={src} alt="" width={96} height={96} decoding="async" className="size-full bg-muted object-cover" />
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
      )}
      {sources.map((src, i) => (
        <TabsPrimitive.Content
          key={src + i}
          value={String(i)}
          className="relative min-w-0 flex-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <NftImage
            src={src}
            alt={altFor(i)}
            width={600}
            height={600}
            // The first image is the page's LCP element.
            fetchPriority={i === 0 ? 'high' : 'auto'}
            decoding="async"
            className="aspect-square w-full rounded-2xl bg-muted object-cover"
            data-testid="gallery-main-image"
          />
          <ZoomDialog src={src} title={altFor(i)} />
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}

function ZoomDialog({ src, title }: { src: string; title: string }) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label="Ampliar imagem"
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-background/70 text-foreground transition hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ZoomIn className="size-4" aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 p-3 sm:max-w-3xl">
        <DialogTitle className="pr-10 text-sm font-normal text-muted-foreground">{title}</DialogTitle>
        <DialogDescription className="sr-only">Visualização ampliada. Pressione Esc para fechar.</DialogDescription>
        <NftImage
          src={src}
          alt={title}
          width={1200}
          height={1200}
          className="mx-auto max-h-[calc(100dvh-7rem)] w-auto rounded-lg bg-muted object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
