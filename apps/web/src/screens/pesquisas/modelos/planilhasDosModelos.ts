/**
 * T216 — as abas da planilha (.xlsx) da NR-1 e da saúde financeira, logo
 * depois do Resumo (`abasDoModelo`, em `modelos/exportacao.ts`).
 *
 * NR-1: Dimensões (resultados por dimensão), Matriz psicossocial, Domínios,
 * Destaques e Metodologia; o plano de ação e as etapas entram quando vêm
 * junto. Saúde financeira: o índice, as pessoas (fora da confidencial, com a
 * nota de cada resposta) e as perguntas. As respostas individuais já saem na
 * aba própria da planilha. Nada leva CPF; o nome só na identificada.
 */
import type {
  AcompanhamentoNr1,
  ResultadoIsfb,
  ResultadoNr1,
} from "../../../api/modelosDePesquisaClient";
import type {
  Pergunta,
  RespostaDetalhe,
  Secao,
} from "../../../api/pesquisasClient";
import { formatarDiaCivil, formatarInstante } from "../../../format/data";
import type {
  AbaXlsx,
  CelulaXlsx,
} from "../../pessoas/importacao/planilhaXlsx";
import { perguntasEmOrdem } from "../estadoDaPesquisa";
import { textoDoValor } from "../exportarResultados";
import { dimensaoNr1, dominioNr1, TIPOS_DE_OFENSA } from "./copsoq/definicao";
import {
  ETAPAS_DA_CONFORMIDADE,
  FAIXA,
  MATRIZ,
  NIVEL,
  ROTULO_DA_PREVALENCIA,
  ROTULO_DA_SITUACAO,
  ROTULO_DO_CONTROLE,
  ROTULO_DO_GRAU,
  ROTULO_DO_INDICADOR,
} from "./copsoq/textos";
import { etapaIsfb, itemIsfb } from "./isfb/definicao";
import {
  ABERTURA,
  ABERTURAS,
  FAIXA_ISFB,
  PERFIL,
  PERFIS,
  SAUDE,
  SINAIS,
  SINAL,
} from "./isfb/textos";

const pct = (n: number | null): CelulaXlsx =>
  n === null
    ? "—"
    : { numero: Math.round(n * 100) / 10000, formato: "percentual" };
const dec = (n: number | null): CelulaXlsx =>
  n === null ? "—" : { numero: n, formato: "decimal" };

function cabecalho(
  titulo: string,
  empresa: string,
  nome: string,
): CelulaXlsx[][] {
  return [[titulo], [`${empresa || "Empresa"} · ${nome}`], []];
}

/** Quem respondeu: o nome na identificada; "Resposta #N" nas outras. */
const autor = (r: RespostaDetalhe) => r.nome ?? `Resposta #${r.numero}`;

const valorDe = (r: RespostaDetalhe, id: string) =>
  r.valores.find((v) => v.perguntaId === id)?.valor;

export interface DadosDaPlanilhaNr1 {
  readonly empresa: string;
  readonly nome: string;
  /** `null`: números ocultos (confidencial abaixo do mínimo). */
  readonly resultado: ResultadoNr1 | null;
  readonly minimoPorGrupo: number;
  readonly acompanhamento?: AcompanhamentoNr1 | null;
}

