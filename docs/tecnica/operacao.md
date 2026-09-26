# Operação e implantação

## Topologia de produção

A implantação de referência usa:

- um proxy HTTPS confiável;
- o contêiner `app`, sem privilégios e ouvindo internamente na porta 3000;
- PostgreSQL em rede interna, sem porta pública;
- um volume para o banco e outro para `public/uploads`.

O cookie administrativo exige HTTPS em produção. Configure `TRUST_PROXY=1` somente quando houver exatamente um proxy confiável entre o cliente e o Express.

## Preparação

```bash
cp .env.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --wait
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npm run db:seed
```

Defina em `.env.production` um `SESSION_SECRET` aleatório, `APP_URL` HTTPS e credenciais exclusivas para o banco. Dentro dos contêineres, `DATABASE_URL` deve usar `postgres:5432`, e não `localhost`.

O entrypoint aguarda o banco, executa `db:deploy` e inicia `node server.js`. Uma migração com falha impede o início. O seed não é automático em produção.

## Primeira conta administrativa

Passe as credenciais apenas ao processo temporário do seed:

```bash
read -rp 'E-mail do administrador: ' ADMIN_EMAIL
read -rsp 'Senha inicial: ' ADMIN_PASSWORD
printf '\n'
read -rp 'Nome do administrador: ' ADMIN_NAME
export ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm \
  -e ADMIN_EMAIL -e ADMIN_PASSWORD -e ADMIN_NAME app npm run db:seed
unset ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME
```

Remova essas variáveis do serviço permanente. Depois, mantenha ao menos duas contas `SUPER_ADMIN` ativas.

## Atualização

A imagem publicada é `ghcr.io/prinako/cosoremi-portal`. Prefira fixar `COSOREMI_IMAGE` no SHA aprovado.

1. Revise novas migrações e compatibilidade com a versão em execução.
2. Faça e verifique um backup do banco e dos uploads.
3. Baixe a imagem e suba os serviços.
4. Aguarde a saúde e confira logs.
5. Faça um teste rápido do site, login e publicação.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-build --wait
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 app
```

Voltar a tag da imagem não desfaz migrações. Planeje compatibilidade regressiva ou uma restauração validada antes de mudanças destrutivas de schema.

## Saúde e monitoramento

O Compose consulta `/health`. A resposta saudável confirma processo HTTP e acesso ao banco; ela não confirma conteúdo editorial, escrita em uploads, entrega pelo proxy ou validade do certificado.

Monitore pelo menos:

- disponibilidade externa via HTTPS;
- estado e reinícios dos contêineres;
- espaço em disco dos volumes;
- falhas de login, migração e upload nos logs;
- idade e sucesso dos backups;
- vencimento de domínio e certificado.

## Backup

Banco e uploads precisam de backups coordenados. Exemplo de dump lógico:

```bash
mkdir -p backups
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backups/cosoremi.sql
```

Exemplo de cópia das imagens:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  cp app:/app/public/uploads backups/uploads
```

Proteja os backups, mantenha cópias fora do host e defina retenção. Para uma cópia consistente, suspenda alterações editoriais enquanto banco e arquivos são capturados.

## Restauração

Teste a restauração regularmente em ambiente isolado. O procedimento mínimo é:

1. criar um PostgreSQL vazio compatível;
2. restaurar o dump com `psql`;
3. restaurar uploads no caminho persistente;
4. iniciar a mesma versão da aplicação usada no backup;
5. executar `/health` e conferir site, login, imagens e conteúdo;
6. só então aplicar atualizações e migrações posteriores.

O comando exato depende do formato do backup e da plataforma. Documente credenciais, localização criptografada e responsáveis no runbook privado da infraestrutura; não inclua segredos neste repositório.

## Diagnóstico rápido

### Aplicação não inicia após atualização

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=300 app
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Procure falha de conexão, variável ausente ou migração recusada. Não execute `migrate dev` em produção.

### Seed falha

Verifique conexão com o banco e `ADMIN_EMAIL`/`ADMIN_PASSWORD`. A senha precisa ter ao menos 12 caracteres e no máximo 72 bytes UTF-8. O seed não registra a senha e não redefine uma conta existente.

### Publicação salva, mas não aparece

Confirme estado `PUBLISHED` e `publishedAt` menor ou igual ao horário atual. O formulário administrativo interpreta o horário em UTC.

### Uploads falham

Verifique espaço, montagem e permissão de escrita no volume. O processo roda como usuário não root. Se o banco funciona e todo upload retorna indisponibilidade, confira o volume `uploads_prod` e os logs do app.

### Site saudável apenas dentro do host

Verifique proxy, certificado, DNS, firewall e endereço publicado. O padrão vincula a porta do app a `127.0.0.1` para uso por um proxy local.

## Persistência e ações destrutivas

Preserve o nome do projeto e dos volumes durante atualizações. `docker compose down` preserva volumes; `down -v` exclui os dados persistentes e não deve ser executado em produção como rotina.

Alterar `POSTGRES_PASSWORD` no arquivo de ambiente não muda a senha de um banco já criado. Faça a alteração no PostgreSQL e atualize a configuração em uma janela planejada.

## CI e imagem

O workflow do GitHub Actions verifica formatação, testes, integração, configuração do Compose e builds. Em push para `main`, publica a imagem no GHCR. Um build ou publicação bem-sucedido não substitui revisão de migrações, backup, validação do ambiente e teste após implantação.
