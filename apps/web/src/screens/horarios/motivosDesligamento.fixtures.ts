/**
 * Dados sintéticos de "Cadastros > Motivos de desligamento" (T085).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * de catálogo de motivo de desligamento por categoria e escopo
 * organizacional técnico — sem alterar vínculo, acesso, jornada, ponto,
 * documentos, Banco de Horas, pagamento, desconto, evento de Folha ou
 * obrigação. Nenhuma linha representa um motivo ativo, aprovado, operacional
 * ou integrado; todas seguem como referência em revisão, aguardando decisão
 * ou histórico ilustrativo.
 */

export type SituacaoMotivoDesligamento =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface MotivoDesligamentoExemplo {
  readonly id: string;
  readonly codigoIlustrativo: string;
  readonly motivo: string;
  readonly categoriaReferencia: string;
  readonly escopoOrganizacionalTecnico: string;
  readonly situacao: SituacaoMotivoDesligamento;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_MOTIVO_DESLIGAMENTO: Record<
  SituacaoMotivoDesligamento,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const MOTIVOS_DESLIGAMENTO_EXEMPLO: readonly MotivoDesligamentoExemplo[] =
  [
    {
      id: "MD-2026-0001",
      codigoIlustrativo: "MDC-001 (exemplo)",
      motivo: "Motivo de referência A (exemplo)",
      categoriaReferencia: "Categoria C-01 (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Desligamento-01 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de motivo de desligamento (exemplo ilustrativo, sem efeito real sobre vínculo, acesso ou Folha).",
      camposPendentes: ["Validação RH (exemplo)"],
    },
    {
      id: "MD-2026-0002",
      codigoIlustrativo: "MDC-002 (exemplo)",
      motivo: "Motivo de referência B (exemplo)",
      categoriaReferencia: "Categoria C-02 (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-02 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Desligamento-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de motivo de desligamento (exemplo ilustrativo, sem efeito real sobre vínculo, acesso ou Folha).",
      camposPendentes: [],
    },
    {
      id: "MD-2026-0003",
      codigoIlustrativo: "MDC-003 (exemplo)",
      motivo: "Motivo de referência C (exemplo)",
      categoriaReferencia: "Categoria C-01 (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      responsavelTecnico: "RT-Desligamento-01 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem efeito real sobre vínculo, acesso ou Folha).",
      camposPendentes: [
        "Validação RH (exemplo)",
        "Reconhecimento formal (exemplo)",
      ],
    },
    {
      id: "MD-2026-0004",
      codigoIlustrativo: "MDC-004 (exemplo)",
      motivo: "Motivo de referência D (exemplo)",
      categoriaReferencia: "Categoria C-03 (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-03 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      responsavelTecnico: "RT-Desligamento-03 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem efeito real sobre vínculo, acesso ou Folha).",
      camposPendentes: ["Aprovação de referência (exemplo)"],
    },
    {
      id: "MD-2026-0005",
      codigoIlustrativo: "MDC-005 (exemplo)",
      motivo: "Motivo de referência E (exemplo)",
      categoriaReferencia: "Categoria C-02 (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-02 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      responsavelTecnico: "RT-Desligamento-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de motivo de desligamento (exemplo ilustrativo, sem efeito real sobre vínculo, acesso ou Folha).",
      camposPendentes: [],
    },
    {
      id: "MD-2025-0001",
      codigoIlustrativo: "MDC-006 (exemplo)",
      motivo: "Motivo de referência A (exemplo)",
      categoriaReferencia: "Categoria C-03 (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-03 (exemplo)",
      situacao: "historico_ilustrativo",
      responsavelTecnico: "RT-Desligamento-03 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, acesso ou Folha.",
      camposPendentes: [],
    },
    {
      id: "MD-2025-0002",
      codigoIlustrativo: "MDC-007 (exemplo)",
      motivo: "Motivo de referência F (exemplo)",
      categoriaReferencia: "Categoria C-01 (exemplo)",
      escopoOrganizacionalTecnico: "Unidade U-01 (exemplo)",
      situacao: "historico_ilustrativo",
      responsavelTecnico: "RT-Desligamento-01 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, acesso ou Folha.",
      camposPendentes: [],
    },
  ];
