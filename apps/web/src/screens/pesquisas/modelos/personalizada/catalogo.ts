/**
 * T216 — Personalizada: o card da galeria e os 6 modelos prontos da página
 * da Personalizada (Integração 1, Desempenho 2, Satisfação 2, Desligamento
 * 1). Todos nascem como `personalizada` e abrem o assistente de 5 etapas
 * com as perguntas já preenchidas. Os formatos com gestor ("Gestor avalia o
 * time", 180°) ficam indicados no card; responder pelo gestor depende do
 * acesso do gestor (fora desta frente).
 */
import type { ModeloDaGaleria, PerguntaDoModelo } from "../tipos";

const CONCORDANCIA: PerguntaDoModelo["tipo"] = "concordancia";

const c = (
  texto: string,
  rotulo: string,
  obrigatoria = true,
): PerguntaDoModelo => ({
  tipo: CONCORDANCIA,
  texto,
  rotulo,
  obrigatoria,
});

const comum = {
  modelo: "personalizada" as const,
  icone: "maleta" as const,
  tom: "cinza" as const,
  comentarioFinal: null,
  perguntaPadrao: { tipo: "concordancia" as const, config: {} },
  limite: 100,
  boasVindas: null,
};

export const PERSONALIZADA: ModeloDaGaleria = {
  ...comum,
  id: "personalizada",
  icone: "personalizada",
  nome: "Personalizada",
  categoria: "outros",
  descricao:
    "Comece por um modelo pronto ou do zero: 13 tipos de pergunta, seções e condições.",
  fatos: [{ icone: "personalizada", texto: "Perguntas suas" }],
  ritmo: "Do seu jeito",
  frequencia: "Quando precisar",
  sobre:
    "Para o que os modelos prontos não cobrem: você monta as seções, as perguntas e as condições.",
  nomeBase: "Pesquisa",
  secoes: [{ titulo: null, perguntas: [] }],
};

