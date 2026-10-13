# T155 — Mapa funcional de Gestão de Talentos: referência de mercado

Status: **referência interna observada; não é requisito aprovado nem autorização de implementação**.

Data da observação: 2026-10-09. A navegação foi somente leitura, sem criar,
editar, exportar, baixar ou enviar registros no sistema de referência.

## 1. Limites de uso

- Este mapa descreve capacidades e padrões funcionais vistos em uma solução de
  mercado, em linguagem própria. Não reproduz código, identidade visual,
  textos, ativos, regras ocultas ou dados daquela solução.
- Uma tela, campo ou fluxo observado **não** se torna requisito do Evolli por
  si só. Cada item depende de decisão de Produto, RH, Jurídico/DPO e Segurança
  quando aplicável.
- Saúde, CID, afastamentos, diversidade, dados de dependentes e métricas de
  uso são dados pessoais potencialmente sensíveis ou de alto impacto. Não
  devem ser implementados sem finalidade, acesso, retenção e auditoria
  aprovados.
- Este documento não declara aderência à CLT, LGPD, eSocial, normas de saúde
  ocupacional ou qualquer outra obrigação.

## 2. Organização observada

O agrupamento de talentos reúne cadastro funcional, estrutura organizacional,
eventos de pessoas, comunicação de feedback, catálogos e indicadores. A
separação é útil como referência para a arquitetura de informação do Evolli:

1. **Pessoas e estrutura:** Colaboradores, Departamentos e Unidades.
2. **Ciclo de vida:** Férias, Motivos de desligamento e Checklists de
   contratação/desligamento.
3. **Acompanhamento:** Registros internos, Feedbacks e Aniversariantes.
4. **Indicadores:** Métricas do colaborador.
5. **Domínio restrito:** Saúde e segurança, isolado do cadastro comum.

## 3. Inventário por capacidade

### 3.1 Colaboradores

**Observado:** uma lista de pessoas ativas/inativas, busca e ações de inclusão,
convite/preenchimento, comunicação, envio de avaliações e exportação. A grade
expõe identidade funcional, cargo, departamento, admissão, banco de horas e
ações por linha. O cadastro reúne dados pessoais, contato/endereço, vínculo,
alocação organizacional, contratação, documentos, dependentes e campos
complementares.

**Regra/padrão observável:** o cadastro é a fonte transversal para estrutura,
indicadores e processos de pessoas; campos de admissão e alocação são
pré-requisitos de vários recursos posteriores.

**Evolli:** a base de colaborador, vínculo, alocação e histórico funcional já
existe. Antes de ampliar o formulário, RH deve aprovar o dicionário de dados,
obrigatoriedade por tipo de vínculo, origem/retificação e retenção de cada
campo. Não copiar uma lista extensa de documentos apenas por existir em outra
plataforma.

### 3.2 Departamentos

**Tela de lista observada:** criar, exportar, buscar e ordenar por nome;
colunas de nome, localização e telefone.

**Formulário observado:** nome obrigatório; descrição; responsáveis;
orçamento mensal; localização; telefone; fax; ramal e e-mail.

**Evolli:** departamento deve ser uma entidade organizacional própria, mas
campos de contato/orçamento precisam de dono de negócio e finalidade clara.
Orçamento não deve nascer no domínio de RH sem alinhamento com Financeiro.
Responsáveis não devem ser confundidos com a relação de gestor/subordinado já
governada pela ADR 0015.

### 3.3 Unidades

**Tela de lista observada:** criar, exportar, buscar e ordenar por nome.

**Formulário observado:** nome obrigatório.

**Evolli:** unidade é um catálogo organizacional simples e candidato a
evolução independente. RH deve definir se unidade é filial, estabelecimento,
local físico, centro operacional ou mais de uma dessas coisas; isso muda a
relação com empresa, departamento, lotação e futuros relatórios.

### 3.4 Férias

**Observado neste ambiente:** o item direciona para uma oferta especializada
de férias, com promessa de consulta individual de prazo-limite; não havia
cadastro de férias operacional disponível nesta navegação.

**Evolli:** referência de capacidade, não de fluxo. A implementação futura
precisa de decisão formal de RH/Jurídico sobre período aquisitivo e concessivo,
fracionamento, abono, bloqueios, aprovações, afastamentos, integração com ponto
e folha. Não iniciar a partir do marketing ou de telas de terceiros.

### 3.5 Registros internos de pessoas

**Tela de lista observada:** criar, exportar, busca e análise; colunas para
data do evento, empresa, colaborador, tipo, classificação, autor e data de
criação. Há ordenação por coluna.

**Formulário observado:** colaborador obrigatório; tipo de registro
obrigatório; data obrigatória; classificação positiva, negativa ou neutra;
valor/quantidade/horas; comentário com editor rico.

**Tela analítica observada:** filtro e estado vazio quando não há registros.

**Regra/padrão observável:** este fluxo é separado do feedback porque comporta
anotações internas. Tipo e classificação permitem organizar ocorrências sem
usar apenas texto livre.

**Evolli:** pode virar um futuro diário funcional/auditoria de pessoas, mas
precisa de catálogo de tipos, política de visibilidade, imutabilidade ou
retificação, matriz de leitura e conteúdo proibido. Comentário rico e valores
numéricos só devem existir se RH justificar os usos.

### 3.6 Feedbacks

**Tela de lista observada:** criar, exportar e análise, com estado vazio.

**Formulário observado:** colaborador obrigatório; data obrigatória;
classificação positiva, neutra ou de melhoria; comentário obrigatório;
envio explícito.

**Regra diretamente informada na tela:** o feedback é encaminhado ao
colaborador por canais da plataforma; anotações confidenciais pertencem ao
fluxo de registros internos.

