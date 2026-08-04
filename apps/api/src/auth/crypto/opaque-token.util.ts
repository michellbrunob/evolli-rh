import { createHash, randomBytes } from "node:crypto";

/**
 * Tokens opacos de alta entropia (sessão, reset de senha, CSRF) usam
 * SHA-256 para o `*_hash` persistido — não Argon2id. São 256 bits de
 * aleatoriedade gerados pelo servidor, não segredo escolhido por humano;
 * um ataque de força bruta offline contra um hash rápido já é inviável
 * nesse espaço de busca, e o hash rápido permite consulta indexada exata
 * no banco (Argon2id, com salt único por chamada, não permite lookup por
 * igualdade). Senha e código de recuperação — que têm entropia muito menor
 * e são escolhidos/memorizados por humano — usam Argon2id (ver
 * password-hash.service.ts).
 */

const TOKEN_BYTES = 32; // 256 bits

export function generateOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
