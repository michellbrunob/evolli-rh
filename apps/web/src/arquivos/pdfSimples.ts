/**
 * T215 — um gerador de PDF pequeno, sem dependência: páginas A4, texto em
 * Helvetica (normal e negrito, codificação WinAnsi: acentos do português),
 * retângulos e linhas. Basta para documentos de tabela, como a escala
 * exportada. Coordenadas em pontos, a partir do canto de CIMA à esquerda.
 */

export type Cor = readonly [number, number, number];

export interface EstiloDoTexto {
  readonly tamanho?: number;
  readonly negrito?: boolean;
  readonly cor?: Cor;
}

export const A4 = { largura: 595.28, altura: 841.89 } as const;

/** Larguras da Helvetica (1/1000 em), caracteres 32 a 126. */
const LARGURAS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

/** Caracteres fora do Latin-1 que a WinAnsi tem (0x80 a 0x9F). */
const WIN_ANSI: Readonly<Record<string, number>> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
};

/** O texto em bytes WinAnsi (o que não existe vira "?"). */
export function bytesWinAnsi(texto: string): number[] {
  return [...texto].map((c) => {
    const especial = WIN_ANSI[c];
    if (especial !== undefined) return especial;
    const n = c.codePointAt(0)!;
    return n < 256 && (n < 0x80 || n > 0x9f) ? n : 0x3f;
  });
}

/** Largura do texto em pontos (aproximada para acentos e símbolos). */
export function larguraDoTexto(
  texto: string,
  tamanho: number,
  negrito = false,
): number {
  let total = 0;
  for (const c of texto.normalize("NFD").replace(/[̀-ͯ]/g, "")) {
    const n = c.codePointAt(0)!;
    total += n >= 32 && n <= 126 ? LARGURAS[n - 32]! : 556;
  }
  return (total * tamanho * (negrito ? 1.06 : 1)) / 1000;
}

/** Corta o texto (com "…") para caber na largura. */
export function cortarTexto(
  texto: string,
  largura: number,
  tamanho: number,
  negrito = false,
): string {
  if (larguraDoTexto(texto, tamanho, negrito) <= largura) return texto;
  let fim = texto.length;
  while (
    fim > 0 &&
    larguraDoTexto(`${texto.slice(0, fim)}…`, tamanho, negrito) > largura
  ) {
    fim -= 1;
  }
  return fim === 0 ? "" : `${texto.slice(0, fim).trimEnd()}…`;
}

