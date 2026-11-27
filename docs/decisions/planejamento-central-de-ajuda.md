# Planejamento — Central de ajuda (FAQ, base de conhecimento e tutoriais)

- **Status:** decidido, não iniciado.
- **Data da decisão:** 2026-11-25.
- **Ordem:** é a **última entrega antes de liberar o Evolli para produção**.
  Vem depois de fechar os módulos em andamento, do pente fino e da entrega
  de versão e novidades (`planejamento-operacao-versoes-e-novidades.md`).

## Por que por último

O conteúdo de ajuda descreve telas, textos e fluxos. Escrever antes de as
telas estabilizarem gera texto desatualizado. Feita por último, a ajuda
nasce igual ao sistema que vai para produção.

## O que entra

1. **Perguntas frequentes (FAQ):** respostas curtas por módulo (Colaboradores,
   Escala de trabalho, Férias e ausências, Documentos, Configurações).
2. **Base de conhecimento:** artigos por tarefa ("Como publicar a escala",
   "Como cadastrar um feriado local", "Como salvar uma visão dos filtros"),
   com busca.
3. **Tutoriais:** passo a passo das tarefas principais, para o primeiro uso de
   cada perfil (dono, RH, DP, gestor, colaborador no portal).
4. **Ajuda no contexto:** atalho "Ajuda" nas telas, abrindo o artigo da tela
   atual.

## Diretrizes

- Linguagem própria do Evolli, português brasileiro, com plural e concordância
  certos; nada copiado de terceiros (textos, imagens, marca ou layout).
- Visual no padrão do sistema (`docs/DESIGN-SYSTEM-EVOLLI.md`): temas,
  acessibilidade, teclado e leitor de tela.
- Conteúdo versionado no repositório, ligado à versão do sistema (as
  Novidades apontam para os artigos novos ou alterados).
- Imagens só com dados sintéticos; nunca dado pessoal real.
- Cada artigo diz para quais perfis vale (permissões).
- Testes focados: busca, abertura pelo atalho da tela, acessibilidade e
  artigo inexistente.

## Antes de começar

- Conferir a lista final de módulos que vão para produção.
- Levantar as dúvidas recorrentes da validação com o gestor.
- Definir onde a central fica no menu (sugestão: menu da conta e
  Configurações › Ajuda).
