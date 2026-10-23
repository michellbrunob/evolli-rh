/**
 * T180 — o modal do cadastro rápido de Departamento, Cargo e Unidade.
 *
 * Prende o que a decisão de 2026-10-23 exige do modal em si: só código e
 * nome, código em maiúsculas e no padrão do contrato, validação local antes
 * de enviar, a empresa ativa no corpo, toda recusa DENTRO do modal (sem
 * fechá-lo) e a trava contra duplo envio. O que acontece na admissão em volta
 * (seletor, foco de volta, dados preservados) está em
 * `NovaAdmissaoScreen.test.tsx`.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ModalReferenciaRapida,
  type TipoReferenciaRapida,
} from "./ModalReferenciaRapida";
import { criarDepartamento, criarUnidade } from "../../api/organizacaoClient";
import { criarCargo } from "../../api/cargoClient";
import { CsrfSessionExpiredError } from "../../api/csrfClient";

vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");

const EMPRESA_ID = "44444444-4444-4444-4444-444444444444";

/** O que o servidor devolve no 201 (dados sintéticos). */
function criada(codigo: string, nome: string) {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    codigo,
    nome,
    empresaId: EMPRESA_ID,
    status: "ativo",
    criadoEm: "2026-10-23T12:00:00.000Z",
    atualizadoEm: "2026-10-23T12:00:00.000Z",
  };
}

/** Recusa lida por forma, como o `ApiError` real (o automock não a monta). */
function recusa(status: number, codigo?: string) {
  return Object.assign(new Error("recusado"), {
    status,
    ...(codigo ? { codigo } : {}),
  });
}

const CLIENTES = {
  departamento: criarDepartamento,
  cargo: criarCargo,
  unidade: criarUnidade,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(criarDepartamento).mockResolvedValue(
    criada("DEP_NOVO", "Departamento Sintético"),
  );
  vi.mocked(criarCargo).mockResolvedValue(
    criada("CAR_NOVO", "Cargo Sintético"),
  );
  vi.mocked(criarUnidade).mockResolvedValue(
    criada("UNI_NOVA", "Unidade Sintética"),
  );
});

function montar(tipo: TipoReferenciaRapida | null = "departamento") {
  const onFechar = vi.fn();
  const onCriada = vi.fn();
  const onRecarregar = vi.fn();
  const resultado = render(
    <ModalReferenciaRapida
      tipo={tipo}
      empresaId={EMPRESA_ID}
      onFechar={onFechar}
      onCriada={onCriada}
      onRecarregar={onRecarregar}
    />,
  );
  return { onFechar, onCriada, onRecarregar, ...resultado };
}

const dialogo = () => screen.getByRole("dialog");
const codigo = () => within(dialogo()).getByLabelText(/^Código/);
const nome = () => within(dialogo()).getByLabelText(/^Nome/);
const cadastrar = () =>
  within(dialogo()).getByRole("button", { name: /^(Cadastrar|Cadastrando…)$/ });

function preencher(valorCodigo: string, valorNome: string) {
  fireEvent.change(codigo(), { target: { value: valorCodigo } });
  fireEvent.change(nome(), { target: { value: valorNome } });
}

