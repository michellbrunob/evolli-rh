/**
 * T209 — a navegação interna de Configurações: "Sua conta" (Meu perfil) e,
 * para quem alcança empresas, "Empresa" (Empresas). Só itens com tela; links
 * pela rota, como o resto do shell.
 */
export type ItemDeConfiguracoes = "meu-perfil" | "empresas";

const GRUPO_SUA_CONTA_ID = "configuracoes-grupo-sua-conta";
const GRUPO_EMPRESA_ID = "configuracoes-grupo-empresa";

function Item({
  href,
  atual,
  children,
}: {
  readonly href: string;
  readonly atual: boolean;
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
        <Item href="#/configuracoes/meu-perfil" atual={atual === "meu-perfil"}>
          Meu perfil
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
            <Item href="#/configuracoes/empresas" atual={atual === "empresas"}>
              Empresas
            </Item>
          </ul>
        </>
      ) : null}
    </nav>
  );
}
