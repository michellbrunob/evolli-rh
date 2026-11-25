import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";
import { PrismaService } from "../../database/prisma.service";
import { CamposRecusadosException } from "../../common/erros/recusa-por-campo";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";

const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * T215 — o que a convenção ou o acordo coletivo permite (Regras › Acordos e
 * convenção), com o valor padrão de cada chave.
 */
export const CONVENCAO_PADRAO = {
  "6x1_autorizada": false,
  jornada_ampliada: false,
  "12x36_acordo": true,
  revezamento_8h: false,
  intervalo_30min: false,
  comercio: false,
  feriado_convencao: false,
  portaria_1316: false,
} as const;

/** T215 — os avisos da CLT (Regras › Avisos), ligados ou não por padrão. */
export const AVISOS_PADRAO = {
  interjornada: true,
  dois_descansos: true,
  seis_dias: true,
  dez_horas: true,
  jornada_semanal: true,
  revezamento: true,
  intervalo: true,
  sobrepostos: true,
  plantao_descanso: true,
  ausencia: true,
  domingo: true,
  feriado_comercio: true,
  feriado: true,
  "6x1_transicao": true,
  aprendiz_estagio: true,
  menor_noturno: true,
  tempo_parcial: true,
  intermitente: true,
  noturno: false,
  sobreaviso: true,
  "12x36_2027": true,
} as const;

export const ANTECEDENCIAS = [0, 1, 2, 3, 5, 7, 10, 14, 15, 21, 30] as const;

/** A EC 141/2026 passa a valer 2 meses depois de 16/10/2026. */
export const INICIO_TRANSICAO_PADRAO = "2026-12-16";

export class SalvarRegrasDto {
  @ValidateIf((_o, v) => v !== null)
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  inicioTransicao!: string | null;

  @IsInt()
  @Min(1)
  @Max(7)
  semanaComeca!: number;

  @IsObject()
  convencao!: Record<string, unknown>;

  @IsObject()
  avisos!: Record<string, unknown>;

  @IsIn(ANTECEDENCIAS)
  antecedenciaDias!: number;

  @IsBoolean()
  avisarPadrao!: boolean;
}

export class CriarFeriadoDto {
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  data!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nome!: string;

  @IsIn(["municipal", "ponto_facultativo"])
  tipo!: string;

  /** Vazio = todas as unidades. */
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID("all", { each: true })
  unidadeIds!: string[];
}

export interface FeriadoLocal {
  id: string;
  data: string;
  nome: string;
  tipo: "municipal" | "ponto_facultativo";
  unidadeIds: string[];
}

export interface RegrasDaEscala {
  /** Há regras salvas (senão, valem as padrão). */
  personalizadas: boolean;
  inicioTransicao: string;
  semanaComeca: number;
  convencao: Record<keyof typeof CONVENCAO_PADRAO, boolean>;
  avisos: Record<keyof typeof AVISOS_PADRAO, boolean>;
  antecedenciaDias: number;
  avisarPadrao: boolean;
  feriados: FeriadoLocal[];
}

