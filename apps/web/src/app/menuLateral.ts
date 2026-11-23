/**
 * T209 — a disposição do menu lateral completo: seções, ordem, rodapé e os
 * recursos que ainda não existem.
 *
 * ## Duas fontes, dois papéis
 *
 * `mapaNavegacao.ts` continua sendo a fonte dos DESTINOS — o que tem tela,
 * rota, capacidade, cartão no Hub e permissão. Este arquivo só decide ONDE
 * cada módulo aparece na barra e acrescenta os itens **em desenvolvimento**.
 *
 * ## Itens em desenvolvimento não são destinos
 *
 * Eles não entram em `DESTINOS`, não têm rota, não aparecem no Hub e não
 * trocam de tela: acioná-los abre só um aviso dizendo que a funcionalidade
 * ainda não está disponível. Não há promessa de data nem de caminho. Quando
 * um deles ganhar tela, ele sai daqui e vira destino no mapa, com o RBAC e
 * a rota de sempre.
 *
 * ## Densidade
 *
 * Um item por linha: o sub-rótulo dos destinos vira a dica (e segue no nome
 * acessível); o estado "Em desenvolvimento" vira uma marca compacta na mesma
 * linha (e segue no nome e na descrição). Recrutamento começa fechado.
 *
 * ## T211 — organização
 *
 * Colaboradores reúne Escala de trabalho e Organograma (destinos do grupo
 * Gestão de Pessoas); Liderança é item direto de Pessoas. T215 — Segurança
 * (Sessões ativas e Permissões de acesso) é módulo próprio no rodapé, logo
 * acima de Roadmap. Ponto, Administração da liderança e as
 * telas de Demonstração não estão no menu: as duas primeiras abrem pela URL
 * própria.
 *
 * ## Permissões
 *
 * Os módulos funcionais seguem o filtro por papel do mapa (`papeis`), sem
 * nenhuma ampliação. Os itens em desenvolvimento aparecem para todos porque
 * não abrem nada.
 */
import {
  IconeBeneficios,
  IconeCalendario,
  IconeFolha,
  IconeHubBeneficios,
  IconePesquisas,
  IconePortal,
  IconeRecrutamento,
  IconeRoadmap,
  IconeSuporte,
  type IconeDoEcossistema,
} from "../ui/icones";

/**
 * T211 — quem vê, no menu, as entradas da operação de pessoas (Colaboradores
 * e os itens em desenvolvimento de Pessoas e Remuneração): os papéis que
 * abrem Colaboradores pela tabela de capacidade (`capacidadeFuncionalDe`).
 * É só disposição do menu — não é autorização: o servidor decide cada
 * requisição, e o shell continua recusando o destino que o papel não abre.
 */
export const PAPEIS_OPERACAO_DE_PESSOAS: readonly string[] = [
  "rh",
  "dp",
  "master_tecnico",
];

/** O texto da dica e do aviso de todo item em desenvolvimento. */
export const MENSAGEM_EM_DESENVOLVIMENTO =
  "Em desenvolvimento. Esta funcionalidade ainda não está disponível.";

/** Selo curto ao lado do nome (não muda o estado do item). */
export type SeloDoMenu = "Beta" | "Novo";

export interface SubitemEmDesenvolvimento {
  readonly id: string;
  readonly rotulo: string;
}

/** Item que ainda não existe: aparece desabilitado e só abre o aviso. */
export interface EntradaEmDesenvolvimento {
  readonly tipo: "em-desenvolvimento";
  readonly id: string;
  readonly rotulo: string;
  readonly icone: IconeDoEcossistema;
  readonly selo?: SeloDoMenu;
  /** T211 — papéis que veem a entrada no menu; ausente = todos. */
  readonly papeis?: readonly string[];
  /**
   * Conteúdo futuro: o item vira um cabeçalho expansível, e cada subitem
   * também está em desenvolvimento.
   */
  readonly subitens?: readonly SubitemEmDesenvolvimento[];
}

/** Um módulo do mapa (`GRUPOS`), pelo título, na posição desta seção. */
export interface EntradaDeModulo {
  readonly tipo: "modulo";
  /** `titulo` do grupo em `mapaNavegacao.ts`. */
  readonly grupo: string;
  /** Nome na barra, quando difere do título do grupo (a trilha usa o título). */
  readonly rotulo?: string;
  /** T211 — papéis que veem a entrada no menu; ausente = todos. */
  readonly papeis?: readonly string[];
  /** Subitens em desenvolvimento acrescentados ao fim do submenu do módulo. */
  readonly subitensEmDesenvolvimento?: readonly SubitemEmDesenvolvimento[];
  /**
   * Começa fechado — salvo quando a tela aberta está dentro dele: o item
   * atual nunca fica escondido.
   */
  readonly fechadoPorPadrao?: boolean;
}

