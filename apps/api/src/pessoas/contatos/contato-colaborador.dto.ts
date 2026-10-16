import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
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
 * Os TRÊS campos são obrigatórios — a ficha os aprovou juntos, e o formulário
 * os exige juntos. Não existe `empresaId` aqui, nem em query: a empresa vem da
 * sessão e do vínculo do colaborador, nunca do navegador. Com
 * `forbidNonWhitelisted`, um corpo que tente informá-la é recusado (400).
 *
 * Normalização no servidor (`@Transform`, antes da validação): o valor gravado
 * é sempre o normalizado, qualquer que seja o cliente.
 */
export class RegistrarContatosColaboradorDto {
  @Transform(({ value }) => normalizarEmailPessoal(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITE_EMAIL_PESSOAL)
  @Matches(EMAIL_PESSOAL_FORMA)
  @IsEmail()
  emailPessoal!: string;

  @Transform(({ value }) => normalizarTelefone(value))
  @IsString()
  @Matches(TELEFONE_NORMALIZADO)
  celular!: string;

  @Transform(({ value }) => normalizarTelefone(value))
  @IsString()
  @Matches(TELEFONE_NORMALIZADO)
  telefone!: string;
}
