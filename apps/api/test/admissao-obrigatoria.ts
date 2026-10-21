import { PrismaClient } from "@prisma/client";

/**
 * T177 — campos obrigatórios da admissão (`POST /v1/colaboradores`), além do
 * nome completo: data de nascimento (no bloco `perfilPessoal`) e os três
 * contatos (bloco `contatos`, ficha da T169). Sem eles, a admissão é 400 antes
 * de qualquer gravação.
 *
 * T179 — o e-mail pessoal é único na MESMA empresa (índice do banco): cada
 * chamada devolve um e-mail novo, para que duas admissões da mesma suíte não
 * esbarrem uma na outra. Os telefones estão na forma brasileira; o servidor
 * os grava em `+55` + DDD + número (`TELEFONE_GRAVADO_ADMISSAO`).
 *
 * Toda suíte que admite alguém só para ter um colaborador espalha o retorno
 * no corpo; quem prova o Módulo 1 em si monta os blocos à parte.
 *
 * **Valores sintéticos.** Domínio reservado `example.test`.
 */
let sequenciaDeEmail = 0;

export function camposObrigatoriosAdmissao() {
  sequenciaDeEmail += 1;
  return {
    perfilPessoal: { dataNascimento: "1990-01-15" },
    contatos: {
      emailPessoal: `pessoa.sintetica.${sequenciaDeEmail}@example.test`,
      celular: "+5511900000000",
      telefone: "1130000000",
    },
  };
}

/** Como o servidor grava os telefones de `camposObrigatoriosAdmissao`. */
export const TELEFONE_GRAVADO_ADMISSAO = {
  celular: "+5511900000000",
  telefone: "+551130000000",
} as const;

/**
 * T179 — a lotação que a Nova admissão exige: Departamento, Cargo e Unidade,
 * ativos e da própria empresa.
 */
export interface LotacaoMinima {
  departamentoId: string;
  cargoId: string;
  unidadeOrganizacionalId: string;
}

const lotacoes = new Map<string, Promise<LotacaoMinima>>();

/**
 * Cria (uma vez por empresa) a lotação mínima da admissão, direto no banco
 * — sem passar pela API, para não somar trilha de auditoria nem itens de
 * catálogo que a suíte conte. A suíte que já tem o seu departamento ou cargo
 * o informa DEPOIS do espalhamento, e o dela prevalece.
 *
 * Códigos fixos (`T179_*`) e únicos por empresa; o cache é por empresa, e o
 * id da empresa é UUID novo a cada container.
 */
export function lotacaoMinima(
  databaseUrl: string,
  empresaId: string,
): Promise<LotacaoMinima> {
  const existente = lotacoes.get(empresaId);
  if (existente) return existente;
  const criada = (async () => {
    const cliente = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    try {
      const [unidade, departamento, cargo] = await Promise.all([
        cliente.unidadeOrganizacional.create({
          data: {
            empresaId,
            codigo: "T179_UO",
            nome: "Unidade T179 Sintetica",
          },
        }),
        cliente.departamento.create({
          data: {
            empresaId,
            codigo: "T179_DEP",
            nome: "Departamento T179 Sintetico",
          },
        }),
        cliente.cargo.create({
          data: {
            empresaId,
            codigo: "T179_CARGO",
            nome: "Cargo T179 Sintetico",
          },
        }),
      ]);
      return {
        departamentoId: departamento.id,
        cargoId: cargo.id,
        unidadeOrganizacionalId: unidade.id,
      };
    } finally {
      await cliente.$disconnect();
    }
  })();
  lotacoes.set(empresaId, criada);
  // Falha não fica em cache: a próxima chamada tenta de novo.
  criada.catch(() => lotacoes.delete(empresaId));
  return criada;
}

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
