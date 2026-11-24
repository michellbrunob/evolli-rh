import { Transform } from "class-transformer";
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

const DIA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
/** Salário em reais: até 10 dígitos inteiros e 2 decimais, com ponto. */
const SALARIO = /^\d{1,10}(\.\d{1,2})?$/;
// eslint-disable-next-line no-control-regex
const SEM_CONTROLE = /^[^\u0000-\u001F\u007F]*$/;

/** Texto livre: aparado, espaços repetidos viram um; vazio vira `null`. */
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

/**
 * T215 — "Adicionar/Editar alteração salarial": data de início, salário,
 * cargo e modelo de contrato nesse período. As regras que dependem do
 * vínculo (a partir da admissão, até hoje, uma data por período) ficam no
 * serviço.
 */
export class GravarAlteracaoSalarialDto {
  @Matches(DIA_CIVIL)
  @IsDateString({ strict: true })
  vigenciaInicio!: string;

  /** Em reais, com ponto: "1621.00". Maior que zero. */
  @IsString()
  @Matches(SALARIO)
  @Validate(SalarioPositivo)
  salarioBruto!: string;

  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(SEM_CONTROLE)
  cargo?: string | null;

  @Transform(({ value }) => texto(value))
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(SEM_CONTROLE)
  modeloContrato?: string | null;
}
