import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { facetsQuery, highlightsQuery, nftListQuery } from '@/features/catalog/api'
import { CatalogPage, type CatalogPatch } from '@/features/catalog/CatalogPage'
import { toListParams, validateCatalogSearch } from '@/features/catalog/search-params'

/** Home: highlights + catalog. All catalog state lives in the URL search params. */
export const Route = createFileRoute('/')({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  // Non-blocking prefetch: the requests start while the page chunk downloads (the loader is
  // not code-split); the components read the same queries and show skeletons meanwhile.
  loader: ({ context: { queryClient }, deps }) => {
    void queryClient.prefetchQuery(nftListQuery(toListParams(deps)))
    void queryClient.prefetchQuery(highlightsQuery())
    void queryClient.prefetchQuery(facetsQuery())
  },
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
