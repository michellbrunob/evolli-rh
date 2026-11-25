/**
 * T215 — o quadro "Escala de trabalho" (semana e mês), no desenho da
 * referência: pessoas × dias, com o turno (cor, nome e horário; no mês, a
 * sigla), folga, DSR, "Escalados no dia", horas da pessoa e do grupo, meta do
 * mês, busca, agrupamento e paginação. Os dias saem dos padrões de escala de
 * cada pessoa (aba Escala da ficha), pela mesma regra.
 *
 * T215 (fase 2) — quem opera (rh, dp) clica na célula: o menu do dia
 * (turnos, Folga, DSR, Sobreaviso, Sobreaviso depois do turno, Dois turnos
 * no dia, Abrir detalhes, observação, Limpar) e o painel do dia gravam no
 * RASCUNHO, com o ponto de "mudança não publicada", o selo "Rascunho · N
 * mudanças não publicadas" e o aviso com Desfazer. Setas andam entre as
 * células; Enter abre o menu; Delete limpa o dia.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../../api/colaboradoresClient";
import {
  consultarQuadro,
  consultarVisoes,
  gravarDia,
  gravarDias,
  limparDia,
  limparDias,
  publicarEscala,
  salvarRegras,
  type DiaGravadoApi,
  type GravarDiaDto,
  type PessoaDoQuadroApi,
  type QuadroDaEscalaApi,
  type VisaoDoQuadroApi,
} from "../../../api/escalaClient";
import {
  listarTabelasHorario,
  type TabelaHorarioApi,
} from "../../../api/horariosClient";
import {
  listarUnidades,
  type UnidadeOrganizacionalApi,
} from "../../../api/organizacaoClient";
import {
  AvisoFlutuante,
  type ConteudoDoAviso,
} from "../../../ui/AvisoFlutuante";
import { Button } from "../../../components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui";
import {
  diaCivilDeHoje,
  diaDaSemanaEDiaMes,
  diaMesCurto,
  numeroDoDia,
} from "../../../format/data";
import { plural } from "../../../format/plural";
import {
  IconeAbrir,
  IconeAvancar,
  IconeAviso,
  IconeConfiguracoes,
  IconeRelogio,
  IconeRepetir,
  IconeBaixarArquivo,
  IconeBuscar,
  IconeCalendario,
  IconeComentario,
  IconeCopiar,
  IconeRemover,
  IconeTentarDeNovo,
  IconeInformacao,
  IconeFiltrar,
  IconeEstrela,
  IconeFechar,
  IconeMaisAcoes,
  IconeModelo,
  IconeVoltar,
} from "../../../ui/icones";
import { Esqueleto, Revelar } from "../../../ui/movimento";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../../pessoas/edicao/dadosProfissionais";
import { OPCOES_GENERO, OPCOES_NIVEL } from "../../pessoas/NovaAdmissaoScreen";
import { GavetaDoQuadro } from "./GavetaDoQuadro";
import { pedirSecaoDasRegras } from "./secaoDasRegras";
import {
  idsComAusencia,
  resumoDasAusencias,
  siglaDaAusencia,
  tituloDaAusencia,
  rotuloDaAusencia,
} from "./ausenciasDoQuadro";
import { DialogoGerenciarVisoes, DialogoSalvarVisao } from "./VisoesDoQuadro";
import {
  type AcaoDaCelula,
  MenuDaCelula,
  sobreavisoDepoisDoTurno,
} from "./MenuDaCelula";
import { type FocoDoPainel, PainelDoDia } from "./PainelDoDia";
import { DialogoPublicar } from "./DialogoPublicar";
import { PainelDeAvisos } from "./PainelDeAvisos";
import { DialogoExportar } from "./DialogoExportar";
import { lerAvisoDoQuadro, pedirModelo } from "./aplicarModelo";
import {
  type AvisoDaEscala,
  avisosPorCelula,
  calcularAvisos,
  feriadoDaPessoa,
  pessoasEm6x1NaTransicao,
} from "./avisosDaEscala";
import {
  DialogoDarFolga,
  DialogoLimparRascunho,
  DialogoRepetir,
  DialogoTrocarTurno,
} from "./DialogosEmMassa";
import {
  type PlanoDoLote,
  chaveDoDia,
  copiarDias,
  darFolga,
  pessoasDoLote,
  planoParaDesfazer,
  rascunhosDe,
  rascunhosPorChave,
  semanasAte,
} from "./acoesEmMassa";
import {
  type FiltrosDoQuadro,
  type RotulosDosCodigos,
  FILTROS_DO_QUADRO_VAZIOS,
  filtrar,
  filtrosAplicados,
  quantosFiltros,
} from "./filtrosDoQuadro";
import {
  diaDaSemana,
  feriadoDe,
  feriadoEstadualDe,
  formatarHoras,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import { corDoTurno, siglaDoNome } from "../turnos/turnos";
import {
  type Agrupamento,
  type CelulaDoQuadro,
  type GrupoDoQuadro,
  type TurnoDaCelula,
  type Visao,
  DIAS_CURTOS,
  LETRAS_DOS_DIAS,
  ROTULO_DO_AGRUPAMENTO,
  agrupar,
  buscar,
  celulaDoDia,
  deslocar,
  diasDoPeriodo,
  faixaDosPeriodos,
  iniciais,
  metaDoPeriodo,
  nomeDosGrupos,
  ordenar,
  periodoDa,
  periodosNoDia,
  rotuloDaEscala,
  tituloDoPeriodo,
} from "./quadroDaEscala";
import "./QuadroDaEscalaScreen.css";

export const QUADRO_ESCALA_TITULO_ID = "quadro-escala-titulo";

const POR_PAGINA = [10, 50, 100] as const;

const AGRUPAMENTOS: readonly Agrupamento[] = [
  "departamento",
  "unidade",
  "turno",
  "gestor",
  "nenhum",
];

const ROTULOS: RotulosDosCodigos = {
  tipo: (c) => (ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[c] ?? c,
  nivel: (c) => OPCOES_NIVEL.find((o) => o.codigo === c)?.rotulo ?? c,
  genero: (c) => OPCOES_GENERO.find((o) => o.codigo === c)?.rotulo ?? c,
};

type Carga =
  | { estado: "carregando" }
  | { estado: "erro"; semEmpresa: boolean }
  | { estado: "pronto"; dados: QuadroDaEscalaApi };

export interface QuadroDaEscalaScreenProps {
  /** "← Colaboradores". */
  readonly onVoltar?: () => void;
  readonly onAbrirTurnos?: () => void;
  /** Regras da escala (sub-página). */
  readonly onAbrirRegras?: () => void;
  /** Planejar a transição da EC 141/2026 (sub-página). */
  readonly onAbrirTransicao?: () => void;
  /** Aplicar modelo (página): o quadro deixa o filtro e a seleção. */
  readonly onAbrirModelo?: () => void;
  /**
   * Aberto pela ficha ("Abrir no quadro"): já filtra o departamento da
   * pessoa (na gaveta "Filtros", removível).
   */
  readonly colaboradorEmFoco?: string | null;
  /** Para testes: o dia de hoje. */
  readonly hoje?: string;
  /** rh e dp gravam no rascunho; os demais só consultam. */
  readonly podeOperar?: boolean;
  /** O nome da empresa ativa (no arquivo exportado). */
  readonly nomeDaEmpresa?: string | null;
  /** Avisos da CLT no arquivo exportado: só para o RH. */
  readonly podeExportarAvisos?: boolean;
}

/**
 * As pessoas com os dias de outro período (em consultas de até 42 dias),
 * juntando padrões e dias gravados de cada uma.
 */
async function pessoasDoPeriodo(
  de: string,
  ate: string,
): Promise<Map<string, PessoaDoQuadroApi>> {
  const m = new Map<string, PessoaDoQuadroApi>();
  for (let i = de; i <= ate;) {
    const f = [ate, somarDiasLocal(i, 41)].sort()[0]!;
    const q = await consultarQuadro(i, f);
    for (const p of q.pessoas) {
      const atual = m.get(p.colaboradorId);
      if (!atual) {
        m.set(p.colaboradorId, { ...p, dias: [...(p.dias ?? [])] });
        continue;
      }
      const escalas = [...atual.escalas];
      for (const e of p.escalas) {
        if (!escalas.some((x) => x.id === e.id)) escalas.push(e);
      }
      escalas.sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio));
      m.set(p.colaboradorId, {
        ...atual,
        escalas,
        dias: [...(atual.dias ?? []), ...(p.dias ?? [])],
      });
    }
    i = somarDiasLocal(f, 1);
  }
  return m;
}

