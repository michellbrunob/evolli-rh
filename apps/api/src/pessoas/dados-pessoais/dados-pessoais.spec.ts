import "reflect-metadata";
import { AccessRole, AccessUser } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { evaluatePermission } from "../../auth/authorization/rbac.evaluator";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { AdmitirColaboradorDto } from "../dto/pessoas.dto";
import { ColaboradorService } from "../colaborador/colaborador.service";
import { ContatoColaboradorService } from "../contatos/contato-colaborador.service";
import {
  EnderecoDto,
  PerfilPessoalDto,
  RegistrarDadosPessoaisDto,
} from "./dados-pessoais.dto";
import {
  DadosPessoaisColaboradorService,
  camposAlterados,
  camposPreenchidos,
  enderecoCompleto,
  perfilCompleto,
} from "./dados-pessoais.service";
import {
  CAMPOS_ENDERECO,
  CAMPOS_PERFIL,
  normalizarTextoPessoal,
} from "./normalizacao-dados-pessoais.util";

/**
 * T177 — Cadastro de colaborador, Módulo 1: dados pessoais e endereço.
 *
 * Prende, sem banco, o que o servidor decide: obrigatoriedade, normalização e
 * limites de cada campo, a matriz de autorização (`rh` e `dp` na empresa
 * ativa; `master_tecnico` em qualquer empresa, como nos contatos), a gravação
 * na admissão e a regra de que nenhum valor pessoal entra na trilha. A
 * atomicidade e os CHECKs do banco ficam no E2E.
 */

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";
const OPCOES = { whitelist: true, forbidNonWhitelisted: true };

function ator(role: AccessRole, companyId: string | null): AccessUser {
  return { id: `ator-${role}`, role, companyId } as unknown as AccessUser;
}

async function erros<T extends object>(
  classe: new () => T,
  corpo: Record<string, unknown>,
): Promise<string[]> {
  const instancia = plainToInstance(classe, corpo);
  const lista = await validate(instancia, OPCOES);
  return lista.map((e) => e.property);
}

describe("Módulo 1 — normalização do texto pessoal", () => {
  it("apara as pontas e colapsa espaços internos repetidos", () => {
    expect(normalizarTextoPessoal("  Rua   das  Flores ")).toBe(
      "Rua das Flores",
    );
  });

  it("vazio e só espaço viram null", () => {
    expect(normalizarTextoPessoal("")).toBeNull();
    expect(normalizarTextoPessoal("    ")).toBeNull();
  });

  it("o que não é texto volta intacto, para a validação recusar", () => {
    expect(normalizarTextoPessoal(42)).toBe(42);
    expect(normalizarTextoPessoal(null)).toBeNull();
  });
});

