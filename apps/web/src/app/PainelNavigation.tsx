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
 *
 * ## Menu completo (T209)
 *
 * A ordem, as seções ("Pessoas", "Remuneração", "Operação"), o rodapé e os
 * itens em desenvolvimento vêm de `menuLateral.ts`; os destinos, de
 * `mapaNavegacao.ts`. Item em desenvolvimento é um `<button>` com
 * `aria-disabled`, nome, estado em texto e a explicação como descrição;
 * acioná-lo abre um aviso pequeno e não modal — nunca muda a URL nem a tela.
 *
 * Um item por linha: o sub-rótulo vai para a dica e o estado vira uma marca
 * compacta (ambos seguem no nome acessível). Recrutamento, a seção Operação
 * e Demonstração começam fechados, salvo quando a tela aberta está neles.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconeRelogio, type IconeDoEcossistema } from "../ui/icones";
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
import {
  MENSAGEM_EM_DESENVOLVIMENTO,
  MENU_LATERAL,
  type EntradaEmDesenvolvimento,
  type SeloDoMenu,
  type SecaoDoMenu,
  type SubitemEmDesenvolvimento,
} from "./menuLateral";

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

/** T209 — id do texto que descreve todo item em desenvolvimento. */
const ID_EXPLICACAO_EM_DESENVOLVIMENTO = "painel-nav-em-desenvolvimento";

/**
 * T209 — atributo do aviso: a gaveta do celular o reconhece para deixar o
 * `Escape` fechar só o aviso, e não a gaveta inteira.
 */
export const ATRIBUTO_AVISO_EM_DESENVOLVIMENTO =
  "data-aviso-em-desenvolvimento";

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

/** T209 — ícone de um item do menu (Iconsax Bulk), na moldura dos demais. */
function IconeDoMenu({ icone: Icone }: { readonly icone: IconeDoEcossistema }) {
  return <Icone className="painel-nav__icone" tamanho={20} />;
}

function Selo({ texto }: { readonly texto: SeloDoMenu }) {
  return (
    <span className="painel-nav__selo" data-selo={texto.toLowerCase()}>
      {" "}
      {texto}
    </span>
  );
}

/**
 * O estado de um item em desenvolvimento: no nome acessível, em texto (fora
 * de vista, para o item caber numa linha).
 */
function EstadoEmDesenvolvimento() {
  return (
    <span className="painel-nav__estado painel-nav__oculto">
      {" "}
      Em desenvolvimento
    </span>
  );
}

/**
 * A marca visual compacta do estado, ao fim da linha. Decorativa para o
 * leitor de tela, que já ouve o estado no nome e a explicação na descrição;
 * quem enxerga lê a explicação na dica (ponteiro ou foco) e no aviso.
 */
function MarcaEmDesenvolvimento() {
  return (
    <IconeRelogio
      className="painel-nav__marca-em-desenvolvimento"
      tamanho={14}
    />
  );
}

