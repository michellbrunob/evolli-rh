/**
 * T209 — menu "Ações" de uma linha da listagem de Colaboradores (C-4).
 *
 * Só atalhos às abas da ficha que o papel vê: nada edita, desliga ou age em
 * lote. Desde a fundação de interface da T209, sobre o `DropdownMenu` da
 * camada `src/ui` (Radix): botão de menu com nome próprio ("Ações: <nome>"),
 * `role="menu"` e `role="menuitem"`, setas com volta, Home, End e busca por
 * letra; seta para baixo (ou Enter, Espaço) abre no primeiro atalho, seta
 * para cima no último; Escape e clique fora fecham e devolvem o foco ao
 * botão. Escolher um atalho devolve o foco ao botão ANTES de abrir a ficha —
 * na volta da ficha, é ele que tem o foco. O menu vai para um portal: o
 * quadro da tabela, que rola, não o recorta.
 */
import { IconeAbrir } from "../../ui/icones";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui";

export interface AtalhoDaPessoa {
  readonly id: string;
  readonly rotulo: string;
  readonly aoEscolher: () => void;
}

export function MenuAcoesDaPessoa({
  nome,
  atalhos,
}: {
  /** Nome da pessoa da linha: "Ações: <nome>". */
  readonly nome: string;
  readonly atalhos: readonly AtalhoDaPessoa[];
}) {
  return (
    <div className="colaboradores-screen__acoes">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="colaboradores-screen__botao-acoes"
          aria-label={`Ações: ${nome}`}
        >
          Ações
          <IconeAbrir tamanho={14} />
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label={`Ações: ${nome}`}>
          {atalhos.map((atalho) => (
            <DropdownMenuItem key={atalho.id} onSelect={atalho.aoEscolher}>
              {atalho.rotulo}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
