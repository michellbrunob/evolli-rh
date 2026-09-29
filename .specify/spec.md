# Especificação Detalhada - Evolli RH - Reserva Fiscal

**Status:** Especificação-base convergida; cada fatia exige complemento e aceite próprios

**Criado:** 2026-08-13

**Última convergência:** 2026-09-29
**Fontes:** Constituição v1.4.0; PRD oficial no Notion; ADRs 0001-0013; decisões versionadas;
Diário Dev - Reserva Fiscal
**Escopo:** Plataforma interna de RH e Reserva Fiscal. Esta especificação descreve comportamento e
regras de negócio; decisões técnicas pertencem ao implementation plan.

> **Glossário vinculante — 20/08/2026:** “Reserva Fiscal” é o nome da empresa e do projeto, não um
> produto, serviço ou módulo. Qualquer referência histórica a “reserva fiscal”, “créditos trabalhistas”
> ou a um módulo fiscal deve ser considerada retirada de escopo e não autoriza trabalho futuro.

## 1. Propósito, limites e prioridades

O Evolli RH centraliza processos hoje manuais em fluxos rastreáveis, protegidos e auditáveis. A
plataforma deve preservar confidencialidade, integridade, disponibilidade e privacidade de dados de
colaboradores, candidatos e informações trabalhistas/fiscais.

O deployment atual é interno. `company_id` é a fronteira organizacional e de autorização. O produto
não inicia multitenancy comercial, exposição pública, automação autônoma de decisão trabalhista ou
fiscal, nem processamento real sem os gates de segurança, LGPD e homologação aplicáveis.

O uso inicial contempla duas empresas internas. Cada usuário operacional pertence a uma única empresa
e só pode visualizar, pesquisar, exportar, aprovar ou alterar recursos daquele escopo. A exceção é o
perfil `master_tecnico`, atribuível a contas nominativas formalmente autorizadas para desenvolvimento e
suporte, com visão global e configuração do ecossistema. Qualquer tentativa de acesso à outra empresa
por perfil não Master é negada no servidor sem expor a existência do recurso. Ações de alto impacto
exigem permissão explícita, auditoria e alçada aprovada; na ausência da regra, a ação é negada inclusive
para o Master.

| Prioridade | Entrega de valor independente                      | Estado conhecido                                                                                 |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| P1         | Cadastro e vida funcional rastreáveis              | Base já integrada; evolução por regras aprovadas                                                 |
| P1         | Jornada/ponto por TXT com prévia e rastreabilidade | Especificado; depende de amostra e homologação                                                   |
| P1         | Segurança, LGPD e auditoria transversal            | Fundação/auditoria integradas; gates reais pendentes                                             |
| P1         | Isolamento multiempresa interno                    | Base estrutural integrada; requer auditoria específica para confirmar o escopo das duas empresas |
| P2         | Folha de pagamento                                 | Requer regras, fórmulas e responsáveis aprovados                                                 |
| P2         | Relatórios gerenciais e operacionais confiáveis    | Requer definições de indicadores e fontes aprovadas                                              |

### 1.1 Estado convergido em 29/09/2026

- **Integrado em `main` até T136:** fundação de identidade/sessão/RBAC/auditoria; estrutura
  organizacional; contas de acesso; autenticação web; sessões ativas; MFA TOTP opcional; cadastros
  funcionais de organização, cargos, centros de custo e horários; colaboradores, vínculos, histórico
  funcional, documentos, dados contratuais e operações delimitadas de Ponto.
- **Superfícies demonstrativas:** continuam sem persistência quando o contrato de backend ou a decisão
  de negócio não existe. A existência visual de uma aba não autoriza tratá-la como funcional.
- **T135:** investigação de Solicitações gerais de Pessoas encerrada sem código porque não há contrato
  HTTP, modelo persistente, RBAC nem decisões humanas suficientes.
