import { IsIn } from "class-validator";

/** T210 — os quatro temas fechados de Configurações › Aparência. */
export const TEMAS_DE_APARENCIA = [
  "azul_institucional",
  "evolli_claro",
  "verde_petroleo",
  "alto_contraste",
] as const;
export type TemaDeAparencia = (typeof TEMAS_DE_APARENCIA)[number];

/**
 * T210 — `PATCH /v1/users/me/aparencia`: só o tema, só da própria conta (a
 * rota não tem `:id`). Campo a mais é recusado pelo `ValidationPipe`
 * (`forbidNonWhitelisted`).
 */
export class AtualizarAparenciaDto {
  @IsIn(TEMAS_DE_APARENCIA)
  tema!: TemaDeAparencia;
}
