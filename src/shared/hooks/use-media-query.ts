import { useSyncExternalStore } from 'react'

/** Tailwind breakpoints (rem, as in Tailwind 4's `md:` / `lg:` variants). */
export const BREAKPOINTS = { md: '(min-width: 48rem)', lg: '(min-width: 64rem)' } as const

const lists = new Map<string, MediaQueryList>()
const listFor = (query: string) => {
  let list = lists.get(query)
  if (!list) {
    list = window.matchMedia(query)
    lists.set(query, list)
  }
  return list
}

/**
 * Whether a media query matches, kept in sync on resize/rotation.
 *
 * Used to skip rendering large blocks that CSS would hide anyway (desktop header, sidebar,
 * footer on phones): `display: none` still costs React and DOM work on every render. The CSS
 * classes stay on the elements, so the visual result is the same.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = listFor(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => listFor(query).matches,
  )
}
