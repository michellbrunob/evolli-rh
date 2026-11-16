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
import { ChevronDown, CircleUserRound } from "lucide-react";
import { useState, type MutableRefObject, type ReactNode } from "react";
import { urlDaFotoPropria } from "../api/usersClient";
import { iniciaisDe } from "../screens/configuracoes/nomeExibicao";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui";
import { MarcaEvolli } from "./IconeModulo";
import type { ItemDaTrilha } from "./trilhaDoShell";
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
  /** Recolher/expandir o menu (desktop). */
  readonly trilhoRecolhido: boolean;
  readonly botaoRecolherRef: MutableRefObject<HTMLButtonElement | null>;
  readonly controlaId: string;
  readonly onAlternarRecolhido: () => void;
  readonly iconeRecolher: ReactNode;
  readonly trilha: readonly ItemDaTrilha[];
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
        <CircleUserRound size={22} strokeWidth={1.6} aria-hidden="true" />
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
  trilhoRecolhido,
  botaoRecolherRef,
  controlaId,
  onAlternarRecolhido,
  iconeRecolher,
  trilha,
  onNavegar,
  conta,
  mfaDisponivel,
  onMeuPerfil,
  onSeguranca,
  onSessoesAtivas,
  onSair,
}: BarraSuperiorProps) {
  const nome = conta?.nomeExibicao ?? NOME_SEM_EXIBICAO;
  const rotuloRecolher = trilhoRecolhido ? "Expandir menu" : "Recolher menu";
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

        <span className="barra-superior__marca">
          <MarcaEvolli />
          <span className="barra-superior__marca-nome">Evolli RH</span>
        </span>

        {/* T206 — um nó só nos dois estados: o foco fica nele ao alternar. No
            modo gaveta ele sai da tabulação com `hidden`. */}
        <button
          type="button"
          ref={botaoRecolherRef}
          className="app-shell__recolher"
          aria-expanded={!trilhoRecolhido}
          aria-controls={controlaId}
          data-dica={rotuloRecolher}
          hidden={modoGaveta}
          onClick={onAlternarRecolhido}
        >
          {iconeRecolher}
          <span className="app-shell__oculto">{rotuloRecolher}</span>
        </button>

        {trilha.length > 0 ? (
          <>
            <span className="barra-superior__separador" aria-hidden="true" />
            <nav className="barra-superior__trilha" aria-label="Trilha">
              <ol>
                {trilha.map((item, i) => {
                  const ultimo = i === trilha.length - 1;
                  return (
                    <li key={`${i}-${item.rotulo}`}>
                      {item.destinoId && !ultimo ? (
                        <button
                          type="button"
                          className="barra-superior__trilha-link"
                          onClick={() => onNavegar(item.destinoId!)}
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
              <ChevronDown
                className="barra-superior__seta"
                size={16}
                aria-hidden="true"
              />
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
