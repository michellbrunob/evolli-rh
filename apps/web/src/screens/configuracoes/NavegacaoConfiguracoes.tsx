/**
 * T209 — a navegação interna de Configurações: "Sua conta" (Meu perfil e,
 * desde a T210, Aparência) e,
 * para quem alcança empresas, "Empresa" (Empresas). Só itens com tela; links
 * pela rota, como o resto do shell.
 */
import type { ReactNode } from "react";
import { IconeAparencia, IconeEmpresa, IconePerfil } from "../../ui/icones";
import "./NavegacaoConfiguracoes.css";

export type ItemDeConfiguracoes = "meu-perfil" | "aparencia" | "empresas";

const GRUPO_SUA_CONTA_ID = "configuracoes-grupo-sua-conta";
const GRUPO_EMPRESA_ID = "configuracoes-grupo-empresa";

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

export function NavegacaoConfiguracoes({
  atual,
  mostrarEmpresas = false,
}: {
  readonly atual: ItemDeConfiguracoes;
  readonly mostrarEmpresas?: boolean;
}) {
  return (
    <nav className="configuracoes__navegacao" aria-label="Configurações">
      <p className="configuracoes__grupo" id={GRUPO_SUA_CONTA_ID}>
        Sua conta
      </p>
      <ul className="configuracoes__itens" aria-labelledby={GRUPO_SUA_CONTA_ID}>
        <Item
          href="#/configuracoes/meu-perfil"
          atual={atual === "meu-perfil"}
          icone={<IconePerfil />}
        >
          Meu perfil
        </Item>
        <Item
          href="#/configuracoes/aparencia"
          atual={atual === "aparencia"}
          icone={<IconeAparencia />}
        >
          Aparência
        </Item>
      </ul>
      {mostrarEmpresas ? (
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
              href="#/configuracoes/empresas"
              atual={atual === "empresas"}
              icone={<IconeEmpresa />}
            >
              Empresas
            </Item>
          </ul>
        </>
      ) : null}
    </nav>
  );
}
