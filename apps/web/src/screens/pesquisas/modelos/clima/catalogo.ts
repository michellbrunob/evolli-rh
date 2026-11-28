/**
 * T216 — Pesquisa de Clima: 60 afirmações de concordância (1 a 5) em 5
 * dimensões × 3 subdimensões × 4 afirmações, e 2 perguntas abertas
 * (obrigatórias). As perguntas são editáveis: o RH muda o texto, remove e
 * acrescenta afirmações (numa dimensão) ou perguntas de texto livre; a API
 * confere só a chave e o tipo.
 */
import { FAIXAS_CLIMA } from "./faixas";
import type {
  ModeloDaGaleria,
  PerguntaDoModelo,
  SecaoDoModelo,
} from "../tipos";

export const DIMENSOES_CLIMA = [
  {
    chave: "credibilidade",
    rotulo: "Credibilidade",
    cor: "--grafico-1",
    texto: "Comunicação, competência e integridade da liderança.",
    subdimensoes: [
      {
        chave: "comunicacao",
        rotulo: "Comunicação",
        itens: [
          "A liderança comunica as decisões com clareza.",
          "Recebo as informações importantes com antecedência.",
          "Entendo as prioridades da empresa pelo que é comunicado.",
          "As mudanças chegam explicadas, com o motivo e o impacto.",
        ],
      },
      {
        chave: "competencia",
        rotulo: "Competência",
        itens: [
          "A liderança tem capacidade para conduzir a empresa.",
          "Confio nas decisões estratégicas da empresa.",
          "A empresa aprende com os problemas e melhora.",
          "As decisões levam em conta dados e a realidade do dia a dia.",
        ],
      },
      {
        chave: "integridade",
        rotulo: "Integridade",
        itens: [
          "O que a liderança diz combina com o que ela faz.",
          "A empresa age com ética.",
          "Posso confiar na liderança.",
          "A liderança cumpre o que promete.",
        ],
      },
    ],
  },
  {
    chave: "respeito",
    rotulo: "Respeito",
    cor: "--grafico-4",
    texto: "Apoio, colaboração e cuidado com as pessoas.",
    subdimensoes: [
      {
        chave: "apoio",
        rotulo: "Apoio",
        itens: [
          "Tenho os recursos e as ferramentas de que preciso.",
          "Tenho autonomia adequada para fazer o meu trabalho.",
          "Meu gestor tira os obstáculos do caminho.",
          "Tenho condições de entregar um trabalho de qualidade.",
        ],
      },
      {
        chave: "colaboracao",
        rotulo: "Colaboração",
        itens: [
          "As áreas cooperam entre si.",
          "As pessoas compartilham o que sabem.",
          "Posso pedir ajuda sem receio.",
          "Há abertura para ideias diferentes.",
        ],
      },
      {
        chave: "cuidado",
        rotulo: "Cuidado",
        itens: [
          "A empresa se preocupa com o meu bem-estar.",
          "Sou tratado como pessoa, não só como profissional.",
          "A carga de trabalho é sustentável.",
          "A empresa respeita os meus limites e o meu equilíbrio.",
        ],
      },
    ],
  },
  {
    chave: "imparcialidade",
    rotulo: "Imparcialidade",
    cor: "--grafico-3",
    texto: "Equidade, imparcialidade e justiça nas decisões.",
    subdimensoes: [
      {
        chave: "equidade",
        rotulo: "Equidade",
        itens: [
          "O reconhecimento é proporcional ao desempenho.",
          "Aqui não há favoritismo.",
          "As promoções são feitas com equidade.",
          "Os critérios de reconhecimento são claros.",
        ],
      },
      {
        chave: "imparcialidade",
        rotulo: "Imparcialidade",
        itens: [
          "As decisões não dependem de preferência pessoal.",
          "Os conflitos são tratados ouvindo todos os lados.",
          "As ideias são consideradas, qualquer que seja o cargo de quem propõe.",
          "Posso discordar sem medo de retaliação.",
        ],
      },
      {
        chave: "justica",
        rotulo: "Justiça",
        itens: [
          "Comportamentos inadequados são tratados com seriedade.",
          "As regras valem do mesmo jeito para todos.",
          "Quando algo dá errado, a correção é justa.",
          "As denúncias são tratadas com responsabilidade.",
        ],
      },
    ],
  },
  {
    chave: "orgulho",
    rotulo: "Orgulho",
    cor: "--grafico-5",
    texto: "Orgulho do próprio trabalho, do time e da empresa.",
    subdimensoes: [
      {
        chave: "trabalho",
        rotulo: "Trabalho",
        itens: [
          "Tenho orgulho do trabalho que faço.",
          "O meu trabalho tem significado para mim.",
          "Fico satisfeito com as minhas entregas.",
          "Recomendaria o meu trabalho a alguém com o meu perfil.",
        ],
      },
      {
        chave: "time",
        rotulo: "Time",
        itens: [
          "Tenho orgulho do meu time.",
          "O meu time se compromete com a qualidade.",
          "O meu time é um bom lugar para crescer.",
          "Confio no meu time.",
        ],
      },
      {
        chave: "empresa",
        rotulo: "Empresa",
        itens: [
          "Tenho orgulho de dizer onde trabalho.",
          "A empresa tem impacto positivo para os clientes e a sociedade.",
          "Acredito no propósito da empresa.",
          "A imagem da empresa lá fora combina com o que vivo aqui dentro.",
        ],
      },
    ],
  },
  {
    chave: "camaradagem",
    rotulo: "Camaradagem",
    cor: "--grafico-2",
    texto: "Proximidade, acolhimento e senso de comunidade.",
    subdimensoes: [
      {
        chave: "proximidade",
        rotulo: "Proximidade",
        itens: [
          "Tenho relações de confiança no trabalho.",
          "Posso ser eu mesmo aqui.",
          "Existe respeito verdadeiro entre as pessoas.",
          "Posso contar com os meus colegas.",
        ],
      },
      {
        chave: "acolhimento",
        rotulo: "Acolhimento",
        itens: [
          "Quem chega é bem integrado.",
          "As pessoas ajudam quem acabou de chegar.",
          "O clima entre as pessoas é amigável.",
          "As comemorações incluem todo mundo.",
        ],
      },
      {
        chave: "comunidade",
        rotulo: "Comunidade",
        itens: [
          "Sinto que faço parte de algo maior.",
          "As pessoas se unem quando é preciso.",
          "As pessoas se apoiam além do que é obrigatório.",
          "Sinto que pertenço a um time.",
        ],
      },
    ],
  },
] as const;

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** O grupo das perguntas abertas (as 2 do modelo e as de texto livre). */
export const TITULO_DAS_ABERTAS = "Perguntas abertas";