export function abasDaPlanilhaNr1(d: DadosDaPlanilhaNr1): AbaXlsx[] {
  const r = d.resultado;
  const abas: AbaXlsx[] = [];
  const resumo: CelulaXlsx[][] = [
    ...cabecalho("Riscos psicossociais (NR-1)", d.empresa, d.nome),
    ["Respondentes", r?.respostas ?? 0],
    ["Dimensões", 29],
  ];
  const linhasDeCabecalho: number[] = [];
  if (!r) {
    resumo.push([
      "Números ocultos",
      `Menos de ${d.minimoPorGrupo} respostas: para proteger quem respondeu, os resultados não aparecem.`,
    ]);
  } else {
    resumo.push(
      ["Críticas", r.niveis.critico],
      ["Alto risco", r.niveis.alto],
      ["Médio risco", r.niveis.medio],
      ["Baixo risco", r.niveis.baixo],
      [],
      ["RESULTADOS POR DIMENSÃO (MATRIZ PSICOSSOCIAL)"],
    );
    linhasDeCabecalho.push(resumo.length);
    resumo.push([
      "Domínio",
      "Dimensão",
      "Definição",
      "Tipo",
      "Escore",
      "Tercil",
      "Class. tercil",
      "Severidade",
      "Prevalência",
      "Nível (matriz)",
      "% risco",
      "% intermediário",
      "% favorável",
    ]);
    for (const x of r.dimensoes) {
      const dim = dimensaoNr1(x.id);
      resumo.push([
        dominioNr1(dim.dominio).rotulo,
        dim.rotulo,
        dim.definicao,
        dim.tipo === "risco" ? "Risco" : "Proteção",
        dec(x.escore),
        x.tercil === null ? "—" : `T${x.tercil}`,
        x.faixa ? FAIXA[x.faixa].rotulo : "—",
        x.severidade ? ROTULO_DO_GRAU[x.severidade]! : "—",
        x.prevalencia ? ROTULO_DO_GRAU[x.prevalencia]! : "—",
        x.nivel ? NIVEL[x.nivel].rotulo : "—",
        pct(x.percentuais.risco),
        pct(x.percentuais.intermediario),
        pct(x.percentuais.favoravel),
      ]);
    }
  }
  abas.push({
    nome: "Dimensões NR-1",
    linhas: resumo,
    titulo: true,
    linhasDeCabecalho,
    larguras: [28, 34, 48, 10, 8, 8, 14, 12, 12, 14, 10, 14, 12],
  });
  if (!r) return abas;

  abas.push({
    nome: "Matriz Psicossocial",
    titulo: true,
    linhasDeCabecalho: [1],
    larguras: [22, 36, 36, 36, 36],
    linhas: [
      ["Severidade × prevalência (nomes das dimensões em cada célula)"],
      [
        "Severidade \\ Prevalência",
        ...[1, 2, 3, 4].map(
          (p) => `${ROTULO_DO_GRAU[p]} (${ROTULO_DA_PREVALENCIA[p]})`,
        ),
      ],
      ...[4, 3, 2, 1].map((sev, linha) => [
        `${ROTULO_DO_GRAU[sev]} (${sev})`,
        ...[0, 1, 2, 3].map((col) => {
          const ids = r.matriz[linha]?.[col] ?? [];
          return `${NIVEL[MATRIZ[linha]![col]!].rotulo}: ${ids.length ? ids.map((id) => dimensaoNr1(id).rotulo).join("; ") : "—"}`;
        }),
      ]),
    ],
  });

  abas.push({
    nome: "Domínios",
    cabecalho: true,
    larguras: [36, 12, 18, 16],
    linhas: [
      ["Domínio", "Dimensões", "Precisam de ação", "% em risco (média)"],
      ...r.dominios.map((x) => [
        dominioNr1(x.id).rotulo,
        x.dimensoes,
        x.precisamDeAcao,
        pct(x.percentualEmRisco),
      ]),
    ],
  });

  const minimo = d.minimoPorGrupo;
  const sigilo = (n: number | null): CelulaXlsx =>
    n === null ? `Menos de ${minimo}` : n;
  // Frequência oculta: abaixo do mínimo ou escondida para não sair por
  // subtração (sigilo complementar) — nunca zero.
  const oculta = (n: number | null): CelulaXlsx => (n === null ? "Oculto" : n);
  const destaques: CelulaXlsx[][] = [
    ["Ranking de prioridades"],
    ["#", "Dimensão", "Nível", "% em risco", "Severidade", "Escore"],
    ...r.prioridades.map((id, i) => {
      const x = r.dimensoes.find((y) => y.id === id)!;
      return [
        i + 1,
        dimensaoNr1(id).rotulo,
        x.nivel ? NIVEL[x.nivel].rotulo : "—",
        pct(x.percentuais.risco),
        x.severidade ? ROTULO_DO_GRAU[x.severidade]! : "—",
        dec(x.escore),
      ];
    }),
    [],
    ["Saúde e bem-estar"],
    ["Indicador", "% em risco", "Pessoas em risco", "Pessoas", "Nível"],
  ];
  const cabSaude = destaques.length - 1;
  for (const s of r.saude) {
    destaques.push([
      ROTULO_DO_INDICADOR[s.id]?.titulo ?? s.id,
      pct(s.percentualEmRisco),
      s.pessoasEmRisco,
      s.pessoas,
      s.nivel ? NIVEL[s.nivel].rotulo : "—",
    ]);
  }
  destaques.push(
    [],
    ["Comportamentos ofensivos (últimos 12 meses)"],
    [
      "Relataram ao menos um tipo",
      sigilo(r.ofensivos.relataram),
      pct(r.ofensivos.percentual),
    ],
    ["Tipo", "Raramente", "Às vezes", "Frequentemente ou sempre", "Relataram"],
  );
  const cabOfensivos = destaques.length - 1;
  for (const t of TIPOS_DE_OFENSA) {
    const x = r.ofensivos.tipos.find((y) => y.id === t.id);
    // `null` é sigilo: não vira zero.
    destaques.push([
      t.rotulo,
      x ? oculta(x.raramente) : 0,
      x ? oculta(x.asVezes) : 0,
      x ? oculta(x.frequentementeOuSempre) : 0,
      x ? sigilo(x.relataram) : 0,
    ]);
  }
  abas.push({
    nome: "Destaques",
    titulo: true,
    linhasDeCabecalho: [1, cabSaude, cabOfensivos],
    larguras: [36, 18, 18, 22, 14, 10],
    linhas: destaques,
  });

  const a = d.acompanhamento ?? null;
  if (a)
    abas.push({
      nome: "Plano de ação",
      cabecalho: true,
      larguras: [32, 40, 50, 26, 22, 14, 34, 14],
      linhas: [
        [
          "Dimensão",
          "Medida",
          "Como",
          "Controle",
          "Responsável",
          "Prazo",
          "Indicador",
          "Situação",
        ],
        ...(a?.plano ?? []).map((m) => [
          dimensaoNr1(m.dimensaoId).rotulo,
          m.titulo,
          m.descricao ?? "",
          ROTULO_DO_CONTROLE[m.controle],
          m.responsavel ?? "",
          m.prazo ? formatarDiaCivil(m.prazo) : "",
          m.indicador ?? "",
          ROTULO_DA_SITUACAO[m.situacao],
        ]),
      ],
    });

  const metodologia: CelulaXlsx[][] = [
    ["Metodologia e NR-1"],
    [
      "Escore",
      "Média dos itens de cada dimensão, de 1 a 5 (itens invertidos e a escala de saúde espelhados).",
    ],
    [
      "Tercis",
      "Até 2,33 = T1; até 3,66 = T2; acima = T3. Risco: T3 em risco; proteção: T1 em risco.",
    ],
    [
      "Severidade",
      "Do escore médio (proteção espelhada): acima de 4 muito alta; de 3 alta; de 2 média; senão baixa.",
    ],
    [
      "Prevalência",
      "% em risco: 60% ou mais muito alta; 40% alta; 20% média; senão baixa. Menos de 10 pessoas: alguém em risco = alta; alguém intermediário = média.",
    ],
    [
      "Nível",
      "Matriz 4 × 4 severidade × prevalência. Sintomas depressivos e comportamentos ofensivos com severidade alta nunca ficam abaixo de alto.",
    ],
    [
      "Proteção dos dados",
      `Grupos com menos de ${minimo} respostas não aparecem nos recortes.`,
    ],
    [],
    ["Etapa", "Situação", "Concluída em", "Evidências"],
  ];
  const cabEtapas = metodologia.length - 1;
  for (const def of ETAPAS_DA_CONFORMIDADE) {
    const e = a?.etapas.find((x) => x.id === def.id);
    metodologia.push([
      def.titulo,
      e?.concluida ? "Concluída" : "Pendente",
      e?.concluidaEm ? formatarInstante(e.concluidaEm) : "",
      e?.evidencias ?? "",
    ]);
  }
  metodologia.push(
    [],
    [
      "Profissional de SST",
      a?.profissionalSst.nome ?? "",
      a?.profissionalSst.registro ?? "",
    ],
  );
  abas.push({
    nome: "Metodologia e NR-1",
    titulo: true,
    linhasDeCabecalho: [cabEtapas],
    larguras: [36, 90, 20, 60],
    quebrarTexto: true,
    linhas: metodologia,
  });

  return abas;
}