describe("Módulo 1 — PerfilPessoalDto", () => {
  it("aceita o perfil completo e normaliza o texto", async () => {
    const dto = plainToInstance(PerfilPessoalDto, {
      dataNascimento: "1990-05-20",
      sexo: " feminino ",
      saudacao: "Sra.",
      estadoCivil: "Casada",
      nacionalidade: "Brasileira",
      naturalidade: "Belo  Horizonte",
      escolaridade: "Superior completo",
      curso: "Administração",
      nomePai: "Pai Sintético",
      nomeMae: "Mãe Sintética",
    });
    expect(await validate(dto, OPCOES)).toEqual([]);
    expect(dto.sexo).toBe("feminino");
    expect(dto.naturalidade).toBe("Belo Horizonte");
  });

  it.each(["feminino", "masculino", "intersexo", "nao_informar"])(
    "T179: sexo %p é uma das opções fechadas e é aceito",
    async (sexo) => {
      const dto = plainToInstance(PerfilPessoalDto, {
        dataNascimento: "1990-05-20",
        sexo,
      });
      expect(await validate(dto, OPCOES)).toEqual([]);
      expect(dto.sexo).toBe(sexo);
    },
  );

  it("T179: sem seleção de sexo (ausente, vazio ou null) é aceito e vira null", async () => {
    for (const sexo of [undefined, "", "   ", null]) {
      const dto = plainToInstance(PerfilPessoalDto, {
        dataNascimento: "1990-05-20",
        ...(sexo === undefined ? {} : { sexo }),
      });
      expect(await validate(dto, OPCOES)).toEqual([]);
      expect(dto.sexo ?? null).toBeNull();
    }
  });

  it.each(["Feminino", "F", "outro", "não informar", "mulher", "<b>x</b>"])(
    "T179: sexo fora da lista fechada (%p) é recusado — sem texto livre",
    async (sexo) => {
      expect(
        await erros(PerfilPessoalDto, { dataNascimento: "1990-05-20", sexo }),
      ).toEqual(["sexo"]);
    },
  );

  it("data de nascimento é obrigatória; os demais campos são opcionais", async () => {
    expect(await erros(PerfilPessoalDto, {})).toEqual(["dataNascimento"]);
    expect(await erros(PerfilPessoalDto, { dataNascimento: "" })).toEqual([
      "dataNascimento",
    ]);
    expect(await erros(PerfilPessoalDto, { dataNascimento: null })).toEqual([
      "dataNascimento",
    ]);
    expect(
      await erros(PerfilPessoalDto, { dataNascimento: "1990-05-20" }),
    ).toEqual([]);
  });

  it.each([
    ["formato livre", "20/05/1990"],
    ["data inexistente", "1990-02-30"],
    ["antes de 1900", "1899-12-31"],
    ["no futuro", "2999-01-01"],
    ["não é texto", 19900520],
  ])("recusa data de nascimento — %s", async (_caso, valor) => {
    expect(await erros(PerfilPessoalDto, { dataNascimento: valor })).toContain(
      "dataNascimento",
    );
  });

  it("aceita a borda de 1900-01-01", async () => {
    expect(
      await erros(PerfilPessoalDto, { dataNascimento: "1900-01-01" }),
    ).toEqual([]);
  });

  it("recusa texto acima do limite e caractere de controle", async () => {
    const data = { dataNascimento: "1990-05-20" };
    expect(
      await erros(PerfilPessoalDto, { ...data, saudacao: "x".repeat(41) }),
    ).toContain("saudacao");
    expect(
      await erros(PerfilPessoalDto, { ...data, curso: "a\u0007b" }),
    ).toContain("curso");
    expect(
      await erros(PerfilPessoalDto, { ...data, nomeMae: "linha\nquebrada" }),
    ).toContain("nomeMae");
  });

  it("recusa campo que não é do Módulo 1 (nome social, gênero, CPF)", async () => {
    for (const campo of ["nomeSocial", "genero", "cpf", "racaEtnia"]) {
      expect(
        await erros(PerfilPessoalDto, {
          dataNascimento: "1990-05-20",
          [campo]: "x",
        }),
      ).toContain(campo);
    }
  });
});

describe("Módulo 1 — EnderecoDto", () => {
  it("aceita o endereço completo, com país em texto", async () => {
    expect(
      await erros(EnderecoDto, {
        pais: "Brasil",
        cep: "30140-071",
        logradouro: "Avenida Sintética",
        numero: "100A",
        complemento: "Sala 2",
        bairro: "Centro",
        cidade: "Belo Horizonte",
        estado: "MG",
      }),
    ).toEqual([]);
  });

  it.each([
    ["curto demais", "12"],
    ["longo demais", "1234567890123"],
    ["caractere fora do padrão", "30140/071"],
  ])("recusa CEP %s", async (_caso, cep) => {
    expect(await erros(EnderecoDto, { cep })).toContain("cep");
  });

  it("recusa número acima de 20 caracteres", async () => {
    expect(await erros(EnderecoDto, { numero: "1".repeat(21) })).toContain(
      "numero",
    );
  });
});

