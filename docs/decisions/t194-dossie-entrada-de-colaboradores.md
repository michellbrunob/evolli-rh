# T194 — Dossiê: entrada de colaboradores

Status: **dossiê de preparação de decisão.** Nada aqui decide, aprova ou
autoriza implementação: a escolha é da proprietária.
Data: 2026-10-28. Tarefa: T194.

Fontes, e só elas:

- o código, os testes e o Spec Kit de `main` em `6366f06`, só como evidência;
- as ADRs e decisões em `docs/` (em especial ADR 0003, 0006, 0011, 0013, 0015,
  0016 e 0017, a [T179](t179-confirmacao-admissao-duplicidade-telefones.md), a
  [T180](t180-referencias-rapidas-nova-admissao.md), a
  [reconciliação T173](t173-reconciliacao-fluxo-rh-dp.md) e as
  [aprovações pendentes da Etapa 2](etapa2-documentos-admissao-aprovacoes-pendentes.md));
- a observação funcional de um produto de mercado de RH (módulo Colaboradores),
  feita em 2026-10-28 só como referência de comportamento e ergonomia. Nada de
  marca, texto, cor, layout literal ou código foi copiado; nenhum dado pessoal
  real foi registrado.

Objetivo: preparar o plano para modernizar a entrada de colaboradores no
Evolli — um painel lateral "Adicionar colaborador" com três formas, o cadastro
individual guiado em quatro etapas e a criação rápida inline de referências
organizacionais em seletores pesquisáveis —, com as regras, contratos,
segurança e decisões próprias do Evolli, sem contornar gates existentes.

## 1. Resumo e recomendação

- **O que já dá para fazer sem contrato novo:** o painel lateral com as três
  formas (a individual levando à página que já existe; as outras duas
  visíveis e indisponíveis, com o motivo) e a reorganização da página de Nova
  admissão em quatro etapas, com os campos e as regras de hoje.
- **O que pede contrato aditivo:** seletores pesquisáveis (as listas de
  referências não têm `busca` e param em 100) e a criação inline sem digitar
  código (hoje o código é obrigatório e sempre digitado).
- **O que depende de decisão e de gates:** importar planilha (formato, origem,
  ficha de tratamento, `DP-FLX-17`) e admissão digital (ADR 0016 §5.3, ADR
  0017 §5.1 e §5.3, `DP-FLX-04`, `DP-FLX-18`, Etapa 2, MFA, e-mail).
- **Estrutura-alvo:** as quatro etapas da referência (dados básicos, dados
  profissionais, endereço, documentos), agora **todas observadas**, com campos
  e regras do Evolli (seção 3).
- **Decididos em 2026-10-28:** D14 (observação com CPF sintético autorizado),
  D15 (contatos na etapa 1) e D16 (**Aprendiz** como tipo de vínculo, em
  entrega futura própria — seção 5.1).
- **Primeira entrega recomendada:** o painel lateral (fatia 1, seção 12) —
  pequena, completa, só web, sem contrato novo.

## 2. Referência de mercado observada

**Diretriz da proprietária (2026-10-28):** o cadastro individual do Evolli
deve ser guiado em **quatro etapas**, com organização, progressão, navegação,
campos e funcionalidades **equivalentes** aos da referência, mas com
identidade visual, contratos, permissões, segurança, LGPD e particularidades
próprias do Evolli. As quatro etapas da referência são a **estrutura-alvo**.

### 2.1 Como foi feita

- Navegador da proprietária, já autenticado, no módulo Colaboradores, em duas
  sessões de observação em 2026-10-28.
- Antes de entrar no cadastro, uma trava no navegador bloqueou **toda**
  requisição de gravação (qualquer método além de GET/HEAD/OPTIONS) só naquela
  aba. Só foram bloqueados envios de telemetria, registros de auditoria do
  próprio front e consultas internas do tipo RPC — nada chegou ao servidor.
- Dados digitados: apenas valores claramente sintéticos e não pessoais (nome
  sintético, data impossível, e-mail e telefone inválidos, um valor de
  salário sintético e um CEP público de logradouro, sem número).
- **CPF sintético autorizado:** para avançar da etapa 1, a proprietária
  digitou ela mesma um CPF fictício autorizado; o número não é registrado em
  lugar nenhum.
- A opção de **criar o termo pesquisado** foi vista em cada lista, mas **não
  acionada** (gravaria na conta). Segundo a proprietária, ela cria a
  referência na hora — é o comportamento desejado no Evolli.
- A lista de gestor direto (pessoas da conta) não foi aberta, para não expor
  dados.
- Saída pelo botão de voltar à lista, escolhendo descartar. O rascunho que o
  produto guarda na sessão da aba foi apagado; nenhum rascunho, colaborador ou
  referência foi gravado pela observação. O botão final e o de salvar rascunho
  **não** foram acionados.
- **Registro existente na conta:** havia um único colaborador, cadastrado pela
  própria proprietária em sessão anterior para conhecer o fluxo. Ele **não**
  foi aberto, alterado nem lido, e nenhum dado dele entra neste dossiê; serve
  só como evidência de que a conclusão gera um registro real.

### 2.2 Limitações que permanecem

- O efeito exato de "criar o termo" (só nome? pede código? onde aparece
  depois?) vem da informação da proprietária, não de observação.
- O limite de tamanho dos arquivos da etapa 4 não aparece na tela.
- Salvar rascunho, concluir o cadastro e as mensagens finais não foram
  observados (gravariam).

### 2.3 O que foi observado

- **Tela principal:** resumo (ativos, distribuição por tipo de contrato,
  ausentes hoje), abas (ativos, férias e ausências, escala, organograma,
  desligados, todos), busca por nome, CPF, e-mail ou identificador, filtro em
  painel lateral (tipo de contrato, gênero), colunas (colaborador, CPF,
  contatos, salário, contrato, ações), exportação e o botão de novo
  colaborador no topo e no estado vazio.
- **Painel de adicionar colaborador:** abre pela direita sobre a página
  escurecida; título, subtítulo e fechar; um grupo de escolha única com três
  cartões; o selecionado se expande com o passo a passo; um bloco de ajuda; um
  rodapé fixo com cancelar e um botão principal cujo rótulo muda com a opção,
  mais uma dica do que falta para seguir.
  - _Importar planilha_ — indicada para cinco pessoas ou mais: baixar um
    modelo (.xlsx), preencher uma pessoa por linha (obrigatórios: nome, CPF e
    salário bruto), enviar .xlsx ou .csv de até 5 MB (escolher ou arrastar). O
    botão principal fica desabilitado até haver arquivo.
  - _Cadastro individual_ — quatro etapas, poucos minutos: leva a uma página
    própria.
  - _Admissão digital_ — para uma pessoa ou várias: leva a uma página própria
    de seis etapas (como funciona, dados básicos, dados da pessoa, campos
    adicionais, documentos, convite). O link pode ser de uso único (pede o CPF
    da pessoa e expira em dias) ou da empresa (várias pessoas). A pessoa cria
    conta num portal, aparece numa aba de admissões em andamento, e o RH
    aprova (vira ativa) ou reprova (fica no histórico).
