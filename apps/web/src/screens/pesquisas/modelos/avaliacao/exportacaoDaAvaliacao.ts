/**
 * T216 — a planilha (.xlsx) da Avaliação 90°/180°, gerada no navegador no
 * padrão do módulo: Resumo, Por pessoa, Por competência, Por afirmação,
 * Calibração, Recortes, Gestor × autoavaliação (180°) e Metodologia. A
 * avaliação é nominal: os nomes saem (só RH e DP exportam); nada de CPF.
 */
import { nomeDoArquivo } from "../../../dashboard/exportacao";
import {
  type AbaXlsx,
  type CelulaXlsx,
  montarXlsx,
} from "../../../pessoas/importacao/planilhaXlsx";
import {
  ALINHAMENTO,
  CALIBRACAO,
  CATALOGO,
  ITENS,
  NIVEIS,
  QUADRANTES,
  TEMPO_DE_CASA,
  competencia,
} from "./catalogo";
import type { ResultadosDaAvaliacao } from "./cliente";

const num = (n: number | null | undefined): CelulaXlsx =>
  n === null || n === undefined ? "" : { numero: n, formato: "decimal" };

export function nomeDaPlanilha(nome: string): string {
  return nomeDoArquivo([nome, "avaliacao"], "xlsx");
}

export const METODOLOGIA_DA_AVALIACAO: readonly (readonly [string, string])[] = [
  ["Escala", "Cada afirmação de 1 (Insuficiente) a 5 (Excepcional)."],
  ["Competência", "Média das 3 afirmações da competência."],
  ["Nota geral", "Média das 8 competências, com 1 casa."],
  ["Eixo Entrega", "Média de Responsabilidade, Organização, Proatividade e Resolução de problemas."],
  ["Eixo Pessoas", "Média de Comunicação, Trabalho em equipe, Liderança e Adaptabilidade."],
  ["Níveis", "Insuficiente 1,0–1,9 · Em desenvolvimento 2,0–2,9 · Bom 3,0–3,9 · Excelente 4,0–4,4 · Excepcional 4,5–5,0."],
  ["Mapa de talentos", "Alto: 4 ou mais; médio: 3 a 3,9; baixo: abaixo de 3, em Entrega e em Pessoas."],
  ["Calibração", "Média dada pelo gestor menos a média da empresa; com 5 avaliações ou mais; 0,4 ou mais indica outro critério."],
  ["Gestor × autoavaliação", "Diferença = autoavaliação − gestor; menos de 0,5 é alinhada."],
  ["Recortes", "Grupos com menos de 3 pessoas avaliadas ficam ocultos."],
];

