import {
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { CEP_JANELA_MS, CEP_LIMITE_CONSULTAS, CepService } from "./cep.service";
import { FornecedorCep, ResultadoFornecedorCep } from "./cep.types";
import { VIACEP_BASE_URL, ViaCepAdapter } from "./viacep.adapter";

/**
 * T178 — preenchimento assistido de endereço por CEP (ViaCEP). Nenhum teste
 * sai para a rede: o adaptador recebe uma função de busca falsa, e o serviço,
 * um fornecedor falso.
 */

type Chamada = { url: string; init: Record<string, unknown> };

function buscaFalsa(
  resposta:
    | { status: number; corpo?: unknown; corpoInvalido?: boolean }
    | "rede"
    | "lenta",
) {
  const chamadas: Chamada[] = [];
  const buscar = (url: string, init: { signal: AbortSignal }) => {
    chamadas.push({ url, init: init as unknown as Record<string, unknown> });
    if (resposta === "rede") return Promise.reject(new Error("ECONNRESET"));
    if (resposta === "lenta") {
      return new Promise<never>((_r, rejeitar) => {
        init.signal.addEventListener("abort", () =>
          rejeitar(new Error("AbortError")),
        );
      });
    }
    return Promise.resolve({
      ok: resposta.status >= 200 && resposta.status < 300,
      status: resposta.status,
      json: () =>
        resposta.corpoInvalido
          ? Promise.reject(new SyntaxError("json"))
          : Promise.resolve(resposta.corpo),
    });
  };
  return { buscar, chamadas };
}

const RESPOSTA_VIACEP = {
  cep: "30140-071",
  logradouro: "  Avenida   Sintetica ",
  complemento: "de 1 a 999",
  unidade: "",
  bairro: "Bairro Sintetico",
  localidade: "Cidade Sintetica",
  uf: "mg",
  estado: "Minas Gerais",
  regiao: "Sudeste",
  ibge: "3106200",
  gia: "",
  ddd: "31",
  siafi: "4123",
};

describe("T178 — adaptador do ViaCEP", () => {
  it("sucesso: devolve só os campos da sugestão, normalizados", async () => {
    const { buscar, chamadas } = buscaFalsa({
      status: 200,
      corpo: RESPOSTA_VIACEP,
    });
    const r = await new ViaCepAdapter(buscar).consultar("30140071");
    expect(r).toEqual({
      tipo: "encontrado",
      endereco: {
        cep: "30140071",
        logradouro: "Avenida Sintetica",
        bairro: "Bairro Sintetico",
        cidade: "Cidade Sintetica",
        uf: "MG",
        estado: "Minas Gerais",
      },
    });
    // Nada da resposta bruta além da sugestão (ibge, ddd, siafi, complemento).
    expect(JSON.stringify(r)).not.toMatch(/3106200|4123|"31"|de 1 a 999/);
    expect(chamadas).toHaveLength(1);
  });

  it("vai ao fornecedor só o CEP: GET, sem corpo, sem cabeçalho, sem query", async () => {
    const { buscar, chamadas } = buscaFalsa({
      status: 200,
      corpo: RESPOSTA_VIACEP,
    });
    await new ViaCepAdapter(buscar).consultar("30140071");
    expect(chamadas[0]!.url).toBe(`${VIACEP_BASE_URL}/30140071/json/`);
    expect(Object.keys(chamadas[0]!.init).sort()).toEqual(
      ["method", "redirect", "signal"].sort(),
    );
    expect(chamadas[0]!.init.method).toBe("GET");
    expect(chamadas[0]!.init.redirect).toBe("error");
  });

  it("CEP inexistente: o ViaCEP responde 200 com `erro`", async () => {
    for (const erro of [true, "true"]) {
      const { buscar } = buscaFalsa({ status: 200, corpo: { erro } });
      expect(await new ViaCepAdapter(buscar).consultar("99999999")).toEqual({
        tipo: "inexistente",
      });
    }
  });

  it("CEP recusado pelo fornecedor (400) conta como inexistente", async () => {
    const { buscar } = buscaFalsa({ status: 400 });
    expect(await new ViaCepAdapter(buscar).consultar("00000000")).toEqual({
      tipo: "inexistente",
    });
  });

  it("CEP fora da forma nunca chega ao fornecedor", async () => {
    const { buscar, chamadas } = buscaFalsa({ status: 200, corpo: {} });
    for (const cep of ["3014007", "30140-071", "abcdefgh", ""]) {
      expect(await new ViaCepAdapter(buscar).consultar(cep)).toEqual({
        tipo: "inexistente",
      });
    }
    expect(chamadas).toEqual([]);
  });

  it("timeout curto: a busca lenta é cancelada e vira indisponível", async () => {
    const { buscar } = buscaFalsa("lenta");
    expect(await new ViaCepAdapter(buscar, 20).consultar("30140071")).toEqual({
      tipo: "indisponivel",
      motivo: "timeout",
    });
  });

  it.each([
    ["erro de rede", "rede" as const],
    ["HTTP 500", { status: 500 }],
    ["HTTP 503", { status: 503 }],
    ["corpo ilegível", { status: 200, corpoInvalido: true }],
    ["corpo que não é objeto", { status: 200, corpo: "texto" }],
  ])("falha do fornecedor (%s) vira indisponível", async (_caso, resposta) => {
    const { buscar } = buscaFalsa(resposta);
    expect(await new ViaCepAdapter(buscar).consultar("30140071")).toEqual({
      tipo: "indisponivel",
      motivo: "falha",
    });
  });

  it("valor fora do limite, com controle ou UF inválida não vira sugestão", async () => {
    const { buscar } = buscaFalsa({
      status: 200,
      corpo: {
        logradouro: "x".repeat(201),
        bairro: "linha\nquebrada",
        localidade: "",
        uf: "Minas",
        estado: 42,
      },
    });
    expect(await new ViaCepAdapter(buscar).consultar("30140071")).toEqual({
      tipo: "encontrado",
      endereco: {
        cep: "30140071",
        logradouro: null,
        bairro: null,
        cidade: null,
        uf: null,
        estado: null,
      },
    });
  });
});

describe("T178 — serviço de consulta de CEP", () => {
  function montar(resultado: ResultadoFornecedorCep) {
    const consultas: string[] = [];
    const fornecedor: FornecedorCep = {
      nome: "falso",
      consultar: (cep) => {
        consultas.push(cep);
        return Promise.resolve(resultado);
      },
    };
    const logs: unknown[] = [];
    const servico = new CepService(fornecedor);
    jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation((mensagem: unknown) => {
        logs.push(mensagem);
      });
    return { servico, consultas, logs };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const encontrado: ResultadoFornecedorCep = {
    tipo: "encontrado",
    endereco: {
      cep: "30140071",
      logradouro: "Avenida Sintetica",
      bairro: "Bairro Sintetico",
      cidade: "Cidade Sintetica",
      uf: "MG",
      estado: "Minas Gerais",
    },
  };

  it("sucesso devolve a sugestão e registra só metadados técnicos", async () => {
    const { servico, consultas, logs } = montar(encontrado);
    await expect(
      servico.consultar("30140071", "u-1", "req-1"),
    ).resolves.toEqual(
      encontrado.tipo === "encontrado" ? encontrado.endereco : null,
    );
    expect(consultas).toEqual(["30140071"]);
    expect(logs).toEqual([
      expect.objectContaining({
        evento: "cep.consulta",
        fornecedor: "falso",
        resultado: "encontrado",
        requestId: "req-1",
      }),
    ]);
    const registro = JSON.stringify(logs);
    for (const valor of [
      "30140071",
      "Avenida Sintetica",
      "Bairro Sintetico",
      "Cidade Sintetica",
      "MG",
      "Minas Gerais",
      "u-1",
    ]) {
      expect(registro).not.toContain(valor);
    }
  });

  it("CEP inválido: 400 antes do fornecedor e sem gastar cota", async () => {
    const { servico, consultas, logs } = montar(encontrado);
    for (const cep of ["3014007", "30140-071", "abcdefgh"]) {
      await expect(servico.consultar(cep, "u-1", "r")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(consultas).toEqual([]);
    expect(logs).toEqual(
      Array(3).fill(expect.objectContaining({ resultado: "invalido" })),
    );
  });

  it("inexistente: 404", async () => {
    const { servico } = montar({ tipo: "inexistente" });
    await expect(
      servico.consultar("99999999", "u-1", "r"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(["timeout", "falha"] as const)(
    "indisponível (%s): 503, e o resultado registrado é o motivo",
    async (motivo) => {
      const { servico, logs } = montar({ tipo: "indisponivel", motivo });
      await expect(
        servico.consultar("30140071", "u-1", "r"),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(logs).toEqual([expect.objectContaining({ resultado: motivo })]);
    },
  );

  it("limite por usuário: a consulta seguinte é 429 e não chega ao fornecedor", async () => {
    const { servico, consultas, logs } = montar(encontrado);
    for (let i = 0; i < CEP_LIMITE_CONSULTAS; i += 1) {
      await servico.consultar("30140071", "u-1", `r${i}`);
    }
    const recusa = await servico
      .consultar("30140071", "u-1", "r-limite")
      .catch((e: unknown) => e);
    expect(recusa).toBeInstanceOf(HttpException);
    expect((recusa as HttpException).getStatus()).toBe(429);
    expect(consultas).toHaveLength(CEP_LIMITE_CONSULTAS);
    expect(logs.at(-1)).toEqual(
      expect.objectContaining({ resultado: "limite" }),
    );
    // Outro usuário tem a própria cota.
    await expect(
      servico.consultar("30140071", "u-2", "r"),
    ).resolves.toBeTruthy();
  });

  it("a janela expira: depois de 10 minutos, consulta de novo", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-20T12:00:00Z") });
    const { servico } = montar(encontrado);
    for (let i = 0; i < CEP_LIMITE_CONSULTAS; i += 1) {
      await servico.consultar("30140071", "u-1", "r");
    }
    await expect(
      servico.consultar("30140071", "u-1", "r"),
    ).rejects.toBeInstanceOf(HttpException);
    jest.setSystemTime(Date.now() + CEP_JANELA_MS + 1);
    await expect(
      servico.consultar("30140071", "u-1", "r"),
    ).resolves.toBeTruthy();
  });
});