/** Prefixo da chave das perguntas abertas. */
export const PREFIXO_DAS_ABERTAS = "clima_aberta_";

const CHAVES_DAS_DIMENSOES: readonly string[] = DIMENSOES_CLIMA.map(
  (d) => d.chave,
);

/**
 * A dimensão de uma afirmação pela chave: `clima_01`…`clima_60` (12 por
 * dimensão, na ordem) ou `clima_<dimensão>_<sufixo>` (acrescentada pelo
 * RH); `null` nas abertas e fora do Clima.
 */
export function dimensaoDaChave(
  chave: string | null | undefined,
): string | null {
  if (!chave || chave.startsWith(PREFIXO_DAS_ABERTAS)) return null;
  const fixa = /^clima_(\d{2})$/.exec(chave);
  if (fixa) {
    const n = Number(fixa[1]);
    return n >= 1 && n <= 60
      ? DIMENSOES_CLIMA[Math.floor((n - 1) / 12)]!.chave
      : null;
  }
  const nova = /^clima_([a-z]+)_[A-Za-z0-9-]+$/.exec(chave);
  return nova && CHAVES_DAS_DIMENSOES.includes(nova[1]!) ? nova[1]! : null;
}

/**
 * A pesquisa usa as telas e exportações próprias do Clima: o modelo é o
 * Clima e a API mandou o resultado do modelo (`null` quando oculto).
 */
export function temTelasDoClima(
  detalhe: { readonly modelo: string },
  geral: { readonly modelo?: unknown },
): boolean {
  return detalhe.modelo === "clima" && geral.modelo !== undefined;
}

