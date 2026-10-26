/**
 * Dados sintéticos da tela "Início > Visão geral" (T048).
 *
 * Painel de resumo puramente ilustrativo: um card por módulo já disponível
 * (Jornadas de trabalho, Pessoas, Ponto, Documentos), cada um com uma métrica de
 * exemplo e um atalho local (troca de destino via o estado já existente em
 * `App`, nunca rota real). Nenhum número aqui reflete indicador operacional
 * de nenhuma empresa — todos são explicitamente rotulados "(exemplo)".
 */

export interface ResumoModuloExemplo {
  readonly id: string;
  readonly destinoId: string;
  readonly titulo: string;
  readonly metrica: string;
  readonly descricao: string;
  readonly rotuloAtalho: string;
}

export const RESUMOS_MODULO_EXEMPLO: readonly ResumoModuloExemplo[] = [
  {
    // T182 — as tabelas de horário são as Jornadas de trabalho, em tela
    // própria; o atalho leva até elas, e não à Estrutura organizacional.
    id: "resumo-jornadas",
    destinoId: "jornadas-trabalho",
    titulo: "Jornadas de trabalho",
    metrica: "3 jornadas de trabalho cadastradas (exemplo)",
    descricao: "Turnos reutilizáveis da empresa, com código, nome e horários.",
    rotuloAtalho: "Ir para Jornadas de trabalho",
  },
  {
    id: "resumo-pessoas",
    destinoId: "pessoas",
    titulo: "Pessoas",
    metrica: "12 colaboradores com horário atribuído (exemplo)",
    descricao: "Colaboradores com tabela de horário já vinculada.",
    rotuloAtalho: "Ir para Pessoas",
  },
  {
    id: "resumo-ponto",
    destinoId: "ponto",
    titulo: "Ponto",
    metrica: "5 pendências na fila de verificação (exemplo)",
    descricao: "Folhas de ponto aguardando conferência do RH.",
    rotuloAtalho: "Ir para Ponto",
  },
  {
    id: "resumo-documentos",
    destinoId: "documentos",
    titulo: "Documentos",
    metrica: "4 registros de documentos e solicitações (exemplo)",
    descricao: "Metadados de documentos e solicitações desta empresa.",
    rotuloAtalho: "Ir para Documentos",
  },
];

/** Número ilustrativo do destaque "Pendências de ponto a conferir". */
export const PENDENCIAS_PONTO_EXEMPLO = 5;
