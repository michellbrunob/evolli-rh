# ADR 0018 — Foto de perfil da conta no PostgreSQL

- Status: **Aceito** em 2026-11-13 (decisões FP-1 a FP-8 aprovadas na T208).
- Escopo: foto de perfil da **conta de acesso**, vista só pela titular em Configurações › Meu
  perfil. Não trata foto de colaborador, conteúdo documental nem anexos.
- Relacionado:
  [ADR 0011](0011-documentos-privados-e-admissao-digital.md),
  [ADR 0013](0013-armazenamento-privado-cloudflare-r2.md),
  [dossiê da T208](../decisions/t208-dossie-configuracoes-meu-perfil.md) (seções 27 e 28) e
  [aprovações de Documentos — Etapa 2](../decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md).

## Contexto

Meu perfil mostra as iniciais no lugar da foto. Para uma foto real, a T208 precisava de um lugar
para os bytes. O repositório não tinha armazenamento de arquivo em uso:

- Documentos é só metadado: nenhum upload ou storage existe, por construção (ADR 0011).
- O Cloudflare R2 foi aprovado como provedor do **conteúdo documental** (ADR 0013), mas continua
  fechado pelos portões de Nível 2: credencial de armazenamento (`DP-2E-04`), limites
  (`DP-2E-05`), antivírus e quarentena (`DP-2E-09`), acesso a conteúdo (`DP-2E-13`), retenção e
  descarte (`DP-2E-15`) e MFA obrigatório.
- O plano proíbe introduzir storage por antecipação sem ADR (`.specify/plan.md`, seção 2), e a
  regra de dado pessoal exige finalidade, acesso restrito, auditoria, retenção e contrato antes de
  qualquer foto.

## Decisão

1. **Finalidade.** Identificação visual da própria conta na interface, para a própria pessoa.
2. **Armazenamento.** PostgreSQL, na tabela própria `access_user_foto` (uma linha por conta),
   **separada** de `access_user`. A sessão carrega a linha da conta a cada requisição; os bytes
   da foto nunca viajam junto. A foto é da conta (global), não por empresa.
3. **Acesso.** Só a titular, pela sessão: `GET`, `PUT` e `DELETE /v1/users/me/foto`, sem
   identificador na rota. Gravações exigem `own_account`/`manage` e CSRF; a leitura exige
   `own_account`/`read`. Nenhuma outra conta, papel ou tela vê a foto.
4. **Limites.** Entrada de até 5 MB, recusada antes de qualquer processamento; formato reconhecido
   pelo **conteúdo** (assinatura de JPEG, PNG ou WebP), nunca pela extensão ou pelo tipo
   declarado; ao menos 128 × 128 px; no máximo 25 milhões de pixels, conferidos no cabeçalho antes
   de decodificar e impostos também ao decodificador, contra imagem-bomba.
5. **Processamento no servidor.** O servidor é a autoridade: decodifica a imagem com a biblioteca
   `sharp` (libvips), aplica a orientação, corta o quadrado central, reduz para 256 × 256 e
   **regrava** como JPEG, sem metadados (EXIF, XMP, ICC). Arquivo malformado ou truncado é
   recusado. O navegador só faz a prévia local; o que ele envia é o arquivo original.
6. **Entrega.** Só pela API, para a titular: `Content-Type: image/jpeg`, `Cache-Control:
no-store`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` e CSP
   `default-src 'none'; sandbox`. Não existe URL pública nem URL persistida. O ator informa a
   **versão** da foto (o instante em que foi gravada), e a tela a usa para trocar a imagem.
7. **Concorrência.** A foto entra na versão do perfil (`perfilAtualizadoEm`): gravar ou remover
   com versão desatualizada responde 409 e nada é sobrescrito.
8. **Retenção e remoção.** A foto existe enquanto a titular não a remove. Remover apaga os bytes na
   hora (sem lixeira). Desativar a conta apaga a foto na mesma transação. A linha cai em cascata
   se a conta for excluída. Fotos removidas continuam nos backups até a retenção deles, que segue
   pendente na Etapa 0.
9. **Auditoria.** Eventos `conta.foto.enviada` e `conta.foto.removida`, na mesma transação, sem
   conteúdo, hash, nome, tamanho, dimensões ou metadados do arquivo.

## Por que não o R2 nesta fatia

- Os portões de Nível 2 que condicionam o R2 continuam abertos e dependem de decisões de TI,
  Segurança, DPO e Jurídico, além de MFA obrigatório.
- A foto da conta é uma imagem pequena e normalizada (256 × 256 JPEG), do tamanho de dezenas de
  kB, que cabe no banco, no backup e na CI atuais sem provedor novo nem credencial nova.
- A regravação no servidor neutraliza o conteúdo que chega: só sai uma imagem nova, gerada pelo
  servidor. Isso substitui, **só para a foto da conta**, a inspeção que a ADR 0013 exige para
  conteúdo documental; não vale para documentos nem anexos.

## Alternativas consideradas

| Alternativa                     | Decisão                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Cloudflare R2                   | Adiada até os portões de Nível 2; a ADR 0013 continua valendo para conteúdo documental |
| Coluna na própria `access_user` | Rejeitada: a sessão carrega a conta a cada requisição, e os bytes iriam junto          |
| Sistema de arquivos do servidor | Rejeitada: sem volume, caminho, backup ou política                                     |
| Processamento só no navegador   | Rejeitada: o navegador não é confiável; o servidor precisa decodificar e regravar      |

## Consequências

- Dependência nova na API: `sharp`, com binários prontos para as plataformas da CI e do
  desenvolvimento, sem compilação na instalação.
- Migration aditiva: tabela `access_user_foto` e dois valores novos de auditoria. Contas atuais
  ficam sem foto (iniciais).
- O `pg_dump` passa a incluir as fotos.
- Mostrar a foto a terceiros, foto de colaborador, R2, antivírus e editor de enquadramento exigem
  decisão própria.
