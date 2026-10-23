/**
 * Testes de contrato das transições de situação (T158).
 *
 * Cobrem as **seis entidades** que a tarefa expôs — unidade, departamento,
 * área, equipe, centro de custo e cargo — e prendem, para cada uma:
 *
 *  - o caminho exato, **com o prefixo `/v1`** e com o plural que o
 *    `@Controller` declara (`centros-de-custo`, `unidades-organizacionais`…);
 *    errar isso dá 404 em produção e teste verde em jsdom;
 *  - o método `POST` e o cabeçalho `x-csrf-token`;
 *  - que **nenhum corpo é enviado**: o servidor não lê payload nestas rotas,
 *    e mandar um seria inventar contrato;
 *  - que **nenhuma chamada usa `DELETE`** — exclusão física não existe no
 *    produto e não pode aparecer aqui por acidente;
 *  - que o `status` do erro chega a quem chamou, porque é ele que escolhe a
 *    mensagem (409 e 422 significam coisas diferentes).
 *
 * Mora num arquivo próprio porque cruza **dois** módulos de cliente:
 * `organizacaoClient` (cinco entidades) e `cargoClient` (cargo). Cada um tem
 * o seu `apiFetch` e o seu `ApiError`, por convenção vigente no projeto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  inativarArea,
  inativarCentroCusto,
  inativarDepartamento,
  inativarEquipe,
  inativarUnidade,
  reativarArea,
  reativarCentroCusto,
  reativarDepartamento,
  reativarEquipe,
  reativarUnidade,
} from "./organizacaoClient";
import { inativarCargo, reativarCargo } from "./cargoClient";
import * as organizacaoClient from "./organizacaoClient";
import * as cargoClient from "./cargoClient";
import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./csrfClient";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearCsrfToken();
  setCsrfToken("csrf-em-memoria");
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCsrfToken();
});

function respostaOk(body: unknown = { id: "x", status: "inativo" }): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

/**
 * T180 — com `clone`, como a `Response` real: no 403 os clientes leem uma
 * cópia do corpo para decidir se descartam o token (`csrf_invalido`).
 */
function respostaErro(
  status: number,
  corpo: unknown = { message: "recusado" },
): Response {
  return {
    ok: false,
    status,
    json: async () => corpo,
    clone: () => respostaErro(status, corpo),
  } as unknown as Response;
}

function ultimaChamada() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return {
    url: url as string,
    init: (init ?? {}) as RequestInit,
    headers: ((init ?? {}) as RequestInit).headers as
      Record<string, string> | undefined,
  };
}

/** As doze funções, com o caminho que cada uma deve produzir. */
const CASOS: ReadonlyArray<{
  nome: string;
  fn: (id: string) => Promise<unknown>;
  caminho: string;
}> = [
  {
    nome: "inativarUnidade",
    fn: inativarUnidade,
    caminho: "/v1/unidades-organizacionais/u-1/inativar",
  },
  {
    nome: "reativarUnidade",
    fn: reativarUnidade,
    caminho: "/v1/unidades-organizacionais/u-1/reativar",
  },
  {
    nome: "inativarDepartamento",
    fn: inativarDepartamento,
    caminho: "/v1/departamentos/u-1/inativar",
  },
  {
    nome: "reativarDepartamento",
    fn: reativarDepartamento,
    caminho: "/v1/departamentos/u-1/reativar",
  },
  { nome: "inativarArea", fn: inativarArea, caminho: "/v1/areas/u-1/inativar" },
  { nome: "reativarArea", fn: reativarArea, caminho: "/v1/areas/u-1/reativar" },
  {
    nome: "inativarEquipe",
    fn: inativarEquipe,
    caminho: "/v1/equipes/u-1/inativar",
  },
  {
    nome: "reativarEquipe",
    fn: reativarEquipe,
    caminho: "/v1/equipes/u-1/reativar",
  },
  {
    nome: "inativarCentroCusto",
    fn: inativarCentroCusto,
    caminho: "/v1/centros-de-custo/u-1/inativar",
  },
  {
    nome: "reativarCentroCusto",
    fn: reativarCentroCusto,
    caminho: "/v1/centros-de-custo/u-1/reativar",
  },
  {
    nome: "inativarCargo",
    fn: inativarCargo,
    caminho: "/v1/cargos/u-1/inativar",
  },
  {
    nome: "reativarCargo",
    fn: reativarCargo,
    caminho: "/v1/cargos/u-1/reativar",
  },
];

describe("caminho, método e CSRF de cada transição", () => {
  for (const caso of CASOS) {
    it(`${caso.nome} chama POST ${caso.caminho} com CSRF e sem corpo`, async () => {
      fetchMock.mockResolvedValueOnce(respostaOk());
      await caso.fn("u-1");
      const { url, init, headers } = ultimaChamada();
      expect(url).toBe(caso.caminho);
      expect(init.method).toBe("POST");
      expect(headers?.["x-csrf-token"]).toBe("csrf-em-memoria");
      expect(init.body).toBeUndefined();
    });
  }

  it("o id vai escapado, nunca concatenado cru", async () => {
    fetchMock.mockResolvedValueOnce(respostaOk());
    await inativarArea("a/b?c");
    expect(ultimaChamada().url).toBe("/v1/areas/a%2Fb%3Fc/inativar");
  });
});

