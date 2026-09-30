/**
 * Entrada de linha de comando do seed de demonstração (T141).
 *
 * Porta de segurança em três travas, para que estas credenciais sintéticas
 * sejam impossíveis de habilitar em produção por engano:
 *
 *  1. `EVOLLI_DEMO_SEED` precisa valer exatamente `confirmo-ambiente-local`.
 *     Nenhum pipeline dispara isso sem alguém ter escrito a frase.
 *  2. A API alvo precisa estar em `127.0.0.1`, `localhost` ou `::1`
 *     (conferido também dentro do módulo).
 *  3. O `DATABASE_URL` precisa apontar para um host local.
 *
 * Falha com mensagem clara e código de saída diferente de zero em qualquer
 * problema — o comando de demonstração não pode esconder um ambiente pela
 * metade. Nunca imprime senha, token ou string de conexão.
 */
import { semearDemonstracao, PERFIS_DEMO } from "./demo-seed";

const CONFIRMACAO = "confirmo-ambiente-local";
const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "::1"]);

function exigirHostLocal(rotulo: string, valor: string): void {
  let host: string;
  try {
    host = new URL(valor).hostname.replace(/^\[|\]$/g, "");
  } catch {
    throw new Error(`${rotulo} não é uma URL válida.`);
  }
  if (!HOSTS_LOCAIS.has(host)) {
    throw new Error(
      `${rotulo} aponta para "${host}", que não é local. O seed de ` +
        "demonstração só roda contra a própria máquina.",
    );
  }
}

async function main(): Promise<void> {
  if (process.env["EVOLLI_DEMO_SEED"] !== CONFIRMACAO) {
    throw new Error(
      `Defina EVOLLI_DEMO_SEED="${CONFIRMACAO}" no ambiente do processo para ` +
        "confirmar que este é um banco local de demonstração.",
    );
  }

  const baseUrl = process.env["EVOLLI_DEMO_API_URL"] ?? "http://127.0.0.1:3000";
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não está definida no ambiente do processo.");
  }

  exigirHostLocal("EVOLLI_DEMO_API_URL", baseUrl);
  exigirHostLocal("DATABASE_URL", databaseUrl);

  const resumo = await semearDemonstracao(baseUrl, databaseUrl);

  process.stdout.write(
    [
      "Seed de demonstração concluído (dados sintéticos).",
      `  empresas .......... ${resumo.empresas}`,
      `  contas de acesso .. ${resumo.usuarios}`,
      `  colaboradores ..... ${resumo.colaboradores}`,
      `  criados agora ..... ${resumo.criados}`,
      `  já existentes ..... ${resumo.reaproveitados}`,
      "",
      "Perfis disponíveis (senha única, documentada no guia):",
      ...PERFIS_DEMO.map((p) => `  ${p.papel.padEnd(16)} ${p.email}`),
      "",
    ].join("\n"),
  );
}

main().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  process.stderr.write(`Seed de demonstração FALHOU: ${mensagem}\n`);
  process.exitCode = 1;
});
