/**
 * T216 — Riscos psicossociais (NR-1): Plano de ação e Conformidade.
 *
 * Plano: por dimensão, as medidas sugeridas da biblioteca do Evolli
 * (`medidasSugeridas.ts`, sem IA: controle, prazo, opções A e B,
 * referência e indicador) e as medidas que o RH registra, com responsável,
 * prazo, indicador e situação. Busca por dimensão ou medida e PDF do plano.
 *
 * Conformidade: as 7 etapas; as duas primeiras concluem sozinhas; nas
 * outras, a empresa marca os itens, descreve e anexa as evidências (PDF,
 * imagem ou apresentação, até 20 MB) e conclui. "Baixar tudo (.zip)" junta
 * plano, conformidade, respostas e os arquivos. Etapas e plano são gravados
 * juntos (`PUT /pesquisas/:id/modelo/acompanhamento`); os arquivos têm rotas
 * próprias.
 */
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  AcompanhamentoNr1,
  AcompanhamentoNr1Entrada,
  ArquivoDaEtapa,
  ControleNr1,
  EtapaNr1,
  MedidaDoPlano,
  ResultadoNr1,
  ServicoDosModelos,
  SituacaoDaMedida,
} from "../../../../api/modelosDePesquisaClient";
import { Button } from "../../../../components";
import {
  diaCivilDeHoje,
  formatarDiaCivil,
  formatarInstante,
} from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { CartaoDeSecao } from "../../componentes";
import { mensagemDaFalha } from "../../falhasDaGravacao";
import { novoId } from "../../textosDasPesquisas";
import { SeloDoNivel } from "../ui";
import { DIMENSOES_NR1, dimensaoNr1 } from "./definicao";
import {
  dimensaoCombina,
  estrategiasSugeridas,
  medidaDaSugestao,
  prazoPeloNivel,
  sugestaoCombina,
  sugestoesDa,
  textoCombina,
  textoDoPrazo,
} from "./medidasSugeridas";
import {
  CONTROLES,
  ETAPAS_DA_CONFORMIDADE,
  NIVEIS,
  NIVEL,
  ROTULO_DA_SITUACAO,
  ROTULO_DO_CONTROLE,
} from "./textos";
import { legendaDaDimensao } from "./VisaoGeralNr1";
import "./Nr1.css";

export function entradaDoAcompanhamento(
  a: AcompanhamentoNr1,
): AcompanhamentoNr1Entrada {
  return {
    etapas: a.etapas
      .filter((e) => !e.automatica)
      .map((e) => ({
        id: e.id,
        itens: e.itens,
        evidencias: e.evidencias,
        concluida: e.concluidaEm !== null,
      })),
    plano: a.plano,
    profissionalSst: a.profissionalSst,
  };
}

/*
 * O último acompanhamento carregado de cada pesquisa (as abas mostram os
 * contadores sem carregar de novo) e a dimensão pedida pela Visão geral
 * ("Ver o plano de ação desta dimensão").
 */
const lembrados = new Map<string, AcompanhamentoNr1>();
const dimensoesPedidas = new Map<string, string>();
const ouvintes = new Set<() => void>();

export function lembrarAcompanhamento(
  pesquisaId: string,
  a: AcompanhamentoNr1,
) {
  lembrados.set(pesquisaId, a);
  ouvintes.forEach((f) => f());
}

export function useAcompanhamentoLembrado(
  pesquisaId: string,
): AcompanhamentoNr1 | null {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => lembrados.get(pesquisaId) ?? null,
  );
}

/** A Visão geral pede que o plano abra nesta dimensão. */
export function pedirDimensaoNoPlano(pesquisaId: string, dimensaoId: string) {
  dimensoesPedidas.set(pesquisaId, dimensaoId);
}

function tomarDimensaoPedida(pesquisaId: string | undefined): string | null {
  if (!pesquisaId) return null;
  const d = dimensoesPedidas.get(pesquisaId) ?? null;
  dimensoesPedidas.delete(pesquisaId);
  return d;
}

