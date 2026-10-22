/**
 * T179 — máscaras de entrada de CEP e telefone brasileiros.
 *
 * Funções PURAS, sem React e sem DOM: recebem o texto e a posição do cursor e
 * devolvem o texto mascarado e a nova posição. O campo controlado
 * (`components/CampoMascarado.tsx`) só liga estas funções aos eventos do
 * navegador; toda a regra fica aqui, testável sem montar tela.
 *
 * ## O que a máscara promete
 *
 * - **Progressiva:** o separador aparece quando o dígito seguinte chega —
 *   nunca um `-` ou `) ` sobrando no fim, que atrapalharia o Backspace.
 * - **Cursor pelos dígitos:** a posição é contada em DÍGITOS, não em
 *   caracteres. Editar no meio do número mantém o cursor logo depois do
 *   dígito digitado, mesmo quando a máscara muda de forma (fixo → celular).
 * - **Separador não trava o apagar:** Backspace sobre `-`, `)` ou espaço apaga
 *   o dígito anterior; Delete, o seguinte (`apagarComSeparador`).
 * - **Colagem tolerante:** telefone colado com `+55`, `55` + DDD + número, ou
 *   já mascarado, vira o número nacional; o `55` do país sai. T179 — sem `+`,
 *   só quando o colado é a entrada INTEIRA (campo vazio ou valor todo trocado).
 * - **País por teclado só com `+`** (T179, B1 e B2): `+`, `+5` e `+55` ficam no
 *   campo até o primeiro dígito nacional; colar depois deles junta tudo numa
 *   entrada só. Número nacional completo (inclusive de DDD 55) RECUSA dígito a
 *   mais, com aviso, em vez de virar outro número.
 * - **Excedente nunca entra** (T179, revisão final): qualquer inserção — tecla,
 *   colagem, arrastar, sugestão do teclado, ditado — que CONSERVA dígitos do
 *   valor anterior e passa do limite é recusada inteira: valor e cursor ficam
 *   como estavam, com o motivo (`recusado`) para o campo avisar. Só uma
 *   entrada INTEIRA (campo vazio, ou todo o valor trocado) pode trazer o `55`
 *   do país sem `+`.
 *
 * ## O que ela não faz
 *
 * Não valida: um número com a forma certa ainda pode ter DDD inexistente. Quem
 * diz se o valor serve é a validação do formulário (`contatosColaborador.ts`,
 * `dadosPessoais.ts`) e, por fim, o servidor. Também não presume país para o
 * CEP: a tela só usa a máscara de CEP quando o país é o Brasil.
 */

export type TipoMascara = "cep" | "telefone";

/**
 * T179 — por que a máscara RECUSOU a entrada; cada motivo tem o seu aviso
 * (`avisoDaRecusa`):
 *  - `excedente` — a inserção conserva dígitos do valor e passaria do limite;
 *  - `formato` — a entrada não é um telefone brasileiro (inteira longa demais
 *    sem ser `55` + DDD + número, zero de tronco, texto com ramal, `+`
 *    inserido num número nacional).
 */
export type MotivoDaRecusa = "excedente" | "formato";

/** Estado de um campo de texto: o valor e a posição do cursor (colapsado). */
export interface EstadoDoCampo {
  readonly valor: string;
  readonly cursor: number;
  /**
   * T179 (B2) — a entrada foi RECUSADA: o valor e o cursor são os de antes da
   * mudança. O campo avisa pelo motivo (`avisoDaRecusa`), em vez de calar.
   */
  readonly recusado?: MotivoDaRecusa;
}

/** Quantos dígitos cada máscara comporta: CEP 8; telefone DDD + 9. */
export const LIMITE_DE_DIGITOS: Readonly<Record<TipoMascara, number>> = {
  cep: 8,
  telefone: 11,
};

/** Dica de formato, para ligar ao campo por `aria-describedby`. */
export const DICA_DE_FORMATO: Readonly<Record<TipoMascara, string>> = {
  cep: "Formato 00000-000. Digite só os números: o hífen entra sozinho.",
  telefone:
    "Número brasileiro com DDD, no formato (00) 00000-0000 para celular ou (00) 0000-0000 para fixo. Digite só os números; pode colar com +55.",
};

