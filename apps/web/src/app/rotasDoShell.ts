/**
 * Rotas de URL do shell (T176, ampliada na T178) — os destinos endereçáveis
 * por URL.
 *
 * Até a T175 o painel não tinha rota nenhuma: destino era só estado do shell
 * (`mapaNavegacao.ts`). A decisão da proprietária sobre o `DP-FLX-21`
 * (2026-10-20) pôs o cadastro longo de admissão em **página própria**, e uma
 * página própria precisa poder ser aberta, recarregada e deixada pelo botão
 * "voltar" do navegador.
 *
 * T178 — a listagem de Colaboradores virou a porta principal de Gestão de
 * Pessoas e ganhou rota também (`#/pessoas/colaboradores`). Sem ela, a Nova
 * admissão era a única página com endereço: recarregar a listagem caía na
 * escolha do Hub, e sair da Nova admissão devolvia a uma URL sem rota. Com as
 * duas, ir da listagem à admissão empilha um endereço, e voltar, cancelar ou
 * concluir devolve à listagem pelo endereço dela.
 *
 * T198 — a ficha do colaborador é página própria, com endereço por
 * colaborador e por aba (`#/pessoas/colaboradores/:id/:aba`, ver
 * `fichaDaRota`). Ela pertence ao destino `pessoas`: a mesma capacidade de
 * Colaboradores, e a troca de empresa a reduz à listagem.
 *
 * **Limitação conhecida:** as demais abas internas de `PessoasScreen`
 * (horário, histórico funcional, dados contratuais da empresa...) continuam
 * sendo estado local, sem URL — recarregar numa delas volta à aba
 * Colaboradores.
 *
 * A rota usa o fragmento (`#/...`), e não o caminho, de propósito: o fragmento
 * nunca chega ao servidor, então nenhum servidor estático precisa aprender a
 * devolver o `index.html` para um caminho novo. Não há biblioteca de rotas: uma
 * tabela fechada de destino para fragmento basta, e o que não está nela
 * continua sendo estado do shell, como antes.
 *
 * Só fragmentos que começam com `#/` pertencem às rotas. Os demais
 * (`#conteudo-principal`, do link "Pular para o conteúdo") são âncoras da
 * página e não trocam de destino — ver `ehFragmentoDeRota`.
 *
 * **Não é autorização.** A rota só diz qual destino montar; quem decide se o
 * papel pode abri-lo é `resolverEntrada` no `App`, com a mesma tabela de
 * capacidade de sempre, e o servidor decide cada requisição.
 */

/** Destinos com URL própria. Fechada: destino fora dela não tem rota. */
const ROTA_POR_DESTINO: Readonly<Record<string, string>> = {
  // T178 — o id segue `pessoas` (o contêiner, aberto na aba Colaboradores).
  pessoas: "#/pessoas/colaboradores",
  "nova-admissao": "#/pessoas/nova-admissao",
  // T209 (Bloco C) — importação por planilha, sub-página de Colaboradores.
  "importar-colaboradores": "#/pessoas/importar",
  // T215 — Políticas de férias, sub-página de Colaboradores (engrenagem da
  // aba Férias e ausências).
  "politicas-ferias": "#/pessoas/politicas-ferias",
  // T215 — o módulo Benefícios (as subtelas vivem dentro dele).
  beneficios: "#/beneficios",
  // T216 — o módulo Pesquisas (as subtelas vivem dentro dele).
  pesquisas: "#/pesquisas",
  // T182 — tela própria do catálogo de jornadas: recarregar volta a ela.
  // T215 — o quadro da escala (o id fica `jornadas-trabalho`) e os turnos,
  // sub-página dele.
  "jornadas-trabalho": "#/pessoas/escala",
  "turnos-escala": "#/pessoas/escala/turnos",
  "regras-escala": "#/pessoas/escala/regras",
  "transicao-escala": "#/pessoas/escala/transicao",
  "modelo-escala": "#/pessoas/escala/modelo",
  // T208 — Configurações abre no único submódulo com tela: Meu perfil.
  configuracoes: "#/configuracoes/meu-perfil",
  // T210 — Configurações › Aparência (o tema da própria conta).
  "configuracoes-aparencia": "#/configuracoes/aparencia",
  // T209 — Configurações › Empresas e a Nova empresa.
  "configuracoes-empresas": "#/configuracoes/empresas",
  "nova-empresa": "#/configuracoes/empresas/nova",
  // T215 — o módulo Segurança: Sessões ativas e Permissões de acesso (as
  // Contas de acesso, que até a T215 moravam em Configurações).
  seguranca: "#/seguranca/sessoes-ativas",
  "contas-acesso": "#/seguranca/permissoes-de-acesso",
  // T211 — fora do menu lateral: abrem pela URL própria.
  ponto: "#/jornada/ponto",
  "administracao-lideranca": "#/lideranca/administracao",
};

