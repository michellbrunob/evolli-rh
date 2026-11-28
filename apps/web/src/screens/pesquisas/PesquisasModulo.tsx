/**
 * T216 — módulo Pesquisas (menu Pessoas › Pesquisas).
 *
 * Cada tela tem rota própria (`rotasDePesquisas.ts`): lista, galeria (passo
 * 1), sobre o modelo, página da personalizada, assistentes, rascunho,
 * resultados (com a aba), editar, resposta individual e prévia. O shell
 * entrega a rota (`rota`) e grava a navegação (`onNavegar`); sem shell (nos
 * testes), o módulo guarda a rota sozinho.
 *
 * - Sem pesquisas: "Crie sua primeira pesquisa", os três passos e a galeria.
 * - Com pesquisas: pílulas de status, busca ("/"), filtro de modelos, a
 *   tabela (a linha inteira abre os resultados) e o rodapé da tabela.
 * - Rascunhos não entram na lista: retomam-se pelo próprio modelo (ou pelo
 *   aviso da página da personalizada).
 *
 * RH e DP operam; o master técnico só lê; sem empresa ativa (acesso global),
 * a tela pede que se escolha uma empresa.
 */
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ModeloPesquisa,
  PesquisaDetalhe,
  PesquisaResumo,
  StatusPesquisa,
} from "../../api/pesquisasClient";
import { useTrilhaComplementar } from "../../app/trilhaComplementar";
import { Button, StatusBadge } from "../../components";
import { diaCivilDeHoje } from "../../format/data";
import { plural } from "../../format/plural";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from "../../ui";
import {
  IconeAbrir,
  IconeCopiar,
  IconeEditar,
  IconeFiltrar,
  IconeLink,
  IconeMais,
  IconeMaisAcoes,
  IconeRemover,
  IconeVer,
  IconeVoltar,
} from "../../ui/icones";
import { Esqueleto } from "../../ui/movimento";
import { GavetaDeDuplicar, JanelaDeExclusao } from "./acoesDaPesquisa";
import { AssistenteDePesquisa } from "./AssistenteDePesquisa";
import { AssistenteDoModelo } from "./AssistenteDoModelo";
import { ProvedorDeAvisos, useAvisar } from "./avisos";
import {
  CampoDeBusca,
  ICONE_DA_IDENTIFICACAO,
  IconeDoModelo,
  PassosIniciais,
  Pilulas,
} from "./componentes";
import { EditarPesquisa } from "./EditarPesquisa";
import { EntradaPersonalizada } from "./EntradaPersonalizada";
import { estadoDaCopia } from "./estadoDaPesquisa";
import { GaleriaDeModelos, semAcento } from "./GaleriaDeModelos";
import { ehModeloPronto, modeloDaGaleria } from "./modelosDePesquisa";
// T216 — relatório e prévia abrem em aba própria: pacotes sob demanda.
const PreviaDaPesquisa = lazy(() =>
  import("./PreviaDaPesquisa").then((m) => ({ default: m.PreviaDaPesquisa })),
);
const RelatorioDaPesquisa = lazy(() =>
  import("./RelatorioImprimivel").then((m) => ({
    default: m.RelatorioDaPesquisa,
  })),
);
const RelatorioDaResposta = lazy(() =>
  import("./RelatorioImprimivel").then((m) => ({
    default: m.RelatorioDaResposta,
  })),
);
import { esquecerRascunho } from "./rascunhosLocais";
import { ResultadoIndividual } from "./ResultadoIndividual";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";
import {
  ROTA_DA_LISTA,
  rotuloDaTrilha,
  type RotaDePesquisas,
} from "./rotasDePesquisas";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import { SobreOModelo } from "./SobreOModelo";
import {
  ROTULO_DA_IDENTIFICACAO,
  ROTULO_DO_MODELO,
  ROTULO_DO_STATUS,
  TOM_DO_STATUS,
  copiarLink,
  dataDoInstante,
  participacao,
  podeEditarPesquisa,
} from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";
import {
  AssistenteProprio,
  ehModeloComTelaPropria,
} from "./modelos/integracao";
import "./Pesquisas.css";

export { PESQUISAS_TITULO_ID };

const TAMANHO_DA_LISTA = 100;

type AssistenteAberto =
  | { readonly id?: string; readonly tipo: "modelo"; readonly modelo: string }
  | { readonly id?: string; readonly tipo: "proprio"; readonly modelo: string }
  | {
      readonly id?: string;
      readonly tipo: "aberta";
      readonly roteiro?: string;
      readonly inicial?: ReturnType<typeof estadoDaCopia>;
    };

export interface OpcoesDaNavegacao {
  /** Troca a entrada atual do histórico (sem empilhar). */
  readonly substituir?: boolean;
}

