# T215 — Colaboradores: lista, edição, ficha e abas

Documento de decisão e registro de fatos da T215. Só entra aqui o que está no código e foi
provado por teste; o que depende de decisão fica listado como pendente.

## Estado

- Branch `codex/t215-colaboradores-lista`, empilhada sobre a T213 (PR #206, Draft) e a T214
  (`515b7e0`). Enviada ao GitHub em 24/11/2026 até `204633a`; os commits seguintes são só
  locais. Sem PR, Ready ou merge.
- A separação em entregas revisáveis (T213, T214 e a T215 em partes) aguarda autorização.

## Fatias entregues (commits locais)

| Fatia                                                | Commits                                    |
| ---------------------------------------------------- | ------------------------------------------ |
| Lista: filtros, ⋯ da linha, abas e gaveta "Filtrar"  | `fe33cd9`, `8c840fe`, `0964434`, `301be01` |
| Segurança e Editar colaborador; desativar e reativar | `aa0d095` a `0f52bee`                      |
| Página inicial de Colaboradores                      | `1c7002b`, `dd27995`                       |
| Férias e ausências (API e lista)                     | `0d18eea`, `5d23bf0`                       |
| Ficha nova com a aba Dados                           | `04239be`                                  |
| Auditoria da lista: um evento por consulta           | `204633a`                                  |
| Aba Salários e salário obrigatório na admissão       | `cdfa0ff`, `08198fc`, `26431f4`, `786ca7a` |
| Aba Férias e ausências da ficha                      | `cc3456f`, `3e775e0`, `0fa8831`            |
| Aba Escala da ficha                                  | esta fatia                                 |

## Aba Férias e ausências da ficha (24/11/2026)

### Regra de férias pelo tipo do vínculo

Decisão da empresa (23 e 24/11/2026), aplicada no servidor (`regraDeFeriasDoTipo`):

| Regra        | Tipos                                                      | Efeito                                                                                                                                      |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `calculada`  | CLT, Estágio                                               | Saldo automático: 30 dias por período aquisitivo, prazo para tirar, situação e venda.                                                       |
| `sem_ferias` | PJ, Freelancer                                             | Registrar férias é recusado (422 `tipo` `nao_se_aplica`); as demais ausências seguem.                                                       |
| `sem_regra`  | Aprendiz; Temporário, Part-time, Trainee, Outro controlado | Sem cálculo: sem períodos nem saldo; férias entram sem conferir saldo, sem período e sem venda (venda: 422 `diasVendidos` `nao_se_aplica`). |

- Antes desta fatia, o Aprendiz tinha saldo automático de 30 dias, e os demais tipos tinham
  direito 0 (férias recusadas por saldo insuficiente).
- **Pendente de decisão:** a regra definitiva do Aprendiz e dos tipos Temporário, Part-time,
  Trainee e Outro controlado.

### Leitura da ficha

- `GET /v1/colaboradores/:colaboradorId/ferias` passa a devolver `regraDeFerias` e o
  `vinculo` (tipo e admissão); os períodos só vêm na regra `calculada`.
- Toda consulta deixa o evento `pessoas.ausencia.consultada`, com o id do colaborador e a
  empresa, sem tipo, datas ou observação. Regime fail-safe: sem o evento gravado, nada é
  entregue. Motivo: a ficha mostra licenças, que são dado de saúde.

### Anexo da ausência (atestado ou documento)

- Formatos da referência: PDF, JPG, PNG, WEBP, HEIC, HEIF, DOC e DOCX; até 10 MB; um anexo
  vivo por ausência; o nome original do arquivo não é guardado.
- Conferência no servidor: extensão, tipo declarado e conteúdo real precisam apontar o mesmo
  formato; estrutura mínima de cada formato; documento com macro é recusado.
- Antivírus antes de gravar, com o verificador e o armazenamento privado dos documentos do
  colaborador (T213, ADR 0021): reprovado é 422, indisponível é 503, e em nenhum dos dois
  casos algo é gravado.
- Rotas: `POST /v1/ausencias/:ausenciaId/anexo` (binário), `GET .../anexo/arquivo` (download
  privado, sem cache, `nosniff`, nome `atestado.<extensão>`) e `DELETE .../anexo` (remoção só
  lógica). RH e DP enviam e removem; o master técnico com empresa ativa só baixa.
- Banco: tabela `anexo_ausencia` (migration `20261124180000`), índice parcial de um anexo vivo
  por ausência, CHECKs de tamanho, hash e remoção, e `DELETE` revogado do papel da aplicação.
- Trilha: `pessoas.ausencia.anexo_enviado`, `anexo_baixado` e `anexo_removido`, com o id da
  ausência, sem nome, formato, tamanho ou conteúdo.
- Na tela: "Anexar atestado ou documento" na gaveta de registro (o arquivo vai depois do
  registro; se falhar, a ausência fica e o aviso diz o motivo) e no ⋯ de cada linha do
  histórico; baixar pelo botão do anexo; remover com confirmação.

### Tela

- **Saldo de férias:** disponíveis, período aquisitivo, direito, usados, prazo para tirar,
  situação e os demais períodos; nas regras `sem_ferias` e `sem_regra`, o motivo.
- **Próxima ausência:** a data num calendário, tipo, período e status; vazio com o texto da
  referência.
- **Histórico de ausências:** por ano, do mais novo; tipo (com o motivo do afastamento),
  datas, dias, dias úteis, dias vendidos, status, anexo e as ações que o status permite
  (aprovar, recusar com motivo opcional, cancelar, anexar e remover o anexo).
- Quem não edita (fora RH e DP) só lê e baixa. Recusar, cancelar e remover pedem confirmação.

### Dias úteis

O cálculo conta de segunda a sexta, sem os feriados nacionais de data fixa. **Feriados móveis
(Carnaval, Sexta-feira Santa, Corpus Christi), estaduais e municipais ainda não entram no
cálculo** — a tela diz isso no histórico.

### Fora de escopo desta fatia

Portal do colaborador, fluxo do gestor, férias coletivas, políticas de férias, mudança
automática de status e o calendário de feriados móveis e regionais.

## Aba Escala da ficha (24/11/2026)

### Permissões

- **RH e DP** definem, alteram e encerram a escala (o vínculo de horário) na empresa ativa
  (`vinculo_horario` `create`/`alter` no avaliador; `resolverEscopoVinculoHorario` no
  serviço). Antes, o DP só consultava (decisão de 26/10/2026, revista nesta fatia).
- O catálogo de jornadas (`tabela_horario`: criar, editar, inativar, reativar) segue **só do
  RH**. A aba leva a Jornadas de trabalho para criar ou ajustar uma jornada.
- `master_tecnico` só consulta; gestor, colaborador, financeiro, auditor e DPO não atribuem nem
  encerram (a ficha nem é montada para eles). Outra empresa: 404, com a negação na trilha.
- Efeito colateral coerente: a Nova admissão aceita jornada também quando o DP admite (a mesma
  permissão). A tela da Nova admissão não mudou nesta fatia.

### Regras

- A vigência é `[início, fim)`: a tela pergunta o último dia e envia o seguinte.
- Definir e alterar são uma operação só (`POST /v1/horarios/vinculos/atribuicoes`): com escala
  aberta, ela termina no novo início e a nova começa ali, numa transação.
- **Nova:** a escala não começa antes da admissão (422 `vigenciaInicio`/`antes_da_admissao`,
  sem o valor). Vale só para a atribuição; o cadastro direto de vínculo (Horário de trabalho,
  T038) ficou como estava.
- Sobreposição: o banco recusa (EXCLUSION + índice da vigência aberta → 409 `sobreposta`); a
  troca precisa começar depois do início da atual e trocar de jornada (422). Na tela, a data
  padrão é o primeiro dia livre depois das escalas já encerradas, e a validação local avisa
  antes de enviar.
- A trilha registra só ids (`horarios_vinculo_criado`/`encerrado`); a leitura do histórico é
  auditada como antes.

### Tela

- Vazio: título, explicação, "Ver jornadas de trabalho" e "Definir escala" (quem opera).
- Escala atual: jornada, situação, carga semanal, dias de trabalho, horário, intervalo, vale
  desde e término; a programada aparece à parte; sem vigente hoje, a tela diz isso.
- Semana de trabalho: os 7 dias com os períodos ou "Folga" e o total do dia.
- Histórico de escalas: da mais nova à mais antiga, com Vigente, Programada, Encerrada e
  "Jornada inativa".
- Gaveta "Definir/Alterar escala": jornada (só ativas, com a carga semanal), "Vale a partir de"
  e o quadro "O que muda" (antes → depois). Gaveta "Encerrar escala": último dia.
- Foco: abre no título da gaveta, volta a quem abriu; depois de gravar, vai ao título do cartão.
  Escape fecha (com confirmação se algo foi preenchido). Coluna única em 375 px, sem rolagem
  horizontal.
- O resumo vem da grade da jornada, que agora acompanha cada vínculo (`tabela.periodos`).

### Limites e fora de escopo

- Sem modelos de escala por ciclo (12x36, revezamentos, embarque), turno noturno, início de
  ciclo, quadro mensal coletivo, publicação, efeito em benefícios, ponto, banco de horas, troca
  de turno pelo colaborador, aprovação do gestor, notificações e adicionais.
- O cabeçalho da ficha (Carga horária) continua lendo o contrato, não a escala.
- A grade mostrada é a da jornada hoje: se a jornada for editada, o histórico mostra a grade
  nova (as jornadas não guardam versões).
