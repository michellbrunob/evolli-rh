/**
 * Dados sintéticos de "Pessoas > Dados contratuais" (T089).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * técnicas de vínculo por modalidade de referência e escopo/unidade técnica —
 * sem criar, modificar ou confirmar vínculo, função, cargo, remuneração,
 * benefício, jornada, ponto, Banco de Horas, documentos, permissões ou
 * acessos. Nenhuma linha representa um contrato ativo, admitido, desligado ou
 * aplicado; todas seguem como referência em revisão, aguardando decisão ou
 * histórico ilustrativo.
 */

export type SituacaoDadosContratuais =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface DadosContratuaisExemplo {
  readonly id: string;
  readonly vinculoTecnico: string;
  readonly modalidadeReferencia: string;
  readonly referenciaOrganizacional: string;
  readonly periodoIlustrativo: string;
  readonly situacao: SituacaoDadosContratuais;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_DADOS_CONTRATUAIS: Record<
  SituacaoDadosContratuais,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const DADOS_CONTRATUAIS_EXEMPLO: readonly DadosContratuaisExemplo[] = [
  {
    id: "DC-2026-0001",
    vinculoTecnico: "Vínculo V-01 (exemplo)",
    modalidadeReferencia: "Modalidade direta (exemplo)",
    referenciaOrganizacional: "Escopo E-01 (exemplo)",
    periodoIlustrativo: "Período P-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Contratual-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de vínculo contratual e escopo organizacional (exemplo ilustrativo, sem criação ou alteração real de contrato, remuneração ou jornada).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "DC-2026-0002",
    vinculoTecnico: "Vínculo V-02 (exemplo)",
    modalidadeReferencia: "Modalidade temporária (exemplo)",
    referenciaOrganizacional: "Escopo E-02 (exemplo)",
    periodoIlustrativo: "Período P-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Contratual-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de vínculo contratual e escopo organizacional (exemplo ilustrativo, sem criação ou alteração real de contrato, remuneração ou jornada).",
    camposPendentes: [],
  },
  {
    id: "DC-2026-0003",
    vinculoTecnico: "Vínculo V-01 (exemplo)",
    modalidadeReferencia: "Modalidade de aprendizagem (exemplo)",
    referenciaOrganizacional: "Escopo E-01 (exemplo)",
    periodoIlustrativo: "Período P-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Contratual-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem criação ou alteração real de contrato, remuneração ou jornada).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "DC-2026-0004",
    vinculoTecnico: "Vínculo V-03 (exemplo)",
    modalidadeReferencia: "Modalidade de estágio (exemplo)",
    referenciaOrganizacional: "Escopo E-03 (exemplo)",
    periodoIlustrativo: "Período P-04 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Contratual-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem criação ou alteração real de contrato, remuneração ou jornada).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "DC-2026-0005",
    vinculoTecnico: "Vínculo V-02 (exemplo)",
    modalidadeReferencia: "Modalidade direta (exemplo)",
    referenciaOrganizacional: "Escopo E-02 (exemplo)",
    periodoIlustrativo: "Período P-05 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Contratual-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de vínculo contratual e escopo organizacional (exemplo ilustrativo, sem criação ou alteração real de contrato, remuneração ou jornada).",
    camposPendentes: [],
  },
  {
    id: "DC-2025-0001",
    vinculoTecnico: "Vínculo V-01 (exemplo)",
    modalidadeReferencia: "Modalidade direta (exemplo)",
    referenciaOrganizacional: "Escopo E-03 (exemplo)",
    periodoIlustrativo: "Período P-06 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Contratual-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre contrato, remuneração, jornada ou Folha.",
    camposPendentes: [],
  },
  {
    id: "DC-2025-0002",
    vinculoTecnico: "Vínculo V-04 (exemplo)",
    modalidadeReferencia: "Modalidade temporária (exemplo)",
    referenciaOrganizacional: "Escopo E-01 (exemplo)",
    periodoIlustrativo: "Período P-07 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Contratual-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre contrato, remuneração, jornada ou Folha.",
    camposPendentes: [],
  },
];
