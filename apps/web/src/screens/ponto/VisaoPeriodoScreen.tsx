/**
 * Ponto > Visão do período (T063) — tela visual estática.
 *
 * Torna visível, apenas para demonstração, o fluxo já documentado e validado
 * nos núcleos puros de Ponto V1 (apuração → extrato/saldo de Banco de Horas →
 * fila "Verificar folhas" → fechamento → Espelho — T050 a T060,
 * `docs/modules/etapa3-jornada-ponto-v1-detalhada.md`,
 * `docs/decisions/prontidao-operacao-real-evolli-rh.md`). Não é uma integração
 * com esses núcleos: todo valor, estado e status aqui é um EXEMPLO fixo.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF, sem
 * rota real, sem persistência, sem associação por identificador, sem cálculo
 * de jornada/tolerância/banco de horas/DSR/fechamento/espelho/assinatura. Todo
 * dado é sintético (`visaoPeriodo.fixtures.ts`). O alternador de "estado de
 * demonstração" só recalcula o que é exibido em memória — nada é salvo,
 * enviado ou persistido.
 */
import { useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { StatusVariant } from "../../components";
import {
  contarPendenciasARevisar,
  ESTADO_PERIODO_EXEMPLO,
  ETAPA_ATUAL_INDICE_EXEMPLO,
  ETAPAS_FLUXO_EXEMPLO,
  formatarDataBr,
  PERIODO_EXEMPLO,
  RESUMO_BANCO_HORAS_EXEMPLO,
  RESUMO_JORNADA_EXEMPLO,
  ROTULO_ESTADO_PERIODO,
  STATUS_ESPELHO_EXEMPLO,
  STATUS_FECHAMENTO_EXEMPLO,
} from "./visaoPeriodo.fixtures";
import "./VisaoPeriodoScreen.css";

export const VISAO_PERIODO_TITULO_ID = "visao-periodo-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_ESTADO_PERIODO: StatusVariant = "info";

export interface VisaoPeriodoScreenProps {
  /** Chamado quando o exemplo convida a abrir a fila de revisão — troca só a
   * aba local de "Ponto"; nunca navega de verdade nem chama API. */
  onAbrirVerificarFolhas?: () => void;
}

export function VisaoPeriodoScreen({
  onAbrirVerificarFolhas,
}: VisaoPeriodoScreenProps) {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");

  const quantidadePendencias = useMemo(() => contarPendenciasARevisar(), []);

  return (
    <div className="visao-periodo-screen">
      <PageHeader
        headingLevel={1}
        titleId={VISAO_PERIODO_TITULO_ID}
        title="Visão do período"
        description="Panorama demonstrativo do fluxo de Ponto — apuração, extrato de Banco de Horas, fila de revisão e fechamento/Espelho — com dados de exemplo, sem cálculo, correção, aprovação ou persistência real."
      />

      <Surface
        as="section"
        padding="md"
        className="visao-periodo-screen__aviso"
        aria-labelledby="visao-periodo-aviso-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="visao-periodo-aviso-titulo"
          className="visao-periodo-screen__aviso-texto"
        >
          Somente o RH da própria empresa opera o Ponto. Todos os dados, status
          e valores abaixo são exemplos ilustrativos — esta tela não calcula,
          corrige, aprova, fecha, assina, paga ou persiste nada.
        </p>
      </Surface>

      <section
        aria-labelledby="visao-periodo-demo-titulo"
        className="visao-periodo-screen__demo"
      >
        <h2
          id="visao-periodo-demo-titulo"
          className="visao-periodo-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="visao-periodo-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da visão do período"
          className="visao-periodo-screen__demo-botoes"
        >
          {(Object.keys(ROTULO_ESTADO_DEMO) as EstadoDemonstracao[]).map(
            (chave) => (
              <Button
                key={chave}
                type="button"
                variant={estadoDemo === chave ? "primary" : "secondary"}
                aria-pressed={estadoDemo === chave}
                onClick={() => setEstadoDemo(chave)}
              >
                {ROTULO_ESTADO_DEMO[chave]}
              </Button>
            ),
          )}
        </div>
      </section>

      {estadoDemo === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="visao-periodo-screen__erro"
          aria-labelledby="visao-periodo-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="visao-periodo-erro-titulo"
            className="visao-periodo-screen__section-title"
          >
            Não foi possível carregar a visão do período
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="visao-periodo-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000789</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : estadoDemo === "vazio" ? (
        <EmptyState
          headingLevel={2}
          icon="—"
          title="Nenhum dado disponível para este período"
          description="Quando a apuração deste período estiver disponível, o panorama aparece aqui (exemplo)."
        />
      ) : (
        <>
          <section
            aria-labelledby="visao-periodo-cabecalho-titulo"
            className="visao-periodo-screen__cabecalho"
          >
            <h2
              id="visao-periodo-cabecalho-titulo"
              className="visao-periodo-screen__section-title"
            >
              Período de referência (exemplo)
            </h2>
            <Surface
              as="div"
              padding="md"
              className="visao-periodo-screen__cabecalho-card"
            >
              <p className="visao-periodo-screen__periodo">
                {formatarDataBr(PERIODO_EXEMPLO.inicio)} –{" "}
                {formatarDataBr(PERIODO_EXEMPLO.fim)}
              </p>
              <StatusBadge variant={VARIANTE_ESTADO_PERIODO}>
                {ROTULO_ESTADO_PERIODO[ESTADO_PERIODO_EXEMPLO]}
              </StatusBadge>
            </Surface>
          </section>

          <section
            aria-labelledby="visao-periodo-linha-tempo-titulo"
            className="visao-periodo-screen__linha-tempo"
          >
            <h2
              id="visao-periodo-linha-tempo-titulo"
              className="visao-periodo-screen__section-title"
            >
              Linha do tempo do fluxo (exemplo)
            </h2>
            <ol className="visao-periodo-screen__etapas">
              {ETAPAS_FLUXO_EXEMPLO.map((etapa, indice) => {
                const concluida = indice < ETAPA_ATUAL_INDICE_EXEMPLO;
                const atual = indice === ETAPA_ATUAL_INDICE_EXEMPLO;
                const estadoEtapa = concluida
                  ? "concluida"
                  : atual
                    ? "atual"
                    : "futura";
                const estadoEtapaRotulo = concluida
                  ? "concluída"
                  : atual
                    ? "atual"
                    : "futura";
                return (
                  <li
                    key={etapa.id}
                    className={`visao-periodo-screen__etapa visao-periodo-screen__etapa--${estadoEtapa}`}
                  >
                    <span
                      className="visao-periodo-screen__etapa-marcador"
                      aria-hidden="true"
                    >
                      {concluida ? "✓" : atual ? "●" : "○"}
                    </span>
                    <span className="visao-periodo-screen__etapa-rotulo">
                      {etapa.rotulo}
                      <span className="sr-only">
                        {" "}
                        ({estadoEtapaRotulo}, exemplo)
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section
            aria-labelledby="visao-periodo-jornada-titulo"
            className="visao-periodo-screen__jornada"
          >
            <h2
              id="visao-periodo-jornada-titulo"
              className="visao-periodo-screen__section-title"
            >
              Resumo de jornada (exemplo)
            </h2>
            <dl className="visao-periodo-screen__resumo-lista">
              <div>
                <dt>Jornada prevista</dt>
                <dd>{RESUMO_JORNADA_EXEMPLO.jornadaPrevistaMinutos} min</dd>
              </div>
              <div>
                <dt>Jornada computada</dt>
                <dd>{RESUMO_JORNADA_EXEMPLO.jornadaComputadaMinutos} min</dd>
              </div>
              <div>
                <dt>Apontamentos não financeiros</dt>
                <dd>{RESUMO_JORNADA_EXEMPLO.apontamentosNaoFinanceiros}</dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="visao-periodo-banco-horas-titulo"
            className="visao-periodo-screen__banco-horas"
          >
            <h2
              id="visao-periodo-banco-horas-titulo"
              className="visao-periodo-screen__section-title"
            >
              Banco de Horas (exemplo)
            </h2>
            <dl className="visao-periodo-screen__resumo-lista">
              <div>
                <dt>Crédito</dt>
                <dd>{RESUMO_BANCO_HORAS_EXEMPLO.creditoMinutos} min</dd>
              </div>
              <div>
                <dt>Débito</dt>
                <dd>{RESUMO_BANCO_HORAS_EXEMPLO.debitoMinutos} min</dd>
              </div>
              <div>
                <dt>Saldo derivado</dt>
                <dd>{RESUMO_BANCO_HORAS_EXEMPLO.saldoDerivadoMinutos} min</dd>
              </div>
            </dl>
            <p className="visao-periodo-screen__nota">
              Crédito e débito são sempre separados — o crédito nunca compensa o
              débito automaticamente; o saldo é apenas derivado da soma dos dois
              (exemplo).
            </p>
          </section>

          <section
            aria-labelledby="visao-periodo-pendencias-titulo"
            className="visao-periodo-screen__pendencias"
          >
            <h2
              id="visao-periodo-pendencias-titulo"
              className="visao-periodo-screen__section-title"
            >
              Fila "Verificar folhas" (exemplo)
            </h2>
            <Surface
              as="div"
              padding="md"
              className="visao-periodo-screen__pendencias-card"
            >
              <StatusBadge
                variant={quantidadePendencias > 0 ? "warning" : "success"}
              >
                {quantidadePendencias} pendência(s) a revisar
              </StatusBadge>
              {onAbrirVerificarFolhas ? (
                <Button variant="subtle" onClick={onAbrirVerificarFolhas}>
                  Ver fila completa
                </Button>
              ) : null}
            </Surface>
          </section>

          <section
            aria-labelledby="visao-periodo-fechamento-titulo"
            className="visao-periodo-screen__fechamento"
          >
            <h2
              id="visao-periodo-fechamento-titulo"
              className="visao-periodo-screen__section-title"
            >
              Fechamento e Espelho (exemplo)
            </h2>
            <dl className="visao-periodo-screen__resumo-lista">
              <div>
                <dt>Fechamento</dt>
                <dd>{STATUS_FECHAMENTO_EXEMPLO}</dd>
              </div>
              <div>
                <dt>Espelho</dt>
                <dd>{STATUS_ESPELHO_EXEMPLO}</dd>
              </div>
            </dl>
            <p className="visao-periodo-screen__nota">
              Nenhum documento, PDF ou assinatura real é gerado nesta
              demonstração.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
