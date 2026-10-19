# T173 — Respostas de RH/DP sobre admissão, vínculo e desligamento

Status: **registro literal da fonte primária da T173**.
Data de entrega: 2026-10-19, pelo proprietário, na conversa da tarefa.
Uso: a [ADR 0017](../adr/0017-fluxo-admissao-vinculo-desligamento-rh-dp.md) e o
[diagnóstico de reconciliação](t173-reconciliacao-fluxo-rh-dp.md) citam cada
resposta como **R1** a **R40**, pelo número da pergunta.

Este arquivo transcreve as respostas **sem edição de conteúdo**: o texto é
literal e semanticamente idêntico ao entregue. Há apenas normalizações
editoriais, todas declaradas aqui: quebra de linha, negrito nas perguntas, o
prefixo "R" no número de cada pergunta, títulos de seção em Markdown e `-` no
lugar de `*` nos marcadores da R23. Não é uma cópia byte a byte do original.

Este registro não é decisão de produto, não é interpretação jurídica e não
autoriza implementação: o que cada resposta muda, confirma ou deixa em aberto no
modelo atual está no diagnóstico.

## 1. Cadastro do colaborador

**R1. Quais dados devem ser obrigatórios no cadastro inicial?**
Nome completo, CPF, data de nascimento, telefone ou e-mail para contato e tipo
de vínculo pretendido. Para a abertura de um vínculo, também devem ser
identificados a empresa contratante e o cargo pretendido.
Os demais dados devem ser solicitados conforme a etapa do processo, evitando
exigir todas as informações antes de a contratação ser aprovada.

**R2. Quais dados podem ser preenchidos posteriormente?**
Endereço completo, dados bancários, dependentes, contato de emergência,
documentos complementares, informações sindicais e demais dados necessários à
admissão. Essas informações deverão estar completas antes da efetivação do
vínculo, conforme as exigências aplicáveis a cada contratação.

**R3. Quais tipos de contratação devem ser contemplados?**
O sistema deve permitir, inicialmente, CLT, estagiário, aprendiz, temporário,
autônomo, sócio e prestador de serviços, conforme os vínculos efetivamente
utilizados pelas empresas.
Os campos e documentos obrigatórios deverão variar de acordo com o tipo de
contratação.

**R4. Um colaborador poderá possuir mais de um vínculo ativo?**
Sim. O sistema deve permitir que uma mesma pessoa esteja vinculada a mais de uma
empresa do grupo ou possua mais de um vínculo, quando aplicável.
O cadastro pessoal deverá ser único, enquanto cada vínculo terá suas próprias
informações contratuais, empresa, cargo, remuneração, jornada, gestor e
situação.

**R5. Quais informações organizacionais devem ser obrigatórias?**
Empresa contratante, cargo, departamento, gestor responsável, local de trabalho
e tipo de vínculo. Unidade, equipe, centro de custo, jornada e horário deverão
ser preenchidos quando aplicáveis.
O sistema deve permitir que a estrutura organizacional seja configurada por
empresa, evitando obrigatoriedade de campos que não façam sentido para todas as
estruturas.

**R6. Quais dados bancários, sindicais e de dependentes precisam ser
registrados?**
Dados bancários necessários ao pagamento, informações sindicais aplicáveis,
dependentes e seus dados exigidos para fins trabalhistas, previdenciários ou
fiscais.
O sistema deverá restringir o acesso a essas informações conforme a necessidade
de cada função. A obrigatoriedade e os campos específicos devem seguir os
requisitos do DP e do sistema de folha.

## 2. Processo de admissão

**R7. Quem pode iniciar uma admissão?**
O gestor responsável poderá solicitar a contratação. O RH deverá receber a
solicitação, conferir as informações e conduzir o fluxo de admissão.

**R8. Quais aprovações são necessárias antes da contratação?**
Como fluxo inicial, aprovação do gestor solicitante, validação do RH e aprovação
da diretoria quando exigida pelas regras internas, orçamento ou nível da vaga.
A necessidade de aprovação financeira deverá ser definida conforme a estrutura
de alçadas da empresa.

**R9. Qual é a sequência correta das etapas?**
Solicitação da vaga → aprovação da contratação → cadastro prévio do candidato →
envio e recebimento de documentos → conferência pelo RH/DP → realização dos
procedimentos admissionais aplicáveis → validação final → efetivação do vínculo.
O sistema deverá permitir devolução para correção e acompanhamento do status em
cada etapa.