export type EntradaDoMenu = EntradaEmDesenvolvimento | EntradaDeModulo;

export interface SecaoDoMenu {
  readonly id: string;
  /** Título visível da seção; sem título, a seção é só um agrupamento. */
  readonly titulo?: string;
  /**
   * `principal`: o trabalho do dia a dia; `secundario`: Demonstração,
   * discreta; `rodape`: utilidades e a própria conta, presas ao pé da faixa.
   */
  readonly lugar: "principal" | "secundario" | "rodape";
  /**
   * O título vira um botão que abre e fecha a seção, que começa fechada —
   * salvo quando a tela aberta está nela. No trilho recolhido a seção fica
   * sempre à vista (o título, ali, nem aparece).
   */
  readonly recolhivel?: boolean;
  readonly entradas: readonly EntradaDoMenu[];
}

export const MENU_LATERAL: readonly SecaoDoMenu[] = [
  {
    id: "inicio",
    lugar: "principal",
    entradas: [
      { tipo: "modulo", grupo: "Dashboard" },
      {
        tipo: "em-desenvolvimento",
        id: "portal",
        rotulo: "Portal",
        icone: IconePortal,
        selo: "Beta",
      },
    ],
  },
  {
    id: "pessoas",
    titulo: "Pessoas",
    lugar: "principal",
    entradas: [
      {
        // O grupo continua "Gestão de Pessoas" (trilha da página e Hub); na
        // barra, o módulo se chama pela porta principal.
        tipo: "modulo",
        grupo: "Gestão de Pessoas",
        rotulo: "Colaboradores",
        papeis: PAPEIS_OPERACAO_DE_PESSOAS,
        subitensEmDesenvolvimento: [
          { id: "desenvolvimento", rotulo: "Desenvolvimento" },
        ],
      },
      {
        tipo: "em-desenvolvimento",
        id: "recrutamento",
        rotulo: "Recrutamento",
        icone: IconeRecrutamento,
        papeis: PAPEIS_OPERACAO_DE_PESSOAS,
        subitens: [
          { id: "vagas", rotulo: "Vagas" },
          { id: "banco-de-talentos", rotulo: "Banco de talentos" },
        ],
      },
      {
        tipo: "em-desenvolvimento",
        id: "pesquisas",
        rotulo: "Pesquisas",
        icone: IconePesquisas,
        papeis: PAPEIS_OPERACAO_DE_PESSOAS,
      },
      {
        tipo: "em-desenvolvimento",
        id: "calendario",
        rotulo: "Calendário",
        icone: IconeCalendario,
        papeis: PAPEIS_OPERACAO_DE_PESSOAS,
      },
      {
        // T211 — item direto, como Folha de Pagamento e Benefícios: abre
        // Minha equipe (a Administração da liderança fica fora do menu).
        tipo: "modulo",
        grupo: "Liderança",
        rotulo: "Liderança",
      },
    ],
  },
  {
    id: "remuneracao",
    titulo: "Remuneração",
    lugar: "principal",
    entradas: [
      {
        tipo: "em-desenvolvimento",
        id: "folha-de-pagamento",
        rotulo: "Folha de Pagamento",
        icone: IconeFolha,
        papeis: PAPEIS_OPERACAO_DE_PESSOAS,
      },
      {
        tipo: "em-desenvolvimento",
        id: "beneficios",
        rotulo: "Benefícios",
        icone: IconeBeneficios,
        papeis: PAPEIS_OPERACAO_DE_PESSOAS,
      },
      {
        tipo: "em-desenvolvimento",
        id: "hub-de-beneficios",
        rotulo: "Hub de Benefícios",
        icone: IconeHubBeneficios,
        papeis: PAPEIS_OPERACAO_DE_PESSOAS,
        selo: "Novo",
      },
    ],
  },
  {
    id: "rodape",
    lugar: "rodape",
    entradas: [
      {
        tipo: "em-desenvolvimento",
        id: "suporte",
        rotulo: "Suporte",
        icone: IconeSuporte,
      },
      // T215 — Segurança, logo acima de Roadmap.
      { tipo: "modulo", grupo: "Segurança" },
      {
        tipo: "em-desenvolvimento",
        id: "roadmap",
        rotulo: "Roadmap",
        icone: IconeRoadmap,
      },
      { tipo: "modulo", grupo: "Configurações" },
    ],
  },
];

/** Todo item e subitem em desenvolvimento, achatados (para contratos). */
export function entradasEmDesenvolvimento(): readonly SubitemEmDesenvolvimento[] {
  return MENU_LATERAL.flatMap((secao) =>
    secao.entradas.flatMap((entrada) =>
      entrada.tipo === "em-desenvolvimento"
        ? [
            { id: entrada.id, rotulo: entrada.rotulo },
            ...(entrada.subitens ?? []),
          ]
        : [...(entrada.subitensEmDesenvolvimento ?? [])],
    ),
  );
}
