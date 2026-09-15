import { useCallback, useEffect, useId, useState } from "react";
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
  type CriarTabelaHorarioDto,
  type DiaSemana,
  type PeriodoApi,
  type TabelaHorarioApi,
  criarTabelaHorario,
  desativarTabelaHorario,
  listarTabelasHorario,
  reativarTabelaHorario,
} from "../../api/horariosClient";
import "./CadastroHorariosScreen.css";

export const HORARIOS_TITULO_ID = "horarios-titulo";

const DIAS_SEMANA: { valor: DiaSemana; rotulo: string }[] = [
  { valor: "segunda", rotulo: "Segunda-feira" },
  { valor: "terca", rotulo: "Terça-feira" },
  { valor: "quarta", rotulo: "Quarta-feira" },
  { valor: "quinta", rotulo: "Quinta-feira" },
  { valor: "sexta", rotulo: "Sexta-feira" },
  { valor: "sabado", rotulo: "Sábado" },
  { valor: "domingo", rotulo: "Domingo" },
];

const ROTULO_DIA: Record<string, string> = Object.fromEntries(
  DIAS_SEMANA.map(({ valor, rotulo }) => [valor, rotulo]),
);

const VARIANTE_STATUS: Record<string, StatusVariant> = {
  true: "success",
  false: "neutral",
};

type FiltroAtivo = "todos" | "ativo" | "inativo";

let uidCounter = 0;
function novoUid(): string {
  return `p${++uidCounter}`;
}

interface PeriodoRow {
  uid: string;
  dia: DiaSemana | "";
  inicio: string;
  fim: string;
}

interface FormularioErros {
  nome?: string;
  periodos?: string;
  geral?: string;
}

interface FormularioState {
  nome: string;
  periodos: PeriodoRow[];
  erros: FormularioErros;
  salvando: boolean;
}

interface DetalheState {
  tabela: TabelaHorarioApi;
  alterando: boolean;
  erroAlteracao: string | null;
}

