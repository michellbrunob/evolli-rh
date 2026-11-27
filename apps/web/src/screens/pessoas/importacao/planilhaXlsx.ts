/**
 * T212 — planilha `.xlsx` da importação de colaboradores, só no navegador.
 *
 * - **Modelo:** gerado aqui, a partir da MESMA definição de colunas do
 *   importador (`COLUNAS_DO_MODELO`), com as abas Colaboradores, Exemplos e
 *   Instruções. Nenhum binário versionado.
 * - **Leitura:** só a aba Colaboradores, com o cabeçalho exato do modelo; as
 *   linhas viram a mesma estrutura do CSV (`PlanilhaLida`) e seguem para a
 *   conferência de sempre (`conferirPlanilha`).
 *
 * Sem dependência nova (decisão X1 do dossiê da T212): um `.xlsx` é um ZIP
 * de XML. Para gerar, o ZIP é montado aqui, sem compressão, com CRC32 — o
 * Excel, o Google Planilhas e o LibreOffice abrem. Para ler, as entradas
 * comprimidas passam pela API nativa `DecompressionStream("deflate-raw")`, e o
 * XML, pelo `DOMParser`. O arquivo nunca sai da aba.
 */
import {
  COLUNAS_DO_MODELO,
  LIMITE_DE_LINHAS,
  LINHA_DE_EXEMPLO,
  NOME_DA_LINHA_DE_EXEMPLO,
  TIPOS_ACEITOS,
  type Coluna,
  type LinhaLida,
  type PlanilhaLida,
} from "./planilhaColaboradores";

export const ABA_COLABORADORES = "Colaboradores";
export const ABA_EXEMPLOS = "Exemplos";
export const ABA_INSTRUCOES = "Instruções";
export const NOME_DO_MODELO_XLSX = "modelo-importacao-colaboradores.xlsx";
export const TIPO_MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Uma célula: texto, número ou fórmula (esta só para testes de recusa). */
export type CelulaXlsx =
  | string
  | number
  | { readonly formula: string; readonly valor?: string | number };

export interface AbaXlsx {
  readonly nome: string;
  readonly linhas: ReadonlyArray<ReadonlyArray<CelulaXlsx>>;
  /** Largura de cada coluna (caracteres). */
  readonly larguras?: readonly number[];
  /** Colunas de texto: o que se digita fica como texto (datas inclusive). */
  readonly colunasTexto?: boolean;
  /** Primeira linha em destaque e congelada. */
  readonly cabecalho?: boolean;
  /** Lista dos tipos aceitos na coluna B (linhas 2 a 201). */
  readonly listaDeTipos?: boolean;
  /** Texto quebrado na largura da coluna (Instruções). */
  readonly quebrarTexto?: boolean;
}

export interface OpcoesDoXlsx {
  /** Sistema de datas de 1904 (planilhas antigas do Mac). */
  readonly datas1904?: boolean;
  /** Textos em `sharedStrings.xml`, como o Excel grava. */
  readonly textosCompartilhados?: boolean;
  /** Entradas a mais no ZIP (testes de recusa). */
  readonly arquivosExtras?: Readonly<Record<string, string | Uint8Array>>;
}

