/**
 * Serviço do contexto empresarial ativo (T163).
 *
 * Responde a duas perguntas e executa um ato:
 *
 * - **quais empresas esta conta pode usar?** — `listar`
 * - **onde ela está agora?** — resolvido no `SessionGuard`, não aqui
 * - **mudar para aquela ali** — `trocar`, que valida, grava e audita
 *
 * A política mora em `session/contexto-empresarial.ts`; este serviço é a
 * camada de aplicação em volta dela: autorização de papel, anti-enumeração e
 * trilha de auditoria.
 */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AccessUser } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SessionRequestMetadata } from "./session/session.service";
import {
  EmpresaAutorizada,
  empresaEstaAutorizada,
  listarEmpresasAutorizadas,
  papelSelecionaEmpresa,
} from "./session/contexto-empresarial";

export interface ContextoAuditContext {
  readonly actor: AccessUser;
  readonly metadata: SessionRequestMetadata;
  readonly requestId: string;
}

@Injectable()
export class ContextoEmpresarialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * As empresas que o ator pode escolher.
   *
   * **Papel sem poder de seleção recebe 403, não lista vazia.** A diferença
   * importa: lista vazia diria "você pode escolher, mas não há nada", o que é
   * falso e convidaria o frontend a desenhar um seletor inútil. O princípio
   * 10 — não expor empresas autorizadas a quem não seleciona — é cumprido
   * aqui, no servidor, e não pela interface lembrar de esconder.
   */
  async listar(actor: AccessUser): Promise<EmpresaAutorizada[]> {
    if (!papelSelecionaEmpresa(actor.role)) {
      throw new ForbiddenException();
    }
    return listarEmpresasAutorizadas(this.prisma, {
      id: actor.id,
      role: actor.role,
      // IMPORTANTE: a empresa da CONTA, não a ativa. A lista de opções não
      // pode depender de onde a pessoa está no momento, senão trocar para a
      // empresa B apagaria a empresa A das opções e prenderia a sessão lá.
      companyId: this.contaEmpresaId(actor),
    });
  }

  /**
   * Troca o contexto ativo da sessão.
   *
   * Três recusas, nesta ordem, e cada uma com o código que não entrega
   * informação a mais:
   *
   * 1. papel que não seleciona → **403**. Não é segredo que o papel não troca
   *    de empresa; é a regra do produto, e esconder isso não protege nada.
   * 2. empresa inexistente, inativa ou não autorizada → **404**, todas iguais.
   *    403 aqui confirmaria que a empresa existe — exatamente a enumeração que
   *    o produto evita desde a T030 (`carregarNoEscopo`).
   * 3. tudo certo → grava na sessão e audita.
   */
  async trocar(
    sessionId: string,
    empresaId: string,
    ctx: ContextoAuditContext,
  ): Promise<EmpresaAutorizada> {
    const { actor } = ctx;

    if (!papelSelecionaEmpresa(actor.role)) {
      // Vale também para requisição forjada: gestor/colaborador param aqui
      // mesmo chamando a rota direto, com cookie e CSRF válidos.
      throw new ForbiddenException();
    }

    const identidadeDaConta = {
      id: actor.id,
      role: actor.role,
      companyId: this.contaEmpresaId(actor),
    };

    const autorizada = await empresaEstaAutorizada(
      this.prisma,
      identidadeDaConta,
      empresaId,
    );
    if (!autorizada) {
      throw new NotFoundException();
    }

    const empresa = await this.prisma.empresa.findFirst({
      where: { id: empresaId, status: "ativo" },
      select: { id: true, codigo: true, nome: true },
    });
    if (empresa === null) {
      // Corrida: a empresa saiu do ar entre a checagem e agora.
      throw new NotFoundException();
    }

    // A gravação e o evento na MESMA transação (ADR 0004 §2): ou a sessão
    // muda de contexto e isso fica registrado, ou nada acontece.
    await this.prisma.$transaction(async (tx) => {
      await tx.accessSession.update({
        where: { id: sessionId },
        data: { empresaAtivaId: empresa.id },
      });

      await this.auditService.record(
        {
          actorType: "user",
          actorUserId: actor.id,
          actorRole: actor.role,
          // Onde a ação PASSA a valer. O evento responde "a partir daqui, esta
          // sessão opera na empresa X".
          companyId: empresa.id,
          action: "acesso_contexto_empresa_trocado",
          resource: "access_session",
          resourceId: sessionId,
          ip: ctx.metadata.ip,
          userAgent: ctx.metadata.userAgent,
          result: "success",
          requestId: ctx.requestId,
        },
        tx,
      );
    });

    return empresa;
  }

  /**
   * A empresa da CONTA, por baixo da resolução de contexto.
   *
   * O ator que chega aqui já teve `companyId` substituído pela empresa ativa
   * (ver `aplicarContextoAoAtor`). Para decidir o que a conta pode escolher,
   * é a empresa da conta que vale — então o campo original é recuperado de
   * `contaEmpresaId` quando ele existe.
   */
  private contaEmpresaId(actor: AccessUser): string | null {
    const comContexto = actor as AccessUser & {
      contaEmpresaId?: string | null;
    };
    return comContexto.contaEmpresaId !== undefined
      ? comContexto.contaEmpresaId
      : actor.companyId;
  }
}
