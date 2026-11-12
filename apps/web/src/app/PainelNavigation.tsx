/**
 * PainelNavigation (T044; reorganizada e recomposta visualmente na T159).
 *
 * ## O que esta navegação afirma
 *
 * Cada item é uma promessa. Os cinco módulos operacionais afirmam capacidade
 * real; o grupo **Demonstração**, ao pé da barra, afirma o contrário — e diz
 * isso em texto, não só em estilo. Nenhum item existe aqui sem tela.
 *
 * ## Estrutura
 *
 * Uma lista de módulos. O módulo com **um** destino é o próprio botão de
 * destino; o módulo com **mais de um** vira um "disclosure" — cabeçalho com
 * `aria-expanded`/`aria-controls` e submenu em `<ul hidden>` quando fechado,
 * que é o que tira os itens da ordem de tabulação e da árvore de
 * acessibilidade de uma vez só.
 *
 * O destino ativo **nunca** depende só de cor: soma `aria-current="page"`
 * (semântica), peso de fonte (tipografia), superfície (fundo) e uma barra
 * indicadora (forma) — o mesmo princípio do `StatusBadge`.
 *
 * ## O que continua não sendo
 *
 * Não é rota: não há `history` nem `<a href>` aqui — destino é estado do
 * shell, como desde a T044. As poucas URLs próprias (Colaboradores e Nova
 * admissão, `rotasDoShell.ts`) são escritas pelo `App` a partir do destino
 * selecionado, nunca por esta barra. E não é autorização: `papeis` evita
 * oferecer uma porta que o servidor recusaria (spec §3.6), mas quem decide é
 * o RBAC, a cada requisição.
 *
 * ## Trilho recolhido (T206)
 *
 * Com `recolhido`, os MESMOS botões viram um trilho de ícones: o texto de cada
 * um continua no DOM, só visualmente oculto, e segue sendo o nome acessível —
 * a dica visual (`data-dica`, lida por `DicaDoTrilho`) repete esse nome para
 * quem enxerga, sem substituí-lo.
 *
 * Nenhum submenu é escondido de vez. Um módulo com submenu, no trilho, não
 * abre um painel flutuante: o cabeçalho dele expande o menu e abre o módulo,
 * e o foco fica no próprio cabeçalho — agora com o submenu à vista logo
 * abaixo. Por isso `aria-expanded` continua verdadeiro: o botão anuncia
 * "recolhido" e, ao ser acionado, revela exatamente a região que controla.
 */
import { useState } from "react";
import "./PainelNavigation.css";

import { IconeModulo } from "./IconeModulo";
import {
  DESTINOS,
  GRUPOS,
  destinoVisivelPara,
  itemDaBarraPara,
  type DestinoNavegacao,
  type GrupoNavegacao,
} from "./mapaNavegacao";

/**
 * T159 — os destinos e os grupos deixam de ser declarados aqui.
 *
 * A fonte única passou a ser `mapaNavegacao.ts`, porque a mesma informação era
 * precisa em três lugares (lista, sub-rótulo e agrupamento) e já tinha
 * divergido entre eles. Reexportado para não quebrar quem importava daqui.
 */
export type DestinoPainel = DestinoNavegacao;
export const DESTINOS_PAINEL = DESTINOS;

export interface PainelNavigationProps {
  destinoAtivoId: string;
  onSelecionar: (id: string) => void;
  /**
   * Papel que o SERVIDOR informou. Decide quais destinos condicionados a uma
   * capacidade aparecem — `null` enquanto não se sabe, que é o padrão seguro:
   * na dúvida não se oferece.
   *
   * Isto é conveniência de interface, nunca autorização (spec §3.6). Esconder
   * um item não protege nada; o RBAC decide cada requisição. O que se evita é
   * oferecer um caminho que sempre responderia 403.
   */
  papel?: string | null;
  /**
   * T206 — trilho de ícones. Os submenus ficam fechados (fora da tabulação e
   * da árvore de acessibilidade), e o cabeçalho de cada módulo passa a pedir
   * espaço ao shell por `onExpandir` em vez de abrir no lugar.
   */
  recolhido?: boolean;
  /** T206 — pedido ao shell para sair do trilho. */
  onExpandir?: () => void;
}

/** Id da `<nav>`: alvo do `aria-controls` do botão de recolher do shell. */
export const ID_NAVEGACAO_PAINEL = "navegacao-painel";

