/**
 * PainelNavigation (T044) — navegação visual do painel administrativo.
 *
 * Lista os oito destinos previstos para o painel (Início, Cadastros,
 * Pessoas, Ponto, Documentos, Portal do Colaborador, Solicitações,
 * Relatórios), sem rota real: a navegação troca apenas o
 * estado local de "destino selecionado" — não há React Router, `history`,
 * `<a href>` real, API nem fetch. É coerente com
 * `docs/modules/painel-administrativo-web-v1.md` (§3.6): a ocultação/seleção
 * de item é conveniência de interface, nunca controle de autorização — cada
 * tela futura seguirá dependendo da decisão do servidor.
 *
 * Layout responsivo por CSS apenas: a MESMA lista de botões vira uma barra
 * lateral vertical em telas largas e uma faixa horizontal (com rolagem
 * própria, contida) em telas estreitas — nunca dois DOMs paralelos, para não
 * duplicar a ordem de tabulação.
 *
 * Item ativo nunca depende só de cor: usa `aria-current="page"` (semântica),
 * peso de fonte maior e uma barra lateral sólida (forma), reforçando o
 * mesmo princípio já usado no `StatusBadge` (texto + glifo + cor).
 */
import "./PainelNavigation.css";

export interface DestinoPainel {
  readonly id: string;
  readonly label: string;
}

export const DESTINOS_PAINEL: readonly DestinoPainel[] = [
  { id: "inicio", label: "Início" },
  { id: "cadastros", label: "Cadastros" },
  { id: "pessoas", label: "Pessoas" },
  { id: "ponto", label: "Ponto" },
  { id: "documentos", label: "Documentos" },
  { id: "portal-colaborador", label: "Portal do Colaborador" },
  { id: "solicitacoes-rh", label: "Solicitações" },
  { id: "relatorios", label: "Relatórios" },
  // T121 — "Administração > Contas de acesso": único destino sem sub-rótulo
  // (sem abas locais), porque hoje só há uma tela administrativa. A
  // ocultação/seleção deste item continua sendo só conveniência de
  // interface (spec §3.6) — quem realmente decide o que aparece DENTRO da
  // tela é o backend, por papel (ver `ContasAcessoScreen`).
  { id: "contas-acesso", label: "Contas de acesso" },
  // T153 — "Minha equipe". Diferente de todos os anteriores, este destino é
  // CONDICIONAL: só entra na navegação quando o SERVIDOR informa um papel a
  // que o RBAC concede `gestor_equipe`/`read`. Ver `destinosCondicionais`
  // abaixo e o precedente `mfaDisponivel` (T131) — nunca uma flag de
  // frontend liga a capacidade. Continua valendo o §3.6: isto é conveniência
  // de interface, e quem decide de verdade é o backend.
  { id: "equipe", label: "Minha equipe" },
];

/** Sub-rótulo exibido junto ao destino quando ele já tem tela própria. Para
 * "cadastros", "pessoas", "ponto", "portal-colaborador" e "relatorios",
 * reflete a aba padrão mostrada ao selecionar o destino (T075/T073/T072/
 * T063/T067) — não a aba interna eventualmente ativa: a navegação aqui é só
 * a de destino principal, sem conhecer o estado local de abas de cada tela. */
const SUB_ROTULO: Record<string, string> = {
  inicio: "Visão geral",
  cadastros: "Horários",
  pessoas: "Colaboradores",
  ponto: "Visão do período",
  documentos: "Metadados",
  "portal-colaborador": "Visão geral — demonstração",
  "solicitacoes-rh": "Central do RH",
  relatorios: "Exceções de Ponto",
  equipe: "Consulta do gestor",
};

/**
 * Agrupamento da navegação (T142, direção visual B aprovada). Não muda destino
 * nem permissão: é só leitura — separa o que se opera no dia a dia do que é
 * administração. A ordem relativa muda apenas pelo agrupamento (T144, O1):
 * "Solicitações" sobe de 7º para 6º e "Portal do Colaborador" desce de 6º para
 * 7º, por caírem em grupos diferentes. Nenhum destino sai da lista: os nove
 * continuam presentes e alcançáveis. Os rótulos de grupo não são focáveis e
 * não entram na ordem de tabulação.
 */
const GRUPOS_NAVEGACAO: readonly {
  readonly titulo: string;
  readonly destinos: readonly string[];
}[] = [
  {
    titulo: "Operação",
    destinos: [
      "inicio",
      "cadastros",
      "pessoas",
      "ponto",
      "documentos",
      "solicitacoes-rh",
    ],
  },
  {
    titulo: "Consulta",
    destinos: ["portal-colaborador", "relatorios", "equipe"],
  },
  {
    titulo: "Administração",
    destinos: ["contas-acesso"],
  },
];

export interface PainelNavigationProps {
  destinoAtivoId: string;
  onSelecionar: (id: string) => void;
  /**
   * T153 — destinos condicionados a uma capacidade que o SERVIDOR concede.
   * Chave: id do destino. Ausente do mapa = incondicional (os nove de
   * sempre). Presente e `false` = não renderizado.
   *
   * Padrão `{}`: um destino condicional só some quando alguém diz
   * explicitamente `false`, e quem monta o shell parte de `false` até o
   * servidor confirmar — mesmo critério seguro de `mfaDisponivel`.
   */
  destinosCondicionais?: Readonly<Record<string, boolean>>;
}

export function PainelNavigation({
  destinoAtivoId,
  onSelecionar,
  destinosCondicionais = {},
}: PainelNavigationProps) {
  return (
    <nav className="painel-nav" aria-label="Navegação do painel">
      {GRUPOS_NAVEGACAO.map((grupo) => (
        <div className="painel-nav__grupo" key={grupo.titulo}>
          <p
            className="painel-nav__grupo-titulo"
            id={`nav-grupo-${grupo.titulo}`}
          >
            {grupo.titulo}
          </p>
          <ul
            className="painel-nav__lista"
            aria-labelledby={`nav-grupo-${grupo.titulo}`}
          >
            {grupo.destinos.map((id) => {
              const destino = DESTINOS_PAINEL.find((d) => d.id === id);
              if (!destino) return null;
              // Destino condicional não concedido pelo servidor: nem botão,
              // nem item de lista, nem posição na ordem de tabulação.
              if (destinosCondicionais[destino.id] === false) return null;
              const ativo = destino.id === destinoAtivoId;
              return (
                <li key={destino.id} className="painel-nav__item">
                  <button
                    type="button"
                    className={
                      ativo
                        ? "painel-nav__link painel-nav__link--ativo"
                        : "painel-nav__link"
                    }
                    aria-current={ativo ? "page" : undefined}
                    onClick={() => onSelecionar(destino.id)}
                  >
                    {SUB_ROTULO[destino.id] ? (
                      <>
                        <span className="painel-nav__link-grupo">
                          {destino.label}
                        </span>
                        <span className="painel-nav__link-sub">
                          {" "}
                          › {SUB_ROTULO[destino.id]}
                        </span>
                      </>
                    ) : (
                      destino.label
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