- **Página do cadastro individual** (comportamentos observados):

| Elemento        | Comportamento                                                                                                                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cabeçalho       | título, subtítulo, botão de voltar à lista e botão de salvar rascunho (sempre visível)                                                                                                                                                                     |
| Lista de etapas | à esquerda; número, nome e subtítulo; etapa concluída ganha marca de concluída; a atual destacada; etapas ainda não visitadas **não** são navegáveis; as já visitadas (inclusive à frente) ficam clicáveis                                                 |
| Corpo da etapa  | título, subtítulo e "Etapa N de 4"; campos em seções com título e explicação curta; cada campo com rótulo e uma linha de ajuda; alguns com ícone de ajuda que explica o uso do dado                                                                        |
| Rodapé          | barra de progresso por etapa (25%, 50%, 75%, 100%); na etapa 1, cancelar; nas demais, voltar; próxima etapa; na etapa 4, o botão final de cadastrar                                                                                                        |
| Validação       | só ao pedir a próxima etapa; mensagem abaixo de cada campo inválido; não avança. Obrigatórios observados: nome (mínimo de 3 letras) e CPF na etapa 1; salário bruto na etapa 2; etapas 3 e 4 sem obrigatório                                               |
| Sair            | o botão de voltar à lista (e o cancelar da etapa 1) pergunta se quer sair, com descartar ou salvar o rascunho e sair                                                                                                                                       |
| Rascunho local  | o preenchimento fica guardado na sessão da aba enquanto ela existe                                                                                                                                                                                         |
| Listas          | abrem um painel com campo de busca; as de estrutura dizem "buscar ou criar" e oferecem, por último, "+ Criar «termo»" quando o termo não existe; cada lista tem uma opção "sem …" no topo                                                                  |
| Dependências    | o tipo de contratação **não** muda os campos (CLT, estágio e aprendiz mostram os mesmos); o salário líquido é calculado do bruto e não é editável; o CEP preenche logradouro, bairro, cidade e UF, deixa número e complemento vazios e tudo segue editável |

## 3. Matriz das etapas e equivalência campo a campo

Destinos: **já existe** · **adaptar** · **módulo futuro** · **bloqueado por
decisão** · **fora do produto**.

### 3.1 Etapa 1 — Dados básicos

| Campo (referência)               | Finalidade            | Obrig.  | Controle                     | Máscara / validação observada | Dependências | Comportamento        | Equivalente e destino no Evolli                                                                                                                            |
| -------------------------------- | --------------------- | ------- | ---------------------------- | ----------------------------- | ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foto                             | perfil e lista        | não     | arquivo PNG ou JPG, até 5 MB | —                             | upload       | enviar e remover     | **Bloqueado** — imagem do titular; `DP-ADM-11`, upload da Etapa 2 (ADR 0011)                                                                               |
| Nome completo                    | identificação oficial | **sim** | texto, até 150               | mínimo de 3 letras            | —            | erro abaixo do campo | **Já existe** — obrigatório, 2 a 160 após aparar                                                                                                           |
| CPF                              | folha e eSocial       | **sim** | numérico, máscara de CPF     | obrigatório                   | —            | impede avançar       | **Bloqueado** — `DP-ADM-04`, `DP-FLX-05`; ausente por decisão                                                                                              |
| RG                               | folha e eSocial       | não     | texto, até 20, máscara de RG | —                             | —            | —                    | **Bloqueado** — documento; ausente por decisão                                                                                                             |
| Data de nascimento               | perfil                | não     | numérico `dd/mm/aaaa`        | aceitou data impossível       | —            | —                    | **Já existe** — obrigatória, de 1900-01-01 até hoje                                                                                                        |
| Gênero                           | perfil                | não     | lista de 4 opções            | —                             | —            | —                    | **Adaptar para Sexo** — lista aprovada do Evolli (feminino, masculino, intersexo, não informar); **gênero (identidade) é sensível e bloqueado** (ADR 0016) |
| Estado civil                     | perfil                | não     | lista de 5 opções            | —                             | —            | —                    | **Já existe como texto livre opcional** (ficha da T177); lista fechada exige decisão (D6)                                                                  |
| E-mail pessoal                   | contato               | não     | e-mail, até 254              | formato                       | —            | erro ao avançar      | **Já existe** — opcional, único por empresa; **etapa 1** (D15)                                                                                             |
| Telefone pessoal                 | contato               | não     | máscara de telefone com DDD  | incompleto não acusado        | —            | —                    | **Já existe** — celular e telefone opcionais, só `+55`; **etapa 1** (D15)                                                                                  |
| Contato de emergência — nome     | urgência              | não     | texto, até 150               | —                             | —            | —                    | **Bloqueado** — dado de terceiro; `DP-FLX-06` (sem ficha)                                                                                                  |
| Contato de emergência — telefone | urgência              | não     | telefone com DDD             | —                             | —            | —                    | **Bloqueado** — `DP-FLX-06`                                                                                                                                |

Campos que o Evolli já tem e que **ficam na etapa 1** do Evolli, mesmo sem
equivalente observado: saudação, nacionalidade, naturalidade, escolaridade,
curso, nome do pai e nome da mãe (opcionais, ficha da T177).

### 3.2 Etapa 2 — Dados profissionais (observada)

Seções: estrutura (onde a pessoa está na organização), contrato (vínculo,
admissão, jornada, escala, matrícula), remuneração e informações adicionais.