/** Seta do disclosure. Desenho próprio, elementar; gira por CSS ao abrir. */
function SetaExpansao() {
  return (
    <svg
      className="painel-nav__seta"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m5.5 3.5 5 4.5-5 4.5" />
    </svg>
  );
}

interface BotaoDestinoProps {
  readonly destino: DestinoNavegacao;
  readonly ativo: boolean;
  readonly nivel: "modulo" | "sub";
  readonly icone?: GrupoNavegacao["icone"];
  readonly onSelecionar: (id: string) => void;
  /** T206 — no trilho, o nome repetido na dica visual. */
  readonly dica?: string;
}

function BotaoDestino({
  destino,
  ativo,
  nivel,
  icone,
  onSelecionar,
  dica,
}: BotaoDestinoProps) {
  return (
    <button
      type="button"
      className={[
        "painel-nav__destino",
        `painel-nav__destino--${nivel}`,
        ativo ? "painel-nav__destino--ativo" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-current={ativo ? "page" : undefined}
      {...(dica ? { "data-dica": dica } : {})}
      onClick={() => onSelecionar(destino.id)}
    >
      {icone ? <IconeModulo nome={icone} /> : null}
      <span className="painel-nav__texto">
        <span className="painel-nav__rotulo">{destino.label}</span>
        {destino.subRotulo ? (
          <span className="painel-nav__sub"> {destino.subRotulo}</span>
        ) : null}
      </span>
    </button>
  );
}

interface ModuloProps {
  readonly grupo: GrupoNavegacao;
  readonly visiveis: readonly DestinoNavegacao[];
  readonly destinoAtivoId: string;
  readonly aberto: boolean;
  readonly onAlternar: () => void;
  readonly onSelecionar: (id: string) => void;
  /** T206 — trilho: a região fica fechada e o cabeçalho pede espaço. */
  readonly recolhido: boolean;
  readonly onAbrirNoMenuExpandido: () => void;
}

function Modulo({
  grupo,
  visiveis,
  destinoAtivoId,
  aberto,
  onAlternar,
  onSelecionar,
  recolhido,
  onAbrirNoMenuExpandido,
}: ModuloProps) {
  // T178 — espaços viram hífen: "Gestão de Pessoas" foi o primeiro título com
  // espaço, e `aria-labelledby`/`aria-controls` leem espaço como SEPARADOR de
  // ids — o submenu passaria a apontar para três ids inexistentes.
  const tituloId = `nav-grupo-${grupo.titulo.replace(/\s+/g, "-")}`;
  // O que o cabeçalho controla é a REGIÃO inteira — aviso e lista —, não só a
  // lista. Com o módulo fechado não pode sobrar um parágrafo anunciando um
  // grupo que não está à vista (R4).
  const regiaoId = `${tituloId}-conteudo`;
  const descricaoId = grupo.descricao ? `${tituloId}-descricao` : undefined;
  const contemAtivo = visiveis.some((d) => d.id === destinoAtivoId);
  // T206 — no trilho nenhuma região fica à vista: o destino ativo, se está
  // dentro dela, sobe para o cabeçalho — visualmente E na semântica, porque o
  // botão marcado com `aria-current="page"` está oculto.
  const regiaoVisivel = aberto && !recolhido;
  const ativoNoCabecalho = contemAtivo && !regiaoVisivel;

  // Módulo de um destino só: o item É o destino. Um cabeçalho que expandisse
  // para revelar exatamente um filho seria um clique sem informação — e dois
  // nomes acessíveis quase iguais para a mesma coisa. T178: a exceção é o
  // módulo cujo nome difere do destino (`sempreComoModulo`, Gestão de Pessoas
  // → Colaboradores) — fundir os dois apagaria o nome do módulo.
  if (visiveis.length === 1 && !grupo.sempreComoModulo) {
    const unico = visiveis[0]!;
    return (
      <li className="painel-nav__modulo">
        <BotaoDestino
          destino={unico}
          ativo={unico.id === destinoAtivoId}
          nivel="modulo"
          icone={grupo.icone}
          onSelecionar={onSelecionar}
          {...(recolhido ? { dica: unico.label } : {})}
        />
      </li>
    );
  }

  return (
    <li className="painel-nav__modulo">
      <button
        type="button"
        id={tituloId}
        className={[
          "painel-nav__cabecalho",
          ativoNoCabecalho ? "painel-nav__cabecalho--contem-ativo" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={regiaoVisivel}
        aria-controls={regiaoId}
        aria-current={ativoNoCabecalho ? "true" : undefined}
        {...(recolhido ? { "data-dica": grupo.titulo } : {})}
        onClick={recolhido ? onAbrirNoMenuExpandido : onAlternar}
      >
        <IconeModulo nome={grupo.icone} />
        <span className="painel-nav__texto">
          <span className="painel-nav__rotulo">{grupo.titulo}</span>
        </span>
        <SetaExpansao />
      </button>

      <div className="painel-nav__regiao" id={regiaoId} hidden={!regiaoVisivel}>
        {grupo.descricao ? (
          <p className="painel-nav__descricao" id={descricaoId}>
            {grupo.descricao}
          </p>
        ) : null}

        <ul
          className="painel-nav__submenu"
          aria-labelledby={tituloId}
          {...(descricaoId ? { "aria-describedby": descricaoId } : {})}
        >
          {visiveis.map((destino) => (
            <li className="painel-nav__item" key={destino.id}>
              <BotaoDestino
                destino={destino}
                ativo={destino.id === destinoAtivoId}
                nivel="sub"
                onSelecionar={onSelecionar}
              />
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export function PainelNavigation({
  destinoAtivoId,
  onSelecionar,
  papel = null,
  recolhido = false,
  onExpandir,
}: PainelNavigationProps) {
  // Só o que a pessoa fechou à mão entra aqui. Tudo começa aberto, inclusive
  // Demonstração: escondê-la por padrão a tornaria difícil de alcançar, e o
  // que a faz secundária é a posição, o tratamento visual e o aviso — não
  // sumir com ela.
  const [fechados, setFechados] = useState<Readonly<Record<string, boolean>>>(
    {},
  );

  // T178 — com uma sub-página aberta (Nova admissão), o item marcado é o do
  // pai (Colaboradores): `aria-current` e destaque visual seguem a área.
  const itemAtivo = itemDaBarraPara(destinoAtivoId);

  const grupos = GRUPOS.map((grupo) => ({
    grupo,
    // T178 — sub-página (`agrupadoEm`) não é item da barra: chega-se a ela
    // pela página do pai, e o pai fica marcado enquanto ela está aberta.
    visiveis: grupo.destinos.filter(
      (d) => !d.agrupadoEm && destinoVisivelPara(d, papel),
    ),
  })).filter(({ visiveis }) => visiveis.length > 0);

  const renderizar = ({
    grupo,
    visiveis,
  }: {
    grupo: GrupoNavegacao;
    visiveis: readonly DestinoNavegacao[];
  }) => (
    <Modulo
      key={grupo.titulo}
      grupo={grupo}
      visiveis={visiveis}
      destinoAtivoId={itemAtivo}
      aberto={!fechados[grupo.titulo]}
      onAlternar={() =>
        setFechados((atual) => ({
          ...atual,
          [grupo.titulo]: !atual[grupo.titulo],
        }))
      }
      onSelecionar={onSelecionar}
      recolhido={recolhido}
      onAbrirNoMenuExpandido={() => {
        // Abre o módulo E sai do trilho no mesmo desenho: o foco, que está
        // no cabeçalho, termina sobre um submenu já visível.
        setFechados((atual) => ({ ...atual, [grupo.titulo]: false }));
        onExpandir?.();
      }}
    />
  );

  const principais = grupos.filter(
    ({ grupo }) => !grupo.secundario && !grupo.daConta,
  );
  // T208 — a própria conta (Configurações): lista própria, separada dos
  // módulos de trabalho, antes de Demonstração.
  const daConta = grupos.filter(({ grupo }) => grupo.daConta);
  const secundarios = grupos.filter(({ grupo }) => grupo.secundario);

  return (
    <nav
      id={ID_NAVEGACAO_PAINEL}
      className={recolhido ? "painel-nav painel-nav--trilho" : "painel-nav"}
      aria-label="Navegação do painel"
    >
      <ul className="painel-nav__modulos">{principais.map(renderizar)}</ul>

      {daConta.length > 0 ? (
        <ul className="painel-nav__modulos painel-nav__modulos--conta">
          {daConta.map(renderizar)}
        </ul>
      ) : null}

      {secundarios.length > 0 ? (
        <ul className="painel-nav__modulos painel-nav__modulos--secundario">
          {secundarios.map(renderizar)}
        </ul>
      ) : null}
    </nav>
  );
}
