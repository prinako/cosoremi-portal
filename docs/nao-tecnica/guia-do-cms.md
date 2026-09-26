# Guia do CMS

Este guia é destinado à equipe editorial e administrativa. O painel fica em `/admin`; quando a sessão não estiver ativa, o sistema encaminha para `/admin/login`.

## Perfis de acesso

| Perfil        | O que pode administrar                                                                       |
| ------------- | -------------------------------------------------------------------------------------------- |
| `EDITOR`      | Publicações, categorias e galeria.                                                           |
| `ADMIN`       | Todo o conteúdo do `EDITOR`, além de páginas, linhas de trabalho, configurações e mensagens. |
| `SUPER_ADMIN` | Todo o CMS, inclusive contas administrativas.                                                |

Cada pessoa deve usar sua própria conta. Ao alterar perfil, senha ou estado ativo de uma conta, as sessões existentes dessa conta são encerradas. O sistema impede que a última conta `SUPER_ADMIN` ativa seja desativada ou rebaixada.

## Publicações do blog

Em **Publicações**, é possível criar, editar e excluir notícias. Os campos principais são:

- **Título e slug:** identificam a publicação e formam seu endereço.
- **Resumo:** aparece nos cards e ajuda o leitor a entender o assunto.
- **Conteúdo:** corpo da notícia em texto simples.
- **Categoria:** organiza e filtra publicações no blog.
- **Imagem:** capa pública da publicação.
- **Estado:** `Rascunho`, `Publicado` ou `Arquivado`.
- **Data de publicação:** define quando um conteúdo publicado fica visível.
- **SEO:** título e descrição usados por mecanismos de busca e compartilhamentos.

Uma publicação só aparece no site quando seu estado é **Publicado** e a data de publicação já chegou. A data do formulário é interpretada em **UTC**. Se o campo ficar vazio ao selecionar Publicado, a publicação fica disponível imediatamente.

Use este fluxo antes de publicar:

1. Salve como **Rascunho** enquanto prepara e revisa o texto.
2. Confira título, resumo, categoria, imagem, nomes próprios, contatos e links escritos no texto.
3. Selecione **Publicado** e deixe a data vazia para publicar agora, ou informe uma data futura para agendar.
4. Abra a página pública do blog e confirme o resultado.

Para retirar temporariamente uma notícia do site, mude o estado para Rascunho ou Arquivado. Excluir remove o registro e sua imagem do armazenamento; prefira arquivar quando o histórico ainda tiver valor.

## Páginas institucionais

Em **Páginas**, a equipe administra título, subtítulo, conteúdo, imagem, publicação e dados de SEO.

As páginas `inicio`, `sobre-nos`, `doar`, `emergencia` e `contato` possuem endereços fixos. Elas podem ser despublicadas, mas não excluídas. Páginas adicionais são acessadas em `/paginas/slug-da-pagina`.

O conteúdo é texto simples: quebras de linha são preservadas, mas HTML não é interpretado. Estrutura visual, botões e componentes pertencem ao código do portal.

## Linhas de trabalho

As linhas de trabalho apresentam as áreas de atuação da organização. É possível definir conteúdo, imagem, ordem de exibição, estado ativo e dados de SEO.

Itens inativos não aparecem no site. Use a ordem para organizar a sequência; números menores aparecem primeiro.

## Galeria

Cada item da galeria pode ter imagem, título, descrição, categoria, data e estado de publicação. Somente itens publicados aparecem ao público.

Antes de enviar uma foto, confirme autorização de uso e revise se ela revela documentos, endereços, dados médicos ou outras informações pessoais. O CMS não oferece uma área privada para imagens.

## Imagens

O portal aceita JPG/JPEG, PNG e WebP com até **5 MB** e **25 megapixels**. O servidor converte a imagem para WebP, remove metadados durante o processamento e limita suas dimensões.

Boas práticas:

- use uma imagem nítida, com assunto central e boa iluminação;
- evite texto pequeno dentro da imagem;
- use apenas imagens com autorização de publicação;
- não envie documentos, dados confidenciais ou arquivos de atendimento;
- descreva o conteúdo no título ou texto próximo para dar contexto.

## Identidade e configurações

Em **Configurações**, `ADMIN` e `SUPER_ADMIN` podem alterar:

- nome, descrição, logotipo e cores principais do site;
- telefone, WhatsApp, e-mail, endereço e horário de atendimento;
- redes sociais;
- textos e dados de doação, incluindo PIX;
- informações de emergência;
- rótulos dos principais botões.

As alterações aparecem nas próximas requisições ao site. Revise especialmente telefone de emergência, dados de doação e PIX com uma segunda pessoa antes de salvar.

As cores aceitam o formato hexadecimal de seis dígitos, por exemplo `#176B47`. Escolha combinações com contraste suficiente para leitura.

## Mensagens de contato

O formulário público grava mensagens no painel. É possível listar, abrir, marcar como lida ou não lida e excluir uma mensagem. Abrir uma mensagem não muda seu estado automaticamente.

O sistema não envia aviso por e-mail e não faz triagem de urgência. A equipe precisa definir quem consulta a caixa, com qual frequência e por quanto tempo os registros serão mantidos. Demandas de emergência devem usar os canais oficiais exibidos no site.

## Usuários

Somente `SUPER_ADMIN` administra contas. É possível criar uma conta, trocar nome, e-mail, perfil, estado ativo e senha. Contas não são excluídas; quando alguém deixa a equipe, desative a conta para preservar a trilha de auditoria.

Senhas devem ter de 12 caracteres a 72 bytes em UTF-8. Nunca compartilhe senhas em mensagens ou documentos. Mantenha pelo menos duas contas `SUPER_ADMIN` protegidas para recuperação administrativa.

## Solução de problemas comuns

### Uma publicação não aparece no blog

Confira se o estado é **Publicado**, se a data de publicação não está no futuro e se a categoria ainda existe. Lembre que a data informada usa UTC.

### Uma imagem não foi aceita

Confirme formato, tamanho do arquivo e resolução. Exporte novamente como JPG, PNG ou WebP. Se todas as imagens falharem, a equipe técnica deve verificar o armazenamento de uploads.

### A sessão encerrou

Faça login novamente. Sessões expiram e também são encerradas após mudanças administrativas na conta.

### Uma alteração não aparece

Recarregue a página pública. Se o problema continuar, confirme se o item está ativo ou publicado e se a data de publicação já chegou.