| Campo (referência)  | Finalidade                                                  | Obrig.  | Controle                                                                                                                                                              | Máscara / validação | Dependências                               | Comportamento     | Equivalente e destino no Evolli                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cargo               | função                                                      | não     | **texto livre**, até 120                                                                                                                                              | —                   | —                                          | —                 | **Adaptar** — no Evolli, Cargo é **referência obrigatória** da empresa; vira lista com busca e criação inline (seção 6)                                                                                          |
| Nível               | senioridade                                                 | não     | lista com busca: sem nível, primeiro emprego, júnior, pleno, sênior, líder técnico, coordenador, gerente, head, diretor, VP, C-level                                  | —                   | —                                          | —                 | **Módulo futuro** — não existe no Evolli (D17)                                                                                                                                                                   |
| Departamento        | estrutura                                                   | não     | lista com busca e **criação inline**; opção "sem departamento"; a conta já traz uma lista genérica de departamentos                                                   | —                   | —                                          | "+ Criar «termo»" | **Já existe** — obrigatório; **criação inline só RH** (seção 6)                                                                                                                                                  |
| Área                | estrutura                                                   | não     | lista com busca e **criação inline**; "sem área"                                                                                                                      | —                   | não ficou claro se depende do departamento | "+ Criar «termo»" | **Já existe** como seleção opcional dependente do departamento; **sem criação inline** (D4)                                                                                                                      |
| Centro de custo     | estrutura                                                   | não     | lista com busca e **criação inline**; "sem centro de custo"                                                                                                           | —                   | —                                          | "+ Criar «termo»" | **Já existe** — opcional; **criação inline só RH**                                                                                                                                                               |
| Unidade             | filial, loja ou local                                       | não     | lista com busca e **criação inline**; "sem unidade"                                                                                                                   | —                   | —                                          | "+ Criar «termo»" | **Já existe** — opcional; **criação inline só RH**                                                                                                                                                               |
| Gestor direto       | recebe solicitações da pessoa                               | não     | lista de pessoas (não aberta)                                                                                                                                         | —                   | —                                          | —                 | **Bloqueado** — relação gestor/subordinado não antecipada (ADR 0006 d.8; ADR 0015)                                                                                                                               |
| Tipo de contratação | vínculo                                                     | não     | lista: CLT, PJ, estágio, aprendiz, part-time, freelancer, trainee                                                                                                     | —                   | não altera campos                          | —                 | **Adaptar** — tipo de vínculo **obrigatório** (`clt`, `estagio`, `pj`, `temporario`, `outro_controlado`); **Aprendiz aprovado** para entrega futura (seção 5.1); part-time, freelancer e trainee a decidir (D18) |
| Data de admissão    | início                                                      | não     | `dd/mm/aaaa`                                                                                                                                                          | —                   | —                                          | —                 | **Já existe** — **obrigatória**                                                                                                                                                                                  |
| Jornada de trabalho | carga horária                                               | não     | número de horas por semana (exemplo 44)                                                                                                                               | numérico            | —                                          | —                 | **Adaptar** — no Evolli a jornada é uma **tabela de horário** (T182/T183), opcional e só RH; horas semanais derivam dela                                                                                         |
| Escala de trabalho  | dias de trabalho e folga                                    | não     | lista com busca: não informada, 5x2, 6x1, semana espanhola, 4x3, fim de semana, 5x1, 6x2, 4x2, 2x2, 3x3, 4x4, 12x36, 12x60, 12x72… cada uma com a explicação dos dias | —                   | sem escala, benefícios usam dias úteis     | —                 | **Módulo futuro** — escalas e revezamento dependem de Ponto (Etapa 3) e de regra trabalhista não decidida                                                                                                        |
| Matrícula           | localizar a pessoa na folha                                 | não     | texto, até 30, com ajuda explicando o uso                                                                                                                             | —                   | —                                          | —                 | **Já existe** — opcional, `^[A-Z0-9_-]{2,32}$`, única por empresa                                                                                                                                                |
| Salário bruto       | folha                                                       | **sim** | moeda                                                                                                                                                                 | obrigatório         | —                                          | erro ao avançar   | **Bloqueado** — remuneração ausente por decisão (ADR 0015, ADR 0016)                                                                                                                                             |
| Salário líquido     | folha                                                       | —       | calculado, só leitura                                                                                                                                                 | —                   | do bruto                                   | —                 | **Bloqueado** — idem                                                                                                                                                                                             |
| Conselho e registro | registro profissional (obrigatório para algumas profissões) | não     | lista (nenhum, OAB, CRM, COREN, CRO, CRP, CREA, CAU, CRA, CRC, CRF, CRN, CREF, CREFITO, CRBM, CRTR) + número, até 40                                                  | —                   | —                                          | —                 | **Módulo futuro** — dado profissional novo; exige ficha de tratamento (D19)                                                                                                                                      |
| Dependentes (IRRF)  | dedução fiscal                                              | não     | numérico                                                                                                                                                              | —                   | —                                          | —                 | **Bloqueado** — dependentes e dado fiscal (`DP-ADM-14`)                                                                                                                                                          |
| Pensão alimentícia  | desconto em folha                                           | não     | percentual                                                                                                                                                            | —                   | —                                          | —                 | **Bloqueado** — dado judicial e financeiro                                                                                                                                                                       |

### 3.3 Etapa 3 — Endereço (observada)

Toda a etapa é **opcional** na referência (avança vazia).

| Campo (referência) | Controle                      | Máscara / validação | Comportamento                                                                 | Equivalente e destino no Evolli                                                          |
| ------------------ | ----------------------------- | ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CEP                | numérico, máscara `00000-000` | —                   | preenche logradouro, bairro, cidade e UF; não preenche número nem complemento | **Já existe** — ViaCEP assistido pelo servidor; preenche só campos vazios; tudo editável |
| Logradouro         | texto, até 200                | —                   | preenchido pelo CEP, editável                                                 | **Já existe**                                                                            |
| Número             | texto, até 20                 | —                   | nunca preenchido                                                              | **Já existe**                                                                            |
| Complemento        | texto, até 120                | —                   | nunca preenchido                                                              | **Já existe**                                                                            |
| Bairro             | texto, até 120                | —                   | preenchido pelo CEP, editável                                                 | **Já existe**                                                                            |
| Cidade             | texto, até 120                | —                   | preenchida pelo CEP, editável                                                 | **Já existe**                                                                            |
| UF                 | lista                         | —                   | preenchida pelo CEP                                                           | **Adaptar** — no Evolli é "Estado" em texto; lista de UF a decidir (D20)                 |
| (País)             | não existe na referência      | —                   | —                                                                             | **Já existe** no Evolli (começa como Brasil); mantém                                     |

### 3.4 Etapa 4 — Documentos (observada)

Etapa **opcional** na referência; os arquivos seriam enviados ao concluir o
cadastro.

| Item (referência)                           | Controle                                                                     | Formatos                                                              | Comportamento | Equivalente e destino no Evolli                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------- |
| Documentos obrigatórios (contador "0 de 5") | lista com estado "pendente" e enviar arquivo                                 | PDF, JPG, JPEG, PNG, WEBP, DOC, DOCX, HEIC, HEIF; tamanho não exibido | —             | **Bloqueado** — `DP-FLX-14`, ADR 0011, Etapa 2 Nível 2                      |
| RG                                          | arquivo                                                                      | idem                                                                  | —             | **Bloqueado**                                                               |
| CPF                                         | arquivo                                                                      | idem                                                                  | —             | **Bloqueado**                                                               |
| Comprovante de endereço                     | arquivo                                                                      | idem                                                                  | —             | **Bloqueado**                                                               |
| Carteira de Trabalho                        | arquivo                                                                      | idem                                                                  | —             | **Bloqueado**                                                               |
| Certidões                                   | arquivo                                                                      | idem                                                                  | —             | **Bloqueado**                                                               |
| Outros documentos                           | nome livre (o exemplo é um atestado médico) + arquivo; adicionar só com nome | idem                                                                  | —             | **Bloqueado** — atestado é dado de saúde (sensível)                         |
| Botão final de cadastrar                    | botão                                                                        | —                                                                     | não acionado  | **Adaptar** — no Evolli, revisão e confirmação (T179) com `Idempotency-Key` |

