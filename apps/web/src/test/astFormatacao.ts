/**
 * Detector de formatação de data por AST — infraestrutura de teste (T154).
 *
 * ## Por que AST, e não regex sobre o texto
 *
 * A versão anterior deste detector procurava a palavra-chave `function`
 * seguida de um nome de uma lista de seis prefixos. Uma mutação de revisão
 * provou que isso não guarda quase nada:
 *
 *     export const exibirData = (iso: string): string =>
 *       `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
 *
 * Nem é `function`, nem o nome está na lista, nem usa `split`. Passava em
 * todos os testes estruturais — e é exatamente o defeito que a consolidação
 * existe para impedir: um segundo formatador, com regra própria, que já nasce
 * divergente (`slice` não valida nada; para `2026-13-45` devolve `45/13/2026`).
 *
 * O AST não cai nessa. Ele vê a FORMA do código, não a grafia: arrow,
 * expressão de função, método, declaração e alias são todos nós.
 *
 * ## A fronteira — o que este detector promete, e o que não
 *
 * Ele NÃO é um analisador universal de datas, e não tenta ser. Promete pegar
 * os dois padrões que de fato aparecem neste produto:
 *
 *   1. formatação de data pelo `Intl`/`toLocale*`, em qualquer lugar;
 *   2. uma função que ao mesmo tempo DISSECA uma string (`split`, `slice`,
 *      `substring`, `substr`, `replace("T"…)`) e MONTA um texto separado por
 *      barra (template ou concatenação) — que é a assinatura de
 *      `DD/MM/AAAA` escrito à mão;
 *   3. apelidar um formatador central, escondendo-o de qualquer busca.
 *
 * Quem quiser burlar consegue — basta não fazer nada disso. O objetivo é
 * tornar a reincidência acidental impossível e a deliberada explícita, não
 * provar um teorema.
 */
import ts from "typescript";

export interface Infrator {
  arquivo: string;
  linha: number;
  motivo: string;
  trecho: string;
}

/** Primitivas que dissecam uma string de data. */
const PRIMITIVAS = new Set(["split", "slice", "substring", "substr"]);

/** `Intl`/`toLocale*`: formatação de data pronta, nunca fora do módulo central. */
const FORMATADORES_DA_LINGUAGEM = new Set([
  "toLocaleDateString",
  "toLocaleTimeString",
  "toLocaleString",
]);

/** Nomes exportados pelo módulo central de apresentação. */
const CENTRAIS = new Set([
  "formatarDiaCivil",
  "formatarMesReferencia",
  "formatarInstante",
]);

function linhaDe(no: ts.Node, fonte: ts.SourceFile): number {
  return fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
}

function trechoDe(no: ts.Node, fonte: ts.SourceFile): string {
  return no.getText(fonte).replace(/\s+/g, " ").slice(0, 90);
}

/** O nó monta um texto separado por barra entre dois valores interpolados? */
function montaTextoComBarra(no: ts.Node): boolean {
  let achou = false;

  const visitar = (n: ts.Node): void => {
    if (achou) return;

    // `${a}/${b}` — a barra fica no literal ENTRE as interpolações.
    if (ts.isTemplateExpression(n)) {
      for (const span of n.templateSpans) {
        if (span.literal.text.includes("/")) achou = true;
      }
      // `${a}/${b}` com a barra no head também conta: `/${a}` é raro, mas
      // `${a}/${b}` cobre o caso real.
    }

    // `dia + "/" + mes + "/" + ano`
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const texto = n.getText();
      if (/["'`]\s*\/\s*["'`]/.test(texto)) achou = true;
    }

    ts.forEachChild(n, visitar);
  };

  visitar(no);
  return achou;
}

/** O nó disseca uma string com uma das primitivas? */
function dissecaString(no: ts.Node): boolean {
  let achou = false;

  const visitar = (n: ts.Node): void => {
    if (achou) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const metodo = n.expression.name.text;
      if (PRIMITIVAS.has(metodo)) achou = true;
      if (metodo === "replace") {
        const arg = n.arguments[0];
        if (arg && ts.isStringLiteral(arg) && arg.text === "T") achou = true;
      }
    }
    ts.forEachChild(n, visitar);
  };

  visitar(no);
  return achou;
}

/** Nós que se comportam como função. */
function ehFuncao(
  no: ts.Node,
): no is ts.SignatureDeclaration & { body?: ts.Node } {
  return (
    ts.isFunctionDeclaration(no) ||
    ts.isFunctionExpression(no) ||
    ts.isArrowFunction(no) ||
    ts.isMethodDeclaration(no)
  );
}

/** Nome legível para a função, quando dá para saber. */
function nomeDaFuncao(no: ts.Node, fonte: ts.SourceFile): string {
  if (ts.isFunctionDeclaration(no) && no.name) return no.name.text;
  if (ts.isMethodDeclaration(no) && ts.isIdentifier(no.name))
    return no.name.text;
  const pai = no.parent;
  if (pai && ts.isVariableDeclaration(pai) && ts.isIdentifier(pai.name)) {
    return pai.name.text;
  }
  if (pai && ts.isPropertyAssignment(pai) && ts.isIdentifier(pai.name)) {
    return pai.name.text;
  }
  return `<anônima:${linhaDe(no, fonte)}>`;
}

