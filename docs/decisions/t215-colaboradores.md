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

Desde 25/11/2026, "Escala de trabalho" abre o quadro (`#/pessoas/escala`; o
endereço antigo `#/estrutura/jornadas-trabalho` continua abrindo o quadro) e os
Turnos são sub-página dele (`#/pessoas/escala/turnos`, botão "Turnos" e voltar).

## Quadro da escala — semana e mês (25/11/2026)

Primeira fatia do quadro "Escala de trabalho", só leitura.

- API: `GET /v1/escala/quadro?inicio=&fim=` (até 42 dias; período invertido ou
  maior é 422 no campo `fim`). Devolve as pessoas da empresa ativa com vínculo
  no período (previsto, ativo ou encerrado dentro dele; sem quem está
  desativado na empresa; readmissão vira uma linha só), com a lotação vigente,
  o gestor direto, a escala e a jornada do contrato, e os padrões de escala que
  tocam o período. `rh` e `dp` leem; o `master_tecnico` só com empresa ativa
  (sem ela, 403). Leitura sem trilha, como a listagem.
- Os dias saem dos padrões, no cliente, pela MESMA regra da aba Escala da
  ficha (`ficha/escala/diaDaEscala.ts`): trabalho com o turno do dia (no
  12x36 com turno da noite, mês sim, mês não), folga, DSR (a folga escolhida
  no 6x1; o domingo nas semanas fixas e em "outra"), sem escala e fora do
  vínculo. Dia sem edição conta como publicado, como na referência.
- Semana: turno com cor, nome e horário; "Escalados no dia" (N de M e o total
  de horas); horas líquidas por pessoa e por grupo ("X h na semana").
- Mês: dias com a letra da semana, feriados nacionais de data fixa
  destacados, sigla do turno, "D" no DSR, e "horas/meta h" com a barra e os
  dias de trabalho. Meta = jornada por semana de cada dia (o menor entre o
  contrato e o limite legal da data, EC 141/2026) × dias ÷ 7.
- Busca pelo nome sem acento, ordem A–Z/Z–A, agrupar por departamento,
  unidade, turno, gestor ou nenhum ("Não informado" por último; a unidade
  aparece quando é a mesma no grupo), 10/50/100 pessoas por página.
- Filtrar (gaveta "Filtros", no navegador, sobre as pessoas do período):
  "N de M pessoas no quadro"; atalho "Sem escala" (sem padrão no período);
  listas com contagem — Unidade, Departamento, Tipo de contrato e Turno
  (várias opções = qualquer uma; "Não informado"/"Sem turno" é opção);
  seletores Gestor, Cargo, Área, Centro de custo, Nível e Gênero; grupos se
  somam; "Limpar filtros" e "Ver N pessoas". O botão mostra quantos filtros
  estão ligados. A API passou a mandar área, centro de custo, nível e gênero
  (quem lê o quadro lê os dados pessoais pela mesma matriz).
- "Abrir no quadro" na ficha abre o quadro já filtrado no departamento da
  pessoa (removível em "Limpar filtros").
- Atalhos da referência que dependem de fases seguintes: "Com aviso da CLT"
  (Regras e avisos), "Mudanças não publicadas" (rascunho), "De férias ou
  afastados" (integração com férias e ausências) e "Salvar como visão".
- Fora desta fatia (próximas, nesta ordem): menu da célula e painel do dia,
  rascunho × publicado e Publicar, ações em massa, Regras e avisos da CLT,
  Aplicar modelo, Exportar, integrações (férias, ausências, benefícios).

## Menu da célula e painel do dia — rascunho (25/11/2026)

Segunda fatia do quadro: quem opera (`rh`, `dp`) edita o dia no RASCUNHO.

- Banco: `escala_dia` (migration aditiva `20261125150000_escala_dia`), um dia
  por pessoa e camada (`rascunho` ou `publicado`) por cima do padrão; tipos
  trabalho (turno opcional, 1 ou 2 períodos, intervalo de 0 a 2 h, até 1
  sobreaviso depois do turno), folga, DSR e sobreaviso (1 ou 2 períodos);
  local (unidade) e observação (até 300). CHECKs da forma de cada tipo; o
  publicado não se apaga (gatilho). Auditoria só com o id do dia:
  `pessoas.escala.dia_gravado` e `pessoas.escala.dia_limpo`.