### 3.5 Outros fluxos observados

| Item (referência)                                                                       | Destino no Evolli                                                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Painel com três formas de entrada                                                       | **Adaptar** — seção 7                                                                         |
| Importar planilha (modelo .xlsx; nome, CPF e salário obrigatórios; .xlsx/.csv até 5 MB) | **Módulo futuro**, com decisões; CPF e salário **bloqueados**                                 |
| Admissão digital (link, portal, aprovar/reprovar)                                       | **Bloqueado por decisão** — seção 8.3                                                         |
| Salvar rascunho (servidor)                                                              | **Módulo futuro** — exige decisão e schema (D7)                                               |
| Rascunho local na sessão da aba                                                         | **Fora**, por padrão — ADR 0016 §5.6 proíbe dado pessoal em storage do navegador              |
| Pergunta ao sair (descartar ou salvar)                                                  | **Adaptar** — no Evolli, o aviso de edição pendente da T189 já cobre sair e trocar de empresa |
| Exportar, CPF e salário na lista, filtro por gênero, ausentes hoje                      | **Bloqueado** ou **módulo futuro** (ADR 0017 §5.3, ausências por decisão, Ponto)              |

## 4. O Evolli hoje

### 4.1 Nova admissão (página própria, `DP-FLX-21`)

| Bloco          | Campos (obrigatórios em negrito)                                                                                                                    | Observações                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Empresa        | empresa ativa (só leitura)                                                                                                                          | exige exatamente uma empresa no contexto                                                             |
| Dados pessoais | **nome completo**, **data de nascimento**, sexo, saudação, estado civil, nacionalidade, naturalidade, escolaridade, curso, nome do pai, nome da mãe | sexo em lista fechada; demais textos controlados, opcionais                                          |
| Endereço       | país (começa "Brasil"), CEP, logradouro, número, complemento, bairro, cidade, estado                                                                | ViaCEP assistido pelo servidor: preenche só campos vazios, nunca número e complemento; tudo editável |
| Contatos       | e-mail pessoal, celular, telefone                                                                                                                   | e-mail único por empresa; telefones só `+55`                                                         |
| Vínculo        | matrícula, **tipo de vínculo**, **data de admissão**                                                                                                | matrícula `^[A-Z0-9_-]{2,32}$`, única por empresa                                                    |
| Lotação        | **Departamento**, **Cargo**, Unidade, Área (depende do departamento), Equipe, Centro de custo                                                       | `<select>` nativo, sem busca, 100 itens; "+" (T180) só para RH, em Departamento, Cargo e Unidade     |
| Jornada        | jornada de trabalho                                                                                                                                 | só RH; jornadas ativas, 100 itens                                                                    |
| Confirmação    | modal "Confirmar cadastro de colaborador?" (T179)                                                                                                   | resumo sem contatos, endereço ou nascimento; `Idempotency-Key` por admissão                          |

Quem admite: RH e DP, na empresa ativa; DP sem "+" e sem jornada;
`master_tecnico` só lê (403 na gravação).

### 4.2 Referências organizacionais

| Item              | Departamento, Cargo, Unidade, Centro de custo                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Campos            | `empresaId`, `codigo`, `nome`, `status` (ativo/inativo) — todos obrigatórios                                                                                       |
| Código            | `^[A-Z0-9_]{2,32}$`, **obrigatório e imutável**, único por empresa (`@@unique([empresaId, codigo])`, sensível a maiúsculas — na prática só maiúsculas, pelo regex) |
| Nome              | 1 a 160; **sem unicidade** (nomes repetidos permitidos por decisão); sem normalização no servidor (um nome só com espaços passa)                                   |
| Listagem          | `pagina`, `tamanhoPagina` até 100, `status`, `empresaId`; ordem por código; **sem `busca`**                                                                        |
| Duplicidade       | 409 genérico, **sem campo e sem código** (diferente de jornadas, que devolvem `codigo` como campo)                                                                 |
| Outros erros      | 400 validação; 404 empresa fora do escopo (com `authorization_denied` na trilha); 422 empresa inativa ou FK; 403 `csrf_invalido`; 403 sem permissão                |
| Quem cria         | RH na própria empresa; `master_tecnico` (no escopo); DP, financeiro e demais **não**                                                                               |
| Auditoria         | evento de criação com ids apenas; **nome e código não vão à auditoria**                                                                                            |
| Geração de código | **não existe** em lugar nenhum                                                                                                                                     |
| Clientes web      | sem reenvio em 403 `csrf_invalido` (só descartam o token); 401 vira "sessão expirada"                                                                              |

**Área** existe no schema, na API, na tela Estrutura e na admissão, como
subdivisão opcional do departamento (ADR 0006 §1); o código é único por
departamento. **Conflito a decidir:** a diretriz desta entrega trata Área como
"não aprovada"; o repositório a tem como estrutura aceita e em uso (ver
decisão D4).

**T180 (referência rápida):** modal curto, só RH, para Departamento, Cargo e
Unidade, com código e nome digitados; devolve a referência ao seletor e a
seleciona; trata 409, 401, 403, 404, 4xx e incerteza (rede/5xx, relê a lista)
sem perder o que foi digitado; registra edição pendente (T189). **Conflito
documental:** a ADR 0016 §6.5 ainda diz que criação rápida de estrutura na
admissão fica de fora; a T180 a substituiu só por documento de decisão.

## 5. Proposta do fluxo Evolli em quatro etapas

Página própria (mantém `DP-FLX-21`), com a **mesma estrutura-alvo da
referência** — quatro etapas, lista de etapas, progresso, validação por etapa
—, substituindo a organização atual da Nova admissão em blocos. **Sem campo
novo** e sem mudar contrato nesta proposta: a admissão continua sendo um único
envio no fim, com a confirmação da T179 e a mesma `Idempotency-Key`.

| Etapa (Evolli)                        | Equivale a (referência)                 | Campos (obrigatórios em negrito)                                                                                                                                                                                     | Regras                                                                                                                    |
| ------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **1 — Dados básicos**                 | Dados básicos (identificação e contato) | **nome completo**, **data de nascimento**, sexo (lista aprovada), estado civil, saudação, nacionalidade, naturalidade, escolaridade, curso, nome do pai, nome da mãe; **contato:** e-mail pessoal, celular, telefone | validações de hoje; sem foto, CPF, RG, gênero ou contato de emergência                                                    |
| **2 — Dados profissionais e lotação** | Dados profissionais (cargo e contrato)  | matrícula, **tipo de vínculo**, **data de admissão**, **Departamento**, **Cargo**, Unidade, Área, Equipe, Centro de custo, jornada (só RH)                                                                           | Área depende do departamento; criação inline (seção 6) só para RH, quando aprovada; sem salário                           |
| **3 — Endereço**                      | Endereço (residência)                   | país, CEP, logradouro, número, complemento, bairro, cidade, estado                                                                                                                                                   | ViaCEP assistido e editável; sem fuso horário                                                                             |
| **4 — Documentos e conclusão**        | Documentos (envio de arquivos)          | bloco "Documentos" informando que o envio ainda não está disponível (sem campo); revisão de tudo; confirmar cadastro                                                                                                 | documentos só depois de `DP-FLX-14`, Etapa 2 e ficha; resumo segue a regra da T179 (sem contatos, endereço ou nascimento) |