describe("Módulo 1 — AdmitirColaboradorDto com os blocos", () => {
  const base = {
    nome: "Pessoa Sintética",
    empresaId: EMPRESA_A,
    matricula: "MAT-T177",
    tipo: "clt",
    dataAdmissao: "2026-10-20",
    motivoCodigo: "admissao_inicial",
    // T179 — a lotação da Nova admissão exige Departamento, Cargo e Unidade.
    departamentoId: "33333333-3333-4333-8333-333333333333",
    cargoId: "55555555-5555-4555-8555-555555555555",
    unidadeOrganizacionalId: "66666666-6666-4666-8666-666666666666",
  };
  const obrigatorios = {
    perfilPessoal: { dataNascimento: "1990-05-20" },
    contatos: {
      emailPessoal: "pessoa@exemplo.test",
      celular: "+5511999990000",
      telefone: "+551133330000",
    },
  };

  it("perfil (com data de nascimento) é obrigatório; T179: contatos e endereço são opcionais", async () => {
    expect(
      await erros(AdmitirColaboradorDto, { ...base, ...obrigatorios }),
    ).toEqual([]);
    expect(await erros(AdmitirColaboradorDto, base)).toEqual(["perfilPessoal"]);
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        ...obrigatorios,
        perfilPessoal: { sexo: "feminino" },
      }),
    ).toEqual(["perfilPessoal"]);
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        perfilPessoal: obrigatorios.perfilPessoal,
      }),
    ).toEqual([]);
  });

  it("nome completo continua obrigatório", async () => {
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        ...obrigatorios,
        nome: undefined,
      }),
    ).toContain("nome");
  });

  it("valida cada bloco aninhado", async () => {
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        ...obrigatorios,
        perfilPessoal: { dataNascimento: "2999-01-01" },
      }),
    ).toContain("perfilPessoal");
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        ...obrigatorios,
        endereco: { cep: "?" },
      }),
    ).toContain("endereco");
  });

  it("contatos seguem a ficha da T169, normalizados; T179: cada um é opcional, e o informado tem formato conferido", async () => {
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        ...obrigatorios,
        contatos: { emailPessoal: "a@b.test", celular: "11999990000" },
      }),
    ).toEqual([]);
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        ...obrigatorios,
        contatos: { celular: "12345" },
      }),
    ).toContain("contatos");

    const dto = plainToInstance(AdmitirColaboradorDto, {
      ...base,
      ...obrigatorios,
      contatos: {
        emailPessoal: " Pessoa@Exemplo.TEST ",
        celular: "+55 (11) 99999-0000",
        telefone: "11 3333-0000",
      },
    });
    expect(await validate(dto, OPCOES)).toEqual([]);
    // T179 — telefone gravado em `+55` + DDD + número.
    expect(dto.contatos).toEqual({
      emailPessoal: "pessoa@exemplo.test",
      celular: "+5511999990000",
      telefone: "+551133330000",
    });
  });

  it("recusa empresa no bloco de dados pessoais", async () => {
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        ...obrigatorios,
        endereco: { empresaId: EMPRESA_A },
      }),
    ).toContain("endereco");
  });
});

describe("Módulo 1 — RegistrarDadosPessoaisDto", () => {
  it("cada bloco é validado", async () => {
    expect(
      await erros(RegistrarDadosPessoaisDto, {
        perfilPessoal: { dataNascimento: "1990-05-20", sexo: "x".repeat(61) },
      }),
    ).toContain("perfilPessoal");
  });

  it("o bloco do perfil exige a data de nascimento também na edição", async () => {
    expect(
      await erros(RegistrarDadosPessoaisDto, {
        perfilPessoal: { sexo: "Feminino" },
      }),
    ).toContain("perfilPessoal");
    expect(
      await erros(RegistrarDadosPessoaisDto, {
        endereco: { cidade: "Recife" },
      }),
    ).toEqual([]);
  });
});

