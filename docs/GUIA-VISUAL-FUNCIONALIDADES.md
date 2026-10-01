# Guia visual — o que já dá para navegar

> Reflete **somente o que está integrado na `main`**. Nada aqui é marcado como
> funcional por existir em branch, protótipo ou documento conceitual.
>
> Ambiente de **desenvolvimento e demonstração local**, com dados
> **exclusivamente sintéticos**. Não é homologação nem produção.

Como subir: [AMBIENTE-DEMONSTRACAO-LOCAL.md](./AMBIENTE-DEMONSTRACAO-LOCAL.md).
Estado formal por tarefa: [`.specify/execution-status.md`](../.specify/execution-status.md).

## Como ler o status

| Status              | O que significa                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Funcional**       | Fala com a API real, persiste no banco e respeita RBAC do servidor.                                                                |
| **Somente leitura** | Consulta real, sem operação de escrita nesta fatia.                                                                                |
| **Demonstrativa**   | Superfície visual com dados de exemplo no próprio código. Não persiste, não consulta a API, não representa capacidade operacional. |
| **Bloqueada**       | Depende de decisão ou portão ainda aberto.                                                                                         |

Hoje: **12 telas funcionais** e **33 demonstrativas**. Uma aba existir no menu
não significa que ela faça algo.

**Navegação agrupada (T142).** O menu lateral está dividido em três grupos —
**Operação** (Início, Cadastros, Pessoas, Ponto, Documentos, Solicitações),
**Consulta** (Portal do Colaborador, Relatórios) e **Administração** (Contas
de acesso). É só reorganização visual: nenhum destino saiu da lista, nenhuma
permissão mudou. Os rótulos de grupo não são focáveis nem entram na ordem de
tabulação.

## Início

| Tela        | Caminho  | Status        | Perfil   | Origem |
| ----------- | -------- | ------------- | -------- | ------ |
| Visão geral | `Início` | Demonstrativa | qualquer | T063   |

Painel de entrada com atalhos. Não agrega número real.

## Cadastros

| Tela                                 | Caminho                                   | Status        | Objetivo                                 | Perfil    | Origem    |
| ------------------------------------ | ----------------------------------------- | ------------- | ---------------------------------------- | --------- | --------- |
| Horários                             | `Cadastros › Horários`                    | **Funcional** | Tabelas de horário e períodos por dia    | `rh.alfa` | T110      |
| Estrutura organizacional             | `Cadastros › Estrutura organizacional`    | **Funcional** | Unidades, departamentos, áreas e equipes | `rh.alfa` | T104–T109 |
| Funções e cargos                     | `Cadastros › Funções e cargos`            | **Funcional** | Cargos da empresa                        | `rh.alfa` | T104–T109 |
| Centros de custo                     | `Cadastros › Centros de custo`            | **Funcional** | Centros de custo                         | `rh.alfa` | T104–T109 |
| Calendário de feriados               | `Cadastros › Calendário de feriados`      | Demonstrativa | —                                        | —         | T077      |
| Políticas de Banco de Horas          | `Cadastros › Políticas de Banco de Horas` | Demonstrativa | —                                        | —         | T079      |
| Motivos de ausência e justificativas | `Cadastros › Motivos de ausência…`        | Demonstrativa | —                                        | —         | T081      |
| Tipos de documento                   | `Cadastros › Tipos de documento`          | Demonstrativa | —                                        | —         | T083–T103 |
| Motivos de desligamento              | `Cadastros › Motivos de desligamento`     | Demonstrativa | —                                        | —         | T083–T103 |
| Escolaridade                         | `Cadastros › Escolaridade`                | Demonstrativa | —                                        | —         | T083–T103 |
| Cidades e localidades                | `Cadastros › Cidades e localidades`       | Demonstrativa | —                                        | —         | T083–T103 |

**Dá para testar** nas quatro funcionais: criar, renomear, inativar e reativar,
com escopo de empresa e resposta 404 para recurso de outra empresa.
**Ainda não:** importação em massa e vigência nos catálogos demonstrativos.

Para ver o isolamento: entre como `rh.beta` e confirme que os registros `Demo`
da Alfa não aparecem.

## Pessoas

