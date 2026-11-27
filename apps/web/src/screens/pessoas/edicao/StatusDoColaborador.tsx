/**
 * T215 — o Status no cabeçalho de "Editar colaborador", no desenho da
 * referência: "Status" ao lado de um botão com a bolinha da cor do status, o
 * nome e a seta; a lista com as cinco opções (Ativo, Férias, Afastado,
 * Inativo, Desligado), cada uma com a sua bolinha, o visto na atual e
 * "Desligado" em vermelho. Escolha única (`menuitemradio`): quem usa decide
 * o que cada escolha faz.
 */
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { useId } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../../ui";
import { IconeAbrir } from "../../../ui/icones";
import "./StatusDoColaborador.css";

export const OPCOES_STATUS = [
  { valor: "ativo", rotulo: "Ativo" },
  { valor: "ferias", rotulo: "Férias" },
  { valor: "afastado", rotulo: "Afastado" },
  { valor: "inativo", rotulo: "Inativo" },
  { valor: "desligado", rotulo: "Desligado" },
] as const;
export type StatusDoColaboradorValor = (typeof OPCOES_STATUS)[number]["valor"];

function Ponto({ valor }: { readonly valor: StatusDoColaboradorValor }) {
  return (
    <span
      className={`status-colaborador__ponto status-colaborador__ponto--${valor}`}
      aria-hidden="true"
    />
  );
}

function Visto() {
  return (
    <svg
      className="status-colaborador__visto"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 8.5l3.2 3L13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatusDoColaborador({
  valor,
  onEscolher,
  desabilitado = false,
}: {
  readonly valor: StatusDoColaboradorValor;
  readonly onEscolher: (valor: StatusDoColaboradorValor) => void;
  readonly desabilitado?: boolean;
}) {
  const idRotulo = useId();
  const atual =
    OPCOES_STATUS.find((o) => o.valor === valor) ?? OPCOES_STATUS[0];
  return (
    <div className="status-colaborador">
      <span id={idRotulo} className="status-colaborador__rotulo">
        Status
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="status-colaborador__botao"
          aria-label={`Status: ${atual.rotulo}`}
          disabled={desabilitado}
        >
          <Ponto valor={atual.valor} />
          <span className="status-colaborador__nome">{atual.rotulo}</span>
          <IconeAbrir className="status-colaborador__seta" tamanho={14} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="status-colaborador__lista">
          <RadixMenu.RadioGroup
            value={valor}
            onValueChange={(novo) => {
              if (novo !== valor) onEscolher(novo as StatusDoColaboradorValor);
            }}
          >
            {OPCOES_STATUS.map((o) => (
              <RadixMenu.RadioItem
                key={o.valor}
                value={o.valor}
                className={
                  o.valor === "desligado"
                    ? "status-colaborador__opcao status-colaborador__opcao--perigo"
                    : "status-colaborador__opcao"
                }
              >
                <Ponto valor={o.valor} />
                <span className="status-colaborador__nome">{o.rotulo}</span>
                <RadixMenu.ItemIndicator className="status-colaborador__indicador">
                  <Visto />
                </RadixMenu.ItemIndicator>
              </RadixMenu.RadioItem>
            ))}
          </RadixMenu.RadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
