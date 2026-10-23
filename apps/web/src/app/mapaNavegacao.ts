/**
 * Mapa de navegação (T159) — fonte única dos módulos, destinos e estados.
 *
 * ## O problema que este módulo resolve
 *
 * Menu é promessa. Até a T158 a navegação listava, lado a lado e sem
 * distinção, destinos que gravam no servidor e superfícies que só desenham
 * dados de exemplo. Quem navegava não tinha como saber qual era qual — e a
 * matriz da T156 mediu a proporção: a maior parte das telas-folha é estática.
 *
 * A T159 não apaga nem altera nenhuma dessas telas. Ela separa as duas coisas
 * na **arquitetura de informação**: o que opera fica na navegação primária, o
 * que é maquete fica num grupo chamado **Demonstração**, nomeado como tal.
 *
 * ## O estado vem do código, não deste arquivo
 *
 * `funcional` aqui significa, literalmente: a tela importa um cliente de
 * `src/api/` e fala com o servidor. `demonstrativo` significa que a tela lê um
 * `*.fixtures` e não emite requisição nenhuma. A classificação foi derivada da
 * fonte, tela por tela, e os testes a prendem contra o próprio código — se uma
 * tela demonstrativa passar a falar com a API, ou o contrário, o teste quebra
 * antes de o menu mentir.
 *
 * ## O que este módulo NÃO é
 *
 * **Não é autorização.** `papeis` existe para não oferecer um destino que o
 * servidor recusaria — conveniência de interface, como a spec do painel fixou
 * em §3.6. Quem decide continua sendo o RBAC, a cada requisição. Esconder um
 * item não protege nada; mostrar um item que sempre dá 403 é que atrapalha.
 *
 * **Não é roteador.** Destino continua sendo estado do shell, como desde a
 * T044. As únicas exceções estão na tabela fechada de `rotasDoShell.ts`: a URL
 * própria de "Nova admissão" (T176) e a de "Colaboradores" (T178), a porta
 * principal de Gestão de Pessoas.
 */

import type { IconeModuloId } from "./IconeModulo";

/** Estado real de um destino, derivado da origem dos dados das suas telas. */
export type EstadoDestino = "funcional" | "demonstrativo";

export interface DestinoNavegacao {
  readonly id: string;
  readonly label: string;
  /** Sub-rótulo exibido junto ao destino, quando ajuda a situar. */
  readonly subRotulo?: string;
  readonly estado: EstadoDestino;
  /**
   * Papéis a que o servidor concede a capacidade deste destino. Ausente =
   * incondicional na interface (o servidor segue decidindo cada requisição).
   */
  readonly papeis?: readonly string[];
  /**
   * T178 — o destino é SUB-PÁGINA de outro (o id do pai). Continua no mapa —
   * com rota, capacidade, validação de entrada e cartão no Hub —, mas não
   * vira item da barra lateral: chega-se a ele pela ação na página do pai.
   * Enquanto ele está aberto, a barra marca o PAI como atual, para que quem
   * navega saiba em que área está.
   */
  readonly agrupadoEm?: string;
}

export interface GrupoNavegacao {
  readonly titulo: string;
  /** Explica o grupo para leitor de tela; obrigatório em Demonstração. */
  readonly descricao?: string;
  /**
   * Ícone do módulo na barra lateral. Desenho próprio (`IconeModulo.tsx`),
   * nunca conjunto de terceiro — ver
   * `docs/decisions/t159-direcao-visual-navegacao.md`.
   */
  readonly icone: IconeModuloId;
  /**
   * Grupo de segunda ordem: vai ao pé da barra, separado do que opera, com
   * tratamento visual mais discreto. Só Demonstração é secundário, e não por
   * estética: é a tradução visual de "isto não é capacidade disponível".
   */
  readonly secundario?: boolean;
  /**
   * T178 — mostra o cabeçalho do módulo mesmo com um único item na barra.
   *
   * A regra geral (`PainelNavigation`) funde módulo e destino quando há um só
   * item, porque ali os dois têm o mesmo nome ("Estrutura", "Jornada"). Em
   * Gestão de Pessoas não têm: o módulo é "Gestão de Pessoas" e a entrada é
   * "Colaboradores" — fundir apagaria o nome do módulo, que é o mesmo que a
   * trilha de navegação da página exibe.
   */
  readonly sempreComoModulo?: boolean;
  readonly destinos: readonly DestinoNavegacao[];
}

