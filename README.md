# COSOREMI Portal

Portal institucional e CMS do **COSOREMI — Comité de Solidariedade dos Refugiados e Migrantes**. Administradores gerenciam conteúdo público em `/admin`, sem editar código.

Express + EJS renderizam as páginas no servidor. PostgreSQL armazena conteúdo e sessões; Prisma 6 gerencia os modelos e migrações. A interface usa JavaScript e CSS, sem framework frontend. Licença MIT.

## Requisitos

- Node.js 22.12+ (prefira uma versão LTS compatível) e npm.
- PostgreSQL 15+; Docker é opcional para desenvolvimento.
- Diretório `public/uploads` gravável e persistente.

## Instalação

```bash
npm install
cp .env.example .env
```

Edite `.env` antes de continuar. Para gerar um segredo de sessão:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

### PostgreSQL local com Docker

Defina uma senha de desenvolvimento no seu terminal e use o mesmo valor, codificado para URL se necessário, em `DATABASE_URL`:

```bash
read -rsp 'Senha do PostgreSQL: ' POSTGRES_PASSWORD
export POSTGRES_PASSWORD
printf '\n'
docker run --name cosoremi-postgres \
  -e POSTGRES_USER=cosoremi -e POSTGRES_DB=cosoremi \
  -e POSTGRES_PASSWORD \
  -p 127.0.0.1:5432:5432 \
  -v cosoremi-postgres-data:/var/lib/postgresql/data \
  -d postgres:17-alpine
unset POSTGRES_PASSWORD
```

Use `DATABASE_URL="postgresql://cosoremi:SUA_SENHA@localhost:5432/cosoremi"`. Como alternativa, crie uma base e um usuário com senha no seu serviço PostgreSQL. Não utilize credenciais de produção em testes.

### Variáveis de ambiente

| Variável            | Finalidade                                                                           |
| ------------------- | ------------------------------------------------------------------------------------ |
| `NODE_ENV`          | `development`, `test` ou `production`                                                |
| `PORT`              | Porta HTTP; padrão `3000`                                                            |
| `DATABASE_URL`      | Conexão PostgreSQL usada pelo Prisma e pelas sessões                                 |
| `SESSION_SECRET`    | Segredo aleatório com no mínimo 32 caracteres                                        |
| `APP_URL`           | Origem pública para canonical e Open Graph; HTTPS obrigatório em produção            |
| `TRUST_PROXY`       | `1` somente quando há exatamente um proxy confiável na frente do Express; padrão `0` |
| `ADMIN_EMAIL`       | E-mail da primeira conta, usado somente pelo seed                                    |
| `ADMIN_PASSWORD`    | Senha inicial: mínimo 12 caracteres, máximo 72 bytes UTF-8                           |
| `ADMIN_NAME`        | Nome da primeira conta; opcional                                                     |
| `TEST_DATABASE_URL` | Base separada para testes de integração                                              |

`.env` e uploads ficam fora do Git. Não grave credenciais no README, scripts ou arquivos versionados.

### Migração e seed

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

A migração inicial também cria a tabela `session` e seu índice de expiração. Não é necessário criar tabelas manualmente. Para alterações futuras no schema, use `npm run db:migrate -- --name descricao` no ambiente de desenvolvimento e versione a nova migração. Aplique migrações em produção com `db:deploy`, nunca com `db:migrate`.

O seed é idempotente: adiciona registros ausentes e **não sobrescreve** conteúdo nem senhas existentes. Cria cinco páginas institucionais, seis linhas de trabalho, três categorias e configurações. Os textos iniciais são propostas editoriais; confirme-os com a organização. Contatos, endereço, redes sociais e PIX começam vazios, para evitar informações inventadas.

### Primeiro SUPER_ADMIN

Configure `ADMIN_EMAIL`, `ADMIN_PASSWORD` e, opcionalmente, `ADMIN_NAME` em `.env`, depois execute:

```bash
npm run db:seed
```

Sem e-mail e senha, o seed informa que não criou uma conta. Se o e-mail já existir, ele não altera a senha nem promove o perfil. Remova as variáveis `ADMIN_*` do ambiente após provisionar o usuário. Senhas futuras são alteradas em **Administração → Usuários** por um SUPER_ADMIN.

### Executar

```bash
npm run dev
```

Abra `http://localhost:3000` e `http://localhost:3000/admin`. O endereço de login é `/admin/login`.

Para execução de produção, após configurar o ambiente, gerar o cliente e aplicar migrações:

