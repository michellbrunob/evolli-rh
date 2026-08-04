import { Request } from "express";
import { SessionRequestMetadata } from "./session/session.service";

export function extractRequestMetadata(req: Request): SessionRequestMetadata {
  return {
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}
