/**
 * T215 — aba Férias e ausências da ficha do colaborador, no desenho da
 * referência:
 *
 * - **Saldo de férias:** pela regra do vínculo — calculada (CLT e Estágio:
 *   disponíveis, período aquisitivo, direito, usados, prazo e situação, e os
 *   demais períodos), sem férias (PJ e Freelancer) ou sem regra automática
 *   (Aprendiz e os tipos ainda não decididos);
 * - **Próxima ausência:** a data num calendário, tipo, período e status;
 * - **Histórico de ausências:** por ano, do mais novo, com tipo, datas, dias,
 *   dias úteis, status e o anexo (atestado ou documento), e as ações que a
 *   permissão e o status deixam: aprovar, recusar, cancelar, anexar, baixar
 *   e remover o anexo.
 *
 * Os números vêm do servidor. Quem não edita (RH e DP editam) só lê e baixa.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  consultarFeriasDoColaborador,
  type FeriasDoColaboradorApi,
  type PeriodoAquisitivoApi,
} from "../../../../api/ausenciasClient";
import { ApiError } from "../../../../api/colaboradoresClient";
import { Button, FormActions, StatusBadge } from "../../../../components";
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../ui";
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import {
  IconeBaixarArquivo,
  IconeCalendario,
  IconeEditar,
  IconeMaisAcoes,
  IconeRemover,
  IconeRegistrarAusencia,
  IconeTempo,
} from "../../../../ui/icones";
import {
  anoDoDiaCivil,
  diaCivilDeHoje,
  diaEMesAbreviado,
  formatarDiaCivil,
} from "../../../../format/data";
import { baixarArquivo } from "../../../dashboard/exportacao";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../../edicao/dadosProfissionais";
import { VARIANTE_DO_STATUS } from "../../ferias/FeriasEAusenciasAba";
import {
  FORMATOS_DO_ANEXO,
  RegistrarAusenciaGaveta,
  motivoDoAnexo,
  recusaDoArquivo,
  tamanhoLegivel,
} from "../../ferias/RegistrarAusenciaGaveta";
import {
  type AusenciaApi,
  type PessoaParaAusencia,
  type ServicoDeAusencias,
  type StatusAusencia,
  MOTIVOS_DE_AFASTAMENTO,
  ROTULO_DO_STATUS,
  ROTULO_DO_TIPO,
  TIPO_NA_FRASE,
  type TipoAusencia,
} from "../../ferias/tiposAusencia";
import { COR_DO_TIPO, ICONE_DO_TIPO } from "../../ferias/aparenciaDoTipo";
import {
  AvisoAnimado,
  Esqueleto,
  NumeroSuave,
  Revelar,
  ehAvisoDeFalha,
} from "../../../../ui/movimento";
import "./AbaFeriasEAusencias.css";

interface Props {
  readonly pessoa: PessoaParaAusencia;
  /** "a Ana", "o João", "Sam" — o trato da ficha. */
  readonly quem: string;
  /** "da Ana", "do João", "de Sam". */
  readonly deQuem: string;
  /** RH e DP: registrar, decidir e anexar. */
  readonly podeEditar: boolean;
  readonly servico: ServicoDeAusencias;
  readonly consultar?: (
    colaboradorId: string,
  ) => Promise<FeriasDoColaboradorApi>;
  /** Dia civil de hoje; padrão, o de São Paulo. */
  readonly hoje?: string;
}

/** O que já foi lido, por função de leitura e pessoa (cada dublê, o seu). */
const memorias = new WeakMap<object, Map<string, FeriasDoColaboradorApi>>();
function memoriaDe(consultar: object): Map<string, FeriasDoColaboradorApi> {
  let m = memorias.get(consultar);
  if (!m) {
    m = new Map();
    memorias.set(consultar, m);
  }
  return m;
}

type Carga =
  | { estado: "carregando" }
  | { estado: "erro"; status: number | null }
  | { estado: "pronto"; dados: FeriasDoColaboradorApi };

type Janela =
  | { tipo: "excluir"; ausencia: AusenciaApi }
  | { tipo: "recusar"; ausencia: AusenciaApi }
  | { tipo: "cancelar"; ausencia: AusenciaApi }
  | { tipo: "remover-anexo"; ausencia: AusenciaApi }
  | null;

const ROTULO_DA_SITUACAO: Readonly<
  Record<PeriodoAquisitivoApi["situacao"], string>
> = {
  em_aquisicao: "Em aquisição",
  disponivel: "Disponível",
  vencido: "Vencido",
};

const VARIANTE_DA_SITUACAO = {
  em_aquisicao: "info",
  disponivel: "success",
  vencido: "danger",
} as const;