describe("Módulo 1 — matriz de autorização (dados_pessoais_colaborador)", () => {
  function pode(
    role: AccessRole,
    action: "read" | "alter" | "create" | "manage",
    companyId: string | null,
    targetCompanyId?: string | null,
  ) {
    return evaluatePermission(
      { userId: `u-${role}`, role, companyId },
      {
        resource: "dados_pessoais_colaborador",
        action,
        ...(targetCompanyId !== undefined ? { targetCompanyId } : {}),
      },
    );
  }

  it.each(["rh", "dp"] as const)("%s lê e edita na própria empresa", (role) => {
    expect(pode(role, "read", EMPRESA_A)).toBe(true);
    expect(pode(role, "alter", EMPRESA_A)).toBe(true);
    expect(pode(role, "read", EMPRESA_A, EMPRESA_A)).toBe(true);
    expect(pode(role, "alter", EMPRESA_A, EMPRESA_A)).toBe(true);
  });

  it.each(["rh", "dp"] as const)("%s não alcança outra empresa", (role) => {
    expect(
      pode(role, "read", EMPRESA_A, "22222222-2222-4222-8222-222222222222"),
    ).toBe(false);
    expect(
      pode(role, "alter", EMPRESA_A, "22222222-2222-4222-8222-222222222222"),
    ).toBe(false);
  });

  it.each(["rh", "dp"] as const)("%s sem empresa é negado", (role) => {
    expect(pode(role, "read", null)).toBe(false);
  });

  it("só read e alter existem: create e manage são negados", () => {
    expect(pode("rh", "create", EMPRESA_A)).toBe(false);
    expect(pode("rh", "manage", EMPRESA_A)).toBe(false);
  });

  it("master_tecnico sem empresa ativa lê e edita em qualquer empresa", () => {
    expect(pode("master_tecnico", "read", null)).toBe(true);
    expect(pode("master_tecnico", "alter", null)).toBe(true);
    expect(pode("master_tecnico", "read", null, EMPRESA_A)).toBe(true);
    expect(pode("master_tecnico", "alter", null, EMPRESA_B)).toBe(true);
  });

  it("master_tecnico com empresa ativa atua só nela", () => {
    expect(pode("master_tecnico", "read", EMPRESA_A)).toBe(true);
    expect(pode("master_tecnico", "read", EMPRESA_A, EMPRESA_A)).toBe(true);
    expect(pode("master_tecnico", "alter", EMPRESA_A, EMPRESA_A)).toBe(true);
    expect(pode("master_tecnico", "read", EMPRESA_A, EMPRESA_B)).toBe(false);
    expect(pode("master_tecnico", "alter", EMPRESA_A, EMPRESA_B)).toBe(false);
  });

  it("master_tecnico: alvo sem empresa resolvida é negado; create e manage não existem", () => {
    expect(pode("master_tecnico", "read", null, null)).toBe(false);
    expect(pode("master_tecnico", "create", null)).toBe(false);
    expect(pode("master_tecnico", "manage", null)).toBe(false);
  });

  it.each([
    ["gestor", EMPRESA_A],
    ["colaborador", EMPRESA_A],
    ["financeiro", EMPRESA_A],
    ["admin_tecnico", null],
    ["auditor", EMPRESA_A],
    ["dpo", EMPRESA_A],
  ] as const)("%s (empresa %s) não lê nem edita", (role, companyId) => {
    expect(pode(role, "read", companyId)).toBe(false);
    expect(pode(role, "alter", companyId)).toBe(false);
  });

  it("o acesso do master_tecnico em contatos continua como estava", () => {
    expect(
      evaluatePermission(
        { userId: "u-m", role: "master_tecnico", companyId: null },
        { resource: "contato_colaborador", action: "read" },
      ),
    ).toBe(true);
  });
});

describe("Módulo 1 — campos alcançados (só nomes)", () => {
  it("campos preenchidos na criação", () => {
    const valores = perfilCompleto(
      plainToInstance(PerfilPessoalDto, {
        dataNascimento: "1990-05-20",
        sexo: "Masculino",
      }),
    );
    expect(camposPreenchidos(valores, CAMPOS_PERFIL)).toEqual([
      "data_nascimento",
      "sexo",
    ]);
  });

  it("campos alterados na edição; ausente vira null e conta como mudança", () => {
    const atual = enderecoCompleto(
      plainToInstance(EnderecoDto, { pais: "Brasil", cidade: "Recife" }),
    );
    const novo = enderecoCompleto(
      plainToInstance(EnderecoDto, { pais: "Brasil", bairro: "Boa Vista" }),
    );
    expect(camposAlterados(atual, novo, CAMPOS_ENDERECO)).toEqual([
      "bairro",
      "cidade",
    ]);
  });
});

/**
 * Admissão com os três blocos, sobre um cliente de banco em memória: prova que
 * o serviço grava perfil, endereço e contatos na MESMA transação da admissão,
 * devolve o que gravou e não põe valor pessoal em evento nenhum.
 */