export function CadastroHorariosScreen() {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [tabelas, setTabelas] = useState<TabelaHorarioApi[]>([]);
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>("todos");
  const [formulario, setFormulario] = useState<FormularioState | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheState | null>(null);
  const formTituloId = useId();
  const detalheTituloId = useId();

  const carregarDados = useCallback(async (filtro: FiltroAtivo) => {
    setStatusCarregamento("carregando");
    try {
      const query: { ativo?: boolean } = {};
      if (filtro === "ativo") query.ativo = true;
      else if (filtro === "inativo") query.ativo = false;
      const resp = await listarTabelasHorario(query);
      setTabelas(resp.itens);
      setStatusCarregamento("dados");
    } catch {
      setStatusCarregamento("erro");
    }
  }, []);

  useEffect(() => {
    void carregarDados(filtroAtivo);
  }, [filtroAtivo, carregarDados]);

  function abrirFormulario() {
    setFormulario({ nome: "", periodos: [], erros: {}, salvando: false });
    setDetalhe(null);
  }

  function fecharFormulario() {
    setFormulario(null);
  }

  function abrirDetalhe(tabela: TabelaHorarioApi) {
    setDetalhe({ tabela, alterando: false, erroAlteracao: null });
    setFormulario(null);
  }

  function fecharDetalhe() {
    setDetalhe(null);
  }

  function adicionarPeriodo() {
    setFormulario((prev) =>
      prev
        ? {
            ...prev,
            periodos: [
              ...prev.periodos,
              { uid: novoUid(), dia: "", inicio: "", fim: "" },
            ],
            erros: {},
          }
        : prev,
    );
  }

  function removerPeriodo(uid: string) {
    setFormulario((prev) =>
      prev
        ? {
            ...prev,
            periodos: prev.periodos.filter((p) => p.uid !== uid),
            erros: {},
          }
        : prev,
    );
  }

  function atualizarPeriodo(
    uid: string,
    campo: keyof Omit<PeriodoRow, "uid">,
    valor: string,
  ) {
    setFormulario((prev) =>
      prev
        ? {
            ...prev,
            periodos: prev.periodos.map((p) =>
              p.uid === uid ? { ...p, [campo]: valor } : p,
            ),
            erros: {},
          }
        : prev,
    );
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;

    const erros: FormularioErros = {};
    if (!formulario.nome.trim()) {
      erros.nome = "Nome é obrigatório.";
    } else if (formulario.nome.trim().length > 120) {
      erros.nome = "Nome deve ter no máximo 120 caracteres.";
    }
    if (formulario.periodos.some((p) => !p.dia || !p.inicio || !p.fim)) {
      erros.periodos =
        "Preencha todos os campos de cada período (dia, entrada e saída).";
    }
    if (erros.nome ?? erros.periodos) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      const dto: CriarTabelaHorarioDto = {
        nome: formulario.nome.trim(),
        periodos: formulario.periodos.map((p) => ({
          dia: p.dia as DiaSemana,
          inicio: p.inicio,
          fim: p.fim,
        })),
      };
      await criarTabelaHorario(dto);
      setFormulario(null);
      await carregarDados(filtroAtivo);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.";
      setFormulario((prev) =>
        prev
          ? {
              ...prev,
              salvando: false,
              erros: { ...prev.erros, geral: mensagem },
            }
          : prev,
      );
    }
  }

  async function handleAlterarAtivo() {
    if (!detalhe) return;
    setDetalhe((prev) =>
      prev ? { ...prev, alterando: true, erroAlteracao: null } : prev,
    );
    try {
      const atualizada = detalhe.tabela.ativo
        ? await desativarTabelaHorario(detalhe.tabela.id)
        : await reativarTabelaHorario(detalhe.tabela.id);
      setDetalhe((prev) =>
        prev ? { ...prev, tabela: atualizada, alterando: false } : prev,
      );
      setTabelas((prev) =>
        prev.map((t) => (t.id === atualizada.id ? atualizada : t)),
      );
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível alterar a situação. Tente novamente.";
      setDetalhe((prev) =>
        prev ? { ...prev, alterando: false, erroAlteracao: mensagem } : prev,
      );
    }
  }

  const colunasPeriodos: DataTableColumn<PeriodoApi>[] = [
    {
      key: "dia",
      header: "Dia",
      cell: (p) => ROTULO_DIA[p.dia] ?? p.dia,
    },
    { key: "inicio", header: "Entrada", cell: (p) => p.inicio },
    { key: "fim", header: "Saída", cell: (p) => p.fim },
  ];

  const colunasTabelas: DataTableColumn<TabelaHorarioApi>[] = [
    { key: "nome", header: "Nome", cell: (t) => t.nome },
    {
      key: "situacao",
      header: "Situação",
      cell: (t) => (
        <StatusBadge variant={VARIANTE_STATUS[String(t.ativo)] ?? "neutral"}>
          {t.ativo ? "Ativa" : "Inativa"}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (t) => (
        <Button variant="secondary" onClick={() => abrirDetalhe(t)}>
          Ver detalhes
          <span className="sr-only"> — {t.nome}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="horarios-screen">
      <PageHeader
        headingLevel={1}
        titleId={HORARIOS_TITULO_ID}
        title="Horários"
        description="Cadastre as tabelas de horário da sua empresa: grade semanal de entradas e saídas. Nome e períodos são imutáveis após o cadastro — para alterar, cadastre uma nova tabela."
        actions={
          <Button onClick={abrirFormulario}>Nova tabela de horário</Button>
        }
      />

      <Surface
        as="section"
        padding="md"
        className="horarios-screen__aviso"
        aria-labelledby="horarios-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="horarios-aviso-rh-titulo"
          className="horarios-screen__aviso-texto"
        >
          Este cadastro é operado exclusivamente pelo RH da própria empresa. Os
          demais perfis não visualizam nem alteram tabelas de horário aqui.
          Cadastros e alterações de situação geram trilha de auditoria
          automática.
        </p>
      </Surface>

      {statusCarregamento === "erro" ? (
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
            Verifique sua conexão e tente novamente. Se o problema persistir,
            contate o suporte.
          </p>
          <Button
            variant="secondary"
            onClick={() => void carregarDados(filtroAtivo)}
          >
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

          <div className="horarios-screen__filtros">
            <FormField id="horarios-filtro-ativo" label="Situação">
              {(control) => (
                <select
                  value={filtroAtivo}
                  onChange={(e) =>
                    setFiltroAtivo(e.target.value as FiltroAtivo)
                  }
                  disabled={statusCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todas as situações</option>
                  <option value="ativo">Ativa</option>
                  <option value="inativo">Inativa</option>
                </select>
              )}
            </FormField>
          </div>

          {statusCarregamento === "carregando" ? (
            <p className="horarios-screen__carregando" role="status">
              Carregando tabelas de horário…
            </p>
          ) : tabelas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma tabela de horário cadastrada"
              description="Cadastre a primeira tabela de horário desta empresa."
              action={
                <Button onClick={abrirFormulario}>
                  Nova tabela de horário
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Tabelas de horário"
              columns={colunasTabelas}
              rows={tabelas}
              rowKey={(t) => t.id}
            />
          )}
        </section>
      )}

      {detalhe ? (
        <Surface
          as="section"
          padding="lg"
          className="horarios-screen__formulario"
          aria-labelledby={detalheTituloId}
        >
          <h2 id={detalheTituloId} className="horarios-screen__section-title">
            {detalhe.tabela.nome}
          </h2>
          <p>
            <StatusBadge
              variant={
                VARIANTE_STATUS[String(detalhe.tabela.ativo)] ?? "neutral"
              }
            >
              {detalhe.tabela.ativo ? "Ativa" : "Inativa"}
            </StatusBadge>
          </p>
          <p className="horarios-screen__aviso-texto">
            Nome e períodos são imutáveis. Para alterar, cadastre uma nova
            tabela de horário.
          </p>

          {detalhe.tabela.periodos.length === 0 ? (
            <p>Nenhum período definido.</p>
          ) : (
            <DataTable
              caption={`Períodos — ${detalhe.tabela.nome}`}
              columns={colunasPeriodos}
              rows={detalhe.tabela.periodos}
              rowKey={(p) => `${p.dia}-${p.inicio}-${p.fim}`}
            />
          )}

          {detalhe.erroAlteracao ? (
            <p className="horarios-screen__form-erro" role="alert">
              {detalhe.erroAlteracao}
            </p>
          ) : null}

          <FormActions>
            <Button
              variant="secondary"
              type="button"
              onClick={fecharDetalhe}
              disabled={detalhe.alterando}
            >
              Fechar
            </Button>
            <Button
              type="button"
              variant={detalhe.tabela.ativo ? "secondary" : "primary"}
              onClick={() => void handleAlterarAtivo()}
              disabled={detalhe.alterando}
            >
              {detalhe.alterando
                ? detalhe.tabela.ativo
                  ? "Desativando…"
                  : "Reativando…"
                : detalhe.tabela.ativo
                  ? "Desativar"
                  : "Reativar"}
            </Button>
          </FormActions>
        </Surface>
      ) : null}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="horarios-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2 id={formTituloId} className="horarios-screen__section-title">
            Nova tabela de horário
          </h2>
          <p className="horarios-screen__aviso-texto">
            Nome e períodos não poderão ser alterados após o cadastro. Para
            corrigir, cadastre uma nova tabela.
          </p>

          <form
            className="horarios-screen__form"
            aria-label="Formulário de nova tabela de horário"
            onSubmit={(e) => void handleSubmit(e)}
          >
            <FormField
              id="horarios-nome"
              label="Nome da tabela"
              required
              help="Identificador interno. Imutável após o cadastro. Máximo 120 caracteres."
              {...(formulario.erros.nome
                ? { error: formulario.erros.nome }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Ex.: Comercial 44h"
                  value={formulario.nome}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? { ...prev, nome: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            <div className="horarios-screen__periodos">
              <p className="horarios-screen__section-title">
                Períodos da semana
              </p>
              <p className="horarios-screen__aviso-texto">
                Imutáveis após o cadastro. Formato 24h (HH:MM).
              </p>

              {formulario.erros.periodos ? (
                <p className="horarios-screen__form-erro" role="alert">
                  {formulario.erros.periodos}
                </p>
              ) : null}

              {formulario.periodos.map((periodo) => (
                <div key={periodo.uid} className="horarios-screen__periodo-row">
                  <FormField
                    id={`horarios-periodo-${periodo.uid}-dia`}
                    label="Dia"
                  >
                    {(control) => (
                      <select
                        value={periodo.dia}
                        onChange={(e) =>
                          atualizarPeriodo(periodo.uid, "dia", e.target.value)
                        }
                        {...control}
                      >
                        <option value="">Selecione</option>
                        {DIAS_SEMANA.map((d) => (
                          <option key={d.valor} value={d.valor}>
                            {d.rotulo}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>

                  <FormField
                    id={`horarios-periodo-${periodo.uid}-inicio`}
                    label="Entrada"
                  >
                    {(control) => (
                      <input
                        type="time"
                        value={periodo.inicio}
                        onChange={(e) =>
                          atualizarPeriodo(
                            periodo.uid,
                            "inicio",
                            e.target.value,
                          )
                        }
                        {...control}
                      />
                    )}
                  </FormField>

                  <FormField
                    id={`horarios-periodo-${periodo.uid}-fim`}
                    label="Saída"
                  >
                    {(control) => (
                      <input
                        type="time"
                        value={periodo.fim}
                        onChange={(e) =>
                          atualizarPeriodo(periodo.uid, "fim", e.target.value)
                        }
                        {...control}
                      />
                    )}
                  </FormField>

                  <Button
                    type="button"
                    variant="subtle"
                    onClick={() => removerPeriodo(periodo.uid)}
                  >
                    Remover
                    <span className="sr-only">
                      {" "}
                      período {ROTULO_DIA[periodo.dia] ?? periodo.uid}
                    </span>
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="secondary"
                onClick={adicionarPeriodo}
              >
                Adicionar período
              </Button>
            </div>

            {formulario.erros.geral ? (
              <p className="horarios-screen__form-erro" role="alert">
                {formulario.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={fecharFormulario}
                disabled={formulario.salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={formulario.salvando}
              >
                {formulario.salvando ? "Salvando…" : "Salvar"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}
