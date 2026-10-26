import { useCallback, useEffect, useRef, useState } from "react";
import { Button, DataTable, FormField, StatusBadge } from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../api/csrfClient";
import {
  type TabelaHorarioApi,
  listarTabelasHorario,
} from "../../api/horariosClient";
import {
  type VinculoHorarioApi,
  atribuirJornada,
  encerrarVinculoHorario,
  listarVinculosHorario,
} from "../../api/vinculoHorarioClient";
import { formatarDiaCivil } from "../../format/data";
import {
  type CampoDaJornada,
  type SituacaoDaVigencia,
  diaDeHoje,
  jornadaDeHoje,
  mensagemDoCampo,
  proximoDiaCivil,
  rotuloDaJornada,
  situacaoDaVigencia,
  ultimoDiaDaVigencia,
  vigenciaAberta,
} from "./jornadaColaborador";

/**
 * T183 — seção "Jornada de trabalho" da ficha do colaborador.
 *
 * Mostra a jornada de hoje (ou a programada) e o histórico de vigências, com
 * a indicação de jornada inativada. Quem OPERA (o RH, `podeOperar`) atribui,
 * troca e encerra; os demais (DP, `master_tecnico`) só consultam — sem nenhum
 * controle de escrita, e o servidor recusa de qualquer forma.
 *
 * - Atribuir e trocar são a mesma operação (`POST
 *   /v1/horarios/vinculos/atribuicoes`): com jornada vigente, o servidor a
 *   encerra no novo início e cria a nova, numa transação.
 * - Encerrar pergunta o ÚLTIMO dia com a jornada e envia o seguinte (o fim
 *   gravado não conta).
 * - Só jornadas ATIVAS aparecem para escolha. A empresa nunca é enviada.
 * - Falhou? O digitado fica; sem resposta, a mensagem não afirma nem nega a
 *   gravação. A confirmação de descarte é a do `Modal`: a seção avisa quando
 *   há formulário preenchido (`onAlteradoChange`) e quando está gravando
 *   (`onSalvandoChange`).
 */

const VARIANTE: Record<SituacaoDaVigencia, StatusVariant> = {
  vigente: "success",
  programada: "info",
  encerrada: "neutral",
};

const ROTULO_SITUACAO: Record<SituacaoDaVigencia, string> = {
  vigente: "Vigente",
  programada: "Programada",
  encerrada: "Encerrada",
};

const ID_JORNADA = "jornada-colaborador-jornada";
const ID_INICIO = "jornada-colaborador-inicio";
const ID_ULTIMO_DIA = "jornada-colaborador-ultimo-dia";
const ID_ERRO_GERAL = "jornada-colaborador-erro-geral";
const ID_TITULO = "jornada-colaborador-titulo";

type Erros = Partial<Record<CampoDaJornada | "geral", string>>;

type Formulario =
  | {
      readonly modo: "atribuir" | "trocar";
      tabelaHorarioId: string;
      inicio: string;
      erros: Erros;
      salvando: boolean;
    }
  | {
      readonly modo: "encerrar";
      readonly vinculo: VinculoHorarioApi;
      ultimoDia: string;
      erros: Erros;
      salvando: boolean;
    };

/** Os erros sem o do campo editado agora. */
function semErro(erros: Erros, campo: CampoDaJornada): Erros {
  const resto = { ...erros };
  delete resto[campo];
  return resto;
}

/** `status` numérico do erro, lido por forma; `null` sem resposta. */
function statusDe(erro: unknown): number | null {
  return typeof erro === "object" &&
    erro !== null &&
    typeof (erro as { status?: unknown }).status === "number"
    ? (erro as { status: number }).status
    : null;
}

/** As recusas por campo que o servidor devolveu, já com a mensagem da tela. */
function errosDosCampos(erro: unknown): Erros {
  const lista =
    typeof erro === "object" && erro !== null
      ? (erro as { erros?: unknown }).erros
      : undefined;
  const erros: Erros = {};
  if (!Array.isArray(lista)) return erros;
  for (const item of lista) {
    if (typeof item !== "object" || item === null) continue;
    const { campo, motivo } = item as { campo?: unknown; motivo?: unknown };
    if (typeof campo !== "string" || typeof motivo !== "string") continue;
    const traduzido = mensagemDoCampo(campo, motivo);
    if (traduzido) erros[traduzido.campo] = traduzido.mensagem;
  }
  return erros;
}