describe("Módulo 1 — admissão com perfil, endereço e contatos", () => {
  const AGORA = new Date("2026-10-20T12:00:00.000Z");
  const DEPARTAMENTO = "33333333-3333-4333-8333-333333333333";
  const CARGO = "55555555-5555-4555-8555-555555555555";
  const UNIDADE = "66666666-6666-4666-8666-666666666666";

  function montar() {
    const eventosDados: Record<string, unknown>[] = [];
    const eventosContato: Record<string, unknown>[] = [];
    const auditorias: Record<string, unknown>[] = [];
    const tx = {
      departamento: { count: jest.fn().mockResolvedValue(1) },
      cargo: { count: jest.fn().mockResolvedValue(1) },
      unidadeOrganizacional: { count: jest.fn().mockResolvedValue(1) },
      colaborador: {
        create: jest.fn().mockResolvedValue({
          id: "col-1",
          nome: "Pessoa Sintética",
          situacao: "inativo",
          criadoEm: AGORA,
          atualizadoEm: AGORA,
        }),
      },
      vinculoFuncional: {
        // T179 — matrícula livre na empresa.
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "vin-1",
          empresaId: EMPRESA_A,
          matricula: "MAT-T177",
          tipo: "clt",
          situacao: "previsto",
          dataAdmissao: AGORA,
        }),
      },
      movimentacaoFuncional: {
        create: jest.fn().mockResolvedValue({
          id: "mov-1",
          tipo: "admissao",
          status: "solicitada",
          vigenciaInicio: AGORA,
          destinoUnidadeOrganizacionalId: UNIDADE,
          destinoDepartamentoId: DEPARTAMENTO,
          destinoAreaId: null,
          destinoEquipeId: null,
          destinoCargoId: CARGO,
          destinoCentroCustoId: null,
        }),
      },
      perfilPessoalColaborador: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: "per-1",
          ...data,
          atualizadoEm: AGORA,
        })),
      },
      enderecoColaborador: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: "end-1",
          ...data,
          atualizadoEm: AGORA,
        })),
      },
      contatoColaborador: {
        // T179 — e-mail pessoal livre na empresa.
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: "con-1",
          ...data,
          atualizadoEm: AGORA,
        })),
      },
      dadosPessoaisColaboradorEvento: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          eventosDados.push(data);
          return data;
        }),
      },
      contatoColaboradorEvento: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          eventosContato.push(data);
          return data;
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const registrar = jest.fn(
      (_tx: unknown, _ctx: unknown, evento: Record<string, unknown>) => {
        auditorias.push(evento);
        return Promise.resolve();
      },
    );
    const auditoria = {
      registrarMutacao: jest.fn(
        (_tx: unknown, _ctx: unknown, action: string) => {
          auditorias.push({ action });
          return Promise.resolve();
        },
      ),
      registrarNaTransacao: registrar,
    } as unknown as PessoasAuditoriaService;
    const servico = new ColaboradorService(
      prisma,
      auditoria,
      new DadosPessoaisColaboradorService(prisma, auditoria),
      new ContatoColaboradorService(prisma, auditoria),
    );
    return { servico, tx, prisma, eventosDados, eventosContato, auditorias };
  }

  const ctx = {
    actor: ator("rh", EMPRESA_A),
    metadata: { ip: null, userAgent: null, requestId: "req-1" },
  };

  const corpo = {
    nome: "Pessoa Sintética",
    empresaId: EMPRESA_A,
    matricula: "MAT-T177",
    tipo: "clt",
    dataAdmissao: "2026-10-01",
    motivoCodigo: "admissao_inicial",
    departamentoId: DEPARTAMENTO,
    cargoId: CARGO,
    unidadeOrganizacionalId: UNIDADE,
    perfilPessoal: {
      dataNascimento: "1990-05-20",
      sexo: "Feminino",
      estadoCivil: "Solteira",
      nacionalidade: "Brasileira",
      nomeMae: "Mãe Sintética",
    },
    endereco: {
      pais: "Brasil",
      cep: "30140-071",
      cidade: "Belo Horizonte",
      estado: "MG",
    },
    contatos: {
      emailPessoal: "pessoa.sintetica@exemplo.test",
      celular: "+5531999990000",
      telefone: "+553133330000",
    },
  };

  it("grava tudo numa transação só e devolve o que o servidor gravou", async () => {
    const { servico, prisma, tx } = montar();
    const resposta = await servico.admitir(
      plainToInstance(AdmitirColaboradorDto, corpo),
      ctx,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.perfilPessoalColaborador.create).toHaveBeenCalledTimes(1);
    expect(tx.enderecoColaborador.create).toHaveBeenCalledTimes(1);
    expect(tx.contatoColaborador.create).toHaveBeenCalledTimes(1);
    expect(resposta.perfilPessoal).toMatchObject({
      dataNascimento: "1990-05-20",
      sexo: "Feminino",
      saudacao: null,
      nomeMae: "Mãe Sintética",
    });
    // T179 — com país Brasil, o CEP é gravado nos 8 dígitos.
    expect(resposta.endereco).toMatchObject({
      pais: "Brasil",
      cep: "30140071",
      logradouro: null,
    });
    expect(resposta.contatos).toMatchObject({
      emailPessoal: "pessoa.sintetica@exemplo.test",
    });
  });

  it("os eventos e a trilha carregam só nomes de campos, nunca valores", async () => {
    const { servico, eventosDados, eventosContato, auditorias } = montar();
    await servico.admitir(plainToInstance(AdmitirColaboradorDto, corpo), ctx);
    expect(eventosDados).toEqual([
      expect.objectContaining({
        categoria: "perfil_pessoal",
        acao: "criacao",
        resultado: "gravado",
        campos: [
          "data_nascimento",
          "sexo",
          "estado_civil",
          "nacionalidade",
          "nome_mae",
        ],
      }),
      expect.objectContaining({
        categoria: "endereco",
        acao: "criacao",
        resultado: "gravado",
        campos: ["pais", "cep", "cidade", "estado"],
      }),
    ]);
    expect(eventosContato).toEqual([
      expect.objectContaining({ acao: "criacao", resultado: "gravado" }),
    ]);
    const trilha = JSON.stringify([eventosDados, eventosContato, auditorias]);
    for (const valor of [
      "1990-05-20",
      "Feminino",
      "Mãe Sintética",
      "30140-071",
      "30140071",
      "Belo Horizonte",
      "pessoa.sintetica@exemplo.test",
      "+5531999990000",
      "553133330000",
    ]) {
      expect(trilha).not.toContain(valor);
    }
    expect(auditorias.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        "pessoas_dados_pessoais_criados",
        "pessoas_contato_criado",
      ]),
    );
  });

  it("só o obrigatório: perfil com a data, contatos, e nenhum endereço", async () => {
    const { servico, tx, eventosDados } = montar();
    const resposta = await servico.admitir(
      plainToInstance(AdmitirColaboradorDto, {
        ...corpo,
        perfilPessoal: { dataNascimento: "1990-05-20", sexo: "   " },
        endereco: {},
      }),
      ctx,
    );
    expect(tx.perfilPessoalColaborador.create).toHaveBeenCalledTimes(1);
    expect(tx.enderecoColaborador.create).not.toHaveBeenCalled();
    expect(tx.contatoColaborador.create).toHaveBeenCalledTimes(1);
    expect(eventosDados).toEqual([
      expect.objectContaining({
        categoria: "perfil_pessoal",
        campos: ["data_nascimento"],
      }),
    ]);
    expect(resposta.perfilPessoal).toMatchObject({
      dataNascimento: "1990-05-20",
      sexo: null,
    });
    expect(resposta.endereco).toBeNull();
  });

  it("falha numa gravação do Módulo 1 derruba a transação inteira", async () => {
    const { servico, tx } = montar();
    tx.enderecoColaborador.create.mockImplementationOnce(() => {
      throw new Error("falha simulada");
    });
    await expect(
      servico.admitir(plainToInstance(AdmitirColaboradorDto, corpo), ctx),
    ).rejects.toThrow();
    // O cliente em memória não desfaz nada — quem desfaz é o banco, provado no
    // E2E. Aqui fica provado que o erro sobe de DENTRO da transação.
    expect(tx.contatoColaborador.create).not.toHaveBeenCalled();
  });
});