/**
 * T208 — `#/configuracoes` sozinho leva ao único submódulo com tela (Meu
 * perfil); a primeira exibição escreve a forma canônica no lugar. Outro
 * caminho (`#/configuracoes/seguranca`) não é rota: não há tela atrás dele.
 */
const ROTA_DO_MODULO_CONFIGURACOES = "#/configuracoes";

/**
 * T215 — endereços que levam a um destino sem serem a forma canônica dele:
 * `#/seguranca` sozinho (o módulo abre em Sessões ativas) e o endereço
 * salvo das permissões quando moravam em Configurações. A primeira exibição
 * escreve a forma canônica no lugar.
 */
const ROTAS_ALTERNATIVAS: Readonly<Record<string, string>> = {
  "#/seguranca": "seguranca",
  "#/configuracoes/equipe-e-permissoes": "contas-acesso",
  // T215 — endereço antigo de "Escala de trabalho" (catálogo de jornadas).
  "#/estrutura/jornadas-trabalho": "jornadas-trabalho",
};

/** O fragmento da URL do destino, ou `null` se ele não tem rota própria. */
export function rotaDoDestino(destinoId: string): string | null {
  return ROTA_POR_DESTINO[destinoId] ?? null;
}

/**
 * T198 — as abas da ficha do colaborador, cada uma com endereço próprio (D18).
 * A ordem é a da navegação interna da ficha.
 *
 * T201 — "documentos": registros e solicitações de documento da pessoa, só
 * metadados (ADR 0011).
 *
 * T202 — "ponto": registros de ponto da pessoa, só consulta, com a
 * competência (mês) na rota (`…/ponto/AAAA-MM`).
 *
 * T203 — "solicitacoes": Solicitações de Pessoas da pessoa, só consulta. Não
 * existe para o DP (negado no servidor): o shell corrige a rota para "dados"
 * (ver `fichaParaOPapel`).
 */
export const ABAS_DA_FICHA = [
  "dados",
  "salarios",
  "ferias",
  "escala",
  "beneficios",
  "pesquisas",
  "documentos",
  "desenvolvimento",
  "comentarios",
] as const;
export type AbaDaFicha = (typeof ABAS_DA_FICHA)[number];

/**
 * T215 — a ficha no desenho da referência (decisão de 2026-11-23): as abas
 * acima. As que saíram da ficha (Vida funcional, Dados contratuais,
 * Registros de ponto e Solicitações) levam a Dados; "jornada" virou Escala.
 * Endereços salvos não quebram: a primeira exibição corrige a URL.
 */
const ABA_DA_FICHA_ANTIGA: Readonly<Record<string, AbaDaFicha>> = {
  "vida-funcional": "dados",
  contratuais: "dados",
  ponto: "dados",
  solicitacoes: "dados",
  jornada: "escala",
};

/**
 * T198 — a ficha pedida pela URL: o colaborador e a aba.
 *
 * T202 — `competencia` (`AAAA-MM`) vale só para a aba "ponto"; nas outras,
 * não vai à URL.
 */
export interface RotaDaFicha {
  readonly colaboradorId: string;
  readonly aba: AbaDaFicha;
  readonly competencia?: string;
  /**
   * T215 — a página "Editar colaborador", na seção pedida
   * (`…/:id/editar/:secao`). Presente, ela ocupa o lugar da ficha.
   */
  readonly edicao?: SecaoDaEdicao;
  /**
   * T215 — a edição foi aberta pela ficha desta pessoa, nesta aba: voltar
   * reabre a ficha nela. Não vai à URL (recarregar volta para a lista).
   */
  readonly voltarParaFicha?: AbaDaFicha;
}

