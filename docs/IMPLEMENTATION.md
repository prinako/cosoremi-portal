# Relatório de implementação — COSOREMI Portal

## Entrega

A aplicação Express/EJS existente foi convertida em portal institucional com CMS em `/admin`. Foram preservados parciais, grids, cards, variáveis CSS e navegação responsiva; a identidade e os arquivos específicos da aplicação anterior foram removidos.

`server.js` agora trata apenas inicialização e encerramento. `app.js` compõe middleware e rotas. Controladores, serviços, validação e acesso a dados ficam em módulos separados. Conteúdo editorial usa campos estruturados e texto escapado.

## Persistência e gestão

PostgreSQL e Prisma armazenam `User`, `Page`, `Category`, `Post`, `WorkArea`, `GalleryItem`, `Setting`, `Contact` e `AuditLog`. `Session` representa a tabela técnica usada por `connect-pg-simple`.

O CMS permite gerenciar páginas, publicações e categorias, imagens e galeria, linhas de trabalho, configurações institucionais, usuários e mensagens de contato. SUPER_ADMIN controla contas; ADMIN controla conteúdo/configuração/mensagens; EDITOR controla publicações/categorias/galeria. Rascunhos, artigos arquivados e publicações futuras não aparecem publicamente.

O seed adiciona cinco páginas, seis linhas de trabalho, três categorias e configurações sem sobrescrever conteúdo existente. A conta inicial só é criada quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` são fornecidos; `ADMIN_NAME` é opcional.

## Segurança

Sessões PostgreSQL, bcrypt, cookies protegidos, CSRF, Helmet/CSP, rate limiting, validação Zod, autorização no servidor, auditoria transacional e tratamento centralizado de erros. Alterar uma conta revoga suas sessões. Uma trava transacional protege a última conta SUPER_ADMIN ativa.

Uploads limitados a 5 MB e 25 megapixels, com extensão/MIME/decodificação verificados, reprocessamento para WebP e nomes aleatórios. Apenas inclusões de templates usam saída EJS sem escape. O CMS não inclui cadastro de casos nem coleta de documentos de beneficiários.

## Ambiente e execução

Obrigatórias: `DATABASE_URL`, `SESSION_SECRET` (32+ caracteres aleatórios) e `APP_URL`. Configure também `NODE_ENV`, `PORT` e `TRUST_PROXY` conforme a implantação. Consulte `.env.example` e o README.

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Para criar o primeiro administrador, configure as variáveis `ADMIN_*` antes do seed. Acesse `/admin`, que redireciona para `/admin/login`. Use `npm start` no ambiente de produção já configurado.

## Verificações realizadas

Em 14/09/2026, no ambiente local:

- Instalação npm e geração do cliente Prisma concluídas.
- Migração aplicada em PostgreSQL 17 isolado; comparação entre banco e schema sem diferenças.
- Seed sem credenciais e com credenciais aleatórias verificados; repetição preservou dados/senha existentes.
- Inicialização com `npm start` confirmada.
- Nove testes unitários/de compilação passaram.
- Dez cenários de integração passaram (onze resultados incluindo o teste agregador), usando PostgreSQL e sessões reais: rotas/SEO, autenticação/CSRF/perfis, publicações, linhas de trabalho, configurações, contatos, uploads, páginas/categorias, criação/troca de senha e revogação de sessão.
- Chromium verificou rotas públicas, ausência de erros JavaScript, um landmark principal e um H1, ausência de rolagem horizontal nas páginas verificadas, menu móvel e Escape.
- Chromium verificou login, telas administrativas, criação/publicação pelo formulário real e formulário administrativo em viewport móvel.
- Proteção da última conta SUPER_ADMIN confirmada também contra PostgreSQL real.
- `npm audit`: nenhuma vulnerabilidade reportada.
- Formatação e `git diff --check` passaram; referências antigas permanecem apenas nas asserções negativas de testes.
- Credenciais e uploads são ignorados pelo Git. Contas e conteúdo de teste foram removidos.

A verificação de navegador é uma conferência funcional e visual, não uma certificação completa de acessibilidade. Produção, domínio, TLS, restauração de backups e múltiplas instâncias não foram implantados/testados.

## Configuração de produção pendente

Definir hospedagem e domínio HTTPS, credenciais e segredo reais, proxy confiável, backups e volume persistente de uploads. Preencher/revisar contatos, canais de emergência, PIX e textos institucionais. Os campos factuais desconhecidos foram deixados vazios. Para várias instâncias, usar mídia e rate limiting compartilhados. Definir retenção das mensagens de contato.

## Pontos de revisão

- `prisma/schema.prisma` e migração: relações, índices e sessões.
- `services/user.service.js`: revogação de sessão e proteção do último SUPER_ADMIN.
- `middleware/security.js` e `routes/admin.routes.js`: CSRF e limites de acesso.
- `services/upload.service.js`: processamento e limpeza de arquivos.
- `controllers/public.controller.js`: filtros públicos, paginação e metadados.
- `tests/integration/cms.test.js`: fluxos reais cobertos.
- `README.md`: instalação, operação, papéis e limites da solução.