- **T136 / PR #129:** pacote de decisão integrado; `PD-SOL-01..05` foram aprovadas em 2026-09-29.
  Catálogo, alçadas, separação de "Verificar folhas", cancelamento/reabertura, objetivo de primeiro
  retorno e política mínima de evidências estão definidos. O Cloudflare R2 foi aprovado como provedor
  privado futuro pela ADR 0013, sem habilitar upload.
- **T138 / PR #130:** convergência do Spec Kit integrada, com gate `pnpm spec:check` na CI.
- **T140:** interface web funcional de Pessoas > Solicitações sobre os cinco endpoints da T139,
  implementada e em revisão. Consome o contrato existente sem ampliá-lo; não implementa ESS/MSS, não
  exibe anexo ou informação clínica e não calcula prazo no navegador.
- **T139 / PR #131:** fundação backend da Central **integrada** em `main` (squash `6eaa6f9`). A
  revisão adversarial encontrou uma corrida de transições concorrentes, corrigida com lock de linha
  na própria branch antes da integração. A tarefa histórica T137
  não foi executada e foi substituída pela T139. A fundação registra e encaminha: não habilita anexo,
  não produz efeito trabalhista automático, não bloqueia fechamento e não implementa cronômetro de
  SLA. Não existe autoatendimento do colaborador enquanto `DP-23` (vínculo `AccessUser <->
Colaborador`) não for decidido — o RH registra em nome do colaborador, como em
  `solicitacoes-documento`.
- **MFA:** núcleo e interface existem. O lançamento inicial usa `MFA_ENABLED=false` por decisão T132;
  MFA universal permanece como alvo. Conta que já tenha fator ativo falha fechada enquanto o recurso
  estiver desligado. Ativação futura depende da chave protegida, das evidências `DS-SEC-*` e de decisão
  de rollout.
- O estado detalhado e a evidência por faixa de tarefas ficam em
  [`.specify/execution-status.md`](execution-status.md); o estado legível por automação fica em
  [`.specify/sync-state.json`](sync-state.json).

## 2. Regras transversais de aceite

- Toda função exige autenticação e autorização no servidor por papel, escopo organizacional e objeto.
  Uma negação não pode revelar existência ou metadados do recurso protegido.
- Cada módulo registra finalidade, base legal, categorias de dados/titulares, origem, compartilhamentos,
  retenção, descarte e responsável antes de receber dados reais. RIPD/DPIA é avaliado quando o risco
  do tratamento o exigir.
- Dados pessoais, sensíveis, salariais, financeiros, fiscais, documentos, tokens e credenciais não
  aparecem em URLs, logs técnicos, mensagens de erro, cache público, e-mails ou auditoria em claro.
- Operações relevantes possuem auditoria append-only com ator, ação, recurso, escopo, origem,
  resultado, data/hora e correlação; eventos não são alterados ou apagados.
- Regras trabalhistas, previdenciárias, tributárias, fiscais e cálculos monetários são versionadas,
  efetivas por período, testáveis e aprovadas pelo responsável competente. O sistema não presume lei,
  alíquota, fórmula, prazo ou integração oficial ausente.
- Produção, piloto com dados reais e qualquer exposição externa dependem dos gates aplicáveis,
  backups com restauração testada, revisão de segurança, risco crítico inexistente e aprovações
  documentadas de RH, Segurança e Jurídico quando aplicável. A única aceitação de risco atualmente
  registrada para o lançamento inicial é MFA não obrigatório (`MFA_ENABLED=false`, T132); ela não
  encerra nem dispensa os demais gates operacionais, de privacidade ou infraestrutura.

## 3. Cadastro de colaboradores

### Objetivo

Manter o cadastro e a linha do tempo funcional do colaborador, preservando a situação vigente e o
histórico de admissões, vínculos, alocações, movimentos, documentos e informações estritamente
necessárias aos processos autorizados de RH e folha.

### Casos de uso principais

1. RH/DP cadastra uma admissão com colaborador, vínculo e alocação organizacional, validando o escopo
   da empresa e os campos obrigatórios aprovados.
