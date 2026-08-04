import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  APP_VERSION: z.string().min(1).default("0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  // Timeout do SELECT 1 de prontidão em GET /v1/health/ready. Não é a
  // MIGRATE_DATABASE_URL (essa é lida só pelo Prisma CLI, a partir de
  // apps/api/.env.migrate, exclusivamente pelo subprocesso de migration —
  // nunca pela aplicação em runtime, por isso não entra neste schema).
  DB_READY_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  // Chave de cifragem do segredo MFA (AES-256-GCM) — obrigatória, Base64 de
  // 32 bytes exatos, nunca versionada (ADR 0003 §7). Falha rápido e sem
  // revelar o valor se ausente/malformada.
  MFA_ENCRYPTION_KEY: z
    .string()
    .min(1, "MFA_ENCRYPTION_KEY é obrigatório")
    .refine(isValidBase64Key32Bytes, {
      message: "MFA_ENCRYPTION_KEY deve ser Base64 de exatamente 32 bytes",
    }),
});

function isValidBase64Key32Bytes(value: string): boolean {
  try {
    const decoded = Buffer.from(value, "base64");
    // Buffer.from silenciosamente ignora caractere inválido de base64 em vez
    // de lançar — reencoda e compara para garantir que é base64 legítimo.
    return (
      decoded.length === 32 && Buffer.from(decoded).toString("base64") === value
    );
  } catch {
    return false;
  }
}

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  // Correção de segurança P1: MIGRATE_DATABASE_URL é a credencial de DDL
  // (evolli_migrator). Se ela existir no processo da API, uma exploração da
  // API poderia lê-la e quebrar a segregação de privilégio da ADR 0002.
  // Bootstrap falha aqui, sem nunca logar/incluir o valor da variável.
  if (
    typeof config.MIGRATE_DATABASE_URL === "string" &&
    config.MIGRATE_DATABASE_URL.length > 0
  ) {
    throw new Error(
      "Configuração de ambiente inválida: MIGRATE_DATABASE_URL não pode estar " +
        "presente no processo da API — é a credencial de migration (DDL), de " +
        "uso exclusivo do pipeline/operador de migration.",
    );
  }

  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Configuração de ambiente inválida: ${issues}`);
  }

  return result.data;
}