/**
 * T179 — os avisos da recusa. Cada um só diz o que é verdade no momento em
 * que aparece: o de excedente não afirma que o número já estava completo
 * (um fixo tem 10 dígitos; um número pela metade pode receber colagem longa
 * demais), só que o resultado passaria do limite.
 */
export const AVISO_DE_RECUSA = {
  cep: "O CEP tem 8 dígitos: o que foi digitado ou colado não coube. Apague antes ou selecione o CEP inteiro para trocar.",
  telefoneExcedente:
    "O número não pode passar de 11 dígitos: o que foi digitado ou colado não entrou. Para trocar o número, apague antes ou selecione o número inteiro.",
  telefoneFormato:
    "Use um telefone brasileiro: DDD e número, como (00) 00000-0000 ou (00) 0000-0000; pode começar com +55.",
} as const;

/** T179 — o aviso de uma recusa, pelo tipo do campo e pelo motivo. */
export function avisoDaRecusa(
  tipo: TipoMascara,
  motivo: MotivoDaRecusa,
): string {
  if (tipo === "cep") return AVISO_DE_RECUSA.cep;
  return motivo === "excedente"
    ? AVISO_DE_RECUSA.telefoneExcedente
    : AVISO_DE_RECUSA.telefoneFormato;
}

const DIGITO = /[0-9]/;

/** Limite da numeração internacional (E.164): `+` de outro país fica até aqui. */
const LIMITE_INTERNACIONAL = 15;

export function somenteDigitos(valor: string): string {
  return valor.replace(/[^0-9]/g, "");
}

