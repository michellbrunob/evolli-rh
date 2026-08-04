import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import "./session-request.types";
import { SessionService } from "./session.service";
import { SESSION_COOKIE_NAME } from "./session.constants";

/**
 * Exige sessão válida. Mensagem de erro sempre genérica via
 * UnauthorizedException (mapeada para "Não autorizado." pelo
 * AllExceptionsFilter) — nunca revela se o cookie estava ausente, expirado
 * ou revogado.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    if (!token) {
      throw new UnauthorizedException();
    }

    const validated = await this.sessionService.validateAndTouch(token);
    if (!validated) {
      throw new UnauthorizedException();
    }

    request.authUser = validated.user;
    request.authSession = validated.session;
    return true;
  }
}
