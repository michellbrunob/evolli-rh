# Referência funcional de mercado — mapa de capacidades para o Evolli

Status: **REFERÊNCIA FUNCIONAL EM CONSOLIDAÇÃO** — não é decisão de produto,
requisito aprovado, declaração de conformidade ou autorização de implementação.

## 1. Objetivo e limites

Este registro preserva o levantamento funcional realizado em outubro de 2026
para orientar a evolução do Evolli como ecossistema brasileiro de RH e DP.

- Descreve capacidades, jornadas, filtros, relatórios, perfis e padrões de UX
  observáveis em material oficial público e em telas às quais o proprietário
  autorizou acesso de leitura.
- Não copia código, texto, imagens, identidade visual, dados, regras internas
  não observáveis ou marca de terceiros.
- Não contém credenciais, tokens, dados pessoais, nomes de colaboradores,
  empresas, imagens privadas ou capturas de tela.
- Uma capacidade observada não se torna requisito do Evolli automaticamente.
  Cada implementação exige priorização própria, contrato técnico, testes,
  revisão de privacidade e, quando aplicável, validação RH + Jurídico.
- Folha, eSocial, SST, ponto eletrônico e benefícios não podem ter suas regras
  legais inferidas de um produto de mercado.

Este documento complementa, sem substituir,
[referências de mercado e diretrizes oficiais](referencias-mercado-diretrizes-oficiais-evolucao-evolli-rh.md),
a [arquitetura](../ARCHITECTURE.md), o [roadmap](../ROADMAP.md) e as ADRs
já aprovadas.

## 2. Princípio para o Evolli

A referência mais valiosa não é uma tela isolada: é uma **base única de
pessoas e estrutura organizacional**. Colaborador, vínculo, empresa, unidade,
equipe, cargo, gestor, jornada e situação funcional alimentam admissão, gestão,
férias, ponto, benefícios, desenvolvimento e relatórios.

O Evolli deve preservar esse princípio com seus contratos próprios, evitando
cadastros paralelos, permissões derivadas de texto livre, indicadores sem origem
auditável e integrações sem escopo, validade, autoria e registro de execução.

## 3. Mapa modular consolidado

| Frente                     | Capacidades de referência mapeadas                                                                              | Direção para o Evolli                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Base de pessoas            | cadastro, documentos, contatos, dependentes, vínculo, cargo, unidade, departamento, gestor, jornada e histórico | consolidar a ficha única e seus vínculos; não duplicar dados em telas de domínio                       |
| Admissão                   | pré-admissão, pendências documentais, estados, responsáveis e conclusão                                         | evoluir a admissão por etapas, com checklist, prazo e trilha de auditoria                              |
| Estrutura e liderança      | unidades, departamentos, equipes, cargos, superior direto e organograma                                         | expandir gradualmente o modelo aprovado de gestor/equipe; preservar os limites da ADR 0015             |
| Gestor                     | lista do time, pendências, calendário, férias, aniversários, tempo de casa, feedback e vagas                    | evoluir `Minha equipe` por blocos consultivos; não liberar mutações sem autorização própria            |
| Colaborador                | dados pessoais, documentos, avisos, onboarding, solicitações, PDI e ponto em portal próprio                     | portal é evolução futura; iniciar apenas após identidade, MFA e privacidade apropriadas                |
| Contratação e desligamento | listas de tarefas configuráveis, motivos e métricas de desligamento                                             | implementar checklists mínimos: item, responsável, prazo, situação e evidência                         |
| Recrutamento               | vagas, etapas, candidatos, banco de talentos, solicitações de vaga e filtros avançados                          | começar por solicitação interna de vaga; ATS completo só após decidir o domínio e a LGPD de candidatos |
| Clima e engajamento        | pesquisas personalizadas, clima, eNPS, demissional, participação e respostas                                    | criar uma primeira frente de clima com escopo e anonimato definidos por RH                             |
| Feedback e desempenho      | feedbacks, competências, ciclos, avaliação, metas, PDI, 9-box e relatórios                                      | sequência recomendada: competências → avaliação → PDI; 9-box é evolução posterior                      |
| Treinamento                | trilhas por cargo, progresso, certificados e relatórios                                                         | iniciar por registro de treinamentos obrigatórios e trilhas; LMS completo é fase futura                |
| Férias e afastamentos      | solicitação, aprovação, períodos, vencimentos, afastamentos e calendário                                        | depende do mapeamento interno de DP e de validação trabalhista antes de regra de cálculo               |
| Jornada e ponto            | marcação, ajustes, inconsistências, banco de horas, fechamento, espelho, relatórios e eventos de folha          | preservar as ADRs e gates já existentes; nenhuma integração real é inferida por este levantamento      |
| Benefícios                 | catálogo, elegibilidade, beneficiários e uso por pessoa                                                         | desenhar cadastro e concessão por política; priorizar os benefícios definidos pelo RH                  |
| SST                        | exames, ASO, afastamentos, riscos e indicadores                                                                 | tratar como dado sensível: minimização, perfis restritos, auditoria e validação LGPD obrigatórias      |
| Folha e eSocial            | competência, eventos, rubricas, retornos, protocolos, erros e obrigações                                        | frente futura separada, com motor próprio e validação fiscal/trabalhista                               |
| Integrações                | importação, exportação, vínculos externos, webhooks e APIs auditáveis                                           | criar camada com contrato, idempotência, escopo, validade, logs e revogação                            |
| Relatórios                 | filtros por período, empresa, unidade, departamento, cargo e pessoa; tabela, detalhe e exportação               | padronizar a convenção sem permitir visões além da autorização                                         |

