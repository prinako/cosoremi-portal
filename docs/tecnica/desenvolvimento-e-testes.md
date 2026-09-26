# Desenvolvimento e testes

## Requisitos

- Node.js 22.12 ou posterior compatível;
- npm;
- PostgreSQL 15 ou posterior;
- Docker Engine e Compose v2.20 ou posterior, caso use o ambiente em contêiner.

## Ambiente local

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Abra `http://localhost:3000` e `http://localhost:3000/admin`.

Variáveis centrais:

| Variável            | Uso                                                 |
| ------------------- | --------------------------------------------------- |
| `DATABASE_URL`      | Conexão PostgreSQL para conteúdo e sessões.         |
| `SESSION_SECRET`    | Segredo aleatório com ao menos 32 caracteres.       |
| `APP_URL`           | Origem pública usada em canonical e Open Graph.     |
| `NODE_ENV`          | `development`, `test` ou `production`.              |
| `PORT`              | Porta HTTP; padrão 3000.                            |
| `TRUST_PROXY`       | Quantidade de proxies Express confiáveis; padrão 0. |
| `ADMIN_EMAIL`       | E-mail da primeira conta, usado pelo seed.          |
| `ADMIN_PASSWORD`    | Senha inicial, entre 12 caracteres e 72 bytes.      |
| `ADMIN_NAME`        | Nome opcional da primeira conta.                    |
| `TEST_DATABASE_URL` | Banco isolado para integração.                      |

Use uma base exclusiva para testes. Nunca aponte `TEST_DATABASE_URL` para produção ou para um banco com conteúdo que precise ser preservado.

## Ambiente de desenvolvimento com Docker

```bash
docker compose -f docker-compose.dev.yml up --build
```

O serviço aguarda o PostgreSQL, aplica migrações versionadas, executa o seed idempotente e inicia o Nodemon. Código do host é montado em `/app`; módulos, banco e uploads usam volumes separados.

Comandos frequentes:

```bash
docker compose -f docker-compose.dev.yml logs -f app
docker compose -f docker-compose.dev.yml exec app npm test
docker compose -f docker-compose.dev.yml exec app npm run db:seed
docker compose -f docker-compose.dev.yml down
```

`down` preserva volumes. `down -v` apaga banco, uploads e dependências locais e deve ser usado somente quando um reset completo for intencional.

## Scripts npm

| Comando                             | Finalidade                                                |
| ----------------------------------- | --------------------------------------------------------- |
| `npm start`                         | Inicia a aplicação sem observador.                        |
| `npm run dev`                       | Inicia com Nodemon.                                       |
| `npm test`                          | Executa testes rápidos de unidade, segurança e templates. |
| `npm run test:integration`          | Executa fluxos HTTP com PostgreSQL real.                  |
| `npm run db:generate`               | Gera o cliente Prisma.                                    |
| `npm run db:migrate -- --name nome` | Cria e aplica migração no desenvolvimento.                |
| `npm run db:deploy`                 | Aplica migrações existentes.                              |
| `npm run db:seed`                   | Adiciona conteúdo inicial ausente.                        |
| `npm run db:studio`                 | Abre o Prisma Studio.                                     |
| `npm run format`                    | Formata arquivos com Prettier.                            |
| `npm run format:check`              | Verifica formatação sem alterar arquivos.                 |

## Migrações e seed

Após editar `prisma/schema.prisma`, crie uma migração no ambiente de desenvolvimento:

```bash
npm run db:migrate -- --name descricao_curta
```

Revise e versione o SQL criado. Em produção e CI, aplique apenas migrações versionadas com `npm run db:deploy`.

O seed é idempotente: cria configurações e conteúdos iniciais ausentes sem substituir textos ou senhas existentes. A primeira conta só é criada quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` válidos são informados juntos.

## Testes de integração

Prepare um banco separado:

```bash
export TEST_DATABASE_URL='postgresql://USUARIO:SENHA@localhost:5432/cosoremi_test'
DATABASE_URL="$TEST_DATABASE_URL" npm run db:deploy
DATABASE_URL="$TEST_DATABASE_URL" npm run db:seed
npm run test:integration
unset TEST_DATABASE_URL
```

Sem `TEST_DATABASE_URL`, a integração é ignorada. Isso não representa um teste bem-sucedido do banco.

## Verificação antes de enviar uma alteração

```bash
npm run format:check
npm test
git diff --check
```

Execute também `npm run test:integration` quando alterar banco, autenticação, sessão, permissões, controladores, validação, uploads ou fluxos do CMS.

## Como incluir um novo recurso editorial

1. Modele os dados no Prisma e crie uma migração.
2. Adicione validação de entrada e limites explícitos.
3. Implemente regras no serviço, incluindo slug, auditoria e limpeza de upload quando aplicável.
4. Registre o recurso na lista permitida do CMS e defina os perfis autorizados.
5. Adicione rotas, telas administrativas e apresentação pública.
6. Cubra regras de visibilidade, autorização e falha transacional em testes.
7. Atualize a documentação funcional e técnica.

Não aceite nomes de modelos ou campos arbitrários vindos do cliente. Mantenha a lista de recursos e operações permitidas no servidor.