Os contatos ficam na etapa 1, como na referência (**D15 decidida**).

Diferenças da referência que o Evolli **mantém** por decisão ou contrato:
Cargo é referência obrigatória (não texto livre); Departamento, Cargo, data de
admissão e tipo de vínculo são obrigatórios; data de nascimento é obrigatória;
salário, CPF, documentos, gestor direto, escala, nível, conselho, dependentes e
pensão não entram.

Comportamento proposto (equivalente ao observado, com as regras do Evolli):

- **Navegação:** lista de etapas à esquerda (acima, em 375 px), com número,
  nome e subtítulo; "Voltar" livre; "Próxima etapa" valida só a etapa atual;
  etapas já concluídas ficam clicáveis; as seguintes, não.
- **Validação:** por etapa, com o erro abaixo do campo e o foco no primeiro
  campo com erro; o servidor continua decidindo (409 de matrícula ou e-mail
  leva de volta à etapa do campo).
- **Progresso:** "Etapa N de 4" e barra de progresso, anunciados ao leitor de
  tela uma vez a cada troca.
- **Rascunho:** **nenhum** nesta fase — os dados ficam só em memória da
  página, nunca em storage do navegador (ADR 0016 §5.6); sair ou trocar de
  empresa passa pelo aviso de edição pendente da T189. "Salvar rascunho" no
  servidor é módulo futuro (D7).
- **Cancelar:** com algo preenchido, pergunta antes de descartar (o aviso da
  T189); vazio, sai direto.
- **Falhas:** as de hoje (sessão expirada, CSRF, permissão, empresa trocada,
  conflito, incerteza com a mesma chave), sem perder nada do que foi
  preenchido.
- **DP:** mesmo fluxo, sem jornada e sem criação inline; com empresa sem
  Departamento ou Cargo ativos, orientação de pedir ao RH (como hoje).
- **Textos:** todos escritos pelo Evolli; nenhum texto da referência é
  reproduzido.

### 5.1 Aprendiz como tipo de vínculo (D16 — aprovado para entrega futura)

A proprietária aprovou incluir **Aprendiz** como tipo de vínculo previsto no
Evolli, em **entrega futura própria**, com regras formais, validações e
decisões documentadas. Nada é implementado nesta tarefa. A referência mostra
"aprendiz" na lista de tipos, sem nenhum campo extra.

Impacto previsto (para a entrega própria):

- **Contrato e schema:** novo valor no tipo de vínculo (enum no banco, DTO,
  migration aditiva), E2E com PostgreSQL real e revisão de onde o tipo é lido
  (listagem, filtros, ficha, histórico funcional, importação futura).
- **RBAC e auditoria:** sem mudança prevista — o tipo é atributo do vínculo,
  que RH e DP já gravam; eventos seguem só com ids.

Regras a decidir e documentar antes do código (todas a confirmar com RH/DP e
jurídico — nada aqui é regra adotada):

1. **Prazo determinado:** o contrato de aprendizagem tem data de término;
   decidir se ela passa a ser obrigatória para Aprendiz e qual o prazo máximo
   aceito.
2. **Idade:** faixa etária na admissão, validada contra a data de nascimento
   (e a exceção para pessoa com deficiência — dado sensível, que **não** existe
   no Evolli e exigiria ADR e ficha).
3. **Programa e entidade formadora:** se o Evolli registra o curso ou a
   instituição de aprendizagem — dado novo, com ficha de tratamento.
4. **Jornada:** limite de horas e relação com a jornada (tabela de horário) já
   existente; validação ou só orientação.
5. **Término e conversão:** o que acontece no fim do prazo (desligamento,
   conversão para outro tipo) e como isso entra no histórico funcional.
6. **Cota e relatórios:** se o Evolli calcula ou só informa.

## 6. Criação rápida inline em seletores

### 6.1 Escopo e comportamento

- Departamento, Cargo, Unidade e Centro de custo; **só RH**, **só na empresa
  ativa**. DP e demais perfis apenas selecionam. **Área fica de fora**.
- O seletor vira uma busca com lista (padrão combobox): ao digitar um termo
  sem resultado igual, a lista oferece, por último, `+ Criar "Tecnologia"`.
- Escolher a opção **confirma inline** (na própria lista, sem modal nem nova
  tela), cria a referência, insere-a na lista, seleciona-a e devolve o foco ao
  campo. Nada do formulário se perde.
- A criação conta como edição em andamento (T189) enquanto envia.

### 6.2 Pré-requisito de contrato: busca

As listas de referências **não têm `busca`** e param em 100 itens. Opções:

| Opção               | Como                                                                                         | Contrato                     | Risco                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| A                   | filtrar no navegador a página de 100                                                         | nenhum                       | some acima de 100 — "Criar" poderia aparecer para um termo que já existe |
| **B (recomendada)** | `busca` por nome ou código nos quatro `GET`, sem diferença de maiúsculas e acentos, paginada | aditivo (DTO e service), E2E | baixo                                                                    |

### 6.3 Código automático — alternativas (sem presumir formato)

Hoje o código é obrigatório, `^[A-Z0-9_]{2,32}$`, imutável e único por
empresa; nada o gera. Para criar só com o nome:

| Opção                              | Como                                                                                                                                                                                                   | Contrato e schema                                                           | Colisão                                                                        | Visibilidade e edição                                      | Riscos                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **G1 — servidor deriva do nome**   | `codigo` opcional no `POST`; ausente, o servidor normaliza o nome (sem acento, maiúsculas, não alfanumérico vira `_`, aparado, cortado) e, em colisão, tenta sufixos (`_2`, `_3`…) dentro da transação | API aditiva; regex e unicidade iguais; sem migration                        | resolvida no servidor, atômica                                                 | o código aparece na resposta e na lista; continua imutável | nome curto ou só símbolos (ex.: "TI" vira `TI`; "R&D" vira `R_D`); limite de tentativas |
| G2 — cliente deriva e mostra       | o seletor sugere o código derivado, visível e editável antes de criar                                                                                                                                  | nenhum                                                                      | 409 genérico não diz que é código — seria preciso tentar outro sufixo às cegas | o RH vê e pode corrigir                                    | corrida entre dois RH; 409 ambíguo; mais um campo na linha                              |
| G3 — sequencial por empresa e tipo | `DEP_0001`, `CAR_0001`… gerado no servidor                                                                                                                                                             | API aditiva + contador ou "maior + 1" com nova tentativa (talvez migration) | atômica se houver contador                                                     | sem significado para quem lê                               | exige schema se usar contador                                                           |
| G4 — sem geração                   | a criação inline pede código e nome na própria linha                                                                                                                                                   | nenhum                                                                      | 409 mostrado no campo                                                          | o RH digita                                                | menos fluido; contraria "só o nome"                                                     |

