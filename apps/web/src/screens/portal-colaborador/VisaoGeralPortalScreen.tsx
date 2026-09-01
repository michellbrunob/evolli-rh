/**
 * Portal do Colaborador > Visão geral (T067) — tela visual estática.
 *
 * Panorama demonstrativo do futuro Portal do Colaborador: resumo de
 * solicitações, jornada/Banco de Horas de exemplo e atalhos locais para as
 * demais áreas. Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/
 * sessão/CSRF, sem rota real, sem persistência. Todo dado é sintético.
 */
import { useMemo } from "react";
import { Button, PageHeader, StatusBadge, Surface } from "../../components";
import { SOLICITACOES_EXEMPLO } from "./minhasSolicitacoes.fixtures";
import { RESUMO_BANCO_HORAS_PORTAL_EXEMPLO } from "./minhaJornada.fixtures";
import type { AbaPortalColaborador } from "./PortalColaboradorScreen";
import "./VisaoGeralPortalScreen.css";

export const VISAO_GERAL_PORTAL_TITULO_ID = "portal-visao-geral-titulo";

export interface VisaoGeralPortalScreenProps {
  /** Troca só a aba local do Portal — nunca navega de verdade nem chama API. */
  onNavegarAba: (aba: AbaPortalColaborador) => void;
}

export function VisaoGeralPortalScreen({
  onNavegarAba,
}: VisaoGeralPortalScreenProps) {
  const pendentes = useMemo(
    () =>
      SOLICITACOES_EXEMPLO.filter(
        (item) =>
          item.situacao !== "encaminhada_para_operacao_rh" &&
          item.situacao !== "recusada" &&
          item.situacao !== "cancelada",
      ).length,
    [],
  );

  return (
    <div className="visao-geral-portal-screen">
      <PageHeader
        headingLevel={1}
        titleId={VISAO_GERAL_PORTAL_TITULO_ID}
        title="Visão geral"
        description="Panorama demonstrativo do futuro Portal do Colaborador — solicitações, jornada e Banco de Horas apenas como exemplo."
      />

      <Surface
        as="section"
        padding="md"
        className="visao-geral-portal-screen__aviso"
        aria-labelledby="portal-visao-geral-aviso-titulo"
      >
        <StatusBadge variant="info">Ambiente demonstrativo</StatusBadge>
        <p
          id="portal-visao-geral-aviso-titulo"
          className="visao-geral-portal-screen__aviso-texto"
        >
          Esta é uma prévia de interface — não é um acesso real de colaborador.
          Todos os dados e valores abaixo são exemplos ilustrativos.
        </p>
      </Surface>

      <section
        aria-labelledby="portal-visao-geral-solicitacoes-titulo"
        className="visao-geral-portal-screen__bloco"
      >
        <h2
          id="portal-visao-geral-solicitacoes-titulo"
          className="visao-geral-portal-screen__section-title"
        >
          Minhas solicitações (exemplo)
        </h2>
        <Surface
          as="div"
          padding="md"
          className="visao-geral-portal-screen__card"
        >
          <StatusBadge variant={pendentes > 0 ? "warning" : "success"}>
            {pendentes} em andamento
          </StatusBadge>
          <StatusBadge variant="neutral">
            {SOLICITACOES_EXEMPLO.length} no total
          </StatusBadge>
          <Button variant="subtle" onClick={() => onNavegarAba("solicitacoes")}>
            Ver minhas solicitações
          </Button>
        </Surface>
      </section>

      <section
        aria-labelledby="portal-visao-geral-jornada-titulo"
        className="visao-geral-portal-screen__bloco"
      >
        <h2
          id="portal-visao-geral-jornada-titulo"
          className="visao-geral-portal-screen__section-title"
        >
          Minha jornada (exemplo)
        </h2>
        <Surface
          as="div"
          padding="md"
          className="visao-geral-portal-screen__card"
        >
          <dl className="visao-geral-portal-screen__resumo-lista">
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
          <Button variant="subtle" onClick={() => onNavegarAba("jornada")}>
            Ver minha jornada
          </Button>
        </Surface>
      </section>

      <section
        aria-labelledby="portal-visao-geral-atalhos-titulo"
        className="visao-geral-portal-screen__bloco"
      >
        <h2
          id="portal-visao-geral-atalhos-titulo"
          className="visao-geral-portal-screen__section-title"
        >
          Outras áreas
        </h2>
        <div className="visao-geral-portal-screen__atalhos">
          <Button
            variant="secondary"
            onClick={() => onNavegarAba("documentos")}
          >
            Meus documentos
          </Button>
        </div>
      </section>
    </div>
  );
}