2. RH autorizado consulta a situação do colaborador em uma data e sua linha do tempo por categoria,
   período e situação.
3. Gestor inicia uma solicitação permitida (admissão, desligamento, promoção, férias ou transferência)
   para seu escopo; RH valida e efetiva ou recusa o evento.
4. RH programa um evento futuro ou retifica um evento efetivado, sem apagar nem sobrescrever o
   histórico anterior.
5. Colaborador consulta somente seus próprios documentos e dados liberados; RH publica, substitui ou
   cancela a publicação segundo permissão e retenção aprovadas.

### Regras de negócio críticas

- Cada colaborador possui identificador interno e matrícula única por empresa; integrações usam
  identificadores aprovados, nunca nome como chave.
- A admissão efetivada cria colaborador, primeiro vínculo e alocação vigente de forma atômica. Vínculos
  e alocações não podem se sobrepor em períodos incompatíveis.
- Todo movimento possui tipo, solicitação, vigência/efetivação, situação, motivo, solicitante,
  aprovadores, executor, anexos autorizados e resultado. O fluxo mínimo é: rascunho, solicitado, em
  validação, aguardando aprovação, aprovado, efetivado, recusado, cancelado ou retificado.
- Movimentos futuros não alteram silenciosamente a situação vigente; a consulta por data apresenta o
  registro efetivo naquele período. Correção ocorre por retificação/evento vinculado, nunca exclusão
  física do registro efetivado.
- Salário, benefícios, dados familiares, saúde, documentos pessoais e eventos confidenciais são de
  acesso restrito. Gestores não veem esses dados por padrão, inclusive em listagens, relatórios e
  notificações.
- Documento é acessível somente por autorização de objeto no servidor. Publicação, alteração,
  cancelamento, visualização e download são auditados. Links públicos, previsíveis ou permanentes são
  proibidos.
- Alteração salarial, promoção, desligamento, dados familiares e outros eventos de alto impacto exigem
  matriz de aprovação, justificativa, segregação de funções e confirmação/reautenticação proporcional
  ao risco.

### Dependências externas e decisões pendentes

- RH/Jurídico definem categorias cadastrais, finalidade, base legal, retenção, descarte,
  documentos comprobatórios e matriz de aprovação.
- RH define o escopo de subordinados diretos/indiretos, campos, anexos, SLA e notificações dos fluxos
  do Portal do Gestor.
- Cloudflare R2 é o provedor privado aprovado (ADR 0013). Credenciais por ambiente, limites,
  quarentena/antimalware, matriz de acesso, retenção e descarte continuam pré-requisitos para uploads
  e documentos reais.
- Integrações com folha, ponto, férias e benefícios dependem de contrato e homologação próprios.

### Cenários de aceite

1. **Dado** RH autorizado na empresa A, **quando** efetiva a admissão válida, **então** colaborador,
   vínculo e alocação são persistidos juntos e auditados sem conteúdo pessoal no evento.
2. **Dado** gestor sem escopo do colaborador, **quando** altera um identificador de requisição,
   **então** não obtém dados nem metadados e a tentativa é tratada/auditada conforme política.
3. **Dado** evento salarial efetivado, **quando** há correção, **então** o original permanece íntegro e
   a retificação vinculada contém vigência, motivo, aprovação e evidência.

## 4. Controle de ponto e jornada

### Objetivo

Importar marcações brutas de ponto, apurar jornadas sob regras homologadas e disponibilizar espelho,
pendências e saldo autorizado para RH, colaborador, gestor e futura folha, sem adulterar o evento de
origem.

### Casos de uso principais

1. Operador autorizado envia um TXT de ponto e recebe prévia de layout, período, colaboradores
   identificados, totais, inconsistências e possíveis duplicidades.
2. Operador confirma lote válido; o sistema mantém arquivo original protegido, hash, layout/versão,
   operador, data/hora, totais, erros e marcações brutas.
