/**
 * T216 — módulo Pesquisas (menu Pessoas › Pesquisas): a lista por status, as
 * boas-vindas com a galeria quando ainda não há pesquisas, a galeria de
 * modelos, o assistente em 5 etapas e os resultados de cada pesquisa.
 *
 * As subtelas vivem dentro do módulo (a rota é `#/pesquisas`). RH e DP
 * operam; o master técnico só lê (sem ações). O servidor decide cada pedido.
 */
import { useCallback, useEffect, useState } from "react";
import type {
  ListaDePesquisasApi,
  ModeloPesquisa,
  PesquisaDetalhe,
  PesquisaResumo,
  StatusPesquisa,
} from "../../api/pesquisasClient";
import { Button, FormActions, StatusBadge } from "../../components";
import { plural } from "../../format/plural";
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from "../../ui";
import {
  IconeMais,
  IconeMaisAcoes,
  IconePesquisas,
  IconeVoltar,
} from "../../ui/icones";
import { Esqueleto } from "../../ui/movimento";
import { AssistenteDePesquisa } from "./AssistenteDePesquisa";
import { GaleriaDeModelos } from "./GaleriaDeModelos";
import { ResultadosDaPesquisa } from "./ResultadosDaPesquisa";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
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
import { diaCivilDeHoje } from "../../format/data";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";
import "./Pesquisas.css";

export { PESQUISAS_TITULO_ID };

const TAMANHO_DA_PAGINA = 20;

type Tela =
  | { readonly tipo: "lista" }
  | { readonly tipo: "galeria" }
  | { readonly tipo: "nova"; readonly modelo: ModeloPesquisa }
  | { readonly tipo: "editar"; readonly base: PesquisaDetalhe }
  | { readonly tipo: "resultados"; readonly id: string };

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

  const irPara = (t: Tela, mensagem?: string) => {
    setTela(t);
    setAviso(mensagem ?? null);
    // O foco vai ao título da tela nova (o navegador rola até ele).
    requestAnimationFrame?.(() =>
      document.getElementById(PESQUISAS_TITULO_ID)?.focus(),
    );
  };

  async function abrirEdicao(id: string) {
    try {
      const base = await servico.obterPesquisa(id);
      irPara({ tipo: "editar", base });
    } catch {
      setAviso("Não foi possível abrir a pesquisa. Tente de novo.");
    }
  }

  if (tela.tipo === "nova" || tela.tipo === "editar") {
    return (
      <AssistenteDePesquisa
        servico={servico}
        hoje={diaCivilDeHoje()}
        {...(tela.tipo === "nova"
          ? { modelo: tela.modelo }
          : { base: tela.base })}
        onSair={(mensagem) => irPara({ tipo: "lista" }, mensagem)}
        onVerResultados={(id, mensagem) =>
          irPara({ tipo: "resultados", id }, mensagem)
        }
      />
    );
  }
  if (tela.tipo === "resultados") {
    return (
      <ResultadosDaPesquisa
        key={tela.id}
        servico={servico}
        pesquisaId={tela.id}
        podeEditar={podeEditar}
        avisoInicial={aviso}
        onVoltar={(mensagem) => irPara({ tipo: "lista" }, mensagem)}
        onEditar={(base) => irPara({ tipo: "editar", base })}
      />
    );
  }
  if (tela.tipo === "galeria") {
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
              Nova pesquisa
            </h1>
            <p className="pesquisas__subtitulo">
              Escolha um modelo para começar. Tudo pode ser ajustado antes de
              publicar.
            </p>
          </div>
        </header>
        <GaleriaDeModelos
          onUsar={(modelo) => irPara({ tipo: "nova", modelo })}
        />
      </div>
    );
  }
  return (
    <ListaDePesquisas
      servico={servico}
      podeEditar={podeEditar}
      aviso={aviso}
      onAviso={setAviso}
      onNova={() => irPara({ tipo: "galeria" })}
      onUsarModelo={(modelo) => irPara({ tipo: "nova", modelo })}
      onResultados={(id) => irPara({ tipo: "resultados", id })}
      onEditar={(id) => void abrirEdicao(id)}
    />
  );
}

const ABAS: readonly {
  readonly valor: StatusPesquisa | "todas";
  readonly rotulo: string;
}[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "ativa", rotulo: "Ativas" },
  { valor: "pausada", rotulo: "Pausadas" },
  { valor: "finalizada", rotulo: "Finalizadas" },
  { valor: "cancelada", rotulo: "Canceladas" },
];

