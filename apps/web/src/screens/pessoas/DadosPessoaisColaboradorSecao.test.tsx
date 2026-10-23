/**
 * T177 — dados pessoais e endereço na ficha do colaborador, só leitura.
 *
 * Prende o que a ficha mostra para cada resposta do servidor: os valores
 * gravados (com a data em dia civil, sem ISO cru), "Não informado" para campo
 * vazio, sem registro, bloqueado e cada recusa do servidor (sem acesso, fora
 * da empresa ativa, empresa ambígua do `master_tecnico`) — que nunca mostra
 * valor.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DadosPessoaisColaboradorSecao } from "./DadosPessoaisColaboradorSecao";
import {
  type DadosPessoaisDoColaboradorApi,
  consultarDadosPessoaisDoColaborador,
  registrarDadosPessoaisDoColaborador,
} from "../../api/dadosPessoaisClient";
import { ApiError } from "../../api/colaboradoresClient";
import { consultarCep } from "../../api/cepClient";
import {
  CsrfRequestError,
  CsrfSessionExpiredError,
} from "../../api/csrfClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/dadosPessoaisClient");
vi.mock("../../api/colaboradoresClient");
// T181 — a consulta de CEP nunca sai da ficha nos testes.
vi.mock("../../api/cepClient");

const ID = "11111111-1111-4111-8111-111111111111";

function recusa(status: number): ApiError {
  const erro = new ApiError(status, "recusado");
  Object.assign(erro, { status, message: "recusado" });
  return erro;
}

const registrado: DadosPessoaisDoColaboradorApi = {
  colaboradorId: ID,
  empresaId: "44444444-4444-4444-4444-444444444444",
  situacao: "registrado",
  perfilPessoal: {
    dataNascimento: "1990-05-20",
    // T179 — gravado como código da lista fechada; a ficha mostra o rótulo.
    sexo: "feminino",
    saudacao: null,
    estadoCivil: "Casada",
    nacionalidade: "Brasileira",
    naturalidade: "Ouro Preto",
    escolaridade: null,
    curso: null,
    nomePai: null,
    nomeMae: "Mãe Sintética",
    atualizadoEm: "2026-10-20T12:00:00.000Z",
  },
  endereco: {
    pais: "Brasil",
    cep: "30140-071",
    logradouro: "Rua Sintética",
    numero: "10",
    complemento: null,
    bairro: "Centro",
    cidade: "Cidade Sintética",
    estado: "MG",
    atualizadoEm: "2026-10-20T12:00:00.000Z",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Ficha — dados pessoais e endereço (T177)", () => {
  it("mostra o que o servidor gravou, com a data em dia civil", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue(
      registrado,
    );
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
    expect(await screen.findByText("Feminino")).toBeInTheDocument();
    expect(screen.getByText("20/05/1990")).toBeInTheDocument();
    expect(screen.getByText("Mãe Sintética")).toBeInTheDocument();
    expect(screen.getByText("Cidade Sintética")).toBeInTheDocument();
    expect(screen.getByText("30140-071")).toBeInTheDocument();
    expect(screen.getAllByText("Não informado").length).toBeGreaterThan(0);
    expect(consultarDadosPessoaisDoColaborador).toHaveBeenCalledWith(ID);
    expectSemIsoVisivel(document.body);
  });

  it.each([
    ["Brasil", "30140071", "30140-071"],
    ["brasil", "30140071", "30140-071"],
    ["Portugal", "1000-001", "1000-001"],
    ["Portugal", "30140071", "30140071"],
  ])(
    "T179 — com país %s, o CEP gravado %s aparece como %s",
    async (pais, cep, exibido) => {
      vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
        ...registrado,
        endereco: { ...registrado.endereco!, pais, cep },
      });
      render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
      expect(await screen.findByText(exibido)).toBeInTheDocument();
    },
  );

  it("T181 — abre em leitura: nenhum campo editável até 'Editar'", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue(
      registrado,
    );
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} podeEditar />);
    await screen.findByText("Feminino");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Editar dados pessoais",
      "Editar endereço",
    ]);
  });

  it("sem registro diz isso, sem campo falso", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
      ...registrado,
      situacao: "sem_registro",
      perfilPessoal: null,
      endereco: null,
    });
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} podeEditar />);
    expect(
      await screen.findByText("Nenhum dado pessoal registrado."),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum endereço registrado.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    // T181 — sem registro, o bloco se preenche pela própria ficha.
    expect(
      screen.getByRole("button", { name: "Preencher dados pessoais" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preencher endereço" }),
    ).toBeInTheDocument();
  });

  it("vínculo encerrado: uso bloqueado, nenhum valor", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
      ...registrado,
      situacao: "bloqueado",
      perfilPessoal: null,
      endereco: null,
    });
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
    expect(
      await screen.findByText(/uso dos dados pessoais/),
    ).toBeInTheDocument();
    // T181 — vínculo encerrado não tem edição: o servidor recusaria.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    [403, /não tem acesso aos dados pessoais/],
    [404, /não encontrado na empresa ativa/],
    [409, /vínculo em mais de uma empresa. Selecione a empresa ativa/],
    [401, /Seu acesso expirou/],
  ] as const)(
    "%i: a recusa vira aviso, nunca um valor",
    async (status, mensagem) => {
      vi.mocked(consultarDadosPessoaisDoColaborador).mockRejectedValue(
        recusa(status),
      );
      render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
      expect(await screen.findByText(mensagem)).toBeInTheDocument();
      expect(screen.queryByText("Feminino")).not.toBeInTheDocument();
      // T181 — sem leitura aceita, nenhum botão de edição.
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );
});

// ---------------------------------------------------------------------------
// T179 — sexo de lista fechada: código pelo rótulo, ausente como "Não
// informado", texto livre de cadastro anterior como veio.
// ---------------------------------------------------------------------------
describe("Ficha — sexo (T179)", () => {
  /** O valor exibido na linha "Sexo" da ficha. */
  async function valorDoSexo(): Promise<string> {
    const rotulo = await screen.findByText("Sexo", { selector: "dt" });
    const par = rotulo.closest(".colaboradores-screen__par") as HTMLElement;
    return within(par).getByRole("definition").textContent ?? "";
  }

  it.each([
    ["feminino", "Feminino"],
    ["masculino", "Masculino"],
    ["intersexo", "Intersexo"],
    ["nao_informar", "Não informar"],
  ])("código %s aparece como %s", async (codigo, rotulo) => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
      ...registrado,
      perfilPessoal: { ...registrado.perfilPessoal!, sexo: codigo },
    });
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
    expect(await valorDoSexo()).toBe(rotulo);
    expect(screen.queryByText(codigo)).not.toBeInTheDocument();
  });

  it("sem sexo gravado: 'Não informado', sem inferir", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
      ...registrado,
      perfilPessoal: { ...registrado.perfilPessoal!, sexo: null },
    });
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
    expect(await valorDoSexo()).toBe("Não informado");
  });

  it("texto livre de cadastro anterior aparece como veio, marcado como valor legado (T181)", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
      ...registrado,
      perfilPessoal: { ...registrado.perfilPessoal!, sexo: "Fem. (legado)" },
    });
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
    expect(await valorDoSexo()).toBe("Fem. (legado) (valor legado)");
  });
});

