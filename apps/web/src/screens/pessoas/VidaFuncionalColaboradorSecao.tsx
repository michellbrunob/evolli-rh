/**
 * T187 — "Vida funcional" da ficha do colaborador: a lotação vigente e a linha
 * do tempo de movimentações do vínculo principal, **somente leitura**.
 *
 * Usa só contratos já aprovados, sem rota nova:
 * - `GET /v1/vinculos/:id/alocacoes` (T134) — a lotação vigente é a alocação
 *   com `vigenteAte === null`, campo do servidor, não recálculo;
 * - `GET /v1/vinculos/:id/linha-do-tempo` (T115) — o histórico completo, com
 *   todos os status: programada, efetivada, cancelada e retificada nunca são
 *   omitidas (RI-M6, RI-M2).
 *
 * Os dois devolvem só identificadores organizacionais. Os nomes de
 * departamento e cargo saem da própria linha da listagem (T184), que já vem
 * da mesma alocação aberta; nenhum catálogo é lido aqui. Destinos de cada
 * movimentação e os demais níveis da lotação ficam no Histórico funcional,
 * para onde o atalho leva já no vínculo.
 *
 * Nada aqui escreve: registrar, efetivar, cancelar ou retificar continua no
 * Histórico funcional (decisão da proprietária de 2026-10-27). Escopo e
 * permissão são do servidor: RH, DP e `master_tecnico` leem; 403 ou 404 viram
 * um aviso, sem dado.
 */
import { useCallback, useEffect, useId, useState } from "react";
import { Button, DataTable, StatusBadge } from "../../components";
import type { DataTableColumn } from "../../components";
import type {
  LotacaoListadaApi,
  SituacaoVinculo,
  VinculoApi,
} from "../../api/colaboradoresClient";
import {
  buscarLinhaDoTempo,
  type MovimentacaoApi,
} from "../../api/movimentacaoClient";
import {
  listarAlocacoesVinculo,
  type AlocacaoOrganizacionalApi,
} from "../../api/vinculoContratualClient";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import {
  ROTULO_MOTIVO,
  ROTULO_STATUS_MOVIMENTACAO,
  ROTULO_TIPO_MOVIMENTACAO,
  VARIANTE_STATUS_MOVIMENTACAO,
} from "./movimentacaoRotulos";

const ROTULO_SITUACAO_VINCULO: Record<SituacaoVinculo, string> = {
  ativo: "Ativo",
  previsto: "Previsto",
  encerrado: "Encerrado",
};

/** O alvo do atalho: o colaborador e o vínculo que a ficha mostra. */
export interface AlvoHistoricoFuncional {
  readonly colaboradorId: string;
  readonly vinculoId: string;
}

export interface VidaFuncionalColaboradorSecaoProps {
  readonly colaboradorId: string;
  readonly nomeColaborador: string;
  /** O vínculo principal na empresa ativa; `null` se não há vínculo. */
  readonly vinculo: VinculoApi | null;
  /**
   * Nomes de departamento e cargo já conhecidos pela linha da listagem
   * (T184), com o vínculo a que se referem. Só valem para o MESMO vínculo e
   * para os MESMOS identificadores da alocação aberta.
   */
  readonly lotacaoDaLinha?: {
    readonly vinculoId: string;
    readonly lotacao: LotacaoListadaApi | null;
  } | null;
  /** Abre o Histórico funcional já neste vínculo. Sem ele, não há atalho. */
  readonly onAbrirHistorico?: (alvo: AlvoHistoricoFuncional) => void;
  /** Ficha com edição pendente: o atalho espera, para nada se perder. */
  readonly atalhoBloqueado?: boolean;
}

type Estado =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "erro" }
  | { readonly tipo: "negado" }
  | {
      readonly tipo: "dados";
      readonly linhaDoTempo: readonly MovimentacaoApi[];
      readonly alocacaoVigente: AlocacaoOrganizacionalApi | null;
    };

/** 403 ou 404 do servidor: sem acesso a este vínculo — nunca "erro". */
function semAcesso(erro: unknown): boolean {
  const status = (erro as { status?: unknown } | null)?.status;
  return status === 403 || status === 404;
}

/** Observação histórica de cada linha: nada é escondido, tudo é dito. */
function observacao(m: MovimentacaoApi): string {
  if (m.status === "retificada") {
    return "Substituída por uma retificação; mantida no histórico.";
  }
  if (m.status === "cancelada") return "Cancelada; mantida no histórico.";
  if (m.retificaId) return "Corrige um registro anterior.";
  return "—";
}

const COLUNAS: DataTableColumn<MovimentacaoApi>[] = [
  {
    key: "tipo",
    header: "Movimentação",
    cell: (m) => ROTULO_TIPO_MOVIMENTACAO[m.tipo] ?? m.tipo,
  },
  {
    key: "status",
    header: "Situação",
    cell: (m) => (
      <StatusBadge
        variant={VARIANTE_STATUS_MOVIMENTACAO[m.status] ?? "neutral"}
      >
        {ROTULO_STATUS_MOVIMENTACAO[m.status] ?? m.status}
      </StatusBadge>
    ),
  },
  {
    key: "motivo",
    header: "Motivo",
    cell: (m) => ROTULO_MOTIVO[m.motivoCodigo] ?? m.motivoCodigo,
  },
  {
    key: "vigencia",
    header: "Vigência",
    cell: (m) => formatarDiaCivil(m.vigenciaInicio),
  },
  {
    key: "registrada",
    header: "Registrada em",
    cell: (m) => formatarInstante(m.registradaEm),
  },
  {
    key: "efetivada",
    header: "Efetivada em",
    cell: (m) => formatarInstante(m.efetivadaEm),
  },
  { key: "observacao", header: "Observação", cell: observacao },
];

