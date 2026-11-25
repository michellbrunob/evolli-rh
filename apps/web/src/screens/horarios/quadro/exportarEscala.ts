/**
 * T215 — Exportar a escala: o PDF para imprimir (a equipe por página, ou o
 * calendário de cada pessoa) e a planilha pessoa × dia. Só a escala
 * PUBLICADA sai no arquivo, para o mural e o colaborador verem a mesma coisa:
 * o rascunho fica de fora. Gerado no navegador; nada muda na escala.
 */
import type {
  PessoaDoQuadroApi,
  PublicacaoDaEscalaApi,
  RegrasDaEscalaApi,
} from "../../../api/escalaClient";
import {
  type Cor,
  DocumentoPdf,
  type PaginaPdf,
  cortarTexto,
} from "../../../arquivos/pdfSimples";
import {
  diaCivilDeHoje,
  diaMesComZero,
  formatarDiaCivil,
  numeroDoDia,
} from "../../../format/data";
import { plural } from "../../../format/plural";
import {
  type AbaXlsx,
  montarXlsx,
  montarZip,
} from "../../pessoas/importacao/planilhaXlsx";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../../pessoas/edicao/dadosProfissionais";
import {
  diaDaSemana,
  feriadoDe,
  formatarHoras,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import {
  type AvisoDaEscala,
  calcularAvisos,
  feriadoDaPessoa,
} from "./avisosDaEscala";
import { rotuloDaAusencia, siglaDaAusencia } from "./ausenciasDoQuadro";
import {
  type CelulaDoQuadro,
  DIAS_CURTOS,
  celulaDoDia,
  faixaDosPeriodos,
  tituloDoPeriodo,
} from "./quadroDaEscala";

export type FormatoDaExportacao = "pdf" | "xlsx";
export type PeriodoDaExportacao = "dia" | "semana" | "mes";
export type SepararPor =
  "unidade" | "departamento" | "turno" | "pessoa" | "nenhum";

export const ROTULO_DA_SEPARACAO: Readonly<Record<SepararPor, string>> = {
  unidade: "Unidade",
  departamento: "Departamento",
  turno: "Turno",
  pessoa: "Pessoa",
  nenhum: "Não separar",
};

/** O que vem depois do "Uma página por …". */
export const DETALHE_DA_SEPARACAO: Readonly<Record<SepararPor, string>> = {
  unidade: "agrupar por departamento",
  departamento: "agrupar por unidade",
  turno: "agrupar por departamento",
  pessoa: "calendário do período",
  nenhum: "agrupar por departamento",
};

export interface OpcoesDaExportacao {
  readonly formato: FormatoDaExportacao;
  readonly periodo: PeriodoDaExportacao;
  readonly inicio: string;
  readonly fim: string;
  readonly separarPor: SepararPor;
  /** "Pessoa": um PDF por pessoa, num arquivo .zip. */
  readonly zipPorPessoa: boolean;
  readonly horas: boolean;
  readonly legenda: boolean;
  readonly assinatura: boolean;
  /** Avisos da CLT (só para o RH). */
  readonly avisos: boolean;
}

export interface ContextoDaExportacao {
  readonly empresa: string | null;
  readonly publicacao: PublicacaoDaEscalaApi | null;
  readonly regras: RegrasDaEscalaApi | undefined;
  /** "25/11/2026 às 12:54" (o momento da geração). */
  readonly geradoEm: string;
}

/** Só o publicado: sem o rascunho e sem o padrão (dia sem publicação fica vazio). */
export function soPublicado(p: PessoaDoQuadroApi): PessoaDoQuadroApi {
  return {
    ...p,
    escalas: [],
    dias: (p.dias ?? []).filter((d) => d.camada === "publicado"),
  };
}

/** As pessoas com algum dia publicado no período (só com o publicado). */
export function pessoasPublicadas(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
): PessoaDoQuadroApi[] {
  const noPeriodo = new Set(dias);
  return pessoas
    .map(soPublicado)
    .filter((p) => (p.dias ?? []).some((d) => noPeriodo.has(d.dia)));
}

/** Dias com rascunho no período (as mudanças que não entram no arquivo). */
export function mudancasForaDoArquivo(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
): number {
  const noPeriodo = new Set(dias);
  return pessoas.reduce(
    (t, p) =>
      t +
      (p.dias ?? []).filter(
        (d) => d.camada === "rascunho" && noPeriodo.has(d.dia),
      ).length,
    0,
  );
}

const NOME_DO_PERIODO: Readonly<Record<PeriodoDaExportacao, string>> = {
  dia: "dia",
  semana: "semana",
  mes: "mes",
};

/** "escala-semana-2026-12-07.pdf" (".xlsx"; ".zip" com um PDF por pessoa). */
export function nomeDoArquivoDaEscala(o: OpcoesDaExportacao): string {
  const extensao =
    o.formato === "xlsx"
      ? "xlsx"
      : o.separarPor === "pessoa" && o.zipPorPessoa
        ? "zip"
        : "pdf";
  return `escala-${NOME_DO_PERIODO[o.periodo]}-${o.inicio}.${extensao}`;
}

/** "maria-silva-santos" (para o nome do arquivo de cada pessoa). */
export function nomeParaArquivo(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pessoa"
  );
}

