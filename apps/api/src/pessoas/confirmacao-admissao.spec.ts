import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import { AccessUser, Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate, ValidationArguments } from "class-validator";
import {
  ConflitoDeCamposException,
  RecusaDeNegocioException,
} from "../common/erros/recusa-por-campo";
import { PrismaService } from "../database/prisma.service";
import { chaveDeIdempotencia } from "./colaborador/colaborador.controller";
import {
  AdmissaoGravada,
  ColaboradorService,
  admissaoConfere,
  camposDaUnicidadeViolada,
  conflitosDaAdmissao,
} from "./colaborador/colaborador.service";
import { ContatoColaboradorService } from "./contatos/contato-colaborador.service";
import { DadosPessoaisColaboradorService } from "./dados-pessoais/dados-pessoais.service";
import { PessoasAuditoriaService } from "./pessoas-auditoria.service";
import {
  TELEFONE_NORMALIZADO,
  normalizarTelefone,
} from "./contatos/normalizacao-contatos.util";
import {
  CepCoerenteComPais,
  EnderecoDto,
} from "./dados-pessoais/dados-pessoais.dto";
import {
  ehPaisBrasil,
  normalizarCep,
} from "./dados-pessoais/normalizacao-dados-pessoais.util";
import { AdmitirColaboradorDto, CriarVinculoDto } from "./dto/pessoas.dto";

/**
 * T179 — confirmação segura da Nova admissão (decisões da proprietária de
 * 2026-10-21).
 *
 * Prende, sem banco: a forma brasileira do telefone (`+55` + DDD + número) e
 * do CEP (8 dígitos com país Brasil), a chave de idempotência do cabeçalho, a
 * tradução da unicidade do banco em campo público, a comparação do reenvio
 * com a admissão gravada e a lotação obrigatória da admissão. Concorrência,
 * índices e a migration de dados ficam no E2E
 * (`test/admissao-confirmacao.e2e-spec.ts`).
 *
 * **Valores sintéticos.** Domínio reservado `example.test`.
 */

const OPCOES = { whitelist: true, forbidNonWhitelisted: true };
const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const DEPARTAMENTO = "33333333-3333-4333-8333-333333333333";
const CARGO = "55555555-5555-4555-8555-555555555555";
const UNIDADE = "66666666-6666-4666-8666-666666666666";

/** Normaliza como o `@Transform` e diz se a validação aceitaria. */
function telefoneAceito(entrada: string): boolean {
  const normalizado = normalizarTelefone(entrada);
  return (
    typeof normalizado === "string" && TELEFONE_NORMALIZADO.test(normalizado)
  );
}

// ---------------------------------------------------------------------------
// Telefone brasileiro
// ---------------------------------------------------------------------------

