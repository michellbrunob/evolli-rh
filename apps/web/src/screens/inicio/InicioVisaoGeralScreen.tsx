/**
 * Início > Visão geral (T048) — tela visual estática.
 *
 * Painel de resumo do administrativo: um card de exemplo por módulo já
 * disponível (Jornadas de trabalho, Pessoas, Ponto, Documentos) e um destaque para as
 * pendências de ponto a conferir. Cada atalho apenas troca o estado local de
 * "destino selecionado" já existente em `App` (`onNavegar`) — sem React
 * Router, sem URL real, sem API/fetch, sem persistência.
 *
 * Todo número aqui é ilustrativo e rotulado "(exemplo)": nada representa um
 * indicador real de nenhuma empresa.
 */
import { Button, PageHeader, StatusBadge, Surface } from "../../components";
import {
  PENDENCIAS_PONTO_EXEMPLO,
  RESUMOS_MODULO_EXEMPLO,
} from "./inicioVisaoGeral.fixtures";
import "./InicioVisaoGeralScreen.css";

export interface InicioVisaoGeralScreenProps {
  /** Troca o destino ativo do painel — mesmo estado local usado em `App`. */
  onNavegar: (destinoId: string) => void;
}

export function InicioVisaoGeralScreen({
  onNavegar,
}: InicioVisaoGeralScreenProps) {
  return (
    <div className="inicio-visao-geral-screen">
      <PageHeader
        headingLevel={1}
        titleId="inicio-visao-geral-titulo"
        title="Visão geral"
        description="Resumo do painel administrativo, com atalhos rápidos para os módulos já disponíveis."
      />

      <Surface
        as="section"
        padding="md"
        className="inicio-visao-geral-screen__aviso"
        aria-labelledby="inicio-visao-geral-aviso-titulo"
      >
        <StatusBadge variant="info">Versão demonstrativa</StatusBadge>
        <p
          id="inicio-visao-geral-aviso-titulo"
          className="inicio-visao-geral-screen__aviso-texto"
        >
          Esta visão geral ainda não usa dados operacionais — os números abaixo
          são exemplos ilustrativos, e os atalhos apenas trocam a tela exibida
          neste painel.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="lg"
        className="inicio-visao-geral-screen__destaque"
        aria-labelledby="inicio-visao-geral-destaque-titulo"
      >
        <StatusBadge variant="warning">Atenção</StatusBadge>
        <h2
          id="inicio-visao-geral-destaque-titulo"
          className="inicio-visao-geral-screen__destaque-titulo"
        >
          Pendências de ponto a conferir
        </h2>
        <p className="inicio-visao-geral-screen__destaque-metrica">
          {PENDENCIAS_PONTO_EXEMPLO} pendências (exemplo)
        </p>
        <p className="inicio-visao-geral-screen__destaque-texto">
          Folhas de ponto aguardando conferência do RH nesta empresa.
        </p>
        <Button variant="primary" onClick={() => onNavegar("ponto")}>
          Ir para Ponto
        </Button>
      </Surface>

      <section aria-labelledby="inicio-visao-geral-modulos-titulo">
        <h2
          id="inicio-visao-geral-modulos-titulo"
          className="inicio-visao-geral-screen__section-title"
        >
          Módulos
        </h2>
        <div className="inicio-visao-geral-screen__grade">
          {RESUMOS_MODULO_EXEMPLO.map((resumo) => (
            <Surface
              key={resumo.id}
              as="article"
              padding="md"
              className="inicio-visao-geral-screen__card"
              aria-labelledby={`${resumo.id}-titulo`}
            >
              <h3
                id={`${resumo.id}-titulo`}
                className="inicio-visao-geral-screen__card-titulo"
              >
                {resumo.titulo}
              </h3>
              <p className="inicio-visao-geral-screen__card-metrica">
                <StatusBadge variant="neutral">Exemplo</StatusBadge>{" "}
                {resumo.metrica}
              </p>
              <p className="inicio-visao-geral-screen__card-descricao">
                {resumo.descricao}
              </p>
              <Button
                variant="secondary"
                onClick={() => onNavegar(resumo.destinoId)}
              >
                {resumo.rotuloAtalho}
              </Button>
            </Surface>
          ))}
        </div>
      </section>
    </div>
  );
}
