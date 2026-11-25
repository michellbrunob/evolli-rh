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
- Ações em massa e menu ⋯ (25/11/2026), conferidas na referência por
  simulação (pessoa de teste):
  - API: `PUT /v1/escala/dias/lote` e `POST /v1/escala/dias/limpar-lote`
    (até 500 dias por envio, tudo ou nada, um evento de trilha por dia); o
    cliente manda blocos de 100 (o corpo JSON do servidor tem limite de 100
    kB). Lotes acima de 100 dias não são atômicos entre blocos.
  - Seleção por pessoa, grupo e página (parcial quando há só parte), barra
    "N pessoa(s) selecionada(s)" com Trocar turno, Dar folga, Copiar semana
    anterior e limpar a seleção (Esc).
  - Trocar turno: novo turno, De/Até (a semana; até 42 dias), dias da
    semana (segunda a sexta), "Só onde já há turno" ou "Também nas folgas"
    e "O que muda" por pessoa. Dar folga: dia (hoje) e Folga ou DSR.
  - Menu ⋯: Turnos, Copiar semana anterior (pessoas do filtro), Repetir
    esta semana até… (até um ano) e Limpar o rascunho do período (com a
    contagem; indisponível sem rascunho).
  - Copiar e repetir: cada dia recebe o dia correspondente da origem; dia
    da origem que vem do padrão deixa o destino no padrão (sai o rascunho),
    como a referência faz.
  - Cada ação mostra o aviso com Desfazer (regrava o rascunho de antes, ou o
    limpa) e o quadro recarrega.
  - Ficam para as próximas fases: Aplicar modelo e Exportar (na barra e no
    menu). Regras e transição: seção abaixo.
    "Quem já tem ausência aprovada nesse dia não muda" depende da
    integração com Férias e ausências.
- Ainda não: integrações com Férias e ausências e benefícios (próxima fase).

## Regras da escala, avisos da CLT e transição da EC 141/2026 (25/11/2026)

Conferido na referência por simulação (pessoa de teste); textos e desenho
próprios.

- API: `GET`/`PUT /v1/escala/regras` (por empresa: início da transição,
  dia em que a semana começa, 8 chaves da convenção, 21 avisos ligados ou
  desligados, antecedência mínima entre 0 e 30 dias, "avisar as pessoas"
  marcado por padrão) e `POST`/`DELETE /v1/escala/feriados` (feriado local
  municipal ou estadual, de todas as unidades ou de unidades ativas
  escolhidas). Sem linha gravada valem os padrões (`personalizadas: false`;
  transição em 16/12/2026, 12x36 por acordo marcada, aviso noturno
  desligado). Chave desconhecida ou valor não lógico: 400 por campo. Cada
  gravação é um evento de trilha. Migration `20261125170000_escala_regras`.
- O quadro traz as regras e a data de nascimento de cada pessoa (aviso de
  menor de idade).
- Avisos (calculados no navegador, sobre o rascunho): Atenção, Conferir e
  Informativos. PJ e autônomo só recebem informativos. 6x1 depois da
  transição sem convenção; jornada da semana (44 h antes, 42 h depois; 40 h
  um ano depois); 2 descansos por semana; mais de 10 h no dia; intervalo
  (art. 71; 30 min com convenção); 11 h entre jornadas (fora do plantão);
  36 h depois do plantão 12x36; 12x36 depois da 2ª etapa; 7 dias seguidos;
  domingo; feriado (comércio sem convenção vai para Atenção); feriado local
  da unidade; aprendiz e estágio acima de 6 h; menor de 18 anos à noite;
  revezamento (turno de noite = metade ou mais das horas entre 22 h e 5 h);
  noturno e sobreaviso informativos. Cada regra pode ser desligada.
- Quadro: botão Avisos com a contagem (vermelho com Atenção), marca na
  célula, descrição para leitor de tela, atalho "Com aviso da CLT" na gaveta
  Filtrar e o painel de avisos (abas por categoria; cada item leva à célula,
  trocando de página se preciso). Publicar com avisos de Atenção pede
  "Publicar mesmo assim"; com menos antecedência que a mínima, mostra a
  nota.
