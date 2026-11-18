import { Prisma } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { CamposRecusadosException } from "../../common/erros/recusa-por-campo";

/**
 * T209 — contrato da admissão (etapa 2 do Novo colaborador, decisão de
 * 2026-11-17): o que a etapa coleta além do vínculo e da lotação. Fica numa
 * tabela própria (`contrato_vinculo`), fora do vínculo, para o salário não
 * sair pelas rotas que já devolvem o vínculo. Listas FECHADAS (os mesmos
 * valores dos CHECKs da migration `20261117160000_cadastro_etapa_2`).
 */

/** Nível do cargo (sem seleção é "sem nível": `null`). */
export const NIVEIS = [
  "primeiro_emprego",
  "junior",
  "pleno",
  "senior",
  "lider_tecnico",
  "coordenador",
  "gerente",
  "head",
  "diretor",
  "vp",
  "c_level",
] as const;

/** Escala de trabalho (sem seleção é "não informada": `null`). */
export const ESCALAS = [
  "5x2",
  "6x1",
  "semana_espanhola",
  "4x3",
  "fim_de_semana",
  "5x1",
  "6x2",
  "4x2",
  "2x2",
  "3x3",
  "4x4",
  "12x36",
  "12x60",
  "12x72",
  "18x36",
  "24x48",
  "24x72",
  "7x7",
  "14x14",
  "14x21",
  "15x15",
  "20x10",
  "21x21",
  "28x28",
  "outra",
] as const;

/** Conselho profissional ("nenhum" é `null`). */
export const CONSELHOS = [
  "oab",
  "crm",
  "coren",
  "cro",
  "crp",
  "crea",
  "cau",
  "cra",
  "crc",
  "crf",
  "crn",
  "cref",
  "crefito",
  "crbm",
  "crtr",
] as const;

/** Salário em reais: até 10 dígitos inteiros e 2 decimais, com ponto. */
const SALARIO = /^\d{1,10}(\.\d{1,2})?$/;
/** Percentual: até 3 dígitos inteiros e 2 decimais, com ponto. */
const PERCENTUAL = /^\d{1,3}(\.\d{1,2})?$/;
// eslint-disable-next-line no-control-regex
const SEM_CONTROLE = /^[^\u0000-\u001F\u007F]*$/;

function texto(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  const limpo = valor.trim().replace(/ {2,}/g, " ");
  return limpo === "" ? null : limpo;
}

@ValidatorConstraint({ name: "salarioPositivo", async: false })
class SalarioPositivo implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    return typeof valor === "string" && Number(valor) > 0;
  }
}

@ValidatorConstraint({ name: "ateCemPorCento", async: false })
class AteCemPorCento implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    return typeof valor === "string" && Number(valor) <= 100;
  }
}

@ValidatorConstraint({ name: "registroExigeConselho", async: false })
class RegistroExigeConselho implements ValidatorConstraintInterface {
  validate(_valor: unknown, args: ValidationArguments): boolean {
    const conselho = (args.object as { conselhoProfissional?: unknown })
      .conselhoProfissional;
    return typeof conselho === "string";
  }
}

/** O bloco `contrato` da admissão. Tudo opcional na API. */
export class ContratoAdmissaoDto {
  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsIn(NIVEIS)
  nivel?: (typeof NIVEIS)[number] | null;

  @IsOptional()
  @IsUUID()
  gestorDiretoId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(80)
  jornadaSemanalHoras?: number | null;

  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsIn(ESCALAS)
  escala?: (typeof ESCALAS)[number] | null;

  /** Em reais, com ponto: "5000.00". Maior que zero. */
  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsString()
  @Matches(SALARIO)
  @Validate(SalarioPositivo)
  salarioBruto?: string | null;

  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsIn(CONSELHOS)
  conselhoProfissional?: (typeof CONSELHOS)[number] | null;

  /** Só com conselho. */
  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(SEM_CONTROLE)
  @Validate(RegistroExigeConselho)
  registroProfissional?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  dependentesIrrf?: number | null;

  /** Percentual, com ponto: "12.5". De 0 a 100. */
  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsString()
  @Matches(PERCENTUAL)
  @Validate(AteCemPorCento)
  pensaoAlimenticiaPercentual?: string | null;
}

/** O contrato como a API devolve: decimais em texto com 2 casas. */
export interface ContratoDaAdmissao {
  nivel: string | null;
  gestorDiretoId: string | null;
  jornadaSemanalHoras: number | null;
  escala: string | null;
  salarioBruto: string | null;
  conselhoProfissional: string | null;
  registroProfissional: string | null;
  dependentesIrrf: number | null;
  pensaoAlimenticiaPercentual: string | null;
}

