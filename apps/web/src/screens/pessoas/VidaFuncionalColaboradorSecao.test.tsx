import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  VidaFuncionalColaboradorSecao,
  type VidaFuncionalColaboradorSecaoProps,
} from "./VidaFuncionalColaboradorSecao";
import type { VinculoApi } from "../../api/colaboradoresClient";
import {
  buscarLinhaDoTempo,
  cancelarMovimentacao,
  efetivarMovimentacao,
  registrarMovimentacao,
  retificarMovimentacao,
  type MovimentacaoApi,
} from "../../api/movimentacaoClient";
import {
  listarAlocacoesVinculo,
  type AlocacaoOrganizacionalApi,
} from "../../api/vinculoContratualClient";

vi.mock("../../api/movimentacaoClient");
vi.mock("../../api/vinculoContratualClient");

/**
 * T187 — "Vida funcional" da ficha: lotação vigente e linha do tempo do
 * vínculo principal, só leitura, sobre `linha-do-tempo` e `alocacoes`.
 */

const COLABORADOR_ID = "11111111-1111-4111-8111-111111111111";
const EMPRESA_ID = "44444444-4444-4444-8444-444444444444";

const vinculo: VinculoApi = {
  id: "33333333-3333-4333-8333-333333333333",
  colaboradorId: COLABORADOR_ID,
  empresaId: EMPRESA_ID,
  matricula: "MAT-0001",
  tipo: "clt",
  situacao: "ativo",
  dataAdmissao: "2025-01-10",
  dataDesligamento: null,
  criadoEm: "2025-01-10T12:00:00.000Z",
  atualizadoEm: "2025-01-10T12:00:00.000Z",
};

const DEPARTAMENTO = {
  id: "d-1",
  codigo: "ADM",
  nome: "Administrativo (teste)",
};
const CARGO = { id: "c-1", codigo: "ANA", nome: "Analista (teste)" };

function movimentacao(
  id: string,
  parcial: Partial<MovimentacaoApi>,
): MovimentacaoApi {
  return {
    id,
    vinculoId: vinculo.id,
    empresaId: EMPRESA_ID,
    tipo: "transferencia_organizacional",
    status: "efetivada",
    motivoCodigo: "realocacao_interna",
    registradaEm: "2025-03-01T12:00:00.000Z",
    solicitanteUserId: "u-1",
    vigenciaInicio: "2025-03-01",
    efetivadaEm: "2025-03-01T12:00:00.000Z",
    executorUserId: "u-1",
    retificaId: null,
    destinoUnidadeOrganizacionalId: null,
    destinoDepartamentoId: DEPARTAMENTO.id,
    destinoAreaId: null,
    destinoEquipeId: null,
    destinoCargoId: null,
    destinoCentroCustoId: null,
    criadoEm: "2025-03-01T12:00:00.000Z",
    atualizadoEm: "2025-03-01T12:00:00.000Z",
    ...parcial,
  };
}

/** Uma movimentação de cada status, inclusive as históricas. */
const LINHA_COMPLETA: MovimentacaoApi[] = [
  movimentacao("m-adm", {
    tipo: "admissao",
    motivoCodigo: "admissao_inicial",
    vigenciaInicio: "2025-01-10",
  }),
  movimentacao("m-ret", { status: "retificada", vigenciaInicio: "2025-02-01" }),
  movimentacao("m-cor", { retificaId: "m-ret", vigenciaInicio: "2025-02-02" }),
  movimentacao("m-can", {
    tipo: "mudanca_cargo",
    status: "cancelada",
    efetivadaEm: null,
    motivoCodigo: "promocao",
  }),
  movimentacao("m-sol", { status: "solicitada", efetivadaEm: null }),
  movimentacao("m-pro", {
    tipo: "mudanca_cargo",
    status: "programada",
    efetivadaEm: null,
    vigenciaInicio: "2099-01-01",
  }),
];

function alocacao(
  parcial: Partial<AlocacaoOrganizacionalApi>,
): AlocacaoOrganizacionalApi {
  return {
    id: "a-1",
    vinculoId: vinculo.id,
    empresaId: EMPRESA_ID,
    unidadeOrganizacionalId: null,
    departamentoId: DEPARTAMENTO.id,
    areaId: null,
    equipeId: null,
    cargoId: CARGO.id,
    centroCustoId: null,
    vigenteDe: "2025-02-02",
    vigenteAte: null,
    movimentacaoOrigemId: "m-cor",
    criadoEm: "2025-02-02T12:00:00.000Z",
    ...parcial,
  };
}

