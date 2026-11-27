/**
 * T215 — aba Salários da ficha do colaborador, no desenho da referência:
 *
 * - **Salário atual:** bruto do período vigente, de onde ele veio (admissão
 *   ou reajuste), líquido estimado (INSS e IRRF de 2026, com dependentes e
 *   pensão do contrato), vigente desde e o gráfico do salário no tempo;
 * - **Resumo:** aumento acumulado, média por reajuste, reajustes e tempo no
 *   salário atual;
 * - **Linha do tempo salarial:** os períodos, do mais novo ao mais antigo,
 *   com "Nova alteração", ⋯ Editar/Excluir e "Registrar reajuste".
 *
 * Quem não edita o contrato (`contrato_vinculo`) só lê; vínculo encerrado
 * também (a API recusa gravar depois do desligamento). Reajuste é só a
 * alteração em que o salário sobe; percentuais em centavos inteiros. Gravar
 * devolve a linha do tempo inteira, já reorganizada pelo servidor.
 */
import { Esqueleto, NumeroSuave, Revelar } from "../../../../ui/movimento";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ApiError } from "../../../../api/colaboradoresClient";
import {
  atualizarAlteracaoSalarial,
  consultarHistoricoSalarial,
  registrarAlteracaoSalarial,
  removerAlteracaoSalarial,
} from "../../../../api/salariosClient";
import type {
  AlteracaoSalarialApi,
  GravarAlteracaoSalarialDto,
  HistoricoSalarialApi,
} from "../../../../api/salariosClient";
import { Button, FormActions } from "../../../../components";
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
} from "../../../../ui";
import {
  IconeDinheiro,
  IconeEditar,
  IconeMais,
  IconeMaisAcoes,
  IconePainel,
  IconeRemover,
  IconeTempo,
} from "../../../../ui/icones";
import { diaCivilDeHoje, formatarDiaCivil } from "../../../../format/data";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../../edicao/dadosProfissionais";
import { mascararReais } from "../../NovaAdmissaoScreen";
import {
  calcularSalarioLiquido,
  formatarReais,
  lerValorEmReais,
} from "../../salarioLiquido";
import {
  duracaoDoPeriodo,
  formatarPercentual as percentual,
  idsDeReajuste,
  mesCurto,
  percentualSobreAnterior,
  pontosDoGrafico,
  resumoSalarial,
  tempoCurto,
} from "./resumoSalarial";
import "./AbaSalarios.css";

/** O que já foi lido, por serviço e pessoa (cada dublê de teste tem o seu). */
const memorias = new WeakMap<object, Map<string, HistoricoSalarialApi>>();
function memoriaDe(servico: object): Map<string, HistoricoSalarialApi> {
  let m = memorias.get(servico);
  if (!m) {
    m = new Map();
    memorias.set(servico, m);
  }
  return m;
}

/** As operações da aba (o servidor, ou um dublê nos testes). */
export interface ServicoDeSalarios {
  consultar(colaboradorId: string): Promise<HistoricoSalarialApi>;
  registrar(
    colaboradorId: string,
    dto: GravarAlteracaoSalarialDto,
  ): Promise<HistoricoSalarialApi>;
  atualizar(
    colaboradorId: string,
    alteracaoId: string,
    dto: GravarAlteracaoSalarialDto,
  ): Promise<HistoricoSalarialApi>;
  remover(
    colaboradorId: string,
    alteracaoId: string,
  ): Promise<HistoricoSalarialApi>;
}

export const servicoDeSalariosDoServidor: ServicoDeSalarios = {
  consultar: consultarHistoricoSalarial,
  registrar: registrarAlteracaoSalarial,
  atualizar: atualizarAlteracaoSalarial,
  remover: removerAlteracaoSalarial,
};

