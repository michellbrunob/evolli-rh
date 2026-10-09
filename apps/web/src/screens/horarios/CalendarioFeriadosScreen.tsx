/**
 * Cadastros > Calendário de feriados (T076) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar e organizar referências de feriados
 * por escopo (nacional, estadual, municipal, data móvel da empresa) — apenas
 * referências técnicas, data ilustrativa e situação de cada item. Não ativa
 * nenhuma operação real de calendário.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * Todo dado é sintético (`calendarioFeriados.fixtures.ts`), independente do
 * catálogo de "Horários" (T043) e de "Estrutura organizacional" (T073). Não
 * calcula jornada, escala, dias úteis, Banco de Horas ou Folha — os
 * contadores do resumo são apenas exemplos de interface.
 */
import { useMemo, useState } from "react";
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
import { formatarDiaCivil } from "../../format/data";
import {
  ANOS_ILUSTRATIVOS_DISPONIVEIS,
  type EscopoFeriado,
  FERIADOS_EXEMPLO,
  type FeriadoExemplo,
  ROTULO_ESCOPO_FERIADO,
  ROTULO_SITUACAO_FERIADO,
  type SituacaoFeriado,
} from "./calendarioFeriados.fixtures";
import "./CalendarioFeriadosScreen.css";

export const CALENDARIO_FERIADOS_TITULO_ID = "calendario-feriados-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoFeriado, StatusVariant> = {
  ativa: "success",
  inativa: "neutral",
  pendente_validacao: "warning",
};

const OPCAO_TODOS = "todos";

