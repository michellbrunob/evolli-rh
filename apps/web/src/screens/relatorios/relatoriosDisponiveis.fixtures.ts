/**
 * Dados sintéticos da tela "Relatórios > Relatórios disponíveis" (T075).
 *
 * Lista demonstrativa de relatórios futuros do módulo de Ponto — apenas
 * nome e descrição funcional de alto nível, sem gerar, baixar ou exportar
 * nenhum arquivo. Nenhum destes relatórios existe de fato nesta
 * demonstração.
 */

export interface RelatorioDisponivelExemplo {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string;
}

export const RELATORIOS_DISPONIVEIS_EXEMPLO: readonly RelatorioDisponivelExemplo[] =
  [
    {
      id: "relatorio-exemplo-1",
      nome: "Espelho do período",
      descricao:
        "Consolidação de leitura do período — jornada prevista/computada, marcações e saldo de Banco de Horas, sempre por referência técnica.",
    },
    {
      id: "relatorio-exemplo-2",
      nome: "Extrato de Banco de Horas",
      descricao:
        "Movimentos de crédito e débito separados, com saldo derivado — nunca um valor líquido.",
    },
    {
      id: "relatorio-exemplo-3",
      nome: "Justificativas e ajustes",
      descricao:
        "Registro consolidado de ajustes manuais e motivos codificados, sempre como eventos aditivos e auditáveis.",
    },
    {
      id: "relatorio-exemplo-4",
      nome: "Calendário de feriados",
      descricao:
        "Feriados cadastrados por empresa, usados como referência para a apuração de jornada.",
    },
    {
      id: "relatorio-exemplo-5",
      nome: "Horários e escalas",
      descricao:
        "Tabelas de horário e vigências cadastradas por empresa, com o histórico de vigências preservado.",
    },
    {
      id: "relatorio-exemplo-6",
      nome: "Exportação para Folha",
      descricao:
        "Interface futura e controlada para envio de dados consolidados de Ponto — sem lançamento automático.",
    },
  ];