// =================================================================== ZIP

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(dados: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < dados.length; i += 1) {
    crc = TABELA_CRC[(crc ^ dados[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const UTF8 = new TextEncoder();

/** ZIP sem compressão (método 0), nomes em UTF-8. */
export function montarZip(
  arquivos: ReadonlyArray<readonly [string, Uint8Array]>,
): Uint8Array {
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let deslocamento = 0;
  for (const [nome, dados] of arquivos) {
    const nomeBytes = UTF8.encode(nome);
    const crc = crc32(dados);
    const local = new Uint8Array(30 + nomeBytes.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true); // nome em UTF-8
    l.setUint16(8, 0, true); // sem compressão
    l.setUint16(10, 0, true);
    l.setUint16(12, 0x21, true); // 01/01/1980
    l.setUint32(14, crc, true);
    l.setUint32(18, dados.length, true);
    l.setUint32(22, dados.length, true);
    l.setUint16(26, nomeBytes.length, true);
    l.setUint16(28, 0, true);
    local.set(nomeBytes, 30);

    const central = new Uint8Array(46 + nomeBytes.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, 0, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, dados.length, true);
    c.setUint32(24, dados.length, true);
    c.setUint16(28, nomeBytes.length, true);
    c.setUint32(42, deslocamento, true);
    central.set(nomeBytes, 46);

    locais.push(local, dados);
    centrais.push(central);
    deslocamento += local.length + dados.length;
  }
  const tamanhoCentral = centrais.reduce((t, c) => t + c.length, 0);
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, arquivos.length, true);
  f.setUint16(10, arquivos.length, true);
  f.setUint32(12, tamanhoCentral, true);
  f.setUint32(16, deslocamento, true);
  return juntar([...locais, ...centrais, fim]);
}

function juntar(partes: readonly Uint8Array[]): Uint8Array {
  const total = partes.reduce((t, p) => t + p.length, 0);
  const saida = new Uint8Array(total);
  let i = 0;
  for (const parte of partes) {
    saida.set(parte, i);
    i += parte.length;
  }
  return saida;
}

/** Erro que recusa o arquivo inteiro, com a mensagem para a pessoa. */
class ArquivoRecusado extends Error {}

const MENSAGEM_INVALIDO =
  "O arquivo não é uma planilha .xlsx válida (ou está corrompido). Baixe o modelo do Evolli e tente de novo.";
const MENSAGEM_SENHA =
  "O arquivo está protegido por senha ou é uma planilha antiga (.xls). Salve sem senha, no formato .xlsx, e tente de novo.";
const MENSAGEM_MACRO =
  "O arquivo tem macros e não é aceito. Salve como pasta de trabalho .xlsx, sem macros.";

/** Teto do conteúdo descompactado: protege a aba contra arquivo-bomba. */
const LIMITE_DESCOMPACTADO = 20 * 1024 * 1024;
const LIMITE_DE_ENTRADAS = 500;

interface EntradaDoZip {
  readonly nome: string;
  readonly metodo: number;
  readonly cifrada: boolean;
  readonly tamanho: number;
  readonly inicioDosDados: number;
  readonly tamanhoComprimido: number;
}

function lerDiretorio(bytes: Uint8Array): Map<string, EntradaDoZip> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fim = -1;
  for (
    let i = bytes.length - 22;
    i >= Math.max(0, bytes.length - 65557);
    i -= 1
  ) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new ArquivoRecusado(MENSAGEM_INVALIDO);
  const quantidade = v.getUint16(fim + 10, true);
  const inicioCentral = v.getUint32(fim + 16, true);
  if (quantidade > LIMITE_DE_ENTRADAS || inicioCentral >= bytes.length) {
    throw new ArquivoRecusado(MENSAGEM_INVALIDO);
  }
  const entradas = new Map<string, EntradaDoZip>();
  const decodificador = new TextDecoder();
  let p = inicioCentral;
  for (let n = 0; n < quantidade; n += 1) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) {
      throw new ArquivoRecusado(MENSAGEM_INVALIDO);
    }
    const flags = v.getUint16(p + 8, true);
    const metodo = v.getUint16(p + 10, true);
    const tamanhoComprimido = v.getUint32(p + 20, true);
    const tamanho = v.getUint32(p + 24, true);
    const tamNome = v.getUint16(p + 28, true);
    const tamExtra = v.getUint16(p + 30, true);
    const tamComentario = v.getUint16(p + 32, true);
    const inicioLocal = v.getUint32(p + 42, true);
    const nome = decodificador.decode(bytes.subarray(p + 46, p + 46 + tamNome));
    if (
      inicioLocal + 30 > bytes.length ||
      v.getUint32(inicioLocal, true) !== 0x04034b50
    ) {
      throw new ArquivoRecusado(MENSAGEM_INVALIDO);
    }
    const inicioDosDados =
      inicioLocal +
      30 +
      v.getUint16(inicioLocal + 26, true) +
      v.getUint16(inicioLocal + 28, true);
    if (inicioDosDados + tamanhoComprimido > bytes.length) {
      throw new ArquivoRecusado(MENSAGEM_INVALIDO);
    }
    entradas.set(nome, {
      nome,
      metodo,
      cifrada: (flags & 1) === 1,
      tamanho,
      inicioDosDados,
      tamanhoComprimido,
    });
    p += 46 + tamNome + tamExtra + tamComentario;
  }
  return entradas;
}

