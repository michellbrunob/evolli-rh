/**
 * Pessoas > Horário de trabalho (T046) — tela visual estática.
 *
 * Demonstra a atribuição de tabela de horário ao colaborador com vigência,
 * conforme `docs/modules/etapa3-jornada-ponto-v1-detalhada.md` (§2.4): "o
 * horário é atribuído no cadastro do colaborador... com vigência" e
 * "mudanças de horário não podem alterar períodos já apurados — a apuração
 * de um dia permanece a que foi calculada com a versão de horário vigente
 * naquele dia". A fundação real desse vínculo já existe no backend
 * (`apps/api/src/horarios/vinculo/`), mas esta tela não a chama.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF, sem
 * rota real, sem persistência, sem alteração real de cadastro do
 * colaborador, sem cálculo de jornada/banco de horas/AFD/fechamento/
 * espelho/assinatura. Todo dado é sintético
 * (`pessoasHorario.fixtures.ts`). O formulário é inteiramente
 * demonstrativo: confirmar não atribui nem altera nenhuma tabela de
 * horário de verdade, e a listagem nunca é modificada por ele.
 */
import { useId, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  FormActions,
  FormField,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  type AtribuicaoHorarioExemplo,
  ATRIBUICOES_EXEMPLO,
  formatarVigencia,
  ROTULO_SITUACAO,
  type SituacaoVigencia,
  TABELAS_HORARIO_DISPONIVEIS,
} from "./pessoasHorario.fixtures";
import "./PessoasHorarioScreen.css";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

type FormularioAberto =
  | { modo: "novo" }
  | { modo: "editar"; atribuicao: AtribuicaoHorarioExemplo }
  | null;

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoVigencia, StatusVariant> = {
  vigente: "success",
  encerrada: "neutral",
};

