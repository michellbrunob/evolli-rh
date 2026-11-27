/**
 * T215 — a navegação interna de Segurança, no mesmo desenho da de
 * Configurações: "Sua conta" (Sessões ativas, de toda conta) e, para quem
 * tem a capacidade das Contas de acesso, "Empresa" (Permissões de acesso).
 * Só itens com tela; links pela rota, como o resto do shell.
 */
import type { ReactNode } from "react";
import { IconePermissoes, IconeSessoes } from "../../ui/icones";
import "../configuracoes/MeuPerfilScreen.css";
import "../configuracoes/NavegacaoConfiguracoes.css";

export type ItemDeSeguranca = "sessoes-ativas" | "permissoes-de-acesso";

const GRUPO_SUA_CONTA_ID = "seguranca-grupo-sua-conta";
const GRUPO_EMPRESA_ID = "seguranca-grupo-empresa";

function Item({
  href,
  atual,
  icone,
  children,
}: {
  readonly href: string;
  readonly atual: boolean;
  readonly icone: ReactNode;
  readonly children: string;
}) {
  return (
    <li>
      <a
        className={
          atual
            ? "configuracoes__item configuracoes__item--atual"
            : "configuracoes__item"
        }
        href={href}
        {...(atual ? { "aria-current": "page" as const } : {})}
      >
        <span className="configuracoes__item-icone">{icone}</span>
        {children}
      </a>
    </li>
  );
}

export function NavegacaoSeguranca({
  atual,
  mostrarPermissoes = false,
}: {
  readonly atual: ItemDeSeguranca;
  /** A conta alcança as Contas de acesso (a capacidade de sempre). */
  readonly mostrarPermissoes?: boolean;
}) {
  return (
    <nav className="configuracoes__navegacao" aria-label="Segurança">
      <p className="configuracoes__grupo" id={GRUPO_SUA_CONTA_ID}>
        Sua conta
      </p>
      <ul className="configuracoes__itens" aria-labelledby={GRUPO_SUA_CONTA_ID}>
        <Item
          href="#/seguranca/sessoes-ativas"
          atual={atual === "sessoes-ativas"}
          icone={<IconeSessoes />}
        >
          Sessões ativas
        </Item>
      </ul>
      {mostrarPermissoes ? (
        <>
          <p
            className="configuracoes__grupo configuracoes__grupo--seguinte"
            id={GRUPO_EMPRESA_ID}
          >
            Empresa
          </p>
          <ul
            className="configuracoes__itens"
            aria-labelledby={GRUPO_EMPRESA_ID}
          >
            <Item
              href="#/seguranca/permissoes-de-acesso"
              atual={atual === "permissoes-de-acesso"}
              icone={<IconePermissoes />}
            >
              Permissões de acesso
            </Item>
          </ul>
        </>
      ) : null}
    </nav>
  );
}