/**
 * Papéis a que o RBAC concede `gestor_equipe`/`read` — `gestor` consulta o
 * próprio escopo, `rh` confere o que configurou. Espelha `rbac.evaluator.ts`.
 */
export const PAPEIS_MINHA_EQUIPE: readonly string[] = ["gestor", "rh"];

/**
 * Papéis a que o RBAC concede `gestor_atribuicao` — só `rh`, na própria
 * empresa. `master_tecnico` é negado de propósito: não tem empresa, e toda
 * consulta ali parte da empresa do ator.
 */
export const PAPEIS_ADMINISTRACAO_LIDERANCA: readonly string[] = ["rh"];

/**
 * T176 — papéis a que o RBAC concede `colaborador`/`create`, a ação de
 * `POST /v1/colaboradores`: só `rh` e `dp`, na própria empresa. Espelha
 * `evaluatePessoas` em `rbac.evaluator.ts`, em que `master_tecnico` só lê.
 */
export const PAPEIS_NOVA_ADMISSAO: readonly string[] = ["rh", "dp"];

/**
 * T181 — papéis que EDITAM, na ficha do colaborador, dados pessoais, endereço
 * e contatos: só `rh` e `dp`, na empresa ativa (decisão da proprietária de
 * 2026-10-23). Espelha `evaluateDadosPessoais` e `evaluateContatos` em
 * `rbac.evaluator.ts`, em que o `master_tecnico` só lê. Os mesmos papéis
 * consultam o CEP (`colaborador`/`create`). Só ORIENTA a tela: quem recusa é
 * o servidor.
 */
export const PAPEIS_EDICAO_FICHA: readonly string[] = ["rh", "dp"];

export function podeEditarFicha(papel: string | null): boolean {
  return papel !== null && PAPEIS_EDICAO_FICHA.includes(papel);
}

/**
 * Os cinco módulos da navegação primária, mais Demonstração.
 *
 * A ordem é de uso: quem se opera no dia a dia vem antes do que se administra,
 * e o que é maquete vem por último, separado e nomeado.
 */
