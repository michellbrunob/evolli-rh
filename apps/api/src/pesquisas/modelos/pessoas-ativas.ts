import { Prisma } from "@prisma/client";
import { semDesativacaoVigente } from "../../pessoas/colaborador/desativacao";
import { diaDe } from "../../pessoas/ausencias/calculo-ausencias";

/**
 * T216 — as pessoas ativas da empresa com o que a Avaliação 90°/180° e o
 * Onboarding precisam: a lotação vigente (equipe, cargo, departamento,
 * unidade e centro de custo), a admissão, se entra pelo link (CPF e
 * nascimento no perfil) e se tem e-mail no cadastro. CPF, nascimento e
 * e-mail nunca saem daqui: só os indicadores.
 */

type Db = Prisma.TransactionClient;

export interface PessoaAtiva {
  id: string;
  nome: string;
  admissao: string | null;
  equipeId: string | null;
  cargoId: string | null;
  cargo: string | null;
  departamentoId: string | null;
  departamento: string | null;
  unidadeId: string | null;
  unidade: string | null;
  centroCustoId: string | null;
  identificavel: boolean;
  temEmail: boolean;
}

export async function pessoasAtivas(
  db: Db,
  empresaId: string,
): Promise<PessoaAtiva[]> {
  const vinculos = await db.vinculoFuncional.findMany({
    where: {
      empresaId,
      situacao: "ativo",
      colaborador: semDesativacaoVigente(empresaId),
    },
    orderBy: [{ dataAdmissao: "desc" }, { id: "asc" }],
    select: {
      colaboradorId: true,
      dataAdmissao: true,
      colaborador: { select: { nome: true } },
      alocacoes: {
        where: { vigenteAte: null },
        orderBy: [{ vigenteDe: "desc" }, { id: "asc" }],
        take: 1,
        select: {
          equipeId: true,
          centroCustoId: true,
          cargo: { select: { id: true, nome: true } },
          departamento: { select: { id: true, nome: true } },
          unidadeOrganizacional: { select: { id: true, nome: true } },
        },
      },
    },
  });
  const ids = [...new Set(vinculos.map((v) => v.colaboradorId))];
  const [perfis, contatos] = await Promise.all([
    db.perfilPessoalColaborador.findMany({
      where: { empresaId, colaboradorId: { in: ids } },
      select: { colaboradorId: true, cpf: true, dataNascimento: true },
    }),
    db.contatoColaborador.findMany({
      where: {
        empresaId,
        colaboradorId: { in: ids },
        ativo: true,
        emailPessoal: { not: null },
      },
      select: { colaboradorId: true },
    }),
  ]);
  const identificaveis = new Set(
    perfis
      .filter((p) => !!p.cpf && p.dataNascimento !== null)
      .map((p) => p.colaboradorId),
  );
  const comEmail = new Set(contatos.map((c) => c.colaboradorId));
  const vistos = new Set<string>();
  const r: PessoaAtiva[] = [];
  for (const v of vinculos) {
    if (vistos.has(v.colaboradorId)) continue;
    vistos.add(v.colaboradorId);
    const a = v.alocacoes[0];
    r.push({
      id: v.colaboradorId,
      nome: v.colaborador.nome,
      admissao: diaDe(v.dataAdmissao),
      equipeId: a?.equipeId ?? null,
      cargoId: a?.cargo?.id ?? null,
      cargo: a?.cargo?.nome ?? null,
      departamentoId: a?.departamento?.id ?? null,
      departamento: a?.departamento?.nome ?? null,
      unidadeId: a?.unidadeOrganizacional?.id ?? null,
      unidade: a?.unidadeOrganizacional?.nome ?? null,
      centroCustoId: a?.centroCustoId ?? null,
      identificavel: identificaveis.has(v.colaboradorId),
      temEmail: comEmail.has(v.colaboradorId),
    });
  }
  return r.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** As atribuições de gestor vigentes no dia (`AAAA-MM-DD`). */
export async function atribuicoesVigentes(
  db: Db,
  empresaId: string,
  hoje: string,
): Promise<
  { equipeId: string; gestorId: string; papel: "principal" | "substituto" }[]
> {
  const dia = new Date(`${hoje}T00:00:00.000Z`);
  const linhas = await db.atribuicaoGestorEquipe.findMany({
    where: {
      empresaId,
      vigenciaInicio: { lte: dia },
      OR: [{ vigenciaFim: null }, { vigenciaFim: { gt: dia } }],
    },
    select: { equipeId: true, gestorColaboradorId: true, papel: true },
  });
  return linhas.map((l) => ({
    equipeId: l.equipeId,
    gestorId: l.gestorColaboradorId,
    papel: l.papel,
  }));
}

/** Feriados locais da empresa (sem unidade: valem para todos), não arquivados. */
export async function feriadosLocais(
  db: Db,
  empresaId: string,
  de: string,
  ate: string,
): Promise<Set<string>> {
  const linhas = await db.escalaFeriadoLocal.findMany({
    where: {
      empresaId,
      arquivadoEm: null,
      unidadeIds: { isEmpty: true },
      data: {
        gte: new Date(`${de}T00:00:00.000Z`),
        lte: new Date(`${ate}T00:00:00.000Z`),
      },
    },
    select: { data: true },
  });
  return new Set(linhas.map((l) => diaDe(l.data)));
}