export interface DadosDaPlanilhaIsfb {
  readonly empresa: string;
  readonly nome: string;
  readonly resultado: ResultadoIsfb | null;
  readonly minimoPorGrupo: number;
  /** As respostas (fora da confidencial), com o resultado de cada uma. */
  readonly respostas: readonly RespostaDetalhe[] | null;
  readonly secoes: readonly Secao[];
}

export function abasDaPlanilhaIsfb(d: DadosDaPlanilhaIsfb): AbaXlsx[] {
  const r = d.resultado;
  const resumo: CelulaXlsx[][] = [
    ...cabecalho("Saúde financeira", d.empresa, d.nome),
    ["Pessoas com nota", r?.pessoas ?? 0],
  ];
  const abas: AbaXlsx[] = [];
  if (!r) {
    resumo.push([
      "Números ocultos",
      `Menos de ${d.minimoPorGrupo} respostas: para proteger quem respondeu, os resultados não aparecem.`,
    ]);
    abas.push({
      nome: "Saúde financeira",
      titulo: true,
      linhas: resumo,
      larguras: [40, 20, 20],
    });
    return abas;
  }
  resumo.push(
    [
      "Nota do time (0 a 100)",
      r.isfb ?? "—",
      r.faixa ? FAIXA_ISFB[r.faixa].rotulo : "—",
    ],
    ["Média do Brasil (referência nacional, 2024)", dec(r.mediaDoBrasil)],
    [],
    ["Dimensão", "Nota", "Faixa"],
  );
  const cabDims = resumo.length - 1;
  for (const x of r.dimensoes) {
    resumo.push([
      etapaIsfb(x.id).rotulo,
      x.nota ?? "—",
      x.faixa ? FAIXA_ISFB[x.faixa].rotulo : "—",
    ]);
  }
  resumo.push([], ["Saúde financeira", "Pessoas", "%"]);
  const cabSaude = resumo.length - 1;
  for (const s of ["baixa", "no_limite", "saudavel"] as const) {
    resumo.push([
      `${SAUDE[s].rotulo} (${SAUDE[s].faixa})`,
      r.saude[s].quantidade,
      pct(r.saude[s].percentual),
    ]);
  }
  resumo.push([], ["Sinal de alerta", "Pessoas", "%"]);
  const cabSinais = resumo.length - 1;
  for (const s of SINAIS) {
    resumo.push([
      SINAL[s].pessoa,
      r.sinais[s].quantidade,
      pct(r.sinais[s].percentual),
    ]);
  }
  resumo.push([], ["Perfil do time", "Pessoas", "%"]);
  const cabPerfis = resumo.length - 1;
  for (const p of PERFIS) {
    resumo.push([
      PERFIL[p].rotulo,
      r.perfis[p].quantidade,
      pct(r.perfis[p].percentual),
    ]);
  }
  abas.push({
    nome: "Saúde financeira",
    titulo: true,
    linhasDeCabecalho: [cabDims, cabSaude, cabSinais, cabPerfis],
    larguras: [44, 14, 14],
    linhas: resumo,
  });

  if (d.respostas) {
    const perguntas = perguntasEmOrdem(d.secoes);
    const textoDe = (p: Pergunta, v: unknown) => textoDoValor(p, v);
    abas.push({
      nome: "Pessoas",
      cabecalho: true,
      linhas: [
        [
          "Resposta",
          "Respondeu em",
          "Nota",
          "Faixa",
          "Segurança",
          "Habilidade",
          "Comportamento",
          "Liberdade",
          "Autopercepção",
          "Perfil",
          "Sinais",
          ...perguntas.map((p) => p.chave ?? p.id),
        ],
        ...d.respostas.map((resp) => {
          const x = resp.modelo?.modelo === "isfb" ? resp.modelo : null;
          return [
            autor(resp),
            formatarInstante(resp.respondidaEm),
            x ? x.isfb : "—",
            x ? FAIXA_ISFB[x.faixa].rotulo : "—",
            x ? x.dimensoes.seguranca : "—",
            x ? x.dimensoes.habilidade : "—",
            x ? x.dimensoes.comportamento : "—",
            x ? x.dimensoes.liberdade : "—",
            x?.autopercepcao ?? "—",
            x ? PERFIL[x.perfil].rotulo : "—",
            x ? x.sinais.length : "—",
            ...perguntas.map((p) => textoDe(p, valorDe(resp, p.id))),
          ];
        }),
      ],
    });
  }

  abas.push({
    nome: "Perguntas",
    cabecalho: true,
    larguras: [10, 44, 12, 14, 9, 9, 9, 9, 9],
    linhas: [
      [
        "Pergunta",
        "Texto curto",
        "Favorável",
        "Desfavorável",
        "Ponto 0",
        "Ponto 1",
        "Ponto 2",
        "Ponto 3",
        "Ponto 4",
      ],
      ...r.perguntas.map((p) => [
        p.id,
        itemIsfb(p.id).rotulo,
        pct(p.favoravel),
        pct(p.desfavoravel),
        ...p.pontos,
      ]),
    ],
  });
  if (r.comAutopercepcao) {
    abas.push({
      nome: "Abertura a apoio",
      cabecalho: true,
      linhas: [
        ["Grupo", "Pessoas", "%", "Sugestão"],
        ...ABERTURAS.map((x) => [
          ABERTURA[x].rotulo,
          r.aberturas[x].quantidade,
          pct(r.aberturas[x].percentual),
          ABERTURA[x].acao,
        ]),
      ],
    });
  }
  return abas;
}