export const GRUPOS: readonly GrupoNavegacao[] = [
  {
    // T178 — "Gestão de Pessoas", com "Colaboradores" como porta principal:
    // é dali que se consulta quem já está na empresa e se inicia uma admissão.
    titulo: "Gestão de Pessoas",
    icone: "pessoas",
    sempreComoModulo: true,
    destinos: [
      {
        // O id continua `pessoas`: a aterrissagem por papel, o Hub, a
        // capacidade e a abertura da ficha do admitido dependem dele. Só o
        // rótulo mudou — o contêiner é o mesmo, aberto na aba Colaboradores.
        id: "pessoas",
        label: "Colaboradores",
        subRotulo: "Consulta, ficha e vida funcional",
        estado: "funcional",
      },
      {
        // T176 — página própria da admissão (decisão da proprietária sobre o
        // `DP-FLX-21`). Usa só o contrato atual de `POST /v1/colaboradores`.
        // T178 — sub-página de Colaboradores: sai da barra lateral (abre pela
        // ação "Nova admissão" da listagem) e, aberta, marca Colaboradores.
        id: "nova-admissao",
        label: "Nova admissão",
        subRotulo: "Página própria",
        estado: "funcional",
        papeis: PAPEIS_NOVA_ADMISSAO,
        agrupadoEm: "pessoas",
      },
    ],
  },
  {
    titulo: "Estrutura",
    icone: "estrutura",
    destinos: [
      {
        id: "cadastros",
        label: "Estrutura",
        subRotulo: "Horários",
        estado: "funcional",
      },
    ],
  },
  {
    titulo: "Jornada",
    icone: "jornada",
    destinos: [
      {
        id: "ponto",
        label: "Jornada",
        subRotulo: "Visão do período",
        estado: "funcional",
      },
    ],
  },
  {
    titulo: "Liderança",
    icone: "lideranca",
    destinos: [
      {
        id: "equipe",
        label: "Minha equipe",
        subRotulo: "Consulta do gestor",
        estado: "funcional",
        papeis: PAPEIS_MINHA_EQUIPE,
      },
      {
        id: "administracao-lideranca",
        label: "Administração da liderança",
        subRotulo: "Vínculos e equipes",
        estado: "funcional",
        papeis: PAPEIS_ADMINISTRACAO_LIDERANCA,
      },
    ],
  },
  {
    titulo: "Administração",
    icone: "administracao",
    destinos: [
      {
        id: "contas-acesso",
        label: "Contas de acesso",
        estado: "funcional",
      },
      // Auditoria NÃO entra aqui. A API existe (`GET /v1/audit`), mas não há
      // tela — e um item de menu sem tela é exatamente a promessa vazia que
      // esta tarefa existe para eliminar. Configurações idem: não há tela.
    ],
  },
  {
    titulo: "Demonstração",
    icone: "demonstracao",
    secundario: true,
    descricao:
      "Superfícies de exemplo. Nada aqui grava, consulta o servidor ou representa capacidade disponível.",
    destinos: [
      {
        id: "inicio",
        label: "Visão geral",
        estado: "demonstrativo",
      },
      // Rótulos próprios, não "Pessoas (demonstração)". Repetir o nome do
      // módulo funcional criaria dois itens cujo nome acessível começa igual,
      // e quem navega por leitor de tela ouviria "Pessoas" duas vezes antes de
      // chegar ao que os distingue.
      {
        id: "pessoas-demonstracao",
        label: "Benefícios e dependentes",
        subRotulo: "Inclui afastamentos",
        estado: "demonstrativo",
      },
      {
        id: "cadastros-demonstracao",
        label: "Catálogos de apoio",
        subRotulo: "Feriados, motivos, escolaridade",
        estado: "demonstrativo",
      },
      {
        id: "ponto-demonstracao",
        label: "Apuração e banco de horas",
        subRotulo: "Fechamento, escalas, inconsistências",
        estado: "demonstrativo",
      },
      {
        id: "documentos",
        label: "Documentos",
        subRotulo: "Metadados e repositório",
        estado: "demonstrativo",
      },
      {
        id: "solicitacoes-rh",
        label: "Central de solicitações",
        estado: "demonstrativo",
      },
      {
        id: "relatorios",
        label: "Relatórios",
        estado: "demonstrativo",
      },
      {
        id: "portal-colaborador",
        label: "Portal do Colaborador",
        estado: "demonstrativo",
      },
    ],
  },
];

/** Todos os destinos, achatados, na ordem em que aparecem. */
export const DESTINOS: readonly DestinoNavegacao[] = GRUPOS.flatMap(
  (g) => g.destinos,
);

export function destinoPorId(id: string): DestinoNavegacao | undefined {
  return DESTINOS.find((d) => d.id === id);
}

/** O destino é oferecido a este papel? Papel desconhecido vê só o incondicional. */
export function destinoVisivelPara(
  destino: DestinoNavegacao,
  papel: string | null,
): boolean {
  if (!destino.papeis) return true;
  return papel !== null && destino.papeis.includes(papel);
}

/**
 * T178 — o item da barra que representa o destino aberto: o próprio destino
 * ou, se ele é sub-página (`agrupadoEm`), o pai. É o que a barra marca como
 * atual — com Nova admissão aberta, "Colaboradores".
 */
export function itemDaBarraPara(destinoId: string): string {
  return destinoPorId(destinoId)?.agrupadoEm ?? destinoId;
}

/**
 * T178 — o título do módulo a que o destino pertence ("Gestão de Pessoas"),
 * para a trilha de navegação. Sai daqui, e não de um texto repetido na tela,
 * para que barra e trilha nunca digam nomes diferentes do mesmo módulo.
 */
