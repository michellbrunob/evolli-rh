/**
 * T215 — aba "Férias e ausências" da lista de Colaboradores, no desenho da
 * referência: os quatro cartões (que ocupam o lugar dos cartões da lista),
 * a busca, os filtros Período, Tipo e Status, a engrenagem das políticas,
 * "Registrar ausência", a tabela com as ações por status e o estado vazio.
 */
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, EmptyState, StatusBadge } from "../../../components";
import type { StatusVariant } from "../../../components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui";
import {
  IconeAbrir,
  IconeBuscar,
  IconeCalendario,
  IconeConfiguracoes,
  IconeMaisAcoes,
} from "../../../ui/icones";
import { formatarDiaCivil } from "../../../format/data";
import { RegistrarAusenciaGaveta } from "./RegistrarAusenciaGaveta";
import {
  type AusenciaApi,
  type FiltroPeriodo,
  type FiltroStatus,
  type FiltroTipo,
  type IndicadoresDeAusencias,
  type ServicoDeAusencias,
  type StatusAusencia,
  OPCOES_DE_PERIODO,
  OPCOES_DE_STATUS,
  OPCOES_DE_TIPO,
  ROTULO_DO_STATUS,
  ROTULO_DO_TIPO,
} from "./tiposAusencia";
import "./FeriasEAusencias.css";

const TAMANHO_DA_PAGINA = 20;

const VARIANTE_DO_STATUS: Readonly<Record<StatusAusencia, StatusVariant>> = {
  aguardando_gestor: "warning",
  aguardando_rh: "warning",
  aprovada: "success",
  cancelamento_pedido: "warning",
  ajuste_sugerido: "info",
  recusada: "danger",
  cancelada: "neutral",
};

