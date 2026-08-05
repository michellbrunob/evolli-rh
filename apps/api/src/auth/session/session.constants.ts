// Parâmetros iniciais desta fatia (ADR 0003 / spec §4) — fixos, não
// configuráveis por env nesta implementação.
export const SESSION_COOKIE_NAME = "evolli_session";
export const SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
export const SESSION_INACTIVITY_TTL_MS = 30 * 60 * 1000; // 30 minutos
