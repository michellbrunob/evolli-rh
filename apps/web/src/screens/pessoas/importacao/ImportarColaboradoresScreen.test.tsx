/**
 * T209 (Bloco C) — página de importação de colaboradores por planilha CSV:
 * modelo e arquivo, conferência, confirmação, envio sequencial (uma admissão
 * por linha, com chave de idempotência própria), resultado e "tentar de novo
 * só as que não entraram", com a guarda de saída da T200.
 */
import {
  act,
  fireEvent,
  render as renderSemGuarda,
  screen,
  waitFor,
  within,
  type RenderOptions,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComGuardaDeSaida } from "../../../test/ComGuardaDeSaida";
import {
  ApiError,
  enviarAdmissao,
  type AdmissaoEnviada,
  type AdmissaoRegistradaApi,
} from "../../../api/colaboradoresClient";
import {
  listarDepartamentos,
  listarEmpresasMulti,
  listarUnidades,
} from "../../../api/organizacaoClient";
import { listarCargos } from "../../../api/cargoClient";
import {
  IMPORTAR_COLABORADORES_TITULO_ID,
  ImportarColaboradoresScreen,
} from "./ImportarColaboradoresScreen";

vi.mock("../../../api/colaboradoresClient", async (original) => ({
  ...(await original<typeof import("../../../api/colaboradoresClient")>()),
  enviarAdmissao: vi.fn(),
}));
vi.mock("../../../api/organizacaoClient", async (original) => ({
  ...(await original<typeof import("../../../api/organizacaoClient")>()),
  listarEmpresasMulti: vi.fn(),
  listarDepartamentos: vi.fn(),
  listarUnidades: vi.fn(),
}));
vi.mock("../../../api/cargoClient", async (original) => ({
  ...(await original<typeof import("../../../api/cargoClient")>()),
  listarCargos: vi.fn(),
}));

const CABECALHO =
  "nome;tipo_vinculo;data_admissao;data_nascimento;departamento_codigo;cargo_codigo;matricula;unidade_codigo";
const ANA = "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;";
const BIA = "Bia Lima;aprendiz;01/12/2026;20/03/2008;ADM;ANALISTA;M-2;";
const RUIM = "Zuleica Teste;estatutario;01/12/2026;15/05/1990;ADM;ANALISTA;;";

function paginado<T>(itens: T[], total = itens.length) {
  return { itens, pagina: 1, tamanhoPagina: 100, total };
}

function dep(id: string, codigo: string) {
  return {
    id,
    codigo,
    nome: codigo,
    empresaId: "emp-1",
    status: "ativo",
    criadoEm: "",
    atualizadoEm: "",
  };
}

function admitida(nome: string): AdmissaoEnviada {
  return {
    admissao: { id: `col-${nome}`, nome } as unknown as AdmissaoRegistradaApi,
    reenvio: false,
  };
}

function render(ui: ReactElement, opcoes?: RenderOptions) {
  return renderSemGuarda(ui, { wrapper: ComGuardaDeSaida, ...opcoes });
}

const onSair = vi.fn();

function montar() {
  return render(<ImportarColaboradoresScreen onSair={onSair} />);
}

async function escolherArquivo(texto: string, nome = "pessoas.csv") {
  const campo = await screen.findByLabelText("Arquivo CSV da planilha");
  const arquivo = new File([texto], nome, { type: "text/csv" });
  await act(async () => {
    fireEvent.change(campo, { target: { files: [arquivo] } });
  });
}

function planilha(...linhas: string[]) {
  return [CABECALHO, ...linhas].join("\r\n");
}

async function ateConferencia(...linhas: string[]) {
  montar();
  await escolherArquivo(planilha(...linhas));
  return screen.findByRole("heading", { level: 2, name: "Conferência" });
}

async function confirmarImportacao(n: number) {
  fireEvent.click(
    screen.getByRole("button", {
      name: `Importar ${n} ${n === 1 ? "colaborador" : "colaboradores"}`,
    }),
  );
  const janela = await screen.findByRole("dialog", {
    name: `Importar ${n} ${n === 1 ? "colaborador" : "colaboradores"}?`,
  });
  fireEvent.click(
    within(janela).getByRole("button", { name: "Confirmar importação" }),
  );
}