/** A chave de uma afirmação nova na dimensão (até 40 caracteres). */
export function chaveNova(dimensao: string | null, id: string): string {
  const sufixo = id.replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "nova";
  return dimensao
    ? `clima_${dimensao}_${sufixo}`
    : `${PREFIXO_DAS_ABERTAS}${sufixo}`;
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "Pesquisa de Clima – Novembro 2026". */
export function nomeDaPesquisaDeClima(hoje: string): string {
  const [ano, mes] = hoje.split("-");
  return `Pesquisa de Clima – ${MESES[Number(mes) - 1] ?? ""} ${ano}`;
}

const SECOES: SecaoDoModelo[] = [
  ...DIMENSOES_CLIMA.map((d, i): SecaoDoModelo => ({
    titulo: d.rotulo,
    descricao: d.texto,
    cor: d.cor,
    perguntas: d.subdimensoes.flatMap((s, j) =>
      s.itens.map((texto, k): PerguntaDoModelo => ({
        chave: `clima_${doisDigitos(i * 12 + j * 4 + k + 1)}`,
        tipo: "concordancia",
        rotulo: `${s.rotulo} ${k + 1}`,
        texto,
        selo: s.rotulo,
      })),
    ),
  })),
  {
    titulo: TITULO_DAS_ABERTAS,
    cor: "--modelo-cinza",
    perguntas: [
      {
        chave: "clima_aberta_01",
        tipo: "paragrafo",
        rotulo: "O que manter",
        texto: "O que a empresa faz hoje que funciona e deve continuar?",
      },
      {
        chave: "clima_aberta_02",
        tipo: "paragrafo",
        rotulo: "O que mudar",
        texto: "Se você pudesse mudar uma coisa primeiro, o que seria?",
      },
    ],
  },
];

export const CLIMA: ModeloDaGaleria = {
  id: "clima",
  modelo: "clima",
  nome: "Pesquisa de Clima",
  categoria: "clima",
  icone: "clima",
  tom: "azul",
  descricao:
    "O clima em 5 dimensões e 15 subdimensões: credibilidade, respeito, imparcialidade, orgulho e camaradagem.",
  fatos: [
    { icone: "dimensoes", texto: "5 dimensões" },
    { icone: "competencias", texto: "15 subdimensões" },
  ],
  ritmo: "Completa · anual",
  frequencia: "Anual",
  sobre:
    "60 afirmações de 1 a 5 em 5 dimensões, mais 2 perguntas abertas. O resultado é o índice do time: o % de respostas favoráveis, no geral e em cada dimensão.",
  nomeBase: "Pesquisa de Clima",
  boasVindas:
    "Queremos entender como é trabalhar aqui hoje. Não existe resposta certa: vale a sua percepção.",
  secoes: SECOES,
  comentarioFinal: null,
  perguntaPadrao: { tipo: "concordancia", config: {} },
  limite: 100,
  nomeDaPesquisa: nomeDaPesquisaDeClima,
  legendaDaEscala: [
    "Escala de concordância de 1 a 5",
    "1 = Discordo totalmente · 5 = Concordo totalmente · 4 e 5 contam como favoráveis",
  ],
  pagina: {
    titulo: "Pesquisa de Clima · O retrato completo",
    selo: "62 perguntas",
    texto:
      "60 afirmações de 1 a 5 em 5 dimensões, mais 2 perguntas abertas. Mostra o índice do time (o % de respostas favoráveis), cada dimensão e onde o clima pede atenção.",
    metadados: [
      "Cerca de 19 minutos para responder",
      "Identificada, CPF confidencial ou anônima",
      "Índice do time de 0% a 100%",
    ],
    botaoVer: "Ver as 62 perguntas",
    botaoCriar: "Criar pesquisa",
    numeros: [
      { valor: "5", rotulo: "dimensões" },
      { valor: "60", rotulo: "afirmações de 1 a 5" },
      { valor: "2", rotulo: "perguntas abertas" },
      { valor: "15 min", rotulo: "para responder" },
    ],
    conteudo: [
      {
        tipo: "grupos",
        titulo: "As 5 dimensões",
        descricao: "12 afirmações em cada uma.",
        itens: DIMENSOES_CLIMA.map((d, i) => ({
          numero: doisDigitos(i + 1),
          titulo: d.rotulo,
          subtitulo: d.texto,
          quantidade: "12",
          cor: d.cor,
        })),
      },
      {
        tipo: "passos",
        titulo: "Como o resultado é calculado",
        descricao:
          "1 Discordo totalmente · 2 Discordo · 3 Neutro · 4 Concordo · 5 Concordo totalmente",
        itens: [
          {
            rotulo: "1",
            titulo: "Cada afirmação de 1 a 5",
            texto: "A pessoa marca o quanto concorda com cada frase.",
          },
          {
            rotulo: "2",
            titulo: "4 e 5 são favoráveis",
            texto: "3 é neutro; 1 e 2 são desfavoráveis.",
          },
          {
            rotulo: "3",
            titulo: "O índice é o % favorável",
            texto:
              "De todas as respostas às afirmações, quantas foram 4 ou 5 — no time e em cada dimensão.",
          },
        ],
      },
    ],
    escalas: [
      {
        titulo: "Concordância de 1 a 5",
        texto:
          "Discordo totalmente · Discordo · Neutro · Concordo · Concordo totalmente",
      },
    ],
    regua: {
      titulo: "As faixas do índice",
      faixas: FAIXAS_CLIMA.map((f) => ({
        rotulo: f.rotulo,
        intervalo: f.intervalo,
        cor: f.cor,
      })),
    },
  },
};