```bash
NODE_ENV=production npm start
```

## Conteúdo e administração

| Perfil      | Permissões                                                                               |
| ----------- | ---------------------------------------------------------------------------------------- |
| SUPER_ADMIN | Todo o CMS, mensagens e contas administrativas                                           |
| ADMIN       | Páginas, publicações, categorias, galeria, linhas de trabalho, configurações e mensagens |
| EDITOR      | Publicações, categorias e galeria                                                        |

- **Páginas:** título, subtítulo, texto, imagem, publicação e SEO. Os endereços `inicio`, `sobre-nos`, `doar`, `emergencia` e `contato` são fixos; essas páginas podem ser despublicadas, mas não excluídas. Páginas adicionais usam `/paginas/:slug`.
- **Publicações:** CRUD, categoria, resumo, imagem, SEO, slug e estado. Apenas `PUBLISHED` com data menor ou igual ao momento atual é visível ao público. A data do formulário usa **UTC**; em branco, publica imediatamente ao selecionar Publicado. Arquivar ou voltar a rascunho retira o artigo do site.
- **Linhas de trabalho:** CRUD, ordenação, ativação, conteúdo, imagem e SEO.
- **Galeria:** upload, título, descrição, categoria, data e publicação.
- **Configurações:** contatos, WhatsApp, redes sociais, informações de emergência e doação, PIX, identidade e metadados gerais, textos dos botões principais. Alterações aparecem na próxima requisição pública.
- **Mensagens:** lista paginada, leitura individual, marcar como lida/não lida e exclusão com confirmação. Abrir uma mensagem não altera automaticamente seu estado.
- **Usuários:** criar, editar, ativar/desativar, alterar perfil e redefinir senha. Não há exclusão de contas. Alterações invalidam sessões existentes; a última conta SUPER_ADMIN ativa não pode ser desativada ou rebaixada, inclusive em alterações concorrentes.

O conteúdo editorial é **texto simples escapado**, com quebras de linha preservadas. HTML não é executado. O layout permanece nos templates EJS. O formulário de contato grava mensagens no banco; não envia e-mails nem faz triagem de emergência.

## Rotas públicas

`/`, `/sobre-nos`, `/linhas-de-trabalho`, `/linhas-de-trabalho/:slug`, `/blog`, `/blog/:slug`, `/galeria`, `/doar`, `/emergencia`, `/contato` (GET e POST) e `/paginas/:slug`. Blog e galeria têm paginação; o blog também filtra categorias. Rotas e conteúdo indisponíveis retornam 404.

## Arquitetura

```text
server.js                Inicialização, conexão e encerramento
app.js                   Composição do Express e middleware
config/                  Ambiente, Prisma e sessões PostgreSQL
routes/                  Rotas públicas, autenticação e administração
controllers/             Fluxos HTTP e renderização
services/                Regras de conteúdo, usuários, autenticação e uploads
validators/              Schemas Zod e limites de entrada
middleware/              Autenticação, perfis, CSRF, upload e erros
utils/                   Slug, paginação e helpers HTTP
prisma/                  Schema, migração inicial e seed
views/pages/             Páginas públicas
views/admin/             Painel e formulários administrativos
views/partials/          Cabeçalho, rodapé, cards e paginação
public/css/ e public/js/  Estilos e comportamento responsivo
public/uploads/          Imagens locais, não versionadas
tests/                   Testes de segurança e integração
```

Os recursos editoriais compartilham um controlador de CRUD e formulários estruturados, definidos por uma lista explícita de modelos e perfis em `services/content.service.js`. Isso evita duplicar cinco implementações equivalentes. Configurações, usuários e contatos têm controladores próprios. Não há nomes de tabelas definidos livremente pelo cliente.

Modelos: `User`, `Page`, `Category`, `Post`, `WorkArea`, `GalleryItem`, `Setting`, `Contact`, `AuditLog`. O modelo técnico `Session` corresponde à tabela SQL `session` usada pelo `connect-pg-simple`, evitando divergência em futuras migrações.

### Base preservada

Foram reaproveitados o padrão de cabeçalho/rodapé EJS, variáveis CSS, cards, grids, menu responsivo, carregamento tardio de imagens e link para pular ao conteúdo. O menu ganhou fechamento por Escape e respeito à preferência de movimento reduzido. Componentes específicos da aplicação anterior foram removidos após a substituição funcional.

## Imagens

