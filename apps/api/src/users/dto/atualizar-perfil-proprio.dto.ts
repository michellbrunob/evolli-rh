import { Transform } from "class-transformer";
import {
  IsDefined,
  IsISO8601,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from "class-validator";
import {
  NOME_EXIBICAO_MAXIMO,
  NOME_EXIBICAO_MINIMO,
  nomeExibicaoValido,
  normalizarNomeExibicao,
} from "../perfil/nome-exibicao.util";

@ValidatorConstraint({ name: "nomeExibicao", async: false })
class NomeExibicaoConstraint implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    return nomeExibicaoValido(valor);
  }

  defaultMessage(_args: ValidationArguments): string {
    return `nomeExibicao deve ter de ${NOME_EXIBICAO_MINIMO} a ${NOME_EXIBICAO_MAXIMO} caracteres, com ao menos uma letra`;
  }
}

/**
 * Corpo de `PATCH /v1/users/me` (T208 — Configurações › Meu perfil).
 *
 * **O único dado alterável é o nome de exibição.** Não existe `id`, `email`,
 * `role`, `companyId`, `unitId`, `teamId` nem `status` aqui: o alvo é sempre
 * a conta da sessão, e com o `ValidationPipe` global (`whitelist` +
 * `forbidNonWhitelisted`, ver `main.ts`) qualquer um desses campos no corpo é
 * recusado com 400, em vez de ignorado em silêncio.
 *
 * `perfilAtualizadoEmLido` não é dado do perfil: é a versão que a tela leu
 * (a data da última alteração do perfil, ou `null` se nunca foi salvo). É a
 * pré-condição da concorrência otimista: se o perfil mudou desde então, a
 * gravação é recusada com 409 e nada é sobrescrito.
 */
export class AtualizarPerfilProprioDto {
  /** Vazio, só espaços ou `null` limpam o nome (volta o e-mail). */
  @Transform(({ value }) => normalizarNomeExibicao(value))
  @Validate(NomeExibicaoConstraint)
  nomeExibicao!: string | null;

  @IsDefined()
  @ValidateIf((_objeto, valor) => valor !== null)
  @IsISO8601({ strict: true, strictSeparator: true })
  perfilAtualizadoEmLido!: string | null;
}
