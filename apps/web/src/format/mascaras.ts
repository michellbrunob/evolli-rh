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

const DIGITO = /[0-9]/;

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
 * Aplica a máscara a uma mudança do campo (`onChange`): digitação, apagar,
 * colagem que o navegador já inseriu, preenchimento automático.
 *
 * `anterior` é o valor antes da mudança; `entrada` e `cursor`, o que o
 * navegador tem agora. Um dígito a mais num campo já cheio é RECUSADO — o
 * valor fica como estava, com o cursor onde estava — em vez de empurrar o
 * último dígito para fora sem aviso.
 */
export function aplicarMascara(
  tipo: TipoMascara,
  anterior: string,
  entrada: string,
  cursor: number,
): EstadoDoCampo {
  const limite = LIMITE_DE_DIGITOS[tipo];
  const digitosAnteriores = somenteDigitos(anterior);
  let digitos = somenteDigitos(entrada);
  let antes = digitosAntesDe(entrada, cursor);

  const digitacaoAlemDoLimite =
    digitos.length > limite &&
    digitos.length - digitosAnteriores.length === 1 &&
    digitosAnteriores.length >= limite;
  if (digitacaoAlemDoLimite) {
    const valor = mascarar(tipo, digitosAnteriores);
    return { valor, cursor: posicaoAposDigitos(valor, antes - 1) };
  }

  if (tipo === "telefone") {
    // O `55` do país sai do começo: o cursor anda dois dígitos para trás.
    if (temCodigoDoPais(entrada)) antes = Math.max(0, antes - 2);
    digitos = digitosNacionaisDoTelefone(entrada);
  }

  digitos = digitos.slice(0, limite);
  const valor = mascarar(tipo, digitos);
  return {
    valor,
    cursor: posicaoAposDigitos(valor, Math.min(antes, digitos.length)),
  };
}

/**
 * Colagem (`onPaste`): o texto colado substitui a seleção `[inicio, fim)` do
 * valor atual. O que veio colado é limpo SOZINHO antes de entrar — assim um
 * `+55 11 98765-4321` colado no meio de um campo vazio ou não perde o `55` do
 * país do jeito certo. Passou do limite, o excesso do fim é descartado.
 */
export function colarNaMascara(
  tipo: TipoMascara,
  atual: string,
  inicio: number,
  fim: number,
  colado: string,
): EstadoDoCampo {
  const limite = LIMITE_DE_DIGITOS[tipo];
  const limpo =
    tipo === "telefone"
      ? digitosNacionaisDoTelefone(colado)
      : somenteDigitos(colado);
  const antes = somenteDigitos(atual.slice(0, inicio));
  const depois = somenteDigitos(atual.slice(fim));
  const digitos = `${antes}${limpo}${depois}`.slice(0, limite);
  const valor = mascarar(tipo, digitos);
  const cursorEmDigitos = Math.min(antes.length + limpo.length, digitos.length);
  return { valor, cursor: posicaoAposDigitos(valor, cursorEmDigitos) };
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