async function inflar(dados: Uint8Array, limite: number): Promise<Uint8Array> {
  const fluxo = new DecompressionStream("deflate-raw");
  const escritor = fluxo.writable.getWriter();
  void escritor.write(dados as unknown as BufferSource).catch(() => undefined);
  void escritor.close().catch(() => undefined);
  const leitor = fluxo.readable.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > limite) {
      await leitor.cancel().catch(() => undefined);
      throw new ArquivoRecusado(MENSAGEM_INVALIDO);
    }
    partes.push(value);
  }
  return juntar(partes);
}

interface PastaAberta {
  readonly entradas: Map<string, EntradaDoZip>;
  readonly texto: (nome: string) => Promise<string | null>;
}

function abrirPasta(bytes: Uint8Array): PastaAberta {
  // Contêiner OLE (D0 CF 11 E0): é o que o Excel grava quando a pasta tem
  // senha — e também o .xls antigo.
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    throw new ArquivoRecusado(MENSAGEM_SENHA);
  }
  if (
    bytes.length < 22 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    throw new ArquivoRecusado(MENSAGEM_INVALIDO);
  }
  const entradas = lerDiretorio(bytes);
  let consumido = 0;
  const decodificador = new TextDecoder("utf-8", { fatal: false });
  return {
    entradas,
    async texto(nome) {
      const entrada = entradas.get(nome);
      if (!entrada) return null;
      if (entrada.cifrada) throw new ArquivoRecusado(MENSAGEM_SENHA);
      const bruto = bytes.subarray(
        entrada.inicioDosDados,
        entrada.inicioDosDados + entrada.tamanhoComprimido,
      );
      const restante = LIMITE_DESCOMPACTADO - consumido;
      let dados: Uint8Array;
      if (entrada.metodo === 0) dados = bruto;
      else if (entrada.metodo === 8) {
        try {
          dados = await inflar(bruto, restante);
        } catch (erro) {
          if (erro instanceof ArquivoRecusado) throw erro;
          throw new ArquivoRecusado(MENSAGEM_INVALIDO);
        }
      } else throw new ArquivoRecusado(MENSAGEM_INVALIDO);
      consumido += dados.length;
      if (consumido > LIMITE_DESCOMPACTADO) {
        throw new ArquivoRecusado(MENSAGEM_INVALIDO);
      }
      return decodificador.decode(dados);
    },
  };
}

// =================================================================== XML

function escapar(texto: string): string {
  return (
    texto
      // Caracteres que o XML 1.0 não aceita.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  );
}

const CABECALHO_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL =
  "http://schemas.openxmlformats.org/package/2006/relationships";

/** Coluna (0, 1, …) → letras (A, B, …). */
function letras(indice: number): string {
  let n = indice + 1;
  let saida = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    saida = String.fromCharCode(65 + r) + saida;
    n = Math.floor((n - 1) / 26);
  }
  return saida;
}