/**
 * T215 — a edição pedida a partir do que está aberto: se é a ficha da mesma
 * pessoa (e não a própria edição), guarda a aba para a volta.
 */
export function edicaoAPartirDe(
  atual: RotaDaFicha | null,
  colaboradorId: string,
  secao: SecaoDaEdicao,
): RotaDaFicha {
  const daFicha =
    atual !== null &&
    atual.colaboradorId === colaboradorId &&
    atual.edicao === undefined;
  return {
    colaboradorId,
    aba: "dados",
    edicao: secao,
    ...(daFicha
      ? { voltarParaFicha: atual.aba }
      : atual?.colaboradorId === colaboradorId && atual.voltarParaFicha
        ? { voltarParaFicha: atual.voltarParaFicha }
        : {}),
  };
}

/** T215 — para onde a edição volta: a ficha de origem, ou a lista (`null`). */
export function voltarDaEdicao(edicao: RotaDaFicha | null): RotaDaFicha | null {
  if (!edicao?.voltarParaFicha) return null;
  return { colaboradorId: edicao.colaboradorId, aba: edicao.voltarParaFicha };
}

/**
 * T215 — as seções da página "Editar colaborador", na ordem do menu lateral.
 */
export const SECOES_DA_EDICAO = [
  "dados-basicos",
  "dados-profissionais",
  "endereco",
  "dependentes",
  "documentos",
  "dados-bancarios",
  "formacao-academica",
  "campos-extras",
] as const;
export type SecaoDaEdicao = (typeof SECOES_DA_EDICAO)[number];

function ehSecaoDaEdicao(valor: string): valor is SecaoDaEdicao {
  return (SECOES_DA_EDICAO as readonly string[]).includes(valor);
}

/**
 * T202 — competência no formato do servidor (`COMPETENCIA_PATTERN` da API):
 * quatro dígitos de ano e mês de 01 a 12.
 */
const COMPETENCIA = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

/** T202 — `AAAA-MM` válido (o mesmo formato que o servidor aceita). */
export function competenciaValida(valor: string): boolean {
  return COMPETENCIA.test(valor) && Number(valor.slice(0, 4)) >= 1;
}

/**
 * T202 — a competência do dia civil do navegador (P-4): a mesma regra de
 * "hoje" da listagem (T185).
 */
export function competenciaDoMesAtual(agora: Date = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  return `${String(agora.getFullYear()).padStart(4, "0")}-${mes}`;
}

/** T202 — a competência `delta` meses antes (negativo) ou depois. */
export function competenciaVizinha(competencia: string, delta: number): string {
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  const indice = ano * 12 + (mes - 1) + delta;
  const novoAno = Math.floor(indice / 12);
  const novoMes = (indice % 12) + 1;
  return `${String(novoAno).padStart(4, "0")}-${String(novoMes).padStart(2, "0")}`;
}

/**
 * T198 — a ficha é a primeira rota com parâmetro: `#/pessoas/colaboradores/`,
 * o id do colaborador (UUID, conferido antes de qualquer requisição) e, se
 * houver, a aba. Sem aba, vale "dados". Id ou aba fora do formato: não é rota.
 */
const PREFIXO_DA_FICHA = "#/pessoas/colaboradores/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fichaDaRota(fragmento: string): RotaDaFicha | null {
  if (!fragmento.startsWith(PREFIXO_DA_FICHA)) return null;
  const partes = fragmento.slice(PREFIXO_DA_FICHA.length).split("/");
  if (partes.length > 3) return null;
  const [colaboradorId = "", aba = "dados", competencia] = partes;
  if (!UUID.test(colaboradorId)) return null;
  // T215 — `…/:id/editar` e `…/:id/editar/:secao`: a página de edição.
  if (aba === "editar") {
    const secao = competencia ?? "dados-basicos";
    return ehSecaoDaEdicao(secao)
      ? { colaboradorId, aba: "dados", edicao: secao }
      : null;
  }
  const antiga = ABA_DA_FICHA_ANTIGA[aba];
  if (antiga) {
    // O antigo "…/ponto/AAAA-MM" também abre Dados.
    if (competencia !== undefined && aba !== "ponto") return null;
    return { colaboradorId, aba: antiga };
  }
  if (!(ABAS_DA_FICHA as readonly string[]).includes(aba)) return null;
  return competencia === undefined
    ? { colaboradorId, aba: aba as AbaDaFicha }
    : null;
}