**R10. Em qual momento a matrícula deve ser gerada?**
A matrícula deverá ser gerada na etapa de efetivação do vínculo, conforme a
regra do sistema de folha. Caso seja necessário gerar um identificador
provisório antes disso, ele não deverá ser confundido com a matrícula
definitiva.

**R11. Em qual etapa o colaborador deve passar de “previsto” para “ativo”?**
Após a conclusão das validações admissionais e a confirmação da admissão pelo
RH/DP, respeitando a data de início do vínculo.
O sistema deverá diferenciar admissão prevista, admissão em andamento, admissão
efetivada e vínculo ativo, para que uma pessoa ainda em processo não seja
tratada como colaboradora ativa antes do momento correto.

**R12. Uma admissão poderá ser devolvida para correção ou cancelada?**
Sim. O RH poderá devolver o processo para correção, registrando o motivo. O
cancelamento deverá ser permitido aos usuários autorizados, com justificativa e
histórico da ação.
Após a efetivação, eventuais correções deverão seguir um fluxo específico, com
registro do responsável e da alteração realizada.

**R13. Quais documentos devem ser solicitados em cada tipo de contratação?**
O sistema deverá permitir checklists configuráveis por tipo de vínculo,
contemplando os documentos pessoais, contratuais, cadastrais e admissionais
exigidos para cada caso.
Para CLT, por exemplo, deverão ser considerados os documentos necessários ao
registro trabalhista, os dados exigidos para o eSocial e os procedimentos de
saúde ocupacional aplicáveis. Estagiários, aprendizes e prestadores deverão
possuir checklists próprios, conforme suas exigências.

**R14. O checklist de admissão varia conforme cargo, empresa ou tipo de
vínculo?**
Sim. O checklist deverá ser configurável por empresa e tipo de vínculo,
permitindo exigências adicionais por cargo ou função quando necessárias.

**R15. Quais pessoas devem ser notificadas durante a admissão?**
O solicitante ou gestor responsável e o RH/DP deverão receber notificações sobre
aprovação, devolução, cancelamento e efetivação. Outras áreas, como TI,
financeiro e responsável pelos acessos, deverão ser notificadas quando houver
necessidade operacional.
As notificações deverão respeitar as permissões de acesso e apresentar somente
as informações necessárias para cada destinatário.

## 3. Alterações durante o vínculo

**R16. Quais alterações precisam ser registradas no sistema?**
Mudanças de cargo, salário, departamento, equipe, gestor, jornada, horário,
unidade, centro de custo, local de trabalho, empresa contratante e demais
informações contratuais ou cadastrais relevantes.
O sistema deverá diferenciar alterações cadastrais simples de movimentações que
exijam aprovação ou atualização na folha e nos registros oficiais.

**R17. Quais alterações exigem aprovação prévia e quem aprova?**
Alterações de cargo, salário, jornada, gestor, empresa contratante e outras que
impactem a estrutura organizacional ou o contrato deverão seguir fluxo de
aprovação.
Como proposta inicial, o gestor responsável solicita, o RH analisa e a
diretoria aprova quando necessário, conforme as alçadas definidas pela empresa.
Correções cadastrais simples poderão ter um fluxo simplificado, com registro da
alteração.

**R18. As alterações devem possuir uma data futura de vigência?**
Sim. O sistema deverá permitir informar a data de vigência da alteração,
inclusive para mudanças aprovadas previamente e programadas para o futuro.
A alteração não deverá modificar os dados vigentes antes da data definida. O
histórico deverá registrar a data da solicitação, aprovação e início da
vigência.

**R19. Será permitido corrigir uma informação retroativamente?**
Sim, em situações justificadas e por usuários autorizados. A correção deverá
exigir motivo, identificação do responsável e registro dos valores anteriores e
posteriores.
Quando houver impacto em folha, obrigações legais ou informações já
transmitidas ao eSocial, deverá ser prevista uma etapa de análise pelo DP antes
da conclusão.

**R20. Quais informações devem permanecer no histórico e nunca ser apagadas?**
Histórico de vínculos, cargos, remunerações, jornadas, gestores,
departamentos, empresas, datas de vigência, aprovações, documentos contratuais
relevantes e alterações cadastrais que afetem os registros oficiais.
Também deverão ser mantidos os registros de cancelamentos, devoluções,
correções, usuários responsáveis e datas das ações. A exclusão de registros não
deverá ser utilizada para ocultar alterações; eventuais correções deverão
preservar a rastreabilidade.
A retenção e a eliminação definitiva deverão seguir a legislação aplicável e a
política de guarda documental da empresa.

## 4. Processo de desligamento

