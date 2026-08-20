import { IsIn } from "class-validator";
import { ACCESS_ROLES } from "../access-roles.const";

/**
 * Alteração de papel de um usuário existente.
 *
 * O escopo de empresa/unidade/equipe é IMUTÁVEL por esta rota (T029): esta
 * operação altera apenas o papel, nunca transfere, remove ou atribui escopo.
 * `companyId`/`unitId`/`teamId` são deliberadamente ausentes deste DTO — o
 * `ValidationPipe` global (`whitelist: true`, `forbidNonWhitelisted: true`,
 * ver `main.ts`) recusa com 400 qualquer requisição que os envie, em vez de
 * ignorá-los em silêncio. Transferência de usuário entre empresas não existe
 * na V1 e não tem rota (Constituição, Princípio II; ADR 0005 decisão 3).
 */
export class UpdateUserRoleDto {
  @IsIn(ACCESS_ROLES)
  role!: (typeof ACCESS_ROLES)[number];
}