const duasCasas = (v: string | null | undefined): string | null =>
  v === null || v === undefined ? null : Number(v).toFixed(2);

/** O bloco enviado, com ausente como `null` e decimais em 2 casas. */
export function contratoEnviado(
  dto: ContratoAdmissaoDto | undefined,
): ContratoDaAdmissao {
  return {
    nivel: dto?.nivel ?? null,
    gestorDiretoId: dto?.gestorDiretoId ?? null,
    jornadaSemanalHoras: dto?.jornadaSemanalHoras ?? null,
    escala: dto?.escala ?? null,
    salarioBruto: duasCasas(dto?.salarioBruto),
    conselhoProfissional: dto?.conselhoProfissional ?? null,
    registroProfissional: dto?.registroProfissional ?? null,
    dependentesIrrf: dto?.dependentesIrrf ?? null,
    pensaoAlimenticiaPercentual: duasCasas(dto?.pensaoAlimenticiaPercentual),
  };
}

type LinhaDoContrato = Prisma.ContratoVinculoGetPayload<object>;

/** A linha gravada como a API devolve. */
export function contratoGravado(
  linha: LinhaDoContrato | null,
): ContratoDaAdmissao | null {
  if (!linha) return null;
  return {
    nivel: linha.nivel,
    gestorDiretoId: linha.gestorDiretoColaboradorId,
    jornadaSemanalHoras: linha.jornadaSemanalHoras,
    escala: linha.escala,
    salarioBruto: linha.salarioBruto?.toFixed(2) ?? null,
    conselhoProfissional: linha.conselhoProfissional,
    registroProfissional: linha.registroProfissional,
    dependentesIrrf: linha.dependentesIrrf,
    pensaoAlimenticiaPercentual:
      linha.pensaoAlimenticiaPercentual?.toFixed(2) ?? null,
  };
}

/** Algum campo com valor? Sem nenhum, a linha não nasce. */
export function contratoTemValor(contrato: ContratoDaAdmissao): boolean {
  return Object.values(contrato).some((v) => v !== null);
}

/** O reenvio traz o MESMO contrato gravado (ou nenhum, dos dois lados)? */
export function contratoConfere(
  dto: ContratoAdmissaoDto | undefined,
  linha: LinhaDoContrato | null,
): boolean {
  const enviado = contratoEnviado(dto);
  const gravado = contratoGravado(linha);
  if (!contratoTemValor(enviado)) return gravado === null;
  if (!gravado) return false;
  return (Object.keys(enviado) as (keyof ContratoDaAdmissao)[]).every(
    (k) => enviado[k] === gravado[k],
  );
}

/**
 * Grava o contrato na transação da admissão. O gestor direto precisa ter
 * vínculo na MESMA empresa: inexistente e de outra empresa respondem igual
 * (422 `indisponivel`), sem revelar outra empresa. Nenhum valor vai à
 * trilha (a admissão já é auditada pelos ids).
 */
export async function gravarContratoNaAdmissao(
  tx: Prisma.TransactionClient,
  alvo: { vinculoId: string; empresaId: string },
  dto: ContratoAdmissaoDto | undefined,
): Promise<ContratoDaAdmissao | null> {
  const enviado = contratoEnviado(dto);
  if (!contratoTemValor(enviado)) return null;
  if (enviado.gestorDiretoId !== null) {
    const doGestor = await tx.vinculoFuncional.findFirst({
      where: {
        colaboradorId: enviado.gestorDiretoId,
        empresaId: alvo.empresaId,
      },
      select: { id: true },
    });
    if (!doGestor) {
      throw new CamposRecusadosException([
        { campo: "contrato.gestorDiretoId", motivo: "indisponivel" },
      ]);
    }
  }
  const linha = await tx.contratoVinculo.create({
    data: {
      vinculoId: alvo.vinculoId,
      empresaId: alvo.empresaId,
      nivel: enviado.nivel,
      gestorDiretoColaboradorId: enviado.gestorDiretoId,
      jornadaSemanalHoras: enviado.jornadaSemanalHoras,
      escala: enviado.escala,
      salarioBruto: enviado.salarioBruto,
      conselhoProfissional: enviado.conselhoProfissional,
      registroProfissional: enviado.registroProfissional,
      dependentesIrrf: enviado.dependentesIrrf,
      pensaoAlimenticiaPercentual: enviado.pensaoAlimenticiaPercentual,
    },
  });
  return contratoGravado(linha);
}
