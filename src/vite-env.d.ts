/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" enables MSW (REST + Socket.IO) in dev, preview and the demo build. */
  readonly VITE_ENABLE_MOCKS: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_SOCKET_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