/**
 * Escopo do `master_tecnico` na leitura e na edição, sobre um cliente em
 * memória: com empresa ativa, só ela; sem empresa ativa, a empresa REAL do
 * vínculo; com vínculo em mais de uma empresa, nada lido nem gravado.
 */
describe("Módulo 1 — escopo de leitura e edição do master_tecnico", () => {
  function montar(vinculos: { empresaId: string; situacao: string }[]) {
    const eventos: Record<string, unknown>[] = [];
    const auditorias: Record<string, unknown>[] = [];
    const filtros: Record<string, unknown>[] = [];
    const tx = {
      perfilPessoalColaborador: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      enderecoColaborador: { findUnique: jest.fn().mockResolvedValue(null) },
      dadosPessoaisColaboradorEvento: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          eventos.push(data);
          return data;
        }),
      },
    };
    const prisma = {
      vinculoFuncional: {
        findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
          filtros.push(where);
          const empresa = where.empresaId as string | undefined;
          return Promise.resolve(
            vinculos.filter((v) => !empresa || v.empresaId === empresa),
          );
        }),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const auditoria = {
      registrarNaTransacao: jest.fn(
        (_tx: unknown, _ctx: unknown, evento: Record<string, unknown>) => {
          auditorias.push(evento);
          return Promise.resolve();
        },
      ),
      negarAcesso: jest.fn(() => Promise.reject(new Error("404"))),
    } as unknown as PessoasAuditoriaService;
    const servico = new DadosPessoaisColaboradorService(prisma, auditoria);
    return { servico, eventos, auditorias, filtros, auditoria };
  }

  const contexto = (companyId: string | null) => ({
    actor: ator("master_tecnico", companyId),
    metadata: { ip: null, userAgent: null, requestId: "req-m" },
  });

  it("sem empresa ativa: lê na empresa REAL do vínculo e audita com ela", async () => {
    const { servico, eventos, auditorias, filtros } = montar([
      { empresaId: EMPRESA_B, situacao: "ativo" },
    ]);
    const r = await servico.consultar("col-1", contexto(null));
    expect(filtros).toEqual([{ colaboradorId: "col-1" }]);
    expect(r).toMatchObject({ empresaId: EMPRESA_B, situacao: "sem_registro" });
    expect(eventos.map((e) => e.empresaId)).toEqual([EMPRESA_B, EMPRESA_B]);
    expect(auditorias.map((a) => a.empresaId)).toEqual([EMPRESA_B, EMPRESA_B]);
  });

  it("com empresa ativa: procura só nela; fora dela, 404 de negação", async () => {
    const { servico, filtros, auditoria } = montar([
      { empresaId: EMPRESA_B, situacao: "ativo" },
    ]);
    await expect(
      servico.consultar("col-1", contexto(EMPRESA_A)),
    ).rejects.toThrow("404");
    expect(filtros).toEqual([{ colaboradorId: "col-1", empresaId: EMPRESA_A }]);
    expect(auditoria.negarAcesso).toHaveBeenCalledWith(
      expect.anything(),
      "dados_pessoais_colaborador",
      "col-1",
      EMPRESA_A,
    );
  });

  it("sem empresa ativa e vínculo em duas empresas: 409, trilha sem empresa e sem valor", async () => {
    const { servico, eventos, auditorias } = montar([
      { empresaId: EMPRESA_A, situacao: "ativo" },
      { empresaId: EMPRESA_B, situacao: "ativo" },
    ]);
    await expect(servico.consultar("col-1", contexto(null))).rejects.toThrow(
      "Conflict",
    );
    expect(eventos).toEqual([
      expect.objectContaining({
        categoria: "perfil_pessoal",
        empresaId: null,
        perfilId: null,
        enderecoId: null,
        acao: "leitura",
        resultado: "empresa_ambigua",
        campos: [],
      }),
      expect.objectContaining({
        categoria: "endereco",
        empresaId: null,
        resultado: "empresa_ambigua",
      }),
    ]);
    expect(auditorias).toEqual([
      expect.objectContaining({
        action: "pessoas_dados_pessoais_consultados",
        empresaId: null,
        result: "failure",
      }),
    ]);
  });

  it("edição ambígua registra só a categoria enviada e não grava nada", async () => {
    const { servico, eventos } = montar([
      { empresaId: EMPRESA_A, situacao: "ativo" },
      { empresaId: EMPRESA_B, situacao: "ativo" },
    ]);
    await expect(
      servico.registrar(
        "col-1",
        plainToInstance(RegistrarDadosPessoaisDto, {
          endereco: { cidade: "Recife" },
        }),
        contexto(null),
      ),
    ).rejects.toThrow("Conflict");
    expect(eventos).toEqual([
      expect.objectContaining({
        categoria: "endereco",
        acao: "edicao",
        resultado: "empresa_ambigua",
      }),
    ]);
  });
});

