/**
 * T216 — Riscos psicossociais (NR-1): os documentos gerados no navegador,
 * sem dependência (`arquivos/pdfSimples` e o .zip sem compressão do módulo
 * de importação):
 *
 * - o PDF do plano de ação: as medidas da empresa por dimensão e as medidas
 *   sugeridas (biblioteca do Evolli) das dimensões em nível crítico, alto e
 *   médio, com opções, referência, indicador e prazo;
 * - o PDF da conformidade: as 7 etapas, o que foi marcado, as evidências
 *   descritas e anexadas, e os campos de assinatura;
 * - o pacote "Baixar tudo (.zip)": os dois PDFs, a planilha de respostas
 *   e os arquivos de evidência de cada etapa.
 *
 * O conteúdo é montado em blocos (função pura, testada) e depois desenhado.
 */
import type {
  AcompanhamentoNr1,
  MedidaDoPlano,
  NivelNr1,
  ResultadoNr1,
} from "../../../../api/modelosDePesquisaClient";
import {
  type Cor,
  DocumentoPdf,
  type PaginaPdf,
  larguraDoTexto,
} from "../../../../arquivos/pdfSimples";
import { formatarDiaCivil, formatarInstante } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { montarZip } from "../../../pessoas/importacao/planilhaXlsx";
import { dimensaoNr1 } from "./definicao";
import { prazoPeloNivel, sugestoesDa, textoDoPrazo } from "./medidasSugeridas";
import {
  CONTROLES,
  ETAPAS_DA_CONFORMIDADE,
  NIVEL,
  ROTULO_DA_SITUACAO,
  ROTULO_DO_CONTROLE,
} from "./textos";

export type Bloco =
  | { readonly tipo: "titulo"; readonly texto: string }
  | { readonly tipo: "subtitulo"; readonly texto: string; readonly cor?: Cor }
  | {
      readonly tipo: "texto";
      readonly texto: string;
      readonly negrito?: boolean;
      readonly suave?: boolean;
      readonly recuo?: number;
      readonly cor?: Cor;
    }
  | { readonly tipo: "aviso"; readonly texto: string }
  | { readonly tipo: "assinatura"; readonly rotulos: readonly string[] }
  | { readonly tipo: "espaco" };

export interface ContextoDoDocumento {
  readonly empresa: string;
  readonly pesquisa: string;
  /** AAAA-MM-DD. */
  readonly hoje: string;
}

const COR_DO_CONTROLE: Readonly<Record<MedidaDoPlano["controle"], Cor>> = {
  eliminacao: [185, 28, 28],
  substituicao: [234, 88, 12],
  administrativo: [37, 99, 235],
  protecao: [22, 163, 74],
};

const hex = (h: string): Cor => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** Níveis que recebem sugestões no documento. */
const NIVEIS_COM_SUGESTAO: readonly NivelNr1[] = ["critico", "alto", "medio"];

