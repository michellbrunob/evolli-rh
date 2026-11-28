/**
 * T216 — "Editar pesquisa" (publicada, até ser finalizada): página própria,
 * sem mexer nas perguntas, em duas colunas. À esquerda: Dados da pesquisa
 * (nome, descrição e o formato), Encerramento e, na anônima, "Separar por"
 * (travado quando já há respostas). À direita: o painel de participantes
 * (Total, Responderam, Pendentes e "A adicionar"; abas Atuais e Adicionar,
 * com busca e filtros). Rodapé fixo com o estado das alterações, Cancelar e
 * Salvar alterações; o aviso flutuante sobe acima dele.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  CandidatoPesquisa,
  PesquisaDetalhe,
} from "../../api/pesquisasClient";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import { Button, StatusBadge } from "../../components";
import { plural } from "../../format/plural";
import { IconButton, ListaDeEscolha } from "../../ui";
import { IconeFechar, IconeVoltar } from "../../ui/icones";
import { Esqueleto } from "../../ui/movimento";
import { useAvisar } from "./avisos";
import { CartaoDeEncerramento } from "./CartaoDeEncerramento";
import {
  CampoDeBusca,
  CartaoDeSecao,
  ICONE_DA_IDENTIFICACAO,
  Pilulas,
} from "./componentes";
import {
  entradaDoEstado,
  estadoDoDetalhe,
  validarEnvio,
  validarSobre,
  type EstadoDaPesquisa,
  type PessoaEscolhida,
} from "./estadoDaPesquisa";
import { semAcento } from "./GaleriaDeModelos";
import { SepararRespostasPor } from "./SepararRespostasPor";
import {
  todosOsCandidatos,
  type GruposDaEmpresa,
  type ServicoDePesquisas,
} from "./servicoDePesquisas";
import { LIMITES, ROTULO_DA_IDENTIFICACAO } from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";

export function EditarPesquisa({
  servico,
  pesquisaId,
  hoje,
  onVoltar,
  onSalvo,
}: {
  readonly servico: ServicoDePesquisas;
  readonly pesquisaId: string;
  readonly hoje: string;
  readonly onVoltar: () => void;
  readonly onSalvo: (d: PesquisaDetalhe) => void;
}) {
  const [detalhe, setDetalhe] = useState<PesquisaDetalhe | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.obterPesquisa(pesquisaId))
      .then((d) => {
        if (vivo) setDetalhe(d);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId]);
  if (falhou)
    return (
      <div className="pesquisas">
        <p className="pesquisas__erro" role="alert">
          Não foi possível abrir a pesquisa.
        </p>
        <Button variant="secondary" onClick={onVoltar}>
          Voltar
        </Button>
      </div>
    );
  if (!detalhe) return <Esqueleto rotulo="Carregando a pesquisa…" linhas={5} />;
  return (
    <FormularioDeEdicao
      servico={servico}
      detalhe={detalhe}
      hoje={hoje}
      onVoltar={onVoltar}
      onSalvo={onSalvo}
    />
  );
}

function FormularioDeEdicao({
  servico,
  detalhe,
  hoje,
  onVoltar,
  onSalvo,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly hoje: string;
  readonly onVoltar: () => void;
  readonly onSalvo: (d: PesquisaDetalhe) => void;
}) {
  const avisar = useAvisar();
  const [estado, setEstado] = useState<EstadoDaPesquisa>(() =>
    estadoDoDetalhe(detalhe),
  );
  const referencia = useMemo(
    () => JSON.stringify(entradaDoEstado(estadoDoDetalhe(detalhe))),
    [detalhe],
  );
  const [salvando, setSalvando] = useState(false);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const pendente = JSON.stringify(entradaDoEstado(estado)) !== referencia;
  /** A finalizada edita, mas o encerramento fica (ela não volta). */
  const finalizada = detalhe.status === "finalizada";
  const validar = () => ({
    ...validarSobre(estado),
    ...(finalizada ? {} : validarEnvio(estado, hoje)),
  });
  const erros = mostrarErros ? validar() : null;
  const anonima = estado.identificacao === "anonima";
  const IconeId = ICONE_DA_IDENTIFICACAO[estado.identificacao];

  useEdicaoEmAndamento(`Editar ${detalhe.nome}`, {
    pendente,
    salvando,
  });

  const mudar = (m: Partial<EstadoDaPesquisa>) =>
    setEstado((e) => ({ ...e, ...m }));

  async function salvar() {
    const encontrados = validar();
    if (Object.keys(encontrados).length > 0) {
      setMostrarErros(true);
      return;
    }
    setSalvando(true);
    setFalha(null);
    try {
      const d = await servico.alterarPesquisa(
        detalhe.id,
        entradaDoEstado(estado),
      );
      avisar("Alterações salvas.");
      onSalvo(d ?? detalhe);
    } catch (erro) {
      const status = (erro as { status?: unknown } | null)?.status;
      setFalha(
        status === 409 || status === 422
          ? "O servidor recusou as alterações (a pesquisa pode ter mudado de situação). Volte aos resultados e abra de novo."
          : "Não foi possível salvar as alterações. Tente de novo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="pesquisas pesquisas--com-rodape pesquisas__edicao">
      <header className="pesquisas__cabecalho pesquisas__edicao-cabeca">
        <IconButton
          label="Voltar para os resultados"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <h1
          id={PESQUISAS_TITULO_ID}
          className="pesquisas__titulo"
          tabIndex={-1}
        >
          Editar pesquisa
        </h1>
      </header>

      <div className="pesquisas__edicao-grade">
        <div className="pesquisas__edicao-coluna">
          <CartaoDeSecao titulo="Dados da pesquisa">
            <div className="pesquisas__campos">
              <label htmlFor="editar-nome" className="pesquisas__rotulo">
                Nome da pesquisa
              </label>
              <input
                id="editar-nome"
                className="pesquisas__campo"
                value={estado.nome}
                maxLength={LIMITES.nome + 10}
                aria-invalid={erros?.nome ? true : undefined}
                onChange={(e) => mudar({ nome: e.target.value })}
              />
              {erros?.nome ? (
                <p className="pesquisas__erro">{erros.nome}</p>
              ) : null}
              <label htmlFor="editar-descricao" className="pesquisas__rotulo">
                Descrição <span className="pesquisas__suave">(opcional)</span>
              </label>
              <textarea
                id="editar-descricao"
                className="pesquisas__campo"
                value={estado.boasVindas}
                onChange={(e) => mudar({ boasVindas: e.target.value })}
              />
            </div>
            <p className="pesquisas__edicao-formato">
              <span className="pesquisas__suave">Formato:</span>
              <span className="pesquisas__selo pesquisas__selo--destaque pesquisas__com-icone">
                <IconeId tamanho={12} />
                {ROTULO_DA_IDENTIFICACAO[estado.identificacao]}
              </span>
            </p>
          </CartaoDeSecao>

          {finalizada ? (
            <CartaoDeSecao titulo="Encerramento">
              <p className="pesquisas__suave">
                Pesquisa finalizada: o encerramento não muda e o link não volta
                a aceitar respostas.
              </p>
            </CartaoDeSecao>
          ) : (
            <CartaoDeEncerramento
              compacto
              data={estado.encerraEm}
              hora={estado.encerraHora}
              hoje={hoje}
              erro={erros?.encerraEm}
              onMudar={mudar}
            />
          )}

          {anonima ? (
            <SepararRespostasPor
              servico={servico}
              separarPor={estado.separarPor}
              travado={detalhe.temRespostas}
              motivoDoTravamento="Esta pesquisa já tem respostas: os campos não mudam mais."
              onMudar={(separarPor) => mudar({ separarPor })}
            />
          ) : null}
        </div>

        {anonima ? (
          <CartaoDeSecao titulo="Participantes">
            <p className="pesquisas__edicao-vazio">
              Pesquisa anônima: quem tiver o link responde, sem lista de
              participantes.
            </p>
          </CartaoDeSecao>
        ) : (
          <PainelDeParticipantes
            servico={servico}
            detalhe={detalhe}
            estado={estado}
            onMudar={mudar}
          />
        )}
      </div>

      {falha ? (
        <p className="pesquisas__erro" role="alert">
          {falha}
        </p>
      ) : null}

      <footer className="pesquisas__rodape">
        <span className="pesquisas__suave" role="status">
          {pendente ? "Alterações não salvas." : "Sem alterações pendentes"}
        </span>
        <div className="pesquisas__rodape-direita">
          <Button variant="subtle" disabled={salvando} onClick={onVoltar}>
            Cancelar
          </Button>
          <Button
            disabled={!pendente || salvando}
            onClick={() => void salvar()}
          >
            Salvar alterações
          </Button>
        </div>
      </footer>
    </div>
  );
}

type FiltroDeStatus = "" | "responderam" | "pendentes";

const OPCOES_DE_STATUS: readonly { valor: FiltroDeStatus; rotulo: string }[] = [
  { valor: "", rotulo: "Todos os status" },
  { valor: "responderam", rotulo: "Responderam" },
  { valor: "pendentes", rotulo: "Pendentes" },
];

/** "Cargo · Departamento · Centro de custo · Unidade" (o que houver). */
const lotacaoDe = (c: CandidatoPesquisa) =>
  [c.cargo, c.departamento, c.centroCusto, c.unidade]
    .filter(Boolean)
    .join(" · ");

type CampoDoFiltro = "departamento" | "centroCusto" | "unidade";

/**
 * O painel da direita: pílulas Total, Responderam, Pendentes (e "A
 * adicionar" quando há inclusões), abas Atuais e Adicionar. Atuais: busca e
 * filtros por status e departamento; quem já respondeu não sai. Adicionar:
 * os ativos da empresa que ainda não estão na pesquisa (candidatos da API,
 * com busca e filtros no servidor), marcados um a um ou todos de uma vez.
 */
function PainelDeParticipantes({
  servico,
  detalhe,
  estado,
  onMudar,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly estado: EstadoDaPesquisa;
  readonly onMudar: (m: Partial<EstadoDaPesquisa>) => void;
}) {
  const ids = useId();
  const [aba, setAba] = useState<"atuais" | "adicionar">("atuais");
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<FiltroDeStatus>("");
  const [departamento, setDepartamento] = useState("");
  const [buscaNova, setBuscaNova] = useState("");
  const [filtroNovo, setFiltroNovo] = useState<Record<CampoDoFiltro, string>>({
    departamento: "",
    centroCusto: "",
    unidade: "",
  });
  const [grupos, setGrupos] = useState<GruposDaEmpresa | null>(null);
  const [candidatos, setCandidatos] = useState<CandidatoPesquisa[] | null>(
    null,
  );
  const geralRef = useRef<HTMLInputElement>(null);
  const lista = detalhe.participantesLista ?? [];
  const naPesquisa = new Set(lista.map((p) => p.colaboradorId));
  const respondeu = new Set(
    lista.filter((p) => p.respondeu).map((p) => p.colaboradorId),
  );
  // Atuais: a lista da pesquisa (todo o time resolvido ou os escolhidos).
  const atuais: Record<string, PessoaEscolhida> = estado.todos
    ? Object.fromEntries(
        lista.map((p) => [
          p.colaboradorId,
          { nome: p.nome, departamento: p.departamento },
        ]),
      )
    : { ...estado.escolhidos };
  const aAdicionar =
    lista.length === 0
      ? 0
      : Object.keys(atuais).filter((id) => !naPesquisa.has(id)).length;
  // Sem mudança na lista, vale o total do servidor (todo o time inteiro).
  const total =
    estado.todos && lista.length === 0
      ? (detalhe.participantesTotal ?? detalhe.participantes ?? 0)
      : Object.keys(atuais).length;
  const responderam = detalhe.responderam ?? respondeu.size;
  // Incluir alguém aumenta os pendentes (e a frase do painel).
  const pendentes = Math.max(0, total - responderam);

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

  const consulta = useMemo(
    () => ({
      ...(buscaNova.trim() ? { busca: buscaNova.trim() } : {}),
      ...(filtroNovo.departamento
        ? { departamentoId: filtroNovo.departamento }
        : {}),
      ...(filtroNovo.centroCusto
        ? { centroCustoId: filtroNovo.centroCusto }
        : {}),
      ...(filtroNovo.unidade ? { unidadeId: filtroNovo.unidade } : {}),
    }),
    [buscaNova, filtroNovo],
  );

  // Os candidatos do filtro, página a página no servidor (só nesta aba).
  useEffect(() => {
    if (aba !== "adicionar") return;
    let vivo = true;
    todosOsCandidatos(
      (q) => Promise.resolve(servico.listarCandidatos(q)),
      consulta,
    )
      .then((l) => {
        if (vivo) setCandidatos(l);
      })
      .catch(() => {
        if (vivo) setCandidatos([]);
      });
    return () => {
      vivo = false;
    };
  }, [aba, servico, consulta]);

  const termo = semAcento(busca.trim());
  const nomeDoDepartamento =
    grupos?.departamento.find((d) => d.id === departamento)?.nome ?? null;
  const visiveis = Object.entries(atuais).filter(
    ([id, p]) =>
      (!termo ||
        semAcento(`${p.nome} ${p.departamento ?? ""}`).includes(termo)) &&
      (status === "" ||
        (status === "responderam" ? respondeu.has(id) : !respondeu.has(id))) &&
      (!departamento || p.departamento === nomeDoDepartamento),
  );
  // Para adicionar: quem não estava na pesquisa (os marcados agora ficam).
  const paraAdicionar = (candidatos ?? []).filter(
    (c) => !naPesquisa.has(c.colaboradorId),
  );
  const marcados = paraAdicionar.filter((c) => c.colaboradorId in atuais);
  const todosMarcados =
    paraAdicionar.length > 0 && marcados.length === paraAdicionar.length;

  useEffect(() => {
    if (geralRef.current)
      geralRef.current.indeterminate = marcados.length > 0 && !todosMarcados;
  }, [marcados.length, todosMarcados]);

  function remover(id: string) {
    const novo = { ...atuais };
    delete novo[id];
    onMudar({ todos: false, escolhidos: novo });
  }

  function marcar(pessoas: readonly CandidatoPesquisa[], marcado: boolean) {
    const novo = { ...atuais };
    for (const c of pessoas) {
      if (marcado)
        novo[c.colaboradorId] = { nome: c.nome, departamento: c.departamento };
      else delete novo[c.colaboradorId];
    }
    onMudar({ todos: false, escolhidos: novo });
  }

  const filtro = (
    id: string,
    rotulo: string,
    opcoes: readonly { valor: string; rotulo: string }[],
    valor: string,
    onMudarValor: (v: string) => void,
  ) => (
    <div className="pesquisas__filtro-lista">
      <label htmlFor={id} className="pesquisas__so-leitor">
        {rotulo}
      </label>
      <ListaDeEscolha
        id={id}
        opcoes={opcoes}
        valor={valor}
        onMudar={onMudarValor}
      />
    </div>
  );

  const opcoesDoGrupo = (campo: CampoDoFiltro, todos: string) => [
    { valor: "", rotulo: todos },
    ...(grupos?.[campo] ?? []).map((g) => ({ valor: g.id, rotulo: g.nome })),
  ];

  const filtroDoNovo = (campo: CampoDoFiltro, rotulo: string, todos: string) =>
    filtro(
      `${ids}-novo-${campo}`,
      rotulo,
      opcoesDoGrupo(campo, todos),
      filtroNovo[campo],
      (v) => setFiltroNovo((f) => ({ ...f, [campo]: v })),
    );

  return (
    <section
      className="pesquisas__cartao-secao pesquisas__participantes"
      aria-label="Participantes"
    >
      <h2 className="pesquisas__cartao-secao-titulo">{`Participantes (${total})`}</h2>
      <dl
        className="pesquisas__contadores"
        aria-label="Totais de participantes"
      >
        <div>
          <dt>Total</dt>
          <dd>{total}</dd>
        </div>
        <div data-tom="sucesso">
          <dt>Responderam</dt>
          <dd>{responderam}</dd>
        </div>
        <div>
          <dt>Pendentes</dt>
          <dd>{pendentes}</dd>
        </div>
        {aAdicionar > 0 ? (
          <div data-tom="destaque">
            <dt>A adicionar</dt>
            <dd>{aAdicionar}</dd>
          </div>
        ) : null}
      </dl>
      <Pilulas
        rotulo="Participantes"
        valor={aba}
        onMudar={setAba}
        opcoes={[
          { valor: "atuais", rotulo: "Atuais", contagem: total - aAdicionar },
          {
            valor: "adicionar",
            rotulo: "Adicionar",
            ...(aAdicionar > 0 ? { contagem: aAdicionar } : {}),
          },
        ]}
      />
      {aba === "atuais" ? (
        <>
          <div className="pesquisas__participantes-filtros">
            <CampoDeBusca
              rotulo="Buscar por nome ou departamento"
              valor={busca}
              onMudar={setBusca}
            />
            {filtro(`${ids}-status`, "Status", OPCOES_DE_STATUS, status, (v) =>
              setStatus(v as FiltroDeStatus),
            )}
            {filtro(
              `${ids}-departamento`,
              "Departamento",
              opcoesDoGrupo("departamento", "Todos os departamentos"),
              departamento,
              setDepartamento,
            )}
          </div>
          <ul
            className="pesquisas__participantes-lista"
            aria-label="Participantes atuais"
          >
            {visiveis.map(([id, p]) => (
              <li key={id}>
                <span className="pesquisas__pessoa-textos">
                  <span className="pesquisas__forte">{p.nome}</span>
                  <span className="pesquisas__suave">
                    {p.departamento ?? "Sem departamento"}
                  </span>
                </span>
                {respondeu.has(id) ? (
                  <StatusBadge variant="success">Respondeu</StatusBadge>
                ) : (
                  <StatusBadge variant="warning">Pendente</StatusBadge>
                )}
                {respondeu.has(id) ? (
                  <span
                    className="pesquisas__participantes-sem-acao"
                    aria-hidden="true"
                  />
                ) : (
                  <IconButton
                    label={`Tirar ${p.nome}`}
                    icon={<IconeFechar tamanho={14} />}
                    variant="subtle"
                    onClick={() => remover(id)}
                  />
                )}
              </li>
            ))}
          </ul>
          {visiveis.length === 0 ? (
            <p className="pesquisas__edicao-vazio">
              Nenhum participante encontrado com esses filtros.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="pesquisas__participantes-topo">
            <strong>Selecionar colaboradores</strong>
            <span className="pesquisas__suave">
              {plural(marcados.length, "selecionado", "selecionados")}
            </span>
          </div>
          <div className="pesquisas__participantes-filtros pesquisas__participantes-filtros--quatro">
            <CampoDeBusca
              rotulo="Buscar colaborador"
              valor={buscaNova}
              onMudar={setBuscaNova}
            />
            {filtroDoNovo(
              "departamento",
              "Departamento dos colaboradores",
              "Todos os departamentos",
            )}
            {filtroDoNovo(
              "centroCusto",
              "Centro de custo dos colaboradores",
              "Todos os centros de custo",
            )}
            {filtroDoNovo(
              "unidade",
              "Unidade dos colaboradores",
              "Todas as unidades",
            )}
          </div>
          {candidatos === null ? (
            <p className="pesquisas__suave">Carregando pessoas…</p>
          ) : paraAdicionar.length === 0 ? (
            <p className="pesquisas__edicao-vazio">
              Ninguém para adicionar com esses filtros.
            </p>
          ) : (
            <>
              <label className="pesquisas__participantes-todos">
                <input
                  ref={geralRef}
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={(e) => marcar(paraAdicionar, e.target.checked)}
                />
                {`Selecionar todos (${paraAdicionar.length})`}
              </label>
              <ul
                className="pesquisas__participantes-lista"
                aria-label="Pessoas para adicionar"
              >
                {paraAdicionar.map((c) => (
                  <li key={c.colaboradorId}>
                    <label className="pesquisas__participantes-escolha">
                      <input
                        type="checkbox"
                        aria-label={c.nome}
                        checked={c.colaboradorId in atuais}
                        onChange={(e) => marcar([c], e.target.checked)}
                      />
                      <span className="pesquisas__pessoa-textos">
                        <span className="pesquisas__forte">{c.nome}</span>
                        {lotacaoDe(c) ? (
                          <span className="pesquisas__suave">
                            {lotacaoDe(c)}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <p className="pesquisas__suave">
        {`Quem já respondeu não sai da pesquisa. ${plural(pendentes, "pessoa ainda não respondeu", "pessoas ainda não responderam")}.`}
      </p>
    </section>
  );
}
