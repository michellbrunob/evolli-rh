/**
 * Cadastros > Cidades e localidades (T087) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar referências técnicas de localidade
 * por escopo técnico e unidade/abrangência técnica — sem alterar endereço,
 * unidade, feriado, jornada, ponto, Banco de Horas, Folha, elegibilidade,
 * permissão ou acesso. Tudo aqui é amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * Sem geolocalização, mapa, CEP ou endereço real em nenhum lugar. O painel
 * de detalhe é só leitura: nenhuma ação cria, edita, associa, localiza,
 * valida, aprova, salva, importa, exporta, usa mapa, consulta endereço ou
 * altera dados reais.
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
  type CidadeLocalidadeExemplo,
  CIDADES_LOCALIDADES_EXEMPLO,
  ROTULO_SITUACAO_CIDADE_LOCALIDADE,
  type SituacaoCidadeLocalidade,
} from "./cidadesLocalidades.fixtures";
import "./CidadesLocalidadesScreen.css";

export const CIDADES_LOCALIDADES_TITULO_ID = "cidades-localidades-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoCidadeLocalidade, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function CidadesLocalidadesScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroUnidade, setFiltroUnidade] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : CIDADES_LOCALIDADES_EXEMPLO),
    [estadoDemo],
  );

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      CIDADES_LOCALIDADES_EXEMPLO.map((linha) => linha.escopoTecnico),
    );
    return Array.from(unicos);
  }, []);

  const unidadesDisponiveis = useMemo(() => {
    const unicos = new Set(
      CIDADES_LOCALIDADES_EXEMPLO.map(
        (linha) => linha.unidadeAbrangenciaTecnica,
      ),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroEscopo !== OPCAO_TODOS &&
        linha.escopoTecnico !== filtroEscopo
      ) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroUnidade !== OPCAO_TODOS &&
        linha.unidadeAbrangenciaTecnica !== filtroUnidade
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroEscopo, filtroSituacao, filtroUnidade]);

  const filtrosAtivos =
    filtroEscopo !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroUnidade !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroEscopo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroUnidade(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const escoposTecnicos = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      escoposTecnicos.add(linha.escopoTecnico);
      if (linha.situacao === "referencia_em_revisao_exemplo") {
        totalEmRevisao += 1;
      }
      if (linha.situacao === "aguardando_decisao_exemplo") {
        totalAguardandoDecisao += 1;
      }
      if (linha.situacao === "historico_ilustrativo") {
        totalHistorico += 1;
      }
    }
    return {
      totalLocalidades: linhasBase.length,
      totalEscopos: escoposTecnicos.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<CidadeLocalidadeExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "codigo",
      header: "Código ilustrativo",
      cell: (linha) => linha.codigoIlustrativo,
    },
    {
      key: "localidade",
      header: "Localidade técnica",
      cell: (linha) => linha.localidadeTecnica,
    },
    {
      key: "escopo",
      header: "Escopo técnico",
      cell: (linha) => linha.escopoTecnico,
    },
    {
      key: "unidade",
      header: "Unidade/abrangência técnica",
      cell: (linha) => linha.unidadeAbrangenciaTecnica,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_CIDADE_LOCALIDADE[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "responsavel",
      header: "Responsável técnico",
      cell: (linha) => linha.responsavelTecnico,
    },
    {
      key: "trilha",
      header: "Trilha de auditoria",
      cell: (linha) => linha.trilhaAuditoria,
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <Button variant="subtle" onClick={() => setDetalheAbertoId(linha.id)}>
          Ver detalhe
          <span className="sr-only"> — {linha.id}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="cidades-localidades-screen">
      <PageHeader
        headingLevel={1}
        titleId={CIDADES_LOCALIDADES_TITULO_ID}
        title="Cidades e localidades"
        description="Demonstração visual de como o RH poderá consultar referências técnicas de localidade por escopo técnico e unidade/abrangência técnica."
      />

      <Surface
        as="section"
        padding="md"
        className="cidades-localidades-screen__aviso"
        aria-labelledby="cidades-localidades-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="cidades-localidades-aviso-rh-titulo"
          className="cidades-localidades-screen__aviso-texto"
        >
          O catálogo é limitado à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="cidades-localidades-screen__aviso"
        aria-labelledby="cidades-localidades-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="cidades-localidades-aviso-demo-titulo"
          className="cidades-localidades-screen__aviso-texto"
        >
          Não há login, API, persistência, geolocalização, mapa, endereço, CEP,
          importação, exportação ou alteração cadastral real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="cidades-localidades-screen__aviso cidades-localidades-screen__aviso--indisponivel"
        aria-labelledby="cidades-localidades-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">
          Referência não é endereço ou regra
        </StatusBadge>
        <p
          id="cidades-localidades-aviso-referencia-titulo"
          className="cidades-localidades-screen__aviso-texto"
        >
          Cidade/localidade é referência técnica; não altera endereço, unidade,
          feriado, jornada, ponto, Banco de Horas, Folha, elegibilidade,
          permissão ou acesso.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="cidades-localidades-screen__aviso cidades-localidades-screen__aviso--indisponivel"
        aria-labelledby="cidades-localidades-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="cidades-localidades-aviso-dados-titulo"
          className="cidades-localidades-screen__aviso-texto"
        >
          Qualquer operação real exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis de RH, Jurídico/privacidade, Folha/DP e TI.
        </p>
      </Surface>

      <section
        aria-labelledby="cidades-localidades-resumo-titulo"
        className="cidades-localidades-screen__resumo"
      >
        <h2
          id="cidades-localidades-resumo-titulo"
          className="cidades-localidades-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="cidades-localidades-screen__resumo-lista">
          <li className="cidades-localidades-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="cidades-localidades-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Localidades</StatusBadge>
              <p className="cidades-localidades-screen__resumo-item-texto">
                {resumo.totalLocalidades} localidade(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="cidades-localidades-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="cidades-localidades-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Escopos técnicos</StatusBadge>
              <p className="cidades-localidades-screen__resumo-item-texto">
                {resumo.totalEscopos} escopo(s) técnico(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="cidades-localidades-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="cidades-localidades-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="cidades-localidades-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="cidades-localidades-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="cidades-localidades-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="cidades-localidades-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="cidades-localidades-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="cidades-localidades-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="cidades-localidades-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) ilustrativo(s)
                (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="cidades-localidades-screen__nota">
          Os indicadores não localizam pessoa, não exibem endereço, coordenada,
          mapa, CEP ou dado real; não calculam feriado, jornada, pagamento,
          desconto, Banco de Horas, Folha ou integração.
        </p>
      </section>

      <section
        aria-labelledby="cidades-localidades-demo-titulo"
        className="cidades-localidades-screen__demo"
      >
        <h2
          id="cidades-localidades-demo-titulo"
          className="cidades-localidades-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="cidades-localidades-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração das referências de localidade"
          className="cidades-localidades-screen__demo-botoes"
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
          className="cidades-localidades-screen__erro"
          aria-labelledby="cidades-localidades-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="cidades-localidades-erro-titulo"
            className="cidades-localidades-screen__section-title"
          >
            Não foi possível carregar as referências de localidade
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="cidades-localidades-screen__erro-referencia">
            Referência: <code>REQ-DEMO-007014</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="cidades-localidades-lista-titulo">
          <h2
            id="cidades-localidades-lista-titulo"
            className="cidades-localidades-screen__section-title"
          >
            Referências de localidade
          </h2>

          <div className="cidades-localidades-screen__filtros">
            <FormField id="cidades-localidades-filtro-escopo" label="Escopo">
              {(control) => (
                <select
                  value={filtroEscopo}
                  onChange={(evento) => setFiltroEscopo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os escopos</option>
                  {escoposDisponiveis.map((escopo) => (
                    <option key={escopo} value={escopo}>
                      {escopo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="cidades-localidades-filtro-situacao"
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
                    Object.keys(
                      ROTULO_SITUACAO_CIDADE_LOCALIDADE,
                    ) as SituacaoCidadeLocalidade[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_CIDADE_LOCALIDADE[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="cidades-localidades-filtro-unidade"
              label="Unidade/abrangência técnica"
            >
              {(control) => (
                <select
                  value={filtroUnidade}
                  onChange={(evento) => setFiltroUnidade(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as unidades</option>
                  {unidadesDisponiveis.map((unidade) => (
                    <option key={unidade} value={unidade}>
                      {unidade}
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
          <p className="cidades-localidades-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de localidade cadastrada"
              description="Quando houver uma referência desta empresa, ela aparece aqui (exemplo)."
            />
          ) : linhasFiltradas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver as demais referências desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Cidades e localidades (exemplo)"
              columns={colunas}
              rows={linhasFiltradas}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {detalheAberto ? (
        <Surface
          as="section"
          padding="lg"
          className="cidades-localidades-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="cidades-localidades-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="cidades-localidades-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Código ilustrativo</dt>
              <dd>{detalheAberto.codigoIlustrativo}</dd>
            </div>
            <div>
              <dt>Localidade técnica</dt>
              <dd>{detalheAberto.localidadeTecnica}</dd>
            </div>
            <div>
              <dt>Escopo técnico</dt>
              <dd>{detalheAberto.escopoTecnico}</dd>
            </div>
            <div>
              <dt>Unidade/abrangência técnica</dt>
              <dd>{detalheAberto.unidadeAbrangenciaTecnica}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {ROTULO_SITUACAO_CIDADE_LOCALIDADE[detalheAberto.situacao]}
              </dd>
            </div>
            <div>
              <dt>Responsável técnico</dt>
              <dd>{detalheAberto.responsavelTecnico}</dd>
            </div>
            <div>
              <dt>Trilha de auditoria</dt>
              <dd>{detalheAberto.trilhaAuditoria}</dd>
            </div>
          </dl>

          <h3 className="cidades-localidades-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="cidades-localidades-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="cidades-localidades-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="cidades-localidades-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, associa, localiza, valida, aprova, salva, importa, exporta,
            usa mapa, consulta endereço nem altera dados reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