**Evolli:** é uma fronteira de produto relevante. Antes de criar feedback,
Produto/RH devem decidir destinatário, visibilidade ao gestor, edição após
envio, reconhecimento, confidencialidade, moderação, notificação e retenção.
Não reutilizar o mesmo modelo de dados de registro interno sem separar as
permissões e a exposição ao colaborador.

### 3.7 Checklists de contratação e desligamento

**Tela de lista observada:** dois grupos distintos, contratação e demissão,
com descrição e ações por tópico.

**Formulário observado:** descrição obrigatória e tipo obrigatório.

**Padrão observável:** existem modelos/tópicos separados por evento do ciclo
de vida.

**Evolli:** esta é a investigação corrente da T155. O recorte proposto, as
perguntas ao RH e o critério para iniciar código estão em
[T155 — Checklists de contratação e desligamento](t155-checklists-contratacao-desligamento-pendencias.md).
O checklist não pode bloquear admissão ou desligamento automaticamente sem
decisão explícita.

### 3.8 Aniversariantes

**Tela observada:** lista mensal baseada no mês escolhido, com estado vazio
quando não há pessoas elegíveis.

**Evolli:** é um recurso de conveniência e cultura, posterior aos dados
confiáveis de nascimento. RH/DPO deve decidir se a visualização mostra somente
dia/mês, quem pode vê-la e como tratar pessoas que não queiram divulgação.

### 3.9 Saúde e segurança

**Tela de lista observada:** criar, exportar, busca e grade por colaborador,
tipo de exame/procedimento, código de classificação clínica, data,
quantidade de dias de afastamento e ações.

**Formulário observado:** colaborador; data; tipo de exame/procedimento;
descrição; profissional de saúde e registro profissional; código clínico;
avaliação; indicadores de finalização e aptidão; próximo exame e dias de
afastamento.

**Evolli:** não é extensão do cadastro de pessoas. Qualquer implementação
exige avaliação prévia de LGPD e Segurança, finalidade específica, princípio
de minimização, perfis segregados, auditoria de acesso, retenção, exportação
controlada e análise de integração com medicina ocupacional. Não registrar CID,
avaliação clínica ou aptidão nesta etapa.

### 3.10 Catálogo de motivos de desligamento

**Tela de lista observada:** criar, exportar, busca e ordenação por nome.

**Formulário observado:** nome obrigatório.

**Evolli:** catálogo simples é uma dependência candidata do processo de
desligamento, porém o RH precisa definir códigos, vigência, inativação,
hierarquia, uso obrigatório/opcional, mapeamento legal futuro e permissão de
alteração. O catálogo não deve substituir a motivação jurídica do desligamento.

### 3.11 Métricas do colaborador

**Tela observada:** visão geral e visão de organização/estrutura; filtros por
unidade, departamento, cargo e superior direto; limpar filtros; exportação de
relatório. A visão reúne produtividade, total de ativos, idade média,
distribuições demográficas, PCD, dependentes, faixa etária, tempo de empresa,
escolaridade, experiência, tipo de contrato e uma tabela de acessos ao app.

**Regra/fórmula explicitada na tela:** produtividade apresentada como
faturamento bruto dividido pela quantidade de pessoas ativas. A tela também
ressalta que a qualidade das métricas depende de cadastro atualizado.

**Evolli:** tratar cada indicador como contrato próprio: fonte de dados,
fórmula, período, filtros, atualização, vazio, acesso e exportação. Métricas
de diversidade, saúde, dependentes e uso de aplicativo demandam revisão de
privacidade e de finalidade. A métrica de produtividade depende de fonte
financeira que não pertence ao núcleo RH atual.

## 4. Regras transversais que fazem sentido avaliar no Evolli

Estas são hipóteses de produto, não decisões:

1. separar dados organizacionais, eventos internos, comunicação ao colaborador
   e dados sensíveis em domínios e permissões distintos;
2. usar catálogos administráveis para tipos de evento, motivo de desligamento
   e modelos de checklist, preservando vigência e histórico;
3. dar estados vazios, busca, filtros, ordenação e exportação somente quando a
   operação e a proteção de dados justificarem a funcionalidade;
4. não usar indicadores sem contrato de cálculo e origem dos dados;
5. registrar ator, momento, empresa e justificativa em operações que alteram
   histórico funcional;
6. tornar visível ao usuário a diferença entre informação interna e conteúdo
   que será compartilhado com o colaborador.

## 5. Prioridade sugerida, sem iniciar implementação

| Frente                                 | Estado no Evolli                 | Próxima dependência                                |
| -------------------------------------- | -------------------------------- | -------------------------------------------------- |
| Checklists de contratação/desligamento | investigação T155 em curso       | respostas de RH às 12 perguntas                    |
| Motivos de desligamento                | candidato simples                | catálogo e semântica aprovados por RH/DP           |
| Departamentos e unidades               | estrutura parcialmente existente | definição corporativa e relação com alocações      |
| Registros internos                     | não iniciado                     | política de tipo, conteúdo e visibilidade          |
| Feedbacks                              | não iniciado                     | decisão de exposição, notificação e auditoria      |
| Métricas                               | futuro                           | contratos de indicadores e privacidade             |
| Férias                                 | futuro regulamentado             | decisão RH/Jurídico própria                        |
| Saúde e segurança                      | futuro sensível                  | parecer Jurídico/DPO/Segurança e desenho segregado |

## 6. Próxima decisão necessária

O próximo passo útil não é replicar telas: é reunir RH/DP para responder as
perguntas da T155 e, em seguida, priorizar **um** módulo independente. A
recomendação inicial é começar por catálogo de motivos de desligamento ou por
checklists, conforme a urgência operacional apontada pelo RH.