interface Props {
  readonly colaboradorId: string;
  /** "da Ana", "do João", "de Sam" — o trato da ficha. */
  readonly deQuem: string;
  readonly podeEditar: boolean;
  /** Cargo vigente (lotação): vem preenchido em "Nova alteração". */
  readonly cargoAtual?: string | null;
  /** Dia civil de hoje (`AAAA-MM-DD`); padrão, o de São Paulo. */
  readonly hoje?: string;
  readonly servico?: ServicoDeSalarios;
}

const VAZIO = "—";

/** "1.621" (sem centavos), para o rótulo do gráfico. */
function reaisInteiros(valor: number): string {
  return Math.round(valor)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type Carga =
  | { estado: "carregando" }
  | { estado: "erro"; status: number | null }
  | { estado: "pronto"; historico: HistoricoSalarialApi };

type Gaveta =
  { modo: "nova" } | { modo: "editar"; alteracao: AlteracaoSalarialApi } | null;

export function AbaSalarios({
  colaboradorId,
  deQuem,
  podeEditar,
  cargoAtual = null,
  hoje: hojeInformado,
  servico = servicoDeSalariosDoServidor,
}: Props) {
  const hoje = hojeInformado ?? diaCivilDeHoje();
  // Voltar à aba mostra na hora o que já foi lido, e atualiza em silêncio.
  const [carga, setCargaInterna] = useState<Carga>(() => {
    const lido = memoriaDe(servico).get(colaboradorId);
    return lido
      ? { estado: "pronto", historico: lido }
      : { estado: "carregando" };
  });
  const setCarga = useCallback(
    (nova: Carga) => {
      if (nova.estado === "pronto") {
        memoriaDe(servico).set(colaboradorId, nova.historico);
      }
      setCargaInterna(nova);
    },
    [servico, colaboradorId],
  );
  const [gaveta, setGaveta] = useState<Gaveta>(null);
  const [excluindo, setExcluindo] = useState<AlteracaoSalarialApi | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [erroAoRemover, setErroAoRemover] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!memoriaDe(servico).has(colaboradorId)) {
      setCarga({ estado: "carregando" });
    }
    servico.consultar(colaboradorId).then(
      (historico) => setCarga({ estado: "pronto", historico }),
      (erro: unknown) =>
        setCarga({
          estado: "erro",
          status: erro instanceof ApiError ? erro.status : null,
        }),
    );
  }, [colaboradorId, servico, setCarga]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir() {
    if (!excluindo) return;
    setRemovendo(true);
    setErroAoRemover(null);
    try {
      const historico = await servico.remover(colaboradorId, excluindo.id);
      setCarga({ estado: "pronto", historico });
      setExcluindo(null);
    } catch (erro) {
      const status = erro instanceof ApiError ? erro.status : null;
      if (status === 409) {
        setErroAoRemover(
          "Não dá para excluir: o vínculo foi encerrado e a linha do tempo ficou só para consulta.",
        );
      } else if (status === 404) {
        setErroAoRemover(
          "Este registro já tinha sido excluído. A linha do tempo foi atualizada.",
        );
      } else {
        setErroAoRemover("Não foi possível excluir. Tente de novo.");
      }
      // O estado mudou no servidor: a linha do tempo é lida de novo.
      if (status === 409 || status === 404) carregar();
    } finally {
      setRemovendo(false);
    }
  }

  if (carga.estado === "carregando") {
    return <Esqueleto rotulo="Carregando salários…" linhas={5} />;
  }
  if (carga.estado === "erro") {
    return (
      <div className="salarios__aviso" role="alert">
        <p>
          {carga.status === 403
            ? "Você não tem permissão para ver os salários."
            : "Não foi possível carregar os salários."}
        </p>
        {carga.status !== 403 ? (
          <Button type="button" variant="secondary" onClick={carregar}>
            Tentar de novo
          </Button>
        ) : null}
      </div>
    );
  }

  const { historico } = carga;
  // Depois do desligamento, a API recusa toda gravação (409): só consulta.
  const encerrado = historico.vinculo.situacao === "encerrado";
  const podeAlterar = podeEditar && !encerrado;
  const modeloPadrao =
    ROTULO_DO_TIPO_DE_VINCULO[
      historico.vinculo.tipo as keyof typeof ROTULO_DO_TIPO_DE_VINCULO
    ] ?? "";

  return (
    <Revelar>
      <div className="salarios">
        {historico.alteracoes.length === 0 ? (
          <section className="ficha-ref__cartao salarios__vazio">
            <span className="ficha-ref__cartao-icone" aria-hidden="true">
              <IconeDinheiro tamanho={18} />
            </span>
            <h3 className="salarios__vazio-titulo">
              Nenhum salário registrado
            </h3>
            <p className="salarios__vazio-texto">
              {`Registre o salário para acompanhar a evolução ${deQuem}.`}
            </p>
            {podeAlterar ? (
              <button
                type="button"
                className="ficha-ref__editar"
                onClick={() => setGaveta({ modo: "nova" })}
              >
                <IconeMais tamanho={14} />
                Nova alteração
              </button>
            ) : null}
          </section>
        ) : (
          <>
            <div className="salarios__topo">
              <SalarioAtual historico={historico} hoje={hoje} />
              <Resumo alteracoes={historico.alteracoes} hoje={hoje} />
            </div>
            <LinhaDoTempo
              historico={historico}
              hoje={hoje}
              deQuem={deQuem}
              modeloPadrao={modeloPadrao}
              podeEditar={podeAlterar}
              encerrado={encerrado}
              onNova={() => setGaveta({ modo: "nova" })}
              onEditar={(alteracao) => setGaveta({ modo: "editar", alteracao })}
              onExcluir={(alteracao) => {
                setErroAoRemover(null);
                setExcluindo(alteracao);
              }}
            />
          </>
        )}

        {gaveta ? (
          <GavetaDeAlteracao
            key={gaveta.modo === "editar" ? gaveta.alteracao.id : "nova"}
            gaveta={gaveta}
            colaboradorId={colaboradorId}
            dataAdmissao={historico.vinculo.dataAdmissao}
            primeiroSalario={historico.alteracoes.length === 0}
            cargoAtual={cargoAtual || historico.alteracoes[0]?.cargo || ""}
            modeloPadrao={
              historico.alteracoes[0]?.modeloContrato ?? modeloPadrao
            }
            servico={servico}
            onFechar={() => setGaveta(null)}
            onGravado={(novo) => {
              setCarga({ estado: "pronto", historico: novo });
              setGaveta(null);
            }}
          />
        ) : null}

        <Dialog
          aberto={excluindo !== null}
          titulo="Excluir alteração salarial?"
          descricao={
            excluindo
              ? `O período que começa em ${formatarDiaCivil(excluindo.vigenciaInicio)} sai da linha do tempo, e os demais se reorganizam.`
              : ""
          }
          onFechar={() => setExcluindo(null)}
          bloqueado={removendo}
          rodape={
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setExcluindo(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="ficha-ref__botao-perigo"
                disabled={removendo}
                onClick={() => void excluir()}
              >
                Excluir
              </Button>
            </FormActions>
          }
        >
          {erroAoRemover ? (
            <p className="salarios__erro" role="alert">
              {erroAoRemover}
            </p>
          ) : (
            <p className="ficha-ref__janela-texto">
              O registro fica guardado no histórico de auditoria.
            </p>
          )}
        </Dialog>
      </div>
    </Revelar>
  );
}