// ---------------------------------------------------------------------------
// T181 — edição na ficha (decisão da proprietária de 2026-10-23): cada bloco
// com "Editar", Salvar e Cancelar; Cancelar volta ao gravado; Salvar envia só
// o bloco; erro no campo com foco no primeiro; nenhuma recusa apaga o
// digitado, e nenhuma mensagem afirma uma gravação incerta.
// ---------------------------------------------------------------------------

type Perfil = NonNullable<DadosPessoaisDoColaboradorApi["perfilPessoal"]>;
type Endereco = NonNullable<DadosPessoaisDoColaboradorApi["endereco"]>;

/** O que o servidor devolve depois de gravar (dados sintéticos). */
function gravado(
  mudancas: {
    perfilPessoal?: Partial<Perfil>;
    endereco?: Partial<Endereco>;
  } = {},
): DadosPessoaisDoColaboradorApi {
  return {
    ...registrado,
    perfilPessoal: {
      ...registrado.perfilPessoal!,
      atualizadoEm: "2026-10-23T12:00:00.000Z",
      ...mudancas.perfilPessoal,
    },
    endereco: {
      ...registrado.endereco!,
      atualizadoEm: "2026-10-23T12:00:00.000Z",
      ...mudancas.endereco,
    },
  };
}

const regiao = (nome: string) => screen.getByRole("region", { name: nome });
const campo = (rotulo: RegExp) => screen.getByLabelText(rotulo);
const botao = (nome: string | RegExp) =>
  screen.getByRole("button", { name: nome });