/**
 * T198 — o endereço da ficha, sempre com a aba explícita. T202 — na aba
 * "ponto", sempre com a competência (a do mês corrente, se não houver).
 */
export function rotaDaFicha(ficha: RotaDaFicha): string {
  if (ficha.edicao !== undefined) {
    return `${PREFIXO_DA_FICHA}${ficha.colaboradorId}/editar/${ficha.edicao}`;
  }
  return `${PREFIXO_DA_FICHA}${ficha.colaboradorId}/${ficha.aba}`;
}

/**
 * T199 — as abas do dashboard de Colaboradores. Ativos é a inicial (N-6);
 * "jornada" mostra a visão de jornadas que já existia (N-4).
 * T215 — na ordem da tela: Ativos, Em admissão, Férias e ausências
 * ("ferias"), Escala de trabalho (o id "jornada" fica, para endereços
 * salvos), Desligados e Todos. O Organograma é atalho, não aba com estado.
 */
export const ABAS_DA_LISTAGEM = [
  "ativos",
  "em-admissao",
  "ferias",
  "jornada",
  "desligados",
  "todos",
] as const;
export type AbaDaListagem = (typeof ABAS_DA_LISTAGEM)[number];

/**
 * T215 — abas com a tabela de colaboradores. Escala de trabalho e Férias e
 * ausências são outras visões, com conteúdo e filtros próprios.
 */
export function abaTemTabela(aba: AbaDaListagem): boolean {
  return aba !== "jornada" && aba !== "ferias";
}

/**
 * T199 — os tipos de vínculo controlados. Aqui, e não importados do cliente da
 * API, porque os testes automockam aquele módulo (e listas viram vazias).
 */
export const TIPOS_DE_VINCULO = [
  "clt",
  "estagio",
  // T209 — Aprendiz, logo depois de Estágio (AP-8).
  "aprendiz",
  "pj",
  "temporario",
  "outro_controlado",
  // T209 — etapa 2 do Novo colaborador.
  "part_time",
  "freelancer",
  "trainee",
] as const;
export type TipoDeVinculo = (typeof TIPOS_DE_VINCULO)[number];

/**
 * T209 — tamanhos de página da listagem (C-2): 20 (o padrão), 50 e 100, o
 * teto que a API aceita. Fechado: outro valor na URL cai no padrão.
 */
export const TAMANHOS_DE_PAGINA = [20, 50, 100] as const;
export type TamanhoDaPagina = (typeof TAMANHOS_DE_PAGINA)[number];

/**
 * T215 — os níveis de carreira do contrato: a mesma lista fechada da API
 * (`NIVEIS`). Aqui, e não importados de outra tela, pela mesma razão dos
 * tipos de vínculo.
 */
export const NIVEIS_DE_CARREIRA = [
  "primeiro_emprego",
  "junior",
  "pleno",
  "senior",
  "lider_tecnico",
  "coordenador",
  "gerente",
  "head",
  "diretor",
  "vp",
  "c_level",
] as const;
export type NivelDeCarreira = (typeof NIVEIS_DE_CARREIRA)[number];

/** T215 — os gêneros do perfil pessoal: a lista fechada da API (`GENEROS`). */
export const GENEROS_DO_PERFIL = [
  "feminino",
  "masculino",
  "outro",
  "prefiro_nao_informar",
] as const;
export type GeneroDoPerfil = (typeof GENEROS_DO_PERFIL)[number];

/** T215 — o teto de valores por grupo da gaveta (o mesmo da API). */
export const FILTRO_VALORES_MAXIMOS = 50;

/**
 * T215 — os grupos da gaveta "Filtrar". Os de lotação (departamentos,
 * áreas, centros de custo, unidades, cargos) são ids; nível, tipo e gênero,
 * valores das listas fechadas. Lista vazia: sem filtro naquele grupo.
 */
