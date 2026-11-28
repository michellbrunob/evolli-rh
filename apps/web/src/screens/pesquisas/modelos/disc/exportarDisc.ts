/**
 * T216 — Perfil comportamental (DISC): a planilha (.xlsx), gerada no
 * navegador, em 7 abas: Resumo, Participantes, Análise do perfil, Plano de
 * ação, Compatibilidade, Diversidade do time e Glossário.
 *
 * Privacidade: as pessoas só saem quando a API as manda (RH e DP, na
 * identificada com o nome e na anônima numeradas); a confidencial nunca
 * tem a aba de pessoas preenchida. Nada leva CPF.
 */
import type { PesquisaDetalhe } from "../../../../api/pesquisasClient";
import { formatarDiaCivil } from "../../../../format/data";
import {
  type AbaXlsx,
  type CelulaXlsx,
  montarXlsx,
} from "../../../pessoas/importacao/planilhaXlsx";
import { dataDoInstante, ROTULO_DO_STATUS } from "../../textosDasPesquisas";
import { PARES, ROTULO_DA_RELACAO, areaPorId } from "./areas";
import { FATOR, FATORES, type FatorDisc } from "./fatores";
import { ROTULO_DA_DIVERSIDADE, TEXTO_DA_DIVERSIDADE } from "./graficosDisc";
import {
  ROTULO_DA_INTENSIDADE,
  TEXTO_DA_INTENSIDADE,
  codigoDoPerfil,
  conteudoDoPerfil,
} from "./perfis";
import type { ResultadoDisc } from "./tiposDisc";

/** Nome da cor de cada fator (a planilha não leva código de cor). */
const COR: Readonly<Record<FatorDisc, string>> = {
  D: "Vermelho",
  I: "Laranja",
  S: "Verde",
  C: "Azul",
};

const numerada = (itens: readonly string[]) =>
  itens.map((t, i) => `${i + 1}. ${t}`).join("\n");

const pct = (n: number) => ({
  numero: n / 100,
  formato: "percentual" as const,
});