beforeEach(() => {
  onSair.mockReset();
  vi.mocked(enviarAdmissao).mockReset();
  vi.mocked(listarEmpresasMulti).mockReset();
  vi.mocked(listarDepartamentos).mockReset();
  vi.mocked(listarCargos).mockReset();
  vi.mocked(listarUnidades).mockReset();
  vi.mocked(listarEmpresasMulti).mockResolvedValue(
    paginado([
      { id: "emp-1", codigo: "ALFA", nome: "Empresa Alfa", status: "ativo" },
    ]),
  );
  vi.mocked(listarDepartamentos).mockResolvedValue(
    paginado([dep("dep-adm", "ADM")]),
  );
  vi.mocked(listarCargos).mockResolvedValue(
    paginado([dep("car-analista", "ANALISTA")]),
  );
  vi.mocked(listarUnidades).mockResolvedValue(
    paginado([] as ReturnType<typeof dep>[]) as never,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("passo 1 — modelo e arquivo", () => {
  it("título, passos, colunas aceitas e a data de nascimento obrigatória", async () => {
    montar();
    const titulo = screen.getByRole("heading", {
      level: 1,
      name: "Importar planilha de colaboradores",
    });
    expect(titulo).toHaveAttribute("id", IMPORTAR_COLABORADORES_TITULO_ID);
    const passos = screen.getByRole("list", { name: "Passos da importação" });
    expect(
      within(passos)
        .getAllByRole("listitem")
        .map((p) => p.textContent),
    ).toEqual(["1Modelo e arquivo", "2Conferência", "3Resultado"]);
    expect(within(passos).getAllByRole("listitem")[0]).toHaveAttribute(
      "aria-current",
      "step",
    );
    const colunas = screen.getByRole("table", { name: "Colunas da planilha" });
    expect(
      within(colunas).getByRole("row", { name: /data_nascimento/ }),
    ).toHaveTextContent("Obrigatória");
    expect(
      within(colunas).getByRole("row", { name: /unidade_codigo/ }),
    ).toHaveTextContent("Opcional");
    expect(await screen.findByText(/Empresa Alfa/)).toBeInTheDocument();
  });

  it("'Baixar modelo' gera o CSV no navegador, sem chamar a API", () => {
    const criar = vi.fn(() => "blob:modelo");
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() });
    const clicar = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Baixar modelo" }));
    expect(criar).toHaveBeenCalledTimes(1);
    expect(clicar).toHaveBeenCalledTimes(1);
    expect(enviarAdmissao).not.toHaveBeenCalled();
  });

  it("arquivo acima de 1 MB é recusado sem ser lido nem consultar catálogos", async () => {
    montar();
    const campo = await screen.findByLabelText("Arquivo CSV da planilha");
    const grande = new File(["x"], "grande.csv", { type: "text/csv" });
    Object.defineProperty(grande, "size", { value: 1024 * 1024 + 1 });
    await act(async () => {
      fireEvent.change(campo, { target: { files: [grande] } });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/1 MB/);
    expect(listarDepartamentos).not.toHaveBeenCalled();
  });

  it("coluna fora do modelo (ex.: CPF) recusa o arquivo inteiro", async () => {
    montar();
    await escolherArquivo([`${CABECALHO};cpf`, `${ANA};123`].join("\n"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A planilha tem colunas que não fazem parte do modelo: cpf.",
    );
    expect(
      screen.queryByRole("heading", { level: 2, name: "Conferência" }),
    ).toBeNull();
  });
});

describe("passo 2 — conferência", () => {
  it("resume prontas e com erro; o erro diz linha, campo e motivo, sem o valor", async () => {
    await ateConferencia(ANA, RUIM, BIA);
    expect(
      screen.getByText("3 linhas lidas: 2 prontas para importar, 1 com erro."),
    ).toBeInTheDocument();
    const erros = screen.getByRole("table", { name: "Linhas com erro" });
    expect(within(erros).getByRole("row", { name: /^3/ })).toHaveTextContent(
      "Tipo de vínculo",
    );
    expect(erros).not.toHaveTextContent("estatutario");
    const prontas = screen.getByRole("table", {
      name: "Prontas para importar",
    });
    expect(prontas).toHaveTextContent("Ana Souza");
    expect(prontas).toHaveTextContent("Aprendiz");
    expect(prontas).not.toHaveTextContent("Zuleica");
  });

  it("lê todas as páginas dos catálogos ativos (sem teto de 100)", async () => {
    vi.mocked(listarDepartamentos).mockImplementation(async (query = {}) =>
      query.pagina === 2
        ? { ...paginado([dep("dep-oper", "OPER")], 101), pagina: 2 }
        : paginado(
            Array.from({ length: 100 }, (_, i) => dep(`d${i}`, `D${i}`)),
            101,
          ),
    );
    await ateConferencia("Ana Souza;clt;01/12/2026;15/05/1990;OPER;ANALISTA;;");
    expect(listarDepartamentos).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ativo",
        pagina: 2,
        tamanhoPagina: 100,
      }),
    );
    expect(
      screen.getByText(
        "1 linha lida: 1 pronta para importar, nenhuma com erro.",
      ),
    ).toBeInTheDocument();
  });

  it("sem nenhuma linha pronta, não há o que importar", async () => {
    await ateConferencia(RUIM);
    expect(screen.queryByRole("button", { name: /^Importar \d/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Baixar relatório de erros" }),
    ).toBeInTheDocument();
  });

  it("'Escolher outro arquivo' volta ao passo 1, sem nada guardado", async () => {
    await ateConferencia(ANA);
    fireEvent.click(
      screen.getByRole("button", { name: "Escolher outro arquivo" }),
    );
    expect(
      screen.queryByRole("heading", { level: 2, name: "Conferência" }),
    ).toBeNull();
    expect(screen.queryByText("Ana Souza")).toBeNull();
    expect(
      screen.getByLabelText("Arquivo CSV da planilha"),
    ).toBeInTheDocument();
  });

  it("a confirmação diz quantas e em qual empresa; 'Voltar' não envia nada", async () => {
    await ateConferencia(ANA, BIA);
    fireEvent.click(
      screen.getByRole("button", { name: "Importar 2 colaboradores" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Importar 2 colaboradores?",
    });
    expect(janela).toHaveTextContent("Empresa Alfa");
    fireEvent.click(within(janela).getByRole("button", { name: "Voltar" }));
    expect(enviarAdmissao).not.toHaveBeenCalled();
  });
});

describe("passo 3 — envio e resultado", () => {
  it("uma admissão por linha, em sequência, cada uma com a sua chave; resultado com as admitidas", async () => {
    const ordem: string[] = [];
    vi.mocked(enviarAdmissao).mockImplementation(async (dto) => {
      ordem.push(dto.nome);
      return admitida(dto.nome);
    });
    await ateConferencia(ANA, BIA);
    await confirmarImportacao(2);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Resultado" }),
    ).toBeInTheDocument();
    expect(ordem).toEqual(["Ana Souza", "Bia Lima"]);
    type Chamada = [
      Parameters<typeof enviarAdmissao>[0],
      { chaveIdempotencia: string },
    ];
    const chamadas = vi.mocked(enviarAdmissao).mock.calls as Chamada[];
    expect(chamadas).toHaveLength(2);
    const [corpoAna, opcoesAna] = chamadas[0]!;
    const [corpoBia, opcoesBia] = chamadas[1]!;
    expect(corpoAna).toMatchObject({
      empresaId: "emp-1",
      motivoCodigo: "admissao_inicial",
      departamentoId: "dep-adm",
      cargoId: "car-analista",
      perfilPessoal: expect.objectContaining({ dataNascimento: "1990-05-15" }),
    });
    expect(corpoBia).toMatchObject({ tipo: "aprendiz", matricula: "M-2" });
    expect(opcoesAna.chaveIdempotencia).toMatch(/^[0-9a-f-]{36}$/);
    expect(opcoesBia.chaveIdempotencia).not.toBe(opcoesAna.chaveIdempotencia);
    expect(
      screen.getByText("2 admitidas, nenhuma pendente."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver colaboradores" }));
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  it("recusa do servidor fica na linha; 'tentar de novo' reenvia só ela, com a MESMA chave", async () => {
    vi.mocked(enviarAdmissao)
      .mockResolvedValueOnce(admitida("Ana Souza"))
      .mockRejectedValueOnce(
        new ApiError(409, "Matrícula já usada nesta empresa.", {}),
      );
    await ateConferencia(ANA, BIA);
    await confirmarImportacao(2);
    await screen.findByRole("heading", { level: 2, name: "Resultado" });
    expect(
      screen.getByText("1 admitida, 1 pendente: 1 recusada."),
    ).toBeInTheDocument();
    const pendentes = screen.getByRole("table", { name: "Não entraram" });
    expect(pendentes).toHaveTextContent("Bia Lima");
    expect(pendentes).toHaveTextContent("Recusada");
    expect(pendentes).toHaveTextContent("Matrícula já usada nesta empresa.");
    const chaveDaBia =
      vi.mocked(enviarAdmissao).mock.calls[1]![1]!.chaveIdempotencia;

    vi.mocked(enviarAdmissao).mockResolvedValueOnce(admitida("Bia Lima"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar de novo as que não entraram (1)",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("2 admitidas, nenhuma pendente."),
      ).toBeInTheDocument(),
    );
    expect(enviarAdmissao).toHaveBeenCalledTimes(3);
    expect(vi.mocked(enviarAdmissao).mock.calls[2]![0].nome).toBe("Bia Lima");
    expect(vi.mocked(enviarAdmissao).mock.calls[2]![1]!.chaveIdempotencia).toBe(
      chaveDaBia,
    );
  });

  it("falha de rede vira 'não confirmada' (reenvio seguro) e a importação segue", async () => {
    vi.mocked(enviarAdmissao)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(admitida("Bia Lima"));
    await ateConferencia(ANA, BIA);
    await confirmarImportacao(2);
    await screen.findByRole("heading", { level: 2, name: "Resultado" });
    expect(
      screen.getByText("1 admitida, 1 pendente: 1 não confirmada."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Não entraram" }),
    ).toHaveTextContent("Não confirmada");
  });

  it("sessão expirada (401) para a importação: a linha e as seguintes ficam 'não enviada'", async () => {
    vi.mocked(enviarAdmissao).mockRejectedValueOnce(
      new ApiError(401, "Sessão expirada", {}),
    );
    await ateConferencia(ANA, BIA);
    await confirmarImportacao(2);
    await screen.findByRole("heading", { level: 2, name: "Resultado" });
    expect(enviarAdmissao).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Nenhuma admitida, 2 pendentes: 2 não enviadas."),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sua sessão expirou. Entre de novo e tente as que faltaram.",
    );
  });

  it("o progresso é anunciado e, ao fim, o foco vai ao resultado", async () => {
    let soltar: (v: AdmissaoEnviada) => void = () => undefined;
    vi.mocked(enviarAdmissao)
      .mockImplementationOnce(
        () => new Promise((resolver) => (soltar = resolver)),
      )
      .mockResolvedValueOnce(admitida("Bia Lima"));
    await ateConferencia(ANA, BIA);
    await confirmarImportacao(2);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Importando 1 de 2…",
    );
    await act(async () => soltar(admitida("Ana Souza")));
    const resultado = await screen.findByRole("heading", {
      level: 2,
      name: "Resultado",
    });
    await waitFor(() => expect(resultado).toHaveFocus());
  });
});

describe("guarda de saída", () => {
  it("sem arquivo, 'Voltar para Colaboradores' sai direto", async () => {
    montar();
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  it("com planilha conferida e não importada, sair pergunta", async () => {
    await ateConferencia(ANA);
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Sair sem salvar?" }),
    ).toBeInTheDocument();
    expect(onSair).not.toHaveBeenCalled();
  });

  it("durante o envio, a saída fica bloqueada até terminar", async () => {
    vi.mocked(enviarAdmissao).mockImplementation(
      () => new Promise(() => undefined),
    );
    await ateConferencia(ANA);
    await confirmarImportacao(1);
    await screen.findByText("Importando 1 de 1…");
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Aguarde o salvamento terminar",
      }),
    ).toBeInTheDocument();
    expect(onSair).not.toHaveBeenCalled();
  });
});

describe("reimportar não duplica (chave determinística por pessoa e empresa)", () => {
  /**
   * Servidor falso com a regra real (`IdempotenciaAdmissao`): a chave vale
   * por empresa, sem prazo; mesma chave e mesmo conteúdo devolvem a admissão
   * já gravada (reenvio); mesma chave com outro conteúdo, 422 divergente.
   */
  function servidorFalso() {
    const gravadas = new Map<string, string>();
    const criadas: string[] = [];
    vi.mocked(enviarAdmissao).mockImplementation(async (dto, opcoes) => {
      const lugar = `${dto.empresaId}|${opcoes?.chaveIdempotencia}`;
      const conteudo = JSON.stringify(dto);
      const anterior = gravadas.get(lugar);
      if (anterior !== undefined) {
        if (anterior !== conteudo) {
          throw new ApiError(422, "Conteúdo divergente.", {
            codigo: "idempotencia_conteudo_divergente",
          });
        }
        return { ...admitida(dto.nome), reenvio: true };
      }
      gravadas.set(lugar, conteudo);
      criadas.push(`${dto.empresaId}:${dto.nome}`);
      return admitida(dto.nome);
    });
    return criadas;
  }

  async function importarArquivo(...linhas: string[]) {
    await escolherArquivo(planilha(...linhas));
    await screen.findByRole("heading", { level: 2, name: "Conferência" });
    const n = linhas.length;
    await confirmarImportacao(n);
    await screen.findByRole("heading", { level: 2, name: "Resultado" });
  }

  it("primeira importação: cada pessoa criada uma vez", async () => {
    const criadas = servidorFalso();
    montar();
    await importarArquivo(ANA, BIA);
    expect(criadas).toEqual(["emp-1:Ana Souza", "emp-1:Bia Lima"]);
    expect(
      screen.getByText("2 admitidas, nenhuma pendente."),
    ).toBeInTheDocument();
  });

  it("reimportação do mesmo arquivo concluído: nada novo, e a tela diz que já estavam importadas", async () => {
    const criadas = servidorFalso();
    montar();
    await importarArquivo(ANA, BIA);
    fireEvent.click(
      screen.getByRole("button", { name: "Importar outra planilha" }),
    );
    await importarArquivo(ANA, BIA);
    expect(criadas).toHaveLength(2);
    expect(
      screen.getByText(
        "Nenhuma admitida, 2 já importadas antes, nenhuma pendente.",
      ),
    ).toBeInTheDocument();
  });

  it("tentativa parcial: só a pendente é reenviada, com a mesma chave; reimportar depois não duplica", async () => {
    const criadas = servidorFalso();
    const real = vi.mocked(enviarAdmissao).getMockImplementation()!;
    vi.mocked(enviarAdmissao)
      .mockImplementationOnce(real)
      .mockImplementationOnce(async () => {
        throw new TypeError("Failed to fetch");
      });
    montar();
    await importarArquivo(ANA, BIA);
    expect(criadas).toEqual(["emp-1:Ana Souza"]);
    const chaveDaBia =
      vi.mocked(enviarAdmissao).mock.calls[1]![1]!.chaveIdempotencia;
    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar de novo as que não entraram (1)",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("2 admitidas, nenhuma pendente."),
      ).toBeInTheDocument(),
    );
    expect(vi.mocked(enviarAdmissao).mock.calls[2]![1]!.chaveIdempotencia).toBe(
      chaveDaBia,
    );
    expect(criadas).toEqual(["emp-1:Ana Souza", "emp-1:Bia Lima"]);

    fireEvent.click(
      screen.getByRole("button", { name: "Importar outra planilha" }),
    );
    await importarArquivo(ANA, BIA);
    expect(criadas).toHaveLength(2);
  });

  it("a mesma pessoa com outros dados é recusada (não vira outra admissão)", async () => {
    const criadas = servidorFalso();
    montar();
    await importarArquivo(ANA);
    fireEvent.click(
      screen.getByRole("button", { name: "Importar outra planilha" }),
    );
    await importarArquivo("Ana Souza;pj;05/12/2026;15/05/1990;ADM;ANALISTA;;");
    expect(criadas).toEqual(["emp-1:Ana Souza"]);
    expect(
      screen.getByRole("table", { name: "Não entraram" }),
    ).toHaveTextContent(
      "Esta pessoa já foi importada antes com outros dados. Confira e corrija pela ficha.",
    );
  });

  it("troca de empresa: o mesmo arquivo em outra empresa usa outras chaves e admite lá", async () => {
    const criadas = servidorFalso();
    const { unmount } = montar();
    await importarArquivo(ANA);
    const chaveNaAlfa =
      vi.mocked(enviarAdmissao).mock.calls[0]![1]!.chaveIdempotencia;
    unmount();

    vi.mocked(listarEmpresasMulti).mockResolvedValue(
      paginado([
        { id: "emp-2", codigo: "BETA", nome: "Empresa Beta", status: "ativo" },
      ]),
    );
    montar();
    await screen.findByText(/Empresa Beta/);
    await importarArquivo(ANA);
    expect(
      vi.mocked(enviarAdmissao).mock.calls[1]![1]!.chaveIdempotencia,
    ).not.toBe(chaveNaAlfa);
    expect(criadas).toEqual(["emp-1:Ana Souza", "emp-2:Ana Souza"]);
  });
});
