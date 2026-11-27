/**
 * T215 — "Importar valores" de um benefício (como a referência,
 * 2026-11-26): a gaveta (mês, modelo, como preencher, enviar) e a página
 * Revisar (prontas, com pendência, sem mudança; corrigir ou ignorar cada
 * pendência; importar só as prontas). A conferência por CPF é do
 * servidor; importar grava como "Salvar valores", com a origem.
 */
import {
  type DragEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ColunaDaImportacao,
  ImportacaoConferidaApi,
  LinhaConferidaApi,
  LinhaDaPlanilhaDto,
  PessoaDoBeneficioApi,
  ProblemaDaLinhaApi,
} from "../../api/beneficiosClient";
import { Button, FormActions } from "../../components";
import {
  formatarCompetenciaPorExtenso,
  formatarMesReferencia,
} from "../../format/data";
import { formatarCentavos } from "../../format/moeda";
import { plural } from "../../format/plural";
import { IconButton, ListaDeEscolha, Sheet } from "../../ui";
import {
  IconeBaixarArquivo,
  IconeEnviarArquivo,
  IconeSucesso,
  IconeVoltar,
} from "../../ui/icones";
import { competenciaVizinha } from "../../app/rotasDoShell";
import { baixarArquivo } from "../dashboard/exportacao";
import { TIPO_MIME_XLSX } from "../pessoas/importacao/planilhaXlsx";
import {
  ROTULO_DA_COLUNA,
  baseDoArquivo,
  formatarCpf,
  lerArquivoDeValores,
  modeloDeValores,
  oQueAtualiza,
} from "./planilhaDeValores";
import type { ServicoDeBeneficios } from "./servicoDeBeneficios";

export const IMPORTAR_TITULO_ID = "beneficio-importar-titulo";

export interface PlanilhaEnviada {
  readonly arquivo: string;
  readonly competencia: string;
  readonly linhas: LinhaDaPlanilhaDto[];
  /** O nome escrito na planilha, por linha (quando o CPF não casa). */
  readonly nomes: Readonly<Record<number, string>>;
}