Recomendação: **G1**, com o 409 passando a indicar o campo `codigo` (como em
jornadas), para distinguir colisão de código de outros conflitos.

### 6.4 Regras a decidir

- **Nome:** aparar e colapsar espaços no cliente e **também no servidor**
  (hoje um nome só com espaços passa); limite de 160.
- **Duplicidade de nome:** permitida hoje. O "Criar" aparece só quando **não**
  há nome igual (sem diferença de maiúsculas e acentos)?
- **Confirmação:** um passo inline ("Criar «Tecnologia» como novo
  departamento? Confirmar / Cancelar") ou criar direto ao escolher.
- **Incerteza (rede ou 5xx):** a criação de referência **não tem chave de
  idempotência**. Antes de oferecer nova tentativa, buscar pelo nome; se
  apareceu, selecionar em vez de criar outra.
- **Troca de empresa durante a criação:** a resposta da empresa anterior é
  descartada; a lista é relida na nova.
- **403 `csrf_invalido`:** renovar o token e oferecer reenviar, sem perder o
  termo (hoje não há reenvio automático).
- **401:** aviso de sessão expirada, termo preservado.
- **T180:** o modal continua até a decisão de substituí-lo; a ADR 0016 §6.5
  precisa de nota de convergência.

## 7. Painel lateral "Adicionar colaborador"

- **Abertura:** botão "Adicionar colaborador" (nome a decidir; hoje a ação de
  entrada é "Nova admissão") no topo de Colaboradores e no estado vazio; abre
  um painel à direita, por cima da página.
- **Conteúdo:** título, uma linha de apoio, fechar; grupo de escolha única com
  três cartões; o selecionado mostra o passo a passo curto; rodapé fixo com
  "Cancelar" e o botão principal com o rótulo da opção.
  - _Cadastro individual_ — disponível para RH e DP; leva à página de Nova
    admissão (em quatro etapas, quando a fatia 2 existir).
  - _Importar planilha_ — **indisponível**, com o motivo ("depende de
    aprovação do formato e da ficha de tratamento").
  - _Admissão digital_ — **indisponível**, com o motivo ("depende das
    aprovações de convite, documentos e acesso do colaborador").
- **Estados:** fechado; aberto com a primeira opção disponível selecionada;
  opção indisponível (selecionável para ler o motivo, botão principal
  indisponível); empresa ativa trocada com o painel aberto (o painel fecha e o
  foco volta ao botão de origem).
- **Acessibilidade:** `role="dialog"` com título; foco preso no painel; Esc,
  fundo e "Cancelar" fecham e devolvem o foco ao botão de origem; setas
  percorrem os cartões; motivo de indisponibilidade lido junto do cartão.
- **375 px:** o painel ocupa a largura toda; cartões empilhados; alvos de
  44 px; rodapé fixo sem cobrir conteúdo.
- **Quem vê:** RH e DP; o `master_tecnico` não (não admite).
- **Identidade:** componentes e tokens do Evolli (`Surface`, `Button`,
  `StatusBadge`), terminologia do Evolli; nada copiado da referência.
- **Regra:** o painel só escolhe — é a "seleção curta" que o `DP-FLX-21`
  permite fora da página; nenhum dado pessoal é digitado nele.

## 8. Três formas de entrada

### 8.1 Cadastro individual

| Pode agora                                                                       | Depende de decisão                                                                                    | Exige contrato, schema ou ficha                                                                 |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| painel; quatro etapas com os campos de hoje; validação por etapa; acessibilidade | nome do botão; estado civil em lista fechada; manter ou não Área, Equipe e Centro de custo na etapa 2 | seletores pesquisáveis (`busca`); criação inline sem código (G1); rascunho no servidor (schema) |

### 8.2 Importar planilha

| Tema        | Proposta                                                                                                                                                              | Decisão ou gate                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Formato     | CSV UTF-8, cabeçalho fixo; .xlsx exige dependência nova                                                                                                               | D10                               |
| Campos      | os mesmos do cadastro (obrigatórios: nome, nascimento, tipo de vínculo, admissão, Departamento, Cargo); referências por **código**; **sem CPF, salário ou documento** | `DP-ADM-04` (CPF) segue aberto    |
| Arquivo     | lido no navegador; **não** guardado no servidor                                                                                                                       | ficha de tratamento da importação |
| Validação   | por linha no navegador e, antes de gravar, no servidor (verificação sem gravação — contrato novo)                                                                     | contrato                          |
| Confirmação | prévia com contagem de válidas e inválidas; "Importar N colaboradores"                                                                                                | —                                 |
| Gravação    | uma admissão por linha com `Idempotency-Key` própria (reenvio seguro), ou um lote no servidor                                                                         | D11                               |
| Erros       | relatório por linha (campo e motivo, nunca o valor), baixável só no navegador                                                                                         | ADR 0016 §5.6                     |
| Duplicidade | e-mail e matrícula únicos por empresa recusam a linha; mesma pessoa entre empresas segue aberta                                                                       | `DP-ADM-05`                       |
| Origem      | registrar que veio de importação                                                                                                                                      | `DP-FLX-17`                       |
| Auditoria   | eventos por admissão (já existem); evento do lote só com contagens                                                                                                    | contrato                          |
| Quem        | RH (e DP?) na empresa ativa; limite de linhas por arquivo                                                                                                             | D12                               |

### 8.3 Admissão digital

| Tema                                                                               | ADR, gate ou decisão                                                                                                     | Situação                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Link, convite, autopreenchimento, acesso do papel `colaborador`                    | ADR 0016 §5.3; ADR 0017 §5.1                                                                                             | **bloqueado por decisão**      |
| Portal e acesso do titular                                                         | ADR 0016 §8; `DP-2E-14`; ADR 0015 d.6 / `DP-23` (pré-condição, não autorização)                                          | aberto                         |
| MFA e reautenticação                                                               | ADR 0003 d.3; ADR 0016 §5.9 / `DP-ADM-07`                                                                                | aberto                         |
| Estados do processo (em andamento, devolução, aprovação, reprovação, cancelamento) | `DP-FLX-04`                                                                                                              | **aberto**                     |
| Documentos e upload                                                                | ADR 0011 (d.2, d.3, d.9); ADR 0013 (d.7); `DP-2E-04`, `05`, `06`, `09`, `10`, `11`, `13`, `15`; `DP-FLX-14`; `DP-ADM-13` | **bloqueado** (Nível 2 aberto) |
| Expiração e revogação do link                                                      | `DP-2E-06` (prazos); token de uso único, guardado só como hash, revogável                                                | schema novo + decisão          |
| E-mail                                                                             | ADR 0003 (provedor não decidido; hoje `NoopEmailNotifier`); `DP-FLX-18` (notificações)                                   | aberto                         |
| Preenchimento por terceiro e LGPD                                                  | ADR 0016 §5.4 (sem ficha, a categoria não existe); ficha nova para o titular preenchendo                                 | aberto                         |
| Notificação, exportação, exclusão                                                  | ADR 0017 §5.3                                                                                                            | bloqueado                      |
| Auditoria                                                                          | eventos de convite criado, aberto, enviado, aprovado, reprovado, revogado — só ids                                       | contrato e schema              |
| CPF                                                                                | `DP-ADM-04`                                                                                                              | aberto                         |

Nada disso é apresentado como pronto: a admissão digital é um projeto próprio,
que começa por decisões, não por código.

## 9. Matriz de permissões

| Ação                                                | RH                 | DP                 | `master_tecnico` | Demais |
| --------------------------------------------------- | ------------------ | ------------------ | ---------------- | ------ |
| Ver "Adicionar colaborador" e o painel              | sim                | sim                | não              | não    |
| Cadastro individual                                 | sim                | sim                | não (só lê)      | não    |
| Jornada na admissão                                 | sim                | não                | —                | —      |
| Criar referência inline (Depto, Cargo, Unidade, CC) | sim, empresa ativa | não (só seleciona) | não na admissão  | não    |
| Selecionar referência existente                     | sim                | sim                | —                | —      |
| Importar planilha                                   | a decidir (D12)    | a decidir          | não              | não    |
| Admissão digital                                    | bloqueada          | bloqueada          | não              | não    |

Isolamento: toda leitura e gravação usa a empresa ativa da sessão (T163); o
servidor recusa empresa divergente (404) e o RBAC continua a decisão final.

## 10. Dados pessoais e dados sensíveis

| Categoria                                               | Situação   | Ficha      | Logs e auditoria                                      |
| ------------------------------------------------------- | ---------- | ---------- | ----------------------------------------------------- |
| Nome, nascimento, sexo, estado civil e demais do perfil | existem    | T177       | nunca valores                                         |
| Endereço e CEP (ViaCEP só com o CEP)                    | existem    | T177       | nunca valores                                         |
| E-mail pessoal, celular, telefone                       | existem    | T178       | `*.emailPessoal`, `*.celular`, `*.telefone` redigidos |
| Arquivo de importação                                   | não existe | ficha nova | nunca valores                                         |
| Dados preenchidos pelo titular (convite)                | não existe | ficha nova | nunca valores                                         |

**Dependem de ADR, ficha de tratamento e decisão expressa da proprietária**
— nenhum deles entra em fatia alguma deste plano sem essas três coisas:

| Dado ou recurso                               | Por quê                                                | Referências                                                               |
| --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Documentos (RG, CNH, CTPS, PIS, comprovantes) | documento pessoal; upload bloqueado                    | ADR 0011, ADR 0013, Etapa 2 Nível 2 (`DP-2E-*`), `DP-FLX-14`, `DP-ADM-13` |
| CPF                                           | identificador governamental; obrigatoriedade em aberto | `DP-ADM-04`, `DP-FLX-05`                                                  |
| Dados bancários                               | financeiro; proteção em repouso e MFA                  | ADR 0016 §5.9, `DP-ADM-07`, `DP-ADM-13`                                   |
| Foto                                          | imagem do titular; upload                              | `DP-ADM-11`, ADR 0011                                                     |
| Raça/etnia                                    | dado sensível (LGPD art. 5º, II)                       | ADR 0016 (fora de escopo)                                                 |
| Deficiência                                   | dado sensível de saúde                                 | ADR 0016 (fora de escopo)                                                 |
| Gênero (identidade)                           | dado sensível; o Evolli usa só Sexo em lista aprovada  | ADR 0016                                                                  |
| Contato de emergência                         | dado de terceiro                                       | `DP-FLX-06`                                                               |
| Salário e remuneração                         | ausente por decisão                                    | ADR 0015, ADR 0016                                                        |
| Dependentes                                   | dado de terceiro                                       | ADR 0016 (`DP-ADM-14`)                                                    |
| Convite digital e preenchimento pelo titular  | acesso do papel `colaborador`, link, e-mail            | ADR 0016 §5.3, ADR 0017 §5.1 e §5.3, seção 8.3                            |
| Fuso horário                                  | fora do produto                                        | `DP-FLX-22`                                                               |
| Conselho e registro profissional              | dado profissional novo                                 | ficha nova (D19)                                                          |
| Dependentes para IRRF e pensão alimentícia    | dado fiscal, judicial e de terceiro                    | ADR 0016 (`DP-ADM-14`), folha                                             |
| Gestor direto                                 | relação gestor/subordinado não antecipada              | ADR 0006 d.8, ADR 0015                                                    |
| Atestado médico e outros documentos livres    | dado de saúde (sensível)                               | ADR 0011, LGPD art. 11                                                    |
| Faixa etária e deficiência para Aprendiz      | dado sensível (deficiência)                            | seção 5.1                                                                 |

**Nunca usar dado real em teste, comparação, captura, log ou documentação** —
inclusive o registro que a proprietária criou na referência de mercado.

**Lacuna registrada:** a ADR 0016 §5.6 pede que cada categoria aprovada
acrescente seus caminhos à redação do logger antes de existir; os campos da
T177 (nascimento, CEP, logradouro, nomes dos pais etc.) não estão nos caminhos
redigidos. Hoje a proteção vem da redação do corpo inteiro e de serializadores
mínimos; um objeto com esses dados logado por engano num service não seria
redigido.

## 11. Riscos e dependências

| Risco ou dependência                                 | Impacto                                                      | Mitigação                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| Listas sem `busca`, presas em 100                    | seletor pesquisável incompleto; "Criar" para termo existente | `busca` aditiva (6.2-B) antes da criação inline                 |
| Código obrigatório e sem geração                     | criação "só com o nome" impossível sem contrato              | G1 (6.3)                                                        |
| 409 genérico nas referências                         | não distingue colisão de código                              | 409 com campo `codigo`                                          |
| Criação de referência sem idempotência               | duplicata após incerteza                                     | buscar pelo nome antes de reenviar                              |
| Sem reenvio em 403 `csrf_invalido`                   | erro desnecessário após outra aba renovar o token            | renovar e oferecer reenviar                                     |
| Nome só com espaços aceito pelo servidor             | referência sem nome legível                                  | normalizar no servidor                                          |
| Referência cria a estrutura na hora, sem confirmação | estrutura criada por engano                                  | confirmação inline e só RH (D9)                                 |
| A referência trata Cargo como texto livre            | divergência de modelo                                        | o Evolli mantém Cargo como referência (seção 5)                 |
| A referência exige salário e CPF e não exige lotação | expectativa de paridade total                                | equivalência explícita campo a campo (seção 3)                  |
| Área "não aprovada" × existente                      | ambiguidade de escopo                                        | D4                                                              |
| ADR 0016 §6.5 × T180                                 | documentação contraditória                                   | nota de convergência na ADR                                     |
| Estado civil texto × lista da referência             | inconsistência futura                                        | D6                                                              |
| Aprendiz exige enum, migration e regras legais       | regressão em listagens e filtros; regra mal definida         | entrega própria (fatia 5) com regras decididas antes            |
| Tipos part-time, freelancer e trainee                | confusão entre vínculo, jornada e programa                   | D18                                                             |
| "Outros documentos" com atestado médico              | dado de saúde                                                | bloqueado; documentos só após a Etapa 2                         |
| Redação do logger incompleta para a T177             | risco latente de vazamento em log                            | incluir os caminhos antes de mexer na admissão                  |
| Reorganizar a página de admissão                     | regressão em fluxo crítico                                   | fatia própria, E2E existentes como rede de segurança, navegador |
| Importação e admissão digital                        | gates múltiplos                                              | decisões antes de qualquer código                               |

## 12. Fatiamento em entregas pequenas

Uma funcionalidade completa por entrega (regra 7 do `tasks.md`):
implementar, validar no localhost com dados sintéticos, revisar, PR, CI,
integrar — e só então a seguinte.

| Fatia                                           | Funcionalidade completa                                                                                                                              | Contrato                    | Depende de           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------- |
| **1 — Painel "Adicionar colaborador"**          | painel lateral, três cartões (individual leva à Nova admissão de hoje; importar e digital indisponíveis com motivo), acessibilidade e 375 px         | nenhum                      | D1, D2, D3           |
| 2 — Cadastro em quatro etapas                   | a Nova admissão reorganizada nas quatro etapas (contatos na etapa 1), sem campo novo; validação por etapa; progresso; navegação; confirmação da T179 | nenhum                      | D5, D6, D7           |
| 3 — Busca nas referências e seletor pesquisável | `busca` nos quatro `GET`; seletor com busca em Departamento, Cargo, Unidade e Centro de custo na admissão                                            | aditivo + E2E               | D8                   |
| 4 — Criação inline                              | "+ Criar «termo»" para RH, com o código conforme a opção escolhida, 409 com campo e nome normalizado                                                 | aditivo + E2E               | D8, D9               |
| 5 — Aprendiz                                    | novo tipo de vínculo com as regras da seção 5.1                                                                                                      | enum, migration, E2E        | D16 (aprovada), D21  |
| 6 — Importar planilha                           | conforme 8.2                                                                                                                                         | contrato + ficha            | D10, D11, D12, ficha |
| 7 — Admissão digital                            | conforme 8.3                                                                                                                                         | schema + contratos + fichas | gates de 8.3         |

Fora do plano (módulos futuros, cada um com decisão própria): nível, escala de
trabalho, conselho e registro, gestor direto, salário, documentos.

**Recomendação:** começar pela **fatia 1**, depois a 2 — as duas só web, sem
contrato, e juntas já dão a experiência de entrada guiada.

## 13. Estratégia de testes (por fatia)

- **Web (Vitest):** foco ao abrir e ao fechar (volta ao botão de origem), Esc,
  teclado nos cartões, motivos de indisponibilidade lidos, navegação entre
  etapas, validação por etapa, anúncios únicos, 375 px pelo CSS, edição
  pendente e troca de empresa.
- **E2E com PostgreSQL real:** para cada contrato novo — `busca` (isolamento
  por empresa, master global e com empresa ativa, perfis negados), criação sem
  código (geração, colisão, unicidade por empresa, 409 com campo), nome
  normalizado; admissão completa continua verde.
- **Navegador (`[T194 dev]` ou da fatia):** RH, DP e `master_tecnico`; rota
  direta; troca de empresa com o painel e com a admissão abertos; sessão
  expirada; CSRF; falha de rede simulada; 375 px; só dados sintéticos.

## 14. Decisões

**Decididas em 2026-10-28:**

- **D14** — observação das etapas 2 a 4 com CPF sintético autorizado
  (digitado pela proprietária); feita e registrada na seção 3.
- **D15** — e-mail pessoal, celular e telefone ficam na etapa 1.
- **D16** — Aprendiz entra como tipo de vínculo, em entrega futura própria
  (seção 5.1).

**Pendentes antes de qualquer código de produto:**

1. **D1 — Primeira fatia:** começar pelo painel lateral (recomendado).
2. **D2 — Nome do botão:** "Adicionar colaborador" (substitui "Nova
   admissão" como ponto de entrada) ou manter "Nova admissão".
3. **D3 — Formas indisponíveis no painel:** visíveis com o motivo
   (recomendado) ou ocultas.
4. **D4 — Área:** "não aprovada" significa só "sem criação inline" (Área
   continua como seleção opcional, recomendado) ou retirar Área da admissão.
5. **D5 — Etapa 4 sem documentos:** mostrar o bloco "Documentos —
   indisponível" com a revisão final (recomendado) ou só a revisão.
6. **D6 — Estado civil:** manter texto livre (recomendado agora) ou lista
   fechada (exige revisão da ficha da T177).
7. **D7 — Rascunho:** nenhum nesta fase (recomendado) ou rascunho no servidor
   (schema e ficha).
8. **D8 — Busca nas referências:** aprovar `busca` aditiva nos quatro `GET`
   (recomendado).
9. **D9 — Código na criação inline:** G1 servidor deriva do nome
   (recomendado), G2, G3 ou G4; e se "Criar" pede confirmação inline
   (recomendado) ou cria direto, como na referência.
10. **D10 — Formato da importação:** CSV apenas (recomendado) ou também .xlsx.
11. **D11 — Gravação da importação:** uma admissão por linha com chave própria
    (recomendado) ou lote no servidor.
12. **D12 — Quem importa e o limite de linhas.**
13. **D13 — Admissão digital:** confirmar que segue bloqueada até as decisões
    de 8.3 (recomendado), sem código antes disso.
14. **D17 — Nível (senioridade):** módulo futuro próprio ou fora do produto.
15. **D18 — Part-time, freelancer e trainee:** tipos de vínculo, atributos
    (jornada, programa) ou fora do produto.
16. **D19 — Conselho e registro profissional:** módulo futuro com ficha de
    tratamento ou fora do produto.
17. **D20 — Estado no endereço:** manter texto ou adotar lista de UF
    (o CEP já devolve a UF).
18. **D21 — Regras do Aprendiz:** aprovar a lista da seção 5.1 como roteiro da
    entrega própria (prazo, idade, programa, jornada, término, cota).
