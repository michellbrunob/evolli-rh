/**
 * Inventário da consolidação de datas da T154 — infraestrutura de teste.
 *
 * Existe porque a descrição da PR afirmou "17 formatadores locais removidos",
 * e o número estava errado. Ele veio de uma varredura por lista de prefixos de
 * nome, que não enxergou `formatarDiaReferencia` nem os dois `formatarData`.
 * A recontagem por AST sobre a base achou **25 definições**, não 20.
 *
 * O número agora mora aqui, em código, com a quebra que o sustenta — e um
 * teste confere que a soma fecha. Escrever "17" de novo quebra a suíte.
 *
 * ## Como reproduzir o universo de 25
 *
 *     git grep -nE "^(export )?function formatar[A-Za-z0-9_]*\s*\(" \
 *       94bdededc481d3aa45e6970161090ff4d21da10b -- apps/web
 *
 * São **definições**. Importação, comentário, chamada e alias NÃO entram:
 * `import { formatarDiaCivil }` não define nada, `// use formatarDiaCivil` é
 * prosa, `formatarDiaCivil(x)` é uso, e `const formatarData = formatarDia` é
 * apelido — este último está contado à parte, como alias.
 */

export interface DefinicaoRemovida {
  readonly nome: string;
  readonly quantidade: number;
  readonly onde: string;
}

/**
 * Formatadores LOCAIS removidos: funções que formatavam data no próprio corpo,
 * fora do módulo central.
 */
export const FORMATADORES_LOCAIS_REMOVIDOS: readonly DefinicaoRemovida[] = [
  {
    nome: "formatarDataBr",
    quantidade: 12,
    onde: 'fixtures de 12 telas — corpo idêntico, `iso.split("-")`',
  },
  {
    nome: "formatarDataHora",
    quantidade: 3,
    onde: "SessoesAtivasPanel, DadosContratuaisScreen, HistoricoFuncionalScreen",
  },
  {
    nome: "formatarMomento",
    quantidade: 2,
    onde: "api/solicitacoesPessoasClient, VisaoPeriodoScreen",
  },
  {
    nome: "formatarDiaReferencia",
    quantidade: 1,
    onde: "api/solicitacoesPessoasClient — o segundo que morava no cliente HTTP",
  },
  {
    nome: "formatarData",
    quantidade: 2,
    onde: "ContasAcessoScreen, PessoasDocumentosScreen",
  },
];

/** O formatador central ANTIGO, substituído — não é "local". */
export const CENTRAL_ANTIGO_SUBSTITUIDO = {
  nome: "formatarDia",
  arquivo: "format/dia.ts",
  substitutoPor: "format/data.ts",
} as const;

/** Apelido removido. Apelido não é definição: conta separado. */
export const ALIASES_REMOVIDOS = [
  {
    nome: "formatarData",
    arquivo: "screens/pessoas/DadosContratuaisScreen.tsx",
    apelidava: "formatarDia",
  },
] as const;

/**
 * Wrappers de COMPOSIÇÃO preservados.
 *
 * Não formatam: compõem um texto a partir de um formatador. Continuam vivos e
 * passaram a delegar ao módulo central. Chamá-los de "formatadores removidos"
 * seria contar duas vezes e inflar o número.
 */
export const WRAPPERS_PRESERVADOS = [
  {
    nome: "formatarVigenciaIlustrativa",
    arquivo: "screens/horarios/politicasBancoHoras.fixtures.ts",
    compoe: "intervalo `X a Y (ilustrativa)`",
  },
  {
    nome: "formatarPeriodoIlustrativo",
    arquivo: "screens/ponto/fechamentoEspelho.fixtures.ts",
    compoe: "intervalo `X a Y (ilustrativo)`",
  },
  {
    nome: "formatarValidade",
    arquivo: "screens/documentos/documentosMetadados.fixtures.ts",
    compoe: "data ou `Sem validade definida (exemplo)`",
  },
  {
    nome: "formatarValidadeRepositorio",
    arquivo: "screens/documentos/repositorioDocumental.fixtures.ts",
    compoe: "data ou `Sem validade definida (exemplo)`",
  },
] as const;

/** Universo de `function formatar*` medido na base `94bdeded`. */
export const DEFINICOES_NA_BASE = 25;

/** Soma dos formatadores locais removidos. Derivada, nunca escrita à mão. */
export const TOTAL_LOCAIS_REMOVIDOS = FORMATADORES_LOCAIS_REMOVIDOS.reduce(
  (soma, d) => soma + d.quantidade,
  0,
);

/** As três funções que o módulo central expõe hoje. */
export const CENTRAIS_HOJE = [
  "formatarDiaCivil",
  "formatarMesReferencia",
  "formatarInstante",
] as const;