export function planilhaDaAvaliacao(
  nome: string,
  r: ResultadosDaAvaliacao,
): Uint8Array {
  const e180 = r.modelo === "avaliacao180";
  const abas: AbaXlsx[] = [];
  abas.push({
    nome: "Resumo",
    titulo: true,
    larguras: [32, 40],
    linhas: [
      [nome],
      ["Modelo", e180 ? "Avaliação 180°" : "Avaliação 90°"],
      ["Pessoas avaliadas", r.avaliadas],
      ["Avaliações previstas", r.previstas],
      ...(e180
        ? [
            ["Autoavaliações feitas", r.autoavaliacoes.respondidas],
            ["Autoavaliações previstas", r.autoavaliacoes.previstas],
          ]
        : []),
      ["Nota do time", num(r.time.media)],
      ["Nível do time", r.time.nivel ? NIVEIS[r.time.nivel].rotulo : ""],
    ],
  });
  abas.push({
    nome: "Por pessoa",
    cabecalho: true,
    larguras: [30, 26, 26, 10, 10, 10, 20, 26, ...(e180 ? [14, 12, 16] : []), ...CATALOGO.map(() => 14)],
    linhas: [
      [
        "Pessoa",
        "Cargo",
        "Gestor",
        "Nota geral",
        "Entrega",
        "Pessoas",
        "Nível",
        "Mapa de talentos",
        ...(e180 ? ["Autoavaliação", "Diferença", "Alinhamento"] : []),
        ...CATALOGO.map((c) => c.rotulo),
      ],
      ...r.pessoas.map((p): CelulaXlsx[] => [
        p.nome,
        p.cargo ?? "",
        p.gestor.nome,
        num(p.nota?.geral),
        num(p.nota?.entrega),
        num(p.nota?.pessoas),
        p.nota?.nivel ? NIVEIS[p.nota.nivel].rotulo : "Pendente",
        p.nota?.quadrante ? QUADRANTES[p.nota.quadrante].rotulo : "",
        ...(e180
          ? [
              num(p.autoavaliacao?.geral),
              num(p.diferenca),
              p.alinhamento ? ALINHAMENTO[p.alinhamento] : "",
            ]
          : []),
        ...CATALOGO.map((c) => num(p.nota?.competencias[c.id])),
      ]),
    ],
  });
  abas.push({
    nome: "Por competência",
    cabecalho: true,
    larguras: [26, 10, 14, 14, 40],
    linhas: [
      ["Competência", "Média", "Abaixo de 3", "% abaixo de 3", "Afirmação mais baixa"],
      ...r.time.competencias.map((c): CelulaXlsx[] => [
        competencia(c.competencia).rotulo,
        num(c.media),
        c.abaixoDe3.length,
        c.percentualAbaixoDe3,
        c.menorAfirmacao
          ? `${ITENS.find((i) => i.id === c.menorAfirmacao!.itemId)?.gestor ?? ""} (${String(c.menorAfirmacao.media).replace(".", ",")})`
          : "",
      ]),
    ],
  });
  abas.push({
    nome: "Por afirmação",
    cabecalho: true,
    larguras: [6, 24, 60, 10],
    linhas: [
      ["#", "Competência", "Afirmação", "Média"],
      ...ITENS.map((i): CelulaXlsx[] => [
        i.ordem + 1,
        competencia(i.competencia).rotulo,
        i.gestor,
        num(r.itens.find((x) => x.itemId === i.id)?.media),
      ]),
    ],
  });
  abas.push({
    nome: "Calibração",
    cabecalho: true,
    larguras: [30, 10, 12, 12, 32],
    linhas: [
      ["Gestor", "Avaliou", "Média dada", "Diferença", "Leitura"],
      ...r.calibracao.map((c): CelulaXlsx[] => [
        c.nome,
        c.avaliadas,
        num(c.media),
        num(c.diferenca),
        CALIBRACAO[c.leitura],
      ]),
    ],
  });
  abas.push({
    nome: "Recortes",
    cabecalho: true,
    larguras: [18, 26, 10, 12],
    linhas: [
      ["Recorte", "Grupo", "Pessoas", "Média"],
      ...r.recortes.tempoDeCasa.map((l): CelulaXlsx[] => [
        "Tempo de casa",
        TEMPO_DE_CASA[l.grupo as keyof typeof TEMPO_DE_CASA] ?? l.grupo,
        l.avaliadas,
        l.visivel ? num(l.media) : "Oculto (menos de 3)",
      ]),
      ...r.recortes.departamento.map((l): CelulaXlsx[] => [
        "Departamento",
        l.grupo,
        l.avaliadas,
        l.visivel ? num(l.media) : "Oculto (menos de 3)",
      ]),
    ],
  });
  if (e180 && r.comparativo) {
    abas.push({
      nome: "Gestor x autoavaliação",
      cabecalho: true,
      larguras: [26, 12, 14, 12],
      linhas: [
        ["Competência", "Gestor", "Autoavaliação", "Diferença"],
        ...r.comparativo.competencias.map((c): CelulaXlsx[] => [
          competencia(c.competencia).rotulo,
          num(c.gestor),
          num(c.autoavaliacao),
          num(c.diferenca),
        ]),
        [],
        ["Se veem acima", r.comparativo.acima],
        ["Alinhadas", r.comparativo.alinhadas],
        ["Se veem abaixo", r.comparativo.abaixo],
      ],
    });
  }
  abas.push({
    nome: "Metodologia",
    cabecalho: true,
    quebrarTexto: true,
    larguras: [26, 90],
    linhas: [["Item", "Regra"], ...METODOLOGIA_DA_AVALIACAO.map(([a, b]) => [a, b])],
  });
  return montarXlsx(abas);
}
