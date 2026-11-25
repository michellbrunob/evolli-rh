import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { IsObject, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
} from "../../common/erros/recusa-por-campo";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { PessoasAuditContext } from "../pessoas.types";

/** Os atalhos do filtro (ligados ou não). */
export const ATALHOS_DA_VISAO = ["comAviso", "semEscala", "mudancas"] as const;

/** Os grupos do filtro: cada um, a lista de valores marcados. */
export const GRUPOS_DA_VISAO = [
  "unidades",
  "departamentos",
  "tipos",
  "turnos",
  "gestores",
  "cargos",
  "areas",
  "centrosCusto",
  "niveis",
  "generos",
] as const;

/** Teto de visões por pessoa em cada empresa. */
export const MAXIMO_DE_VISOES = 30;
const MAXIMO_POR_GRUPO = 500;
const MAXIMO_DO_VALOR = 80;

type Atalho = (typeof ATALHOS_DA_VISAO)[number];
type Grupo = (typeof GRUPOS_DA_VISAO)[number];
export type FiltrosDaVisao = Record<Atalho, boolean> & Record<Grupo, string[]>;

export interface VisaoDoQuadro {
  id: string;
  nome: string;
  filtros: FiltrosDaVisao;
}

const aparar = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CriarVisaoDto {
  @Transform(aparar)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nome!: string;

  @IsObject()
  filtros!: Record<string, unknown>;
}

export class RenomearVisaoDto {
  @Transform(aparar)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nome!: string;
}

/**
 * Confere os filtros: só chaves conhecidas, atalhos verdadeiro/falso, grupos
 * com listas de textos curtos e sem repetição. Devolve a forma completa (as
 * chaves ausentes vêm desligadas/vazias) ou `null` se a forma é inválida.
 */
export function normalizarFiltros(
  valor: Record<string, unknown>,
): FiltrosDaVisao | null {
  const conhecidas = new Set<string>([...ATALHOS_DA_VISAO, ...GRUPOS_DA_VISAO]);
  if (Object.keys(valor).some((k) => !conhecidas.has(k))) return null;
  const r = {} as FiltrosDaVisao;
  for (const a of ATALHOS_DA_VISAO) {
    const v = valor[a] ?? false;
    if (typeof v !== "boolean") return null;
    r[a] = v;
  }
  for (const g of GRUPOS_DA_VISAO) {
    const v = valor[g] ?? [];
    if (
      !Array.isArray(v) ||
      v.length > MAXIMO_POR_GRUPO ||
      !v.every(
        (x) =>
          typeof x === "string" && x.length > 0 && x.length <= MAXIMO_DO_VALOR,
      )
    ) {
      return null;
    }
    r[g] = [...new Set(v as string[])];
  }
  return r;
}

function algumFiltro(f: FiltrosDaVisao): boolean {
  return (
    ATALHOS_DA_VISAO.some((a) => f[a]) ||
    GRUPOS_DA_VISAO.some((g) => f[g].length > 0)
  );
}

/** Lê o que está gravado; o que não tem a forma certa vira filtro vazio. */
function lerFiltros(gravado: Prisma.JsonValue): FiltrosDaVisao {
  const vazio = normalizarFiltros({})!;
  if (!gravado || typeof gravado !== "object" || Array.isArray(gravado)) {
    return vazio;
  }
  return normalizarFiltros(gravado as Record<string, unknown>) ?? vazio;
}

/**
 * T215 — Visões salvas do quadro da escala: os filtros com um nome. Cada
 * conta só vê as próprias, e só na empresa ativa ("Só você vê"). É
 * preferência de tela: sem dado de pessoa e sem trilha de auditoria.
 */
@Injectable()
export class EscalaVisoesService {
  constructor(private readonly prisma: PrismaService) {}

  private dono(ctx: PessoasAuditContext): {
    empresaId: string;
    userId: string;
  } {
    const escopo = resolverEscopoContatos(ctx.actor);
    if (escopo.global) throw new ForbiddenException();
    return { empresaId: escopo.empresaId, userId: ctx.actor.id };
  }

  private async listar(
    tx: Prisma.TransactionClient,
    dono: { empresaId: string; userId: string },
  ): Promise<{ visoes: VisaoDoQuadro[] }> {
    const linhas = await tx.escalaVisao.findMany({
      where: dono,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      select: { id: true, nome: true, filtros: true },
    });
    return {
      visoes: linhas.map((l) => ({
        id: l.id,
        nome: l.nome,
        filtros: lerFiltros(l.filtros),
      })),
    };
  }

  async consultar(ctx: PessoasAuditContext) {
    return this.listar(this.prisma, this.dono(ctx));
  }

  async criar(dto: CriarVisaoDto, ctx: PessoasAuditContext) {
    const dono = this.dono(ctx);
    const filtros = normalizarFiltros(dto.filtros);
    if (!filtros) {
      throw new CamposRecusadosException([
        { campo: "filtros", motivo: "invalido" },
      ]);
    }
    if (!algumFiltro(filtros)) {
      throw new CamposRecusadosException([
        { campo: "filtros", motivo: "obrigatorio" },
      ]);
    }
    return this.prisma.$transaction(async (tx) => {
      const quantas = await tx.escalaVisao.count({ where: dono });
      if (quantas >= MAXIMO_DE_VISOES) {
        throw new CamposRecusadosException([
          { campo: "nome", motivo: "limite" },
        ]);
      }
      await this.gravar(() =>
        tx.escalaVisao.create({
          data: { ...dono, nome: dto.nome, filtros },
        }),
      );
      return this.listar(tx, dono);
    });
  }

  async renomear(id: string, dto: RenomearVisaoDto, ctx: PessoasAuditContext) {
    const dono = this.dono(ctx);
    return this.prisma.$transaction(async (tx) => {
      const visao = await tx.escalaVisao.findFirst({
        where: { id, ...dono },
        select: { id: true },
      });
      if (!visao) throw new NotFoundException();
      await this.gravar(() =>
        tx.escalaVisao.update({ where: { id }, data: { nome: dto.nome } }),
      );
      return this.listar(tx, dono);
    });
  }

  async remover(id: string, ctx: PessoasAuditContext) {
    const dono = this.dono(ctx);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.escalaVisao.deleteMany({
        where: { id, ...dono },
      });
      if (count === 0) throw new NotFoundException();
      return this.listar(tx, dono);
    });
  }

  /** Nome repetido (na mesma pessoa e empresa): 409 `nome em_uso`. */
  private async gravar(acao: () => Promise<unknown>): Promise<void> {
    try {
      await acao();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflitoDeCamposException([
          { campo: "nome", motivo: "em_uso" },
        ]);
      }
      throw e;
    }
  }
}
