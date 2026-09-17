import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ACCESS_ROLES } from "../../auth/access-roles.const";
import { ACCESS_USER_STATUSES } from "../access-user-status.const";
import {
  LISTAR_USUARIOS_LIMITE_MAXIMO,
  LISTAR_USUARIOS_LIMITE_PADRAO,
} from "../listar-usuarios.util";

/**
 * Query de `GET /v1/users` (T120).
 *
 * Filtros deliberadamente ENUMERADOS — sem busca por e-mail, substring ou
 * texto livre (vetor de enumeração/varredura; contrato aprovado T119). Sem
 * `total`/contagem: paginação é puramente keyset (`createdAt DESC, id DESC`).
 *
 * `companyId` só tem efeito para `master_tecnico` — para `rh`/`dp` a empresa
 * vem sempre da sessão, e qualquer valor aqui é ignorado
 * (`resolverEscopoListagemUsuarios`, `users.service.ts`). O campo continua
 * aceito no DTO (em vez de recusado com 400) porque não é uma tentativa de
 * elevação: só deixa de ter efeito.
 */
export class ListarUsuariosQueryDto {
  @IsOptional()
  @IsIn(ACCESS_USER_STATUSES)
  status?: (typeof ACCESS_USER_STATUSES)[number];

  @IsOptional()
  @IsIn(ACCESS_ROLES)
  role?: (typeof ACCESS_ROLES)[number];

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LISTAR_USUARIOS_LIMITE_MAXIMO)
  limit?: number = LISTAR_USUARIOS_LIMITE_PADRAO;
}