/** Letras → coluna (A → 0). */
function indiceDaColuna(referencia: string): number {
  const letrasDaRef = /^[A-Z]+/.exec(referencia)?.[0] ?? "A";
  let n = 0;
  for (const c of letrasDaRef) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// Estilos: 0 normal; 1 texto (@); 2 cabeçalho (negrito, fundo, texto);
// 3 texto quebrado (Instruções); 4 título das instruções (negrito).
const ESTILOS =
  CABECALHO_XML +
  `<styleSheet xmlns="${NS_MAIN}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F0FB"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

function folhaXml(
  aba: AbaXlsx,
  primeira: boolean,
  indiceDeTexto: (texto: string) => number | null,
): string {
  const estiloPadrao = aba.colunasTexto ? 1 : aba.quebrarTexto ? 3 : 0;
  const larguras = aba.larguras ?? [];
  const cols =
    larguras.length > 0
      ? "<cols>" +
        larguras
          .map(
            (largura, i) =>
              `<col min="${i + 1}" max="${i + 1}" width="${largura}" customWidth="1"${estiloPadrao ? ` style="${estiloPadrao}"` : ""}/>`,
          )
          .join("") +
        "</cols>"
      : "";
  const visao =
    `<sheetViews><sheetView workbookViewId="0"${primeira ? ' tabSelected="1"' : ""}>` +
    (aba.cabecalho
      ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
      : "") +
    "</sheetView></sheetViews>";
  const linhas = aba.linhas
    .map((linha, i) => {
      const numero = i + 1;
      const destaque =
        aba.cabecalho && i === 0
          ? 2
          : aba.quebrarTexto && i === 0
            ? 4
            : estiloPadrao;
      const celulas = linha
        .map((celula, j) => {
          const ref = `${letras(j)}${numero}`;
          const s = destaque ? ` s="${destaque}"` : "";
          if (typeof celula === "number") {
            return `<c r="${ref}"${s}><v>${celula}</v></c>`;
          }
          if (typeof celula === "object") {
            const valor = celula.valor ?? "";
            return `<c r="${ref}"${s}${typeof valor === "string" ? ' t="str"' : ""}><f>${escapar(celula.formula)}</f><v>${escapar(String(valor))}</v></c>`;
          }
          if (celula === "") return "";
          const compartilhado = indiceDeTexto(celula);
          return compartilhado === null
            ? `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(celula)}</t></is></c>`
            : `<c r="${ref}"${s} t="s"><v>${compartilhado}</v></c>`;
        })
        .join("");
      return `<row r="${numero}">${celulas}</row>`;
    })
    .join("");
  const validacao = aba.listaDeTipos
    ? `<dataValidations count="1"><dataValidation type="list" errorStyle="warning" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Tipo de vínculo" error="Use um dos tipos da lista." promptTitle="Tipo de vínculo" prompt="Escolha um dos tipos aceitos." sqref="B2:B${LIMITE_DE_LINHAS + 1}"><formula1>"${TIPOS_ACEITOS.map(([codigo]) => codigo).join(",")}"</formula1></dataValidation></dataValidations>`
    : "";
  return (
    CABECALHO_XML +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    visao +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    cols +
    `<sheetData>${linhas}</sheetData>` +
    validacao +
    "</worksheet>"
  );
}

/** Monta um `.xlsx` com as abas dadas (o modelo e os testes usam isto). */
export function montarXlsx(
  abas: readonly AbaXlsx[],
  opcoes: OpcoesDoXlsx = {},
): Uint8Array {
  const textos: string[] = [];
  const indiceDeTexto = (texto: string): number | null => {
    if (!opcoes.textosCompartilhados) return null;
    const existente = textos.indexOf(texto);
    if (existente >= 0) return existente;
    textos.push(texto);
    return textos.length - 1;
  };
  const folhas = abas.map((aba, i) => folhaXml(aba, i === 0, indiceDeTexto));
  const usaTextos = textos.length > 0;

  const tipos =
    CABECALHO_XML +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    abas
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    (usaTextos
      ? '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
      : "") +
    "</Types>";
  const relsRaiz =
    CABECALHO_XML +
    `<Relationships xmlns="${NS_PKG_REL}">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";
  const pasta =
    CABECALHO_XML +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    (opcoes.datas1904 ? '<workbookPr date1904="1"/>' : "<workbookPr/>") +
    '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
    abas
      .map(
        (aba, i) =>
          `<sheet name="${escapar(aba.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
      )
      .join("") +
    "</sheets></workbook>";
  const relsPasta =
    CABECALHO_XML +
    `<Relationships xmlns="${NS_PKG_REL}">` +
    abas
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    (usaTextos
      ? `<Relationship Id="rId${abas.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`
      : "") +
    "</Relationships>";
  const compartilhados =
    CABECALHO_XML +
    `<sst xmlns="${NS_MAIN}" count="${textos.length}" uniqueCount="${textos.length}">` +
    textos
      .map((t) => `<si><t xml:space="preserve">${escapar(t)}</t></si>`)
      .join("") +
    "</sst>";

  const arquivos: Array<[string, Uint8Array]> = [
    ["[Content_Types].xml", UTF8.encode(tipos)],
    ["_rels/.rels", UTF8.encode(relsRaiz)],
    ["xl/workbook.xml", UTF8.encode(pasta)],
    ["xl/_rels/workbook.xml.rels", UTF8.encode(relsPasta)],
    ["xl/styles.xml", UTF8.encode(ESTILOS)],
    ...folhas.map(
      (xml, i) =>
        [`xl/worksheets/sheet${i + 1}.xml`, UTF8.encode(xml)] as [
          string,
          Uint8Array,
        ],
    ),
    ...(usaTextos
      ? [
          ["xl/sharedStrings.xml", UTF8.encode(compartilhados)] as [
            string,
            Uint8Array,
          ],
        ]
      : []),
    ...Object.entries(opcoes.arquivosExtras ?? {}).map(
      ([nome, conteudo]) =>
        [
          nome,
          typeof conteudo === "string" ? UTF8.encode(conteudo) : conteudo,
        ] as [string, Uint8Array],
    ),
  ];
  return montarZip(arquivos);
}

