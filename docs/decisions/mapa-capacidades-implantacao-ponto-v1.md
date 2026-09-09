# Mapa de capacidades e roteiro seguro de implantação — Módulo de Ponto V1

Status: **MAPA DE PLANEJAMENTO** — não é decisão, não é autorização e não declara
conformidade.

Relacionado:
[Prontidão para operação real](prontidao-operacao-real-evolli-rh.md),
[Contrato de persistência e auditoria futura do Ponto](contrato-persistencia-auditoria-ponto-v1.md),
[Baseline V1 de Jornada e Ponto](etapa3-jornada-ponto-baseline-v1.md),
[Convergência CCT 2026/2027 — Jornada e Ponto](etapa3-cct-2026-2027-convergencia-jornada-ponto.md),
[Pacote de decisão — Compensação e quitação de Banco de Horas](pacote-decisao-compensacao-quitacao-banco-horas.md),
[Pacote de decisão — Segurança operacional](pacote-decisao-seguranca-operacional.md),
[Referências de mercado e diretrizes oficiais](referencias-mercado-diretrizes-oficiais-evolucao-evolli-rh.md),
[Baseline V1 do Painel Administrativo Web](painel-administrativo-web-v1-baseline.md);
contratos técnicos:
[motor de apuração puro V1](../modules/etapa3-motor-apuracao-puro-v1.md),
[ciclo de vida do Banco de Horas](../modules/etapa3-banco-horas-ciclo-vida-contrato-v1.md),
[compensação de Banco de Horas](../modules/etapa3-banco-horas-compensacao-contrato-v1.md),
[fila "Verificar folhas"](../modules/etapa3-fila-verificar-folhas-contrato-v1.md),
[fechamento e Espelho](../modules/etapa3-fechamento-espelho-contrato-v1.md),
[Central de Solicitações do Colaborador](../modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md),
[contrato técnico do parser AFD](../modules/etapa3-parser-afd-contrato-tecnico-v1.md),
[lote de importação AFD](../modules/etapa3-lote-importacao-afd-contrato-v1.md),
[Jornada e Ponto V1 (detalhada)](../modules/etapa3-jornada-ponto-v1-detalhada.md);
ADRs [0003](../adr/0003-identidade-sessao-e-autorizacao.md),
[0004](../adr/0004-auditoria-formal-e-integridade.md),
[0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md),
[0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md),
[0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md),
[0009](../adr/0009-painel-administrativo-web-v1.md),
[0011](../adr/0011-documentos-privados-e-admissao-digital.md),
[0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md).

## 0. Natureza e limites deste documento

Este documento é um **mapa de planejamento**: organiza, num só lugar, **o que já
existe** (fundação real ou protótipo sintético), **o que é o próximo passo
apenas visual/documental**, **o que depende de decisão formal**, **o que
depende de integração técnica** e **o que permanece bloqueado para dado real**
no módulo de Ponto V1 — e propõe uma **ordem conceitual segura** para avançar.

**O que este documento NÃO faz** (limites inegociáveis):

- **Não é especificação de operação real** — não descreve como o sistema deve
  funcionar em produção; é um mapa de planejamento e um roteiro conceitual.
- **Não declara conformidade** com a CLT, com nenhuma CCT/ACT, com a Portaria
  MTP 671/2021, com a LGPD, com o eSocial ou com qualquer outra norma. Toda
  referência normativa é **informativa**, nunca uma declaração de aderência.
- **Não substitui validação de RH, Jurídico, Folha, TI ou privacidade** — cada
  capacidade classificada como "depende de decisão formal" ou "bloqueado para
  dado real" continua exigindo essa validação, sem exceção.
- **Não usa nem solicita dado real** — todos os exemplos e referências deste
  documento são **sintéticos** (identificadores técnicos, nunca CPF, nome,
  razão social, endereço, e-mail, IP, arquivo, print ou valor financeiro).