function diaCivil(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mesclar<T extends Record<string, boolean>>(
  padrao: T,
  gravado: Prisma.JsonValue | undefined,
): Record<keyof T, boolean> {
  const g =
    gravado && typeof gravado === "object" && !Array.isArray(gravado)
      ? (gravado as Record<string, unknown>)
      : {};
  const r = { ...padrao } as Record<keyof T, boolean>;
  for (const k of Object.keys(padrao) as (keyof T)[]) {
    if (typeof g[k as string] === "boolean") r[k] = g[k as string] as boolean;
  }
  return r;
}

/** Só chaves conhecidas, com valor verdadeiro ou falso. */
function chavesValidas(
  valor: Record<string, unknown>,
  padrao: Record<string, boolean>,
): boolean {
  return Object.entries(valor).every(
    ([k, v]) => k in padrao && typeof v === "boolean",
  );
}

/**
 * T215 — Regras da escala e feriados locais da empresa ativa. Ler: quem lê o
 * quadro; salvar e cadastrar: `rh` e `dp`. Sem linha salva, valem as regras
 * padrão. A trilha leva só ação, recurso e empresa (ou o id do feriado).
 */
@Injectable()
export class EscalaRegrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  private empresa(ctx: PessoasAuditContext): string {
    const escopo = resolverEscopoContatos(ctx.actor);
    if (escopo.global) throw new ForbiddenException();
    return escopo.empresaId;
  }

  async consultar(
    ctx: PessoasAuditContext,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<RegrasDaEscala> {
    const empresaId = this.empresa(ctx);
    return this.montar(tx, empresaId);
  }

  /** As regras efetivas da empresa (usado também pelo quadro). */
  async montar(
    tx: Prisma.TransactionClient,
    empresaId: string,
  ): Promise<RegrasDaEscala> {
    const [linha, feriados] = await Promise.all([
      tx.escalaRegras.findUnique({ where: { empresaId } }),
      tx.escalaFeriadoLocal.findMany({
        where: { empresaId },
        orderBy: [{ data: "asc" }, { nome: "asc" }],
      }),
    ]);
    return {
      personalizadas: linha !== null,
      inicioTransicao: linha?.inicioTransicao
        ? diaCivil(linha.inicioTransicao)
        : INICIO_TRANSICAO_PADRAO,
      semanaComeca: linha?.semanaComeca ?? 1,
      convencao: mesclar(CONVENCAO_PADRAO, linha?.convencao),
      avisos: mesclar(AVISOS_PADRAO, linha?.avisos),
      antecedenciaDias: linha?.antecedenciaDias ?? 7,
      avisarPadrao: linha?.avisarPadrao ?? true,
      feriados: feriados.map((f) => ({
        id: f.id,
        data: diaCivil(f.data),
        nome: f.nome,
        tipo: f.tipo as FeriadoLocal["tipo"],
        unidadeIds: f.unidadeIds,
      })),
    };
  }

  async salvar(
    dto: SalvarRegrasDto,
    ctx: PessoasAuditContext,
  ): Promise<RegrasDaEscala> {
    const empresaId = this.empresa(ctx);
    const erros: { campo: "convencao" | "avisos"; motivo: "invalido" }[] = [];
    if (!chavesValidas(dto.convencao, CONVENCAO_PADRAO)) {
      erros.push({ campo: "convencao", motivo: "invalido" });
    }
    if (!chavesValidas(dto.avisos, AVISOS_PADRAO)) {
      erros.push({ campo: "avisos", motivo: "invalido" });
    }
    if (erros.length > 0) throw new CamposRecusadosException(erros);

    const dados = {
      inicioTransicao: dto.inicioTransicao
        ? new Date(`${dto.inicioTransicao}T00:00:00.000Z`)
        : null,
      semanaComeca: dto.semanaComeca,
      convencao: mesclar(CONVENCAO_PADRAO, dto.convencao as Prisma.JsonValue),
      avisos: mesclar(AVISOS_PADRAO, dto.avisos as Prisma.JsonValue),
      antecedenciaDias: dto.antecedenciaDias,
      avisarPadrao: dto.avisarPadrao,
      atualizadoPorUserId: ctx.actor.id,
    };
    return this.prisma.$transaction(async (tx) => {
      await tx.escalaRegras.upsert({
        where: { empresaId },
        create: { empresaId, ...dados },
        update: dados,
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_escala_regras_salvas",
        "escala_colaborador",
        empresaId,
        empresaId,
      );
      return this.montar(tx, empresaId);
    });
  }

  async criarFeriado(
    dto: CriarFeriadoDto,
    ctx: PessoasAuditContext,
  ): Promise<RegrasDaEscala> {
    const empresaId = this.empresa(ctx);
    const unidadeIds = [...new Set(dto.unidadeIds)];
    if (unidadeIds.length > 0) {
      const ativas = await this.prisma.unidadeOrganizacional.count({
        where: { id: { in: unidadeIds }, empresaId, status: "ativo" },
      });
      if (ativas !== unidadeIds.length) {
        throw new CamposRecusadosException([
          { campo: "unidadeOrganizacionalId", motivo: "indisponivel" },
        ]);
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const f = await tx.escalaFeriadoLocal.create({
        data: {
          empresaId,
          data: new Date(`${dto.data}T00:00:00.000Z`),
          nome: dto.nome,
          tipo: dto.tipo,
          unidadeIds,
          criadoPorUserId: ctx.actor.id,
        },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_escala_feriado_criado",
        "escala_colaborador",
        f.id,
        empresaId,
      );
      return this.montar(tx, empresaId);
    });
  }

  async removerFeriado(
    feriadoId: string,
    ctx: PessoasAuditContext,
  ): Promise<RegrasDaEscala> {
    const empresaId = this.empresa(ctx);
    return this.prisma.$transaction(async (tx) => {
      const f = await tx.escalaFeriadoLocal.findFirst({
        where: { id: feriadoId, empresaId },
        select: { id: true },
      });
      if (f === null) throw new NotFoundException();
      await tx.escalaFeriadoLocal.delete({ where: { id: f.id } });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_escala_feriado_removido",
        "escala_colaborador",
        f.id,
        empresaId,
      );
      return this.montar(tx, empresaId);
    });
  }
}
