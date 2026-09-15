# Documentação do COSOREMI Portal

Esta pasta reúne a documentação funcional e técnica do portal. Use a trilha adequada ao seu papel.

## Para equipe institucional e editorial

- [Guia do CMS](nao-tecnica/guia-do-cms.md): acesso, publicação, imagens, configurações, mensagens e usuários.
- [Conteúdo, privacidade e rotina editorial](nao-tecnica/conteudo-e-privacidade.md): responsabilidades, revisão e tratamento de dados.

## Para desenvolvimento e operação

- [Arquitetura](tecnica/arquitetura.md): componentes, fluxo das requisições, dados, segurança e decisões do sistema.
- [Desenvolvimento e testes](tecnica/desenvolvimento-e-testes.md): instalação, banco, scripts, migrações e validação.
- [Operação e implantação](tecnica/operacao.md): produção, atualizações, persistência, backups e diagnóstico.

## Visão geral do produto

O COSOREMI Portal é um site institucional com um sistema de gestão de conteúdo, ou CMS, disponível em `/admin`. A aplicação publica páginas, notícias, linhas de trabalho e galeria; também mantém configurações institucionais e recebe mensagens do formulário de contato.

O CMS não envia e-mails, não gerencia atendimentos ou casos e não deve armazenar documentos ou informações sensíveis de pessoas atendidas. As imagens enviadas ao CMS são públicas.

## Glossário

| Termo     | Significado                                                           |
| --------- | --------------------------------------------------------------------- |
| CMS       | Painel usado para administrar o conteúdo do site sem editar código.   |
| Slug      | Parte legível do endereço, como `acolhimento` em `/blog/acolhimento`. |
| Rascunho  | Conteúdo salvo no CMS que ainda não aparece no site.                  |
| Publicado | Conteúdo que pode aparecer no site, sujeito à data de publicação.     |
| Arquivado | Publicação retirada do site, mas preservada no CMS.                   |
| Seed      | Processo que adiciona configurações e conteúdo inicial ausentes.      |
| Migração  | Alteração versionada da estrutura do banco de dados.                  |

## Manutenção destes documentos

Atualize a documentação na mesma alteração que modificar um fluxo, uma regra de acesso, uma variável de ambiente ou um procedimento operacional. Exemplos e comandos devem ser executáveis, e valores secretos nunca devem ser incluídos nos arquivos versionados.