function CabecaDoCartao({
  id,
  titulo,
  subtitulo,
  icone,
  acao,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly subtitulo: string;
  readonly icone: ReactNode;
  readonly acao?: ReactNode;
}) {
  return (
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
  );
}

function SalarioAtual({
  historico,
  hoje,
}: {
  readonly historico: HistoricoSalarialApi;
  readonly hoje: string;
}) {
  const id = useId();
  const vigente = historico.alteracoes[0]!;
  const bruto = Number(vigente.salarioBruto);
  const liquido = calcularSalarioLiquido({
    bruto,
    dependentes: historico.dependentesIrrf ?? 0,
    pensaoPercentual: Number(historico.pensaoAlimenticiaPercentual ?? 0),
  });
  const sobreAnterior = percentualSobreAnterior(historico.alteracoes).get(
    vigente.id,
  );
  const ids = idsDeReajuste(historico.alteracoes);
  const reajustes = ids.size;
  const primeiro = historico.alteracoes[historico.alteracoes.length - 1]!;
  // Admissão futura: o salário ainda não vale.
  const futuro = vigente.vigenciaInicio > hoje;

  return (
    <section className="ficha-ref__cartao salarios__atual" aria-labelledby={id}>
      <CabecaDoCartao
        id={id}
        titulo="Salário atual"
        subtitulo="Remuneração bruta mensal vigente"
        icone={<IconeDinheiro tamanho={18} />}
      />
      <div className="salarios__atual-corpo">
        <div className="salarios__atual-valores">
          <p className="salarios__valor">
            <span className="salarios__moeda">R$</span>
            <NumeroSuave
              className="salarios__numero"
              valor={bruto}
              formatar={formatarReais}
            />
            <span className="salarios__periodo">/mês</span>
          </p>
          <p className="salarios__origem">
            <span className="salarios__selo">
              {vigente.origem === "admissao"
                ? "Salário inicial"
                : ids.has(vigente.id)
                  ? "Reajuste"
                  : "Alteração"}
            </span>
            <span className="salarios__origem-texto">
              {vigente.origem === "admissao" || sobreAnterior == null
                ? vigente.origem === "admissao"
                  ? "Definido na admissão"
                  : "Primeiro registro"
                : `${percentual(sobreAnterior)} sobre o anterior`}
            </span>
          </p>
          <dl className="salarios__detalhes">
            <div className="salarios__detalhe">
              <dt>Líquido estimado</dt>
              <dd>
                {liquido === null ? VAZIO : `R$ ${formatarReais(liquido)}`}
              </dd>
            </div>
            <div className="salarios__detalhe">
              <dt>{futuro ? "A partir de" : "Vigente desde"}</dt>
              <dd>{formatarDiaCivil(vigente.vigenciaInicio)}</dd>
            </div>
          </dl>
        </div>
        <figure className="salarios__grafico">
          <Grafico alteracoes={historico.alteracoes} hoje={hoje} />
          <figcaption className="salarios__grafico-legenda">
            <span>{mesCurto(primeiro.vigenciaInicio)}</span>
            <span className="salarios__grafico-meio">
              {reajustes === 0
                ? "Sem reajustes desde a admissão"
                : reajustes === 1
                  ? "1 reajuste desde a admissão"
                  : `${reajustes} reajustes desde a admissão`}
            </span>
            <span className="salarios__grafico-hoje">hoje</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

const LARGURA = 300;
const ALTURA = 120;
/** Respiro lateral: o marcador do início e o tracejado depois de hoje. */
const MARGEM_ESQUERDA = 6;
const MARGEM_DIREITA = 14;
/** Faixa útil do valor: o topo deixa lugar para a etiqueta. */
const TOPO = 40;
const BASE = 100;
const LINHAS_GUIA = [34.5, 68.5, 102.5];

function Grafico({
  alteracoes,
  hoje,
}: {
  readonly alteracoes: readonly AlteracaoSalarialApi[];
  readonly hoje: string;
}) {
  const gradiente = useId().replace(/:/g, "");
  const pontos = pontosDoGrafico(alteracoes, hoje);
  const tempo = (dia: string) => new Date(`${dia}T12:00:00Z`).getTime();
  const inicio = tempo(pontos[0]!.dia);
  const fimReal = tempo(pontos[pontos.length - 1]!.dia);
  // Período de um dia só (ou admissão ainda por vir): a linha atravessa o
  // gráfico inteiro, do início até hoje.
  const plano = fimReal <= inicio;
  const fim = plano ? inicio + 1 : fimReal;
  const valores = pontos.map((p) => p.valor);
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const util = LARGURA - MARGEM_ESQUERDA - MARGEM_DIREITA;
  const x = (dia: string, indice?: number) =>
    plano
      ? MARGEM_ESQUERDA + (indice === pontos.length - 1 ? util : 0)
      : MARGEM_ESQUERDA + ((tempo(dia) - inicio) / (fim - inicio)) * util;
  const y = (valor: number) =>
    maior === menor
      ? (TOPO + BASE) / 2
      : BASE - ((valor - menor) / (maior - menor)) * (BASE - TOPO);
  const caminho = pontos
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.dia, i)} ${y(p.valor)}`)
    .join(" ");
  const primeiro = pontos[0]!;
  const ultimo = pontos[pontos.length - 1]!;
  const xFim = x(ultimo.dia, pontos.length - 1);
  const yFim = y(ultimo.valor);
  const area = `${caminho} L${xFim} ${ALTURA} L${x(primeiro.dia, 0)} ${ALTURA} Z`;
  return (
    <div className="salarios__grafico-area">
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        role="img"
        aria-label="Evolução do salário até hoje"
      >
        <defs>
          <linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="salarios__grafico-cor-topo" />
            <stop offset="1" className="salarios__grafico-cor-base" />
          </linearGradient>
        </defs>
        {LINHAS_GUIA.map((g) => (
          <line
            key={g}
            className="salarios__grafico-guia"
            x1="0"
            x2={LARGURA}
            y1={g}
            y2={g}
          />
        ))}
        <path
          className="salarios__grafico-preenchimento"
          d={area}
          fill={`url(#${gradiente})`}
        />
        <path className="salarios__grafico-linha" d={caminho} pathLength={1} />
        <path
          className="salarios__grafico-depois"
          d={`M${xFim} ${yFim} L${LARGURA} ${yFim}`}
        />
        <circle
          className="salarios__grafico-inicio"
          cx={x(primeiro.dia, 0)}
          cy={y(primeiro.valor)}
          r="3"
        />
        <circle className="salarios__grafico-fim" cx={xFim} cy={yFim} r="4" />
      </svg>
      <span
        className="salarios__grafico-rotulo"
        style={{
          left: `${(xFim / LARGURA) * 100}%`,
          top: `${(yFim / ALTURA) * 100}%`,
        }}
      >
        {`R$ ${reaisInteiros(ultimo.valor)}`}
      </span>
    </div>
  );
}