## 4. Fluxos e padrões preservados

### Pessoa e admissão

1. Registro inicial e dados de contato.
2. Alocação organizacional: unidade, departamento, cargo, equipe e gestor.
3. Dados contratuais e de jornada.
4. Documentos e dependentes.
5. Pendências, conferência e conclusão da admissão.
6. Ativação do acesso e integração/onboarding quando aplicável.

Cada transição do Evolli precisa ser explícita, auditável e protegida por
permissão. Campos exigidos em obrigação legal serão definidos com RH/DP e
Jurídico, não importados de uma referência de mercado.

### Gestão de equipe

1. Gestor consulta somente a composição autorizada de sua equipe.
2. Painel mostra pendências e datas relevantes para ação.
3. Detalhe preserva a projeção mínima autorizada.
4. Jornada resumida, solicitações ou aprovações entram somente após terem
   contrato e regra de autorização próprios.

Essa direção é compatível com a fundação de gestor consultivo já entregue pelo
Evolli e não amplia o escopo para departamento inteiro, empresa inteira,
matricial ou autosserviço sem nova decisão.

### Relatórios e integrações

Padrão de relatório: `filtros autorizados → tabela resumida → detalhe →
exportação controlada`. Filtros e exportações devem obedecer à mesma política
da tela, sem permitir descoberta de pessoas, vínculos ou empresas fora do
escopo do ator.

Para integração, o Evolli deve priorizar contrato de lote e chave idempotente,
ator de serviço distinto de pessoa humana, escopo por empresa/origem, trilha de
auditoria sem conteúdo sensível, reprocessamento seguro e visão de erros.

## 5. UX aproveitável

- navegação por módulos, sem ocultar o estado real de disponibilidade;
- painel por perfil com pendências acionáveis, não apenas gráficos;
- calendário consolidado para eventos relevantes do time;
- busca, filtros, tabela, estado vazio, erro e nova tentativa consistentes;
- atalhos configuráveis por usuário, quando não conflitam com autorização;
- portais separados por papel: RH, gestor, colaborador e candidato;
- modais para tarefas focadas, conforme o padrão B aprovado no Evolli;
- textos claros de acesso negado ou capacidade indisponível.

Não adotar como padrão: identidade visual, textos, ícones, copy, barreiras
comerciais ou aparência de capacidade inexistente de terceiros.

## 6. Sequência recomendada de discussão

