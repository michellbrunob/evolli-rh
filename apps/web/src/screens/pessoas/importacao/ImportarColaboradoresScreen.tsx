/**
 * T209 (Bloco C) — importação de colaboradores por planilha CSV, numa página
 * própria (`#/pessoas/importar`), em três passos: **modelo e arquivo**,
 * **conferência** e **resultado**.
 *
 * Ficha de tratamento (seção 29.2 do dossiê): o arquivo é lido só nesta aba e
 * nunca sai dela como arquivo nem é guardado; o que vai ao servidor é uma
 * admissão por linha válida, pelo `POST /v1/colaboradores` de sempre, com
 * `Idempotency-Key` própria da linha — gerada na conferência e mantida nas
 * novas tentativas, então reenviar nunca admite a mesma pessoa duas vezes.
 * Mensagens e relatório dizem linha, campo e motivo, nunca o valor.
 *
 * O envio é sequencial (C-7). Recusa do servidor fica na linha e a importação
 * segue; falha de rede ou do servidor vira "não confirmada" (reenvio seguro);
 * sessão expirada ou permissão negada param tudo, e o resto fica "não
 * enviada". Com planilha conferida e não importada, sair pergunta (T200);
 * durante o envio, a saída e a troca de empresa esperam.
 */
import { ChevronLeft } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ApiError, admitirColaborador } from "../../../api/colaboradoresClient";
import { listarCargos } from "../../../api/cargoClient";
import {
  listarDepartamentos,
  listarEmpresasMulti,
  listarUnidades,
  type EmpresaApi,
} from "../../../api/organizacaoClient";
import { useEdicaoEmAndamento } from "../../../app/edicoesPendentes";
import { useGuardaDeSaida } from "../../../app/guardaDeSaida";
import { destinoPorId, tituloDoGrupoDe } from "../../../app/mapaNavegacao";
import { formatarDiaCivil } from "../../../format/data";
import { PageHeader, Surface, TrilhaNavegacao } from "../../../components";
import { baixarArquivo } from "../../dashboard/exportacao";
import { Button, Dialog, IconButton } from "../../../ui";
import { ROTULO_TIPO_DE_VINCULO } from "../ColaboradoresScreen";
import {
  COLUNAS_OBRIGATORIAS,
  COLUNAS_OPCIONAIS,
  LIMITE_DE_LINHAS,
  conferirPlanilha,
  gerarModelo,
  lerPlanilha,
  montarAdmissao,
  relatorioDeErros,
  verificarTamanho,
  type AdmissaoDaLinha,
  type Coluna,
  type ItemDoRelatorio,
  type LinhaConferida,
  type ReferenciaDoCatalogo,
  type Referencias,
} from "./planilhaColaboradores";
import "./ImportarColaboradoresScreen.css";

export const IMPORTAR_COLABORADORES_TITULO_ID = "importar-colaboradores-titulo";

const TITULO = "Importar planilha de colaboradores";
const ROTULO_DO_ARQUIVO = "Arquivo CSV da planilha";
const AVISO_NADA_IMPORTADO = "Nenhuma pessoa da planilha foi importada ainda.";

/** O que cada coluna aceita, para a tabela do passo 1. */
const FORMATO_DA_COLUNA: Readonly<Record<Coluna, string>> = {
  nome: "Nome completo, de 2 a 160 caracteres",
  tipo_vinculo: "CLT, Estágio, Aprendiz, PJ, Temporário ou Outro controlado",
  data_admissao: "DD/MM/AAAA",
  data_nascimento: "DD/MM/AAAA, até hoje",
  departamento_codigo: "Código de um departamento ativo da empresa",
  cargo_codigo: "Código de um cargo ativo da empresa",
  matricula: "De 2 a 32 letras, números, hífen ou sublinhado",
  unidade_codigo: "Código de uma unidade ativa da empresa",
};

type Passo = "arquivo" | "conferencia" | "resultado";

const PASSOS: ReadonlyArray<readonly [Passo, string]> = [
  ["arquivo", "Modelo e arquivo"],
  ["conferencia", "Conferência"],
  ["resultado", "Resultado"],
];

type EstadoDoEnvio = "admitida" | "recusada" | "incerta" | "nao_enviada";

