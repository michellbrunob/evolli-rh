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
| Quem edita              | Só RH e DP, somente na **empresa ativa** da sessão. O `master_tecnico` **não edita** (só lê, como antes); a recusa é do servidor, e a ficha não lhe mostra Preencher, Editar, Salvar nem Cancelar      |
| Sem permissão           | Leitura segura: perfil que o servidor recusa não vê valor nem botão de edição                                                                                                                          |
| Contatos                | Mantém o estado "Nenhum contato registrado" e as regras da T179 para adicionar e remover; concorrência continua protegida                                                                              |
| CEP                     | Preenchimento assistido pelo ViaCEP somente pelo servidor, campos editáveis e alternativa manual                                                                                                       |
| Formatos                | Máscaras de CEP e telefone, normalização brasileira `+55`, validações e mensagens acessíveis já aprovadas                                                                                              |
| Empresa                 | Sempre a da sessão; nenhum endereço, contato ou ficha vaza entre empresas                                                                                                                              |
| Auditoria               | A existente, com os nomes dos campos alterados, nunca valores pessoais                                                                                                                                 |
| Falhas                  | Sessão expirada, CSRF desatualizado, 403, 404, 409, rede e 5xx não perdem o que foi digitado, e nenhuma mensagem afirma gravação incerta                                                               |
| Interface               | Identidade do Evolli; edição por seção, com Salvar e Cancelar; Cancelar restaura o gravado; erro no campo, foco no primeiro erro; em 375 px sem rolagem horizontal e com controles de toque acessíveis |
| Imutáveis nesta tarefa  | Nome (fora a correção já existente na ficha), matrícula, tipo de vínculo, lotação, situação e datas da admissão                                                                                        |
| Sexo legado             | Valor fora da lista fechada (cadastro anterior à T179) fica exatamente como está: aparece como "valor legado", só para leitura; mudar exige escolher Feminino, Masculino, Intersexo ou Não informar    |
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
- Até a T181, as permissões de leitura e de edição de dados pessoais e de
  contatos eram as mesmas para cada papel, inclusive o `master_tecnico`
  (Emendas 1 e 2 da ADR 0012).

## 3. Decisões complementares da proprietária (2026-10-23)

Tomadas depois da primeira versão da PR, ainda na T181.

1. **Edição da ficha só por RH e DP.** RH e DP leem e editam dados pessoais,
   endereço e contatos, só na empresa ativa. O `master_tecnico` **deixa de
   editar** essas categorias e mantém só a leitura que já tinha (sem empresa
   ativa, na empresa do vínculo; com empresa ativa, só nela). Isto restringe,
   para a edição, o que as Emendas 1 e 2 da ADR 0012 concediam; nenhuma
   permissão de nenhum perfil é ampliada. A recusa é do servidor
   (`evaluateContatos` e `evaluateDadosPessoais`, com a negação na trilha pelo
   recurso certo e sem valores); a tela só deixa de oferecer o que ele
   recusaria.
2. **Sexo legado preservado.** Um valor fora da lista fechada (cadastro
   anterior à T179) nunca é limpo, alterado, descartado nem convertido sem
   pedido:
   - aparece na ficha como "valor legado", só para leitura, com aviso de que
     novas escolhas seguem a lista atual;
   - salvar outro campo dos dados pessoais, ou o endereço, não o toca: na
     edição dos dados pessoais, sexo **ausente** do corpo mantém o gravado;
   - mudá-lo exige escolher uma opção da lista atual — Feminino, Masculino,
     Intersexo ou Não informar —; não há texto livre novo, e o seletor não
     oferece "vazio" para o legado;
   - valor fora da lista enviado direto à API é recusado com 400, sem eco do
     valor, e o gravado fica.

## 4. Pontos de leitura técnica

- **Data de nascimento:** é o campo obrigatório do bloco de dados pessoais e
  vai sempre junto quando o bloco é salvo. Não é data da admissão.
- **CEP:** a consulta exige a capacidade de admitir (`colaborador:create`):
  RH e DP, os mesmos que editam a ficha.
- **`null` explícito em sexo**, enviado direto à API, continua apagando o
  valor ("não informado"), como antes da T181; a ficha não o envia para um
  valor legado.
