import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { CatalogPage, type CatalogPatch } from '@/features/catalog/CatalogPage'
import { validateCatalogSearch } from '@/features/catalog/search-params'

/** Home: highlights + catalog. All catalog state lives in the URL search params. */
export const Route = createFileRoute('/')({
  validateSearch: validateCatalogSearch,
  component: HomeRoute,
})

function HomeRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  // Any filter/search/sort change resets pagination. Typing replaces the history entry.
  const onChange = useCallback(
    (patch: CatalogPatch, options?: { replace?: boolean }) =>
      void navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }), replace: options?.replace ?? false }),
    [navigate],
  )
  const onClear = useCallback(
    () => void navigate({ search: (prev) => (prev.sort ? { sort: prev.sort } : {}) }),
    [navigate],
  )

  return <CatalogPage search={search} onChange={onChange} onClear={onClear} />
}