export const SUBMODELOS_PERSONALIZADA: readonly ModeloDaGaleria[] = [
  {
    ...comum,
    id: "onboarding-30",
    nome: "Onboarding · 30 dias",
    categoria: "integracao",
    formato: "Cada pessoa responde",
    descricao: "Como foram a chegada, o time e a liderança no primeiro mês.",
    fatos: [{ icone: "perguntas", texto: "8 perguntas · 3 min" }],
    ritmo: "Integração",
    frequencia: "30 dias após a admissão",
    sobre:
      "Confere a recepção, os acessos, o acolhimento do time e a clareza do papel.",
    nomeBase: "Onboarding · 30 dias de casa",
    secoes: [
      {
        titulo: "Sua chegada",
        perguntas: [
          c(
            "No primeiro dia, recebi as informações de que precisava.",
            "Informações do 1º dia",
          ),
          {
            ref: "acessos",
            tipo: "escolha_unica",
            rotulo: "Acessos e equipamento",
            texto:
              "No primeiro dia, os seus acessos e o equipamento estavam prontos?",
            opcoes: ["Sim, tudo pronto", "Só uma parte", "Não recebi"],
          },
          {
            tipo: "paragrafo",
            rotulo: "O que faltou",
            texto: "O que faltou e quanto tempo levou para resolver?",
            condicao: { ref: "acessos", opcao: 2 },
          },
        ],
      },
      {
        titulo: "Seu time e sua liderança",
        perguntas: [
          {
            tipo: "estrelas",
            rotulo: "Acolhimento",
            texto: "Como o time recebeu você?",
          },
          c(
            "Meu gestor deixou claro o que espera de mim.",
            "Expectativas claras",
          ),
          {
            tipo: "multipla_escolha",
            rotulo: "O que ajudou",
            texto: "O que mais ajudou nas primeiras semanas?",
            descricao: "Marque até duas.",
            opcoes: [
              "Meu gestor",
              "Meus colegas",
              "Padrinho ou madrinha",
              "Treinamentos",
              "Materiais",
            ],
            config: { outro: true, maximo: 2 },
          },
        ],
      },
      {
        titulo: "Para fechar",
        perguntas: [
          {
            tipo: "nota_0_10",
            rotulo: "Indicação",
            texto: "De 0 a 10, quanto você indicaria a empresa para trabalhar?",
            config: { enps: true },
          },
          {
            tipo: "texto_curto",
            rotulo: "Uma palavra",
            texto: "Que palavra resume o seu primeiro mês?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    ...comum,
    id: "experiencia-90",
    nome: "Experiência · 90 dias",
    categoria: "desempenho",
    formato: "Gestor avalia o time",
    descricao:
      "Perto do fim do contrato de experiência: entregas, comportamento e a decisão.",
    fatos: [{ icone: "perguntas", texto: "10 perguntas · 4 min" }],
    ritmo: "Desempenho",
    frequencia: "Perto do fim da experiência",
    sobre:
      "O gestor avalia entregas e comportamento e recomenda efetivar ou não.",
    nomeBase: "Experiência · 90 dias",
    secoes: [
      {
        titulo: "Entregas",
        perguntas: [
          c("Entrega no prazo combinado.", "Prazo"),
          c("Entrega com a qualidade esperada.", "Qualidade"),
          c("Aprende rápido o que precisa.", "Aprendizado"),
        ],
      },
      {
        titulo: "Comportamento",
        perguntas: [
          c("Pede e oferece ajuda quando precisa.", "Colaboração"),
          c("Avisa cedo quando surge um problema.", "Comunicação"),
          c("Se adaptou bem ao time.", "Adaptação"),
        ],
      },
      {
        titulo: "Decisão",
        perguntas: [
          {
            tipo: "escolha_unica",
            rotulo: "Recomendação",
            texto: "Qual é a sua recomendação?",
            opcoes: [
              "Efetivar",
              "Efetivar com um plano de desenvolvimento",
              "Conversar com o RH antes de decidir",
            ],
          },
          {
            tipo: "paragrafo",
            rotulo: "O que faz bem",
            texto: "O que essa pessoa faz muito bem?",
          },
          {
            tipo: "paragrafo",
            rotulo: "O que desenvolver",
            texto: "O que ela precisa desenvolver?",
          },
          {
            tipo: "texto_curto",
            rotulo: "Para o RH",
            texto: "Quer dizer mais alguma coisa ao RH?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    ...comum,
    id: "avaliacao-180-personalizada",
    nome: "Avaliação 180°",
    categoria: "desempenho",
    formato: "Gestor e autoavaliação (180°)",
    descricao:
      "Gestor e pessoa avaliam entregas e comportamento, com espaço para exemplos.",
    fatos: [{ icone: "perguntas", texto: "8 perguntas · 4 min" }],
    ritmo: "Desempenho",
    frequencia: "Semestral ou anual",
    sobre: "As mesmas perguntas para o gestor e para a pessoa, lado a lado.",
    nomeBase: "Avaliação 180°",
    secoes: [
      {
        titulo: "Entregas",
        perguntas: [
          c("Cumpre os combinados e os prazos.", "Combinados"),
          c("Entrega com qualidade.", "Qualidade"),
          {
            tipo: "paragrafo",
            rotulo: "Entrega recente",
            texto:
              "Conte uma entrega recente que mostra o melhor dessa pessoa.",
            obrigatoria: false,
          },
        ],
      },
      {
        titulo: "Comportamento",
        perguntas: [
          c("Pede e oferece ajuda.", "Colaboração"),
          c("Avisa cedo quando algo pode dar errado.", "Comunicação"),
          c("Busca aprender coisas novas.", "Aprendizado"),
          c("Recebe feedback e muda o que precisa.", "Feedback"),
          {
            tipo: "paragrafo",
            rotulo: "O que desenvolver",
            texto: "O que precisa desenvolver?",
          },
        ],
      },
    ],
  },
  {
    ...comum,
    id: "beneficios",
    nome: "Satisfação com benefícios",
    categoria: "satisfacao",
    formato: "Cada pessoa responde",
    descricao:
      "Quais benefícios as pessoas usam, quais pesam para ficar e o que falta.",
    fatos: [{ icone: "perguntas", texto: "6 perguntas · 2 min" }],
    ritmo: "Satisfação",
    frequencia: "Antes de renovar contratos",
    sobre:
      "Mostra o uso de cada benefício, o que é mais valorizado e o que atrapalha.",
    nomeBase: "Benefícios",
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "multipla_escolha",
            rotulo: "Uso nos últimos 3 meses",
            texto: "Quais benefícios você usou nos últimos 3 meses?",
            opcoes: [
              "Vale-refeição ou alimentação",
              "Plano de saúde",
              "Plano odontológico",
              "Vale-transporte",
              "Auxílio home office",
              "Academia ou bem-estar",
              "Seguro de vida",
            ],
            config: { outro: true },
          },
          {
            tipo: "estrelas",
            rotulo: "Conjunto",
            texto: "No geral, como você avalia os benefícios?",
          },
          c("Sei como usar cada benefício.", "Sabe usar"),
          {
            tipo: "escolha_unica",
            rotulo: "Benefício desejado",
            texto: "Qual benefício novo faria mais diferença para você?",
            opcoes: [
              "Auxílio educação",
              "Previdência privada",
              "Folga no aniversário",
              "Auxílio creche",
              "Mais vale-refeição",
            ],
            config: { outro: true },
          },
          {
            tipo: "nota_0_10",
            rotulo: "Peso para ficar",
            texto:
              "De 0 a 10, quanto os benefícios pesam para você continuar aqui?",
            config: {
              enps: false,
              rotuloMinimo: "Nada",
              rotuloMaximo: "Muito",
            },
          },
          {
            tipo: "paragrafo",
            rotulo: "O que atrapalha",
            texto: "Algo atrapalha o uso dos benefícios?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    ...comum,
    id: "treinamento",
    nome: "Avaliação de treinamento",
    categoria: "satisfacao",
    formato: "Cada pessoa responde",
    descricao:
      "Até 7 dias depois: conteúdo, instrutor e o quanto ajudou na prática.",
    fatos: [{ icone: "perguntas", texto: "7 perguntas · 2 min" }],
    ritmo: "Satisfação",
    frequencia: "Até 7 dias depois",
    sobre:
      "Avalia conteúdo e instrutor e mede quanto do aprendizado chega ao dia a dia.",
    nomeBase: "Treinamento",
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "estrelas",
            rotulo: "Conteúdo",
            texto: "Como você avalia o conteúdo?",
          },
          {
            tipo: "estrelas",
            rotulo: "Instrutor",
            texto: "Como você avalia o instrutor?",
          },
          {
            tipo: "escala",
            rotulo: "Ajuda no dia a dia",
            texto: "Quanto o treinamento vai ajudar no seu dia a dia?",
            config: {
              minimo: 1,
              maximo: 7,
              rotuloMinimo: "Nada",
              rotuloMaximo: "Muito",
            },
          },
          c("A carga horária foi adequada.", "Carga horária"),
          {
            tipo: "sim_nao",
            rotulo: "Recomendaria",
            texto: "Você recomendaria este treinamento a um colega?",
            config: { respostaBoa: "sim" },
          },
          {
            tipo: "paragrafo",
            rotulo: "O que melhorar",
            texto: "O que pode melhorar?",
            obrigatoria: false,
          },
          {
            tipo: "texto_curto",
            rotulo: "Próximo tema",
            texto: "Que tema você gostaria no próximo treinamento?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
  {
    ...comum,
    id: "desligamento",
    nome: "Entrevista de desligamento",
    categoria: "saida",
    formato: "Cada pessoa responde",
    descricao:
      "Na última semana: o motivo da saída e o que a empresa pode aprender.",
    fatos: [{ icone: "perguntas", texto: "8 perguntas · 3 min" }],
    ritmo: "Desligamento",
    frequencia: "Na última semana",
    sobre:
      "Registra o motivo principal, o que poderia ter feito a pessoa ficar e como ela viu a empresa.",
    nomeBase: "Desligamento",
    secoes: [
      {
        titulo: null,
        perguntas: [
          {
            tipo: "escolha_unica",
            rotulo: "Motivo principal",
            texto: "Qual é o principal motivo da sua saída?",
            opcoes: [
              "Proposta com salário maior",
              "Falta de crescimento",
              "Relação com a liderança",
              "Ambiente de trabalho",
              "Motivos pessoais",
              "Mudança de carreira",
            ],
            config: { outro: true },
          },
          {
            ref: "ficaria",
            tipo: "sim_nao",
            rotulo: "Poderia ter ficado",
            texto: "Algo poderia ter feito você ficar?",
            config: { respostaBoa: null },
          },
          {
            tipo: "paragrafo",
            rotulo: "O que faria ficar",
            texto: "O que poderia ter feito você ficar?",
            condicao: { ref: "ficaria", opcao: "sim" },
          },
          c("Eu me senti valorizado.", "Valorizado"),
          c("Meu gestor me ajudou a crescer.", "Crescimento"),
          c("Eu tinha as ferramentas de que precisava.", "Ferramentas"),
          {
            tipo: "nota_0_10",
            rotulo: "Indicação",
            texto: "De 0 a 10, quanto você indicaria a empresa para trabalhar?",
            config: { enps: true },
          },
          {
            tipo: "paragrafo",
            rotulo: "Recado ao RH",
            texto: "Quer deixar um recado para o RH?",
            obrigatoria: false,
          },
        ],
      },
    ],
  },
];
