import { readFileSync } from "node:fs";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ColaboradorApi,
  type VinculoApi,
  buscarColaborador,
  listarVinculosDoColaborador,
} from "../../api/colaboradoresClient";
import { buscarCargo, listarCargos } from "../../api/cargoClient";
import {
  buscarDepartamento,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import {
  type AlocacaoOrganizacionalApi,
  listarAlocacoesVinculo,
} from "../../api/vinculoContratualClient";
import {
  type VinculoHorarioApi,
  listarVinculosHorario,
} from "../../api/vinculoHorarioClient";
import { listarTabelasHorario } from "../../api/horariosClient";
import { consultarContatosDoColaborador } from "../../api/contatosColaboradorClient";
import { consultarDadosPessoaisDoColaborador } from "../../api/dadosPessoaisClient";
import { buscarLinhaDoTempo } from "../../api/movimentacaoClient";
import type { AbaDaFicha } from "../../app/rotasDoShell";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";
import { FichaColaboradorScreen, iniciaisDe } from "./FichaColaboradorScreen";

/**
 * T198 — a ficha unificada do colaborador, em página própria. O que se prova
 * aqui é a própria página: cabeçalho (vínculo principal, lotação e jornada
 * vigentes), os estados, as quatro abas, o teclado, as permissões e que uma
 * resposta atrasada nunca preenche a ficha de outro colaborador. O shell (rota
 * e troca de empresa) tem testes próprios em `App.ficha.test.tsx`.
 */
vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/cargoClient");
vi.mock("../../api/organizacaoClient");
vi.mock("../../api/vinculoContratualClient");
vi.mock("../../api/vinculoHorarioClient");
vi.mock("../../api/horariosClient");
vi.mock("../../api/contatosColaboradorClient");
vi.mock("../../api/dadosPessoaisClient");
vi.mock("../../api/movimentacaoClient");

const EMPRESA = "44444444-4444-4444-4444-444444444444";
const HOJE = "2026-10-29";

function paginado<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

const ana: ColaboradorApi = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Ana Sintética (teste)",
  // A situação de `GET /colaboradores/:id` é a GLOBAL: não vale na ficha.
  situacao: "inativo",
  criadoEm: "2025-01-10T12:00:00.000Z",
  atualizadoEm: "2025-01-10T12:00:00.000Z",
};

const bruno: ColaboradorApi = {
  id: "22222222-2222-4222-8222-222222222222",
  nome: "Bruno Sintético (teste)",
  situacao: "ativo",
  criadoEm: "2025-02-05T12:00:00.000Z",
  atualizadoEm: "2025-02-05T12:00:00.000Z",
};

function vinculo(parcial: Partial<VinculoApi> = {}): VinculoApi {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    colaboradorId: ana.id,
    empresaId: EMPRESA,
    matricula: "MAT-0001",
    tipo: "clt",
    situacao: "ativo",
    dataAdmissao: "2025-01-10",
    dataDesligamento: null,
    criadoEm: "2025-01-10T12:00:00.000Z",
    atualizadoEm: "2025-01-10T12:00:00.000Z",
    ...parcial,
  };
}

function alocacao(
  parcial: Partial<AlocacaoOrganizacionalApi> = {},
): AlocacaoOrganizacionalApi {
  return {
    id: "a-1",
    vinculoId: vinculo().id,
    empresaId: EMPRESA,
    unidadeOrganizacionalId: null,
    departamentoId: "d-1",
    areaId: null,
    equipeId: null,
    cargoId: "c-1",
    centroCustoId: null,
    vigenteDe: "2025-01-10",
    vigenteAte: null,
    movimentacaoOrigemId: "m-1",
    criadoEm: "2025-01-10T12:00:00.000Z",
    ...parcial,
  };
}

function jornada(parcial: Partial<VinculoHorarioApi> = {}): VinculoHorarioApi {
  return {
    id: "h-1",
    colaboradorId: ana.id,
    empresaId: EMPRESA,
    tabelaHorarioId: "t-1",
    tabela: {
      id: "t-1",
      codigo: "JOR44",
      nome: "Comercial (teste)",
      ativo: true,
    },
    vigenciaInicio: "2025-01-10",
    vigenciaFim: null,
    criadoPorUserId: "u-1",
    criadoEm: "2025-01-10T12:00:00.000Z",
    atualizadoEm: "2025-01-10T12:00:00.000Z",
    ...parcial,
  };
}

function referencia(
  id: string,
  codigo: string,
  nome: string,
  status = "ativo",
) {
  return {
    id,
    codigo,
    nome,
    empresaId: EMPRESA,
    status,
    criadoEm: "2025-01-01T12:00:00.000Z",
    atualizadoEm: "2025-01-01T12:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarColaborador).mockImplementation(async (id) => {
    if (id === ana.id) return ana;
    if (id === bruno.id) return bruno;
    throw Object.assign(new Error("Recurso não encontrado."), { status: 404 });
  });
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([vinculo()]);
  vi.mocked(listarAlocacoesVinculo).mockResolvedValue([alocacao()]);
  vi.mocked(buscarCargo).mockResolvedValue(
    referencia("c-1", "ANL", "Analista (teste)"),
  );
  vi.mocked(buscarDepartamento).mockResolvedValue(
    referencia("d-1", "ADM", "Administrativo (teste)"),
  );
  vi.mocked(listarVinculosHorario).mockResolvedValue(paginado([jornada()]));
  vi.mocked(listarTabelasHorario).mockResolvedValue(paginado([]));
  vi.mocked(buscarLinhaDoTempo).mockResolvedValue([]);
  vi.mocked(listarCargos).mockResolvedValue(paginado([]));
  vi.mocked(listarDepartamentos).mockResolvedValue(paginado([]));
  vi.mocked(listarUnidades).mockResolvedValue(paginado([]));
  vi.mocked(listarAreas).mockResolvedValue(paginado([]));
  vi.mocked(listarEquipes).mockResolvedValue(paginado([]));
  vi.mocked(listarCentrosCusto).mockResolvedValue(paginado([]));
  vi.mocked(listarEmpresasMulti).mockResolvedValue(paginado([]));
  vi.mocked(consultarContatosDoColaborador).mockImplementation(
    async (colaboradorId) => ({
      colaboradorId,
      empresaId: EMPRESA,
      situacao: "sem_registro",
      contatos: null,
    }),
  );
  vi.mocked(consultarDadosPessoaisDoColaborador).mockImplementation(
    async (colaboradorId) => ({
      colaboradorId,
      empresaId: EMPRESA,
      situacao: "sem_registro",
      perfilPessoal: null,
      endereco: null,
    }),
  );
});

