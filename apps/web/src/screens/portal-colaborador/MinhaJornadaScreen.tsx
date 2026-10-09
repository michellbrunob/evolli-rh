/**
 * Portal do Colaborador > Minha jornada (T067) — tela visual estática.
 *
 * Panorama demonstrativo de jornada e Banco de Horas sob a ótica do
 * colaborador. Escopo: PURAMENTE visual. Sem `fetch`, sem persistência, sem
 * cálculo real. Todo dado é sintético.
 */
import { PageHeader, StatusBadge, Surface } from "../../components";
import { formatarDiaCivil } from "../../format/data";
import {
  APONTAMENTOS_PORTAL_EXEMPLO,
  PERIODO_JORNADA_EXEMPLO,
  RESUMO_BANCO_HORAS_PORTAL_EXEMPLO,
  RESUMO_JORNADA_PORTAL_EXEMPLO,
} from "./minhaJornada.fixtures";
import "./MinhaJornadaScreen.css";

export const MINHA_JORNADA_TITULO_ID = "portal-jornada-titulo";

export function MinhaJornadaScreen() {
  return (
    <div className="minha-jornada-screen">
      <PageHeader
        headingLevel={1}
        titleId={MINHA_JORNADA_TITULO_ID}
        title="Minha jornada"
        description="Panorama demonstrativo da jornada e do Banco de Horas — apenas exemplo, sem cálculo ou dado real."
      />

      <Surface
        as="section"
        padding="md"
        className="minha-jornada-screen__aviso"
        aria-labelledby="portal-jornada-aviso-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="portal-jornada-aviso-titulo"
          className="minha-jornada-screen__aviso-texto"
        >
          Uma contestação enviada por aqui não altera marcação, saldo ou
          fechamento automaticamente — ela apenas registra a intenção do
          colaborador para revisão do RH.
        </p>
      </Surface>

      <section
        aria-labelledby="portal-jornada-periodo-titulo"
        className="minha-jornada-screen__bloco"
      >
        <h2
          id="portal-jornada-periodo-titulo"
          className="minha-jornada-screen__section-title"
        >
          Período de referência (exemplo)
        </h2>
        <p className="minha-jornada-screen__periodo">
          {formatarDiaCivil(PERIODO_JORNADA_EXEMPLO.inicio)} –{" "}
          {formatarDiaCivil(PERIODO_JORNADA_EXEMPLO.fim)}
        </p>
      </section>

      <section
        aria-labelledby="portal-jornada-resumo-titulo"
        className="minha-jornada-screen__bloco"
      >
        <h2
          id="portal-jornada-resumo-titulo"
          className="minha-jornada-screen__section-title"
        >
          Resumo de jornada (exemplo)
        </h2>
        <dl className="minha-jornada-screen__resumo-lista">
          <div>
            <dt>Jornada prevista</dt>
            <dd>{RESUMO_JORNADA_PORTAL_EXEMPLO.jornadaPrevistaMinutos} min</dd>
          </div>
          <div>
            <dt>Jornada computada</dt>
            <dd>{RESUMO_JORNADA_PORTAL_EXEMPLO.jornadaComputadaMinutos} min</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="portal-jornada-banco-titulo"
        className="minha-jornada-screen__bloco"
      >
        <h2
          id="portal-jornada-banco-titulo"
          className="minha-jornada-screen__section-title"
        >
          Banco de Horas (exemplo)
        </h2>
        <dl className="minha-jornada-screen__resumo-lista">
          <div>
            <dt>Crédito</dt>
            <dd>{RESUMO_BANCO_HORAS_PORTAL_EXEMPLO.creditoMinutos} min</dd>
          </div>
          <div>
            <dt>Débito</dt>
            <dd>{RESUMO_BANCO_HORAS_PORTAL_EXEMPLO.debitoMinutos} min</dd>
          </div>
          <div>
            <dt>Saldo derivado</dt>
            <dd>
              {RESUMO_BANCO_HORAS_PORTAL_EXEMPLO.saldoDerivadoMinutos} min
            </dd>
          </div>
        </dl>
        <p className="minha-jornada-screen__nota">
          Crédito e débito são sempre separados — o crédito nunca compensa o
          débito automaticamente; o saldo é apenas derivado da soma dos dois
          (exemplo).
        </p>
      </section>

      <section
        aria-labelledby="portal-jornada-apontamentos-titulo"
        className="minha-jornada-screen__bloco"
      >
        <h2
          id="portal-jornada-apontamentos-titulo"
          className="minha-jornada-screen__section-title"
        >
          Apontamentos (exemplo)
        </h2>
        <ul className="minha-jornada-screen__apontamentos">
          {APONTAMENTOS_PORTAL_EXEMPLO.map((item) => (
            <li key={item.dia}>
              {formatarDiaCivil(item.dia)} — {item.rotulo}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