Aceita JPG/JPEG, PNG e WebP, até **5 MB** e **25 megapixels**. O servidor valida extensão, MIME e decodificação, remove metadados ao reprocessar, limita a 2000 × 2000 pixels e grava WebP com UUID. SVG e nomes fornecidos pelo usuário não são usados para armazenamento. Imagens ficam em `public/uploads/blog`, `gallery` ou `pages`. Sem imagem, os cards usam um fundo gradiente.

Uploads novos que falham ao salvar no banco são removidos; substituição e exclusão removem o arquivo anterior. Falhas de limpeza são registradas sem conteúdo pessoal. Uma interrupção abrupta pode deixar arquivos órfãos: revise-os junto à política de backups. Não altere caminhos de arquivos manualmente no banco nem compartilhe arquivos entre registros.

Monte um volume persistente para `public/uploads` e faça backup junto ao PostgreSQL. Para múltiplas instâncias, será necessário armazenamento compartilhado ou adaptar `upload.service.js` a object storage. Os uploads são mídia pública: não envie arquivos confidenciais.

## Segurança e operação

- bcrypt com custo 12; hashes nunca entram nos templates.
- Sessões PostgreSQL de até 8 horas, regeneradas no login; cookies HttpOnly, SameSite=Lax e Secure em produção. Sessões são revogadas após mudanças de conta.
- Permissões verificadas no backend. Conteúdo e auditoria são gravados na mesma transação. Alterações de usuários usam trava transacional para proteger o último SUPER_ADMIN.
- Tokens CSRF ligados à sessão em todas as mutações, inclusive login, logout, uploads e contato. Formulários com token e páginas administrativas não são armazenados em cache.
- Helmet/CSP, limite global de requisições, limite de login e contato, corpos limitados, validação Zod e saída EJS escapada.
- Rate limits usam memória por processo. Em múltiplas instâncias, configure limitação compartilhada no proxy ou um store apropriado.
- Sem HTML editorial, scripts inline ou dependência de fontes remotas. Canonical e Open Graph usam `APP_URL`.
- Erros não expõem stack traces, consultas, credenciais ou detalhes do banco. Auditoria registra ações e IDs, sem senhas nem corpo de mensagens.
- O sistema não é um prontuário ou gestor de casos: não coleta documentos nem cria tabelas de dados sensíveis de beneficiários. Defina retenção e responsáveis pelo acesso às mensagens comuns de contato.

Antes de publicar: configure domínio/HTTPS, proxy confiável, banco com usuário de privilégios mínimos, segredo aleatório, backups/restauração, monitoramento e volume de uploads. Preencha e revise contatos, informações de emergência e doação e textos institucionais. Restrinja a porta do Node ao proxy. O aplicativo não oferece recuperação de senha por e-mail; mantenha uma segunda conta SUPER_ADMIN protegida para recuperação administrativa.

Prisma permanece na linha 6 para manter a integração CommonJS simples. `deepmerge-ts` recebe override para a versão corrigida; a CLI e migrações são verificadas pelos comandos abaixo. Referências: [Prisma Migrate](https://www.prisma.io/docs/orm/v6/prisma-migrate/getting-started) e [sessões Express](https://expressjs.com/en/resources/middleware/session/).

## Verificação

```bash
npm test
npm run format:check
npm run db:generate
npm audit
```

Integração exige uma base **separada de produção**, migrada e sem dados reais. O teste cria contas temporárias, altera e restaura configurações e limpa seus registros ao terminar:

```bash
export TEST_DATABASE_URL='postgresql://USUARIO:SENHA@localhost:5432/cosoremi_test'
DATABASE_URL="$TEST_DATABASE_URL" npm run db:deploy
DATABASE_URL="$TEST_DATABASE_URL" npm run db:seed
npm run test:integration
unset TEST_DATABASE_URL
```

Sem `TEST_DATABASE_URL`, a suíte de integração é marcada como ignorada; isso não comprova funcionamento do banco. Em ambientes restritos, os testes HTTP precisam poder abrir sockets locais. Para evitar provisionar uma conta real no banco de teste, não exporte `ADMIN_*` durante o seed de teste.

Os testes cobrem validação de contatos, CSRF, perfis, slugs únicos, rascunhos/arquivos/agendamentos, escape de conteúdo, CRUD de conteúdo, uploads, configurações, caixa de entrada, contas e revogação de sessão. Confira `tests/integration/cms.test.js` e `tests/security.test.js`.
