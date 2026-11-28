/**
 * T216 — o resultado próprio dos modelos com cálculo (espelho de
 * `apps/api/src/pesquisas/modelos/tipos.ts`): `ResultadosPesquisa.modelo`
 * (agregado) e `RespostaDetalhe.modelo` (a pessoa).
 */

/** Faixas do score 0–100: < 50 · 50–69 · 70–84 · ≥ 85. */
export type FaixaDeScore = "critico" | "atencao" | "saudavel" | "forte";

/** Faixas do eNPS e do LNPS no Pulso e Clima: < 0 · 0–29 · 30–69 · ≥ 70. */
export type FaixaDeRecomendacao = "critico" | "em_ajuste" | "bom" | "excelente";

/** Uma pergunta de recomendação 0–10 (eNPS ou LNPS), com a distribuição. */
export interface RecomendacaoDoModelo {
  perguntaId: string | null;
  respostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  /** −100 a 100; `null` sem respostas. */
  indice: number | null;
  faixa: FaixaDeRecomendacao | null;
  /** As notas de 0 a 10, com zeros. */
  distribuicao: { valor: number; quantidade: number }[];
}

/** Uma afirmação de concordância (1 a 5) do modelo. */
export interface AfirmacaoDoModelo {
  chave: string;
  perguntaId: string;
  dimensao: string;
  subdimensao: string | null;
  respostas: number;
  /** Média de 1 a 5 (duas casas). */
  media: number | null;
  /** `(média − 1) ÷ 4 × 100`, inteiro. */
  score: number | null;
  /** % das respostas em 4–5, 3 e 1–2 (inteiros). */
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
}

/** Uma dimensão (ou subdimensão) do modelo. */
export interface DimensaoDoModelo {
  chave: string;
  rotulo: string;
  afirmacoes: number;
  /** Respostas somadas das afirmações da dimensão. */
  respostas: number;
  /** Média dos scores das afirmações (0–100, inteiro). */
  score: number | null;
  /** A faixa do indicador principal do modelo (score ou % favorável). */
  faixa: FaixaDeScore | null;
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
  /** Comentários escritos sobre a dimensão (só o Pulso e Clima). */
  comentarios: number;
  subdimensoes?: DimensaoDoModelo[];
}

/** O comentário de uma dimensão (ou da recomendação), para a tela agrupar. */
export interface ComentarioDoModelo {
  /** A dimensão, `lnps` ou `enps`. */
  dimensao: string;
  perguntaId: string;
  quantidade: number;
}

export interface ResultadoPulsoClima {
  modelo: "pulso_clima";
  /** Média dos scores das 22 afirmações (0–100, inteiro). */
  score: number | null;
  faixa: FaixaDeScore | null;
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
  dimensoes: DimensaoDoModelo[];
  afirmacoes: AfirmacaoDoModelo[];
  enps: RecomendacaoDoModelo;
  lnps: RecomendacaoDoModelo;
  comentarios: ComentarioDoModelo[];
}

/** Faixas do % favorável do Clima: < 50 · 50–64 · 65–79 · ≥ 80. */
export type FaixaClima = "critica" | "atencao" | "boa" | "excelente";

/** Uma dimensão (ou subdimensão) do Clima, com a faixa do % favorável. */
export interface DimensaoClima extends Omit<
  DimensaoDoModelo,
  "faixa" | "subdimensoes"
> {
  faixa: FaixaClima | null;
  subdimensoes?: DimensaoClima[];
}

export interface ResultadoClima {
  modelo: "clima";
  /** O índice: % favorável (4–5) sobre todas as respostas das afirmações. */
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
  /** Respostas das afirmações somadas (favoráveis, neutras, desfavoráveis). */
  notas: { favoraveis: number; neutras: number; desfavoraveis: number };
  /** Média dos scores das afirmações (0–100, inteiro). */
  score: number | null;
  /** A faixa do % favorável. */
  faixa: FaixaClima | null;
  dimensoes: DimensaoClima[];
  afirmacoes: AfirmacaoDoModelo[];
}

/** O índice de uma resposta na lista (aba Respostas). */
export interface ResumoDaRespostaClima {
  modelo: "clima";
  indice: number | null;
  faixa: FaixaClima | null;
}

/** O resultado de uma resposta do Clima, comparado com o time. */
export interface ResultadoIndividualClima {
  modelo: "clima";
  indice: number | null;
  faixa: FaixaClima | null;
  favoraveis: number;
  neutras: number;
  desfavoraveis: number;
  time: { indice: number | null; faixa: FaixaClima | null } | null;
  dimensoes: {
    chave: string;
    rotulo: string;
    indice: number | null;
    faixa: FaixaClima | null;
    time: number | null;
  }[];
  afirmacoes: {
    chave: string;
    perguntaId: string;
    dimensao: string;
    nota: number | null;
    mediaTime: number | null;
    favoravelTime: number | null;
  }[];
  /** Quantas notas 1 a 5 a pessoa deu e o % do time em cada nota. */
  distribuicao: { resposta: number[]; time: number[] | null };
}

export type NivelTad = "alto" | "moderado" | "baixo";

export interface PilarTad {
  chave: string;
  rotulo: string;
  perguntas: number;
  /** De 1 a 7, duas casas. */
  score: number | null;
  nivel: NivelTad | null;
}

export interface ResultadoTad {
  modelo: "tad";
  /** Quem respondeu as afirmações (entra na média do time). */
  respondentes: number;
  /** Média dos scores gerais de cada pessoa (1 a 7, duas casas). */
  geral: number | null;
  nivel: NivelTad | null;
  /** Média dos scores de cada pessoa no pilar. */
  pilares: PilarTad[];
  /** Quantas pessoas em cada nível (pelo score geral de cada uma). */
  niveis: Record<NivelTad, number>;
}

export interface ResultadoIndividualTad {
  modelo: "tad";
  /** Média dos 3 pilares (1 a 7, duas casas). */
  geral: number | null;
  nivel: NivelTad | null;
  pilares: PilarTad[];
}

/** Acrescente aqui o resultado de cada modelo com cálculo próprio. */
export type ResultadoDoModelo =
  | ResultadoPulsoClima
  | ResultadoClima
  | ResultadoTad
  | ResultadoNr1
  | ResultadoIsfb;

export type ResultadoIndividualDoModelo =
  | ResultadoIndividualTad
  | IndividualNr1
  | PessoaIsfb
  | ResultadoIndividualClima;

/** O resumo de uma resposta na lista; acrescente aqui o de cada modelo. */
export type ResumoDaRespostaDoModelo = ResumoDaRespostaClima;

/** Grupo oculto (mesmo motivo dos resultados). */
type MotivoOcultoDoModelo = "minimo" | "protege_grupo_menor";

// ---------------------------------------------------------------------
// Riscos psicossociais (NR-1) e saúde financeira

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
  modelo: "copsoq";
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
  modelo: "isfb";
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
    oculto: MotivoOcultoDoModelo | null;
    saude: Record<SaudeFinanceira, number> | null;
  }[];
}

export interface PessoaIsfb {
  modelo: "isfb";
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
  modelo: "copsoq";
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