/** Carrega e grava o acompanhamento (estado local até salvar). */
export function useAcompanhamentoNr1(
  servico: ServicoDosModelos,
  pesquisaId: string,
  /** Só a NR-1 tem acompanhamento. */
  ativo = true,
) {
  const [gravado, setGravadoLocal] = useState<AcompanhamentoNr1 | null>(null);
  const [rascunho, setRascunho] = useState<AcompanhamentoNr1Entrada | null>(
    null,
  );
  const [falha, setFalha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const setGravado = (a: AcompanhamentoNr1) => {
    setGravadoLocal(a);
    lembrarAcompanhamento(pesquisaId, a);
  };
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    Promise.resolve(servico.acompanhamentoNr1(pesquisaId))
      .then((a) => {
        if (!vivo) return;
        setGravadoLocal(a);
        lembrarAcompanhamento(pesquisaId, a);
        setRascunho(entradaDoAcompanhamento(a));
      })
      .catch(() => {
        if (vivo) setFalha("Não foi possível carregar o acompanhamento.");
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId, ativo]);
  const pendente =
    gravado !== null &&
    rascunho !== null &&
    JSON.stringify(entradaDoAcompanhamento(gravado)) !==
      JSON.stringify(rascunho);
  async function salvar(entrada = rascunho): Promise<boolean> {
    if (!entrada) return false;
    setSalvando(true);
    try {
      const a = await servico.gravarAcompanhamentoNr1(pesquisaId, entrada);
      setGravado(a);
      setRascunho(entradaDoAcompanhamento(a));
      setFalha(null);
      return true;
    } catch (erro) {
      const status = (erro as { status?: unknown } | null)?.status;
      setFalha(
        status === 422
          ? "Revise os campos: algum ficou vazio ou longo demais."
          : mensagemDaFalha(erro, "salvar"),
      );
      return false;
    } finally {
      setSalvando(false);
    }
  }
  return {
    pesquisaId,
    servico,
    gravado,
    rascunho,
    setRascunho,
    pendente,
    salvando,
    falha,
    salvar,
    /** Depois de enviar ou remover um arquivo (o rascunho fica como está). */
    atualizarGravado: setGravado,
  };
}

export type Acompanhamento = ReturnType<typeof useAcompanhamentoNr1>;

function medidaNova(dimensaoId: string): MedidaDoPlano {
  return {
    id: idDaMedida(),
    dimensaoId,
    titulo: "",
    descricao: null,
    controle: "administrativo",
    responsavel: null,
    prazo: null,
    indicador: null,
    situacao: "planejada",
  };
}

const idDaMedida = () =>
  novoId()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 40);

const vazioParaNulo = (t: string) => (t.trim() ? t : null);

/** A cor de cada controle (tokens do sistema). */
const COR_DO_CONTROLE: Readonly<Record<ControleNr1, string>> = {
  eliminacao: "var(--faixa-critico)",
  substituicao: "var(--modelo-laranja)",
  administrativo: "var(--color-action)",
  protecao: "var(--faixa-forte)",
};