- **Não implementa nada** — nenhum código, teste, schema, migration, endpoint,
  API, dependência, configuração ou arquivo de UI é criado por este documento.
- **Não decide nenhuma pendência** e **não inventa regra trabalhista** — apenas
  organiza o estado já registrado nos documentos relacionados acima, sem
  reabri-los.
- **Não copia** layout, texto, marca, fluxo proprietário ou dado de nenhum
  sistema de terceiros. Qualquer referência a um sistema legado usada como
  insumo desta tarefa serviu **apenas** como referência funcional de alto
  nível (existência de um conceito de mercado) — nunca como fonte de texto,
  tela, identificador ou dado copiado.

## 1. Como usar este mapa

Cada capacidade relevante (§2) recebe **um** destes rótulos de status:

| Rótulo                                             | Significado                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Já existe como fundação ou protótipo sintético** | Há um núcleo real de governança/RBAC/auditoria já implementado, **ou** um núcleo puro/contrato conceitual já validado só com dado sintético, **ou** uma tela demonstrativa no Painel Administrativo Web — em todos os casos, sem dado real e sem operação efetiva. |
| **Próximo passo visual/documental**                | Não há bloqueio de decisão pendente conhecido para uma próxima demonstração visual ou um próximo contrato conceitual — apenas ainda não foi feito.                                                                                                                 |
| **Depende de decisão formal**                      | Existe uma pendência nomeada (RH, Jurídico, Folha, TI/Segurança ou combinação) que precisa ser resolvida antes de qualquer avanço de implementação, mesmo sintética em alguns casos.                                                                               |
| **Depende de integração técnica**                  | A capacidade pressupõe uma camada (persistência, API, serviço externo) que ainda não foi construída, além de eventuais decisões pendentes.                                                                                                                         |
| **Bloqueado para dado real**                       | Mesmo com decisão e integração resolvidas, a capacidade permanece impedida de operar sobre dado real enquanto os gates transversais (MFA, `DS-OPS-01`, validade legal, retenção/base legal) estiverem abertos.                                                     |

