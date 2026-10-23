# Decisão — edição da ficha do colaborador por RH e DP (T181)

Status: **decidida pela proprietária em 2026-10-23.**
Tarefa que a aplica: T181.
Relacionado: [decisão da T179](t179-confirmacao-admissao-duplicidade-telefones.md)
(contatos opcionais, telefone brasileiro em `+55`, e-mail pessoal único na
empresa), [decisão de obrigatoriedade](t179-obrigatoriedade-cadastro-colaborador.md),
[ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md) (Emenda 2),
[ADR 0017](../adr/0017-fluxo-admissao-vinculo-desligamento-rh-dp.md).

## 1. A decisão

Em **Gestão de Pessoas › Colaboradores**, a ficha do colaborador passa a
permitir que RH e DP **completem e atualizem** os dados já aprovados e já
gravados, sem nenhum campo novo.

| Ponto                   | Regra                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blocos editáveis        | **Dados pessoais** complementares já existentes, **Endereço** e **Contatos**                                                                                                                           |
| Quem edita              | RH e DP, somente na **empresa ativa** da sessão                                                                                                                                                        |
| Sem permissão           | Leitura segura: perfil que o servidor recusa não vê valor nem botão de edição                                                                                                                          |
| Contatos                | Mantém o estado "Nenhum contato registrado" e as regras da T179 para adicionar e remover; concorrência continua protegida                                                                              |
| CEP                     | Preenchimento assistido pelo ViaCEP somente pelo servidor, campos editáveis e alternativa manual                                                                                                       |
| Formatos                | Máscaras de CEP e telefone, normalização brasileira `+55`, validações e mensagens acessíveis já aprovadas                                                                                              |
| Empresa                 | Sempre a da sessão; nenhum endereço, contato ou ficha vaza entre empresas                                                                                                                              |
| Auditoria               | A existente, com os nomes dos campos alterados, nunca valores pessoais                                                                                                                                 |
| Falhas                  | Sessão expirada, CSRF desatualizado, 403, 404, 409, rede e 5xx não perdem o que foi digitado, e nenhuma mensagem afirma gravação incerta                                                               |
| Interface               | Identidade do Evolli; edição por seção, com Salvar e Cancelar; Cancelar restaura o gravado; erro no campo, foco no primeiro erro; em 375 px sem rolagem horizontal e com controles de toque acessíveis |
| Imutáveis nesta tarefa  | Nome (fora a correção já existente na ficha), matrícula, tipo de vínculo, lotação, situação e datas da admissão                                                                                        |
| Contrato, banco e build | Sem schema, migration, seed, Docker, dependência ou lockfile novos                                                                                                                                     |

A referência funcional de mercado serve só para o comportamento; marca,
textos, cores e layout são do Evolli.

## 2. O que já existe e é reaproveitado

Leitura do código em `main` (`cf04afc`), sem mudança de contrato:

- `PUT /v1/colaboradores/:colaboradorId/dados-pessoais` grava o bloco
  `perfilPessoal` e/ou o bloco `endereco`; cada bloco enviado substitui o
  registro, e o ausente fica como está. A trilha registra os campos
  alterados, sem valores.
- `PUT /v1/colaboradores/:colaboradorId/contatos` grava os contatos; campo
  ausente fica como está, `null` remove. Salvamentos são serializados
  (`FOR NO KEY UPDATE`) e o e-mail pessoal é único na empresa.
- `GET /v1/cep/:cep` consulta o ViaCEP pelo servidor, com a capacidade de
  admitir (`colaborador:create`: RH e DP na própria empresa).
- As permissões de leitura e de edição de dados pessoais e de contatos são as
  **mesmas** para cada papel: quem lê, edita. A ficha mostra a edição só
  depois de uma leitura aceita pelo servidor.

## 3. Pontos de leitura técnica, sem mudança de regra

- **`master_tecnico`:** a regra existente (Emenda 2 da ADR 0012) já o deixa
  ler e editar dados pessoais e contatos, na empresa ativa quando há uma. A
  T181 não muda permissão: a ficha segue o que o servidor aceita. A consulta
  de CEP não é oferecida a ele, porque o servidor a recusaria; o endereço
  segue manual.
- **Data de nascimento:** é o campo obrigatório do bloco de dados pessoais e
  vai sempre junto quando o bloco é salvo. Não é data da admissão.
- **Sexo gravado fora da lista fechada** (cadastro anterior à T179): o
  servidor só aceita a lista; a ficha mostra o valor anterior e pede uma
  opção da lista, ou nenhuma, ao salvar o bloco.