/** A gaveta: mês, modelo, como preencher e o arquivo. */
export function GavetaDeImportacao({
  nome,
  colunas,
  competenciaInicial,
  pessoas,
  onFechar,
  onRevisar,
}: {
  readonly nome: string;
  readonly colunas: readonly ColunaDaImportacao[];
  readonly competenciaInicial: string;
  readonly pessoas: readonly PessoaDoBeneficioApi[];
  readonly onFechar: () => void;
  readonly onRevisar: (p: PlanilhaEnviada) => void;
}) {
  const [competencia, setCompetencia] = useState(competenciaInicial);
  const [trocarMes, setTrocarMes] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const idFormatos = useId();
  const mesExtenso = formatarCompetenciaPorExtenso(competencia, "barra");
  const opcoesDeMes = [-3, -2, -1, 0, 1, 2, 3].map((d) =>
    competenciaVizinha(competenciaInicial, d),
  );

  function receber(f: File | undefined) {
    setRecusa(null);
    if (!f) return;
    if (!/\.(xlsx|csv)$/i.test(f.name)) {
      setRecusa("Envie um arquivo .xlsx ou .csv.");
      return;
    }
    setArquivo(f);
  }

  function aoSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    receber(e.dataTransfer.files?.[0]);
  }

  async function revisar() {
    if (!arquivo) return;
    setLendo(true);
    const lida = await lerArquivoDeValores(arquivo, colunas);
    setLendo(false);
    if ("erro" in lida) {
      setRecusa(lida.erro);
      return;
    }
    onRevisar({
      arquivo: arquivo.name,
      competencia,
      linhas: lida.linhas,
      nomes: lida.nomes,
    });
  }

  return (
    <Sheet
      aberto
      titulo="Importar valores"
      subtitulo={`${nome} · atualiza ${oQueAtualiza(colunas)} por CPF.`}
      onFechar={onFechar}
      bloqueado={lendo}
      rodape={
        <div className="beneficios__rodape-gaveta">
          <span className="beneficios__suave">
            {arquivo ? arquivo.name : "Envie a planilha para continuar"}
          </span>
          <FormActions>
            <Button variant="secondary" onClick={onFechar}>
              Cancelar
            </Button>
            <Button disabled={!arquivo || lendo} onClick={() => void revisar()}>
              Revisar planilha
            </Button>
          </FormActions>
        </div>
      }
    >
      <div className="beneficios__importar">
        <div className="beneficios__importar-mes">
          <div>
            <strong>{`Valores de ${mesExtenso}`}</strong>
            <span className="beneficios__suave">
              Sem folha no Evolli: são valores previstos. Um mês por planilha.
            </span>
          </div>
          {trocarMes ? (
            <ListaDeEscolha
              aria-label="Mês da planilha"
              valor={competencia}
              onMudar={setCompetencia}
              opcoes={opcoesDeMes.map((c) => ({
                valor: c,
                rotulo: formatarMesReferencia(c),
              }))}
            />
          ) : (
            <Button variant="secondary" onClick={() => setTrocarMes(true)}>
              Trocar mês
            </Button>
          )}
        </div>
        <ol className="beneficios__passos-importar">
          <li>
            <span className="beneficios__passo-bola" aria-hidden="true">
              1
            </span>
            <div>
              <strong>Baixe o modelo</strong>
              <span className="beneficios__suave">
                {`Já vem com o CPF${colunas.includes("dias") ? ", a escala" : ""} e o valor atual ${pessoas.length === 1 ? "da pessoa" : `das ${pessoas.length} pessoas`}.`}
              </span>
              <Button
                variant="secondary"
                onClick={() =>
                  baixarArquivo(
                    modeloDeValores(colunas, pessoas, mesExtenso),
                    `valores-${baseDoArquivo(nome, competencia)}.xlsx`,
                    TIPO_MIME_XLSX,
                  )
                }
              >
                <IconeBaixarArquivo tamanho={16} />
                {`Baixar modelo com ${plural(pessoas.length, "pessoa", "pessoas")} (.xlsx)`}
              </Button>
            </div>
          </li>
          <li>
            <span className="beneficios__passo-bola" aria-hidden="true">
              2
            </span>
            <div>
              <strong>Preencha no Excel ou no Google Planilhas</strong>
              <span className="beneficios__suave">
                Mude só o que precisar. Linhas sem mudança são ignoradas.
              </span>
              <span className="beneficios__obrigatorios">
                <span className="beneficios__suave">Obrigatórios:</span>
                <span className="beneficios__chip-campo">CPF *</span>
                <span className="beneficios__chip-campo">
                  {`${colunas.map((c) => ROTULO_DA_COLUNA[c]).join(" ou ")} *`}
                </span>
              </span>
            </div>
          </li>
          <li>
            <span className="beneficios__passo-bola" aria-hidden="true">
              3
            </span>
            <div>
              <strong>Envie a planilha preenchida</strong>
              <div
                className={[
                  "beneficios__soltar",
                  arrastando ? "beneficios__soltar--arrastando" : "",
                  arquivo ? "beneficios__soltar--escolhido" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={aoSoltar}
              >
                <span className="beneficios__vazio-icone" aria-hidden="true">
                  <IconeEnviarArquivo tamanho={22} />
                </span>
                <strong>
                  {arquivo
                    ? arquivo.name
                    : "Escolha a planilha no seu computador"}
                </strong>
                <span className="beneficios__suave" id={idFormatos}>
                  Arquivos .xlsx ou .csv, até 5 MB
                </span>
                <input
                  ref={campo}
                  type="file"
                  hidden
                  accept=".xlsx,.csv"
                  aria-label="Planilha de valores"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    receber(f);
                  }}
                />
                <Button
                  variant="secondary"
                  aria-describedby={idFormatos}
                  onClick={() => campo.current?.click()}
                >
                  <IconeEnviarArquivo tamanho={16} />
                  {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
                </Button>
                <span className="beneficios__suave">
                  ou arraste o arquivo para esta área
                </span>
                {recusa ? (
                  <span className="beneficios__erro" role="alert">
                    {recusa}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        </ol>
      </div>
    </Sheet>
  );
}

const TEXTO_DO_PROBLEMA: Readonly<
  Record<string, { problema: string; detalhe: string }>
> = {
  "cpf:obrigatorio": {
    problema: "CPF em branco",
    detalhe: "Preencha o CPF da pessoa",
  },
  "cpf:invalido": {
    problema: "CPF inválido",
    detalhe: "Confira os números do CPF",
  },
  "cpf:nao_encontrado": {
    problema: "CPF não encontrado",
    detalhe: "Ninguém ativo com esse CPF na empresa",
  },
  "cpf:nao_recebe": {
    problema: "Não recebe o benefício",
    detalhe: "A pessoa não está no benefício neste mês",
  },
  "cpf:duplicado": {
    problema: "CPF repetido",
    detalhe: "O CPF já apareceu numa linha anterior",
  },
  "valores:obrigatorio": {
    problema: "Sem valor",
    detalhe: "Preencha pelo menos um valor da linha",
  },
};

export function textoDoProblema(p: ProblemaDaLinhaApi): {
  problema: string;
  detalhe: string;
} {
  const fixo = TEXTO_DO_PROBLEMA[`${p.campo}:${p.motivo}`];
  if (fixo) return fixo;
  const rotulo =
    p.campo in ROTULO_DA_COLUNA
      ? ROTULO_DA_COLUNA[p.campo as ColunaDaImportacao]
      : "Valor";
  return {
    problema: `${rotulo} inválido`,
    detalhe:
      p.campo === "dias"
        ? "Use um número inteiro de 0 a 31"
        : "Use um valor em reais, como 30,00",
  };
}

type Filtro = "pendencia" | "pronta" | "todos";

/** A página Revisar: o que entra, o que corrigir e o que fica igual. */
export function RevisaoDaImportacao({
  servico,
  beneficioId,
  planilha,
  onTrocarArquivo,
  onCancelar,
  onImportado,
}: {
  readonly servico: ServicoDeBeneficios;
  readonly beneficioId: string;
  readonly planilha: PlanilhaEnviada;
  readonly onTrocarArquivo: () => void;
  readonly onCancelar: () => void;
  readonly onImportado: (mensagem: string) => void;
}) {
  const [linhas, setLinhas] = useState(planilha.linhas);
  const [conferida, setConferida] = useState<ImportacaoConferidaApi | null>(
    null,
  );
  const [falhou, setFalhou] = useState(false);
  const [ignoradas, setIgnoradas] = useState<number[]>([]);
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [busca, setBusca] = useState("");
  const [corrigindo, setCorrigindo] = useState<number | null>(null);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mes = formatarCompetenciaPorExtenso(planilha.competencia, "barra");

  const conferir = async (lista: LinhaDaPlanilhaDto[]) => {
    try {
      const r = await servico.conferirImportacaoDoBeneficio(
        beneficioId,
        planilha.competencia,
        lista,
      );
      setConferida(r);
      setFalhou(false);
      return r;
    } catch {
      setFalhou(true);
      return null;
    }
  };

  // Primeira conferência ao abrir.
  useEffect(() => {
    void conferir(planilha.linhas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todas = conferida?.linhas ?? [];
  const ativa = (l: LinhaConferidaApi) => !ignoradas.includes(l.linha);
  const prontas = todas.filter((l) => l.situacao === "pronta" && ativa(l));
  const pendentes = todas.filter((l) => l.situacao === "pendencia" && ativa(l));
  const semMudanca = todas.filter((l) => l.situacao === "sem_mudanca");
  const filtroAtual: Filtro =
    filtro ?? (pendentes.length > 0 ? "pendencia" : "todos");
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, "");
    return todas.filter((l) => {
      if (
        filtroAtual === "pendencia" &&
        !(l.situacao === "pendencia" && ativa(l))
      )
        return false;
      if (filtroAtual === "pronta" && !(l.situacao === "pronta" && ativa(l)))
        return false;
      if (!termo) return true;
      return (
        (l.nome ?? "").toLowerCase().includes(termo) ||
        (digitos.length > 0 && l.cpf.includes(digitos))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todas, filtroAtual, busca, ignoradas]);

  const emCorrecao =
    corrigindo === null ? null : todas.find((l) => l.linha === corrigindo);
  const posicao = emCorrecao
    ? pendentes.findIndex((l) => l.linha === emCorrecao.linha)
    : -1;

  async function salvarCorrecao(nova: LinhaDaPlanilhaDto) {
    const lista = linhas.map((l) => (l.linha === nova.linha ? nova : l));
    setLinhas(lista);
    const r = await conferir(lista);
    const proxima = r?.linhas.find(
      (l) =>
        l.situacao === "pendencia" &&
        !ignoradas.includes(l.linha) &&
        l.linha > nova.linha,
    );
    setCorrigindo(proxima?.linha ?? null);
  }

  function ignorar(linha: number) {
    setIgnoradas((x) => [...x, linha]);
    const proxima = pendentes.find((l) => l.linha > linha);
    setCorrigindo(proxima?.linha ?? null);
  }

  async function importar() {
    setImportando(true);
    setErro(null);
    try {
      await servico.salvarValoresDoBeneficio(
        beneficioId,
        planilha.competencia,
        prontas.map((l) => ({ colaboradorId: l.colaboradorId!, ...l.valores })),
        "importacao",
      );
      onImportado(
        `Valores de ${formatarMesReferencia(planilha.competencia)} importados para ${plural(prontas.length, "pessoa", "pessoas")}.`,
      );
    } catch {
      setErro("Não foi possível importar. Tente de novo.");
      setImportando(false);
    }
  }

  return (
    <div className="beneficios beneficios--com-rodape">
      <header className="beneficios__cabecalho">
        <IconButton
          label="Voltar para o benefício"
          icon={<IconeVoltar tamanho={18} />}
          onClick={onCancelar}
        />
        <div className="beneficios__titulos">
          <h1 id={IMPORTAR_TITULO_ID} className="beneficios__titulo">
            Importar valores
          </h1>
          <p className="beneficios__subtitulo">
            {`${planilha.arquivo} · ${plural(planilha.linhas.length, "linha", "linhas")} · ${mes} `}
            <button
              type="button"
              className="beneficios__link"
              onClick={onTrocarArquivo}
            >
              Trocar arquivo
            </button>
          </p>
        </div>
        <ol className="beneficios__etapas-importar" aria-label="Etapas">
          <li data-feita>
            <span aria-hidden="true">
              <IconeSucesso tamanho={14} />
            </span>
            Enviar planilha
          </li>
          <li aria-current="step">
            <span aria-hidden="true">2</span>
            Revisar
          </li>
          <li>
            <span aria-hidden="true">3</span>
            Importar
          </li>
        </ol>
      </header>

      {falhou ? (
        <div className="beneficios__erro" role="alert">
          <p>Não foi possível conferir a planilha.</p>
          <Button variant="secondary" onClick={() => void conferir(linhas)}>
            Tentar novamente
          </Button>
        </div>
      ) : !conferida ? (
        <p role="status" className="beneficios__suave">
          Conferindo a planilha…
        </p>
      ) : (
        <>
          <div>
            <h2 className="beneficios__importar-resumo">
              <span
                className={
                  prontas.length === 0 ? "beneficios__alerta-forte" : undefined
                }
              >
                {prontas.length}
              </span>
              {` de ${todas.length} ${todas.length === 1 ? "linha pronta" : "linhas prontas"} para importar`}
            </h2>
            {pendentes.length > 0 ? (
              <p className="beneficios__suave">
                {`${pendentes.length === 1 ? "A linha com pendência pode ser corrigida agora ou ignorada — ela não impede" : `As ${pendentes.length} linhas com pendência podem ser corrigidas agora ou ignoradas — elas não impedem`} a importação das outras.`}
              </p>
            ) : null}
          </div>
          <div className="beneficios__cartoes-importar">
            <div data-tom="sucesso">
              <strong>{prontas.length}</strong>
              <span>
                <span className="beneficios__forte">Prontas</span>
                <span className="beneficios__suave">{`valores novos para ${formatarCompetenciaPorExtenso(planilha.competencia).split(" ")[0]}`}</span>
              </span>
            </div>
            <div data-tom="atencao">
              <strong>{pendentes.length}</strong>
              <span>
                <span className="beneficios__forte">Com pendência</span>
                <span className="beneficios__suave">
                  {pendentes.length === 0
                    ? "nenhuma"
                    : `${pendentes.length} com erro`}
                </span>
              </span>
            </div>
            <div>
              <strong>{semMudanca.length}</strong>
              <span>
                <span className="beneficios__forte">Sem mudança</span>
                <span className="beneficios__suave">
                  iguais ao que já está lançado
                </span>
              </span>
            </div>
          </div>
          <div className="beneficios__filtros">
            <div
              role="tablist"
              aria-label="Mostrar"
              className="beneficios__pilulas"
            >
              {(
                [
                  ["pendencia", "Com pendência", pendentes.length],
                  ["pronta", "Prontas", prontas.length],
                  ["todos", "Todos", todas.length],
                ] as const
              ).map(([v, rotulo, n]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={filtroAtual === v}
                  onClick={() => setFiltro(v)}
                >
                  {rotulo} <span className="beneficios__contagem">{n}</span>
                </button>
              ))}
            </div>
            <input
              type="search"
              className="beneficios__busca beneficios__busca--direita"
              aria-label="Buscar na planilha"
              placeholder="Buscar nome ou CPF"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="beneficios__tabela-caixa">
            <table
              className="beneficios__tabela"
              aria-label="Linhas da planilha"
            >
              <thead>
                <tr>
                  <th scope="col">Linha</th>
                  <th scope="col">Colaborador</th>
                  <th scope="col">
                    {filtroAtual === "pronta" ? "O que muda" : "Problema"}
                  </th>
                  <th scope="col">
                    {filtroAtual === "pronta" ? "Desconto" : "Detalhe"}
                  </th>
                  <th scope="col">
                    <span className="beneficios__so-leitor">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="beneficios__sem-linhas">
                      {filtroAtual === "pendencia"
                        ? "Nenhuma pendência. Tudo pronto para importar."
                        : "Nenhuma linha por aqui."}
                    </td>
                  </tr>
                ) : (
                  visiveis.map((l) => (
                    <LinhaDaRevisao
                      key={l.linha}
                      l={l}
                      nomeDaPlanilha={planilha.nomes[l.linha] ?? null}
                      ignorada={ignoradas.includes(l.linha)}
                      onCorrigir={() => setCorrigindo(l.linha)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="beneficios__rodape-fixo">
        <span className="beneficios__suave">
          {pendentes.length > 0
            ? `${pendentes.length === 1 ? "A linha com pendência não entra" : `As ${pendentes.length} linhas com pendência não entram`}: corrija agora ou envie de novo depois.`
            : "Tudo conferido."}
        </span>
        {erro ? (
          <span className="beneficios__erro" role="alert">
            {erro}
          </span>
        ) : null}
        <Button variant="secondary" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          disabled={prontas.length === 0 || importando}
          onClick={() => void importar()}
        >
          {`Importar ${plural(prontas.length, "linha", "linhas")}`}
        </Button>
      </div>

      {emCorrecao && conferida ? (
        <GavetaDeCorrecao
          key={emCorrecao.linha}
          linha={emCorrecao}
          nomeDaPlanilha={planilha.nomes[emCorrecao.linha] ?? null}
          informada={linhas.find((x) => x.linha === emCorrecao.linha)!}
          colunas={conferida.colunas}
          posicao={posicao + 1}
          total={pendentes.length}
          onFechar={() => setCorrigindo(null)}
          onIgnorar={() => ignorar(emCorrecao.linha)}
          onSalvar={(nova) => void salvarCorrecao(nova)}
        />
      ) : null}
    </div>
  );
}

function LinhaDaRevisao({
  l,
  nomeDaPlanilha,
  ignorada,
  onCorrigir,
}: {
  readonly l: LinhaConferidaApi;
  readonly nomeDaPlanilha: string | null;
  readonly ignorada: boolean;
  readonly onCorrigir: () => void;
}) {
  const primeiro = l.problemas[0];
  const texto = primeiro ? textoDoProblema(primeiro) : null;
  return (
    <tr>
      <td className="beneficios__suave">{l.linha}</td>
      <td>
        <span className="beneficios__pessoa-textos">
          <span className="beneficios__pessoa-nome">
            {l.nome ?? nomeDaPlanilha ?? "Sem nome"}
          </span>
          <span className="beneficios__suave">{`CPF ${formatarCpf(l.cpf) || "—"}`}</span>
        </span>
      </td>
      {ignorada ? (
        <>
          <td className="beneficios__suave">Ignorada</td>
          <td />
          <td />
        </>
      ) : l.situacao === "pendencia" && texto ? (
        <>
          <td className="beneficios__alerta">
            {texto.problema}
            {l.problemas.length > 1 ? ` (+${l.problemas.length - 1})` : ""}
          </td>
          <td className="beneficios__suave">{texto.detalhe}</td>
          <td>
            <Button variant="secondary" onClick={onCorrigir}>
              Corrigir
            </Button>
          </td>
        </>
      ) : l.situacao === "pronta" ? (
        <>
          <td>
            {(Object.keys(l.valores) as ColunaDaImportacao[])
              .map(
                (c) =>
                  `${ROTULO_DA_COLUNA[c]}: ${c === "dias" ? l.valores[c] : formatarCentavos(Math.round((l.valores[c] ?? 0) * 100))}`,
              )
              .join(" · ")}
          </td>
          <td className="beneficios__numero">
            {l.antes && l.depois
              ? `${formatarCentavos(l.antes.desconto)} → ${formatarCentavos(l.depois.desconto)}`
              : "—"}
          </td>
          <td />
        </>
      ) : (
        <>
          <td className="beneficios__suave">Sem mudança</td>
          <td />
          <td />
        </>
      )}
    </tr>
  );
}

function GavetaDeCorrecao({
  linha,
  nomeDaPlanilha,
  informada,
  colunas,
  posicao,
  total,
  onFechar,
  onIgnorar,
  onSalvar,
}: {
  readonly linha: LinhaConferidaApi;
  readonly nomeDaPlanilha: string | null;
  readonly informada: LinhaDaPlanilhaDto;
  readonly colunas: readonly ColunaDaImportacao[];
  readonly posicao: number;
  readonly total: number;
  readonly onFechar: () => void;
  readonly onIgnorar: () => void;
  readonly onSalvar: (nova: LinhaDaPlanilhaDto) => void;
}) {
  const [cpf, setCpf] = useState(informada.cpf);
  const [valores, setValores] = useState(informada.valores);
  const id = useId();
  const erroDe = (campo: string) =>
    linha.problemas.find((p) => p.campo === campo);
  const n = linha.problemas.length;
  return (
    <Sheet
      aberto
      titulo={linha.nome ?? nomeDaPlanilha ?? `Linha ${linha.linha}`}
      subtitulo={`Pendência ${Math.max(posicao, 1)} de ${Math.max(total, 1)} · linha ${linha.linha} da planilha · ${plural(n, "campo para corrigir", "campos para corrigir")}`}
      onFechar={onFechar}
      rodape={
        <FormActions>
          <Button variant="secondary" onClick={onIgnorar}>
            Ignorar esta linha
          </Button>
          <Button
            onClick={() => onSalvar({ linha: informada.linha, cpf, valores })}
          >
            Salvar e ir para a próxima
          </Button>
        </FormActions>
      }
    >
      <div className="beneficios__correcao">
        <p>
          <strong>Corrija o campo destacado</strong>
          <br />
          <span className="beneficios__suave">
            {`Só são obrigatórios: CPF e ${colunas.length > 1 ? "pelo menos um valor" : oQueAtualiza(colunas)}.`}
          </span>
        </p>
        <div className="beneficios__campo-rotulado">
          <label htmlFor={`${id}-cpf`}>CPF</label>
          <input
            id={`${id}-cpf`}
            className="beneficios__campo-texto"
            inputMode="numeric"
            value={cpf}
            aria-invalid={erroDe("cpf") ? true : undefined}
            aria-describedby={erroDe("cpf") ? `${id}-cpf-erro` : undefined}
            onChange={(e) => setCpf(e.target.value)}
          />
          {erroDe("cpf") ? (
            <span id={`${id}-cpf-erro`} className="beneficios__alerta">
              {textoDoProblema(erroDe("cpf")!).detalhe}
            </span>
          ) : null}
        </div>
        {colunas.map((c) => {
          const erro = linha.problemas.find(
            (p) => p.campo === c || p.campo === "valores",
          );
          return (
            <div key={c} className="beneficios__campo-rotulado">
              <label htmlFor={`${id}-${c}`}>{ROTULO_DA_COLUNA[c]}</label>
              <input
                id={`${id}-${c}`}
                className="beneficios__campo-texto"
                inputMode={c === "dias" ? "numeric" : "decimal"}
                value={valores[c] ?? ""}
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? `${id}-${c}-erro` : undefined}
                onChange={(e) =>
                  setValores((v) => ({ ...v, [c]: e.target.value || null }))
                }
              />
              {erro ? (
                <span id={`${id}-${c}-erro`} className="beneficios__alerta">
                  {textoDoProblema(erro).detalhe}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