describe("T179 — telefone só brasileiro, em +55 + DDD + número", () => {
  it.each([
    ["11987654321", "+5511987654321", "celular nacional sem máscara"],
    ["1133334444", "+551133334444", "fixo nacional sem máscara"],
    ["(11) 98765-4321", "+5511987654321", "celular nacional com máscara"],
    ["(11) 3333-4444", "+551133334444", "fixo nacional com máscara"],
    ["  21 98765.4321  ", "+5521987654321", "pontas e ponto como separador"],
    ["+55 (11) 98765-4321", "+5511987654321", "+55 com máscara"],
    ["+551133334444", "+551133334444", "+55 já normalizado"],
    ["5511987654321", "+5511987654321", "55 + celular, sem +"],
    ["55 (11) 3333-4444", "+551133334444", "55 + fixo, com máscara"],
  ])("%p vira %p (%s) e é aceito", (entrada, saida) => {
    expect(normalizarTelefone(entrada)).toBe(saida);
    expect(TELEFONE_NORMALIZADO.test(saida)).toBe(true);
  });

  it.each([
    ["+44 20 7946 0958", "Reino Unido"],
    ["+1 212 555 0100", "Estados Unidos"],
    ["+442079460958", "Reino Unido sem separador"],
  ])("estrangeiro %p (%s) volta intacto e é recusado", (entrada) => {
    expect(normalizarTelefone(entrada)).toBe(entrada);
    expect(telefoneAceito(entrada)).toBe(false);
  });

  it.each([
    ["(01) 98765-4321", "DDD iniciado por 0"],
    ["(10) 98765-4321", "DDD com 0 no segundo dígito"],
    ["0198765432", "DDD 01, fixo"],
  ])("DDD inválido %p (%s) é recusado", (entrada) => {
    expect(telefoneAceito(entrada)).toBe(false);
  });

  it.each(["11887654321", "11787654321", "11087654321"])(
    "celular de 9 dígitos sem o 9 inicial %p é recusado",
    (entrada) => {
      expect(telefoneAceito(entrada)).toBe(false);
    },
  );

  it.each([
    "1163334444",
    "1173334444",
    "1183334444",
    "1193334444",
    "1103334444",
    "1113334444",
  ])("fixo de 8 dígitos fora de 2 a 5 %p é recusado", (entrada) => {
    expect(telefoneAceito(entrada)).toBe(false);
  });

  it.each(["1122223333", "1132223333", "1142223333", "1152223333"])(
    "fixo de 8 dígitos iniciado por 2 a 5 %p é aceito",
    (entrada) => {
      expect(telefoneAceito(entrada)).toBe(true);
    },
  );

  it.each([
    ["12345678", "8 dígitos, sem DDD"],
    ["119876543", "9 dígitos"],
    ["119876543210", "12 dígitos sem 55"],
    ["0119876543210", "13 dígitos com zero de operadora"],
    ["55119876543210", "55 + 12 dígitos"],
    ["+55119876543210", "+55 + 12 dígitos"],
    ["+55119876543", "+55 + 9 dígitos"],
  ])("comprimento errado %p (%s) é recusado", (entrada) => {
    expect(telefoneAceito(entrada)).toBe(false);
  });

  it("sem forma brasileira, a entrada volta como veio: normalizar nunca conserta", () => {
    expect(normalizarTelefone("119876543")).toBe("119876543");
    expect(normalizarTelefone("0119876543210")).toBe("0119876543210");
  });

  it("a forma gravada exige o + do começo", () => {
    expect(TELEFONE_NORMALIZADO.test("5511987654321")).toBe(false);
    expect(TELEFONE_NORMALIZADO.test("+5511987654321")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CEP coerente com o país
// ---------------------------------------------------------------------------

describe("T179 (B1) — o que a tela envia depois de digitar +55 tecla a tecla", () => {
  // A tela mostra `+`, `+5` e `+55` enquanto o país é digitado e, com o
  // primeiro dígito nacional, segue como número nacional. Cada passo abaixo é
  // um valor que o campo pode ter ao enviar; o servidor nunca lê o 55 do país
  // como DDD, e nunca aceita o país pela metade.
  it.each([
    ["(11) 98765-4321", "+5511987654321", "DDD comum, depois de +55 digitado"],
    ["(91) 98765-4321", "+5591987654321", "DDD iniciado por 9, depois de +55"],
    ["(21) 3333-4444", "+552133334444", "fixo, depois de +55 digitado"],
    ["+55 91 98765-4321", "+5591987654321", "+55 e DDD 9x digitados inteiros"],
    ["5591987654321", "+5591987654321", "55 + DDD 9x sem +: país, não DDD"],
    ["(55) 99999-8888", "+5555999998888", "DDD 55 nacional continua DDD 55"],
  ])("%p vira %p (%s)", (entrada, saida) => {
    expect(normalizarTelefone(entrada)).toBe(saida);
    expect(TELEFONE_NORMALIZADO.test(saida)).toBe(true);
  });

  it.each([["+"], ["+5"], ["+55"], ["(9"], ["(91) 9876"]])(
    "país ou número pela metade (%p) é recusado",
    (entrada) => {
      expect(telefoneAceito(entrada)).toBe(false);
    },
  );
});

describe("T179 — CEP brasileiro em 8 dígitos; outro país em texto livre", () => {
  async function endereco(corpo: Record<string, unknown>) {
    const dto = plainToInstance(EnderecoDto, corpo);
    const erros = await validate(dto, OPCOES);
    return {
      dto,
      campos: erros.map((e) => e.property),
      regras: Object.fromEntries(
        erros.map((e) => [e.property, Object.keys(e.constraints ?? {})]),
      ),
    };
  }

  it.each([
    ["01001-000", "01001000", "com hífen"],
    ["01001000", "01001000", "sem hífen"],
    ["  01001-000 ", "01001000", "com espaço nas pontas"],
  ])("Brasil: %p vira %p (%s)", async (cep, gravado) => {
    expect(normalizarCep(cep, "Brasil")).toBe(gravado);
    const { dto, campos } = await endereco({ pais: "Brasil", cep });
    expect(campos).toEqual([]);
    expect(dto.cep).toBe(gravado);
  });

  it.each([
    ["ABC123", "letras"],
    ["0100-1000", "hífen no lugar errado"],
    ["010010000", "9 dígitos"],
    ["0100100", "7 dígitos"],
    ["01001 000", "espaço no lugar do hífen"],
  ])(
    "Brasil: CEP %p (%s) é recusado pela coerência com o país",
    async (cep) => {
      const { campos, regras } = await endereco({ pais: "Brasil", cep });
      expect(campos).toEqual(["cep"]);
      expect(regras["cep"]).toContain("cepCoerenteComPais");
    },
  );

  it.each([
    ["Inglaterra", "SW1A 1AA"],
    ["Portugal", "1000-001"],
    ["Argentina", "C1002"],
  ])("outro país (%s): CEP %p fica em texto livre", async (pais, cep) => {
    expect(normalizarCep(cep, pais)).toBe(cep);
    const { dto, campos } = await endereco({ pais, cep });
    expect(campos).toEqual([]);
    expect(dto.cep).toBe(cep);
  });

  it("outro país continua limitado pela forma geral do código postal", async () => {
    const { campos } = await endereco({ pais: "Inglaterra", cep: "SW1A/1AA" });
    expect(campos).toEqual(["cep"]);
  });

  it.each([" BRASIL ", "brasil", "Brasil", "  Brasil", "BRASÍL"])(
    "país %p é o Brasil (caixa, acento e espaço nas pontas não contam)",
    async (pais) => {
      expect(ehPaisBrasil(pais)).toBe(true);
      const { dto, campos } = await endereco({ pais, cep: "01001-000" });
      expect(campos).toEqual([]);
      expect(dto.cep).toBe("01001000");
    },
  );

  it.each(["Brazil", "Bras il", "", null, undefined, 55])(
    "%p não é o Brasil",
    (pais) => {
      expect(ehPaisBrasil(pais)).toBe(false);
    },
  );

  it("Brasil sem CEP é aceito: o CEP segue opcional", async () => {
    expect(
      (await endereco({ pais: "Brasil", cidade: "Recife" })).campos,
    ).toEqual([]);
  });

  it("valor que não é texto volta intacto, para a validação recusar", async () => {
    expect(normalizarCep(1001000, "Brasil")).toBe(1001000);
    expect((await endereco({ pais: "Brasil", cep: 1001000 })).campos).toEqual([
      "cep",
    ]);
  });

  it("CepCoerenteComPais: só os 8 dígitos com Brasil; qualquer coisa sem Brasil", () => {
    const regra = new CepCoerenteComPais();
    const args = (pais: unknown) =>
      ({ object: { pais } }) as unknown as ValidationArguments;
    expect(regra.validate("01001000", args("Brasil"))).toBe(true);
    expect(regra.validate("01001-000", args("Brasil"))).toBe(false);
    expect(regra.validate("SW1A 1AA", args("Inglaterra"))).toBe(true);
    expect(regra.validate("01001-000", args(undefined))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Chave de idempotência
// ---------------------------------------------------------------------------

describe("T179 — chaveDeIdempotencia (cabeçalho Idempotency-Key)", () => {
  it("ausente: envio sem idempotência", () => {
    expect(chaveDeIdempotencia(undefined)).toBeUndefined();
  });

  it.each([
    "6f1c2a4e-8b3d-4c5e-9f60-718293a4b5c6",
    "0190f0e2-7c3a-7b4d-8e5f-60718293a4b5",
  ])("UUID válido %p é aceito", (chave) => {
    expect(chaveDeIdempotencia(chave)).toBe(chave);
  });

  it("caixa alta vira caixa baixa: a mesma chave é a mesma chave", () => {
    expect(chaveDeIdempotencia("6F1C2A4E-8B3D-4C5E-9F60-718293A4B5C6")).toBe(
      "6f1c2a4e-8b3d-4c5e-9f60-718293a4b5c6",
    );
  });

  it.each([
    ["", "vazia"],
    ["abc", "texto curto"],
    ["6f1c2a4e8b3d4c5e9f60718293a4b5c6", "sem hífens"],
    ["6f1c2a4e-8b3d-0c5e-9f60-718293a4b5c6", "versão 0"],
    ["6f1c2a4e-8b3d-4c5e-7f60-718293a4b5c6", "variante fora de 8-b"],
    [" 6f1c2a4e-8b3d-4c5e-9f60-718293a4b5c6", "espaço na ponta"],
    [
      "6f1c2a4e-8b3d-4c5e-9f60-718293a4b5c6, 6f1c2a4e-8b3d-4c5e-9f60-718293a4b5c7",
      "cabeçalho repetido",
    ],
  ])("fora da forma %p (%s) é 400", (chave) => {
    expect(() => chaveDeIdempotencia(chave)).toThrow(BadRequestException);
  });

  it.each([[["6f1c2a4e-8b3d-4c5e-9f60-718293a4b5c6"]], [42], [null]])(
    "valor que não é texto %p é 400",
    (valor) => {
      expect(() => chaveDeIdempotencia(valor)).toThrow(BadRequestException);
    },
  );
});

// ---------------------------------------------------------------------------
// Unicidade do banco → campo público
// ---------------------------------------------------------------------------

describe("T179 — camposDaUnicidadeViolada", () => {
  function unicidade(target: unknown, code = "P2002") {
    return new Prisma.PrismaClientKnownRequestError("unique", {
      code,
      clientVersion: "5.22.0",
      ...(target !== undefined && { meta: { target } }),
    });
  }

  it.each([
    [["empresa_id", "matricula"], "alvo em array"],
    ["vinculo_funcional_empresa_id_matricula_key", "alvo em texto"],
  ])("matrícula (%p, %s)", (target: unknown, _rotulo: string) => {
    expect(camposDaUnicidadeViolada(unicidade(target))).toEqual([
      { campo: "matricula", motivo: "em_uso" },
    ]);
  });

  it.each([
    [["empresa_id", "email_pessoal"], "coluna em array"],
    [["empresaId", "emailPessoal"], "campo do Prisma em array"],
    ["contato_colaborador_empresa_id_email_pessoal_key", "índice em texto"],
  ])("e-mail pessoal (%p, %s)", (target: unknown, _rotulo: string) => {
    expect(camposDaUnicidadeViolada(unicidade(target))).toEqual([
      { campo: "contatos.emailPessoal", motivo: "em_uso" },
    ]);
  });

  it.each([
    [["ator_user_id", "empresa_id", "chave"], "chave em array"],
    [
      "idempotencia_admissao_ator_user_id_empresa_id_chave_key",
      "chave em texto",
    ],
  ])(
    "a chave de idempotência não é campo público (%p, %s)",
    (target: unknown, _rotulo: string) => {
      expect(camposDaUnicidadeViolada(unicidade(target))).toBeNull();
    },
  );

  it("outra unicidade (contato por colaborador e empresa) não vira campo", () => {
    expect(
      camposDaUnicidadeViolada(unicidade(["colaborador_id", "empresa_id"])),
    ).toBeNull();
  });

  it("sem alvo, outro código do Prisma ou erro comum: null", () => {
    expect(camposDaUnicidadeViolada(unicidade(undefined))).toBeNull();
    expect(
      camposDaUnicidadeViolada(unicidade(["empresa_id", "matricula"], "P2003")),
    ).toBeNull();
    expect(camposDaUnicidadeViolada(new Error("matricula"))).toBeNull();
    expect(camposDaUnicidadeViolada(undefined)).toBeNull();
  });
});

describe("T179 — conflitosDaAdmissao (só a empresa ativa, sem valor)", () => {
  function tx(matriculaEmUso: boolean, emailEmUso: boolean) {
    return {
      vinculoFuncional: {
        findFirst: jest
          .fn()
          .mockResolvedValue(matriculaEmUso ? { id: "v" } : null),
      },
      contatoColaborador: {
        findFirst: jest.fn().mockResolvedValue(emailEmUso ? { id: "c" } : null),
      },
    };
  }
  const dto = {
    matricula: "MAT-T179",
    contatos: { emailPessoal: "pessoa.t179@example.test" },
  } as Pick<AdmitirColaboradorDto, "matricula" | "contatos">;

  it.each([
    [false, false, []],
    [true, false, ["matricula"]],
    [false, true, ["contatos.emailPessoal"]],
    [true, true, ["matricula", "contatos.emailPessoal"]],
  ] as const)(
    "matrícula em uso %p, e-mail em uso %p → %p",
    async (matricula, email, campos) => {
      const t = tx(matricula, email);
      const erros = await conflitosDaAdmissao(
        t as unknown as Prisma.TransactionClient,
        EMPRESA_A,
        dto,
      );
      expect(erros).toEqual(
        campos.map((campo) => ({ campo, motivo: "em_uso" })),
      );
      expect(JSON.stringify(erros)).not.toContain("MAT-T179");
      expect(JSON.stringify(erros)).not.toContain("example.test");
      expect(t.vinculoFuncional.findFirst).toHaveBeenCalledWith({
        where: { empresaId: EMPRESA_A, matricula: "MAT-T179" },
        select: { id: true },
      });
      expect(t.contatoColaborador.findFirst).toHaveBeenCalledWith({
        where: {
          empresaId: EMPRESA_A,
          emailPessoal: "pessoa.t179@example.test",
        },
        select: { id: true },
      });
    },
  );
});

// ---------------------------------------------------------------------------
// Reenvio idempotente: o conteúdo confere com a admissão gravada?
// ---------------------------------------------------------------------------

describe("T179 — admissaoConfere", () => {
  const CORPO = {
    nome: "Pessoa Sintetica T179",
    empresaId: EMPRESA_A,
    matricula: "MAT-T179",
    tipo: "clt",
    dataAdmissao: "2026-10-01",
    motivoCodigo: "admissao_inicial",
    departamentoId: DEPARTAMENTO,
    cargoId: CARGO,
    unidadeOrganizacionalId: UNIDADE,
    perfilPessoal: { dataNascimento: "1990-05-20", sexo: "Feminino" },
    endereco: { pais: "Brasil", cep: "01001-000", cidade: "Sao Paulo" },
    contatos: {
      emailPessoal: "Pessoa.T179@Example.TEST",
      celular: "(11) 98765-4321",
      telefone: "(11) 3333-4444",
    },
  };

  /** O DTO passa pelos mesmos `@Transform` da gravação. */
  function dto(corpo: Record<string, unknown> = CORPO) {
    return plainToInstance(AdmitirColaboradorDto, corpo);
  }

  function gravada(): AdmissaoGravada {
    return {
      colaborador: { nome: "Pessoa Sintetica T179" },
      vinculo: {
        empresaId: EMPRESA_A,
        matricula: "MAT-T179",
        tipo: "clt",
        dataAdmissao: new Date("2026-10-01T00:00:00.000Z"),
      },
      movimentacao: {
        motivoCodigo: "admissao_inicial",
        destinoUnidadeOrganizacionalId: UNIDADE,
        destinoDepartamentoId: DEPARTAMENTO,
        destinoAreaId: null,
        destinoEquipeId: null,
        destinoCargoId: CARGO,
        destinoCentroCustoId: null,
      },
      perfil: {
        dataNascimento: new Date("1990-05-20T00:00:00.000Z"),
        sexo: "Feminino",
        saudacao: null,
        estadoCivil: null,
        nacionalidade: null,
        naturalidade: null,
        escolaridade: null,
        curso: null,
        nomePai: null,
        nomeMae: null,
      },
      endereco: {
        pais: "Brasil",
        cep: "01001000",
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: "Sao Paulo",
        estado: null,
      },
      contato: {
        emailPessoal: "pessoa.t179@example.test",
        celular: "+5511987654321",
        telefone: "+551133334444",
      },
    } as AdmissaoGravada;
  }

  it("o mesmo conteúdo, já normalizado, confere", () => {
    expect(admissaoConfere(dto(), gravada())).toBe(true);
  });

  type Mutacao = (g: AdmissaoGravada) => void;
  it.each<[string, Mutacao]>([
    ["nome", (g) => (g.colaborador.nome = "Outra Pessoa")],
    [
      "empresa",
      (g) => (g.vinculo.empresaId = "22222222-2222-4222-8222-222222222222"),
    ],
    ["matrícula", (g) => (g.vinculo.matricula = "MAT-OUTRA")],
    ["tipo", (g) => (g.vinculo.tipo = "estagio")],
    [
      "data de admissão",
      (g) => (g.vinculo.dataAdmissao = new Date("2026-10-02T00:00:00.000Z")),
    ],
    ["motivo", (g) => (g.movimentacao.motivoCodigo = "outro_controlado")],
    ["unidade", (g) => (g.movimentacao.destinoUnidadeOrganizacionalId = null)],
    ["departamento", (g) => (g.movimentacao.destinoDepartamentoId = UNIDADE)],
    [
      "área",
      (g) =>
        (g.movimentacao.destinoAreaId = "77777777-7777-4777-8777-777777777777"),
    ],
    [
      "equipe",
      (g) =>
        (g.movimentacao.destinoEquipeId =
          "77777777-7777-4777-8777-777777777777"),
    ],
    ["cargo", (g) => (g.movimentacao.destinoCargoId = null)],
    [
      "centro de custo",
      (g) =>
        (g.movimentacao.destinoCentroCustoId =
          "77777777-7777-4777-8777-777777777777"),
    ],
    ["perfil ausente", (g) => (g.perfil = null)],
    [
      "data de nascimento",
      (g) => (g.perfil!.dataNascimento = new Date("1990-05-21T00:00:00.000Z")),
    ],
    ["sexo", (g) => (g.perfil!.sexo = null)],
    ["nome da mãe", (g) => (g.perfil!.nomeMae = "Mae Sintetica")],
    ["endereço ausente", (g) => (g.endereco = null)],
    ["CEP", (g) => (g.endereco!.cep = "01001001")],
    ["cidade", (g) => (g.endereco!.cidade = "Campinas")],
    ["logradouro", (g) => (g.endereco!.logradouro = "Rua Sintetica")],
    ["contato ausente", (g) => (g.contato = null)],
    ["e-mail pessoal", (g) => (g.contato!.emailPessoal = "outra@example.test")],
    ["celular", (g) => (g.contato!.celular = "+5511987654320")],
    ["telefone", (g) => (g.contato!.telefone = "+551133334440")],
  ])("%s divergente não confere", (_campo, mutar) => {
    const g = gravada();
    mutar(g);
    expect(admissaoConfere(dto(), g)).toBe(false);
  });

  describe("endereço ausente × vazio", () => {
    // Campo ausente: `undefined` some do corpo como some do JSON enviado.
    const semEndereco = (): Record<string, unknown> => ({
      ...CORPO,
      endereco: undefined,
    });
    const gravadaSemEndereco = () => ({ ...gravada(), endereco: null });

    it("envio sem endereço e nada gravado: confere", () => {
      expect(admissaoConfere(dto(semEndereco()), gravadaSemEndereco())).toBe(
        true,
      );
    });

    it("envio com endereço vazio (`{}` ou só espaços) e nada gravado: confere", () => {
      expect(
        admissaoConfere(dto({ ...CORPO, endereco: {} }), gravadaSemEndereco()),
      ).toBe(true);
      expect(
        admissaoConfere(
          dto({ ...CORPO, endereco: { cidade: "   ", pais: "" } }),
          gravadaSemEndereco(),
        ),
      ).toBe(true);
    });

    it("envio sem endereço, mas endereço gravado: não confere", () => {
      expect(admissaoConfere(dto(semEndereco()), gravada())).toBe(false);
      expect(admissaoConfere(dto({ ...CORPO, endereco: {} }), gravada())).toBe(
        false,
      );
    });

    it("envio com endereço, mas nada gravado: não confere", () => {
      expect(admissaoConfere(dto(), gravadaSemEndereco())).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Lotação obrigatória só na Nova admissão
// ---------------------------------------------------------------------------

describe("T179 — AdmitirColaboradorDto exige Departamento, Cargo e Unidade", () => {
  const CORPO = {
    nome: "Pessoa Sintetica T179",
    empresaId: EMPRESA_A,
    matricula: "MAT-T179",
    tipo: "clt",
    dataAdmissao: "2026-10-01",
    motivoCodigo: "admissao_inicial",
    departamentoId: DEPARTAMENTO,
    cargoId: CARGO,
    unidadeOrganizacionalId: UNIDADE,
    perfilPessoal: { dataNascimento: "1990-05-20" },
    contatos: {
      emailPessoal: "pessoa.t179@example.test",
      celular: "11987654321",
      telefone: "1133334444",
    },
  };

  async function campos(corpo: Record<string, unknown>) {
    const erros = await validate(
      plainToInstance(AdmitirColaboradorDto, corpo),
      OPCOES,
    );
    return erros.map((e) => e.property).sort();
  }

  it("com os três, sem área, equipe nem centro de custo: aceito", async () => {
    expect(await campos(CORPO)).toEqual([]);
  });

  it.each(["departamentoId", "cargoId", "unidadeOrganizacionalId"])(
    "sem %s: recusado só nesse campo",
    async (campo) => {
      expect(await campos({ ...CORPO, [campo]: undefined })).toEqual([campo]);
      expect(await campos({ ...CORPO, [campo]: null })).toEqual([campo]);
      expect(await campos({ ...CORPO, [campo]: "" })).toEqual([campo]);
      expect(await campos({ ...CORPO, [campo]: "nao-e-uuid" })).toEqual([
        campo,
      ]);
    },
  );

  it("sem nenhum dos três: os três recusados", async () => {
    const semLotacao = {
      ...CORPO,
      departamentoId: undefined,
      cargoId: undefined,
      unidadeOrganizacionalId: undefined,
    };
    expect(await campos(semLotacao)).toEqual(
      ["cargoId", "departamentoId", "unidadeOrganizacionalId"].sort(),
    );
  });

  it.each(["areaId", "equipeId", "centroCustoId"])(
    "%s segue opcional, mas, quando vem, é UUID",
    async (campo) => {
      expect(
        await campos({
          ...CORPO,
          [campo]: "77777777-7777-4777-8777-777777777777",
        }),
      ).toEqual([]);
      expect(await campos({ ...CORPO, [campo]: "x" })).toEqual([campo]);
    },
  );

  it("o novo vínculo de colaborador existente continua com o destino todo opcional", async () => {
    const erros = await validate(
      plainToInstance(CriarVinculoDto, {
        colaboradorId: "88888888-8888-4888-8888-888888888888",
        empresaId: EMPRESA_A,
        matricula: "MAT-T179-2",
        tipo: "clt",
        dataAdmissao: "2026-10-01",
        motivoCodigo: "admissao_inicial",
      }),
      OPCOES,
    );
    expect(erros).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// admitirIdempotente: reenvio, divergência e a corrida da mesma chave
// ---------------------------------------------------------------------------

describe("T179 — admitirIdempotente (serviço, sem banco)", () => {
  const AGORA = new Date("2026-10-01T12:00:00.000Z");
  const CHAVE = "6f1c2a4e-8b3d-4c5e-9f60-718293a4b5c6";
  const REGISTRO = {
    id: "idem-1",
    chave: CHAVE,
    atorUserId: "ator-rh",
    empresaId: EMPRESA_A,
    colaboradorId: "col-1",
    vinculoId: "vin-1",
    movimentacaoId: "mov-1",
    criadoEm: AGORA,
  };
  const CORPO = {
    nome: "Pessoa Sintetica T179",
    empresaId: EMPRESA_A,
    matricula: "MAT-T179",
    tipo: "clt",
    dataAdmissao: "2026-10-01",
    motivoCodigo: "admissao_inicial",
    departamentoId: DEPARTAMENTO,
    cargoId: CARGO,
    unidadeOrganizacionalId: UNIDADE,
    perfilPessoal: { dataNascimento: "1990-05-20" },
    contatos: {
      emailPessoal: "pessoa.t179@example.test",
      celular: "(11) 98765-4321",
      telefone: "(11) 3333-4444",
    },
  };
  const ctx = {
    actor: {
      id: "ator-rh",
      role: "rh",
      companyId: EMPRESA_A,
    } as unknown as AccessUser,
    metadata: { ip: null, userAgent: null, requestId: "req-t179" },
  };

  /** A admissão já gravada, como o banco a devolve ao reenvio. */
  function gravadaNoBanco() {
    return {
      colaborador: {
        id: "col-1",
        nome: "Pessoa Sintetica T179",
        situacao: "inativo",
        criadoEm: AGORA,
        atualizadoEm: AGORA,
      },
      vinculo: {
        id: "vin-1",
        empresaId: EMPRESA_A,
        matricula: "MAT-T179",
        tipo: "clt",
        situacao: "previsto",
        dataAdmissao: new Date("2026-10-01T00:00:00.000Z"),
      },
      movimentacao: {
        id: "mov-1",
        tipo: "admissao",
        status: "solicitada",
        vigenciaInicio: new Date("2026-10-01T00:00:00.000Z"),
        motivoCodigo: "admissao_inicial",
        destinoUnidadeOrganizacionalId: UNIDADE,
        destinoDepartamentoId: DEPARTAMENTO,
        destinoAreaId: null,
        destinoEquipeId: null,
        destinoCargoId: CARGO,
        destinoCentroCustoId: null,
      },
      perfil: {
        dataNascimento: new Date("1990-05-20T00:00:00.000Z"),
        sexo: null,
        saudacao: null,
        estadoCivil: null,
        nacionalidade: null,
        naturalidade: null,
        escolaridade: null,
        curso: null,
        nomePai: null,
        nomeMae: null,
      },
      contato: {
        emailPessoal: "pessoa.t179@example.test",
        celular: "+5511987654321",
        telefone: "+551133334444",
      },
    };
  }

  function montar(opcoes: {
    /** O que `findUnique` da chave devolve, chamada a chamada. */
    registros: (typeof REGISTRO | null)[];
    /** Erro que a transação da GRAVAÇÃO lança (a corrida perdida). */
    falhaNaGravacao?: unknown;
    gravada?: ReturnType<typeof gravadaNoBanco>;
  }) {
    const gravada = opcoes.gravada ?? gravadaNoBanco();
    const registros = [...opcoes.registros];
    const txLeitura = {
      colaborador: {
        findUniqueOrThrow: jest.fn(async () => gravada.colaborador),
      },
      vinculoFuncional: {
        findUniqueOrThrow: jest.fn(async () => gravada.vinculo),
      },
      movimentacaoFuncional: {
        findUniqueOrThrow: jest.fn(async () => gravada.movimentacao),
      },
      perfilPessoalColaborador: {
        findUnique: jest.fn(async () => gravada.perfil),
      },
      enderecoColaborador: { findUnique: jest.fn(async () => null) },
      contatoColaborador: { findUnique: jest.fn(async () => gravada.contato) },
    };
    const gravacao = jest.fn(async () => {
      throw opcoes.falhaNaGravacao ?? new Error("não devia gravar");
    });
    let transacoes = 0;
    const prisma = {
      idempotenciaAdmissao: {
        findUnique: jest.fn(async () => registros.shift() ?? null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        transacoes += 1;
        // Com falha simulada, a primeira transação é a da gravação (a
        // corrida perdida); as demais são a leitura do reenvio.
        return opcoes.falhaNaGravacao !== undefined && transacoes === 1
          ? gravacao()
          : fn(txLeitura);
      }),
    };
    const dadosPessoais = {
      consultar: jest.fn(async () => ({
        perfilPessoal: { dataNascimento: "1990-05-20" },
        endereco: null,
      })),
    };
    const contatos = {
      consultar: jest.fn(async () => ({
        contatos: { ...gravada.contato, atualizadoEm: AGORA },
      })),
    };
    const servico = new ColaboradorService(
      prisma as unknown as PrismaService,
      {} as unknown as PessoasAuditoriaService,
      dadosPessoais as unknown as DadosPessoaisColaboradorService,
      contatos as unknown as ContatoColaboradorService,
    );
    return { servico, prisma, gravacao, dadosPessoais, contatos };
  }

  const dto = (corpo: Record<string, unknown> = CORPO) =>
    plainToInstance(AdmitirColaboradorDto, corpo);
  const unicidade = (target: string[]) =>
    new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "5.22.0",
      meta: { target },
    });

  it("chave já registrada e conteúdo igual: reenvio, sem gravar nada", async () => {
    const m = montar({ registros: [REGISTRO] });
    const { admissao, reenvio } = await m.servico.admitirIdempotente(
      dto(),
      ctx,
      CHAVE,
    );
    expect(reenvio).toBe(true);
    expect(admissao).toMatchObject({
      id: "col-1",
      vinculo: { id: "vin-1", matricula: "MAT-T179" },
      movimentacao: { id: "mov-1", destino: { cargoId: CARGO } },
    });
    expect(m.prisma.idempotenciaAdmissao.findUnique).toHaveBeenCalledWith({
      where: {
        atorUserId_empresaId_chave: {
          atorUserId: "ator-rh",
          empresaId: EMPRESA_A,
          chave: CHAVE,
        },
      },
    });
    expect(m.gravacao).not.toHaveBeenCalled();
    // A resposta é montada pelas consultas que deixam a trilha de leitura.
    expect(m.dadosPessoais.consultar).toHaveBeenCalledWith("col-1", ctx);
    expect(m.contatos.consultar).toHaveBeenCalledWith("col-1", ctx);
  });

  it("chave já registrada e conteúdo diferente: 422, nada lido para a resposta", async () => {
    const m = montar({ registros: [REGISTRO] });
    await expect(
      m.servico.admitirIdempotente(
        dto({ ...CORPO, nome: "Outra Pessoa" }),
        ctx,
        CHAVE,
      ),
    ).rejects.toEqual(
      new RecusaDeNegocioException("idempotencia_conteudo_divergente"),
    );
    expect(m.dadosPessoais.consultar).not.toHaveBeenCalled();
    expect(m.contatos.consultar).not.toHaveBeenCalled();
  });

  it("corrida da MESMA chave: a unicidade barra, o registro do outro aparece, e é reenvio", async () => {
    const m = montar({
      registros: [null, REGISTRO],
      falhaNaGravacao: unicidade(["empresa_id", "matricula"]),
    });
    const { reenvio, admissao } = await m.servico.admitirIdempotente(
      dto(),
      ctx,
      CHAVE,
    );
    expect(reenvio).toBe(true);
    expect(admissao.id).toBe("col-1");
    expect(m.gravacao).toHaveBeenCalledTimes(1);
  });

  it("corrida com OUTRA chave (ou sem chave): a unicidade vira 409 com o campo", async () => {
    const m = montar({
      registros: [null, null],
      falhaNaGravacao: unicidade(["empresa_id", "email_pessoal"]),
    });
    const erro = await m.servico
      .admitirIdempotente(dto(), ctx, CHAVE)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ConflitoDeCamposException);
    expect((erro as ConflitoDeCamposException).erros).toEqual([
      { campo: "contatos.emailPessoal", motivo: "em_uso" },
    ]);
  });

  it("conflito detectado antes de gravar e chave sem registro: 409 com os campos", async () => {
    const m = montar({
      registros: [null, null],
      falhaNaGravacao: new ConflitoDeCamposException([
        { campo: "matricula", motivo: "em_uso" },
      ]),
    });
    const erro = await m.servico
      .admitirIdempotente(dto(), ctx, CHAVE)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ConflitoDeCamposException);
    expect((erro as ConflitoDeCamposException).erros).toEqual([
      { campo: "matricula", motivo: "em_uso" },
    ]);
  });

  it("sem chave: nenhum registro de idempotência é consultado", async () => {
    const m = montar({
      registros: [],
      falhaNaGravacao: unicidade(["empresa_id", "matricula"]),
    });
    await expect(
      m.servico.admitirIdempotente(dto(), ctx, undefined),
    ).rejects.toBeInstanceOf(ConflitoDeCamposException);
    expect(m.prisma.idempotenciaAdmissao.findUnique).not.toHaveBeenCalled();
  });
});