export function PesquisasModulo(props: {
  readonly servico: ServicoDePesquisas;
  /** RH e DP: criam, editam, publicam, mudam status e excluem. */
  readonly podeEditar: boolean;
  /** A rota da URL (o shell entrega); sem ela, o módulo guarda a sua. */
  readonly rota?: RotaDePesquisas;
  readonly onNavegar?: (
    rota: RotaDePesquisas,
    opcoes?: OpcoesDaNavegacao,
  ) => void;
  /** Acesso global, sem empresa ativa: nada é consultado. */
  readonly semEmpresa?: boolean;
}) {
  return (
    <ProvedorDeAvisos>
      <Modulo {...props} />
    </ProvedorDeAvisos>
  );
}

function Modulo({
  servico,
  podeEditar,
  rota,
  onNavegar,
  semEmpresa = false,
}: {
  readonly servico: ServicoDePesquisas;
  readonly podeEditar: boolean;
  readonly rota?: RotaDePesquisas;
  readonly onNavegar?: (
    rota: RotaDePesquisas,
    opcoes?: OpcoesDaNavegacao,
  ) => void;
  readonly semEmpresa?: boolean;
}) {
  const avisar = useAvisar();
  const [rotaLocal, setRotaLocal] = useState<RotaDePesquisas>(ROTA_DA_LISTA);
  const atual = rota ?? rotaLocal;
  const hoje = diaCivilDeHoje();
  /**
   * O assistente aberto: ao gravar o primeiro rascunho, a rota passa a
   * `<id>/rascunho`, e o mesmo assistente continua na tela (sem recarregar).
   */
  const abertoRef = useRef<AssistenteAberto | null>(null);
  /** Modelo já conferido (sem rascunho dele para retomar). */
  const [conferido, setConferido] = useState<string | null>(null);
  /** A pesquisa copiada (`copia/<id>`), já carregada. */
  const [copia, setCopia] = useState<{
    id: string;
    inicial: ReturnType<typeof estadoDaCopia>;
  } | null>(null);
  const [falhaAoAbrir, setFalhaAoAbrir] = useState(false);

  const irPara = useCallback(
    (r: RotaDePesquisas, opcoes?: OpcoesDaNavegacao) => {
      if (onNavegar) onNavegar(r, opcoes);
      else setRotaLocal(r);
      requestAnimationFrame?.(() =>
        document.getElementById(PESQUISAS_TITULO_ID)?.focus(),
      );
    },
    [onNavegar],
  );

  const voltarNaTrilha = useCallback(() => {
    switch (atual.tela) {
      case "resposta":
      case "editar":
        irPara({ tela: "resultados", id: atual.id, aba: "geral" });
        break;
      case "aberta":
      case "copia":
        irPara({ tela: "personalizada" });
        break;
      default:
        irPara(ROTA_DA_LISTA);
    }
  }, [atual, irPara]);
  // O resultado individual declara a própria trilha (pesquisa › resposta).
  useTrilhaComplementar(
    atual.tela === "resposta" ? undefined : rotuloDaTrilha(atual),
    voltarNaTrilha,
  );

  const telaAtual = atual.tela;
  const modeloAtual = atual.tela === "modelo" ? atual.modelo : null;
  const copiaAtual = atual.tela === "copia" ? atual.id : null;

  // Fora dos assistentes, esquece o que estava aberto.
  useEffect(() => {
    if (!["modelo", "aberta", "copia", "rascunho"].includes(telaAtual)) {
      abertoRef.current = null;
      setConferido(null);
      setCopia(null);
    }
    setFalhaAoAbrir(false);
  }, [telaAtual]);

  // Modelo pronto: retoma o rascunho dele, se houver.
  useEffect(() => {
    if (modeloAtual === null || semEmpresa) return;
    let vivo = true;
    Promise.resolve(
      servico.listarPesquisas({
        status: "rascunho",
        tamanhoPagina: TAMANHO_DA_LISTA,
      }),
    )
      .then((r) => {
        if (!vivo) return;
        const doModelo = (r?.itens ?? []).find(
          (p) => p.modelo === (modeloAtual as ModeloPesquisa),
        );
        if (doModelo)
          irPara({ tela: "rascunho", id: doModelo.id }, { substituir: true });
        else setConferido(modeloAtual);
      })
      .catch(() => {
        if (vivo) setConferido(modeloAtual);
      });
    return () => {
      vivo = false;
    };
    // Uma consulta por modelo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico, modeloAtual, semEmpresa]);

  // Cópia de uma personalizada: carrega a origem uma vez.
  useEffect(() => {
    if (copiaAtual === null || semEmpresa) return;
    let vivo = true;
    Promise.resolve(servico.obterPesquisa(copiaAtual))
      .then((d) => {
        if (vivo) setCopia({ id: copiaAtual, inicial: estadoDaCopia(d, hoje) });
      })
      .catch(() => {
        if (vivo) setFalhaAoAbrir(true);
      });
    return () => {
      vivo = false;
    };
    // Uma consulta por cópia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico, copiaAtual, semEmpresa]);

  if (semEmpresa) {
    return (
      <div className="pesquisas">
        <header className="pesquisas__cabecalho">
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            Pesquisas
          </h1>
        </header>
        <div className="pesquisas__nota" role="status">
          <p>Escolha uma empresa ativa no menu para ver as pesquisas.</p>
          <p className="pesquisas__suave">
            Sem empresa ativa, pesquisas de empresas diferentes ficariam
            misturadas; por isso nada é consultado.
          </p>
        </div>
      </div>
    );
  }

  const abrirResultados = (id: string, substituir = false) => {
    esquecerRascunho(id);
    irPara({ tela: "resultados", id, aba: "geral" }, { substituir });
  };
  const aoCriarRascunho = (aberto: AssistenteAberto) => (id: string) => {
    abertoRef.current = { ...aberto, id };
    irPara({ tela: "rascunho", id }, { substituir: true });
  };
  const editarConformeStatus = (d: PesquisaDetalhe) =>
    irPara(
      d.status === "rascunho"
        ? { tela: "rascunho", id: d.id }
        : { tela: "editar", id: d.id },
    );

  const assistenteDoModelo = (modeloId: string, base?: PesquisaDetalhe) => (
    <AssistenteDoModelo
      key="assistente-do-modelo"
      servico={servico}
      modeloId={modeloId}
      {...(base ? { base } : {})}
      hoje={hoje}
      onRascunhoCriado={aoCriarRascunho({ tipo: "modelo", modelo: modeloId })}
      onCancelar={(mensagem) => {
        irPara({ tela: "nova" });
        if (mensagem) avisar(mensagem);
      }}
      onConcluir={() => irPara(ROTA_DA_LISTA)}
      onVerResultados={(id) => abrirResultados(id)}
      onEditarGerada={(d) => irPara({ tela: "editar", id: d.id })}
    />
  );
  const assistenteProprio = (modelo: string, base?: PesquisaDetalhe) => (
    <AssistenteProprio
      key="assistente-proprio"
      modelo={modelo}
      servico={servico}
      {...(base ? { base } : {})}
      onRascunhoCriado={aoCriarRascunho({ tipo: "proprio", modelo })}
      hoje={hoje}
      onVoltar={() => irPara({ tela: "nova" })}
      onAbrirResultados={(id) => abrirResultados(id)}
    />
  );
  const assistenteAberto = (x: {
    roteiro?: string | undefined;
    inicial?: ReturnType<typeof estadoDaCopia> | undefined;
    base?: PesquisaDetalhe;
  }) => (
    <AssistenteDePesquisa
      key="assistente-aberto"
      servico={servico}
      hoje={hoje}
      {...(x.base ? { base: x.base } : {})}
      {...(x.inicial ? { inicial: x.inicial } : {})}
      {...(x.roteiro && x.roteiro !== "branco" ? { modelo: x.roteiro } : {})}
      onRascunhoCriado={aoCriarRascunho({
        tipo: "aberta",
        ...(x.roteiro ? { roteiro: x.roteiro } : {}),
        ...(x.inicial ? { inicial: x.inicial } : {}),
      })}
      onSair={(mensagem) => {
        irPara({ tela: "personalizada" });
        if (mensagem) avisar(mensagem);
      }}
      onConcluir={() => irPara(ROTA_DA_LISTA)}
      onVerResultados={(id) => abrirResultados(id)}
      onEditarGerada={(d) => irPara({ tela: "editar", id: d.id })}
    />
  );

  const carregando = (rotulo: string) =>
    falhaAoAbrir ? (
      <p className="pesquisas__erro" role="alert">
        Não foi possível abrir a pesquisa.
      </p>
    ) : (
      <Esqueleto rotulo={rotulo} linhas={4} />
    );
  const jaAberto = abertoRef.current;

  switch (atual.tela) {
    case "modelo":
      // T216 — avaliação e onboarding: assistente próprio (mesma retomada).
      if (conferido !== atual.modelo) return carregando("Abrindo o modelo…");
      return ehModeloComTelaPropria(atual.modelo)
        ? assistenteProprio(atual.modelo)
        : assistenteDoModelo(atual.modelo);
    case "rascunho":
      if (jaAberto?.id === atual.id) {
        // O assistente aberto acabou de criar este rascunho: continua o mesmo.
        return jaAberto.tipo === "modelo"
          ? assistenteDoModelo(jaAberto.modelo)
          : jaAberto.tipo === "proprio"
            ? assistenteProprio(jaAberto.modelo)
            : assistenteAberto({
                roteiro: jaAberto.roteiro,
                inicial: jaAberto.inicial,
              });
      }
      return (
        <CarregarPesquisa
          key={`rascunho-${atual.id}`}
          servico={servico}
          id={atual.id}
          render={(d) =>
            d.status !== "rascunho" ? (
              <Redirecionar
                para={() =>
                  irPara({ tela: "editar", id: d.id }, { substituir: true })
                }
              />
            ) : ehModeloComTelaPropria(d.modelo) ? (
              assistenteProprio(d.modelo, d)
            ) : ehModeloPronto(d.modelo) ? (
              assistenteDoModelo(d.modelo, d)
            ) : (
              assistenteAberto({ base: d })
            )
          }
        />
      );
    case "aberta":
      return assistenteAberto({ roteiro: atual.roteiro });
    case "copia":
      return copia?.id === atual.id
        ? assistenteAberto({ inicial: copia.inicial })
        : carregando("Copiando a pesquisa…");
    case "personalizada":
      return (
        <EntradaPersonalizada
          servico={servico}
          onVoltar={() => irPara({ tela: "nova" })}
          onComecar={(x) =>
            x.base
              ? irPara({ tela: "rascunho", id: x.base.id })
              : irPara({ tela: "aberta", roteiro: x.roteiro ?? "branco" })
          }
          onCopiar={(id) => irPara({ tela: "copia", id })}
          onContinuar={(id) => irPara({ tela: "rascunho", id })}
        />
      );
    case "sobre":
      return (
        <SobreOModelo
          id={atual.modelo}
          onVoltar={() => irPara({ tela: "nova" })}
          onUsar={(id) =>
            modeloDaGaleria(id).modelo === "personalizada"
              ? irPara(
                  id === "personalizada"
                    ? { tela: "personalizada" }
                    : { tela: "aberta", roteiro: id },
                )
              : irPara({ tela: "modelo", modelo: id })
          }
        />
      );
    case "resultados":
      return (
        <ResultadosDaPesquisa
          key={atual.id}
          servico={servico}
          pesquisaId={atual.id}
          podeEditar={podeEditar}
          abaInicial={atual.aba}
          onTrocarAba={(aba) =>
            irPara(
              { tela: "resultados", id: atual.id, aba },
              { substituir: true },
            )
          }
          onVoltar={() => irPara(ROTA_DA_LISTA)}
          onEditar={editarConformeStatus}
          onDuplicada={(copia) => abrirResultados(copia.id)}
          onSobreOModelo={(modelo) => irPara({ tela: "sobre", modelo })}
          onAbrirResposta={(respostaId) =>
            irPara({ tela: "resposta", id: atual.id, respostaId })
          }
        />
      );
    case "editar":
      return (
        <EditarPesquisa
          key={atual.id}
          servico={servico}
          pesquisaId={atual.id}
          hoje={hoje}
          onVoltar={() =>
            irPara({ tela: "resultados", id: atual.id, aba: "geral" })
          }
          onSalvo={(d) =>
            irPara({ tela: "resultados", id: d.id, aba: "geral" })
          }
        />
      );
    case "resposta":
      return (
        <ResultadoIndividual
          key={atual.respostaId}
          servico={servico}
          pesquisaId={atual.id}
          respostaId={atual.respostaId}
          onVoltar={() =>
            irPara({ tela: "resultados", id: atual.id, aba: "respostas" })
          }
          onLista={() => irPara(ROTA_DA_LISTA)}
          onIr={(respostaId) =>
            irPara(
              { tela: "resposta", id: atual.id, respostaId },
              { substituir: true },
            )
          }
        />
      );
    case "previa":
      return (
        <Suspense fallback={<Esqueleto rotulo="Carregando…" linhas={3} />}>
          <PreviaDaPesquisa servico={servico} pesquisaId={atual.id} />
        </Suspense>
      );
    case "relatorio":
      return (
        <Suspense fallback={<Esqueleto rotulo="Carregando…" linhas={3} />}>
          <RelatorioDaPesquisa servico={servico} pesquisaId={atual.id} />
        </Suspense>
      );
    case "relatorioDaResposta":
      return (
        <Suspense fallback={<Esqueleto rotulo="Carregando…" linhas={3} />}>
          <RelatorioDaResposta
            servico={servico}
            pesquisaId={atual.id}
            respostaId={atual.respostaId}
          />
        </Suspense>
      );
    case "nova":
      return (
        <div className="pesquisas">
          <header className="pesquisas__cabecalho">
            <IconButton
              label="Voltar para Pesquisas"
              icon={<IconeVoltar tamanho={18} />}
              className="pesquisas__voltar"
              onClick={() => irPara(ROTA_DA_LISTA)}
            />
            <div className="pesquisas__titulos">
              <h1
                id={PESQUISAS_TITULO_ID}
                className="pesquisas__titulo"
                tabIndex={-1}
              >
                Que pesquisa você quer aplicar?
              </h1>
              <p className="pesquisas__subtitulo">
                Escolha um modelo. Depois você ajusta as perguntas, define quem
                responde e envia.
              </p>
            </div>
            <ProgressoDoFluxo passo={1} total={4} />
          </header>
          <GaleriaDeModelos
            onUsar={(id) =>
              id === "personalizada"
                ? irPara({ tela: "personalizada" })
                : irPara({ tela: "modelo", modelo: id })
            }
            onSobre={(id) => irPara({ tela: "sobre", modelo: id })}
          />
        </div>
      );
    default:
      return (
        <ListaDePesquisas
          servico={servico}
          podeEditar={podeEditar}
          onNova={() => irPara({ tela: "nova" })}
          onUsarModelo={(id) =>
            id === "personalizada"
              ? irPara({ tela: "personalizada" })
              : irPara({ tela: "modelo", modelo: id })
          }
          onSobre={(id) => irPara({ tela: "sobre", modelo: id })}
          onResultados={(id) =>
            irPara({ tela: "resultados", id, aba: "geral" })
          }
          onEditar={(p) =>
            irPara(
              p.status === "rascunho"
                ? { tela: "rascunho", id: p.id }
                : { tela: "editar", id: p.id },
            )
          }
          onAbrirCopia={(copia) => abrirResultados(copia.id)}
        />
      );
  }
}

/** "Passo 1 de 4" com os pontos do progresso. */
function ProgressoDoFluxo({
  passo,
  total,
}: {
  readonly passo: number;
  readonly total: number;
}) {
  return (
    <span
      className="pesquisas__progresso-fluxo"
      aria-label={`Passo ${passo} de ${total}`}
    >
      {`Passo ${passo} de ${total}`}
      <span className="pesquisas__pontos" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            {...(i === passo - 1
              ? { "data-atual": "" }
              : i < passo - 1
                ? { "data-feito": "" }
                : {})}
          />
        ))}
      </span>
    </span>
  );
}

/** Dispara a navegação uma vez (redirecionamento no lugar). */
function Redirecionar({ para }: { readonly para: () => void }) {
  useEffect(() => {
    para();
    // Uma vez, ao montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Carrega a pesquisa e entrega ao `render`. */
function CarregarPesquisa({
  servico,
  id,
  render,
}: {
  readonly servico: ServicoDePesquisas;
  readonly id: string;
  readonly render: (d: PesquisaDetalhe) => React.ReactNode;
}) {
  const [d, setD] = useState<PesquisaDetalhe | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.obterPesquisa(id))
      .then((x) => {
        if (vivo) setD(x);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, id]);
  if (falhou)
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível abrir a pesquisa.
      </p>
    );
  if (!d) return <Esqueleto rotulo="Carregando a pesquisa…" linhas={5} />;
  return <>{render(d)}</>;
}

type FiltroDeStatus = "todas" | Exclude<StatusPesquisa, "rascunho">;

const STATUS_DA_LISTA: readonly { valor: FiltroDeStatus; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "ativa", rotulo: "Ativas" },
  { valor: "pausada", rotulo: "Pausadas" },
  { valor: "finalizada", rotulo: "Finalizadas" },
  { valor: "cancelada", rotulo: "Canceladas" },
];

const VAZIO_DO_FILTRO: Readonly<Record<FiltroDeStatus, string>> = {
  todas: "Nenhuma pesquisa encontrada com esses filtros.",
  ativa: "Nenhuma pesquisa ativa.",
  pausada: "Nenhuma pesquisa pausada.",
  finalizada: "Nenhuma pesquisa finalizada.",
  cancelada: "Nenhuma pesquisa cancelada.",
};

const PASSOS = [
  {
    titulo: "Escolha um modelo",
    texto: "Clima, pulso, eNPS, onboarding e outros",
  },
  {
    titulo: "Defina quem responde",
    texto: "Todo o time ou pessoas escolhidas",
  },
  {
    titulo: "Envie e acompanhe",
    texto: "Pelo link, com as respostas chegando",
  },
];

function ListaDePesquisas({
  servico,
  podeEditar,
  onNova,
  onUsarModelo,
  onSobre,
  onResultados,
  onEditar,
  onAbrirCopia,
}: {
  readonly servico: ServicoDePesquisas;
  readonly podeEditar: boolean;
  readonly onNova: () => void;
  readonly onUsarModelo: (id: string) => void;
  readonly onSobre: (id: string) => void;
  readonly onResultados: (id: string) => void;
  readonly onEditar: (p: PesquisaResumo) => void;
  readonly onAbrirCopia: (copia: PesquisaDetalhe) => void;
}) {
  const avisar = useAvisar();
  const [itens, setItens] = useState<PesquisaResumo[] | null>(null);
  const [falhou, setFalhou] = useState<false | "erro" | "sem-empresa">(false);
  const [versao, setVersao] = useState(0);
  const [status, setStatus] = useState<FiltroDeStatus>("todas");
  const [busca, setBusca] = useState("");
  const [tipos, setTipos] = useState<readonly string[]>([]);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const filtroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtroAberto) return;
    const fora = (e: Event) => {
      if (!filtroRef.current?.contains(e.target as Node))
        setFiltroAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltroAberto(false);
    };
    document.addEventListener("pointerdown", fora, true);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora, true);
      document.removeEventListener("keydown", tecla);
    };
  }, [filtroAberto]);
  const [crescente, setCrescente] = useState(false);
  const [excluir, setExcluir] = useState<PesquisaResumo | null>(null);
  const [duplicar, setDuplicar] = useState<PesquisaResumo | null>(null);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    Promise.resolve(
      servico.listarPesquisas({ tamanhoPagina: TAMANHO_DA_LISTA }),
    )
      .then((d) => {
        if (vivo)
          setItens((d?.itens ?? []).filter((p) => p.status !== "rascunho"));
      })
      .catch((erro: unknown) => {
        if (!vivo) return;
        const codigo = (erro as { status?: unknown } | null)?.status;
        setFalhou(codigo === 403 ? "sem-empresa" : "erro");
      });
    return () => {
      vivo = false;
    };
  }, [servico, versao]);

  const contagem = (s: FiltroDeStatus) =>
    (itens ?? []).filter((p) => s === "todas" || p.status === s).length;
  const modelosPresentes = useMemo(
    () => [...new Set((itens ?? []).map((p) => p.modelo))],
    [itens],
  );

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return (itens ?? [])
      .filter((p) => status === "todas" || p.status === status)
      .filter((p) => tipos.length === 0 || tipos.includes(p.modelo))
      .filter((p) => !termo || semAcento(p.nome).includes(termo))
      .sort((a, b) =>
        crescente
          ? a.criadaEm.localeCompare(b.criadaEm)
          : b.criadaEm.localeCompare(a.criadaEm),
      );
  }, [itens, status, tipos, busca, crescente]);

  async function copiar(p: PesquisaResumo) {
    if (!p.link) return;
    if (await copiarLink(p.link)) avisar("Link copiado.");
    else avisar("Não foi possível copiar o link.", { tom: "erro" });
  }

  const semNenhuma = itens !== null && itens.length === 0;

  return (
    <div className="pesquisas">
      {semNenhuma ? (
        <header className="pesquisas__cabecalho">
          <div className="pesquisas__titulos">
            <h1
              id={PESQUISAS_TITULO_ID}
              className="pesquisas__titulo pesquisas__titulo--grande"
              tabIndex={-1}
            >
              Crie sua primeira pesquisa
            </h1>
            <p className="pesquisas__subtitulo">
              Ainda não há pesquisas. Escolha um modelo: as perguntas já vêm
              prontas e dá para ajustar antes de enviar.
            </p>
          </div>
        </header>
      ) : (
        <header className="pesquisas__cabecalho">
          <div className="pesquisas__titulos">
            <h1
              id={PESQUISAS_TITULO_ID}
              className="pesquisas__titulo"
              tabIndex={-1}
            >
              Pesquisas
            </h1>
            <p className="pesquisas__subtitulo">
              Clima, engajamento e a experiência das pessoas, com pesquisas da
              própria empresa.
            </p>
          </div>
          {podeEditar && itens ? (
            <div className="pesquisas__acoes-topo">
              <Button onClick={onNova}>
                <IconeMais tamanho={16} />
                Nova pesquisa
              </Button>
            </div>
          ) : null}
        </header>
      )}

      {falhou === "sem-empresa" ? (
        <div className="pesquisas__nota" role="status">
          <p>Escolha uma empresa ativa no menu para ver as pesquisas.</p>
        </div>
      ) : falhou ? (
        <div className="pesquisas__caixa-erro" role="alert">
          <p className="pesquisas__erro">
            Não foi possível carregar as pesquisas.
          </p>
          <Button variant="secondary" onClick={recarregar}>
            Tentar novamente
          </Button>
        </div>
      ) : !itens ? (
        <Esqueleto rotulo="Carregando pesquisas…" linhas={5} />
      ) : semNenhuma ? (
        <>
          <PassosIniciais passos={PASSOS} />
          {podeEditar ? (
            <>
              <GaleriaDeModelos
                comRecomendacao
                onUsar={onUsarModelo}
                onSobre={onSobre}
              />
              <p className="pesquisas__suave pesquisas__ajuda-final">
                Sem saber por onde começar? O Pulso tem poucas perguntas e dá
                uma primeira leitura do time em poucos minutos.
              </p>
            </>
          ) : (
            <p className="pesquisas__nota">
              Ainda não há pesquisas. Quem cria pesquisas é o RH ou o DP.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="pesquisas__filtros pesquisas__filtros--linha">
            <Pilulas
              rotulo="Status"
              valor={status}
              onMudar={setStatus}
              opcoes={STATUS_DA_LISTA.map((s) => ({
                ...s,
                contagem: contagem(s.valor),
              }))}
            />
            <div className="pesquisas__filtros-direita">
              <CampoDeBusca
                rotulo="Buscar pesquisa"
                valor={busca}
                onMudar={setBusca}
                atalho
              />
              <div className="pesquisas__filtro-tipo" ref={filtroRef}>
                <Button
                  variant="secondary"
                  aria-expanded={filtroAberto}
                  aria-controls="pesquisas-filtro-modelos"
                  onClick={() => setFiltroAberto((a) => !a)}
                >
                  <IconeFiltrar tamanho={16} />
                  Tipo
                  {tipos.length > 0 ? (
                    <span className="pesquisas__contagem">{tipos.length}</span>
                  ) : null}
                  <IconeAbrir tamanho={12} />
                </Button>
                {filtroAberto ? (
                  <div
                    id="pesquisas-filtro-modelos"
                    className="pesquisas__popover"
                    role="group"
                    aria-label="Modelos"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setFiltroAberto(false);
                    }}
                  >
                    <p className="pesquisas__menu-titulo">Modelos</p>
                    {modelosPresentes.map((m) => (
                      <label key={m} className="pesquisas__marcacao">
                        <input
                          type="checkbox"
                          checked={tipos.includes(m)}
                          onChange={(e) =>
                            setTipos((t) =>
                              e.target.checked
                                ? [...t, m]
                                : t.filter((x) => x !== m),
                            )
                          }
                        />
                        <IconeDoModelo id={m} tamanho="sm" />
                        {ROTULO_DO_MODELO[m]}
                      </label>
                    ))}
                    {tipos.length > 0 ? (
                      <Button variant="subtle" onClick={() => setTipos([])}>
                        Limpar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="pesquisas__tabela-caixa">
            <table
              className="pesquisas__tabela pesquisas__tabela--clicavel"
              aria-label="Pesquisas"
            >
              <thead>
                <tr>
                  <th scope="col">Pesquisa</th>
                  <th scope="col">Participação</th>
                  <th
                    scope="col"
                    aria-sort={crescente ? "ascending" : "descending"}
                  >
                    <button
                      type="button"
                      className="pesquisas__ordenar"
                      aria-label={
                        crescente
                          ? "Criada em: ordenar das mais recentes para as mais antigas"
                          : "Criada em: ordenar das mais antigas para as mais recentes"
                      }
                      onClick={() => setCrescente((c) => !c)}
                    >
                      Criada em
                      <span
                        className="pesquisas__ordenar-seta"
                        {...(crescente ? { "data-crescente": "" } : {})}
                      >
                        <IconeAbrir tamanho={12} />
                      </span>
                    </button>
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="pesquisas__so-leitor">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="pesquisas__suave">
                      {busca || tipos.length > 0
                        ? VAZIO_DO_FILTRO.todas
                        : VAZIO_DO_FILTRO[status]}
                    </td>
                  </tr>
                ) : (
                  visiveis.map((p) => (
                    <LinhaDaPesquisa
                      key={p.id}
                      pesquisa={p}
                      podeEditar={podeEditar}
                      onResultados={() => onResultados(p.id)}
                      onEditar={() => onEditar(p)}
                      onDuplicar={() => setDuplicar(p)}
                      onCopiar={() => void copiar(p)}
                      onExcluir={() => setExcluir(p)}
                    />
                  ))
                )}
              </tbody>
            </table>
            <div className="pesquisas__tabela-rodape">
              <span>{plural(visiveis.length, "pesquisa", "pesquisas")}</span>
              <span className="pesquisas__suave">
                Clique numa linha para ver os resultados
              </span>
            </div>
          </div>
        </>
      )}

      <JanelaDeExclusao
        pesquisa={excluir}
        servico={servico}
        onFechar={() => setExcluir(null)}
        onExcluida={() => {
          setExcluir(null);
          recarregar();
        }}
        onFinalizada={() => {
          setExcluir(null);
          recarregar();
        }}
      />
      <GavetaDeDuplicar
        pesquisa={duplicar}
        servico={servico}
        onFechar={() => setDuplicar(null)}
        onDuplicada={(copia, naAtiva) => {
          setDuplicar(null);
          if (naAtiva) onAbrirCopia(copia);
          else recarregar();
        }}
      />
    </div>
  );
}

/** "3/7 · 43%" com barra; na anônima, "3 respostas" e o selo "link aberto". */
export function Participacao({
  pesquisa: p,
}: {
  readonly pesquisa: PesquisaResumo;
}) {
  if (p.identificacao === "anonima" || p.participantes === null) {
    return (
      <span className="pesquisas__participacao">
        <span>
          <span className="pesquisas__forte">
            {plural(p.respostas, "resposta", "respostas")}
          </span>{" "}
          <span className="pesquisas__selo">link aberto</span>
        </span>
      </span>
    );
  }
  const pct = participacao(p.respostas, p.participantes);
  return (
    <span className="pesquisas__participacao pesquisas__participacao--linha">
      <span
        className="pesquisas__barra"
        role="progressbar"
        aria-label={`Participação em ${p.nome}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="pesquisas__forte">{`${p.respostas}/${p.participantes}`}</span>
      <span className="pesquisas__suave">{`${pct}%`}</span>
    </span>
  );
}

function LinhaDaPesquisa({
  pesquisa: p,
  podeEditar,
  onResultados,
  onEditar,
  onDuplicar,
  onCopiar,
  onExcluir,
}: {
  readonly pesquisa: PesquisaResumo;
  readonly podeEditar: boolean;
  readonly onResultados: () => void;
  readonly onEditar: () => void;
  readonly onDuplicar: () => void;
  readonly onCopiar: () => void;
  readonly onExcluir: () => void;
}) {
  const IconeId = ICONE_DA_IDENTIFICACAO[p.identificacao];
  return (
    <tr
      onClick={(e) => {
        // O menu de ações (e o que ele abre fora da linha, num portal) não
        // abre os resultados.
        const alvo = e.target as HTMLElement;
        if (!e.currentTarget.contains(alvo) || alvo.closest("[data-sem-linha]"))
          return;
        onResultados();
      }}
    >
      <td>
        <span className="pesquisas__pessoa-linha">
          <IconeDoModelo id={p.modelo} />
          <button
            type="button"
            className="pesquisas__nome-botao"
            aria-label={`Ver resultados de ${p.nome}`}
            onClick={(e) => {
              e.stopPropagation();
              onResultados();
            }}
          >
            <span className="pesquisas__forte">{p.nome}</span>
            <span className="pesquisas__suave pesquisas__com-icone">
              {ROTULO_DO_MODELO[p.modelo]}
              <span className="pesquisas__sem-quebra">
                {" · "}
                <IconeId tamanho={12} />
                {ROTULO_DA_IDENTIFICACAO[p.identificacao]}
              </span>
            </span>
          </button>
        </span>
      </td>
      <td>
        <Participacao pesquisa={p} />
      </td>
      <td className="pesquisas__data">{dataDoInstante(p.criadaEm)}</td>
      <td>
        <StatusBadge variant={TOM_DO_STATUS[p.status]}>
          {ROTULO_DO_STATUS[p.status]}
        </StatusBadge>
      </td>
      <td data-sem-linha="">
        <div className="pesquisas__acoes-linha">
          {podeEditar ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="pesquisas__menu-botao"
                aria-label={`Ações de ${p.nome}`}
              >
                <IconeMaisAcoes tamanho={18} />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="pesquisas__menu">
                <DropdownMenuItem onSelect={onResultados}>
                  <IconeVer tamanho={16} />
                  Ver resultados
                </DropdownMenuItem>
                {podeEditarPesquisa(p.status) ? (
                  <DropdownMenuItem onSelect={onEditar}>
                    <IconeEditar tamanho={16} />
                    Editar pesquisa
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={onDuplicar}>
                  <IconeCopiar tamanho={16} />
                  Duplicar
                </DropdownMenuItem>
                {p.link ? (
                  <DropdownMenuItem
                    onSelect={onCopiar}
                    disabled={p.status !== "ativa"}
                  >
                    <IconeLink tamanho={16} />
                    Copiar link
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="pesquisas__menu-perigo"
                  onSelect={onExcluir}
                >
                  <IconeRemover tamanho={16} />
                  Excluir pesquisa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