// =================================================================== modelo

const LARGURAS_DO_MODELO = [36, 18, 16, 18, 26, 22, 14, 14, 18];

/** Exemplos fictícios, nos mesmos 9 campos (não são importados). */
const EXEMPLOS: ReadonlyArray<readonly string[]> = [
  [
    "Ana Fictícia Souza",
    "clt",
    "01/12/2026",
    "15/05/1990",
    "ADMINISTRATIVO",
    "ANALISTA-RH",
    "3.500,00",
    "MAT-001",
    "SEDE",
  ],
  [
    "Bruno Fictício Lima",
    "estagio",
    "05/01/2027",
    "20/08/2004",
    "OPERACOES",
    "ESTAGIARIO",
    "1.200,00",
    "",
    "",
  ],
  [
    "Carla Fictícia Rocha",
    "pj",
    "2027-02-01",
    "1985-11-30",
    "TECNOLOGIA",
    "DESENVOLVEDOR",
    "8.000,00",
    "PJ-010",
    "FILIAL-SUL",
  ],
  [
    "Diego Fictício Alves",
    "aprendiz",
    "01/03/2027",
    "10/02/2008",
    "LOGISTICA",
    "APRENDIZ-ADM",
    "1.000,00",
    "",
    "",
  ],
];

const TIPOS_POR_EXTENSO = TIPOS_ACEITOS.map(
  ([codigo, rotulo]) => `${codigo} (${rotulo})`,
).join(", ");

const INSTRUCOES: readonly string[] = [
  "Como preencher a planilha de colaboradores do Evolli",
  "",
  "Passo a passo",
  "1. Na aba Colaboradores, preencha uma pessoa por linha, a partir da linha 2.",
  `2. Apague a linha de exemplo ("${NOME_DA_LINHA_DE_EXEMPLO}") antes de enviar. Se ela for enviada, o Evolli a recusa.`,
  "3. Não altere o cabeçalho (linha 1) nem acrescente colunas. A aba Exemplos é só para consulta e não é importada.",
  "4. Salve como .xlsx e escolha o arquivo em Pessoas › Colaboradores › Adicionar colaborador › Importar planilha.",
  "",
  "Dados obrigatórios: nome, tipo_vinculo, data_admissao, data_nascimento, departamento_codigo, cargo_codigo e salario. Opcionais: matricula e unidade_codigo.",
  "Salário: o salário bruto mensal da admissão, em reais (por exemplo, 1.621,00). Ele abre a linha do tempo salarial da pessoa; ninguém é admitido sem ele.",
  "Códigos ativos: departamento_codigo, cargo_codigo e unidade_codigo usam os códigos ativos da empresa selecionada no Evolli (Pessoas › Colaboradores › Organograma). Código inativo ou inexistente recusa a linha; a planilha não cria nada novo.",
  `Tipos de vínculo aceitos: ${TIPOS_POR_EXTENSO}.`,
  "Datas: DD/MM/AAAA (por exemplo, 01/12/2026) ou AAAA-MM-DD. A data de nascimento não pode estar no futuro, e nenhuma data pode ser anterior a 01/01/1900.",
  "Matrícula: de 2 a 32 letras, números, hífen ou sublinhado (o Evolli usa maiúsculas); não pode se repetir no arquivo.",
  `Limites: até ${LIMITE_DE_LINHAS} linhas de dados e 1 MB por arquivo. Para mais pessoas, divida em arquivos.`,
  "Sem fórmulas: cole só os valores. Arquivos com senha ou com macros são recusados.",
  "",
  "No Excel: abra o modelo, preencha a aba Colaboradores e salve normalmente, mantendo o formato .xlsx.",
  "No Google Planilhas: Arquivo › Importar › Fazer upload do modelo; depois de preencher, Arquivo › Fazer download › Microsoft Excel (.xlsx).",
  "CSV: o Evolli continua aceitando .csv em UTF-8, com o mesmo cabeçalho, separado por ponto e vírgula ou vírgula.",
  "Privacidade: a planilha é lida só no seu navegador; o arquivo não é enviado nem guardado. Cada linha válida vira uma admissão, enviada uma a uma.",
];