1. Consolidar pessoas, estrutura, documentos, admissão e checklists.
2. Entregar clima organizacional e feedback estruturado, após decisão de RH
   sobre anonimato, questionários e tratamento de respostas.
3. Completar férias, afastamentos, jornada, ponto e banco de horas após a
   investigação do DP e as validações legais pendentes.
4. Ampliar o painel do gestor e iniciar o portal do colaborador de modo
   consultivo e seguro.
5. Estruturar recrutamento e solicitação de vaga.
6. Evoluir desempenho, competências, PDI e treinamentos.
7. Planejar benefícios, SST, folha, eSocial e integrações fiscais como frentes
   independentes, com responsáveis e homologações próprios.

## 7. Estado da investigação

### Coberto

- navegação e arquitetura de módulos do ambiente de RH acessível;
- cadastro de pessoas, estrutura, checklists, saúde ocupacional, desempenho,
  engajamento, benefícios, configurações e integrações expostas;
- painel integrado, gestor, colaborador, candidato/vagas e padrões de UX;
- documentação pública de ponto, férias, folha, eSocial, SST, treinamento e
  integrações.

### Pendente de observação direta

O ambiente de DP/Ponto usa autenticação separada. Quando uma sessão de leitura
estiver disponível, ainda devem ser mapeadas as telas de jornada, espelho,
ajustes, banco de horas, fechamento, férias operacionais, GED, admissão
digital, relatórios, folha e eSocial. Até lá, essas frentes permanecem
referência documental, não descrição de tela interna.

## 8. Referências públicas principais

- [Gestão integrada](https://ajuda.solides.com.br/hc/pt-br/articles/48290247569293-Gest%C3%A3o-Integrada-A-experi%C3%AAncia-unificada-que-simplifica-a-sua-rotina)
- [Admissão](https://ajuda.solides.com.br/hc/pt-br/articles/25326695126413-M%C3%B3dulo-de-Admiss%C3%A3o-o-que-%C3%A9-e-como-funciona)
- [Filtros de vagas](https://ajuda.solides.com.br/hc/pt-br/articles/10532580410125-Como-utilizar-os-filtros-de-vagas)
- [Relatório geral de avaliação](https://ajuda.solides.com.br/hc/pt-br/articles/13206169477517--V3-Avalia%C3%A7%C3%A3o-de-Desempenho-relat%C3%B3rio-geral)
- [PDI](https://ajuda.solides.com.br/hc/pt-br/articles/4411730052749-Como-construir-um-PDI-pela-plataforma-da-S%C3%B3lides)
- [Configurações de ponto](https://ajuda.solides.com.br/hc/pt-br/articles/34520511975821-Configura%C3%A7%C3%B5es-gerais-de-ponto-quais-s%C3%A3o-e-como-ajust%C3%A1-las)
- [Integração ponto e folha](https://ajuda.solides.com.br/hc/pt-br/articles/37001623063181-Como-integrar-os-eventos-do-ponto-S%C3%B3lides-na-Folha-Digital-via-arquivo-de-importa%C3%A7%C3%A3o)
- [SuperApp](https://ajuda.solides.com.br/hc/pt-br/articles/33572448494989-SuperApp-como-funciona-o-novo-App-da-S%C3%B3lides)
- [SST](https://ajuda.solides.com.br/hc/pt-br/articles/45075903607821-Gest%C3%A3o-de-Sa%C3%BAde-e-Seguran%C3%A7a-do-Trabalho-SST-da-S%C3%B3lides)
- [Folha Digital e eSocial](https://ajuda.solides.com.br/hc/pt-br/sections/26571084190349-S%C3%B3lides-Folha-Digital)

## 9. Declaração

Este documento registra uma referência funcional para apoiar decisões futuras.
Ele não cria funcionalidade, não altera ADRs, não declara conformidade, não
autoriza uso de dados reais e não permite copiar artefatos proprietários de
terceiros. A prioridade e o desenho de cada item continuam pertencendo ao
Evolli, à diretoria e às áreas responsáveis.
