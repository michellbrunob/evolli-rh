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
| Aba Férias e ausências da ficha                      | esta fatia                                 |

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

## Trilhas da barra superior (padrão do sistema, 2026-11-25)

Regra, igual à da referência e já aplicada em `trilhaDoShell.ts`:

- **Seção** (cabeçalho do menu: Pessoas, Remuneração…): só texto.
- **Módulo** (item do menu: Colaboradores, Liderança, Configurações…): link
  para a página principal do módulo sempre que ela não é a tela atual.
- **Página intermediária** (o pai de uma sub-página): link para ela.
- **Último item**: a tela atual, só texto (`aria-current="page"`).
- Nome igual ao anterior não se repete; destino sem rota não ganha caminho.
- Toda tela nova ganha rota própria em `rotasDoShell.ts` (recarregar e
  voltar funcionam). Organograma e Minha equipe ainda não têm rota: a trilha
  leva a elas, mas o endereço não muda; ganham rota quando forem revistas
  (sugestão: `#/estrutura/organograma` e `#/lideranca/minha-equipe`).

Trilhas previstas para os módulos ainda em desenvolvimento (aplicar ao criar
cada um; links nos itens do meio, só texto no último):

| Módulo / tela futura                     | Trilha                                                          | Rota sugerida                                 |
| ---------------------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| Quadro da escala                         | Pessoas / [Colaboradores] / Escala de trabalho                  | `#/pessoas/escala`                            |
| Turnos                                   | Pessoas / [Colaboradores] / [Escala de trabalho] / Turnos       | `#/pessoas/escala/turnos`                     |
| Novo/Editar turno                        | … / [Escala de trabalho] / [Turnos] / Novo turno · Editar turno | `#/pessoas/escala/turnos/novo` · `/:id`       |
| Regras da escala                         | … / [Escala de trabalho] / Regras da escala                     | `#/pessoas/escala/regras`                     |
| Aplicar modelo                           | … / [Escala de trabalho] / Aplicar modelo                       | `#/pessoas/escala/modelo`                     |
| Desenvolvimento                          | Pessoas / [Colaboradores] / Desenvolvimento                     | `#/pessoas/desenvolvimento`                   |
| Recrutamento › Vagas · Banco de talentos | Pessoas / [Recrutamento] / Vagas · Banco de talentos            | `#/recrutamento/vagas` · `/banco-de-talentos` |
| Pesquisas                                | Pessoas / Pesquisas                                             | `#/pessoas/pesquisas`                         |
| Calendário                               | Pessoas / Calendário                                            | `#/pessoas/calendario`                        |
| Folha de Pagamento                       | Remuneração / Folha de Pagamento                                | `#/remuneracao/folha`                         |
| Benefícios                               | Remuneração / Benefícios                                        | `#/remuneracao/beneficios`                    |
| Hub de Benefícios                        | Remuneração / Hub de Benefícios                                 | `#/remuneracao/hub-de-beneficios`             |
| Portal                                   | Portal                                                          | `#/portal`                                    |
| Suporte · Roadmap                        | Suporte · Roadmap                                               | `#/suporte` · `#/roadmap`                     |

Quando o quadro existir, "Escala de trabalho" deixa de abrir os Turnos e
passa a abrir o quadro; os Turnos viram sub-página dele (tabela acima).

## Botões quadrados e design próprio (2026-11-25)

- Decisão da proprietária: todos os botões do sistema seguem o padrão
  "quadrado" — cantos levemente arredondados, pelo token `--radius-botao`
  (`app/tokens.css`). A pílula (`--radius-pill`) fica só para selos, chips,
  barras e marcadores.
- O Evolli tem design próprio: o arquivo de referência visual externa da
  T032 foi removido do repositório e a fonte oficial passou a ser
  [`docs/DESIGN-SYSTEM-EVOLLI.md`](../DESIGN-SYSTEM-EVOLLI.md).
