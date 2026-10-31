# Lighthouse — 2026-10-31T19:45:47.638Z

Lighthouse 13.6.0 · Chrome 156.0.0.0 · Node v22.18.0 · win32 x64 · commit 22e5246 (+ alterações não commitadas)
Build: vite build + vite preview (VITE_ENABLE_MOCKS=true, cenário default). 3 execuções por página e perfil, Chrome novo a cada execução.
Páginas: home = `/`, detail = `/nfts/nft-distant-galaxy`.

| Cenário | Execução | Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) | CPU bench |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| home-mobile | 1 | 76 | 100 | 100 | 100 | 3614 | 0.026 | 550 | 2078 |
| home-mobile | 2 | 75 | 100 | 100 | 100 | 3556 | 0.026 | 607 | 1711 |
| home-mobile | 3 | 82 | 100 | 100 | 100 | 3543 | 0 | 357 | 1747 |
| **home-mobile** | **mediana** | **76** | **100** | **100** | **100** | **3556** | **0.026** | **550** | **1747** |
| detail-mobile | 1 | 72 | 100 | 100 | 100 | 3503 | 0 | 771 | 1861 |
| detail-mobile | 2 | 77 | 100 | 100 | 100 | 3449 | 0 | 570 | 1901 |
| detail-mobile | 3 | 82 | 100 | 100 | 100 | 3389 | 0 | 387 | 1900 |
| **detail-mobile** | **mediana** | **77** | **100** | **100** | **100** | **3449** | **0** | **570** | **1900** |
| home-desktop | 1 | 99 | 100 | 100 | 100 | 975 | 0.01 | 19 | 1947 |
| home-desktop | 2 | 99 | 100 | 100 | 100 | 1000 | 0.01 | 0 | 1832 |
| home-desktop | 3 | 99 | 100 | 100 | 100 | 1009 | 0.01 | 2 | 1540 |
| **home-desktop** | **mediana** | **99** | **100** | **100** | **100** | **1000** | **0.01** | **2** | **1832** |
| detail-desktop | 1 | 94 | 100 | 100 | 100 | 1061 | 0 | 172 | 1688 |
| detail-desktop | 2 | 99 | 100 | 100 | 100 | 1018 | 0 | 47 | 1277 |
| detail-desktop | 3 | 99 | 100 | 100 | 100 | 918 | 0 | 9 | 1988 |
| **detail-desktop** | **mediana** | **99** | **100** | **100** | **100** | **1018** | **0** | **47** | **1688** |