function numero(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function corPdf(c: Cor): string {
  return c.map((x) => numero(x / 255)).join(" ");
}

function literal(texto: string): string {
  return bytesWinAnsi(texto)
    .map((b) => {
      if (b === 0x28 || b === 0x29 || b === 0x5c)
        return `\\${String.fromCharCode(b)}`;
      if (b < 32 || b > 126) return `\\${b.toString(8).padStart(3, "0")}`;
      return String.fromCharCode(b);
    })
    .join("");
}

export class PaginaPdf {
  readonly operacoes: string[] = [];

  constructor(
    readonly largura: number,
    readonly altura: number,
  ) {}

  /** Texto com a linha de base em `y` (a partir do topo). */
  texto(x: number, y: number, texto: string, estilo: EstiloDoTexto = {}): void {
    const tamanho = estilo.tamanho ?? 10;
    const fonte = estilo.negrito ? "F2" : "F1";
    this.operacoes.push(
      `BT /${fonte} ${numero(tamanho)} Tf ${corPdf(estilo.cor ?? [0, 0, 0])} rg ${numero(x)} ${numero(this.altura - y)} Td (${literal(texto)}) Tj ET`,
    );
  }

  /** Texto alinhado à direita de `x`. */
  textoADireita(
    x: number,
    y: number,
    texto: string,
    estilo: EstiloDoTexto = {},
  ): void {
    this.texto(
      x - larguraDoTexto(texto, estilo.tamanho ?? 10, estilo.negrito),
      y,
      texto,
      estilo,
    );
  }

  retangulo(
    x: number,
    y: number,
    largura: number,
    altura: number,
    estilo: {
      readonly preenchimento?: Cor;
      readonly contorno?: Cor;
      readonly espessura?: number;
    },
  ): void {
    const base = `${numero(x)} ${numero(this.altura - y - altura)} ${numero(largura)} ${numero(altura)} re`;
    const partes: string[] = [];
    if (estilo.preenchimento) partes.push(`${corPdf(estilo.preenchimento)} rg`);
    if (estilo.contorno) {
      partes.push(
        `${corPdf(estilo.contorno)} RG ${numero(estilo.espessura ?? 0.5)} w`,
      );
    }
    const pintura =
      estilo.preenchimento && estilo.contorno
        ? "B"
        : estilo.preenchimento
          ? "f"
          : "S";
    this.operacoes.push(`${partes.join(" ")} ${base} ${pintura}`);
  }

  linha(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cor: Cor,
    espessura = 0.5,
  ): void {
    this.operacoes.push(
      `${corPdf(cor)} RG ${numero(espessura)} w ${numero(x1)} ${numero(this.altura - y1)} m ${numero(x2)} ${numero(this.altura - y2)} l S`,
    );
  }

  /** Um círculo cheio (marcador de cor). */
  ponto(x: number, y: number, raio: number, cor: Cor): void {
    const k = raio * 0.5523;
    const cy = this.altura - y;
    this.operacoes.push(
      `${corPdf(cor)} rg ${numero(x + raio)} ${numero(cy)} m ` +
        `${numero(x + raio)} ${numero(cy + k)} ${numero(x + k)} ${numero(cy + raio)} ${numero(x)} ${numero(cy + raio)} c ` +
        `${numero(x - k)} ${numero(cy + raio)} ${numero(x - raio)} ${numero(cy + k)} ${numero(x - raio)} ${numero(cy)} c ` +
        `${numero(x - raio)} ${numero(cy - k)} ${numero(x - k)} ${numero(cy - raio)} ${numero(x)} ${numero(cy - raio)} c ` +
        `${numero(x + k)} ${numero(cy - raio)} ${numero(x + raio)} ${numero(cy - k)} ${numero(x + raio)} ${numero(cy)} c f`,
    );
  }
}

export class DocumentoPdf {
  readonly paginas: PaginaPdf[] = [];

  constructor(readonly titulo = "") {}

  novaPagina(paisagem = false): PaginaPdf {
    const p = paisagem
      ? new PaginaPdf(A4.altura, A4.largura)
      : new PaginaPdf(A4.largura, A4.altura);
    this.paginas.push(p);
    return p;
  }

  /** O arquivo PDF (1.4), só com caracteres ASCII. */
  bytes(): Uint8Array {
    const objetos: string[] = [];
    const adicionar = (conteudo: string): number => {
      objetos.push(conteudo);
      return objetos.length;
    };
    const catalogo = adicionar("");
    const raizDasPaginas = adicionar("");
    const f1 = adicionar(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    );
    const f2 = adicionar(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    );
    const filhas: number[] = [];
    for (const p of this.paginas) {
      const fluxo = p.operacoes.join("\n");
      const conteudo = adicionar(
        `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`,
      );
      filhas.push(
        adicionar(
          `<< /Type /Page /Parent ${raizDasPaginas} 0 R /MediaBox [0 0 ${numero(p.largura)} ${numero(p.altura)}] ` +
            `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${conteudo} 0 R >>`,
        ),
      );
    }
    objetos[catalogo - 1] = `<< /Type /Catalog /Pages ${raizDasPaginas} 0 R >>`;
    objetos[raizDasPaginas - 1] =
      `<< /Type /Pages /Kids [${filhas.map((n) => `${n} 0 R`).join(" ")}] /Count ${filhas.length} >>`;
    const info = adicionar(
      `<< /Title (${literal(this.titulo)}) /Producer (Evolli) >>`,
    );

    let saida = "%PDF-1.4\n";
    const posicoes: number[] = [];
    objetos.forEach((o, i) => {
      posicoes.push(saida.length);
      saida += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = saida.length;
    saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    saida += posicoes
      .map((p) => `${String(p).padStart(10, "0")} 00000 n \n`)
      .join("");
    saida += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(saida);
  }
}