/** O modelo `.xlsx` do Evolli, gerado agora, no navegador. */
export function gerarModeloXlsx(): Uint8Array {
  return montarXlsx([
    {
      nome: ABA_COLABORADORES,
      linhas: [COLUNAS_DO_MODELO, LINHA_DE_EXEMPLO],
      larguras: LARGURAS_DO_MODELO,
      colunasTexto: true,
      cabecalho: true,
      listaDeTipos: true,
    },
    {
      nome: ABA_EXEMPLOS,
      linhas: [COLUNAS_DO_MODELO, ...EXEMPLOS],
      larguras: LARGURAS_DO_MODELO,
      colunasTexto: true,
      cabecalho: true,
    },
    {
      nome: ABA_INSTRUCOES,
      linhas: INSTRUCOES.map((linha) => [linha]),
      larguras: [110],
      quebrarTexto: true,
    },
  ]);
}

// =================================================================== leitura

function parse(xml: string): Document {
  const documento = new DOMParser().parseFromString(xml, "application/xml");
  if (documento.getElementsByTagName("parsererror").length > 0) {
    throw new ArquivoRecusado(MENSAGEM_INVALIDO);
  }
  return documento;
}

function filhos(no: Element | Document, nome: string): Element[] {
  return Array.from(no.getElementsByTagNameNS("*", nome));
}

/** O texto de um `<si>` ou `<is>` (com ou sem trechos formatados). */
function textoRico(no: Element): string {
  return filhos(no, "t")
    .map((t) => t.textContent ?? "")
    .join("");
}

interface CelulaLida {
  readonly coluna: number;
  readonly texto: string;
  readonly numerica: boolean;
  readonly formula: boolean;
}

interface LinhaDaFolha {
  readonly numero: number;
  readonly celulas: readonly CelulaLida[];
}

interface FolhaLida {
  readonly datas1904: boolean;
  readonly linhas: readonly LinhaDaFolha[];
}

/** As abas da pasta, na ordem, e o leitor de cada uma. */
async function abrirAbas(bytes: Uint8Array): Promise<{
  readonly nomes: readonly string[];
  readonly folha: (nome: string) => Promise<FolhaLida | null>;
  readonly arquivos: PastaAberta;
}> {
  const pasta = abrirPasta(bytes);
  const nomes = [...pasta.entradas.keys()];
  const tiposXml = (await pasta.texto("[Content_Types].xml")) ?? "";
  if (
    nomes.some((nome) => /vbaProject\.bin$/i.test(nome)) ||
    /macroEnabled/i.test(tiposXml)
  ) {
    throw new ArquivoRecusado(MENSAGEM_MACRO);
  }
  const pastaXml = await pasta.texto("xl/workbook.xml");
  const relsXml = await pasta.texto("xl/_rels/workbook.xml.rels");
  if (pastaXml === null || relsXml === null) {
    throw new ArquivoRecusado(MENSAGEM_INVALIDO);
  }
  const doc = parse(pastaXml);
  const propriedades = filhos(doc, "workbookPr")[0];
  const marca1904 = propriedades?.getAttribute("date1904");
  const datas1904 = marca1904 === "1" || marca1904 === "true";
  const alvos = new Map(
    filhos(parse(relsXml), "Relationship").map((r) => [
      r.getAttribute("Id") ?? "",
      r.getAttribute("Target") ?? "",
    ]),
  );
  const abas = filhos(doc, "sheet").map((folha) => ({
    nome: (folha.getAttribute("name") ?? "").trim(),
    id: folha.getAttributeNS(NS_REL, "id") ?? folha.getAttribute("r:id") ?? "",
  }));

  let compartilhados: string[] | null = null;
  async function textosCompartilhados(): Promise<string[]> {
    if (compartilhados === null) {
      const xml = await pasta.texto("xl/sharedStrings.xml");
      compartilhados =
        xml === null ? [] : filhos(parse(xml), "si").map(textoRico);
    }
    return compartilhados;
  }

  return {
    nomes: abas.map((a) => a.nome),
    arquivos: pasta,
    async folha(nome) {
      const aba = abas.find((a) => a.nome === nome);
      if (!aba) return null;
      const alvo = alvos.get(aba.id) ?? "";
      const caminho = alvo.startsWith("/")
        ? alvo.slice(1)
        : `xl/${alvo.replace(/^\.\//, "")}`;
      const xml = await pasta.texto(caminho);
      if (xml === null) throw new ArquivoRecusado(MENSAGEM_INVALIDO);
      const textos = await textosCompartilhados();
      const linhas = filhos(parse(xml), "row").map((linha, i) => {
        const numero = Number(linha.getAttribute("r")) || i + 1;
        const celulas = filhos(linha, "c").map((c, j): CelulaLida => {
          const ref = c.getAttribute("r");
          const coluna = ref ? indiceDaColuna(ref) : j;
          const tipo = c.getAttribute("t");
          const formula = filhos(c, "f").length > 0;
          const valor = filhos(c, "v")[0]?.textContent ?? "";
          let texto: string;
          if (tipo === "s") texto = textos[Number(valor)] ?? "";
          else if (tipo === "inlineStr") {
            const is = filhos(c, "is")[0];
            texto = is ? textoRico(is) : "";
          } else texto = valor;
          return {
            coluna,
            texto,
            numerica: (tipo === null || tipo === "n") && valor !== "",
            formula,
          };
        });
        return { numero, celulas };
      });
      return { datas1904, linhas };
    },
  };
}

