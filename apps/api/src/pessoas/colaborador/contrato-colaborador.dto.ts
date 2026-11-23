import { Transform } from "class-transformer";
import { IsOptional, Matches } from "class-validator";
import { MATRICULA_PATTERN } from "../dto/pessoas.dto";
import { ContratoAdmissaoDto } from "./contrato-admissao";

/**
 * T215 — corpo de `PUT /v1/colaboradores/:colaboradorId/contrato`: o MESMO
 * bloco (e as mesmas validações) do contrato da admissão, que aqui substitui
 * o gravado inteiro — ausente e `null` limpam.
 *
 * A matrícula do vínculo principal vem junto, com regra própria: AUSENTE
 * mantém a gravada; `null`, vazia ou só espaços apaga; texto segue o padrão
 * da admissão e é única na empresa. Tipo, admissão, desligamento e situação
 * do vínculo são só leitura aqui (campo desconhecido é 400).
 */
export class RegistrarContratoColaboradorDto extends ContratoAdmissaoDto {
  @Transform(({ value }) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  )
  @IsOptional()
  @Matches(MATRICULA_PATTERN)
  matricula?: string | null;
}
