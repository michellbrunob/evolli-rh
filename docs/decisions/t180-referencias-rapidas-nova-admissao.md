# Decisão — cadastro rápido de referências na Nova admissão (T180)

Status: **decidida pela proprietária em 2026-10-23.**
Tarefa que a aplica: T180.
Relacionado: [decisão da T179](t179-confirmacao-admissao-duplicidade-telefones.md)
(decisão 7: "Adicionar" referências só do RH),
[decisão de obrigatoriedade](t179-obrigatoriedade-cadastro-colaborador.md)
(Departamento e Cargo obrigatórios; Unidade opcional),
[ADR 0017](../adr/0017-fluxo-admissao-vinculo-desligamento-rh-dp.md).

## 1. A decisão

Na página **Gestão de Pessoas › Colaboradores › Nova admissão**, o RH cadastra
**Departamento**, **Cargo** e **Unidade** sem sair do formulário e sem perder
nada do que já digitou.

| Ponto                | Regra                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quem vê o "+"        | Só **RH**. O DP seleciona referências existentes, mas não vê nem usa o botão. Os demais papéis continuam sem acesso à admissão                                                                                                               |
| Obrigatoriedade      | Inalterada: Departamento e Cargo obrigatórios; Unidade opcional                                                                                                                                                                              |
| Campos de cada modal | Só os mínimos do contrato atual: **código** (maiúsculas, dígitos e `_`, de 2 a 32 caracteres, imutável) e **nome** (até 160 caracteres). Nada de CBO, salário, descrição, atividades, hierarquia ou responsáveis                             |
| Empresa              | Sempre a da sessão. O cliente envia a empresa ativa que o próprio servidor informou, e o servidor a confere contra o escopo da sessão; outra empresa é negada com trilha                                                                     |
| Cancelar ou fechar   | Preserva integralmente a admissão em edição                                                                                                                                                                                                  |
| Erro                 | Validação ou código repetido na empresa aparecem no campo do modal, sem fechá-lo e sem perder a admissão                                                                                                                                     |
| Depois de salvar     | O seletor correspondente é atualizado na hora e a referência nova fica selecionada, sem recarregar a página                                                                                                                                  |
| Acessibilidade       | Modal curto, foco inicial no primeiro campo, Escape e "Cancelar" fecham, e o foco volta ao seletor; sem rolagem horizontal em tela pequena                                                                                                   |
| Permissões           | Inalteradas: a regra atual de estrutura organizacional (RH escreve na própria empresa; DP só lê; gestor, colaborador e financeiro não escrevem) já atende. Auditoria pelo padrão existente da estrutura (`organizacao_*_criado`), só com ids |
| Contrato e banco     | Sem migration e sem mudança de contrato: os endpoints `POST /v1/departamentos`, `/v1/cargos` e `/v1/unidades-organizacionais` já existem, com CSRF, permissão e trilha                                                                       |

A identidade visual é a do Evolli: nada de marca, cor, texto ou layout de
outro produto. As máscaras e os comportamentos já aprovados de CEP e telefones
não mudam.

## 2. Fora desta decisão

Documentos, CPF, dados bancários, dependentes, saúde, gênero, foto,
raça/etnia, dados trabalhistas detalhados, horário e fuso, telefone
estrangeiro e importação em massa. Área, Equipe e Centro de custo continuam sem
cadastro rápido. Nenhuma outra tarefa é aberta por esta decisão.