/** "Escala da semana · 7 a 13 de dezembro de 2026". */
export function tituloDaExportacao(o: OpcoesDaExportacao): string {
  if (o.periodo === "dia")
    return `Escala do dia · ${formatarDiaCivil(o.inicio)}`;
  if (o.periodo === "mes")
    return `Escala do mês · ${tituloDoPeriodo("mes", o.inicio, o.fim)}`;
  return `Escala da semana · ${tituloDoPeriodo("semana", o.inicio, o.fim)}`;
}

/** O texto da célula: "Comercial 09:00–18:00", "Folga", "DSR", "Sobreaviso …" ou "". */
export function textoDaCelula(c: CelulaDoQuadro): string {
  if (c.tipo === "ausencia" && c.ausencia) return rotuloDaAusencia(c.ausencia);
  if (c.tipo === "folga") return "Folga";
  if (c.tipo === "dsr") return "DSR";
  if (c.tipo === "sobreaviso")
    return `Sobreaviso ${faixaDosPeriodos(c.periodos)}`;
  if (c.tipo === "trabalho") {
    return [
      c.turno?.nome,
      c.periodos.length > 0 ? faixaDosPeriodos(c.periodos) : null,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

/** Minutos de trabalho publicados da pessoa nos dias. */
export function minutosPublicados(
  p: PessoaDoQuadroApi,
  dias: readonly string[],
): number {
  return dias.reduce((t, d) => t + celulaDoDia(p, d).minutos, 0);
}

/** O turno que mais aparece na pessoa (para separar por turno). */
function turnoPrincipal(p: PessoaDoQuadroApi, dias: readonly string[]): string {
  const conta = new Map<string, number>();
  for (const d of dias) {
    const nome = celulaDoDia(p, d).turno?.nome;
    if (nome) conta.set(nome, (conta.get(nome) ?? 0) + 1);
  }
  return (
    [...conta.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? "Sem turno"
  );
}

export interface GrupoDaPagina {
  readonly nome: string;
  readonly pessoas: readonly PessoaDoQuadroApi[];
}

export interface PaginaDaEquipe {
  /** Unidade, departamento, turno ou pessoa; `null` = todas. */
  readonly nome: string | null;
  readonly grupos: readonly GrupoDaPagina[];
}

const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, "pt-BR");

function agruparPor(
  pessoas: readonly PessoaDoQuadroApi[],
  chave: (p: PessoaDoQuadroApi) => string,
): GrupoDaPagina[] {
  const m = new Map<string, PessoaDoQuadroApi[]>();
  for (const p of pessoas) m.set(chave(p), [...(m.get(chave(p)) ?? []), p]);
  return [...m.entries()]
    .map(([nome, ps]) => ({ nome, pessoas: [...ps].sort(porNome) }))
    .sort((a, b) =>
      SEM.has(a.nome) && !SEM.has(b.nome)
        ? 1
        : SEM.has(b.nome) && !SEM.has(a.nome)
          ? -1
          : a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/** Sem unidade ou departamento: o grupo vai para o fim. */
const SEM_UNIDADE = "Sem unidade";
const SEM_DEPARTAMENTO = "Sem departamento";
const SEM = new Set([SEM_UNIDADE, SEM_DEPARTAMENTO, "Sem turno"]);

const departamentoDe = (p: PessoaDoQuadroApi) =>
  p.departamento?.nome ?? SEM_DEPARTAMENTO;
const unidadeDe = (p: PessoaDoQuadroApi) => p.unidade?.nome ?? SEM_UNIDADE;

/** As páginas do PDF da equipe (cada uma com os grupos de dentro). */
export function paginasDaEquipe(
  pessoas: readonly PessoaDoQuadroApi[],
  separarPor: SepararPor,
  dias: readonly string[],
): PaginaDaEquipe[] {
  if (separarPor === "nenhum") {
    return [{ nome: null, grupos: agruparPor(pessoas, departamentoDe) }];
  }
  const chave =
    separarPor === "unidade"
      ? unidadeDe
      : separarPor === "departamento"
        ? departamentoDe
        : separarPor === "turno"
          ? (p: PessoaDoQuadroApi) => turnoPrincipal(p, dias)
          : (p: PessoaDoQuadroApi) => p.nome;
  const dentro = separarPor === "departamento" ? unidadeDe : departamentoDe;
  return agruparPor(pessoas, chave).map((g) => ({
    nome: g.nome,
    grupos: agruparPor(g.pessoas, dentro),
  }));
}

/** O resumo da pessoa no período (cabeçalho do calendário dela). */
export function resumoDaPessoa(
  p: PessoaDoQuadroApi,
  dias: readonly string[],
  regras: RegrasDaEscalaApi | undefined,
): { dias: number; minutos: number; folgas: number; feriados: number } {
  let trabalho = 0;
  let folgas = 0;
  let feriados = 0;
  let minutos = 0;
  for (const d of dias) {
    const c = celulaDoDia(p, d);
    if (c.tipo === "trabalho") {
      trabalho += 1;
      minutos += c.minutos;
      if (feriadoDaPessoa(p, d, regras)) feriados += 1;
    }
    if (c.tipo === "folga" || c.tipo === "dsr") folgas += 1;
  }
  return { dias: trabalho, minutos, folgas, feriados };
}

/** A legenda: um item por turno que aparece. */
export function legendaDosTurnos(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
): { nome: string; cor: string | null; texto: string }[] {
  const m = new Map<
    string,
    { nome: string; cor: string | null; texto: string }
  >();
  for (const p of pessoas) {
    for (const d of dias) {
      const c = celulaDoDia(p, d);
      if (c.tipo !== "trabalho" || !c.turno || m.has(c.turno.id)) continue;
      const intervalo =
        c.periodos.length === 1 && c.intervaloMinutos > 0
          ? ` · ${formatarHoras(c.intervaloMinutos)} de intervalo`
          : "";
      m.set(c.turno.id, {
        nome: c.turno.nome,
        cor: c.turno.cor ?? null,
        texto: `${c.turno.nome} ${faixaDosPeriodos(c.periodos)}${intervalo}`,
      });
    }
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ============================================================== cores do PDF

const CINZA: Cor = [138, 143, 152];

/** A cor de um token do tema (`#rrggbb`), ou a de reserva. */
export function corDoToken(nome: string, reserva: Cor): Cor {
  if (typeof document === "undefined") return reserva;
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(nome)
    .trim();
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(valor);
  return m
    ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)]
    : reserva;
}

function corDoTurnoNoPdf(cor: string | null | undefined): Cor {
  return corDoToken(`--turno-${(cor ?? "cinza").replace("_", "-")}`, CINZA);
}

interface Paleta {
  readonly marca: Cor;
  readonly tinta: Cor;
  readonly suave: Cor;
  readonly linha: Cor;
  readonly fundo: Cor;
  readonly branco: Cor;
}

function paleta(): Paleta {
  return {
    marca: corDoToken("--color-action", [0, 102, 204]),
    tinta: [29, 29, 31],
    suave: [102, 112, 133],
    linha: [222, 224, 228],
    fundo: [246, 247, 249],
    branco: [255, 255, 255],
  };
}

// ============================================================ PDF da equipe

const MARGEM = 32;

function cabecalhoDoPdf(pg: PaginaPdf, cores: Paleta): void {
  pg.retangulo(0, 0, pg.largura, 26, { preenchimento: cores.marca });
  pg.texto(MARGEM, 17, "Evolli", {
    tamanho: 11,
    negrito: true,
    cor: cores.branco,
  });
  pg.textoADireita(pg.largura - MARGEM, 17, "Escala de trabalho", {
    tamanho: 8,
    negrito: true,
    cor: cores.branco,
  });
}

function rodapeDoPdf(
  pg: PaginaPdf,
  cores: Paleta,
  ctx: ContextoDaExportacao,
  n: number,
  total: number,
  assinatura: string | null,
): void {
  const y = pg.altura - 24;
  if (assinatura) {
    pg.linha(MARGEM, y - 26, MARGEM + 180, y - 26, cores.suave);
    pg.texto(MARGEM, y - 17, assinatura, { tamanho: 7, cor: cores.suave });
    pg.linha(MARGEM + 210, y - 26, MARGEM + 300, y - 26, cores.suave);
    pg.texto(MARGEM + 210, y - 17, "Data", { tamanho: 7, cor: cores.suave });
  }
  pg.linha(MARGEM, y - 8, pg.largura - MARGEM, y - 8, cores.linha);
  pg.texto(MARGEM, y, `Gerado pelo Evolli em ${ctx.geradoEm}`, {
    tamanho: 7,
    cor: cores.suave,
  });
  pg.textoADireita(pg.largura - MARGEM, y, `${n}/${total}`, {
    tamanho: 7,
    cor: cores.suave,
  });
}

function versao(ctx: ContextoDaExportacao): string {
  const p = ctx.publicacao;
  if (!p) return "escala publicada";
  return `versão publicada em ${formatarDiaCivil(diaCivilDeHoje(new Date(p.publicadaEm)))}${p.publicadaPor ? ` por ${p.publicadaPor}` : ""}`;
}

function textoDoContrato(p: PessoaDoQuadroApi): string {
  return (
    (ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[p.tipoVinculo] ??
    p.tipoVinculo
  );
}

interface LinhaDaTabela {
  readonly tipo: "grupo" | "pessoa";
  readonly grupo?: GrupoDaPagina;
  readonly pessoa?: PessoaDoQuadroApi;
}

/** O PDF da equipe: A4 deitado, uma ou mais folhas por página lógica. */
export function pdfDaEquipe(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
  o: OpcoesDaExportacao,
  ctx: ContextoDaExportacao,
  avisos: readonly AvisoDaEscala[] = [],
): DocumentoPdf {
  const cores = paleta();
  const doc = new DocumentoPdf(tituloDaExportacao(o));
  const paginas = paginasDaEquipe(pessoas, o.separarPor, dias);
  const folhas: { pagina: PaginaDaEquipe; linhas: LinhaDaTabela[] }[] = [];
  const POR_FOLHA = o.periodo === "mes" ? 22 : 16;
  for (const pagina of paginas) {
    const linhas: LinhaDaTabela[] = pagina.grupos.flatMap((g) => [
      { tipo: "grupo" as const, grupo: g },
      ...g.pessoas.map((p) => ({ tipo: "pessoa" as const, pessoa: p })),
    ]);
    for (let i = 0; i < linhas.length || i === 0; i += POR_FOLHA) {
      folhas.push({ pagina, linhas: linhas.slice(i, i + POR_FOLHA) });
      if (linhas.length === 0) break;
    }
  }
  const legenda = o.legenda ? legendaDosTurnos(pessoas, dias) : [];
  folhas.forEach((folha, n) => {
    const pg = doc.novaPagina(true);
    cabecalhoDoPdf(pg, cores);
    pg.texto(MARGEM, 54, tituloDaExportacao(o), {
      tamanho: 14,
      negrito: true,
      cor: cores.tinta,
    });
    const local = [folha.pagina.nome, ctx.empresa, versao(ctx)]
      .filter(Boolean)
      .join(" · ");
    pg.texto(MARGEM, 68, cortarTexto(local, pg.largura - 2 * MARGEM - 160, 8), {
      tamanho: 8,
      cor: cores.suave,
    });
    pg.textoADireita(
      pg.largura - MARGEM,
      68,
      `Uma página por ${ROTULO_DA_SEPARACAO[o.separarPor].toLowerCase()}`,
      { tamanho: 8, cor: cores.marca },
    );

    // Tabela: colaborador, os dias e as horas.
    const xTabela = MARGEM;
    const larguraNome = o.periodo === "mes" ? 120 : 150;
    const larguraHoras = o.horas ? 40 : 0;
    const larguraDias = pg.largura - 2 * MARGEM - larguraNome - larguraHoras;
    const col = larguraDias / dias.length;
    let y = 82;
    pg.retangulo(xTabela, y, pg.largura - 2 * MARGEM, 22, {
      preenchimento: cores.fundo,
    });
    pg.texto(xTabela + 6, y + 14, "Colaborador", {
      tamanho: 7,
      cor: cores.suave,
    });
    dias.forEach((d, i) => {
      const x = xTabela + larguraNome + i * col;
      const rotulo =
        o.periodo === "mes"
          ? `${numeroDoDia(d)}`
          : `${DIAS_CURTOS[diaDaSemana(d) - 1]} ${numeroDoDia(d)}`;
      pg.texto(x + 3, y + 14, rotulo, {
        tamanho: 7,
        negrito: o.periodo !== "mes",
        cor: feriadoDe(d) ? cores.marca : cores.tinta,
      });
    });
    if (o.horas)
      pg.texto(pg.largura - MARGEM - larguraHoras + 4, y + 14, "Horas", {
        tamanho: 7,
        cor: cores.suave,
      });
    y += 22;
    for (const linha of folha.linhas) {
      if (linha.tipo === "grupo") {
        const g = linha.grupo!;
        const total = g.pessoas.reduce(
          (t, p) => t + minutosPublicados(p, dias),
          0,
        );
        pg.linha(xTabela, y, pg.largura - MARGEM, y, cores.linha);
        pg.texto(xTabela + 6, y + 12, cortarTexto(g.nome, 260, 8, true), {
          tamanho: 8,
          negrito: true,
          cor: cores.tinta,
        });
        pg.texto(
          xTabela + 270,
          y + 12,
          plural(g.pessoas.length, "pessoa", "pessoas"),
          { tamanho: 7, cor: cores.suave },
        );
        if (o.horas)
          pg.textoADireita(
            pg.largura - MARGEM - 4,
            y + 12,
            `${formatarHoras(total)} no período`,
            { tamanho: 7, cor: cores.suave },
          );
        y += 18;
        continue;
      }
      const p = linha.pessoa!;
      const altura = o.periodo === "mes" ? 18 : 26;
      pg.linha(xTabela, y, pg.largura - MARGEM, y, cores.linha);
      pg.texto(
        xTabela + 6,
        y + 11,
        cortarTexto(p.nome, larguraNome - 10, 8, true),
        { tamanho: 8, negrito: true, cor: cores.tinta },
      );
      if (o.periodo !== "mes") {
        pg.texto(xTabela + 6, y + 21, textoDoContrato(p), {
          tamanho: 6.5,
          cor: cores.suave,
        });
      }
      dias.forEach((d, i) => {
        const c = celulaDoDia(p, d);
        const x = xTabela + larguraNome + i * col + 3;
        if (c.tipo === "trabalho" && c.turno) {
          if (o.periodo === "mes") {
            pg.ponto(x + 2, y + 8, 1.6, corDoTurnoNoPdf(c.turno.cor));
            pg.texto(x + 5, y + 11, c.turno.sigla || c.turno.nome.charAt(0), {
              tamanho: 6.5,
              negrito: true,
              cor: cores.tinta,
            });
          } else {
            pg.ponto(x + 2, y + 8, 2, corDoTurnoNoPdf(c.turno.cor));
            pg.texto(
              x + 6,
              y + 10,
              cortarTexto(c.turno.nome, col - 10, 7, true),
              { tamanho: 7, negrito: true, cor: cores.tinta },
            );
            pg.texto(
              x,
              y + 20,
              cortarTexto(faixaDosPeriodos(c.periodos), col - 4, 6.5),
              { tamanho: 6.5, cor: cores.suave },
            );
          }
        } else if (c.tipo !== "sem-escala" && c.tipo !== "fora") {
          const t =
            o.periodo === "mes"
              ? c.tipo === "ausencia" && c.ausencia
                ? siglaDaAusencia(c.ausencia)
                : c.tipo === "dsr"
                  ? "D"
                  : c.tipo === "folga"
                    ? "F"
                    : "S"
              : textoDaCelula(c);
          pg.texto(x, y + 11, cortarTexto(t, col - 4, 7), {
            tamanho: 7,
            cor: cores.suave,
          });
        }
      });
      if (o.horas) {
        pg.textoADireita(
          pg.largura - MARGEM - 4,
          y + 11,
          formatarHoras(minutosPublicados(p, dias)),
          { tamanho: 8, negrito: true, cor: cores.tinta },
        );
      }
      y += altura;
    }
    pg.linha(xTabela, y, pg.largura - MARGEM, y, cores.linha);
    y += 14;
    if (legenda.length > 0) {
      let x = MARGEM;
      for (const item of legenda) {
        const largura = Math.min(220, 14 + item.texto.length * 4);
        if (x + largura > pg.largura - MARGEM) {
          x = MARGEM;
          y += 12;
        }
        pg.ponto(x + 3, y - 3, 2, corDoTurnoNoPdf(item.cor));
        pg.texto(x + 8, y, cortarTexto(item.texto, largura - 12, 7), {
          tamanho: 7,
          cor: cores.suave,
        });
        x += largura;
      }
      y += 14;
    }
    // Avisos da CLT: na última folha, enquanto couber.
    if (o.avisos && n === folhas.length - 1 && avisos.length > 0) {
      pg.texto(MARGEM, y, "Avisos da CLT (só para o RH)", {
        tamanho: 8,
        negrito: true,
        cor: cores.tinta,
      });
      y += 11;
      for (const a of avisos) {
        if (y > pg.altura - 70) break;
        pg.texto(
          MARGEM,
          y,
          cortarTexto(
            `${a.nome}: ${a.titulo} · ${diaMesComZero(a.dia)}`,
            pg.largura - 2 * MARGEM,
            7,
          ),
          { tamanho: 7, cor: cores.suave },
        );
        y += 10;
      }
    }
    rodapeDoPdf(
      pg,
      cores,
      ctx,
      n + 1,
      folhas.length,
      o.assinatura ? "Responsável" : null,
    );
  });
  return doc;
}

// ======================================================= PDF de cada pessoa

/** O calendário da pessoa no período: A4 em pé. */
export function pdfDaPessoa(
  p: PessoaDoQuadroApi,
  dias: readonly string[],
  o: OpcoesDaExportacao,
  ctx: ContextoDaExportacao,
  semanaComeca = 1,
): DocumentoPdf {
  const cores = paleta();
  const doc = new DocumentoPdf(
    `${p.nome} · ${tituloDoPeriodo(o.periodo === "mes" ? "mes" : "semana", o.inicio, o.fim)}`,
  );
  const pg = doc.novaPagina(false);
  cabecalhoDoPdf(pg, cores);
  const periodo =
    o.periodo === "dia"
      ? formatarDiaCivil(o.inicio)
      : tituloDoPeriodo(
          o.periodo === "mes" ? "mes" : "semana",
          o.inicio,
          o.fim,
        );
  pg.texto(
    MARGEM,
    56,
    cortarTexto(`${p.nome} · ${periodo}`, pg.largura - 2 * MARGEM, 14, true),
    { tamanho: 14, negrito: true, cor: cores.tinta },
  );
  pg.texto(
    MARGEM,
    70,
    [textoDoContrato(p), ctx.empresa, versao(ctx)].filter(Boolean).join(" · "),
    { tamanho: 8, cor: cores.suave },
  );

  // Os números do período.
  const r = resumoDaPessoa(p, dias, ctx.regras);
  const caixas: [string, string][] = [
    [String(r.dias), r.dias === 1 ? "dia de trabalho" : "dias de trabalho"],
    [formatarHoras(r.minutos), "previstas"],
    [String(r.folgas), r.folgas === 1 ? "folga (ou DSR)" : "folgas (e DSR)"],
    [
      String(r.feriados),
      r.feriados === 1 ? "feriado trabalhado" : "feriados trabalhados",
    ],
  ];
  const larguraCaixa = (pg.largura - 2 * MARGEM - 3 * 8) / 4;
  caixas.forEach(([valor, rotulo], i) => {
    const x = MARGEM + i * (larguraCaixa + 8);
    pg.retangulo(x, 84, larguraCaixa, 40, { contorno: cores.linha });
    pg.texto(x + 8, 102, valor, {
      tamanho: 13,
      negrito: true,
      cor: cores.tinta,
    });
    pg.texto(x + 8, 116, rotulo, { tamanho: 7, cor: cores.suave });
  });

  // O calendário: semanas a partir do dia de início da semana das Regras.
  const largura = (pg.largura - 2 * MARGEM) / 7;
  let y = 140;
  pg.retangulo(MARGEM, y, pg.largura - 2 * MARGEM, 16, {
    preenchimento: cores.fundo,
  });
  for (let i = 0; i < 7; i += 1) {
    const semana = ((semanaComeca - 1 + i) % 7) + 1;
    pg.texto(MARGEM + i * largura + 4, y + 11, DIAS_CURTOS[semana - 1]!, {
      tamanho: 7,
      cor: cores.suave,
    });
  }
  y += 16;
  const deslocamento = (diaDaSemana(dias[0]!) - semanaComeca + 7) % 7;
  const casas: (string | null)[] = [...Array(deslocamento).fill(null), ...dias];
  const ALTURA = 52;
  for (let i = 0; i < casas.length; i += 7) {
    const semana = casas.slice(i, i + 7);
    semana.forEach((d, j) => {
      const x = MARGEM + j * largura;
      pg.retangulo(x, y, largura, ALTURA, {
        contorno: cores.linha,
        ...(d ? {} : { preenchimento: cores.fundo }),
      });
      if (!d) return;
      const feriado = feriadoDaPessoa(p, d, ctx.regras);
      pg.texto(x + 4, y + 11, `${numeroDoDia(d)}`, {
        tamanho: 8,
        negrito: true,
        cor: feriado ? cores.marca : cores.tinta,
      });
      if (feriado)
        pg.texto(x + 18, y + 11, cortarTexto(feriado, largura - 22, 6), {
          tamanho: 6,
          cor: cores.marca,
        });
      const c = celulaDoDia(p, d);
      if (c.tipo === "trabalho" && c.turno) {
        pg.ponto(x + 6, y + 23, 2, corDoTurnoNoPdf(c.turno.cor));
        pg.texto(
          x + 11,
          y + 25,
          cortarTexto(c.turno.nome, largura - 15, 7, true),
          { tamanho: 7, negrito: true, cor: cores.tinta },
        );
        pg.texto(
          x + 4,
          y + 36,
          cortarTexto(faixaDosPeriodos(c.periodos), largura - 8, 6.5),
          { tamanho: 6.5, cor: cores.suave },
        );
      } else if (
        c.tipo === "folga" ||
        c.tipo === "dsr" ||
        c.tipo === "sobreaviso" ||
        c.tipo === "ausencia"
      ) {
        pg.texto(x + 4, y + 25, cortarTexto(textoDaCelula(c), largura - 8, 7), {
          tamanho: 7,
          cor: cores.suave,
        });
      }
    });
    y += ALTURA;
  }
  y += 14;
  if (o.legenda) {
    for (const item of legendaDosTurnos([p], dias)) {
      pg.ponto(MARGEM + 3, y - 3, 2, corDoTurnoNoPdf(item.cor));
      pg.texto(MARGEM + 9, y, item.texto, { tamanho: 7, cor: cores.suave });
      y += 11;
    }
  }
  rodapeDoPdf(
    pg,
    cores,
    ctx,
    1,
    1,
    o.assinatura ? "Ciente do colaborador" : null,
  );
  return doc;
}

// ================================================================ planilha

/** A planilha: aba "Escala" (o texto de cada dia) e "Horas previstas". */
export function planilhaDaEscala(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
  o: OpcoesDaExportacao,
  avisos: readonly AvisoDaEscala[] = [],
): AbaXlsx[] {
  const ordenadas = [...pessoas].sort(porNome);
  const datas = dias.map((d) => diaMesComZero(d));
  const escala: AbaXlsx = {
    nome: "Escala",
    cabecalho: true,
    larguras: [32, 22, 22, ...dias.map(() => 22), ...(o.horas ? [10] : [])],
    linhas: [
      [
        "Colaborador",
        "Departamento",
        "Unidade",
        ...datas,
        ...(o.horas ? ["Horas"] : []),
      ],
      ...ordenadas.map((p) => [
        p.nome,
        departamentoDe(p),
        unidadeDe(p),
        ...dias.map((d) => textoDaCelula(celulaDoDia(p, d))),
        ...(o.horas ? [formatarHoras(minutosPublicados(p, dias))] : []),
      ]),
    ],
  };
  const horas: AbaXlsx = {
    nome: "Horas previstas",
    cabecalho: true,
    larguras: [32, ...dias.map(() => 8), 10],
    linhas: [
      ["Colaborador", ...datas, "Total"],
      ...ordenadas.map((p) => {
        const porDia = dias.map(
          (d) => Math.round((celulaDoDia(p, d).minutos / 60) * 100) / 100,
        );
        return [
          p.nome,
          ...porDia,
          Math.round(porDia.reduce((t, h) => t + h, 0) * 100) / 100,
        ];
      }),
    ],
  };
  const abas = [escala, horas];
  if (o.avisos && avisos.length > 0) {
    abas.push({
      nome: "Avisos da CLT",
      cabecalho: true,
      larguras: [32, 12, 48, 70],
      linhas: [
        ["Colaborador", "Dia", "Aviso", "Por quê"],
        ...avisos.map((a) => [
          a.nome,
          formatarDiaCivil(a.dia),
          a.titulo,
          a.explicacao,
        ]),
      ],
    });
  }
  return abas;
}

/** Os avisos que entram no arquivo (só do publicado). */
export function avisosDoArquivo(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
  regras: RegrasDaEscalaApi | undefined,
): AvisoDaEscala[] {
  return calcularAvisos(pessoas, dias, regras);
}

export const TIPO_PDF = "application/pdf";
export const TIPO_ZIP = "application/zip";

/** O arquivo pronto: bytes, nome e tipo. */
export function gerarArquivoDaEscala(
  todas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
  o: OpcoesDaExportacao,
  ctx: ContextoDaExportacao,
  semanaComeca = 1,
): { bytes: Uint8Array; nome: string; tipo: string; paginas: number } {
  const pessoas = pessoasPublicadas(todas, dias);
  const avisos = o.avisos ? avisosDoArquivo(pessoas, dias, ctx.regras) : [];
  const nome = nomeDoArquivoDaEscala(o);
  if (o.formato === "xlsx") {
    return {
      bytes: montarXlsx(planilhaDaEscala(pessoas, dias, o, avisos)),
      nome,
      tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      paginas: 0,
    };
  }
  if (o.separarPor === "pessoa" && o.zipPorPessoa) {
    const arquivos = [...pessoas]
      .sort(porNome)
      .map(
        (p) =>
          [
            `escala-${nomeParaArquivo(p.nome)}-${o.inicio}.pdf`,
            pdfDaPessoa(p, dias, o, ctx, semanaComeca).bytes(),
          ] as const,
      );
    return {
      bytes: montarZip(arquivos),
      nome,
      tipo: TIPO_ZIP,
      paginas: arquivos.length,
    };
  }
  const doc =
    o.separarPor === "pessoa"
      ? juntarPessoas(pessoas, dias, o, ctx, semanaComeca)
      : pdfDaEquipe(pessoas, dias, o, ctx, avisos);
  return {
    bytes: doc.bytes(),
    nome,
    tipo: TIPO_PDF,
    paginas: doc.paginas.length,
  };
}

/** Um PDF com uma página por pessoa. */
function juntarPessoas(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
  o: OpcoesDaExportacao,
  ctx: ContextoDaExportacao,
  semanaComeca: number,
): DocumentoPdf {
  const doc = new DocumentoPdf(tituloDaExportacao(o));
  for (const p of [...pessoas].sort(porNome)) {
    doc.paginas.push(...pdfDaPessoa(p, dias, o, ctx, semanaComeca).paginas);
  }
  return doc;
}
