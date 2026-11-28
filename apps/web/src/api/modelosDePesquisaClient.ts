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
import { pedir } from "./pesquisasClient";

export type NivelNr1 = "critico" | "alto" | "medio" | "baixo";
export type FaixaNr1 = "risco" | "intermediario" | "favoravel";
export type Grau = 1 | 2 | 3 | 4;
export type Comparacao = "acima" | "abaixo" | "na_media";

export interface DimensaoNr1Resultado {
  id: string;
  dominio: string;
  tipo: "risco" | "protecao";
  pessoas: number;
  escore: number | null;
  tercil: 1 | 2 | 3 | null;
  faixa: FaixaNr1 | null;
  distribuicao: Record<FaixaNr1, number>;
  percentuais: Record<FaixaNr1, number>;
  severidade: Grau | null;
  prevalencia: Grau | null;
  nivel: NivelNr1 | null;
  regraDeProtecao: boolean;
}

/** `null` = "menos de N pessoas" (sigilo fora da identificada). */
export type ContagemSigilosa = number | null;

export interface ResultadoNr1 {
  respostas: number;
  dimensoes: DimensaoNr1Resultado[];
  prioridades: string[];
  niveis: Record<NivelNr1, number>;
  precisamDeAcao: number;
  /** Linhas: severidade 4 a 1; colunas: prevalência 1 a 4; ids. */
  matriz: string[][][];
  dominios: {
    id: string;
    dimensoes: number;
    precisamDeAcao: number;
    percentualEmRisco: number | null;
  }[];
  saude: {
    id: string;
    pessoasEmRisco: number;
    pessoas: number;
    percentualEmRisco: number;
    nivel: NivelNr1 | null;
  }[];
  ofensivos: {
    pessoas: number;
    relataram: ContagemSigilosa;
    percentual: number | null;
    tipos: {
      id: string;
      raramente: ContagemSigilosa;
      asVezes: ContagemSigilosa;
      frequentementeOuSempre: ContagemSigilosa;
      relataram: ContagemSigilosa;
    }[];
  };
  pressao: number | null;
  recursos: number | null;
}

export type FaixaIsfb =
  "ruim" | "muito_baixa" | "baixa" | "ok" | "boa" | "muito_boa" | "otima";
export type SaudeFinanceira = "baixa" | "no_limite" | "saudavel";
export type PerfilIsfb =
  "estaveis" | "confortaveis_sem_metodo" | "apertados_organizados" | "em_risco";
export type SinalIsfb = "gasta_mais" | "estresse" | "apertado" | "sem_reserva";
export type AberturaIsfb =
  "sabem_que_precisam" | "ponto_cego" | "bem_e_atentos" | "bem_mas_desatentos";
export type TemaIsfb =
  | "orcamento"
  | "reserva"
  | "aposentadoria"
  | "investimentos"
  | "dividas"
  | "decidir";

export interface ContagemComPercentual {
  quantidade: number;
  percentual: number;
}

export interface ResultadoIsfb {
  pessoas: number;
  isfb: number | null;
  faixa: FaixaIsfb | null;
  diferencaDoBrasil: number | null;
  mediaDoBrasil: number;
  dimensoes: {
    id: string;
    nota: number | null;
    faixa: FaixaIsfb | null;
    pessoas: number;
  }[];
  distribuicao: number[];
  saude: Record<SaudeFinanceira, ContagemComPercentual>;
  sinais: Record<SinalIsfb, ContagemComPercentual>;
  sinaisAcumulados: number[];
  perfis: Record<PerfilIsfb, ContagemComPercentual>;
  pontoDoTime: { seguranca: number; capacidade: number } | null;
  perguntas: {
    id: string;
    respostas: number;
    favoravel: number;
    desfavoravel: number;
    pontos: number[];
  }[];
  produtos: Record<string, ContagemComPercentual>;
  base: {
    semReserva: ContagemComPercentual;
    comPrevidencia: ContagemComPercentual;
    doisOuMaisFinanciamentos: ContagemComPercentual;
    produtosPorPessoa: number | null;
  };
  creditoReserva: {
    creditoSemReserva: number;
    creditoComReserva: number;
    semCreditoSemReserva: number;
    semCreditoComReserva: number;
  };
  temas: { id: TemaIsfb; quantidade: number; percentual: number }[];
  aberturas: Record<AberturaIsfb, ContagemComPercentual>;
  comAutopercepcao: number;
  porRenda: {
    id: string;
    respostas: number;
    visivel: boolean;
    oculto: MotivoOculto | null;
    saude: Record<SaudeFinanceira, number> | null;
  }[];
}

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

export interface ResultadoDoModelo {
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

export interface PessoaIsfb {
  isfb: number;
  faixa: FaixaIsfb;
  saude: SaudeFinanceira;
  dimensoes: Record<
    "seguranca" | "habilidade" | "comportamento" | "liberdade",
    number
  >;
  autopercepcao: number | null;
  baseBaixa: boolean;
  perfil: PerfilIsfb;
  sinais: SinalIsfb[];
  abertura: AberturaIsfb | null;
  produtos: string[];
  pontos: Record<string, number | null>;
  renda: number | null;
  isfbDoTime: number | null;
  mediaDoBrasil: number;
  dimensoesDoTime: Record<string, number | null>;
}

export interface IndividualNr1 {
  dimensoes: {
    id: string;
    escore: number | null;
    tercil: 1 | 2 | 3 | null;
    faixa: FaixaNr1 | null;
    severidade: Grau | null;
    prevalencia: Grau | null;
    nivel: NivelNr1 | null;
    regraDeProtecao: boolean;
    escoreDoTime: number | null;
    comparacao: Comparacao | null;
  }[];
  niveis: Record<NivelNr1, number>;
  ofensivos: { id: string; resposta: number | null }[];
}

export interface IndividualDoModelo {
  modelo: "copsoq" | "isfb";
  respostaId: string;
  nr1: IndividualNr1 | null;
  isfb: PessoaIsfb | null;
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

export const resultadoDoModelo = (pesquisaId: string, campo?: CampoGrupo) =>
  pedir<ResultadoDoModelo>(
    `/pesquisas/${id(pesquisaId)}/modelo/resultado${campo ? `?campo=${id(campo)}` : ""}`,
    "GET",
  );

export const individualDoModelo = (pesquisaId: string, respostaId: string) =>
  pedir<IndividualDoModelo>(
    `/pesquisas/${id(pesquisaId)}/modelo/respostas/${id(respostaId)}`,
    "GET",
  );

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
  readonly resultadoDoModelo: typeof resultadoDoModelo;
  readonly individualDoModelo: typeof individualDoModelo;
  readonly acompanhamentoNr1: typeof acompanhamentoNr1;
  readonly gravarAcompanhamentoNr1: typeof gravarAcompanhamentoNr1;
}

export const SERVICO_DOS_MODELOS: ServicoDosModelos = {
  resultadoDoModelo,
  individualDoModelo,
  acompanhamentoNr1,
  gravarAcompanhamentoNr1,
};