3. RH reprocessa apuração com uma versão de regra aprovada e compara pendências, intervalos, horas,
   ausências e banco de horas no espelho de ponto.
4. Colaborador consulta seu espelho; gestor acompanha somente equipe autorizada; RH exporta dados
   aprovados para folha.
5. RH registra ajuste excepcional com justificativa e aprovação, preservando o evento original.

### Regras de negócio críticas

- A entrada é a marcação bruta, não totais pré-calculados. O vínculo com o colaborador usa matrícula
  ou identificador do relógio aprovados, nunca nome.
- A mesma fonte não pode produzir marcações efetivas duplicadas. O sistema identifica reimportação por
  hash, origem, período e demais critérios homologados e informa o resultado sem duplicar eventos.
- O lote passa por prévia, validação e confirmação. Falha de formato, tamanho, conteúdo, layout,
  permissão ou duplicidade impede efetivação e registra erro seguro.
- A apuração associa uma versão de cálculo às regras de jornada, escala, intervalos, feriados,
  ausências, fechamento e exceções aplicáveis. Nenhuma regra é presumida a partir de texto livre.
- Fechamento mensal bloqueia alterações ordinárias; exceções posteriores usam procedimento aprovado,
  justificativa, aprovação, versão de cálculo e auditoria.
- Ajustes não alteram a marcação original. Eles são eventos adicionais identificados com autor, motivo,
  aprovação e efeitos de cálculo.
- Dados biométricos, geolocalização, dispositivo ou dados de REP têm classificação e avaliação de
  privacidade específicas antes de coleta/uso.

### Dependências externas e decisões pendentes

- RH fornece TXT anonimizado, documentação do fabricante/REP, mapeamento de campos, períodos de
  fechamento, escalas, exceções, feriados e regras de banco de horas.
- RH, Jurídico e fornecedor do REP homologam aderência regulatória e regras de registro eletrônico.
- A integração/exportação com folha exige contrato de campos, competência, reconciliação e aceite de
  ambas as áreas.

### Cenários de aceite

1. **Dado** um TXT válido e inédito, **quando** o operador confirma o lote, **então** as marcações
   brutas, metadados e resultado de validação ficam rastreáveis e disponíveis para apuração.
2. **Dado** o mesmo arquivo já efetivado, **quando** é reenviado, **então** não há duplicação de
   marcações e o usuário recebe a situação idempotente do lote.
3. **Dado** ajuste após fechamento, **quando** não contém aprovação exigida, **então** ele não afeta
   o cálculo nem a exportação.

## 5. Folha de pagamento

### Objetivo

Preparar, calcular, revisar, aprovar e disponibilizar os eventos de folha e documentos correlatos de
forma rastreável, por competência e vigência, sem substituir homologação humana, contábil ou legal.

### Casos de uso principais

1. DP configura rubricas, incidências, parâmetros e regras com vigência aprovada para uma competência.
2. DP gera uma prévia de folha a partir de vínculos, movimentos efetivados, jornadas homologadas,
   férias, afastamentos e demais fontes aprovadas.
3. Responsáveis revisam divergências, justificam ajustes e aprovam fechamento de competência conforme
   alçada.
4. RH publica contracheques e documentos de férias ao Portal do Colaborador, com acesso exclusivo ao
   titular e registro de visualização/download.
5. Área autorizada exporta arquivos/dados aprovados para contabilidade, pagamento ou obrigações, com
   reconciliação de resultado.

### Regras de negócio críticas

- Nenhuma fórmula, rubrica, alíquota, incidência, base de cálculo, arredondamento, encargo ou obrigação
  é criada por inferência. Cada regra contém versão, vigência, fonte/aprovação, responsável e cenários
  de teste de referência.
- A folha usa somente dados efetivados e autorizados da competência. Eventos pendentes, reprovados ou
  sem vigência válida não alteram cálculo final.