/** CEP progressivo: `00000`, depois `00000-0`, até `00000-000`. */
export function mascararCep(digitos: string): string {
  const d = somenteDigitos(digitos).slice(0, LIMITE_DE_DIGITOS.cep);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Telefone nacional progressivo: `(1`, `(11`, `(11) 3`, `(11) 3000-0`,
 * `(11) 3000-0000` e, com o 11º dígito, `(11) 98765-4321`.
 */
export function mascararTelefone(digitos: string): string {
  const d = somenteDigitos(digitos).slice(0, LIMITE_DE_DIGITOS.telefone);
  if (d.length === 0) return "";
  const ddd = d.slice(0, 2);
  const numero = d.slice(2);
  if (numero.length === 0) return `(${ddd}`;
  // Até 10 dígitos o hífen fica depois do 4º do número (fixo); com 11, do 5º.
  const corte = d.length === 11 ? 5 : 4;
  if (numero.length <= corte) return `(${ddd}) ${numero}`;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

function mascarar(tipo: TipoMascara, digitos: string): string {
  return tipo === "cep" ? mascararCep(digitos) : mascararTelefone(digitos);
}

/**
 * Dígitos NACIONAIS de um telefone digitado, colado ou gravado: tira o `55`
 * do país quando ele está explícito (`+55…`) ou quando o número tem 12 ou 13
 * dígitos começando por `55` (o `55` + DDD + número). Com 10 ou 11 dígitos o
 * `55` inicial é DDD, e fica. O resultado não passa de 11 dígitos.
 */
export function digitosNacionaisDoTelefone(entrada: string): string {
  const digitos = somenteDigitos(entrada);
  return (temCodigoDoPais(entrada) ? digitos.slice(2) : digitos).slice(
    0,
    LIMITE_DE_DIGITOS.telefone,
  );
}

/** O texto traz o `55` do Brasil na frente (ver `digitosNacionaisDoTelefone`)? */
function temCodigoDoPais(entrada: string): boolean {
  const digitos = somenteDigitos(entrada);
  return (
    (/^\s*\+/.test(entrada) && digitos.startsWith("55")) ||
    ((digitos.length === 12 || digitos.length === 13) &&
      digitos.startsWith("55"))
  );
}

/**
 * T179 (B1 da revisão) — código do país ainda sendo DIGITADO: `+`, `+5` ou
 * `+55`, sem nenhum dígito nacional depois. O campo mostra o que foi digitado,
 * em vez de jogar fora o `+` e fazer do `55` o DDD na tecla seguinte.
 */
const PAIS_EM_DIGITACAO = /^\s*\+\s*(?:5\s*){0,2}$/;

/** O texto começa com `+` (o usuário está informando o código do país)? */
function comecaComMais(entrada: string): boolean {
  return /^\s*\+/.test(entrada);
}

/** Posição logo depois do `n`-ésimo dígito do texto (0 = início). */
export function posicaoAposDigitos(valor: string, n: number): number {
  if (n <= 0) return 0;
  let contados = 0;
  for (let i = 0; i < valor.length; i++) {
    if (DIGITO.test(valor[i]!)) {
      contados++;
      if (contados === n) return i + 1;
    }
  }
  return valor.length;
}

function digitosAntesDe(valor: string, posicao: number): number {
  return somenteDigitos(valor.slice(0, Math.max(0, posicao))).length;
}

/**
 * T179 (B2 da revisão) — leitura de um telefone: o que o campo terá depois da
 * mudança, seja ela uma tecla, uma colagem ou um preenchimento.
 *
 * - `+`, `+5` ou `+55` sozinhos: o código do país ainda sendo digitado.
 * - `+` de outro país: estrangeiro, mostrado como veio — nada de DDD
 *   inventado; a validação o recusa (só número brasileiro).
 * - `+55` + dígitos: o `55` é o país; o resto, o número nacional.
 * - sem `+`: dígitos nacionais. Com 12 ou 13 dígitos começando por `55`, o
 *   texto só pode ser `55` + DDD + número — mas SÓ quando `inteira`: uma
 *   entrada que não conserva nenhum dígito do valor anterior (colagem ou
 *   preenchimento num campo vazio, ou trocando o valor todo). Inserção num
 *   número existente nunca chega a ler o `55` como país (ver
 *   `telefoneDaEntrada`).
 *
 * Os dígitos podem passar do limite: quem chama decide recusar.
 */
type TelefoneLido =
  | { readonly tipo: "pais" | "estrangeiro"; readonly valor: string }
  | { readonly tipo: "nacional"; readonly digitos: string };

function lerTelefone(entrada: string, inteira: boolean): TelefoneLido {
  const digitos = somenteDigitos(entrada);
  if (comecaComMais(entrada)) {
    if (PAIS_EM_DIGITACAO.test(entrada)) {
      return { tipo: "pais", valor: `+${digitos}` };
    }
    if (!digitos.startsWith("55")) {
      return { tipo: "estrangeiro", valor: `+${digitos}` };
    }
    return { tipo: "nacional", digitos: digitos.slice(2) };
  }
  if (
    inteira &&
    (digitos.length === 12 || digitos.length === 13) &&
    digitos.startsWith("55")
  ) {
    return { tipo: "nacional", digitos: digitos.slice(2) };
  }
  return { tipo: "nacional", digitos };
}

/** O valor e o cursor ficam como estavam: entrada recusada, com o motivo. */
function recusar(
  anterior: string,
  cursor: number,
  motivo: MotivoDaRecusa,
): EstadoDoCampo {
  return {
    valor: anterior,
    cursor: Math.max(0, Math.min(cursor, anterior.length)),
    recusado: motivo,
  };
}

/**
 * T179 — o que mudou entre `anterior` e `entrada`: o maior prefixo e o maior
 * sufixo comuns, sem se sobreporem. O que fica fora deles é o trecho
 * trocado. Diz se algum DÍGITO do anterior sobreviveu (no prefixo ou no
 * sufixo) e se a mudança foi só inserção (o anterior inteiro sobreviveu).
 */
function comparar(
  anterior: string,
  entrada: string,
): { readonly digito: boolean; readonly soInsercao: boolean } {
  const maximo = Math.min(anterior.length, entrada.length);
  let prefixo = 0;
  while (prefixo < maximo && anterior[prefixo] === entrada[prefixo]) {
    prefixo++;
  }
  let sufixo = 0;
  while (
    sufixo < maximo - prefixo &&
    anterior[anterior.length - 1 - sufixo] ===
      entrada[entrada.length - 1 - sufixo]
  ) {
    sufixo++;
  }
  const conservado =
    anterior.slice(0, prefixo) + anterior.slice(anterior.length - sufixo);
  return {
    digito: DIGITO.test(conservado),
    soInsercao: prefixo + sufixo === anterior.length,
  };
}

/** T179 — o que uma mudança do telefone conserva do valor anterior. */
interface Conservado {
  /** Algum dígito NACIONAL do anterior ficou: é inserção num número. */
  readonly digito: boolean;
  /** O anterior inteiro ficou: só houve inserção, nada foi trocado. */
  readonly soInsercao: boolean;
}

/** Nada do anterior ficou: a entrada é INTEIRA. */
const ENTRADA_INTEIRA: Conservado = { digito: false, soInsercao: false };

/**
 * T179 (revisão final) — o telefone que uma mudança produz, ou a recusa.
 *
 * `conservado.digito` diz se a mudança mantém dígitos NACIONAIS do valor
 * anterior (inserção num número existente); sem isso, a entrada é INTEIRA. O
 * `+55` em digitação não conta como dígito nacional: colar ou soltar texto
 * depois dele é entrada única.
 *
 * - Inserção que passa de 11 dígitos: RECUSADA (`excedente`). Um número de DDD
 *   55 com dígitos a mais nunca vira `55` do país + outro número.
 * - Entrada inteira com mais de 11 dígitos: só `55` + 10 ou 11 dígitos (sem
 *   `+`) ou `+55` + até 11 dígitos servem; o resto é RECUSADO (`formato`) —
 *   zero de tronco, `0055…`, texto com ramal, 14 dígitos.
 * - `+` posto na frente de um número nacional que já estava no campo:
 *   RECUSADO, para o DDD (55 inclusive) não virar código de país.
 * - `+` de outro país: fica como veio (a validação o recusa); passar de 15
 *   dígitos, o limite internacional, é recusado (`formato`).
 */
function telefoneDaEntrada(
  anterior: string,
  entrada: string,
  cursor: number,
  cursorDaRecusa: number,
  conservado: Conservado,
): EstadoDoCampo {
  const limite = LIMITE_DE_DIGITOS.telefone;
  const digitos = somenteDigitos(entrada);

  if (
    comecaComMais(entrada) &&
    !comecaComMais(anterior) &&
    conservado.digito &&
    conservado.soInsercao
  ) {
    return recusar(
      anterior,
      cursorDaRecusa,
      digitos.length > limite ? "excedente" : "formato",
    );
  }

  const lido = lerTelefone(entrada, !conservado.digito);
  if (lido.tipo !== "nacional") {
    if (lido.tipo === "estrangeiro" && digitos.length > LIMITE_INTERNACIONAL) {
      return recusar(anterior, cursorDaRecusa, "formato");
    }
    return { valor: lido.valor, cursor: lido.valor.length };
  }
  if (lido.digitos.length > limite) {
    return recusar(
      anterior,
      cursorDaRecusa,
      conservado.digito ? "excedente" : "formato",
    );
  }
  // O `55` do país sai do começo: o cursor anda dois dígitos para trás.
  const antes = digitosAntesDe(entrada, cursor);
  const antesNacional = Math.max(
    0,
    antes - (digitos.length - lido.digitos.length),
  );
  const valor = mascararTelefone(lido.digitos);
  return {
    valor,
    cursor: posicaoAposDigitos(
      valor,
      Math.min(antesNacional, lido.digitos.length),
    ),
  };
}

/**
 * Aplica a máscara a uma mudança do campo (`onChange`): digitação, apagar,
 * colagem que o navegador já inseriu, arrastar e soltar, sugestão do teclado,
 * ditado, IME, preenchimento automático.
 *
 * `anterior` é o valor antes da mudança; `entrada` e `cursor`, o que o
 * navegador tem agora. Entrada que passa do limite é RECUSADA — o valor fica
 * como estava, o cursor volta para onde estava antes da inserção, e o estado
 * volta com o motivo em `recusado`, para o campo avisar — em vez de empurrar
 * dígitos para fora sem aviso.
 *
 * T179 (revisão final) — vale para QUALQUER quantidade de dígitos inseridos de
 * uma vez, não só para a tecla seguinte. CEP: nada além de 8 dígitos entra.
 * Telefone: ver `telefoneDaEntrada`.
 *
 * Valor que JÁ passava do limite (CEP de outro país antes de o país voltar a
 * ser Brasil) pode ser apagado aos poucos: mudança que não aumenta os dígitos
 * fica como veio, sem cortar nada, até caber na máscara.
 */
export function aplicarMascara(
  tipo: TipoMascara,
  anterior: string,
  entrada: string,
  cursor: number,
): EstadoDoCampo {
  const limite = LIMITE_DE_DIGITOS[tipo];
  const digitosAnteriores = somenteDigitos(anterior);
  const digitos = somenteDigitos(entrada);
  // Onde o cursor estava antes: a inserção termina no cursor de agora.
  const cursorDaRecusa = cursor - (entrada.length - anterior.length);

  if (
    digitos.length > limite &&
    digitos.length <= digitosAnteriores.length &&
    !(tipo === "telefone" && comecaComMais(entrada))
  ) {
    return { valor: entrada, cursor };
  }

  if (tipo === "cep") {
    if (digitos.length > limite) {
      return recusar(anterior, cursorDaRecusa, "excedente");
    }
    const valor = mascararCep(digitos);
    const antes = digitosAntesDe(entrada, cursor);
    return {
      valor,
      cursor: posicaoAposDigitos(valor, Math.min(antes, digitos.length)),
    };
  }

  const { digito, soInsercao } = comparar(anterior, entrada);
  return telefoneDaEntrada(anterior, entrada, cursor, cursorDaRecusa, {
    // `+`, `+5` ou `+55` em digitação não são dígitos do número.
    digito: digito && !PAIS_EM_DIGITACAO.test(anterior),
    soInsercao,
  });
}

/**
 * Colagem (`onPaste`): o texto colado substitui a seleção `[inicio, fim)` do
 * valor atual.
 *
 * - CEP: o colado é limpo e entra no lugar da seleção; se o resultado passar
 *   de 8 dígitos, a colagem é RECUSADA com aviso e o valor fica. CEP inteiro
 *   colado em campo vazio, ou sobre o CEP todo selecionado, entra.
 * - Telefone (T179, B2 e revisão final) — a mesma regra do `onChange`:
 *   - com o campo só no código do país (`+`, `+5` ou `+55`), campo e colado
 *     viram UMA entrada antes de formatar — `+55` + `91 98765-4321` dá
 *     `(91) 98765-4321`. Se o colado já traz o próprio país (`+…` ou `55` +
 *     DDD + número), ele vale sozinho, para o `55` não entrar duas vezes;
 *   - sem nenhum dígito fora da seleção (campo vazio ou tudo selecionado), o
 *     colado é uma entrada INTEIRA: `+55…` e `55…` com 12 ou 13 dígitos
 *     trazem o país; `+` de outro país fica como veio e é recusado na
 *     validação;
 *   - colado num número existente (fim, meio ou início) é INSERÇÃO: passou de
 *     11 dígitos, RECUSADO, sem ler `55` nenhum como país.
 *   Nenhum dígito some sem aviso.
 */
export function colarNaMascara(
  tipo: TipoMascara,
  atual: string,
  inicio: number,
  fim: number,
  colado: string,
): EstadoDoCampo {
  const limite = LIMITE_DE_DIGITOS[tipo];
  if (tipo === "cep") {
    const limpo = somenteDigitos(colado);
    const antes = somenteDigitos(atual.slice(0, inicio));
    const depois = somenteDigitos(atual.slice(fim));
    const digitos = `${antes}${limpo}${depois}`;
    if (digitos.length > limite) return recusar(atual, inicio, "excedente");
    const valor = mascararCep(digitos);
    return {
      valor,
      cursor: posicaoAposDigitos(valor, antes.length + limpo.length),
    };
  }

  const foraDaSelecao = atual.slice(0, inicio) + atual.slice(fim);
  const combinado = atual.slice(0, inicio) + colado + atual.slice(fim);
  const cursorNoCombinado = inicio + colado.length;
  if (PAIS_EM_DIGITACAO.test(foraDaSelecao)) {
    return comecaComMais(colado) || temCodigoDoPais(colado)
      ? telefoneDaEntrada(atual, colado, colado.length, inicio, ENTRADA_INTEIRA)
      : telefoneDaEntrada(
          atual,
          combinado,
          cursorNoCombinado,
          inicio,
          ENTRADA_INTEIRA,
        );
  }
  if (!DIGITO.test(foraDaSelecao)) {
    return telefoneDaEntrada(
      atual,
      colado,
      colado.length,
      inicio,
      ENTRADA_INTEIRA,
    );
  }
  return telefoneDaEntrada(atual, combinado, cursorNoCombinado, inicio, {
    digito: true,
    soInsercao: inicio === fim,
  });
}

/**
 * Backspace e Delete sobre um SEPARADOR (`(`, `)`, espaço, `-`). Sem isto, o
 * navegador apagaria só o separador, a máscara o poria de volta e a tecla
 * pareceria não funcionar. Aqui, Backspace apaga o dígito anterior mais
 * próximo e Delete, o seguinte.
 *
 * Devolve `null` quando a tecla pode seguir o comportamento normal: há
 * seleção, ou o caractere vizinho já é dígito (a mudança chega por
 * `aplicarMascara`).
 */
export function apagarComSeparador(
  tipo: TipoMascara,
  valor: string,
  inicio: number,
  fim: number,
  tecla: "Backspace" | "Delete",
): EstadoDoCampo | null {
  if (inicio !== fim) return null;
  // T179 (B1) — com o `+` do país ainda no campo, a tecla segue o normal: o
  // `+` não é separador da máscara, é o que foi digitado.
  if (tipo === "telefone" && comecaComMais(valor)) return null;
  const digitos = somenteDigitos(valor);
  const antes = digitosAntesDe(valor, inicio);
  if (tecla === "Backspace") {
    if (inicio === 0 || DIGITO.test(valor[inicio - 1]!)) return null;
    if (antes === 0) return { valor, cursor: inicio };
    const novos = digitos.slice(0, antes - 1) + digitos.slice(antes);
    const novo = mascarar(tipo, novos);
    return { valor: novo, cursor: posicaoAposDigitos(novo, antes - 1) };
  }
  if (inicio >= valor.length || DIGITO.test(valor[inicio]!)) return null;
  if (antes >= digitos.length) return { valor, cursor: inicio };
  const novos = digitos.slice(0, antes) + digitos.slice(antes + 1);
  const novo = mascarar(tipo, novos);
  return { valor: novo, cursor: posicaoAposDigitos(novo, antes) };
}

// ---------------------------------------------------------------------------
// Exibição do que o servidor gravou.
// ---------------------------------------------------------------------------

/**
 * Telefone gravado (`+55` + DDD + número) na forma brasileira:
 * `+5511987654321` → `(11) 98765-4321`. Valor que não tem a forma de um
 * número brasileiro completo (registro antigo, ainda em revisão) aparece como
 * veio — mascarar pela metade inventaria um número.
 */
export function exibirTelefone(valor: string | null | undefined): string {
  if (typeof valor !== "string") return "";
  const nacionais = digitosNacionaisDoTelefone(valor);
  const forma = /^\+?[0-9 ().-]+$/.test(valor.trim());
  if (!forma || (nacionais.length !== 10 && nacionais.length !== 11)) {
    return valor;
  }
  // `+` de outro país não é número brasileiro: fica como veio.
  if (/^\s*\+/.test(valor) && !somenteDigitos(valor).startsWith("55")) {
    return valor;
  }
  return mascararTelefone(nacionais);
}

/**
 * CEP gravado: com país Brasil e 8 dígitos, `00000-000`. Outro país, ou forma
 * diferente, aparece como veio.
 */
export function exibirCep(
  valor: string | null | undefined,
  brasileiro: boolean,
): string {
  if (typeof valor !== "string") return "";
  if (!brasileiro || !/^[0-9]{5}-?[0-9]{3}$/.test(valor.trim())) return valor;
  return mascararCep(valor);
}
