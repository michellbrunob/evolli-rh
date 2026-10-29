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
import { FichaColaboradorScreen } from "./FichaColaboradorScreen";

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
    expect(resumo("Admissão")).toHaveTextContent("—");
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