- Cálculos devem ser reproduzíveis: guardar competência, versão das regras, insumos autorizados,
  resultado, responsável, aprovação e justificativas de exceção.
- Ajustes e recálculos produzem versão/retificação rastreável; não sobrescrevem um fechamento sem
  registrar motivo, alçada e impacto.
- Fechamento, alteração salarial, férias, afastamento, desligamento e pagamento seguem segregação de
  funções e aprovação definida. A solicitação do gestor não efetiva cadastro ou folha automaticamente.
- Contracheques, recibos e declarações têm acesso de objeto, cache privado, link autenticado/temporário,
  retenção e auditoria. Não são enviados como anexo ou com conteúdo sensível em notificação.

### Dependências externas e decisões pendentes

- DP/Fiscal/Jurídico formalizam rubricas, convenções, calendários, regras de férias, 13º,
  afastamentos, rescisões, encargos, eventos e obrigações aplicáveis.
- Contabilidade, banco e provedores oficiais definem contrato de integração, homologação, contingência
  e reconciliação. Integração oficial não é assumida sem validação da fonte.
- Jurídico define retenção documental, base legal, atendimento a direitos e necessidade de RIPD.

### Cenários de aceite

1. **Dado** uma competência e regras aprovadas, **quando** DP gera prévia, **então** o resultado
   informa versão, fontes, exceções e itens que impedem fechamento.
2. **Dado** regra sem vigência ou aprovação, **quando** é usada no cálculo, **então** o sistema bloqueia
   o fechamento e aponta a pendência.
3. **Dado** colaborador autenticado, **quando** solicita documento próprio, **então** recebe apenas o
   documento liberado a ele, com operação auditada; outro identificador não revela existência.

## 6. Relatórios gerenciais e operacionais

### Objetivo

Disponibilizar indicadores, relatórios operacionais e demonstrações fiscais confiáveis, contextualizados
por período, origem, atualização, fórmula e acesso autorizado, priorizando agregação e minimização de
dados pessoais.

### Casos de uso principais

1. RH e Diretoria consultam indicadores agregados por período e escopo autorizado: headcount,
   admissões, desligamentos, turnover, absenteísmo, vagas, tempo de recrutamento, clima e treinamentos.
2. RH consulta indicadores operacionais de pessoas, jornadas e treinamentos conforme escopo e fonte
   aprovados.
3. Usuário autorizado gera relatório ou exportação com finalidade, filtros, período e fonte registrados.
4. RH acompanha pendências de ponto, treinamento, documentos e solicitações conforme seu escopo.

### Regras de negócio críticas

- Todo indicador exibe período de referência, fonte, data/hora da última atualização, fórmula/versão e
  limitações conhecidas para o público autorizado.
- Fórmulas de headcount, turnover, absenteísmo, tempo médio de recrutamento e indicadores fiscais são
  definidas e homologadas pelos donos de negócio antes de publicação.
- Diretoria e gestores recebem indicadores agregados e somente o recorte necessário; detalhes pessoais,
  salariais, médicos, disciplinares ou familiares ficam fora do escopo padrão.
- Pesquisa de clima separa elegibilidade e respostas; resultados são exclusivamente agregados e só são
  divulgados acima do limiar mínimo aprovado por RH/Jurídico, com supressão de recortes reidentificáveis.
- Exportação é uma operação sensível: exige permissão, escopo, finalidade, filtros e auditoria. O
  conteúdo exportado deve conter somente as colunas autorizadas e mecanismo seguro de entrega.
- Relatório não pode misturar períodos, regras ou fontes sem identificação explícita; divergências de
  reconciliação são exibidas como pendência, não mascaradas por total consolidado.

### Dependências externas e decisões pendentes

- RH aprova fórmula, definição, público, periodicidade, metas e fonte de cada indicador.
- RH/Jurídico definem limiar de clima (proposta inicial: cinco respondentes), retenção e governança dos
  planos de ação.
