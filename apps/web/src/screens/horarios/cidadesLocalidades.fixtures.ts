/**
 * Dados sintéticos de "Cadastros > Cidades e localidades" (T087).
 *
 * Amostra puramente demonstrativa de como o RH poderá consultar referências
 * técnicas de localidade por escopo técnico e unidade/abrangência técnica —
 * sem alterar endereço, unidade, feriado, jornada, ponto, Banco de Horas,
 * Folha, elegibilidade, permissão ou acesso. Nenhuma linha representa uma
 * localidade oficial, ativa, aprovada, operacional ou integrada; todas
 * seguem como referência em revisão, aguardando decisão ou histórico
 * ilustrativo. Nenhuma cidade real, estado real, CEP, endereço ou
 * coordenada aparece em nenhum campo — apenas referências técnicas
 * sintéticas.
 */

export type SituacaoCidadeLocalidade =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export interface CidadeLocalidadeExemplo {
  readonly id: string;
  readonly codigoIlustrativo: string;
  readonly localidadeTecnica: string;
  readonly escopoTecnico: string;
  readonly unidadeAbrangenciaTecnica: string;
  readonly situacao: SituacaoCidadeLocalidade;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const ROTULO_SITUACAO_CIDADE_LOCALIDADE: Record<
  SituacaoCidadeLocalidade,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export const CIDADES_LOCALIDADES_EXEMPLO: readonly CidadeLocalidadeExemplo[] = [
  {
    id: "LOC-2026-0001",
    codigoIlustrativo: "LOCC-001 (exemplo)",
    localidadeTecnica: "Localidade L-01 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    unidadeAbrangenciaTecnica: "Unidade U-01 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Localidades-01 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de localidade (exemplo ilustrativo, sem cidade, estado, CEP ou endereço real).",
    camposPendentes: ["Validação RH (exemplo)"],
  },
  {
    id: "LOC-2026-0002",
    codigoIlustrativo: "LOCC-002 (exemplo)",
    localidadeTecnica: "Localidade L-02 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    unidadeAbrangenciaTecnica: "Unidade U-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Localidades-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de localidade (exemplo ilustrativo, sem cidade, estado, CEP ou endereço real).",
    camposPendentes: [],
  },
  {
    id: "LOC-2026-0003",
    codigoIlustrativo: "LOCC-003 (exemplo)",
    localidadeTecnica: "Localidade L-03 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    unidadeAbrangenciaTecnica: "Unidade U-01 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Localidades-01 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem cidade, estado, CEP ou endereço real).",
    camposPendentes: [
      "Validação RH (exemplo)",
      "Reconhecimento formal (exemplo)",
    ],
  },
  {
    id: "LOC-2026-0004",
    codigoIlustrativo: "LOCC-004 (exemplo)",
    localidadeTecnica: "Localidade L-04 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    unidadeAbrangenciaTecnica: "Unidade U-03 (exemplo)",
    situacao: "aguardando_decisao_exemplo",
    responsavelTecnico: "RT-Localidades-03 (exemplo)",
    trilhaAuditoria: "2 eventos registrados (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem cidade, estado, CEP ou endereço real).",
    camposPendentes: ["Aprovação de referência (exemplo)"],
  },
  {
    id: "LOC-2026-0005",
    codigoIlustrativo: "LOCC-005 (exemplo)",
    localidadeTecnica: "Localidade L-05 (exemplo)",
    escopoTecnico: "Escopo E-02 (exemplo)",
    unidadeAbrangenciaTecnica: "Unidade U-02 (exemplo)",
    situacao: "referencia_em_revisao_exemplo",
    responsavelTecnico: "RT-Localidades-02 (exemplo)",
    trilhaAuditoria: "1 evento registrado (exemplo)",
    descricaoReferencia:
      "Registro de referência técnica de localidade (exemplo ilustrativo, sem cidade, estado, CEP ou endereço real).",
    camposPendentes: [],
  },
  {
    id: "LOC-2025-0001",
    codigoIlustrativo: "LOCC-006 (exemplo)",
    localidadeTecnica: "Localidade L-01 (exemplo)",
    escopoTecnico: "Escopo E-03 (exemplo)",
    unidadeAbrangenciaTecnica: "Unidade U-03 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Localidades-03 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre endereço, unidade ou Folha.",
    camposPendentes: [],
  },
  {
    id: "LOC-2025-0002",
    codigoIlustrativo: "LOCC-007 (exemplo)",
    localidadeTecnica: "Localidade L-06 (exemplo)",
    escopoTecnico: "Escopo E-01 (exemplo)",
    unidadeAbrangenciaTecnica: "Unidade U-01 (exemplo)",
    situacao: "historico_ilustrativo",
    responsavelTecnico: "RT-Localidades-01 (exemplo)",
    trilhaAuditoria: "3 eventos registrados (exemplo)",
    descricaoReferencia:
      "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre endereço, unidade ou Folha.",
    camposPendentes: [],
  },
];
