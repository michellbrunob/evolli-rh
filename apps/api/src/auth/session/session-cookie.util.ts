import { Response } from "express";
import { ConfigService } from "@nestjs/config";
import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_COOKIE_NAME,
} from "./session.constants";

/** `Secure` fora de desenvolvimento (spec §4) — nunca desligado em produção/homolog. */
export function isSecureCookieEnvironment(
  configService: ConfigService,
): boolean {
  return configService.get<string>("NODE_ENV") !== "development";
}

export function setSessionCookie(
  res: Response,
  token: string,
  configService: ConfigService,
): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookieEnvironment(configService),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_ABSOLUTE_TTL_MS,
  });
}

export function clearSessionCookie(
  res: Response,
  configService: ConfigService,
): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecureCookieEnvironment(configService),
    sameSite: "lax",
    path: "/",
  });
}
