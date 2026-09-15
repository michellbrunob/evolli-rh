/**
 * Dados sintéticos de "Relatórios > Listagem de Colaboradores" (T103).
 *
 * Amostra puramente demonstrativa de referências técnicas de vínculo por
 * categoria, escopo técnico e função de referência — sem criar, editar,
 * identificar, admitir, desligar, vincular, atribuir, aprovar, salvar,
 * calcular, pagar, descontar, gerar, exportar, importar ou integrar
 * colaborador real. Nenhuma linha representa pessoa identificável, nome,
 * CPF, matrícula real, e-mail, telefone, endereço, data de nascimento,
 * documento, empresa ou unidade real; todas seguem como referência em
 * revisão, aguardando decisão ou histórico ilustrativo.
 */

export type SituacaoRelatorioListagemColaboradores =
  | "referencia_em_revisao_exemplo"
  | "aguardando_decisao_exemplo"
  | "historico_ilustrativo";

export const ROTULO_SITUACAO_RELATORIO_LISTAGEM_COLABORADORES: Record<
  SituacaoRelatorioListagemColaboradores,
  string
> = {
  referencia_em_revisao_exemplo: "Referência em revisão (exemplo)",
  aguardando_decisao_exemplo: "Aguardando decisão (exemplo)",
  historico_ilustrativo: "Histórico ilustrativo",
};

export interface RelatorioListagemColaboradorExemplo {
  readonly id: string;
  readonly vinculoTecnicoIlustrativo: string;
  readonly categoriaVinculo: string;
  readonly escopoTecnico: string;
  readonly situacao: SituacaoRelatorioListagemColaboradores;
  readonly funcaoReferencia: string;
  readonly responsavelTecnico: string;
  readonly trilhaAuditoria: string;
  readonly descricaoReferencia: string;
  readonly camposPendentes: readonly string[];
}

export const RELATORIO_LISTAGEM_COLABORADORES_EXEMPLO: readonly RelatorioListagemColaboradorExemplo[] =
  [
    {
      id: "LCO-2026-0001",
      vinculoTecnicoIlustrativo: "Vínculo técnico ilustrativo V-01 (exemplo)",
      categoriaVinculo: "Categoria de vínculo C-01 (exemplo)",
      escopoTecnico: "Escopo E-01 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      funcaoReferencia: "Função de referência F-01 (exemplo)",
      responsavelTecnico: "RT-Colaboradores-01 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de vínculo (exemplo ilustrativo, sem identificação, admissão ou vinculação real).",
      camposPendentes: ["Validação RH (exemplo)"],
    },
    {
      id: "LCO-2026-0002",
      vinculoTecnicoIlustrativo: "Vínculo técnico ilustrativo V-02 (exemplo)",
      categoriaVinculo: "Categoria de vínculo C-02 (exemplo)",
      escopoTecnico: "Escopo E-02 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      funcaoReferencia: "Função de referência F-02 (exemplo)",
      responsavelTecnico: "RT-Colaboradores-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de vínculo (exemplo ilustrativo, sem identificação, admissão ou vinculação real).",
      camposPendentes: [],
    },
    {
      id: "LCO-2026-0003",
      vinculoTecnicoIlustrativo: "Vínculo técnico ilustrativo V-01 (exemplo)",
      categoriaVinculo: "Categoria de vínculo C-01 (exemplo)",
      escopoTecnico: "Escopo E-01 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      funcaoReferencia: "Função de referência F-01 (exemplo)",
      responsavelTecnico: "RT-Colaboradores-01 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem identificação, admissão ou vinculação real).",
      camposPendentes: [
        "Validação RH (exemplo)",
        "Reconhecimento formal (exemplo)",
      ],
    },
    {
      id: "LCO-2026-0004",
      vinculoTecnicoIlustrativo: "Vínculo técnico ilustrativo V-03 (exemplo)",
      categoriaVinculo: "Categoria de vínculo C-03 (exemplo)",
      escopoTecnico: "Escopo E-03 (exemplo)",
      situacao: "aguardando_decisao_exemplo",
      funcaoReferencia: "Função de referência F-03 (exemplo)",
      responsavelTecnico: "RT-Colaboradores-03 (exemplo)",
      trilhaAuditoria: "2 eventos registrados (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica aguardando decisão formal (exemplo ilustrativo, sem identificação, admissão ou vinculação real).",
      camposPendentes: ["Aprovação de referência (exemplo)"],
    },
    {
      id: "LCO-2026-0005",
      vinculoTecnicoIlustrativo: "Vínculo técnico ilustrativo V-02 (exemplo)",
      categoriaVinculo: "Categoria de vínculo C-02 (exemplo)",
      escopoTecnico: "Escopo E-02 (exemplo)",
      situacao: "referencia_em_revisao_exemplo",
      funcaoReferencia: "Função de referência F-02 (exemplo)",
      responsavelTecnico: "RT-Colaboradores-02 (exemplo)",
      trilhaAuditoria: "1 evento registrado (exemplo)",
      descricaoReferencia:
        "Registro de referência técnica de vínculo (exemplo ilustrativo, sem identificação, admissão ou vinculação real).",
      camposPendentes: [],
    },
    {
      id: "LCO-2025-0001",
      vinculoTecnicoIlustrativo: "Vínculo técnico ilustrativo V-01 (exemplo)",
      categoriaVinculo: "Categoria de vínculo C-01 (exemplo)",
      escopoTecnico: "Escopo E-03 (exemplo)",
      situacao: "historico_ilustrativo",
      funcaoReferencia: "Função de referência F-04 (exemplo)",
      responsavelTecnico: "RT-Colaboradores-03 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, função ou cargo.",
      camposPendentes: [],
    },
    {
      id: "LCO-2025-0002",
      vinculoTecnicoIlustrativo: "Vínculo técnico ilustrativo V-04 (exemplo)",
      categoriaVinculo: "Categoria de vínculo C-04 (exemplo)",
      escopoTecnico: "Escopo E-01 (exemplo)",
      situacao: "historico_ilustrativo",
      funcaoReferencia: "Função de referência F-01 (exemplo)",
      responsavelTecnico: "RT-Colaboradores-01 (exemplo)",
      trilhaAuditoria: "3 eventos registrados (exemplo)",
      descricaoReferencia:
        "Exemplo de referência já registrada como histórico ilustrativo, sem efeito real sobre vínculo, função ou cargo.",
      camposPendentes: [],
    },
  ];