function Resumo({
  alteracoes,
  hoje,
}: {
  readonly alteracoes: readonly AlteracaoSalarialApi[];
  readonly hoje: string;
}) {
  const id = useId();
  const resumo = resumoSalarial(alteracoes, hoje);
  const barra =
    resumo.aumentoAcumulado === null
      ? 0
      : Math.max(0, Math.min(100, resumo.aumentoAcumulado / 10));
  return (
    <section
      className="ficha-ref__cartao salarios__resumo"
      aria-labelledby={id}
    >
      <CabecaDoCartao
        id={id}
        titulo="Resumo"
        subtitulo="Desde o primeiro registro"
        icone={<IconePainel tamanho={18} />}
      />
      <dl className="salarios__resumo-lista">
        <div className="salarios__resumo-item salarios__resumo-item--barra">
          <dt>Aumento acumulado</dt>
          <dd>
            {resumo.aumentoAcumulado === null
              ? VAZIO
              : percentual(resumo.aumentoAcumulado)}
          </dd>
          <span className="salarios__barra" aria-hidden="true">
            <span style={{ width: `${barra}%` }} />
          </span>
          {resumo.aumentoAcumulado === null ? (
            <span className="salarios__ajuda">
              Aparece após a primeira alteração
            </span>
          ) : null}
        </div>
        <div className="salarios__resumo-item">
          <dt>Média por reajuste</dt>
          <dd>
            {resumo.mediaPorReajuste === null
              ? VAZIO
              : percentual(resumo.mediaPorReajuste)}
          </dd>
        </div>
        <div className="salarios__resumo-item">
          <dt>Reajustes</dt>
          <dd>
            <NumeroSuave valor={resumo.reajustes} />
          </dd>
        </div>
        <div className="salarios__resumo-item">
          <dt>Tempo no salário atual</dt>
          <dd>{tempoCurto(resumo.mesesNoSalarioAtual)}</dd>
        </div>
      </dl>
    </section>
  );
}

