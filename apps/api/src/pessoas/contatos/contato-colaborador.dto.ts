import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import {
  EMAIL_PESSOAL_FORMA,
  LIMITE_EMAIL_PESSOAL,
  TELEFONE_NORMALIZADO,
  normalizarEmailPessoal,
  normalizarTelefone,
} from "./normalizacao-contatos.util";

/**
 * Corpo de `PUT /colaboradores/:colaboradorId/contatos`.
 *
 * T179 — os TRÊS campos são OPCIONAIS (decisão da proprietária de 2026-10-21).
 * No PUT, campo AUSENTE mantém o valor gravado; vazio ou `null` apaga aquele
 * campo (decisão de 2026-10-22). Na admissão, ausente é não informado. Quando
 * informado, o formato continua conferido; telefone com letras é recusado. Não existe `empresaId` aqui, nem em query: a empresa vem da
 * sessão e do vínculo do colaborador, nunca do navegador. Com
 * `forbidNonWhitelisted`, um corpo que tente informá-la é recusado (400).
 *
 * Normalização no servidor (`@Transform`, antes da validação): o valor gravado
 * é sempre o normalizado, qualquer que seja o cliente.
 */
export class RegistrarContatosColaboradorDto {
  @Transform(({ value }) => normalizarEmailPessoal(value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITE_EMAIL_PESSOAL)
  @Matches(EMAIL_PESSOAL_FORMA)
  @IsEmail()
  emailPessoal?: string | null;

  @Transform(({ value }) => normalizarTelefone(value))
  @IsOptional()
  @IsString()
  @Matches(TELEFONE_NORMALIZADO)
  celular?: string | null;

  @Transform(({ value }) => normalizarTelefone(value))
  @IsOptional()
  @IsString()
  @Matches(TELEFONE_NORMALIZADO)
  telefone?: string | null;
}