/** As ações de decisão que cada status permite. */
function decisoesDoStatus(
  status: StatusAusencia,
): readonly ("aprovar" | "recusar" | "cancelar")[] {
  switch (status) {
    case "aguardando_rh":
    case "aguardando_gestor":
    case "ajuste_sugerido":
      return ["aprovar", "recusar", "cancelar"];
    case "cancelamento_pedido":
    case "aprovada":
      return ["cancelar"];
    default:
      return [];
  }
}

const ENCERRADAS: ReadonlySet<StatusAusencia> = new Set([
  "cancelada",
  "recusada",
]);

function dias(n: number): string {
  return n === 1 ? "1 dia" : `${n} dias`;
}

/** "As férias … serão removidas", "O day off … será removido". */
const EXCLUSAO_NA_FRASE: Readonly<
  Record<TipoAusencia, { readonly artigo: string; readonly verbo: string }>
> = {
  ferias: { artigo: "As", verbo: "serão removidas" },
  licenca_medica: { artigo: "A", verbo: "será removida" },
  licenca_maternidade: { artigo: "A", verbo: "será removida" },
  licenca_paternidade: { artigo: "A", verbo: "será removida" },
  afastamento: { artigo: "O", verbo: "será removido" },
  falta_justificada: { artigo: "A", verbo: "será removida" },
  falta_sem_justificativa: { artigo: "A", verbo: "será removida" },
  day_off: { artigo: "O", verbo: "será removido" },
  home_office: { artigo: "O", verbo: "será removido" },
};

function textoDaExclusao(a: AusenciaApi, nome: string): string {
  const { artigo, verbo } = EXCLUSAO_NA_FRASE[a.tipo];
  return `${artigo} ${TIPO_NA_FRASE[a.tipo]} de ${nome} (${datas(a)}) ${verbo} do histórico e do calendário. Essa ação não pode ser desfeita.`;
}

function diasUteis(n: number | null): string {
  if (n === null) return "";
  return n === 1 ? "1 dia útil" : `${n} dias úteis`;
}

/** O ponto com a cor do tipo, ao lado do nome (a cor não é o único sinal). */
function PontoDoTipo({ a }: { readonly a: AusenciaApi }) {
  return (
    <span
      className="ferias-ficha__ponto"
      style={{ background: COR_DO_TIPO[a.tipo] }}
      aria-hidden="true"
    />
  );
}

function datas(a: AusenciaApi): string {
  if (!a.fim) return `Desde ${formatarDiaCivil(a.inicio)}`;
  return a.inicio === a.fim
    ? formatarDiaCivil(a.inicio)
    : `${formatarDiaCivil(a.inicio)} a ${formatarDiaCivil(a.fim)}`;
}

function rotuloDoTipo(a: AusenciaApi): string {
  if (a.tipo !== "afastamento" || !a.motivoAfastamento) {
    return ROTULO_DO_TIPO[a.tipo];
  }
  const motivo = MOTIVOS_DE_AFASTAMENTO.find(
    (m) => m.valor === a.motivoAfastamento,
  );
  return motivo ? `Afastamento · ${motivo.rotulo}` : ROTULO_DO_TIPO[a.tipo];
}

/** Dias corridos entre dois dias civis (b − a). */
function diasAte(de: string, ate: string): number {
  const t = (d: string) =>
    Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((t(ate) - t(de)) / 86_400_000);
}

