# Feature Specification: Interface web funcional da Central de Solicitações de Pessoas

**Feature Branch**: `codex/t140-web-solicitacoes-pessoas`

**Created**: 2026-09-29

**Status**: Draft

**Input**: T140 — transformar a tela demonstrativa **Pessoas > Solicitações** (T091) em interface
funcional de RH sobre a fundação backend integrada pela T139 (`main` em `6eaa6f9`).

**Fontes vinculantes**: `.specify/memory/constitution.md` v1.4.0;
[pacote de decisão](../../docs/decisions/pacote-decisao-solicitacoes-pessoas.md) §1.1;
[decisões de documentos e solicitações](../../docs/decisions/decisoes-gestao-documentos-e-solicitacoes-v1.md);
[contrato conceitual T065](../../docs/modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md);
[spec da T139](../t139-backend-solicitacoes-pessoas/spec.md); ADRs 0001, 0003, 0006, 0009, 0011, 0012, 0013.

## 1. Resultado pretendido

A aba **Pessoas > Solicitações** deixa de ser demonstrativa e passa a consumir os cinco endpoints
reais da T139. O RH registra, lista, filtra, pagina, detalha, transiciona e lê o histórico de
solicitações da própria empresa. `master_tecnico` lê e não muta. Os demais papéis não mutam.

A entrega é **uma superfície de leitura e registro**. Ela não executa operação trabalhista alguma:
encaminhar continua sendo _handoff_, exatamente como no backend.

## 2. Fora de escopo (limites invioláveis)

Esta tarefa **não**:

- implementa ESS ou MSS, nem simula login de colaborador. Não existe vínculo autenticado
  `AccessUser <-> Colaborador` (`DP-23`): o **RH registra em nome do colaborador** e permanece o
  ator real na auditoria, como já ocorre em `solicitacoes-documento`;
- cria endpoint, campo, estado, transição, papel, motivo ou regra de domínio. Consome apenas o que
  a T139 integrou em `main`;
- introduz anexo, upload, download, preview, assinatura, URL, chave de objeto, base64, blob ou
  integração Cloudflare R2. A ADR 0013 aprovou o provedor futuro, nunca o upload;
- exibe ou coleta diagnóstico, CID, descrição clínica, documento médico ou qualquer texto livre não
  previsto pelo DTO. `atestado` usa exatamente a mesma estrutura dos outros cinco tipos;
- altera ponto, férias, cadastro, vínculo, benefícios, Banco de Horas, Folha ou fechamento, nem
  dispara automação em outro módulo;
- calcula prazo, exibe cronômetro ou promete conclusão. `PD-SOL-04` aprovou o objetivo de **primeiro
  retorno** do RH em dois dias úteis, não de conclusão, e a V1 registra apenas marcos;
- declara conformidade legal;
- toca `CentralSolicitacoesRHScreen` (T068) ou `MinhasSolicitacoesScreen` (T067) — ambas seguem
  demonstrativas, fora deste escopo, e cobertas por teste de não regressão;
- adiciona dependência, lockfile, roteador de URL ou React Context (o projeto não tem nenhum).

## 3. Catálogo apresentado (`PD-SOL-01`)

Exatamente os seis tipos que o backend aceita, com rótulo humano na interface e código técnico só
no DTO:

| Código técnico             | Rótulo na interface            |
| -------------------------- | ------------------------------ |
| `contestacao_ajuste_ponto` | Contestação de ajuste de ponto |
| `ausencia`                 | Ausência                       |
| `ferias`                   | Férias                         |
| `atualizacao_cadastral`    | Atualização cadastral          |
| `atestado`                 | Atestado                       |
| `beneficios`               | Benefícios                     |

`documento` **não** aparece: continua em `solicitacoes-documento`.

Os rótulos de situação, ação e motivo são **apresentação**, derivados dos identificadores do
backend; nenhum deles cria, renomeia ou agrupa regra de domínio.

## 4. Atores e autoridade

| Papel                                 | Na tela                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| `rh`                                  | Lê e muta, na própria empresa.                                |
| `master_tecnico`                      | Lê (leitura global do backend); nenhuma ação de mutação.      |
| `dp`, `gestor`, `colaborador`, demais | Nenhuma mutação; o backend responde 403 e a tela não oferece. |

O gestor **não participa desta tela**: `PD-SOL-01` o definiu como consultivo, e consultivo não é
capacidade de RBAC.

**A interface não é autoridade de segurança.** Esconder ou desabilitar ação é usabilidade; o
servidor decide. A tela obtém o papel por `GET /v1/users/me`, o mesmo caminho que
`PessoasDocumentosScreen` (T133) e `ContasAcessoScreen` (T121) já usam — sem endpoint novo, sem
sessão paralela, sem Context inédito.

## 5. Origem de cada dado enviado

Nada de escopo é inventado pelo navegador:

- **`empresaId`** do registro vem de `GET /v1/users/me` -> `companyId` (precedente literal da T133).
  Ele existe só para o servidor **reconferir** contra a sessão; divergência responde 404.
- **`vinculoId`** vem de `GET /v1/colaboradores/:id/vinculos`, que o backend já filtra pela empresa
  da sessão. O vínculo sempre pertence ao colaborador selecionado.
- **`tipo`**, **`motivo`**, **`acao`**, **`situacao`**: enums fechados do backend.
- **`periodoReferencia`**: opcional para **todos** os tipos — o DTO diz explicitamente que exigir
  por inferência seria inventar regra de elegibilidade.

Nenhum identificador interno é oferecido como campo digitável.