Uma capacidade pode acumular mais de uma condição (ex.: "depende de decisão
formal **e** está bloqueada para dado real"); o mapa cita a mais restritiva
primeiro.

## 2. Mapa de capacidades

### 2.1 Cadastros e referências organizacionais

| Capacidade                                                                                             | Status                                                            | Nota                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estrutura organizacional (Empresa → Unidade → Departamento → Área → Equipe → Cargo → Centro de custo)  | Já existe como fundação real (modelo aprovado) + protótipo visual | Fronteira de autorização única é a empresa; nenhuma vigência nos nós organizacionais nesta fatia; CNPJ da empresa segue como pendência própria, não introduzida |
| Colaboradores e vínculo funcional                                                                      | Já existe como fundação real + protótipo visual                   | Colaborador é entidade independente do usuário de acesso; identificador de matrícula é técnico e único por empresa; nunca chave por CPF                         |
| Horários (tabelas de horário, faixas, vigência)                                                        | Já existe como fundação sintética + protótipo visual              | Vigência nova nunca retroativa; período já apurado com a vigência anterior não é recalculado                                                                    |
| Escalas (parametrização além de faixas fixas: tolerância, intervalo livre, dias "compensado"/"neutro") | Depende de decisão formal                                         | Modelo final de jornada/escala ainda pendente; hoje a fundação cobre apenas jornada por faixas fixas                                                            |
| Feriados (cadastro e regras de tratamento)                                                             | Depende de decisão formal                                         | Regras de feriado (inclusive apontamento não financeiro de dia trabalhado) dependem de homologação do RH antes de qualquer protótipo com regra própria          |
| Centro de custo                                                                                        | Já existe como fundação real + protótipo visual                   | Cadastrado por empresa nesta fatia, sem associação obrigatória a outro nó                                                                                       |
| Vínculo entre colaborador e usuário de acesso técnico                                                  | Depende de decisão formal                                         | Permanece deliberadamente **não** inferido por igualdade de campo; ligação técnica é decisão própria futura                                                     |

### 2.2 Operação de Ponto

| Capacidade                                                                                                   | Status                                                                                                           | Nota                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Cartão ponto (registro consolidado do dia)                                                                   | Depende de integração técnica                                                                                    | Núcleo puro de apuração existe; camada de persistência/API real para consulta administrativa ainda não construída                |
| Ajuste manual de marcação                                                                                    | Depende de integração técnica e de decisão formal                                                                | Princípio já preservado (§3): ajuste é evento aditivo, nunca edição/exclusão do original                                         |
| Solicitações do colaborador (ex.: contestação de ajuste, ausência, férias, atualização cadastral, documento) | Já existe como fundação sintética (contrato conceitual) + protótipo visual (Central do RH e área do colaborador) | Encaminhar uma solicitação **não** executa mutação; qualquer efeito trabalhista acontece no fluxo próprio do RH, fora da Central |
| Fila de revisão ("Verificar folhas")                                                                         | Já existe como fundação sintética + protótipo visual                                                             | Fila apenas sinaliza pendências; não corrige, aprova, calcula ou fecha nada automaticamente                                      |
| Apuração diária                                                                                              | Já existe como fundação sintética                                                                                | Produz crédito/débito separados e apontamentos não financeiros, em minutos; não decide saldo acumulado nem dinheiro              |
| Banco de Horas (extrato e saldo)                                                                             | Já existe como fundação sintética + protótipo visual                                                             | Saldo é sempre **derivado** dos movimentos; crédito e débito nunca são colapsados                                                |
| Compensação (proposta)                                                                                       | Já existe como fundação sintética                                                                                | Máquina de estados da proposta já validada; proposta aprovada **não** cria débito                                                |
| Registro efetivo de compensação (`debito_compensacao`)                                                       | Depende de decisão formal                                                                                        | Alçada, evidência e "quando" a proposta vira débito seguem pendentes                                                             |
| Quitação de Banco de Horas                                                                                   | Bloqueado para dado real                                                                                         | Depende de decisão formal sobre como a quitação futura vira evento rastreável e de integração com a Folha                        |
| Fechamento operacional do período                                                                            | Já existe como fundação sintética                                                                                | Ação humana do RH; não recalcula os núcleos anteriores; não declara efeito legal                                                 |
| Espelho de Ponto (superfície de leitura consolidada)                                                         | Já existe como fundação sintética (contrato)                                                                     | Próximo passo visual/documental para uma maquete de leitura; conteúdo real (PDF, layout final) segue pendente                    |
| Conferência e assinatura manual do Espelho                                                                   | Depende de decisão formal                                                                                        | Etapa **externa** ao sistema nesta versão; o sistema só registra que a etapa ocorreu, sem capturar assinatura                    |
| Assinatura eletrônica do Espelho                                                                             | Bloqueado para dado real                                                                                         | Depende de Documentos Nível 2 e de decisão própria de solução/base legal                                                         |

### 2.3 Administração, segurança e integrações

| Capacidade                                              | Status                                                   | Nota                                                                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Identidade, sessão e autorização (papéis segregados)    | Já existe como fundação real                             | Base de produto, sem dado real de colaborador                                                                                       |
| Escopo por empresa (fronteira estrutural)               | Já existe como fundação real                             | Nenhuma leitura ou escrita cruza empresas; alvo fora do escopo responde como não encontrado                                         |
| Auditoria formal e integridade (trilha append-only)     | Já existe como fundação real                             | Serviço de auditoria dedicado ao domínio de Ponto                                                                                   |
| Acesso técnico global sem mutação trabalhista           | Já existe como fundação real                             | Papel técnico único de acesso global; não aprova, não fecha, não opera rotina de RH                                                 |
| Papel de gestor (validação/recomendação sobre a equipe) | Depende de decisão formal                                | Escopo do gestor (por equipe, por departamento, por pessoa) ainda não definido; hoje é negado em toda operação trabalhista do Ponto |
| MFA (autenticação multifator)                           | Depende de decisão formal; bloqueado para dado real      | Tecnologia já indicada como baseline; ativação/imposição no servidor é pré-condição dura antes de qualquer dado real                |
| Segredos, backup e recuperação                          | Depende de decisão formal                                | Cofre/config protegida, rotação, acesso emergencial e teste de restauração seguem como formulário de decisão aberto                 |
| Configurações versionadas                               | Já existe como fundação real (padrão do repositório)     | Convenções de configuração e segredo fora do versionamento já em vigor para todo o produto                                          |
| Gate-mestre de segurança operacional                    | Depende de decisão formal; bloqueado para dado real      | Enquanto aberto, nenhum dado real entra em nenhum ambiente, de nenhum módulo                                                        |
| AFD/REP — leiaute técnico (parser)                      | Já existe como fundação sintética                        | Núcleo puro isolado, sem persistência, rede ou banco                                                                                |
| AFD/REP — lote de importação (envelope, estados)        | Já existe como fundação documental (contrato conceitual) | Especificação completa; nenhuma linha de código de importação real ainda                                                            |
| AFD/REP — homologação de fornecedor/equipamento         | Depende de decisão formal                                | Leiaute oficial publicado é referência estável; homologação campo a campo contra amostra sintética segue pendente                   |
| Comunicação técnica com equipamento/relógio de ponto    | Bloqueado para dado real                                 | Nenhuma integração de rede especificada; qualquer comunicação futura exige logs e reconciliação (ver §5)                            |
| Associação de marcação por CPF                          | Bloqueado para dado real                                 | Base legal e retenção do CPF pendentes antes de qualquer associação com dado real                                                   |
| Importação/exportação controlada (fora do AFD)          | Depende de integração técnica                            | Sem especificação própria além do lote AFD; qualquer novo formato exige o mesmo tratamento fail-closed                              |
| Integração manual com a Folha                           | Bloqueado para dado real                                 | Integração futura controlada; sem lançamento automático; depende de autorização própria da diretoria                                |
| Integração com o eSocial                                | Bloqueado; evolução futura                               | Fora do escopo do Ponto V1; documentação técnica oficial existe como referência, sem decisão de integração                          |

### 2.4 Consultas, relatórios e evidências

| Capacidade                                                             | Status                                                                                 | Nota                                                                                                                |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Painel administrativo web (navegação entre destinos e abas locais)     | Já existe como protótipo visual                                                        | Demonstrativo; nenhuma tela opera sobre dado real de ponto                                                          |
| Central do RH (fila de revisão demonstrativa)                          | Já existe como protótipo visual                                                        | Toda ação é demonstrativa; RH revisa só a própria empresa                                                           |
| Portal do Colaborador (visão geral, solicitações, documentos, jornada) | Já existe como protótipo visual                                                        | Prévia de interface; sem login real, sem autenticação de colaborador                                                |
| Documentos (metadado: catálogo, situação, referência técnica)          | Já existe como fundação real + protótipo visual                                        | Metadado e conteúdo são segregados por construção; upload permanece um estado sem transição de saída                |
| Repositório documental (referências, situação, responsável técnico)    | Já existe como protótipo visual                                                        | Somente metadados e referências técnicas; upload/anexo/download/PDF/imagem seguem indisponíveis                     |
| Upload e conteúdo real de documento                                    | Bloqueado para dado real                                                               | Depende de retenção, base legal, minimização, auditoria, MFA e validação RH + Jurídico                              |
| Assinatura de documento                                                | Bloqueado; depende de decisão formal                                                   | Depende do upload/conteúdo real (acima) e de solução própria de assinatura                                          |
| Relatório de exceções/pendências                                       | Próximo passo visual/documental                                                        | Dado conceitual já existe na fila de revisão; consolidação em relatório ainda não desenhada                         |
| Relatório de jornada                                                   | Próximo passo visual/documental; depende de integração técnica para dado agregado real | Hoje a apuração é núcleo puro sintético, sem camada de agregação persistida                                         |
| Extrato de Banco de Horas (relatório consolidado/exportável)           | Já existe como protótipo visual (tela); exportação depende de integração técnica       | A tela demonstrativa já existe; um relatório exportável é passo seguinte                                            |
| Relatório de justificativas                                            | Próximo passo visual/documental                                                        | Depende do catálogo fechado de motivos já usado nos núcleos de pendência/solicitação                                |
| Relatório de horários e feriados                                       | Próximo passo visual/documental                                                        | Depende também da decisão de escalas/feriados (§2.1)                                                                |
| Biometria (qualquer captura ou verificação)                            | Bloqueado                                                                              | Depende de decisão específica de necessidade, segurança, controle de acesso e retenção; nenhuma decisão existe hoje |

## 3. Decisões e gates preservados (não reabertos por este mapa)

Este mapa **não decide** nem **relaxa** nenhum destes pontos — apenas os
organiza. Cada um segue exatamente como registrado no documento de origem:

- **Marcação original nunca é apagada ou sobrescrita.** Toda apuração,
  movimento, pendência, proposta ou evento de fechamento é histórico
  append-only.
- **Ajuste manual é um evento aditivo**, identificado, com motivo codificado e
  auditável — nunca uma edição do registro original.
- **O gestor, quando seu escopo for decidido, valida ou recomenda — nunca
  altera a marcação bruta.** Toda mutação trabalhista continua exclusiva do
  RH da própria empresa.
- **Crédito e débito de Banco de Horas permanecem separados**; o saldo é
  sempre **derivado** da soma dos movimentos, nunca um campo mutável
  independente.
- **Uma proposta de compensação aprovada não cria débito efetivo
  automaticamente.** O registro efetivo depende de decisão formal própria.
- **O módulo de Ponto não calcula salário, DSR financeiro, pagamento,
  adicional ou desconto.** Qualquer efeito monetário pertence à Folha, fora
  do Ponto.
- **Operação com dado real depende, sempre, de:** MFA habilitado e imposto no
  servidor; o gate-mestre de segurança operacional resolvido; retenção e base
  legal definidas; auditoria comprovada; e as validações formais aplicáveis
  de RH, Jurídico, Folha e TI.
- **Biometria permanece bloqueada** até decisão específica de necessidade,
  segurança, controle de acesso e retenção — nunca assumida por conveniência
  de escopo.
- **A Folha começa como integração futura controlada**, sem lançamento
  automático — qualquer efeito financeiro ou de quitação exige interface
  própria, decidida formalmente, fora do módulo de Ponto.

## 4. Roteiro conceitual de implantação (ordem segura, sem datas ou estimativas)

Ordem lógica; cada etapa só avança quando a anterior estiver satisfeita.
**Nenhuma data, prazo, percentual, promessa ou estimativa é atribuída aqui.**

1. **Decisões e governança** — resolver os gates transversais nomeados no §3
   (MFA, gate-mestre de segurança operacional, retenção/base legal, alçadas de
   Banco de Horas, escopo do gestor) com as áreas responsáveis (RH, Jurídico,
   Folha, TI/Segurança, diretoria conforme o caso).
2. **Persistência e auditoria** — modelar o armazenamento real respeitando as
   fronteiras já fixadas (segregação por empresa, referências técnicas,
   histórico append-only, saldo derivado, correção aditiva), só depois das
   decisões do passo 1.
3. **Operação controlada de Ponto** — construir a camada de aplicação sobre
   os núcleos já validados (apuração, extrato, propostas, fila de revisão,
   fechamento), sempre repetindo a homologação com dado sintético antes de
   qualquer piloto.
4. **Evidências e documentos** — avançar Documentos além do metadado (Nível 2)
   apenas quando retenção, base legal, minimização e auditoria estiverem
   decididas, mantendo a segregação entre metadado e conteúdo.
5. **Integrações AFD/REP** — homologar leiaute e fornecedor de equipamento
   contra amostra sintética, sob os mesmos princípios fail-closed já
   especificados no contrato de lote, antes de qualquer importação real.
6. **Integração manual com a Folha** — desenhar a interface/evento de
   integração (registro efetivo de compensação, quitação) como decisão formal
   própria, sem lançamento automático em nenhuma etapa.
7. **Automações e integrações futuras** — avaliar evolução (assinatura
   eletrônica, relatórios avançados, eSocial, autosserviço ampliado) somente
   depois de todas as etapas anteriores homologadas, sempre como decisão de
   produto própria, nunca por inferência de mercado.

## 5. O que não replicar do sistema legado

Referências funcionais de alto nível a um sistema legado foram usadas **só**
como indicação de que um conceito de mercado existe — nunca como fonte de
layout, texto, marca, fluxo proprietário ou dado. Os padrões abaixo são
**explicitamente rejeitados** para o Ponto V1, independentemente de serem
comuns em outros produtos:

- **Controle de acesso apenas por ocultação de menu.** Ocultar um item de
  navegação é, no máximo, conveniência de interface — nunca a decisão de
  autorização, que continua sendo sempre do servidor (RBAC/ABAC), nunca do
  cliente.
- **Ajustes que alterem ou escondam a marcação original.** Qualquer correção
  é um novo evento aditivo, referenciando o original — o dado bruto nunca é
  substituído nem ocultado da trilha.
- **Fechamento apenas automático por calendário.** O fechamento é sempre uma
  ação humana do RH, precedida de revisão das pendências — nunca um job que
  fecha o período sem decisão humana.
- **Cálculos financeiros automáticos dentro do Ponto.** Nenhum valor
  monetário, salário, adicional, desconto ou DSR financeiro é calculado pelo
  módulo de Ponto — esse efeito pertence exclusivamente à Folha.
- **Comunicação técnica com equipamento sem log e reconciliação.** Qualquer
  integração futura com relógio/REP exige trilha de auditoria e reconciliação
  auditável do que foi enviado/recebido — nunca uma chamada silenciosa sem
  evidência.
- **Biometria sem decisão formal.** Nenhuma captura biométrica é assumida por
  ser prática comum de mercado — exige decisão própria e explícita de
  necessidade, segurança, controle de acesso e retenção.
- **Alegações automáticas de conformidade normativa.** Nenhuma tela, relatório
  ou rótulo declara conformidade com a CLT, CCT/ACT, Portaria 671, LGPD ou
  eSocial — essas conclusões dependem sempre de validação humana do Jurídico.

## 6. Declaração

Este é um **mapa de planejamento**, não uma decisão nem uma autorização. Não
foi criado código, schema, migration, endpoint, API, dependência ou arquivo de
UI por este documento; não há dado real, CPF, nome, razão social, CNPJ,
endereço, e-mail, IP, arquivo, print ou valor financeiro em nenhuma linha
acima; e **não** se declara conformidade com a CLT, com a CCT/ACT, com a
Portaria MTP 671/2021, com a LGPD, com o eSocial ou com qualquer outra norma.
As decisões e gates preservados no §3, o roteiro do §4 e os anti-padrões do §5
**não substituem** a validação de RH, Jurídico, Folha, TI ou privacidade — cada
capacidade classificada como "depende de decisão formal" ou "bloqueado para
dado real" permanece exatamente como estava nos documentos de origem
referenciados no topo deste mapa.