export interface FiltrosDaListagem {
  readonly departamentos: readonly string[];
  readonly areas: readonly string[];
  readonly centrosCusto: readonly string[];
  readonly unidades: readonly string[];
  readonly cargos: readonly string[];
  readonly niveis: readonly NivelDeCarreira[];
  readonly tipos: readonly TipoDeVinculo[];
  readonly generos: readonly GeneroDoPerfil[];
}

export const FILTROS_VAZIOS: FiltrosDaListagem = {
  departamentos: [],
  areas: [],
  centrosCusto: [],
  unidades: [],
  cargos: [],
  niveis: [],
  tipos: [],
  generos: [],
};

/** T215 — os grupos que dependem da lotação vigente (vínculo ativo). */
export const GRUPOS_DE_LOTACAO = [
  "departamentos",
  "areas",
  "centrosCusto",
  "unidades",
  "cargos",
  "niveis",
] as const satisfies readonly (keyof FiltrosDaListagem)[];

/** T215 — quantos valores estão marcados, somando os grupos. */
export function quantidadeDeFiltros(filtros: FiltrosDaListagem): number {
  return Object.values(filtros).reduce(
    (soma: number, lista: readonly string[]) => soma + lista.length,
    0,
  );
}

/**
 * T199 — o que o dashboard guarda na URL (D-3): aba, página e os filtros.
 * **Nunca o texto da busca**, que pode ser nome ou matrícula — dado pessoal
 * não vai para a URL, o histórico ou o servidor de log.
 * T209 — e o tamanho da página (C-2), no parâmetro canônico `tamanho`.
 * T215 — os filtros são os grupos da gaveta "Filtrar", em listas.
 */
export interface EstadoDaListagem {
  readonly aba: AbaDaListagem;
  readonly pagina: number;
  readonly tamanho: TamanhoDaPagina;
  readonly filtros: FiltrosDaListagem;
}

/**
 * T199 — como o dashboard pede uma mudança de estado ao shell. `substituir`:
 * é uma CORREÇÃO (um id da URL que não existe nos catálogos da empresa), não
 * uma navegação — a URL é corrigida no lugar, sem entrada no histórico, para
 * o "voltar" não cair de novo no endereço inválido.
 */
export interface OpcoesDaMudancaDaListagem {
  readonly substituir?: boolean;
}

export const ESTADO_INICIAL_DA_LISTAGEM: EstadoDaListagem = {
  aba: "ativos",
  pagina: 1,
  tamanho: 20,
  filtros: FILTROS_VAZIOS,
};

const ROTA_DA_LISTAGEM = "#/pessoas/colaboradores";
const PAGINA_MAXIMA = 100_000;

/**
 * T199 — abas com filtro de lotação: a lotação vigente só existe em vínculo
 * ATIVO (T184, T190), então Departamento e Cargo nunca casariam em "Em
 * admissão" nem em "Desligados". T215 — o mesmo vale para Área, Centro de
 * custo, Unidade e Nível.
 */
export function abaTemLotacao(aba: AbaDaListagem): boolean {
  return aba === "ativos" || aba === "todos";
}

/**
 * T199 — o estado coerente com a aba: lotação só onde ela existe; as abas
 * sem tabela (jornada e, T215, férias) não levam página, filtros nem
 * tamanho — têm conteúdo próprio.
 */
export function normalizarEstadoDaListagem(
  estado: EstadoDaListagem,
): EstadoDaListagem {
  if (!abaTemTabela(estado.aba)) {
    return { ...ESTADO_INICIAL_DA_LISTAGEM, aba: estado.aba };
  }
  if (abaTemLotacao(estado.aba)) return estado;
  const lotacaoVazia = GRUPOS_DE_LOTACAO.every(
    (g) => estado.filtros[g].length === 0,
  );
  if (lotacaoVazia) return estado;
  return {
    ...estado,
    filtros: {
      ...FILTROS_VAZIOS,
      tipos: estado.filtros.tipos,
      generos: estado.filtros.generos,
    },
  };
}

/**
 * T215 — uma lista da URL: valores separados por vírgula (ou o parâmetro
 * repetido); cada um conferido; inválidos saem, repetidos entram uma vez, e
 * no máximo `FILTRO_VALORES_MAXIMOS`.
 */
