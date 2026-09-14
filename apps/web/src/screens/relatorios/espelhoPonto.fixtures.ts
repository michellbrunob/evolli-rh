/**
 * Dados sintéticos de "Relatórios > Espelho de Ponto" (T099).
 *
 * Amostra puramente demonstrativa de referências técnicas de visualização de
 * espelho por tipo de evidência, visibilidade prevista e escopo técnico —
 * sem criar, editar, marcar, ajustar, contestar, aprovar, recusar, fechar,
 * reabrir, assinar, gerar, exportar, salvar, importar ou integrar espelho
 * real. Nenhuma linha representa marcação original, ponto, vínculo, jornada,
 * data real ou documento real; todas seguem como referência em revisão,
 * aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoEspelhoPonto =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export const ROTULO_SITUACAO_ESPELHO_PONTO: Record<
  SituacaoEspelhoPonto,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export interface EspelhoPontoExemplo {
  readonly id: string;
  readonly periodoIlustrativo: string;
  readonly tipoEvidencia: string;
  readonly situacao: SituacaoEspelhoPonto;
  readonly visibilidadePrevista: string;
  readonly escopoTecnico: string;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ESPELHO_PONTO_EXEMPLO: readonly EspelhoPontoExemplo[] = [
  {
    id: "ESP-2026-0001",
    periodoIlustrativo: "Período P-01 (exemplo)",
    tipoEvidencia: "Evidência ilustrativa V-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    visibilidadePrevista: "RH da unidade (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    responsavelTecnico: "RT-Espelho-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de visualização de espelho (exemplo ilustrativo, sem geração, assinatura ou exportação real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "ESP-2026-0002",
    periodoIlustrativo: "Período P-02 (exemplo)",
    tipoEvidencia: "Evidência ilustrativa V-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    visibilidadePrevista: "RH e auditoria (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    responsavelTecnico: "RT-Espelho-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de visualização de espelho (exemplo ilustrativo, sem geração, assinatura ou exportação real).",
    camposPendentes: [],
  },
  {
    id: "ESP-2026-0003",
    periodoIlustrativo: "Período P-03 (exemplo)",
    tipoEvidencia: "Evidência ilustrativa V-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    visibilidadePrevista: "Somente RH central (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    responsavelTecnico: "RT-Espelho-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem geração, assinatura ou exportação real).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "ESP-2026-0004",
    periodoIlustrativo: "Período P-04 (exemplo)",
    tipoEvidencia: "Evidência ilustrativa V-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    visibilidadePrevista: "RH da unidade (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    responsavelTecnico: "RT-Espelho-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem geração, assinatura ou exportação real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "ESP-2026-0005",
    periodoIlustrativo: "Período P-05 (exemplo)",
    tipoEvidencia: "Evidência ilustrativa V-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    visibilidadePrevista: "RH e auditoria (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    responsavelTecnico: "RT-Espelho-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de visualização de espelho (exemplo ilustrativo, sem geração, assinatura ou exportação real).",
    camposPendentes: [],
  },
  {
    id: "ESP-2025-0001",
    periodoIlustrativo: "Período P-06 (exemplo)",
    tipoEvidencia: "Evidência ilustrativa V-01 (exemplo)",
    situacao: "historico_ilustrativo",
    visibilidadePrevista: "Somente RH central (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    responsavelTecnico: "RT-Espelho-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre marcação, ponto, jornada ou Banco de Horas.",
    camposPendentes: [],
  },
  {
    id: "ESP-2025-0002",
    periodoIlustrativo: "Período P-07 (exemplo)",
    tipoEvidencia: "Evidência ilustrativa V-04 (exemplo)",
    situacao: "historico_ilustrativo",
    visibilidadePrevista: "RH da unidade (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    responsavelTecnico: "RT-Espelho-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre marcação, ponto, jornada ou Banco de Horas.",
    camposPendentes: [],
  },
];