- Faixa da EC 141: aparece com gente em 6x1 no período; "Já temos
  convenção" grava a 6x1 autorizada nas Regras (com Desfazer); "Planejar a
  transição" abre a página.
- Regras da escala (sub-página, consulta para quem vê o quadro; edição para
  RH e DP): linha do tempo da transição com "Agora", convenção, feriados
  locais, avisos e publicação; Descartar e Salvar regras no rodapé, com a
  guarda de saída.
- Planejar a transição (RH e DP): quem está em 6x1, caminho (5x2,
  convenção ou outra escala) e horário de 8h24 ou 8 h; aplica pelo padrão da
  escala e cria a tabela "Nome 8h24" quando precisa.
- Semana: o dia de início das Regras guia o período do quadro.
- Barra da seleção (pedido da proprietária): ícones nos botões, dica "Esc" e
  menu ⋯ com Ver avisos dessas pessoas (painel só delas), Abrir no mês /
  Abrir na semana (mesmo filtro e seleção) e Limpar o rascunho do período
  só das selecionadas. Aplicar modelo e Exportar entram nas fases deles,
  também na barra.
- Menu da célula: ícone por item e o atalho à direita ("Abrir detalhes ·
  Enter", "Limpar · Del"); "+" na célula vazia ao passar o mouse.

## Aplicar modelo de escala (25/11/2026)

Conferido na referência por simulação (pessoa de teste, sem aplicar lá);
textos e desenho próprios, sobre o padrão de cadastro em etapas.

- Página `#/pessoas/escala/modelo` (RH e DP), aberta pelo botão "Aplicar
  modelo" no topo do quadro (leva o filtro atual) e na barra da seleção
  (leva também as pessoas selecionadas).
- 5 etapas:
  1. Quem: todo o time do filtro atual ou escolher pessoas; lista com busca e
     filtros de Unidade, Departamento e Contrato (valem para as duas
     opções), contrato e escala atual.
  2. Escala: o catálogo do cadastro por grupo, com os dias de benefício no
     mês; selos "Padrão da EC 141" (5x2) e "Convenção a partir de dd/mm"
     (6x1, pela data das Regras).
  3. Turnos: turno dos dias de trabalho, ou um turno por dia nas escalas de
     dias fixos (fora a 6x1); dias de trabalho em "Outra"; horas por semana
     e dias de benefício; na 6x1, folga semanal no domingo para todos ou
     distribuída (domingo, segunda, terça…) e "folga no domingo pelo menos
     a cada 3 semanas" (a folga da semana troca de lugar com o domingo);
     prévia das duas primeiras semanas por pessoa, com as siglas.
  4. Período: começa no primeiro dia da próxima semana (pelas Regras);
     termina numa data (sugestão: 4 semanas; até um ano) ou sem data de
     fim; "Substituir o que já está escalado" com a contagem das células
     já preenchidas (rascunho ou publicado).
  5. Prévia: resumo (pessoas, escala, início, células no rascunho), por
     pessoa (horas da primeira semana, dias no mês, avisos), avisos da CLT
     com o modelo (Atenção primeiro; "Ver os N avisos"), "Tirar … do
     modelo".
- Aplicar: sem data de fim, troca o padrão de cada pessoa a partir do
  início (ou da admissão, se posterior; o padrão igual ao vigente não é
  falha) e o rascunho recebe 8 semanas; até uma data, só o rascunho muda.
  Nada é publicado. Na volta, o quadro mostra "Modelo aplicado: N células
  no rascunho para N pessoas" (e quem ficou sem trocar o padrão).
- As células saem da mesma regra do padrão (`celulaDoDia` sobre a escala do
  modelo). Sem "Substituir", ocupa só os dias vazios; com ele, regrava
  mantendo a observação e o local do dia.
- Diferenças em relação à referência: lá, a etapa 2 aparece em branco ao
  voltar da 3 (a rolagem fica embaixo); aqui, a troca de etapa leva o foco
  ao título da etapa. Aplicar sem nenhuma célula para gravar é recusado com
  a orientação de marcar "Substituir". Férias e ausências ainda não entram
  no quadro (integração da próxima fase), e a nota diz isso.
- Caixas de seleção e opções dentro do cadastro em etapas deixaram de
  herdar a largura dos campos de texto (padrão do sistema preservado).

## Exportar a escala (25/11/2026)

Conferido na referência por simulação (sem baixar lá); textos e desenho
próprios.

- Onde: "Exportar" no topo do quadro (também para quem só consulta), na
  barra da seleção (entram as pessoas selecionadas), no menu ⋯ do quadro e
  "Exportar a escala de cada uma" no ⋯ da seleção (uma página por pessoa,
  um PDF por pessoa num .zip).
- Diálogo: formato (PDF para imprimir, A4 com a cor de cada turno; ou
  planilha .xlsx, pessoa × dia com as horas); período (dia, semana ou mês,
  com anterior e próximo; começa no período do quadro); quem entra (as
  selecionadas, quem está no filtro do quadro ou escolher por unidade,
  departamento, turno e área, com a contagem de pessoas e departamentos);
  páginas (uma por unidade, departamento, turno, pessoa ou sem separar;
  "Um PDF por pessoa, num arquivo .zip"); incluir (horas, legenda dos
  turnos, linha de assinatura, avisos da CLT — este só para o RH); prévia
  com o tamanho da folha, as páginas e o nome do arquivo
  (`escala-semana-AAAA-MM-DD.pdf`).
- Só a escala PUBLICADA sai no arquivo (o rascunho e o padrão ficam de
  fora): sem publicação no período, o diálogo diz "Nada publicado neste
  período" e não baixa; com publicação, diz a data e quantas mudanças do
  rascunho não entram.
- PDF da equipe (A4 deitado): faixa com a marca, título do período, local ·
  empresa · versão publicada, a tabela (colaborador, os dias, horas) por
  grupo, legenda, avisos (opcional), assinatura do responsável e o rodapé
  "Gerado pelo Evolli em …" com a página. No mês, a célula mostra a sigla.
- PDF da pessoa (A4 em pé): os números do período (dias de trabalho, horas
  previstas, folgas, feriados trabalhados), o calendário a partir do dia de
  início da semana das Regras, a legenda e "Ciente do colaborador".
- Planilha: abas "Escala" (o texto de cada dia e as horas) e "Horas
  previstas" (horas por dia e o total); "Avisos da CLT" quando pedido.
- Geração no navegador, sem dependência nova: um gerador de PDF próprio
  (`src/arquivos/pdfSimples.ts`: Helvetica WinAnsi, texto, retângulos e
  linhas) e o gerador de .xlsx e .zip que a importação já usava. As cores
  vêm dos tokens do tema (ação e cores dos turnos).

## Controles padrão do sistema (25/11/2026)

- Decisão da proprietária: caixa de seleção e botões seguem um padrão único
  no sistema inteiro, registrado em
  [`docs/DESIGN-SYSTEM-EVOLLI.md`](../DESIGN-SYSTEM-EVOLLI.md) ("Controles
  padrão").
- Caixa de seleção global em `app/tokens.css` (`:where`, especificidade
  zero): marcada na cor de ação do tema com visto e halo; contorno
  `--borda-controle` (3:1).
- Botão: respiro lateral de 16 px (antes 24 px) nos dois componentes.

## Botões quadrados e design próprio (2026-11-25)

- Decisão da proprietária: todos os botões do sistema seguem o padrão
  "quadrado" — cantos levemente arredondados, pelo token `--radius-botao`
  (`app/tokens.css`). A pílula (`--radius-pill`) fica só para selos, chips,
  barras e marcadores.
- O Evolli tem design próprio: o arquivo de referência visual externa da
  T032 foi removido do repositório e a fonte oficial passou a ser
  [`docs/DESIGN-SYSTEM-EVOLLI.md`](../DESIGN-SYSTEM-EVOLLI.md).