describe("nenhuma exclusão existe", () => {
  it("nenhuma das doze chamadas usa DELETE", async () => {
    fetchMock.mockResolvedValue(respostaOk());
    for (const caso of CASOS) {
      await caso.fn("u-1");
    }
    const metodos = fetchMock.mock.calls.map(
      ([, init]) => (init as RequestInit | undefined)?.method ?? "GET",
    );
    expect(metodos).toHaveLength(CASOS.length);
    expect(metodos.every((m) => m === "POST")).toBe(true);
    expect(metodos).not.toContain("DELETE");
  });

  it("nenhum dos dois módulos exporta função de exclusão", () => {
    const nomes = [
      ...Object.keys(organizacaoClient),
      ...Object.keys(cargoClient),
    ];
    expect(
      nomes.some((n) => /excluir|remover|apagar|deletar|delete/i.test(n)),
    ).toBe(false);
  });
});

describe("o status da recusa chega a quem chamou", () => {
  // A tela escolhe a mensagem pelo código: 409 e 422 querem dizer coisas
  // diferentes, e perder o status aqui tornaria impossível distingui-las.
  for (const status of [403, 404, 409, 422]) {
    it(`${status} vira erro com o status preservado`, async () => {
      fetchMock.mockResolvedValueOnce(respostaErro(status));
      const erro = await inativarDepartamento("u-1").catch(
        (e: unknown) => e as { status?: number },
      );
      expect(erro.status).toBe(status);
    });
  }

  it("falha de rede propaga sem virar ApiError com status", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const erro = await reativarCargo("u-1").catch(
      (e: unknown) => e as { status?: number },
    );
    expect(erro.status).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// T180 — o cadastro rápido da Nova admissão grava por `criarDepartamento`,
// `criarUnidade` e `criarCargo`. Como `colaboradoresClient` desde a T179, os
// dois clientes guardam o `codigo` da recusa e, no 403 `csrf_invalido`,
// descartam o token em memória; o 403 de permissão não o toca.
// ---------------------------------------------------------------------------
describe("T180 — criação guarda o codigo e descarta o token desatualizado", () => {
  const DTO = {
    codigo: "DEP_NOVO",
    nome: "Departamento Sintético",
    empresaId: "44444444-4444-4444-4444-444444444444",
  };
  const CRIACOES: ReadonlyArray<{
    nome: string;
    criar: (dto: typeof DTO) => Promise<unknown>;
    caminho: string;
  }> = [
    {
      nome: "criarDepartamento",
      criar: organizacaoClient.criarDepartamento,
      caminho: "/v1/departamentos",
    },
    {
      nome: "criarUnidade",
      criar: organizacaoClient.criarUnidade,
      caminho: "/v1/unidades-organizacionais",
    },
    {
      nome: "criarCargo",
      criar: cargoClient.criarCargo,
      caminho: "/v1/cargos",
    },
  ];

  /** A recusa de uma criação, lida por forma, como a tela a lê. */
  async function recusaDe(
    promessa: Promise<unknown>,
  ): Promise<{ status?: number; codigo?: string }> {
    return promessa.then(
      () => ({}),
      (e: unknown) => e as { status?: number; codigo?: string },
    );
  }

  for (const caso of CRIACOES) {
    it(`${caso.nome}: POST ${caso.caminho} com o corpo e o CSRF`, async () => {
      fetchMock.mockResolvedValueOnce(respostaOk({ id: "n-1" }));
      await caso.criar(DTO);
      const { url, init, headers } = ultimaChamada();
      expect(url).toBe(caso.caminho);
      expect(init.method).toBe("POST");
      expect(headers?.["x-csrf-token"]).toBe("csrf-em-memoria");
      expect(JSON.parse(init.body as string)).toEqual(DTO);
    });

    it(`${caso.nome}: 403 csrf_invalido guarda o codigo e descarta o token`, async () => {
      fetchMock.mockResolvedValueOnce(
        respostaErro(403, { message: "recusado", codigo: "csrf_invalido" }),
      );
      const erro = await recusaDe(caso.criar(DTO));
      expect(erro.status).toBe(403);
      expect(erro.codigo).toBe("csrf_invalido");
      expect(getCsrfToken()).toBeNull();
    });

    it(`${caso.nome}: 403 de permissão, sem codigo, mantém o token`, async () => {
      fetchMock.mockResolvedValueOnce(respostaErro(403));
      const erro = await recusaDe(caso.criar(DTO));
      expect(erro.status).toBe(403);
      expect(erro.codigo).toBeUndefined();
      expect(getCsrfToken()).toBe("csrf-em-memoria");
    });

    it(`${caso.nome}: 409 chega com o status para a mensagem do campo`, async () => {
      fetchMock.mockResolvedValueOnce(respostaErro(409));
      const erro = await recusaDe(caso.criar(DTO));
      expect(erro.status).toBe(409);
      expect(getCsrfToken()).toBe("csrf-em-memoria");
    });
  }
});