export function AbaFeriasEAusencias({
  pessoa,
  quem,
  deQuem,
  podeEditar,
  servico,
  consultar = consultarFeriasDoColaborador,
  hoje: hojeInformado,
}: Props) {
  const hoje = hojeInformado ?? diaCivilDeHoje();
  // Voltar à aba mostra na hora o que já foi lido, e atualiza em silêncio.
  const [carga, setCargaInterna] = useState<Carga>(() => {
    const lido = memoriaDe(consultar).get(pessoa.id);
    return lido ? { estado: "pronto", dados: lido } : { estado: "carregando" };
  });
  const setCarga = useCallback(
    (nova: Carga) => {
      if (nova.estado === "pronto") {
        memoriaDe(consultar).set(pessoa.id, nova.dados);
      }
      setCargaInterna(nova);
    },
    [consultar, pessoa.id],
  );
  const [gaveta, setGaveta] = useState(false);
  // "Agendar férias" abre a mesma janela já em Férias.
  const [agendarFerias, setAgendarFerias] = useState(false);
  const [editando, setEditando] = useState<AusenciaApi | null>(null);
  const [janela, setJanela] = useState<Janela>(null);
  const [motivo, setMotivo] = useState("");
  const [trabalhando, setTrabalhando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [anexandoEm, setAnexandoEm] = useState<AusenciaApi | null>(null);
  const campoArquivo = useRef<HTMLInputElement | null>(null);

  const carregar = useCallback(
    (silencioso = false) => {
      if (!silencioso && !memoriaDe(consultar).has(pessoa.id)) {
        setCarga({ estado: "carregando" });
      }
      consultar(pessoa.id).then(
        (dados) => setCarga({ estado: "pronto", dados }),
        (erro: unknown) =>
          setCarga({
            estado: "erro",
            status: erro instanceof ApiError ? erro.status : null,
          }),
      );
    },
    [consultar, pessoa.id, setCarga],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function executar(
    acao: () => Promise<unknown>,
    sucesso: string,
    falha: string,
  ) {
    setTrabalhando(true);
    setAviso("");
    try {
      await acao();
      setAviso(sucesso);
      setJanela(null);
      carregar(true);
    } catch (erro) {
      setAviso(falha.replace("{motivo}", motivoDoAnexo(erro)));
    } finally {
      setTrabalhando(false);
    }
  }

  function pedirArquivo(a: AusenciaApi) {
    setAnexandoEm(a);
    campoArquivo.current?.click();
  }

  async function anexar(arquivo: File) {
    const alvo = anexandoEm;
    if (!alvo || !servico.enviarAnexo) return;
    const recusa = recusaDoArquivo(arquivo);
    if (recusa) {
      setAviso(`O anexo não foi enviado: ${recusa}`);
      return;
    }
    await executar(
      () => servico.enviarAnexo!(alvo.id, arquivo),
      "Anexo enviado.",
      "O anexo não foi enviado: {motivo}.",
    );
  }

  async function baixar(a: AusenciaApi) {
    if (!servico.baixarAnexo) return;
    setAviso("");
    try {
      const { blob, nome } = await servico.baixarAnexo(a.id);
      baixarArquivo(blob, nome, blob.type || "application/octet-stream");
    } catch {
      setAviso("Não foi possível baixar o anexo. Tente de novo.");
    }
  }

  if (carga.estado === "carregando") {
    return <Esqueleto rotulo="Carregando férias e ausências…" linhas={5} />;
  }
  if (carga.estado === "erro") {
    return (
      <div className="ferias-ficha__aviso" role="alert">
        <p>
          {carga.status === 403
            ? "Você não tem permissão para ver as férias e ausências."
            : "Não foi possível carregar as férias e ausências."}
        </p>
        {carga.status !== 403 ? (
          <Button type="button" variant="secondary" onClick={() => carregar()}>
            Tentar de novo
          </Button>
        ) : null}
      </div>
    );
  }

  const { dados } = carga;
  const tipoDoVinculo =
    ROTULO_DO_TIPO_DE_VINCULO[
      dados.vinculo.tipo as keyof typeof ROTULO_DO_TIPO_DE_VINCULO
    ] ?? dados.vinculo.tipo;

  return (
    <Revelar>
      <div className="ferias-ficha">
        <div className="ferias-ficha__topo">
          <Saldo
            dados={dados}
            tipoDoVinculo={tipoDoVinculo}
            hoje={hoje}
            podeAgendar={podeEditar}
            onAgendar={() => {
              setAgendarFerias(true);
              setGaveta(true);
            }}
          />
          <ProximaAusencia dados={dados} hoje={hoje} quem={quem} />
        </div>

        <Historico
          dados={dados}
          deQuem={deQuem}
          podeEditar={podeEditar}
          servico={servico}
          onRegistrar={() => {
            setAgendarFerias(false);
            setGaveta(true);
          }}
          onAprovar={(a) =>
            void executar(
              () => servico.aprovar(a.id),
              "Ausência aprovada.",
              "Não foi possível aprovar. Tente de novo.",
            )
          }
          onRecusar={(a) => {
            setMotivo("");
            setJanela({ tipo: "recusar", ausencia: a });
          }}
          onCancelar={(a) => setJanela({ tipo: "cancelar", ausencia: a })}
          onEditar={(a) => setEditando(a)}
          onExcluir={(a) => setJanela({ tipo: "excluir", ausencia: a })}
          onAnexar={pedirArquivo}
          onBaixar={(a) => void baixar(a)}
          onRemoverAnexo={(a) =>
            setJanela({ tipo: "remover-anexo", ausencia: a })
          }
        />

        <input
          ref={campoArquivo}
          type="file"
          hidden
          accept={FORMATOS_DO_ANEXO}
          aria-label="Arquivo do anexo da ausência"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo) void anexar(arquivo);
          }}
        />

        <AvisoAnimado
          className="ferias-ficha__status"
          mensagem={aviso}
          tipo={ehAvisoDeFalha(aviso) ? "neutro" : "sucesso"}
        />

        <RegistrarAusenciaGaveta
          aberta={gaveta}
          servico={servico}
          pessoaInicial={pessoa}
          {...(agendarFerias ? { tipoInicial: "ferias" as const } : {})}
          regraDeFerias={dados.regraDeFerias}
          onFechar={() => setGaveta(false)}
          onRegistrada={(_nova, avisoDoAnexo) => {
            setGaveta(false);
            setAviso(avisoDoAnexo ?? "Ausência registrada.");
            carregar(true);
          }}
        />

        <RegistrarAusenciaGaveta
          aberta={editando !== null}
          editando={editando}
          servico={servico}
          regraDeFerias={dados.regraDeFerias}
          onFechar={() => setEditando(null)}
          onRegistrada={() => undefined}
          onAlterada={(_alterada, avisoDoAnexo) => {
            setEditando(null);
            setAviso(avisoDoAnexo ?? "Ausência alterada.");
            carregar(true);
          }}
        />

        <Dialog
          aberto={janela?.tipo === "excluir"}
          titulo="Excluir esta ausência?"
          icone={<IconeRemover tamanho={20} />}
          descricao={
            janela?.tipo === "excluir"
              ? textoDaExclusao(janela.ausencia, pessoa.nome)
              : ""
          }
          onFechar={() => setJanela(null)}
          bloqueado={trabalhando}
          rodape={
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setJanela(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="ficha-ref__botao-perigo"
                disabled={trabalhando}
                onClick={() => {
                  const alvo = janela?.ausencia;
                  if (!alvo || !servico.excluir) return;
                  void executar(
                    () => servico.excluir!(alvo.id),
                    "Ausência excluída.",
                    "Não foi possível excluir. Tente de novo.",
                  );
                }}
              >
                Excluir
              </Button>
            </FormActions>
          }
        >
          {null}
        </Dialog>

        <Dialog
          aberto={janela?.tipo === "recusar"}
          titulo="Recusar ausência?"
          descricao={
            janela
              ? `${rotuloDoTipo(janela.ausencia)} de ${datas(janela.ausencia)} fica recusada e sai do calendário.`
              : ""
          }
          onFechar={() => setJanela(null)}
          bloqueado={trabalhando}
          rodape={
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setJanela(null)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="ficha-ref__botao-perigo"
                disabled={trabalhando}
                onClick={() => {
                  const alvo = janela?.ausencia;
                  if (!alvo) return;
                  void executar(
                    () => servico.recusar(alvo.id, motivo.trim() || undefined),
                    "Ausência recusada.",
                    "Não foi possível recusar. Tente de novo.",
                  );
                }}
              >
                Recusar
              </Button>
            </FormActions>
          }
        >
          <label className="ferias-ficha__campo">
            <span>Motivo (opcional)</span>
            <textarea
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
        </Dialog>

        <Dialog
          aberto={janela?.tipo === "cancelar"}
          titulo="Cancelar ausência?"
          descricao={
            janela
              ? `${rotuloDoTipo(janela.ausencia)} de ${datas(janela.ausencia)} fica cancelada. O registro continua no histórico.`
              : ""
          }
          onFechar={() => setJanela(null)}
          bloqueado={trabalhando}
          rodape={
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setJanela(null)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="ficha-ref__botao-perigo"
                disabled={trabalhando}
                onClick={() => {
                  const alvo = janela?.ausencia;
                  if (!alvo) return;
                  void executar(
                    () => servico.cancelar(alvo.id),
                    "Ausência cancelada.",
                    "Não foi possível cancelar. Tente de novo.",
                  );
                }}
              >
                Cancelar ausência
              </Button>
            </FormActions>
          }
        >
          <p className="ficha-ref__janela-texto">
            Se ainda descontava do saldo de férias, os dias voltam ao saldo.
          </p>
        </Dialog>

        <Dialog
          aberto={janela?.tipo === "remover-anexo"}
          titulo="Remover o anexo?"
          descricao="O arquivo sai do histórico desta ausência. O registro da remoção fica na trilha de auditoria."
          onFechar={() => setJanela(null)}
          bloqueado={trabalhando}
          rodape={
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setJanela(null)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="ficha-ref__botao-perigo"
                disabled={trabalhando}
                onClick={() => {
                  const alvo = janela?.ausencia;
                  if (!alvo || !servico.removerAnexo) return;
                  void executar(
                    () => servico.removerAnexo!(alvo.id),
                    "Anexo removido.",
                    "Não foi possível remover o anexo. Tente de novo.",
                  );
                }}
              >
                Remover
              </Button>
            </FormActions>
          }
        >
          <p className="ficha-ref__janela-texto">
            Depois, dá para anexar outro arquivo.
          </p>
        </Dialog>
      </div>
    </Revelar>
  );
}