/**
 * Após o desligamento (todo vínculo na empresa encerrado), o uso operacional é
 * bloqueado — a retenção aprovada: nada é excluído nem anonimizado, os
 * registros vigentes ficam, e nenhum valor é lido nem gravado.
 */
describe("Módulo 1 — vínculo encerrado: uso operacional bloqueado", () => {
  function montar() {
    const eventos: Record<string, unknown>[] = [];
    const auditorias: Record<string, unknown>[] = [];
    const selects: unknown[] = [];
    const tx = {
      perfilPessoalColaborador: {
        findUnique: jest.fn(({ select }: { select: unknown }) => {
          selects.push(select);
          return Promise.resolve({ id: "per-1" });
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      enderecoColaborador: {
        findUnique: jest.fn(({ select }: { select: unknown }) => {
          selects.push(select);
          return Promise.resolve({ id: "end-1" });
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      dadosPessoaisColaboradorEvento: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          eventos.push(data);
          return data;
        }),
      },
    };
    const prisma = {
      vinculoFuncional: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ empresaId: EMPRESA_A, situacao: "encerrado" }]),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const auditoria = {
      registrarNaTransacao: jest.fn(
        (_tx: unknown, _ctx: unknown, evento: Record<string, unknown>) => {
          auditorias.push(evento);
          return Promise.resolve();
        },
      ),
      negarAcesso: jest.fn(() => Promise.reject(new Error("404"))),
    } as unknown as PessoasAuditoriaService;
    return {
      servico: new DadosPessoaisColaboradorService(prisma, auditoria),
      tx,
      eventos,
      auditorias,
      selects,
    };
  }

  const ctx = {
    actor: ator("rh", EMPRESA_A),
    metadata: { ip: null, userAgent: null, requestId: "req-b" },
  };

  it("leitura: bloqueado, sem valor, e só o id dos registros é consultado", async () => {
    const { servico, eventos, auditorias, selects } = montar();
    const r = await servico.consultar("col-1", ctx);
    expect(r).toEqual({
      colaboradorId: "col-1",
      empresaId: EMPRESA_A,
      situacao: "bloqueado",
      perfilPessoal: null,
      endereco: null,
    });
    expect(selects).toEqual([{ id: true }, { id: true }]);
    expect(eventos).toEqual([
      expect.objectContaining({
        categoria: "perfil_pessoal",
        perfilId: "per-1",
        acao: "leitura",
        resultado: "bloqueado",
        campos: [],
      }),
      expect.objectContaining({
        categoria: "endereco",
        enderecoId: "end-1",
        acao: "leitura",
        resultado: "bloqueado",
        campos: [],
      }),
    ]);
    expect(auditorias.map((a) => a.result)).toEqual(["success", "success"]);
  });

  it("edição: 409, nada criado nem alterado, tentativa na trilha como falha", async () => {
    const { servico, tx, eventos, auditorias } = montar();
    await expect(
      servico.registrar(
        "col-1",
        plainToInstance(RegistrarDadosPessoaisDto, {
          perfilPessoal: { dataNascimento: "1990-05-20", curso: "X" },
          endereco: { cidade: "Recife" },
        }),
        ctx,
      ),
    ).rejects.toThrow("Conflict");
    for (const tabela of [
      tx.perfilPessoalColaborador,
      tx.enderecoColaborador,
    ]) {
      expect(tabela.create).not.toHaveBeenCalled();
      expect(tabela.update).not.toHaveBeenCalled();
    }
    expect(eventos.map((e) => [e.categoria, e.acao, e.resultado])).toEqual([
      ["perfil_pessoal", "edicao", "bloqueado"],
      ["endereco", "edicao", "bloqueado"],
    ]);
    expect(auditorias.map((a) => [a.action, a.result])).toEqual([
      ["pessoas_dados_pessoais_atualizados", "failure"],
      ["pessoas_dados_pessoais_atualizados", "failure"],
    ]);
  });
});