function montar(props: Partial<VidaFuncionalColaboradorSecaoProps> = {}) {
  return render(
    <VidaFuncionalColaboradorSecao
      colaboradorId={COLABORADOR_ID}
      nomeColaborador="Pessoa Teste"
      vinculo={vinculo}
      lotacaoDaLinha={{
        vinculoId: vinculo.id,
        lotacao: { departamento: DEPARTAMENTO, cargo: CARGO },
      }}
      {...props}
    />,
  );
}

const secao = () => screen.getByRole("region", { name: "Vida funcional" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarLinhaDoTempo).mockResolvedValue(LINHA_COMPLETA);
  vi.mocked(listarAlocacoesVinculo).mockResolvedValue([
    alocacao({ id: "a-0", vigenteDe: "2025-01-10", vigenteAte: "2025-02-02" }),
    alocacao({}),
  ]);
});

describe("T187 — Vida funcional: seção preenchida", () => {
  it("lê linha do tempo e alocações do vínculo principal, e só elas", async () => {
    montar();
    await screen.findByRole("table", { name: "Linha do tempo — Pessoa Teste" });
    expect(buscarLinhaDoTempo).toHaveBeenCalledWith(vinculo.id);
    expect(listarAlocacoesVinculo).toHaveBeenCalledWith(vinculo.id);
    expect(secao()).toHaveTextContent(
      "Vínculo principal: MAT-0001 · Ativo · admissão em 10/01/2025",
    );
  });

  it("lotação vigente é a alocação aberta, com os nomes da linha da listagem", async () => {
    montar();
    await screen.findByRole("table", { name: "Linha do tempo — Pessoa Teste" });
    const lotacao = within(secao()).getByText("Departamento").closest("dl")!;
    expect(lotacao).toHaveTextContent("DepartamentoAdministrativo (teste)");
    expect(lotacao).toHaveTextContent("CargoAnalista (teste)");
    expect(lotacao).toHaveTextContent("Vigente desde02/02/2025");
  });

  it("mostra todos os status, sem esconder cancelada nem retificada", async () => {
    montar();
    const tabela = await screen.findByRole("table", {
      name: "Linha do tempo — Pessoa Teste",
    });
    const linhas = within(tabela).getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(LINHA_COMPLETA.length);
    for (const status of [
      "Efetivada",
      "Retificada",
      "Cancelada",
      "Solicitada",
      "Programada",
    ]) {
      expect(within(tabela).getAllByText(status).length).toBeGreaterThan(0);
    }
    expect(tabela).toHaveTextContent(
      "Substituída por uma retificação; mantida no histórico.",
    );
    expect(tabela).toHaveTextContent("Corrige um registro anterior.");
    expect(tabela).toHaveTextContent("Cancelada; mantida no histórico.");
    // Ordem do servidor, sem reordenar.
    expect(linhas[0]).toHaveTextContent("Admissão");
    expect(linhas[5]).toHaveTextContent("01/01/2099");
  });

  it("referência que não bate com a linha da listagem não ganha nome inventado", async () => {
    vi.mocked(listarAlocacoesVinculo).mockResolvedValue([
      alocacao({ cargoId: "c-outro", departamentoId: null }),
    ]);
    montar();
    await screen.findByRole("table", { name: "Linha do tempo — Pessoa Teste" });
    const lotacao = within(secao()).getByText("Departamento").closest("dl")!;
    expect(lotacao).toHaveTextContent("DepartamentoNão informado");
    expect(lotacao).toHaveTextContent("CargoConsulte no Histórico funcional");
    expect(lotacao).not.toHaveTextContent("Analista (teste)");
  });
});

describe("T187 — Vida funcional: estados vazios", () => {
  it("sem movimentação: diz isso, sem tabela", async () => {
    vi.mocked(buscarLinhaDoTempo).mockResolvedValue([]);
    montar();
    expect(
      await screen.findByText(
        "Nenhuma movimentação registrada para este vínculo.",
      ),
    ).toBeInTheDocument();
    expect(within(secao()).queryByRole("table")).toBeNull();
  });

  it("sem lotação vigente: nenhuma alocação aberta", async () => {
    vi.mocked(listarAlocacoesVinculo).mockResolvedValue([
      alocacao({ vigenteAte: "2025-06-01" }),
    ]);
    montar({ vinculo: { ...vinculo, situacao: "encerrado" } });
    expect(
      await screen.findByText(
        /^Sem lotação vigente: o vínculo não tem alocação aberta/,
      ),
    ).toBeInTheDocument();
    expect(within(secao()).queryByText("Departamento")).toBeNull();
  });

  it("sem vínculo na empresa: nada é pedido ao servidor", () => {
    montar({ vinculo: null });
    expect(secao()).toHaveTextContent(
      "Sem vínculo nesta empresa: não há vida funcional para mostrar.",
    );
    expect(buscarLinhaDoTempo).not.toHaveBeenCalled();
    expect(listarAlocacoesVinculo).not.toHaveBeenCalled();
    expect(
      within(secao()).queryByRole("button", {
        name: "Abrir no Histórico funcional",
      }),
    ).toBeNull();
  });
});

