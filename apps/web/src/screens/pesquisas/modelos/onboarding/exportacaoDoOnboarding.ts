/**
 * T216 — a planilha (.xlsx) do Onboarding, gerada no navegador no padrão
 * do módulo: Resumo, Por rodada, Blocos, Intenção e motivos, Recomendação,
 * Peso dos blocos, Envios, Comentários e Metodologia. Respeita a
 * identificação: contatos e comentários sem nome, rodada nem data; os
 * envios levam o nome (é o convite, não a resposta). Nada de CPF.
 */
import type { Secao } from "../../../../api/pesquisasClient";
import { nomeDoArquivo } from "../../../dashboard/exportacao";
import {
  type AbaXlsx,
  type CelulaXlsx,
  montarXlsx,
} from "../../../pessoas/importacao/planilhaXlsx";
import { FAIXAS, rotuloDaRodada } from "./envio";
import type { EnviosDoOnboarding, ResultadosDoOnboarding } from "./cliente";
import { formatarDiaCivil } from "../../../../format/data";
import { ROTULO_DA_SITUACAO } from "./regrasDoOnboarding";

export function nomeDaPlanilha(nome: string): string {
  return nomeDoArquivo([nome, "onboarding"], "xlsx");
}

export const METODOLOGIA_DO_ONBOARDING: readonly (readonly [string, string])[] =
  [
    [
      "Nota do item",
      "Escalas de 4 pontos viram 0 a 100: (valor − 1) ÷ 3 × 100.",
    ],
    [
      "Índice do bloco",
      "Média das notas dos itens de 4 pontos do bloco, na rodada.",
    ],
    ["Índice geral", "Média de todos os itens de 4 pontos da rodada."],
    [
      "Faixas",
      "Crítico abaixo de 50 · Atenção 50 a 69 · Saudável 70 a 84 · Forte 85 ou mais.",
    ],
    ["Mínimo", "Cada rodada mostra números a partir de 3 respostas."],
    ["Recomendação", "% de notas 9 e 10 menos % de notas 0 a 6."],
    [
      "Peso do bloco",
      "Correlação de Spearman entre a nota do bloco e a intenção de ficar; com 20 respostas ou mais. Prioridade: nota abaixo de 70 e peso 0,4 ou mais.",
    ],
    [
      "Convites",
      "Sem provedor de e-mail, ficam aguardando e-mail; sem e-mail no cadastro, não saem.",
    ],
  ];

export function planilhaDoOnboarding(
  nome: string,
  secoes: readonly Secao[],
  r: ResultadosDoOnboarding,
  envios: EnviosDoOnboarding,
): Uint8Array {
  const texto = new Map<string, string>();
  for (const s of secoes)
    for (const p of s.perguntas)
      for (const o of p.config.opcoes ?? []) texto.set(o.id, o.texto);
  const abas: AbaXlsx[] = [
    {
      nome: "Resumo",
      titulo: true,
      larguras: [30, 30],
      linhas: [
        [nome],
        ["Respostas", r.respostas],
        ["Convites", r.funil.noPublico],
        ["Aguardando e-mail", r.funil.aguardandoEmail],
        ["Sem e-mail", r.funil.semEmail],
        ["Responderam", r.funil.responderam],
        ["Pulados", r.funil.pulados],
      ],
    },
    {
      nome: "Por rodada",
      cabecalho: true,
      larguras: [16, 12, 12, 14, 20],
      linhas: [
        ["Rodada", "Respostas", "Índice", "Faixa", "Quer continuar (%)"],
        ...r.rodadas.map((x): CelulaXlsx[] => [
          rotuloDaRodada(x.rodada),
          x.respostas,
          x.visivel ? (x.indice ?? "") : "Oculto (menos de 3)",
          x.faixa ? FAIXAS[x.faixa].rotulo : "",
          x.intencao?.querContinuar ?? "",
        ]),
      ],
    },
    {
      nome: "Blocos",
      cabecalho: true,
      larguras: [30, ...r.rodadas.map(() => 12)],
      linhas: [
        ["Bloco", ...r.rodadas.map((x) => rotuloDaRodada(x.rodada))],
        ...(r.rodadas.find((x) => x.visivel)?.blocos ?? []).map(
          (b): CelulaXlsx[] => [
            b.titulo ?? "",
            ...r.rodadas.map(
              (x) => x.blocos.find((y) => y.id === b.id)?.indice ?? "",
            ),
          ],
        ),
      ],
    },
    {
      nome: "Intenção e motivos",
      cabecalho: true,
      larguras: [16, 14, 60, 12, 10],
      linhas: [
        ["Rodada", "Pergunta", "Opção", "Respostas", "%"],
        ...r.rodadas.flatMap((x): CelulaXlsx[][] => [
          ...(x.intencao?.opcoes ?? []).map((o): CelulaXlsx[] => [
            rotuloDaRodada(x.rodada),
            "Intenção",
            texto.get(o.opcaoId) ?? "",
            o.quantidade,
            o.percentual,
          ]),
          ...(x.motivos?.opcoes ?? []).map((o): CelulaXlsx[] => [
            rotuloDaRodada(x.rodada),
            "Motivo",
            texto.get(o.opcaoId) ?? "",
            o.quantidade,
            o.percentual,
          ]),
        ]),
      ],
    },
    {
      nome: "Recomendação",
      cabecalho: true,
      larguras: [16, 12, 12, 12, 12, 12],
      linhas: [
        ["Rodada", "Respostas", "Índice", "9 e 10", "7 e 8", "0 a 6"],
        ...r.rodadas
          .filter((x) => x.recomendacao)
          .map((x): CelulaXlsx[] => [
            rotuloDaRodada(x.rodada),
            x.recomendacao!.respostas,
            x.recomendacao!.indice ?? "",
            x.recomendacao!.promotores,
            x.recomendacao!.neutros,
            x.recomendacao!.detratores,
          ]),
      ],
    },
    {
      nome: "Peso dos blocos",
      cabecalho: true,
      larguras: [30, 10, 10, 14],
      linhas: [
        ["Bloco", "Nota", "Peso", "Prioridade"],
        ...r.peso.blocos.map((b): CelulaXlsx[] => [
          b.titulo ?? "",
          b.indice ?? "",
          b.peso === null ? "" : { numero: b.peso, formato: "decimal" },
          b.prioridade ? "Sim" : "",
        ]),
      ],
    },
    {
      nome: "Envios",
      cabecalho: true,
      larguras: [14, 30, 14, 20, 14],
      linhas: [
        ["Data", "Colaborador", "Rodada", "Situação", "Prazo"],
        ...envios.itens.map((e): CelulaXlsx[] => [
          formatarDiaCivil(e.dataPrevista),
          e.nome,
          rotuloDaRodada(e.rodada),
          ROTULO_DA_SITUACAO[e.situacao],
          formatarDiaCivil(e.prazo),
        ]),
      ],
    },
    {
      nome: "Comentários",
      cabecalho: true,
      quebrarTexto: true,
      larguras: [30, 90],
      linhas: [
        ["Tipo", "Texto"],
        ...r.melhorar.map((t) => ["O que poderia ter sido diferente", t]),
        ...r.gosta.map((t) => ["O que gosta e quer que continue", t]),
        ...r.contatos.map((t) => ["Contato com o RH", t]),
      ],
    },
    {
      nome: "Metodologia",
      cabecalho: true,
      quebrarTexto: true,
      larguras: [24, 90],
      linhas: [
        ["Item", "Regra"],
        ...METODOLOGIA_DO_ONBOARDING.map(([a, b]) => [a, b]),
      ],
    },
  ];
  return montarXlsx(abas);
}