export function CalendarioFeriadosScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroAno, setFiltroAno] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : FERIADOS_EXEMPLO),
    [estadoDemo],
  );

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroAno !== OPCAO_TODOS &&
        String(linha.anoIlustrativo) !== filtroAno
      ) {
        return false;
      }
      if (filtroEscopo !== OPCAO_TODOS && linha.escopo !== filtroEscopo) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroAno, filtroEscopo, filtroSituacao]);

  const filtrosAtivos =
    filtroAno !== OPCAO_TODOS ||
    filtroEscopo !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroAno(OPCAO_TODOS);
    setFiltroEscopo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
  }

  const resumoPorEscopo = useMemo(() => {
    const contagem: Record<EscopoFeriado, number> = {
      nacional: 0,
      estadual: 0,
      municipal: 0,
      data_movel_empresa: 0,
    };
    for (const linha of linhasBase) {
      contagem[linha.escopo] += 1;
    }
    return contagem;
  }, [linhasBase]);

  const colunas: DataTableColumn<FeriadoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.referenciaTecnica}</code>,
    },
    {
      key: "data",
      header: "Data ilustrativa",
      cell: (linha) => formatarDiaCivil(linha.dataIlustrativa),
    },
    {
      key: "descricao",
      header: "Descrição sintética",
      cell: (linha) => linha.descricaoSintetica,
    },
    {
      key: "escopo",
      header: "Escopo",
      cell: (linha) => ROTULO_ESCOPO_FERIADO[linha.escopo],
    },
    {
      key: "abrangencia",
      header: "Unidade/abrangência técnica",
      cell: (linha) => linha.abrangenciaTecnica,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_FERIADO[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "responsavel",
      header: "Responsável técnico",
      cell: (linha) => linha.responsavelTecnico,
    },
  ];

  return (
    <div className="calendario-feriados-screen">
      <PageHeader
        headingLevel={1}
        titleId={CALENDARIO_FERIADOS_TITULO_ID}
        title="Calendário de feriados"
        description="Demonstração visual de como o RH poderá consultar e organizar referências de feriados por escopo — apenas referências técnicas e situação de cada item, nunca dado real."
      />

      <Surface
        as="section"
        padding="md"
        className="calendario-feriados-screen__aviso"
        aria-labelledby="calendario-feriados-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="calendario-feriados-aviso-rh-titulo"
          className="calendario-feriados-screen__aviso-texto"
        >
          O RH administra somente referências de feriados da própria empresa e
          das unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="calendario-feriados-screen__aviso"
        aria-labelledby="calendario-feriados-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="calendario-feriados-aviso-demo-titulo"
          className="calendario-feriados-screen__aviso-texto"
        >
          Esta é uma demonstração visual: não existe calendário operacional,
          importação oficial, integração externa ou persistência.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="calendario-feriados-screen__aviso calendario-feriados-screen__aviso--indisponivel"
        aria-labelledby="calendario-feriados-aviso-ativacao-titulo"
      >
        <StatusBadge variant="warning">Ativação futura</StatusBadge>
        <p
          id="calendario-feriados-aviso-ativacao-titulo"
          className="calendario-feriados-screen__aviso-texto"
        >
          Feriados nacionais, estaduais, municipais e datas móveis da empresa só
          poderão ser ativados com escopo, vigência, responsável, auditoria e
          validação aplicável. Alterações futuras não podem recalcular nem
          modificar períodos já fechados sem o fluxo próprio e autorizado.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="calendario-feriados-screen__aviso calendario-feriados-screen__aviso--indisponivel"
        aria-labelledby="calendario-feriados-aviso-bloqueio-titulo"
      >
        <StatusBadge variant="warning">Dado real bloqueado</StatusBadge>
        <p
          id="calendario-feriados-aviso-bloqueio-titulo"
          className="calendario-feriados-screen__aviso-texto"
        >
          Dado real continua bloqueado por MFA, pelo gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          demais validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="calendario-feriados-resumo-titulo"
        className="calendario-feriados-screen__resumo"
      >
        <h2
          id="calendario-feriados-resumo-titulo"
          className="calendario-feriados-screen__section-title"
        >
          Resumo por escopo (exemplo)
        </h2>
        <ul className="calendario-feriados-screen__resumo-lista">
          <li className="calendario-feriados-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="info">
                {resumoPorEscopo.nacional} nacional(is)
              </StatusBadge>
            </Surface>
          </li>
          <li className="calendario-feriados-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="info">
                {resumoPorEscopo.estadual} estadual(is)
              </StatusBadge>
            </Surface>
          </li>
          <li className="calendario-feriados-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="info">
                {resumoPorEscopo.municipal} municipal(is)
              </StatusBadge>
            </Surface>
          </li>
          <li className="calendario-feriados-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="info">
                {resumoPorEscopo.data_movel_empresa} data(s) móvel(is) da
                empresa
              </StatusBadge>
            </Surface>
          </li>
        </ul>
        <p className="calendario-feriados-screen__nota">
          Contadores e datas são apenas exemplos de interface — não calculam
          jornada, escala, pagamento, Banco de Horas ou Folha.
        </p>
      </section>

      <section
        aria-labelledby="calendario-feriados-demo-titulo"
        className="calendario-feriados-screen__demo"
      >
        <h2
          id="calendario-feriados-demo-titulo"
          className="calendario-feriados-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="calendario-feriados-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da listagem"
          className="calendario-feriados-screen__demo-botoes"
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
          className="calendario-feriados-screen__erro"
          aria-labelledby="calendario-feriados-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="calendario-feriados-erro-titulo"
            className="calendario-feriados-screen__section-title"
          >
            Não foi possível carregar o calendário de feriados
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="calendario-feriados-screen__erro-referencia">
            Referência: <code>REQ-DEMO-001267</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="calendario-feriados-lista-titulo">
          <h2
            id="calendario-feriados-lista-titulo"
            className="calendario-feriados-screen__section-title"
          >
            Feriados
          </h2>

          <div className="calendario-feriados-screen__filtros">
            <FormField
              id="calendario-feriados-filtro-ano"
              label="Ano ilustrativo"
            >
              {(control) => (
                <select
                  value={filtroAno}
                  onChange={(evento) => setFiltroAno(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os anos</option>
                  {ANOS_ILUSTRATIVOS_DISPONIVEIS.map((ano) => (
                    <option key={ano} value={String(ano)}>
                      {ano}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="calendario-feriados-filtro-escopo" label="Escopo">
              {(control) => (
                <select
                  value={filtroEscopo}
                  onChange={(evento) => setFiltroEscopo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os escopos</option>
                  {(Object.keys(ROTULO_ESCOPO_FERIADO) as EscopoFeriado[]).map(
                    (escopo) => (
                      <option key={escopo} value={escopo}>
                        {ROTULO_ESCOPO_FERIADO[escopo]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <FormField
              id="calendario-feriados-filtro-situacao"
              label="Situação"
            >
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(ROTULO_SITUACAO_FERIADO) as SituacaoFeriado[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_FERIADO[situacao]}
                    </option>
                  ))}
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
          <p className="calendario-feriados-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de feriado cadastrada"
              description="Quando houver uma referência de feriado desta empresa, ela aparece aqui (exemplo)."
            />
          ) : linhasFiltradas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum feriado corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver os demais feriados desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Calendário de feriados (exemplo)"
              columns={colunas}
              rows={linhasFiltradas}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}
    </div>
  );
}