function linhaDaMedida(m: MedidaDoPlano): string {
  return [
    ROTULO_DO_CONTROLE[m.controle],
    m.responsavel ? `Responsável: ${m.responsavel}` : null,
    m.prazo ? `Prazo: ${formatarDiaCivil(m.prazo)}` : null,
    ROTULO_DA_SITUACAO[m.situacao],
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Os blocos do PDF do plano de ação. */
export function blocosDoPlano(
  resultado: ResultadoNr1 | null,
  plano: readonly MedidaDoPlano[],
  ctx: ContextoDoDocumento,
): Bloco[] {
  // Sem o resultado (poucas respostas na confidencial): só as medidas.
  const r: Pick<ResultadoNr1, "dimensoes" | "prioridades"> = resultado ?? {
    dimensoes: [],
    prioridades: [],
  };
  const porId = new Map(r.dimensoes.map((d) => [d.id, d]));
  const blocos: Bloco[] = [
    { tipo: "titulo", texto: "Plano de ação · Riscos psicossociais (NR-1)" },
    {
      tipo: "texto",
      texto: `${ctx.empresa || "Empresa"} · ${ctx.pesquisa} · gerado em ${formatarDiaCivil(ctx.hoje)}`,
      suave: true,
    },
    {
      tipo: "aviso",
      texto:
        "Documento de apoio: o plano é responsabilidade da empresa. Revise, date e valide as medidas com o profissional de SST antes de levá-las ao PGR (NR-1, item 1.5).",
    },
    {
      tipo: "texto",
      texto: `Ordem de prioridade dos controles: ${CONTROLES.map((c, i) => `${i + 1} ${c.rotulo}`).join(" · ")}.`,
      suave: true,
    },
    { tipo: "espaco" },
    { tipo: "subtitulo", texto: "1. Medidas do plano da empresa" },
  ];
  if (plano.length === 0) {
    blocos.push({
      tipo: "texto",
      texto: "Nenhuma medida registrada ainda.",
      suave: true,
    });
  }
  const ordem = [
    ...r.prioridades,
    ...plano
      .map((m) => m.dimensaoId)
      .filter((id) => !r.prioridades.includes(id)),
  ];
  for (const id of [...new Set(ordem)]) {
    const medidas = plano.filter((m) => m.dimensaoId === id);
    if (!medidas.length) continue;
    const nivel = porId.get(id)?.nivel ?? null;
    blocos.push({
      tipo: "texto",
      negrito: true,
      texto: `${dimensaoNr1(id).rotulo}${nivel ? ` · ${NIVEL[nivel].rotulo}` : ""} · ${plural(medidas.length, "medida", "medidas")}`,
      ...(nivel ? { cor: hex(NIVEL[nivel].cor) } : {}),
    });
    for (const m of medidas) {
      blocos.push(
        {
          tipo: "texto",
          texto: `• ${m.titulo}`,
          negrito: true,
          recuo: 10,
          cor: COR_DO_CONTROLE[m.controle],
        },
        { tipo: "texto", texto: linhaDaMedida(m), recuo: 20, suave: true },
      );
      if (m.descricao)
        blocos.push({ tipo: "texto", texto: m.descricao, recuo: 20 });
      if (m.indicador)
        blocos.push({
          tipo: "texto",
          texto: `Indicador: ${m.indicador}`,
          recuo: 20,
        });
    }
  }

  blocos.push(
    { tipo: "espaco" },
    {
      tipo: "subtitulo",
      texto: "2. Medidas sugeridas por dimensão (crítico, alto e médio)",
    },
    {
      tipo: "texto",
      texto:
        "Sugestões da biblioteca do Evolli, na ordem de controles da NR-1. Escolha, adapte e registre no plano o que fizer sentido para a empresa.",
      suave: true,
    },
  );
  const comSugestao = r.prioridades.filter((id) => {
    const n = porId.get(id)?.nivel;
    return n !== null && n !== undefined && NIVEIS_COM_SUGESTAO.includes(n);
  });
  if (comSugestao.length === 0) {
    blocos.push({
      tipo: "texto",
      texto: "Nenhuma dimensão em nível crítico, alto ou médio.",
      suave: true,
    });
  }
  for (const id of comSugestao) {
    const nivel = porId.get(id)!.nivel!;
    blocos.push({
      tipo: "texto",
      negrito: true,
      texto: `${dimensaoNr1(id).rotulo} · ${NIVEL[nivel].rotulo} · ${NIVEL[nivel].acao}`,
      cor: hex(NIVEL[nivel].cor),
    });
    for (const s of sugestoesDa(id)) {
      blocos.push(
        {
          tipo: "texto",
          texto: `• ${s.titulo}`,
          negrito: true,
          recuo: 10,
          cor: COR_DO_CONTROLE[s.controle],
        },
        {
          tipo: "texto",
          texto: `${ROTULO_DO_CONTROLE[s.controle]} · ${textoDoPrazo(prazoPeloNivel(s, nivel))}`,
          recuo: 20,
          suave: true,
        },
        { tipo: "texto", texto: s.descricao, recuo: 20 },
        { tipo: "texto", texto: `Opção A: ${s.opcaoA}`, recuo: 20 },
        { tipo: "texto", texto: `Opção B: ${s.opcaoB}`, recuo: 20 },
        {
          tipo: "texto",
          texto: `Indicador: ${s.indicador}`,
          recuo: 20,
        },
        {
          tipo: "texto",
          texto: `Referência: ${s.referencia}`,
          recuo: 20,
          suave: true,
        },
      );
    }
  }
  return blocos;
}

/** Os blocos do PDF da conformidade (etapas, evidências e assinaturas). */
export function blocosDaConformidade(
  a: AcompanhamentoNr1,
  ctx: ContextoDoDocumento,
): Bloco[] {
  const blocos: Bloco[] = [
    { tipo: "titulo", texto: "Conformidade com a NR-1 · Riscos psicossociais" },
    {
      tipo: "texto",
      texto: `${ctx.empresa || "Empresa"} · ${ctx.pesquisa} · gerado em ${formatarDiaCivil(ctx.hoje)}`,
      suave: true,
    },
    {
      tipo: "texto",
      texto: `${a.concluidas} de 7 etapas concluídas.`,
      negrito: true,
    },
    { tipo: "espaco" },
  ];
  ETAPAS_DA_CONFORMIDADE.forEach((def, i) => {
    const e = a.etapas.find((x) => x.id === def.id);
    const situacao = e?.concluida
      ? e.concluidaEm
        ? `Concluída em ${formatarInstante(e.concluidaEm).slice(0, 10)}`
        : "Concluída"
      : "Pendente";
    blocos.push({
      tipo: "subtitulo",
      texto: `${i + 1}. ${def.titulo} · ${situacao}`,
    });
    def.itens.forEach((t, j) =>
      blocos.push({
        tipo: "texto",
        texto: `${e?.itens[j] ? "[x]" : "[ ]"} ${t}`,
        recuo: 10,
      }),
    );
    if (e?.evidencias)
      blocos.push({
        tipo: "texto",
        texto: `Evidências: ${e.evidencias}`,
        recuo: 10,
      });
    const arquivos = e?.arquivos ?? [];
    if (arquivos.length)
      blocos.push({
        tipo: "texto",
        texto: `Arquivos anexados: ${arquivos.map((x) => x.nome).join(", ")}`,
        recuo: 10,
        suave: true,
      });
  });
  blocos.push(
    { tipo: "espaco" },
    { tipo: "subtitulo", texto: "Revisão e aprovação" },
    {
      tipo: "texto",
      texto: `Profissional de SST: ${a.profissionalSst.nome ?? "—"}${a.profissionalSst.registro ? ` · ${a.profissionalSst.registro}` : ""}`,
    },
    {
      tipo: "assinatura",
      rotulos: [
        "Nome e cargo · Responsável pela organização · Data",
        "Nome e registro · Profissional de SST · Data",
      ],
    },
  );
  return blocos;
}

/** Quebra o texto em linhas que cabem na largura. */
export function quebrarLinhas(
  texto: string,
  largura: number,
  tamanho: number,
  negrito = false,
): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (larguraDoTexto(tentativa, tamanho, negrito) <= largura || !atual) {
        atual = tentativa;
      } else {
        linhas.push(atual);
        atual = palavra;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

const MARGEM = 48;
const PRETO: Cor = [17, 24, 39];
const SUAVE: Cor = [100, 106, 120];
const DESTAQUE: Cor = [190, 24, 93];
const FUNDO_DO_AVISO: Cor = [254, 243, 199];

/** Desenha os blocos em páginas A4 e numera o rodapé. */
export function desenharPdf(titulo: string, blocos: readonly Bloco[]) {
  const doc = new DocumentoPdf(titulo);
  let pg: PaginaPdf = doc.novaPagina();
  const largura = pg.largura - 2 * MARGEM;
  let y = MARGEM;
  const garantir = (altura: number) => {
    if (y + altura > pg.altura - MARGEM - 16) {
      pg = doc.novaPagina();
      y = MARGEM;
    }
  };
  const escrever = (
    texto: string,
    o: {
      tamanho: number;
      negrito?: boolean;
      cor?: Cor;
      recuo?: number;
      entrelinha?: number;
    },
  ) => {
    const recuo = o.recuo ?? 0;
    const passo = o.entrelinha ?? o.tamanho * 1.35;
    for (const linha of quebrarLinhas(
      texto,
      largura - recuo,
      o.tamanho,
      o.negrito,
    )) {
      garantir(passo);
      y += passo;
      pg.texto(MARGEM + recuo, y, linha, {
        tamanho: o.tamanho,
        negrito: o.negrito ?? false,
        cor: o.cor ?? PRETO,
      });
    }
  };
  for (const b of blocos) {
    switch (b.tipo) {
      case "titulo":
        escrever(b.texto, { tamanho: 16, negrito: true, cor: DESTAQUE });
        y += 4;
        break;
      case "subtitulo":
        garantir(40);
        y += 8;
        escrever(b.texto, { tamanho: 12, negrito: true, cor: b.cor ?? PRETO });
        pg.linha(MARGEM, y + 4, MARGEM + largura, y + 4, [229, 231, 235]);
        y += 6;
        break;
      case "texto":
        escrever(b.texto, {
          tamanho: 9.5,
          negrito: b.negrito ?? false,
          cor: b.cor ?? (b.suave ? SUAVE : PRETO),
          recuo: b.recuo ?? 0,
        });
        if (b.negrito && !b.recuo) y += 2;
        break;
      case "aviso": {
        const linhas = quebrarLinhas(b.texto, largura - 16, 9.5);
        const altura = linhas.length * 13 + 12;
        garantir(altura + 8);
        y += 8;
        pg.retangulo(MARGEM, y, largura, altura, {
          preenchimento: FUNDO_DO_AVISO,
        });
        let yy = y + 4;
        for (const l of linhas) {
          yy += 13;
          pg.texto(MARGEM + 8, yy, l, { tamanho: 9.5, cor: [120, 53, 15] });
        }
        y += altura;
        break;
      }
      case "assinatura":
        for (const r of b.rotulos) {
          garantir(60);
          y += 44;
          pg.linha(MARGEM, y, MARGEM + largura * 0.7, y, PRETO);
          y += 12;
          pg.texto(MARGEM, y, r, { tamanho: 8.5, cor: SUAVE });
        }
        break;
      case "espaco":
        y += 10;
        break;
    }
  }
  doc.paginas.forEach((p, i) => {
    p.texto(MARGEM, p.altura - 24, titulo, { tamanho: 8, cor: SUAVE });
    p.textoADireita(
      p.largura - MARGEM,
      p.altura - 24,
      `${i + 1} / ${doc.paginas.length}`,
      { tamanho: 8, cor: SUAVE },
    );
  });
  return doc;
}

export function pdfDoPlano(
  r: ResultadoNr1 | null,
  plano: readonly MedidaDoPlano[],
  ctx: ContextoDoDocumento,
): Uint8Array {
  return desenharPdf(
    "NR-1 · Plano de ação",
    blocosDoPlano(r, plano, ctx),
  ).bytes();
}

export function pdfDaConformidade(
  a: AcompanhamentoNr1,
  ctx: ContextoDoDocumento,
): Uint8Array {
  return desenharPdf(
    "NR-1 · Conformidade",
    blocosDaConformidade(a, ctx),
  ).bytes();
}

/** "ata-da-reuniao": o nome seguro dentro do .zip (sem caminho). */
export function nomeNoPacote(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._ -]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^[.-]+/, "")
      .slice(0, 120) || "arquivo"
  );
}

