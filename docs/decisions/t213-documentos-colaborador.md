# T213 — Documentos do colaborador

- **Estado:** aberta em 2026-11-19, **em preparação**: levantamento, dossiê e proposta da primeira
  fatia para aprovação da proprietária. Nenhum código. Branch local
  `codex/t213-documentos-colaborador`, a partir do squash da T212 em `main` (`9caf216`, PR #205).
  Sem push, PR, Ready ou merge.
- **Pedido da proprietária:** RH e DP anexarem documentos reais do colaborador com rapidez e
  segurança, começando pela etapa 4 "Documentos" do fluxo "Novo colaborador".

## 1. Levantamento (só leitura, em `9caf216`)

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

## 2. Primeira fatia proposta — etapa 4 "Documentos" com envio real

### 2.1 Interface (composição; textos e identidade do Evolli)

- **Etapas:** Dados básicos, Dados profissionais, Endereço e **Documentos** (etapa 4 de 4). A
  revisão de hoje vira o resumo do diálogo de confirmação, que já existe (decisão D1).
- **Topo:** título "Documentos" e o texto "Opcional. Escolha os arquivos agora; eles sobem assim
  que o cadastro for concluído. Também dá para anexar depois, pela ficha."
- **Lista central, em linhas:** RG, CPF, Comprovante de endereço, Carteira de trabalho e
  Certidões, sob o título "Documentos da admissão" e a contagem "0 de 5 escolhidos". Nenhum é
  apresentado como obrigatório.
- **Cada linha:** nome do documento, estado ("Pendente" até haver arquivo; depois "Pronto para
  enviar", com o nome do arquivo e as ações "Trocar" e "Tirar") e o botão "Enviar arquivo" à
  direita.
- **Outros documentos:** campo "Nome do documento" (exemplo "Contrato de experiência") e o botão
  "Adicionar", que cria uma linha nova com o mesmo comportamento.
- **Rodapé fixo:** progresso de 100%, "Voltar" e "Cadastrar colaborador".
- **Depois de cadastrar:** a confirmação mostra cada anexo como "Enviando", "Em verificação",
  "Disponível" ou "Não enviado", com "Tentar de novo" por arquivo.
- **Responsividade:** em 375 px, a linha empilha nome e estado sobre o botão de largura total;
  sem rolagem horizontal. Transições curtas só com `prefers-reduced-motion: no-preference`.
- **Acessibilidade:** botões e campos nativos; o campo de arquivo é aberto pelo botão; o estado
  é texto (não só cor) e as mudanças são anunciadas com `role="status"`.
- **Ficha › Documentos:** a mesma linha com "Enviar arquivo", para anexar depois e para refazer
  um envio que falhou; mais "Baixar", "Trocar" e "Remover" nos disponíveis.

### 2.2 Regra de negócio

- **A admissão nunca depende de anexo.** Cadastrar sem arquivo continua possível, e falha de
  anexo nunca desfaz a admissão (D2, ligado ao DP-2E-10/11).
- **Ordem:** a admissão é enviada como hoje; com o id devolvido, cada arquivo sobe em seguida, um
  por vez, cada um com chave de idempotência própria (gerada ao escolher o arquivo), para que a
  nova tentativa não duplique.
- **Arquivo só em memória até o envio:** nada é guardado no navegador nem no rascunho. Se a aba
  for fechada antes do envio, o anexo é feito depois, pela ficha.

## 3. Decisões para aprovação

| #   | Decisão                  | Proposta                                                                                                                                                                                                                                                             |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Etapa 4                  | "Documentos" substitui "Revisão e conclusão" como etapa 4; o resumo da revisão passa para o diálogo de confirmação.                                                                                                                                                  |
| D2  | Obrigatoriedade          | Todos opcionais na primeira fatia; nunca bloqueiam a admissão. **Pendente:** se serão obrigatórios, opcionais ou configuráveis por empresa ou cargo (DP-2E-10/11, RH + Jurídico).                                                                                    |
| D3  | Categorias               | Fixas do sistema: RG, CPF, Comprovante de endereço, Carteira de trabalho, Certidões e Outros (nome livre). **Futuro:** configuráveis por empresa, ligadas ao catálogo de tipos já existente.                                                                         |
| D4  | Nome de "Outros"         | Até 60 caracteres, mostrado só a quem lê o documento, nunca na auditoria; a tela orienta a não escrever dado de saúde ou detalhe pessoal no nome.                                                                                                                    |
| D5  | Formatos                 | PDF, JPG/JPEG e PNG. Extensão, tipo declarado e assinatura do conteúdo precisam concordar. HEIC, WEBP, DOC e DOCX ficam para depois (DOCX pode levar macro).                                                                                                         |
| D6  | Limites                  | Até 10 MB por arquivo (413 acima); até 5 arquivos por categoria e 30 documentos disponíveis por colaborador.                                                                                                                                                         |
| D7  | Antivírus e quarentena   | ClamAV próprio (sem enviar documento a terceiros). Todo arquivo nasce "Em verificação"; só o aprovado fica disponível; falha ou indisponibilidade do antivírus mantém o bloqueio (fail-closed). Reprovado fica bloqueado para sempre. Nos testes, verificador falso. |
| D8  | Chaves no R2             | `v1/empresas/{empresaId}/colaboradores/{colaboradorId}/documentos/{documentoId}/{versaoId}`, com ids opacos; sem nome, extensão, categoria ou dado pessoal. Bucket privado, um por ambiente.                                                                         |
| D9  | Nome original            | Não é guardado. A lista mostra categoria, data, formato e tamanho; o download sai como `categoria-AAAA-MM-DD.ext`.                                                                                                                                                   |
| D10 | Leitura e download       | Pela API (proxy autenticado), como a foto; sem URL pré-assinada nem CORS nesta fatia. Resposta `attachment`, `private, no-store`, `nosniff` e CSP restritiva. Download auditado de forma obrigatória: sem registro, sem download.                                    |
| D11 | Troca e remoção          | Trocar cria versão nova e preserva a anterior. Remover é lógico: some da lista e deixa de ser baixável, mas o objeto fica no R2 até a política de retenção. Nenhuma exclusão física nesta fatia.                                                                     |
| D12 | Isolamento               | Tudo no escopo da empresa ativa; documento de outra empresa responde 404; a chave do objeto nunca sai da API.                                                                                                                                                        |
| D13 | Papéis                   | **Enviar, baixar, trocar e remover:** RH e DP da empresa. **master_tecnico:** só vê a lista (metadados), sem baixar. **Gestor, colaborador, financeiro, auditor, dpo e admin_tecnico:** negados.                                                                     |
| D14 | MFA                      | O segundo fator por TOTP já existe na API, mas está desligado por padrão (`MFA_ENABLED=false`, T131). Proposta: baixar exige o MFA ligado no ambiente e ativo na conta de quem baixa; enviar não exige. Ligar o MFA para RH e DP é decisão da proprietária.          |
| D15 | Auditoria                | Eventos de envio, verificação (aprovado ou reprovado), download, troca e remoção, com ator, papel, empresa, id, resultado e requisição. Nunca: conteúdo, nome do arquivo, categoria, nome livre de "Outros", hash, tamanho ou chave.                                 |
| D16 | Falha depois do cadastro | A admissão fica; o anexo aparece como "Não enviado", com "Tentar de novo" na confirmação e o envio pela ficha. O reenvio com a mesma chave não duplica.                                                                                                              |
| D17 | Desligamento             | Documentos continuam legíveis por RH e DP; novos envios continuam permitidos (documentos de rescisão).                                                                                                                                                               |
| D18 | Retenção e limpeza       | Sem descarte automático nesta fatia (DP-2E-15 segue com DPO e Jurídico). Objeto gravado sem registro concluído entra numa lista de limpeza pendente, para apagar só depois da política aprovada.                                                                     |
| D19 | Trava de ambiente        | O envio só fica habilitado com R2 e antivírus configurados no servidor; sem eles, a etapa mostra que o envio está indisponível e a admissão segue normalmente.                                                                                                       |
| D20 | ADR                      | Nova ADR registrando D2–D19 como emenda das ADRs 0011 e 0013, com confirmação de DPO sobre finalidade e base legal antes de dado real.                                                                                                                               |

## 4. Fora da primeira fatia

- OCR, leitura automática e conferência de dados do documento.
- Assinatura eletrônica.
- Compartilhamento externo e acesso do próprio colaborador (portal).
- Vencimentos, prazos e alertas.
- Retenção e descarte automáticos.
- Envio de documentos pela importação de planilha.
- Obrigatoriedade por empresa, cargo ou vínculo.
- Categorias configuráveis.
- Formatos além de PDF, JPG/JPEG e PNG.

## 5. Plano de validação da fatia (quando aprovada)

- **Testes antes do código:** etapa 4 (lista, estados, outros, teclado, 375 px), envio depois do
  cadastro com falha e nova tentativa, ficha (enviar, baixar, trocar, remover).
- **API e E2E com PostgreSQL real:** RH e DP enviam e baixam; os demais papéis recusados; outra
  empresa 404; formato e assinatura divergentes recusados; 413 acima do limite; quarentena
  fail-closed (verificador falso aprovando, reprovando e indisponível); download sem MFA
  recusado; auditoria sem conteúdo; armazenamento falso, sem envio ao bucket real.
- **Navegador:** RH e DP, desktop e 375 px, com arquivos sintéticos.
- **Revisão humana de segurança** do fluxo antes de habilitar em produção.
