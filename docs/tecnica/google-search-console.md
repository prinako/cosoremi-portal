# Google Search, rastreamento e Search Console

Este guia cobre a preparação técnica do portal e as ações manuais posteriores à implantação. O código torna as URLs públicas rastreáveis e fornece sinais de indexação; ele não garante nem comprova que o Google indexou uma página.

## Origem canônica

`APP_URL` é a única origem usada para canonical, Open Graph, dados estruturados, `robots.txt` e `sitemap.xml`. A configuração aceita HTTP ou HTTPS em desenvolvimento e falha na inicialização da produção se a origem não usar HTTPS. O repositório não comprova um hostname público concreto: confirme o valor de `APP_URL` no ambiente realmente implantado antes de cadastrar a propriedade.

Não crie uma segunda constante de domínio. Uma mudança de hostname deve ser feita na configuração de implantação e acompanhada da estratégia operacional de redirecionamento apropriada.

## Auditoria técnica da base anterior

Antes desta implementação, o portal já renderizava no servidor, usava `lang="pt-BR"`, respeitava `seoTitle` e `seoDescription` de Page, Post e WorkArea, e emitia title, description, canonical e Open Graph básico. `APP_URL` já era validada e a área `/admin` já recebia `X-Robots-Tag: noindex, nofollow`.

Os canonicals eram montados em mais de um lugar, imagens Open Graph usavam concatenação de strings e os parâmetros da URL podiam entrar no canonical sem uma política explícita. As rotas reservadas também podiam ser abertas como `/paginas/:slug`. Não existiam endpoints dinâmicos `robots.txt` ou `sitemap.xml`, Twitter Cards ou dados estruturados. `/health` retornava status operacional sem `X-Robots-Tag`. Não foram encontrados `public/robots.txt`, `public/sitemap.xml`, `public/wlwmanifest.xml`, `<link rel="wlwmanifest">` ou outras referências WLW.

As rotas públicas auditadas foram `/`, `/sobre-nos`, `/doar`, `/emergencia`, `/contato`, `/paginas/:slug`, `/linhas-de-trabalho`, `/linhas-de-trabalho/:slug`, `/blog`, `/blog/:slug` e `/galeria`. Conteúdo ausente já retornava 404 real; páginas públicas não exigiam autenticação; o conteúdo principal já estava no HTML EJS. `/admin`, `/admin/*` e `/admin/login` são privados ou de autenticação. `/health` é operacional.

## Política implementada

- Páginas públicas canônicas usam URLs absolutas derivadas de `APP_URL` e `index, follow`.
- `/paginas/inicio`, `/paginas/sobre-nos`, `/paginas/doar`, `/paginas/emergencia` e `/paginas/contato` respondem com redirecionamento permanente direto para as rotas preferidas.
- Paginação válida é autocanônica (`?page=N`) e recebe título com o número da página; páginas inexistentes continuam retornando 404.
- Filtros de categoria do blog permanecem navegáveis com `noindex, follow`, usam como canonical a listagem equivalente sem o filtro e não entram no sitemap.
- `/health` e toda a área `/admin` enviam `X-Robots-Tag: noindex, nofollow`. O `robots.txt` não bloqueia `/admin`, para que rastreadores possam receber essa diretiva; autenticação e autorização continuam sendo os controles de acesso.
- O sitemap lista somente páginas publicadas canônicas, posts publicados cuja data já chegou, linhas de trabalho ativas e as listagens públicas principais. Galeria não recebe URLs de detalhe inexistentes. `lastmod` aparece somente quando vem de `updatedAt` do registro.
- A página inicial emite `Organization` e `WebSite` com valores institucionais existentes. Posts públicos emitem `BlogPosting`. Propriedades opcionais vazias são omitidas, não há `SearchAction` nem endereço postal inferido, e o JSON-LD é serializado contra quebra do elemento `script`.

## Configurar o Search Console depois da implantação

1. Confirme a origem HTTPS implantada em `APP_URL` e abra essa origem no navegador. Verifique também `/robots.txt` e `/sitemap.xml` nessa mesma origem.
2. Abra o [Google Search Console](https://search.google.com/search-console/) e escolha **Adicionar propriedade**.
3. Cadastre a propriedade de produção correta. Uma propriedade de domínio abrange protocolos e subdomínios e exige verificação DNS; uma propriedade de prefixo de URL precisa coincidir com protocolo e prefixo. Use o tipo que corresponda à administração real do hostname.
4. No fluxo de verificação, escolha o registro DNS TXT e copie exatamente o valor exclusivo fornecido pelo Google. Não use valores de exemplo deste repositório.
5. No provedor DNS autoritativo, adicione o TXT no host/nome indicado pelo provedor (frequentemente vazio ou `@`) e mantenha o valor intacto.
6. Aguarde a propagação DNS e clique em **Verificar** no Search Console. A propagação pode levar tempo; não remova o registro depois da confirmação.
7. Em **Sitemaps**, envie `/sitemap.xml` para a propriedade correta e confirme se o Google conseguiu lê-lo.
8. Em **Inspeção de URL**, inspecione a homepage canônica, teste a URL publicada e, depois da implantação, solicite sua indexação.
9. Inspecione também `/sobre-nos`, `/linhas-de-trabalho` e `/blog`.
10. Acompanhe o relatório **Indexação de páginas**, os motivos de exclusão e os erros de rastreamento.
11. Abra o sitemap enviado para acompanhar URLs descobertas e indexadas.
12. Na Inspeção de URL, compare o canonical declarado pelo portal com o canonical selecionado pelo Google. Divergências devem ser investigadas; canonical é um sinal, não uma ordem absoluta.
13. Use `site:seu-host-de-producao` apenas como verificação manual aproximada. Esse operador não fornece uma contagem autoritativa; Search Console é a fonte diagnóstica principal.

Solicitar indexação ou enviar um sitemap não garante inclusão nos resultados. Rastreamento, seleção de canonical e indexação permanecem decisões do Google e podem levar tempo.

## Referências oficiais

- [Consolidação de URLs duplicadas e canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Robots meta e X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Visão geral de sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Dados estruturados de Article](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Dados estruturados de Organization](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Começar com Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- [Adicionar propriedade](https://support.google.com/webmasters/answer/34592)
- [Verificar propriedade por DNS](https://support.google.com/webmasters/answer/9008080)
- [Inspeção de URL e solicitação de indexação](https://support.google.com/webmasters/answer/9012289)
