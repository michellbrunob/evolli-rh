/**
 * Pessoas > Dados contratuais (T134) — visão FUNCIONAL e **somente leitura** do
 * contrato de trabalho, sobre os contratos reais já existentes:
 *
 * - `GET /v1/colaboradores` e `/:id/vinculos` — colaborador e vínculos.
 * - `GET /v1/vinculos/:id/alocacoes` — cargo + lotação por vigência.
 * - `GET /v1/horarios/vinculos?colaboradorId=` — horário vigente e vigências.
 * - `GET /v1/vinculos/:id/linha-do-tempo` — movimentações (só exibição).
 * - Catálogos (`cargos`, unidades/departamentos/áreas/equipes/centros de custo,
 *   tabelas de horário, empresas) para resolver nomes.
 *
 * **Nada é editado aqui.** Cargo, lotação, situação, admissão e desligamento
 * mudam por **movimentação funcional** — esta tela orienta para a aba
 * "Histórico funcional" e nunca cria mutação paralela. Não recalcula tempo de
 * empresa, aviso, férias, encargos, Folha ou rescisão; a alocação/horário
 * "vigente" é lida do campo do backend (`vigenteAte`/`vigenciaFim` nulos), não
 * reinterpretada. Backend é autoritativo para RBAC, escopo e 404
 * anti-enumeração; nenhuma autorização depende do navegador.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  listarVinculosDoColaborador,
  type SituacaoVinculo,
  type TipoVinculo,
  type VinculoApi,
} from "../../api/colaboradoresClient";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import {
  listarAlocacoesVinculo,
  type AlocacaoOrganizacionalApi,
} from "../../api/vinculoContratualClient";
import {
  buscarLinhaDoTempo,
  type MovimentacaoApi,
  type StatusMovimentacao,
  type TipoMovimentacao,
} from "../../api/movimentacaoClient";
import {
  listarVinculosHorario,
  type VinculoHorarioApi,
} from "../../api/vinculoHorarioClient";
import { listarCargos, type CargoApi } from "../../api/cargoClient";
import {
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import {
  listarTabelasHorario,
  type TabelaHorarioApi,
} from "../../api/horariosClient";
import {
  SeletorColaboradorPaginado,
  type ColaboradorEscolhido,
} from "./SeletorColaboradorPaginado";
import "./DadosContratuaisScreen.css";

export const DADOS_CONTRATUAIS_TITULO_ID = "dados-contratuais-titulo";

type StatusCarregamento = "carregando" | "erro" | "pronto";

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro (controlado)",
};

const ROTULO_SITUACAO_VINCULO: Record<SituacaoVinculo, string> = {
  previsto: "Previsto",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

const VARIANTE_SITUACAO_VINCULO: Record<SituacaoVinculo, StatusVariant> = {
  previsto: "info",
  ativo: "success",
  encerrado: "neutral",
};

const ROTULO_TIPO_MOV: Record<TipoMovimentacao, string> = {
  admissao: "Admissão",
  transferencia_organizacional: "Transferência organizacional",
  mudanca_cargo: "Mudança de cargo",
  desligamento: "Desligamento",
};

const ROTULO_STATUS_MOV: Record<StatusMovimentacao, string> = {
  solicitada: "Solicitada",
  programada: "Programada",
  efetivada: "Efetivada",
  cancelada: "Cancelada",
  retificada: "Retificada",
};

const VARIANTE_STATUS_MOV: Record<StatusMovimentacao, StatusVariant> = {
  solicitada: "info",
  programada: "warning",
  efetivada: "success",
  cancelada: "danger",
  retificada: "neutral",
};

// Datas e horas vêm de `format/data` (T154) e são usadas pelo nome delas:
// `formatarDiaCivil` para dia de calendário (`@db.Date` — admissão, vigências)
// e `formatarInstante` para ponto no tempo (`criadoEm`, `registradaEm`), que é
// convertido para America/Sao_Paulo. O alias local `formatarData` sumiu de
// propósito: ele escondia qual das duas semânticas estava em jogo em cada
// célula, que é exatamente a distinção que esta tela precisa deixar visível.

export function DadosContratuaisScreen() {
  // T188 — escolhido pela busca paginada no servidor, sem o teto de 100.
  const [colaboradorEscolhido, setColaboradorEscolhido] =
    useState<ColaboradorEscolhido | null>(null);
  const colaboradorId = colaboradorEscolhido?.id ?? "";

  const [vinculos, setVinculos] = useState<VinculoApi[]>([]);
  const [statusVinculos, setStatusVinculos] =
    useState<StatusCarregamento>("carregando");
  const [vinculoId, setVinculoId] = useState("");

  const [alocacoes, setAlocacoes] = useState<AlocacaoOrganizacionalApi[]>([]);
  const [statusAlocacoes, setStatusAlocacoes] =
    useState<StatusCarregamento>("carregando");

  const [horarios, setHorarios] = useState<VinculoHorarioApi[]>([]);
  const [statusHorarios, setStatusHorarios] =
    useState<StatusCarregamento>("carregando");

  const [linhaTempo, setLinhaTempo] = useState<MovimentacaoApi[]>([]);
  const [statusLinhaTempo, setStatusLinhaTempo] =
    useState<StatusCarregamento>("carregando");

  // Guarda determinística contra respostas obsoletas: um contador monotônico
  // por carregador. Cada carga captura o valor no início e só aplica o
  // resultado (dados, estado de carregamento, erro, seleção derivada) se ainda
  // for a tentativa mais recente daquele carregador. Trocar/limpar
  // colaborador/vínculo e o "Tentar novamente" incrementam o contador,
  // invalidando qualquer resposta anterior — inclusive uma segunda tentativa
  // para o MESMO id, que compete com a original.
  const seqVinculos = useRef(0);
  const seqAlocacoes = useRef(0);
  const seqHorarios = useRef(0);
  const seqLinhaTempo = useRef(0);

  // Catálogos para resolver nomes (id → "código — nome"). Falha não quebra a
  // tela: os nomes caem para o id técnico.
  const [cargos, setCargos] = useState<CargoApi[]>([]);
  const [tabelas, setTabelas] = useState<TabelaHorarioApi[]>([]);
  const [mapaOrg, setMapaOrg] = useState<Map<string, string>>(new Map());
  const [mapaEmpresa, setMapaEmpresa] = useState<Map<string, string>>(
    new Map(),
  );

  // ---- Catálogos ----------------------------------------------------------
  const carregarCatalogos = useCallback(async () => {
    try {
      const [
        cargosRes,
        unidades,
        departamentos,
        areas,
        equipes,
        centros,
        tabelasRes,
        empresas,
      ] = await Promise.all([
        listarCargos({ tamanhoPagina: 100 }),
        listarUnidades({ tamanhoPagina: 100 }),
        listarDepartamentos({ tamanhoPagina: 100 }),
        listarAreas({ tamanhoPagina: 100 }),
        listarEquipes({ tamanhoPagina: 100 }),
        listarCentrosCusto({ tamanhoPagina: 100 }),
        listarTabelasHorario({ tamanhoPagina: 100 }),
        listarEmpresasMulti(),
      ]);
      setCargos(cargosRes.itens);
      setTabelas(tabelasRes.itens);
      const org = new Map<string, string>();
      const add = (itens: { id: string; codigo: string; nome: string }[]) => {
        for (const i of itens) org.set(i.id, `${i.codigo} — ${i.nome}`);
      };
      add(unidades.itens);
      add(departamentos.itens);
      add(areas.itens);
      add(equipes.itens);
      add(cargosRes.itens);
      add(centros.itens);
      setMapaOrg(org);
      const emp = new Map<string, string>();
      for (const e of empresas.itens) emp.set(e.id, `${e.codigo} — ${e.nome}`);
      setMapaEmpresa(emp);
    } catch {
      // Sem catálogos: nomes caem para o id; a tela continua funcional.
    }
  }, []);

  useEffect(() => {
    void carregarCatalogos();
  }, [carregarCatalogos]);

  // ---- Vínculos do colaborador -------------------------------------------
  const carregarVinculos = useCallback(async (id: string) => {
    const seq = ++seqVinculos.current;
    setStatusVinculos("carregando");
    try {
      const lista = await listarVinculosDoColaborador(id);
      if (seq !== seqVinculos.current) return; // resposta superada: descarta
      setVinculos(lista);
      // Zero bloqueia; uma resolve automaticamente; múltiplas exigem escolha.
      setVinculoId(lista.length === 1 ? lista[0]!.id : "");
      setStatusVinculos("pronto");
    } catch {
      if (seq !== seqVinculos.current) return;
      setStatusVinculos("erro");
    }
  }, []);

  useEffect(() => {
    if (!colaboradorId) {
      // Sem colaborador: invalida cargas em voo e limpa tudo que depende dele.
      seqVinculos.current++;
      setVinculos([]);
      setVinculoId("");
      return;
    }
    void carregarVinculos(colaboradorId);
  }, [colaboradorId, carregarVinculos]);

  // ---- Dados do vínculo selecionado --------------------------------------
  const carregarAlocacoes = useCallback(async (id: string) => {
    const seq = ++seqAlocacoes.current;
    setStatusAlocacoes("carregando");
    try {
      const dados = await listarAlocacoesVinculo(id);
      if (seq !== seqAlocacoes.current) return;
      setAlocacoes(dados);
      setStatusAlocacoes("pronto");
    } catch {
      if (seq !== seqAlocacoes.current) return;
      setStatusAlocacoes("erro");
    }
  }, []);

  const carregarHorarios = useCallback(async (colabId: string) => {
    const seq = ++seqHorarios.current;
    setStatusHorarios("carregando");
    try {
      const res = await listarVinculosHorario({
        colaboradorId: colabId,
        tamanhoPagina: 100,
      });
      if (seq !== seqHorarios.current) return;
      setHorarios(res.itens);
      setStatusHorarios("pronto");
    } catch {
      if (seq !== seqHorarios.current) return;
      setStatusHorarios("erro");
    }
  }, []);

  const carregarLinhaTempo = useCallback(async (id: string) => {
    const seq = ++seqLinhaTempo.current;
    setStatusLinhaTempo("carregando");
    try {
      const dados = await buscarLinhaDoTempo(id);
      if (seq !== seqLinhaTempo.current) return;
      setLinhaTempo(dados);
      setStatusLinhaTempo("pronto");
    } catch {
      if (seq !== seqLinhaTempo.current) return;
      setStatusLinhaTempo("erro");
    }
  }, []);

  useEffect(() => {
    if (!vinculoId) {
      // Sem vínculo: invalida cargas em voo e limpa o detalhe dependente dele.
      seqAlocacoes.current++;
      seqLinhaTempo.current++;
      setAlocacoes([]);
      setLinhaTempo([]);
      return;
    }
    void carregarAlocacoes(vinculoId);
    void carregarLinhaTempo(vinculoId);
  }, [vinculoId, carregarAlocacoes, carregarLinhaTempo]);

  useEffect(() => {
    if (!colaboradorId) {
      seqHorarios.current++;
      setHorarios([]);
      return;
    }
    void carregarHorarios(colaboradorId);
  }, [colaboradorId, carregarHorarios]);

  // Troca de colaborador: invalida imediatamente TODAS as cargas em voo (mesmo
  // antes de os efeitos re-dispararem) e limpa vínculos, vínculo selecionado,
  // alocações, horários e linha do tempo — nada do colaborador anterior
  // sobrevive à troca. Os efeitos acima recarregam a partir do novo estado.
  function selecionarColaborador(colaborador: ColaboradorEscolhido | null) {
    seqVinculos.current++;
    seqAlocacoes.current++;
    seqHorarios.current++;
    seqLinhaTempo.current++;
    setVinculos([]);
    setVinculoId("");
    setAlocacoes([]);
    setHorarios([]);
    setLinhaTempo([]);
    setColaboradorEscolhido(colaborador);
  }

  // Troca de vínculo: invalida alocações/linha do tempo em voo e limpa-as, para
  // que a resposta tardia do vínculo anterior nunca apareça no detalhe do novo.
  function selecionarVinculo(id: string) {
    seqAlocacoes.current++;
    seqLinhaTempo.current++;
    setAlocacoes([]);
    setLinhaTempo([]);
    setVinculoId(id);
  }

  const cargosPorId = useMemo(() => {
    const m = new Map<string, CargoApi>();
    for (const c of cargos) m.set(c.id, c);
    return m;
  }, [cargos]);

  const tabelasPorId = useMemo(() => {
    const m = new Map<string, TabelaHorarioApi>();
    for (const t of tabelas) m.set(t.id, t);
    return m;
  }, [tabelas]);

  function rotuloOrg(id: string | null): string | null {
    if (!id) return null;
    return mapaOrg.get(id) ?? id;
  }

  function rotuloCargo(id: string | null): string {
    if (!id) return "—";
    const c = cargosPorId.get(id);
    return c ? `${c.codigo} — ${c.nome}` : id;
  }

  function rotuloTabela(id: string): string {
    const t = tabelasPorId.get(id);
    return t ? t.nome : id;
  }

  function rotuloLotacao(a: AlocacaoOrganizacionalApi): string {
    const partes = [
      rotuloOrg(a.unidadeOrganizacionalId),
      rotuloOrg(a.departamentoId),
      rotuloOrg(a.areaId),
      rotuloOrg(a.equipeId),
      rotuloOrg(a.centroCustoId),
    ].filter((p): p is string => p !== null);
    return partes.length > 0 ? partes.join(" · ") : "—";
  }

  const vinculoSelecionado = useMemo(
    () => vinculos.find((v) => v.id === vinculoId) ?? null,
    [vinculos, vinculoId],
  );

  const alocacaoVigente = useMemo(
    () => alocacoes.find((a) => a.vigenteAte === null) ?? null,
    [alocacoes],
  );

  const horarioVigente = useMemo(
    () => horarios.find((h) => h.vigenciaFim === null) ?? null,
    [horarios],
  );

  const colunasAlocacoes: DataTableColumn<AlocacaoOrganizacionalApi>[] = [
    {
      key: "de",
      header: "Vigente de",
      cell: (a) => formatarDiaCivil(a.vigenteDe),
    },
    {
      // Nulo aqui NÃO é ausência: é vigência aberta. Por decisão de domínio a
      // célula diz "Vigente", e não o traço de valor ausente.
      key: "ate",
      header: "Vigente até",
      cell: (a) => (a.vigenteAte ? formatarDiaCivil(a.vigenteAte) : "Vigente"),
    },
    { key: "cargo", header: "Cargo", cell: (a) => rotuloCargo(a.cargoId) },
    { key: "lotacao", header: "Lotação", cell: (a) => rotuloLotacao(a) },
  ];

  const colunasHorarios: DataTableColumn<VinculoHorarioApi>[] = [
    {
      key: "tabela",
      header: "Tabela de horário",
      cell: (h) => rotuloTabela(h.tabelaHorarioId),
    },
    {
      key: "de",
      header: "Vigência início",
      cell: (h) => formatarDiaCivil(h.vigenciaInicio),
    },
    {
      key: "ate",
      header: "Vigência fim",
      cell: (h) =>
        h.vigenciaFim ? formatarDiaCivil(h.vigenciaFim) : "Vigente",
    },
  ];

  const colunasLinhaTempo: DataTableColumn<MovimentacaoApi>[] = [
    {
      key: "vigencia",
      header: "Vigência",
      cell: (m) => formatarDiaCivil(m.vigenciaInicio),
    },
    { key: "tipo", header: "Tipo", cell: (m) => ROTULO_TIPO_MOV[m.tipo] },
    {
      key: "status",
      header: "Estado",
      cell: (m) => (
        <StatusBadge variant={VARIANTE_STATUS_MOV[m.status]}>
          {ROTULO_STATUS_MOV[m.status]}
        </StatusBadge>
      ),
    },
    {
      key: "registrada",
      header: "Registrada em",
      cell: (m) => formatarInstante(m.registradaEm),
    },
  ];

  return (
    <div className="dados-contratuais-screen">
      <PageHeader
        headingLevel={1}
        titleId={DADOS_CONTRATUAIS_TITULO_ID}
        title="Dados contratuais"
        description="Consulta somente leitura do vínculo: matrícula, tipo, situação, admissão/desligamento, cargo e lotação vigentes, horário e a linha do tempo de movimentações. Alterações contratuais ocorrem por movimentação (aba Histórico funcional)."
      />

      <Surface
        as="section"
        padding="md"
        className="dados-contratuais-screen__aviso"
        aria-labelledby="dados-contratuais-aviso-titulo"
      >
        <StatusBadge variant="info">Somente leitura</StatusBadge>
        <p
          id="dados-contratuais-aviso-titulo"
          className="dados-contratuais-screen__aviso-texto"
        >
          Esta aba não edita cargo, lotação, situação, admissão nem desligamento
          — essas mudanças são registradas como movimentação funcional na aba{" "}
          <strong>Histórico funcional</strong>. Nenhum dado financeiro, de ponto
          ou de Folha é calculado ou exibido aqui.
        </p>
      </Surface>

      {/* Seleção de colaborador ---------------------------------------- */}
      <section
        aria-labelledby="dados-contratuais-colaborador-titulo"
        className="dados-contratuais-screen__secao"
      >
        <h2
          id="dados-contratuais-colaborador-titulo"
          className="dados-contratuais-screen__section-title"
        >
          Colaborador e vínculo
        </h2>

        <div className="dados-contratuais-screen__selecao">
          {/* T188 — qualquer colaborador da empresa ativa, por busca
              paginada no servidor; sem o teto de 100. Com um só no escopo,
              ele é escolhido sozinho, como antes. */}
          <SeletorColaboradorPaginado
            id="dados-contratuais-colaborador"
            rotulo="Colaborador (buscar por nome ou matrícula)"
            selecionado={colaboradorEscolhido}
            onSelecionar={selecionarColaborador}
            autoSelecionarUnico
          />

          {colaboradorId ? (
            statusVinculos === "carregando" ? (
              <p role="status">Carregando vínculos…</p>
            ) : statusVinculos === "erro" ? (
              <div className="dados-contratuais-screen__erro">
                <p role="alert">Não foi possível carregar os vínculos.</p>
                <Button
                  variant="secondary"
                  onClick={() => void carregarVinculos(colaboradorId)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : vinculos.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Este colaborador não tem vínculo no seu escopo"
                description="Nenhum vínculo funcional disponível para consulta."
              />
            ) : (
              <FormField id="dados-contratuais-vinculo" label="Vínculo">
                {(control) => (
                  <select
                    value={vinculoId}
                    onChange={(e) => selecionarVinculo(e.target.value)}
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {vinculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {exibirMatricula(v.matricula)} ·{" "}
                        {ROTULO_TIPO_VINCULO[v.tipo]} ·{" "}
                        {ROTULO_SITUACAO_VINCULO[v.situacao]}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            )
          ) : null}
        </div>
      </section>

      {/* Detalhe do vínculo -------------------------------------------- */}
      {vinculoSelecionado ? (
        <>
          <Surface
            as="section"
            padding="lg"
            className="dados-contratuais-screen__detalhe"
            aria-labelledby="dados-contratuais-detalhe-titulo"
          >
            <StatusBadge
              variant={VARIANTE_SITUACAO_VINCULO[vinculoSelecionado.situacao]}
            >
              {ROTULO_SITUACAO_VINCULO[vinculoSelecionado.situacao]}
            </StatusBadge>
            <h2
              id="dados-contratuais-detalhe-titulo"
              className="dados-contratuais-screen__section-title"
            >
              Vínculo — {exibirMatricula(vinculoSelecionado.matricula)}
            </h2>
            <dl className="dados-contratuais-screen__lista">
              <div>
                <dt>Matrícula</dt>
                <dd>{exibirMatricula(vinculoSelecionado.matricula)}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{ROTULO_TIPO_VINCULO[vinculoSelecionado.tipo]}</dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd>{ROTULO_SITUACAO_VINCULO[vinculoSelecionado.situacao]}</dd>
              </div>
              <div>
                <dt>Admissão</dt>
                <dd>{formatarDiaCivil(vinculoSelecionado.dataAdmissao)}</dd>
              </div>
              <div>
                <dt>Desligamento</dt>
                <dd>{formatarDiaCivil(vinculoSelecionado.dataDesligamento)}</dd>
              </div>
              <div>
                <dt>Empresa</dt>
                <dd>
                  {mapaEmpresa.get(vinculoSelecionado.empresaId) ??
                    vinculoSelecionado.empresaId}
                </dd>
              </div>
              <div>
                <dt>Cargo vigente</dt>
                <dd>
                  {alocacaoVigente ? rotuloCargo(alocacaoVigente.cargoId) : "—"}
                </dd>
              </div>
              <div>
                <dt>Lotação vigente</dt>
                <dd>
                  {alocacaoVigente ? rotuloLotacao(alocacaoVigente) : "—"}
                </dd>
              </div>
              <div>
                <dt>Horário vigente</dt>
                <dd>
                  {horarioVigente
                    ? rotuloTabela(horarioVigente.tabelaHorarioId)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Referência técnica</dt>
                <dd>
                  <code>{vinculoSelecionado.id}</code>
                </dd>
              </div>
              <div>
                <dt>Criado em</dt>
                <dd>{formatarInstante(vinculoSelecionado.criadoEm)}</dd>
              </div>
              <div>
                <dt>Atualizado em</dt>
                <dd>{formatarInstante(vinculoSelecionado.atualizadoEm)}</dd>
              </div>
            </dl>
          </Surface>

          {/* Alocações (vigências) ----------------------------------- */}
          <section
            aria-labelledby="dados-contratuais-alocacoes-titulo"
            className="dados-contratuais-screen__secao"
          >
            <h2
              id="dados-contratuais-alocacoes-titulo"
              className="dados-contratuais-screen__section-title"
            >
              Cargo e lotação (vigências)
            </h2>
            {statusAlocacoes === "carregando" ? (
              <p role="status">Carregando alocações…</p>
            ) : statusAlocacoes === "erro" ? (
              <div className="dados-contratuais-screen__erro">
                <p role="alert">Não foi possível carregar as alocações.</p>
                <Button
                  variant="secondary"
                  onClick={() => void carregarAlocacoes(vinculoId)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : alocacoes.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Sem alocação registrada"
                description="Este vínculo ainda não tem cargo/lotação efetivados."
              />
            ) : (
              <DataTable
                caption="Cargo e lotação por vigência"
                columns={colunasAlocacoes}
                rows={alocacoes}
                rowKey={(a) => a.id}
              />
            )}
          </section>

          {/* Horário (vigências) ------------------------------------- */}
          <section
            aria-labelledby="dados-contratuais-horario-titulo"
            className="dados-contratuais-screen__secao"
          >
            <h2
              id="dados-contratuais-horario-titulo"
              className="dados-contratuais-screen__section-title"
            >
              Horário (vigências)
            </h2>
            {statusHorarios === "carregando" ? (
              <p role="status">Carregando horários…</p>
            ) : statusHorarios === "erro" ? (
              <div className="dados-contratuais-screen__erro">
                <p role="alert">Não foi possível carregar os horários.</p>
                <Button
                  variant="secondary"
                  onClick={() => void carregarHorarios(colaboradorId)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : horarios.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Sem horário vinculado"
                description="Este colaborador ainda não tem tabela de horário vigente."
              />
            ) : (
              <DataTable
                caption="Horário por vigência"
                columns={colunasHorarios}
                rows={horarios}
                rowKey={(h) => h.id}
              />
            )}
          </section>

          {/* Linha do tempo (só leitura) ----------------------------- */}
          <section
            aria-labelledby="dados-contratuais-linha-titulo"
            className="dados-contratuais-screen__secao"
          >
            <h2
              id="dados-contratuais-linha-titulo"
              className="dados-contratuais-screen__section-title"
            >
              Linha do tempo de movimentações
            </h2>
            <p className="dados-contratuais-screen__nota">
              Exibição somente leitura. Para registrar, cancelar, efetivar ou
              retificar uma movimentação, use a aba{" "}
              <strong>Histórico funcional</strong>.
            </p>
            {statusLinhaTempo === "carregando" ? (
              <p role="status">Carregando linha do tempo…</p>
            ) : statusLinhaTempo === "erro" ? (
              <div className="dados-contratuais-screen__erro">
                <p role="alert">Não foi possível carregar a linha do tempo.</p>
                <Button
                  variant="secondary"
                  onClick={() => void carregarLinhaTempo(vinculoId)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : linhaTempo.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Sem movimentações"
                description="Nenhuma movimentação registrada para este vínculo."
              />
            ) : (
              <DataTable
                caption="Movimentações do vínculo"
                columns={colunasLinhaTempo}
                rows={linhaTempo}
                rowKey={(m) => m.id}
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
