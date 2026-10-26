import { ForbiddenException } from "@nestjs/common";
import { AccessRole, AccessUser, MotivoMovimentacao } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { evaluatePermission } from "../auth/authorization/rbac.evaluator";
import { AdmitirColaboradorDto, MOTIVOS_ADMISSAO } from "./dto/pessoas.dto";
import { resolverEscopoPessoas } from "./escopo-pessoas.util";
import { PrismaService } from "../database/prisma.service";
import { PessoasAuditoriaService } from "./pessoas-auditoria.service";
import { ColaboradorService } from "./colaborador/colaborador.service";
import { DadosPessoaisColaboradorService } from "./dados-pessoais/dados-pessoais.service";
import { ContatoColaboradorService } from "./contatos/contato-colaborador.service";

/**
 * T167 — admissão mínima segura.
 *
 * Duas garantias que antes só tinham cobertura indireta:
 *  - a SEGUNDA camada de recusa da admissão, `resolverEscopoPessoas`, não
 *    tinha teste unitário próprio (achado da T166, diagnóstico §4);
 *  - o contrato aceitava em `motivoCodigo` motivos que pressupõem um vínculo
 *    que ainda não existe, como `encerramento_de_vinculo`.
 */

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";

function ator(role: AccessRole, companyId: string | null): AccessUser {
  return { id: `ator-${role}`, role, companyId } as unknown as AccessUser;
}

