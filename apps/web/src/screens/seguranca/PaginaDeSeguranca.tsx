/**
 * T215 — a moldura do módulo Segurança, no mesmo desenho de Configurações:
 * título do módulo (o `h1` que recebe o foco), navegação interna e o painel
 * da tela escolhida (que traz o próprio `h2`).
 */
import type { ReactNode } from "react";
import { PageHeader } from "../../components";
import { NavegacaoSeguranca, type ItemDeSeguranca } from "./NavegacaoSeguranca";
import "./PaginaDeSeguranca.css";

/** `id` do `h1` do módulo — o título que recebe o foco ao abrir. */
export const SEGURANCA_TITULO_ID = "seguranca-titulo";

export function PaginaDeSeguranca({
  atual,
  mostrarPermissoes = false,
  children,
}: {
  readonly atual: ItemDeSeguranca;
  readonly mostrarPermissoes?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className="configuracoes">
      <PageHeader
        headingLevel={1}
        titleId={SEGURANCA_TITULO_ID}
        title="Segurança"
        description="As sessões da sua conta e quem acessa o Evolli."
      />
      <div className="configuracoes__corpo">
        <NavegacaoSeguranca
          atual={atual}
          mostrarPermissoes={mostrarPermissoes}
        />
        <div className="seguranca__painel">{children}</div>
      </div>
    </div>
  );
}