/** Os quatro cartões da aba (no lugar dos cartões da lista). */
export function CartoesDeAusencias({
  indicadores,
}: {
  readonly indicadores: IndicadoresDeAusencias | null;
}) {
  const base = useId();
  const cartoes = [
    ["Em férias agora", indicadores?.emFeriasAgora, "pessoas"],
    [
      "Licenças e afastamentos",
      indicadores?.licencasEAfastamentos,
      "em andamento",
    ],
    ["Faltas este mês", indicadores?.faltasEsteMes, "registradas"],
    ["Próximas férias", indicadores?.proximasFerias, "nos próximos 30 dias"],
  ] as const;
  return (
    <div className="ausencias-cartoes">
      {cartoes.map(([titulo, numero, sufixo], i) => (
        <div
          key={titulo}
          className="ausencias-cartoes__cartao"
          role="group"
          aria-labelledby={`${base}-${i}`}
        >
          <h3 id={`${base}-${i}`} className="ausencias-cartoes__titulo">
            {titulo}
          </h3>
          <p className="ausencias-cartoes__linha">
            <span className="ausencias-cartoes__numero">
              {numero === undefined ? "…" : numero}
            </span>
            <span className="ausencias-cartoes__sufixo">{sufixo}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

/** Um filtro da barra: "Período: Todos", com a lista de escolha única. */
function FiltroDaBarra<T extends string>({
  rotulo,
  opcoes,
  valor,
  onEscolher,
}: {
  readonly rotulo: string;
  readonly opcoes: readonly {
    readonly valor: T | "";
    readonly rotulo: string;
  }[];
  readonly valor: T | "";
  readonly onEscolher: (valor: T | "") => void;
}) {
  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0]!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ausencias-barra__filtro"
        aria-label={`${rotulo}: ${atual.rotulo}`}
      >
        <span className="ausencias-barra__filtro-rotulo">{rotulo}:</span>
        <strong>{atual.rotulo}</strong>
        <IconeAbrir className="ausencias-barra__seta" tamanho={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="ausencias-barra__lista">
        <RadixMenu.RadioGroup
          value={valor}
          onValueChange={(v) => onEscolher(v as T | "")}
        >
          {opcoes.map((o) => (
            <RadixMenu.RadioItem
              key={o.valor || "todos"}
              value={o.valor}
              className="ausencias-barra__opcao"
            >
              {o.rotulo}
              <RadixMenu.ItemIndicator className="ausencias-barra__visto">
                ✓
              </RadixMenu.ItemIndicator>
            </RadixMenu.RadioItem>
          ))}
        </RadixMenu.RadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function periodoDaLinha(a: AusenciaApi): string {
  if (!a.fim) return `Desde ${formatarDiaCivil(a.inicio)} · sem data de volta`;
  const datas =
    a.inicio === a.fim
      ? formatarDiaCivil(a.inicio)
      : `${formatarDiaCivil(a.inicio)} – ${formatarDiaCivil(a.fim)}`;
  const dias = a.dias === 1 ? "1 dia" : `${a.dias} dias`;
  return a.diasVendidos > 0
    ? `${datas} · ${dias} + ${a.diasVendidos} vendidos`
    : `${datas} · ${dias}`;
}

/** As ações que cada status permite a quem decide. */
function acoesDoStatus(
  status: StatusAusencia,
): readonly ("aprovar" | "recusar" | "cancelar")[] {
  switch (status) {
    case "aguardando_rh":
    case "aguardando_gestor":
    case "ajuste_sugerido":
      return ["aprovar", "recusar", "cancelar"];
    case "cancelamento_pedido":
    case "aprovada":
      return ["cancelar"];
    default:
      return [];
  }
}

const ROTULO_DA_ACAO = {
  aprovar: "Aprovar",
  recusar: "Recusar",
  cancelar: "Cancelar",
} as const;

export function FeriasEAusenciasAba({
  servico,
  podeRegistrar,
  podeDecidir,
  onIndicadores,
  onPoliticas,
}: {
  readonly servico: ServicoDeAusencias;
  /** RH e DP registram; quem só lê vê a lista. */
  readonly podeRegistrar: boolean;
  readonly podeDecidir: boolean;
  /** Os cartões moram acima das abas: quem monta a página os desenha. */
  readonly onIndicadores?: (indicadores: IndicadoresDeAusencias) => void;
  readonly onPoliticas?: () => void;
}) {
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<FiltroPeriodo | "">("");
  const [tipo, setTipo] = useState<FiltroTipo | "">("");
  const [status, setStatus] = useState<FiltroStatus | "">("");
  const [pagina, setPagina] = useState(1);
  const [itens, setItens] = useState<readonly AusenciaApi[]>([]);
  const [total, setTotal] = useState(0);
  const [carga, setCarga] = useState<"carregando" | "dados" | "erro">(
    "carregando",
  );
  const [releitura, setReleitura] = useState(0);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [aviso, setAviso] = useState("");
  const onIndicadoresRef = useRef(onIndicadores);
  onIndicadoresRef.current = onIndicadores;

  // A busca vai pouco depois de a pessoa parar de digitar.
  useEffect(() => {
    const termo = buscaDigitada.trim();
    if (termo === busca) return;
    const espera = window.setTimeout(() => {
      setBusca(termo);
      setPagina(1);
    }, 350);
    return () => window.clearTimeout(espera);
  }, [buscaDigitada, busca]);

  useEffect(() => {
    const controle = new AbortController();
    setCarga("carregando");
    servico
      .listar(
        {
          pagina,
          tamanhoPagina: TAMANHO_DA_PAGINA,
          ...(busca ? { busca } : {}),
          ...(periodo ? { periodo } : {}),
          ...(tipo ? { tipo } : {}),
          ...(status ? { status } : {}),
        },
        { signal: controle.signal },
      )
      .then((resp) => {
        if (controle.signal.aborted) return;
        setItens(resp.itens);
        setTotal(resp.total);
        setCarga("dados");
        onIndicadoresRef.current?.(resp.indicadores);
      })
      .catch(() => {
        if (!controle.signal.aborted) setCarga("erro");
      });
    return () => controle.abort();
  }, [servico, pagina, busca, periodo, tipo, status, releitura]);

  const reler = useCallback(() => setReleitura((n) => n + 1), []);

  async function decidir(
    acao: "aprovar" | "recusar" | "cancelar",
    a: AusenciaApi,
  ) {
    setAviso("");
    try {
      if (acao === "aprovar") await servico.aprovar(a.id);
      else if (acao === "recusar") await servico.recusar(a.id);
      else await servico.cancelar(a.id);
      setAviso(
        acao === "aprovar"
          ? "Ausência aprovada."
          : acao === "recusar"
            ? "Ausência recusada."
            : "Ausência cancelada.",
      );
      reler();
    } catch {
      setAviso("Não foi possível concluir a ação. Tente de novo.");
    }
  }

  function trocarFiltro<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPagina(1);
    };
  }

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA));

  return (
    <div className="ausencias">
      <div className="ausencias-barra">
        <div className="ausencias-barra__busca">
          <span className="ausencias-barra__busca-icone" aria-hidden="true">
            <IconeBuscar tamanho={16} />
          </span>
          <input
            type="search"
            className="ausencias-barra__campo"
            placeholder="Buscar colaborador"
            aria-label="Buscar colaborador"
            value={buscaDigitada}
            onChange={(e) => setBuscaDigitada(e.target.value)}
          />
        </div>
        <FiltroDaBarra
          rotulo="Período"
          opcoes={OPCOES_DE_PERIODO}
          valor={periodo}
          onEscolher={trocarFiltro(setPeriodo)}
        />
        <FiltroDaBarra
          rotulo="Tipo"
          opcoes={OPCOES_DE_TIPO}
          valor={tipo}
          onEscolher={trocarFiltro(setTipo)}
        />
        <FiltroDaBarra
          rotulo="Status"
          opcoes={OPCOES_DE_STATUS}
          valor={status}
          onEscolher={trocarFiltro(setStatus)}
        />
        <span className="ausencias-barra__espaco" />
        {onPoliticas ? (
          <button
            type="button"
            className="ausencias-barra__engrenagem"
            aria-label="Políticas de férias"
            title="Políticas de férias"
            onClick={onPoliticas}
          >
            <IconeConfiguracoes tamanho={18} />
          </button>
        ) : null}
        {podeRegistrar ? (
          <Button onClick={() => setGavetaAberta(true)}>
            <IconeCalendario tamanho={18} />
            Registrar ausência
          </Button>
        ) : null}
      </div>

      {aviso ? (
        <p className="ausencias__aviso" role="status">
          {aviso}
        </p>
      ) : null}

      {carga === "erro" ? (
        <div className="ausencias__falha" role="alert">
          <p>Não foi possível carregar as ausências.</p>
          <Button variant="secondary" onClick={reler}>
            Tentar novamente
          </Button>
        </div>
      ) : carga === "carregando" && itens.length === 0 ? (
        <p className="ausencias__carregando" role="status">
          Carregando ausências…
        </p>
      ) : itens.length === 0 ? (
        <div className="ausencias__vazio">
          <EmptyState
            headingLevel={3}
            icon={<IconeCalendario tamanho={22} />}
            title="Nenhuma ausência registrada"
            description="Férias, licenças e faltas do time aparecem aqui assim que forem registradas."
            {...(podeRegistrar
              ? {
                  action: (
                    <Button onClick={() => setGavetaAberta(true)}>
                      <IconeCalendario tamanho={18} />
                      Registrar ausência
                    </Button>
                  ),
                }
              : {})}
          />
        </div>
      ) : (
        <TableContainer label="Férias e ausências">
          <Table>
            <TableCaption visible={false}>Férias e ausências</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="ausencias__so-leitor">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((a) => {
                const acoes = podeDecidir ? acoesDoStatus(a.status) : [];
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="ausencias__pessoa">
                        <span className="ausencias__nome">
                          {a.colaborador.nome}
                        </span>
                        <span className="ausencias__cargo">
                          {a.colaborador.cargo ?? "Sem cargo"}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>{ROTULO_DO_TIPO[a.tipo]}</TableCell>
                    <TableCell>{periodoDaLinha(a)}</TableCell>
                    <TableCell>
                      <StatusBadge variant={VARIANTE_DO_STATUS[a.status]}>
                        {ROTULO_DO_STATUS[a.status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {acoes.length > 0 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="ausencias__acoes"
                            aria-label={`Ações da ausência de ${a.colaborador.nome}`}
                          >
                            <IconeMaisAcoes tamanho={18} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {acoes.map((acao) => (
                              <DropdownMenuItem
                                key={acao}
                                onSelect={() => void decidir(acao, a)}
                              >
                                {ROTULO_DA_ACAO[acao]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {itens.length > 0 ? (
        <div className="ausencias__rodape">
          <p className="ausencias__resultados">
            {total === 1 ? "1 resultado" : `${total} resultados`}
          </p>
          {totalPaginas > 1 ? (
            <nav
              className="ausencias__paginacao"
              aria-label="Paginação de ausências"
            >
              <Button
                variant="secondary"
                aria-disabled={pagina <= 1}
                onClick={() => pagina > 1 && setPagina(pagina - 1)}
              >
                Página anterior
              </Button>
              <span>{`Página ${pagina} de ${totalPaginas}`}</span>
              <Button
                variant="secondary"
                aria-disabled={pagina >= totalPaginas}
                onClick={() => pagina < totalPaginas && setPagina(pagina + 1)}
              >
                Próxima página
              </Button>
            </nav>
          ) : null}
        </div>
      ) : null}

      <RegistrarAusenciaGaveta
        aberta={gavetaAberta}
        servico={servico}
        onFechar={() => setGavetaAberta(false)}
        onRegistrada={() => {
          setGavetaAberta(false);
          setAviso("Ausência registrada.");
          reler();
        }}
      />
    </div>
  );
}