/** Para inspeção (testes e conferência do modelo): cada aba como texto. */
export async function lerAbasXlsx(
  bytes: Uint8Array,
): Promise<Record<string, string[][]>> {
  const pasta = await abrirAbas(bytes);
  const saida: Record<string, string[][]> = {};
  for (const nome of pasta.nomes) {
    const folha = await pasta.folha(nome);
    const linhas: string[][] = [];
    for (const linha of folha?.linhas ?? []) {
      const valores: string[] = [];
      for (const celula of linha.celulas) valores[celula.coluna] = celula.texto;
      linhas[linha.numero - 1] = Array.from(valores, (v) => v ?? "");
    }
    saida[nome] = Array.from(linhas, (l) => l ?? []);
  }
  return saida;
}

/** O XML cru de cada entrada (testes do modelo). */
lerAbasXlsx.cru = async function cru(
  bytes: Uint8Array,
): Promise<{ arquivos: Record<string, string> }> {
  const pasta = abrirPasta(bytes);
  const arquivos: Record<string, string> = {};
  for (const nome of pasta.entradas.keys()) {
    arquivos[nome] = (await pasta.texto(nome)) ?? "";
  }
  return { arquivos };
};

const COLUNAS_DE_DATA = new Set<Coluna>(["data_admissao", "data_nascimento"]);