export function tituloDoGrupoDe(destinoId: string): string | undefined {
  return GRUPOS.find((g) => g.destinos.some((d) => d.id === destinoId))?.titulo;
}

/**
 * Onde cada papel aterrissa.
 *
 * Tabela explícita, e não regra inferida, porque "o primeiro destino que o
 * papel vê" daria a resposta errada: os contêineres funcionais permanecem
 * incondicionais no menu — esconder `Pessoas` de quem pode usar uma aba dela
 * removeria acesso real —, então "primeiro visível" não é o mesmo que
 * "primeiro utilizável".
 *
 * Cada linha foi conferida em `rbac.evaluator.ts`, contra o recurso que a
 * **aba padrão** do destino consulta na primeira requisição:
 *
 * | Papel            | Aterrissa em | Por quê                                              |
 * | ---------------- | ------------ | ---------------------------------------------------- |
 * | `rh`             | `pessoas`    | lê `colaborador` na própria empresa                   |
 * | `dp`             | `pessoas`    | idem                                                  |
 * | `master_tecnico` | `pessoas`    | lê `colaborador` em escopo global                     |
 * | `gestor`         | `equipe`     | único destino funcional que o RBAC lhe concede        |
 * | demais           | `inicio`     | nenhuma capacidade funcional — e `inicio` não chama nada |
 *
 * **Isto corrige um defeito antigo sem inventar capacidade.** O padrão era
 * `cadastros` para todo mundo, cuja aba inicial consulta `tabela_horario` —
 * concedida só a `rh` e `master_tecnico`. Seis papéis abriam o produto numa
 * tela que respondia 403 na primeira requisição: a primeira impressão do
 * sistema era uma negação. `financeiro` é o caso menos óbvio e por isso vale
 * dizer: ele lê `centro_custo`, que é uma aba de Estrutura, mas **não** a aba
 * padrão — mandá-lo para lá continuaria produzindo 403 antes de ele trocar de
 * aba.
 *
 * `inicio` é demonstrativo e **não importa nenhum cliente de API**: aterrissar
 * ali não dispara requisição alguma, então não há como gerar 403.
 */
export const DESTINO_SEM_CAPACIDADE = "inicio";

const DESTINO_INICIAL_POR_PAPEL: Readonly<Record<string, string>> = {
  rh: "pessoas",
  dp: "pessoas",
  master_tecnico: "pessoas",
  gestor: "equipe",
};

export function destinoInicialPara(papel: string | null): string {
  if (papel === null) return DESTINO_SEM_CAPACIDADE;
  return DESTINO_INICIAL_POR_PAPEL[papel] ?? DESTINO_SEM_CAPACIDADE;
}