/** A aba é do shell (rota); aqui, um estado local faz esse papel. */
function Ficha({
  colaboradorId = ana.id,
  abaInicial = "dados",
  onVoltar = () => {},
  ...resto
}: {
  colaboradorId?: string;
  abaInicial?: AbaDaFicha;
  onVoltar?: () => void;
  podeEditarFicha?: boolean;
  podeOperarJornada?: boolean;
}) {
  const [aba, setAba] = useState<AbaDaFicha>(abaInicial);
  return (
    <FichaColaboradorScreen
      colaboradorId={colaboradorId}
      aba={aba}
      onTrocarAba={setAba}
      onVoltar={onVoltar}
      hoje={HOJE}
      {...resto}
    />
  );
}

async function esperarFicha() {
  await screen.findByRole("tablist", { name: /^Seções da ficha de / });
}

function cabecalho(): HTMLElement {
  const el = document.querySelector<HTMLElement>(
    ".ficha-colaborador__cabecalho",
  );
  if (!el) throw new Error("Sem cabeçalho.");
  return el;
}

/** O valor de um item do resumo (`dt` → `dd`). */
function resumo(rotulo: string): HTMLElement {
  const dt = within(cabecalho()).getByText(rotulo, { selector: "dt" });
  return dt.nextElementSibling as HTMLElement;
}

describe("T198 — cabeçalho da ficha", () => {
  it("vínculo ativo: nome, situação nesta empresa, vínculo principal, lotação, admissão e jornada", async () => {
    render(<Ficha />);
    await esperarFicha();

    expect(
      screen.getByRole("heading", { level: 1, name: ana.nome }),
    ).toBeInTheDocument();
    // Ativo NESTA empresa, mesmo com a situação global "inativo".
    expect(
      within(cabecalho()).getByText("Ativo nesta empresa"),
    ).toBeInTheDocument();
    expect(resumo("Vínculo principal")).toHaveTextContent(
      /^CLT · MAT-0001 · \W*Ativo$/,
    );
    expect(resumo("Admissão")).toHaveTextContent("10/01/2025");
    await waitFor(() =>
      expect(cabecalho()).toHaveTextContent(
        "Cargo: ANL — Analista (teste) · Departamento: ADM — Administrativo (teste)",
      ),
    );
    await waitFor(() =>
      expect(resumo("Jornada vigente")).toHaveTextContent(
        "JOR44 — Comercial (teste)",
      ),
    );
    // Nada de "tempo de empresa" calculado, nem contatos no cabeçalho (D19).
    expect(cabecalho()).not.toHaveTextContent(/tempo de empresa/i);
    expect(
      within(cabecalho()).queryByText(/e-mail|celular|telefone/i),
    ).toBeNull();
    expect(screen.queryByText("Desligamento", { selector: "dt" })).toBeNull();
    expectSemIsoVisivel(cabecalho());

    // D20 — os nomes vêm por id, da alocação aberta do vínculo principal.
    expect(listarAlocacoesVinculo).toHaveBeenCalledWith(vinculo().id);
    expect(buscarCargo).toHaveBeenCalledWith("c-1");
    expect(buscarDepartamento).toHaveBeenCalledWith("d-1");
    expect(listarVinculosHorario).toHaveBeenCalledWith({
      colaboradorId: ana.id,
      tamanhoPagina: 100,
    });
  });

  it("referência inativa e lotação incompleta aparecem como tal", async () => {
    vi.mocked(listarAlocacoesVinculo).mockResolvedValue([
      alocacao({ departamentoId: null }),
    ]);
    vi.mocked(buscarCargo).mockResolvedValue(
      referencia("c-1", "ANL", "Analista (teste)", "inativo"),
    );
    render(<Ficha />);
    await esperarFicha();
    await waitFor(() =>
      expect(cabecalho()).toHaveTextContent(
        "Cargo: ANL — Analista (teste) (inativo) · Departamento: Não informado",
      ),
    );
    expect(buscarDepartamento).not.toHaveBeenCalled();
  });

  it("só a alocação ABERTA conta: encerradas não viram lotação vigente", async () => {
    vi.mocked(listarAlocacoesVinculo).mockResolvedValue([
      alocacao({ vigenteAte: "2025-06-30" }),
    ]);
    render(<Ficha />);
    await esperarFicha();
    await waitFor(() =>
      expect(cabecalho()).toHaveTextContent("Sem lotação vigente"),
    );
    expect(buscarCargo).not.toHaveBeenCalled();
  });

  it("vínculo ativo sem jornada vigente hoje: 'Sem jornada vigente'", async () => {
    vi.mocked(listarVinculosHorario).mockResolvedValue(
      paginado([jornada({ vigenciaInicio: "2026-12-01" })]),
    );
    render(<Ficha />);
    await esperarFicha();
    await waitFor(() =>
      expect(resumo("Jornada vigente")).toHaveTextContent(
        "Sem jornada vigente",
      ),
    );
  });

  it("jornada vigente inativa leva a marca 'Jornada inativa'", async () => {
    vi.mocked(listarVinculosHorario).mockResolvedValue(
      paginado([
        jornada({
          tabela: {
            id: "t-1",
            codigo: null,
            nome: "Antiga (teste)",
            ativo: false,
          },
        }),
      ]),
    );
    render(<Ficha />);
    await esperarFicha();
    await waitFor(() =>
      expect(resumo("Jornada vigente")).toHaveTextContent(
        /^Antiga \(teste\) \W*Jornada inativa$/,
      ),
    );
  });

  it("vínculo previsto: sem lotação e sem jornada vigentes, sem consultar", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      vinculo({ situacao: "previsto", dataAdmissao: "2026-12-01" }),
    ]);
    render(<Ficha />);
    await esperarFicha();
    expect(
      within(cabecalho()).getByText("Inativo nesta empresa"),
    ).toBeInTheDocument();
    expect(resumo("Vínculo principal")).toHaveTextContent("Previsto");
    expect(resumo("Admissão")).toHaveTextContent("01/12/2026");
    expect(cabecalho()).toHaveTextContent("Sem lotação vigente");
    expect(resumo("Jornada vigente")).toHaveTextContent("Sem jornada vigente");
    expect(listarAlocacoesVinculo).not.toHaveBeenCalled();
    expect(listarVinculosHorario).not.toHaveBeenCalled();
  });

  it("vínculo encerrado: mostra o desligamento, sem lotação e sem jornada", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      vinculo({ situacao: "encerrado", dataDesligamento: "2026-06-30" }),
    ]);
    render(<Ficha />);
    await esperarFicha();
    expect(
      within(cabecalho()).getByText("Inativo nesta empresa"),
    ).toBeInTheDocument();
    expect(resumo("Vínculo principal")).toHaveTextContent("Encerrado");
    expect(resumo("Desligamento")).toHaveTextContent("30/06/2026");
    expect(cabecalho()).toHaveTextContent("Sem lotação vigente");
    expect(resumo("Jornada vigente")).toHaveTextContent("Sem jornada vigente");
    expectSemIsoVisivel(cabecalho());
  });

  it("sem vínculo nesta empresa: diz isso, sem inventar dado", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([]);
    render(<Ficha />);
    await esperarFicha();
    expect(resumo("Vínculo principal")).toHaveTextContent(
      "Sem vínculo nesta empresa",
    );
    expect(resumo("Admissão")).toHaveTextContent("Sem admissão nesta empresa");
    expect(resumo("Jornada vigente")).toHaveTextContent("Sem jornada vigente");
    expect(
      within(cabecalho()).getByText("Inativo nesta empresa"),
    ).toBeInTheDocument();
  });

  it("vários vínculos: o principal é o ativo; os outros ficam na Vida funcional", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      vinculo({
        id: "77777777-7777-4777-8777-777777777777",
        matricula: "MAT-NOVA",
        situacao: "previsto",
        dataAdmissao: "2026-12-01",
      }),
      vinculo(),
      vinculo({
        id: "88888888-8888-4888-8888-888888888888",
        matricula: "MAT-VELHA",
        situacao: "encerrado",
        dataAdmissao: "2020-01-02",
        dataDesligamento: "2024-12-31",
      }),
    ]);
    render(<Ficha />);
    await esperarFicha();
    expect(resumo("Vínculo principal")).toHaveTextContent("MAT-0001");
    expect(listarAlocacoesVinculo).toHaveBeenCalledWith(vinculo().id);

    fireEvent.click(screen.getByRole("tab", { name: "Vida funcional" }));
    const outros = await screen.findByRole("table", {
      name: `Outros vínculos — ${ana.nome}`,
    });
    expect(outros).toHaveTextContent("MAT-NOVA");
    expect(outros).toHaveTextContent("MAT-VELHA");
    expect(outros).not.toHaveTextContent("MAT-0001");
    expectSemIsoVisivel(outros);
  });

  it("falha na lotação ou na jornada: aviso no próprio item e 'Tentar de novo'", async () => {
    vi.mocked(listarAlocacoesVinculo).mockRejectedValueOnce(new Error("falha"));
    vi.mocked(listarVinculosHorario).mockRejectedValueOnce(new Error("falha"));
    render(<Ficha />);
    await esperarFicha();
    expect(
      await within(cabecalho()).findByText(
        /Não foi possível carregar a lotação\./,
      ),
    ).toBeInTheDocument();
    expect(
      await within(cabecalho()).findByText(
        /Não foi possível carregar a jornada\./,
      ),
    ).toBeInTheDocument();

    const [lotacao, jornadaDeNovo] = within(cabecalho()).getAllByRole(
      "button",
      {
        name: "Tentar de novo",
      },
    );
    fireEvent.click(lotacao!);
    fireEvent.click(jornadaDeNovo!);
    await waitFor(() =>
      expect(cabecalho()).toHaveTextContent("Cargo: ANL — Analista (teste)"),
    );
    await waitFor(() =>
      expect(resumo("Jornada vigente")).toHaveTextContent(
        "JOR44 — Comercial (teste)",
      ),
    );
  });
});