- API: `PUT /v1/escala/dias` (grava no rascunho) e `POST
/v1/escala/dias/limpar` (desfaz a mudança do dia; idempotente), `rh` e
  `dp` na empresa ativa. Recusas por campo: período sobreposto, sobreaviso
  dentro do turno, intervalo fora da lista, turno ou local indisponível
  (inativo ou de outra empresa), dia fora do vínculo (`fora_do_vinculo`,
  também para pessoa de outra empresa). O quadro passou a trazer os dias
  gravados do período.
- Tela: a célula é um botão (setas, Home/End; Enter abre o menu; Delete limpa
  o dia com rascunho). O menu tem os turnos ativos (horário e intervalo do
  dia, o atual marcado), Folga, DSR, Sobreaviso, Sobreaviso depois do turno
  (do fim do turno ao início dele no dia seguinte), Dois turnos no dia, Abrir
  detalhes, Adicionar/Editar observação e Limpar (só com rascunho). Cada
  escolha mostra o aviso "<turno ou tipo> em d/m no rascunho" com Desfazer;
  "Limpar" mostra "Dia limpo no rascunho"; Desfazer mostra "1 mudança
  desfeita". O dia com rascunho ganha o ponto âmbar, e o cabeçalho, o selo
  "Rascunho · N mudança(s) não publicada(s)" do período.
- Painel do dia: pessoa (departamento · contrato · escala), dia anterior e
  próximo (travados com mudança não salva), "Semana de … · pelo padrão /
  rascunho / publicada", Ver semana; abas Trabalho, Folga, DSR, Sobreaviso e
  Ausência (desabilitada: vem de Férias e ausências); turno, início, fim,
  intervalo, 2º período, sobreaviso depois do turno, local e observação; o
  resumo ("8 h de trabalho · termina no mesmo dia", "… de sobreaviso (1/3 da
  hora na folha) · termina no dia seguinte") e os avisos da CLT ao vivo (art.
  59, 71 e 244, § 2º), que não impedem salvar. "Limpar o dia" só com
  rascunho. Turno de 3 períodos traz os dois primeiros para o RH ajustar.
- Publicar (25/11/2026): `POST /v1/escala/publicar` {inicio, fim, avisar}
  troca ou cria o publicado de cada dia do rascunho do período, tira o
  rascunho e registra `escala_publicacao` (novas, alteradas, pessoas, aviso
  pedido, quem e quando; só se cria). Sem rascunho no período: 422
  `escala_nada_para_publicar`. O quadro mostra "Publicada em d/m por …" (a
  publicação mais recente que toca o período) e o botão vira "Publicar
  mudanças". O diálogo mostra período, novas, alteradas e pessoas afetadas, e
  a escolha "Avisar as pessoas pelo Portal e por e-mail" — registrada; o
  envio depende do Portal e do e-mail, que ainda não existem no Evolli. A
  frase da referência sobre VR/VA/VT por dia ficou de fora (não há folha de
  benefícios por dia), assim como "Removidas" (o quadro não remove um dia
  publicado; muda-o).
- Ainda não: ações em massa, Avisos,
  Regras, Aplicar modelo, Exportar, menu ⋯ e o aviso da transição da EC
  141/2026 ("Já temos convenção" / "Planejar a transição").

## Botões quadrados e design próprio (2026-11-25)

- Decisão da proprietária: todos os botões do sistema seguem o padrão
  "quadrado" — cantos levemente arredondados, pelo token `--radius-botao`
  (`app/tokens.css`). A pílula (`--radius-pill`) fica só para selos, chips,
  barras e marcadores.
- O Evolli tem design próprio: o arquivo de referência visual externa da
  T032 foi removido do repositório e a fonte oficial passou a ser
  [`docs/DESIGN-SYSTEM-EVOLLI.md`](../DESIGN-SYSTEM-EVOLLI.md).
