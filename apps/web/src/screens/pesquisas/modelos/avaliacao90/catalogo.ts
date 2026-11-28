/**
 * T216 — Avaliação 90° (o gestor avalia o time): card, gaveta e página
 * "Sobre o modelo". As 24 afirmações (8 competências × 3), o assistente de
 * gestores e o cálculo ficam com a frente das avaliações: ela preenche
 * `secoes` e tira `grupos`. As competências valem também para o 180°.
 */
import type { BlocoDoSobre, ModeloDaGaleria, PaginaSobre } from "../tipos";

export const COMPETENCIAS = [
  {
    titulo: "Comunicação",
    cor: "--grafico-1",
    eixo: "pessoas",
    texto: "Clareza, escuta e feedback.",
  },
  {
    titulo: "Trabalho em Equipe",
    cor: "--grafico-2",
    eixo: "pessoas",
    texto: "Colaborar, ajudar e gerar confiança.",
  },
  {
    titulo: "Proatividade",
    cor: "--grafico-3",
    eixo: "entrega",
    texto: "Agir antes de pedirem e propor melhorias.",
  },
  {
    titulo: "Organização",
    cor: "--grafico-4",
    eixo: "entrega",
    texto: "Prazos, prioridades e controle.",
  },
  {
    titulo: "Responsabilidade",
    cor: "--grafico-5",
    eixo: "entrega",
    texto: "Compromisso com a entrega e com os próprios erros.",
  },
  {
    titulo: "Adaptabilidade",
    cor: "--grafico-6",
    eixo: "pessoas",
    texto: "Mudanças e vontade de aprender.",
  },
  {
    titulo: "Liderança",
    cor: "--grafico-7",
    eixo: "pessoas",
    texto: "Influenciar, motivar e orientar.",
  },
  {
    titulo: "Resolução de Problemas",
    cor: "--grafico-2",
    eixo: "entrega",
    texto: "Analisar, criar alternativas e decidir bem.",
  },
] as const;

export const GRUPOS_DAS_COMPETENCIAS = COMPETENCIAS.map((c) => ({
  titulo: c.titulo,
  cor: c.cor,
  quantidade: 3,
}));

export const BLOCO_DAS_COMPETENCIAS: BlocoDoSobre = {
  tipo: "grupos",
  titulo: "As 8 competências",
  descricao:
    "3 afirmações em cada uma, iguais para todos os cargos. Elas formam os dois eixos do mapa de talentos.",
  itens: (["entrega", "pessoas"] as const).flatMap((eixo) =>
    COMPETENCIAS.filter((c) => c.eixo === eixo).map((c) => ({
      titulo: c.titulo,
      subtitulo: c.texto,
      selo: eixo === "entrega" ? "Eixo Entrega" : "Eixo Pessoas",
      quantidade: "3 afirmações",
      cor: c.cor,
    })),
  ),
};

export const REGUA_DAS_AVALIACOES: NonNullable<PaginaSobre["regua"]> = {
  titulo: "A régua da nota",
  descricao:
    "Competência = média das 3 afirmações; nota geral = média das 8 competências.",
  faixas: [
    { rotulo: "Insuficiente", intervalo: "1,0 a 1,9", cor: "--faixa-critico" },
    {
      rotulo: "Em desenvolvimento",
      intervalo: "2,0 a 2,9",
      cor: "--modelo-laranja",
    },
    { rotulo: "Bom", intervalo: "3,0 a 3,9", cor: "--faixa-atencao" },
    { rotulo: "Excelente", intervalo: "4,0 a 4,4", cor: "--faixa-saudavel" },
    { rotulo: "Excepcional", intervalo: "4,5 a 5,0", cor: "--faixa-forte" },
  ],
};