function listaDaUrl<T extends string>(
  params: URLSearchParams,
  nome: string,
  aceitar: (valor: string) => T | null,
): T[] {
  const lidos: T[] = [];
  for (const bruto of params.getAll(nome)) {
    for (const parte of bruto.split(",")) {
      const valor = aceitar(parte.trim());
      if (valor !== null && !lidos.includes(valor)) lidos.push(valor);
    }
  }
  return lidos.slice(0, FILTRO_VALORES_MAXIMOS);
}

const idValido = (valor: string): string | null =>
  UUID.test(valor) ? valor.toLowerCase() : null;
const daLista =
  <T extends string>(lista: readonly T[]) =>
  (valor: string): T | null =>
    (lista as readonly string[]).includes(valor) ? (valor as T) : null;

/** T215 — o parâmetro da URL de cada grupo, na ordem em que é escrito. */
const PARAMETRO_DO_GRUPO: readonly (readonly [
  keyof FiltrosDaListagem,
  string,
])[] = [
  ["departamentos", "departamento"],
  ["areas", "area"],
  ["centrosCusto", "centro"],
  ["unidades", "unidade"],
  ["cargos", "cargo"],
  ["niveis", "nivel"],
  ["tipos", "tipo"],
  ["generos", "genero"],
];

/**
 * T199 — o estado do dashboard pedido pelo fragmento, ou `null` se ele não é a
 * rota da listagem. Valor inválido (aba desconhecida, página que não é inteiro
 * positivo, id que não é UUID, valor fora das listas fechadas) cai no padrão
 * seguro — nunca vira consulta. Qualquer outro parâmetro é ignorado,
 * inclusive uma busca colada na URL.
 */
export function listagemDaRota(fragmento: string): EstadoDaListagem | null {
  if (fragmento === ROTA_DA_LISTAGEM) return ESTADO_INICIAL_DA_LISTAGEM;
  if (!fragmento.startsWith(`${ROTA_DA_LISTAGEM}?`)) return null;
  const params = new URLSearchParams(
    fragmento.slice(ROTA_DA_LISTAGEM.length + 1),
  );
  const aba = params.get("aba") ?? "";
  const pagina = params.get("pagina") ?? "";
  const numero = /^[1-9][0-9]{0,5}$/.test(pagina) ? Number(pagina) : 1;
  const tamanho = params.get("tamanho") ?? "";
  return normalizarEstadoDaListagem({
    aba: (ABAS_DA_LISTAGEM as readonly string[]).includes(aba)
      ? (aba as AbaDaListagem)
      : ESTADO_INICIAL_DA_LISTAGEM.aba,
    pagina: numero <= PAGINA_MAXIMA ? numero : 1,
    tamanho:
      TAMANHOS_DE_PAGINA.find((n) => String(n) === tamanho) ??
      ESTADO_INICIAL_DA_LISTAGEM.tamanho,
    filtros: {
      departamentos: listaDaUrl(params, "departamento", idValido),
      areas: listaDaUrl(params, "area", idValido),
      centrosCusto: listaDaUrl(params, "centro", idValido),
      unidades: listaDaUrl(params, "unidade", idValido),
      cargos: listaDaUrl(params, "cargo", idValido),
      niveis: listaDaUrl(params, "nivel", daLista(NIVEIS_DE_CARREIRA)),
      tipos: listaDaUrl(params, "tipo", daLista(TIPOS_DE_VINCULO)),
      generos: listaDaUrl(params, "genero", daLista(GENEROS_DO_PERFIL)),
    },
  });
}

/**
 * T199 — o endereço do dashboard: só o que difere do padrão, sempre na mesma
 * ordem (o mesmo estado dá sempre a mesma URL). T215 — cada grupo da gaveta
 * em um parâmetro, valores separados por vírgula.
 */
export function rotaDaListagem(estado: EstadoDaListagem): string {
  const e = normalizarEstadoDaListagem(estado);
  const partes: string[] = [];
  if (e.aba !== ESTADO_INICIAL_DA_LISTAGEM.aba) partes.push(`aba=${e.aba}`);
  if (e.pagina > 1) partes.push(`pagina=${e.pagina}`);
  if (e.tamanho !== ESTADO_INICIAL_DA_LISTAGEM.tamanho)
    partes.push(`tamanho=${e.tamanho}`);
  // Os valores já são conferidos (UUID ou listas fechadas): a vírgula fica
  // legível, sem escape.
  for (const [grupo, nome] of PARAMETRO_DO_GRUPO) {
    const lista = e.filtros[grupo];
    if (lista.length > 0)
      partes.push(`${nome}=${lista.map(encodeURIComponent).join(",")}`);
  }
  return partes.length > 0
    ? `${ROTA_DA_LISTAGEM}?${partes.join("&")}`
    : ROTA_DA_LISTAGEM;
}

