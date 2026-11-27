/**
 * T216 — resultados de uma pesquisa.
 *
 * Cabeçalho: voltar, ícone do modelo, título, status com menu (Ativa,
 * Pausada, Finalizada, Cancelada) e "Modelo · N respostas até agora"; à
 * direita "⋯" (duplicar, sobre o modelo, excluir), Editar, Exportar (Excel e
 * PDF) e Copiar link. Uma faixa com Modelo, Criada em, Identificação e
 * Participação. Abas: Visão geral (indicadores e um cartão por pergunta,
 * com filtros por grupo), Análises (mapa de médias por grupo e evolução) e
 * Respostas (identificada e anônima; nunca na confidencial).
 *
 * Grupos abaixo do mínimo nunca mostram números.
 */
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import type {
  AnalisesPesquisa,
  CampoGrupo,
  Pergunta,
  PesquisaDetalhe,
  RespostaDetalhe,
  RespostaResumo,
  ResultadoPergunta,
  ResultadosPesquisa,
  StatusPesquisa,
} from "../../api/pesquisasClient";
import { Button, FormActions } from "../../components";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import { plural } from "../../format/plural";
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  ListaDeEscolha,
} from "../../ui";
import {
  IconeAbrir,
  IconeAvancar,
  IconeBaixarArquivo,
  IconeCadeado,
  IconeComentario,
  IconeEditar,
  IconeMaisAcoes,
  IconeVoltar,
} from "../../ui/icones";
import { Esqueleto } from "../../ui/movimento";
import { baixarArquivo } from "../dashboard/exportacao";
import { TIPO_MIME_XLSX } from "../pessoas/importacao/planilhaXlsx";
import { CAMPOS_DE_GRUPO, seloDoTipo } from "./AssistenteDoModelo";
import { AvisoNaoIdentificaveis } from "./AvisoNaoIdentificaveis";
import { Avatar, IconeDoModelo, iniciaisDe, Pilulas } from "./componentes";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import {
  nomeDaExportacao,
  pdfDosResultados,
  planilhaDosResultados,
} from "./exportarResultados";
import {
  BarraEmpilhada,
  BarrasPorNota,
  LinhaDeEvolucao,
  Regua,
  Rosca,
} from "./graficos";
import {
  ROTULO_DA_ZONA,
  corDaNota,
  ehDeEscala,
  escalaDe,
  faixaDaMedia10,
  faixasDe,
  favoravelDe,
  indicadoresDe,
  limitesDasFaixas,
  mediaNa10,
  textoDoFavoravel,
} from "./indicadores";
import type { GruposDaEmpresa, ServicoDePesquisas } from "./servicoDePesquisas";
import { CampoDoLink } from "./TelaDeGerada";
import {
  ROTULO_DA_IDENTIFICACAO,
  ROTULO_DO_MODELO,
  ROTULO_DO_STATUS,
  copiarLink,
  dataDoInstante,
  participacao,
  percentual,
  podeEditarPesquisa,
  proximosStatus,
  umaCasa,
} from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";
import "./Pesquisas.css";

type Aba = "geral" | "analises" | "respostas";

const CONFIRMACAO: Readonly<
  Partial<
    Record<StatusPesquisa, { titulo: string; texto: string; botao: string }>
  >
> = {
  finalizada: {
    titulo: "Finalizar a pesquisa?",
    texto:
      "O link deixa de aceitar respostas e a pesquisa não volta a ficar ativa. Os resultados recebidos continuam aqui.",
    botao: "Finalizar pesquisa",
  },
  cancelada: {
    titulo: "Cancelar a pesquisa?",
    texto:
      "O link deixa de aceitar respostas e a pesquisa não volta a ficar ativa. As respostas recebidas continuam guardadas.",
    botao: "Cancelar pesquisa",
  },
};

const COR_DA_FAIXA = {
  baixa: "var(--status-danger-ink)",
  media: "var(--turno-mostarda)",
  alta: "var(--turno-verde)",
} as const;

/** "27/11 · 11:23". */
export function diaEHora(iso: string): string {
  return formatarInstante(iso).replace(/^(\d{2}\/\d{2})\/\d{4} às /, "$1 · ");
}

/** Quem pode ver respostas individuais: identificada e anônima, RH e DP. */
export function temRespostasIndividuais(
  detalhe: Pick<PesquisaDetalhe, "identificacao">,
  podeEditar: boolean,
): boolean {
  return podeEditar && detalhe.identificacao !== "confidencial";
}

