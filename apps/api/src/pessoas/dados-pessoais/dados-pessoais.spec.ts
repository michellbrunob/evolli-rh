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
 * Prende, sem banco, o que o servidor decide: normalização e limites de cada
 * campo, a matriz de autorização (só `rh` e `dp`, sem a exceção do
 * `master_tecnico`), a gravação na admissão e a regra de que nenhum valor
 * pessoal entra na trilha. A atomicidade e os CHECKs do banco ficam no E2E.
 */

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
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
      sexo: " Feminino ",
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
    expect(dto.sexo).toBe("Feminino");
    expect(dto.naturalidade).toBe("Belo Horizonte");
  });

  it("todos os campos são opcionais", async () => {
    expect(await erros(PerfilPessoalDto, {})).toEqual([]);
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
    expect(
      await erros(PerfilPessoalDto, { saudacao: "x".repeat(41) }),
    ).toContain("saudacao");
    expect(await erros(PerfilPessoalDto, { curso: "a\u0007b" })).toContain(
      "curso",
    );
    expect(
      await erros(PerfilPessoalDto, { nomeMae: "linha\nquebrada" }),
    ).toContain("nomeMae");
  });

  it("recusa campo que não é do Módulo 1 (nome social, gênero, CPF)", async () => {
    for (const campo of ["nomeSocial", "genero", "cpf", "racaEtnia"]) {
      expect(await erros(PerfilPessoalDto, { [campo]: "x" })).toContain(campo);
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
    departamentoId: "33333333-3333-4333-8333-333333333333",
  };

  it("os três blocos são opcionais no contrato (modal transitório)", async () => {
    expect(await erros(AdmitirColaboradorDto, base)).toEqual([]);
  });

  it("valida cada bloco aninhado", async () => {
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        perfilPessoal: { dataNascimento: "2999-01-01" },
      }),
    ).toContain("perfilPessoal");
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        endereco: { cep: "?" },
      }),
    ).toContain("endereco");
  });

  it("contatos seguem a ficha da T169: os três juntos e normalizados", async () => {
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        contatos: { emailPessoal: "a@b.test", celular: "11999990000" },
      }),
    ).toContain("contatos");

    const dto = plainToInstance(AdmitirColaboradorDto, {
      ...base,
      contatos: {
        emailPessoal: " Pessoa@Exemplo.TEST ",
        celular: "+55 (11) 99999-0000",
        telefone: "11 3333-0000",
      },
    });
    expect(await validate(dto, OPCOES)).toEqual([]);
    expect(dto.contatos).toEqual({
      emailPessoal: "pessoa@exemplo.test",
      celular: "+5511999990000",
      telefone: "1133330000",
    });
  });

  it("recusa empresa no bloco de dados pessoais", async () => {
    expect(
      await erros(AdmitirColaboradorDto, {
        ...base,
        endereco: { empresaId: EMPRESA_A },
      }),
    ).toContain("endereco");
  });
});

describe("Módulo 1 — RegistrarDadosPessoaisDto", () => {
  it("cada bloco é validado", async () => {
    expect(
      await erros(RegistrarDadosPessoaisDto, {
        perfilPessoal: { sexo: "x".repeat(61) },
      }),
    ).toContain("perfilPessoal");
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

  it.each([
    ["master_tecnico", null],
    ["master_tecnico", EMPRESA_A],
    ["gestor", EMPRESA_A],
    ["colaborador", EMPRESA_A],
    ["financeiro", EMPRESA_A],
    ["admin_tecnico", null],
    ["auditor", EMPRESA_A],
    ["dpo", EMPRESA_A],
  ] as const)(
    "%s (empresa %s) não lê nem edita — a exceção do master_tecnico é só de contatos",
    (role, companyId) => {
      expect(pode(role, "read", companyId)).toBe(false);
      expect(pode(role, "alter", companyId)).toBe(false);
    },
  );

  it("a exceção do master_tecnico em contatos continua como estava", () => {
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

  function montar() {
    const eventosDados: Record<string, unknown>[] = [];
    const eventosContato: Record<string, unknown>[] = [];
    const auditorias: Record<string, unknown>[] = [];
    const tx = {
      departamento: { count: jest.fn().mockResolvedValue(1) },
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
          destinoUnidadeOrganizacionalId: null,
          destinoDepartamentoId: DEPARTAMENTO,
          destinoAreaId: null,
          destinoEquipeId: null,
          destinoCargoId: null,
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
      telefone: "3133330000",
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
    expect(resposta.endereco).toMatchObject({
      pais: "Brasil",
      cep: "30140-071",
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
      "Belo Horizonte",
      "pessoa.sintetica@exemplo.test",
      "+5531999990000",
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

  it("bloco sem nenhum valor não cria registro nem evento", async () => {
    const { servico, tx, eventosDados } = montar();
    const resposta = await servico.admitir(
      plainToInstance(AdmitirColaboradorDto, {
        ...corpo,
        perfilPessoal: { sexo: "   " },
        endereco: {},
      }),
      ctx,
    );
    expect(tx.perfilPessoalColaborador.create).not.toHaveBeenCalled();
    expect(tx.enderecoColaborador.create).not.toHaveBeenCalled();
    expect(eventosDados).toEqual([]);
    expect(resposta.perfilPessoal).toBeNull();
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
