/**
 * T215 — "Exportar escala": formato (PDF para imprimir ou planilha), período
 * (dia, semana ou mês), quem entra, como separar as páginas e o que incluir,
 * com a prévia ao lado. Só a escala publicada sai no arquivo.
 */
import { useEffect, useId, useMemo, useState } from "react";
import {
  type PessoaDoQuadroApi,
  type PublicacaoDaEscalaApi,
  type RegrasDaEscalaApi,
  consultarQuadro,
} from "../../../api/escalaClient";
import { baixarArquivo } from "../../dashboard/exportacao";
import {
  diaCivilDeHoje,
  diaMesComZero,
  formatarDiaCivil,
  formatarInstante,
} from "../../../format/data";
import { plural } from "../../../format/plural";
import { Button, Dialog } from "../../../ui";
import { IconeCalendario } from "../../../ui/icones";
import {
  DETALHE_DA_SEPARACAO,
  type FormatoDaExportacao,
  type OpcoesDaExportacao,
  type PeriodoDaExportacao,
  ROTULO_DA_SEPARACAO,
  type SepararPor,
  gerarArquivoDaEscala,
  minutosPublicados,
  mudancasForaDoArquivo,
  nomeDoArquivoDaEscala,
  pessoasPublicadas,
  textoDaCelula,
  tituloDaExportacao,
} from "./exportarEscala";
import {
  NAO_INFORMADO,
  celulaDoDia,
  diasDoPeriodo,
  turnoDaPessoa,
} from "./quadroDaEscala";
import { formatarHoras } from "../../pessoas/ficha/escala/calendarioDaEscala";
import { SeletorDePeriodo, periodoQueContem } from "./SeletorDePeriodo";
import "./DialogoExportar.css";

type QuemEntra = "filtro" | "selecionadas" | "escolher";

const SEPARACOES: readonly SepararPor[] = [
  "unidade",
  "departamento",
  "turno",
  "pessoa",
  "nenhum",
];

export interface DialogoExportarProps {
  /** O período do quadro agora (o padrão do diálogo). */
  readonly visao: "semana" | "mes";
  readonly ancora: string;
  readonly semanaComeca: number;
  /** As pessoas do filtro do quadro agora. */
  readonly doFiltro: readonly PessoaDoQuadroApi[];
  /** As selecionadas no quadro (a barra da seleção). */
  readonly selecionadas?: readonly string[];
  /** "Exportar a escala de cada uma": uma página por pessoa, em .zip. */
  readonly cadaUma?: boolean;
  readonly regras: RegrasDaEscalaApi | undefined;
  readonly empresa: string | null;
  /** Avisos da CLT no arquivo: só para o RH. */
  readonly podeIncluirAvisos: boolean;
  readonly onFechar: () => void;
  /** Para testes: o arquivo gerado, em vez de baixar. */
  readonly onBaixar?: (arquivo: {
    bytes: Uint8Array;
    nome: string;
    tipo: string;
  }) => void;
}