const VAZIO_DA_ABA: Readonly<Record<StatusPesquisa | "todas", string>> = {
  todas: "Nenhuma pesquisa por aqui.",
  rascunho: "Nenhum rascunho.",
  ativa:
    "Nenhuma pesquisa ativa. Publique um rascunho para começar a receber respostas.",
  pausada: "Nenhuma pesquisa pausada.",
  finalizada: "Nenhuma pesquisa finalizada.",
  cancelada: "Nenhuma pesquisa cancelada.",
};

function ListaDePesquisas({
  servico,
  podeEditar,
  aviso,
  onAviso,
  onNova,
  onUsarModelo,
  onResultados,
  onEditar,
}: {
  readonly servico: ServicoDePesquisas;
  readonly podeEditar: boolean;
  readonly aviso: string | null;
  readonly onAviso: (m: string | null) => void;
  readonly onNova: () => void;
  readonly onUsarModelo: (modelo: ModeloPesquisa) => void;
  readonly onResultados: (id: string) => void;
  readonly onEditar: (id: string) => void;
}) {
  const [aba, setAba] = useState<StatusPesquisa | "todas">("todas");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<ListaDePesquisasApi | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [excluir, setExcluir] = useState<PesquisaResumo | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [versao, setVersao] = useState(0);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    Promise.resolve(
      servico.listarPesquisas({
        ...(aba === "todas" ? {} : { status: aba }),
        pagina,
        tamanhoPagina: TAMANHO_DA_PAGINA,
      }),
    )
      .then((d) => {
        if (vivo) setDados(d);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, aba, pagina, versao]);

  const semNenhuma = dados !== null && dados.contagens.todas === 0;
  const paginas = dados
    ? Math.max(1, Math.ceil(dados.total / dados.tamanhoPagina))
    : 1;

  async function duplicar(p: PesquisaResumo) {
    try {
      const copia = await servico.duplicarPesquisa(p.id);
      onAviso(`Cópia criada como rascunho: ${copia.nome}.`);
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

  return (
    <div className="pesquisas">
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
            Meça clima, engajamento e a experiência das pessoas com pesquisas da
            própria empresa.
          </p>
        </div>
        {podeEditar && dados && !semNenhuma ? (
          <div className="pesquisas__acoes-topo">
            <Button onClick={onNova}>
              <IconeMais tamanho={16} />
              Nova pesquisa
            </Button>
          </div>
        ) : null}
      </header>

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
      ) : !dados ? (
        <Esqueleto rotulo="Carregando pesquisas…" linhas={5} />
      ) : semNenhuma ? (
        <BoasVindas podeEditar={podeEditar} onUsarModelo={onUsarModelo} />
      ) : (
        <>
          <div role="tablist" aria-label="Status" className="pesquisas__abas">
            {ABAS.map((a) => (
              <button
                key={a.valor}
                type="button"
                role="tab"
                aria-selected={aba === a.valor}
                onClick={() => {
                  setAba(a.valor);
                  setPagina(1);
                }}
              >
                {a.rotulo}
                <span className="pesquisas__contagem">
                  {dados.contagens[a.valor] ?? 0}
                </span>
              </button>
            ))}
          </div>
          {dados.itens.length === 0 ? (
            <div className="pesquisas__aba-vazia">
              <span className="pesquisas__suave">{VAZIO_DA_ABA[aba]}</span>
            </div>
          ) : (
            <div className="pesquisas__tabela-caixa">
              <table className="pesquisas__tabela" aria-label="Pesquisas">
                <thead>
                  <tr>
                    <th scope="col">Pesquisa</th>
                    <th scope="col">Participação</th>
                    <th scope="col">Criada em</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="pesquisas__so-leitor">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.itens.map((p) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {paginas > 1 ? (
            <nav className="pesquisas__paginacao" aria-label="Páginas">
              <Button
                variant="secondary"
                disabled={pagina <= 1}
                onClick={() => setPagina((n) => n - 1)}
              >
                Anterior
              </Button>
              <span className="pesquisas__suave">{`Página ${pagina} de ${paginas}`}</span>
              <Button
                variant="secondary"
                disabled={pagina >= paginas}
                onClick={() => setPagina((n) => n + 1)}
              >
                Próxima
              </Button>
            </nav>
          ) : null}
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
  const pct = participacao(p.respostas, p.participantes);
  const rascunho = p.status === "rascunho";
  const abrir = rascunho ? (podeEditar ? onEditar : null) : onResultados;
  return (
    <tr>
      <td>
        {abrir ? (
          <button
            type="button"
            className="pesquisas__nome-botao"
            onClick={abrir}
          >
            <span className="pesquisas__forte">{p.nome}</span>
            <span className="pesquisas__suave">
              {`${ROTULO_DO_MODELO[p.modelo]} · ${ROTULO_DA_IDENTIFICACAO[p.identificacao]}`}
            </span>
          </button>
        ) : (
          <span className="pesquisas__nome-botao">
            <span className="pesquisas__forte">{p.nome}</span>
            <span className="pesquisas__suave">
              {`${ROTULO_DO_MODELO[p.modelo]} · ${ROTULO_DA_IDENTIFICACAO[p.identificacao]}`}
            </span>
          </span>
        )}
      </td>
      <td>
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
      </td>
      <td className="pesquisas__numero">{dataDoInstante(p.criadaEm)}</td>
      <td>
        <StatusBadge variant={TOM_DO_STATUS[p.status]}>
          {ROTULO_DO_STATUS[p.status]}
        </StatusBadge>
      </td>
      <td>
        <div className="pesquisas__acoes-linha">
          {rascunho ? (
            podeEditar ? (
              <Button
                variant="secondary"
                aria-label={`Continuar ${p.nome}`}
                onClick={onEditar}
              >
                Continuar
              </Button>
            ) : null
          ) : (
            <Button
              variant="secondary"
              aria-label={`Ver resultados de ${p.nome}`}
              onClick={onResultados}
            >
              Ver resultados
            </Button>
          )}
          {podeEditar ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="pesquisas__menu-botao"
                aria-label={`Ações de ${p.nome}`}
              >
                <IconeMaisAcoes tamanho={18} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {rascunho ? null : (
                  <DropdownMenuItem onSelect={onResultados}>
                    Ver resultados
                  </DropdownMenuItem>
                )}
                {podeEditarPesquisa(p.status) ? (
                  <DropdownMenuItem onSelect={onEditar}>
                    Editar
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={onDuplicar}>
                  Duplicar
                </DropdownMenuItem>
                {p.link ? (
                  <DropdownMenuItem onSelect={onCopiar}>
                    Copiar link
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="pesquisas__menu-perigo"
                  onSelect={onExcluir}
                >
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function BoasVindas({
  podeEditar,
  onUsarModelo,
}: {
  readonly podeEditar: boolean;
  readonly onUsarModelo: (modelo: ModeloPesquisa) => void;
}) {
  return (
    <>
      <div className="pesquisas__vazio-cartao">
        <span className="pesquisas__vazio-icone" aria-hidden="true">
          <IconePesquisas tamanho={28} />
        </span>
        <h2>Comece a ouvir as pessoas da empresa</h2>
        <p>
          Escolha um modelo pronto ou monte a sua pesquisa, defina quem responde
          e envie o link. As respostas chegam aqui, com participação e
          resultados por pergunta e por departamento.
        </p>
      </div>
      <ol className="pesquisas__passos" aria-label="Como funciona">
        <li>
          <span className="pesquisas__passo-numero">Passo 1</span>
          <strong>Escolha um modelo</strong>
          <span>
            Clima, pulso, eNPS, onboarding e outros, ou uma pesquisa em branco.
            Todas as perguntas podem ser ajustadas.
          </span>
        </li>
        <li>
          <span className="pesquisas__passo-numero">Passo 2</span>
          <strong>Defina quem responde</strong>
          <span>
            Todo o time ou pessoas escolhidas, e se a pesquisa é identificada,
            confidencial ou anônima.
          </span>
        </li>
        <li>
          <span className="pesquisas__passo-numero">Passo 3</span>
          <strong>Envie e acompanhe</strong>
          <span>
            Publique, compartilhe o link e acompanhe a participação e os
            resultados enquanto as respostas chegam.
          </span>
        </li>
      </ol>
      {podeEditar ? (
        <GaleriaDeModelos onUsar={onUsarModelo} />
      ) : (
        <p className="pesquisas__nota">
          Ainda não há pesquisas. Quem cria pesquisas é o RH ou o DP.
        </p>
      )}
    </>
  );
}
