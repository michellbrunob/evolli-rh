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
  // T182 — tela própria do catálogo de jornadas: recarregar volta a ela.
  "jornadas-trabalho": "#/estrutura/jornadas-trabalho",
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
 */
export const ABAS_DA_FICHA = [
  "dados",
  "vida-funcional",
  "contratuais",
  "jornada",
  "documentos",
] as const;
export type AbaDaFicha = (typeof ABAS_DA_FICHA)[number];

/** T198 — a ficha pedida pela URL: o colaborador e a aba. */
export interface RotaDaFicha {
  readonly colaboradorId: string;
  readonly aba: AbaDaFicha;
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
  if (partes.length > 2) return null;
  const [colaboradorId = "", aba = "dados"] = partes;
  if (!UUID.test(colaboradorId)) return null;
  if (!(ABAS_DA_FICHA as readonly string[]).includes(aba)) return null;
  return { colaboradorId, aba: aba as AbaDaFicha };
}

/** T198 — o endereço da ficha, sempre com a aba explícita. */
export function rotaDaFicha(ficha: RotaDaFicha): string {
  return `${PREFIXO_DA_FICHA}${ficha.colaboradorId}/${ficha.aba}`;
}

/**
 * T199 — as abas do dashboard de Colaboradores. Ativos é a inicial (N-6);
 * "jornada" mostra a visão de jornadas que já existia (N-4).
 */
export const ABAS_DA_LISTAGEM = [
  "ativos",
  "em-admissao",
  "desligados",
  "todos",
  "jornada",
] as const;
export type AbaDaListagem = (typeof ABAS_DA_LISTAGEM)[number];

/**
 * T199 — os tipos de vínculo controlados. Aqui, e não importados do cliente da
 * API, porque os testes automockam aquele módulo (e listas viram vazias).
 */
export const TIPOS_DE_VINCULO = [
  "clt",
  "estagio",
  "pj",
  "temporario",
  "outro_controlado",
] as const;
export type TipoDeVinculo = (typeof TIPOS_DE_VINCULO)[number];

/**
 * T199 — o que o dashboard guarda na URL (D-3): aba, página e os ids dos
 * filtros. **Nunca o texto da busca**, que pode ser nome ou matrícula — dado
 * pessoal não vai para a URL, o histórico ou o servidor de log.
 */
export interface EstadoDaListagem {
  readonly aba: AbaDaListagem;
  readonly pagina: number;
  readonly departamentoId: string | null;
  readonly cargoId: string | null;
  readonly tipo: TipoDeVinculo | null;
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
  departamentoId: null,
  cargoId: null,
  tipo: null,
};

const ROTA_DA_LISTAGEM = "#/pessoas/colaboradores";
const PAGINA_MAXIMA = 100_000;

/**
 * T199 — abas com filtro de lotação: a lotação vigente só existe em vínculo
 * ATIVO (T184, T190), então Departamento e Cargo nunca casariam em "Em
 * admissão" nem em "Desligados".
 */
export function abaTemLotacao(aba: AbaDaListagem): boolean {
  return aba === "ativos" || aba === "todos";
}

/**
 * T199 — o estado coerente com a aba: lotação só onde ela existe; a aba de
 * jornada (outra visão, com paginação e filtros próprios) não leva página,
 * lotação nem tipo.
 */
export function normalizarEstadoDaListagem(
  estado: EstadoDaListagem,
): EstadoDaListagem {
  if (estado.aba === "jornada") {
    return { ...ESTADO_INICIAL_DA_LISTAGEM, aba: "jornada" };
  }
  return abaTemLotacao(estado.aba)
    ? estado
    : { ...estado, departamentoId: null, cargoId: null };
}

/**
 * T199 — o estado do dashboard pedido pelo fragmento, ou `null` se ele não é a
 * rota da listagem. Valor inválido (aba desconhecida, página que não é inteiro
 * positivo, id que não é UUID, tipo fora dos controlados) cai no padrão seguro
 * — nunca vira consulta. Qualquer outro parâmetro é ignorado, inclusive uma
 * busca colada na URL.
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
  const uuid = (valor: string | null) =>
    valor !== null && UUID.test(valor) ? valor.toLowerCase() : null;
  const tipo = params.get("tipo") ?? "";
  return normalizarEstadoDaListagem({
    aba: (ABAS_DA_LISTAGEM as readonly string[]).includes(aba)
      ? (aba as AbaDaListagem)
      : ESTADO_INICIAL_DA_LISTAGEM.aba,
    pagina: numero <= PAGINA_MAXIMA ? numero : 1,
    departamentoId: uuid(params.get("departamento")),
    cargoId: uuid(params.get("cargo")),
    tipo: (TIPOS_DE_VINCULO as readonly string[]).includes(tipo)
      ? (tipo as TipoDeVinculo)
      : null,
  });
}

/**
 * T199 — o endereço do dashboard: só o que difere do padrão, sempre na mesma
 * ordem (o mesmo estado dá sempre a mesma URL).
 */
export function rotaDaListagem(estado: EstadoDaListagem): string {
  const e = normalizarEstadoDaListagem(estado);
  const params = new URLSearchParams();
  if (e.aba !== ESTADO_INICIAL_DA_LISTAGEM.aba) params.set("aba", e.aba);
  if (e.pagina > 1) params.set("pagina", String(e.pagina));
  if (e.departamentoId) params.set("departamento", e.departamentoId);
  if (e.cargoId) params.set("cargo", e.cargoId);
  if (e.tipo) params.set("tipo", e.tipo);
  const qs = params.toString();
  return qs ? `${ROTA_DA_LISTAGEM}?${qs}` : ROTA_DA_LISTAGEM;
}

/**
 * O destino que o fragmento pede, ou `null` se ele não é rota conhecida.
 * T198 — a ficha pertence ao destino `pessoas` (o mesmo contêiner, a mesma
 * capacidade por papel): quem abre Colaboradores abre a ficha.
 * T199 — o dashboard com estado na URL também.
 */
export function destinoDaRota(fragmento: string): string | null {
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
};

export function destinoAposTrocaDeEmpresa(
  destinoId: string | null,
): string | null {
  if (destinoId === null) return null;
  return DESTINO_SEGURO_APOS_TROCA[destinoId] ?? destinoId;
}