/**
 * T205 — o Dashboard inicial: a visão do ano, com o ano na URL
 * (`#/dashboard?ano=AAAA`, decisão D-3). O ano vale de `ANO_MINIMO_DO_DASHBOARD`
 * até o ano corrente do navegador; ausente, inválido ou futuro é corrigido no
 * lugar para o ano corrente (sem entrada nova no histórico). Qualquer outro
 * parâmetro é ignorado.
 */
const ROTA_DO_DASHBOARD = "#/dashboard";
export const ANO_MINIMO_DO_DASHBOARD = 2000;

/** T205 — o ano civil corrente, pelo relógio do navegador. */
export function anoCorrente(agora: Date = new Date()): number {
  return agora.getFullYear();
}

/** T205 — o ano está no intervalo consultável do Dashboard? */
export function anoDoDashboardValido(
  ano: number,
  agora: Date = new Date(),
): boolean {
  return (
    Number.isInteger(ano) &&
    ano >= ANO_MINIMO_DO_DASHBOARD &&
    ano <= anoCorrente(agora)
  );
}

/**
 * T207 — as abas do Dashboard (V-3, V-4). A Visão Geral fica na rota da T205
 * (`#/dashboard?ano=AAAA`); as demais levam o próprio caminho
 * (`#/dashboard/<aba>?ano=AAAA`). O ano é um só para todas as abas.
 */
export const ABAS_DO_DASHBOARD = [
  "visao-geral",
  "pessoas",
  "movimentacao",
  "remuneracao",
  "clima-e-saude",
] as const;
export type AbaDoDashboard = (typeof ABAS_DO_DASHBOARD)[number];
export const ABA_INICIAL_DO_DASHBOARD: AbaDoDashboard = "visao-geral";

/** Prefixos da rota do Dashboard: com consulta e com caminho de aba. */
const PREFIXO_DA_CONSULTA = ROTA_DO_DASHBOARD + "?";
const PREFIXO_DA_ABA = ROTA_DO_DASHBOARD + "/";

export function abaDoDashboardValida(valor: string): valor is AbaDoDashboard {
  return (ABAS_DO_DASHBOARD as readonly string[]).includes(valor);
}

/** T205/T207 — o que a rota do Dashboard pede: a aba e o ano. */
export interface RotaDoDashboard {
  readonly aba: AbaDoDashboard;
  readonly ano: number;
}

/**
 * T205 — o ano que a rota do Dashboard pede, ou `null` se o fragmento não é
 * a rota do Dashboard. Ano ausente, malformado, anterior ao mínimo ou futuro
 * vira o ano corrente (a URL é corrigida no lugar por quem exibe).
 * T207 — e a aba: caminho desconhecido vira a Visão Geral, também corrigido
 * no lugar. `#/dashboardx` não é a rota do Dashboard.
 */
export function dashboardDaRota(
  fragmento: string,
  agora: Date = new Date(),
): RotaDoDashboard | null {
  let resto: string;
  if (fragmento === ROTA_DO_DASHBOARD) {
    resto = "";
  } else if (
    fragmento.startsWith(PREFIXO_DA_CONSULTA) ||
    fragmento.startsWith(PREFIXO_DA_ABA)
  ) {
    resto = fragmento.slice(ROTA_DO_DASHBOARD.length);
  } else {
    return null;
  }
  let segmento = "";
  let consulta = "";
  if (resto.startsWith("/")) {
    const interrogacao = resto.indexOf("?");
    segmento = interrogacao < 0 ? resto.slice(1) : resto.slice(1, interrogacao);
    consulta = interrogacao < 0 ? "" : resto.slice(interrogacao + 1);
  } else if (resto.startsWith("?")) {
    consulta = resto.slice(1);
  }
  const texto = new URLSearchParams(consulta).get("ano") ?? "";
  const ano = /^[0-9]{4}$/.test(texto) ? Number(texto) : NaN;
  return {
    aba: abaDoDashboardValida(segmento) ? segmento : ABA_INICIAL_DO_DASHBOARD,
    ano: anoDoDashboardValido(ano, agora) ? ano : anoCorrente(agora),
  };
}