interface BotaoDestinoProps {
  readonly destino: DestinoNavegacao;
  readonly ativo: boolean;
  readonly nivel: "modulo" | "sub";
  readonly icone?: GrupoNavegacao["icone"];
  readonly onSelecionar: (id: string) => void;
  /**
   * T206 — no trilho, o nome repetido na dica visual. T209 — sem ela, a dica
   * é o sub-rótulo, que saiu de vista para o item caber numa linha.
   */
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
  const textoDaDica = dica ?? destino.subRotulo;
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
      {...(textoDaDica ? { "data-dica": textoDaDica } : {})}
      onClick={() => onSelecionar(destino.id)}
    >
      {icone ? <IconeModulo nome={icone} /> : null}
      <span className="painel-nav__texto">
        <span className="painel-nav__rotulo">{destino.label}</span>
        {destino.subRotulo ? (
          <span className="painel-nav__sub painel-nav__oculto">
            {" "}
            {destino.subRotulo}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** Quem abre o aviso: o botão (para devolver o foco) e o nome do item. */
type PedirAviso = (alvo: HTMLElement, rotulo: string) => void;

interface BotaoEmDesenvolvimentoProps {
  readonly rotulo: string;
  readonly nivel: "modulo" | "sub";
  readonly icone?: IconeDoEcossistema;
  readonly selo?: SeloDoMenu;
  readonly recolhido: boolean;
  readonly onAvisar: PedirAviso;
}

/**
 * T209 — item que ainda não existe. É um `<button>` de verdade (focável, com
 * nome e descrição), marcado `aria-disabled`: não navega, não troca de tela e
 * não escreve na URL. Acioná-lo — clique, Enter ou Espaço — abre o aviso.
 */
function BotaoEmDesenvolvimento({
  rotulo,
  nivel,
  icone,
  selo,
  recolhido,
  onAvisar,
}: BotaoEmDesenvolvimentoProps) {
  return (
    <button
      type="button"
      className={[
        "painel-nav__destino",
        `painel-nav__destino--${nivel}`,
        "painel-nav__destino--em-desenvolvimento",
      ].join(" ")}
      aria-disabled="true"
      aria-describedby={ID_EXPLICACAO_EM_DESENVOLVIMENTO}
      data-dica={
        recolhido
          ? `${rotulo} — ${MENSAGEM_EM_DESENVOLVIMENTO}`
          : MENSAGEM_EM_DESENVOLVIMENTO
      }
      onClick={(evento) => onAvisar(evento.currentTarget, rotulo)}
    >
      {icone ? <IconeDoMenu icone={icone} /> : null}
      <span className="painel-nav__texto">
        <span className="painel-nav__rotulo">
          {rotulo}
          {selo ? <Selo texto={selo} /> : null}
        </span>
        <EstadoEmDesenvolvimento />
      </span>
      <MarcaEmDesenvolvimento />
    </button>
  );
}

/** Lista de subitens em desenvolvimento, no fim de um submenu. */
function SubitensEmDesenvolvimento({
  subitens,
  recolhido,
  onAvisar,
}: {
  readonly subitens: readonly SubitemEmDesenvolvimento[];
  readonly recolhido: boolean;
  readonly onAvisar: PedirAviso;
}) {
  return (
    <>
      {subitens.map((sub) => (
        <li className="painel-nav__item" key={sub.id}>
          <BotaoEmDesenvolvimento
            rotulo={sub.rotulo}
            nivel="sub"
            recolhido={recolhido}
            onAvisar={onAvisar}
          />
        </li>
      ))}
    </>
  );
}

/** Ids derivados do nome (espaços viram hífen — ver T178). */
function idDoGrupo(nome: string): string {
  return `nav-grupo-${nome.replace(/\s+/g, "-")}`;
}

interface ModuloProps {
  readonly grupo: GrupoNavegacao;
  /** T209 — nome na barra, quando difere do título do grupo. */
  readonly rotulo: string;
  readonly visiveis: readonly DestinoNavegacao[];
  readonly extras: readonly SubitemEmDesenvolvimento[];
  readonly destinoAtivoId: string;
  readonly aberto: boolean;
  readonly onAlternar: () => void;
  readonly onSelecionar: (id: string) => void;
  /** T206 — trilho: a região fica fechada e o cabeçalho pede espaço. */
  readonly recolhido: boolean;
  readonly onAbrirNoMenuExpandido: () => void;
  readonly onAvisar: PedirAviso;
}

function Modulo({
  grupo,
  rotulo,
  visiveis,
  extras,
  destinoAtivoId,
  aberto,
  onAlternar,
  onSelecionar,
  recolhido,
  onAbrirNoMenuExpandido,
  onAvisar,
}: ModuloProps) {
  // T178 — espaços viram hífen: "Gestão de Pessoas" foi o primeiro título com
  // espaço, e `aria-labelledby`/`aria-controls` leem espaço como SEPARADOR de
  // ids — o submenu passaria a apontar para três ids inexistentes.
  const tituloId = idDoGrupo(grupo.titulo);
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
  // → Colaboradores) — fundir os dois apagaria o nome do módulo. T209: e o
  // módulo com subitens em desenvolvimento, que já tem mais de um filho.
  if (visiveis.length === 1 && !grupo.sempreComoModulo && extras.length === 0) {
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
          contemAtivo && regiaoVisivel ? "painel-nav__cabecalho--na-area" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={regiaoVisivel}
        aria-controls={regiaoId}
        aria-current={ativoNoCabecalho ? "true" : undefined}
        {...(recolhido ? { "data-dica": rotulo } : {})}
        onClick={recolhido ? onAbrirNoMenuExpandido : onAlternar}
      >
        <IconeModulo nome={grupo.icone} />
        <span className="painel-nav__texto">
          <span className="painel-nav__rotulo">{rotulo}</span>
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
          <SubitensEmDesenvolvimento
            subitens={extras}
            recolhido={recolhido}
            onAvisar={onAvisar}
          />
        </ul>
      </div>
    </li>
  );
}

interface ModuloEmDesenvolvimentoProps {
  readonly entrada: EntradaEmDesenvolvimento;
  readonly aberto: boolean;
  readonly onAlternar: () => void;
  readonly recolhido: boolean;
  readonly onAbrirNoMenuExpandido: () => void;
  readonly onAvisar: PedirAviso;
}

/**
 * T209 — item em desenvolvimento com conteúdo futuro (Recrutamento): um
 * cabeçalho expansível de verdade, que revela os subitens — todos em
 * desenvolvimento. O cabeçalho não é desabilitado: ele só abre e fecha.
 */
function ModuloEmDesenvolvimento({
  entrada,
  aberto,
  onAlternar,
  recolhido,
  onAbrirNoMenuExpandido,
  onAvisar,
}: ModuloEmDesenvolvimentoProps) {
  const tituloId = idDoGrupo(entrada.rotulo);
  const regiaoId = `${tituloId}-conteudo`;
  const regiaoVisivel = aberto && !recolhido;
  return (
    <li className="painel-nav__modulo">
      <button
        type="button"
        id={tituloId}
        className="painel-nav__cabecalho painel-nav__cabecalho--em-desenvolvimento"
        aria-expanded={regiaoVisivel}
        aria-controls={regiaoId}
        aria-describedby={ID_EXPLICACAO_EM_DESENVOLVIMENTO}
        data-dica={
          recolhido
            ? `${entrada.rotulo} — ${MENSAGEM_EM_DESENVOLVIMENTO}`
            : MENSAGEM_EM_DESENVOLVIMENTO
        }
        onClick={recolhido ? onAbrirNoMenuExpandido : onAlternar}
      >
        <IconeDoMenu icone={entrada.icone} />
        <span className="painel-nav__texto">
          <span className="painel-nav__rotulo">
            {entrada.rotulo}
            {entrada.selo ? <Selo texto={entrada.selo} /> : null}
          </span>
        </span>
        <MarcaEmDesenvolvimento />
        <SetaExpansao />
      </button>
      <div className="painel-nav__regiao" id={regiaoId} hidden={!regiaoVisivel}>
        <ul className="painel-nav__submenu" aria-labelledby={tituloId}>
          <SubitensEmDesenvolvimento
            subitens={entrada.subitens ?? []}
            recolhido={recolhido}
            onAvisar={onAvisar}
          />
        </ul>
      </div>
    </li>
  );
}

interface EstadoDoAviso {
  readonly alvo: HTMLElement;
  readonly rotulo: string;
}

/** Margem do aviso até a borda da janela e até o item. */
const MARGEM_DO_AVISO = 8;

/**
 * T209 — o aviso de item em desenvolvimento. Pequeno, não modal, preso ao
 * item que o abriu (ao lado no desktop; abaixo quando não cabe, como na
 * gaveta do celular). Recebe o foco para ser lido; `Escape` e "Fechar aviso"
 * o fecham e devolvem o foco ao item. Clicar fora, ou o foco sair dele, só o
 * fecha. Mora dentro da navegação — na gaveta, a armadilha de foco o alcança.
 */
function AvisoEmDesenvolvimento({
  aviso,
  onFechar,
}: {
  readonly aviso: EstadoDoAviso;
  readonly onFechar: (devolverFoco: boolean) => void;
}) {
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const base = useId();
  const tituloId = `${base}-titulo`;
  const textoId = `${base}-texto`;
  const [posicao, setPosicao] = useState<{
    readonly top: number;
    readonly left: number;
  } | null>(null);

  useLayoutEffect(() => {
    const caixa = caixaRef.current;
    if (!caixa) return;
    const item = aviso.alvo.getBoundingClientRect();
    const largura = caixa.offsetWidth;
    const altura = caixa.offsetHeight;
    const larguraJanela = window.innerWidth;
    const alturaJanela = window.innerHeight;
    let left = item.right + MARGEM_DO_AVISO;
    let top = item.top;
    if (left + largura > larguraJanela - MARGEM_DO_AVISO) {
      // Não cabe ao lado (gaveta, janela estreita): vai para baixo do item.
      left = Math.min(
        Math.max(MARGEM_DO_AVISO, item.left),
        Math.max(MARGEM_DO_AVISO, larguraJanela - MARGEM_DO_AVISO - largura),
      );
      top = item.bottom + 4;
    }
    if (top + altura > alturaJanela - MARGEM_DO_AVISO) {
      top = Math.max(MARGEM_DO_AVISO, alturaJanela - MARGEM_DO_AVISO - altura);
    }
    setPosicao({ top, left });
  }, [aviso]);

  // O foco entra só depois de posicionado: um elemento ainda com
  // `visibility: hidden` não pode recebê-lo (o navegador ignora o `focus()`).
  useEffect(() => {
    if (posicao) caixaRef.current?.focus();
  }, [posicao]);

  useEffect(() => {
    const aoApontarFora = (evento: PointerEvent) => {
      const alvo = evento.target;
      if (!(alvo instanceof Node)) return;
      if (caixaRef.current?.contains(alvo) || aviso.alvo.contains(alvo)) return;
      onFechar(false);
    };
    const aoMudarJanela = () => onFechar(false);
    document.addEventListener("pointerdown", aoApontarFora, true);
    window.addEventListener("resize", aoMudarJanela);
    return () => {
      document.removeEventListener("pointerdown", aoApontarFora, true);
      window.removeEventListener("resize", aoMudarJanela);
    };
  }, [aviso, onFechar]);

  return (
    <div
      ref={caixaRef}
      className="painel-nav__aviso"
      role="dialog"
      aria-modal="false"
      aria-labelledby={tituloId}
      aria-describedby={textoId}
      tabIndex={-1}
      {...{ [ATRIBUTO_AVISO_EM_DESENVOLVIMENTO]: "" }}
      style={
        posicao
          ? { top: posicao.top, left: posicao.left }
          : { visibility: "hidden" }
      }
      onKeyDown={(evento) => {
        if (evento.key !== "Escape") return;
        evento.preventDefault();
        evento.stopPropagation();
        onFechar(true);
      }}
      onBlur={(evento) => {
        const proximo = evento.relatedTarget;
        if (proximo instanceof Node && caixaRef.current?.contains(proximo)) {
          return;
        }
        if (proximo !== null) onFechar(false);
      }}
    >
      <p className="painel-nav__aviso-titulo" id={tituloId}>
        Em desenvolvimento
      </p>
      <p className="painel-nav__aviso-texto" id={textoId}>
        <strong>{aviso.rotulo}</strong>: {MENSAGEM_EM_DESENVOLVIMENTO}
      </p>
      <button
        type="button"
        className="painel-nav__aviso-fechar"
        onClick={() => onFechar(true)}
      >
        Fechar aviso
      </button>
    </div>
  );
}

export function PainelNavigation({
  destinoAtivoId,
  onSelecionar,
  papel = null,
  recolhido = false,
  onExpandir,
}: PainelNavigationProps) {
  // Só o que a pessoa fechou (ou abriu) à mão entra aqui. Os módulos
  // funcionais começam abertos; Recrutamento (conteúdo futuro), a seção
  // Operação e Demonstração começam fechados, para o menu caber numa tela —
  // salvo quando a tela aberta está dentro deles: o item atual nunca some.
  const [alternados, setAlternados] = useState<
    Readonly<Record<string, boolean>>
  >({});
  const [aviso, setAviso] = useState<EstadoDoAviso | null>(null);

  // T178 — com uma sub-página aberta (Nova admissão), o item marcado é o do
  // pai (Colaboradores): `aria-current` e destaque visual seguem a área.
  const itemAtivo = itemDaBarraPara(destinoAtivoId);

  const estaAberto = (chave: string, padrao: boolean) =>
    alternados[chave] === undefined ? padrao : alternados[chave]!;

  const alternar = (chave: string, padrao: boolean) =>
    setAlternados((atual) => ({
      ...atual,
      [chave]: !(atual[chave] === undefined ? padrao : atual[chave]),
    }));
  const abrirNoMenuExpandido = (chave: string) => {
    // Abre o módulo E sai do trilho no mesmo desenho: o foco, que está no
    // cabeçalho, termina sobre um submenu já visível.
    setAlternados((atual) => ({ ...atual, [chave]: true }));
    onExpandir?.();
  };

  const avisar: PedirAviso = (alvo, rotulo) => setAviso({ alvo, rotulo });
  const fecharAviso = (devolverFoco: boolean) => {
    const alvo = aviso?.alvo;
    setAviso(null);
    if (devolverFoco && alvo && document.contains(alvo)) alvo.focus();
  };

  const grupoPorTitulo = new Map(GRUPOS.map((g) => [g.titulo, g]));

  // T178 — sub-página (`agrupadoEm`) não é item da barra: chega-se a ela
  // pela página do pai, e o pai fica marcado enquanto ela está aberta.
  function visiveisDoModulo(titulo: string): readonly DestinoNavegacao[] {
    const grupo = grupoPorTitulo.get(titulo);
    if (!grupo) return [];
    return grupo.destinos.filter(
      (d) => !d.agrupadoEm && destinoVisivelPara(d, papel),
    );
  }

  /** A seção contém a tela aberta (por algum dos seus módulos)? */
  function secaoContemAtivo(secao: SecaoDoMenu): boolean {
    return secao.entradas.some(
      (e) =>
        e.tipo === "modulo" &&
        visiveisDoModulo(e.grupo).some((d) => d.id === itemAtivo),
    );
  }

  function renderizarEntrada(
    entrada: SecaoDoMenu["entradas"][number],
  ): ReactNode {
    if (entrada.tipo === "em-desenvolvimento") {
      if (entrada.subitens && entrada.subitens.length > 0) {
        const chave = `em-desenvolvimento:${entrada.id}`;
        return (
          <ModuloEmDesenvolvimento
            key={chave}
            entrada={entrada}
            aberto={estaAberto(chave, false)}
            onAlternar={() => alternar(chave, false)}
            recolhido={recolhido}
            onAbrirNoMenuExpandido={() => abrirNoMenuExpandido(chave)}
            onAvisar={avisar}
          />
        );
      }
      return (
        <li className="painel-nav__modulo" key={entrada.id}>
          <BotaoEmDesenvolvimento
            rotulo={entrada.rotulo}
            nivel="modulo"
            icone={entrada.icone}
            {...(entrada.selo ? { selo: entrada.selo } : {})}
            recolhido={recolhido}
            onAvisar={avisar}
          />
        </li>
      );
    }

    const visiveis = visiveisDoModulo(entrada.grupo);
    const grupo = grupoPorTitulo.get(entrada.grupo);
    if (!grupo || visiveis.length === 0) return null;
    const chave = `grupo:${grupo.titulo}`;
    const padrao = entrada.fechadoPorPadrao
      ? visiveis.some((d) => d.id === itemAtivo)
      : true;
    return (
      <Modulo
        key={chave}
        grupo={grupo}
        rotulo={entrada.rotulo ?? grupo.titulo}
        visiveis={visiveis}
        extras={entrada.subitensEmDesenvolvimento ?? []}
        destinoAtivoId={itemAtivo}
        aberto={estaAberto(chave, padrao)}
        onAlternar={() => alternar(chave, padrao)}
        onSelecionar={onSelecionar}
        recolhido={recolhido}
        onAbrirNoMenuExpandido={() => abrirNoMenuExpandido(chave)}
        onAvisar={avisar}
      />
    );
  }

  function renderizarSecao(secao: SecaoDoMenu): ReactNode {
    const itens = secao.entradas.map(renderizarEntrada).filter(Boolean);
    if (itens.length === 0) return null;
    const classe = [
      "painel-nav__modulos",
      secao.lugar === "secundario" ? "painel-nav__modulos--secundario" : "",
      secao.lugar === "rodape" ? "painel-nav__modulos--rodape" : "",
      // T208 — a própria conta (Configurações) mora no rodapé.
      secao.lugar === "rodape" ? "painel-nav__modulos--conta" : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (!secao.titulo) {
      return (
        <ul className={classe} key={secao.id}>
          {itens}
        </ul>
      );
    }
    const tituloId = `painel-nav-secao-${secao.id}`;
    // Seção recolhível (Operação): o título vira o botão de abrir e fechar. No
    // trilho não há título à vista — a seção fica sempre aberta, em ícones.
    if (secao.recolhivel && !recolhido) {
      const chave = `secao:${secao.id}`;
      const contemAtivo = secaoContemAtivo(secao);
      const aberta = estaAberto(chave, contemAtivo);
      const listaId = `${tituloId}-lista`;
      return (
        <div className="painel-nav__secao" key={secao.id}>
          <button
            type="button"
            id={tituloId}
            className={[
              "painel-nav__secao-titulo",
              "painel-nav__secao-alternar",
              contemAtivo && !aberta
                ? "painel-nav__secao-alternar--contem-ativo"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-expanded={aberta}
            aria-controls={listaId}
            aria-current={contemAtivo && !aberta ? "true" : undefined}
            onClick={() => alternar(chave, contemAtivo)}
          >
            <span>{secao.titulo}</span>
            <SetaExpansao />
          </button>
          <ul
            className={classe}
            id={listaId}
            aria-labelledby={tituloId}
            hidden={!aberta}
          >
            {itens}
          </ul>
        </div>
      );
    }
    return (
      <div className="painel-nav__secao" key={secao.id}>
        <p className="painel-nav__secao-titulo" id={tituloId}>
          {secao.titulo}
        </p>
        <ul className={classe} aria-labelledby={tituloId}>
          {itens}
        </ul>
      </div>
    );
  }

  return (
    <nav
      id={ID_NAVEGACAO_PAINEL}
      className={recolhido ? "painel-nav painel-nav--trilho" : "painel-nav"}
      aria-label="Navegação do painel"
    >
      <span
        className="painel-nav__oculto"
        id={ID_EXPLICACAO_EM_DESENVOLVIMENTO}
      >
        {MENSAGEM_EM_DESENVOLVIMENTO}
      </span>
      {aviso ? (
        <AvisoEmDesenvolvimento aviso={aviso} onFechar={fecharAviso} />
      ) : null}
      {MENU_LATERAL.map(renderizarSecao)}
    </nav>
  );
}