function Cartao({
  titulo,
  subtitulo,
  icone,
  acao,
  className,
  children,
}: {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly icone: ReactNode;
  readonly acao?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      className={`ficha-ref__cartao ${className ?? ""}`}
      aria-labelledby={id}
    >
      <header className="ficha-ref__cartao-cabeca">
        <span className="ficha-ref__cartao-icone" aria-hidden="true">
          {icone}
        </span>
        <span className="ficha-ref__cartao-textos">
          <h3 id={id} className="ficha-ref__cartao-titulo">
            {titulo}
          </h3>
          <span className="ficha-ref__cartao-subtitulo">{subtitulo}</span>
        </span>
        {acao}
      </header>
      {children}
    </section>
  );
}

/** "Vence hoje", "Vence em 16 dias", "Vence em 1 mês", "Vence em 6 meses". */
function textoDoVencimento(hoje: string, prazo: string): string {
  const faltam = diasAte(hoje, prazo);
  if (faltam <= 0) return "Vence hoje";
  const [a1, m1, d1] = hoje.split("-").map(Number) as [number, number, number];
  const [a2, m2, d2] = prazo.split("-").map(Number) as [number, number, number];
  const meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (meses >= 1) return `Vence em ${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `Vence em ${faltam} ${faltam === 1 ? "dia" : "dias"}`;
}

/** O dia seguinte (o direito começa quando o período aquisitivo termina). */
function diaSeguinte(dia: string): string {
  const t = new Date(
    Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10) + 1),
  );
  return t.toISOString().slice(0, 10);
}

/**
 * Como a referência (2026-11-26): o subtítulo diz o período; em aquisição,
 * só quando começa o direito (sem número nem etiqueta); com dias, o número,
 * quando vence, Direito/Solicitados/Disponíveis, um quadradinho por dia e
 * "Agendar férias".
 */
function Saldo({
  dados,
  tipoDoVinculo,
  hoje,
  podeAgendar,
  onAgendar,
}: {
  readonly dados: FeriasDoColaboradorApi;
  readonly tipoDoVinculo: string;
  readonly hoje: string;
  readonly podeAgendar: boolean;
  readonly onAgendar: () => void;
}) {
  const indiceAtual = dados.periodoAtual;
  const atual = indiceAtual !== null ? dados.periodos[indiceAtual] : undefined;
  const calculada = dados.regraDeFerias === "calculada" && atual !== undefined;
  const emAquisicao = atual?.situacao === "em_aquisicao";
  const primeiro = indiceAtual === 0;
  // Os demais períodos com algo a dizer (o em aquisição fica de fora).
  const outros = dados.periodos.filter(
    (p) => p !== atual && p.situacao !== "em_aquisicao",
  );

  const subtitulo = !calculada
    ? "Controle de saldo para contratos CLT e Estágio"
    : emAquisicao
      ? primeiro
        ? "Primeiro período aquisitivo em andamento"
        : "Período aquisitivo em andamento"
      : `Período aquisitivo ${formatarDiaCivil(atual.inicio)} – ${formatarDiaCivil(atual.fim)}`;

  return (
    <Cartao
      titulo="Saldo de férias"
      subtitulo={subtitulo}
      icone={<IconeCalendario tamanho={18} />}
      className="ferias-ficha__saldo"
    >
      <div className="ferias-ficha__corpo">
        {dados.regraDeFerias !== "calculada" ? (
          <>
            <p className="ferias-ficha__forte">
              {dados.regraDeFerias === "sem_ferias"
                ? `Contrato ${tipoDoVinculo}: não tem férias.`
                : `Contrato ${tipoDoVinculo}: o saldo de férias não é calculado.`}
            </p>
            <p className="ferias-ficha__suave">
              Ausências, folgas e day offs continuam sendo registrados
              normalmente.
            </p>
          </>
        ) : !atual ? (
          <>
            <p className="ferias-ficha__forte">Ainda sem período aquisitivo.</p>
            <p className="ferias-ficha__suave">
              {`O primeiro período começa na admissão, em ${formatarDiaCivil(dados.vinculo.dataAdmissao)}.`}
            </p>
          </>
        ) : emAquisicao ? (
          <>
            <p className="ferias-ficha__forte">
              {`O direito às ${primeiro ? "primeiras" : "próximas"} férias começa em ${formatarDiaCivil(diaSeguinte(atual.fim))}.`}
            </p>
            <p className="ferias-ficha__suave">
              Ausências, folgas e day offs continuam sendo registrados
              normalmente.
            </p>
          </>
        ) : (
          <>
            <div className="ferias-ficha__saldo-linha">
              <div className="ferias-ficha__saldo-principal">
                <p className="ferias-ficha__saldo-valor">
                  <span className="ferias-ficha__saldo-numero">
                    <NumeroSuave valor={atual.disponiveis} />
                  </span>
                  <span className="ferias-ficha__saldo-rotulo">
                    dias disponíveis
                  </span>
                </p>
                <p className="ferias-ficha__prazo">
                  {atual.situacao === "vencido" ? (
                    <StatusBadge variant="danger">Vencido</StatusBadge>
                  ) : (
                    <StatusBadge
                      variant={
                        // Perto do prazo, atenção; o "×" fica para Vencido.
                        diasAte(hoje, atual.prazoGozo) <= 90
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {textoDoVencimento(hoje, atual.prazoGozo)}
                    </StatusBadge>
                  )}
                  <span className="ferias-ficha__suave">
                    {`prazo para gozo: ${formatarDiaCivil(atual.prazoGozo)}`}
                  </span>
                </p>
              </div>
              <dl className="ferias-ficha__detalhes">
                <div>
                  <dt>Direito</dt>
                  <dd>{dias(atual.direito)}</dd>
                </div>
                <div>
                  <dt>Solicitados</dt>
                  <dd>{dias(atual.solicitados)}</dd>
                </div>
                <div>
                  <dt>Disponíveis</dt>
                  <dd className="ferias-ficha__destaque">
                    {dias(atual.disponiveis)}
                  </dd>
                </div>
              </dl>
            </div>
            <span className="ferias-ficha__dias" aria-hidden="true">
              {Array.from({ length: atual.direito }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < atual.solicitados
                      ? "ferias-ficha__dia ferias-ficha__dia--solicitado"
                      : "ferias-ficha__dia"
                  }
                />
              ))}
            </span>
            <div className="ferias-ficha__legenda">
              {atual.solicitados > 0 ? (
                <span className="ferias-ficha__legenda-item">
                  <span
                    className="ferias-ficha__amostra ferias-ficha__amostra--solicitado"
                    aria-hidden="true"
                  />
                  Solicitados
                </span>
              ) : null}
              <span className="ferias-ficha__legenda-item">
                <span className="ferias-ficha__amostra" aria-hidden="true" />
                Disponíveis para agendar
              </span>
              {podeAgendar && atual.disponiveis > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="ferias-ficha__agendar"
                  onClick={onAgendar}
                >
                  <IconeCalendario tamanho={16} />
                  Agendar férias
                </Button>
              ) : null}
            </div>
            {outros.length > 0 ? (
              <ul
                className="ferias-ficha__periodos"
                aria-label="Outros períodos"
              >
                {outros.map((p) => (
                  <li key={p.inicio} className="ferias-ficha__periodo">
                    <span>{`${formatarDiaCivil(p.inicio)} – ${formatarDiaCivil(p.fim)}`}</span>
                    <span className="ferias-ficha__suave">
                      {`${dias(p.disponiveis)} de ${p.direito}`}
                    </span>
                    <StatusBadge variant={VARIANTE_DA_SITUACAO[p.situacao]}>
                      {ROTULO_DA_SITUACAO[p.situacao]}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </Cartao>
  );
}

function ProximaAusencia({
  dados,
  hoje,
  quem,
}: {
  readonly dados: FeriasDoColaboradorApi;
  readonly hoje: string;
  readonly quem: string;
}) {
  const a = dados.proximaAusencia;
  const faltam = a ? diasAte(hoje, a.inicio) : null;
  const data = a ? diaEMesAbreviado(a.inicio) : null;
  return (
    <Cartao
      titulo="Próxima ausência"
      subtitulo={a ? ROTULO_DO_STATUS[a.status] : "Nada agendado por enquanto"}
      icone={<IconeTempo tamanho={18} />}
      className="ferias-ficha__proxima"
    >
      <div className="ferias-ficha__corpo ferias-ficha__proxima-corpo">
        <span
          className="ferias-ficha__calendario"
          aria-hidden={!a}
          title={
            faltam === null
              ? undefined
              : faltam <= 0
                ? "Hoje"
                : faltam === 1
                  ? "Amanhã"
                  : `Em ${faltam} dias`
          }
        >
          <span className="ferias-ficha__calendario-mes">
            {data ? data.mes : "— —"}
          </span>
          <span className="ferias-ficha__calendario-dia">
            {data ? data.dia : "?"}
          </span>
        </span>
        {a ? (
          <span className="ferias-ficha__proxima-textos">
            <span className="ferias-ficha__forte ferias-ficha__com-ponto">
              <PontoDoTipo a={a} />
              {rotuloDoTipo(a)}
            </span>
            <span className="ferias-ficha__suave">{datas(a)}</span>
            {a.dias !== null ? (
              <span className="ferias-ficha__suave">
                {diasUteis(a.diasUteis)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="ferias-ficha__proxima-textos ferias-ficha__centro">
            <span className="ferias-ficha__forte">
              Nenhuma ausência agendada
            </span>
            <span className="ferias-ficha__suave">
              {`Quando ${quem} solicitar férias ou day off, a solicitação aparece aqui para você aprovar.`}
            </span>
          </span>
        )}
      </div>
    </Cartao>
  );
}

function Historico({
  dados,
  deQuem,
  podeEditar,
  servico,
  onRegistrar,
  onAprovar,
  onRecusar,
  onCancelar,
  onEditar,
  onExcluir,
  onAnexar,
  onBaixar,
  onRemoverAnexo,
}: {
  readonly dados: FeriasDoColaboradorApi;
  readonly deQuem: string;
  readonly podeEditar: boolean;
  readonly servico: ServicoDeAusencias;
  readonly onRegistrar: () => void;
  readonly onAprovar: (a: AusenciaApi) => void;
  readonly onRecusar: (a: AusenciaApi) => void;
  readonly onCancelar: (a: AusenciaApi) => void;
  readonly onEditar: (a: AusenciaApi) => void;
  readonly onExcluir: (a: AusenciaApi) => void;
  readonly onAnexar: (a: AusenciaApi) => void;
  readonly onBaixar: (a: AusenciaApi) => void;
  readonly onRemoverAnexo: (a: AusenciaApi) => void;
}) {
  const itens = [...dados.historico].sort((x, y) =>
    x.inicio < y.inicio ? 1 : x.inicio > y.inicio ? -1 : 0,
  );
  const anos: { ano: string; itens: AusenciaApi[] }[] = [];
  for (const a of itens) {
    const ano = anoDoDiaCivil(a.inicio) ?? "—";
    const grupo = anos.find((g) => g.ano === ano);
    if (grupo) grupo.itens.push(a);
    else anos.push({ ano, itens: [a] });
  }
  const botaoRegistrar = podeEditar ? (
    <button type="button" className="ficha-ref__editar" onClick={onRegistrar}>
      <IconeRegistrarAusencia tamanho={16} />
      Registrar ausência
    </button>
  ) : null;
  const registros = (n: number) => (n === 1 ? "1 registro" : `${n} registros`);
  const proximaId = dados.proximaAusencia?.id ?? null;

  return (
    <Cartao
      titulo="Histórico de ausências"
      subtitulo={
        itens.length === 0
          ? "Nenhum registro até agora"
          : `${registros(itens.length)} · férias, licenças, faltas e day offs`
      }
      icone={<IconeCalendario tamanho={18} />}
      {...(itens.length > 0 && botaoRegistrar ? { acao: botaoRegistrar } : {})}
      className="ferias-ficha__historico"
    >
      {itens.length === 0 ? (
        <div className="ferias-ficha__vazio">
          <span className="ficha-ref__cartao-icone" aria-hidden="true">
            <IconeCalendario tamanho={18} />
          </span>
          <p className="ferias-ficha__forte">Nenhuma ausência registrada</p>
          <p className="ferias-ficha__suave">
            {`Férias, licenças, faltas e day offs ${deQuem} vão aparecer aqui, organizados por ano.`}
          </p>
          {podeEditar ? (
            <Button type="button" onClick={onRegistrar}>
              Registrar ausência
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="ferias-ficha__anos">
          {anos.map((grupo) => (
            <section key={grupo.ano} className="ferias-ficha__ano">
              <div className="ferias-ficha__ano-cabeca">
                <h4 className="ferias-ficha__ano-titulo">{grupo.ano}</h4>
                <span className="ferias-ficha__ano-linha" aria-hidden="true" />
                <span className="ferias-ficha__ano-total">
                  {registros(grupo.itens.length)}
                </span>
              </div>
              <ul className="ferias-ficha__lista">
                {grupo.itens.map((a) => (
                  <LinhaDoHistorico
                    key={a.id}
                    a={a}
                    proxima={a.id === proximaId}
                    podeEditar={podeEditar}
                    servico={servico}
                    onAprovar={onAprovar}
                    onRecusar={onRecusar}
                    onCancelar={onCancelar}
                    onEditar={onEditar}
                    onExcluir={onExcluir}
                    onAnexar={onAnexar}
                    onBaixar={onBaixar}
                    onRemoverAnexo={onRemoverAnexo}
                  />
                ))}
              </ul>
            </section>
          ))}
          <p className="ferias-ficha__nota">
            Dias úteis: de segunda a sexta, sem os feriados nacionais de data
            fixa. Feriados móveis (como Carnaval e Corpus Christi), estaduais e
            municipais ainda não entram no cálculo.
          </p>
        </div>
      )}
    </Cartao>
  );
}

function LinhaDoHistorico({
  a,
  proxima,
  podeEditar,
  servico,
  onAprovar,
  onRecusar,
  onCancelar,
  onEditar,
  onExcluir,
  onAnexar,
  onBaixar,
  onRemoverAnexo,
}: {
  readonly a: AusenciaApi;
  /** É a próxima ausência (destaque e "Próxima ausência" na linha). */
  readonly proxima: boolean;
  readonly podeEditar: boolean;
  readonly servico: ServicoDeAusencias;
  readonly onAprovar: (a: AusenciaApi) => void;
  readonly onRecusar: (a: AusenciaApi) => void;
  readonly onCancelar: (a: AusenciaApi) => void;
  readonly onEditar: (a: AusenciaApi) => void;
  readonly onExcluir: (a: AusenciaApi) => void;
  readonly onAnexar: (a: AusenciaApi) => void;
  readonly onBaixar: (a: AusenciaApi) => void;
  readonly onRemoverAnexo: (a: AusenciaApi) => void;
}) {
  const Icone = ICONE_DO_TIPO[a.tipo];
  // Como a referência: Editar e Excluir em toda linha (editar, só a que
  // ainda vale; cancelada e recusada só saem).
  const podeAlterar =
    !ENCERRADAS.has(a.status) && servico.alterar !== undefined;
  const podeExcluir = servico.excluir !== undefined;
  const decisoes = decisoesDoStatus(a.status);
  const podeAnexar =
    !a.anexo && !ENCERRADAS.has(a.status) && servico.enviarAnexo !== undefined;
  const podeRemover = Boolean(a.anexo) && servico.removerAnexo !== undefined;
  const temAcoes =
    podeEditar &&
    (podeAlterar ||
      podeExcluir ||
      decisoes.length > 0 ||
      podeAnexar ||
      podeRemover);
  const nomeDaLinha = `${ROTULO_DO_TIPO[a.tipo]} de ${formatarDiaCivil(a.inicio)}`;
  return (
    <li className="ferias-ficha__item">
      <span
        className={
          proxima
            ? "ferias-ficha__item-icone ferias-ficha__item-icone--proxima"
            : "ferias-ficha__item-icone"
        }
        aria-hidden="true"
      >
        <Icone tamanho={18} />
      </span>
      <span className="ferias-ficha__item-textos">
        <span className="ferias-ficha__forte ferias-ficha__com-ponto">
          <PontoDoTipo a={a} />
          {rotuloDoTipo(a)}
        </span>
        <span className="ferias-ficha__suave">
          {proxima ? "Próxima ausência" : ROTULO_DO_TIPO[a.tipo]}
        </span>
      </span>
      <span className="ferias-ficha__item-dias">
        <span>{datas(a)}</span>
        <span className="ferias-ficha__suave">
          {a.dias !== null ? diasUteis(a.diasUteis) : "Sem data de volta"}
          {a.diasVendidos > 0 ? ` + ${a.diasVendidos} vendidos` : null}
        </span>
      </span>
      <span className="ferias-ficha__item-fim">
        {a.anexo ? (
          <button
            type="button"
            className="ferias-ficha__anexo"
            aria-label={`Baixar anexo de ${nomeDaLinha} (${a.anexo.formato.toUpperCase()}, ${tamanhoLegivel(a.anexo.tamanhoBytes)})`}
            onClick={() => onBaixar(a)}
          >
            <IconeBaixarArquivo tamanho={14} />
            {a.anexo.formato.toUpperCase()}
          </button>
        ) : null}
        <StatusBadge variant={VARIANTE_DO_STATUS[a.status]}>
          {ROTULO_DO_STATUS[a.status]}
        </StatusBadge>
        {temAcoes ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="ficha-ref__mais"
              aria-label={`Ações de ${nomeDaLinha}`}
            >
              <IconeMaisAcoes tamanho={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="ficha-ref__menu">
              {podeAlterar ? (
                <DropdownMenuItem
                  className="ficha-ref__menu-item"
                  onSelect={() => onEditar(a)}
                >
                  <IconeEditar tamanho={18} />
                  Editar
                </DropdownMenuItem>
              ) : null}
              {decisoes.includes("aprovar") ? (
                <DropdownMenuItem
                  className="ficha-ref__menu-item"
                  onSelect={() => onAprovar(a)}
                >
                  Aprovar
                </DropdownMenuItem>
              ) : null}
              {decisoes.includes("recusar") ? (
                <DropdownMenuItem
                  className="ficha-ref__menu-item"
                  onSelect={() => onRecusar(a)}
                >
                  Recusar
                </DropdownMenuItem>
              ) : null}
              {decisoes.includes("cancelar") ? (
                <DropdownMenuItem
                  className="ficha-ref__menu-item"
                  onSelect={() => onCancelar(a)}
                >
                  Cancelar ausência
                </DropdownMenuItem>
              ) : null}
              {podeAnexar ? (
                <DropdownMenuItem
                  className="ficha-ref__menu-item"
                  onSelect={() => onAnexar(a)}
                >
                  Anexar atestado ou documento
                </DropdownMenuItem>
              ) : null}
              {podeRemover ? (
                <DropdownMenuItem
                  className="ficha-ref__menu-item"
                  onSelect={() => onRemoverAnexo(a)}
                >
                  Remover anexo
                </DropdownMenuItem>
              ) : null}
              {podeExcluir ? (
                <>
                  <RadixMenu.Separator className="ficha-ref__menu-divisor" />
                  <DropdownMenuItem
                    className="ficha-ref__menu-item ficha-ref__menu-item--perigo"
                    onSelect={() => onExcluir(a)}
                  >
                    <IconeRemover tamanho={18} />
                    Excluir
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : podeEditar ? (
          // Sem ações nesta linha: o lugar do ⋯ fica, e o status alinha.
          <span className="ficha-ref__mais-vago" aria-hidden="true" />
        ) : null}
      </span>
    </li>
  );
}
