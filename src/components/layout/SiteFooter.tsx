import { Link } from '@tanstack/react-router'

/**
 * Footer (Figma: all desktop frames; mobile frames have none → hidden below md).
 * Only links backed by real features are interactive (collections → filtered catalog).
 * Out-of-scope items are plain text and the newsletter form is disabled: nothing here
 * pretends to work.
 */
const UNAVAILABLE = 'Indisponível nesta versão'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const TEXT_COLUMNS = [
  { title: 'Meu perfil', items: ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'] },
  { title: 'Central de ajuda', items: ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'] },
]

const COLLECTIONS = [
  { id: 'digital-art', label: 'Arte digital' },
  { id: 'photography', label: 'Fotografia' },
  { id: 'music', label: 'Música' },
  { id: '3d-art', label: 'Arte 3D' },
  { id: 'utility', label: 'Utilidade' },
]

const SOCIAL = ['f', 'ig', 'x', 'in', 'yt']

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 hidden max-w-6xl px-6 pb-8 md:block">
      <div className="grid grid-cols-4 gap-6 rounded-t-xl bg-card p-6">
        {FEATURES.map((feature) => (
          <div key={feature.letter} className="border-r border-border pr-6">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
              {feature.letter}
            </span>
            <h2 className="mt-3 text-sm font-semibold">{feature.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{feature.text}</p>
          </div>
        ))}
        <form aria-label="Newsletter" onSubmit={(event) => event.preventDefault()}>
          <h2 className="text-sm font-semibold">Antecipe-se ao próximo lançamento</h2>
          <div className="mt-3 flex">
            <label htmlFor="newsletter-email" className="sr-only">
              E-mail
            </label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="digite seu e-mail..."
              disabled
              title={UNAVAILABLE}
              className="min-w-0 flex-1 rounded-l-sm border border-r-0 bg-background px-2 py-1.5 text-xs disabled:opacity-60"
            />
            <button
              type="submit"
              disabled
              title={UNAVAILABLE}
              className="rounded-r-sm bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              Enviar
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Receba lançamentos selecionados, histórias de criadores e novidades do mercado.{' '}
            <span className="italic">(Inscrição indisponível nesta versão.)</span>
          </p>
        </form>
      </div>

      <div className="grid grid-cols-4 items-center gap-6 bg-surface-band px-6 py-4 text-xs">
        <span className="font-semibold tracking-[0.25em]">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <span>contato@email.com</span>
        <span>+55 11 4002 8922</span>
      </div>

      <div className="grid grid-cols-4 gap-6 rounded-b-xl bg-card p-6 text-xs">
        {TEXT_COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="mb-2 text-sm font-semibold">{column.title}</h2>
            <ul className="space-y-1.5 text-muted-foreground">
              {column.items.map((item) => (
                <li key={item} title={UNAVAILABLE}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <nav aria-label="Coleções">
          <h2 className="mb-2 text-sm font-semibold">Coleções</h2>
          <ul className="space-y-1.5">
            {COLLECTIONS.map((collection) => (
              <li key={collection.id}>
                <Link to="/" search={{ category: [collection.id] }} hash="catalogo" className="text-muted-foreground hover:text-primary">
                  {collection.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="mb-2 text-sm font-semibold">Redes sociais</h2>
          <p className="sr-only">Perfis em redes sociais indisponíveis nesta versão.</p>
          <ul className="flex gap-1.5" aria-hidden="true">
            {SOCIAL.map((network) => (
              <li
                key={network}
                className="grid size-6 place-items-center rounded-sm border border-primary/60 text-[10px] text-primary"
              >
                {network}
              </li>
            ))}
          </ul>
          <h2 className="mt-4 mb-2 text-sm font-semibold">Carteiras compatíveis</h2>
          <p className="inline-block rounded-sm bg-surface-band px-2 py-1 text-[10px] tracking-wider text-primary">
            METAMASK · WALLETCONNECT · COINBASE
          </p>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
