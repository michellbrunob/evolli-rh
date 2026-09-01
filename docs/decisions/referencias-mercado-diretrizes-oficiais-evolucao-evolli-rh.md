# Referências de mercado e diretrizes oficiais para evolução do Evolli RH

Status: **PESQUISA DOCUMENTAL ESTRATÉGICA** — não é decisão, não é requisito
aprovado e não declara conformidade.

Relacionado (contexto interno, sem alteração): [Prontidão para operação
real](prontidao-operacao-real-evolli-rh.md),
[Contrato de persistência e auditoria futura do Ponto](contrato-persistencia-auditoria-ponto-v1.md),
[Convergência CCT 2026/2027 — Jornada e Ponto](etapa3-cct-2026-2027-convergencia-jornada-ponto.md),
[especificação detalhada de Jornada/Ponto](../modules/etapa3-jornada-ponto-v1-detalhada.md).

## 0. Natureza e limites deste documento

Esta é uma **pesquisa documental** — um panorama de fontes públicas oficiais e
de mercado para **orientar** a evolução futura do Ecossistema Evolli RH.

**O que este documento NÃO faz** (limites inegociáveis):

- **Não implementa nada** — nenhum código, UI, schema, integração,
  funcionalidade, endpoint ou dependência é criado aqui.
- **Não copia** design, texto, fluxo proprietário, código ou marca de
  terceiros — toda observação de mercado é uma **descrição funcional**,
  redigida de forma própria, a partir de material **público**.
- **Não declara conformidade** com a Portaria MTP 671/2021, a LGPD, o
  eSocial, CCT/ACT ou qualquer outra norma. Toda referência a norma é
  **informativa**, nunca uma declaração de aderência do Evolli RH.
- **Não usa dado real** — nenhum login, captura de tela privada, CPF, nome,
  empresa ou arquivo real aparece neste documento; toda referência de mercado
  vem de material **público** (sites institucionais, documentação de produto,
  FAQ públicos).
- **Não transforma referência de mercado em requisito aprovado** — cada linha
  das tabelas abaixo é uma **observação**, sujeita a decisão de produto
  própria, gates de segurança e validação RH + Jurídico antes de qualquer
  implementação.
- **Não altera** nenhuma decisão, ADR, contrato ou gate já registrado neste
  repositório — apenas os referencia, sem modificá-los.
- **Requisito legal ou trabalhista sempre depende de validação RH +
  Jurídico** antes de qualquer implementação — nenhuma linha abaixo substitui
  essa validação.

## 1. Fontes oficiais brasileiras