describe("T180 — modal de cadastro rápido", () => {
  it.each([
    ["departamento", "Cadastrar departamento"],
    ["cargo", "Cadastrar cargo"],
    ["unidade", "Cadastrar unidade"],
  ] as const)("%s: diálogo com o título próprio", (tipo, titulo) => {
    montar(tipo);
    expect(screen.getByRole("dialog", { name: titulo })).toBeInTheDocument();
  });

  it("fechado, não mostra nada", () => {
    montar(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("só Código e Nome, ambos obrigatórios; foco inicial no Código", () => {
    montar();
    const campos = within(dialogo()).getAllByRole("textbox");
    expect(campos).toHaveLength(2);
    expect(codigo()).toHaveFocus();
    expect(codigo()).toHaveAttribute("aria-required", "true");
    expect(nome()).toHaveAttribute("aria-required", "true");
    expect(codigo()).toHaveAccessibleDescription(
      "Letras maiúsculas, números e _ (2 a 32 caracteres). Não pode ser alterado depois.",
    );
    // Nada de CBO, salário, descrição, hierarquia ou responsáveis.
    for (const proibido of [
      /CBO/i,
      /Salário/i,
      /Descrição/i,
      /Atividades/i,
      /Responsável/i,
      /Superior/i,
    ]) {
      expect(within(dialogo()).queryByLabelText(proibido)).toBeNull();
    }
  });

  it("converte o código para maiúsculas ao digitar", () => {
    montar();
    fireEvent.change(codigo(), { target: { value: "dep_novo1" } });
    expect(codigo()).toHaveValue("DEP_NOVO1");
  });

  it("Escape e Cancelar fecham sem chamar o servidor", () => {
    const { onFechar } = montar();
    preencher("DEP_X", "Algum nome");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(1);
    fireEvent.click(
      within(dialogo()).getByRole("button", { name: "Cancelar" }),
    );
    expect(onFechar).toHaveBeenCalledTimes(2);
    expect(criarDepartamento).not.toHaveBeenCalled();
  });

  it.each([
    ["", "Nome", "Código é obrigatório.", "codigo"],
    [
      "A-1",
      "Nome",
      "Código deve conter apenas letras maiúsculas, dígitos e _ (2 a 32 caracteres).",
      "codigo",
    ],
    [
      "A",
      "Nome",
      "Código deve conter apenas letras maiúsculas, dígitos e _ (2 a 32 caracteres).",
      "codigo",
    ],
    ["DEP_OK", "   ", "Nome é obrigatório.", "nome"],
    [
      "DEP_OK",
      "n".repeat(161),
      "Nome deve ter no máximo 160 caracteres.",
      "nome",
    ],
  ] as const)(
    "código %j e nome inválidos: nenhuma chamada, erro no campo e foco nele",
    (valorCodigo, valorNome, mensagem, campo) => {
      const { onFechar } = montar();
      preencher(valorCodigo, valorNome);
      fireEvent.click(cadastrar());
      expect(criarDepartamento).not.toHaveBeenCalled();
      const alvo = campo === "codigo" ? codigo() : nome();
      expect(alvo).toHaveAttribute("aria-invalid", "true");
      expect(alvo).toHaveAccessibleDescription(
        expect.stringContaining(mensagem),
      );
      expect(alvo).toHaveFocus();
      expect(onFechar).not.toHaveBeenCalled();
    },
  );

  it.each(["departamento", "cargo", "unidade"] as const)(
    "%s: envia código e nome aparados com a empresa ativa e devolve o criado",
    async (tipo) => {
      const { onCriada, onFechar } = montar(tipo);
      preencher(" ref_nova ", "  Referência Sintética  ");
      fireEvent.click(cadastrar());
      await vi.waitFor(() => expect(onCriada).toHaveBeenCalledTimes(1));
      expect(CLIENTES[tipo]).toHaveBeenCalledWith({
        codigo: "REF_NOVA",
        nome: "Referência Sintética",
        empresaId: EMPRESA_ID,
      });
      expect(onCriada.mock.calls[0]![0]).toBe(tipo);
      expect(onCriada.mock.calls[0]![1]).toMatchObject({ status: "ativo" });
      expect(onFechar).not.toHaveBeenCalled();
    },
  );

  it("trava contra duplo envio e mostra Cadastrando…", async () => {
    let resolver: (v: ReturnType<typeof criada>) => void = () => undefined;
    vi.mocked(criarDepartamento).mockReturnValue(
      new Promise((r) => {
        resolver = r;
      }),
    );
    const { onCriada, onFechar } = montar();
    preencher("DEP_NOVO", "Departamento Sintético");
    fireEvent.click(cadastrar());
    fireEvent.click(cadastrar());
    expect(criarDepartamento).toHaveBeenCalledTimes(1);
    expect(cadastrar()).toHaveTextContent("Cadastrando…");
    expect(cadastrar()).toHaveAttribute("aria-disabled", "true");
    // Durante o envio, nem Escape nem Cancelar fecham.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      within(dialogo()).getByRole("button", { name: "Cancelar" }),
    ).toBeDisabled();
    expect(onFechar).not.toHaveBeenCalled();
    await act(async () => {
      resolver(criada("DEP_NOVO", "Departamento Sintético"));
    });
    expect(onCriada).toHaveBeenCalledTimes(1);
  });

  it("409: erro no campo Código, foco nele, modal aberto e dados mantidos", async () => {
    vi.mocked(criarDepartamento).mockRejectedValue(recusa(409));
    const { onFechar, onCriada, onRecarregar } = montar();
    preencher("DEP_REPETIDO", "Departamento Sintético");
    fireEvent.click(cadastrar());
    await vi.waitFor(() =>
      expect(codigo()).toHaveAccessibleDescription(
        expect.stringContaining("Este código já está em uso nesta empresa."),
      ),
    );
    expect(codigo()).toHaveAttribute("aria-invalid", "true");
    expect(codigo()).toHaveFocus();
    expect(codigo()).toHaveValue("DEP_REPETIDO");
    expect(nome()).toHaveValue("Departamento Sintético");
    expect(dialogo()).toBeInTheDocument();
    expect(onFechar).not.toHaveBeenCalled();
    expect(onCriada).not.toHaveBeenCalled();
    expect(onRecarregar).not.toHaveBeenCalled();
  });

  it.each([
    [
      "400",
      () => recusa(400),
      "O servidor recusou os dados. Revise código e nome.",
    ],
    [
      "403 csrf_invalido",
      () => recusa(403, "csrf_invalido"),
      "Esta página ficou desatualizada. Cadastre novamente; seus dados foram mantidos.",
    ],
    [
      "403 sem código",
      () => recusa(403),
      "Seu perfil não tem permissão para cadastrar departamentos.",
    ],
    [
      "401",
      () => recusa(401),
      "Sua sessão expirou. Entre de novo para continuar; os dados digitados foram mantidos nesta página.",
    ],
    [
      "sessão expirada ao renovar o token",
      () => new CsrfSessionExpiredError(),
      "Sua sessão expirou. Entre de novo para continuar; os dados digitados foram mantidos nesta página.",
    ],
    [
      "404",
      () => recusa(404),
      "A empresa ativa não pôde ser confirmada. Feche este cadastro e abra a página de novo.",
    ],
  ])(
    "%s: mensagem geral, modal aberto, sem recarregar a lista",
    async (_caso, erro, mensagem) => {
      vi.mocked(criarDepartamento).mockRejectedValue(erro());
      const { onFechar, onRecarregar } = montar();
      preencher("DEP_NOVO", "Departamento Sintético");
      fireEvent.click(cadastrar());
      const alerta = await within(dialogo()).findByRole("alert");
      expect(alerta).toHaveTextContent(mensagem);
      expect(dialogo()).toBeInTheDocument();
      expect(codigo()).toHaveValue("DEP_NOVO");
      expect(onFechar).not.toHaveBeenCalled();
      expect(onRecarregar).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["cargo", "Seu perfil não tem permissão para cadastrar cargos."],
    ["unidade", "Seu perfil não tem permissão para cadastrar unidades."],
  ] as const)(
    "403 em %s: a mensagem nomeia a referência",
    async (tipo, msg) => {
      vi.mocked(CLIENTES[tipo]).mockRejectedValue(recusa(403));
      montar(tipo);
      preencher("REF_NOVA", "Referência Sintética");
      fireEvent.click(cadastrar());
      expect(await within(dialogo()).findByRole("alert")).toHaveTextContent(
        msg,
      );
    },
  );

  it.each([
    ["rede", () => new TypeError("Failed to fetch")],
    ["500", () => recusa(500)],
    ["503", () => recusa(503)],
  ])(
    "%s: não afirma nem nega o cadastro e pede a recarga da lista",
    async (_caso, erro) => {
      vi.mocked(criarCargo).mockRejectedValue(erro());
      const { onFechar, onRecarregar } = montar("cargo");
      preencher("CAR_NOVO", "Cargo Sintético");
      fireEvent.click(cadastrar());
      expect(await within(dialogo()).findByRole("alert")).toHaveTextContent(
        "Não foi possível confirmar se o cadastro foi feito. A lista foi atualizada: confira se a referência já aparece antes de tentar de novo.",
      );
      expect(onRecarregar).toHaveBeenCalledWith("cargo");
      expect(onFechar).not.toHaveBeenCalled();
    },
  );

  it("depois de uma recusa, corrigir o código limpa o erro do campo", async () => {
    vi.mocked(criarDepartamento).mockRejectedValueOnce(recusa(409));
    montar();
    preencher("DEP_REPETIDO", "Departamento Sintético");
    fireEvent.click(cadastrar());
    await vi.waitFor(() =>
      expect(codigo()).toHaveAttribute("aria-invalid", "true"),
    );
    fireEvent.change(codigo(), { target: { value: "DEP_OUTRO" } });
    expect(codigo()).not.toHaveAttribute("aria-invalid");
  });
});