- Conectores e BI externos dependem de revisão de segurança, contrato de compartilhamento, minimização
  e aprovação de acesso.

### Cenários de aceite

1. **Dado** Diretoria autorizada, **quando** consulta turnover, **então** vê fórmula, período, fonte e
   dado agregado; não recebe detalhes individuais não autorizados.
2. **Dado** departamento abaixo do limiar de anonimato, **quando** solicita resultado de clima, **então**
   o sistema suprime o resultado e não permite exportação reidentificável.
3. **Dado** relatório fiscal conciliado, **quando** é exportado, **então** período, regra, filtros,
   solicitante e resultado ficam registrados em auditoria.

## 8. Segurança, LGPD e trilhas de auditoria

### Objetivo

Garantir controles de segurança e privacidade desde a concepção, mantendo evidência confiável de
operações relevantes e reduzindo risco de acesso indevido, vazamento, alteração não autorizada ou
perda de dados.

### Casos de uso principais

1. Usuário autentica-se por sessão segura e executa somente ações compatíveis com papel, escopo e
   objeto; ações negadas não elevam privilégio.
2. RH/Jurídico consulta o inventário de tratamento e conduz análise de finalidade, base legal,
   retenção, compartilhamento, atendimento a titulares e incidentes.
3. Auditor autorizado investiga eventos de segurança e negócio sem visualizar conteúdo sensível em
   claro nos próprios eventos.
4. Operador recupera ambiente por backup segregado e validado, seguindo objetivo de recuperação e
   procedimento documentado.

### Regras de negócio críticas

- Menor privilégio, negação por padrão, RBAC/ABAC e autorização por objeto são aplicados no servidor.
  O perfil `master_tecnico` é a exceção controlada de escopo global: só pode ser atribuído a conta
  nominativa, tem todas as ações globais auditadas e não contorna aprovações de negócio. Enquanto o
  lançamento inicial operar sem MFA obrigatório, aplicam-se a aceitação de risco e os controles
  compensatórios registrados em T132; ativação futura segue os gates `DS-SEC-*`.
- Convergência (ADR 0012): `master_tecnico` é o **único** acesso global standing; `admin_tecnico`
  converge para bootstrap/histórico (perda futura da auto-cunhagem); o papel `dpo` fica depreciado
  (não destrutivo, sem provisionamento); a governança de privacidade/LGPD é de **RH + Jurídico**.
- Credenciais, segredos, tokens, dados reais, documentos e backups não entram no repositório. Sessões
  usam credencial opaca, revogável e protegida. MFA TOTP é implementado e opcional por configuração
  no lançamento inicial; fator ativo nunca é rebaixado para senha única.
- Logs técnicos são estruturados e redigidos. A auditoria formal é separada, append-only e não aceita
  conteúdo livre ou valores sensíveis antes/depois sem decisão arquitetural aprovada.
- Alterações sensíveis e auditoria obrigatória são atômicas: falha na persistência de auditoria impede
  a mutação que exige essa evidência. Correções de eventos são complementares, nunca edição do evento.
- Arquivos passam por validação, armazenamento privado, quarentena/antimalware quando suportado,
  autorização de download e política de retenção/descarte.
- Backups são criptografados ou protegidos por controle compensatório formal, segregados, monitorados e
  restaurados em teste. Incidentes possuem fluxo de resposta, responsáveis e evidência preservada.

### Dependências externas e decisões pendentes

- Segurança/TI definem hospedagem, rede, IAM, monitoramento, resposta a incidentes, objetivos de
  recuperação, cofre de segredos, ativação operacional do MFA, SSO/Active Directory e controles de
  rede.
- RH/Jurídico definem bases legais, prazos, descarte, titulares, operadores/fornecedores e RIPD/DPIA.
- Acesso de `auditor`, retenção/exportação de auditoria e medidas de imutabilidade adicional
  (WORM/hash encadeado) requerem decisão antes do primeiro uso aplicável.

