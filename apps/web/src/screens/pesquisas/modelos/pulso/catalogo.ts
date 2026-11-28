/**
 * T216 — Pesquisa Pulso: 5 afirmações de 1 a 10, o eNPS (0 a 10) e um
 * comentário curto opcional. De 1 a 15 perguntas (dá para incluir e tirar).
 */
import type { ConfigPergunta } from "../../../../api/pesquisasClient";
import type { ModeloDaGaleria } from "../tipos";
import { perguntasParaOTempo, tempoNoTexto } from "../../tempoEstimado";

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
  get boasVindas() {
    return `São poucas perguntas e leva ${tempoNoTexto(perguntasParaOTempo(PULSO.secoes, PULSO.comentarioFinal))}. Responda pensando nas últimas semanas.`;
  },
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
    layout: "perguntas",
    titulo: "Pesquisa Pulso · Leitura rápida e frequente",
    selo: "5 perguntas",
    texto:
      "Cinco afirmações de 1 a 10 e o eNPS mostram como o time está, sem tomar tempo. Repetida todo mês, mostra a tendência antes que um problema cresça.",
    metadados: [],
    botaoVer: "Ver as perguntas",
    botaoCriar: "Criar pesquisa",
    numeros: [
      { valor: "5", rotulo: "perguntas de 1 a 10" },
      { valor: "1", rotulo: "de recomendação (eNPS)" },
      { valor: "1", rotulo: "comentário opcional" },
      { valor: "Mensal", rotulo: "frequência sugerida" },
    ],
    conteudo: [],
  },
};