/** Número de data do Excel → `DD/MM/AAAA`. */
function dataDoExcel(serie: number, datas1904: boolean): string | null {
  if (!Number.isFinite(serie) || serie < 1 || serie > 2958465) return null;
  const base = datas1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const data = new Date(base + Math.floor(serie) * 86400000);
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

/** Número que não é data → texto sem casas decimais desnecessárias. */
function numeroComoTexto(texto: string): string {
  const n = Number(texto);
  if (!Number.isFinite(n)) return texto;
  return Number.isInteger(n) ? String(n) : String(n);
}

/**
 * T215 — salário em célula numérica: o Excel guarda o número binário (às
 * vezes com ruído, como 2045.0000000000002, ou com casas a mais). Na
 * leitura, arredonda a 2 casas, meio para cima, a partir dos 15 algarismos
 * que o Excel mostra; devolve "2045.00". Texto digitado não passa por aqui
 * (casas a mais no texto continuam recusadas na conferência).
 */
function reaisComoTexto(texto: string): string {
  const n = Number(texto);
  if (!Number.isFinite(n) || n < 0 || n >= 1e15) return numeroComoTexto(texto);
  const [inteiro = "0", fracao = ""] = Number(n.toPrecision(15))
    .toFixed(10)
    .split(".");
  let centavos = BigInt(inteiro) * 100n + BigInt(fracao.slice(0, 2) || "0");
  if (Number(fracao[2] ?? "0") >= 5) centavos += 1n;
  return `${centavos / 100n}.${String(centavos % 100n).padStart(2, "0")}`;
}

/** Colunas de valor em reais (célula numérica arredonda a centavos). */
const COLUNAS_DE_REAIS = new Set<Coluna>(["salario"]);

/**
 * Lê a aba Colaboradores para a mesma estrutura do CSV (`PlanilhaLida`), ou
 * devolve o erro que recusa o arquivo inteiro.
 */
export async function lerPlanilhaXlsx(
  bytes: Uint8Array,
): Promise<PlanilhaLida> {
  try {
    const pasta = await abrirAbas(bytes);
    const folha = await pasta.folha(ABA_COLABORADORES);
    if (folha === null) {
      return {
        erro: `A planilha não tem a aba ${ABA_COLABORADORES}. Use o modelo do Evolli, sem renomear as abas.`,
      };
    }
    const colunas = COLUNAS_DO_MODELO;

    for (const linha of folha.linhas) {
      if (linha.celulas.some((c) => c.formula)) {
        return {
          erro: `A planilha tem fórmula na linha ${linha.numero}. Cole só os valores e tente de novo.`,
        };
      }
    }

    const preenchidas = folha.linhas.filter((linha) =>
      linha.celulas.some((c) => c.texto.trim() !== ""),
    );
    const cabecalho = preenchidas[0];
    const valoresDoCabecalho: string[] = [];
    for (const celula of cabecalho?.celulas ?? []) {
      if (celula.texto.trim() !== "") {
        valoresDoCabecalho[celula.coluna] = celula.texto.trim();
      }
    }
    const cabecalhoCerto =
      cabecalho !== undefined &&
      cabecalho.numero === 1 &&
      valoresDoCabecalho.length === colunas.length &&
      colunas.every((coluna, i) => valoresDoCabecalho[i] === coluna);
    if (!cabecalhoCerto) {
      const foraDoModelo = valoresDoCabecalho.some(
        (valor, i) => i >= colunas.length && valor,
      );
      return {
        erro: foraDoModelo
          ? "O cabeçalho da aba Colaboradores tem colunas fora do modelo. Use o modelo do Evolli, sem colunas a mais."
          : `O cabeçalho da aba Colaboradores foi alterado. A linha 1 deve ser exatamente: ${colunas.join(", ")}.`,
      };
    }

    const linhas: LinhaLida[] = [];
    for (const linha of preenchidas.slice(1)) {
      const fora = linha.celulas.some(
        (c) => c.coluna >= colunas.length && c.texto.trim() !== "",
      );
      if (fora) {
        return {
          erro: `A linha ${linha.numero} tem conteúdo fora das ${colunas.length} colunas do modelo. Apague o que estiver depois da coluna ${letras(colunas.length - 1)}.`,
        };
      }
      const valores: Partial<Record<Coluna, string>> = {};
      for (const celula of linha.celulas) {
        const coluna = colunas[celula.coluna];
        if (coluna === undefined) continue;
        let texto = celula.texto;
        if (celula.numerica) {
          texto = COLUNAS_DE_DATA.has(coluna)
            ? (dataDoExcel(Number(texto), folha.datas1904) ?? texto)
            : COLUNAS_DE_REAIS.has(coluna)
              ? reaisComoTexto(texto)
              : numeroComoTexto(texto);
        }
        valores[coluna] = texto;
      }
      for (const coluna of colunas) valores[coluna] ??= "";
      linhas.push({ numero: linha.numero, valores, sobra: false });
    }
    if (linhas.length === 0) {
      return {
        erro: "A planilha não tem nenhuma linha de dados abaixo do cabeçalho.",
      };
    }
    if (linhas.length > LIMITE_DE_LINHAS) {
      return {
        erro: `A planilha tem mais de ${LIMITE_DE_LINHAS} linhas de dados. Divida em arquivos menores.`,
      };
    }
    return { colunas, linhas };
  } catch (erro) {
    if (erro instanceof ArquivoRecusado) return { erro: erro.message };
    return { erro: MENSAGEM_INVALIDO };
  }
}

/** `.xlsx` pelo nome ou pelo conteúdo (assinatura de ZIP). */
export function pareceXlsx(nome: string, primeirosBytes: Uint8Array): boolean {
  if (/\.xlsx$/i.test(nome)) return true;
  return (
    primeirosBytes[0] === 0x50 &&
    primeirosBytes[1] === 0x4b &&
    primeirosBytes[2] === 0x03 &&
    primeirosBytes[3] === 0x04
  );
}
