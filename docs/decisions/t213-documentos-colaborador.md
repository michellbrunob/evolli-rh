# T213 — Documentos do colaborador

- **Estado:** aberta em 2026-11-19; primeira fatia **implementada localmente** (API e tela),
  com a **validação visual aprovada pela proprietária em 2026-11-23**. Branch local
  `codex/t213-documentos-colaborador`, a partir do squash da T212 em `main` (`9caf216`,
  PR #205). Aguarda a autorização para publicar a PR; sem push, PR, Ready ou merge.
- **Arquivos reais:** continuam **bloqueados** até o ClamAV estar configurado e a revisão de
  segurança estar concluída. Até lá, só arquivos sintéticos.
- **Pedido da proprietária:** RH e DP anexarem documentos reais do colaborador com rapidez e
  segurança, começando pela etapa 4 "Documentos" do fluxo "Novo colaborador".

## 1. Levantamento de preparação (só leitura, em `9caf216`, antes de qualquer código)

### 1.1 O que já existe

- **R2 para a foto do colaborador (T209, ADR 0020):**
  - cliente próprio, sem SDK, com assinatura SigV4 do `crypto` do Node;
  - porta `ArmazenamentoDeObjetos` (gravar, ler, apagar) e armazenamento falso em memória nos
    testes;
  - os bytes passam pela API (proxy autenticado); não há URL pré-assinada nem CORS;
  - chave só com ids internos, em `v1/empresas/{e}/colaboradores/{c}/foto/…`;
  - leitura do corpo com limite e 413 (`lerCorpoLimitado`), conferência de extensão, tipo
    declarado e assinatura do conteúdo, resposta `private, no-store`, `nosniff` e CSP própria;
  - objetos que não puderam ser apagados vão para uma tabela de limpeza pendente;
  - na Nova admissão, a foto é enviada depois do sucesso da admissão, com nova tentativa na
    confirmação.
  - É o padrão mais próximo, mas documento não pode ser regravado como a foto (a foto é
    recodificada no servidor; PDF não).
- **Documentos só como metadados (T133 e T201, ADR 0011):**
  - `TipoDocumento` por empresa, com referência de aprovação de DPO; `DocumentoMetadado` com
    estado `upload_desabilitado`, sem coluna de conteúdo; `SolicitacaoDocumento`;
  - rotas de listar, registrar e substituir metadado, sem exclusão;
  - aba Documentos da ficha com "Somente registro"; nenhum envio, nenhum download;
  - não há tipos RG, CPF, comprovante, carteira de trabalho ou certidões cadastrados (sem seed).
- **Novo colaborador (T195 e T209):** quatro etapas — Dados básicos, Dados profissionais,
  Endereço e Revisão e conclusão —, com o rodapé de progresso, "Voltar" e "Cadastrar
  colaborador", e o diálogo de confirmação. A admissão é idempotente (`Idempotency-Key`) e
  devolve o id do colaborador. A T209 registrou que não havia etapa de Documentos no assistente.
- **Permissões:**
  - `tipo_documento`, `documento_metadado` e `solicitacao_documento`: RH e DP leem e registram
    metadado (só RH cria tipo); `master_tecnico` só lê; os demais papéis são negados;
  - não existe recurso para o **conteúdo** do documento;
  - fora do escopo da empresa, a resposta é 404.
- **Auditoria:** `AuditService` com evento por ação (ator, papel, empresa, recurso, id,
  resultado), sem coluna de detalhe; proibido registrar o rótulo do tipo documental e, na foto,
  conteúdo, hash, tamanho e chave. A leitura de metadado é auditada de forma obrigatória.
- **Exclusão e retenção:** colaborador nunca é excluído; metadado de documento nunca é apagado
  (substituir cria versão nova); a retenção do conteúdo depende do DP-2E-15, aberto.
- **Upload no servidor:** não há multer nem interceptador de arquivo; não há antivírus nem
  quarentena em código.
- **MFA:** segundo fator por TOTP implementado na API, desligado por padrão (`MFA_ENABLED=false`,
  lançamento inicial da T131).

### 1.2 Portões já decididos que travam o upload real

A ADR 0013 diz que o R2 contratado **não habilita upload nem dado real** enquanto houver portão
obrigatório aberto, e a ADR 0011 lista os portões de Nível 2:

| Portão         | Assunto                                                           | Situação |
| -------------- | ----------------------------------------------------------------- | -------- |
| DP-2E-04       | Credenciais de armazenamento por ambiente, com escopo mínimo      | Aberto   |
| DP-2E-05       | Formatos, tamanho máximo e metadados técnicos                     | Aberto   |
| DP-2E-09       | Antivírus/quarentena e política para conteúdo reprovado           | Aberto   |
| DP-2E-10/11    | Documento como pré-condição da admissão; obrigatórios por vínculo | Aberto   |
| DP-2E-13       | Acesso ao conteúdo (quem baixa)                                   | Aberto   |
| DP-2E-15       | Retenção, anonimização e descarte alcançando o conteúdo           | Aberto   |
| MFA            | Autenticação reforçada para conteúdo sensível                     | Aberto   |
| Revisão humana | Segurança do fluxo de upload antes de produção                    | Aberto   |

Por isso a primeira fatia precisa de uma **ADR nova** (emenda das ADRs 0011 e 0013) registrando
as decisões da seção 3, e de uma trava de ambiente: sem antivírus operante, nada é liberado.

## 2. Decisões aprovadas (2026-11-19)

A proprietária aprovou a primeira fatia com estas decisões, registradas na
[ADR 0021](../adr/0021-documentos-do-colaborador-no-r2-privado.md):

- **Upload via R2 liberado, com condição.** Jurídico e DPO validaram finalidade e base legal
  (registro só da confirmação). **Arquivos reais** só depois de o ClamAV estar configurado e a
  revisão de segurança concluída; tecnicamente, o envio depende de verificador configurado e
  operante (seção 3.1).
- **MFA não exigido nesta fase**; fica como endurecimento futuro.
- **Opcionais:** nenhum documento bloqueia a admissão. Obrigatórios, opcionais ou configuráveis
  por empresa ou cargo continua **pendente** (DP-2E-10/11).
- **Categorias:** RG, CPF, Comprovante de endereço, Carteira de Trabalho, Certidões e Outros.
- **Formatos e limites:** PDF, JPG e PNG; até 10 MB por arquivo, 5 por categoria, 30 por
  colaborador.
- **Armazenamento:** bucket privado, chave opaca só com ids (empresa, colaborador, documento e
  versão); nome original não guardado; download com nome neutro `categoria-AAAA-MM-DD.ext`.
- **Papéis:** RH e DP enviam, baixam, trocam e removem; `master_tecnico` vê só a lista e o
  estado; os demais não veem nem acessam.
- **Depois do cadastro:** os arquivos sobem depois de o colaborador ser criado; falha não desfaz
  a admissão e fica "Não enviado".
- **Troca** cria versão nova; **remoção** é lógica. Documento de outra empresa responde como não
  encontrado. Arquivo sem verificação aprovada nunca é baixado.
- **Auditoria** de envio, verificação, troca, remoção e download, sem conteúdo, nome, categoria,
  tamanho ou chave.
- **Segurança:** ClamAV com quarentena fail-closed; extensão, tipo e conteúdo conferidos antes
  de gravar; nenhuma URL do R2 no navegador; limpeza pendente para objetos sem registro.

## 3. O que está implementado

### 3.1 API (commit `a8469e1`)

- **Migration aditiva** `20261119120000_documentos_colaborador`: `documento_colaborador`
  (categoria, nome só em "outros", remoção lógica), `versao_documento_colaborador` (número,
  chave, formato, tamanho, hash, estado da verificação, chave de idempotência) e
  `limpeza_documento_colaborador_pendente`; CHECKs de forma; sete ações novas de auditoria.
- **Rotas** em `/v1/colaboradores/:colaboradorId/documentos`: listar, enviar, trocar
  (`/:id/versoes`), verificar de novo (`/:id/verificacao`), remover e baixar (`/:id/arquivo`).
  Corpo `application/octet-stream`; categoria, nome, tipo e extensão em cabeçalhos;
  `Idempotency-Key` opcional.
- **Conferência do arquivo** antes de gravar e **antivírus** pelo `clamd` (sem dependência nova).
- **Trava do antivírus (correção pós-revisão, 2026-11-23):** o arquivo passa pelo antivírus antes
  de qualquer gravação. Sem verificador configurado e operante (ausente, fora do ar, recusando
  conexão ou sem resposta no tempo), envio e troca respondem 503 com o código
  `documento_verificacao_indisponivel`, sem detalhe interno, e nada é gravado (R2, documento,
  versão, limpeza ou trilha). Com resposta, a versão nasce aprovada ou reprovada. O verificador
  falso só é aceito com `NODE_ENV` de desenvolvimento ou teste.
- **Remoção só lógica no banco:** migration `20261123120000_documentos_colaborador_remocao_logica`
  revoga o `DELETE` do usuário da aplicação em `documento_colaborador` e
  `versao_documento_colaborador`; a limpeza pendente mantém o `DELETE`.
- **RBAC:** recursos `documento_colaborador` (lista e escrita) e `conteudo_documento_colaborador`
  (download).

### 3.2 Tela

- **Etapa 4 "Documentos" do Novo colaborador**, no lugar de "Revisão e conclusão", na composição
  aprovada:
  - título "Documentos" e o texto "Opcional. Os arquivos são enviados quando o cadastro é
    concluído.";
  - seção "Documentos principais", com a contagem "N de 5 anexados.";
  - cada linha com "Pendente" e "Enviar arquivo"; escolhido o arquivo, a linha mostra o ícone, o
    nome e o tamanho, o botão de ver e o menu "⋯" com Trocar arquivo e Remover arquivo;
  - "Outros documentos" com "Novo documento", campo de nome e "Adicionar";
  - rodapé com 100%, Voltar e Cadastrar colaborador.
- **Depois do cadastro:** cada arquivo sobe com chave própria; a confirmação mostra "Enviando…",
  "Aprovado", "Em verificação", "Reprovado" ou "Não enviado", com texto e ícone. Só a falha
  transitória (rede, servidor ou armazenamento indisponível) oferece "Tentar de novo"; formato,
  tamanho, conteúdo, limite, nome, acesso e arquivo reprovado trazem o que fazer, sem nova
  tentativa.
- **Proteção de saída:** arquivo escolhido conta como edição pendente (sair, voltar, trocar de
  empresa ou fechar pedem confirmação). Enquanto os documentos sobem, a página conta como
  salvando e "Registrar outra admissão" fica bloqueado, com o aviso ligado ao botão.
- **Ficha › Documentos:** seção "Arquivos do colaborador" acima do registro de metadados, com a
  lista e o estado de cada arquivo; RH e DP enviam, veem, baixam, trocam, verificam de novo e
  removem (com confirmação); o `master_tecnico` vê só a lista e o estado.
- **Ver** abre o arquivo numa aba nova a partir da memória do navegador, buscado pela rota
  autenticada; nunca por URL do armazenamento.
- **Baixar** (correção pós-revisão) usa o mesmo padrão do Dashboard: link temporário inserido no
  documento e endereço revogado depois do clique.
- **Foco** (correção pós-revisão): ao escolher, trocar ou remover arquivo, na etapa 4 e na
  ficha, o foco vai a um controle visível da mesma linha — "Ver" quando há arquivo (ou o "⋯" se
  ele não pode ser visto), "Enviar arquivo" quando não há; ao tirar um Outro da lista, o campo
  "Novo documento". O foco adiado nunca fecha um menu ou diálogo já aberto.
- **Antivírus indisponível:** a tela diz que a verificação está indisponível, que o arquivo não foi
  enviado e oferece nova tentativa.

### 3.3 Diferenças em relação à proposta de preparação

- A revisão completa da antiga etapa 4 saiu; o diálogo de confirmação manteve só o resumo de
  identificação (regra da T179: nunca contatos nem endereço).
- Os textos ficaram "Documentos principais" (e não "obrigatórios", porque nenhum é) e
  "N de 5 anexados".
- O exemplo do campo de "Outros" é "Contrato de experiência", para não induzir dado de saúde no
  nome; não há outra orientação na tela.
- A trava de ambiente (D19) ficou na API, não na tela: sem ClamAV operante, o envio é recusado
  (503) antes de gravar. Na primeira versão, o arquivo subia e ficava "Em verificação"; a
  revisão final trocou isso pela recusa.

## 4. Validação visual (2026-11-23)

Aprovada pela proprietária na prévia local, com arquivo sintético, o R2 privado configurado no
ambiente local e o verificador falso de desenvolvimento. Cenários conferidos no navegador:

- RH percorre as quatro etapas do Novo colaborador e escolhe um PDF sintético no RG: a linha
  mostra o ícone, o nome, o tamanho, o botão de ver e o menu "⋯", e a seção conta "1 de 5
  anexados.";
- ao cadastrar, a admissão é registrada e a confirmação mostra o RG como "Aprovado";
- na ficha, a seção "Arquivos do colaborador" mostra o RG "Aprovado" e as demais categorias
  "Pendente";
- o download como RH é entregue com o nome neutro `categoria-AAAA-MM-DD.ext` e sem cache;
- o `master_tecnico` vê a lista e o estado, e o download dele é recusado (403);
- a ficha em 375 px não tem rolagem horizontal.

## 5. Limites conhecidos e pendências

- **Arquivos reais bloqueados:** só depois de o ClamAV estar configurado no ambiente e de a
  revisão de segurança do fluxo de envio (portão "Revisão humana" da seção 1.2) estar
  concluída.
- **ClamAV:** a integração existe, mas o serviço não está configurado no ambiente local
  (`CLAMAV_HOST`, `CLAMAV_PORT`); a prévia usa o verificador falso, só de desenvolvimento ou
  teste. Sem verificador operante, a API recusa o envio (503) e nada é gravado.
- Limites conhecidos, mantidos nesta fatia: dois envios simultâneos podem passar do limite de 5
  por categoria ou 30 por colaborador (a contagem não trava a linha); duas trocas simultâneas do
  mesmo documento sem chave de idempotência respondem 500 em vez de 409; se a versão nova for
  reprovada, a anterior aprovada fica preservada mas não é baixada; o hash não é conferido no
  download.
- **Retenção e descarte** (DP-2E-15), **MFA para baixar**, **obrigatoriedade** (DP-2E-10/11),
  **categorias configuráveis**, **outros formatos** e **acesso do próprio colaborador**
  (DP-2E-14) ficam para depois.
- Fora desta fatia: OCR, assinatura, leitura automática, compartilhamento externo, vencimentos,
  retenção automática e envio de documentos pela importação.