| Fonte                                                                                             | Padrão/funcionalidade observada                                                                                                                                                                   | Benefício operacional potencial                                                                                                                                               | Fase sugerida   | Dependência/risco                                                                                                                                                                                                                                             | Fonte e data de consulta                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ministério do Trabalho e Emprego (MTE) — Portaria MTP nº 671/2021                                 | Regula REP-C/REP-A/REP-P, o leiaute técnico do AFD (Arquivo Fonte de Dados) e do AEJ (Arquivo Eletrônico de Jornada), com assinatura eletrônica dos arquivos (ICP-Brasil, padrão CAdES)           | Uma futura importação real de marcações teria leiaute técnico já publicado e estável para se basear, reduzindo retrabalho de engenharia reversa                               | Após gates      | Depende de `DP-3J-09` (validade legal), `DP-3J-20` (homologação de fornecedor/leiaute) e do gate-mestre `DS-OPS-01`; **não** declara conformidade                                                                                                             | [Portaria MTP nº 671/2021 (texto compilado, gov.br)](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/legislacao/portarias-1/portarias-vigentes-3/portaria-no-671-de-8-de-novembro-de-2021-compilada-20-10-2023.pdf) — consultado em 01/09/2026                                                                      |
| MTE — Perguntas e Respostas sobre o REP (Portaria 671)                                            | Material oficial de esclarecimento sobre obrigatoriedade, equipamentos homologados e fiscalização do registro eletrônico de ponto                                                                 | Esclarece dúvidas operacionais antes de qualquer decisão de importação real, reduzindo risco de interpretação equivocada                                                      | Após gates      | Conteúdo pode ser atualizado pelo MTE; não substitui parecer jurídico próprio                                                                                                                                                                                 | [Perguntas e Respostas — Portaria n° 671/2021 (gov.br)](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP) — consultado em 01/09/2026                                                                                                   |
| eSocial — Documentação técnica (leiautes, manual de orientação, notas técnicas)                   | Portal oficial com leiautes versionados (S-1.3, com Nota Técnica 6/2026), manual de orientação consolidado e esquemas XSD para os eventos do eSocial                                              | Uma futura integração de eventos de jornada/afastamento com o eSocial teria especificação técnica oficial e versionada como referência                                        | Futuro          | Fora do escopo de Ponto V1; depende de decisão própria de integração com Folha/eSocial, ainda não iniciada                                                                                                                                                    | [Documentação Técnica — eSocial (gov.br)](https://www.gov.br/esocial/pt-br/documentacao-tecnica) — consultado em 01/09/2026                                                                                                                                                                                              |
| ANPD — Guia orientativo sobre segurança da informação para agentes de tratamento de pequeno porte | Guia oficial com medidas administrativas e técnicas de segurança da informação e um checklist de apoio, com foco em minimização e prevenção de incidentes                                         | Referência para o desenho de persistência (minimização, segurança) já registrado no [contrato de persistência](contrato-persistencia-auditoria-ponto-v1.md), sem substituí-lo | Após gates      | Documento orientativo, não é norma cogente isolada; não dispensa avaliação jurídica de base legal e retenção (`DP-3J-11`)                                                                                                                                     | [Guia orientativo sobre segurança da informação para agentes de tratamento de pequeno porte (ANPD, gov.br)](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte) — consultado em 01/09/2026 |
| Ministério Público do Trabalho (MPT) — publicações institucionais (notas técnicas, cartilhas)     | Materiais institucionais de orientação e fiscalização sobre temas trabalhistas (ex.: jornada, trabalho remoto); **tratados aqui apenas como material institucional**, nunca como norma substituta | Sinaliza pontos de atenção que a área Jurídica pode considerar ao validar regras de jornada/ponto, sem criar obrigação nova por si só                                         | Após gates      | Material institucional, não normativo por si só; qualquer leitura deve passar por validação Jurídica antes de virar regra do produto                                                                                                                          | [Publicações — Ministério Público do Trabalho](https://mpt.mp.br/pgt/publicacoes) — consultado em 01/09/2026                                                                                                                                                                                                             |
| CCT/ACT aplicável à empresa/categoria                                                             | Convenção ou Acordo Coletivo de Trabalho vigente, quando aplicável, pode trazer regras específicas de jornada, banco de horas ou compensação                                                      | Nenhum benefício é assumido aqui — a CCT/ACT só é **instrumento a validar**, nunca fonte de regra automática do produto                                                       | Depende de gate | Aplicabilidade e conteúdo variam por empresa/categoria/vigência; **exige validação RH + Jurídico caso a caso**, nunca inferência automática (mesma cautela já registrada em [Convergência CCT 2026/2027](etapa3-cct-2026-2027-convergencia-jornada-ponto.md)) | Instrumento próprio de cada empresa — sem fonte pública única; não pesquisado externamente por esta tarefa                                                                                                                                                                                                               |

## 2. Referências de mercado (materiais públicos)

| Referência                                                 | Padrão/funcionalidade observada                                                                                                                                                     | Benefício operacional potencial                                                                                                                                                                                                                | Fase sugerida     | Dependência/risco                                                                                                                                    | Fonte e data de consulta                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secullum — Banco de Horas (Ponto Web)                      | Extrato de banco de horas agrupável por departamento, opção de não descontar DSR para faltas cobertas pelo banco, e limites configuráveis de saldo máximo/mínimo                    | Ideia para uma futura política de saldo (`BH-01`..`BH-03`): parametrizar limites de saldo e a interação com desconto de DSR, sem copiar a implementação                                                                                        | Após gates        | Depende de decisão de produto própria sobre política de saldo/DSR (`BH-01`..`BH-03`, `DP-3J-21`); descrição funcional, não há acesso ao código-fonte | [Perguntas Frequentes — Banco de Horas, Secullum Ponto Web](https://www.secullum.com.br/pt/perguntas-frequentes/930) — consultado em 01/09/2026                                                                                                 |
| Secullum — Escalas mensais                                 | Parâmetros de escala como tolerância de extras/faltas, almoço livre, "compensado" e "neutro" configuráveis por escala                                                               | Ideia para parametrização futura de escalas no Evolli, além do padrão atual (jornada fixa por faixas) — **sem** decidir se/quando essa ampliação ocorre                                                                                        | Futuro            | Ampliação de escopo além da Baseline V1 (DP-3J-01, modelo de jornada/escala ainda pendente quanto ao modelo final); exige decisão de produto própria | [Perguntas Frequentes — Escalas Mensais, Secullum Ponto Web](https://www.secullum.com.br/pt/perguntas-frequentes/952) — consultado em 01/09/2026                                                                                                |
| Secullum — Central do Funcionário (app de autoatendimento) | Restrição de acesso a dados de período já encerrado e restrição de plataforma (app/web) para inclusão de ponto, no aplicativo do colaborador                                        | Ideia de salvaguarda para um futuro autosserviço do colaborador: impedir edição/visualização de período fechado — coerente com o princípio de imutabilidade já adotado nos núcleos de Ponto                                                    | Futuro            | Autosserviço do colaborador não existe hoje no Evolli; depende de gates de identidade/MFA e de decisão de produto própria                            | [Atualizações recentes — Secullum Ponto Web](https://secullum.com.br/en/canal-cliente/perguntas/1082) — consultado em 01/09/2026                                                                                                                |
| TOTVS RH (Meu RH / linha Ahgora-Protheus)                  | Autosserviço do colaborador via app para solicitar férias, abono de ponto e atestado médico, com registro de ponto por geolocalização                                               | Ideia para desenhar um futuro autosserviço do colaborador com solicitações estruturadas (não texto livre), mantendo o princípio já adotado de catálogos fechados e auditáveis                                                                  | Futuro            | Fora do escopo atual (Ponto V1 não tem app de colaborador); geolocalização/biometria seguem fora de escopo por decisão já registrada                 | [TOTVS Meu RH](https://www.totvs.com/rh/meu-rh/) e [Tudo sobre o TOTVS RH Ponto Eletrônico — linha Ahgora](https://produtos.totvs.com/ficha-tecnica/tudo-sobre-o-totvs-rh-ponto-eletronico-linha-ahgora/) — consultados em 01/09/2026           |
| TOTVS RH — Banco de Horas (RM)                             | Banco de horas com forma de armazenamento e período de disponibilidade definidos por legislação/CCT/ACT, e visão individual de horas positivas/negativas por colaborador            | Reforça a necessidade já registrada de validar prazo de validade de créditos por CCT/ACT (`BH-01`) antes de qualquer implementação de política de expiração                                                                                    | Depende de gate   | `BH-01` (validade/expiração de créditos) segue pendente; qualquer prazo precisa de validação RH + Jurídico, nunca inferido de um concorrente         | [RH - RM - PTO - Banco de Horas: Conceito e tipos de banco (Central de Atendimento TOTVS)](https://centraldeatendimento.totvs.com/hc/pt-br/articles/360045694133-RH-RM-PTO-Banco-de-Horas-Conceito-e-tipos-de-banco) — consultado em 01/09/2026 |
| Senior Sistemas — Gestão do Ponto (HCM)                    | Interfaces distintas para colaborador e gestor, totalizadores de horas, conferência em lote e uma visão de banco de horas com saldo inicial/positivo/negativo/final por competência | O conceito de "saldo inicial/final por competência" reforça o desenho já adotado no [contrato de persistência](contrato-persistencia-auditoria-ponto-v1.md#43-movimento-de-banco-de-horas) (saldo sempre **derivado**, nunca um campo mutável) | Base já existente | Nenhuma — o princípio de saldo derivado já está registrado; esta observação só reforça a direção já tomada                                           | [Gestão do Ponto — Documentação Senior](https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/gestao-ponto/produto.htm) — consultado em 01/09/2026                                                                                    |
| Senior Sistemas — Notificações de marcação                 | Horários configuráveis para lembrar o colaborador de registrar o ponto                                                                                                              | Ideia de melhoria futura de UX para um eventual app de colaborador — não prioritária para Ponto V1                                                                                                                                             | Futuro            | Depende da existência de um canal de notificação e de um app de colaborador, nenhum dos dois existente hoje                                          | [Gestão de Pessoas — HCM, Senior X](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/hcm/gestao-do-ponto-x/ponto-x/) — consultado em 01/09/2026                                                                             |
| Sólides (ex-Tangerino) — Relatórios de ponto               | Conjunto amplo de relatórios prontos (banco de horas, horas extras, faltas, atrasos, absenteísmo) gerados a partir dos dados de ponto                                               | Ideia para uma futura frente de relatórios/indicadores do Evolli, construída sobre os núcleos já validados (apuração, extrato) sem duplicar cálculo                                                                                            | Futuro            | Frente de relatórios ainda não iniciada no Evolli; depende da camada de persistência real (fora de escopo hoje)                                      | [Sólides Controle de Ponto: o melhor software de ponto (blog Sólides)](https://solides.com.br/blog/solides-controle-de-ponto/) — consultado em 01/09/2026                                                                                       |
| Sólides — Configuração de banco de horas e escalas         | Mais de dez opções de configuração de banco de horas e escalas fixas/flexíveis, com integração direta à folha de pagamento                                                          | Reforça, por comparação, que integração de banco de horas com Folha é uma frente de mercado madura — mas o Evolli mantém isso deliberadamente **bloqueado** (`BH-06`, `BH-QUIT`) até decisão própria                                           | Depende de gate   | `BH-06`/`BH-QUIT` (integração com a Folha) seguem bloqueados por decisão; nenhuma integração é sugerida por esta observação                          | [Controle de Ponto Sólides](https://solides.com.br/controle-de-ponto-digital/) — consultado em 01/09/2026                                                                                                                                       |

## 3. Mapa de oportunidades por frente (sem decidir implementação)

Cada item abaixo é uma **oportunidade observada**, não uma decisão. A coluna
"Referências" aponta para as linhas das tabelas §1/§2 que motivaram a
observação.

| Frente                                                           | Oportunidade observada (não decidida)                                                                                                                                                                                                                                                                          | Referências                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Cadastros e estrutura organizacional                             | Nenhuma oportunidade nova identificada nesta pesquisa — a base de empresas/colaboradores/vínculos já é própria do Evolli (ADR 0006/0007) e não depende de padrão de mercado                                                                                                                                    | —                                                                                           |
| Jornada, escalas, feriados e vigências                           | Parametrização mais rica de escala (tolerância, almoço livre, "compensado"/"neutro") é um padrão comum de mercado — hoje fora da Baseline V1, que trata jornada por faixas fixas                                                                                                                               | Secullum — Escalas mensais                                                                  |
| Ponto, exceções e fila de revisão                                | Salvaguarda de "período encerrado não editável" em autosserviço já ecoa o princípio de imutabilidade já adotado na fila "Verificar folhas" (T059)                                                                                                                                                              | Secullum — Central do Funcionário                                                           |
| Banco de Horas, compensação e Folha                              | Limites configuráveis de saldo e regra de desconto de DSR ligado ao banco são práticas de mercado a considerar **somente após** `BH-01`..`BH-03`/`DP-3J-21` serem decididos; integração com Folha permanece deliberadamente bloqueada                                                                          | Secullum — Banco de Horas; TOTVS — Banco de Horas; Sólides — configuração de banco de horas |
| Autosserviço do colaborador                                      | Solicitações estruturadas (férias, abono, atestado) por app é um padrão maduro de mercado — inexistente hoje no Evolli e dependente de gates de identidade/MFA antes de qualquer decisão                                                                                                                       | TOTVS — Meu RH; Senior — notificações                                                       |
| Documentos e assinatura                                          | Nenhuma oportunidade nova de mercado pesquisada nesta tarefa — o tema já está sob governança própria (ADR 0011, Documentos Nível 2) e a assinatura eletrônica já é registrada como "futura e condicionada" no [contrato de persistência](contrato-persistencia-auditoria-ponto-v1.md#5-preservações-expressas) | —                                                                                           |
| Relatórios e indicadores                                         | Conjunto amplo de relatórios prontos (banco de horas, horas extras, absenteísmo) é uma frente comum de mercado — ainda não iniciada no Evolli e dependente de persistência real                                                                                                                                | Sólides — relatórios de ponto                                                               |
| Auditoria, segurança, MFA, privacidade e segregação multiempresa | O guia da ANPD reforça (sem substituir decisão própria) os princípios de minimização e segurança já registrados no contrato de persistência; nenhuma prática de mercado pesquisada aqui é específica de MFA/segregação multiempresa                                                                            | ANPD — guia de segurança da informação                                                      |
| Integrações futuras (relógio, Folha, eSocial)                    | O leiaute técnico oficial do AFD/AEJ (Portaria 671) e a documentação técnica do eSocial são referências estáveis para uma eventual integração real — nenhuma integração é sugerida ou priorizada por esta pesquisa                                                                                             | MTE — Portaria 671; eSocial — documentação técnica                                          |

## 4. Preservações expressas

Esta pesquisa **não decide** nada e preserva expressamente:

- Nenhum design, texto, fluxo proprietário, código ou marca de terceiro foi
  copiado — toda observação é uma descrição funcional própria, a partir de
  material público.
- Nenhuma declaração de conformidade com a Portaria MTP 671/2021, a LGPD, o
  eSocial, CCT/ACT ou qualquer outra norma foi feita.
- Nenhum dado real, login, captura de tela privada, CPF, nome, empresa ou
  arquivo real foi usado.
- Nenhuma referência de mercado observada aqui vira requisito aprovado do
  Evolli por si só — cada uma depende de decisão de produto própria.
- Nenhuma decisão ou gate já registrado (MFA, `DS-OPS-01`, `DP-3J-*`,
  `BH-*`) foi alterado — esta pesquisa só os referencia.
- Todo requisito de origem legal/trabalhista identificado aqui **exige
  validação RH + Jurídico** antes de qualquer implementação — nunca decisão
  por inferência a partir de um concorrente ou de uma norma lida
  isoladamente.

## 5. Matriz de priorização (sem pontuação)

Classificação qualitativa — **não** é um cronograma, prazo ou compromisso de
entrega.

### Já coberto sinteticamente

- Saldo do Banco de Horas sempre **derivado** dos movimentos (alinhado à
  prática de "saldo inicial/final por competência" observada na Senior) —
  já implementado nos núcleos puros (T052) e registrado no [contrato de
  persistência](contrato-persistencia-auditoria-ponto-v1.md).
- Imutabilidade de itens já revisados/fechados (alinhado à salvaguarda de
  "período encerrado" observada na Secullum) — já é princípio da fila
  "Verificar folhas" (T059) e do fechamento (T057).

### Próxima pesquisa/decisão

- Modelo de escala mais rico (tolerância, almoço livre, "compensado"/"neutro")
  — depende de decisão de produto sobre `DP-3J-01` (modelo de jornada/escala).
- Política de limites de saldo do Banco de Horas e sua relação com desconto
  de DSR — depende de decisão sobre `BH-01`..`BH-03` e `DP-3J-21`.

### Depende de gate

- Qualquer importação real de marcações via AFD/AEJ — depende de `DP-3J-09`,
  `DP-3J-20` e `DS-OPS-01`.
- Qualquer integração de Banco de Horas com a Folha — depende de `BH-06`,
  `BH-QUIT` e autorização própria da diretoria.
- Qualquer autosserviço do colaborador — depende de MFA e de decisão de
  produto própria sobre identidade do colaborador.

### Evolução futura

- Relatórios e indicadores construídos sobre os núcleos já validados.
- Integração técnica com o eSocial (fora do escopo de Ponto V1).
- Notificações de marcação para um eventual app de colaborador.

## 6. Declaração

Esta é uma **pesquisa documental estratégica**, não uma decisão nem uma
autorização. Nenhum código, UI, schema, integração ou funcionalidade foi
criado; nenhum design, texto, fluxo, código ou marca de terceiro foi copiado;
nenhum dado real foi usado; e **não** se declara conformidade com a Portaria
MTP 671/2021, a LGPD, o eSocial, CCT/ACT ou qualquer outra norma. Toda
oportunidade aqui listada depende de decisão de produto própria, dos gates já
registrados e, quando de origem legal/trabalhista, de validação formal por
RH + Jurídico antes de qualquer implementação.