function LinhaDoTempo({
  historico,
  hoje,
  deQuem,
  modeloPadrao,
  podeEditar,
  encerrado,
  onNova,
  onEditar,
  onExcluir,
}: {
  readonly historico: HistoricoSalarialApi;
  readonly hoje: string;
  readonly deQuem: string;
  readonly modeloPadrao: string;
  readonly podeEditar: boolean;
  /** Vínculo encerrado: a linha do tempo é só consulta. */
  readonly encerrado: boolean;
  readonly onNova: () => void;
  readonly onEditar: (a: AlteracaoSalarialApi) => void;
  readonly onExcluir: (a: AlteracaoSalarialApi) => void;
}) {
  const id = useId();
  const percentuais = useMemo(
    () => percentualSobreAnterior(historico.alteracoes),
    [historico.alteracoes],
  );
  return (
    <section className="ficha-ref__cartao salarios__tempo" aria-labelledby={id}>
      <CabecaDoCartao
        id={id}
        titulo="Linha do tempo salarial"
        subtitulo={
          encerrado
            ? "Só consulta: o vínculo foi encerrado."
            : "Alterações de salário, cargo e contrato"
        }
        icone={<IconeTempo tamanho={18} />}
        {...(podeEditar
          ? {
              acao: (
                <button
                  type="button"
                  className="ficha-ref__editar"
                  onClick={onNova}
                >
                  <IconeMais tamanho={14} />
                  Nova alteração
                </button>
              ),
            }
          : {})}
      />
      <ol className="salarios__periodos">
        {historico.alteracoes.map((a) => {
          const p = percentuais.get(a.id);
          // Ainda não começou (admissão futura): nem vigente, nem duração.
          const futuro = a.vigenciaInicio > hoje;
          const vigente = a.vigente && !futuro;
          return (
            <li
              key={a.id}
              className={
                vigente
                  ? "salarios__periodo salarios__periodo--vigente"
                  : "salarios__periodo"
              }
            >
              <span className="salarios__trilho" aria-hidden="true">
                <span className="salarios__marco">
                  {vigente ? <span className="salarios__pulso" /> : null}
                  <span className="salarios__ponto" />
                </span>
                <span className="salarios__conector" />
              </span>
              <span className="salarios__conteudo">
                <span className="salarios__coluna">
                  <span className="salarios__forte salarios__data">
                    {formatarDiaCivil(a.vigenciaInicio)}
                  </span>
                  <span className="salarios__suave">
                    {a.vigenciaFim
                      ? `até ${formatarDiaCivil(a.vigenciaFim)}`
                      : futuro
                        ? `a partir de ${formatarDiaCivil(a.vigenciaInicio)}`
                        : "até hoje"}
                  </span>
                </span>
                <span className="salarios__coluna">
                  <span className="salarios__valor-periodo">
                    {`R$ ${formatarReais(Number(a.salarioBruto))}`}
                  </span>
                  <span className="salarios__suave">
                    {p == null
                      ? a.origem === "admissao"
                        ? "Salário inicial"
                        : "Primeiro registro"
                      : percentual(p)}
                  </span>
                </span>
                <span className="salarios__coluna">
                  <span className="salarios__texto salarios__cortado">
                    {a.cargo ?? "Não informado"}
                  </span>
                  <span className="salarios__suave salarios__cortado">
                    {futuro
                      ? (a.modeloContrato ?? modeloPadrao)
                      : `${a.modeloContrato ?? modeloPadrao} · ${duracaoDoPeriodo(a.vigenciaInicio, a.vigenciaFim ?? hoje)}`}
                  </span>
                </span>
                <span className="salarios__selos">
                  {vigente ? (
                    <span className="salarios__selo salarios__selo--vigente">
                      Vigente
                    </span>
                  ) : null}
                  {a.origem === "admissao" ? (
                    <span className="salarios__selo">Admissão</span>
                  ) : null}
                  {podeEditar ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="ficha-ref__mais"
                        aria-label={`Ações do registro de ${formatarDiaCivil(a.vigenciaInicio)}`}
                      >
                        <IconeMaisAcoes tamanho={16} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="ficha-ref__menu">
                        <DropdownMenuItem
                          className="ficha-ref__menu-item salarios__menu-item"
                          onSelect={() => onEditar(a)}
                        >
                          <IconeEditar tamanho={14} />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="ficha-ref__menu-item ficha-ref__menu-item--perigo salarios__menu-item"
                          disabled={a.origem === "admissao"}
                          onSelect={() => onExcluir(a)}
                        >
                          <IconeRemover tamanho={14} />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </span>
              </span>
            </li>
          );
        })}
        <li className="salarios__periodo salarios__periodo--proximo">
          <span className="salarios__trilho" aria-hidden="true">
            <span className="salarios__marco">
              <span className="salarios__ponto salarios__ponto--futuro" />
            </span>
          </span>
          <span className="salarios__conteudo salarios__conteudo--proximo">
            <span className="salarios__coluna">
              <span className="salarios__texto">Próximo reajuste</span>
              <span className="salarios__suave">
                {`Registre reajustes e promoções para acompanhar a evolução ${deQuem}.`}
              </span>
            </span>
            {podeEditar ? (
              <button
                type="button"
                className="ficha-ref__editar"
                onClick={onNova}
              >
                <IconeMais tamanho={14} />
                Registrar reajuste
              </button>
            ) : null}
          </span>
        </li>
      </ol>
    </section>
  );
}

const MENSAGEM_DA_DATA: Readonly<Record<string, string>> = {
  futura: "A data não pode ser depois de hoje.",
  em_uso: "Já existe um período começando nesta data.",
  nao_se_aplica: "A data da admissão não muda.",
};

function GavetaDeAlteracao({
  gaveta,
  colaboradorId,
  dataAdmissao,
  primeiroSalario,
  modeloPadrao,
  cargoAtual,
  servico,
  onFechar,
  onGravado,
}: {
  readonly gaveta: NonNullable<Gaveta>;
  readonly colaboradorId: string;
  readonly dataAdmissao: string;
  /** Sem nenhum período: o primeiro salário é o da admissão, na data dela. */
  readonly primeiroSalario: boolean;
  readonly modeloPadrao: string;
  /** Cargo que vem preenchido numa alteração nova. */
  readonly cargoAtual: string;
  readonly servico: ServicoDeSalarios;
  readonly onFechar: () => void;
  readonly onGravado: (historico: HistoricoSalarialApi) => void;
}) {
  const base = useId();
  const editando = gaveta.modo === "editar" ? gaveta.alteracao : null;
  const dataFixa = editando?.origem === "admissao" || primeiroSalario;
  const [data, setData] = useState(
    editando?.vigenciaInicio ?? (primeiroSalario ? dataAdmissao : ""),
  );
  const [salario, setSalario] = useState(
    editando ? formatarReais(Number(editando.salarioBruto)) : "",
  );
  const cargoInicial = editando ? (editando.cargo ?? "") : cargoAtual;
  const [cargo, setCargo] = useState(cargoInicial);
  const [modelo, setModelo] = useState(
    editando ? (editando.modeloContrato ?? modeloPadrao) : modeloPadrao,
  );
  const [enviando, setEnviando] = useState(false);
  const [erroDaData, setErroDaData] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const valor = lerValorEmReais(salario);
  const completo = data !== "" && valor !== null && valor > 0;
  const alterado = editando
    ? data !== editando.vigenciaInicio ||
      salario !== formatarReais(Number(editando.salarioBruto)) ||
      cargo !== cargoInicial ||
      modelo !== (editando.modeloContrato ?? modeloPadrao)
    : (!primeiroSalario && data !== "") ||
      salario !== "" ||
      cargo !== cargoInicial;

  async function gravar(evento?: FormEvent) {
    evento?.preventDefault();
    if (!completo || enviando) return;
    setEnviando(true);
    setErroDaData(null);
    setErroGeral(null);
    const dto: GravarAlteracaoSalarialDto = {
      vigenciaInicio: data,
      salarioBruto: valor!.toFixed(2),
      cargo: cargo.trim() === "" ? null : cargo.trim(),
      modeloContrato: modelo.trim() === "" ? null : modelo.trim(),
    };
    try {
      const historico = editando
        ? await servico.atualizar(colaboradorId, editando.id, dto)
        : await servico.registrar(colaboradorId, dto);
      onGravado(historico);
    } catch (erro) {
      const daData =
        erro instanceof ApiError
          ? erro.erros?.find((e) => e.campo === "vigenciaInicio")
          : undefined;
      if (daData) {
        setErroDaData(
          daData.motivo === "fora_de_ordem"
            ? `A data não pode ser anterior à admissão (${formatarDiaCivil(dataAdmissao)}).`
            : (MENSAGEM_DA_DATA[daData.motivo] ?? "Confira a data."),
        );
      } else if (erro instanceof ApiError && erro.status === 409) {
        setErroGeral("Não dá para alterar o salário de quem foi desligado.");
      } else {
        setErroGeral("Não foi possível salvar. Tente de novo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet
      aberto
      titulo={
        editando ? "Editar alteração salarial" : "Adicionar alteração salarial"
      }
      descricao="Informe a data em que o salário passou a valer. Pode ser uma data passada: o sistema organiza os períodos automaticamente."
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={alterado}
      className="salarios-gaveta"
      rodape={
        <FormActions>
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!completo || enviando}
            onClick={() => void gravar()}
          >
            {editando ? "Salvar alterações" : "Registrar alteração"}
          </Button>
        </FormActions>
      }
    >
      <form
        className="salarios-gaveta__campos"
        onSubmit={(e) => void gravar(e)}
      >
        <div className="salarios-gaveta__campo">
          <label htmlFor={`${base}-data`}>Data de início</label>
          <input
            id={`${base}-data`}
            type="date"
            value={data}
            disabled={dataFixa}
            aria-invalid={erroDaData ? "true" : undefined}
            aria-describedby={
              erroDaData
                ? `${base}-data-erro`
                : dataFixa
                  ? `${base}-data-ajuda`
                  : undefined
            }
            onChange={(e) => {
              setData(e.target.value);
              setErroDaData(null);
            }}
          />
          {erroDaData ? (
            <span id={`${base}-data-erro`} className="salarios__erro">
              {erroDaData}
            </span>
          ) : dataFixa ? (
            <span id={`${base}-data-ajuda`} className="salarios__ajuda">
              {primeiroSalario
                ? "O primeiro salário vale desde a admissão."
                : "A data da admissão vem do vínculo."}
            </span>
          ) : null}
        </div>
        <label className="salarios-gaveta__campo" htmlFor={`${base}-salario`}>
          <span>Salário</span>
          <input
            id={`${base}-salario`}
            inputMode="numeric"
            placeholder="0,00"
            value={salario}
            onChange={(e) => setSalario(mascararReais(e.target.value))}
          />
        </label>
        <label className="salarios-gaveta__campo" htmlFor={`${base}-cargo`}>
          <span>Cargo</span>
          <input
            id={`${base}-cargo`}
            placeholder="Cargo nesse período"
            maxLength={120}
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
          />
        </label>
        <label className="salarios-gaveta__campo" htmlFor={`${base}-modelo`}>
          <span>Modelo de contrato</span>
          <input
            id={`${base}-modelo`}
            placeholder="CLT, PJ, Estágio..."
            maxLength={60}
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
          />
        </label>
        {erroGeral ? (
          <p className="salarios__erro" role="alert">
            {erroGeral}
          </p>
        ) : null}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
