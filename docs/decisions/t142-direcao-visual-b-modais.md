# Direção visual aprovada — alternativa B com modais (T142)

**Estado:** **aprovado** pelo proprietário, nos termos abaixo.

> **Padrão visual B com modais aprovado para o piloto de Colaboradores.
> Expansão para outras telas condicionada à decisão arquitetural sobre o
> Frappe.**

Esta aprovação é **visual**. Não autoriza merge, produção, migração, nem a
aplicação do padrão a qualquer outra tela.

> **Por que este arquivo existe, e não uma edição em `DESIGN-apple.md`.**
> Aquele arquivo é a referência visual externa, mantida **intacta byte a byte**
> por decisão do próprio projeto (T032; está em `.prettierignore` exatamente
> por isso). Editá-lo misturaria referência com decisão nossa. As decisões de
> design do Evolli RH vivem aqui e nos tokens/componentes, que continuam sendo
> a fonte de verdade executável.

## O que foi escolhido

Depois de duas propostas de alta fidelidade (protótipos estáticos em
`docs/prototipos/t142/`), o proprietário escolheu a **alternativa B**, com uma
alteração explícita: **modais** no lugar do painel lateral e da folha inferior.

1. **Navegação lateral agrupada.** Coluna à esquerda, com rótulos de grupo
   (Operação, Consulta, Administração). Os destinos, a ordem e as permissões
   não mudam — o agrupamento é leitura, nunca controle de acesso.
2. **Densidade confortável.** Menos colunas visíveis, mais respiro por linha.
3. **Filtros organizados** em bloco próprio, acima da lista.
4. **Lista conforme a proposta B.**
5. **Cadastro, edição e detalhe em janelas modais.**

## Regras dos modais

Concentradas no componente `Modal` (`src/components/Modal.tsx`), para que
nenhuma tela reimplemente acessibilidade de janela:

- Centralizado no desktop, com largura por conteúdo (`media` para leitura,
  `larga` para formulário em duas colunas). Em 375 px ocupa a tela inteira,
  respeitando a área visível real (`dvh`, que acompanha o teclado virtual) e as
  áreas seguras do aparelho.
- Cabeçalho e ações fixos; **só o corpo rola**.
- Fundo sem rolagem e sem interação. **Clique no fundo não fecha**: num
  formulário longo isso descartaria trabalho sem aviso.
- `role="dialog"`, `aria-modal`, nome acessível vindo do título; foco inicial no
  título, foco **preso** enquanto aberto e devolvido a quem abriu.
- `Escape` fecha **quando é seguro**: durante um envio não fecha, e com
  alterações não salvas abre confirmação explícita **dentro da própria janela**
  (nunca `window.confirm`).
- Envio em curso: trava **síncrona** contra duplicação — `disabled` no botão
  depende do próximo render e deixa passar cliques no mesmo quadro (medido: três
  cliques, três requisições, antes da trava).
- Sucesso: fecha, atualiza a lista e anuncia por `role="status"`.
- Erro: mantém o que foi preenchido e marca **o campo que precisa de correção**.
- **Não empilha.** Detalhe e edição acontecem na mesma janela.
- **Não usar modal** para filtro, navegação ou ação simples que não precisa de
  janela.

## Limites

- Aplicado **apenas** em `Pessoas › Colaboradores` (piloto). A expansão para as
  demais telas está **condicionada à decisão arquitetural sobre o Frappe** —
  não é questão de aprovação visual, e sim de saber sobre qual base o produto
  vai crescer.
- Nenhuma cor, fonte, raio ou escala nova: só tokens de `app/tokens.css`.
- Nenhuma dependência nova. O `<dialog>` nativo foi descartado porque o suporte
  parcial no ambiente de teste custaria cobertura de comportamento.
- Contratos HTTP, regras de admissão e permissões intocados.
