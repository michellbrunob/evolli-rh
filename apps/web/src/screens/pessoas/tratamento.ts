/**
 * T215 — o tratamento de uma pessoa nos textos da tela, pelo gênero
 * informado no cadastro (nunca adivinhado pelo nome):
 *
 * - **Masculino:** "Não convidado", "O Michell ainda não tem acesso… para
 *   ele…", "evolução do Michell";
 * - **Feminino:** "Não convidada", "A Ana…", "para ela", "da Ana";
 * - **Outro, prefiro não informar ou vazio:** texto neutro ("a pessoa",
 *   "convidada(o)", o nome sem artigo).
 */
export interface Tratamento {
  /** "Ele" / "Ela" / "A pessoa" (começo de frase). */
  readonly pronome: string;
  /** "ele" / "ela" / "a pessoa" (meio de frase). */
  readonly pronomeNaFrase: string;
  /** "O" / "A" / "" (o artigo, em maiúscula). */
  readonly artigo: string;
  /** "convidado" / "convidada" / "convidada(o)". */
  readonly convidado: string;
  /** "O Michell" / "A Ana" / "Sam" (começo de frase). */
  readonly oNome: string;
  /** "o Michell" / "a Ana" / "Sam" (meio de frase). */
  readonly oNomeNaFrase: string;
  /** "do Michell" / "da Ana" / "de Sam". */
  readonly doNome: string;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function tratamentoDe(
  genero: string | null | undefined,
  nome: string,
): Tratamento {
  const curto = primeiroNome(nome);
  if (genero === "masculino") {
    return {
      pronome: "Ele",
      pronomeNaFrase: "ele",
      artigo: "O",
      convidado: "convidado",
      oNome: `O ${curto}`,
      oNomeNaFrase: `o ${curto}`,
      doNome: `do ${curto}`,
    };
  }
  if (genero === "feminino") {
    return {
      pronome: "Ela",
      pronomeNaFrase: "ela",
      artigo: "A",
      convidado: "convidada",
      oNome: `A ${curto}`,
      oNomeNaFrase: `a ${curto}`,
      doNome: `da ${curto}`,
    };
  }
  return {
    pronome: "A pessoa",
    pronomeNaFrase: "a pessoa",
    artigo: "",
    convidado: "convidada(o)",
    oNome: curto,
    oNomeNaFrase: curto,
    doNome: `de ${curto}`,
  };
}