export function planilhaDisc(
  detalhe: PesquisaDetalhe,
  r: ResultadoDisc,
  empresa: string,
  hoje: string,
): Uint8Array {
  const linhaDoCabecalho = `Empresa: ${empresa || "—"} | Status: ${ROTULO_DO_STATUS[detalhe.status]} | Criada em: ${dataDoInstante(detalhe.criadaEm)} | Gerada em: ${formatarDiaCivil(hoje)}`;
  const aba = (
    nome: string,
    titulo: string,
    cabecalho: CelulaXlsx[],
    linhas: CelulaXlsx[][],
    larguras: number[],
  ): AbaXlsx => ({
    nome,
    titulo: true,
    linhasDeCabecalho: cabecalho.length ? [2] : [],
    larguras,
    linhas: [
      [titulo],
      [linhaDoCabecalho],
      ...(cabecalho.length ? [cabecalho] : []),
      ...linhas,
    ],
  });
  const time = r.perfil;
  const c = time ? conteudoDoPerfil(time.classe) : null;
  const pessoas = r.totalDePessoas;
  const predominante = time?.predominante ?? null;
  const abas: AbaXlsx[] = [];

  // 1. Resumo.
  abas.push(
    aba(
      "Resumo",
      `DISC — ${detalhe.nome}`,
      ["Fator", "Nome", "%", "Pontos", "Cor", "Descrição"],
      [
        ...FATORES.map((f): CelulaXlsx[] => [
          f,
          FATOR[f].nome,
          pct(time?.percentuais[f] ?? 0),
          time?.pontos[f] ?? 0,
          COR[f],
          `${FATOR[f].frase} ${FATOR[f].resumo}`,
        ]),
        [],
        [
          "Perfil do time",
          time && c
            ? `${c.titulo} (${codigoDoPerfil(time.classe)})`
            : "Sem respostas",
        ],
        [
          "Fator predominante",
          predominante ? `${predominante} · ${FATOR[predominante].nome}` : "—",
        ],
        ["Pessoas com perfil", pessoas],
        ["Respostas", r.respostas],
      ],
      [22, 18, 10, 10, 12, 80],
    ),
  );

  // 2. Participantes.
  abas.push(
    aba(
      "Participantes",
      "Participantes — perfil de cada pessoa",
      [
        "Nome",
        "Perfil",
        "D (%)",
        "I (%)",
        "S (%)",
        "C (%)",
        "Fator",
        "Departamento",
      ],
      r.pessoas.length
        ? r.pessoas.map((p): CelulaXlsx[] => [
            p.nome ?? `Resposta ${p.numero}`,
            p.perfil.predominante,
            p.perfil.percentuais.D,
            p.perfil.percentuais.I,
            p.perfil.percentuais.S,
            p.perfil.percentuais.C,
            FATOR[p.perfil.predominante].nome,
            p.departamento ?? "",
          ])
        : [
            [
              detalhe.identificacao === "confidencial"
                ? "Pesquisa confidencial: os perfis aparecem só agrupados."
                : "Sem respostas individuais para mostrar.",
            ],
          ],
      [30, 8, 8, 8, 8, 8, 16, 24],
    ),
  );

  // 3. Análise do perfil (do time).
  abas.push(
    aba(
      "Análise do perfil",
      `Análise do perfil — ${c?.titulo ?? "sem respostas"}`,
      [],
      time && c
        ? [
            ["Identidade"],
            ["Perfil", `${c.titulo} (${codigoDoPerfil(time.classe)})`],
            ["Intensidade", ROTULO_DA_INTENSIDADE[time.classe.intensidade]],
            ["Sujeito", "O time"],
            [
              "Distribuição",
              FATORES.map((f) => `${f} ${time.percentuais[f]}%`).join(" · "),
            ],
            ["Entendendo o perfil"],
            ["Sobre o perfil", c.resumo],
            [
              "O que a intensidade quer dizer",
              TEXTO_DA_INTENSIDADE[time.classe.intensidade],
            ],
            [
              "Sobre o fator principal",
              `${FATOR[c.principal].nome} (${c.principal}) — ${FATOR[c.principal].focoAnalisado}.`,
            ],
            ["Valor para a empresa", c.valor],
            ["O que move"],
            ["Medo básico", c.medo],
            ["O que motiva", c.motivacao],
            ["O que valoriza", c.valoriza],
            ["Pontos fortes e de atenção"],
            ["Pontos fortes", numerada(c.fortes)],
            ["Pontos de atenção", numerada(c.atencao)],
            ["Estilo e ambiente"],
            ["Estilo de comunicação", c.comunicacao],
            ["Estilo de liderança", c.lideranca],
            ["Ambiente ideal", c.ambiente],
            ["O que gera estresse", numerada(c.estresse)],
            [
              "Centro do time no mapa",
              areaPorId(time.posicao.area)?.nome ?? "—",
            ],
            ["Síntese", c.sintese],
          ]
        : [["Sem respostas suficientes para mostrar o perfil do time."]],
      [32, 100],
    ),
  );

  // 4. Plano de ação.
  abas.push(
    aba(
      "Plano de ação",
      "Plano de ação — como agir a partir do perfil do time",
      ["Categoria", "Recomendação", "Itens"],
      c
        ? [
            [
              "Onde brilha",
              "Dê ao time projetos que pedem",
              numerada(c.fortes),
            ],
            ["Tenha cuidado", "Acompanhe de perto", numerada(c.atencao)],
            [
              "Como dar retorno",
              "Ao conversar com o time",
              numerada(c.feedback),
            ],
            ["Como motivar", "O time se engaja quando", numerada(c.motivar)],
            [
              "Plano de 30, 60 e 90 dias",
              "Roteiro de desenvolvimento sugerido",
              numerada(
                FATOR[c.principal].plano.map(
                  (t, i) => `${[30, 60, 90][i]} dias — ${t}`,
                ),
              ),
            ],
          ]
        : [],
      [26, 36, 90],
    ),
  );

  // 5. Compatibilidade do fator predominante com os 4.
  abas.push(
    aba(
      "Compatibilidade",
      `Compatibilidade — ${predominante ? FATOR[predominante].nome : "sem respostas"}`,
      [
        "Fator",
        "Relação",
        "Resumo",
        "Dica prática",
        "Pares de pessoas no time",
      ],
      predominante
        ? FATORES.map((f): CelulaXlsx[] => {
            const m = r.compatibilidade.matriz.find(
              (x) =>
                (x.a === predominante && x.b === f) ||
                (x.b === predominante && x.a === f),
            )!;
            const par = PARES[`${m.a}${m.b}`];
            return [
              `${f} · ${FATOR[f].nome}`,
              ROTULO_DA_RELACAO[m.relacao],
              par?.resumo ?? "",
              par?.dica ?? "",
              m.pares,
            ];
          })
        : [],
      [22, 12, 30, 70, 14],
    ),
  );

  // 6. Diversidade.
  const d = r.diversidade;
  abas.push(
    aba(
      "Diversidade do time",
      "Diversidade comportamental",
      [],
      [
        ["Score (0 a 100)", d.score],
        ["Classificação", ROTULO_DA_DIVERSIDADE[d.faixa]],
        ["Interpretação", TEXTO_DA_DIVERSIDADE[d.faixa]],
        [
          "Fatores ausentes",
          d.ausentes.length
            ? d.ausentes
                .map((f) => `${FATOR[f].nome}: ${FATOR[f].risco}`)
                .join("\n")
            : "Nenhum",
        ],
        [
          "Oportunidade de reforço",
          r.lacunas.length
            ? r.lacunas
                .map((f) => `${FATOR[f].nome}: ${FATOR[f].reforco}`)
                .join("\n")
            : "Nenhum fator abaixo de 20% das pessoas.",
        ],
        [
          "Metodologia",
          "Entropia de Shannon da distribuição das pessoas pelo fator predominante, dividida pelo máximo (2 bits) e levada a 0–100. Faixas: pouco diverso 0–39, moderado 40–59, equilibrado 60–79, altamente diverso 80–100.",
        ],
      ],
      [28, 100],
    ),
  );

  // 7. Glossário.
  abas.push(
    aba(
      "Glossário DISC",
      "Glossário — o que cada fator quer dizer",
      ["Fator", "O que mede", "Quando alto", "Quando baixo"],
      FATORES.map((f): CelulaXlsx[] => [
        `${FATOR[f].nome} (${f})`,
        FATOR[f].focoAnalisado,
        FATOR[f].quandoAlto,
        FATOR[f].quandoBaixo,
      ]),
      [22, 40, 50, 50],
    ),
  );

  return montarXlsx(abas);
}
