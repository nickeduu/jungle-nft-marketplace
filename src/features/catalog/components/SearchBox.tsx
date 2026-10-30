import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const DEBOUNCE_MS = 300

interface SearchBoxProps {
  /** Unique per instance (mobile and desktop boxes coexist in the DOM). */
  id: string
  value: string
  onSearch: (q: string) => void
}

/**
 * Debounced search (Figma mobile: "Explorar coleções"). Local state while typing; the URL is
 * updated after a pause (or immediately on Enter). External URL changes (back/forward) resync it.
 */
export function SearchBox({ id, value, onSearch }: SearchBoxProps) {
  const [text, setText] = useState(value)
  const lastSubmitted = useRef(value)

  // Back/forward or "clear filters" changed the URL: reflect it in the input.
  useEffect(() => {
    if (value !== lastSubmitted.current) {
      lastSubmitted.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    const normalized = text.trim()
    if (normalized === lastSubmitted.current) return
    const timer = setTimeout(() => {
      lastSubmitted.current = normalized
      onSearch(normalized)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, onSearch])

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault()
        const normalized = text.trim()
        lastSubmitted.current = normalized
        onSearch(normalized)
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar NFTs
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-primary" aria-hidden="true" />
      <input
        id={id}
        type="search"
        placeholder="Explorar coleções"
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        className="h-11 w-full rounded-xl border border-transparent bg-card pr-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none"
      />
    </form>
  )
}
