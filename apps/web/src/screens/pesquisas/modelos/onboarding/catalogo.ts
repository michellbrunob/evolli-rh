/**
 * T216 — Pesquisa de Onboarding: 17 perguntas em 8 blocos, escalas de 4
 * pontos (sem meio-termo), escolhas, a recomendação de 0 a 10 e 2 abertas.
 * O catálogo é desta frente; o envio automático aos 30, 60 e 90 dias e o
 * resultado por rodada ficam com a frente do Onboarding.
 *
 * Papéis (chave → bloco do resultado): q12 motivo, q13 intenção, q14
 * contato, q15 recomendação, q16 o que melhorar, q17 o que a pessoa gosta.
 */
import type { ModeloDaGaleria, PerguntaDoModelo } from "../tipos";
import {
  minutosDaPesquisa,
  perguntasParaOTempo,
  tempoParaResponder,
} from "../../tempoEstimado";

const c4 = (
  chave: string,
  rotulo: string,
  texto: string,
): PerguntaDoModelo => ({
  chave,
  tipo: "concordancia_4",
  rotulo,
  texto,
});

/** "Quer ficar" … "Buscando outro lugar" (rótulos curtos do resultado). */
export const INTENCOES_ONBOARDING = [
  "Quero continuar e não estou buscando outra coisa.",
  "Pretendo continuar, mas às vezes penso em outras opções.",
  "Estou considerando sair nos próximos meses.",
  "Já estou me candidatando ou fazendo entrevistas.",
] as const;

export const ROTULOS_DAS_INTENCOES = [
  "Quer ficar",
  "Fica, mas pensa em opções",
  "Considera sair",
  "Buscando outro lugar",
] as const;