function montarEdicao(
  props: { podeEditar?: boolean } = {},
  dados: DadosPessoaisDoColaboradorApi = registrado,
) {
  vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue(dados);
  const onAlteradoChange = vi.fn();
  const onSalvandoChange = vi.fn();
  render(
    <DadosPessoaisColaboradorSecao
      colaboradorId={ID}
      onAlteradoChange={onAlteradoChange}
      onSalvandoChange={onSalvandoChange}
      podeEditar
      {...props}
    />,
  );
  return { onAlteradoChange, onSalvandoChange };
}

/** O valor exibido na linha "Sexo" da leitura. */
async function valorDoSexoNaFicha(): Promise<string> {
  const rotulo = await screen.findByText("Sexo", { selector: "dt" });
  const par = rotulo.closest(".colaboradores-screen__par") as HTMLElement;
  return within(par).getByRole("definition").textContent ?? "";
}

async function editar(nome: string) {
  fireEvent.click(await screen.findByRole("button", { name: nome }));
}

describe("T181 — edição dos dados pessoais na ficha", () => {
  it("Editar abre o formulário com o gravado e foco na data de nascimento", async () => {
    montarEdicao();
    await editar("Editar dados pessoais");
    const data = campo(/^Data de nascimento/);
    await waitFor(() => expect(data).toHaveFocus());
    expect(data).toHaveValue("1990-05-20");
    expect(data).toHaveAttribute("aria-required", "true");
    expect(campo(/^Sexo/)).toHaveValue("feminino");
    expect(campo(/^Estado civil/)).toHaveValue("Casada");
    expect(campo(/^Nome da mãe/)).toHaveValue("Mãe Sintética");
    expect(campo(/^Curso/)).toHaveValue("");
    // Só o bloco em edição vira formulário; o endereço segue em leitura.
    expect(within(regiao("Endereço")).queryByRole("textbox")).toBeNull();
    expect(botao("Salvar dados pessoais")).toBeInTheDocument();
    expect(botao("Cancelar")).toBeInTheDocument();
  });

  it("Cancelar descarta o digitado, volta ao gravado e devolve o foco a 'Editar'", async () => {
    const { onAlteradoChange } = montarEdicao();
    await editar("Editar dados pessoais");
    fireEvent.change(campo(/^Nome da mãe/), {
      target: { value: "Outra Mãe" },
    });
    await waitFor(() =>
      expect(onAlteradoChange).toHaveBeenLastCalledWith(true),
    );
    fireEvent.click(botao("Cancelar"));
    expect(botao("Editar dados pessoais")).toHaveFocus();
    expect(screen.getByText("Mãe Sintética")).toBeInTheDocument();
    expect(screen.queryByText("Outra Mãe")).toBeNull();
    await waitFor(() =>
      expect(onAlteradoChange).toHaveBeenLastCalledWith(false),
    );
    // Reabrir começa do gravado, não do que foi descartado.
    fireEvent.click(botao("Editar dados pessoais"));
    expect(campo(/^Nome da mãe/)).toHaveValue("Mãe Sintética");
    expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
  });

  it("Salvar envia só o bloco de dados pessoais, normalizado, e volta à leitura com o gravado", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockResolvedValue(
      gravado({
        perfilPessoal: {
          curso: "Administração",
          sexo: "masculino",
          estadoCivil: null,
        },
      }),
    );
    const { onSalvandoChange } = montarEdicao();
    await editar("Editar dados pessoais");
    fireEvent.change(campo(/^Curso/), {
      target: { value: "  Administração " },
    });
    fireEvent.change(campo(/^Sexo/), { target: { value: "masculino" } });
    fireEvent.change(campo(/^Estado civil/), { target: { value: "   " } });
    fireEvent.click(botao("Salvar dados pessoais"));
    expect(
      await screen.findByText("Dados pessoais salvos."),
    ).toBeInTheDocument();
    expect(registrarDadosPessoaisDoColaborador).toHaveBeenCalledTimes(1);
    const [id, corpo] = vi.mocked(registrarDadosPessoaisDoColaborador).mock
      .calls[0]!;
    expect(id).toBe(ID);
    expect(corpo).toEqual({
      perfilPessoal: {
        dataNascimento: "1990-05-20",
        sexo: "masculino",
        saudacao: null,
        estadoCivil: null,
        nacionalidade: "Brasileira",
        naturalidade: "Ouro Preto",
        escolaridade: null,
        curso: "Administração",
        nomePai: null,
        nomeMae: "Mãe Sintética",
      },
    });
    // Nada de empresa nem de endereço no corpo: a empresa é da sessão.
    expect(corpo).not.toHaveProperty("endereco");
    expect(JSON.stringify(corpo)).not.toContain("empresa");
    expect(screen.getByText("Administração")).toBeInTheDocument();
    expect(screen.getByText("Masculino")).toBeInTheDocument();
    expect(botao("Editar dados pessoais")).toHaveFocus();
    expect(onSalvandoChange).toHaveBeenCalledWith(true);
    await waitFor(() =>
      expect(onSalvandoChange).toHaveBeenLastCalledWith(false),
    );
  });

  it("salvar sem mudar nada diz que nada mudou", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockResolvedValue(
      registrado,
    );
    montarEdicao();
    await editar("Editar dados pessoais");
    fireEvent.click(botao("Salvar dados pessoais"));
    expect(
      await screen.findByText(
        "Nada mudou: os dados pessoais já estavam com estes valores.",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ["", "Informe a data de nascimento."],
    ["2999-01-01", "A data de nascimento não pode estar no futuro."],
  ])(
    "data de nascimento %j: erro no campo, foco nele e nada enviado",
    async (valor, mensagem) => {
      montarEdicao();
      await editar("Editar dados pessoais");
      fireEvent.change(campo(/^Nome da mãe/), {
        target: { value: "Mãe Nova" },
      });
      fireEvent.change(campo(/^Data de nascimento/), {
        target: { value: valor },
      });
      fireEvent.click(botao("Salvar dados pessoais"));
      const data = campo(/^Data de nascimento/);
      await waitFor(() => expect(data).toHaveFocus());
      expect(data).toHaveAttribute("aria-invalid", "true");
      expect(data).toHaveAccessibleDescription(new RegExp(mensagem));
      expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
      // O resto do formulário fica como estava.
      expect(campo(/^Nome da mãe/)).toHaveValue("Mãe Nova");
    },
  );

  // T181 — sexo LEGADO (decisão da proprietária de 2026-10-23): fica como
  // está até alguém escolher, deliberadamente, uma opção da lista atual.
  const comLegado: DadosPessoaisDoColaboradorApi = {
    ...registrado,
    perfilPessoal: { ...registrado.perfilPessoal!, sexo: "Fem. (legado)" },
  };

  it("sexo legado: o seletor começa em 'Manter o valor legado', mostra o valor e não oferece vazio", async () => {
    montarEdicao({}, comLegado);
    await editar("Editar dados pessoais");
    const sexo = campo(/^Sexo/) as HTMLSelectElement;
    expect(
      within(sexo).getByRole("option", { selected: true }),
    ).toHaveTextContent("Manter o valor legado");
    expect(sexo).toHaveAccessibleDescription(
      /Valor legado, gravado antes da lista atual: "Fem\. \(legado\)"\..*segue a lista atual/,
    );
    expect(
      within(sexo)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "Manter o valor legado",
      "Feminino",
      "Masculino",
      "Intersexo",
      "Não informar",
    ]);
    // Abrir não conta como alteração.
    expect(botao("Cancelar")).toBeEnabled();
  });

  it("sexo legado: salvar outro campo omite o sexo do envio, e o legado fica", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockResolvedValue({
      ...comLegado,
      perfilPessoal: {
        ...comLegado.perfilPessoal!,
        curso: "Curso Sintético",
        atualizadoEm: "2026-10-23T12:00:00.000Z",
      },
    });
    montarEdicao({}, comLegado);
    await editar("Editar dados pessoais");
    fireEvent.change(campo(/^Curso/), { target: { value: "Curso Sintético" } });
    fireEvent.click(botao("Salvar dados pessoais"));
    await screen.findByText("Dados pessoais salvos.");
    const corpo = vi.mocked(registrarDadosPessoaisDoColaborador).mock
      .calls[0]![1];
    expect(corpo.perfilPessoal).not.toHaveProperty("sexo");
    expect(corpo.perfilPessoal).toMatchObject({ curso: "Curso Sintético" });
    expect(await valorDoSexoNaFicha()).toBe("Fem. (legado) (valor legado)");
  });

  it.each([
    ["feminino", "Feminino"],
    ["masculino", "Masculino"],
    ["intersexo", "Intersexo"],
    ["nao_informar", "Não informar"],
  ])(
    "sexo legado: escolher %s envia o código da lista",
    async (codigo, rotulo) => {
      vi.mocked(registrarDadosPessoaisDoColaborador).mockResolvedValue({
        ...comLegado,
        perfilPessoal: {
          ...comLegado.perfilPessoal!,
          sexo: codigo,
          atualizadoEm: "2026-10-23T12:00:00.000Z",
        },
      });
      montarEdicao({}, comLegado);
      await editar("Editar dados pessoais");
      fireEvent.change(campo(/^Sexo/), { target: { value: codigo } });
      fireEvent.click(botao("Salvar dados pessoais"));
      await screen.findByText("Dados pessoais salvos.");
      expect(
        vi.mocked(registrarDadosPessoaisDoColaborador).mock.calls[0]![1]
          .perfilPessoal?.sexo,
      ).toBe(codigo);
      expect(await valorDoSexoNaFicha()).toBe(rotulo);
    },
  );

  it("sexo legado: voltar a 'Manter o valor legado' depois de escolher outra opção omite o sexo de novo", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockResolvedValue(comLegado);
    montarEdicao({}, comLegado);
    await editar("Editar dados pessoais");
    const sexo = campo(/^Sexo/);
    fireEvent.change(sexo, { target: { value: "masculino" } });
    fireEvent.change(sexo, { target: { value: "__sexo_legado_mantido__" } });
    fireEvent.click(botao("Salvar dados pessoais"));
    await waitFor(() =>
      expect(registrarDadosPessoaisDoColaborador).toHaveBeenCalled(),
    );
    expect(
      vi.mocked(registrarDadosPessoaisDoColaborador).mock.calls[0]![1]
        .perfilPessoal,
    ).not.toHaveProperty("sexo");
  });

  it("sem sexo legado, o seletor segue como antes: 'Selecione…' e o sexo vai no envio", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockResolvedValue(
      registrado,
    );
    montarEdicao();
    await editar("Editar dados pessoais");
    expect(
      within(campo(/^Sexo/))
        .getAllByRole("option")
        .map((o) => o.textContent)[0],
    ).toBe("Selecione…");
    fireEvent.click(botao("Salvar dados pessoais"));
    await waitFor(() =>
      expect(registrarDadosPessoaisDoColaborador).toHaveBeenCalled(),
    );
    expect(
      vi.mocked(registrarDadosPessoaisDoColaborador).mock.calls[0]![1]
        .perfilPessoal?.sexo,
    ).toBe("feminino");
  });

  it("sem dados pessoais gravados: 'Preencher' abre o formulário vazio e a data é obrigatória", async () => {
    montarEdicao(
      {},
      {
        ...registrado,
        situacao: "sem_registro",
        perfilPessoal: null,
        endereco: null,
      },
    );
    await editar("Preencher dados pessoais");
    expect(campo(/^Data de nascimento/)).toHaveValue("");
    fireEvent.click(botao("Salvar dados pessoais"));
    await waitFor(() =>
      expect(campo(/^Data de nascimento/)).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
  });
});

