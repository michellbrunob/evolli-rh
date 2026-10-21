# Decisão — ViaCEP para preenchimento assistido de endereço (T178)

Status: **decidida pela proprietária em 2026-10-20.**
Tarefa que a implementa: T178 — Gestão de Pessoas → Colaboradores.
Relacionado:
[ficha de tratamento de dados pessoais e endereço](ficha-tratamento-dados-pessoais-endereco-colaborador.md)
(T177, aprovada),
[ADR 0016](../adr/0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md)
(`DP-ADM-12` — catálogos de localidade e consulta de endereço por CEP).

## 1. A decisão

> "Autorizo ViaCEP para preenchimento assistido de endereço, somente para CEP
> brasileiro, com campos editáveis e cadastro manual como alternativa."
> — proprietária, 2026-10-20

Resolve o `DP-ADM-12` **só** quanto à consulta de endereço por CEP brasileiro,
pelo ViaCEP. Catálogos de país, UF e município continuam pendentes.

## 2. Como a integração funciona

| Item                    | Regra                                                                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quem chama o fornecedor | **só a API do Evolli**, pela rota interna `GET /v1/cep/:cep`. O navegador nunca fala com o ViaCEP                                                                                                                                                                          |
| Fornecedor              | adaptador isolado (`apps/api/src/cep/viacep.adapter.ts`), atrás da interface `FornecedorCep`; trocar de fornecedor é trocar o adaptador                                                                                                                                    |
| Quem consulta           | quem admite: `rh` e `dp` (`colaborador`/`create`). Não é capacidade nova; `master_tecnico`, `gestor`, `colaborador` e demais são recusados antes de qualquer chamada                                                                                                       |
| Entrada                 | **só CEP brasileiro de 8 dígitos**, validado antes do fornecedor; fora disso, 400 sem chamada externa                                                                                                                                                                      |
| O que vai ao fornecedor | **só o CEP**, no caminho de um `GET` sem corpo, sem cookie e sem cabeçalho de identificação. Nenhum nome, CPF, telefone, e-mail, empresa ou usuário                                                                                                                        |
| Quando consulta         | só por ação explícita "Buscar CEP" ou ao sair do campo com CEP completo — nunca a cada tecla; só com País = Brasil                                                                                                                                                         |
| O que volta à tela      | sugestão de logradouro, bairro, cidade, UF e estado. País continua Brasil e editável; número e complemento são sempre manuais; todos os campos continuam editáveis                                                                                                         |
| Sobrescrita             | só campos **vazios** são preenchidos; campo já digitado é mantido, e a tela oferece substituí-lo por ação explícita                                                                                                                                                        |
| Falhas                  | CEP inexistente (404), fora da forma (400), limite (429) e fornecedor indisponível ou lento (503) têm mensagem clara; o cadastro manual continua funcionando                                                                                                               |
| Tempo e abuso           | timeout de 3 s; limite de 30 consultas por usuário em 10 minutos, em memória da instância (reinício zera; várias instâncias não somam — limitação aceita nesta primeira versão)                                                                                            |
| Persistência            | **nenhuma**: a resposta bruta não é guardada, não há cache de endereço em banco e não há consulta em lote. A resposta é reduzida aos campos da sugestão e descartada                                                                                                       |
| Registro                | uma linha de log técnico por consulta: fornecedor, resultado (`encontrado`, `inexistente`, `invalido`, `limite`, `timeout`, `falha`), duração e `requestId`. **Nenhum CEP nem endereço** no registro                                                                       |
| Log de requisições      | o log geral de requisições da API **não grava a URL** nem corpo, query ou parâmetros: só método, padrão da rota (`/v1/cep/:cep`, nunca o CEP), status, duração e `requestId`. Vale para toda rota — inclusive a `busca` da listagem de colaboradores, que não entra no log |
| Auditoria               | a consulta de CEP **não grava** `audit_event`. Uma tentativa **negada** pela autorização (papel sem permissão) grava o `authorization_denied` de sempre, só com ator, papel, empresa, resultado, IP, agente e `requestId` — **sem CEP, endereço, busca nem caminho**       |

## 3. Efeito na ficha de dados pessoais e endereço

- **Consulta de CEP:** passa de "nenhuma" a "ViaCEP, assistida, só CEP
  brasileiro".
- **Destinatários e compartilhamento externo:** o ViaCEP recebe **só o CEP**
  digitado — nenhum dado que identifique o colaborador. Nada mais sai.

## 4. O que esta decisão não autoriza

Outro fornecedor, consulta de CEP estrangeiro, catálogo de localidades,
consulta em lote, cache ou persistência da resposta, envio de qualquer dado
além do CEP, e qualquer outra integração externa.