/** "ata.pdf" → "ata-2.pdf" (nome repetido na mesma etapa). */
function comNumero(nome: string, i: number): string {
  const ponto = nome.lastIndexOf(".");
  return ponto > 0
    ? `${nome.slice(0, ponto)}-${i}${nome.slice(ponto)}`
    : `${nome}-${i}`;
}

export interface ArquivoDoPacote {
  readonly etapa: string;
  readonly nome: string;
  readonly bytes: Uint8Array;
}

/**
 * O pacote da conformidade: `01-plano-de-acao.pdf`, `02-conformidade.pdf`,
 * `03-respostas.xlsx` (quando houver) e `evidencias/NN-etapa/arquivo`.
 * Nomes repetidos na mesma etapa ganham um número.
 */
export function montarPacote(x: {
  readonly plano: Uint8Array;
  readonly conformidade: Uint8Array;
  readonly planilha: Uint8Array | null;
  readonly evidencias: readonly ArquivoDoPacote[];
}): { bytes: Uint8Array; arquivos: string[] } {
  const entradas: [string, Uint8Array][] = [
    ["01-plano-de-acao.pdf", x.plano],
    ["02-conformidade.pdf", x.conformidade],
  ];
  if (x.planilha) entradas.push(["03-respostas.xlsx", x.planilha]);
  const usados = new Set<string>();
  for (const e of x.evidencias) {
    const n = ETAPAS_DA_CONFORMIDADE.findIndex((d) => d.id === e.etapa) + 1;
    const pasta = ["evidencias", `${String(n).padStart(2, "0")}-${e.etapa}`];
    const base = nomeNoPacote(e.nome);
    let caminho = [...pasta, base].join("/");
    for (let i = 2; usados.has(caminho); i += 1) {
      caminho = [...pasta, comNumero(base, i)].join("/");
    }
    usados.add(caminho);
    entradas.push([caminho, e.bytes]);
  }
  return {
    bytes: montarZip(entradas),
    arquivos: entradas.map(([nome]) => nome),
  };
}
