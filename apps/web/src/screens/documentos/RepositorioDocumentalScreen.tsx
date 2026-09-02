/**
 * Documentos > Repositório documental (T070) — tela visual estática.
 *
 * Demonstra como uma visão de repositório documental poderia listar
 * referências técnicas, situação, validade ilustrativa, responsável técnico
 * e pendência de cada registro — sempre só metadado, nunca conteúdo de
 * arquivo.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA
 * funcional, sem rota real, sem persistência, sem backend, schema ou
 * dependência nova. Todo dado é sintético
 * (`repositorioDocumental.fixtures.ts`), independente do catálogo de
 * "Metadados" (T047).
 *
 * Proibições absolutas nesta tela, por design: nada de upload, anexo,
 * download, imagem, PDF, visualização ou armazenamento de conteúdo — os
 * avisos abaixo deixam isso explícito, junto com o que uma eventual
 * ativação futura desses recursos exigiria (retenção, base legal,
 * minimização, auditoria, MFA, DS-OPS-01 e validação RH + Jurídico).
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
import {
  formatarValidadeRepositorio,
  REGISTROS_REPOSITORIO_EXEMPLO,
  type RegistroRepositorioExemplo,
  ROTULO_SITUACAO_REPOSITORIO,
  type SituacaoRepositorio,
  TIPOS_REPOSITORIO_EXEMPLO,
} from "./repositorioDocumental.fixtures";
import "./RepositorioDocumentalScreen.css";

export const REPOSITORIO_DOCUMENTAL_TITULO_ID = "repositorio-documental-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoRepositorio, StatusVariant> = {
  vigente: "success",
  a_vencer: "warning",
  vencido: "danger",
  pendente_verificacao: "info",
};

const OPCAO_TODOS = "todos";

export function RepositorioDocumentalScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);

  const registrosBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : REGISTROS_REPOSITORIO_EXEMPLO),
    [estadoDemo],
  );

  const registrosFiltrados = useMemo(() => {
    return registrosBase.filter((registro) => {
      if (filtroTipo !== OPCAO_TODOS && registro.tipoDocumento !== filtroTipo) {
        return false;
      }
      if (
        filtroSituacao !== OPCAO_TODOS &&
        registro.situacao !== filtroSituacao
      ) {
        return false;
      }
      return true;
    });
  }, [registrosBase, filtroTipo, filtroSituacao]);

  const resumo = useMemo(() => {
    const contagem: Record<SituacaoRepositorio, number> = {
      vigente: 0,
      a_vencer: 0,
      vencido: 0,
      pendente_verificacao: 0,
    };
    for (const registro of registrosBase) {
      contagem[registro.situacao] += 1;
    }
    return contagem;
  }, [registrosBase]);

  const filtrosAtivos =
    filtroTipo !== OPCAO_TODOS || filtroSituacao !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroTipo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
  }

  const colunasTipos: DataTableColumn<
    (typeof TIPOS_REPOSITORIO_EXEMPLO)[number]
  >[] = [
    { key: "codigo", header: "Código", cell: (linha) => linha.codigo },
    { key: "nome", header: "Nome", cell: (linha) => linha.nome },
  ];

  const colunasRegistros: DataTableColumn<RegistroRepositorioExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.referenciaTecnica}</code>,
    },
    {
      key: "tipo",
      header: "Tipo documental",
      cell: (linha) => linha.tipoDocumento,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_REPOSITORIO[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "validade",
      header: "Validade (ilustrativa)",
      cell: (linha) => formatarValidadeRepositorio(linha),
    },
    {
      key: "responsavel",
      header: "Responsável técnico",
      cell: (linha) => linha.responsavelTecnico,
    },
    {
      key: "pendencia",
      header: "Pendência",
      cell: (linha) => linha.pendencia,
    },
  ];

  return (
    <div className="repositorio-documental-screen">
      <PageHeader
        headingLevel={1}
        titleId={REPOSITORIO_DOCUMENTAL_TITULO_ID}
        title="Repositório documental"
        description="Visão demonstrativa de um repositório documental — apenas referências técnicas e situação de cada registro, nunca o conteúdo do arquivo."
      />

      <Surface
        as="section"
        padding="md"
        className="repositorio-documental-screen__aviso"
        aria-labelledby="repositorio-documental-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração visual</StatusBadge>
        <p
          id="repositorio-documental-aviso-demo-titulo"
          className="repositorio-documental-screen__aviso-texto"
        >
          Esta tela é uma demonstração visual — não existe repositório real por
          trás dela. Upload, anexo, download, visualização de imagem ou PDF e
          armazenamento de conteúdo seguem indisponíveis; só metadados e
          referências técnicas são exibidos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="repositorio-documental-screen__aviso"
        aria-labelledby="repositorio-documental-aviso-ativacao-titulo"
      >
        <StatusBadge variant="warning">Ativação futura</StatusBadge>
        <p
          id="repositorio-documental-aviso-ativacao-titulo"
          className="repositorio-documental-screen__aviso-texto"
        >
          Qualquer ativação futura de upload, anexo, download ou armazenamento
          dependerá de decisão de retenção, base legal, minimização de dados,
          auditoria, MFA, da diretriz <code>DS-OPS-01</code> e de validação
          conjunta do RH e do Jurídico.
        </p>
      </Surface>

      <section aria-labelledby="repositorio-documental-tipos-titulo">
        <h2
          id="repositorio-documental-tipos-titulo"
          className="repositorio-documental-screen__section-title"
        >
          Catálogo de tipos documentais
        </h2>
        <DataTable
          caption="Catálogo de tipos documentais do repositório"
          columns={colunasTipos}
          rows={TIPOS_REPOSITORIO_EXEMPLO}
          rowKey={(linha) => linha.id}
        />
      </section>

      <section
        aria-labelledby="repositorio-documental-resumo-titulo"
        className="repositorio-documental-screen__resumo"
      >
        <h2
          id="repositorio-documental-resumo-titulo"
          className="repositorio-documental-screen__section-title"
        >
          Resumo por situação
        </h2>
        <ul className="repositorio-documental-screen__resumo-lista">
          <li className="repositorio-documental-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="success">
                {resumo.vigente} vigente(s)
              </StatusBadge>
            </Surface>
          </li>
          <li className="repositorio-documental-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="warning">
                {resumo.a_vencer} a vencer
              </StatusBadge>
            </Surface>
          </li>
          <li className="repositorio-documental-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="danger">
                {resumo.vencido} vencido(s)
              </StatusBadge>
            </Surface>
          </li>
          <li className="repositorio-documental-screen__resumo-item">
            <Surface as="div" padding="md">
              <StatusBadge variant="info">
                {resumo.pendente_verificacao} pendente(s) de verificação
              </StatusBadge>
            </Surface>
          </li>
        </ul>
        <p className="repositorio-documental-screen__resumo-nota">
          Contagem calculada só sobre os dados sintéticos desta demonstração.
        </p>
      </section>

      <section
        aria-labelledby="repositorio-documental-demo-titulo"
        className="repositorio-documental-screen__demo"
      >
        <h2
          id="repositorio-documental-demo-titulo"
          className="repositorio-documental-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="repositorio-documental-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da listagem"
          className="repositorio-documental-screen__demo-botoes"
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
          className="repositorio-documental-screen__erro"
          aria-labelledby="repositorio-documental-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="repositorio-documental-erro-titulo"
            className="repositorio-documental-screen__section-title"
          >
            Não foi possível carregar o repositório documental
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="repositorio-documental-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000789</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="repositorio-documental-lista-titulo">
          <h2
            id="repositorio-documental-lista-titulo"
            className="repositorio-documental-screen__section-title"
          >
            Registros do repositório
          </h2>

          <div className="repositorio-documental-screen__filtros">
            <FormField id="repositorio-filtro-tipo" label="Tipo documental">
              {(control) => (
                <select
                  value={filtroTipo}
                  onChange={(evento) => setFiltroTipo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {TIPOS_REPOSITORIO_EXEMPLO.map((tipo) => (
                    <option key={tipo.id} value={tipo.nome}>
                      {tipo.nome}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="repositorio-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_REPOSITORIO,
                    ) as SituacaoRepositorio[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_REPOSITORIO[situacao]}
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
          <p className="repositorio-documental-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {registrosBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum registro no repositório"
              description="Quando houver um registro documental para esta empresa, ele aparece aqui (exemplo)."
            />
          ) : registrosFiltrados.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum registro corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver os demais registros desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Registros do repositório documental"
              columns={colunasRegistros}
              rows={registrosFiltrados}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}
    </div>
  );
}