export interface OpcoesDeVarredura {
  /**
   * Funções tecnicamente justificadas, por `arquivo::nome`. Lista mínima e
   * explícita: cada entrada é uma transformação que NÃO vai para a tela.
   */
  readonly permitidas: ReadonlySet<string>;
}

/**
 * Procura formatação de data escrita à mão num arquivo.
 */
export function acharFormatadorLocal(
  caminhoRelativo: string,
  codigo: string,
  opcoes: OpcoesDeVarredura,
): Infrator[] {
  const fonte = ts.createSourceFile(
    caminhoRelativo,
    codigo,
    ts.ScriptTarget.ES2022,
    true,
    caminhoRelativo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const infratores: Infrator[] = [];

  const visitar = (no: ts.Node): void => {
    // 1. Formatação pronta da linguagem.
    if (ts.isPropertyAccessExpression(no)) {
      if (FORMATADORES_DA_LINGUAGEM.has(no.name.text)) {
        infratores.push({
          arquivo: caminhoRelativo,
          linha: linhaDe(no, fonte),
          motivo: `usa ${no.name.text} fora do módulo central`,
          trecho: trechoDe(no, fonte),
        });
      }
      if (
        no.name.text === "DateTimeFormat" &&
        ts.isIdentifier(no.expression) &&
        no.expression.text === "Intl"
      ) {
        infratores.push({
          arquivo: caminhoRelativo,
          linha: linhaDe(no, fonte),
          motivo: "usa Intl.DateTimeFormat fora do módulo central",
          trecho: trechoDe(no, fonte),
        });
      }
    }

    // 2. Função que disseca string E monta texto com barra.
    if (ehFuncao(no) && no.body) {
      const nome = nomeDaFuncao(no, fonte);
      const chave = `${caminhoRelativo}::${nome}`;
      if (
        !opcoes.permitidas.has(chave) &&
        dissecaString(no.body) &&
        montaTextoComBarra(no.body)
      ) {
        infratores.push({
          arquivo: caminhoRelativo,
          linha: linhaDe(no, fonte),
          motivo: `\`${nome}\` disseca a string e monta texto com barra — é um formatador de data local`,
          trecho: trechoDe(no, fonte),
        });
      }
    }

    // 3. Apelido de um formatador central.
    if (ts.isImportSpecifier(no) && no.propertyName) {
      if (CENTRAIS.has(no.propertyName.text)) {
        infratores.push({
          arquivo: caminhoRelativo,
          linha: linhaDe(no, fonte),
          motivo: `importa \`${no.propertyName.text}\` sob apelido \`${no.name.text}\``,
          trecho: trechoDe(no, fonte),
        });
      }
    }
    if (
      ts.isVariableDeclaration(no) &&
      no.initializer &&
      ts.isIdentifier(no.initializer) &&
      CENTRAIS.has(no.initializer.text)
    ) {
      infratores.push({
        arquivo: caminhoRelativo,
        linha: linhaDe(no, fonte),
        motivo: `apelida \`${no.initializer.text}\``,
        trecho: trechoDe(no, fonte),
      });
    }

    ts.forEachChild(no, visitar);
  };

  visitar(fonte);
  return infratores;
}

/**
 * Conta `CallExpression` REAIS de uma função num arquivo.
 *
 * É o que distingue uso de menção: `import`, comentário e string não são
 * chamadas, e nenhum deles vira `CallExpression` no AST.
 */
export function contarChamadas(
  caminhoRelativo: string,
  codigo: string,
  nome: string,
): number {
  const fonte = ts.createSourceFile(
    caminhoRelativo,
    codigo,
    ts.ScriptTarget.ES2022,
    true,
    caminhoRelativo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let n = 0;
  const visitar = (no: ts.Node): void => {
    if (
      ts.isCallExpression(no) &&
      ts.isIdentifier(no.expression) &&
      no.expression.text === nome
    ) {
      n++;
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return n;
}

/** O arquivo importa este nome do módulo central? */
export function importaDoModuloCentral(
  caminhoRelativo: string,
  codigo: string,
  nome: string,
): boolean {
  const fonte = ts.createSourceFile(
    caminhoRelativo,
    codigo,
    ts.ScriptTarget.ES2022,
    true,
    caminhoRelativo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let achou = false;
  const visitar = (no: ts.Node): void => {
    if (achou) return;
    if (
      ts.isImportDeclaration(no) &&
      ts.isStringLiteral(no.moduleSpecifier) &&
      no.moduleSpecifier.text.includes("format/data")
    ) {
      const bindings = no.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const e of bindings.elements) {
          if ((e.propertyName ?? e.name).text === nome) achou = true;
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achou;
}
