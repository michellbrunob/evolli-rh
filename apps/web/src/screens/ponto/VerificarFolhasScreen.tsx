/**
 * Ponto > Verificar folhas (T045) — tela visual estática.
 *
 * Demonstra a fila de triagem descrita em
 * `docs/modules/etapa3-jornada-ponto-v1-detalhada.md` (§5): "expõe o que
 * precisa de atenção antes de um fechamento — sem ajustar, descontar,
 * compensar ou fechar automaticamente". A fila apenas sinaliza; a decisão e
 * a ação são humanas (RH), pelos fluxos próprios.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF, sem
 * rota real, sem persistência, sem associação por identificador, sem cálculo
 * de jornada/tolerância/banco de horas/DSR/fechamento/espelho/assinatura.
 * Todo dado é sintético (`verificarFolhas.fixtures.ts`). Filtros e o
 * alternador de "estado de demonstração" só recalculam o que é exibido em
 * memória — nada é salvo, enviado ou persistido. Todo botão é
 * explicitamente demonstrativo: nenhum executa ação real de tratamento.
 */
import { useId, useMemo, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  FormField,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  type EstadoPendencia,
  type PendenciaExemplo,
  PENDENCIAS_EXEMPLO,
  ROTULO_ESTADO,
  ROTULO_SEVERIDADE,
  ROTULO_TIPO,
  type SeveridadePendencia,
  type TipoPendencia,
  formatarDataBr,
} from "./verificarFolhas.fixtures";
import "./VerificarFolhasScreen.css";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SEVERIDADE: Record<SeveridadePendencia, StatusVariant> = {
  informativa: "info",
  atencao: "warning",
  critica: "danger",
};

const VARIANTE_ESTADO: Record<EstadoPendencia, StatusVariant> = {
  aberto: "neutral",
  em_analise: "info",
  resolvido: "success",
};

const OPCAO_TODOS = "todos";