**R21. Quem pode solicitar um desligamento?**
O gestor responsável poderá solicitar o desligamento, mediante justificativa. O
RH também poderá iniciar o fluxo quando houver uma solicitação formal da
diretoria ou outra situação autorizada.
O sistema deverá registrar quem solicitou e quem é responsável pela aprovação.

**R22. Quem deve aprovar e quem deve efetivar o desligamento?**
A aprovação deverá seguir as alçadas definidas pela empresa, envolvendo a
diretoria quando aplicável. O RH/DP será responsável por conduzir o processo,
verificar as informações e efetivar o registro após as aprovações necessárias.
A solicitação, a aprovação e a efetivação deverão ser etapas distintas.

**R23. Quais motivos de desligamento devem estar disponíveis?**
O sistema deverá possuir uma lista configurável, contemplando, conforme
aplicável:

- Pedido de demissão;
- Dispensa sem justa causa;
- Dispensa por justa causa;
- Término de contrato por prazo determinado ou de experiência;
- Rescisão por acordo entre as partes;
- Rescisão antecipada de contrato por prazo determinado;
- Aposentadoria, quando houver encerramento do vínculo;
- Falecimento;
- Outros motivos legalmente aplicáveis.

A classificação definitiva deverá ser validada pelo DP, para garantir
compatibilidade com os códigos e regras utilizados na folha e no eSocial.

**R24. Quais informações precisam ser registradas?**
Data da solicitação, solicitante, aprovadores, motivo, justificativa, data de
comunicação, último dia trabalhado, data de desligamento, tipo de aviso-prévio,
cumprimento ou indenização do aviso, informações necessárias ao cálculo
rescisório e observações pertinentes.
Os dados deverão ser registrados conforme o tipo de desligamento, sem exigir
campos que não se aplicam a todos os cenários.

**R25. Qual deve ser a sequência das etapas?**
Solicitação de desligamento → análise e aprovação → conferência do RH/DP →
definição das datas e condições do desligamento → checklist de devoluções e
encerramentos → cálculo e conferência rescisória → efetivação do desligamento →
conclusão das obrigações e arquivamento dos registros.
O sistema deverá permitir o acompanhamento de cada etapa e a identificação de
pendências.

**R26. Quais pendências devem impedir a conclusão do desligamento?**
Pendências que impeçam legalmente ou operacionalmente a conclusão de
determinada etapa deverão gerar alertas ou bloqueios específicos.
Exemplos: ausência de aprovação obrigatória, divergência nas datas, falta de
informações necessárias ao cálculo rescisório ou inconsistência nos dados do
vínculo.
A devolução de equipamentos e o encerramento de acessos deverão ser monitorados
por checklist, mas não devem bloquear automaticamente a conclusão trabalhista
sem uma regra previamente validada. A falta de devolução de um equipamento, por
exemplo, deve gerar tratativa específica, sem permitir descontos automáticos
indevidos.

**R27. O processo deve possuir checklist para acessos, equipamentos,
documentos, benefícios e exame demissional?**
Sim. O checklist deverá contemplar, conforme aplicável, equipamentos, acessos a
sistemas e e-mails, benefícios, documentos, exame demissional e demais
providências necessárias.
As tarefas deverão ter responsáveis, prazos, status e registro de conclusão. A
área de TI deverá ser responsável pela execução técnica do encerramento dos
acessos, mediante comunicação formal do RH ou da área autorizada.

**R28. Um desligamento poderá ser cancelado ou corrigido depois de iniciado?**
Sim, enquanto estiver em andamento, por usuários autorizados e mediante
justificativa.
Após a efetivação ou transmissão de informações oficiais, a correção deverá
seguir um fluxo específico, com análise do DP e, quando necessário, orientação
jurídica. O sistema deverá preservar o registro original e todo o histórico da
correção.

**R29. Quais informações do desligamento poderão ser visualizadas pelo
gestor?**
O gestor deverá visualizar as informações necessárias à sua atuação, como status
do processo, data prevista, pendências sob sua responsabilidade e tarefas de
transição.
Informações salariais detalhadas, documentos pessoais, dados bancários,
documentos médicos e demais informações restritas deverão ficar limitados aos
usuários autorizados, conforme a necessidade de acesso.

## 5. Documentos, acesso e privacidade

**R30. Quais documentos precisam ser armazenados no ecossistema RH Evolli?**
Documentos cadastrais e admissionais, contratos, termos, registros de
movimentações, documentos de desligamento, comprovantes pertinentes e demais
documentos necessários à gestão do vínculo.
O armazenamento deverá ser organizado por colaborador, vínculo, empresa,
categoria e período, com controle de acesso e histórico de alterações.