export function PessoasHorarioScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [formulario, setFormulario] = useState<FormularioAberto>(null);
  const [confirmacaoVisivel, setConfirmacaoVisivel] = useState(false);
  const formTituloId = useId();

  const linhas = estadoDemo === "vazio" ? [] : ATRIBUICOES_EXEMPLO;

  function abrirNovo() {
    setConfirmacaoVisivel(false);
    setFormulario({ modo: "novo" });
  }

  function abrirEdicao(atribuicao: AtribuicaoHorarioExemplo) {
    setConfirmacaoVisivel(false);
    setFormulario({ modo: "editar", atribuicao });
  }

  function fecharFormulario() {
    setFormulario(null);
  }

  const colunas: DataTableColumn<AtribuicaoHorarioExemplo>[] = [
    { key: "vinculo", header: "Colaborador", cell: (linha) => linha.vinculo },
    {
      key: "tabela",
      header: "Tabela de horário",
      cell: (linha) => linha.tabelaHorario,
    },
    {
      key: "vigencia",
      header: "Início da vigência",
      cell: (linha) => formatarVigencia(linha),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <Button variant="subtle" onClick={() => abrirEdicao(linha)}>
          Atribuir/alterar
          <span className="sr-only"> — {linha.vinculo}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="pessoas-horario-screen">
      <PageHeader
        headingLevel={1}
        titleId="pessoas-horario-titulo"
        title="Horário de trabalho"
        description="O RH atribui uma tabela de horário ao colaborador, com vigência — a mesma tabela pode ser reaproveitada por vários colaboradores, e uma nova vigência substitui a anterior somente dali em diante."
        actions={<Button onClick={abrirNovo}>Nova atribuição</Button>}
      />

      <Surface
        as="section"
        padding="md"
        className="pessoas-horario-screen__aviso"
        aria-labelledby="pessoas-horario-aviso-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="pessoas-horario-aviso-titulo"
          className="pessoas-horario-screen__aviso-texto"
        >
          Somente o RH da própria empresa atribui ou altera a tabela de horário
          de um colaborador. Uma nova vigência vale apenas a partir da data de
          início escolhida — ela nunca altera a apuração de dias já calculados
          com a versão de horário anterior.
        </p>
      </Surface>

      <section
        aria-labelledby="pessoas-horario-demo-titulo"
        className="pessoas-horario-screen__demo"
      >
        <h2
          id="pessoas-horario-demo-titulo"
          className="pessoas-horario-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="pessoas-horario-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da listagem"
          className="pessoas-horario-screen__demo-botoes"
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
          className="pessoas-horario-screen__erro"
          aria-labelledby="pessoas-horario-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="pessoas-horario-erro-titulo"
            className="pessoas-horario-screen__section-title"
          >
            Não foi possível carregar as atribuições de horário
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="pessoas-horario-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000789</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="pessoas-horario-lista-titulo">
          <h2
            id="pessoas-horario-lista-titulo"
            className="pessoas-horario-screen__section-title"
          >
            Colaboradores com tabela de horário atribuída
          </h2>

          {linhas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma atribuição de horário cadastrada"
              description="Atribua uma tabela de horário a um colaborador desta empresa para que ela apareça aqui."
              action={<Button onClick={abrirNovo}>Nova atribuição</Button>}
            />
          ) : (
            <DataTable
              caption="Colaboradores com tabela de horário atribuída"
              columns={colunas}
              rows={linhas}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-horario-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2
            id={formTituloId}
            className="pessoas-horario-screen__section-title"
          >
            {formulario.modo === "novo"
              ? "Nova atribuição de horário"
              : `Alterar atribuição — ${formulario.atribuicao.vinculo}`}
          </h2>
          <p className="pessoas-horario-screen__demo-texto">
            Demonstração visual: nada é enviado, salvo ou realmente atribuído ao
            confirmar.
          </p>

          <form
            // `key` força o React a remontar os campos (não controlados, via
            // `defaultValue`) ao trocar entre "novo" e "editar" — mesma
            // técnica já usada em `CadastroHorariosScreen` (T043) para não
            // vazar o valor de uma edição anterior para um formulário novo.
            key={
              formulario.modo === "novo"
                ? "novo"
                : `editar-${formulario.atribuicao.id}`
            }
            className="pessoas-horario-screen__form"
            aria-label="Formulário de atribuição de horário"
            onSubmit={(evento) => {
              evento.preventDefault();
              setConfirmacaoVisivel(true);
            }}
          >
            <FormField
              id="atribuicao-vinculo"
              label="Colaborador (vínculo)"
              required
              help="Identificador abstrato do colaborador nesta demonstração — o cadastro real usa o vínculo funcional, nunca o nome."
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={60}
                  defaultValue={
                    formulario.modo === "editar"
                      ? formulario.atribuicao.vinculo
                      : ""
                  }
                  placeholder="Ex.: Vínculo V-050"
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="atribuicao-tabela"
              label="Tabela de horário"
              required
            >
              {(control) => (
                <select
                  defaultValue={
                    formulario.modo === "editar"
                      ? formulario.atribuicao.tabelaHorario
                      : ""
                  }
                  {...control}
                >
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {TABELAS_HORARIO_DISPONIVEIS.map((tabela) => (
                    <option key={tabela} value={tabela}>
                      {tabela}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="atribuicao-vigencia-inicio"
              label="Vigência — início"
              required
              help="A partir desta data a nova tabela passa a valer. Dias já apurados com a tabela anterior não são recalculados."
            >
              {(control) => (
                <input
                  type="date"
                  defaultValue={
                    formulario.modo === "editar"
                      ? formulario.atribuicao.vigenciaInicio
                      : ""
                  }
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="atribuicao-vigencia-exemplo-erro"
              label="Vigência — início (exemplo de validação)"
              error="Informe uma data no formato AAAA-MM-DD."
            >
              {(control) => (
                <input type="text" defaultValue="31/02/2026" {...control} />
              )}
            </FormField>

            {confirmacaoVisivel ? (
              <p className="pessoas-horario-screen__confirmacao" role="status">
                Ação apenas demonstrativa: nenhuma tabela de horário foi
                realmente atribuída, alterada ou salva.
              </p>
            ) : null}

            <FormActions>
              <Button variant="secondary" onClick={fecharFormulario}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Confirmar (demonstração)
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}
