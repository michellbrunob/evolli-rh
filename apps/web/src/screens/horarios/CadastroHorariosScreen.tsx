/**
 * Cadastros > Horários (T043) — tela visual estática.
 *
 * Lista tabelas de horário e abre um formulário de cadastro/edição, seguindo
 * a fundação do módulo já implementado no backend
 * (`apps/api/src/horarios/`, T038) e a spec de Jornada/Ponto V1
 * (`docs/modules/etapa3-jornada-ponto-v1-detalhada.md`, §2.4: RH único
 * operador, cadastro por empresa, definição de períodos imutável — "alterar"
 * é nova revisão/vigência).
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF, sem
 * rota real, sem persistência, sem cálculo de jornada. Todo dado é sintético
 * (`horarios.fixtures.ts`). O botão "estado de demonstração" só troca qual
 * amostra visual é exibida (dados / vazio / erro) — não representa nenhuma
 * chamada de rede nem falha real.
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
import type { DataTableColumn } from "../../components";
import {
  formatarVigencia,
  listarDiasUteis,
  resumirFaixas,
  TABELAS_HORARIO_EXEMPLO,
  type TabelaHorarioExemplo,
} from "./horarios.fixtures";
import "./CadastroHorariosScreen.css";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

type FormularioAberto =
  { modo: "novo" } | { modo: "editar"; tabela: TabelaHorarioExemplo } | null;

const ROTULO_ESTADO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

export function CadastroHorariosScreen() {
  const [estado, setEstado] = useState<EstadoDemonstracao>("dados");
  const [formulario, setFormulario] = useState<FormularioAberto>(null);
  const formTituloId = useId();

  const linhas = estado === "vazio" ? [] : TABELAS_HORARIO_EXEMPLO;

  const colunas: DataTableColumn<TabelaHorarioExemplo>[] = [
    { key: "nome", header: "Nome da tabela", cell: (linha) => linha.nome },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge
          variant={linha.situacao === "ativa" ? "success" : "neutral"}
        >
          {linha.situacao === "ativa" ? "Ativa" : "Inativa"}
        </StatusBadge>
      ),
    },
    {
      key: "dias",
      header: "Dias úteis",
      cell: (linha) => listarDiasUteis(linha.faixas),
    },
    {
      key: "faixas",
      header: "Faixas de entrada/saída",
      cell: (linha) => resumirFaixas(linha.faixas),
    },
    {
      key: "vigencia",
      header: "Vigência",
      cell: (linha) => formatarVigencia(linha),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <Button
          variant="subtle"
          onClick={() => setFormulario({ modo: "editar", tabela: linha })}
        >
          Editar
          <span className="sr-only"> {linha.nome}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="horarios-screen">
      <PageHeader
        headingLevel={1}
        titleId="horarios-titulo"
        title="Horários"
        description="Cadastro das tabelas de horário da própria empresa — grade semanal de faixas de entrada/saída e período de vigência."
        actions={
          <Button onClick={() => setFormulario({ modo: "novo" })}>
            Nova tabela de horário
          </Button>
        }
      />

      <Surface
        as="section"
        padding="md"
        className="horarios-screen__aviso"
        aria-labelledby="horarios-aviso-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p id="horarios-aviso-titulo" className="horarios-screen__aviso-texto">
          Este cadastro é operado exclusivamente pelo RH da própria empresa. Os
          demais perfis não visualizam nem alteram tabelas de horário aqui.
        </p>
      </Surface>

      <section
        aria-labelledby="horarios-demo-titulo"
        className="horarios-screen__demo"
      >
        <h2
          id="horarios-demo-titulo"
          className="horarios-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="horarios-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da listagem"
          className="horarios-screen__demo-botoes"
        >
          {(Object.keys(ROTULO_ESTADO) as EstadoDemonstracao[]).map((chave) => (
            <Button
              key={chave}
              type="button"
              variant={estado === chave ? "primary" : "secondary"}
              aria-pressed={estado === chave}
              onClick={() => setEstado(chave)}
            >
              {ROTULO_ESTADO[chave]}
            </Button>
          ))}
        </div>
      </section>

      {estado === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="horarios-screen__erro"
          aria-labelledby="horarios-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="horarios-erro-titulo"
            className="horarios-screen__section-title"
          >
            Não foi possível carregar as tabelas de horário
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="horarios-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000123</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstado("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="horarios-lista-titulo">
          <h2
            id="horarios-lista-titulo"
            className="horarios-screen__section-title"
          >
            Tabelas de horário
          </h2>

          {linhas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma tabela de horário cadastrada"
              description="Cadastre a primeira tabela de horário desta empresa para vinculá-la a colaboradores."
              action={
                <Button onClick={() => setFormulario({ modo: "novo" })}>
                  Cadastrar tabela de horário
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Tabelas de horário cadastradas"
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
          className="horarios-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2 id={formTituloId} className="horarios-screen__section-title">
            {formulario.modo === "novo"
              ? "Nova tabela de horário"
              : `Editar tabela — ${formulario.tabela.nome}`}
          </h2>
          <p className="horarios-screen__demo-texto">
            Demonstração visual: nada é enviado nem salvo ao confirmar.
          </p>

          <form
            // `key` força o React a remontar os campos (não controlados, via
            // `defaultValue`) ao trocar entre "novo" e "editar" — sem isso, o
            // valor de um registro editado anteriormente vazaria para o
            // formulário de uma nova tabela aberto em seguida.
            key={
              formulario.modo === "novo"
                ? "novo"
                : `editar-${formulario.tabela.id}`
            }
            className="horarios-screen__form"
            aria-label="Formulário de tabela de horário"
            onSubmit={(evento) => {
              evento.preventDefault();
              setFormulario(null);
            }}
          >
            <FormField
              id="horario-nome"
              label="Nome da tabela"
              required
              help="Nome interno usado para identificar a tabela no cadastro."
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={120}
                  defaultValue={
                    formulario.modo === "editar" ? formulario.tabela.nome : ""
                  }
                  placeholder="Ex.: Tabela Administrativo"
                  {...control}
                />
              )}
            </FormField>

            <FormField id="horario-situacao" label="Situação" required>
              {(control) => (
                <select
                  defaultValue={
                    formulario.modo === "editar"
                      ? formulario.tabela.situacao
                      : "ativa"
                  }
                  {...control}
                >
                  <option value="ativa">Ativa</option>
                  <option value="inativa">Inativa</option>
                </select>
              )}
            </FormField>

            <div className="horarios-screen__form-linha">
              <FormField
                id="horario-vigencia-inicio"
                label="Vigência — início"
                required
              >
                {(control) => (
                  <input
                    type="date"
                    defaultValue={
                      formulario.modo === "editar"
                        ? formulario.tabela.vigenciaInicio
                        : ""
                    }
                    {...control}
                  />
                )}
              </FormField>

              <FormField
                id="horario-vigencia-fim"
                label="Vigência — fim"
                help="Deixe em branco para vigência em aberto."
              >
                {(control) => (
                  <input
                    type="date"
                    defaultValue={
                      formulario.modo === "editar"
                        ? (formulario.tabela.vigenciaFim ?? "")
                        : ""
                    }
                    {...control}
                  />
                )}
              </FormField>
            </div>

            <FormField
              id="horario-periodos"
              label="Períodos da semana"
              help="Estrutura ilustrativa (dia, entrada e saída) — o editor real da grade semanal por dia é detalhe de implementação futura."
            >
              {(control) => (
                <textarea
                  rows={3}
                  defaultValue={
                    formulario.modo === "editar"
                      ? resumirFaixas(formulario.tabela.faixas)
                      : ""
                  }
                  placeholder="Ex.: Seg: 09:00–12:00 / 13:00–18:00 · Sex: 09:00–12:00 / 13:00–17:00"
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="horario-exemplo-erro"
              label="Faixa de horário (exemplo de validação)"
              error="Informe um horário válido no formato HH:MM."
            >
              {(control) => (
                <input type="text" defaultValue="25:00–12:00" {...control} />
              )}
            </FormField>

            <FormActions>
              <Button variant="secondary" onClick={() => setFormulario(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Salvar
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}