describe("T187 — Vida funcional: somente leitura e permissões", () => {
  it("nenhuma ação de escrita: sem botões de operar e nenhuma chamada de escrita", async () => {
    montar({ onAbrirHistorico: vi.fn() });
    await screen.findByRole("table", { name: "Linha do tempo — Pessoa Teste" });
    const botoes = within(secao())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(botoes).toEqual(["Abrir no Histórico funcional"]);
    expect(within(secao()).queryByRole("textbox")).toBeNull();
    expect(within(secao()).queryByRole("combobox")).toBeNull();
    for (const escrita of [
      registrarMovimentacao,
      efetivarMovimentacao,
      cancelarMovimentacao,
      retificarMovimentacao,
    ]) {
      expect(escrita).not.toHaveBeenCalled();
    }
  });

  it.each([403, 404])(
    "servidor recusa (%i): aviso de acesso, sem dado e sem atalho",
    async (status) => {
      vi.mocked(buscarLinhaDoTempo).mockRejectedValue(
        Object.assign(new Error("recusado"), { status }),
      );
      montar({ onAbrirHistorico: vi.fn() });
      expect(
        await screen.findByText(
          "Seu perfil não tem acesso à vida funcional deste vínculo.",
        ),
      ).toBeInTheDocument();
      expect(within(secao()).queryByRole("table")).toBeNull();
      expect(within(secao()).queryByText("Lotação vigente")).toBeNull();
      expect(
        within(secao()).queryByRole("button", {
          name: "Abrir no Histórico funcional",
        }),
      ).toBeNull();
    },
  );

  it("falha de rede é erro, com 'Tentar novamente' que relê", async () => {
    vi.mocked(buscarLinhaDoTempo).mockRejectedValueOnce(new Error("rede"));
    montar();
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "Não foi possível carregar a vida funcional.",
    );
    fireEvent.click(
      within(alerta).getByRole("button", { name: "Tentar novamente" }),
    );
    await screen.findByRole("table", { name: "Linha do tempo — Pessoa Teste" });
    expect(buscarLinhaDoTempo).toHaveBeenCalledTimes(2);
  });
});

describe("T187 — Vida funcional: atalho ao Histórico funcional", () => {
  it("leva o colaborador e o vínculo da ficha", async () => {
    const onAbrirHistorico = vi.fn();
    montar({ onAbrirHistorico });
    fireEvent.click(
      within(secao()).getByRole("button", {
        name: "Abrir no Histórico funcional",
      }),
    );
    expect(onAbrirHistorico).toHaveBeenCalledWith({
      colaboradorId: COLABORADOR_ID,
      vinculoId: vinculo.id,
    });
  });

  it("com edição pendente na ficha, o atalho espera e diz por quê", () => {
    const onAbrirHistorico = vi.fn();
    montar({ onAbrirHistorico, atalhoBloqueado: true });
    const atalho = within(secao()).getByRole("button", {
      name: "Abrir no Histórico funcional",
    });
    expect(atalho).toBeDisabled();
    expect(atalho).toHaveAccessibleDescription(
      "Salve ou descarte as alterações da ficha para abrir o Histórico funcional.",
    );
    fireEvent.click(atalho);
    expect(onAbrirHistorico).not.toHaveBeenCalled();
  });

  it("sem quem trate o atalho, ele não aparece", async () => {
    montar();
    await screen.findByRole("table", { name: "Linha do tempo — Pessoa Teste" });
    expect(
      within(secao()).queryByRole("button", {
        name: "Abrir no Histórico funcional",
      }),
    ).toBeNull();
  });

  it("resposta atrasada de outro vínculo é descartada", async () => {
    let resolverAntiga: (v: MovimentacaoApi[]) => void = () => {};
    vi.mocked(buscarLinhaDoTempo).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolverAntiga = resolve;
        }),
    );
    const { rerender } = montar();
    const outro = { ...vinculo, id: "55555555-5555-4555-8555-555555555555" };
    vi.mocked(buscarLinhaDoTempo).mockResolvedValue([]);
    rerender(
      <VidaFuncionalColaboradorSecao
        colaboradorId={COLABORADOR_ID}
        nomeColaborador="Pessoa Teste"
        vinculo={outro}
      />,
    );
    await screen.findByText(
      "Nenhuma movimentação registrada para este vínculo.",
    );
    await act(async () => {
      resolverAntiga(LINHA_COMPLETA);
    });
    expect(within(secao()).queryByRole("table")).toBeNull();
    expect(buscarLinhaDoTempo).toHaveBeenLastCalledWith(outro.id);
  });
});
