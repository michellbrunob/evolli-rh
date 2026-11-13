# ADR 0019 — Fundação de interface incremental: Tailwind 4 sem preflight, Radix e Lucide

- Status: **Aceito** em 2026-11-13 (ordem da proprietária na T209).
- Escopo: a camada interna de componentes da web (`apps/web/src/ui`) e a primeira tela adotada
  (Colaboradores). Não muda API, banco, permissões nem rotas.
- Relacionado: [dossiê da T209](../decisions/t209-dossie-colaboradores.md) (seção 25).

## Contexto

A web usa React 18, Vite e CSS próprio com tokens (`tokens.css`), sem biblioteca de componentes.
Os próximos módulos precisam de componentes acessíveis e reutilizáveis (menu, diálogo, painel
lateral, tooltip) sem reescrever o sistema atual e sem trocar a identidade do produto.

## Decisão

1. **Tailwind CSS 4** pelo plugin do Vite, **sem preflight** (nenhum reset global): só o tema e as
   utilidades, em camadas de cascata (`@layer theme, utilities`) e com **prefixo `ev`** (classes
   `ev:*`, variáveis `--ev-*`). O CSS atual, fora de camada, prevalece; nenhuma variável do tema
   colide com os tokens do Evolli. Entrada: `apps/web/src/ui/estilos.css`.
2. **Radix** só onde o comportamento acessível é difícil de acertar à mão: **menu**
   (`@radix-ui/react-dropdown-menu`), **diálogo e painel lateral** (`@radix-ui/react-dialog`) e
   **tooltip** (`@radix-ui/react-tooltip`). Abas ficam próprias (ativação manual; o Radix Tabs
   ativa no `mousedown` e duplicaria a ativação de quem pergunta antes de trocar).
3. **Lucide React** para ícones (decorativos, `aria-hidden`), importados um a um.
4. **Componentes próprios** em `src/ui`, inspirados na abordagem shadcn/ui e escritos no
   repositório, com os tokens do Evolli: Button, IconButton, Card, CardSection, Input, Select
   (nativos), Badge, Tabs, DropdownMenu, Dialog, Sheet, Tooltip e primitivas de tabela.
5. **Sem TanStack Table** por ora: a tabela atual não ordena, não seleciona e pagina no servidor.
6. **Adoção tela a tela:** só módulos abertos para evolução migram; os demais seguem com os
   componentes atuais (`src/components`).

## Dependências

Versões exatas, publicadas há pelo menos duas semanas na data da decisão:

| Pacote                          | Versão | Licença | Tipo            |
| ------------------------------- | ------ | ------- | --------------- |
| `@radix-ui/react-dialog`        | 1.3.1  | MIT     | produção        |
| `@radix-ui/react-dropdown-menu` | 2.2.1  | MIT     | produção        |
| `@radix-ui/react-tooltip`       | 1.4.1  | MIT     | produção        |
| `lucide-react`                  | 1.64.0 | ISC     | produção        |
| `tailwindcss`                   | 4.3.3  | MIT     | desenvolvimento |
| `@tailwindcss/vite`             | 4.3.3  | MIT     | desenvolvimento |

Compatíveis com React 18, Vite 5.4 e o Node 24 exigido pelo projeto. Nenhuma biblioteca visual
completa (Bootstrap, MUI, Ant Design).

## Consequências

- O comportamento de foco, teclado e camada dos menus e janelas passa a vir do Radix, com
  acréscimos do Evolli no próprio componente (foco no título, foco devolvido a quem abriu,
  guarda de alterações, seta para cima e Tab no menu).
- O fundo inerte do painel segue a regra do Radix: tudo é ocultado do leitor de tela, exceto
  regiões `aria-live` (anúncios), que continuam audíveis por desenho; a janela declara
  `aria-modal`.
- No ambiente de teste (jsdom), substitutos mínimos de `ResizeObserver`, `PointerEvent`, captura
  de ponteiro e `scrollIntoView` (`apps/web/src/test/setup.ts`).