/**
 * Destinos **funcionais que o papel de fato consegue abrir** — a lista que o
 * Hub pós-login (T162) oferece.
 *
 * ## Por que não dá para reusar `destinoVisivelPara`
 *
 * São duas perguntas diferentes, e confundi-las produziria exatamente a
 * promessa vazia que a T159 eliminou da barra lateral.
 *
 * `destinoVisivelPara` responde "mostro este item no menu?". Os contêineres
 * funcionais — `pessoas`, `cadastros`, `ponto`, `contas-acesso` — não declaram
 * `papeis` de propósito: cada um reúne várias abas, e esconder o contêiner
 * inteiro de quem pode usar **uma** delas removeria acesso real. No menu isso
 * é correto; a aba é escolhida por quem navega.
 *
 * `capacidadeFuncionalDe` responde "ofereço este produto como um cartão?". Um
 * cartão não tem abas: ele leva ao destino, que abre na **aba padrão** e
 * dispara a primeira requisição dela. Oferecer um cartão que aterrissa num 403
 * é prometer capacidade que não existe — e num Hub, cuja única função é dizer
 * o que o acesso abre, a mentira é o conteúdo inteiro da tela.
 *
 * ## A tabela sai do avaliador, conferida recurso por recurso
 *
 * Mesma disciplina de `destinoInicialPara`, estendida a todos os destinos. Cada
 * linha foi lida em `rbac.evaluator.ts`, contra o recurso que a **aba padrão**
 * do destino consulta na primeira requisição:
 *
 * | Destino                   | Recurso da aba padrão   | Papéis concedidos                |
 * | ------------------------- | ----------------------- | -------------------------------- |
 * | `pessoas`                 | `colaborador` read      | `rh`, `dp`, `master_tecnico`     |
 * | `nova-admissao`           | `colaborador` create    | `rh`, `dp`                       |
 * | `cadastros`               | `tabela_horario` read   | `rh`, `master_tecnico`           |
 * | `ponto`                   | `evento_ponto` read     | `rh`, `dp`, `master_tecnico`     |
 * | `equipe`                  | `gestor_equipe` read    | `gestor`, `rh`                   |
 * | `administracao-lideranca` | `gestor_atribuicao`     | `rh`                             |
 * | `contas-acesso`           | `other_account` read    | `rh`, `dp`, `master_tecnico`     |
 *
 * Os dois casos que surpreendem, e por isso valem dito:
 *
 * - **`dp` não recebe `cadastros`.** `evaluateHorarios` concede `tabela_horario`
 *   só a `rh` e `master_tecnico` — a alçada de horários é exclusiva do RH desde
 *   a T037. `dp` lê a estrutura organizacional, que é **outra aba** do mesmo
 *   destino; como o cartão abre na aba padrão, oferecê-lo produziria 403 na
 *   primeira requisição. É a mesma razão pela qual `destinoInicialPara` não
 *   manda `financeiro` para lá.
 * - **`master_tecnico` não recebe `equipe` nem `administracao-lideranca`.**
 *   Ambos partem da empresa do ator, e `master_tecnico` não tem empresa. Já
 *   está registrado em `PAPEIS_MINHA_EQUIPE` e
 *   `PAPEIS_ADMINISTRACAO_LIDERANCA`.
 *
 * **Papel ausente da tabela recebe lista vazia** — negação por padrão, igual ao
 * avaliador. `financeiro` lê `centro_custo`, que é aba de Estrutura mas não a
 * padrão; `colaborador`, `auditor`, `dpo` e `admin_tecnico` não têm capacidade
 * funcional nenhuma hoje. Para todos eles o Hub diz isso, em vez de inventar um
 * produto.
 *
 * **Continua não sendo autorização.** O servidor decide cada requisição; esta
 * tabela só evita oferecer o que ele recusaria.
 */
const CAPACIDADE_FUNCIONAL_POR_PAPEL: Readonly<
  Record<string, readonly string[]>
> = {
  rh: [
    "pessoas",
    "nova-admissao",
    "cadastros",
    "ponto",
    "equipe",
    "administracao-lideranca",
    "contas-acesso",
  ],
  dp: ["pessoas", "nova-admissao", "ponto", "contas-acesso"],
  master_tecnico: ["pessoas", "cadastros", "ponto", "contas-acesso"],
  gestor: ["equipe"],
};

/**
 * Os destinos funcionais do papel, na ordem em que aparecem em `GRUPOS`.
 *
 * Filtra contra `DESTINOS` em vez de devolver os identificadores crus: um id
 * digitado errado, ou um destino removido do mapa, vira ausência silenciosa de
 * cartão — nunca um cartão que não leva a lugar nenhum.
 */
export function capacidadeFuncionalDe(
  papel: string | null,
): readonly DestinoNavegacao[] {
  if (papel === null) return [];
  const permitidos = CAPACIDADE_FUNCIONAL_POR_PAPEL[papel];
  if (permitidos === undefined) return [];
  return DESTINOS.filter(
    (d) => d.estado === "funcional" && permitidos.includes(d.id),
  );
}

/** Os destinos demonstrativos, na ordem do mapa. Iguais para todo papel. */
export const DESTINOS_DEMONSTRATIVOS: readonly DestinoNavegacao[] =
  DESTINOS.filter((d) => d.estado === "demonstrativo");