describe("Admissão — quem pode admitir (duas camadas)", () => {
  describe("resolverEscopoPessoas (camada do serviço)", () => {
    it.each(["rh", "dp"] as const)(
      "%s com empresa recebe o escopo da SESSÃO",
      (role) => {
        expect(resolverEscopoPessoas(ator(role, EMPRESA_A))).toEqual({
          empresaId: EMPRESA_A,
        });
      },
    );

    it.each(["rh", "dp"] as const)(
      "%s sem empresa é recusado — ausência de escopo nunca vira 'sem filtro'",
      (role) => {
        expect(() => resolverEscopoPessoas(ator(role, null))).toThrow(
          ForbiddenException,
        );
      },
    );

    it.each([
      ["master_tecnico", null],
      ["master_tecnico", EMPRESA_A],
      ["admin_tecnico", null],
      ["gestor", EMPRESA_A],
      ["colaborador", EMPRESA_A],
      ["financeiro", EMPRESA_A],
      ["auditor", EMPRESA_A],
      ["dpo", EMPRESA_A],
    ] as const)("%s (empresa %s) é recusado", (role, companyId) => {
      expect(() => resolverEscopoPessoas(ator(role, companyId))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe("avaliador RBAC (camada do guard): colaborador/create", () => {
    function pode(role: AccessRole, companyId: string | null) {
      return evaluatePermission(
        { userId: `u-${role}`, role, companyId },
        { resource: "colaborador", action: "create" },
      );
    }

    it.each(["rh", "dp"] as const)("concede a %s", (role) => {
      expect(pode(role, EMPRESA_A)).toBe(true);
    });

    it.each([
      ["master_tecnico", null],
      ["master_tecnico", EMPRESA_A],
      ["gestor", EMPRESA_A],
      ["colaborador", EMPRESA_A],
      ["admin_tecnico", null],
    ] as const)("nega a %s (empresa %s)", (role, companyId) => {
      expect(pode(role, companyId)).toBe(false);
    });
  });
});

describe("Admissão — motivoCodigo só aceita motivo de primeira admissão", () => {
  function dto(motivoCodigo: string) {
    return plainToInstance(AdmitirColaboradorDto, {
      nome: "Pessoa Sintetica",
      empresaId: EMPRESA_A,
      matricula: "MAT-T167",
      tipo: "clt",
      dataAdmissao: "2026-10-01",
      motivoCodigo,
      // T179 — a lotação da Nova admissão exige os três.
      departamentoId: "33333333-3333-4333-8333-333333333333",
      cargoId: "55555555-5555-4555-8555-555555555555",
      unidadeOrganizacionalId: "66666666-6666-4666-8666-666666666666",
    });
  }

  async function errosDoMotivo(motivoCodigo: string) {
    const erros = await validate(dto(motivoCodigo));
    return erros.filter((e) => e.property === "motivoCodigo");
  }

  it.each(MOTIVOS_ADMISSAO)("aceita %s", async (motivo) => {
    expect(await errosDoMotivo(motivo)).toHaveLength(0);
  });

  const INCOMPATIVEIS: readonly MotivoMovimentacao[] = [
    "reestruturacao_organizacional",
    "realocacao_interna",
    "promocao",
    "correcao_cadastral",
    "encerramento_de_vinculo",
  ];

  it.each(INCOMPATIVEIS)(
    "recusa %s — pressupõe um vínculo que ainda não existe",
    async (motivo) => {
      expect(await errosDoMotivo(motivo)).toHaveLength(1);
    },
  );

  it("recusa texto livre fora do catálogo", async () => {
    expect(await errosDoMotivo("demissao por justa causa")).toHaveLength(1);
  });

  it("os dois conjuntos cobrem o catálogo inteiro, sem sobreposição", () => {
    const todos: readonly MotivoMovimentacao[] =
      Object.values(MotivoMovimentacao);
    const aceitos: readonly string[] = MOTIVOS_ADMISSAO;
    expect([...aceitos, ...INCOMPATIVEIS].sort()).toEqual([...todos].sort());
    expect(aceitos.filter((m) => INCOMPATIVEIS.includes(m as never))).toEqual(
      [],
    );
  });
});

describe("Admissão — a resposta é projeção explícita, campo a campo", () => {
  const DEPARTAMENTO = "33333333-3333-4333-8333-333333333333";
  const CARGO = "55555555-5555-4555-8555-555555555555";
  const UNIDADE = "66666666-6666-4666-8666-666666666666";
  const AGORA = new Date("2026-10-01T12:00:00.000Z");

  /**
   * Cada entidade devolvida pelo Prisma traz uma coluna que NÃO existe hoje.
   * Se a resposta espalhasse a entidade em vez de escolher os campos, essa
   * coluna futura sairia junto — sem decisão, sem ficha, sem revisão.
   */
  function servico() {
    const tx = {
      departamento: { count: jest.fn().mockResolvedValue(1) },
      cargo: { count: jest.fn().mockResolvedValue(1) },
      unidadeOrganizacional: { count: jest.fn().mockResolvedValue(1) },
      colaborador: {
        create: jest.fn().mockResolvedValue({
          id: "col-1",
          nome: "Pessoa Sintetica",
          situacao: "inativo",
          criadoEm: AGORA,
          atualizadoEm: AGORA,
          colunaFutura: "NAO_PODE_VAZAR",
        }),
      },
      vinculoFuncional: {
        // T179 — matrícula livre na empresa.
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: "vin-1",
          colaboradorId: "col-1",
          empresaId: EMPRESA_A,
          matricula: "MAT-T167",
          tipo: "clt",
          situacao: "previsto",
          dataAdmissao: AGORA,
          dataDesligamento: null,
          criadoEm: AGORA,
          atualizadoEm: AGORA,
          colunaFutura: "NAO_PODE_VAZAR",
        }),
      },
      movimentacaoFuncional: {
        create: jest.fn().mockResolvedValue({
          id: "mov-1",
          tipo: "admissao",
          status: "solicitada",
          vigenciaInicio: AGORA,
          solicitanteUserId: "ator-rh",
          destinoUnidadeOrganizacionalId: UNIDADE,
          destinoDepartamentoId: DEPARTAMENTO,
          destinoAreaId: null,
          destinoEquipeId: null,
          destinoCargoId: CARGO,
          destinoCentroCustoId: null,
          colunaFutura: "NAO_PODE_VAZAR",
        }),
      },
      perfilPessoalColaborador: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: "per-1",
          ...data,
          atualizadoEm: AGORA,
          colunaFutura: "NAO_PODE_VAZAR",
        })),
      },
      contatoColaborador: {
        // T179 — e-mail pessoal livre na empresa.
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: "con-1",
          ...data,
          atualizadoEm: AGORA,
          colunaFutura: "NAO_PODE_VAZAR",
        })),
      },
      dadosPessoaisColaboradorEvento: { create: jest.fn() },
      contatoColaboradorEvento: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    } as unknown as PrismaService;
    const auditoria = {
      registrarMutacao: jest.fn().mockResolvedValue(undefined),
      registrarNaTransacao: jest.fn().mockResolvedValue(undefined),
    } as unknown as PessoasAuditoriaService;
    return new ColaboradorService(
      prisma,
      auditoria,
      new DadosPessoaisColaboradorService(prisma, auditoria),
      new ContatoColaboradorService(prisma, auditoria),
    );
  }

  it("devolve exatamente os campos escolhidos, e nenhuma coluna futura", async () => {
    const resposta = await servico().admitir(
      plainToInstance(AdmitirColaboradorDto, {
        nome: "Pessoa Sintetica",
        empresaId: EMPRESA_A,
        matricula: "MAT-T167",
        tipo: "clt",
        dataAdmissao: "2026-10-01",
        motivoCodigo: "admissao_inicial",
        departamentoId: DEPARTAMENTO,
        cargoId: CARGO,
        unidadeOrganizacionalId: UNIDADE,
        perfilPessoal: { dataNascimento: "1990-05-20" },
        contatos: {
          emailPessoal: "pessoa@exemplo.test",
          celular: "+5511999990000",
          telefone: "+551133330000",
        },
      }),
      {
        actor: ator("rh", EMPRESA_A),
        metadata: { ip: null, userAgent: null, requestId: "req-1" },
      },
    );

    expect(Object.keys(resposta).sort()).toEqual(
      [
        "atualizadoEm",
        "contatos",
        "criadoEm",
        "endereco",
        "id",
        "jornada",
        "movimentacao",
        "nome",
        "perfilPessoal",
        "situacao",
        "vinculo",
      ].sort(),
    );
    expect(Object.keys(resposta.vinculo).sort()).toEqual(
      [
        "dataAdmissao",
        "empresaId",
        "id",
        "matricula",
        "situacao",
        "tipo",
      ].sort(),
    );
    expect(Object.keys(resposta.movimentacao).sort()).toEqual(
      ["destino", "id", "status", "tipo", "vigenciaInicio"].sort(),
    );
    expect(JSON.stringify(resposta)).not.toContain("NAO_PODE_VAZAR");
    expect(resposta).toMatchObject({
      id: "col-1",
      nome: "Pessoa Sintetica",
      situacao: "inativo",
      vinculo: { id: "vin-1", matricula: "MAT-T167", situacao: "previsto" },
      movimentacao: { id: "mov-1", tipo: "admissao" },
      // T177 — perfil e contatos são obrigatórios; sem endereço, nada é
      // gravado nem inventado.
      perfilPessoal: { dataNascimento: "1990-05-20", sexo: null },
      endereco: null,
      contatos: { emailPessoal: "pessoa@exemplo.test" },
    });
    expect(Object.keys(resposta.perfilPessoal).sort()).toEqual(
      [
        "atualizadoEm",
        "curso",
        "dataNascimento",
        "escolaridade",
        "estadoCivil",
        "nacionalidade",
        "naturalidade",
        "nomeMae",
        "nomePai",
        "saudacao",
        "sexo",
      ].sort(),
    );
  });
});