export const AVALIACAO_90: ModeloDaGaleria = {
  id: "avaliacao90",
  modelo: "avaliacao90",
  nome: "Avaliação 90°",
  categoria: "desempenho",
  icone: "avaliacao90",
  tom: "esmeralda",
  selo: "novo",
  descricao: "O gestor direto avalia cada pessoa do time em 8 competências.",
  fatos: [
    { icone: "perguntas", texto: "24 perguntas" },
    { icone: "competencias", texto: "8 competências" },
  ],
  ritmo: "Desempenho · semestral",
  frequencia: "A cada 6 meses",
  sobre:
    "O gestor direto avalia cada pessoa do time em 8 competências; mostra destaques, o que desenvolver e se os gestores avaliam com o mesmo critério.",
  nomeBase: "Avaliação 90°",
  boasVindas: null,
  secoes: [],
  grupos: GRUPOS_DAS_COMPETENCIAS,
  comentarioFinal: null,
  perguntaPadrao: { tipo: "escala", config: { minimo: 1, maximo: 5 } },
  limite: 24,
  fixo: true,
  pagina: {
    titulo: "Avaliação 90° · Avaliação de desempenho",
    selo: "24 afirmações",
    texto:
      "O gestor direto avalia cada pessoa do time em 8 competências. O resultado mostra os destaques, o que desenvolver e se os gestores avaliam com o mesmo critério.",
    metadados: [
      "3 a 4 minutos por pessoa",
      "Nominal: só o RH vê as notas",
      "Sugestão: a cada 6 meses",
    ],
    botaoVer: "Ver as 24 afirmações",
    botaoCriar: "Criar avaliação",
    recebe: {
      titulo: "A nota de cada pessoa e o mapa do time",
      itens: [
        {
          titulo: "Nota por pessoa e por competência",
          texto: "De 1 a 5, em 5 níveis.",
        },
        {
          titulo: "Mapa de talentos",
          texto:
            "Entrega × Pessoas: quem é referência e quem precisa de apoio.",
        },
        {
          titulo: "Plano de desenvolvimento",
          texto: "Sugerido para cada pessoa e revisado pelo RH.",
        },
      ],
      exemplo: {
        cabecalho: "Exemplo · 31 pessoas avaliadas",
        destaque: {
          valor: "3,6",
          texto: "nota do time · Bom",
          cor: "--faixa-atencao",
        },
        barras: [
          { rotulo: "Responsabilidade", valor: 4.2, maximo: 5, texto: "4,2" },
          { rotulo: "Trabalho em Equipe", valor: 4, maximo: 5, texto: "4,0" },
          { rotulo: "Organização", valor: 3.5, maximo: 5, texto: "3,5" },
          { rotulo: "Liderança", valor: 2.9, maximo: 5, texto: "2,9" },
        ],
      },
    },
    conteudo: [
      {
        tipo: "passos",
        titulo: "Como funciona",
        descricao: "Um ciclo leva cerca de 30 dias.",
        itens: [
          {
            rotulo: "1",
            titulo: "Você escolhe quem avalia",
            texto:
              "Gestores e times vêm do organograma; dá para mover pessoas e definir o prazo.",
          },
          {
            rotulo: "2",
            titulo: "Cada gestor avalia o time",
            texto:
              "Pelo link, com CPF, uma pessoa por vez: 24 afirmações de 1 a 5.",
          },
          {
            rotulo: "3",
            titulo: "Você vê o resultado",
            texto:
              "Nota por pessoa e competência, mapa de talentos e calibração.",
          },
          {
            rotulo: "4",
            titulo: "Feedback e plano",
            texto: "Um plano por pessoa, revisado pelo RH.",
          },
        ],
      },
      BLOCO_DAS_COMPETENCIAS,
    ],
    ficha: [
      ["Quem avalia", "Gestor direto"],
      ["Formato", "24 afirmações de 1 a 5"],
      ["Tempo", "3 a 4 minutos por pessoa"],
      ["Identificação", "Nominal, por CPF"],
      ["Quem vê", "O RH e quem edita a avaliação"],
      ["Resultado", "Por pessoa, gestor e time"],
    ],
    regua: REGUA_DAS_AVALIACOES,
    uso: "A nota é a percepção de um gestor. Nunca use como critério único para promover ou desligar.",
  },
};
