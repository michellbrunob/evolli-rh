import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpStatus,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ConflitoDeCamposException,
  ErroDeCampo,
  RecusaDeNegocioException,
} from "../erros/recusa-por-campo";
import { AllExceptionsFilter } from "./http-exception.filter";

function createHost(req: unknown, res: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
}

describe("AllExceptionsFilter", () => {
  it("nunca expõe a mensagem interna da exceção, apenas mensagem pública fixa por status", () => {
    const filter = new AllExceptionsFilter();
    const req = { requestId: "req-teste-1" };
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const res = { status: statusMock };

    const sensitiveDetail =
      "SELECT senha FROM usuarios WHERE cpf = 12345678900 -- falha em /app/src/internal/query.ts:42";
    const exception = new BadRequestException(sensitiveDetail);

    filter.catch(exception, createHost(req, res));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = jsonMock.mock.calls[0][0];

    expect(body).toEqual({
      status_code: HttpStatus.BAD_REQUEST,
      message: "Requisição inválida.",
      request_id: "req-teste-1",
      timestamp: expect.any(String),
    });

    const bodyAsText = JSON.stringify(body);
    expect(bodyAsText).not.toContain("senha");
    expect(bodyAsText).not.toContain("cpf");
    expect(bodyAsText).not.toContain("/app/src");
    expect(bodyAsText).not.toContain(sensitiveDetail);
  });

  /**
   * T161 — o filtro passa a dizer QUAL invariante quebrou.
   *
   * Este e o unico logger que escreve na CI: o E2E roda com
   * `LOG_LEVEL=silent`, que cala o `PinoLogger` dos services. Em `0db3d70` a
   * unica pista foi `errorName`, e ela nao bastava.
   */
  describe("diagnostico de erro de banco no log", () => {
    function capturar(exception: unknown) {
      const filter = new AllExceptionsFilter();
      const registros: Record<string, unknown>[] = [];
      const espiao = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation((registro: unknown) => {
          registros.push(registro as Record<string, unknown>);
        });

      const jsonMock = jest.fn();
      const res = { status: jest.fn().mockReturnValue({ json: jsonMock }) };
      filter.catch(
        exception,
        createHost({ requestId: "req-t161" }, res) as ArgumentsHost,
      );
      espiao.mockRestore();

      return { registros, corpo: jsonMock.mock.calls[0][0] };
    }

    const EXCLUSION =
      "Invalid `prisma.atribuicaoGestorEquipe.create()` invocation: " +
      'PostgresError { code: "23P01", message: "conflicting key value ' +
      "violates exclusion constraint " +
      '\\"atribuicao_gestor_equipe_sem_sobreposicao\\"", ' +
      'detail: Some("Key (equipe_id)=(EQP-SEGREDO-42)") }';

    it("registra classe, SQLSTATE e constraint de um erro de banco", () => {
      const { registros } = capturar(
        new Prisma.PrismaClientUnknownRequestError(EXCLUSION, {
          clientVersion: "5.22.0",
        }),
      );

      expect(registros).toHaveLength(1);
      expect(registros[0]).toMatchObject({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorName: "PrismaClientUnknownRequestError",
        classe: "PrismaClientUnknownRequestError",
        sqlstate: "23P01",
        constraint: "atribuicao_gestor_equipe_sem_sobreposicao",
      });
    });

    it("registra o codigo do Prisma quando o erro e tipificado", () => {
      const { registros } = capturar(
        new Prisma.PrismaClientKnownRequestError("write conflict", {
          code: "P2034",
          clientVersion: "5.22.0",
        }),
      );
      expect(registros[0]).toMatchObject({ prismaCode: "P2034" });
    });

    it("o log NAO carrega mensagem do banco, DETAIL nem valores enviados", () => {
      const { registros } = capturar(
        new Prisma.PrismaClientUnknownRequestError(EXCLUSION, {
          clientVersion: "5.22.0",
        }),
      );
      const registrado = JSON.stringify(registros[0]);
      expect(registrado).not.toContain("EQP-SEGREDO-42");
      expect(registrado).not.toContain("conflicting key value");
      expect(registrado).not.toMatch(/detail/i);
      expect(registrado).not.toContain("prisma.atribuicaoGestorEquipe");
    });

    it("a RESPOSTA continua sem citar Prisma, SQLSTATE ou constraint", () => {
      const { corpo } = capturar(
        new Prisma.PrismaClientUnknownRequestError(EXCLUSION, {
          clientVersion: "5.22.0",
        }),
      );
      const texto = JSON.stringify(corpo);
      expect(texto).not.toMatch(/prisma|postgres|23P01|sqlstate|constraint/i);
      expect(corpo).toMatchObject({
        status_code: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it("erro comum nao inventa campos de banco", () => {
      const { registros } = capturar(new Error("algo quebrou"));
      expect(registros[0]).toMatchObject({ classe: "Error" });
      expect(registros[0]).not.toHaveProperty("sqlstate");
      expect(registros[0]).not.toHaveProperty("constraint");
      expect(registros[0]).not.toHaveProperty("prismaCode");
    });
  });

  /**
   * T179 — erro por campo e código de recusa (`DP-ADM-15`): o corpo ganha
   * `erros` só no 409 de campos e `codigo` só na recusa de negócio, sempre com
   * o que a aplicação montou, nunca com o valor enviado.
   */
  describe("T179 — erros por campo e código de recusa", () => {
    function corpoDe(exception: unknown) {
      const filter = new AllExceptionsFilter();
      const jsonMock = jest.fn();
      const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
      filter.catch(
        exception,
        createHost({ requestId: "req-t179" }, { status: statusMock }),
      );
      return {
        status: statusMock.mock.calls[0][0] as number,
        corpo: jsonMock.mock.calls[0][0] as Record<string, unknown>,
      };
    }

    it("409 de campos: mensagem pública fixa e a lista de campos, sem código", () => {
      const { status, corpo } = corpoDe(
        new ConflitoDeCamposException([
          { campo: "matricula", motivo: "em_uso" },
          { campo: "contatos.emailPessoal", motivo: "em_uso" },
        ]),
      );
      expect(status).toBe(HttpStatus.CONFLICT);
      expect(corpo).toEqual({
        status_code: HttpStatus.CONFLICT,
        message: "Conflito ao processar a requisição.",
        request_id: "req-t179",
        timestamp: expect.any(String),
        erros: [
          { campo: "matricula", motivo: "em_uso" },
          { campo: "contatos.emailPessoal", motivo: "em_uso" },
        ],
      });
      expect(corpo).not.toHaveProperty("codigo");
    });

    it("409 de campos nunca carrega o valor, nem que alguém o anexe ao erro", () => {
      // O tipo impede; aqui a defesa é provada em tempo de execução: o filtro
      // copia só `campo` e `motivo`.
      const comValor = {
        campo: "matricula",
        motivo: "em_uso",
        valor: "MAT-SEGREDO-179",
      } as unknown as ErroDeCampo;
      const { corpo } = corpoDe(new ConflitoDeCamposException([comValor]));
      expect(corpo["erros"]).toEqual([
        { campo: "matricula", motivo: "em_uso" },
      ]);
      expect(JSON.stringify(corpo)).not.toContain("MAT-SEGREDO-179");
    });

    it("422 de negócio: o código estável, sem lista de campos", () => {
      const { status, corpo } = corpoDe(
        new RecusaDeNegocioException("idempotencia_conteudo_divergente"),
      );
      expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(corpo).toEqual({
        status_code: HttpStatus.UNPROCESSABLE_ENTITY,
        message: "Dados inválidos.",
        request_id: "req-t179",
        timestamp: expect.any(String),
        codigo: "idempotencia_conteudo_divergente",
      });
      expect(corpo).not.toHaveProperty("erros");
    });

    it.each([
      ["409 comum", new ConflictException("matricula MAT-SEGREDO-179 em uso")],
      [
        "422 comum",
        new UnprocessableEntityException("pessoa.segredo@example.test"),
      ],
      ["400 comum", new BadRequestException("+5511987654321")],
    ])(
      "%s: nem erros, nem código, nem a mensagem da exceção",
      (_caso, erro) => {
        const { corpo } = corpoDe(erro);
        expect(corpo).not.toHaveProperty("erros");
        expect(corpo).not.toHaveProperty("codigo");
        const texto = JSON.stringify(corpo);
        expect(texto).not.toContain("SEGREDO");
        expect(texto).not.toContain("example.test");
        expect(texto).not.toContain("5511987654321");
      },
    );
  });
});
