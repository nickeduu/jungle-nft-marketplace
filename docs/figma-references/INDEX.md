# Referências do Figma (Kurio)

Capturas de tela (celular, 610×1356, JPEG) do arquivo oficial
https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge — não são exports do Figma:
resolução baixa, compressão JPEG e barra de status do aparelho. Use para composição, hierarquia e
cores aproximadas; medidas exatas, fontes e assets não podem ser extraídos daqui.

| Arquivo | Tela | Observações |
| --- | --- | --- |
| desktop-01-inicio.jpeg | Início | Header, hero, abas (Todos/Novos/Em alta), ordenação, sidebar (Coleções, Faixa de preço, Rede), NFT em destaque, grade 3 col., paginação, banners, Diário da Cunhagem |
| desktop-02-detalhe-nft.jpeg | Detalhe do NFT | Galeria com miniaturas, edições (1/1, 1/10, 1/50, aberta), quantidade, Comprar/Favoritar, abas de detalhes/avaliações, "Mais desta coleção", footer completo |
| desktop-03-carrinho.jpeg | Carrinho | Tabela de itens, quantidades, cupom, resumo (subtotal, desconto, taxa, total), "Colecionadores também viram" |
| desktop-04-pagamento.jpeg | Pagamento | Formulário do colecionador, resumo dos NFTs, seleção de carteira e rede, Confirmar compra |
| desktop-05-confirmacao-pedido.jpeg | Confirmação | Modal: ID da transação, data, total, carteira, itens, taxa, "Ver no Etherscan" |
| desktop-06-login-modal.jpeg | Login | Modal sobre o Início (abas Entrar/Criar conta); visão parcial do canvas |
| desktop-07-cadastro-modal.jpeg | Cadastro | Modal Criar conta; canvas mostra miniaturas mobile e menu do perfil |
| desktop-08-perfil.jpeg | Perfil | Menu lateral "Meu perfil", dados, avatar, alteração de senha |
| desktop-09-carteiras.jpeg | Carteiras | Carteira principal (formulário) e secundária (vazia) |
| mobile-01-inicio.jpeg | Início (mobile) | Busca + botão de filtros, hero em card, abas, grade 2 col. em mosaico, selo "RARO", favoritar, bottom nav |
| mobile-02-detalhe-nft.jpeg | Detalhe (mobile) | Voltar/favoritar, imagem, avaliação, edições, quantidade, Comprar NFT + carrinho |
| mobile-03-carrinho.jpeg | Carrinho (mobile) | Itens com quantidade, cupom, resumo, Conectar e finalizar |
| mobile-04-pagamento-carteira.jpeg | Pagamento (mobile) | Carteiras salvas, conector (WalletConnect/MetaMask/Coinbase), total |
| mobile-05-login.jpeg | Login (mobile) | Logo, e-mail, senha com olho, esqueceu a senha, login social |
| mobile-06-cadastro.jpeg | Cadastro (mobile) | Usuário, e-mail, senha, confirmar senha |

Sem frame próprio (README: devem funcionar em mobile): perfil, carteiras e confirmação.

## Identidade visual extraída

Cores amostradas por pixel (média 5×5, sujeitas a compressão JPEG):

| Uso | Amostra | Token adotado |
| --- | --- | --- |
| Fundo do app | #120E08 / #130D07 | `--background` #120E08 |
| Superfícies (busca, itens, sidebar, footer) | #231812 / #251712 | `--card` #231812 |
| Card de NFT | #291B13 | `--surface-raised` #291B13 |
| Faixa do footer | #36230D | `--surface-band` #36230D |
| Botão principal | #D28A49 (mobile com gradiente até ~#AA7041) | `--primary` #D28A49 |
| Hero mobile | #523820 | gradiente marrom (decorativo) |

Tipografia: monoespaçada em todo o layout (títulos em caixa alta no hero, logo "KURIO" espaçado).
A família exata não é identificável pelas capturas; adotada **Roboto Mono** (inferido) — confirmar no Figma.

## Antes de tornar o repositório público

As capturas reproduzem o arquivo Figma do desafio (link público no README oficial) e não contêm
credenciais nem dados pessoais — apenas a barra de status do celular (hora, bateria, ícone do
WhatsApp). O design pertence à Jungle Gaming; avaliar se as imagens devem permanecer no histórico
público. Remover depois de publicado exige reescrever o histórico.
