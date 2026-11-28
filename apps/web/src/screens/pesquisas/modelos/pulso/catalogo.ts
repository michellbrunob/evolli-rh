/**
 * T216 — Pesquisa Pulso: 5 afirmações de 1 a 10, o eNPS (0 a 10) e um
 * comentário curto opcional. De 1 a 15 perguntas (dá para incluir e tirar).
 */
import type { ConfigPergunta } from "../../../../api/pesquisasClient";
import type { ModeloDaGaleria } from "../tipos";

export const ESCALA_1_10: Omit<ConfigPergunta, "opcoes"> = {
  minimo: 1,
  maximo: 10,
  rotuloMinimo: "Discordo totalmente",
  rotuloMaximo: "Concordo totalmente",
};

const escala = (chave: string, rotulo: string, texto: string) => ({
  chave,
  tipo: "escala" as const,
  rotulo,
  texto,
  config: ESCALA_1_10,
});

export const PULSO: ModeloDaGaleria = {
  id: "pulso",
  modelo: "pulso",
  nome: "Pesquisa Pulso",
  categoria: "clima",
  icone: "pulso",
  tom: "rosa",
  recomendado: true,
  descricao:
    "Cinco perguntas rápidas de 1 a 10 para acompanhar o time de perto. Dá para incluir ou tirar perguntas.",
  fatos: [
    { icone: "perguntas", texto: "5 perguntas" },
    { icone: "escala", texto: "Escala 1–10" },
  ],
  ritmo: "Rápida · recorrente",
  frequencia: "Mensal",
  sobre:
    "Mede em poucos minutos permanência, clareza, apoio da gestão, reconhecimento e orgulho, com o eNPS. Feita para repetir todo mês.",
  nomeBase: "Pulso",
  boasVindas:
    "São poucas perguntas e leva cerca de 2 minutos. Responda pensando nas últimas semanas.",
  secoes: [
    {
      titulo: null,
      perguntas: [
        escala(
          "pulso_permanencia",
          "Permanência",
          "Eu me vejo trabalhando na {empresa} daqui a 12 meses.",
        ),
        escala(
          "pulso_clareza",
          "Clareza",
          "Sei com clareza o que esperam do meu trabalho.",
        ),
        escala(
          "pulso_apoio_gestao",
          "Apoio da gestão",
          "Recebo da gestão o apoio de que preciso para fazer bem o meu trabalho.",
        ),
        escala(
          "pulso_reconhecimento",
          "Reconhecimento",
          "Sinto que o meu trabalho é reconhecido.",
        ),
        escala(
          "pulso_orgulho",
          "Orgulho",
          "Tenho orgulho de fazer parte da {empresa}.",
        ),
        {
          chave: "pulso_enps",
          tipo: "nota_0_10",
          rotulo: "eNPS",
          texto:
            "De 0 a 10, quanto você indicaria a {empresa} como um bom lugar para trabalhar?",
          obrigatoria: false,
          config: { enps: true },
        },
      ],
    },
  ],
  comentarioFinal: "Quer deixar algum comentário ou sugestão?",
  tipoDoComentario: "texto_curto",
  perguntaPadrao: { tipo: "escala", config: ESCALA_1_10 },
  limite: 15,
  minimo: 1,
  pagina: {
    titulo: "Pesquisa Pulso · Leitura rápida e frequente",
    selo: "5 perguntas",
    texto:
      "Cinco afirmações de 1 a 10 e o eNPS mostram como o time está, sem tomar tempo. Repetida todo mês, mostra a tendência antes que um problema cresça.",
    metadados: [
      "Cerca de 2 minutos para responder",
      "Identificada, CPF confidencial ou anônima",
      "Média por pergunta e eNPS",
    ],
    botaoVer: "Ver as perguntas",
    botaoCriar: "Criar pesquisa",
    recebe: {
      titulo: "Um termômetro do time, mês a mês",
      itens: [
        {
          titulo: "Média geral e por pergunta",
          texto: "De 1 a 10, com a distribuição das notas e o % favorável.",
        },
        {
          titulo: "eNPS",
          texto: "Promotores menos detratores, de −100 a 100.",
        },
        {
          titulo: "Evolução",
          texto: "A média de cada Pulso, lado a lado com os anteriores.",
        },
      ],
      exemplo: {
        cabecalho: "Exemplo · 24 respostas",
        destaque: {
          valor: "7,8",
          sufixo: "/10",
          texto: "média geral do time",
          cor: "--faixa-saudavel",
        },
        barras: [
          { rotulo: "Clareza", valor: 8.4, maximo: 10, texto: "8,4" },
          { rotulo: "Orgulho", valor: 8.1, maximo: 10, texto: "8,1" },
          { rotulo: "Permanência", valor: 7.9, maximo: 10, texto: "7,9" },
          { rotulo: "Apoio da gestão", valor: 7.4, maximo: 10, texto: "7,4" },
          { rotulo: "Reconhecimento", valor: 6.8, maximo: 10, texto: "6,8" },
        ],
      },
    },
    conteudo: [],
    ficha: [
      ["Perguntas", "5 de 1 a 10, eNPS e comentário"],
      ["Tempo", "Cerca de 2 minutos"],
      ["Edição", "De 1 a 15 perguntas"],
      ["Frequência", "Mensal"],
    ],
    escalas: [
      {
        titulo: "Concordância de 1 a 10",
        texto: "1 = Discordo totalmente · 10 = Concordo totalmente",
      },
      {
        titulo: "eNPS de 0 a 10",
        texto: "9 e 10 promotores · 0 a 6 detratores",
      },
    ],
  },
};