export const ONBOARDING: ModeloDaGaleria = {
  id: "onboarding",
  modelo: "onboarding",
  nome: "Pesquisa de Onboarding",
  categoria: "clima",
  icone: "onboarding",
  tom: "verde",
  selo: "novo",
  descricao:
    "Acompanha a chegada de cada pessoa: a pesquisa sai sozinha aos 30 e aos 60 dias de casa.",
  fatos: [
    { icone: "perguntas", texto: "17 perguntas" },
    { icone: "automatico", texto: "Envio automático" },
  ],
  ritmo: "Envio automático",
  frequencia: "30 e 60 dias após a admissão",
  sobre:
    "17 perguntas em 8 blocos sobre a chegada, a liderança, os colegas, a remuneração, a rotina e a intenção de ficar.",
  nomeBase: "Onboarding",
  nomeDaPesquisa: () => "Onboarding · 30 e 60 dias",
  boasVindas: null,
  secoes: [
    {
      titulo: "Onboarding e treinamento",
      cor: "--grafico-1",
      perguntas: [
        c4(
          "q1",
          "Preparação",
          "O onboarding me preparou para as minhas atividades.",
        ),
        c4(
          "q2",
          "Utilidade",
          "O que aprendi no onboarding continua útil no meu dia a dia.",
        ),
      ],
    },
    {
      titulo: "Liderança",
      cor: "--grafico-2",
      perguntas: [
        c4(
          "q3",
          "Apoio da liderança",
          "Posso contar com a minha liderança direta quando preciso.",
        ),
        c4(
          "q4",
          "Reconhecimento",
          "Minha liderança reconhece quando faço um bom trabalho.",
        ),
      ],
    },
    {
      titulo: "Colegas",
      cor: "--grafico-3",
      perguntas: [
        c4("q5", "Colegas", "Tenho uma boa relação com os meus colegas."),
      ],
    },
    {
      titulo: "Remuneração",
      cor: "--grafico-4",
      perguntas: [
        c4(
          "q6",
          "Clareza da remuneração",
          "Entendo bem os meus benefícios e como a minha remuneração é calculada.",
        ),
        {
          chave: "q7",
          tipo: "satisfacao_4",
          rotulo: "Satisfação com a remuneração",
          texto: "Qual é a sua satisfação com a sua remuneração?",
        },
      ],
    },
    {
      titulo: "Ferramentas e feedback",
      cor: "--grafico-5",
      perguntas: [
        c4(
          "q8",
          "Ferramentas",
          "As ferramentas e os materiais ajudam no meu trabalho.",
        ),
        c4(
          "q9",
          "Feedback",
          "O feedback que recebo deixa claro o que preciso mudar.",
        ),
      ],
    },
    {
      titulo: "Rotina e crescimento",
      cor: "--grafico-6",
      perguntas: [
        c4(
          "q10",
          "Escala",
          "A minha carga horária e a minha escala combinam com a minha vida pessoal.",
        ),
        c4("q11", "Crescimento", "Enxergo um caminho de crescimento aqui."),
      ],
    },
    {
      titulo: "Motivação e permanência",
      cor: "--grafico-7",
      perguntas: [
        {
          chave: "q12",
          tipo: "escolha_unica",
          rotulo: "Motivo para ficar",
          texto:
            "Hoje, qual é o principal motivo para você continuar na empresa?",
          opcoes: [
            "Remuneração ou comissão",
            "Relação com meus colegas",
            "Relação com minha liderança",
            "Horário e flexibilidade da escala",
            "Oportunidade de crescimento",
            "Identificação com o propósito da empresa",
            "Estabilidade financeira e de emprego",
          ],
          config: { outro: true },
        },
        {
          chave: "q13",
          tipo: "escolha_unica",
          rotulo: "Próximos 6 meses",
          texto:
            "Qual frase descreve melhor a sua situação nos próximos 6 meses?",
          opcoes: INTENCOES_ONBOARDING,
          config: { outro: false },
        },
        {
          chave: "q14",
          tipo: "texto_curto",
          rotulo: "Contato",
          texto:
            "Se quiser conversar com o RH, deixe um telefone ou e-mail para contato.",
          descricao:
            "Ao deixar um contato, o RH saberá que esta resposta é sua.",
          obrigatoria: false,
        },
        {
          chave: "q15",
          tipo: "nota_0_10",
          rotulo: "Recomendação",
          texto:
            "De 0 a 10, quanto você recomendaria a empresa para um amigo trabalhar?",
          config: { enps: true },
        },
      ],
    },
    {
      titulo: "Para fechar",
      cor: "--grafico-8",
      perguntas: [
        {
          chave: "q16",
          tipo: "paragrafo",
          rotulo: "O que melhorar",
          texto: "O que a empresa poderia ter feito diferente na sua chegada?",
          obrigatoria: false,
        },
        {
          chave: "q17",
          tipo: "paragrafo",
          rotulo: "O que manter",
          texto: "O que a empresa faz hoje que você gosta?",
          obrigatoria: false,
        },
      ],
    },
  ],
  comentarioFinal: null,
  perguntaPadrao: { tipo: "concordancia_4", config: {} },
  limite: 40,
  minimo: 1,
  pagina: {
    titulo: "Onboarding · Envio automático",
    selo: "17 perguntas",
    texto:
      "Acompanha a chegada de cada pessoa aos 30 e aos 60 dias de casa. A pesquisa sai sozinha na data de cada uma, e as rodadas são comparadas.",
    get metadados() {
      return [
        `${tempoParaResponder("onboarding", perguntasParaOTempo(ONBOARDING.secoes))} para responder`,
        "CPF confidencial",
        "Média por bloco, de 0 a 100, em cada rodada",
      ];
    },
    botaoVer: "Ver as perguntas",
    botaoCriar: "Criar pesquisa",
    get numeros() {
      return [
        { valor: "17", rotulo: "perguntas em 8 blocos" },
        {
          valor: String(
            minutosDaPesquisa(
              "onboarding",
              perguntasParaOTempo(ONBOARDING.secoes),
            ),
          ),
          rotulo: "minutos para responder",
        },
        { valor: "30 e 60", rotulo: "dias (90 opcional)" },
        { valor: "Automático", rotulo: "na data de cada pessoa" },
      ];
    },
    recebe: {
      titulo: "A média de cada bloco, de 0 a 100, em cada rodada",
      itens: [
        {
          titulo: "Índice por bloco",
          texto: "Cada rodada lado a lado, com o que mudou.",
        },
        {
          titulo: "Intenção de ficar",
          texto: "Como ela muda entre as rodadas.",
        },
        {
          titulo: "Motivos para ficar",
          texto: "O que mais segura as pessoas.",
        },
      ],
      exemplo: {
        cabecalho: "Exemplo · 2 rodadas",
        tabela: {
          colunas: ["Bloco", "30 dias", "60 dias", "Mudou"],
          linhas: [
            ["Onboarding e treinamento", "78", "71", "−7"],
            ["Liderança", "82", "84", "+2"],
            ["Colegas", "88", "90", "+2"],
          ],
        },
        rodape:
          "Quer continuar nos próximos 6 meses: 84% aos 30 dias e 79% aos 60.",
      },
    },
    conteudo: [
      {
        tipo: "passos",
        titulo: "Como funciona",
        descricao:
          "Você cria uma vez. Cada pessoa recebe o convite na data dela, contada a partir da admissão.",
        itens: [
          {
            rotulo: "Dia 0",
            titulo: "Admissão",
            texto: "A pessoa entra no cadastro e a contagem começa.",
          },
          {
            rotulo: "Dia 30",
            titulo: "1ª rodada",
            texto: "Chegada, treinamento e liderança.",
          },
          {
            rotulo: "Dia 60",
            titulo: "2ª rodada",
            texto: "As mesmas perguntas, para ver o que mudou.",
          },
          {
            rotulo: "Dia 90 · opcional",
            titulo: "3ª rodada",
            texto: "No fim do contrato de experiência.",
          },
        ],
      },
      {
        tipo: "grupos",
        titulo: "O que a pesquisa pergunta",
        descricao:
          "8 blocos com o que mais pesa na saída nos primeiros meses. Dá para editar, incluir ou tirar perguntas.",
        itens: [
          {
            titulo: "Onboarding e treinamento",
            quantidade: "2 perguntas",
            cor: "--grafico-1",
          },
          {
            titulo: "Liderança",
            quantidade: "2 perguntas",
            cor: "--grafico-2",
          },
          { titulo: "Colegas", quantidade: "1 pergunta", cor: "--grafico-3" },
          {
            titulo: "Remuneração",
            quantidade: "2 perguntas",
            cor: "--grafico-4",
          },
          {
            titulo: "Ferramentas e feedback",
            quantidade: "2 perguntas",
            cor: "--grafico-5",
          },
          {
            titulo: "Rotina e crescimento",
            quantidade: "2 perguntas",
            cor: "--grafico-6",
          },
          {
            titulo: "Motivação e permanência",
            subtitulo: "Por que fica, se pensa em sair e a recomendação.",
            quantidade: "4 perguntas",
            cor: "--grafico-7",
          },
          {
            titulo: "Para fechar",
            subtitulo: "O que melhorar e o que manter.",
            quantidade: "2 perguntas",
            cor: "--grafico-8",
          },
        ],
      },
    ],
    get ficha(): readonly (readonly [string, string])[] {
      return [
        ["Perguntas", "17 em 8 blocos"],
        [
          "Tempo",
          tempoParaResponder(
            "onboarding",
            perguntasParaOTempo(ONBOARDING.secoes),
          ),
        ],
        ["Escalas", "4 pontos, sem meio-termo"],
        ["Recomendação", "De 0 a 10"],
        ["Identificação", "CPF confidencial"],
        ["Envio", "Agora, agendado ou automático"],
      ];
    },
    escalas: [
      {
        titulo: "Concordância · 4 pontos",
        texto:
          "Discordo totalmente · Discordo parcialmente · Concordo parcialmente · Concordo totalmente",
      },
      {
        titulo: "Satisfação · 4 pontos",
        texto:
          "Muito insatisfeito · Insatisfeito · Satisfeito · Muito satisfeito",
      },
    ],
    regua: {
      titulo: "As faixas do índice (0 a 100)",
      descricao: "Cada resposta de 4 pontos vira 0, 33, 67 ou 100.",
      faixas: [
        {
          rotulo: "Crítico",
          intervalo: "abaixo de 50",
          cor: "--faixa-critico",
        },
        { rotulo: "Atenção", intervalo: "50 a 69", cor: "--faixa-atencao" },
        { rotulo: "Saudável", intervalo: "70 a 84", cor: "--faixa-saudavel" },
        { rotulo: "Forte", intervalo: "85 ou mais", cor: "--faixa-forte" },
      ],
    },
  },
};