### Cenários de aceite

1. **Dado** usuário sem autorização de objeto, **quando** tenta ler, baixar ou exportar recurso de
   outra empresa/equipe/colaborador, **então** o servidor bloqueia sem vazar existência ou metadados.
2. **Dado** mudança sensível, **quando** a auditoria obrigatória falha, **então** a mudança não é
   efetivada; não existe alteração órfã.
3. **Dado** backup aprovado, **quando** é submetido a teste de restauração, **então** a restauração e
   integridade são comprovadas sem expor dados reais em ambiente não autorizado.

## 9. Entidades de negócio principais

- **Colaborador e vínculo funcional:** pessoa e sua relação profissional, com vigência e escopo.
- **Alocação e movimento funcional:** posição organizacional e mudança datada, aprovada e rastreável.
- **Documento protegido:** arquivo e metadados mínimos, publicação, autorização, retenção e acesso.
- **Lote de ponto e marcação bruta:** fonte importada, hash, layout, resultado e eventos originais.
- **Regra de jornada/folha:** política versionada, efetiva por período, aprovada e testável.
- **Competência e apuração:** período, insumos, versão de regra, cálculo, resultado, aprovação e
  retificação quando aplicável.
- **Relatório/exportação:** finalidade, escopo, filtros, fórmula/fonte, conteúdo autorizado e evidência.
- **Evento de auditoria:** evidência append-only de ator, ação, recurso, escopo, origem, resultado e
  correlação, sem conteúdo sensível em claro.

## 10. Exclusões e decisões que bloqueiam implementação

- Não implementar regra trabalhista, fórmula de indicador, integração oficial ou cálculo de folha sem
  fonte e aprovação formal do responsável.
- Não processar dado real, documento real, biometria, geolocalização ou currículo antes das decisões de
  privacidade, segurança e retenção aplicáveis.
- Não publicar externamente nem liberar produção antes dos gates da Constituição e do PRD.
- Não expor respostas individuais de clima, dados pessoais de terceiros, documentos ou valores
  confidenciais por conveniência de relatório, administração técnica ou filtro apenas de interface.

## 11. Critérios mensuráveis de sucesso

- **SC-001:** 100% dos módulos homologados possuem matriz de acesso, cenários positivos e negativos,
  classificação de dados e eventos de auditoria aplicáveis.
- **SC-002:** toda importação de ponto efetivada preserva origem, hash, layout, operador, resultado e
  não cria marcação duplicada quando a mesma fonte é reenviada.
- **SC-003:** 100% dos relatórios publicados informam período, fonte, atualização e fórmula/regra
  aprovada; relatórios sensíveis aplicam escopo e agregação autorizados.
- **SC-004:** toda apuração de folha aprovada pode ser reproduzida a partir de versão de regra,
  competência e insumos registrados.
- **SC-005:** não há publicação externa ou piloto com dados reais enquanto existir risco crítico aberto
  ou gate obrigatório sem evidência de aprovação.

## 12. Rastreabilidade e próximos passos

Esta especificação deriva do PRD oficial no Notion e deve ser refinada por fatia antes da implementação.
A T139 entregou a fundação de backend de Solicitações gerais de Pessoas sem anexos, com o núcleo puro
T066 já reconciliado à regra aprovada de cancelamento e reabertura; o termo funcional "encerrada"
corresponde ao estado terminal `encaminhada_para_operacao_rh`, sem estado novo. A T140 colocou a
interface funcional de RH sobre essa fundação, sem alterar contrato algum do backend. A próxima fatia
só é aberta após a integração da T140 e recebe o próximo identificador disponível. Folha permanece em
planejamento até a homologação das regras e responsáveis.

> Nota (T032): "Reserva Fiscal" é o nome da empresa/projeto, não um módulo (glossario-reserva-fiscal.md). Governança de privacidade = RH + Juridico (ADR 0012). Estado integrado e gates pendentes: ver README e ROADMAP.
