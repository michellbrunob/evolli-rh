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
 *   já mascarado, vira o número nacional; o `55` do país sai.
 * - **País por teclado só com `+`** (T179, B1 e B2): `+`, `+5` e `+55` ficam no
 *   campo até o primeiro dígito nacional; colar depois deles junta tudo numa
 *   entrada só. Número nacional completo (inclusive de DDD 55) RECUSA dígito a
 *   mais, com aviso, em vez de virar outro número.
 *
 * ## O que ela não faz
 *
 * Não valida: um número com a forma certa ainda pode ter DDD inexistente. Quem
 * diz se o valor serve é a validação do formulário (`contatosColaborador.ts`,
 * `dadosPessoais.ts`) e, por fim, o servidor. Também não presume país para o
 * CEP: a tela só usa a máscara de CEP quando o país é o Brasil.
 */

export type TipoMascara = "cep" | "telefone";

/** Estado de um campo de texto: o valor e a posição do cursor (colapsado). */
export interface EstadoDoCampo {
  readonly valor: string;
  readonly cursor: number;
  /**
   * T179 (B2) — a entrada passou do limite e foi RECUSADA: o valor é o que
   * estava. O campo avisa (`AVISO_DE_EXCEDENTE`), em vez de calar.
   */
  readonly recusado?: true;
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

/** T179 (B2) — aviso quando o que foi digitado ou colado passa do limite. */
export const AVISO_DE_EXCEDENTE: Readonly<Record<TipoMascara, string>> = {
  cep: "O CEP tem 8 dígitos: o que passou disso não entrou.",
  telefone:
    "O número já está completo: o que passou de 11 dígitos não entrou. Para informar o código do país, comece com +55.",
};

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
 * T179 (B2 da revisão) — leitura de um telefone INTEIRO: o que o campo terá
 * depois da mudança, seja ela uma tecla, uma colagem ou um preenchimento.
 *
 * - `+`, `+5` ou `+55` sozinhos: o código do país ainda sendo digitado.
 * - `+` de outro país: estrangeiro, mostrado como veio — nada de DDD
 *   inventado; a validação o recusa (só número brasileiro).
 * - `+55` + dígitos: o `55` é o país; o resto, o número nacional.
 * - sem `+`: dígitos nacionais. Com 12 ou 13 dígitos começando por `55`, o
 *   texto só pode ser `55` + DDD + número — mas só uma ENTRADA INTEIRA chega
 *   assim (colagem, preenchimento); tecla a tecla, um número completo recusa o
 *   dígito seguinte antes de chegar aqui (ver `aplicarMascara`).
 *
 * O número nacional pode passar de 11 dígitos: quem chama decide recusar.
 */
type TelefoneLido =
  | { readonly tipo: "pais" | "estrangeiro"; readonly valor: string }
  | { readonly tipo: "nacional"; readonly digitos: string };

function lerTelefone(entrada: string): TelefoneLido {
  const digitos = somenteDigitos(entrada);
  if (comecaComMais(entrada)) {
    if (PAIS_EM_DIGITACAO.test(entrada)) {
      return { tipo: "pais", valor: `+${digitos}` };
    }
    if (!digitos.startsWith("55")) {
      return {
        tipo: "estrangeiro",
        valor: `+${digitos.slice(0, LIMITE_INTERNACIONAL)}`,
      };
    }
    return { tipo: "nacional", digitos: digitos.slice(2) };
  }
  if (
    (digitos.length === 12 || digitos.length === 13) &&
    digitos.startsWith("55")
  ) {
    return { tipo: "nacional", digitos: digitos.slice(2) };
  }
  return { tipo: "nacional", digitos };
}

/** O valor fica como estava: entrada excedente, recusada com aviso. */
function recusar(anterior: string, cursor: number): EstadoDoCampo {
  return { valor: anterior, cursor, recusado: true };
}

/**
 * Aplica a máscara a uma mudança do campo (`onChange`): digitação, apagar,
 * colagem que o navegador já inseriu, preenchimento automático.
 *
 * `anterior` é o valor antes da mudança; `entrada` e `cursor`, o que o
 * navegador tem agora. Entrada que passa do limite é RECUSADA — o valor fica
 * como estava e o estado volta com `recusado`, para o campo avisar — em vez
 * de empurrar dígitos para fora sem aviso.
 *
 * T179 (B2) — telefone completo é NACIONAL: com 11 dígitos, o dígito seguinte
 * é recusado, inclusive com DDD 55. Um número de DDD 55 não vira `55` do país
 * por causa de dígitos a mais. O código do país, por teclado, se informa com
 * `+`; sem `+`, só uma entrada inteira (colagem, preenchimento) o traz.
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
  const antes = digitosAntesDe(entrada, cursor);

  const teclaAlemDoLimite =
    !(tipo === "telefone" && comecaComMais(entrada)) &&
    digitos.length > limite &&
    digitos.length - digitosAnteriores.length === 1 &&
    digitosAnteriores.length >= limite;
  if (teclaAlemDoLimite) {
    const valor = mascarar(tipo, digitosAnteriores);
    return {
      valor,
      cursor: posicaoAposDigitos(valor, antes - 1),
      recusado: true,
    };
  }

  if (tipo === "cep") {
    const cep = digitos.slice(0, limite);
    const valor = mascararCep(cep);
    return {
      valor,
      cursor: posicaoAposDigitos(valor, Math.min(antes, cep.length)),
    };
  }

  const lido = lerTelefone(entrada);
  if (lido.tipo !== "nacional") {
    return { valor: lido.valor, cursor: lido.valor.length };
  }
  if (lido.digitos.length > limite) {
    return recusar(anterior, anterior.length);
  }
  // O `55` do país sai do começo: o cursor anda dois dígitos para trás.
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
 * Colagem (`onPaste`): o texto colado substitui a seleção `[inicio, fim)` do
 * valor atual.
 *
 * - CEP: o colado é limpo e entra no lugar da seleção; passou de 8 dígitos, o
 *   excesso do fim é descartado.
 * - Telefone (T179, B2):
 *   - colado que começa com `+` é um número INTEIRO, com o próprio país: ele
 *     substitui o campo (`+` de outro país fica como veio e é recusado);
 *   - com o campo só no código do país (`+`, `+5` ou `+55`), campo e colado
 *     viram UMA entrada antes de formatar — `+55` + `91 98765-4321` dá
 *     `(91) 98765-4321`. Se o colado já traz o próprio `55` do país, ele vale
 *     sozinho, para o `55` não entrar duas vezes;
 *   - nos demais casos, o colado é limpo sozinho (o `55` do país sai) e entra
 *     no lugar da seleção.
 *   Passou de 11 dígitos nacionais, a colagem é RECUSADA com aviso e o valor
 *   fica como estava — nenhum dígito some sem aviso.
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
    const digitos = `${antes}${limpo}${depois}`.slice(0, limite);
    const valor = mascararCep(digitos);
    const cursorEmDigitos = Math.min(
      antes.length + limpo.length,
      digitos.length,
    );
    return { valor, cursor: posicaoAposDigitos(valor, cursorEmDigitos) };
  }

  const foraDaSelecao = atual.slice(0, inicio) + atual.slice(fim);
  if (
    comecaComMais(colado) ||
    (PAIS_EM_DIGITACAO.test(foraDaSelecao) && temCodigoDoPais(colado))
  ) {
    return telefoneInteiro(atual, colado);
  }
  if (PAIS_EM_DIGITACAO.test(foraDaSelecao)) {
    return telefoneInteiro(
      atual,
      atual.slice(0, inicio) + colado + atual.slice(fim),
    );
  }

  const limpo = digitosNacionaisDeColagem(colado);
  const antes = somenteDigitos(atual.slice(0, inicio));
  const depois = somenteDigitos(atual.slice(fim));
  const digitos = `${antes}${limpo}${depois}`;
  if (digitos.length > limite) return recusar(atual, inicio);
  const valor = mascararTelefone(digitos);
  return {
    valor,
    cursor: posicaoAposDigitos(valor, antes.length + limpo.length),
  };
}

/** Um telefone inteiro no lugar do campo (ver `lerTelefone`). */
function telefoneInteiro(atual: string, entrada: string): EstadoDoCampo {
  const lido = lerTelefone(entrada);
  if (lido.tipo !== "nacional") {
    return { valor: lido.valor, cursor: lido.valor.length };
  }
  if (lido.digitos.length > LIMITE_DE_DIGITOS.telefone) {
    return recusar(atual, atual.length);
  }
  const valor = mascararTelefone(lido.digitos);
  return { valor, cursor: valor.length };
}

/** Dígitos nacionais de um trecho colado, SEM cortar no limite. */
function digitosNacionaisDeColagem(colado: string): string {
  const digitos = somenteDigitos(colado);
  return temCodigoDoPais(colado) ? digitos.slice(2) : digitos;
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