/** Recusa de uma gravação, pelo que o contrato produz. */
function errosDaRecusa(erro: unknown, campoDaData: CampoDaJornada): Erros {
  if (falhaPorTokenDesatualizado(erro)) {
    return {
      geral:
        "Esta página ficou desatualizada, e nada foi salvo. Tente de novo; seus dados foram mantidos.",
    };
  }
  if (falhaPorSessaoExpirada(erro)) {
    return {
      geral:
        "Sua sessão expirou, e nada foi salvo. Entre de novo para continuar.",
    };
  }
  if (falhaAoPrepararEnvio(erro)) {
    return {
      geral:
        "Não foi possível preparar o envio, e nada foi salvo. Confira a conexão e tente de novo.",
    };
  }
  const status = statusDe(erro);
  if (status === 409 || status === 422) {
    const porCampo = errosDosCampos(erro);
    if (Object.keys(porCampo).length > 0) return porCampo;
  }
  switch (status) {
    case 400:
      return {
        [campoDaData]: "Informe uma data válida.",
      };
    case 403:
      return {
        geral:
          "Seu perfil não tem permissão para alterar a jornada. Nada foi salvo.",
      };
    case 404:
      return {
        geral:
          "Colaborador ou jornada não encontrados na empresa ativa. Nada foi salvo.",
      };
    case 409:
    case 422:
      return {
        geral:
          "A alteração foi recusada. Atualize o histórico e tente de novo.",
      };
    default:
      return {
        geral:
          "Não foi possível confirmar se a alteração foi salva. Atualize o histórico para conferir antes de tentar de novo.",
      };
  }
}

export interface JornadaColaboradorSecaoProps {
  readonly colaboradorId: string;
  /** Só o RH: atribuir, trocar e encerrar. Sem isso, só consulta. */
  readonly podeOperar?: boolean;
  readonly onAlteradoChange?: (alterado: boolean) => void;
  readonly onSalvandoChange?: (salvando: boolean) => void;
  /** Para testes: o "hoje" da tela. */
  readonly hoje?: string;
}