describe("T181 — edição do endereço na ficha", () => {
  it("Editar mostra o CEP brasileiro na máscara e Salvar envia só o endereço, com os 8 dígitos", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockResolvedValue(
      gravado({ endereco: { numero: "200", complemento: "Sala 3" } }),
    );
    montarEdicao(
      {},
      { ...registrado, endereco: { ...registrado.endereco!, cep: "30140071" } },
    );
    await editar("Editar endereço");
    expect(campo(/^País/)).toHaveFocus();
    expect(campo(/^CEP/)).toHaveValue("30140-071");
    fireEvent.change(campo(/^Número/), { target: { value: "200" } });
    fireEvent.change(campo(/^Complemento/), { target: { value: "Sala 3" } });
    fireEvent.click(botao("Salvar endereço"));
    expect(await screen.findByText("Endereço salvo.")).toBeInTheDocument();
    const corpo = vi.mocked(registrarDadosPessoaisDoColaborador).mock
      .calls[0]![1];
    expect(corpo).toEqual({
      endereco: {
        pais: "Brasil",
        cep: "30140071",
        logradouro: "Rua Sintética",
        numero: "200",
        complemento: "Sala 3",
        bairro: "Centro",
        cidade: "Cidade Sintética",
        estado: "MG",
      },
    });
    expect(corpo).not.toHaveProperty("perfilPessoal");
    expect(botao("Editar endereço")).toHaveFocus();
  });

  it("limpar um campo opcional envia null; outro país deixa o CEP em texto livre", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockResolvedValue(
      registrado,
    );
    montarEdicao();
    await editar("Editar endereço");
    fireEvent.change(campo(/^País/), { target: { value: "Portugal" } });
    fireEvent.change(campo(/^CEP/), { target: { value: "1000-001" } });
    fireEvent.change(campo(/^Bairro/), { target: { value: "" } });
    // Com outro país não há consulta, nem para quem pode consultar.
    expect(screen.queryByRole("button", { name: "Buscar CEP" })).toBeNull();
    fireEvent.click(botao("Salvar endereço"));
    await waitFor(() =>
      expect(registrarDadosPessoaisDoColaborador).toHaveBeenCalled(),
    );
    expect(
      vi.mocked(registrarDadosPessoaisDoColaborador).mock.calls[0]![1].endereco,
    ).toMatchObject({ pais: "Portugal", cep: "1000-001", bairro: null });
  });

  it("CEP brasileiro incompleto: erro no campo CEP, foco nele e nada enviado", async () => {
    montarEdicao();
    await editar("Editar endereço");
    fireEvent.change(campo(/^CEP/), { target: { value: "3014" } });
    fireEvent.click(botao("Salvar endereço"));
    await waitFor(() => expect(campo(/^CEP/)).toHaveFocus());
    expect(campo(/^CEP/)).toHaveAccessibleDescription(/8 dígitos do CEP/);
    expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
  });

  it("Cancelar volta ao endereço gravado", async () => {
    montarEdicao();
    await editar("Editar endereço");
    fireEvent.change(campo(/^Cidade/), { target: { value: "Outra Cidade" } });
    fireEvent.click(botao("Cancelar"));
    expect(botao("Editar endereço")).toHaveFocus();
    expect(screen.getByText("Cidade Sintética")).toBeInTheDocument();
    expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
  });

  it("sem endereço: começa com o país sugerido e não cria endereço só com o país", async () => {
    montarEdicao({}, { ...registrado, endereco: null });
    await editar("Preencher endereço");
    expect(campo(/^País/)).toHaveValue("Brasil");
    fireEvent.click(botao("Salvar endereço"));
    const aviso = await screen.findByText(
      /Nenhum endereço preenchido: informe ao menos um campo além do país/,
    );
    await waitFor(() => expect(aviso).toHaveFocus());
    expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
  });

  it("com a consulta disponível, 'Buscar CEP' preenche só o vazio e os campos seguem editáveis", async () => {
    vi.mocked(consultarCep).mockResolvedValue({
      cep: "01310100",
      logradouro: "Avenida Sintética",
      bairro: "Bairro Sintético",
      cidade: "Cidade Sintética",
      uf: "SP",
      estado: "São Paulo",
    });
    montarEdicao({}, { ...registrado, endereco: null });
    await editar("Preencher endereço");
    fireEvent.change(campo(/^Logradouro/), {
      target: { value: "Rua Digitada" },
    });
    fireEvent.change(campo(/^CEP/), { target: { value: "01310100" } });
    fireEvent.click(botao("Buscar CEP"));
    await waitFor(() =>
      expect(campo(/^Bairro/)).toHaveValue("Bairro Sintético"),
    );
    expect(consultarCep).toHaveBeenCalledWith("01310100");
    expect(campo(/^Logradouro/)).toHaveValue("Rua Digitada");
    expect(campo(/^Estado/)).toHaveValue("SP");
    expect(
      screen.getByText(/O que já estava digitado foi mantido em Logradouro/),
    ).toBeInTheDocument();
    // "Usar endereço do CEP" substitui só por ação explícita.
    fireEvent.click(botao("Usar endereço do CEP"));
    expect(campo(/^Logradouro/)).toHaveValue("Avenida Sintética");
    expect(botao("Buscar CEP")).toHaveFocus();
    fireEvent.change(campo(/^Bairro/), {
      target: { value: "Bairro Ajustado" },
    });
    expect(campo(/^Bairro/)).toHaveValue("Bairro Ajustado");
  });

  // T181 — a edição da ficha é só de RH e DP: sem `podeEditar` (o
  // master_tecnico, por exemplo), os blocos ficam só em leitura.
  it.each([
    ["com registro", registrado],
    [
      "sem registro",
      {
        ...registrado,
        situacao: "sem_registro" as const,
        perfilPessoal: null,
        endereco: null,
      },
    ],
  ])(
    "sem permissão de editar (%s): só leitura, sem Preencher, Editar, Salvar nem Cancelar",
    async (_caso, dados) => {
      montarEdicao({ podeEditar: false }, dados);
      await screen.findByRole("region", { name: "Dados pessoais" });
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByRole("combobox")).toBeNull();
      expect(consultarCep).not.toHaveBeenCalled();
    },
  );
});