export function DialogoExportar({
  visao,
  ancora: ancoraInicial,
  semanaComeca,
  doFiltro,
  selecionadas = [],
  cadaUma = false,
  regras,
  empresa,
  podeIncluirAvisos,
  onFechar,
  onBaixar,
}: DialogoExportarProps) {
  const base = useId();
  const [formato, setFormato] = useState<FormatoDaExportacao>("pdf");
  const [periodo, setPeriodo] = useState<PeriodoDaExportacao>(visao);
  const [ancora, setAncora] = useState(ancoraInicial);
  const [quem, setQuem] = useState<QuemEntra>(
    selecionadas.length > 0 ? "selecionadas" : "filtro",
  );
  const [unidade, setUnidade] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [turno, setTurno] = useState("");
  const [area, setArea] = useState("");
  const [separarPor, setSepararPor] = useState<SepararPor>(
    cadaUma ? "pessoa" : "unidade",
  );
  const [zipPorPessoa, setZipPorPessoa] = useState(cadaUma);
  const [horas, setHoras] = useState(true);
  const [legenda, setLegenda] = useState(true);
  const [assinatura, setAssinatura] = useState(true);
  const [avisos, setAvisos] = useState(false);
  const [carga, setCarga] = useState<
    | { estado: "carregando" }
    | { estado: "erro" }
    | {
        estado: "pronto";
        pessoas: PessoaDoQuadroApi[];
        publicacao: PublicacaoDaEscalaApi | null;
      }
  >({ estado: "carregando" });
  const [erro, setErro] = useState<string | null>(null);

  const { inicio, fim } = periodoQueContem(periodo, ancora, semanaComeca);
  const dias = useMemo(() => diasDoPeriodo(inicio, fim), [inicio, fim]);

  // O período escolhido: as pessoas com os dias (e a publicação) dele.
  useEffect(() => {
    let vivo = true;
    setCarga({ estado: "carregando" });
    consultarQuadro(inicio, fim)
      .then((q) => {
        if (vivo)
          setCarga({
            estado: "pronto",
            pessoas: q.pessoas,
            publicacao: q.publicacao ?? null,
          });
      })
      .catch(() => {
        if (vivo) setCarga({ estado: "erro" });
      });
    return () => {
      vivo = false;
    };
  }, [inicio, fim]);

  const doPeriodo = carga.estado === "pronto" ? carga.pessoas : [];
  const idsDoFiltro = new Set(doFiltro.map((p) => p.colaboradorId));
  const idsSelecionadas = new Set(selecionadas);
  const opcoesDe = (lista: readonly string[]) =>
    [...new Set(lista)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const unidades = opcoesDe(
    doPeriodo.map((p) => p.unidade?.nome ?? NAO_INFORMADO),
  );
  const departamentos = opcoesDe(
    doPeriodo.map((p) => p.departamento?.nome ?? NAO_INFORMADO),
  );
  const turnos = opcoesDe(
    doPeriodo.flatMap((p) => {
      const t = turnoDaPessoa(p, inicio);
      return t ? [t.nome] : [];
    }),
  );
  const areas = opcoesDe(
    doPeriodo.flatMap((p) => (p.area ? [p.area.nome] : [])),
  );
  const entram = doPeriodo.filter((p) => {
    if (quem === "filtro") return idsDoFiltro.has(p.colaboradorId);
    if (quem === "selecionadas") return idsSelecionadas.has(p.colaboradorId);
    return (
      (!unidade || (p.unidade?.nome ?? NAO_INFORMADO) === unidade) &&
      (!departamento ||
        (p.departamento?.nome ?? NAO_INFORMADO) === departamento) &&
      (!turno || turnoDaPessoa(p, inicio)?.nome === turno) &&
      (!area || p.area?.nome === area)
    );
  });
  const quantosDepartamentos = new Set(
    entram.map((p) => p.departamento?.nome ?? NAO_INFORMADO),
  ).size;
  const publicadas = pessoasPublicadas(entram, dias);
  const foraDoArquivo = mudancasForaDoArquivo(entram, dias);
  const publicacao = carga.estado === "pronto" ? carga.publicacao : null;

  const o: OpcoesDaExportacao = {
    formato,
    periodo,
    inicio,
    fim,
    separarPor,
    zipPorPessoa: separarPor === "pessoa" && zipPorPessoa,
    horas,
    legenda: formato === "pdf" && legenda,
    assinatura: formato === "pdf" && assinatura,
    // O "Avisos da CLT" só aparece para o RH (podeIncluirAvisos).
    avisos,
  };
  // "25/11/2026 às 12:54", no fuso de negócio.
  const ctx = {
    empresa,
    publicacao,
    regras,
    geradoEm: formatarInstante(new Date().toISOString()),
  };
  const arquivo =
    publicadas.length > 0
      ? gerarArquivoDaEscala(entram, dias, o, ctx, semanaComeca)
      : null;
  const nome = nomeDoArquivoDaEscala(o);

  const baixar = () => {
    setErro(null);
    if (!arquivo) return;
    try {
      if (onBaixar) onBaixar(arquivo);
      else baixarArquivo(arquivo.bytes, arquivo.nome, arquivo.tipo);
      onFechar();
    } catch {
      setErro("Não foi possível gerar o arquivo. Tente de novo.");
    }
  };

  const nota =
    carga.estado !== "pronto"
      ? null
      : publicadas.length === 0
        ? "Nada publicado neste período. Só a escala publicada sai no arquivo."
        : `Sai a versão publicada${publicacao ? ` em ${formatarDiaCivil(diaCivilDeHoje(new Date(publicacao.publicadaEm)))}` : ""}.${
            foraDoArquivo > 0
              ? ` ${foraDoArquivo === 1 ? "A mudança do rascunho não entra" : `As ${foraDoArquivo} mudanças do rascunho não entram`}.`
              : ""
          }`;

  return (
    <Dialog
      aberto
      titulo="Exportar escala"
      descricao="Escolha o período, quem entra e como separar as páginas."
      onFechar={onFechar}
      className="exportar"
      rodape={
        <>
          <p className="exportar__rodape-nota">
            O arquivo é gerado na hora; nada muda na escala.
          </p>
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={baixar}
            aria-disabled={!arquivo}
            disabled={carga.estado !== "pronto"}
          >
            {formato === "pdf"
              ? o.zipPorPessoa
                ? "Baixar .zip"
                : "Baixar PDF"
              : "Baixar planilha"}
          </Button>
        </>
      }
    >
      <div className="exportar__corpo">
        <div className="exportar__opcoes">
          <fieldset className="exportar__grupo">
            <legend>Formato</legend>
            <div className="exportar__cartoes">
              {(
                [
                  ["pdf", "PDF para imprimir", "A4, com a cor de cada turno"],
                  ["xlsx", "Planilha (.xlsx)", "Pessoa × dia, com as horas"],
                ] as const
              ).map(([valor, titulo, texto]) => (
                <label
                  key={valor}
                  className={`exportar__cartao${formato === valor ? " exportar__cartao--marcado" : ""}`}
                >
                  <input
                    type="radio"
                    name={`${base}-formato`}
                    checked={formato === valor}
                    onChange={() => setFormato(valor)}
                  />
                  <span>
                    <strong>{titulo}</strong>
                    <small>{texto}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="exportar__grupo">
            <legend>Período</legend>
            <div className="exportar__periodo">
              <div
                className="exportar__abas"
                role="radiogroup"
                aria-label="Tamanho do período"
              >
                {(
                  [
                    ["dia", "Dia"],
                    ["semana", "Semana"],
                    ["mes", "Mês"],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={periodo === valor}
                    onClick={() => setPeriodo(valor)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              <SeletorDePeriodo
                tamanho={periodo}
                ancora={ancora}
                semanaComeca={semanaComeca}
                onEscolher={setAncora}
              />
            </div>
          </fieldset>

          <fieldset className="exportar__grupo">
            <legend>Quem entra</legend>
            {selecionadas.length > 0 ? (
              <label className="exportar__radio">
                <input
                  type="radio"
                  name={`${base}-quem`}
                  checked={quem === "selecionadas"}
                  onChange={() => setQuem("selecionadas")}
                />
                {`As ${plural(selecionadas.length, "pessoa selecionada", "pessoas selecionadas")}`}
              </label>
            ) : null}
            <label className="exportar__radio">
              <input
                type="radio"
                name={`${base}-quem`}
                checked={quem === "filtro"}
                onChange={() => setQuem("filtro")}
              />
              Quem está no filtro do quadro agora
            </label>
            <label className="exportar__radio">
              <input
                type="radio"
                name={`${base}-quem`}
                checked={quem === "escolher"}
                onChange={() => setQuem("escolher")}
              />
              Escolher
            </label>
            {quem === "escolher" ? (
              <div className="exportar__filtros">
                <FiltroDoExportar
                  rotulo="Unidade"
                  todos="Todas"
                  valor={unidade}
                  onMudar={setUnidade}
                  opcoes={unidades}
                />
                <FiltroDoExportar
                  rotulo="Departamento"
                  todos="Todos"
                  valor={departamento}
                  onMudar={setDepartamento}
                  opcoes={departamentos}
                />
                <FiltroDoExportar
                  rotulo="Turno"
                  todos="Todos"
                  valor={turno}
                  onMudar={setTurno}
                  opcoes={turnos}
                />
                <FiltroDoExportar
                  rotulo="Área"
                  todos="Todas"
                  valor={area}
                  onMudar={setArea}
                  opcoes={areas}
                />
              </div>
            ) : null}
            <p className="exportar__ajuda" aria-live="polite">
              {`${plural(entram.length, "pessoa", "pessoas")} · ${plural(quantosDepartamentos, "departamento", "departamentos")}`}
            </p>
          </fieldset>

          {formato === "pdf" ? (
            <fieldset className="exportar__grupo">
              <legend>Páginas</legend>
              <div className="exportar__linha">
                <label htmlFor={`${base}-separar`}>Uma página por</label>
                <select
                  id={`${base}-separar`}
                  value={separarPor}
                  onChange={(e) => setSepararPor(e.target.value as SepararPor)}
                >
                  {SEPARACOES.map((s) => (
                    <option key={s} value={s}>
                      {ROTULO_DA_SEPARACAO[s]}
                    </option>
                  ))}
                </select>
                <span className="exportar__ajuda">{`· ${DETALHE_DA_SEPARACAO[separarPor]}`}</span>
              </div>
              {separarPor === "pessoa" ? (
                <label className="exportar__marcar">
                  <input
                    type="checkbox"
                    checked={zipPorPessoa}
                    onChange={(e) => setZipPorPessoa(e.target.checked)}
                  />
                  Um PDF por pessoa, num arquivo .zip
                </label>
              ) : null}
            </fieldset>
          ) : null}

          <fieldset className="exportar__grupo">
            <legend>Incluir</legend>
            <label className="exportar__marcar">
              <input
                type="checkbox"
                checked={horas}
                onChange={(e) => setHoras(e.target.checked)}
              />
              Horas de cada pessoa
            </label>
            {formato === "pdf" ? (
              <>
                <label className="exportar__marcar">
                  <input
                    type="checkbox"
                    checked={legenda}
                    onChange={(e) => setLegenda(e.target.checked)}
                  />
                  Legenda dos turnos
                </label>
                <label className="exportar__marcar">
                  <input
                    type="checkbox"
                    checked={assinatura}
                    onChange={(e) => setAssinatura(e.target.checked)}
                  />
                  {separarPor === "pessoa"
                    ? "Linha para a assinatura do colaborador"
                    : "Linha para assinatura do responsável"}
                </label>
              </>
            ) : null}
            {podeIncluirAvisos ? (
              <label className="exportar__marcar">
                <input
                  type="checkbox"
                  checked={avisos}
                  onChange={(e) => setAvisos(e.target.checked)}
                />
                Avisos da CLT (só para o RH)
              </label>
            ) : null}
          </fieldset>

          {nota ? (
            <p className="exportar__nota" role="status">
              {nota}
            </p>
          ) : null}
          {erro ? (
            <p className="exportar__erro" role="alert">
              {erro}
            </p>
          ) : null}
        </div>

        <aside className="exportar__previa" aria-label="Prévia">
          <h3>Prévia</h3>
          {carga.estado === "carregando" ? (
            <p className="exportar__ajuda">Carregando o período…</p>
          ) : carga.estado === "erro" ? (
            <p className="exportar__erro" role="alert">
              Não foi possível carregar o período.
            </p>
          ) : publicadas.length === 0 ? (
            <div className="exportar__vazio">
              <span className="exportar__vazio-icone" aria-hidden="true">
                <IconeCalendario tamanho={20} />
              </span>
              <strong>Nada publicado neste período</strong>
              <p>
                O arquivo leva só a escala publicada, para o mural e o
                colaborador verem a mesma coisa. Publique o período no quadro ou
                escolha outro período ou outras pessoas.
              </p>
            </div>
          ) : formato === "xlsx" ? (
            <>
              <div
                className="exportar__mini-tabela"
                role="table"
                aria-label="Primeiras linhas da planilha"
              >
                <div role="row">
                  <span role="columnheader">Colaborador</span>
                  {dias.slice(0, 4).map((d) => (
                    <span role="columnheader" key={d}>
                      {diaMesComZero(d)}
                    </span>
                  ))}
                  {horas ? <span role="columnheader">Horas</span> : null}
                </div>
                {publicadas.slice(0, 4).map((p) => (
                  <div role="row" key={p.colaboradorId}>
                    <span role="cell">{p.nome}</span>
                    {dias.slice(0, 4).map((d) => (
                      <span role="cell" key={d}>
                        {textoDaCelula(celulaDoDia(p, d))}
                      </span>
                    ))}
                    {horas ? (
                      <span role="cell">
                        {formatarHoras(minutosPublicados(p, dias))}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="exportar__ajuda">
                {`${plural(publicadas.length, "pessoa", "pessoas")} · ${plural(dias.length, "dia", "dias")}`}
              </p>
              <p className="exportar__ajuda">{`Planilha · abas Escala, Horas previstas${o.avisos ? ", Avisos da CLT" : ""}`}</p>
              <p className="exportar__ajuda">{`Arquivo: ${nome}`}</p>
            </>
          ) : (
            <>
              <div className="exportar__folha" aria-hidden="true">
                <div className="exportar__folha-faixa" />
                <strong>
                  {separarPor === "pessoa"
                    ? publicadas[0]!.nome
                    : tituloDaExportacao(o)}
                </strong>
                {publicadas.slice(0, 6).map((p) => (
                  <span key={p.colaboradorId} className="exportar__folha-linha">
                    {p.nome}
                  </span>
                ))}
              </div>
              <p className="exportar__ajuda">
                {`${separarPor === "pessoa" ? "A4 em pé" : "A4 deitado"} · ${
                  o.zipPorPessoa
                    ? plural(arquivo?.paginas ?? 0, "PDF", "PDFs")
                    : plural(arquivo?.paginas ?? 0, "página", "páginas")
                }`}
              </p>
              <p className="exportar__ajuda">{`Arquivo: ${nome}`}</p>
            </>
          )}
        </aside>
      </div>
    </Dialog>
  );
}

function FiltroDoExportar({
  rotulo,
  todos,
  valor,
  onMudar,
  opcoes,
}: {
  readonly rotulo: string;
  readonly todos: string;
  readonly valor: string;
  readonly onMudar: (v: string) => void;
  readonly opcoes: readonly string[];
}) {
  const id = useId();
  return (
    <div className="exportar__filtro">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} value={valor} onChange={(e) => onMudar(e.target.value)}>
        <option value="">{todos}</option>
        {opcoes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}
