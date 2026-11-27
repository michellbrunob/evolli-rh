/**
 * T216 — o texto de cada resposta e a exportação CSV dos resultados.
 *
 * Privacidade (LGPD): o CSV segue a identificação da pesquisa. O resumo por
 * pergunta nunca leva autor fora da identificada, mesmo que o servidor o
 * mande; o CSV por pessoa só existe na identificada. Nenhum CSV leva CPF.
 */
import type {
  Identificacao,
  Pergunta,
  PesquisaDetalhe,
  RespostaIndividual,
  ResultadoPergunta,
  ResultadosPesquisa,
} from "../../api/pesquisasClient";
import { formatarDiaCivil } from "../../format/data";
import { plural } from "../../format/plural";
import {
  montarCsv,
  nomeDoArquivo,
  type CelulaDoCsv,
} from "../dashboard/exportacao";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import {
  ROTULO_DO_TIPO,
  ROTULOS_DA_CONCORDANCIA,
  dataDoInstante,
  percentual,
  umaCasa,
} from "./textosDasPesquisas";

export const SEM_RESPOSTA = "Sem resposta";

const numero = (n: number) => String(n).replace(".", ",");

/** A resposta de uma pessoa, em texto legível. */
export function textoDoValor(p: Pergunta, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "")
    return SEM_RESPOSTA;
  const opcao = (id: unknown) =>
    p.config.opcoes?.find((o) => o.id === id)?.texto ?? "Opção removida";
  switch (p.tipo) {
    case "texto_curto":
    case "paragrafo":
      return String(valor);
    case "escolha_unica": {
      const v = valor as { opcao?: string; outro?: string };
      if (typeof v.outro === "string") return `Outro: ${v.outro}`;
      return v.opcao ? opcao(v.opcao) : SEM_RESPOSTA;
    }
    case "multipla_escolha": {
      const v = valor as { opcoes?: string[]; outro?: string };
      const partes = (v.opcoes ?? []).map(opcao);
      if (typeof v.outro === "string" && v.outro)
        partes.push(`Outro: ${v.outro}`);
      return partes.length > 0 ? partes.join(", ") : SEM_RESPOSTA;
    }
    case "sim_nao":
      return valor === "sim" ? "Sim" : valor === "nao" ? "Não" : SEM_RESPOSTA;
    case "concordancia": {
      const n = Number(valor);
      return `${n} · ${ROTULOS_DA_CONCORDANCIA[n - 1] ?? ""}`.trim();
    }
    case "estrelas":
      return plural(Number(valor), "estrela", "estrelas");
    case "data":
      return formatarDiaCivil(String(valor));
    default:
      return typeof valor === "number" ? numero(valor) : String(valor);
  }
}

/** O resultado agregado de uma pergunta, em uma linha de texto. */
export function resumoDoResultado(
  p: Pergunta,
  r: ResultadoPergunta | undefined,
  identificacao: Identificacao,
): string {
  if (!r) return "Sem respostas";
  const partes: string[] = [];
  if ("enps" in r) {
    const { promotores, neutros, detratores, indice } = r.enps;
    partes.push(
      `eNPS ${indice === null ? "—" : indice}`,
      `${plural(promotores, "promotor", "promotores")}, ${plural(neutros, "neutro", "neutros")}, ${plural(detratores, "detrator", "detratores")}`,
    );
  }
  if ("media" in r && r.media !== undefined) {
    partes.push(`Média ${r.media === null ? "—" : umaCasa(r.media)}`);
    if (r.distribuicao && r.distribuicao.length > 0)
      partes.push(
        r.distribuicao.map((d) => `${d.valor}: ${d.quantidade}`).join("; "),
      );
  }
  if ("opcoes" in r) {
    const total = r.respondidas;
    partes.push(
      r.opcoes
        .map((o) => {
          const texto =
            p.config.opcoes?.find((x) => x.id === o.opcaoId)?.texto ??
            "Opção removida";
          return `${texto}: ${o.quantidade} (${percentual(o.quantidade, total)}%)`;
        })
        .join("; "),
    );
    if (r.outros.length > 0) partes.push(`Outro: ${r.outros.join(" | ")}`);
  }
  if ("sim" in r) {
    const total = r.sim + r.nao;
    partes.push(
      `Sim: ${r.sim} (${percentual(r.sim, total)}%); Não: ${r.nao} (${percentual(r.nao, total)}%)`,
    );
  }
  if ("textos" in r) {
    partes.push(
      r.textos
        .map((t) =>
          identificacao === "identificada" && t.autor
            ? `${t.autor}: ${t.texto}`
            : t.texto,
        )
        .join(" | "),
    );
  }
  if ("datas" in r) {
    partes.push(
      r.datas
        .map((d) => `${formatarDiaCivil(d.valor)}: ${d.quantidade}`)
        .join("; "),
    );
  }
  return partes.filter(Boolean).join(" · ");
}

/** CSV do resumo por pergunta (vale para todas as identificações). */
export function csvDoResumo(
  detalhe: PesquisaDetalhe,
  resultados: ResultadosPesquisa,
): string {
  const cabecalho = [
    "Seção",
    "Nº",
    "Pergunta",
    "Tipo",
    "Viram",
    "Responderam",
    "Resultado",
  ];
  if (!resultados.filtro.visivel) {
    return montarCsv(cabecalho, [
      [null, null, "Poucas respostas para mostrar", null, null, null, null],
    ]);
  }
  const porId = new Map(resultados.perguntas.map((r) => [r.perguntaId, r]));
  const linhas: CelulaDoCsv[][] = [];
  let n = 0;
  detalhe.secoes.forEach((s, si) => {
    for (const p of s.perguntas) {
      n += 1;
      const r = porId.get(p.id);
      linhas.push([
        s.titulo ?? `Seção ${si + 1}`,
        n,
        p.texto,
        ROTULO_DO_TIPO[p.tipo],
        r ? r.viram : 0,
        r ? r.respondidas : 0,
        resumoDoResultado(p, r, detalhe.identificacao),
      ]);
    }
  });
  return montarCsv(cabecalho, linhas);
}

/**
 * CSV das respostas por pessoa — só na identificada. Em qualquer outra
 * identificação devolve `null` (nunca nome de quem respondeu).
 */
export function csvDasRespostas(
  detalhe: PesquisaDetalhe,
  respostas: readonly RespostaIndividual[],
): string | null {
  if (detalhe.identificacao !== "identificada") return null;
  const perguntas = perguntasEmOrdem(detalhe.secoes);
  const cabecalho = [
    "Nome",
    "Departamento",
    "Respondida em",
    ...perguntas.map((p, i) => `${i + 1}. ${p.texto}`),
  ];
  const linhas = respostas.map((r) => {
    const valores = new Map(r.valores.map((v) => [v.perguntaId, v.valor]));
    return [
      r.nome,
      r.departamento,
      dataDoInstante(r.respondidaEm),
      ...perguntas.map((p) =>
        valores.has(p.id) ? textoDoValor(p, valores.get(p.id)) : SEM_RESPOSTA,
      ),
    ];
  });
  return montarCsv(cabecalho, linhas);
}

export function nomeDoCsv(nome: string, parte: "resumo" | "respostas"): string {
  return nomeDoArquivo([nome, parte], "csv");
}