| Tela                | Caminho                         | Status              | Objetivo                                                | Perfil    | Origem                    |
| ------------------- | ------------------------------- | ------------------- | ------------------------------------------------------- | --------- | ------------------------- |
| Colaboradores       | `Pessoas › Colaboradores`       | **Funcional**       | Admitir e retificar colaborador                         | `rh.alfa` | T111                      |
| Horário de trabalho | `Pessoas › Horário de trabalho` | **Funcional**       | Vincular tabela de horário por vigência                 | `rh.alfa` | T112                      |
| Histórico funcional | `Pessoas › Histórico funcional` | **Funcional**       | Registrar, efetivar, cancelar e retificar movimentações | `rh.alfa` | T115                      |
| Dados contratuais   | `Pessoas › Dados contratuais`   | **Somente leitura** | Ler o vínculo: alocações, horário e linha do tempo      | `rh.alfa` | T134                      |
| Documentos          | `Pessoas › Documentos`          | **Funcional**       | Metadados e solicitações documentais                    | `rh.alfa` | T133                      |
| Solicitações        | `Pessoas › Solicitações`        | **Funcional**       | Central de Solicitações de Pessoas                      | `rh.alfa` | T139/T140 (PR #131, #132) |
| Benefícios          | `Pessoas › Benefícios`          | Demonstrativa       | —                                                       | —         | T092                      |
| Dependentes         | `Pessoas › Dependentes`         | Demonstrativa       | —                                                       | —         | T093                      |
| Afastamentos        | `Pessoas › Afastamentos`        | Demonstrativa       | —                                                       | —         | T094                      |

**Colaboradores usa o padrão visual B + modais (T142/T144).** O detalhe do
colaborador abre numa janela modal com foco preso, em vez de navegar para uma
página própria; editar o nome e tentar fechar com alteração não salva pede
confirmação explícita dentro da própria janela, antes de descartar. É a
primeira tela nessa direção — as demais telas funcionais desta tabela ainda
não foram migradas, e nenhuma outra migração começou.

### Pessoas › Solicitações — o que olhar

É a fatia mais recente e a que o seed foi desenhado para exercitar.

**Dá para testar:** registrar solicitação de um dos seis tipos aprovados;
filtrar por tipo e situação; paginar; abrir detalhe e histórico cronológico;
executar as transições que o backend permite no estado atual; e ver a
justificativa obrigatória em recusar e reabrir.

**Cenários que o seed prepara de propósito:**

- `Pessoa Demo Alfa Um` tem **um** vínculo — resolve sozinho.
- `Pessoa Demo Alfa Dois` tem **dois** — exige escolha explícita, e enquanto
  nenhum é escolhido a tela não lista nada e explica por quê.
- Sem colaborador escolhido, a lista mostra a visão geral da empresa, rotulada
  como tal.

**Por papel:** `rh.alfa` opera; `master.demo` vê tudo em modo somente leitura,
sem nenhum botão de mutação; `dp.alfa`, `gestor.alfa` e `colaborador.alfa` não
recebem ação alguma.

**Ainda não:** anexo, upload, download, preview e assinatura (bloqueados pelos
portões de conteúdo; a ADR 0013 aprovou o provedor futuro, nunca o upload);
autoatendimento do colaborador (depende de `DP-23`); capacidade de RBAC para o
gestor consultivo (decisão em aberto); efeito automático em qualquer outro
módulo; e cronômetro de SLA — a tela mostra os marcos que o servidor gravou e
não calcula prazo.

## Ponto

| Tela                 | Caminho                        | Status        | Objetivo                                            | Perfil    | Origem    |
| -------------------- | ------------------------------ | ------------- | --------------------------------------------------- | --------- | --------- |
| Visão do período     | `Ponto › Visão do período`     | **Funcional** | Marcações e ajustes aditivos; horário de referência | `rh.alfa` | T113/T114 |
| Verificar folhas     | `Ponto › Verificar folhas`     | Demonstrativa | —                                                   | —         | T064      |
| Banco de Horas       | `Ponto › Banco de Horas`       | Demonstrativa | —                                                   | —         | T069      |
| Ajustes manuais      | `Ponto › Ajustes manuais`      | Demonstrativa | —                                                   | —         | T078      |
| Fechamento e Espelho | `Ponto › Fechamento e Espelho` | Demonstrativa | —                                                   | —         | T080      |
| Escalas e jornadas   | `Ponto › Escalas e jornadas`   | Demonstrativa | —                                                   | —         | T083–T103 |
| Inconsistências      | `Ponto › Inconsistências`      | Demonstrativa | —                                                   | —         | T075      |
| Justificativas       | `Ponto › Justificativas`       | Demonstrativa | —                                                   | —         | T083–T103 |

**Dá para testar** em Visão do período: registrar marcação e ajuste aditivo,
sempre rastreáveis — nada é sobrescrito.
**Ainda não:** fechamento, Espelho, cálculo de Banco de Horas e Folha.

## Documentos

| Tela                   | Caminho                               | Status        | Origem |
| ---------------------- | ------------------------------------- | ------------- | ------ |
| Metadados              | `Documentos › Metadados`              | Demonstrativa | T070   |
| Repositório documental | `Documentos › Repositório documental` | Demonstrativa | T070   |

A parte **funcional** de documentos vive em `Pessoas › Documentos` (T133).
Estas duas continuam visuais. Em nenhuma delas há conteúdo, arquivo, upload ou
download — o portão de conteúdo (ADR 0011) segue fechado.

## Portal do Colaborador

| Tela                | Caminho                                       | Status        | Origem |
| ------------------- | --------------------------------------------- | ------------- | ------ |
| Visão geral         | `Portal do Colaborador › Visão geral`         | Demonstrativa | T067   |
| Minhas solicitações | `Portal do Colaborador › Minhas solicitações` | Demonstrativa | T067   |
| Minha jornada       | `Portal do Colaborador › Minha jornada`       | Demonstrativa | T067   |
| Meus documentos     | `Portal do Colaborador › Meus documentos`     | Demonstrativa | T067   |

**Bloqueada como capacidade.** O portal inteiro depende de `DP-23` — o vínculo
autenticado entre conta de acesso e colaborador, deliberadamente não
materializado. Entrar como `colaborador.alfa` **não** dá autoatendimento: a
conta existe para demonstrar a negação por papel. Nada aqui é ESS.

## Solicitações (Central do RH)

| Tela          | Caminho        | Status        | Origem |
| ------------- | -------------- | ------------- | ------ |
| Central do RH | `Solicitações` | Demonstrativa | T068   |

Superfície anterior, mantida como está. A Central **funcional** é
`Pessoas › Solicitações`. As duas coexistem: esta não foi tocada pela T140.

## Relatórios

Todas as oito telas (`Exceções de Ponto`, `Relatórios disponíveis`, `Extrato de
Banco de Horas`, `Espelho de Ponto`, `Justificativas`, `Quadro de Horários`,
`Calendário de Feriados`, `Listagem de Colaboradores`) são **demonstrativas**
(T075, T083–T103). Nenhuma consulta a API, exporta arquivo ou calcula valor.

## Contas de acesso

| Tela             | Caminho            | Status        | Objetivo                                        | Perfil        | Origem    |
| ---------------- | ------------------ | ------------- | ----------------------------------------------- | ------------- | --------- |
| Contas de acesso | `Contas de acesso` | **Funcional** | Listar contas, criar, alterar papel e desativar | `master.demo` | T120/T121 |

**Dá para testar:** listagem paginada e escopada, criação de conta, alteração
de papel e desativação.
**Ainda não:** MFA — o servidor controla a disponibilidade (`MFA_ENABLED`,
padrão desativado, T131) e o seed não habilita segundo fator para nenhuma conta.

## Decisões em aberto que limitam o que se vê

| Pendência                                           | O que trava                                                 |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `DP-23` — vínculo `AccessUser ↔ Colaborador`        | Todo o Portal do Colaborador e qualquer ESS/MSS             |
| Capacidade de RBAC do gestor consultivo             | Participação do gestor nas Solicitações                     |
| Portões de conteúdo documental (ADR 0011, ADR 0013) | Anexo, upload, download, preview, assinatura e R2           |
| Catálogo de motivos a validar com RH                | Conteúdo da lista de motivos (o mecanismo já está aprovado) |
| Gates operacionais de MFA (`DS-OPS-01`)             | Segundo fator obrigatório                                   |

## Pendência visual aberta

Verificação feita em navegador real contra a `main` integrada, em **1280 px** e
em **375 px**, com o ambiente local semeado.

| Tela                            | Sintoma                                 | Medida                                                                          | Origem |
| ------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| `Pessoas › Histórico funcional` | Rolagem horizontal do documento inteiro | `scrollWidth` 1653 contra 1265 de viewport (**+388 px**); a 375 px, **+938 px** | T115   |

O elemento que estoura é a tabela `evolli-datatable__table` ("Movimentações
funcionais"), cuja borda direita fica em 1775 px. **Não foi corrigida nesta
tarefa** — é defeito preexistente da T115, e corrigi-lo aqui misturaria escopo.

As demais telas verificadas (Horários, Estrutura organizacional, Funções e
cargos, Centros de custo, Colaboradores, Horário de trabalho, Dados
contratuais, Documentos, Solicitações, Ponto › Visão do período e Contas de
acesso) **não** apresentaram estouro em nenhuma das duas larguras. Isto não é
uma afirmação sobre as telas não verificadas.

## O que este ambiente não prova

Que o sistema está pronto para dado real, homologação ou produção. Ele prova
apenas que o que está integrado na `main` sobe, autentica e navega com dados
sintéticos, numa máquina local.
