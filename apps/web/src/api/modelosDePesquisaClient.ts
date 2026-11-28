/**
 * T216 — resultados dos modelos com metodologia própria (riscos
 * psicossociais NR-1 e saúde financeira) e o acompanhamento da NR-1:
 *
 *   GET /pesquisas/:id/modelo/resultado?campo=        time e recortes
 *   GET /pesquisas/:id/modelo/respostas/:respostaId   uma resposta
 *   GET /pesquisas/:id/modelo/acompanhamento          etapas e plano
 *   PUT /pesquisas/:id/modelo/acompanhamento          grava (CSRF)
 *
 * Os tipos seguem `apps/api/src/pesquisas/modelos/` (apêndice de
 * `docs/decisions/t216-pesquisas.md`).
 */
import type { CampoGrupo, MotivoOculto } from "./pesquisasClient";
import type {
  FaixaIsfb,
  NivelNr1,
  ResultadoIsfb,
  ResultadoNr1,
  SaudeFinanceira,
} from "./resultadosDosModelos";
export type * from "./resultadosDosModelos";
import { pedir } from "./pesquisasClient";

export interface GrupoDoModelo {
  id: string;
  nome: string;
  respostas: number;
  visivel: boolean;
  oculto: MotivoOculto | null;
  nr1: {
    pressao: number | null;
    recursos: number | null;
    destaque: boolean;
    niveis: Record<NivelNr1, number>;
    precisamDeAcao: number;
    dimensoes: {
      id: string;
      escore: number | null;
      percentualEmRisco: number;
      nivel: NivelNr1 | null;
    }[];
  } | null;
  isfb: {
    isfb: number | null;
    faixa: FaixaIsfb | null;
    saude: Record<SaudeFinanceira, number>;
    comTresOuMaisSinais: number;
  } | null;
}

/** O resultado montado para o painel (empresa, recortes e grupos). */
export interface ResultadoDoPainel {
  modelo: "copsoq" | "isfb";
  respostas: number;
  visivel: boolean;
  minimoPorGrupo: number;
  recortes: CampoGrupo[];
  nr1: ResultadoNr1 | null;
  isfb: ResultadoIsfb | null;
  campo: CampoGrupo | null;
  grupos: GrupoDoModelo[] | null;
  semGrupo: number;
}

export type EtapaNr1 =
  | "mapear"
  | "plano"
  | "comunicar"
  | "validar"
  | "treinar"
  | "implementar"
  | "revisar";
export type ControleNr1 =
  "eliminacao" | "substituicao" | "administrativo" | "protecao";
export type SituacaoDaMedida = "planejada" | "em_andamento" | "concluida";

export interface MedidaDoPlano {
  id: string;
  dimensaoId: string;
  titulo: string;
  descricao: string | null;
  controle: ControleNr1;
  responsavel: string | null;
  prazo: string | null;
  indicador: string | null;
  situacao: SituacaoDaMedida;
}

export interface EtapaDoAcompanhamento {
  id: EtapaNr1;
  itens: boolean[];
  evidencias: string | null;
  concluidaEm: string | null;
  concluida: boolean;
  automatica: boolean;
}

export interface AcompanhamentoNr1 {
  etapas: EtapaDoAcompanhamento[];
  plano: MedidaDoPlano[];
  profissionalSst: { nome: string | null; registro: string | null };
  atualizadoEm: string | null;
  concluidas: number;
  proxima: EtapaNr1 | null;
  revisarEm: string | null;
}

export interface AcompanhamentoNr1Entrada {
  etapas: {
    id: EtapaNr1;
    itens: boolean[];
    evidencias: string | null;
    concluida: boolean;
  }[];
  plano: MedidaDoPlano[];
  profissionalSst: { nome: string | null; registro: string | null };
}

const id = encodeURIComponent;

export const acompanhamentoNr1 = (pesquisaId: string) =>
  pedir<AcompanhamentoNr1>(
    `/pesquisas/${id(pesquisaId)}/modelo/acompanhamento`,
    "GET",
  );

export const gravarAcompanhamentoNr1 = (
  pesquisaId: string,
  entrada: AcompanhamentoNr1Entrada,
) =>
  pedir<AcompanhamentoNr1>(
    `/pesquisas/${id(pesquisaId)}/modelo/acompanhamento`,
    "PUT",
    entrada,
  );

/** As chamadas dos modelos (as telas recebem um falso nos testes). */
export interface ServicoDosModelos {
  readonly acompanhamentoNr1: typeof acompanhamentoNr1;
  readonly gravarAcompanhamentoNr1: typeof gravarAcompanhamentoNr1;
}

export const SERVICO_DOS_MODELOS: ServicoDosModelos = {
  acompanhamentoNr1,
  gravarAcompanhamentoNr1,
};