describe("T198 — estados da página", () => {
  it("carregando: título neutro e aviso de carregamento", async () => {
    vi.mocked(buscarColaborador).mockImplementation(
      () => new Promise(() => {}),
    );
    render(<Ficha />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Ficha do colaborador" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando a ficha…");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("fora da empresa ativa (404): 'não encontrado', sem sugerir que exista, e volta", async () => {
    const onVoltar = vi.fn();
    render(
      <Ficha
        colaboradorId="99999999-9999-4999-8999-999999999999"
        onVoltar={onVoltar}
      />,
    );
    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Colaborador não encontrado",
    });
    await waitFor(() => expect(titulo).toHaveFocus());
    expect(
      screen.getByText("Este colaborador não foi encontrado na empresa ativa."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it("recusa (403) também é 'não encontrado', nunca erro técnico", async () => {
    vi.mocked(listarVinculosDoColaborador).mockRejectedValueOnce(
      Object.assign(new Error("Acesso negado."), { status: 403 }),
    );
    render(<Ficha />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Colaborador não encontrado",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Acesso negado/)).toBeNull();
  });

  it("falha de rede: aviso e 'Tentar de novo', que relê", async () => {
    vi.mocked(buscarColaborador).mockRejectedValueOnce(new Error("falha"));
    render(<Ficha />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a ficha.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await esperarFicha();
    expect(
      screen.getByRole("heading", { level: 1, name: ana.nome }),
    ).toBeInTheDocument();
  });

  it("o título do documento leva o nome enquanto a ficha está aberta", async () => {
    document.title = "Evolli RH";
    const { unmount } = render(<Ficha />);
    await esperarFicha();
    expect(document.title).toBe(`${ana.nome} — Colaboradores`);
    unmount();
    expect(document.title).toBe("Evolli RH");
  });
});

describe("T198 — as quatro abas", () => {
  it("quatro abas, só as que funcionam, na ordem; a ativa é a da rota", async () => {
    render(<Ficha abaInicial="contratuais" />);
    await esperarFicha();
    const abas = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(abas.map((a) => a.textContent)).toEqual([
      "Dados do colaborador",
      "Vida funcional",
      "Dados contratuais",
      "Jornada de trabalho",
    ]);
    expect(
      screen.getByRole("tab", { name: "Dados contratuais", selected: true }),
    ).toBeInTheDocument();
    // Só a aba ativa entra na sequência do Tab.
    expect(abas.map((a) => a.tabIndex)).toEqual([-1, -1, 0, -1]);
    const painel = screen.getByRole("tabpanel", { name: "Dados contratuais" });
    expect(painel).toHaveAttribute(
      "aria-labelledby",
      screen.getByRole("tab", { name: "Dados contratuais" }).id,
    );
  });

  it("Dados do colaborador: dados pessoais, endereço e contatos da pessoa", async () => {
    render(<Ficha podeEditarFicha />);
    await esperarFicha();
    const painel = screen.getByRole("tabpanel", {
      name: "Dados do colaborador",
    });
    expect(within(painel).getByLabelText("Nome")).toHaveValue(ana.nome);
    expect(
      await within(painel).findByRole("region", { name: "Contatos" }),
    ).toBeInTheDocument();
    expect(consultarDadosPessoaisDoColaborador).toHaveBeenCalledWith(ana.id);
    expect(consultarContatosDoColaborador).toHaveBeenCalledWith(ana.id);
  });

  it("Vida funcional: a linha do tempo do vínculo principal", async () => {
    render(<Ficha abaInicial="vida-funcional" />);
    await esperarFicha();
    const painel = screen.getByRole("tabpanel", { name: "Vida funcional" });
    await within(painel).findByText(
      "Nenhuma movimentação registrada para este vínculo.",
    );
    expect(buscarLinhaDoTempo).toHaveBeenCalledWith(vinculo().id);
  });

  it("Dados contratuais: a tela da empresa, fixada neste colaborador, sem seletor", async () => {
    render(<Ficha abaInicial="contratuais" />);
    await esperarFicha();
    const painel = screen.getByRole("tabpanel", { name: "Dados contratuais" });
    await waitFor(() =>
      expect(listarVinculosDoColaborador).toHaveBeenCalledTimes(2),
    );
    expect(within(painel).queryByLabelText(/Colaborador \(buscar/)).toBeNull();
    expect(within(painel).queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("Jornada de trabalho: os vínculos de horário do colaborador", async () => {
    render(<Ficha abaInicial="jornada" />);
    await esperarFicha();
    const painel = screen.getByRole("tabpanel", {
      name: "Jornada de trabalho",
    });
    await within(painel).findAllByText(/Comercial \(teste\)/);
  });

  it("clicar numa aba pede a troca; a aba visitada fica montada (escondida)", async () => {
    render(<Ficha podeEditarFicha />);
    await esperarFicha();
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana Editada (teste)" },
    });

    fireEvent.click(screen.getByRole("tab", { name: "Jornada de trabalho" }));
    expect(
      screen.getByRole("tab", { name: "Jornada de trabalho", selected: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tabpanel", { name: "Dados do colaborador" }),
    ).toBeNull();

    // Voltar à aba não perde o que foi digitado.
    fireEvent.click(screen.getByRole("tab", { name: "Dados do colaborador" }));
    expect(screen.getByLabelText("Nome")).toHaveValue("Ana Editada (teste)");
  });

  it("teclado: setas, Home e End movem o foco entre as abas, sem ativar", async () => {
    render(<Ficha />);
    await esperarFicha();
    const aba = (nome: string) => screen.getByRole("tab", { name: nome });

    aba("Dados do colaborador").focus();
    fireEvent.keyDown(aba("Dados do colaborador"), { key: "ArrowRight" });
    expect(aba("Vida funcional")).toHaveFocus();
    fireEvent.keyDown(aba("Vida funcional"), { key: "End" });
    expect(aba("Jornada de trabalho")).toHaveFocus();
    fireEvent.keyDown(aba("Jornada de trabalho"), { key: "ArrowRight" });
    expect(aba("Dados do colaborador")).toHaveFocus();
    fireEvent.keyDown(aba("Dados do colaborador"), { key: "ArrowLeft" });
    expect(aba("Jornada de trabalho")).toHaveFocus();
    fireEvent.keyDown(aba("Jornada de trabalho"), { key: "Home" });
    expect(aba("Dados do colaborador")).toHaveFocus();
    // Mover o foco não troca a aba ativa.
    expect(aba("Dados do colaborador")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("ao abrir, o foco vai ao título (h1)", async () => {
    render(<Ficha />);
    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: ana.nome,
    });
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it("cada painel tem título para leitor de tela", async () => {
    render(<Ficha abaInicial="jornada" />);
    await esperarFicha();
    expect(
      within(screen.getByRole("tabpanel")).getByRole("heading", {
        level: 2,
        name: "Jornada de trabalho",
      }),
    ).toBeInTheDocument();
  });
});

describe("T198 — permissões (D23)", () => {
  it("só leitura (master_tecnico): sem campo de nome e sem botões de editar", async () => {
    render(<Ficha />);
    await esperarFicha();
    const painel = screen.getByRole("tabpanel", {
      name: "Dados do colaborador",
    });
    await within(painel).findByRole("region", { name: "Contatos" });
    expect(within(painel).queryByLabelText("Nome")).toBeNull();
    expect(
      within(painel).queryByRole("button", { name: /Editar|Salvar/ }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Jornada de trabalho" }));
    const jornadaPainel = screen.getByRole("tabpanel", {
      name: "Jornada de trabalho",
    });
    await within(jornadaPainel).findAllByText(/Comercial \(teste\)/);
    expect(
      within(jornadaPainel).queryByRole("button", {
        name: /Atribuir|Trocar|Encerrar/,
      }),
    ).toBeNull();
  });

  it("RH e DP editam nome, dados e contatos; só quem opera jornada vê as ações dela", async () => {
    render(<Ficha podeEditarFicha />);
    await esperarFicha();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Jornada de trabalho" }));
    const painel = screen.getByRole("tabpanel", {
      name: "Jornada de trabalho",
    });
    await within(painel).findAllByText(/Comercial \(teste\)/);
    expect(
      within(painel).queryByRole("button", { name: /Trocar|Encerrar/ }),
    ).toBeNull();
  });

  it("o RH opera a jornada", async () => {
    render(<Ficha podeEditarFicha podeOperarJornada abaInicial="jornada" />);
    await esperarFicha();
    const painel = screen.getByRole("tabpanel", {
      name: "Jornada de trabalho",
    });
    expect(
      await within(painel).findAllByRole("button", { name: /Trocar|Encerrar/ }),
    ).not.toHaveLength(0);
  });
});

describe("T198 — respostas atrasadas nunca preenchem outra ficha", () => {
  it("trocar de colaborador antes da resposta: a resposta antiga é descartada", async () => {
    let soltarAna: ((c: ColaboradorApi) => void) | null = null;
    vi.mocked(buscarColaborador).mockImplementation((id) => {
      if (id === ana.id) {
        return new Promise<ColaboradorApi>((res) => {
          soltarAna = res;
        });
      }
      return Promise.resolve(bruno);
    });
    vi.mocked(listarVinculosDoColaborador).mockImplementation(async (id) =>
      id === bruno.id
        ? [vinculo({ id: "v-b", colaboradorId: bruno.id, matricula: "MAT-B" })]
        : [vinculo()],
    );

    // O contêiner remonta a ficha por colaborador (`key`), como no produto.
    const { rerender } = render(<Ficha key={ana.id} colaboradorId={ana.id} />);
    rerender(<Ficha key={bruno.id} colaboradorId={bruno.id} />);
    await esperarFicha();
    expect(
      screen.getByRole("heading", { level: 1, name: bruno.nome }),
    ).toBeInTheDocument();

    await act(async () => {
      soltarAna?.(ana);
    });
    expect(screen.queryByText(ana.nome)).toBeNull();
    expect(resumo("Vínculo principal")).toHaveTextContent("MAT-B");
  });

  it("lotação e jornada atrasadas do anterior não entram no cabeçalho do seguinte", async () => {
    let soltarLotacao: ((a: AlocacaoOrganizacionalApi[]) => void) | null = null;
    let soltarJornada:
      ((j: ReturnType<typeof paginado<VinculoHorarioApi>>) => void) | null =
      null;
    vi.mocked(listarVinculosDoColaborador).mockImplementation(async (id) =>
      id === bruno.id
        ? [vinculo({ id: "v-b", colaboradorId: bruno.id, matricula: "MAT-B" })]
        : [vinculo()],
    );
    vi.mocked(listarAlocacoesVinculo).mockImplementation((id) =>
      id === vinculo().id
        ? new Promise((res) => {
            soltarLotacao = res;
          })
        : Promise.resolve([]),
    );
    vi.mocked(listarVinculosHorario).mockImplementation((q) =>
      q?.colaboradorId === ana.id
        ? new Promise((res) => {
            soltarJornada = res;
          })
        : Promise.resolve(paginado([])),
    );

    const { rerender } = render(<Ficha key={ana.id} colaboradorId={ana.id} />);
    await esperarFicha();
    await waitFor(() => expect(soltarLotacao).not.toBeNull());
    await waitFor(() => expect(soltarJornada).not.toBeNull());

    rerender(<Ficha key={bruno.id} colaboradorId={bruno.id} />);
    await screen.findByRole("heading", { level: 1, name: bruno.nome });
    await waitFor(() =>
      expect(cabecalho()).toHaveTextContent("Sem lotação vigente"),
    );

    await act(async () => {
      soltarLotacao?.([alocacao()]);
      soltarJornada?.(paginado([jornada()]));
    });
    expect(cabecalho()).not.toHaveTextContent("Analista (teste)");
    expect(cabecalho()).not.toHaveTextContent("Comercial (teste)");
    expect(resumo("Jornada vigente")).toHaveTextContent("Sem jornada vigente");
  });
});

describe("T198 — voltar", () => {
  it("a trilha volta à listagem; com edição pendente, pede confirmação", async () => {
    const onVoltar = vi.fn();
    render(<Ficha podeEditarFicha onVoltar={onVoltar} />);
    await esperarFicha();
    const trilha = screen.getByRole("navigation", {
      name: "Trilha de navegação",
    });
    expect(trilha).toHaveTextContent("Gestão de Pessoas");
    expect(trilha).toHaveTextContent(ana.nome);

    fireEvent.click(
      within(trilha).getByRole("button", { name: "Colaboradores" }),
    );
    expect(onVoltar).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Outra (teste)" },
    });
    fireEvent.click(
      within(trilha).getByRole("button", { name: "Colaboradores" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Sair da ficha sem salvar?" }),
    ).toBeInTheDocument();
    expect(onVoltar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));
    expect(onVoltar).toHaveBeenCalledTimes(2);
  });
});

describe("T198 — contrato de CSS (375 px, sem rolagem da página)", () => {
  const css = readFileSync(
    "src/screens/pessoas/FichaColaboradorScreen.css",
    "utf8",
  );
  const corpo = (seletor: string) => {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(
      String.raw`(?:^|\})\s*${escapado}\s*\{([^}]*)\}`,
      "m",
    ).exec(css);
    return m ? (m[1] ?? "") : null;
  };

  it("a página e o cabeçalho encolhem abaixo do conteúdo", () => {
    expect(corpo(".ficha-colaborador")).toMatch(/min-width:\s*0\s*;/);
    expect(corpo(".ficha-colaborador__cabecalho")).toMatch(
      /min-width:\s*0\s*;/,
    );
  });

  it("os grids de coluna única encolhem: nunca a coluna implícita 'auto'", () => {
    for (const seletor of [
      ".ficha-colaborador__cabecalho",
      ".ficha-colaborador__identidade",
      ".ficha-colaborador__item",
      ".ficha-colaborador__painel",
      ".ficha-colaborador__aviso",
    ]) {
      expect(corpo(seletor)).toMatch(
        /grid-template-columns:\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*;/,
      );
    }
  });

  it("o resumo nunca exige mais que a largura disponível", () => {
    expect(corpo(".ficha-colaborador__resumo")).toMatch(
      /minmax\(\s*min\(\s*12rem\s*,\s*100%\s*\)\s*,\s*1fr\s*\)/,
    );
  });

  it("as abas rolam na própria faixa; tabelas, no próprio quadro", () => {
    expect(corpo(".ficha-colaborador__abas")).toMatch(/overflow-x:\s*auto\s*;/);
    expect(corpo(".ficha-colaborador__quadro")).toMatch(
      /overflow-x:\s*auto\s*;/,
    );
  });

  it("nome longo quebra dentro da caixa; aba tem alvo de toque", () => {
    expect(corpo(".ficha-colaborador__titulo")).toMatch(
      /overflow-wrap:\s*anywhere\s*;/,
    );
    expect(corpo(".ficha-colaborador__aba")).toMatch(
      /min-height:\s*var\(--touch-target\)\s*;/,
    );
  });

  it("só tokens: nenhuma cor literal", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\brgba?\(/i);
  });
});

describe("T198 — títulos para quem navega por eles", () => {
  it.each([
    ["dados", "Dados do colaborador"],
    ["vida-funcional", "Vida funcional"],
    ["contratuais", "Dados contratuais"],
    ["jornada", "Jornada de trabalho"],
  ] as const)(
    "aba %s: um único h2 com o nome da aba, abaixo do h1 da ficha",
    async (aba, rotulo) => {
      render(<Ficha abaInicial={aba} />);
      await esperarFicha();
      const painel = screen.getByRole("tabpanel", { name: rotulo });
      await waitFor(() =>
        expect(
          within(painel).getAllByRole("heading", { level: 2, name: rotulo }),
        ).toHaveLength(1),
      );
      // Nenhum título repete o nome da aba em outro nível.
      expect(
        within(painel)
          .queryAllByRole("heading", { name: rotulo })
          .filter((h) => h.tagName !== "H2"),
      ).toHaveLength(0);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    },
  );
});

// ---------------------------------------------------------------------------
// Pós-revisão (C1) — a jornada do cabeçalho é só da empresa do vínculo
// principal. O `master_tecnico` sem empresa ativa lê vínculos e horários de
// todas as empresas: sem o filtro, a jornada de uma empresa aparecia ao lado
// do vínculo, da lotação e da situação de outra.
// ---------------------------------------------------------------------------
describe("T198 — jornada do cabeçalho na empresa do vínculo principal", () => {
  const EMPRESA_B = "55555555-5555-4555-8555-555555555555";
  /** Vínculo principal ativo na empresa A; o da empresa B, encerrado. */
  const vinculosEmDuasEmpresas = () => [
    vinculo(),
    vinculo({
      id: "66666666-6666-4666-8666-666666666666",
      empresaId: EMPRESA_B,
      matricula: "MAT-B-0001",
      situacao: "encerrado",
      dataAdmissao: "2020-01-02",
      dataDesligamento: "2024-12-31",
    }),
  ];
  const jornadaDaEmpresaB = () =>
    jornada({
      id: "h-b",
      empresaId: EMPRESA_B,
      tabelaHorarioId: "t-b",
      tabela: {
        id: "t-b",
        codigo: "JORB",
        nome: "Outra empresa (teste)",
        ativo: true,
      },
    });

  it("leitura global com só a jornada da outra empresa: 'Sem jornada vigente'", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue(
      vinculosEmDuasEmpresas(),
    );
    vi.mocked(listarVinculosHorario).mockResolvedValue(
      paginado([jornadaDaEmpresaB()]),
    );
    render(<Ficha />);
    await esperarFicha();
    expect(resumo("Vínculo principal")).toHaveTextContent("MAT-0001");
    await waitFor(() => expect(listarVinculosHorario).toHaveBeenCalled());
    await waitFor(() =>
      expect(resumo("Jornada vigente")).toHaveTextContent(
        "Sem jornada vigente",
      ),
    );
    expect(cabecalho()).not.toHaveTextContent("Outra empresa (teste)");
    expect(cabecalho()).not.toHaveTextContent("JORB");
  });

  it("com as duas jornadas vigentes, mostra a da empresa do vínculo principal", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue(
      vinculosEmDuasEmpresas(),
    );
    // A da outra empresa vem primeiro: a regra antiga a escolheria.
    vi.mocked(listarVinculosHorario).mockResolvedValue(
      paginado([jornadaDaEmpresaB(), jornada()]),
    );
    render(<Ficha />);
    await esperarFicha();
    await waitFor(() =>
      expect(resumo("Jornada vigente")).toHaveTextContent(
        "JOR44 — Comercial (teste)",
      ),
    );
    expect(cabecalho()).not.toHaveTextContent("Outra empresa (teste)");
    // Lotação e situação continuam as da empresa A.
    await waitFor(() =>
      expect(cabecalho()).toHaveTextContent("Cargo: ANL — Analista (teste)"),
    );
    expect(
      within(cabecalho()).getByText("Ativo nesta empresa"),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Pós-revisão (C2) — nova leitura sem perder o foco. O botão "Tentar de novo"
// fica no lugar, com `aria-disabled`, até a resposta; sucesso leva o foco ao
// título (ficha) ou ao item recuperado (lotação, jornada); nova falha mantém o
// foco no botão. Cada falha é anunciada uma vez, por um alerta novo.
// ---------------------------------------------------------------------------
describe("T198 — foco e anúncio nas novas leituras", () => {
  function adiado<T>() {
    let resolver!: (v: T) => void;
    let rejeitar!: (e: unknown) => void;
    const promessa = new Promise<T>((res, rej) => {
      resolver = res;
      rejeitar = rej;
    });
    return { promessa, resolver, rejeitar };
  }

  /** Clica como a pessoa clica: o botão recebe o foco antes do clique. */
  function clicarComFoco(botao: HTMLElement) {
    botao.focus();
    fireEvent.click(botao);
  }

  /** O botão "Tentar de novo" do mesmo bloco do alerta. */
  function botaoDoAlerta(alerta: HTMLElement): HTMLButtonElement {
    const botao = alerta.parentElement?.querySelector("button");
    if (!botao) throw new Error("Sem botão ao lado do alerta.");
    return botao;
  }

  describe("ficha", () => {
    it("durante a nova leitura o botão fica, focado e indisponível; o sucesso leva o foco ao h1", async () => {
      vi.mocked(buscarColaborador).mockRejectedValueOnce(new Error("falha"));
      render(<Ficha />);
      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent("Não foi possível carregar a ficha.");
      const botao = screen.getByRole("button", { name: "Tentar de novo" });

      const leitura = adiado<ColaboradorApi>();
      vi.mocked(buscarColaborador).mockImplementationOnce(
        () => leitura.promessa,
      );
      clicarComFoco(botao);

      expect(document.activeElement).toBe(botao);
      expect(botao).toHaveAttribute("aria-disabled", "true");
      expect(botao).not.toBeDisabled();
      // Indisponível: um segundo clique não dispara outra leitura.
      const chamadas = vi.mocked(buscarColaborador).mock.calls.length;
      fireEvent.click(botao);
      expect(vi.mocked(buscarColaborador).mock.calls.length).toBe(chamadas);

      await act(async () => {
        leitura.resolver(ana);
      });
      const titulo = await screen.findByRole("heading", {
        level: 1,
        name: ana.nome,
      });
      await waitFor(() => expect(titulo).toHaveFocus());
    });

    it("nova falha: o foco segue no botão e a falha é anunciada uma vez", async () => {
      vi.mocked(buscarColaborador).mockRejectedValueOnce(new Error("falha"));
      render(<Ficha />);
      const primeiro = await screen.findByRole("alert");
      const botao = screen.getByRole("button", { name: "Tentar de novo" });

      const leitura = adiado<ColaboradorApi>();
      vi.mocked(buscarColaborador).mockImplementationOnce(
        () => leitura.promessa,
      );
      clicarComFoco(botao);
      await act(async () => {
        leitura.rejeitar(new Error("falha de novo"));
      });

      await waitFor(() =>
        expect(botao).toHaveAttribute("aria-disabled", "false"),
      );
      expect(document.activeElement).toBe(botao);
      const alertas = screen.getAllByRole("alert");
      expect(alertas).toHaveLength(1);
      // Alerta NOVO (outro nó): o leitor de tela anuncia a nova falha.
      expect(alertas[0]).not.toBe(primeiro);
      expect(alertas[0]).toHaveTextContent(
        "Não foi possível carregar a ficha.",
      );
    });

    it("nova leitura que vira 'não encontrado' leva o foco ao h1 dele", async () => {
      vi.mocked(buscarColaborador).mockRejectedValueOnce(new Error("falha"));
      render(<Ficha />);
      await screen.findByRole("alert");
      vi.mocked(buscarColaborador).mockRejectedValueOnce(
        Object.assign(new Error("Recurso não encontrado."), { status: 404 }),
      );
      clicarComFoco(screen.getByRole("button", { name: "Tentar de novo" }));
      const titulo = await screen.findByRole("heading", {
        level: 1,
        name: "Colaborador não encontrado",
      });
      await waitFor(() => expect(titulo).toHaveFocus());
    });
  });

  describe("lotação e jornada do cabeçalho", () => {
    it("falhas de lotação e de jornada são anunciadas, cada uma uma vez", async () => {
      vi.mocked(listarAlocacoesVinculo).mockRejectedValueOnce(
        new Error("falha"),
      );
      vi.mocked(listarVinculosHorario).mockRejectedValueOnce(
        new Error("falha"),
      );
      render(<Ficha />);
      await esperarFicha();
      await waitFor(() =>
        expect(within(cabecalho()).getAllByRole("alert")).toHaveLength(2),
      );
      const textos = within(cabecalho())
        .getAllByRole("alert")
        .map((a) => a.textContent);
      expect(textos).toEqual([
        "Não foi possível carregar a lotação.",
        "Não foi possível carregar a jornada.",
      ]);
      // O botão fica fora do alerta: o nome dele não entra no anúncio.
      for (const botao of within(cabecalho()).getAllByRole("button", {
        name: "Tentar de novo",
      })) {
        expect(botao.closest("[role=alert]")).toBeNull();
      }
    });

    it("lotação: botão estável e focado na nova leitura; sucesso leva o foco à lotação", async () => {
      vi.mocked(listarAlocacoesVinculo).mockRejectedValueOnce(
        new Error("falha"),
      );
      render(<Ficha />);
      await esperarFicha();
      const botao = botaoDoAlerta(
        await within(cabecalho()).findByRole("alert"),
      );

      const leitura = adiado<AlocacaoOrganizacionalApi[]>();
      vi.mocked(listarAlocacoesVinculo).mockImplementationOnce(
        () => leitura.promessa,
      );
      clicarComFoco(botao);
      expect(document.activeElement).toBe(botao);
      expect(botao).toHaveAttribute("aria-disabled", "true");

      await act(async () => {
        leitura.resolver([alocacao()]);
      });
      await waitFor(() =>
        expect(document.activeElement).toHaveClass(
          "ficha-colaborador__lotacao",
        ),
      );
      expect(document.activeElement).toHaveTextContent(
        "Cargo: ANL — Analista (teste)",
      );
    });

    it("lotação: nova falha mantém o foco no botão, com um alerta novo", async () => {
      vi.mocked(listarAlocacoesVinculo).mockRejectedValueOnce(
        new Error("falha"),
      );
      render(<Ficha />);
      await esperarFicha();
      const primeiro = await within(cabecalho()).findByRole("alert");
      const botao = botaoDoAlerta(primeiro);

      const leitura = adiado<AlocacaoOrganizacionalApi[]>();
      vi.mocked(listarAlocacoesVinculo).mockImplementationOnce(
        () => leitura.promessa,
      );
      clicarComFoco(botao);
      await act(async () => {
        leitura.rejeitar(new Error("falha de novo"));
      });
      await waitFor(() =>
        expect(botao).toHaveAttribute("aria-disabled", "false"),
      );
      expect(document.activeElement).toBe(botao);
      const alertas = within(cabecalho()).getAllByRole("alert");
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).not.toBe(primeiro);
    });

    it("jornada: botão estável e focado na nova leitura; sucesso leva o foco ao item 'Jornada vigente'", async () => {
      vi.mocked(listarVinculosHorario).mockRejectedValueOnce(
        new Error("falha"),
      );
      render(<Ficha />);
      await esperarFicha();
      const botao = botaoDoAlerta(
        await within(cabecalho()).findByRole("alert"),
      );

      const leitura = adiado<ReturnType<typeof paginado<VinculoHorarioApi>>>();
      vi.mocked(listarVinculosHorario).mockImplementationOnce(
        () => leitura.promessa,
      );
      clicarComFoco(botao);
      expect(document.activeElement).toBe(botao);
      expect(botao).toHaveAttribute("aria-disabled", "true");

      await act(async () => {
        leitura.resolver(paginado([jornada()]));
      });
      await waitFor(() =>
        expect(document.activeElement).toHaveTextContent(
          /^Jornada vigente\s*JOR44 — Comercial \(teste\)$/,
        ),
      );
    });

    it("jornada: nova falha mantém o foco no botão, com um alerta novo", async () => {
      vi.mocked(listarVinculosHorario).mockRejectedValueOnce(
        new Error("falha"),
      );
      render(<Ficha />);
      await esperarFicha();
      const primeiro = await within(cabecalho()).findByRole("alert");
      const botao = botaoDoAlerta(primeiro);

      const leitura = adiado<ReturnType<typeof paginado<VinculoHorarioApi>>>();
      vi.mocked(listarVinculosHorario).mockImplementationOnce(
        () => leitura.promessa,
      );
      clicarComFoco(botao);
      await act(async () => {
        leitura.rejeitar(new Error("falha de novo"));
      });
      await waitFor(() =>
        expect(botao).toHaveAttribute("aria-disabled", "false"),
      );
      expect(document.activeElement).toBe(botao);
      const alertas = within(cabecalho()).getAllByRole("alert");
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).not.toBe(primeiro);
    });
  });
});

// ---------------------------------------------------------------------------
// Refinamento visual — a ficha como painel de perfil: cabeçalho com faixa,
// avatar por iniciais, selos, papel na estrutura e retorno à listagem; faixa
// de resumo em cartões; abas com ícone próprio. Só dados reais e só ações que
// existem.
// ---------------------------------------------------------------------------
describe("T198 — painel de perfil", () => {
  function perfil(): HTMLElement {
    const el = document.querySelector<HTMLElement>(
      ".ficha-colaborador__perfil",
    );
    if (!el) throw new Error("Sem painel de perfil.");
    return el;
  }

  it("iniciais do avatar: primeira letra do primeiro e do último nome", () => {
    expect(iniciaisDe("Ana Sintética (teste)")).toBe("AT");
    expect(iniciaisDe("  bruno   sintético ")).toBe("BS");
    expect(iniciaisDe("Única")).toBe("Ú");
    expect(iniciaisDe("   ")).toBe("");
  });

  it("cabeçalho: faixa e avatar decorativos, nome, selos e papel na estrutura", async () => {
    render(<Ficha />);
    await esperarFicha();
    const faixa = perfil().querySelector(".ficha-colaborador__faixa");
    expect(faixa).toHaveAttribute("aria-hidden", "true");
    expect(faixa).toBeEmptyDOMElement();
    const avatar = perfil().querySelector(".ficha-colaborador__avatar");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).toHaveTextContent(/^AT$/);
    // Sem foto: nenhum <img> no painel.
    expect(perfil().querySelector("img")).toBeNull();

    const selos = perfil().querySelector(".ficha-colaborador__selos")!;
    expect(selos).toHaveTextContent("Ativo nesta empresa");
    expect(selos).toHaveTextContent("CLT · Ativo");
    await waitFor(() =>
      expect(
        perfil().querySelector(".ficha-colaborador__papel"),
      ).toHaveTextContent("Analista (teste) · Administrativo (teste)"),
    );
  });

  it("sem lotação vigente, o papel na estrutura não aparece (nada inventado)", async () => {
    vi.mocked(listarAlocacoesVinculo).mockResolvedValue([]);
    render(<Ficha />);
    await esperarFicha();
    await waitFor(() =>
      expect(cabecalho()).toHaveTextContent("Sem lotação vigente"),
    );
    expect(perfil().querySelector(".ficha-colaborador__papel")).toBeNull();
  });

  it("faixa de resumo: admissão, cargo e departamento, jornada e vínculo, nessa ordem, com ícone decorativo", async () => {
    render(<Ficha />);
    await esperarFicha();
    const rotulos = [
      ...cabecalho().querySelectorAll(".ficha-colaborador__resumo dt"),
    ].map((dt) => dt.textContent);
    expect(rotulos).toEqual([
      "Admissão",
      "Cargo e departamento",
      "Jornada vigente",
      "Vínculo principal",
    ]);
    for (const icone of cabecalho().querySelectorAll(
      ".ficha-colaborador__resumo svg",
    )) {
      expect(icone).toHaveAttribute("aria-hidden", "true");
      expect(icone).toHaveAttribute("focusable", "false");
    }
    // Nada de tempo de empresa nem de contato na faixa (D19).
    expect(cabecalho()).not.toHaveTextContent(/tempo de (casa|empresa)/i);
    expect(cabecalho()).not.toHaveTextContent(/e-mail|celular|telefone/i);
  });

  it("encerrado: o desligamento entra como cartão depois da admissão", async () => {
    vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
      vinculo({ situacao: "encerrado", dataDesligamento: "2026-06-30" }),
    ]);
    render(<Ficha />);
    await esperarFicha();
    const rotulos = [
      ...cabecalho().querySelectorAll(".ficha-colaborador__resumo dt"),
    ].map((dt) => dt.textContent);
    expect(rotulos.slice(0, 2)).toEqual(["Admissão", "Desligamento"]);
    expect(
      perfil().querySelector(".ficha-colaborador__selos"),
    ).toHaveTextContent("CLT · Encerrado");
  });

  it("'Voltar para Colaboradores' no cabeçalho volta à listagem e respeita a edição pendente", async () => {
    const onVoltar = vi.fn();
    render(<Ficha podeEditarFicha onVoltar={onVoltar} />);
    await esperarFicha();
    const voltar = within(cabecalho()).getByRole("button", {
      name: "Voltar para Colaboradores",
    });
    fireEvent.click(voltar);
    expect(onVoltar).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Outra (teste)" },
    });
    fireEvent.click(voltar);
    expect(
      screen.getByRole("dialog", { name: "Sair da ficha sem salvar?" }),
    ).toBeInTheDocument();
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it("o cabeçalho só tem a ação que existe: nada de editar, exportar, convidar ou menu", async () => {
    render(<Ficha podeEditarFicha podeOperarJornada />);
    await esperarFicha();
    await waitFor(() =>
      expect(cabecalho()).toHaveTextContent("JOR44 — Comercial (teste)"),
    );
    expect(
      within(cabecalho())
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Voltar para Colaboradores"]);
  });

  it("abas com ícone decorativo: o nome acessível é só o rótulo; nenhuma aba indisponível", async () => {
    render(<Ficha />);
    await esperarFicha();
    const abas = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(abas).toHaveLength(4);
    for (const aba of abas) {
      const icone = aba.querySelector("svg");
      expect(icone).toHaveAttribute("aria-hidden", "true");
    }
    expect(abas.map((a) => a.textContent)).toEqual([
      "Dados do colaborador",
      "Vida funcional",
      "Dados contratuais",
      "Jornada de trabalho",
    ]);
    expect(
      screen.queryByRole("tab", {
        name: /sal[aá]rio|f[eé]rias|benef[ií]cio|documento|pesquisa|coment[aá]rio|portal/i,
      }),
    ).toBeNull();
    // As abas ficam no mesmo painel do cabeçalho.
    expect(perfil()).toContainElement(screen.getByRole("tablist"));
  });

  it("a edição do nome fica num cartão com título e contexto (só para quem edita)", async () => {
    const { unmount } = render(<Ficha podeEditarFicha />);
    await esperarFicha();
    const cartao = screen.getByRole("region", { name: "Identificação" });
    expect(within(cartao).getByLabelText("Nome")).toBeInTheDocument();
    expect(cartao).toHaveTextContent(
      "O nome aparece em todas as telas do Evolli.",
    );
    unmount();

    render(<Ficha />);
    await esperarFicha();
    expect(screen.queryByRole("region", { name: "Identificação" })).toBeNull();
  });
});

describe("T198 — contrato de CSS do painel de perfil (375 px, tokens)", () => {
  const css = readFileSync(
    "src/screens/pessoas/FichaColaboradorScreen.css",
    "utf8",
  );
  const corpo = (seletor: string) => {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(
      String.raw`(?:^|\})\s*${escapado}\s*\{([^}]*)\}`,
      "m",
    ).exec(css);
    return m ? (m[1] ?? "") : null;
  };
  /** O bloco do `@media (max-width: 40rem)` que contém o seletor. */
  const noCelular = (seletor: string) => {
    const blocos = css.split("@media (max-width: 40rem)").slice(1);
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const bloco of blocos) {
      const m = new RegExp(String.raw`${escapado}\s*\{([^}]*)\}`).exec(bloco);
      if (m) return m[1] ?? "";
    }
    return null;
  };

  it("o painel recorta a faixa e encolhe com a tela", () => {
    expect(corpo(".ficha-colaborador__perfil")).toMatch(/overflow:\s*hidden;/);
    expect(corpo(".ficha-colaborador__perfil")).toMatch(/min-width:\s*0;/);
    expect(corpo(".ficha-colaborador__topo")).toMatch(/flex-wrap:\s*wrap;/);
  });

  it("faixa e avatar só com tokens do Evolli", () => {
    expect(corpo(".ficha-colaborador__faixa")).toMatch(/var\(--color-action\)/);
    expect(corpo(".ficha-colaborador__avatar")).toMatch(
      /border-radius:\s*var\(--radius-pill\);/,
    );
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\brgba?\(|\bhsla?\(/i);
    expect(css).not.toMatch(/url\(/i);
  });

  it("no celular, as quatro abas viram grade de duas colunas, sem rolagem lateral", () => {
    const abas = noCelular(".ficha-colaborador__abas");
    expect(abas).toMatch(/display:\s*grid;/);
    expect(abas).toMatch(
      /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(abas).toMatch(/overflow-x:\s*visible;/);
    expect(noCelular(".ficha-colaborador__aba")).toMatch(
      /white-space:\s*normal;/,
    );
  });

  it("cartões da faixa e do conteúdo encolhem abaixo do conteúdo", () => {
    expect(corpo(".ficha-colaborador__item")).toMatch(/min-width:\s*0;/);
    expect(corpo(".ficha-colaborador__cartao")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
  });
});
