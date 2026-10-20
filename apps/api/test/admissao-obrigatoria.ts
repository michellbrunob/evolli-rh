import { PrismaClient } from "@prisma/client";

/**
 * T177 — campos obrigatórios da admissão (`POST /v1/colaboradores`), além do
 * nome completo: data de nascimento (no bloco `perfilPessoal`) e os três
 * contatos (bloco `contatos`, ficha da T169). Sem eles, a admissão é 400 antes
 * de qualquer gravação.
 *
 * Toda suíte que admite alguém só para ter um colaborador espalha este objeto
 * no corpo; quem prova o Módulo 1 em si monta os blocos à parte.
 *
 * **Valores sintéticos.** Domínio reservado `example.test`.
 */
export const CAMPOS_OBRIGATORIOS_ADMISSAO = {
  perfilPessoal: { dataNascimento: "1990-01-15" },
  contatos: {
    emailPessoal: "pessoa.sintetica@example.test",
    celular: "+5511900000000",
    telefone: "1130000000",
  },
} as const;

/**
 * Leva um colaborador recém-admitido ao estado de quem foi admitido ANTES da
 * T177: sem perfil, sem endereço e sem contato gravados — a situação de todo o
 * cadastro existente, que as consultas respondem como `sem_registro`.
 *
 * Só para teste, pelo papel de migração (dono das tabelas): `evolli_app` não
 * tem DELETE em nenhuma destas tabelas, e as trilhas de tratamento são
 * append-only para ele. Os eventos de tratamento da admissão saem junto, como
 * se nunca tivessem existido; o `audit_event` fica, e não atrapalha.
 */
export async function comoAdmitidoAntesDaT177(
  migratorUrl: string,
  colaboradorId: string,
): Promise<void> {
  const migrator = new PrismaClient({
    datasources: { db: { url: migratorUrl } },
  });
  try {
    await migrator.$transaction([
      migrator.contatoColaboradorEvento.deleteMany({
        where: { colaboradorId },
      }),
      migrator.contatoColaborador.deleteMany({ where: { colaboradorId } }),
      migrator.dadosPessoaisColaboradorEvento.deleteMany({
        where: { colaboradorId },
      }),
      migrator.perfilPessoalColaborador.deleteMany({
        where: { colaboradorId },
      }),
      migrator.enderecoColaborador.deleteMany({ where: { colaboradorId } }),
    ]);
  } finally {
    await migrator.$disconnect();
  }
}
