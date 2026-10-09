/**
 * Ponto > Banco de Horas (T069) — tela visual estática.
 *
 * Demonstra o extrato do Banco de Horas com crédito e débito **sempre
 * separados** e saldo **derivado** — mesmo conceito já validado no núcleo
 * puro T052 (`apps/api/src/ponto/banco-horas/`), mas esta tela **não** importa
 * nem chama aquele núcleo: tudo aqui é amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF, sem
 * rota real, sem persistência. Não há compensação efetiva, `debito_compensacao`,
 * quitação, pagamento, Folha, aprovação, ordem de consumo, validade/expiração
 * ou ajuste manual nesta demonstração — só o RH decide qualquer ação futura,
 * em fluxo próprio fora desta tela. Os alertas de saldo alto/negativo são
 * apenas informativos: nunca bloqueiam nem calculam nada.
 */
import { useMemo, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import { formatarDiaCivil } from "../../format/data";
import {
  EXTRATO_BANCO_HORAS_EXEMPLO,
  LIMIAR_ALERTA_ALTO_MINUTOS,
  LIMIAR_ALERTA_NEGATIVO_MINUTOS,
  type MovimentoBancoHorasExemplo,
  type NaturezaMovimentoExemplo,
  RESUMO_EXTRATO_EXEMPLO,
  ROTULO_ORIGEM_MOVIMENTO,
} from "./bancoHoras.fixtures";
import "./BancoHorasScreen.css";

export const BANCO_HORAS_TITULO_ID = "banco-horas-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const ROTULO_NATUREZA: Record<NaturezaMovimentoExemplo, string> = {
  credito: "Crédito",
  debito: "Débito",
};

const VARIANTE_NATUREZA: Record<NaturezaMovimentoExemplo, StatusVariant> = {
  credito: "success",
  debito: "warning",
};

export function BancoHorasScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");

  const linhas = useMemo(
    () => (estadoDemo === "vazio" ? [] : EXTRATO_BANCO_HORAS_EXEMPLO),
    [estadoDemo],
  );

  const colunas: DataTableColumn<MovimentoBancoHorasExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "data",
      header: "Data",
      cell: (linha) => formatarDiaCivil(linha.dataReferencia),
    },
    {
      key: "natureza",
      header: "Natureza",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_NATUREZA[linha.natureza]}>
          {ROTULO_NATUREZA[linha.natureza]}
        </StatusBadge>
      ),
    },
    {
      key: "origem",
      header: "Origem",
      cell: (linha) => ROTULO_ORIGEM_MOVIMENTO[linha.origem],
    },
    {
      key: "minutos",
      header: "Minutos",
      align: "end",
      cell: (linha) => `${linha.minutos} min`,
    },
  ];

  return (
    <div className="banco-horas-screen">
      <PageHeader
        headingLevel={1}
        titleId={BANCO_HORAS_TITULO_ID}
        title="Banco de Horas"
        description="Extrato demonstrativo do Banco de Horas — crédito e débito sempre separados, com saldo apenas derivado. Apenas exemplo, sem cálculo ou dado real."
      />

      <Surface
        as="section"
        padding="md"
        className="banco-horas-screen__aviso"
        aria-labelledby="banco-horas-aviso-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="banco-horas-aviso-titulo"
          className="banco-horas-screen__aviso-texto"
        >
          O saldo é apenas <strong>derivado</strong> dos movimentos abaixo — o
          RH decide qualquer ação futura de compensação ou quitação, em fluxo
          próprio fora desta demonstração. Não há pagamento, Folha, aprovação,
          ordem de consumo, validade/expiração, ajuste manual, persistência ou
          integração nesta tela.
        </p>
      </Surface>

      <section
        aria-labelledby="banco-horas-demo-titulo"
        className="banco-horas-screen__demo"
      >
        <h2
          id="banco-horas-demo-titulo"
          className="banco-horas-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="banco-horas-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração do extrato"
          className="banco-horas-screen__demo-botoes"
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
          className="banco-horas-screen__erro"
          aria-labelledby="banco-horas-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="banco-horas-erro-titulo"
            className="banco-horas-screen__section-title"
          >
            Não foi possível carregar o extrato do Banco de Horas
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="banco-horas-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000654</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <>
          <section
            aria-labelledby="banco-horas-resumo-titulo"
            className="banco-horas-screen__bloco"
          >
            <h2
              id="banco-horas-resumo-titulo"
              className="banco-horas-screen__section-title"
            >
              Resumo (exemplo)
            </h2>
            <dl className="banco-horas-screen__resumo-lista">
              <div>
                <dt>Crédito total</dt>
                <dd>{RESUMO_EXTRATO_EXEMPLO.totalCreditoMinutos} min</dd>
              </div>
              <div>
                <dt>Débito total</dt>
                <dd>{RESUMO_EXTRATO_EXEMPLO.totalDebitoMinutos} min</dd>
              </div>
              <div>
                <dt>Saldo derivado</dt>
                <dd>{RESUMO_EXTRATO_EXEMPLO.saldoDerivadoMinutos} min</dd>
              </div>
            </dl>
            <p className="banco-horas-screen__nota">
              Crédito e débito são sempre separados — o crédito nunca compensa o
              débito automaticamente; o saldo é apenas a soma assinada dos dois,
              nunca um evento "líquido" (exemplo).
            </p>
          </section>

          <section
            aria-labelledby="banco-horas-alertas-titulo"
            className="banco-horas-screen__bloco"
          >
            <h2
              id="banco-horas-alertas-titulo"
              className="banco-horas-screen__section-title"
            >
              Alertas informativos (exemplo)
            </h2>
            <ul className="banco-horas-screen__alertas">
              <li>
                <Surface
                  as="div"
                  padding="md"
                  className="banco-horas-screen__alerta"
                >
                  <StatusBadge variant="warning">Saldo alto</StatusBadge>
                  <p>
                    Exemplo de alerta quando o saldo ultrapassa{" "}
                    {LIMIAR_ALERTA_ALTO_MINUTOS} min (+38h) — apenas
                    informativo, não bloqueia nem calcula nada.
                  </p>
                </Surface>
              </li>
              <li>
                <Surface
                  as="div"
                  padding="md"
                  className="banco-horas-screen__alerta"
                >
                  <StatusBadge variant="danger">Saldo negativo</StatusBadge>
                  <p>
                    Exemplo de alerta quando o saldo fica abaixo de{" "}
                    {LIMIAR_ALERTA_NEGATIVO_MINUTOS} min (−24h) — apenas
                    informativo, não bloqueia nem calcula nada.
                  </p>
                </Surface>
              </li>
            </ul>
          </section>

          <section aria-labelledby="banco-horas-extrato-titulo">
            <h2
              id="banco-horas-extrato-titulo"
              className="banco-horas-screen__section-title"
            >
              Extrato cronológico
            </h2>

            {linhas.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhum movimento neste período"
                description="Quando houver movimento de Banco de Horas nesta empresa, ele aparece aqui (exemplo)."
              />
            ) : (
              <DataTable
                caption="Extrato do Banco de Horas"
                columns={colunas}
                rows={linhas}
                rowKey={(linha) => linha.id}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