describe("T181 — recusa da gravação: o digitado fica e nada é afirmado sem certeza", () => {
  const INCERTO =
    "Não foi possível confirmar se os dados pessoais foram salvos. O que você digitou foi mantido; salvar de novo é seguro.";
  it.each([
    [
      "403 csrf_invalido",
      () => Object.assign(recusa(403), { codigo: "csrf_invalido" }),
      "Esta página ficou desatualizada. Salve novamente; seus dados foram mantidos.",
    ],
    [
      "sessão expirada na renovação do token",
      () => new CsrfSessionExpiredError(),
      "Sua sessão expirou, e os dados pessoais não foram salvos.",
    ],
    [
      "401",
      () => recusa(401),
      "Sua sessão expirou, e os dados pessoais não foram salvos.",
    ],
    [
      "token não renovado (rede)",
      () => new CsrfRequestError("falhou"),
      "Não foi possível preparar o envio, e os dados pessoais não foram salvos.",
    ],
    [
      "403 de permissão",
      () => recusa(403),
      "Seu perfil não tem permissão para alterar os dados pessoais deste colaborador. Nada foi salvo.",
    ],
    [
      "404 (fora da empresa ativa)",
      () => recusa(404),
      "Colaborador não encontrado na empresa ativa. Nada foi salvo.",
    ],
    [
      "409",
      () => recusa(409),
      "Os dados pessoais não foram salvos: o colaborador deixou de ter vínculo em uso nesta empresa",
    ],
    [
      "400",
      () => recusa(400),
      "O servidor recusou algum dos dados informados.",
    ],
    ["rede", () => new TypeError("Failed to fetch"), INCERTO],
    ["500", () => recusa(500), INCERTO],
    ["503", () => recusa(503), INCERTO],
  ])(
    "%s: mensagem certa, formulário aberto com o digitado e foco no aviso",
    async (_caso, erro, mensagem) => {
      vi.mocked(registrarDadosPessoaisDoColaborador).mockRejectedValue(erro());
      montarEdicao();
      await editar("Editar dados pessoais");
      fireEvent.change(campo(/^Nome do pai/), {
        target: { value: "Pai Sintético" },
      });
      fireEvent.click(botao("Salvar dados pessoais"));
      const aviso = await screen.findByRole("alert");
      expect(aviso).toHaveTextContent(mensagem);
      await waitFor(() => expect(aviso).toHaveFocus());
      expect(campo(/^Nome do pai/)).toHaveValue("Pai Sintético");
      expect(botao("Salvar dados pessoais")).toBeInTheDocument();
      expect(screen.queryByText("Dados pessoais salvos.")).toBeNull();
    },
  );

  it("o aviso incerto do endereço também não afirma nada", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockRejectedValue(
      recusa(502),
    );
    montarEdicao();
    await editar("Editar endereço");
    fireEvent.change(campo(/^Número/), { target: { value: "99" } });
    fireEvent.click(botao("Salvar endereço"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível confirmar se o endereço foi salvo. O que você digitou foi mantido; salvar de novo é seguro.",
    );
    expect(campo(/^Número/)).toHaveValue("99");
  });

  it("depois de uma recusa incerta, salvar de novo envia o mesmo conteúdo", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        gravado({ perfilPessoal: { nomePai: "Pai Sintético" } }),
      );
    montarEdicao();
    await editar("Editar dados pessoais");
    fireEvent.change(campo(/^Nome do pai/), {
      target: { value: "Pai Sintético" },
    });
    fireEvent.click(botao("Salvar dados pessoais"));
    await screen.findByRole("alert");
    fireEvent.click(botao("Salvar dados pessoais"));
    expect(
      await screen.findByText("Dados pessoais salvos."),
    ).toBeInTheDocument();
    const chamadas = vi.mocked(registrarDadosPessoaisDoColaborador).mock.calls;
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]![1]).toEqual(chamadas[0]![1]);
  });

  it("duplo clique em Salvar envia uma vez só, e Cancelar fica travado durante o envio", async () => {
    let liberar: (v: DadosPessoaisDoColaboradorApi) => void = () => undefined;
    vi.mocked(registrarDadosPessoaisDoColaborador).mockReturnValue(
      new Promise((r) => {
        liberar = r;
      }),
    );
    montarEdicao();
    await editar("Editar endereço");
    fireEvent.click(botao("Salvar endereço"));
    fireEvent.click(botao("Salvando…"));
    expect(registrarDadosPessoaisDoColaborador).toHaveBeenCalledTimes(1);
    expect(botao("Cancelar")).toBeDisabled();
    await act(async () => liberar(registrado));
    expect(
      await screen.findByText(/Nada mudou: o endereço/),
    ).toBeInTheDocument();
  });

  it("salvar um bloco não descarta o que está sendo editado no outro", async () => {
    vi.mocked(registrarDadosPessoaisDoColaborador).mockResolvedValue(
      gravado({ endereco: { numero: "77" } }),
    );
    montarEdicao();
    await editar("Editar dados pessoais");
    fireEvent.change(campo(/^Nome do pai/), {
      target: { value: "Pai em edição" },
    });
    fireEvent.click(botao("Editar endereço"));
    fireEvent.change(campo(/^Número/), { target: { value: "77" } });
    fireEvent.click(botao("Salvar endereço"));
    expect(await screen.findByText("Endereço salvo.")).toBeInTheDocument();
    expect(campo(/^Nome do pai/)).toHaveValue("Pai em edição");
    expect(within(regiao("Endereço")).getByText("77")).toBeInTheDocument();
  });
});