## 6. Seleção de colaborador e vínculo

| Situação         | Comportamento                                                    |
| ---------------- | ---------------------------------------------------------------- |
| Zero opções      | Bloqueia o registro e explica por quê.                           |
| Exatamente uma   | Resolve automaticamente (não é escolha silenciosa entre várias). |
| Múltiplas opções | Exige escolha explícita; nunca seleciona a primeira em silêncio. |

## 7. Estados e transições (espelho do backend)

A tela **deriva** as ações disponíveis da situação devolvida pela API, usando a mesma tabela do
núcleo T066. Ela não duplica nem amplia a regra:

| Situação atual                 | Ações oferecidas                                             |
| ------------------------------ | ------------------------------------------------------------ |
| `rascunho`                     | `enviar`, `cancelar`                                         |
| `enviada`                      | `iniciar_revisao`, `cancelar`                                |
| `em_revisao_rh`                | `aguardar_informacao`, `encaminhar_para_operacao`, `recusar` |
| `aguardando_informacao`        | `retomar_revisao`                                            |
| `encaminhada_para_operacao_rh` | `reabrir`                                                    |
| `recusada`                     | `reabrir`                                                    |
| `cancelada`                    | nenhuma                                                      |

Invariantes preservadas: cancelamento **somente antes** de `em_revisao_rh`; `cancelada` sem saída;
**não existe** estado `encerrada` — o termo funcional corresponde a `encaminhada_para_operacao_rh`;
reabertura só de `recusada` e `encaminhada_para_operacao_rh`, com **motivo obrigatório**.

## 8. Concorrência e respostas obsoletas

Toda carga assíncrona é protegida por **contador monotônico** (precedente T134): a resposta só é
aplicada se a geração dela ainda for a corrente. Cobre troca de colaborador, troca de vínculo,
mudança de filtro, paginação, abertura/fechamento de detalhe, histórico e recarga pós-mutação.

Conflito por transição concorrente: a tela **não projeta sucesso local**, mostra mensagem segura e
**recarrega o estado do servidor**. O backend serializa a transição com lock de linha e devolve 422
à perdedora.

## 9. Tratamento de resposta

| Status | Significado no contrato                                               | Na tela                                                     |
| ------ | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| 201    | Registro e **transição** bem-sucedidos (não 200)                      | Sucesso + recarga                                           |
| 400    | Campo desconhecido ou valor fora do enum                              | "Dados inválidos"                                           |
| 401    | Sessão ausente/expirada                                               | Descarta o token CSRF em memória; o portão de sessão assume |
| 403    | Papel sem capacidade                                                  | "Sem permissão"                                             |
| 404    | Inexistente **ou** de outra empresa (indistinguíveis)                 | "Não encontrada no seu escopo" + recarga                    |
| 409    | Conflito                                                              | Mensagem de conflito + recarga                              |
| 422    | Transição inválida, estado terminal, motivo ausente, data inexistente | "Esta ação não é mais possível" + recarga                   |

O corpo interno de erro **nunca** é exibido.

## 10. Cenários de aceite

1. RH abre a aba -> lista carrega da API, paginada, só da própria empresa.
2. Sem solicitações -> estado vazio explicativo, sem erro.
3. Falha de rede -> mensagem de erro com "Tentar novamente" que refaz a chamada.
4. RH filtra por tipo/situação/vínculo -> a query vai para a API; a paginação volta à página 1.
5. RH registra: escolhe colaborador, vínculo, tipo, motivo e período opcional -> 201 -> lista recarrega.
6. RH abre detalhe -> somente leitura, sem campo clínico, anexo ou texto livre.
7. RH abre histórico -> ordem cronológica completa, vinda da API.
8. RH executa uma transição permitida -> 201 -> situação e histórico recarregam.
9. Transição que o backend recusa (422) -> mensagem segura + recarga; nada é projetado localmente.
10. `master_tecnico` -> lê tudo; nenhum botão de mutação é oferecido.
11. `dp`/`gestor`/`colaborador` -> nenhuma ação de mutação oferecida.
12. Resposta atrasada de uma seleção anterior nunca preenche a seleção atual.

## 11. Critérios mensuráveis

- Um único `h1` por tela ativa; tabelas com `caption`; status com texto, não só cor; rótulos reais.
- Desktop e 375px sem overflow horizontal **da página** (tabela rola por dentro).
- CSS só com tokens existentes de `apps/web/src/app/tokens.css`.
- Sem `localStorage`, `sessionStorage` ou persistência paralela.
- `credentials: "same-origin"` em toda chamada; CSRF **apenas** nas duas mutações.
- Zero `.only`/`.skip`/`fit`/`fdescribe`/`xit`/`xdescribe`.

## 12. Limites preservados e decisões ainda abertas

- **Sem ESS/MSS.** Depende de `DP-23`.
- **Gestor sem capacidade.** Depende de decisão de escopo de equipe.
- **Catálogo de motivos a validar com RH.** O mecanismo (código fechado) é o aprovado; a lista é
  extensível de forma aditiva. Nenhuma regra liga motivo a tipo — a tela não inventa uma.
- **Nome do colaborador na solicitação.** A API devolve `vinculoId` técnico; a tela resolve o nome
  apenas dentro do colaborador já selecionado pelo próprio RH, nunca ampliando a superfície de dado
  pessoal do objeto solicitação.
- **Sem URL própria.** O shell não tem roteador; a aba é estado de `PessoasScreen`.
- **Isto não habilita dados reais, produção, ESS nem MSS.**