export function PlanoDeAcaoNr1({
  r,
  acompanhamento: a,
  podeEditar,
  hoje = diaCivilDeHoje(),
  onBaixarPdf,
}: {
  readonly r: ResultadoNr1;
  readonly acompanhamento: Acompanhamento;
  readonly podeEditar: boolean;
  readonly hoje?: string;
  /** Gera o PDF do plano (sem isto, o botão não aparece). */
  readonly onBaixarPdf?: () => void;
}) {
  const ids = useId();
  const porId = useMemo(() => new Map(r.dimensoes.map((d) => [d.id, d])), [r]);
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState<string>(
    () =>
      tomarDimensaoPedida(a.pesquisaId) ??
      r.prioridades[0] ??
      DIMENSOES_NR1[0]!.id,
  );
  const plano = a.rascunho?.plano ?? [];
  const mudarPlano = (novo: MedidaDoPlano[]) =>
    a.setRascunho((x) => (x ? { ...x, plano: novo } : x));
  const mudarMedida = (id: string, m: Partial<MedidaDoPlano>) =>
    mudarPlano(plano.map((x) => (x.id === id ? { ...x, ...m } : x)));

  if (!a.rascunho) {
    return (
      <p className="pesquisas__suave">{a.falha ?? "Carregando o plano…"}</p>
    );
  }
  const visiveis = r.prioridades.filter((id) =>
    dimensaoCombina(id, dimensaoNr1(id).rotulo, busca),
  );
  const daDimensao = plano.filter((m) => m.dimensaoId === escolhida);
  const d = porId.get(escolhida);
  const dim = dimensaoNr1(escolhida);
  // Busca pelo nome da dimensão: todas as sugestões dela; senão, as que
  // combinam com o texto.
  const sugestoes = sugestoesDa(escolhida).filter(
    (s) => textoCombina(dim.rotulo, busca) || sugestaoCombina(s, busca),
  );
  const noPlano = new Set(daDimensao.map((m) => m.titulo.trim()));
  // As 3 de cada dimensão com nível, inclusive as preventivas do baixo:
  // o mesmo número da lista à esquerda, da aba e da Visão geral.
  const totalDeSugestoes = estrategiasSugeridas(r);

  return (
    <div className="modelos">
      <CartaoDeSecao
        titulo="Plano de ação"
        descricao="Medidas por dimensão, na ordem de controles da NR-1, com responsável, prazo e indicador. As sugestões são da biblioteca do Evolli."
        acao={
          <span className="modelos__acoes">
            {onBaixarPdf ? (
              <Button variant="secondary" onClick={onBaixarPdf}>
                Baixar PDF
              </Button>
            ) : null}
            {podeEditar ? (
              <Button
                disabled={!a.pendente || a.salvando}
                onClick={() => void a.salvar()}
              >
                {a.salvando ? "Salvando…" : "Salvar plano"}
              </Button>
            ) : null}
          </span>
        }
      >
        <div className="modelos__grade">
          <div className="modelos__mini">
            <span className="modelos__mini-titulo">Medidas no plano</span>
            <strong className="modelos__mini-valor">{plano.length}</strong>
          </div>
          <div className="modelos__mini">
            <span className="modelos__mini-titulo">Estratégias sugeridas</span>
            <strong className="modelos__mini-valor">{totalDeSugestoes}</strong>
          </div>
          <div className="modelos__mini">
            <span className="modelos__mini-titulo">Dimensões críticas</span>
            <strong className="modelos__mini-valor">{r.niveis.critico}</strong>
          </div>
          <div className="modelos__mini">
            <span className="modelos__mini-titulo">Em nível alto</span>
            <strong className="modelos__mini-valor">{r.niveis.alto}</strong>
          </div>
          <div className="modelos__mini">
            <span className="modelos__mini-titulo">Em nível médio</span>
            <strong className="modelos__mini-valor">{r.niveis.medio}</strong>
          </div>
        </div>
        <p className="pesquisas__nota" role="note">
          As sugestões são um ponto de partida, não o plano oficial do PGR. O
          plano é responsabilidade da empresa: revise, date e valide as medidas
          com o profissional de SST (e, quando couber, psicólogo ou médico do
          trabalho) antes de levá-lo ao PGR.
        </p>
        {a.falha ? (
          <p className="pesquisas__erro" role="alert">
            {a.falha}
          </p>
        ) : null}
        {a.gravado?.atualizadoEm ? (
          <p className="pesquisas__suave">{`Atualizado em ${formatarInstante(a.gravado.atualizadoEm)}`}</p>
        ) : null}
      </CartaoDeSecao>

      <div className="modelos__mestre-detalhe">
        <nav aria-label="Dimensões do plano">
          <input
            className="pesquisas__campo"
            type="search"
            placeholder="Buscar dimensão ou medida"
            aria-label="Buscar dimensão ou medida"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {visiveis.length === 0 ? (
            <p className="pesquisas__suave" role="status">
              Nenhuma dimensão ou medida encontrada.
            </p>
          ) : null}
          {NIVEIS.map((n) => {
            const lista = visiveis.filter((id) => porId.get(id)?.nivel === n);
            if (!lista.length) return null;
            return (
              <div key={n}>
                <p className="modelos__grupo-titulo">{`${NIVEL[n].rotulo} · ${lista.length}`}</p>
                <ul className="modelos__lista-dimensoes">
                  {lista.map((id) => {
                    const qtd = plano.filter((m) => m.dimensaoId === id).length;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className="modelos__item-dimensao"
                          aria-current={id === escolhida ? "true" : undefined}
                          onClick={() => setEscolhida(id)}
                        >
                          <span>{dimensaoNr1(id).rotulo}</span>
                          <span className="pesquisas__suave">
                            {`${plural(qtd, "medida", "medidas")} · ${plural(sugestoesDa(id).length, "estratégia", "estratégias")}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <section
          className="modelos__cartao"
          aria-label={`Medidas de ${dim.rotulo}`}
        >
          <div className="modelos__cartao-topo">
            <h3>{dim.rotulo}</h3>
            <SeloDoNivel nivel={d?.nivel ?? null} />
          </div>
          <span className="pesquisas__suave">{`${legendaDaDimensao(escolhida)} · ${plural(daDimensao.length, "medida", "medidas")}`}</span>
          <p className="pesquisas__suave">{dim.definicao}</p>
          <span className="modelos__rotulo">Ordem de prioridade da NR-1</span>
          <ol className="modelos__regua-controles">
            {CONTROLES.map((c, i) => (
              <li key={c.id}>
                <strong>{`${i + 1} ${c.rotulo}`}</strong>
                <span className="modelos__rotulo">{c.texto}</span>
              </li>
            ))}
          </ol>

          <h4 className="modelos__grupo-titulo">
            {`Estratégias sugeridas · ${sugestoes.length}`}
          </h4>
          <ul
            className="nr1__sugestoes"
            aria-label={`Estratégias sugeridas para ${dim.rotulo}`}
          >
            {sugestoes.map((s) => {
              const ja = noPlano.has(s.titulo);
              return (
                <li
                  key={s.id}
                  className="nr1__sugestao"
                  style={{
                    ["--cor-controle" as string]: COR_DO_CONTROLE[s.controle],
                  }}
                >
                  <div className="nr1__sugestao-topo">
                    <span className="modelos__rotulo">
                      {`${ROTULO_DO_CONTROLE[s.controle]} · ${textoDoPrazo(prazoPeloNivel(s, d?.nivel ?? null))}`}
                    </span>
                    {podeEditar ? (
                      <Button
                        variant="secondary"
                        disabled={ja}
                        onClick={() =>
                          mudarPlano([
                            ...plano,
                            medidaDaSugestao(
                              s,
                              idDaMedida(),
                              hoje,
                              d?.nivel ?? null,
                            ),
                          ])
                        }
                      >
                        {ja ? "No plano" : "Adicionar ao plano"}
                      </Button>
                    ) : null}
                  </div>
                  <strong>{s.titulo}</strong>
                  <p>{s.descricao}</p>
                  <ul className="nr1__opcoes">
                    <li>
                      <strong>Opção A · </strong>
                      {s.opcaoA}
                    </li>
                    <li>
                      <strong>Opção B · </strong>
                      {s.opcaoB}
                    </li>
                  </ul>
                  <p className="pesquisas__suave">{`Indicador: ${s.indicador}`}</p>
                  <p className="modelos__rotulo">{`Referência: ${s.referencia}`}</p>
                </li>
              );
            })}
          </ul>

          <h4 className="modelos__grupo-titulo">
            {`Medidas do plano · ${daDimensao.length}`}
          </h4>
          {daDimensao.map((m, i) => {
            const base = `${ids}-${m.id}`;
            return (
              <fieldset
                key={m.id}
                className="modelos__medida"
                disabled={!podeEditar}
              >
                <legend className="pesquisas__suave">{`Medida ${i + 1}`}</legend>
                <label
                  className="modelos__campo modelos__medida-largo"
                  htmlFor={`${base}-t`}
                >
                  O que fazer
                  <input
                    id={`${base}-t`}
                    className="pesquisas__campo"
                    maxLength={200}
                    value={m.titulo}
                    onChange={(e) =>
                      mudarMedida(m.id, { titulo: e.target.value })
                    }
                  />
                </label>
                <label
                  className="modelos__campo modelos__medida-largo"
                  htmlFor={`${base}-d`}
                >
                  Como (opcional)
                  <textarea
                    id={`${base}-d`}
                    className="pesquisas__campo"
                    maxLength={1000}
                    value={m.descricao ?? ""}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        descricao: vazioParaNulo(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="modelos__campo" htmlFor={`${base}-c`}>
                  Controle
                  <select
                    id={`${base}-c`}
                    className="pesquisas__campo"
                    value={m.controle}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        controle: e.target.value as ControleNr1,
                      })
                    }
                  >
                    {CONTROLES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="modelos__campo" htmlFor={`${base}-r`}>
                  Responsável
                  <input
                    id={`${base}-r`}
                    className="pesquisas__campo"
                    maxLength={120}
                    value={m.responsavel ?? ""}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        responsavel: vazioParaNulo(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="modelos__campo" htmlFor={`${base}-p`}>
                  Prazo
                  <input
                    id={`${base}-p`}
                    type="date"
                    className="pesquisas__campo"
                    value={m.prazo ?? ""}
                    onChange={(e) =>
                      mudarMedida(m.id, { prazo: e.target.value || null })
                    }
                  />
                </label>
                <label className="modelos__campo" htmlFor={`${base}-s`}>
                  Situação
                  <select
                    id={`${base}-s`}
                    className="pesquisas__campo"
                    value={m.situacao}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        situacao: e.target.value as SituacaoDaMedida,
                      })
                    }
                  >
                    {(
                      Object.keys(ROTULO_DA_SITUACAO) as SituacaoDaMedida[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_DA_SITUACAO[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="modelos__campo modelos__medida-largo"
                  htmlFor={`${base}-i`}
                >
                  Indicador de acompanhamento
                  <input
                    id={`${base}-i`}
                    className="pesquisas__campo"
                    maxLength={300}
                    value={m.indicador ?? ""}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        indicador: vazioParaNulo(e.target.value),
                      })
                    }
                  />
                </label>
                {podeEditar ? (
                  <div className="modelos__acoes modelos__medida-largo">
                    <Button
                      variant="subtle"
                      onClick={() =>
                        mudarPlano(plano.filter((x) => x.id !== m.id))
                      }
                    >
                      Excluir medida
                    </Button>
                  </div>
                ) : null}
              </fieldset>
            );
          })}
          {podeEditar ? (
            <div>
              <Button
                variant="secondary"
                onClick={() => mudarPlano([...plano, medidaNova(escolhida)])}
              >
                + Adicionar medida
              </Button>
            </div>
          ) : daDimensao.length === 0 ? (
            <p className="pesquisas__suave">
              Nenhuma medida para esta dimensão.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

/** Anel de progresso das etapas ("2/7"). */
function Anel({
  feitas,
  total,
}: {
  readonly feitas: number;
  readonly total: number;
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg
      className="modelos__anel"
      viewBox="0 0 56 56"
      width={56}
      height={56}
      role="img"
      aria-label={`${feitas} de ${total} etapas concluídas`}
    >
      <circle
        cx={28}
        cy={28}
        r={r}
        fill="none"
        stroke="var(--surface-neutral)"
        strokeWidth={6}
      />
      <circle
        cx={28}
        cy={28}
        r={r}
        fill="none"
        stroke="var(--color-action)"
        strokeWidth={6}
        strokeDasharray={`${(c * feitas) / total} ${c}`}
        transform="rotate(-90 28 28)"
        strokeLinecap="round"
      />
      <text
        x={28}
        y={32}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fill="var(--color-ink)"
      >{`${feitas}/${total}`}</text>
    </svg>
  );
}

/** Formatos aceitos nas evidências (o servidor confere o conteúdo). */
export const ACEITA_EVIDENCIA =
  ".pdf,.jpg,.jpeg,.png,.webp,.pptx,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const EVIDENCIA_LIMITE_BYTES = 20 * 1024 * 1024;
export const EVIDENCIAS_POR_ETAPA = 10;

/** "1,2 MB" / "340 KB". */
export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** A mensagem da recusa do envio, pelo código da API. */
export function mensagemDoEnvio(erro: unknown): string {
  const e = erro as {
    status?: number;
    codigo?: string;
    erros?: readonly { motivo?: string }[];
  } | null;
  const codigo = e?.codigo ?? "";
  if (codigo === "evidencia_arquivo_grande_demais" || e?.status === 413)
    return "O arquivo passa de 20 MB.";
  if (codigo === "evidencia_formato_invalido")
    return "Envie PDF, imagem (JPG, PNG ou WEBP) ou apresentação (PPTX).";
  if (codigo === "evidencia_arquivo_malformado")
    return "O arquivo parece corrompido ou incompleto.";
  if (codigo === "evidencia_com_macro")
    return "Apresentações com macro não são aceitas.";
  if (codigo === "evidencia_reprovada_antivirus")
    return "O antivírus recusou o arquivo.";
  if (codigo === "evidencia_arquivo_vazio") return "O arquivo está vazio.";
  if (e?.erros?.[0]?.motivo === "limite")
    return `Cada etapa aceita até ${EVIDENCIAS_POR_ETAPA} arquivos.`;
  if (e?.status === 503)
    return "A verificação do arquivo está indisponível agora. Tente de novo em alguns minutos.";
  // Sessão, página desatualizada, permissão, 5xx e conexão: os textos comuns.
  return mensagemDaFalha(erro, "enviar o arquivo");
}

/** Os arquivos de evidência de uma etapa: lista, envio, download e remoção. */
function ArquivosDaEtapa({
  etapa,
  arquivos,
  acompanhamento: a,
  podeEditar,
}: {
  readonly etapa: EtapaNr1;
  readonly arquivos: readonly ArquivoDaEtapa[];
  readonly acompanhamento: Acompanhamento;
  readonly podeEditar: boolean;
}) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const s = a.servico;
  const podeEnviar = podeEditar && s.enviarEvidenciaNr1 !== undefined;

  async function enviar(lista: FileList | readonly File[] | null) {
    if (!lista || !s.enviarEvidenciaNr1) return;
    const arquivosEscolhidos = [...lista];
    setErro(null);
    setEnviando(true);
    try {
      for (const f of arquivosEscolhidos) {
        if (f.size > EVIDENCIA_LIMITE_BYTES) {
          setErro(`${f.name}: o arquivo passa de 20 MB.`);
          continue;
        }
        try {
          a.atualizarGravado(
            await s.enviarEvidenciaNr1(a.pesquisaId, etapa, f),
          );
        } catch (e) {
          setErro(`${f.name}: ${mensagemDoEnvio(e)}`);
        }
      }
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function baixar(x: ArquivoDaEtapa) {
    if (!s.baixarEvidenciaNr1) return;
    try {
      const blob = await s.baixarEvidenciaNr1(a.pesquisaId, etapa, x.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = x.nome;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setErro(`${x.nome}: não foi possível baixar.`);
    }
  }

  async function remover(x: ArquivoDaEtapa) {
    if (!s.removerEvidenciaNr1) return;
    setErro(null);
    try {
      a.atualizarGravado(
        await s.removerEvidenciaNr1(a.pesquisaId, etapa, x.id),
      );
    } catch (e) {
      setErro(`${x.nome}: ${mensagemDaFalha(e, "remover o arquivo")}`);
    }
  }

  if (!podeEnviar && arquivos.length === 0) return null;
  return (
    <div className="modelos__campo">
      <span>{`Arquivos de evidência · ${arquivos.length}`}</span>
      {arquivos.length ? (
        <ul className="nr1__arquivos" aria-label="Arquivos de evidência">
          {arquivos.map((x) => (
            <li key={x.id} className="nr1__arquivo">
              <span>
                <strong>{x.nome}</strong>
                <span className="pesquisas__suave">{` · ${tamanhoLegivel(x.tamanhoBytes)} · ${formatarInstante(x.enviadoEm).slice(0, 10)}`}</span>
              </span>
              <span className="modelos__acoes">
                {s.baixarEvidenciaNr1 ? (
                  <Button
                    variant="subtle"
                    aria-label={`Baixar ${x.nome}`}
                    onClick={() => void baixar(x)}
                  >
                    Baixar
                  </Button>
                ) : null}
                {podeEnviar && s.removerEvidenciaNr1 ? (
                  <Button
                    variant="subtle"
                    aria-label={`Remover ${x.nome}`}
                    onClick={() => void remover(x)}
                  >
                    Remover
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {podeEnviar && arquivos.length < EVIDENCIAS_POR_ETAPA ? (
        <div
          className="nr1__envio"
          {...(arrastando ? { "data-arrastando": "" } : {})}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            void enviar(e.dataTransfer.files);
          }}
        >
          <span>
            {enviando ? "Enviando…" : "Arraste os arquivos ou "}
            {enviando ? null : (
              <button
                type="button"
                className="modelos__link"
                onClick={() => entrada.current?.click()}
              >
                escolha no computador
              </button>
            )}
          </span>
          <span className="pesquisas__suave">
            PDF, imagem ou apresentação · até 20 MB · verificado pelo antivírus
          </span>
          <input
            ref={entrada}
            id={`${id}-arquivo`}
            type="file"
            multiple
            hidden
            accept={ACEITA_EVIDENCIA}
            aria-label="Escolher arquivos de evidência"
            onChange={(e) => void enviar(e.target.files)}
          />
        </div>
      ) : null}
      {erro ? (
        <p className="pesquisas__erro" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

export function ConformidadeNr1({
  acompanhamento: a,
  podeEditar,
  onVerResultados,
  onVerPlano,
  onBaixarTudo,
}: {
  readonly acompanhamento: Acompanhamento;
  readonly podeEditar: boolean;
  readonly onVerResultados?: () => void;
  readonly onVerPlano?: () => void;
  /** "Baixar tudo (.zip)" (sem isto, o botão não aparece). */
  readonly onBaixarTudo?: () => Promise<void>;
}) {
  const ids = useId();
  const [baixando, setBaixando] = useState(false);
  const [falhaDoPacote, setFalhaDoPacote] = useState<string | null>(null);
  /** Uma etapa por vez: a escolhida ou, sem escolha, a próxima pendente. */
  const [escolhida, setEscolhida] = useState<EtapaNr1 | null>(null);
  if (!a.gravado || !a.rascunho) {
    return (
      <p className="pesquisas__suave">
        {a.falha ?? "Carregando a conformidade…"}
      </p>
    );
  }
  const g = a.gravado;
  const rascunho = a.rascunho;
  const etapaDoRascunho = (id: string) =>
    rascunho.etapas.find((e) => e.id === id);
  const mudarEtapa = (
    id: string,
    m: Partial<AcompanhamentoNr1Entrada["etapas"][number]>,
  ) =>
    a.setRascunho((x) =>
      x
        ? {
            ...x,
            etapas: x.etapas.map((e) => (e.id === id ? { ...e, ...m } : e)),
          }
        : x,
    );
  const proxima = ETAPAS_DA_CONFORMIDADE.find((e) => e.id === g.proxima);
  const atual: EtapaNr1 =
    escolhida ?? g.proxima ?? ETAPAS_DA_CONFORMIDADE.at(-1)!.id;
  const situacaoDaEtapa = (
    e: { concluida: boolean; concluidaEm: string | null },
    id: EtapaNr1,
  ) =>
    e.concluida
      ? e.concluidaEm
        ? `Concluída em ${formatarInstante(e.concluidaEm).slice(0, 10)}`
        : "Concluída"
      : id === "revisar" && g.revisarEm
        ? `Prevista para ${formatarDiaCivil(`${g.revisarEm}-01`).slice(3)}`
        : "Pendente";

  return (
    <div className="modelos">
      <CartaoDeSecao
        titulo="Conformidade com a NR-1"
        descricao={`${g.concluidas} de 7 etapas concluídas${proxima ? ` · próxima: ${proxima.titulo}` : ""}`}
        acao={
          <span className="modelos__acoes">
            {onBaixarTudo ? (
              <Button
                variant="secondary"
                disabled={baixando}
                onClick={() => {
                  setBaixando(true);
                  setFalhaDoPacote(null);
                  void onBaixarTudo()
                    .catch(() =>
                      setFalhaDoPacote(
                        "Não foi possível gerar o pacote. Tente de novo.",
                      ),
                    )
                    .finally(() => setBaixando(false));
                }}
              >
                {baixando ? "Gerando o pacote…" : "Baixar tudo (.zip)"}
              </Button>
            ) : null}
            <Anel feitas={g.concluidas} total={7} />
          </span>
        }
      >
        {onBaixarTudo ? (
          <p className="pesquisas__suave">
            O pacote leva o plano de ação e a conformidade em PDF, as respostas
            em planilha e os arquivos de evidência de cada etapa.
          </p>
        ) : null}
        {falhaDoPacote ? (
          <p className="pesquisas__erro" role="alert">
            {falhaDoPacote}
          </p>
        ) : null}
        {a.falha ? (
          <p className="pesquisas__erro" role="alert">
            {a.falha}
          </p>
        ) : null}
        <ol
          className="modelos__lista-dimensoes nr1__etapas"
          aria-label="Etapas da conformidade"
        >
          {ETAPAS_DA_CONFORMIDADE.map((def, i) => {
            const e = g.etapas.find((x) => x.id === def.id)!;
            return (
              <li key={def.id}>
                <button
                  type="button"
                  className="modelos__etapa nr1__etapa-botao"
                  aria-current={def.id === atual ? "step" : undefined}
                  {...(e.concluida ? { "data-concluida": "" } : {})}
                  onClick={() => setEscolhida(def.id)}
                >
                  <span className="modelos__etapa-numero" aria-hidden="true">
                    {e.concluida ? "✓" : i + 1}
                  </span>
                  <strong>{def.titulo}</strong>
                  <span
                    className={`pesquisas__selo${e.concluida ? " pesquisas__selo--sucesso" : ""}`}
                  >
                    {situacaoDaEtapa(e, def.id)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {(() => {
          const i = ETAPAS_DA_CONFORMIDADE.findIndex((x) => x.id === atual);
          const def = ETAPAS_DA_CONFORMIDADE[i]!;
          const e = g.etapas.find((x) => x.id === def.id)!;
          const r = etapaDoRascunho(def.id);
          const arquivos = e.arquivos ?? [];
          const marcados = r ? r.itens.filter(Boolean).length : 0;
          const marcouAlgo = r
            ? marcados > 0 ||
              Boolean(r.evidencias?.trim()) ||
              arquivos.length > 0
            : false;
          return (
            <section
              className="modelos__cartao nr1__etapa-detalhe"
              aria-label={def.titulo}
              {...(e.concluida ? { "data-concluida": "" } : {})}
            >
              <span className="modelos__rotulo">{`Etapa ${i + 1} de ${ETAPAS_DA_CONFORMIDADE.length}`}</span>
              <div className="modelos__cartao-topo">
                <h3>{def.titulo}</h3>
                <span
                  className={`pesquisas__selo${e.concluida ? " pesquisas__selo--sucesso" : ""}`}
                >
                  {situacaoDaEtapa(e, def.id)}
                </span>
              </div>
              <p className="pesquisas__suave">{def.texto}</p>
              {e.automatica ? (
                <div>
                  <Button
                    variant="subtle"
                    onClick={def.id === "mapear" ? onVerResultados : onVerPlano}
                  >
                    {def.id === "mapear"
                      ? "Ver resultados da pesquisa"
                      : "Ver plano de ação"}
                  </Button>
                </div>
              ) : r ? (
                <>
                  <p className="nr1__o-que-fazer">
                    <span className="modelos__rotulo">O que fazer</span>
                    <span className="pesquisas__contagem">{`${marcados} de ${def.itens.length}`}</span>
                  </p>
                  <ul className="modelos__checklist">
                    {def.itens.map((t, j) => (
                      <li key={t}>
                        <label>
                          <input
                            type="checkbox"
                            checked={r.itens[j] ?? false}
                            disabled={!podeEditar}
                            onChange={(ev) =>
                              mudarEtapa(def.id, {
                                itens: r.itens.map((v, k) =>
                                  k === j ? ev.target.checked : v,
                                ),
                              })
                            }
                          />
                          {t}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <label
                    className="modelos__campo"
                    htmlFor={`${ids}-${def.id}`}
                  >
                    {`Evidências guardadas (${def.evidencias ?? "documentos"}): o que e onde`}
                    <textarea
                      id={`${ids}-${def.id}`}
                      className="pesquisas__campo"
                      maxLength={2000}
                      disabled={!podeEditar}
                      value={r.evidencias ?? ""}
                      onChange={(ev) =>
                        mudarEtapa(def.id, {
                          evidencias: ev.target.value.trim()
                            ? ev.target.value
                            : null,
                        })
                      }
                    />
                  </label>
                  <ArquivosDaEtapa
                    etapa={def.id}
                    arquivos={arquivos}
                    acompanhamento={a}
                    podeEditar={podeEditar}
                  />
                  {podeEditar ? (
                    <div className="modelos__acoes">
                      <Button
                        variant={r.concluida ? "secondary" : "primary"}
                        disabled={a.salvando || (!r.concluida && !marcouAlgo)}
                        onClick={() => {
                          const etapas = rascunho.etapas.map((x) =>
                            x.id === def.id
                              ? { ...x, concluida: !r.concluida }
                              : x,
                          );
                          void a.salvar({ ...rascunho, etapas });
                        }}
                      >
                        {r.concluida ? "Reabrir etapa" : "Concluir etapa"}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className="modelos__acoes nr1__etapa-navegacao">
                <Button
                  variant="secondary"
                  disabled={i === 0}
                  onClick={() =>
                    setEscolhida(ETAPAS_DA_CONFORMIDADE[i - 1]!.id)
                  }
                >
                  Etapa anterior
                </Button>
                <Button
                  variant="secondary"
                  disabled={i === ETAPAS_DA_CONFORMIDADE.length - 1}
                  onClick={() =>
                    setEscolhida(ETAPAS_DA_CONFORMIDADE[i + 1]!.id)
                  }
                >
                  Próxima etapa
                </Button>
              </div>
            </section>
          );
        })()}
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Profissional de SST"
        descricao="Quem valida o inventário e o plano (aparece no relatório para assinatura)."
        acao={
          podeEditar ? (
            <Button
              disabled={!a.pendente || a.salvando}
              onClick={() => void a.salvar()}
            >
              {a.salvando ? "Salvando…" : "Salvar"}
            </Button>
          ) : null
        }
      >
        <div className="modelos__par">
          <label className="modelos__campo" htmlFor={`${ids}-sst-nome`}>
            Nome
            <input
              id={`${ids}-sst-nome`}
              className="pesquisas__campo"
              maxLength={120}
              disabled={!podeEditar}
              value={rascunho.profissionalSst.nome ?? ""}
              onChange={(e) =>
                a.setRascunho((x) =>
                  x
                    ? {
                        ...x,
                        profissionalSst: {
                          ...x.profissionalSst,
                          nome: e.target.value || null,
                        },
                      }
                    : x,
                )
              }
            />
          </label>
          <label className="modelos__campo" htmlFor={`${ids}-sst-registro`}>
            Registro profissional
            <input
              id={`${ids}-sst-registro`}
              className="pesquisas__campo"
              maxLength={60}
              disabled={!podeEditar}
              value={rascunho.profissionalSst.registro ?? ""}
              onChange={(e) =>
                a.setRascunho((x) =>
                  x
                    ? {
                        ...x,
                        profissionalSst: {
                          ...x.profissionalSst,
                          registro: e.target.value || null,
                        },
                      }
                    : x,
                )
              }
            />
          </label>
        </div>
      </CartaoDeSecao>
    </div>
  );
}
