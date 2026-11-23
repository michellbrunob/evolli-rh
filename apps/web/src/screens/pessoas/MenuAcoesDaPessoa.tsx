/**
 * T209 — menu "Ações" de uma linha da listagem de Colaboradores (C-4).
 * T215 — o "⋯" da linha: "Ver ficha" e, para quem edita, "Editar
 * colaborador". Nada desliga, exclui ou age em lote.
 *
 * Sobre o `DropdownMenu` da camada `src/ui` (Radix): botão de menu com nome
 * próprio ("Ações: <nome>", à vista só o "⋯"), `role="menu"` e
 * `role="menuitem"`, setas com volta, Home, End e busca por letra; seta para
 * baixo (ou Enter, Espaço) abre no primeiro item, seta para cima no último;
 * Escape e clique fora fecham e devolvem o foco ao botão. Escolher um item
 * devolve o foco ao botão ANTES de abrir a ficha — na volta, é ele que tem o
 * foco. O menu vai para um portal: o quadro da tabela, que rola, não o
 * recorta.
 */
import { IconeMaisAcoes, type IconeDoEcossistema } from "../../ui/icones";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui";

export interface AtalhoDaPessoa {
  readonly id: string;
  readonly rotulo: string;
  /** T215 — o ícone do item (decorativo; o nome é o rótulo). */
  readonly icone?: IconeDoEcossistema;
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
          <IconeMaisAcoes tamanho={18} />
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label={`Ações: ${nome}`}>
          {atalhos.map(({ id, rotulo, icone: Icone, aoEscolher }) => (
            <DropdownMenuItem key={id} onSelect={aoEscolher}>
              {Icone ? <Icone tamanho={18} /> : null}
              {rotulo}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
