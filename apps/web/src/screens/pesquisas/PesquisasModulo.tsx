/**
 * T216 — módulo Pesquisas (menu Pessoas › Pesquisas).
 *
 * - Sem pesquisas: "Crie sua primeira pesquisa", os três passos e a galeria.
 * - Com pesquisas: pílulas de status, busca ("/"), filtro por tipo, a tabela
 *   (a linha inteira abre os resultados) e o rodapé da tabela.
 * - "Nova pesquisa" abre a galeria como passo 1; o modelo pronto abre o
 *   assistente de 3 etapas; a personalizada abre a página de entrada e o
 *   assistente de 5 etapas. Rascunhos não entram na lista: retomam-se pelo
 *   próprio modelo (ou pelo aviso da página da personalizada).
 *
 * As subtelas vivem dentro do módulo (a rota é `#/pesquisas`). RH e DP
 * operam; o master técnico só lê. O servidor decide cada pedido.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ModeloPesquisa,
  PesquisaDetalhe,
  PesquisaResumo,
  StatusPesquisa,
} from "../../api/pesquisasClient";
import { Button, FormActions, StatusBadge } from "../../components";
import { diaCivilDeHoje } from "../../format/data";
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
import { IconeMais, IconeMaisAcoes, IconeVoltar } from "../../ui/icones";
import { Esqueleto } from "../../ui/movimento";
import { AssistenteDePesquisa } from "./AssistenteDePesquisa";
import { AssistenteDoModelo } from "./AssistenteDoModelo";
import {
  CampoDeBusca,
  ICONE_DA_IDENTIFICACAO,
  IconeDoModelo,
  PassosIniciais,
  Pilulas,
} from "./componentes";
import { EntradaPersonalizada } from "./EntradaPersonalizada";
import type { EstadoDaPesquisa } from "./estadoDaPesquisa";
import { GaleriaDeModelos, semAcento } from "./GaleriaDeModelos";
import { ehModeloPronto, MODELOS_DE_PESQUISA } from "./modelosDePesquisa";
import { esquecerRascunho } from "./rascunhosLocais";
import { ResultadoIndividual } from "./ResultadoIndividual";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import { SobreOModelo } from "./SobreOModelo";
import {
  ROTULO_DA_IDENTIFICACAO,
  ROTULO_DO_MODELO,
  ROTULO_DO_STATUS,
  TOM_DO_STATUS,
  copiarLink,
  dataDoInstante,
  enderecoDoLink,
  participacao,
  podeEditarPesquisa,
} from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";
import "./Pesquisas.css";

export { PESQUISAS_TITULO_ID };

const TAMANHO_DA_LISTA = 100;

type Tela =
  | { readonly tipo: "lista" }
  | { readonly tipo: "galeria" }
  | { readonly tipo: "sobre"; readonly id: string; readonly volta: Tela }
  | { readonly tipo: "personalizada" }
  | {
      readonly tipo: "modelo";
      readonly modeloId: string;
      readonly base?: PesquisaDetalhe;
    }
  | {
      readonly tipo: "aberta";
      readonly roteiro?: string;
      readonly inicial?: EstadoDaPesquisa;
      readonly base?: PesquisaDetalhe;
    }
  | { readonly tipo: "resultados"; readonly id: string }
  | {
      readonly tipo: "resposta";
      readonly pesquisaId: string;
      readonly respostaId: string;
    };

export function PesquisasModulo({
  servico,
  podeEditar,
}: {
  readonly servico: ServicoDePesquisas;
  /** RH e DP: criam, editam, publicam, mudam status e excluem. */
  readonly podeEditar: boolean;
}) {
  const [tela, setTela] = useState<Tela>({ tipo: "lista" });
  const [aviso, setAviso] = useState<string | null>(null);
  const hoje = diaCivilDeHoje();

  const irPara = useCallback((t: Tela, mensagem?: string) => {
    setTela(t);
    setAviso(mensagem ?? null);
    requestAnimationFrame?.(() =>
      document.getElementById(PESQUISAS_TITULO_ID)?.focus(),
    );
  }, []);

  /** Editar: o assistente do tipo da pesquisa, com a pesquisa carregada. */
  async function abrirEdicao(id: string) {
    try {
      const base = await servico.obterPesquisa(id);
      irPara(
        ehModeloPronto(base.modelo)
          ? { tipo: "modelo", modeloId: base.modelo, base }
          : { tipo: "aberta", base },
      );
    } catch {
      setAviso("Não foi possível abrir a pesquisa. Tente de novo.");
    }
  }

  /** Usar um modelo: retoma o rascunho dele, se houver; senão, começa um. */
  async function usarModelo(id: string) {
    if (id === "personalizada") {
      irPara({ tipo: "personalizada" });
      return;
    }
    try {
      const rascunhos = await servico.listarPesquisas({
        status: "rascunho",
        tamanhoPagina: TAMANHO_DA_LISTA,
      });
      const doModelo = (rascunhos?.itens ?? []).find(
        (p) => p.modelo === (id as ModeloPesquisa),
      );
      if (doModelo) {
        const base = await servico.obterPesquisa(doModelo.id);
        irPara({ tipo: "modelo", modeloId: id, base });
        return;
      }
    } catch {
      /* sem a lista de rascunhos, começa do zero */
    }
    irPara({ tipo: "modelo", modeloId: id });
  }

  const voltarAoFim = (mensagem?: string) =>
    irPara({ tipo: "lista" }, mensagem);

  switch (tela.tipo) {
    case "modelo":
      return (
        <AssistenteDoModelo
          key={tela.base?.id ?? tela.modeloId}
          servico={servico}
          modeloId={tela.modeloId}
          {...(tela.base ? { base: tela.base } : {})}
          hoje={hoje}
          onCancelar={(mensagem) =>
            tela.base && tela.base.status !== "rascunho"
              ? irPara({ tipo: "resultados", id: tela.base.id })
              : irPara({ tipo: "galeria" }, mensagem)
          }
          onConcluir={() => voltarAoFim()}
          onVerResultados={(id, mensagem) => {
            esquecerRascunho(id);
            irPara({ tipo: "resultados", id }, mensagem);
          }}
          onEditarGerada={(base) =>
            irPara({ tipo: "modelo", modeloId: base.modelo, base })
          }
        />
      );
    case "aberta":
      return (
        <AssistenteDePesquisa
          key={tela.base?.id ?? tela.roteiro ?? "aberta"}
          servico={servico}
          hoje={hoje}
          {...(tela.base ? { base: tela.base } : {})}
          {...(tela.inicial ? { inicial: tela.inicial } : {})}
          {...(tela.roteiro ? { modelo: tela.roteiro } : {})}
          onSair={(mensagem) =>
            tela.base && tela.base.status !== "rascunho"
              ? irPara({ tipo: "resultados", id: tela.base.id }, mensagem)
              : irPara({ tipo: "personalizada" }, mensagem)
          }
          onConcluir={() => voltarAoFim()}
          onVerResultados={(id, mensagem) => {
            esquecerRascunho(id);
            irPara({ tipo: "resultados", id }, mensagem);
          }}
          onEditarGerada={(base) => irPara({ tipo: "aberta", base })}
        />
      );
    case "personalizada":
      return (
        <EntradaPersonalizada
          servico={servico}
          aviso={aviso}
          onVoltar={() => irPara({ tipo: "galeria" })}
          onComecar={(x) => irPara({ tipo: "aberta", ...x })}
          onSobre={(id) =>
            irPara({ tipo: "sobre", id, volta: { tipo: "personalizada" } })
          }
        />
      );
    case "sobre":
      return (
        <SobreOModelo
          id={tela.id}
          onVoltar={() => irPara(tela.volta)}
          onUsar={(id) =>
            tela.volta.tipo === "personalizada"
              ? irPara({ tipo: "aberta", roteiro: id })
              : void usarModelo(id)
          }
        />
      );
    case "resultados":
      return (
        <ResultadosDaPesquisa
          key={tela.id}
          servico={servico}
          pesquisaId={tela.id}
          podeEditar={podeEditar}
          avisoInicial={aviso}
          onVoltar={(mensagem) => voltarAoFim(mensagem)}
          onEditar={(base) =>
            irPara(
              ehModeloPronto(base.modelo)
                ? { tipo: "modelo", modeloId: base.modelo, base }
                : { tipo: "aberta", base },
            )
          }
          onDuplicada={(copia) =>
            irPara(
              ehModeloPronto(copia.modelo)
                ? { tipo: "modelo", modeloId: copia.modelo, base: copia }
                : { tipo: "aberta", base: copia },
              "Cópia criada como rascunho.",
            )
          }
          onSobreOModelo={(id) =>
            irPara({
              tipo: "sobre",
              id,
              volta: { tipo: "resultados", id: tela.id },
            })
          }
          onAbrirResposta={(respostaId) =>
            irPara({ tipo: "resposta", pesquisaId: tela.id, respostaId })
          }
        />
      );
    case "resposta":
      return (
        <ResultadoIndividual
          key={tela.respostaId}
          servico={servico}
          pesquisaId={tela.pesquisaId}
          respostaId={tela.respostaId}
          onVoltar={() => irPara({ tipo: "resultados", id: tela.pesquisaId })}
          onIr={(respostaId) =>
            irPara({
              tipo: "resposta",
              pesquisaId: tela.pesquisaId,
              respostaId,
            })
          }
        />
      );
    case "galeria":
      return (
        <div className="pesquisas">
          <header className="pesquisas__cabecalho">
            <IconButton
              label="Voltar para Pesquisas"
              icon={<IconeVoltar tamanho={18} />}
              className="pesquisas__voltar"
              onClick={() => irPara({ tipo: "lista" })}
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
            <span className="pesquisas__selo">Passo 1 de 4</span>
          </header>
          {aviso ? (
            <p className="pesquisas__aviso" role="status">
              {aviso}
            </p>
          ) : null}
          <GaleriaDeModelos
            onUsar={(id) => void usarModelo(id)}
            onSobre={(id) =>
              irPara({ tipo: "sobre", id, volta: { tipo: "galeria" } })
            }
          />
        </div>
      );
    default:
      return (
        <ListaDePesquisas
          servico={servico}
          podeEditar={podeEditar}
          aviso={aviso}
          onAviso={setAviso}
          onNova={() => irPara({ tipo: "galeria" })}
          onUsarModelo={(id) => void usarModelo(id)}
          onSobre={(id) =>
            irPara({ tipo: "sobre", id, volta: { tipo: "lista" } })
          }
          onResultados={(id) => irPara({ tipo: "resultados", id })}
          onEditar={(id) => void abrirEdicao(id)}
        />
      );
  }
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
  aviso,
  onAviso,
  onNova,
  onUsarModelo,
  onSobre,
  onResultados,
  onEditar,
}: {
  readonly servico: ServicoDePesquisas;
  readonly podeEditar: boolean;
  readonly aviso: string | null;
  readonly onAviso: (m: string | null) => void;
  readonly onNova: () => void;
  readonly onUsarModelo: (id: string) => void;
  readonly onSobre: (id: string) => void;
  readonly onResultados: (id: string) => void;
  readonly onEditar: (id: string) => void;
}) {
  const [itens, setItens] = useState<PesquisaResumo[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [versao, setVersao] = useState(0);
  const [status, setStatus] = useState<FiltroDeStatus>("todas");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [crescente, setCrescente] = useState(false);
  const [excluir, setExcluir] = useState<PesquisaResumo | null>(null);
  const [excluindo, setExcluindo] = useState(false);

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
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, versao]);

  const contagem = (s: FiltroDeStatus) =>
    (itens ?? []).filter((p) => s === "todas" || p.status === s).length;

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return (itens ?? [])
      .filter((p) => status === "todas" || p.status === status)
      .filter((p) => !tipo || p.modelo === tipo)
      .filter((p) => !termo || semAcento(p.nome).includes(termo))
      .sort((a, b) =>
        crescente
          ? a.criadaEm.localeCompare(b.criadaEm)
          : b.criadaEm.localeCompare(a.criadaEm),
      );
  }, [itens, status, tipo, busca, crescente]);

  async function duplicar(p: PesquisaResumo) {
    try {
      const copia = await servico.duplicarPesquisa(p.id);
      onAviso(
        `Cópia criada como rascunho: ${copia.nome}. Abra o modelo para continuar.`,
      );
      recarregar();
    } catch {
      onAviso("Não foi possível duplicar a pesquisa. Tente de novo.");
    }
  }

  async function copiar(p: PesquisaResumo) {
    if (!p.link) return;
    onAviso(
      (await copiarLink(p.link))
        ? "Link copiado."
        : `Não foi possível copiar. Copie o endereço: ${enderecoDoLink(p.link)}`,
    );
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    setExcluindo(true);
    try {
      await servico.excluirPesquisa(excluir.id);
      setExcluir(null);
      onAviso("Pesquisa excluída.");
      recarregar();
    } catch {
      onAviso("Não foi possível excluir a pesquisa. Tente de novo.");
      setExcluir(null);
    } finally {
      setExcluindo(false);
    }
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

      {aviso ? (
        <p className="pesquisas__aviso" role="status">
          {aviso}
        </p>
      ) : null}

      {falhou ? (
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
          <div className="pesquisas__filtros">
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
              <div className="pesquisas__filtro-lista">
                <label
                  htmlFor="pesquisas-filtro-tipo"
                  className="pesquisas__so-leitor"
                >
                  Tipo
                </label>
                <ListaDeEscolha
                  id="pesquisas-filtro-tipo"
                  opcoes={[
                    { valor: "", rotulo: "Tipo: todos" },
                    ...MODELOS_DE_PESQUISA.map((m) => ({
                      valor: m.modelo,
                      rotulo: m.nome,
                    })),
                  ]}
                  valor={tipo}
                  onMudar={setTipo}
                />
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
                      onClick={() => setCrescente((c) => !c)}
                    >
                      Criada em {crescente ? "▴" : "▾"}
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
                      {busca || tipo
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
                      onEditar={() => onEditar(p.id)}
                      onDuplicar={() => void duplicar(p)}
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

      <Dialog
        aberto={excluir !== null}
        titulo={excluir ? `Excluir ${excluir.nome}?` : ""}
        onFechar={() => setExcluir(null)}
        bloqueado={excluindo}
        rodape={
          <FormActions>
            <Button
              variant="secondary"
              disabled={excluindo}
              onClick={() => setExcluir(null)}
            >
              Cancelar
            </Button>
            <Button
              className="pesquisas__botao-perigo"
              disabled={excluindo}
              onClick={() => void confirmarExclusao()}
            >
              Excluir pesquisa
            </Button>
          </FormActions>
        }
      >
        {excluir ? (
          <p>
            {`A pesquisa sai da lista e o link deixa de funcionar. ${
              excluir.respostas > 0
                ? `As ${plural(excluir.respostas, "resposta recebida", "respostas recebidas")} e os resultados deixam de aparecer no Evolli. `
                : ""
            }Não é possível desfazer.`}
          </p>
        ) : null}
      </Dialog>
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
    <span className="pesquisas__participacao">
      <span>
        <span className="pesquisas__forte">{`${p.respostas}/${p.participantes}`}</span>
        <span className="pesquisas__suave">{` · ${pct}%`}</span>
      </span>
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
          <IconeDoModelo id={p.modelo} tamanho="sm" />
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
              {`${ROTULO_DO_MODELO[p.modelo]} · `}
              <IconeId tamanho={12} />
              {ROTULO_DA_IDENTIFICACAO[p.identificacao]}
            </span>
          </button>
        </span>
      </td>
      <td>
        <Participacao pesquisa={p} />
      </td>
      <td className="pesquisas__numero">{dataDoInstante(p.criadaEm)}</td>
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
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={onResultados}>
                  Ver resultados
                </DropdownMenuItem>
                {podeEditar && podeEditarPesquisa(p.status) ? (
                  <DropdownMenuItem onSelect={onEditar}>
                    Editar pesquisa
                  </DropdownMenuItem>
                ) : null}
                {podeEditar ? (
                  <DropdownMenuItem onSelect={onDuplicar}>
                    Duplicar
                  </DropdownMenuItem>
                ) : null}
                {p.link ? (
                  <DropdownMenuItem onSelect={onCopiar}>
                    Copiar link
                  </DropdownMenuItem>
                ) : null}
                {podeEditar ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="pesquisas__menu-perigo"
                      onSelect={onExcluir}
                    >
                      Excluir
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