function somarDiasLocal(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** O DTO que regrava um dia já gravado (o "Desfazer"). */
function dtoDoDia(
  g: DiaGravadoApi,
): Omit<GravarDiaDto, "colaboradorId" | "dia"> {
  return {
    tipo: g.tipo,
    tabelaHorarioId: g.turno?.id ?? null,
    periodos: g.periodos,
    intervaloMinutos: g.intervaloMinutos,
    sobreaviso: g.sobreaviso,
    unidadeOrganizacionalId: g.unidade?.id ?? null,
    observacao: g.observacao,
  };
}

const NOME_DO_TIPO: Readonly<Record<GravarDiaDto["tipo"], string>> = {
  trabalho: "Trabalho",
  folga: "Folga",
  dsr: "DSR",
  sobreaviso: "Sobreaviso",
};

function siglaDe(t: TurnoDaCelula): string {
  return t.sigla ?? siglaDoNome(t.nome);
}

/** "Comercial, 09:00–18:00" etc. — o que a célula diz a quem lê pela tela. */
export function descricaoDaCelula(
  c: CelulaDoQuadro,
  avisos: readonly AvisoDaEscala[] = [],
): string {
  const partes: string[] = [];
  switch (c.tipo) {
    case "trabalho":
      partes.push(
        c.turno
          ? `${c.turno.nome}, ${faixaDosPeriodos(c.periodos) || (c.horario ?? "")}`
          : c.periodos.length > 0
            ? `Trabalho, ${faixaDosPeriodos(c.periodos)}`
            : "Trabalho, sem turno fixo",
      );
      if (c.sobreaviso.length > 0) {
        partes.push(`sobreaviso ${faixaDosPeriodos(c.sobreaviso)}`);
      }
      break;
    case "sobreaviso":
      partes.push(`Sobreaviso, ${faixaDosPeriodos(c.periodos)}`);
      break;
    case "folga":
      partes.push("Folga");
      break;
    case "dsr":
      partes.push("DSR, descanso semanal remunerado");
      break;
    case "sem-escala":
      partes.push("Sem escala");
      break;
    case "fora":
      partes.push("Fora do vínculo");
      break;
    case "ausencia":
      partes.push(
        c.ausencia
          ? `${tituloDaAusencia(c.ausencia)}, aprovada`
          : "Ausência aprovada",
      );
      break;
  }
  if (c.observacao) partes.push(`observação: ${c.observacao}`);
  if (c.origem === "rascunho") partes.push("mudança não publicada");
  if (avisos.length > 0) {
    partes.push(
      `${avisos.length === 1 ? "1 aviso" : `${avisos.length} avisos`}: ${avisos
        .map((a) => a.titulo)
        .join("; ")}`,
    );
  }
  return partes.join(", ");
}

/** O ponto âmbar de "mudança não publicada" e o sinal de observação. */
function Marcas({
  c,
  avisos,
}: {
  c: CelulaDoQuadro;
  avisos: readonly AvisoDaEscala[];
}) {
  const categoria = avisos.some((a) => a.categoria === "atencao")
    ? "atencao"
    : avisos.some((a) => a.categoria === "conferir")
      ? "conferir"
      : "informativo";
  return (
    <>
      {avisos.length > 0 ? (
        <span
          className={`quadro__marca-aviso quadro__marca-aviso--${categoria}`}
          aria-hidden="true"
          title={avisos.map((a) => a.titulo).join("\n")}
        >
          <IconeInformacao tamanho={12} />
        </span>
      ) : null}
      {c.origem === "rascunho" ? (
        <span className="quadro__marca-rascunho" aria-hidden="true" />
      ) : null}
      {c.observacao ? (
        <span
          className="quadro__marca-observacao"
          aria-hidden="true"
          title={c.observacao}
        >
          <IconeComentario tamanho={12} />
        </span>
      ) : null}
    </>
  );
}

function CelulaDaSemana({
  c,
  avisos,
}: {
  c: CelulaDoQuadro;
  avisos: readonly AvisoDaEscala[];
}) {
  let conteudo: React.ReactNode = null;
  if (c.tipo === "trabalho") {
    conteudo = (
      <div className="quadro__turno">
        <span className="quadro__turno-nome">
          {c.turno ? (
            <span
              className="quadro__ponto"
              style={{ background: corDoTurno(c.turno.cor) }}
              aria-hidden="true"
            />
          ) : null}
          {c.turno ? c.turno.nome : "Trabalho"}
        </span>
        <span className="quadro__turno-horario">
          {c.horario ?? "Sem turno fixo"}
        </span>
        {c.sobreaviso.length > 0 ? (
          <span className="quadro__turno-horario quadro__turno-sobreaviso">
            {`+ sobreaviso ${faixaDosPeriodos(c.sobreaviso)}`}
          </span>
        ) : null}
      </div>
    );
  } else if (c.tipo === "sobreaviso") {
    conteudo = (
      <div className="quadro__descanso">
        <span className="quadro__descanso-nome quadro__sobreaviso-nome">
          Sobreaviso
        </span>
        <span className="quadro__turno-horario">{c.horario}</span>
      </div>
    );
  } else if (c.tipo === "dsr") {
    conteudo = (
      <div className="quadro__descanso">
        <span className="quadro__descanso-nome">DSR</span>
        <span className="quadro__turno-horario">Descanso</span>
      </div>
    );
  } else if (c.tipo === "folga") {
    conteudo = <span className="quadro__descanso-nome">Folga</span>;
  } else if (c.tipo === "ausencia" && c.ausencia) {
    // Ausência vence o turno: o tipo e "Aprovada", numa caixa neutra.
    conteudo = (
      <div className="quadro__ausencia">
        <span className="quadro__ausencia-nome">
          {rotuloDaAusencia(c.ausencia)}
        </span>
        <span className="quadro__turno-horario">Aprovada</span>
      </div>
    );
  } else if (c.tipo === "sem-escala") {
    // O "+" do dia vazio, ao passar o mouse ou no foco (só em quem edita).
    conteudo = <span className="quadro__mais">+</span>;
  }
  return (
    <>
      <span aria-hidden="true" className="quadro__conteudo">
        {conteudo}
      </span>
      <Marcas c={c} avisos={avisos} />
      <span className="sr-only">{descricaoDaCelula(c, avisos)}</span>
    </>
  );
}

function CelulaDoMes({
  c,
  avisos,
}: {
  c: CelulaDoQuadro;
  avisos: readonly AvisoDaEscala[];
}) {
  let sigla: React.ReactNode = null;
  if (c.tipo === "trabalho") {
    const t = c.turno;
    sigla = (
      <span
        className="quadro__sigla"
        style={t ? { color: corDoTurno(t.cor) } : undefined}
      >
        {t ? siglaDe(t) : "T"}
      </span>
    );
  } else if (c.tipo === "sobreaviso") {
    sigla = <span className="quadro__sigla quadro__sigla--sobreaviso">SA</span>;
  } else if (c.tipo === "dsr") {
    sigla = <span className="quadro__sigla quadro__sigla--dsr">D</span>;
  } else if (c.tipo === "ausencia" && c.ausencia) {
    sigla = (
      <span className="quadro__sigla quadro__sigla--ausencia">
        {siglaDaAusencia(c.ausencia)}
      </span>
    );
  } else if (c.tipo === "sem-escala") {
    sigla = <span className="quadro__mais">+</span>;
  }
  return (
    <>
      <span aria-hidden="true" title={descricaoDaCelula(c, avisos)}>
        {sigla}
      </span>
      <Marcas c={c} avisos={avisos} />
      <span className="sr-only">{descricaoDaCelula(c, avisos)}</span>
    </>
  );
}

/** T215 — a faixa da EC 141/2026 sobre o quadro (pessoas em 6x1). */
function FaixaDaTransicao({
  quantas,
  inicio,
  periodo,
  onTemosConvencao,
  onPlanejar,
}: {
  readonly quantas: number;
  readonly inicio: string;
  readonly periodo: string;
  readonly onTemosConvencao?: () => void;
  readonly onPlanejar?: () => void;
}) {
  return (
    <section
      className="quadro__faixa-transicao"
      aria-labelledby="quadro-faixa-transicao"
    >
      <div>
        <p id="quadro-faixa-transicao" className="quadro__faixa-titulo">
          {`A partir de ${diaMesCurto(inicio)}, a 6x1 só vale com convenção coletiva`}
        </p>
        <p className="quadro__faixa-texto">
          {`${quantas === 1 ? "1 pessoa está" : `${quantas} pessoas estão`} em 6x1 ${periodo}. A EC 141/2026 pede 2 descansos por semana e até 42 h.`}
        </p>
      </div>
      {onTemosConvencao ? (
        <div className="quadro__faixa-acoes">
          <Button type="button" variant="secondary" onClick={onTemosConvencao}>
            Já temos convenção
          </Button>
          {onPlanejar ? (
            <Button type="button" variant="primary" onClick={onPlanejar}>
              Planejar a transição
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function QuadroDaEscalaScreen({
  onVoltar,
  onAbrirTurnos,
  onAbrirRegras,
  onAbrirTransicao,
  onAbrirModelo,
  colaboradorEmFoco = null,
  hoje: hojeFixo,
  podeOperar = false,
  nomeDaEmpresa = null,
  podeExportarAvisos = false,
}: QuadroDaEscalaScreenProps) {
  const hoje = hojeFixo ?? diaCivilDeHoje();
  const [visao, setVisao] = useState<Visao>("semana");
  const [ancora, setAncora] = useState(hoje);
  const [tentativa, setTentativa] = useState(0);
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [busca, setBusca] = useState("");
  const [agruparPor, setAgruparPor] = useState<Agrupamento>("departamento");
  const [ordem, setOrdem] = useState<"asc" | "desc">("asc");
  const [porPagina, setPorPagina] = useState<number>(10);
  const [pagina, setPagina] = useState(1);
  const [recolhidos, setRecolhidos] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [filtros, setFiltros] = useState<FiltrosDoQuadro>(
    FILTROS_DO_QUADRO_VAZIOS,
  );
  const [gaveta, setGaveta] = useState(false);
  // Visões salvas (só da conta): carregadas uma vez; falha = nenhuma.
  const [visoes, setVisoes] = useState<VisaoDoQuadroApi[]>([]);
  const [salvarVisao, setSalvarVisao] = useState<FiltrosDoQuadro | null>(null);
  const [gerenciarVisoes, setGerenciarVisoes] = useState(false);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await consultarVisoes();
        if (vivo && r) setVisoes(r.visoes);
      } catch {
        // Sem visões: o quadro segue igual.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);
  const [turnos, setTurnos] = useState<TabelaHorarioApi[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOrganizacionalApi[]>([]);
  const [menu, setMenu] = useState<{
    colaboradorId: string;
    dia: string;
    ancora: HTMLElement;
    /** Aberto pelo teclado (Espaço): o foco vai ao primeiro item. */
    porTeclado?: boolean;
  } | null>(null);
  const [painel, setPainel] = useState<{
    colaboradorId: string;
    dia: string;
    foco: FocoDoPainel | null;
  } | null>(null);
  const pessoaDoPainel = useRef<PessoaDoQuadroApi | null>(null);
  const [aviso, setAviso] = useState<ConteudoDoAviso | null>(null);
  // Na volta do "Aplicar modelo": o aviso do que foi aplicado.
  useEffect(() => {
    const texto = lerAvisoDoQuadro();
    if (texto) setAviso({ id: Date.now(), titulo: texto });
  }, []);
  const [falha, setFalha] = useState<string | null>(null);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  /** O painel de avisos: de todo o filtro ou só das pessoas selecionadas. */
  const [vendoAvisos, setVendoAvisos] = useState<false | "todos" | "selecao">(
    false,
  );
  const focoPendente = useRef<string | null>(null);
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [dialogo, setDialogo] = useState<
    | { tipo: "trocar"; alvo: "selecao" }
    | { tipo: "folga"; alvo: "selecao" }
    | { tipo: "repetir" }
    | { tipo: "limpar"; alvo?: "selecao" }
    | { tipo: "exportar"; selecao?: boolean; cadaUma?: boolean }
    | null
  >(null);
  const tabelaRef = useRef<HTMLTableElement | null>(null);
  const focoAplicado = useRef(false);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);

  // T215 — a semana começa no dia das Regras (vem com o quadro).
  const [semanaComeca, setSemanaComeca] = useState(1);
  const { inicio, fim } = periodoDa(visao, ancora, semanaComeca);

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  useEffect(() => {
    let vivo = true;
    setCarga({ estado: "carregando" });
    consultarQuadro(inicio, fim).then(
      (dados) => {
        if (vivo) setCarga({ estado: "pronto", dados });
      },
      (erro: unknown) => {
        if (!vivo) return;
        setCarga({
          estado: "erro",
          semEmpresa: erro instanceof ApiError && erro.status === 403,
        });
      },
    );
    return () => {
      vivo = false;
    };
  }, [inicio, fim, tentativa]);

  // Turnos (ativos) e unidades (ativas) para o menu e o painel do dia.
  useEffect(() => {
    if (!podeOperar) return;
    let vivo = true;
    listarTabelasHorario({ ativo: true, tamanhoPagina: 100 }).then(
      (r) => {
        if (vivo) setTurnos(r.itens);
      },
      () => undefined,
    );
    listarUnidades({ status: "ativo", tamanhoPagina: 100 }).then(
      (r) => {
        if (vivo) setUnidades(r.itens);
      },
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [podeOperar]);

  /** Troca o rascunho do dia na tela (`null` = sem rascunho). */
  const trocarNoQuadro = (
    colaboradorId: string,
    dia: string,
    gravado: DiaGravadoApi | null,
  ) =>
    setCarga((atual) => {
      if (atual.estado !== "pronto") return atual;
      return {
        estado: "pronto",
        dados: {
          ...atual.dados,
          pessoas: atual.dados.pessoas.map((p) =>
            p.colaboradorId !== colaboradorId
              ? p
              : {
                  ...p,
                  dias: [
                    ...(p.dias ?? []).filter(
                      (d) => !(d.dia === dia && d.camada === "rascunho"),
                    ),
                    ...(gravado ? [gravado] : []),
                  ],
                },
          ),
        },
      };
    });

  const rascunhoDe = (p: PessoaDoQuadroApi, dia: string) =>
    (p.dias ?? []).find((d) => d.dia === dia && d.camada === "rascunho") ??
    null;

  /**
   * Executa um lote no rascunho e oferece Desfazer (regrava o rascunho que
   * cada dia tinha, ou o limpa). Depois, o quadro recarrega.
   */
  const executarLote = async (
    plano: PlanoDoLote,
    anteriores: ReadonlyMap<string, DiaGravadoApi>,
    titulo: string,
    /** O aviso quando nada muda (sem "Desfazer"). */
    semMudanca = "Nada mudou no rascunho.",
  ) => {
    // Só limpa o que tem rascunho.
    const limpar = plano.limpar.filter((d) =>
      anteriores.has(chaveDoDia(d.colaboradorId, d.dia)),
    );
    const efetivo = { gravar: plano.gravar, limpar };
    if (efetivo.gravar.length === 0 && efetivo.limpar.length === 0) {
      setAviso({ id: Date.now(), titulo: semMudanca });
      return;
    }
    if (limpar.length > 0) await limparDias(limpar);
    if (plano.gravar.length > 0) await gravarDias(plano.gravar);
    setTentativa((n) => n + 1);
    const volta = planoParaDesfazer(efetivo, anteriores);
    setAviso({
      id: Date.now(),
      titulo,
      acao: {
        rotulo: "Desfazer",
        onClick: () =>
          void (async () => {
            setFalha(null);
            try {
              if (volta.limpar.length > 0) await limparDias(volta.limpar);
              if (volta.gravar.length > 0) await gravarDias(volta.gravar);
              setTentativa((n) => n + 1);
              setAviso({ id: Date.now(), titulo: "Ação desfeita" });
            } catch {
              setFalha("Não foi possível desfazer. Tente de novo.");
            }
          })(),
      },
    });
  };

  const copiarSemanaAnterior = async (alvo: readonly PessoaDoQuadroApi[]) => {
    const origem = dias.map((d) => somarDiasLocal(d, -7));
    const daOrigem = await pessoasDoPeriodo(
      origem[0]!,
      origem[origem.length - 1]!,
    );
    const plano = copiarDias(alvo, daOrigem, origem, dias);
    await executarLote(
      plano,
      rascunhosPorChave(alvo),
      `Semana anterior copiada para ${plural(alvo.length, "pessoa", "pessoas")}`,
      "Nada para copiar: a semana anterior está só no padrão.",
    );
  };

  const desfazer = async (
    p: PessoaDoQuadroApi,
    dia: string,
    anterior: DiaGravadoApi | null,
  ) => {
    setFalha(null);
    try {
      if (anterior) {
        const g = await gravarDia({
          ...dtoDoDia(anterior),
          colaboradorId: p.colaboradorId,
          dia,
        });
        trocarNoQuadro(p.colaboradorId, dia, g);
      } else {
        await limparDia(p.colaboradorId, dia);
        trocarNoQuadro(p.colaboradorId, dia, null);
      }
      setAviso({ id: Date.now(), titulo: "1 mudança desfeita" });
    } catch {
      setFalha("Não foi possível desfazer. Tente de novo.");
    }
  };

  /** Grava o dia no rascunho, com aviso e Desfazer. Erro sobe a quem chamou. */
  const gravar = async (
    p: PessoaDoQuadroApi,
    dia: string,
    dto: Omit<GravarDiaDto, "colaboradorId" | "dia">,
    nome: string,
  ) => {
    const anterior = rascunhoDe(p, dia);
    const g = await gravarDia({ ...dto, colaboradorId: p.colaboradorId, dia });
    trocarNoQuadro(p.colaboradorId, dia, g);
    setAviso({
      id: Date.now(),
      titulo: `${nome} em ${diaMesCurto(dia)} no rascunho`,
      acao: {
        rotulo: "Desfazer",
        onClick: () => void desfazer(p, dia, anterior),
      },
    });
  };

  const limpar = async (p: PessoaDoQuadroApi, dia: string) => {
    const anterior = rascunhoDe(p, dia);
    if (!anterior) return;
    await limparDia(p.colaboradorId, dia);
    trocarNoQuadro(p.colaboradorId, dia, null);
    setAviso({
      id: Date.now(),
      titulo: "Dia limpo no rascunho",
      acao: {
        rotulo: "Desfazer",
        onClick: () => void desfazer(p, dia, anterior),
      },
    });
  };

  const tentar = async (acao: () => Promise<void>) => {
    setFalha(null);
    try {
      await acao();
    } catch {
      setFalha("Não foi possível gravar o dia. Tente de novo.");
    }
  };

  const abrirPainel = (
    p: PessoaDoQuadroApi,
    dia: string,
    foco: FocoDoPainel | null,
  ) => {
    pessoaDoPainel.current = p;
    setPainel({ colaboradorId: p.colaboradorId, dia, foco });
  };

  const escolher = (
    p: PessoaDoQuadroApi,
    c: CelulaDoQuadro,
    acao: AcaoDaCelula,
  ) => {
    setMenu(null);
    const manter = { observacao: c.observacao };
    switch (acao.tipo) {
      case "turno": {
        const t = acao.turno;
        const ps = periodosNoDia(
          { ...t, intervaloMinutos: t.intervaloMinutos ?? 0 },
          c.dia,
        );
        // Sem horário neste dia, ou mais de 2 períodos: o RH ajusta no painel.
        if (ps.length === 0 || ps.length > 2) {
          abrirPainel(p, c.dia, "inicio");
          return;
        }
        void tentar(() =>
          gravar(
            p,
            c.dia,
            {
              tipo: "trabalho",
              tabelaHorarioId: t.id,
              periodos: ps.map((x) => ({ inicio: x.inicio, fim: x.fim })),
              intervaloMinutos: ps.length === 1 ? (t.intervaloMinutos ?? 0) : 0,
              sobreaviso: [],
              unidadeOrganizacionalId: c.unidade?.id ?? null,
              ...manter,
            },
            t.nome,
          ),
        );
        return;
      }
      case "folga":
      case "dsr":
        void tentar(() =>
          gravar(
            p,
            c.dia,
            { tipo: acao.tipo, ...manter },
            NOME_DO_TIPO[acao.tipo],
          ),
        );
        return;
      case "sobreaviso-depois": {
        const depois = sobreavisoDepoisDoTurno(c);
        if (!depois) return;
        void tentar(() =>
          gravar(
            p,
            c.dia,
            {
              tipo: "trabalho",
              tabelaHorarioId: c.turno?.id ?? null,
              periodos: [...c.periodos],
              intervaloMinutos: c.intervaloMinutos,
              sobreaviso: [depois],
              unidadeOrganizacionalId: c.unidade?.id ?? null,
              ...manter,
            },
            "Sobreaviso",
          ),
        );
        return;
      }
      case "sobreaviso":
        abrirPainel(p, c.dia, "sobreaviso");
        return;
      case "dois-turnos":
        abrirPainel(p, c.dia, "segundo-periodo");
        return;
      case "detalhes":
        abrirPainel(p, c.dia, null);
        return;
      case "observacao":
        abrirPainel(p, c.dia, "observacao");
        return;
      case "limpar":
        void tentar(() => limpar(p, c.dia));
        return;
    }
  };

  /** Setas, Home/End, Delete: o teclado do quadro (célula com foco itinerante). */
  const tecladoDaCelula = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    p: PessoaDoQuadroApi,
    c: CelulaDoQuadro,
  ) => {
    const alvo = e.currentTarget;
    const linha = Number(alvo.dataset.linha);
    const coluna = Number(alvo.dataset.coluna);
    let l = linha;
    let k = coluna;
    if (e.key === "ArrowRight") k += 1;
    else if (e.key === "ArrowLeft") k -= 1;
    else if (e.key === "ArrowDown") l += 1;
    else if (e.key === "ArrowUp") l -= 1;
    else if (e.key === "Home") k = 0;
    else if (e.key === "End") k = dias.length - 1;
    else if (e.key === "Enter") {
      // Atalho do menu: Enter abre os detalhes do dia (Espaço abre o menu).
      e.preventDefault();
      setMenu(null);
      abrirPainel(p, c.dia, null);
      return;
    } else if (e.key === "Delete" || e.key === "Backspace") {
      // Sem rascunho no dia, `limpar` não faz nada.
      e.preventDefault();
      void tentar(() => limpar(p, c.dia));
      return;
    } else return;
    e.preventDefault();
    const destino = tabelaRef.current?.querySelector<HTMLButtonElement>(
      `[data-linha="${l}"][data-coluna="${k}"]`,
    );
    if (destino) {
      setAtiva(destino.dataset.celula ?? null);
      destino.focus();
    }
  };

  useEffect(() => {
    if (selecionados.size === 0) return;
    const tecla = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !document.querySelector('[role="dialog"], [role="menu"]')
      ) {
        setSelecionados(new Set());
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [selecionados.size]);

  // O quadro recarregou (outro período ou depois de um lote): a célula de
  // origem do menu não existe mais.
  useEffect(() => {
    setMenu(null);
  }, [inicio, fim, tentativa]);

  // Depois de ir a um aviso: o foco vai à célula quando ela aparecer.
  useEffect(() => {
    const chave = focoPendente.current;
    if (!chave) return;
    const alvo = document.querySelector<HTMLElement>(
      `[data-celula="${chave}"]`,
    );
    if (alvo) {
      focoPendente.current = null;
      alvo.focus();
    }
  });

  useEffect(() => {
    if (carga.estado !== "pronto") return;
    const comeca = carga.dados.regras?.semanaComeca ?? 1;
    if (comeca !== semanaComeca) setSemanaComeca(comeca);
  }, [carga, semanaComeca]);

  // Aberto pela ficha: o departamento da pessoa, uma vez.
  useEffect(() => {
    if (focoAplicado.current || carga.estado !== "pronto") return;
    focoAplicado.current = true;
    if (!colaboradorEmFoco) return;
    const p = carga.dados.pessoas.find(
      (x) => x.colaboradorId === colaboradorEmFoco,
    );
    if (p?.departamento) {
      setFiltros({
        ...FILTROS_DO_QUADRO_VAZIOS,
        departamentos: [p.departamento.id],
      });
    }
  }, [carga, colaboradorEmFoco]);

  const dias = useMemo(() => diasDoPeriodo(inicio, fim), [inicio, fim]);
  const referencia = hoje >= inicio && hoje <= fim ? hoje : inicio;
  const todas = useMemo(
    () => (carga.estado === "pronto" ? carga.dados.pessoas : []),
    [carga],
  );

  const regras =
    carga.estado === "pronto" ? (carga.dados.regras ?? undefined) : undefined;
  const avisosTodos = useMemo(
    () => calcularAvisos(todas, dias, regras),
    [todas, dias, regras],
  );
  const idsComAviso = useMemo(
    () => new Set(avisosTodos.map((a) => a.colaboradorId)),
    [avisosTodos],
  );

  // Quem tem rascunho no período (atalho "Mudanças não publicadas").
  const idsComMudanca = useMemo(() => {
    const noPeriodo = new Set(dias);
    return new Set(
      todas
        .filter((p) =>
          (p.dias ?? []).some(
            (d) => d.camada === "rascunho" && noPeriodo.has(d.dia),
          ),
        )
        .map((p) => p.colaboradorId),
    );
  }, [todas, dias]);
  // Quem tem ausência aprovada no período (atalho "De férias ou afastados").
  const idsAusentes = useMemo(() => idsComAusencia(todas, dias), [todas, dias]);
  const contextoDoFiltro = useMemo(
    () => ({
      referencia,
      comAviso: idsComAviso,
      comMudanca: idsComMudanca,
      comAusencia: idsAusentes,
    }),
    [referencia, idsComAviso, idsComMudanca, idsAusentes],
  );
  const filtradas = useMemo(
    () => buscar(filtrar(todas, filtros, contextoDoFiltro), busca),
    [todas, filtros, contextoDoFiltro, busca],
  );
  const aplicados = useMemo(
    () => filtrosAplicados(todas, filtros, contextoDoFiltro, ROTULOS),
    [todas, filtros, contextoDoFiltro],
  );
  // Os avisos das pessoas filtradas (os do painel, das células e do botão).
  const visiveis = useMemo(() => {
    const ids = new Set(filtradas.map((p) => p.colaboradorId));
    return avisosTodos.filter((a) => ids.has(a.colaboradorId));
  }, [avisosTodos, filtradas]);
  const porCelula = useMemo(() => avisosPorCelula(visiveis), [visiveis]);
  const ligados = quantosFiltros(filtros);

  const celulas = useMemo(() => {
    const m = new Map<string, CelulaDoQuadro[]>();
    for (const p of filtradas) {
      m.set(
        p.colaboradorId,
        dias.map((d) => celulaDoDia(p, d)),
      );
    }
    return m;
  }, [filtradas, dias]);

  const minutosDe = (p: PessoaDoQuadroApi) =>
    (celulas.get(p.colaboradorId) ?? []).reduce((s, c) => s + c.minutos, 0);

  const grupos = useMemo(
    () => agrupar(ordenar(filtradas, ordem), agruparPor, referencia),
    [filtradas, ordem, agruparPor, referencia],
  );
  const emOrdem = grupos.flatMap((g) => g.pessoas);
  const total = emOrdem.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaAtual = Math.min(pagina, paginas);
  const daPagina = emOrdem.slice(
    (paginaAtual - 1) * porPagina,
    paginaAtual * porPagina,
  );
  const naPagina = new Set(daPagina.map((p) => p.colaboradorId));
  const gruposDaPagina: GrupoDoQuadro[] = grupos
    .map((g) => ({
      ...g,
      pessoas: g.pessoas.filter((p) => naPagina.has(p.colaboradorId)),
    }))
    .filter((g) => g.pessoas.length > 0);

  const escalados = dias.map(
    (_, i) =>
      filtradas.filter(
        (p) => celulas.get(p.colaboradorId)?.[i]?.tipo === "trabalho",
      ).length,
  );
  const minutosTotais = filtradas.reduce((s, p) => s + minutosDe(p), 0);

  const turnosNaPagina = new Map<string, TurnoDaCelula>();
  for (const p of daPagina) {
    for (const c of celulas.get(p.colaboradorId) ?? []) {
      if (c.turno) turnosNaPagina.set(c.turno.id, c.turno);
    }
  }

  const filtrando = ligados > 0 || busca.trim() !== "";
  const em6x1 = pessoasEm6x1NaTransicao(filtradas, dias, regras);
  const avisosDeAtencao = avisosTodos.filter((a) => a.categoria === "atencao");

  /** "Já temos convenção": marca a 6x1 autorizada nas Regras, com Desfazer. */
  const temosConvencao = async () => {
    if (!regras) return;
    const base = {
      inicioTransicao: regras.personalizadas ? regras.inicioTransicao : null,
      semanaComeca: regras.semanaComeca,
      convencao: regras.convencao,
      avisos: regras.avisos,
      antecedenciaDias: regras.antecedenciaDias,
      avisarPadrao: regras.avisarPadrao,
    };
    await salvarRegras({
      ...base,
      convencao: { ...regras.convencao, "6x1_autorizada": true },
    });
    setTentativa((n) => n + 1);
    setAviso({
      id: Date.now(),
      titulo: "6x1 autorizada por convenção nas Regras",
      acao: {
        rotulo: "Desfazer",
        onClick: () =>
          void tentar(async () => {
            await salvarRegras(base);
            setTentativa((n) => n + 1);
          }),
      },
    });
  };

  /** Leva à célula de um aviso (troca de página se preciso). */
  const irParaAviso = (a: AvisoDaEscala) => {
    setVendoAvisos(false);
    const indice = emOrdem.findIndex(
      (p) => p.colaboradorId === a.colaboradorId,
    );
    if (indice >= 0) setPagina(Math.floor(indice / porPagina) + 1);
    const chave = `${a.colaboradorId}|${a.dia}`;
    setAtiva(chave);
    focoPendente.current = chave;
  };
  // Mudanças não publicadas no período (o quadro só traz os dias dele).
  const mudancas = todas.reduce(
    (t, p) => t + (p.dias ?? []).filter((d) => d.camada === "rascunho").length,
    0,
  );
  // O que publicar leva: dias do rascunho, novos ou sobre um publicado.
  const resumoDaPublicacao = (() => {
    let novas = 0;
    let alteradas = 0;
    const comMudanca = new Set<string>();
    for (const p of todas) {
      for (const d of p.dias ?? []) {
        if (d.camada !== "rascunho") continue;
        comMudanca.add(p.colaboradorId);
        const publicado = (p.dias ?? []).some(
          (x) => x.dia === d.dia && x.camada === "publicado",
        );
        if (publicado) alteradas += 1;
        else novas += 1;
      }
    }
    return { novas, alteradas, pessoas: comMudanca.size };
  })();
  const publicacao =
    carga.estado === "pronto" ? (carga.dados.publicacao ?? null) : null;
  const primeiraCelula = daPagina[0]
    ? `${daPagina[0].colaboradorId}|${dias[0]}`
    : null;
  const celulaComFoco =
    ativa &&
    daPagina.some((p) => ativa.startsWith(`${p.colaboradorId}|`)) &&
    dias.includes(ativa.split("|")[1] ?? "")
      ? ativa
      : primeiraCelula;
  const contagem = filtrando
    ? `${total} de ${plural(todas.length, "pessoa", "pessoas")}`
    : agruparPor === "nenhum"
      ? plural(total, "pessoa", "pessoas")
      : `${plural(total, "pessoa", "pessoas")} · ${nomeDosGrupos(agruparPor, grupos.length)}`;

  const abrirModelo = (comSelecao: boolean) => {
    if (!onAbrirModelo) return;
    pedirModelo({
      doFiltro: filtrando ? filtradas.map((p) => p.colaboradorId) : null,
      selecionadas: comSelecao ? [...selecionados] : [],
    });
    onAbrirModelo();
  };
  const trocarVisao = (v: Visao) => {
    setVisao(v);
    setPagina(1);
  };
  const irPara = (dia: string) => {
    setAncora(dia);
  };
  const alternarGrupo = (chave: string) =>
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const titulo = tituloDoPeriodo(visao, inicio, fim);
  const colunas = dias.length + 2;

  /** Caixa de seleção de um grupo de pessoas (marcada, parcial ou não). */
  const caixa = (ps: readonly PessoaDoQuadroApi[], rotulo: string) => {
    const marcadas = ps.filter((p) => selecionados.has(p.colaboradorId)).length;
    const todas = ps.length > 0 && marcadas === ps.length;
    return (
      <input
        type="checkbox"
        className="quadro__selecao"
        aria-label={rotulo}
        checked={todas}
        ref={(el) => {
          if (el) el.indeterminate = marcadas > 0 && !todas;
        }}
        onChange={() =>
          setSelecionados((atual) => {
            const novo = new Set(atual);
            for (const p of ps) {
              if (todas) novo.delete(p.colaboradorId);
              else novo.add(p.colaboradorId);
            }
            return novo;
          })
        }
      />
    );
  };

  const cabecaDoGrupo = (g: GrupoDoQuadro) => {
    const completo = grupos.find((x) => x.chave === g.chave) ?? g;
    const aberto = !recolhidos.has(g.chave);
    const minutos = completo.pessoas.reduce((s, p) => s + minutosDe(p), 0);
    return (
      <tr className="quadro__grupo">
        <th scope="colgroup" colSpan={colunas}>
          <div className="quadro__grupo-linha">
            {podeOperar
              ? caixa(completo.pessoas, `Selecionar ${g.nome}`)
              : null}
            <button
              type="button"
              className="quadro__grupo-botao"
              aria-expanded={aberto}
              onClick={() => alternarGrupo(g.chave)}
            >
              <IconeAbrir
                tamanho={14}
                className={`quadro__seta${aberto ? "" : " quadro__seta--fechada"}`}
              />
              <span className="quadro__grupo-nome">{g.nome}</span>
            </button>
            <span className="quadro__grupo-info">
              {plural(completo.pessoas.length, "pessoa", "pessoas")}
              {completo.unidade ? ` · ${completo.unidade}` : ""}
            </span>
            {visao === "semana" ? (
              <span className="quadro__grupo-horas">
                {formatarHoras(minutos)} na semana
              </span>
            ) : null}
          </div>
        </th>
      </tr>
    );
  };

  const cabecaDaPessoa = (p: PessoaDoQuadroApi) => {
    const tipo =
      p.tipoVinculo !== "clt"
        ? ((ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[
            p.tipoVinculo
          ] ?? null)
        : null;
    return (
      <th scope="row" className="quadro__pessoa">
        <div className="quadro__pessoa-linha">
          {podeOperar ? caixa([p], `Selecionar ${p.nome}`) : null}
          <span className="quadro__avatar" aria-hidden="true">
            {iniciais(p.nome)}
          </span>
          <span className="quadro__pessoa-textos">
            <span className="quadro__pessoa-nome">{p.nome}</span>
            <span className="quadro__pessoa-escala">
              {tipo ? <span className="quadro__tag">{tipo}</span> : null}
              {rotuloDaEscala(p, referencia)}
            </span>
          </span>
        </div>
      </th>
    );
  };

  const corpo = () => {
    if (total === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={colunas} className="quadro__vazio">
              {todas.length === 0
                ? "Nenhuma pessoa com vínculo neste período."
                : "Nenhuma pessoa encontrada. Confira a busca ou o filtro."}
            </td>
          </tr>
        </tbody>
      );
    }
    return gruposDaPagina.map((g) => (
      <tbody key={g.chave || "sem-grupo"}>
        {agruparPor !== "nenhum" ? cabecaDoGrupo(g) : null}
        {agruparPor === "nenhum" || !recolhidos.has(g.chave)
          ? g.pessoas.map((p) => {
              const cs = celulas.get(p.colaboradorId) ?? [];
              const linhaNaPagina = daPagina.indexOf(p);
              const minutos = minutosDe(p);
              return (
                <tr key={p.colaboradorId} className="quadro__linha">
                  {cabecaDaPessoa(p)}
                  {cs.map((c, coluna) => {
                    const chave = `${p.colaboradorId}|${c.dia}`;
                    const conteudo =
                      visao === "semana" ? (
                        <CelulaDaSemana
                          c={c}
                          avisos={porCelula.get(chave) ?? []}
                        />
                      ) : (
                        <CelulaDoMes
                          c={c}
                          avisos={porCelula.get(chave) ?? []}
                        />
                      );
                    return (
                      <td
                        key={c.dia}
                        className={`quadro__celula quadro__celula--${c.tipo}${
                          c.dia === hoje ? " quadro__celula--hoje" : ""
                        }${
                          feriadoDaPessoa(p, c.dia, regras)
                            ? " quadro__celula--feriado"
                            : ""
                        }${c.origem === "rascunho" ? " quadro__celula--rascunho" : ""}`}
                      >
                        {podeOperar && c.tipo !== "fora" ? (
                          <button
                            type="button"
                            className="quadro__celula-botao"
                            data-celula={chave}
                            data-linha={linhaNaPagina}
                            data-coluna={coluna}
                            tabIndex={chave === celulaComFoco ? 0 : -1}
                            aria-haspopup="menu"
                            aria-expanded={
                              menu?.colaboradorId === p.colaboradorId &&
                              menu.dia === c.dia
                            }
                            onFocus={() => setAtiva(chave)}
                            onKeyDown={(e) => tecladoDaCelula(e, p, c)}
                            onClick={(e) =>
                              setMenu({
                                colaboradorId: p.colaboradorId,
                                dia: c.dia,
                                ancora: e.currentTarget,
                                // detail 0: clique pelo teclado.
                                porTeclado: e.detail === 0,
                              })
                            }
                          >
                            {conteudo}
                          </button>
                        ) : (
                          conteudo
                        )}
                      </td>
                    );
                  })}
                  <td className="quadro__horas">
                    {visao === "semana" ? (
                      formatarHoras(minutos)
                    ) : (
                      <HorasDoMes
                        minutos={minutos}
                        meta={metaDoPeriodo(p, dias, regras?.inicioTransicao)}
                        diasDeTrabalho={
                          cs.filter((c) => c.tipo === "trabalho").length
                        }
                        ausencia={resumoDasAusencias(p, dias)}
                      />
                    )}
                  </td>
                </tr>
              );
            })
          : null}
      </tbody>
    ));
  };

  return (
    <Revelar>
      <section className="quadro" aria-labelledby={QUADRO_ESCALA_TITULO_ID}>
        <header className="quadro__cabeca">
          {onVoltar ? (
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Voltar para Colaboradores"
              onClick={onVoltar}
            >
              <IconeVoltar tamanho={18} />
            </button>
          ) : null}
          <div className="quadro__cabeca-textos">
            <h1
              id={QUADRO_ESCALA_TITULO_ID}
              ref={tituloRef}
              tabIndex={-1}
              className="quadro__titulo"
            >
              Escala de trabalho
            </h1>
            <p className="quadro__subtitulo">
              {titulo}
              {publicacao ? (
                <span className="quadro__selo-publicada">
                  {`Publicada em ${diaMesCurto(diaCivilDeHoje(new Date(publicacao.publicadaEm)))}${
                    publicacao.publicadaPor
                      ? ` por ${publicacao.publicadaPor}`
                      : ""
                  }`}
                </span>
              ) : null}
              {mudancas > 0 ? (
                <span className="quadro__selo-rascunho">
                  {`Rascunho · ${plural(mudancas, "mudança não publicada", "mudanças não publicadas")}`}
                </span>
              ) : null}
            </p>
          </div>
          {carga.estado === "pronto" ? (
            <div className="quadro__acoes">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialogo({ tipo: "exportar" })}
              >
                <IconeBaixarArquivo tamanho={16} />
                Exportar
                <IconeAbrir tamanho={14} />
              </Button>
              {podeOperar && onAbrirModelo ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => abrirModelo(false)}
                >
                  <IconeModelo tamanho={16} />
                  Aplicar modelo
                </Button>
              ) : null}
              {podeOperar ? (
                <Button
                  type="button"
                  variant="primary"
                  aria-disabled={mudancas === 0}
                  aria-describedby={
                    mudancas === 0 ? "quadro-nada-para-publicar" : undefined
                  }
                  onClick={() => {
                    if (mudancas > 0) setPublicando(true);
                  }}
                >
                  {publicacao && mudancas > 0
                    ? "Publicar mudanças"
                    : "Publicar"}
                </Button>
              ) : null}
              {podeOperar && mudancas === 0 ? (
                <span id="quadro-nada-para-publicar" className="sr-only">
                  Nada para publicar neste período.
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="quadro__barra">
          <div className="quadro__visao" role="group" aria-label="Visão">
            {(["semana", "mes"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="quadro__visao-botao"
                aria-pressed={visao === v}
                onClick={() => trocarVisao(v)}
              >
                {v === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <div className="quadro__periodo">
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Período anterior"
              onClick={() => irPara(deslocar(visao, ancora, -1, semanaComeca))}
            >
              <IconeVoltar tamanho={16} />
            </button>
            <span className="quadro__periodo-texto" aria-live="polite">
              {visao === "semana" ? titulo.replace(" a ", " – ") : titulo}
            </span>
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Próximo período"
              onClick={() => irPara(deslocar(visao, ancora, 1, semanaComeca))}
            >
              <IconeAvancar tamanho={16} />
            </button>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => irPara(hoje)}
            disabled={hoje >= inicio && hoje <= fim}
          >
            Hoje
          </Button>
          <div className="quadro__barra-direita">
            {carga.estado === "pronto" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setVendoAvisos("todos")}
              >
                <IconeAviso tamanho={16} />
                Avisos
                <span
                  className={`quadro__avisos-numero${
                    visiveis.some((a) => a.categoria === "atencao")
                      ? " quadro__avisos-numero--atencao"
                      : ""
                  }`}
                >
                  {visiveis.length}
                </span>
              </Button>
            ) : null}
            {onAbrirTurnos ? (
              <Button type="button" variant="secondary" onClick={onAbrirTurnos}>
                <IconeRelogio tamanho={16} />
                Turnos
              </Button>
            ) : null}
            {podeOperar && carga.estado === "pronto" ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="quadro__icone-botao"
                  aria-label="Mais ações"
                >
                  <IconeMaisAcoes tamanho={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onAbrirRegras ? (
                    <DropdownMenuItem onSelect={onAbrirRegras}>
                      <span className="quadro__item-menu quadro__item-menu--icone">
                        <IconeConfiguracoes tamanho={16} />
                        <span>
                          Regras da escala
                          <small>
                            Jornada, convenção, feriados locais e avisos
                          </small>
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ) : null}
                  {onAbrirTurnos ? (
                    <DropdownMenuItem onSelect={onAbrirTurnos}>
                      <span className="quadro__item-menu quadro__item-menu--icone">
                        <IconeRelogio tamanho={16} />
                        <span>
                          Turnos
                          <small>Horários da empresa</small>
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ) : null}
                  {onAbrirTransicao && em6x1.length > 0 ? (
                    <DropdownMenuItem onSelect={onAbrirTransicao}>
                      <span className="quadro__item-menu quadro__item-menu--icone">
                        <IconeCalendario tamanho={16} />
                        <span>
                          Planejar a transição
                          <small>
                            EC 141/2026: 6x1 → 2 descansos por semana
                          </small>
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  {visao === "semana" ? (
                    <>
                      <DropdownMenuItem
                        onSelect={() =>
                          void tentar(() => copiarSemanaAnterior(filtradas))
                        }
                      >
                        <span className="quadro__item-menu quadro__item-menu--icone">
                          <IconeCopiar tamanho={16} />
                          <span>
                            Copiar semana anterior
                            <small>Para as pessoas do filtro</small>
                          </span>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setDialogo({ tipo: "repetir" })}
                      >
                        <span className="quadro__item-menu quadro__item-menu--icone">
                          <IconeRepetir tamanho={16} />
                          <span>Repetir esta semana até…</span>
                        </span>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuItem
                    onSelect={() => setDialogo({ tipo: "exportar" })}
                  >
                    <span className="quadro__item-menu quadro__item-menu--icone">
                      <IconeBaixarArquivo tamanho={16} />
                      <span>
                        Exportar
                        <small>
                          PDF ou planilha, por unidade, turno ou departamento
                        </small>
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={rascunhosDe(filtradas).length === 0}
                    onSelect={() => setDialogo({ tipo: "limpar" })}
                  >
                    <span className="quadro__item-menu quadro__item-menu--icone quadro__item-menu--perigo">
                      <IconeRemover tamanho={16} />
                      <span>
                        Limpar o rascunho do período
                        <small>Só o que ainda não foi publicado</small>
                      </span>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        <div className="quadro__filtros">
          <label className="quadro__busca">
            <IconeBuscar tamanho={16} />
            <span className="sr-only">Buscar colaborador</span>
            <input
              type="search"
              placeholder="Buscar colaborador"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            aria-haspopup="dialog"
            onClick={() => setGaveta(true)}
          >
            <IconeFiltrar tamanho={16} />
            Filtrar
            {ligados > 0 ? (
              <span className="quadro__filtrar-numero">
                <span aria-hidden="true">{ligados}</span>
                <span className="sr-only">
                  {`, ${plural(ligados, "filtro ligado", "filtros ligados")}`}
                </span>
              </span>
            ) : null}
          </Button>
          <label className="quadro__agrupar">
            <span>Agrupar por:</span>
            <select
              value={agruparPor}
              onChange={(e) => {
                setAgruparPor(e.target.value as Agrupamento);
                setPagina(1);
              }}
            >
              {AGRUPAMENTOS.map((a) => (
                <option key={a} value={a}>
                  {ROTULO_DO_AGRUPAMENTO[a]}
                </option>
              ))}
            </select>
          </label>
          {carga.estado === "pronto" ? (
            <p className="quadro__contagem" aria-live="polite">
              {contagem}
            </p>
          ) : null}
        </div>

        {aplicados.length > 0 ? (
          <div
            className="quadro__aplicados"
            role="group"
            aria-label="Filtros aplicados"
          >
            {aplicados.map((a) => (
              <button
                key={a.chave}
                type="button"
                className="quadro__aplicado"
                aria-label={`Remover o filtro ${a.texto}`}
                onClick={() => {
                  setFiltros(a.sem);
                  setPagina(1);
                }}
              >
                {a.texto}
                <IconeFechar tamanho={12} />
              </button>
            ))}
            <Button
              type="button"
              variant="subtle"
              onClick={() => setSalvarVisao(filtros)}
            >
              <IconeEstrela tamanho={16} />
              Salvar como visão
            </Button>
            <Button
              type="button"
              variant="subtle"
              onClick={() => {
                setFiltros(FILTROS_DO_QUADRO_VAZIOS);
                setPagina(1);
              }}
            >
              Limpar filtros
            </Button>
          </div>
        ) : null}

        {carga.estado === "pronto" && em6x1.length > 0 ? (
          <FaixaDaTransicao
            quantas={em6x1.length}
            inicio={regras?.inicioTransicao ?? "2026-12-16"}
            periodo={visao === "semana" ? "nesta semana" : "neste mês"}
            {...(podeOperar
              ? { onTemosConvencao: () => void tentar(temosConvencao) }
              : {})}
            {...(podeOperar && onAbrirTransicao
              ? { onPlanejar: onAbrirTransicao }
              : {})}
          />
        ) : null}
        {carga.estado === "carregando" ? (
          <Esqueleto rotulo="Carregando o quadro…" linhas={5} />
        ) : carga.estado === "erro" ? (
          <div className="quadro__aviso" role="alert">
            <p>
              {carga.semEmpresa
                ? "Escolha uma empresa para ver o quadro de escala."
                : "Não foi possível carregar o quadro de escala."}
            </p>
            {carga.semEmpresa ? null : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTentativa((n) => n + 1)}
              >
                Tentar de novo
              </Button>
            )}
          </div>
        ) : (
          <>
            <div
              className={`quadro__rolagem quadro__rolagem--${visao}`}
              tabIndex={0}
              role="region"
              aria-label={`Quadro de escala ${visao === "semana" ? "da semana" : "do mês"}`}
            >
              <table
                ref={tabelaRef}
                className={`quadro__tabela quadro__tabela--${visao}`}
              >
                <caption className="sr-only">
                  {`Escala de trabalho: ${titulo}`}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="quadro__col-pessoa">
                      {podeOperar
                        ? caixa(daPagina, "Selecionar as pessoas desta página")
                        : null}
                      <button
                        type="button"
                        className="quadro__ordenar"
                        onClick={() =>
                          setOrdem((o) => (o === "asc" ? "desc" : "asc"))
                        }
                      >
                        Colaborador
                        <span aria-hidden="true">
                          {ordem === "asc" ? " ↑" : " ↓"}
                        </span>
                        <span className="sr-only">
                          {ordem === "asc"
                            ? ", em ordem de A a Z"
                            : ", em ordem de Z a A"}
                        </span>
                      </button>
                    </th>
                    {dias.map((d) => {
                      const feriado =
                        feriadoDe(d) ??
                        feriadoEstadualDe(d, regras?.uf) ??
                        ([
                          ...new Set(
                            (regras?.feriados ?? [])
                              .filter((x) => x.data === d)
                              .map((x) => x.nome),
                          ),
                        ].join(" · ") ||
                          null);
                      const semana = diaDaSemana(d) - 1;
                      return (
                        <th
                          key={d}
                          scope="col"
                          className={`quadro__dia${d === hoje ? " quadro__dia--hoje" : ""}${
                            feriado ? " quadro__dia--feriado" : ""
                          }`}
                          title={feriado ?? undefined}
                        >
                          {visao === "semana" ? (
                            <>
                              <span className="quadro__dia-nome">
                                {DIAS_CURTOS[semana]}
                              </span>
                              <span className="quadro__dia-numero">
                                {numeroDoDia(d)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="quadro__dia-numero">
                                {numeroDoDia(d)}
                              </span>
                              <span className="quadro__dia-nome">
                                {LETRAS_DOS_DIAS[semana]}
                              </span>
                            </>
                          )}
                          <span className="sr-only">
                            {diaDaSemanaEDiaMes(d)}
                          </span>
                          {d === hoje && visao === "semana" ? (
                            <span className="quadro__hoje">Hoje</span>
                          ) : null}
                          {feriado && visao === "semana" ? (
                            <span
                              className="quadro__feriado"
                              title={feriado}
                              aria-hidden="true"
                            >
                              {feriado}
                            </span>
                          ) : null}
                          {feriado ? (
                            <span className="sr-only">{`, feriado: ${feriado}`}</span>
                          ) : null}
                        </th>
                      );
                    })}
                    <th scope="col" className="quadro__col-horas">
                      {visao === "semana" ? "Horas" : "Horas no mês"}
                    </th>
                  </tr>
                  {visao === "semana" ? (
                    <tr className="quadro__escalados">
                      <th scope="row">Escalados no dia</th>
                      {escalados.map((n, i) => (
                        <td key={dias[i]}>
                          <strong>{n}</strong>
                          <span> de {filtradas.length}</span>
                        </td>
                      ))}
                      <td className="quadro__horas">
                        {formatarHoras(minutosTotais)}
                      </td>
                    </tr>
                  ) : null}
                </thead>
                {corpo()}
              </table>
            </div>

            <footer className="quadro__rodape">
              <nav className="quadro__paginacao" aria-label="Páginas">
                <p>
                  {total === 0
                    ? "Nenhuma pessoa"
                    : `Mostrando ${(paginaAtual - 1) * porPagina + 1}–${Math.min(
                        paginaAtual * porPagina,
                        total,
                      )} de ${plural(total, "pessoa", "pessoas")}`}
                </p>
                <label className="quadro__por-pagina">
                  <span className="sr-only">Pessoas por página</span>
                  <select
                    value={porPagina}
                    onChange={(e) => {
                      setPorPagina(Number(e.target.value));
                      setPagina(1);
                    }}
                  >
                    {POR_PAGINA.map((n) => (
                      <option key={n} value={n}>
                        {n} por página
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="quadro__icone-botao"
                  aria-label="Página anterior"
                  disabled={paginaAtual <= 1}
                  onClick={() => setPagina(paginaAtual - 1)}
                >
                  <IconeVoltar tamanho={14} />
                </button>
                <span aria-current="page">{paginaAtual}</span>
                <button
                  type="button"
                  className="quadro__icone-botao"
                  aria-label="Próxima página"
                  disabled={paginaAtual >= paginas}
                  onClick={() => setPagina(paginaAtual + 1)}
                >
                  <IconeAvancar tamanho={14} />
                </button>
              </nav>
              <ul className="quadro__legenda" aria-label="Legenda">
                {[...turnosNaPagina.values()].map((t) => (
                  <li key={t.id}>
                    {visao === "semana" ? (
                      <span
                        className="quadro__ponto"
                        style={{ background: corDoTurno(t.cor) }}
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="quadro__sigla"
                        style={{ color: corDoTurno(t.cor) }}
                        aria-hidden="true"
                      >
                        {siglaDe(t)}
                      </span>
                    )}
                    {t.nome}
                  </li>
                ))}
                {visao === "mes" ? (
                  <li>
                    <span
                      className="quadro__sigla quadro__sigla--dsr"
                      aria-hidden="true"
                    >
                      D
                    </span>
                    DSR
                  </li>
                ) : null}
                {visao === "mes" ? (
                  <li>
                    <span
                      className="quadro__legenda-ausencia"
                      aria-hidden="true"
                    />
                    Ausência
                  </li>
                ) : null}
              </ul>
              {visao === "mes" ? (
                <p className="quadro__dica">Shift + rolar para os lados</p>
              ) : null}
            </footer>
          </>
        )}
        {falha ? (
          <p role="alert" className="quadro__falha">
            {falha}
          </p>
        ) : null}
        {(() => {
          const p = menu
            ? todas.find((x) => x.colaboradorId === menu.colaboradorId)
            : undefined;
          if (!menu || !p) return null;
          const c = celulaDoDia(p, menu.dia);
          return (
            <MenuDaCelula
              ancora={menu.ancora}
              rotulo={`Dia de ${p.nome}, ${diaDaSemanaEDiaMes(menu.dia)}`}
              celula={c}
              turnos={turnos}
              focarPrimeiro={menu.porTeclado ?? false}
              onEscolher={(acao) => escolher(p, c, acao)}
              onFechar={(devolver) => {
                const ancoraDoMenu = menu.ancora;
                setMenu(null);
                if (devolver) ancoraDoMenu.focus();
              }}
            />
          );
        })()}
        {(() => {
          if (!painel) return null;
          const p =
            todas.find((x) => x.colaboradorId === painel.colaboradorId) ??
            pessoaDoPainel.current;
          if (!p) return null;
          pessoaDoPainel.current = p;
          const c = celulaDoDia(p, painel.dia);
          const tipo =
            (ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[
              p.tipoVinculo
            ] ?? p.tipoVinculo;
          const subtitulo = [
            p.departamento?.nome,
            tipo,
            rotuloDaEscala(p, painel.dia).split(" · ")[0],
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <PainelDoDia
              pessoa={p}
              celula={c}
              turnos={turnos}
              unidades={unidades}
              foco={painel.foco}
              subtitulo={subtitulo}
              onSalvar={async (dto) => {
                const turno =
                  dto.tipo === "trabalho"
                    ? turnos.find((x) => x.id === dto.tabelaHorarioId)
                    : undefined;
                await gravar(
                  p,
                  painel.dia,
                  dto,
                  turno?.nome ?? NOME_DO_TIPO[dto.tipo],
                );
                setPainel(null);
              }}
              onLimpar={async () => {
                await limpar(p, painel.dia);
                setPainel(null);
              }}
              onTrocarDia={(dia) => {
                if (dia < inicio || dia > fim) setAncora(dia);
                setPainel({ ...painel, dia, foco: null });
              }}
              onVerSemana={(dia) => {
                setPainel(null);
                setVisao("semana");
                setAncora(dia);
              }}
              onFechar={() => setPainel(null)}
            />
          );
        })()}
        {publicando ? (
          <DialogoPublicar
            periodo={visao === "semana" ? `Semana de ${titulo}` : titulo}
            resumo={resumoDaPublicacao}
            avisos={avisosDeAtencao}
            onVerAvisos={() => {
              setPublicando(false);
              setVendoAvisos("todos");
            }}
            avisarPadrao={regras?.avisarPadrao ?? true}
            antecedenciaFaltando={
              regras &&
              regras.antecedenciaDias > 0 &&
              inicio < somarDiasLocal(hoje, regras.antecedenciaDias)
                ? regras.antecedenciaDias
                : null
            }
            onFechar={() => setPublicando(false)}
            onPublicar={async (avisar) => {
              const r = await publicarEscala(inicio, fim, avisar);
              setPublicando(false);
              setTentativa((n) => n + 1);
              setAviso({
                id: Date.now(),
                titulo: "Escala publicada",
                texto: `${plural(r.pessoas, "pessoa", "pessoas")} com mudança · ${
                  r.avisar ? "aviso registrado" : "sem aviso"
                }`,
              });
            }}
          />
        ) : null}
        {podeOperar && selecionados.size > 0 ? (
          <div
            role="toolbar"
            aria-label="Ações para as pessoas selecionadas"
            className="quadro__barra-selecao"
          >
            <span className="quadro__selecionadas" aria-live="polite">
              <strong>{selecionados.size}</strong>
              {selecionados.size === 1
                ? " pessoa selecionada"
                : " pessoas selecionadas"}
            </span>
            {onAbrirModelo ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => abrirModelo(true)}
              >
                <IconeModelo tamanho={16} />
                Aplicar modelo
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogo({ tipo: "trocar", alvo: "selecao" })}
              disabled={turnos.length === 0}
            >
              <IconeTentarDeNovo tamanho={16} />
              Trocar turno
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogo({ tipo: "folga", alvo: "selecao" })}
            >
              <IconeCalendario tamanho={16} />
              Dar folga
            </Button>
            {visao === "semana" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void tentar(() =>
                    copiarSemanaAnterior(
                      todas.filter((p) => selecionados.has(p.colaboradorId)),
                    ),
                  )
                }
              >
                <IconeCopiar tamanho={16} />
                Copiar semana anterior
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogo({ tipo: "exportar", selecao: true })}
            >
              <IconeBaixarArquivo tamanho={16} />
              Exportar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="quadro__icone-botao"
                aria-label="Mais ações para as pessoas selecionadas"
              >
                <IconeMaisAcoes tamanho={18} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem onSelect={() => setVendoAvisos("selecao")}>
                  <span className="quadro__item-menu quadro__item-menu--icone">
                    <IconeAviso tamanho={16} />
                    <span>
                      Ver avisos dessas pessoas
                      <small>Abre o painel de avisos filtrado</small>
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    setDialogo({
                      tipo: "exportar",
                      selecao: true,
                      cadaUma: true,
                    })
                  }
                >
                  <span className="quadro__item-menu quadro__item-menu--icone">
                    <IconeBaixarArquivo tamanho={16} />
                    <span>
                      Exportar a escala de cada uma
                      <small>Um PDF por pessoa, num arquivo .zip</small>
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    trocarVisao(visao === "semana" ? "mes" : "semana")
                  }
                >
                  <span className="quadro__item-menu quadro__item-menu--icone">
                    <IconeCalendario tamanho={16} />
                    <span>
                      {visao === "semana" ? "Abrir no mês" : "Abrir na semana"}
                      <small>
                        {visao === "semana"
                          ? "Mesmo filtro, visão mensal"
                          : "Mesmo filtro, visão semanal"}
                      </small>
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={
                    rascunhosDe(
                      todas.filter((p) => selecionados.has(p.colaboradorId)),
                    ).length === 0
                  }
                  onSelect={() =>
                    setDialogo({ tipo: "limpar", alvo: "selecao" })
                  }
                >
                  <span className="quadro__item-menu quadro__item-menu--icone quadro__item-menu--perigo">
                    <IconeRemover tamanho={16} />
                    <span>
                      Limpar o rascunho do período
                      <small>Só o que ainda não foi publicado</small>
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <kbd className="quadro__dica-tecla" aria-hidden="true">
              Esc
            </kbd>
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Limpar a seleção (Esc)"
              onClick={() => setSelecionados(new Set())}
            >
              <IconeFechar tamanho={14} />
            </button>
          </div>
        ) : null}
        {(() => {
          const sel = todas.filter((p) => selecionados.has(p.colaboradorId));
          if (dialogo?.tipo === "trocar") {
            return (
              <DialogoTrocarTurno
                pessoas={sel}
                turnos={turnos}
                inicio={inicio}
                fim={fim}
                obterPessoas={async (de, ate) => {
                  const m = await pessoasDoPeriodo(de, ate);
                  return sel.map((p) => m.get(p.colaboradorId) ?? p);
                }}
                onFechar={() => setDialogo(null)}
                onAplicar={async (plano, doIntervalo, turno) => {
                  await executarLote(
                    plano,
                    rascunhosPorChave(doIntervalo),
                    `${turno.nome} em ${plural(plano.gravar.length, "dia", "dias")} no rascunho`,
                  );
                  setDialogo(null);
                }}
              />
            );
          }
          if (dialogo?.tipo === "folga") {
            return (
              <DialogoDarFolga
                pessoas={sel}
                diaInicial={referencia}
                onFechar={() => setDialogo(null)}
                onAplicar={async (dia, tipo) => {
                  const m = await pessoasDoPeriodo(dia, dia);
                  const alvo = sel.map((p) => m.get(p.colaboradorId) ?? p);
                  const plano = darFolga(alvo, dia, tipo);
                  await executarLote(
                    plano,
                    rascunhosPorChave(alvo),
                    `${tipo === "dsr" ? "DSR" : "Folga"} em ${diaMesCurto(dia)} para ${plural(pessoasDoLote(plano), "pessoa", "pessoas")} no rascunho`,
                  );
                  setDialogo(null);
                }}
              />
            );
          }
          if (dialogo?.tipo === "repetir") {
            return (
              <DialogoRepetir
                fimDaSemana={fim}
                onFechar={() => setDialogo(null)}
                onAplicar={async (ate) => {
                  const semanas = semanasAte(inicio, ate);
                  const destino = await pessoasDoPeriodo(
                    somarDiasLocal(fim, 1),
                    ate,
                  );
                  const gravar: PlanoDoLote["gravar"] = [];
                  const limpar: PlanoDoLote["limpar"] = [];
                  const origem = new Map(
                    filtradas.map((p) => [p.colaboradorId, p] as const),
                  );
                  for (const semana of semanas) {
                    const alvo = filtradas.map(
                      (p) => destino.get(p.colaboradorId) ?? p,
                    );
                    const plano = copiarDias(
                      alvo,
                      origem,
                      dias.slice(0, semana.length),
                      semana,
                    );
                    gravar.push(...plano.gravar);
                    limpar.push(...plano.limpar);
                  }
                  await executarLote(
                    { gravar, limpar },
                    rascunhosPorChave(destino.values()),
                    `Semana repetida até ${diaMesCurto(ate)}`,
                  );
                  setDialogo(null);
                }}
              />
            );
          }
          if (dialogo?.tipo === "exportar") {
            return (
              <DialogoExportar
                visao={visao}
                ancora={ancora}
                semanaComeca={semanaComeca}
                doFiltro={filtradas}
                {...(dialogo.selecao
                  ? { selecionadas: [...selecionados] }
                  : {})}
                cadaUma={dialogo.cadaUma ?? false}
                regras={regras}
                empresa={nomeDaEmpresa}
                podeIncluirAvisos={podeExportarAvisos}
                onFechar={() => setDialogo(null)}
              />
            );
          }
          if (dialogo?.tipo === "limpar") {
            const alvo = dialogo.alvo === "selecao" ? sel : filtradas;
            const itens = rascunhosDe(alvo);
            return (
              <DialogoLimparRascunho
                periodo={titulo}
                quantas={itens.length}
                {...(dialogo.alvo === "selecao"
                  ? { deQuem: "as pessoas selecionadas" }
                  : {})}
                onFechar={() => setDialogo(null)}
                onConfirmar={async () => {
                  await executarLote(
                    { gravar: [], limpar: itens },
                    rascunhosPorChave(alvo),
                    itens.length === 1
                      ? "1 mudança desfeita"
                      : `${itens.length} mudanças desfeitas`,
                  );
                  setDialogo(null);
                }}
              />
            );
          }
          return null;
        })()}
        {vendoAvisos ? (
          <PainelDeAvisos
            titulo={
              vendoAvisos === "selecao"
                ? `Avisos de ${plural(selecionados.size, "pessoa", "pessoas")}`
                : visao === "semana"
                  ? "Avisos da semana"
                  : "Avisos do mês"
            }
            subtitulo={`${titulo} · calculados no rascunho`}
            avisos={
              vendoAvisos === "selecao"
                ? visiveis.filter((a) => selecionados.has(a.colaboradorId))
                : visiveis
            }
            onIrParaCelula={irParaAviso}
            {...(onAbrirRegras
              ? {
                  onAbrirRegras: () => {
                    pedirSecaoDasRegras("avisos");
                    onAbrirRegras();
                  },
                }
              : {})}
            onFechar={() => setVendoAvisos(false)}
          />
        ) : null}
        <AvisoFlutuante aviso={aviso} onFechar={() => setAviso(null)} />
        <GavetaDoQuadro
          aberta={gaveta}
          pessoas={todas}
          filtros={filtros}
          contexto={contextoDoFiltro}
          rotulos={ROTULOS}
          contar={(f) =>
            buscar(filtrar(todas, f, contextoDoFiltro), busca).length
          }
          onAplicar={(f) => {
            setFiltros(f);
            setPagina(1);
            setGaveta(false);
          }}
          onFechar={() => setGaveta(false)}
          visoes={visoes}
          onSalvarVisao={(f) => setSalvarVisao(f)}
          onGerenciarVisoes={() => setGerenciarVisoes(true)}
        />
        <DialogoSalvarVisao
          aberto={salvarVisao !== null}
          filtros={salvarVisao ?? FILTROS_DO_QUADRO_VAZIOS}
          onFechar={() => setSalvarVisao(null)}
          onSalva={(lista) => {
            setVisoes(lista);
            setSalvarVisao(null);
            setAviso({
              id: Date.now(),
              titulo: "Visão salva",
              texto: "Abra pelos Filtros, em Visões salvas.",
            });
          }}
        />
        <DialogoGerenciarVisoes
          aberto={gerenciarVisoes}
          visoes={visoes}
          onFechar={() => setGerenciarVisoes(false)}
          onMudou={(lista, texto) => {
            setVisoes(lista);
            setAviso({ id: Date.now(), titulo: texto });
          }}
        />
      </section>
    </Revelar>
  );
}

function HorasDoMes({
  minutos,
  meta,
  diasDeTrabalho,
  ausencia = null,
}: {
  minutos: number;
  meta: number;
  diasDeTrabalho: number;
  /** "Férias até 19/11": a ausência do período, no lugar dos dias. */
  ausencia?: string | null;
}) {
  const horas = Math.round(minutos / 60);
  const metaHoras = Math.round(meta / 60);
  const proporcao = meta > 0 ? Math.min(1, minutos / meta) : 0;
  return (
    <div className="quadro__mes-horas">
      <span>
        {horas}/{metaHoras} h
      </span>
      <span className="quadro__barra-horas" aria-hidden="true">
        <span style={{ width: `${Math.round(proporcao * 100)}%` }} />
      </span>
      <span className="quadro__mes-dias" title={ausencia ?? undefined}>
        {ausencia ?? plural(diasDeTrabalho, "dia", "dias")}
      </span>
    </div>
  );
}