export function JornadaColaboradorSecao({
  colaboradorId,
  podeOperar = false,
  onAlteradoChange,
  onSalvandoChange,
  hoje = diaDeHoje(),
}: JornadaColaboradorSecaoProps) {
  const [status, setStatus] = useState<"carregando" | "erro" | "dados">(
    "carregando",
  );
  const [vinculos, setVinculos] = useState<VinculoHorarioApi[]>([]);
  const [jornadas, setJornadas] = useState<TabelaHorarioApi[]>([]);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const salvandoRef = useRef(false);
  const focoRef = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    setStatus("carregando");
    try {
      const [resp, catalogo] = await Promise.all([
        listarVinculosHorario({ colaboradorId, tamanhoPagina: 100 }),
        // Só quem opera escolhe jornada: o catálogo de ativas só é lido aí.
        podeOperar
          ? listarTabelasHorario({ ativo: true, tamanhoPagina: 100 })
          : Promise.resolve(null),
      ]);
      setVinculos(resp.itens);
      if (catalogo) setJornadas(catalogo.itens);
      setStatus("dados");
    } catch {
      setStatus("erro");
    }
  }, [colaboradorId, podeOperar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const id = focoRef.current;
    if (id === null) return;
    const alvo = document.getElementById(id);
    if (!alvo) return;
    focoRef.current = null;
    alvo.focus();
  });

  const preenchido =
    formulario !== null &&
    (formulario.modo === "encerrar"
      ? formulario.ultimoDia !== ""
      : formulario.tabelaHorarioId !== "" || formulario.inicio !== "");
  useEffect(() => {
    onAlteradoChange?.(preenchido);
  }, [preenchido, onAlteradoChange]);
  useEffect(() => {
    onSalvandoChange?.(formulario?.salvando ?? false);
  }, [formulario?.salvando, onSalvandoChange]);

  const atual = jornadaDeHoje(vinculos, hoje);
  const aberta = vigenciaAberta(vinculos);
  const programada =
    aberta !== null && situacaoDaVigencia(aberta, hoje) === "programada"
      ? aberta
      : null;

  function abrir(modo: "atribuir" | "trocar" | "encerrar") {
    setAviso(null);
    if (modo === "encerrar") {
      if (!aberta) return;
      setFormulario({
        modo,
        vinculo: aberta,
        ultimoDia: "",
        erros: {},
        salvando: false,
      });
      focoRef.current = ID_ULTIMO_DIA;
    } else {
      setFormulario({
        modo,
        tabelaHorarioId: "",
        inicio: "",
        erros: {},
        salvando: false,
      });
      focoRef.current = ID_JORNADA;
    }
  }

  function cancelar() {
    if (salvandoRef.current) return;
    setFormulario(null);
  }

  function focarPrimeiroErro(erros: Erros) {
    focoRef.current = erros.tabelaHorarioId
      ? ID_JORNADA
      : erros.vigenciaInicio
        ? ID_INICIO
        : erros.vigenciaFim
          ? ID_ULTIMO_DIA
          : erros.geral
            ? ID_ERRO_GERAL
            : null;
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario || salvandoRef.current) return;

    const locais: Erros = {};
    if (formulario.modo === "encerrar") {
      if (!formulario.ultimoDia) {
        locais.vigenciaFim = "Informe o último dia com a jornada.";
      } else if (formulario.ultimoDia < formulario.vinculo.vigenciaInicio) {
        locais.vigenciaFim =
          "O último dia não pode ser antes do primeiro dia da jornada.";
      }
    } else {
      if (!formulario.tabelaHorarioId) {
        locais.tabelaHorarioId = "Escolha a jornada.";
      }
      if (!formulario.inicio) {
        locais.vigenciaInicio = "Informe o primeiro dia da jornada.";
      } else if (
        formulario.modo === "trocar" &&
        aberta &&
        formulario.inicio <= aberta.vigenciaInicio
      ) {
        locais.vigenciaInicio =
          "A nova jornada precisa começar depois do início da jornada atual.";
      }
    }
    if (Object.keys(locais).length > 0) {
      setFormulario((prev) => (prev ? { ...prev, erros: locais } : prev));
      focarPrimeiroErro(locais);
      return;
    }

    salvandoRef.current = true;
    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );
    try {
      if (formulario.modo === "encerrar") {
        await encerrarVinculoHorario(formulario.vinculo.id, {
          vigenciaFim: proximoDiaCivil(formulario.ultimoDia),
        });
        setAviso(
          `Jornada encerrada. O último dia nela é ${formatarDiaCivil(formulario.ultimoDia)}.`,
        );
      } else {
        await atribuirJornada({
          colaboradorId,
          tabelaHorarioId: formulario.tabelaHorarioId,
          vigenciaInicio: formulario.inicio,
        });
        setAviso(
          formulario.modo === "trocar"
            ? `Jornada trocada a partir de ${formatarDiaCivil(formulario.inicio)}. A anterior fica no histórico.`
            : `Jornada atribuída a partir de ${formatarDiaCivil(formulario.inicio)}.`,
        );
      }
      setFormulario(null);
      focoRef.current = ID_TITULO;
      await carregar();
    } catch (erro: unknown) {
      const erros = errosDaRecusa(
        erro,
        formulario.modo === "encerrar" ? "vigenciaFim" : "vigenciaInicio",
      );
      setFormulario((prev) =>
        prev ? { ...prev, salvando: false, erros } : prev,
      );
      focarPrimeiroErro(erros);
    } finally {
      salvandoRef.current = false;
    }
  }

  const colunas: DataTableColumn<VinculoHorarioApi>[] = [
    {
      key: "jornada",
      header: "Jornada",
      cell: (v) => (
        <span className="colaboradores-screen__jornada-nome">
          {rotuloDaJornada(v.tabela)}
          {v.tabela.ativo ? null : (
            <>
              {" "}
              <StatusBadge variant="warning">Jornada inativa</StatusBadge>
            </>
          )}
        </span>
      ),
    },
    {
      key: "inicio",
      header: "Primeiro dia",
      cell: (v) => formatarDiaCivil(v.vigenciaInicio),
    },
    {
      key: "fim",
      header: "Último dia",
      cell: (v) => {
        const ultimo = ultimoDiaDaVigencia(v);
        return ultimo === null ? "Sem término" : formatarDiaCivil(ultimo);
      },
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (v) => {
        const situacao = situacaoDaVigencia(v, hoje);
        return (
          <StatusBadge variant={VARIANTE[situacao]}>
            {ROTULO_SITUACAO[situacao]}
          </StatusBadge>
        );
      },
    },
  ];

  const opcoesDeJornada =
    formulario && formulario.modo !== "encerrar"
      ? jornadas.filter(
          (j) =>
            formulario.modo !== "trocar" || j.id !== aberta?.tabelaHorarioId,
        )
      : [];

  return (
    <section
      className="colaboradores-screen__jornada"
      aria-labelledby={ID_TITULO}
    >
      <h3
        id={ID_TITULO}
        className="colaboradores-screen__section-title"
        tabIndex={-1}
      >
        Jornada de trabalho
      </h3>

      {status === "carregando" ? (
        <p className="colaboradores-screen__carregando" role="status">
          Carregando jornada…
        </p>
      ) : status === "erro" ? (
        <p className="colaboradores-screen__form-erro" role="alert">
          Não foi possível carregar a jornada deste colaborador.{" "}
          <Button variant="secondary" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </p>
      ) : (
        <>
          <dl className="colaboradores-screen__dados-pessoais-lista">
            <div className="colaboradores-screen__par">
              <dt>Jornada atual</dt>
              <dd>
                {atual ? (
                  <>
                    {rotuloDaJornada(atual.tabela)}
                    {atual.tabela.ativo ? null : (
                      <>
                        {" "}
                        <StatusBadge variant="warning">
                          Jornada inativa
                        </StatusBadge>
                      </>
                    )}
                    {` — desde ${formatarDiaCivil(atual.vigenciaInicio)}`}
                    {atual.vigenciaFim
                      ? `, até ${formatarDiaCivil(ultimoDiaDaVigencia(atual))}`
                      : ""}
                  </>
                ) : (
                  "Sem jornada vigente hoje."
                )}
              </dd>
            </div>
            {programada ? (
              <div className="colaboradores-screen__par">
                <dt>Programada</dt>
                <dd>
                  {`${rotuloDaJornada(programada.tabela)} — a partir de ${formatarDiaCivil(programada.vigenciaInicio)}`}
                </dd>
              </div>
            ) : null}
          </dl>

          {!podeOperar ? (
            <p className="colaboradores-screen__contatos-aviso">
              Somente consulta: só o RH atribui, troca e encerra a jornada.
            </p>
          ) : null}

          {aviso ? (
            <p className="colaboradores-screen__sucesso-texto" role="status">
              {aviso}
            </p>
          ) : null}

          {vinculos.length === 0 ? (
            <p>Nenhuma jornada atribuída a este colaborador.</p>
          ) : (
            <DataTable
              caption="Histórico de jornadas"
              columns={colunas}
              rows={vinculos}
              rowKey={(v) => v.id}
            />
          )}

          {podeOperar && formulario === null ? (
            <div className="colaboradores-screen__bloco-acoes">
              {aberta ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => abrir("trocar")}
                  >
                    Trocar jornada
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => abrir("encerrar")}
                  >
                    Encerrar jornada
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => abrir("atribuir")}
                >
                  Atribuir jornada
                </Button>
              )}
            </div>
          ) : null}

          {podeOperar && formulario ? (
            <form
              className="colaboradores-screen__contatos-form"
              aria-label={
                formulario.modo === "encerrar"
                  ? "Encerrar jornada"
                  : formulario.modo === "trocar"
                    ? "Trocar jornada"
                    : "Atribuir jornada"
              }
              noValidate
              onSubmit={(e) => void salvar(e)}
            >
              {formulario.modo === "encerrar" ? (
                <FormField
                  id={ID_ULTIMO_DIA}
                  label="Último dia com a jornada"
                  required
                  disabled={formulario.salvando}
                  help={`A jornada ${rotuloDaJornada(formulario.vinculo.tabela)} começou em ${formatarDiaCivil(formulario.vinculo.vigenciaInicio)}.`}
                  {...(formulario.erros.vigenciaFim
                    ? { error: formulario.erros.vigenciaFim }
                    : {})}
                >
                  {(control) => (
                    <input
                      type="date"
                      value={formulario.ultimoDia}
                      onChange={(e) =>
                        setFormulario((prev) =>
                          prev && prev.modo === "encerrar"
                            ? {
                                ...prev,
                                ultimoDia: e.target.value,
                                erros: semErro(prev.erros, "vigenciaFim"),
                              }
                            : prev,
                        )
                      }
                      {...control}
                    />
                  )}
                </FormField>
              ) : (
                <>
                  {formulario.modo === "trocar" && aberta ? (
                    <p className="colaboradores-screen__contatos-aviso">
                      {`A jornada ${rotuloDaJornada(aberta.tabela)} termina no dia anterior ao início da nova e fica no histórico.`}
                    </p>
                  ) : null}
                  <FormField
                    id={ID_JORNADA}
                    label={
                      formulario.modo === "trocar" ? "Nova jornada" : "Jornada"
                    }
                    required
                    disabled={formulario.salvando}
                    help="Só jornadas ativas da empresa."
                    {...(formulario.erros.tabelaHorarioId
                      ? { error: formulario.erros.tabelaHorarioId }
                      : {})}
                  >
                    {(control) => (
                      <select
                        value={formulario.tabelaHorarioId}
                        onChange={(e) =>
                          setFormulario((prev) =>
                            prev && prev.modo !== "encerrar"
                              ? {
                                  ...prev,
                                  tabelaHorarioId: e.target.value,
                                  erros: semErro(prev.erros, "tabelaHorarioId"),
                                }
                              : prev,
                          )
                        }
                        {...control}
                      >
                        <option value="">Selecione</option>
                        {opcoesDeJornada.map((j) => (
                          <option key={j.id} value={j.id}>
                            {rotuloDaJornada(j)}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                  {opcoesDeJornada.length === 0 ? (
                    <p className="colaboradores-screen__contatos-aviso">
                      Nenhuma jornada ativa disponível. Cadastre ou reative uma
                      jornada em Estrutura › Jornadas de trabalho.
                    </p>
                  ) : null}
                  <FormField
                    id={ID_INICIO}
                    label="Primeiro dia"
                    required
                    disabled={formulario.salvando}
                    {...(formulario.erros.vigenciaInicio
                      ? { error: formulario.erros.vigenciaInicio }
                      : {})}
                  >
                    {(control) => (
                      <input
                        type="date"
                        value={formulario.inicio}
                        onChange={(e) =>
                          setFormulario((prev) =>
                            prev && prev.modo !== "encerrar"
                              ? {
                                  ...prev,
                                  inicio: e.target.value,
                                  erros: semErro(prev.erros, "vigenciaInicio"),
                                }
                              : prev,
                          )
                        }
                        {...control}
                      />
                    )}
                  </FormField>
                </>
              )}

              {formulario.erros.geral ? (
                <p
                  id={ID_ERRO_GERAL}
                  className="colaboradores-screen__form-erro"
                  role="alert"
                  tabIndex={-1}
                >
                  {formulario.erros.geral}
                </p>
              ) : null}

              <div className="colaboradores-screen__bloco-acoes">
                <Button
                  type="submit"
                  variant="primary"
                  aria-disabled={formulario.salvando}
                >
                  {formulario.salvando
                    ? "Salvando…"
                    : formulario.modo === "encerrar"
                      ? "Encerrar jornada"
                      : formulario.modo === "trocar"
                        ? "Trocar jornada"
                        : "Atribuir jornada"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelar}
                  disabled={formulario.salvando}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
