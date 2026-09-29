# Etapa 3 — Contrato da futura Central de Solicitações do Colaborador (V1 conceitual)

Status: **CONTRATO CONCEITUAL COM DECISÕES DE PRODUTO APROVADAS EM
2026-09-29** — autoriza especificar e implementar a fundação, mas não habilita
anexos, dado real, produção nem declara conformidade.

Relacionado (contexto interno, sem alteração):
[Jornada e Ponto V1 (detalhada)](etapa3-jornada-ponto-v1-detalhada.md),
[Contrato da fila "Verificar folhas"](etapa3-fila-verificar-folhas-contrato-v1.md),
[Documentos e Admissão Digital — V1 estrutural](etapa2-documentos-admissao-digital-estrutural.md),
[Pacote de decisão da Central de Solicitações](../decisions/pacote-decisao-solicitacoes-pessoas.md),
[Prontidão para operação real](../decisions/prontidao-operacao-real-evolli-rh.md),
[Contrato de persistência e auditoria futura do Ponto](../decisions/contrato-persistencia-auditoria-ponto-v1.md);
ADRs [0003](../adr/0003-identidade-sessao-e-autorizacao.md) (identidade/MFA),
[0004](../adr/0004-auditoria-formal-e-integridade.md) (auditoria),
[0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md) (escopo por
empresa e 404 anti-enumeração),
[0011](../adr/0011-documentos-privados-e-admissao-digital.md) (documentos),
[0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
(governança de perfis) e
[0013](../adr/0013-armazenamento-privado-cloudflare-r2.md) (armazenamento
privado futuro).

## Atualização de decisão — 2026-09-29

As decisões `PD-SOL-01..05` foram aprovadas no
[pacote de decisão](../decisions/pacote-decisao-solicitacoes-pessoas.md), cujo
§7 é a fonte vigente. As marcações de "pendente" preservadas nas seções abaixo
são o histórico do contrato anterior; em caso de divergência, esta atualização
e o registro do pacote prevalecem.

- Catálogo: contestação/ajuste de ponto, ausência, férias, atualização
  cadastral, atestado e benefícios. Solicitação de documento permanece no
  fluxo específico de `solicitacoes-documento`.
- Decisão final: RH. Gestor participa apenas de forma consultiva nos temas de
  organização da equipe; Diretoria atua excepcionalmente.
- Central e fila "Verificar folhas" permanecem separadas, com referência futura
  opcional e sem correção de ponto ou bloqueio automático de fechamento.
- O colaborador cancela somente antes de `em_revisao_rh`. Na V1, "encerrada"
  corresponde ao estado terminal `encaminhada_para_operacao_rh`; RH pode
  reabrir esse estado ou `recusada` com justificativa auditada. Solicitação
  `cancelada` exige novo registro.
- Objetivo de serviço: primeiro retorno do RH em dois dias úteis, com pausa
  quando depender de informação do colaborador ou de outra área. A V1 registra
  datas e eventos para acompanhamento, sem cronômetro automático nem promessa
  de conclusão.
- Evidências seguem os campos mínimos aprovados por tipo. Anexos permanecem
  desabilitados até o fechamento dos portões técnicos e jurídicos de conteúdo.
  Atestado não coleta diagnóstico ou CID no fluxo, e o gestor nunca acessa o
  documento.
- Cloudflare R2 foi aprovado como provedor privado futuro pela ADR 0013. Essa
  escolha não habilita upload nem conteúdo real.

O núcleo TypeScript puro da T066 deve ser reconciliado com essas decisões antes
de ser conectado ao NestJS/Prisma. Em especial, a transição de cancelamento a
partir de `aguardando_informacao` pertence ao desenho anterior e não deve ser
transportada para a fundação persistente sem ajuste e novos testes.

## 0. Natureza e limites deste documento

Este documento **especifica o contrato conceitual** da futura **Central de
Solicitações do Colaborador**: um canal em que, **no futuro**, o colaborador
poderá **consultar e enviar solicitações próprias** — e o RH poderá **revisar e
encaminhar** essas solicitações para o seu próprio fluxo operacional autorizado.
Ele **organiza** fronteiras e estados e **delimita** o que segue aberto — **sem**
implementar nem inventar regra trabalhista.

**Invariável neste documento:**

- **Não implementa nada:** sem portal, código, teste, schema, migration,
  endpoint, API, UI funcional, autenticação, sessão, persistência, anexo, fila
  real, job, dependência ou configuração.
- **Não executa mutação:** a Central **nunca** altera ponto, saldo, cadastro,
  documento, fechamento ou Folha diretamente. Uma solicitação
  aprovada/encaminhada **não** dispara mutação automática.
- **Não calcula dinheiro:** nenhum valor monetário, salário, adicional, DSR
  financeiro, desconto, pagamento ou Folha.
- **Não usa dado real:** nenhum nome, CPF, texto livre, marcação bruta, horário
  exato, atestado, arquivo, imagem, documento pessoal ou dado sensível. Os
  exemplos são **sintéticos** (`Empresa A`, `Vínculo V-001`).
- **Não declara conformidade** com a **CCT**, a **Portaria MTP 671**, a
  **LGPD**, o **eSocial** ou qualquer outra norma, e **não faz interpretação
  jurídica**.
- **Não habilita dado real:** MFA (ADR 0003) e `DS-OPS-01` seguem duros; a
  habilitação futura depende dos gates e da validação RH + Jurídico (§6, §8).

## 1. Finalidade e fronteiras

- **Finalidade (futura):** dar ao colaborador um canal para **consultar** as
  próprias solicitações e **enviar** novas — como um "balcão" de entrada, nunca
  como um executor de mudanças.
- **A Central nunca altera nada diretamente:** ponto, saldo, cadastro,
  documento, fechamento e Folha **não** são modificados pela Central. Ela apenas
  **registra a intenção** do colaborador e a **encaminha** para revisão humana.
- **Toda alteração operacional é do RH, na própria empresa:** qualquer efeito
  trabalhista acontece **fora** da Central, no **fluxo próprio e autorizado do
  RH** (ex.: ajuste rastreável de ponto, operação de cadastro/documento), sempre
  limitado à empresa dona do vínculo.
- **Encaminhar não é executar:** levar uma solicitação ao estado
  `encaminhada_para_operacao_rh` (§4) **não** produz mutação automática — é um
  **handoff** conceitual para o fluxo do RH, não um atalho.

## 2. Catálogo inicial (conceitual, sujeito a aprovação RH + Jurídico)

Tipos **conceituais** (catálogo inicial desta fatia; nomes conceituais, **não**
enum de banco). **Nenhuma** regra de elegibilidade, prazo, efeito trabalhista,
alçada de aprovação ou documento obrigatório é definida aqui.

| Tipo (conceitual)          | Significado (intenção do colaborador)                                      |
| -------------------------- | -------------------------------------------------------------------------- |
| `contestacao_ajuste_ponto` | Contestar/solicitar ajuste de um registro de ponto — **não** corrige nada. |
| `ausencia`                 | Registrar uma solicitação relacionada a ausência.                          |
| `ferias`                   | Registrar uma solicitação relacionada a férias.                            |
| `atualizacao_cadastral`    | Solicitar atualização de um dado cadastral próprio.                        |
| `documento`                | Solicitar um documento.                                                    |

- **Novos tipos não são regra aprovada.** Qualquer tipo adicional fica como
  **pendência** (§8) até decisão de RH + Jurídico — **não** é inventado aqui.
- **Elegibilidade, prazos, efeitos e obrigatoriedade de documento** de cada tipo
  são **pendências** (§8): este contrato **não** os define.

## 3. Estrutura conceitual mínima de uma solicitação

Campos **conceituais** (sujeitos à modelagem; **não** schema), **só referências
técnicas**:

| Campo (conceitual)  | Papel                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| `id`                | Identificador **técnico** da solicitação.                                        |
| `empresaRef`        | Referência técnica da empresa (`empresa_id`), nunca razão social real.           |
| `vinculoRef`        | Referência técnica do vínculo (`VinculoFuncional`), nunca nome/CPF.              |
| `tipo`              | Tipo da solicitação (§2).                                                        |
| `periodoReferencia` | Dia/período de referência, `"AAAA-MM-DD"` (ou faixa técnica) — **se aplicável**. |
| `motivoCodificado`  | Motivo **codificado** (catálogo controlado, sem texto livre — ADR 0008 dec. 5).  |
| `situacao`          | Estado da solicitação (§4).                                                      |
| `refAuditoria`      | Referência técnica ao evento de auditoria (ADR 0004).                            |

- **Nunca** contém: CPF, nome, texto livre, marcação bruta, atestado, arquivo,
  imagem, documento pessoal ou dado sensível. Evidências/anexos ficam
  **bloqueados** nesta fase (§6).

## 4. Estados conceituais e transições

Estados **conceituais** (nomes conceituais, **não** schema/API/UI):

| Estado                         | Significado                                                            | Terminal? |
| ------------------------------ | ---------------------------------------------------------------------- | --------- |
| `rascunho`                     | Colaborador está montando a solicitação; ainda não enviou.             | Não       |
| `enviada`                      | Colaborador enviou; aguarda triagem do RH.                             | Não       |
| `em_revisao_rh`                | RH está revisando (triagem humana).                                    | Não       |
| `aguardando_informacao`        | RH aguarda informação/insumo do colaborador para decidir.              | Não       |
| `encaminhada_para_operacao_rh` | RH encaminhou ao seu fluxo operacional próprio — **sem mutação aqui**. | **Sim**   |
| `recusada`                     | RH recusou a solicitação (com motivo codificado e auditoria).          | **Sim**   |
| `cancelada`                    | Colaborador cancelou a própria solicitação.                            | **Sim**   |

### 4.1 Transições conceituais

```text
rascunho               ──▶ enviada                       (colaborador)
rascunho               ──▶ cancelada                     (colaborador)
enviada                ──▶ em_revisao_rh                 (RH)
enviada                ──▶ cancelada                     (colaborador; janela pendente)
em_revisao_rh          ──▶ aguardando_informacao         (RH)
em_revisao_rh          ──▶ encaminhada_para_operacao_rh  (RH)
em_revisao_rh          ──▶ recusada                      (RH)
aguardando_informacao  ──▶ em_revisao_rh                 (RH)
aguardando_informacao  ──▶ cancelada                     (colaborador; janela pendente)

encaminhada_para_operacao_rh ──▶ (nenhuma)   terminal
recusada                     ──▶ (nenhuma)   terminal
cancelada                    ──▶ (nenhuma)   terminal
```

- **Encaminhamento não altera nada automaticamente.**
  `encaminhada_para_operacao_rh` é **terminal para a Central**: significa apenas
  que a solicitação foi entregue ao fluxo próprio do RH — **nenhuma** marcação,
  saldo, cadastro, documento, fechamento ou Folha é mutado por essa transição.
- **A janela em que o colaborador pode cancelar** após o envio é **pendente**
  (§8) — não é fixada aqui.
- **Reabertura** de um estado terminal **não** é definida aqui — permanece
  **pendente** (§8).
- **Toda transição é auditável** (§5), sem dado pessoal em claro.

> **Fundação implementada (T066).** A **máquina de estados** desta solicitação
> tem um **núcleo TypeScript puro e isolado** em `apps/api/src/solicitacoes/`
> (`solicitacoes.ts`, `solicitacoes.types.ts`), com fixtures **exclusivamente
> sintéticas** e testes unitários.
> `transicionarSolicitacao(solicitacao, acao, ator, refAuditoriaNova)` aplica
> apenas as transições do §4.1, retornando a cada passo uma **nova versão** da
> solicitação + um **evento técnico de auditoria** (imutável — não muta a
> entrada; `aplicarSequenciaSolicitacao` acumula o histórico). O ator é só
> **papel + referências técnicas**: `colaborador` só na própria solicitação
> (`vinculoRef`/`empresaRef` compatíveis), `rh` só na própria empresa
> (`empresaRef`); `master_tecnico`/`dp`/`gestor` são **negados**; escopo
> incompatível falha de forma segura. É **fail-closed** (campos vazios, período
> inválido, tipo/motivo/estado/ação/papel desconhecidos, papel não autorizado,
> ator fora do escopo, transição fora de ordem, terminal). O
> `encaminhar_para_operacao` é **só mudança de estado** — **nenhuma** marcação,
> saldo, cadastro, documento, fechamento ou Folha é tocado. **Permanece fora**
> (não implementado): portal/login/MFA/sessão/API/endpoint/persistência, anexo/
> upload/arquivo/PDF/assinatura/notificação, correção de ponto, débito de Banco
> de Horas, chamada a Ponto/Folha/Documentos/eSocial — **sem**
> NestJS/Prisma/I/O/rede/banco/dado real.

## 5. Permissões conceituais

- **Colaborador (futuro) só acessa as próprias solicitações:** consulta e envia
  **apenas** o que é do próprio vínculo — nunca de terceiros.
- **RH opera solicitações só da própria empresa:** revisar, encaminhar, recusar
  e pedir informação são operações **exclusivas do RH** da empresa dona do
  vínculo.
- **404 anti-enumeração** (ADR 0006; Constituição, Princípio II): acesso a
  solicitação de **outro** vínculo/empresa retorna **não encontrado**, sem
  revelar existência ou metadados.
- **`master_tecnico` sem mutação trabalhista** (ADR 0012 dec. 3): não envia, não
  revisa, não encaminha, não recusa.
- **DP, `gestor` e demais perfis não ganham operação por inferência:** nenhum
  perfil recebe capacidade sobre a Central sem decisão própria.
- **Sem infraestrutura de acesso aqui:** este contrato **não** cria login,
  sessão, MFA, RBAC de aplicação ou endpoint — apenas descreve o modelo de
  permissão conceitual.

## 6. Privacidade e evidências

- **Anexos, atestados, imagens, documentos e texto livre ficam bloqueados
  nesta fase** — a Central conceitual trabalha **só com referências técnicas e
  motivos codificados** (§3).
- **A habilitação futura de qualquer evidência/anexo depende**, cumulativamente,
  de: **base legal**, **retenção**, **minimização**, **segurança**,
  **auditoria**, **MFA** e **validação RH + Jurídico** — nenhum desses está
  resolvido por este contrato.
- **Nenhum dado real** deve ser usado em testes, documentação ou artefatos
  derivados deste contrato — apenas dados **sintéticos**.

## 7. Relação com Ponto

- **Contestação de ponto não corrige marcação:** uma `contestacao_ajuste_ponto`
  só **registra a intenção**; a correção real (se houver) acontece no **ajuste
  rastreável do RH** (detalhada §2.7), fora da Central.
- **Solicitação de compensação não gera débito:** nada na Central cria
  `debito_compensacao` nem efetiva compensação (T053 §2; `BH-REG` pendente).
- **Férias/ausência não produzem efeito financeiro, Folha ou Banco de Horas:**
  a solicitação é só entrada; nenhum efeito trabalhista/financeiro é produzido
  pela Central.
- **O RH decide a ação operacional em fluxo separado e autorizado:** a Central
  encaminha; a operação efetiva (ajuste, cadastro, documento) segue os fluxos
  próprios do RH, com suas próprias autorizações e auditoria.

## 8. Decisões fechadas e portões remanescentes

Catálogo, papéis de RH/gestor/Diretoria, separação de "Verificar folhas",
cancelamento/reabertura, objetivo de primeiro retorno e política mínima de
evidências foram fechados por `PD-SOL-01..05`. Permanecem fora da fundação sem
anexos:

| Portão remanescente                                                                                                                                                                            | Responsável               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Detalhamento de elegibilidade** por tipo quando a operação de destino exigir regra ainda não aprovada.                                                                                       | RH + Jurídico             |
| **Anexos e conteúdo real**: credenciais, limites, quarentena, autorização por objeto e auditoria.                                                                                              | RH + Jurídico + Segurança |
| **Tratamento de dados sensíveis** (ex.: atestado): base legal, minimização, retenção e descarte.                                                                                               | RH + Jurídico             |
| **Retenção e descarte** das solicitações e do eventual conteúdo (`DP-3J-11`).                                                                                                                  | RH + Jurídico             |
| **Notificações** ao colaborador/RH: canal e conteúdo mínimo, sem dado sensível.                                                                                                                | RH + Produto              |
| **Integrações operacionais** futuras com Ponto, Documentos, Folha e eSocial; a Central não as executa automaticamente.                                                                         | RH + Produto              |
| **Gates operacionais `DS-OPS-01`, segurança de conteúdo e assinatura eletrônica**, quando aplicável. O lançamento inicial segue a exceção de MFA da T132; fator já ativo continua fail-closed. | Diretoria + TI + Jurídico |

## 9. Cenários sintéticos

Valores **fictícios e sintéticos** (sem CPF, nome, texto livre, marcação bruta,
atestado, arquivo ou dado pessoal).

### 9.1 Contestação de ponto encaminhada ao RH, sem alterar marcação nem saldo

`Empresa A`, `Vínculo V-001`, período `2026-08-10`:

- Solicitação: `{ id: "SOL-DEMO-0001", tipo: "contestacao_ajuste_ponto",
periodoReferencia: "2026-08-10", motivoCodificado: "DIVERGENCIA_MARCACAO_DEMO",
situacao: "rascunho", refAuditoria: "AUD-DEMO-0001" }`.
- Percurso: `rascunho` → `enviada` → `em_revisao_rh` →
  `encaminhada_para_operacao_rh`.
- Efeito no Ponto/Banco de Horas: **nenhum**. A Central **não** corrige marcação
  nem altera saldo (T050/T052); o encaminhamento é **handoff** para o ajuste
  rastreável do RH (detalhada §2.7), que decide em fluxo separado e autorizado.

### 9.2 Solicitação de documento iniciada, com anexo bloqueado e sem armazenamento

`Empresa A`, `Vínculo V-001`:

- Solicitação: `{ id: "SOL-DEMO-0002", tipo: "documento",
motivoCodificado: "SEGUNDA_VIA_DEMO", situacao: "rascunho",
refAuditoria: "AUD-DEMO-0002" }`.
- Percurso: `rascunho` → `enviada` → `em_revisao_rh`.
- Anexo/evidência: **bloqueado** (§6) — nenhum arquivo, imagem ou documento é
  enviado, aceito ou **armazenado**. A solicitação segue **só por referência
  técnica e motivo codificado**; a emissão real do documento (se houver) fica a
  cargo do fluxo próprio do RH/Documentos (ADR 0011), fora da Central.

## 10. Critérios de aceite (da especificação — não de implementação)

- [ ] Finalidade e fronteiras: a Central consulta/envia, nunca altera; toda
      mutação é do RH em fluxo próprio; encaminhar não executa (§1).
- [ ] Catálogo inicial conceitual (§2), sem inventar elegibilidade/prazo/efeito/
      alçada/documento obrigatório; novos tipos ficam como pendência.
- [ ] Estrutura mínima só por referências técnicas, sem dado pessoal/sensível
      (§3).
- [ ] Estados/transições conceituais com terminais explícitos; encaminhamento
      não altera nada automaticamente (§4).
- [ ] Permissões (colaborador só o próprio; RH da própria empresa; 404
      anti-enumeração; `master_tecnico` sem mutação; DP/gestor negados) sem
      criar login/sessão/MFA/RBAC/endpoint (§5).
- [ ] Privacidade: anexos/atestados/imagens/documentos/texto livre bloqueados;
      habilitação futura condicionada; sem dado real (§6).
- [ ] Relação com Ponto: contestação não corrige, compensação não vira débito,
      férias/ausência sem efeito financeiro/Folha/Banco (§7).
- [ ] Pendências explícitas para RH/Jurídico/Produto (§8).
- [ ] Dois cenários sintéticos (§9).
- [ ] Nenhum valor monetário, Folha, mutação, código ou dado real.

## 11. Declaração

Este documento **especifica** o contrato conceitual da futura Central de
Solicitações do Colaborador V1 — finalidade/fronteiras, catálogo inicial,
estrutura mínima por referência técnica, estados/transições, permissões,
privacidade/evidências, relação com o Ponto, pendências e cenários sintéticos.
**Nenhuma linha de portal, código, teste, schema, migration, endpoint, API, UI
funcional, autenticação, sessão, persistência, anexo, integração, valor
monetário ou dado real** é criada por este documento. Ele **não decide regra
trabalhista nova**, **não altera** nenhuma decisão existente, **não executa**
mutação (a Central consulta/envia e encaminha para a operação humana do RH),
**não declara** conformidade com a **CCT**, a **Portaria MTP 671**, a **LGPD**,
o **eSocial** ou qualquer outra norma, e **não faz** interpretação jurídica.
Toda habilitação futura depende de decisão de produto própria, dos gates já
registrados e da validação RH + Jurídico.