interface Envio {
  readonly estado: EstadoDoEnvio;
  readonly motivo?: string;
}

const ROTULO_DO_ESTADO: Readonly<Record<EstadoDoEnvio, string>> = {
  admitida: "Admitida",
  recusada: "Recusada",
  incerta: "Não confirmada",
  nao_enviada: "Não enviada",
};

/** Linha pronta para enviar, com a chave fixada na conferência. */
interface LinhaPronta {
  readonly numero: number;
  readonly admissao: AdmissaoDaLinha;
  readonly chave: string;
}

/** Mesma fonte da Nova admissão (T179): UUID v4 do próprio navegador. */
function gerarChave(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Hoje no calendário de quem usa (o limite da data de nascimento). */
function hojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function lerTexto(arquivo: File): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result ?? ""));
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsText(arquivo, "utf-8");
  });
}

/** Todas as páginas de um catálogo ativo — sem o teto de 100 (T190). */
async function todosAtivos(
  listar: (query: {
    status: string;
    pagina: number;
    tamanhoPagina: number;
  }) => Promise<{ itens: ReferenciaDoCatalogo[]; total: number }>,
): Promise<ReferenciaDoCatalogo[]> {
  const itens: ReferenciaDoCatalogo[] = [];
  for (let pagina = 1; ; pagina += 1) {
    const resposta = await listar({
      status: "ativo",
      pagina,
      tamanhoPagina: 100,
    });
    itens.push(...resposta.itens.map(({ id, codigo }) => ({ id, codigo })));
    if (resposta.itens.length === 0 || itens.length >= resposta.total) {
      return itens;
    }
  }
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function quantas(n: number, um: string, varios: string): string {
  return n === 0 ? `nenhuma ${um}` : plural(n, um, varios);
}

/** O motivo da recusa como o servidor o deu (nunca o valor enviado). */
function motivoDaRecusa(erro: ApiError): string {
  const doCampo = erro.erros?.[0]?.motivo;
  return doCampo ?? erro.message;
}

export interface ImportarColaboradoresScreenProps {
  /** Voltar à listagem de Colaboradores. */
  readonly onSair: () => void;
}

export function ImportarColaboradoresScreen({
  onSair,
}: ImportarColaboradoresScreenProps) {
  const prefixo = useId();
  const [empresa, setEmpresa] = useState<EmpresaApi | null>(null);
  const [falhaDaEmpresa, setFalhaDaEmpresa] = useState(false);
  const [passo, setPasso] = useState<Passo>("arquivo");
  const [lendo, setLendo] = useState(false);
  const [erroDoArquivo, setErroDoArquivo] = useState<string | null>(null);
  const [nomeDoArquivo, setNomeDoArquivo] = useState<string | null>(null);
  const [conferidas, setConferidas] = useState<readonly LinhaConferida[]>([]);
  const [prontas, setProntas] = useState<readonly LinhaPronta[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ feitas: 0, total: 0 });
  const [envios, setEnvios] = useState<ReadonlyMap<number, Envio>>(new Map());
  const [interrupcao, setInterrupcao] = useState<string | null>(null);
  const enviandoRef = useRef(false);
  const tituloDoPassoRef = useRef<HTMLHeadingElement | null>(null);
  /** Pedido de foco no título do passo (conta, para valer no mesmo passo). */
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const resposta = await listarEmpresasMulti();
        if (!vigente) return;
        const unica =
          resposta.itens.length === 1 ? resposta.itens[0] : undefined;
        if (unica) setEmpresa(unica);
        else setFalhaDaEmpresa(true);
      } catch {
        if (vigente) setFalhaDaEmpresa(true);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  // O foco vai ao título do passo, depois de ele aparecer — também quando o
  // passo se repete (o resultado de uma nova tentativa).
  useEffect(() => {
    if (pedidoDeFoco > 0) tituloDoPassoRef.current?.focus();
  }, [pedidoDeFoco]);

  function irPara(novo: Passo) {
    setPasso(novo);
    setPedidoDeFoco((n) => n + 1);
  }

  const pendentes = prontas.filter(
    (linha) => envios.get(linha.numero)?.estado !== "admitida",
  );

  // T200 — planilha conferida e ainda não importada é edição pendente; o
  // envio, salvamento em andamento.
  useEdicaoEmAndamento("Importação de colaboradores", {
    pendente: passo === "conferencia" && prontas.length > 0,
    salvando: enviando,
    aviso: AVISO_NADA_IMPORTADO,
  });
  const guarda = useGuardaDeSaida();
  function sair() {
    guarda.solicitarSaida({ executar: onSair });
  }

  function recomecar() {
    setErroDoArquivo(null);
    setNomeDoArquivo(null);
    setConferidas([]);
    setProntas([]);
    setEnvios(new Map());
    setInterrupcao(null);
    setProgresso({ feitas: 0, total: 0 });
    irPara("arquivo");
  }

  async function aoEscolherArquivo(
    evento: React.ChangeEvent<HTMLInputElement>,
  ) {
    const campo = evento.currentTarget;
    const arquivo = campo.files?.[0];
    // O mesmo arquivo pode ser escolhido de novo depois de corrigido.
    campo.value = "";
    if (!arquivo || !empresa) return;
    setErroDoArquivo(null);
    const porTamanho = verificarTamanho(arquivo.size);
    if (porTamanho) {
      setErroDoArquivo(porTamanho);
      return;
    }
    setLendo(true);
    try {
      const lida = lerPlanilha(await lerTexto(arquivo));
      if ("erro" in lida) {
        setErroDoArquivo(lida.erro);
        return;
      }
      const [departamentos, cargos, unidades] = await Promise.all([
        todosAtivos(listarDepartamentos),
        todosAtivos(listarCargos),
        todosAtivos(listarUnidades),
      ]);
      const referencias: Referencias = { departamentos, cargos, unidades };
      const linhas = conferirPlanilha(lida, referencias, hojeLocal());
      setNomeDoArquivo(arquivo.name);
      setConferidas(linhas);
      setProntas(
        linhas.flatMap((linha) =>
          linha.admissao
            ? [
                {
                  numero: linha.numero,
                  admissao: linha.admissao,
                  chave: gerarChave(),
                },
              ]
            : [],
        ),
      );
      setEnvios(new Map());
      irPara("conferencia");
    } catch {
      setErroDoArquivo(
        "Não foi possível ler o arquivo ou consultar os cadastros da empresa agora. Tente de novo.",
      );
    } finally {
      setLendo(false);
    }
  }

  async function enviar(linhas: readonly LinhaPronta[]) {
    if (enviandoRef.current || !empresa || linhas.length === 0) return;
    enviandoRef.current = true;
    setConfirmando(false);
    setEnviando(true);
    setInterrupcao(null);
    setProgresso({ feitas: 0, total: linhas.length });
    const resultado = new Map(envios);
    let parada: string | null = null;
    for (const [indice, linha] of linhas.entries()) {
      if (parada !== null) {
        resultado.set(linha.numero, { estado: "nao_enviada" });
        continue;
      }
      setProgresso({ feitas: indice, total: linhas.length });
      try {
        await admitirColaborador(montarAdmissao(linha.admissao, empresa.id), {
          chaveIdempotencia: linha.chave,
        });
        resultado.set(linha.numero, { estado: "admitida" });
      } catch (erro: unknown) {
        if (
          erro instanceof ApiError &&
          (erro.status === 401 || erro.status === 403)
        ) {
          parada =
            erro.status === 401
              ? "Sua sessão expirou. Entre de novo e tente as que faltaram."
              : "Seu acesso não permite admitir nesta empresa. Nada mais foi enviado.";
          resultado.set(linha.numero, { estado: "nao_enviada" });
        } else if (erro instanceof ApiError && erro.status < 500) {
          resultado.set(linha.numero, {
            estado: "recusada",
            motivo: motivoDaRecusa(erro),
          });
        } else {
          resultado.set(linha.numero, {
            estado: "incerta",
            motivo:
              "Sem confirmação do servidor. Tentar de novo é seguro: a mesma linha nunca é admitida duas vezes.",
          });
        }
      }
    }
    setEnvios(resultado);
    setInterrupcao(parada);
    setProgresso({ feitas: linhas.length, total: linhas.length });
    setEnviando(false);
    enviandoRef.current = false;
    irPara("resultado");
  }

  function baixarModelo() {
    baixarArquivo(gerarModelo(), "modelo-importacao-colaboradores.csv");
  }

  function baixarRelatorio() {
    const itens: ItemDoRelatorio[] = [
      ...conferidas.flatMap((linha) =>
        linha.erros.map((erro) => ({ numero: linha.numero, ...erro })),
      ),
      ...prontas.flatMap((linha) => {
        const envio = envios.get(linha.numero);
        if (!envio || envio.estado === "admitida") return [];
        return [
          {
            numero: linha.numero,
            campo: "Envio",
            motivo: `${ROTULO_DO_ESTADO[envio.estado]}${envio.motivo ? `: ${envio.motivo}` : ""}`,
          },
        ];
      }),
    ].sort((a, b) => a.numero - b.numero);
    baixarArquivo(
      relatorioDeErros(itens),
      "relatorio-importacao-colaboradores.csv",
    );
  }

  const comErro = conferidas.filter((linha) => linha.admissao === null);
  const admitidas = prontas.length - pendentes.length;
  const contagem = (estado: EstadoDoEnvio) =>
    pendentes.filter((l) => envios.get(l.numero)?.estado === estado).length;
  const partesPendentes = (
    [
      ["recusada", "recusada", "recusadas"],
      ["incerta", "não confirmada", "não confirmadas"],
      ["nao_enviada", "não enviada", "não enviadas"],
    ] as const
  )
    .map(([estado, um, varios]) => [contagem(estado), um, varios] as const)
    .filter(([n]) => n > 0)
    .map(([n, um, varios]) => plural(n, um, varios));
  const resumoDoResultado = `${
    admitidas === 0
      ? "Nenhuma admitida"
      : plural(admitidas, "admitida", "admitidas")
  }, ${
    pendentes.length === 0
      ? "nenhuma pendente"
      : `${plural(pendentes.length, "pendente", "pendentes")}: ${partesPendentes.join(", ")}`
  }.`;
  const rotuloImportar = `Importar ${plural(prontas.length, "colaborador", "colaboradores")}`;
  const idTituloDoPasso = `${prefixo}-passo`;

  return (
    <div className="importar-colaboradores">
      <TrilhaNavegacao
        itens={[
          {
            rotulo:
              tituloDoGrupoDe("importar-colaboradores") ?? "Gestão de Pessoas",
          },
          {
            rotulo: destinoPorId("pessoas")?.label ?? "Colaboradores",
            onSelecionar: sair,
          },
          { rotulo: "Importar planilha" },
        ]}
      />
      <header className="importar-colaboradores__cabecalho">
        <IconButton
          label="Voltar para Colaboradores"
          icon={<ChevronLeft size={18} />}
          onClick={sair}
        />
        <PageHeader
          headingLevel={1}
          titleId={IMPORTAR_COLABORADORES_TITULO_ID}
          title={TITULO}
          description="Traga várias pessoas de uma vez: cada linha válida vira uma admissão, como no cadastro individual."
        />
      </header>

      <ol
        className="importar-colaboradores__passos"
        aria-label="Passos da importação"
      >
        {PASSOS.map(([id, rotulo], i) => (
          <li
            key={id}
            className="importar-colaboradores__passo"
            data-estado={id === passo ? "atual" : undefined}
            {...(id === passo ? { "aria-current": "step" as const } : {})}
          >
            <span className="importar-colaboradores__numero">{i + 1}</span>
            {rotulo}
          </li>
        ))}
      </ol>

      {empresa ? (
        <p className="importar-colaboradores__empresa">
          Importando em{" "}
          <strong>
            {empresa.nome} ({empresa.codigo})
          </strong>
          .
        </p>
      ) : falhaDaEmpresa ? (
        <p className="importar-colaboradores__erro" role="alert">
          Não foi possível identificar a empresa ativa. Volte a Colaboradores e
          tente de novo.
        </p>
      ) : null}

      {passo === "arquivo" ? (
        <Surface as="section" padding="md" aria-labelledby={idTituloDoPasso}>
          <h2
            id={idTituloDoPasso}
            ref={tituloDoPassoRef}
            tabIndex={-1}
            className="importar-colaboradores__titulo-passo"
          >
            Modelo e arquivo
          </h2>
          <p className="importar-colaboradores__texto">
            Use o modelo: só CSV, até {LIMITE_DE_LINHAS} linhas e 1 MB. O
            arquivo é lido só neste navegador — não é enviado nem guardado.
            Colunas fora do modelo (como CPF, salário ou contatos) recusam o
            arquivo inteiro.
          </p>
          <div className="importar-colaboradores__tabela-rolagem">
            <table className="importar-colaboradores__tabela">
              <caption>Colunas da planilha</caption>
              <thead>
                <tr>
                  <th scope="col">Coluna</th>
                  <th scope="col">Uso</th>
                  <th scope="col">Formato</th>
                </tr>
              </thead>
              <tbody>
                {[...COLUNAS_OBRIGATORIAS, ...COLUNAS_OPCIONAIS].map(
                  (coluna) => (
                    <tr key={coluna}>
                      <th scope="row">
                        <code>{coluna}</code>
                      </th>
                      <td>
                        {(COLUNAS_OBRIGATORIAS as readonly string[]).includes(
                          coluna,
                        )
                          ? "Obrigatória"
                          : "Opcional"}
                      </td>
                      <td>{FORMATO_DA_COLUNA[coluna]}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <div className="importar-colaboradores__acoes">
            <Button variant="secondary" onClick={baixarModelo}>
              Baixar modelo
            </Button>
          </div>
          <div className="importar-colaboradores__arquivo">
            <label htmlFor={`${prefixo}-arquivo`}>{ROTULO_DO_ARQUIVO}</label>
            <input
              id={`${prefixo}-arquivo`}
              type="file"
              accept=".csv,text/csv"
              disabled={!empresa || lendo}
              aria-describedby={
                erroDoArquivo ? `${prefixo}-erro-arquivo` : undefined
              }
              onChange={(evento) => void aoEscolherArquivo(evento)}
            />
            {lendo ? (
              <p className="importar-colaboradores__texto" role="status">
                Conferindo a planilha…
              </p>
            ) : null}
            {erroDoArquivo ? (
              <p
                id={`${prefixo}-erro-arquivo`}
                className="importar-colaboradores__erro"
                role="alert"
              >
                {erroDoArquivo}
              </p>
            ) : null}
          </div>
        </Surface>
      ) : null}

      {passo === "conferencia" ? (
        <Surface as="section" padding="md" aria-labelledby={idTituloDoPasso}>
          <h2
            id={idTituloDoPasso}
            ref={tituloDoPassoRef}
            tabIndex={-1}
            className="importar-colaboradores__titulo-passo"
          >
            Conferência
          </h2>
          {nomeDoArquivo ? (
            <p className="importar-colaboradores__texto">
              Arquivo <strong>{nomeDoArquivo}</strong>.
            </p>
          ) : null}
          <p className="importar-colaboradores__texto">
            {`${plural(conferidas.length, "linha lida", "linhas lidas")}: ${plural(prontas.length, "pronta", "prontas")} para importar, ${quantas(comErro.length, "com erro", "com erro")}.`}
          </p>
          {enviando ? (
            <div className="importar-colaboradores__progresso">
              <progress
                max={progresso.total}
                value={progresso.feitas}
                aria-label="Progresso da importação"
              />
              <p role="status">
                Importando {Math.min(progresso.feitas + 1, progresso.total)} de{" "}
                {progresso.total}…
              </p>
            </div>
          ) : null}
          {comErro.length > 0 ? <TabelaDeErros linhas={comErro} /> : null}
          {prontas.length > 0 ? <TabelaDeProntas linhas={prontas} /> : null}
          <div className="importar-colaboradores__acoes">
            <Button variant="secondary" onClick={recomecar} disabled={enviando}>
              Escolher outro arquivo
            </Button>
            {comErro.length > 0 ? (
              <Button
                variant="secondary"
                onClick={baixarRelatorio}
                disabled={enviando}
              >
                Baixar relatório de erros
              </Button>
            ) : null}
            {prontas.length > 0 ? (
              <Button
                variant="primary"
                onClick={() => setConfirmando(true)}
                disabled={enviando}
              >
                {rotuloImportar}
              </Button>
            ) : null}
          </div>
        </Surface>
      ) : null}

      {passo === "resultado" ? (
        <Surface as="section" padding="md" aria-labelledby={idTituloDoPasso}>
          <h2
            id={idTituloDoPasso}
            ref={tituloDoPassoRef}
            tabIndex={-1}
            className="importar-colaboradores__titulo-passo"
          >
            Resultado
          </h2>
          <p className="importar-colaboradores__texto">{resumoDoResultado}</p>
          {interrupcao ? (
            <p className="importar-colaboradores__erro" role="alert">
              {interrupcao}
            </p>
          ) : null}
          {enviando ? (
            <div className="importar-colaboradores__progresso">
              <progress
                max={progresso.total}
                value={progresso.feitas}
                aria-label="Progresso da importação"
              />
              <p role="status">
                Importando {Math.min(progresso.feitas + 1, progresso.total)} de{" "}
                {progresso.total}…
              </p>
            </div>
          ) : null}
          {pendentes.length > 0 ? (
            <div className="importar-colaboradores__tabela-rolagem">
              <table className="importar-colaboradores__tabela">
                <caption>Não entraram</caption>
                <thead>
                  <tr>
                    <th scope="col">Linha</th>
                    <th scope="col">Nome</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((linha) => {
                    const envio = envios.get(linha.numero);
                    return (
                      <tr key={linha.numero}>
                        <td>{linha.numero}</td>
                        <td>{linha.admissao.nome}</td>
                        <td>{envio ? ROTULO_DO_ESTADO[envio.estado] : "—"}</td>
                        <td>{envio?.motivo ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="importar-colaboradores__acoes">
            {pendentes.length > 0 ? (
              <Button
                variant="primary"
                onClick={() => void enviar(pendentes)}
                disabled={enviando}
              >
                Tentar de novo as que não entraram ({pendentes.length})
              </Button>
            ) : null}
            {pendentes.length > 0 || comErro.length > 0 ? (
              <Button
                variant="secondary"
                onClick={baixarRelatorio}
                disabled={enviando}
              >
                Baixar relatório de erros
              </Button>
            ) : null}
            <Button variant="secondary" onClick={recomecar} disabled={enviando}>
              Importar outra planilha
            </Button>
            <Button variant="secondary" onClick={sair} disabled={enviando}>
              Ver colaboradores
            </Button>
          </div>
        </Surface>
      ) : null}

      <Dialog
        aberto={confirmando}
        titulo={`${rotuloImportar}?`}
        descricao={`Cada linha pronta vira uma admissão em ${empresa?.nome ?? "empresa ativa"}, como no cadastro individual.`}
        onFechar={() => setConfirmando(false)}
        rodape={
          <>
            <Button variant="secondary" onClick={() => setConfirmando(false)}>
              Voltar
            </Button>
            <Button variant="primary" onClick={() => void enviar(prontas)}>
              Confirmar importação
            </Button>
          </>
        }
      >
        <p className="importar-colaboradores__texto">
          A importação não é desfeita por aqui: correções depois seguem pela
          ficha e pelo Histórico funcional. Linhas com erro não são enviadas.
        </p>
      </Dialog>
    </div>
  );
}

function TabelaDeErros({
  linhas,
}: {
  readonly linhas: readonly LinhaConferida[];
}) {
  return (
    <div className="importar-colaboradores__tabela-rolagem">
      <table className="importar-colaboradores__tabela">
        <caption>Linhas com erro</caption>
        <thead>
          <tr>
            <th scope="col">Linha</th>
            <th scope="col">Campo</th>
            <th scope="col">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {linhas.flatMap((linha) =>
            linha.erros.map((erro, i) => (
              <tr key={`${linha.numero}-${i}`}>
                <td>{linha.numero}</td>
                <td>{erro.campo}</td>
                <td>{erro.motivo}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function TabelaDeProntas({
  linhas,
}: {
  readonly linhas: readonly LinhaPronta[];
}) {
  return (
    <div className="importar-colaboradores__tabela-rolagem">
      <table className="importar-colaboradores__tabela">
        <caption>Prontas para importar</caption>
        <thead>
          <tr>
            <th scope="col">Linha</th>
            <th scope="col">Nome</th>
            <th scope="col">Tipo</th>
            <th scope="col">Admissão</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.numero}>
              <td>{linha.numero}</td>
              <td>{linha.admissao.nome}</td>
              <td>{ROTULO_TIPO_DE_VINCULO[linha.admissao.tipo]}</td>
              <td>{formatarDiaCivil(linha.admissao.dataAdmissao)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