export function ResultadosDaPesquisa({
  servico,
  pesquisaId,
  podeEditar,
  avisoInicial = null,
  onVoltar,
  onEditar,
  onDuplicada,
  onSobreOModelo,
  onAbrirResposta,
}: {
  readonly servico: ServicoDePesquisas;
  readonly pesquisaId: string;
  /** RH e DP: mudam status, editam, exportam respostas e as leem. */
  readonly podeEditar: boolean;
  readonly avisoInicial?: string | null;
  readonly onVoltar: (mensagem?: string) => void;
  readonly onEditar: (detalhe: PesquisaDetalhe) => void;
  readonly onDuplicada?: (copia: PesquisaDetalhe) => void;
  readonly onSobreOModelo?: (modelo: string) => void;
  readonly onAbrirResposta?: (respostaId: string) => void;
}) {
  const [detalhe, setDetalhe] = useState<PesquisaDetalhe | null>(null);
  const [geral, setGeral] = useState<ResultadosPesquisa | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [versao, setVersao] = useState(0);
  const [aba, setAba] = useState<Aba>("geral");
  const [aviso, setAviso] = useState<string | null>(avisoInicial);
  const [confirmar, setConfirmar] = useState<StatusPesquisa | null>(null);
  const [excluir, setExcluir] = useState(false);
  const [mudando, setMudando] = useState(false);
  const [respostas, setRespostas] = useState<RespostaResumo[] | null>(null);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    Promise.all([
      Promise.resolve(servico.obterPesquisa(pesquisaId)),
      Promise.resolve(servico.resultadosDaPesquisa(pesquisaId, null)),
    ])
      .then(([d, r]) => {
        if (!vivo) return;
        setDetalhe(d);
        setGeral(r);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId, versao]);

  const individuais = detalhe
    ? temRespostasIndividuais(detalhe, podeEditar)
    : false;

  useEffect(() => {
    if (!individuais) return;
    let vivo = true;
    Promise.resolve(servico.respostasDaPesquisa(pesquisaId))
      .then((r) => {
        if (vivo) setRespostas(r ?? []);
      })
      .catch(() => {
        if (vivo) setRespostas([]);
      });
    return () => {
      vivo = false;
    };
  }, [individuais, servico, pesquisaId]);

  async function mudarStatus(status: StatusPesquisa) {
    setMudando(true);
    try {
      const d = await servico.alterarStatusDaPesquisa(pesquisaId, status);
      setDetalhe(d);
      setAviso(`Status alterado para ${ROTULO_DO_STATUS[status]}.`);
    } catch {
      setAviso(
        "Não foi possível mudar o status. Atualize a página e tente de novo.",
      );
    } finally {
      setMudando(false);
      setConfirmar(null);
    }
  }

  async function duplicar() {
    try {
      const copia = await servico.duplicarPesquisa(pesquisaId);
      if (onDuplicada) onDuplicada(copia);
      else setAviso(`Cópia criada como rascunho: ${copia.nome}.`);
    } catch {
      setAviso("Não foi possível duplicar a pesquisa. Tente de novo.");
    }
  }

  async function confirmarExclusao() {
    setMudando(true);
    try {
      await servico.excluirPesquisa(pesquisaId);
      onVoltar("Pesquisa excluída.");
    } catch {
      setAviso("Não foi possível excluir a pesquisa. Tente de novo.");
      setExcluir(false);
    } finally {
      setMudando(false);
    }
  }

  async function exportar(formato: "xlsx" | "pdf") {
    if (!detalhe || !geral) return;
    try {
      if (formato === "pdf") {
        baixarArquivo(
          pdfDosResultados(detalhe, geral, indicadoresDe(detalhe, geral)),
          nomeDaExportacao(detalhe.nome, "pdf"),
          "application/pdf",
        );
        return;
      }
      let completas: RespostaDetalhe[] | null = null;
      if (individuais) {
        const lista =
          respostas ?? (await servico.respostasDaPesquisa(pesquisaId)) ?? [];
        completas = await Promise.all(
          lista.map((r) => servico.respostaDaPesquisa(pesquisaId, r.id)),
        );
      }
      baixarArquivo(
        planilhaDosResultados(detalhe, geral, completas),
        nomeDaExportacao(detalhe.nome, "xlsx"),
        TIPO_MIME_XLSX,
      );
    } catch {
      setAviso("Não foi possível exportar. Tente de novo.");
    }
  }

  if (falhou) {
    return (
      <div className="pesquisas">
        <header className="pesquisas__cabecalho">
          <IconButton
            label="Voltar para Pesquisas"
            icon={<IconeVoltar tamanho={18} />}
            className="pesquisas__voltar"
            onClick={() => onVoltar()}
          />
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            Resultados
          </h1>
        </header>
        <div className="pesquisas__caixa-erro" role="alert">
          <p className="pesquisas__erro">
            Não foi possível carregar os resultados.
          </p>
          <Button variant="secondary" onClick={() => setVersao((v) => v + 1)}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
  if (!detalhe || !geral) {
    return (
      <div className="pesquisas">
        <Esqueleto rotulo="Carregando resultados…" linhas={6} />
      </div>
    );
  }

  const anonima = detalhe.identificacao === "anonima";
  const proximos = podeEditar ? proximosStatus(detalhe.status) : [];
  const abas: { valor: Aba; rotulo: ReactNode }[] = [
    { valor: "geral", rotulo: "Visão geral" },
    {
      valor: "analises",
      rotulo: (
        <>
          Análises{" "}
          <span className="pesquisas__selo pesquisas__selo--destaque">
            Novo
          </span>
        </>
      ),
    },
    ...(individuais
      ? [
          {
            valor: "respostas" as const,
            rotulo: (
              <>
                Respostas{" "}
                <span className="pesquisas__contagem">{detalhe.respostas}</span>
              </>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="pesquisas">
      <header className="pesquisas__cabecalho">
        <IconButton
          label="Voltar para Pesquisas"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={() => onVoltar()}
        />
        <IconeDoModelo id={detalhe.modelo} tamanho="lg" />
        <div className="pesquisas__titulos">
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            {detalhe.nome}
          </h1>
          <div className="pesquisas__subtitulo pesquisas__linha-status">
            {proximos.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`pesquisas__status pesquisas__status--${detalhe.status}`}
                  aria-label={`Mudar status, hoje ${ROTULO_DO_STATUS[detalhe.status]}`}
                  disabled={mudando}
                >
                  <span className="pesquisas__ponto" aria-hidden="true" />
                  {ROTULO_DO_STATUS[detalhe.status]}
                  <IconeAbrir tamanho={12} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {proximos.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onSelect={() =>
                        CONFIRMACAO[s] ? setConfirmar(s) : void mudarStatus(s)
                      }
                    >
                      {ROTULO_DO_STATUS[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span
                className={`pesquisas__status pesquisas__status--${detalhe.status}`}
              >
                <span className="pesquisas__ponto" aria-hidden="true" />
                {ROTULO_DO_STATUS[detalhe.status]}
              </span>
            )}
            <span>
              {`${ROTULO_DO_MODELO[detalhe.modelo]} · ${plural(detalhe.respostas, "resposta", "respostas")} até agora`}
            </span>
          </div>
        </div>
        <div className="pesquisas__acoes-topo">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="pesquisas__menu-botao"
              aria-label="Mais ações"
            >
              <IconeMaisAcoes tamanho={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {podeEditar ? (
                <DropdownMenuItem onSelect={() => void duplicar()}>
                  Duplicar pesquisa
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onSelect={() => onSobreOModelo?.(detalhe.modelo)}
              >
                Sobre o modelo
              </DropdownMenuItem>
              {podeEditar ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="pesquisas__menu-perigo"
                    onSelect={() => setExcluir(true)}
                  >
                    Excluir pesquisa
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {podeEditar && podeEditarPesquisa(detalhe.status) ? (
            <Button variant="secondary" onClick={() => onEditar(detalhe)}>
              <IconeEditar tamanho={16} />
              Editar
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="evolli-button evolli-button--secondary"
              aria-label="Exportar"
            >
              <IconeBaixarArquivo tamanho={16} />
              Exportar
              <IconeAbrir tamanho={12} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void exportar("xlsx")}>
                <span className="pesquisas__menu-opcao">
                  <strong>Excel (.xlsx)</strong>
                  <span className="pesquisas__suave">
                    {individuais
                      ? "Todas as respostas e os resultados"
                      : "Os resultados por pergunta"}
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportar("pdf")}>
                <span className="pesquisas__menu-opcao">
                  <strong>PDF</strong>
                  <span className="pesquisas__suave">
                    Relatório dos resultados
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {detalhe.link &&
          (detalhe.status === "ativa" || detalhe.status === "pausada") ? (
            <Button
              onClick={async () =>
                setAviso(
                  (await copiarLink(detalhe.link!))
                    ? "Link copiado."
                    : "Não foi possível copiar o link.",
                )
              }
            >
              Copiar link
            </Button>
          ) : null}
        </div>
      </header>

      {aviso ? (
        <p className="pesquisas__aviso" role="status">
          {aviso}
        </p>
      ) : null}

      <dl className="pesquisas__faixa" aria-label="Sobre a pesquisa">
        <div>
          <dt>Modelo</dt>
          <dd>{ROTULO_DO_MODELO[detalhe.modelo]}</dd>
        </div>
        <div>
          <dt>Criada em</dt>
          <dd>{dataDoInstante(detalhe.criadaEm)}</dd>
        </div>
        <div>
          <dt>Identificação</dt>
          <dd>{ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]}</dd>
        </div>
        <div>
          <dt>Participação</dt>
          <dd>
            {anonima || detalhe.participantes === null
              ? `${plural(detalhe.respostas, "resposta", "respostas")} · link aberto`
              : `${detalhe.respostas} de ${detalhe.participantes} · ${participacao(detalhe.respostas, detalhe.participantes)}%`}
          </dd>
        </div>
      </dl>

      {detalhe.link && detalhe.status === "ativa" ? (
        <details className="pesquisas__detalhes-link">
          <summary>Ver o link da pesquisa</summary>
          <CampoDoLink link={detalhe.link} />
        </details>
      ) : null}

      <AvisoNaoIdentificaveis
        identificacao={detalhe.identificacao}
        naoIdentificaveis={detalhe.naoIdentificaveis}
        participantes={detalhe.participantesLista ?? []}
      />

      <div role="tablist" aria-label="Resultados" className="pesquisas__abas">
        {abas.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="tab"
            aria-selected={aba === a.valor}
            onClick={() => setAba(a.valor)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pesquisas__resultados">
        {aba === "geral" ? (
          <VisaoGeral servico={servico} detalhe={detalhe} geral={geral} />
        ) : aba === "analises" ? (
          <Analises servico={servico} detalhe={detalhe} geral={geral} />
        ) : (
          <ListaDeRespostas
            detalhe={detalhe}
            respostas={respostas}
            onAbrir={(id) => onAbrirResposta?.(id)}
          />
        )}
      </div>

      <Dialog
        aberto={confirmar !== null}
        titulo={confirmar ? (CONFIRMACAO[confirmar]?.titulo ?? "") : ""}
        onFechar={() => setConfirmar(null)}
        bloqueado={mudando}
        rodape={
          <FormActions>
            <Button variant="secondary" onClick={() => setConfirmar(null)}>
              Voltar
            </Button>
            <Button
              className="pesquisas__botao-perigo"
              disabled={mudando}
              onClick={() => confirmar && void mudarStatus(confirmar)}
            >
              {confirmar ? CONFIRMACAO[confirmar]?.botao : ""}
            </Button>
          </FormActions>
        }
      >
        <p>{confirmar ? CONFIRMACAO[confirmar]?.texto : ""}</p>
      </Dialog>

      <Dialog
        aberto={excluir}
        titulo={`Excluir ${detalhe.nome}?`}
        onFechar={() => setExcluir(false)}
        bloqueado={mudando}
        rodape={
          <FormActions>
            <Button variant="secondary" onClick={() => setExcluir(false)}>
              Cancelar
            </Button>
            <Button
              className="pesquisas__botao-perigo"
              disabled={mudando}
              onClick={() => void confirmarExclusao()}
            >
              Excluir pesquisa
            </Button>
          </FormActions>
        }
      >
        <p>
          {`A pesquisa sai da lista e o link deixa de funcionar. ${
            detalhe.respostas > 0
              ? `As ${plural(detalhe.respostas, "resposta recebida", "respostas recebidas")} e os resultados deixam de aparecer no Evolli. `
              : ""
          }Não é possível desfazer.`}
        </p>
      </Dialog>
    </div>
  );
}

function PoucasRespostas({ minimo }: { readonly minimo: number }) {
  return (
    <div className="pesquisas__aba-vazia">
      <IconeCadeado tamanho={18} />
      <strong>Poucas respostas para mostrar</strong>
      <span className="pesquisas__suave">
        {`Este grupo tem menos de ${plural(minimo, "resposta", "respostas")}. Para proteger quem respondeu, os números não aparecem.`}
      </span>
    </div>
  );
}

/** Os recortes que a pesquisa aceita (anônima: os escolhidos para separar). */
function recortesDe(
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
): CampoGrupo[] {
  if (geral.recortes && geral.recortes.length > 0) return geral.recortes;
  if (detalhe.identificacao === "anonima")
    return [...(detalhe.separarPor ?? [])];
  return ["departamento", "centroCusto", "unidade"];
}

function useGrupos(servico: ServicoDePesquisas): GruposDaEmpresa | null {
  const [grupos, setGrupos] = useState<GruposDaEmpresa | null>(null);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.listarGrupos())
      .then((g) => {
        if (vivo && g) setGrupos(g);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [servico]);
  return grupos;
}

function opcoesDoCampo(
  campo: CampoGrupo,
  geral: ResultadosPesquisa,
  grupos: GruposDaEmpresa | null,
): readonly { id: string; nome: string }[] {
  if (campo === "departamento" && geral.departamentos.length > 0)
    return geral.departamentos;
  return grupos?.[campo] ?? [];
}

function VisaoGeral({
  servico,
  detalhe,
  geral,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
}) {
  const base = useId();
  const grupos = useGrupos(servico);
  const recortes = recortesDe(detalhe, geral);
  const [recorte, setRecorte] = useState<{
    campo: CampoGrupo;
    grupoId: string;
  } | null>(null);
  const [atual, setAtual] = useState<ResultadosPesquisa>(geral);
  const [filtrando, setFiltrando] = useState(false);

  useEffect(() => setAtual(geral), [geral]);

  async function filtrar(campo: CampoGrupo, grupoId: string) {
    const novo = grupoId ? { campo, grupoId } : null;
    setRecorte(novo);
    setFiltrando(true);
    try {
      setAtual(
        await servico.resultadosDaPesquisa(
          detalhe.id,
          novo
            ? campo === "departamento" && !geral.recortes
              ? novo.grupoId
              : novo
            : null,
        ),
      );
    } finally {
      setFiltrando(false);
    }
  }

  const indicadores = indicadoresDe(detalhe, geral);
  const porId = new Map(atual.perguntas.map((r) => [r.perguntaId, r]));
  const todas = perguntasEmOrdem(detalhe.secoes);
  const textoDaPergunta = (id: string | undefined) =>
    todas.find((p) => p.id === id)?.texto ?? "";
  const mediasDeEscala = todas
    .filter((p) => ehDeEscala(p) && !(p.tipo === "nota_0_10" && p.config.enps))
    .map((p) => {
      const r = geral.perguntas.find((x) => x.perguntaId === p.id);
      return r && "media" in r && r.media !== null && r.media !== undefined
        ? mediaNa10(r.media, escalaDe(p))
        : null;
    })
    .filter((m): m is number => m !== null);
  const enps = indicadores.enps;

  return (
    <>
      {geral.filtro.visivel && geral.respostas > 0 ? (
        <section className="pesquisas__indicadores" aria-label="Indicadores">
          <div className="pesquisas__indicador">
            <h3>Média geral</h3>
            <p className="pesquisas__indicador-valor">
              {indicadores.mediaGeral === null
                ? "—"
                : umaCasa(indicadores.mediaGeral)}
              <span className="pesquisas__suave"> /10</span>
            </p>
            {mediasDeEscala.length > 1 ? (
              <p className="pesquisas__suave">
                {`De ${umaCasa(Math.min(...mediasDeEscala))} a ${umaCasa(Math.max(...mediasDeEscala))}`}
              </p>
            ) : null}
            <p className="pesquisas__suave">
              {`Média das ${plural(indicadores.perguntasDeEscala, "pergunta de escala", "perguntas de escala")}, com ${plural(geral.respostas, "resposta", "respostas")}`}
            </p>
            <Regua valor={indicadores.mediaGeral} rotulo="Média geral" />
          </div>
          <div className="pesquisas__indicador">
            <h3>eNPS</h3>
            {enps ? (
              <>
                <p className="pesquisas__indicador-valor">
                  {enps.indice}
                  <span
                    className={`pesquisas__selo pesquisas__zona--${enps.zona}`}
                  >
                    {ROTULO_DA_ZONA[enps.zona]}
                  </span>
                </p>
                <p className="pesquisas__suave">Promotores menos detratores</p>
                <BarraEmpilhada
                  rotulo="eNPS"
                  partes={[
                    {
                      rotulo: "promotores",
                      valor: enps.promotores,
                      cor: "var(--turno-verde)",
                    },
                    {
                      rotulo: "neutros",
                      valor: enps.neutros,
                      cor: "var(--turno-mostarda)",
                    },
                    {
                      rotulo: "detratores",
                      valor: enps.detratores,
                      cor: "var(--status-danger-ink)",
                    },
                  ]}
                />
              </>
            ) : (
              <p className="pesquisas__suave">
                Esta pesquisa não tem a pergunta de recomendação.
              </p>
            )}
          </div>
          <div className="pesquisas__indicador">
            <h3>Maior média</h3>
            {indicadores.maiorMedia ? (
              <>
                <p className="pesquisas__indicador-valor">
                  {umaCasa(indicadores.maiorMedia.media)}
                  <span className="pesquisas__suave"> /10</span>
                </p>
                <p className="pesquisas__suave">
                  {textoDaPergunta(indicadores.maiorMedia.perguntaId)}
                </p>
                <Regua
                  valor={indicadores.maiorMedia.media}
                  rotulo="Maior média"
                />
              </>
            ) : (
              <p className="pesquisas__suave">—</p>
            )}
          </div>
          <div className="pesquisas__indicador">
            <h3>Menor média</h3>
            {indicadores.menorMedia ? (
              <>
                <p className="pesquisas__indicador-valor">
                  {umaCasa(indicadores.menorMedia.media)}
                  <span className="pesquisas__suave"> /10</span>
                </p>
                <p className="pesquisas__suave">
                  {textoDaPergunta(indicadores.menorMedia.perguntaId)}
                </p>
                <Regua
                  valor={indicadores.menorMedia.media}
                  rotulo="Menor média"
                />
              </>
            ) : (
              <p className="pesquisas__suave">—</p>
            )}
          </div>
        </section>
      ) : null}

      <div className="pesquisas__secao-cabeca">
        <h2 className="pesquisas__secao-titulo">Resultados por pergunta</h2>
        {recortes.length > 0 ? (
          <div className="pesquisas__filtros-direita">
            {recortes.map((campo) => {
              const rotulo =
                CAMPOS_DE_GRUPO.find((c) => c.campo === campo)?.rotulo ?? campo;
              const opcoes = opcoesDoCampo(campo, geral, grupos);
              return (
                <div key={campo} className="pesquisas__filtro-lista">
                  <label
                    htmlFor={`${base}-${campo}`}
                    className="pesquisas__so-leitor"
                  >
                    {rotulo}
                  </label>
                  <ListaDeEscolha
                    id={`${base}-${campo}`}
                    opcoes={[
                      { valor: "", rotulo: `${rotulo}: todos` },
                      ...opcoes.map((o) => ({ valor: o.id, rotulo: o.nome })),
                    ]}
                    valor={recorte?.campo === campo ? recorte.grupoId : ""}
                    onMudar={(v) => void filtrar(campo, v)}
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div
        className="pesquisas__resultados"
        {...(filtrando ? { "aria-busy": true, "data-carregando": "" } : {})}
      >
        {!atual.filtro.visivel ? (
          <PoucasRespostas minimo={detalhe.minimoPorGrupo} />
        ) : atual.respostas === 0 ? (
          <div className="pesquisas__aba-vazia">
            <strong>Ainda não há respostas.</strong>
            <span className="pesquisas__suave">
              Os resultados aparecem aqui assim que as respostas chegarem.
            </span>
          </div>
        ) : (
          todas.map((p, i) => (
            <CartaoDaPergunta
              key={p.id}
              numero={i + 1}
              pergunta={p}
              resultado={porId.get(p.id)}
              identificada={detalhe.identificacao === "identificada"}
            />
          ))
        )}
      </div>
    </>
  );
}

function CabecaDoCartao({
  numero,
  pergunta: p,
  resultado: r,
}: {
  readonly numero: number;
  readonly pergunta: Pergunta;
  readonly resultado: ResultadoPergunta | undefined;
}) {
  return (
    <header className="pesquisas__cartao-pergunta-cabeca">
      <span className="pesquisas__numero-circulo" aria-hidden="true">
        {numero}
      </span>
      <h3>{p.texto}</h3>
      <span className="pesquisas__selo">{seloDoTipo(p)}</span>
      <span className="pesquisas__suave">
        {r
          ? [
              plural(r.respondidas, "resposta", "respostas"),
              p.condicao
                ? `${plural(r.viram, "pessoa viu", "pessoas viram")} esta pergunta`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : "Sem respostas ainda"}
      </span>
    </header>
  );
}

function LinhaComBarra({
  rotulo,
  quantidade,
  total,
}: {
  readonly rotulo: string;
  readonly quantidade: number;
  readonly total: number;
}) {
  const pct = percentual(quantidade, total);
  return (
    <li>
      <span>{rotulo}</span>
      <span className="pesquisas__barra" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span>{`${quantidade} · ${pct}%`}</span>
    </li>
  );
}

function CartaoDaPergunta({
  numero,
  pergunta: p,
  resultado: r,
  identificada,
}: {
  readonly numero: number;
  readonly pergunta: Pergunta;
  readonly resultado: ResultadoPergunta | undefined;
  readonly identificada: boolean;
}) {
  const nome = `${numero}. ${p.texto}`;

  // Comentários livres (texto).
  if (p.tipo === "paragrafo" || p.tipo === "texto_curto") {
    const textos = r && "textos" in r ? r.textos : [];
    return (
      <section className="pesquisas__cartao-pergunta" aria-label={nome}>
        <header className="pesquisas__cartao-pergunta-cabeca">
          <span
            className="pesquisas__icone-modelo pesquisas__icone-modelo--sm"
            aria-hidden="true"
          >
            <IconeComentario tamanho={14} />
          </span>
          <h3>Comentários livres</h3>
          <span className="pesquisas__suave">
            {`“${p.texto}”${p.obrigatoria ? "" : " · opcional"}`}
          </span>
          <span className="pesquisas__contagem">
            {plural(textos.length, "comentário", "comentários")}
          </span>
        </header>
        {p.condicao && r ? (
          <p className="pesquisas__suave">{`${plural(r.viram, "pessoa viu", "pessoas viram")} esta pergunta`}</p>
        ) : null}
        {textos.length === 0 ? (
          <p className="pesquisas__suave">Nenhum comentário escrito.</p>
        ) : (
          <ul className="pesquisas__comentarios">
            {textos.map((t, i) => (
              <li key={i}>
                {t.texto}
                {identificada && t.autor ? (
                  <span className="pesquisas__suave">{` — ${t.autor}`}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // eNPS.
  if (r && "enps" in r) {
    const { promotores, neutros, detratores, indice } = r.enps;
    const total = promotores + neutros + detratores;
    const zona =
      r.enps.zona ??
      (indice === null
        ? null
        : indice < 0
          ? "critica"
          : indice < 50
            ? "aperfeicoamento"
            : indice < 75
              ? "qualidade"
              : "excelencia");
    const valores = Array.from({ length: 11 }, (_, v) => ({
      valor: v,
      quantidade: r.distribuicao?.find((d) => d.valor === v)?.quantidade ?? 0,
    }));
    return (
      <section className="pesquisas__cartao-pergunta" aria-label={nome}>
        <CabecaDoCartao numero={numero} pergunta={p} resultado={r} />
        <section aria-label="eNPS" className="pesquisas__cartao-pergunta-corpo">
          <div className="pesquisas__cartao-pergunta-resumo">
            <Rosca
              fracao={indice === null ? 0 : (indice + 100) / 200}
              centro={indice === null ? "—" : String(indice)}
              legenda="eNPS"
              cor={
                zona === "critica"
                  ? "var(--status-danger-ink)"
                  : zona === "aperfeicoamento"
                    ? "var(--turno-mostarda)"
                    : "var(--turno-verde)"
              }
              rotulo={`eNPS ${indice ?? "sem dado"}`}
            />
            {zona ? (
              <span className={`pesquisas__selo pesquisas__zona--${zona}`}>
                {ROTULO_DA_ZONA[zona]}
              </span>
            ) : null}
            <ul className="pesquisas__linhas">
              {(
                [
                  ["Promotores (9–10)", promotores],
                  ["Neutros (7–8)", neutros],
                  ["Detratores (0–6)", detratores],
                ] as const
              ).map(([rotulo, q]) => (
                <LinhaComBarra
                  key={rotulo}
                  rotulo={rotulo}
                  quantidade={q}
                  total={total}
                />
              ))}
            </ul>
          </div>
          <BarrasPorNota
            valores={valores}
            cor={(v) =>
              v >= 9
                ? "var(--turno-verde)"
                : v >= 7
                  ? "var(--turno-mostarda)"
                  : "var(--status-danger-ink)"
            }
            rotuloMinimo="Nada provável"
            rotuloMaximo="Muito provável"
            rotulo={`Notas de ${p.texto}`}
          />
        </section>
        <p className="pesquisas__suave pesquisas__cartao-pergunta-rodape">
          eNPS = % de promotores − % de detratores
        </p>
      </section>
    );
  }

  // Escalas, estrelas, nota e número.
  if (r && "media" in r && r.media !== undefined && ehDeEscala(p)) {
    const e = escalaDe(p);
    const faixas = r.faixas ?? faixasDe(r.distribuicao ?? [], e);
    const favoravel = r.favoravel ?? favoravelDe(faixas);
    const { baixaAte, altaDesde } = limitesDasFaixas(e);
    const valores = Array.from({ length: e.maximo - e.minimo + 1 }, (_, i) => ({
      valor: e.minimo + i,
      quantidade:
        r.distribuicao?.find((d) => d.valor === e.minimo + i)?.quantidade ?? 0,
    }));
    const m = r.media;
    return (
      <section className="pesquisas__cartao-pergunta" aria-label={nome}>
        <CabecaDoCartao numero={numero} pergunta={p} resultado={r} />
        <div className="pesquisas__cartao-pergunta-corpo">
          <div className="pesquisas__cartao-pergunta-resumo">
            <Rosca
              fracao={m === null ? 0 : (m - e.minimo) / (e.maximo - e.minimo)}
              centro={m === null ? "—" : umaCasa(m)}
              sufixo={`/${e.maximo}`}
              legenda="Média do time"
              cor={
                m === null
                  ? "var(--surface-neutral)"
                  : COR_DA_FAIXA[faixaDaMedia10(mediaNa10(m, e))]
              }
              rotulo={`Média ${m === null ? "sem dado" : umaCasa(m)} de ${e.maximo}`}
            />
            <p className="pesquisas__forte">{`Média ${m === null ? "—" : umaCasa(m)}`}</p>
            {favoravel !== null ? (
              <span className="pesquisas__selo pesquisas__selo--sucesso">{`${favoravel}% favorável`}</span>
            ) : null}
            <BarraEmpilhada
              rotulo="Faixas"
              partes={[
                {
                  rotulo: `${e.minimo} a ${baixaAte}`,
                  valor: faixas.baixa,
                  cor: COR_DA_FAIXA.baixa,
                },
                {
                  rotulo: `${baixaAte + 1} a ${altaDesde - 1}`,
                  valor: faixas.media,
                  cor: COR_DA_FAIXA.media,
                },
                {
                  rotulo: `${altaDesde} a ${e.maximo}`,
                  valor: faixas.alta,
                  cor: COR_DA_FAIXA.alta,
                },
              ]}
            />
          </div>
          <BarrasPorNota
            valores={valores}
            cor={(v) => corDaNota(v, e)}
            {...(p.tipo === "escala" && p.config.rotuloMinimo
              ? { rotuloMinimo: p.config.rotuloMinimo }
              : {})}
            {...(p.tipo === "escala" && p.config.rotuloMaximo
              ? { rotuloMaximo: p.config.rotuloMaximo }
              : {})}
            rotulo={`Notas de ${p.texto}`}
          />
        </div>
        <p className="pesquisas__suave pesquisas__cartao-pergunta-rodape">
          {`Favorável = notas ${textoDoFavoravel(e)}`}
        </p>
      </section>
    );
  }

  return (
    <section className="pesquisas__cartao-pergunta" aria-label={nome}>
      <CabecaDoCartao numero={numero} pergunta={p} resultado={r} />
      {!r ? null : "opcoes" in r ? (
        <>
          <ul className="pesquisas__linhas">
            {r.opcoes.map((o) => (
              <LinhaComBarra
                key={o.opcaoId}
                rotulo={
                  p.config.opcoes?.find((x) => x.id === o.opcaoId)?.texto ??
                  "Opção removida"
                }
                quantidade={o.quantidade}
                total={r.respondidas}
              />
            ))}
          </ul>
          {r.outros.length > 0 ? (
            <>
              <p className="pesquisas__suave">Escritas em &quot;Outro&quot;</p>
              <ul className="pesquisas__comentarios">
                {r.outros.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : "sim" in r ? (
        <ul className="pesquisas__linhas">
          <LinhaComBarra
            rotulo="Sim"
            quantidade={r.sim}
            total={r.sim + r.nao}
          />
          <LinhaComBarra
            rotulo="Não"
            quantidade={r.nao}
            total={r.sim + r.nao}
          />
        </ul>
      ) : "datas" in r ? (
        <ul className="pesquisas__linhas">
          {r.datas.map((d) => (
            <LinhaComBarra
              key={d.valor}
              rotulo={formatarDiaCivil(d.valor)}
              quantidade={d.quantidade}
              total={r.respondidas}
            />
          ))}
        </ul>
      ) : "media" in r && r.media !== undefined ? (
        <p className="pesquisas__forte">{`Média ${r.media === null ? "—" : umaCasa(r.media)}`}</p>
      ) : null}
    </section>
  );
}

function Analises({
  servico,
  detalhe,
  geral,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
}) {
  const recortes = recortesDe(detalhe, geral);
  const [campo, setCampo] = useState<CampoGrupo | null>(recortes[0] ?? null);
  const [dados, setDados] = useState<AnalisesPesquisa | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!campo) return;
    let vivo = true;
    setFalhou(false);
    Promise.resolve(servico.analisesDaPesquisa(detalhe.id, campo))
      .then((d) => {
        if (vivo) setDados(d ?? null);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, detalhe.id, campo]);

  const rotuloDoCampo = (c: CampoGrupo) =>
    CAMPOS_DE_GRUPO.find((x) => x.campo === c)?.rotulo.toLowerCase() ?? c;
  const anonima = detalhe.identificacao === "anonima";
  const participacaoPorDepartamento = useMemo(() => {
    const m = new Map<string, { total: number; responderam: number }>();
    for (const p of detalhe.participantesLista ?? []) {
      const d = p.departamento ?? "Sem departamento";
      const atual = m.get(d) ?? { total: 0, responderam: 0 };
      atual.total += 1;
      if (p.respondeu) atual.responderam += 1;
      m.set(d, atual);
    }
    return [...m.entries()];
  }, [detalhe.participantesLista]);

  return (
    <>
      {recortes.length === 0 ? (
        <p className="pesquisas__nota">
          Esta pesquisa anônima não pediu para separar as respostas por grupo:
          não há recortes para comparar.
        </p>
      ) : (
        <section
          className="pesquisas__cartao-secao"
          aria-label="Média por grupo"
        >
          <header className="pesquisas__cartao-secao-cabeca">
            <div>
              <h2 className="pesquisas__cartao-secao-titulo">
                {`Média por ${campo ? rotuloDoCampo(campo) : "grupo"}`}
              </h2>
              <p className="pesquisas__suave">Médias na escala de 0 a 10</p>
            </div>
            {recortes.length > 1 ? (
              <Pilulas
                rotulo="Comparar por"
                valor={campo ?? recortes[0]!}
                onMudar={(c) => setCampo(c)}
                opcoes={recortes.map((c) => ({
                  valor: c,
                  rotulo:
                    CAMPOS_DE_GRUPO.find((x) => x.campo === c)?.rotulo ?? c,
                }))}
              />
            ) : null}
          </header>
          {falhou ? (
            <p className="pesquisas__erro" role="alert">
              Não foi possível carregar as análises.
            </p>
          ) : !dados ? (
            <Esqueleto rotulo="Carregando análises…" linhas={4} />
          ) : (
            <>
              <div className="pesquisas__tabela-caixa">
                <table
                  className="pesquisas__tabela pesquisas__mapa"
                  aria-label={`Médias por ${rotuloDoCampo(dados.campo)}`}
                >
                  <thead>
                    <tr>
                      <th scope="col">
                        {
                          CAMPOS_DE_GRUPO.find((x) => x.campo === dados.campo)
                            ?.rotulo
                        }
                      </th>
                      <th scope="col" className="pesquisas__numero">
                        Média
                      </th>
                      {dados.colunas.map((c) => (
                        <th
                          key={c.perguntaId}
                          scope="col"
                          className="pesquisas__numero"
                        >
                          {c.rotulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dados.linhas.map((l) => (
                      <tr key={l.grupoId ?? "todos"}>
                        <th scope="row">
                          {l.grupoId === null ? "Toda a empresa" : l.nome}
                          <span className="pesquisas__suave">{` (${plural(l.respostas, "resposta", "respostas")})`}</span>
                        </th>
                        {l.visivel ? (
                          [l.media, ...l.medias].map((v, i) => (
                            <td
                              key={i}
                              className="pesquisas__numero pesquisas__mapa-celula"
                              {...(v !== null
                                ? { "data-faixa": faixaDaMedia10(v) }
                                : {})}
                            >
                              {v === null ? "—" : umaCasa(v)}
                            </td>
                          ))
                        ) : (
                          <td
                            colSpan={dados.colunas.length + 1}
                            className="pesquisas__suave"
                          >
                            <IconeCadeado tamanho={12} />
                            {` Oculto · menos de ${plural(detalhe.minimoPorGrupo, "resposta", "respostas")}`}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="pesquisas__legenda">
                <li>
                  <span className="pesquisas__ponto" data-faixa="baixa" />
                  Abaixo de 6,5
                </li>
                <li>
                  <span className="pesquisas__ponto" data-faixa="media" />
                  6,5 a 7,9
                </li>
                <li>
                  <span className="pesquisas__ponto" data-faixa="alta" />8 ou
                  mais
                </li>
              </ul>
            </>
          )}
        </section>
      )}

      <section
        className="pesquisas__cartao-secao"
        aria-label="Evolução da média geral"
      >
        <header className="pesquisas__cartao-secao-cabeca">
          <div>
            <h2 className="pesquisas__cartao-secao-titulo">
              Evolução da média geral
            </h2>
            <p className="pesquisas__suave">{`Pesquisas anteriores do modelo ${ROTULO_DO_MODELO[detalhe.modelo]}`}</p>
          </div>
        </header>
        {dados &&
        dados.evolucao.filter((e) => e.mediaGeral !== null).length >= 2 ? (
          <LinhaDeEvolucao
            rotulo="Evolução da média geral"
            pontos={dados.evolucao.map((e) => ({
              rotulo: `${e.nome} · ${dataDoInstante(e.publicadaEm)}`,
              valor: e.mediaGeral,
            }))}
          />
        ) : (
          <p className="pesquisas__suave">
            {`A evolução aparece a partir da segunda pesquisa ${ROTULO_DO_MODELO[detalhe.modelo]}.`}
          </p>
        )}
      </section>

      {!anonima && participacaoPorDepartamento.length > 0 ? (
        <section
          className="pesquisas__cartao-secao"
          aria-label="Participação por departamento"
        >
          <header className="pesquisas__cartao-secao-cabeca">
            <h2 className="pesquisas__cartao-secao-titulo">
              Participação por departamento
            </h2>
          </header>
          <ul className="pesquisas__linhas">
            {participacaoPorDepartamento.map(([d, v]) => (
              <li key={d}>
                <span>{d}</span>
                <span className="pesquisas__barra" aria-hidden="true">
                  <span
                    style={{
                      width: `${participacao(v.responderam, v.total)}%`,
                    }}
                  />
                </span>
                <span>
                  {`${v.responderam} de ${v.total} · ${participacao(v.responderam, v.total)}%`}
                  {v.total > v.responderam ? (
                    <span className="pesquisas__suave">{` · faltam ${v.total - v.responderam}`}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function ListaDeRespostas({
  detalhe,
  respostas,
  onAbrir,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly respostas: RespostaResumo[] | null;
  readonly onAbrir: (id: string) => void;
}) {
  const identificada = detalhe.identificacao === "identificada";
  if (!respostas)
    return <Esqueleto rotulo="Carregando respostas…" linhas={4} />;
  if (respostas.length === 0)
    return (
      <div className="pesquisas__aba-vazia">
        <strong>Ninguém respondeu ainda.</strong>
      </div>
    );
  return (
    <>
      <Pilulas
        rotulo="Respostas"
        valor="todos"
        onMudar={() => undefined}
        opcoes={[
          { valor: "todos", rotulo: "Todos", contagem: respostas.length },
        ]}
      />
      {identificada ? (
        <p className="pesquisas__suave">
          A consulta às respostas individuais fica registrada na auditoria.
        </p>
      ) : null}
      <div className="pesquisas__tabela-caixa">
        <table
          className="pesquisas__tabela pesquisas__tabela--clicavel"
          aria-label="Respostas"
        >
          <thead>
            <tr>
              <th scope="col">Resposta</th>
              <th scope="col">Média das respostas</th>
              <th scope="col">Respondeu em</th>
              <th scope="col">
                <span className="pesquisas__so-leitor">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {respostas.map((r) => {
              const nome =
                identificada && r.nome
                  ? r.nome
                  : `Resposta anônima #${r.numero}`;
              return (
                <tr key={r.id} onClick={() => onAbrir(r.id)}>
                  <td>
                    <span className="pesquisas__pessoa-linha">
                      <Avatar
                        texto={
                          identificada && r.nome
                            ? iniciaisDe(r.nome)
                            : `R${r.numero}`
                        }
                      />
                      <span className="pesquisas__pessoa-textos">
                        <span className="pesquisas__forte">{nome}</span>
                        {identificada && r.departamento ? (
                          <span className="pesquisas__suave">
                            {r.departamento}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td>
                    {r.media === null ? (
                      "—"
                    ) : (
                      <span
                        className="pesquisas__nota-colorida"
                        data-faixa={faixaDaMedia10(r.media)}
                      >
                        {`${umaCasa(r.media)} /10`}
                      </span>
                    )}
                  </td>
                  <td className="pesquisas__numero">
                    {diaEHora(r.respondidaEm)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="pesquisas__acao-texto pesquisas__acao-texto--primaria"
                      aria-label={`Ver resultado de ${nome}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrir(r.id);
                      }}
                    >
                      Ver resultado
                      <IconeAvancar tamanho={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