export function VidaFuncionalColaboradorSecao({
  colaboradorId,
  nomeColaborador,
  vinculo,
  lotacaoDaLinha = null,
  onAbrirHistorico,
  atalhoBloqueado = false,
}: VidaFuncionalColaboradorSecaoProps) {
  const tituloId = useId();
  const avisoAtalhoId = useId();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const vinculoId = vinculo?.id ?? null;

  const carregar = useCallback(async (id: string, ativo: () => boolean) => {
    setEstado({ tipo: "carregando" });
    try {
      const [linhaDoTempo, alocacoes] = await Promise.all([
        buscarLinhaDoTempo(id),
        listarAlocacoesVinculo(id),
      ]);
      if (!ativo()) return;
      setEstado({
        tipo: "dados",
        linhaDoTempo,
        alocacaoVigente: alocacoes.find((a) => a.vigenteAte === null) ?? null,
      });
    } catch (erro) {
      if (!ativo()) return;
      setEstado({ tipo: semAcesso(erro) ? "negado" : "erro" });
    }
  }, []);

  useEffect(() => {
    if (!vinculoId) return;
    // Resposta de outro vínculo (ou de uma ficha já fechada) é descartada.
    let ativo = true;
    void carregar(vinculoId, () => ativo);
    return () => {
      ativo = false;
    };
  }, [vinculoId, carregar]);

  /** Nome conhecido pela linha, só se for o mesmo vínculo e o mesmo id. */
  function nomeDaLotacao(
    campo: keyof LotacaoListadaApi,
    id: string | null,
  ): string {
    if (id === null) return "Não informado";
    const referencia =
      lotacaoDaLinha && lotacaoDaLinha.vinculoId === vinculoId
        ? lotacaoDaLinha.lotacao?.[campo]
        : null;
    return referencia && referencia.id === id
      ? referencia.nome
      : "Consulte no Histórico funcional";
  }

  const podeAbrir =
    vinculo !== null &&
    onAbrirHistorico !== undefined &&
    estado.tipo !== "negado";

  return (
    <section
      className="colaboradores-screen__vida-funcional"
      aria-labelledby={tituloId}
    >
      <h2 id={tituloId} className="colaboradores-screen__section-title">
        Vida funcional
      </h2>
      <p className="colaboradores-screen__vida-funcional-nota">
        Somente leitura. Registrar, efetivar, cancelar e retificar movimentações
        é feito no Histórico funcional.
      </p>

      {vinculo === null ? (
        <p>Sem vínculo nesta empresa: não há vida funcional para mostrar.</p>
      ) : (
        <>
          <p className="colaboradores-screen__vida-funcional-vinculo">
            Vínculo principal: {exibirMatricula(vinculo.matricula)} ·{" "}
            {ROTULO_SITUACAO_VINCULO[vinculo.situacao] ?? vinculo.situacao} ·
            admissão em {formatarDiaCivil(vinculo.dataAdmissao)}
          </p>

          {podeAbrir ? (
            <div className="colaboradores-screen__vida-funcional-atalho">
              <Button
                variant="secondary"
                disabled={atalhoBloqueado}
                {...(atalhoBloqueado
                  ? { "aria-describedby": avisoAtalhoId }
                  : {})}
                onClick={() =>
                  onAbrirHistorico({ colaboradorId, vinculoId: vinculo.id })
                }
              >
                Abrir no Histórico funcional
              </Button>
              {atalhoBloqueado ? (
                <span
                  id={avisoAtalhoId}
                  className="colaboradores-screen__vida-funcional-nota"
                >
                  Salve ou descarte as alterações da ficha para abrir o
                  Histórico funcional.
                </span>
              ) : null}
            </div>
          ) : null}

          {estado.tipo === "carregando" ? (
            <p className="colaboradores-screen__carregando" role="status">
              Carregando vida funcional…
            </p>
          ) : estado.tipo === "negado" ? (
            <p className="colaboradores-screen__vida-funcional-nota">
              Seu perfil não tem acesso à vida funcional deste vínculo.
            </p>
          ) : estado.tipo === "erro" ? (
            <p className="colaboradores-screen__form-erro" role="alert">
              Não foi possível carregar a vida funcional.{" "}
              <Button
                variant="secondary"
                onClick={() => void carregar(vinculo.id, () => true)}
              >
                Tentar novamente
              </Button>
            </p>
          ) : (
            <>
              <h3 className="colaboradores-screen__vida-funcional-subtitulo">
                Lotação vigente
              </h3>
              {estado.alocacaoVigente ? (
                <dl className="colaboradores-screen__vida-funcional-lotacao">
                  <div>
                    <dt>Departamento</dt>
                    <dd>
                      {nomeDaLotacao(
                        "departamento",
                        estado.alocacaoVigente.departamentoId,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Cargo</dt>
                    <dd>
                      {nomeDaLotacao("cargo", estado.alocacaoVigente.cargoId)}
                    </dd>
                  </div>
                  <div>
                    <dt>Vigente desde</dt>
                    <dd>
                      {formatarDiaCivil(estado.alocacaoVigente.vigenteDe)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p>
                  Sem lotação vigente: o vínculo não tem alocação aberta
                  (admissão ainda não efetivada ou vínculo encerrado).
                </p>
              )}

              <h3 className="colaboradores-screen__vida-funcional-subtitulo">
                Linha do tempo
              </h3>
              {estado.linhaDoTempo.length === 0 ? (
                <p>Nenhuma movimentação registrada para este vínculo.</p>
              ) : (
                <DataTable
                  caption={`Linha do tempo — ${nomeColaborador}`}
                  columns={COLUNAS}
                  rows={estado.linhaDoTempo}
                  rowKey={(m) => m.id}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