**R31. Quem poderá visualizar documentos pessoais, bancários e contratuais?**
O acesso deverá seguir o princípio do menor privilégio, permitindo a
visualização apenas a quem realmente precisa da informação para executar suas
atividades.
O RH/DP terá acesso aos documentos necessários à gestão do vínculo. Gestores
deverão visualizar somente as informações pertinentes à sua equipe e às suas
responsabilidades. TI deverá administrar os acessos técnicos, sem acesso
irrestrito ao conteúdo dos documentos por padrão.

**R32. Documentos e informações médicas devem ficar separados dos demais
documentos?**
Sim. Atestados, exames, ASOs e demais informações de saúde deverão possuir
categoria e permissões restritas, com acesso limitado aos profissionais
autorizados e àqueles que precisem tratar a informação dentro de suas
atribuições.
O gestor deverá receber somente as informações necessárias à gestão do
trabalho, sem acesso irrestrito a diagnósticos ou detalhes clínicos.

**R33. O colaborador poderá enviar ou substituir documentos diretamente no
futuro?**
Sim, como funcionalidade prevista para uma etapa futura. O sistema deverá
permitir envio e substituição de documentos pelo próprio colaborador, com
validação do RH/DP, registro de data e responsável e histórico das versões.
O envio não deverá significar aprovação automática do documento.

**R34. Existem documentos que precisam de prazo de validade ou aviso de
vencimento?**
Sim. O sistema deverá permitir configurar validade, data de vencimento e alertas
para documentos que exigem renovação ou acompanhamento, conforme o tipo de
vínculo e a função.
Os prazos deverão ser configuráveis, evitando aplicar uma validade única a
documentos com exigências diferentes.

**R35. Por quanto tempo cada tipo de documento e informação deverá ser
mantido?**
Os prazos deverão ser definidos conforme a legislação trabalhista,
previdenciária, fiscal, de proteção de dados e demais regras aplicáveis a cada
documento.
Recomenda-se criar uma tabela de temporalidade documental, validada com o DP e o
jurídico, contemplando prazo de guarda, marco inicial da contagem, eventuais
suspensões e critérios de descarte seguro. O sistema não deverá excluir
documentos automaticamente sem que essa política esteja aprovada.

## 6. Integração com o sistema atual

**R36. Quais dados serão enviados pelo sistema atualmente utilizado?**
A integração deverá contemplar os dados necessários à gestão do vínculo e à
folha, incluindo cadastro, empresa, matrícula, cargo, remuneração, jornada,
movimentações e desligamentos.
Os campos definitivos dependem do levantamento técnico do sistema atual de folha
e dos recursos disponíveis para integração. O sistema de RH deverá registrar o
status da integração e eventuais erros.

**R37. Qual informação identifica unicamente uma pessoa ou vínculo?**
O CPF poderá ser utilizado para identificar a pessoa, com os cuidados
necessários de segurança e proteção de dados. Para identificar cada vínculo,
deverá existir um identificador próprio, como matrícula ou código interno.
O sistema não deverá utilizar somente o CPF como identificador do vínculo, pois
uma mesma pessoa poderá ter mais de um vínculo ou atuar em empresas diferentes.

**R38. O sistema receberá apenas a situação atual ou também todo o histórico?**
A recomendação é importar a situação atual e o histórico disponível que seja
relevante à gestão dos vínculos, movimentações e obrigações legais.
A disponibilidade e a qualidade dos dados históricos deverão ser avaliadas antes
da migração. Informações importadas deverão ser identificadas como provenientes
do sistema anterior, com a data da carga e, quando disponível, a origem do
registro.

**R39. Como serão comunicadas admissões, alterações e desligamentos?**
A preferência é por integração automática, quando houver suporte técnico, com
registro de envio, retorno, sucesso ou erro.
Enquanto a integração automática não estiver disponível, poderá ser utilizado
arquivo periódico ou lançamento manual controlado. O sistema deverá evitar
duplicidade de registros e permitir conferência entre o RH Evolli e o sistema
de folha.

**R40. Durante a transição, qual sistema será considerado a fonte oficial das
informações?**
Durante a transição, o sistema atual de folha deverá continuar como fonte
oficial para os dados que alimentam o processamento da folha e as obrigações
legais, até que a migração seja formalmente validada.
O RH Evolli será utilizado para organizar os processos, solicitações,
aprovações, documentos e históricos previstos para seus módulos. A definição de
qual sistema será a fonte oficial de cada dado deverá constar no plano de
implantação, com responsáveis, critérios de conferência e data de mudança.