/**
 * T205 — o endereço do Dashboard: sempre com o ano, na forma canônica.
 * T207 — a Visão Geral sem caminho; as demais abas com o próprio.
 */
export function rotaDoDashboard(
  ano: number,
  aba: AbaDoDashboard = ABA_INICIAL_DO_DASHBOARD,
): string {
  return aba === ABA_INICIAL_DO_DASHBOARD
    ? `${ROTA_DO_DASHBOARD}?ano=${ano}`
    : `${ROTA_DO_DASHBOARD}/${aba}?ano=${ano}`;
}

/**
 * O destino que o fragmento pede, ou `null` se ele não é rota conhecida.
 * T198 — a ficha pertence ao destino `pessoas` (o mesmo contêiner, a mesma
 * capacidade por papel): quem abre Colaboradores abre a ficha.
 * T199 — o dashboard com estado na URL também.
 * T205 — o Dashboard inicial é o destino `dashboard`.
 */
export function destinoDaRota(fragmento: string): string | null {
  if (dashboardDaRota(fragmento) !== null) return "dashboard";
  if (fragmento === ROTA_DO_MODULO_CONFIGURACOES) return "configuracoes";
  const alternativa = ROTAS_ALTERNATIVAS[fragmento];
  if (alternativa) return alternativa;
  if (fichaDaRota(fragmento) !== null) return "pessoas";
  if (listagemDaRota(fragmento) !== null) return "pessoas";
  const entrada = Object.entries(ROTA_POR_DESTINO).find(
    ([, rota]) => rota === fragmento,
  );
  return entrada ? entrada[0] : null;
}

/**
 * T178 — o fragmento pertence ao espaço de rotas? Vazio também conta: é a URL
 * sem rota, para onde o "voltar" pode levar.
 *
 * Um fragmento comum (`#conteudo-principal`) é âncora dentro da página: o
 * navegador o põe na URL e dispara `hashchange`, mas ninguém pediu outro
 * destino. Tratá-lo como "URL sem rota" faria o link "Pular para o conteúdo"
 * tirar a pessoa da tela — e, com Colaboradores roteada, isso aconteceria na
 * tela mais usada do produto.
 */
export function ehFragmentoDeRota(fragmento: string): boolean {
  return fragmento === "" || fragmento === "#" || fragmento.startsWith("#/");
}

/**
 * T189 — para onde o shell volta depois de uma troca de empresa: o MESMO
 * módulo, na tela inicial segura dele.
 *
 * A troca recria a árvore inteira (T163), então a tela inicial do módulo já
 * vem limpa — sem busca, filtro, seleção nem ficha. O que sobra decidir é o
 * destino em si, e só uma página precisa ser reduzida: a Nova admissão é um
 * formulário dentro de Pessoas, e reabri-lo na empresa nova seria começar
 * um cadastro que ninguém pediu. Ela volta para a listagem de Colaboradores,
 * o nível do módulo.
 *
 * Não é autorização: o `App` ainda passa o destino por `resolverEntrada`, e
 * papel que não o abre cai no destino inicial dele.
 */
const DESTINO_SEGURO_APOS_TROCA: Readonly<Record<string, string>> = {
  "nova-admissao": "pessoas",
  // T209 (Bloco C) — a planilha conferida é da empresa anterior: descartada.
  "importar-colaboradores": "pessoas",
  // T215 — a política em edição é da empresa anterior: volta à lista.
  "politicas-ferias": "pessoas",
  // T209 — um CNPJ pela metade não segue para a empresa nova: volta à lista.
  "nova-empresa": "configuracoes-empresas",
};

export function destinoAposTrocaDeEmpresa(
  destinoId: string | null,
): string | null {
  if (destinoId === null) return null;
  return DESTINO_SEGURO_APOS_TROCA[destinoId] ?? destinoId;
}
