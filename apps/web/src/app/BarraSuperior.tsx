/**
 * T209 — barra superior fixa do shell.
 *
 * - **Esquerda:** botão da gaveta (só no celular), a marca do Evolli, o botão
 *   de recolher o menu (só no desktop) e a trilha da tela atual, derivada das
 *   rotas (`trilhaDoShell.ts`). Numa sub-página, o item do pai leva a ele.
 * - **Direita:** só a conta — avatar (a foto da própria conta, pela rota
 *   autenticada da T208, ou as iniciais do nome; sem nome, um avatar neutro),
 *   o nome de exibição e um menu (Radix) com Meu perfil, Segurança (quando o
 *   servidor informa MFA), Sessões ativas e Sair. Nunca e-mail, papel
 *   técnico, empresa ou identificador. Não há ajuda nem notificações no
 *   produto, então não há controles para eles.
 *
 * Não há Hub: a barra não oferece volta a ele.
 */
import { IconeAbrir, IconeConta } from "../ui/icones";
import { useState, type MutableRefObject, type ReactNode } from "react";
import { IconeModulo, type IconeModuloId } from "./IconeModulo";
import { urlDaFotoPropria } from "../api/usersClient";
import { iniciaisDe } from "../screens/configuracoes/nomeExibicao";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui";
import { MarcaEvolli } from "./marca/MarcaEvolli";
import type { ItemDaTrilha } from "./trilhaDoShell";
import { useComplementoDaTrilha } from "./trilhaComplementar";
import "./BarraSuperior.css";

/** O nome mostrado quando a conta não tem nome de exibição. */
export const NOME_SEM_EXIBICAO = "Minha conta";

export interface ContaDaBarra {
  readonly nomeExibicao: string | null;
  readonly fotoVersao: string | null;
}

export interface BarraSuperiorProps {
  /** Atributos de fundo inerte enquanto a gaveta modal está aberta. */
  readonly inerte?: Record<string, unknown>;
  /** Gaveta do celular. */
  readonly modoGaveta: boolean;
  readonly gavetaAberta: boolean;
  readonly botaoMenuRef: MutableRefObject<HTMLButtonElement | null>;
  readonly onAlternarGaveta: () => void;
  readonly iconeMenu: ReactNode;
  readonly trilha: readonly ItemDaTrilha[];
  /** O ícone do módulo, antes da trilha (decorativo). */
  readonly iconeDaTrilha?: IconeModuloId | null;
  readonly onNavegar: (destinoId: string) => void;
  /** Sem conta (sem sessão), não há controle de conta. */
  readonly conta: ContaDaBarra | null;
  readonly mfaDisponivel: boolean;
  readonly onMeuPerfil: () => void;
  readonly onSeguranca: () => void;
  readonly onSessoesAtivas: () => void;
  readonly onSair: () => void;
}

function AvatarDaConta({ conta }: { readonly conta: ContaDaBarra }) {
  // A foto pode falhar (sessão trocada, rede): cai nas iniciais.
  const [falhou, setFalhou] = useState<string | null>(null);
  const foto =
    conta.fotoVersao !== null && falhou !== conta.fotoVersao
      ? conta.fotoVersao
      : null;
  return (
    <span className="barra-superior__avatar" aria-hidden="true">
      {foto !== null ? (
        <img
          src={urlDaFotoPropria(foto)}
          alt=""
          width={32}
          height={32}
          onError={() => setFalhou(foto)}
        />
      ) : conta.nomeExibicao !== null ? (
        <span className="barra-superior__iniciais">
          {/* Só do nome: sem nome, nada é derivado do e-mail. */}
          {iniciaisDe(conta.nomeExibicao, "")}
        </span>
      ) : (
        <IconeConta tamanho={22} />
      )}
    </span>
  );
}

export function BarraSuperior({
  inerte,
  modoGaveta,
  gavetaAberta,
  botaoMenuRef,
  onAlternarGaveta,
  iconeMenu,
  trilha: trilhaDaRota,
  iconeDaTrilha = null,
  onNavegar,
  conta,
  mfaDisponivel,
  onMeuPerfil,
  onSeguranca,
  onSessoesAtivas,
  onSair,
}: BarraSuperiorProps) {
  // T209 — o nível que a página declarou (o nome na ficha): entra no fim, e
  // o último nível da rota vira a volta para ele.
  const complemento = useComplementoDaTrilha();
  const trilha: readonly ItemDaTrilha[] = complemento
    ? [
        ...trilhaDaRota.slice(0, -1),
        ...trilhaDaRota.slice(-1).map((item) => ({
          ...item,
          onSelecionar: complemento.onVoltar,
        })),
        { rotulo: complemento.rotulo },
      ]
    : trilhaDaRota;
  const nome = conta?.nomeExibicao ?? NOME_SEM_EXIBICAO;
  return (
    <header className="barra-superior app-shell__topbar" {...inerte}>
      <div className="barra-superior__grupo barra-superior__grupo--inicio">
        <button
          type="button"
          className="app-shell__menu"
          ref={botaoMenuRef}
          aria-expanded={gavetaAberta}
          aria-controls="navegacao-lateral"
          onClick={onAlternarGaveta}
        >
          {iconeMenu}
          Menu
        </button>

        {/* No desktop a marca mora no topo da faixa, na mesma linha; no
            celular (faixa em gaveta) ela vem para a barra. */}
        {modoGaveta ? (
          <span className="barra-superior__marca">
            <MarcaEvolli simboloAte={400} />
          </span>
        ) : null}

        {trilha.length > 0 ? (
          <>
            {iconeDaTrilha ? (
              <span className="barra-superior__trilha-icone" aria-hidden="true">
                <IconeModulo nome={iconeDaTrilha} />
              </span>
            ) : null}
            <nav className="barra-superior__trilha" aria-label="Trilha">
              <ol>
                {trilha.map((item, i) => {
                  const ultimo = i === trilha.length - 1;
                  return (
                    <li key={`${i}-${item.rotulo}`}>
                      {(item.destinoId || item.onSelecionar) && !ultimo ? (
                        <button
                          type="button"
                          className="barra-superior__trilha-link"
                          onClick={() =>
                            item.onSelecionar
                              ? item.onSelecionar()
                              : onNavegar(item.destinoId!)
                          }
                        >
                          {item.rotulo}
                        </button>
                      ) : (
                        <span
                          className="barra-superior__trilha-item"
                          {...(ultimo
                            ? { "aria-current": "page" as const }
                            : {})}
                        >
                          {item.rotulo}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          </>
        ) : null}
      </div>

      {conta ? (
        <div className="barra-superior__grupo barra-superior__grupo--fim">
          <span className="barra-superior__separador" aria-hidden="true" />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="barra-superior__conta"
              aria-label={`Conta: ${nome}`}
            >
              <AvatarDaConta conta={conta} />
              <span className="barra-superior__nome">{nome}</span>
              <IconeAbrir className="barra-superior__seta" tamanho={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onMeuPerfil}>
                Meu perfil
              </DropdownMenuItem>
              {mfaDisponivel ? (
                <DropdownMenuItem onSelect={onSeguranca}>
                  Segurança
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={onSessoesAtivas}>
                Sessões ativas
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSair}>Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </header>
  );
}
