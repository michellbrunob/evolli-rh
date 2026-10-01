/**
 * Comando exclusivo de bootstrap do primeiro administrador técnico.
 *
 * NÃO é um endpoint HTTP — não há cadastro público de admin_tecnico em
 * nenhuma rota. Uso:
 *
 *   ADMIN_BOOTSTRAP_EMAIL=admin@empresa.example \
 *   ADMIN_BOOTSTRAP_PASSWORD='uma-passphrase-de-pelo-menos-15-caracteres' \
 *   node dist/bootstrap/bootstrap-admin.js
 *
 * As duas variáveis só podem existir no ambiente do processo que roda este
 * comando (shell/pipeline de bootstrap) — nunca em apps/api/.env ou
 * qualquer outro arquivo versionado/persistido. Por isso são lidas de
 * `process.env` ANTES de qualquer inicialização do Nest/ConfigModule (que
 * carregaria .env via dotenv) — se estivessem só no .env, ainda não
 * existiriam em process.env neste ponto, e o comando falha pedindo para
 * exportá-las no shell.
 *
 * Falha (sem imprimir a senha em nenhuma hipótese) se:
 *  - as variáveis não estiverem no ambiente do processo;
 *  - a senha não atender à política mínima (§4);
 *  - já existir um usuário com papel admin_tecnico no banco.
 *
 * CÓDIGOS DE SAÍDA (contrato para quem automatiza):
 *
 *   0  administrador técnico criado agora;
 *   3  JÁ EXISTE um administrador técnico — recusa esperada, não é defeito;
 *   1  qualquer outra falha (variável ausente, senha fraca, banco fora).
 *
 * O código 3 existe para que um orquestrador distinga "já provisionado" de
 * "quebrou" sem casar texto de mensagem em português. Ele NÃO enfraquece o
 * bootstrap: a recusa continua acontecendo, a saída continua diferente de
 * zero e nada é sobrescrito.
 */

/** Ver "CÓDIGOS DE SAÍDA" no cabeçalho. Mantido em sincronia com o
 * orquestrador do ambiente local (`scripts/demo-local.core.mjs`). */
const CODIGO_SAIDA_ADMIN_JA_EXISTE = 3;

/** Recusa esperada, distinta de falha real — carrega o código de saída. */
class AdminJaExisteError extends Error {}

const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

async function main(): Promise<void> {
  if (!email || !password) {
    throw new Error(
      "ADMIN_BOOTSTRAP_EMAIL e ADMIN_BOOTSTRAP_PASSWORD precisam estar " +
        "definidas no ambiente deste processo (nunca em arquivo .env).",
    );
  }

  // Imports adiados: só depois de capturar as variáveis acima, para que
  // nenhuma inicialização do Nest/dotenv aconteça antes da checagem.
  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("../app.module");
  const { PrismaService } = await import("../database/prisma.service");
  const { PasswordHashService } =
    await import("../auth/password/password-hash.service");
  const { PasswordPolicyService } =
    await import("../auth/password/password-policy.service");
  const { normalizeEmail } = await import("../auth/normalize-email.util");

  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const prisma = appContext.get(PrismaService);
    const passwordHashService = appContext.get(PasswordHashService);
    const passwordPolicyService = appContext.get(PasswordPolicyService);

    if (!passwordPolicyService.isValid(password)) {
      throw new Error(
        "A senha informada não atende à política mínima (15+ caracteres, " +
          "sem estar na lista de senhas comuns/vazadas).",
      );
    }

    const existingAdmin = await prisma.accessUser.findFirst({
      where: { role: "admin_tecnico" },
      select: { id: true },
    });

    if (existingAdmin) {
      throw new AdminJaExisteError(
        "Já existe um administrador técnico cadastrado — bootstrap não " +
          "pode ser executado novamente.",
      );
    }

    const passwordHash = await passwordHashService.hash(password);

    await prisma.accessUser.create({
      data: {
        email: normalizeEmail(email),
        passwordHash,
        role: "admin_tecnico",
        companyId: null,
        unitId: null,
        teamId: null,
      },
    });

    // eslint-disable-next-line no-console
    console.log(
      "Administrador técnico criado. MFA (TOTP) fica para a próxima fatia " +
        "de segurança — não é exigido nesta entrega (ADR 0003).",
    );
  } finally {
    await appContext.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erro desconhecido.";
  const jaExiste = error instanceof AdminJaExisteError;
  // eslint-disable-next-line no-console
  console.error(`Falha no bootstrap do administrador técnico: ${message}`);
  process.exit(jaExiste ? CODIGO_SAIDA_ADMIN_JA_EXISTE : 1);
});
