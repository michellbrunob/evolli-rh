import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import "../session/session-request.types";
import { hashOpaqueToken } from "../crypto/opaque-token.util";
import { CSRF_HEADER_NAME } from "./csrf.constants";
// T179 — 403 com `codigo: "csrf_invalido"`, para a tela separar sessão
// vencida de falta de permissão.
import { RecusaCsrfException } from "../../common/erros/recusa-por-campo";
import { timingSafeEqual } from "node:crypto";

/**
 * Synchronizer token vinculado à sessão (ADR 0003 §6) — exige que
 * `SessionGuard` já tenha rodado antes (mesma requisição precisa de
 * `request.authSession` populado). `SameSite` do cookie é defesa adicional,
 * não substitui este guard.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const session = request.authSession;

    if (!session) {
      // SessionGuard deveria ter rodado antes; sem sessão não há CSRF token
      // de referência — nega por padrão.
      throw new RecusaCsrfException();
    }

    const provided = request.header(CSRF_HEADER_NAME);
    if (!provided) {
      throw new RecusaCsrfException();
    }

    const providedHash = hashOpaqueToken(provided);
    if (!this.safeEqual(providedHash, session.csrfTokenHash)) {
      throw new RecusaCsrfException();
    }

    return true;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