export function VerificarFolhasScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSeveridade, setFiltroSeveridade] = useState<string>(OPCAO_TODOS);
  const [filtroEstado, setFiltroEstado] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const pendenciasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : PENDENCIAS_EXEMPLO),
    [estadoDemo],
  );

  const pendenciasFiltradas = useMemo(() => {
    return pendenciasBase.filter((pendencia) => {
      if (filtroTipo !== OPCAO_TODOS && pendencia.tipo !== filtroTipo) {
        return false;
      }
      if (
        filtroSeveridade !== OPCAO_TODOS &&
        pendencia.severidade !== filtroSeveridade
      ) {
        return false;
      }
      if (filtroEstado !== OPCAO_TODOS && pendencia.estado !== filtroEstado) {
        return false;
      }
      return true;
    });
  }, [pendenciasBase, filtroTipo, filtroSeveridade, filtroEstado]);

  const resumo = useMemo(() => {
    const contagem: Record<SeveridadePendencia, number> = {
      informativa: 0,
      atencao: 0,
      critica: 0,
    };
    for (const pendencia of pendenciasBase) {
      if (pendencia.estado !== "resolvido") {
        contagem[pendencia.severidade] += 1;
      }
    }
    return contagem;
  }, [pendenciasBase]);

  const filtrosAtivos =
    filtroTipo !== OPCAO_TODOS ||
    filtroSeveridade !== OPCAO_TODOS ||
    filtroEstado !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroTipo(OPCAO_TODOS);
    setFiltroSeveridade(OPCAO_TODOS);
    setFiltroEstado(OPCAO_TODOS);
  }

  const detalheAberto =
    detalheAbertoId != null
      ? pendenciasFiltradas.find((item) => item.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<PendenciaExemplo>[] = [
    { key: "vinculo", header: "Vínculo", cell: (linha) => linha.vinculo },
    {
      key: "dia",
      header: "Dia",
      cell: (linha) => formatarDataBr(linha.dia),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (linha) => ROTULO_TIPO[linha.tipo],
    },
    {
      key: "severidade",
      header: "Severidade",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SEVERIDADE[linha.severidade]}>
          {ROTULO_SEVERIDADE[linha.severidade]}
        </StatusBadge>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_ESTADO[linha.estado]}>
          {ROTULO_ESTADO[linha.estado]}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <Button variant="subtle" onClick={() => setDetalheAbertoId(linha.id)}>
          Ver detalhe
          <span className="sr-only"> — {linha.vinculo}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="verificar-folhas-screen">
      <PageHeader
        headingLevel={1}
        titleId="verificar-folhas-titulo"
        title="Verificar folhas"
        description="Fila de triagem que aponta situações do ponto que precisam de atenção antes de um fechamento — ela apenas sinaliza pendências, nunca ajusta, aprova, fecha ou calcula nada automaticamente."
      />

      <Surface
        as="section"
        padding="md"
        className="verificar-folhas-screen__aviso"
        aria-labelledby="verificar-folhas-aviso-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="verificar-folhas-aviso-titulo"
          className="verificar-folhas-screen__aviso-texto"
        >
          Somente o RH da própria empresa trata pendências desta fila. Nenhuma
          correção, aprovação, desconto ou fechamento é automático — toda ação
          de tratamento acontece nos fluxos próprios do RH, fora desta
          demonstração.
        </p>
      </Surface>

      <section
        aria-labelledby="verificar-folhas-resumo-titulo"
        className="verificar-folhas-screen__resumo"
      >
        <h2
          id="verificar-folhas-resumo-titulo"
          className="verificar-folhas-screen__section-title"
        >
          Resumo de pendências
        </h2>
        <ul className="verificar-folhas-screen__resumo-lista">
          <li className="verificar-folhas-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="danger">
                {resumo.critica} crítica(s)
              </StatusBadge>
            </Surface>
          </li>
          <li className="verificar-folhas-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="warning">
                {resumo.atencao} de atenção
              </StatusBadge>
            </Surface>
          </li>
          <li className="verificar-folhas-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="info">
                {resumo.informativa} informativa(s)
              </StatusBadge>
            </Surface>
          </li>
        </ul>
        <p className="verificar-folhas-screen__resumo-nota">
          Contagem apenas dos itens ainda não resolvidos, calculada só sobre os
          dados sintéticos desta demonstração.
        </p>
      </section>

      <section
        aria-labelledby="verificar-folhas-demo-titulo"
        className="verificar-folhas-screen__demo"
      >
        <h2
          id="verificar-folhas-demo-titulo"
          className="verificar-folhas-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="verificar-folhas-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da fila"
          className="verificar-folhas-screen__demo-botoes"
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
          className="verificar-folhas-screen__erro"
          aria-labelledby="verificar-folhas-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="verificar-folhas-erro-titulo"
            className="verificar-folhas-screen__section-title"
          >
            Não foi possível carregar a fila de pendências
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="verificar-folhas-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000456</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="verificar-folhas-lista-titulo">
          <h2
            id="verificar-folhas-lista-titulo"
            className="verificar-folhas-screen__section-title"
          >
            Pendências
          </h2>

          <div className="verificar-folhas-screen__filtros">
            <FormField id="filtro-tipo" label="Tipo">
              {(control) => (
                <select
                  value={filtroTipo}
                  onChange={(evento) => setFiltroTipo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {(Object.keys(ROTULO_TIPO) as TipoPendencia[]).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_TIPO[tipo]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="filtro-severidade" label="Severidade">
              {(control) => (
                <select
                  value={filtroSeveridade}
                  onChange={(evento) =>
                    setFiltroSeveridade(evento.target.value)
                  }
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as severidades</option>
                  {(
                    Object.keys(ROTULO_SEVERIDADE) as SeveridadePendencia[]
                  ).map((severidade) => (
                    <option key={severidade} value={severidade}>
                      {ROTULO_SEVERIDADE[severidade]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="filtro-estado" label="Estado">
              {(control) => (
                <select
                  value={filtroEstado}
                  onChange={(evento) => setFiltroEstado(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os estados</option>
                  {(Object.keys(ROTULO_ESTADO) as EstadoPendencia[]).map(
                    (estado) => (
                      <option key={estado} value={estado}>
                        {ROTULO_ESTADO[estado]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <Button
              variant="subtle"
              onClick={limparFiltros}
              disabled={!filtrosAtivos}
            >
              Limpar filtros
            </Button>
          </div>
          <p className="verificar-folhas-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {pendenciasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma pendência aberta"
              description="Quando houver situação a conferir nesta empresa, ela aparece aqui para triagem do RH."
            />
          ) : pendenciasFiltradas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma pendência corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver as demais pendências desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Pendências da fila de verificação"
              columns={colunas}
              rows={pendenciasFiltradas}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {detalheAberto ? (
        <Surface
          as="section"
          padding="lg"
          className="verificar-folhas-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <h2
            id={detalheTituloId}
            className="verificar-folhas-screen__section-title"
          >
            Detalhe da pendência — {detalheAberto.vinculo}
          </h2>
          <dl className="verificar-folhas-screen__detalhe-lista">
            <div>
              <dt>Dia</dt>
              <dd>{formatarDataBr(detalheAberto.dia)}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{ROTULO_TIPO[detalheAberto.tipo]}</dd>
            </div>
            <div>
              <dt>Severidade</dt>
              <dd>{ROTULO_SEVERIDADE[detalheAberto.severidade]}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{ROTULO_ESTADO[detalheAberto.estado]}</dd>
            </div>
            <div>
              <dt>Descrição</dt>
              <dd>{detalheAberto.detalhe}</dd>
            </div>
          </dl>
          <p className="verificar-folhas-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> abrir este detalhe não
            altera, ajusta, aprova, calcula nem fecha nenhuma pendência real. O
            tratamento efetivo desta fila acontece somente nos fluxos próprios
            do RH.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
