/**
 * T196 — seletor pesquisável de uma referência da lotação (Departamento,
 * Cargo, Unidade ou Centro de custo) na Nova admissão.
 *
 * ## Por que existe
 *
 * O `<select>` anterior carregava uma única página de até 100 itens ativos:
 * numa empresa com mais do que isso, o que ficava além não podia ser escolhido.
 * Aqui a busca é feita NO SERVIDOR (`busca`, por código ou nome, antes da
 * paginação), de 20 em 20, com "Mostrar mais".
 *
 * ## Comportamento
 *
 * - É um combobox com lista (ARIA 1.2): o campo é só a BUSCA; a escolha atual
 *   aparece sempre logo abaixo ("Escolha atual: CÓDIGO — Nome"), mesmo quando
 *   não está na página exibida, e é lida junto do campo (`aria-describedby`).
 * - A lista só abre por ação explícita: digitar, clicar no campo, seta para
 *   baixo ou o botão "Mostrar opções". Foco vindo de Tab ou de um erro não a
 *   abre.
 * - Teclado: setas percorrem as opções, Enter escolhe, Escape fecha sem mexer
 *   na escolha, Tab sai. Com a lista fechada, Enter segue o formulário (T195:
 *   avança a etapa).
 * - Só a resposta mais recente vale: busca nova, página nova ou o componente
 *   desmontado (troca de empresa remonta a tela, T189) descartam as antigas.
 * - Vazio, carregando e falha têm texto próprio; a falha oferece "Tentar de
 *   novo" e não toca na escolha. Contagens e escolhas são anunciadas UMA vez,
 *   numa região de status sempre montada.
 * - Busca sem remoção de acentos (regra desta entrega).
 * - T197 — com `criacao` (só o RH), uma busca sem nome idêntico entre os
 *   resultados oferece "Criar «termo»" como última opção, também no vazio.
 *   Escolhê-la (Enter ou clique) só pede a confirmação a quem usa o seletor:
 *   nada é criado aqui, e o termo fica no campo.
 */
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { FormField } from "../../components";
import { chaveDoNome, normalizarNomeDeReferencia } from "./nomeDeReferencia";
import type { ResultadoPaginado } from "../../api/organizacaoClient";
import "./SeletorDeReferencia.css";

/** Referência como aparece na lista e na escolha atual. */
export interface ReferenciaEscolhida {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

/** `CÓDIGO — Nome`: nomes repetidos são permitidos, o código distingue. */
export function rotuloDaReferenciaEscolhida(r: ReferenciaEscolhida): string {
  return `${r.codigo} — ${r.nome}`;
}

/** T196 — decisão aprovada: páginas de 20. */
export const TAMANHO_DA_PAGINA_DE_REFERENCIAS = 20;

/** Espera curta entre a digitação e a consulta. */
const ESPERA_DA_DIGITACAO_MS = 300;

/**
 * Uma página da consulta. `total`, `pagina` e `tamanhoPagina` são os do
 * servidor e só eles decidem se há próxima página. `descartados` conta o que a
 * defesa do cliente tirou desta página (referência inativa devolvida
 * indevidamente) e só ajusta a contagem exibida.
 */
export interface PaginaDeReferencias extends ResultadoPaginado<ReferenciaEscolhida> {
  readonly descartados?: number;
}

export type ListarReferencias = (consulta: {
  readonly busca?: string;
  readonly pagina: number;
}) => Promise<PaginaDeReferencias>;

export interface SeletorDeReferenciaProps {
  /** `id` do campo de busca — o alvo do foco quando há erro (T179/T195). */
  readonly id: string;
  /** Nome do campo, também usado nos textos ("Departamento"). */
  readonly rotulo: string;
  /** Rótulo visível; os opcionais trazem "(opcional)". */
  readonly rotuloVisivel: string;
  /** Nome no plural e em minúsculas, para os textos ("departamentos"). */
  readonly plural: string;
  /** "Nenhum" ou "Nenhuma", no gênero do campo. */
  readonly nenhum: "Nenhum" | "Nenhuma";
  /** "ativo" ou "ativa", no gênero do campo. */
  readonly ativo: "ativo" | "ativa";
  readonly obrigatorio: boolean;
  readonly ajuda?: string;
  readonly erro?: string;
  readonly escolhida: ReferenciaEscolhida | null;
  readonly onEscolher: (referencia: ReferenciaEscolhida | null) => void;
  /** A consulta ao servidor (só ativos da empresa da sessão). */
  readonly listar: ListarReferencias;
  readonly desabilitado?: boolean;
  /**
   * Muda quando a lista precisa ser relida (T180: depois de um cadastro
   * rápido): os resultados guardados deixam de valer.
   */
  readonly versao?: number;
  /** T180 — o "+" do cadastro rápido, ao lado do campo. */
  readonly acao?: ReactNode;
  /**
   * T197 — criação inline, só para o RH: `onCriar` recebe o nome já
   * normalizado quando a pessoa escolhe "Criar «termo»".
   */
  readonly criacao?: { readonly onCriar: (nome: string) => void } | undefined;
  /**
   * T197 — anúncio de fora (a referência criada e escolhida), feito uma vez
   * na região de status do seletor a cada `id` novo.
   */
  readonly aviso?: { readonly id: number; readonly texto: string } | undefined;
}

type Estado =
  | { tipo: "fechado" }
  | { tipo: "carregando" }
  | {
      tipo: "pronto";
      /** T197 — o termo (aparado) a que estes resultados respondem. */
      busca: string;
      itens: readonly ReferenciaEscolhida[];
      /** Do servidor: com `pagina` e `tamanhoPagina`, decide a próxima página. */
      totalDoServidor: number;
      pagina: number;
      tamanhoPagina: number;
      /** Tirados pela defesa do cliente em todas as páginas já carregadas. */
      descartados: number;
      /**
       * O servidor devolveu uma página vazia (nenhum item, nem descartado):
       * não há mais nada, seja qual for o total informado.
       */
      esgotado: boolean;
      carregandoMais: boolean;
      falhaAoCarregarMais: boolean;
    }
  | { tipo: "falha" };

type Pronto = Extract<Estado, { tipo: "pronto" }>;

/**
 * Há próxima página no servidor. Decide pela página pedida e pelo total do
 * servidor, nunca pela quantidade exibida: uma página que a defesa do cliente
 * esvaziou não trava nem repete a paginação. Uma página que o servidor
 * devolveu vazia encerra, mesmo com um total informado maior.
 */
function haMaisPaginas(e: Pronto): boolean {
  return (
    !e.esgotado &&
    e.tamanhoPagina > 0 &&
    e.pagina * e.tamanhoPagina < e.totalDoServidor
  );
}

/**
 * Contagem exibida. Enquanto há páginas a carregar: o total do servidor menos
 * o que já foi descartado. Encerrada a paginação (última página pelo total ou
 * página vazia): exatamente as opções carregadas, mesmo que o total informado
 * fosse maior. Não entra na decisão de próxima página.
 */
function totalExibido(e: Pronto): number {
  if (!haMaisPaginas(e)) return e.itens.length;
  return Math.max(e.itens.length, e.totalDoServidor - e.descartados);
}

export function SeletorDeReferencia({
  id,
  rotulo,
  rotuloVisivel,
  plural,
  nenhum,
  ativo,
  obrigatorio,
  ajuda,
  erro,
  escolhida,
  onEscolher,
  listar,
  desabilitado = false,
  versao = 0,
  acao,
  criacao,
  aviso,
}: SeletorDeReferenciaProps) {
  const base = useId();
  const idLista = `${base}-lista`;
  const idEscolha = `${id}-escolha`;
  const idDaOpcao = (indice: number) => `${base}-opcao-${indice}`;
  const idDaCriacao = `${base}-criar`;
  /** T197 — concordância do vazio ("Nenhuma unidade encontrada"). */
  const encontrado = ativo === "ativa" ? "encontrada" : "encontrado";

  const [termo, setTermo] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "fechado" });
  const [ativa, setAtiva] = useState(-1);
  /** Anúncio único (contagem, escolha); limpo antes de cada novo. */
  const [anuncio, setAnuncio] = useState("");

  /** Só a resposta do pedido mais recente vale. */
  const pedidoRef = useRef(0);
  const esperaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campoRef = useRef<HTMLInputElement | null>(null);
  const raizRef = useRef<HTMLDivElement | null>(null);
  const mostrarMaisRef = useRef<HTMLButtonElement | null>(null);
  /** Foco a devolver ao campo depois de "Mostrar mais" sem mais páginas. */
  const focarCampoRef = useRef(false);

  const aberto = estado.tipo !== "fechado";
  /** O estado deste render, lido pelas respostas que chegam depois. */
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  // Desmontado (troca de empresa, saída da página): nenhuma resposta vale.
  useEffect(
    () => () => {
      pedidoRef.current += 1;
      if (esperaRef.current) clearTimeout(esperaRef.current);
    },
    [],
  );

  // T180 — lista relida no servidor: o que estava na tela não vale mais.
  useEffect(() => {
    if (versao === 0) return;
    pedidoRef.current += 1;
    setEstado({ tipo: "fechado" });
    setAtiva(-1);
  }, [versao]);

  useEffect(() => {
    if (!focarCampoRef.current) return;
    focarCampoRef.current = false;
    campoRef.current?.focus();
  });

  function anunciar(texto: string) {
    setAnuncio(texto);
  }

  // T197 — o aviso de fora (referência criada ou escolhida pela confirmação)
  // é anunciado uma vez por `id`, e a busca é limpa, como numa escolha feita
  // na própria lista.
  useEffect(() => {
    if (!aviso) return;
    setAnuncio(aviso.texto);
    setTermo("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aviso?.id]);

  /**
   * T197 — o nome a oferecer em "Criar «termo»": só com `criacao`, termo
   * válido e nenhum resultado com o mesmo nome. `null` quando não há oferta.
   */
  function nomeParaCriar(
    busca: string,
    itens: readonly ReferenciaEscolhida[],
  ): string | null {
    if (!criacao) return null;
    const nome = normalizarNomeDeReferencia(busca);
    if (nome === null) return null;
    const chave = chaveDoNome(nome);
    return itens.some((item) => chaveDoNome(item.nome) === chave) ? null : nome;
  }

  function textoDaContagem(exibidos: number, total: number): string {
    if (total === 0) return `${nenhum} ${rotulo.toLowerCase()} ${encontrado}.`;
    if (total === 1 && exibidos === 1) return "1 resultado.";
    return `${total} ${total === 1 ? "resultado" : "resultados"}; ${exibidos} ${
      exibidos === 1 ? "exibido" : "exibidos"
    }.`;
  }

  async function consultar(busca: string, pagina: number) {
    const pedido = ++pedidoRef.current;
    if (pagina === 1) {
      setEstado({ tipo: "carregando" });
      setAtiva(-1);
    } else {
      setEstado((atual) =>
        atual.tipo === "pronto"
          ? { ...atual, carregandoMais: true, falhaAoCarregarMais: false }
          : atual,
      );
    }
    try {
      const resposta = await listar({
        ...(busca ? { busca } : {}),
        pagina,
      });
      if (pedido !== pedidoRef.current) return;
      const atual = estadoRef.current;
      const anterior = pagina > 1 && atual.tipo === "pronto" ? atual : null;
      const proximo: Pronto = {
        tipo: "pronto",
        busca,
        itens: [...(anterior?.itens ?? []), ...resposta.itens],
        totalDoServidor: resposta.total,
        pagina,
        tamanhoPagina: resposta.tamanhoPagina,
        descartados: (anterior?.descartados ?? 0) + (resposta.descartados ?? 0),
        esgotado: resposta.itens.length + (resposta.descartados ?? 0) === 0,
        carregandoMais: false,
        falhaAoCarregarMais: false,
      };
      // "Mostrar mais" some quando acabam as páginas: o foco volta ao campo.
      if (pagina > 1 && !haMaisPaginas(proximo)) {
        focarCampoRef.current = true;
      }
      setEstado(proximo);
      const oferta = nomeParaCriar(busca, proximo.itens);
      anunciar(
        `${textoDaContagem(proximo.itens.length, totalExibido(proximo))}${
          oferta ? ` A opção de criar «${oferta}» está no fim da lista.` : ""
        }`,
      );
    } catch {
      if (pedido !== pedidoRef.current) return;
      if (pagina > 1) {
        setEstado((atual) =>
          atual.tipo === "pronto"
            ? { ...atual, carregandoMais: false, falhaAoCarregarMais: true }
            : atual,
        );
      } else {
        setEstado({ tipo: "falha" });
      }
    }
  }

  function abrir(busca = termo) {
    if (desabilitado) return;
    if (esperaRef.current) clearTimeout(esperaRef.current);
    void consultar(busca.trim(), 1);
  }

  /** Fecha a lista; o termo fica (T197: volta da confirmação de criação). */
  function fecharLista() {
    if (esperaRef.current) clearTimeout(esperaRef.current);
    pedidoRef.current += 1;
    setEstado({ tipo: "fechado" });
    setAtiva(-1);
  }

  function fechar() {
    fecharLista();
    setTermo("");
  }

  function aoDigitar(valor: string) {
    setTermo(valor);
    if (esperaRef.current) clearTimeout(esperaRef.current);
    esperaRef.current = setTimeout(
      () => void consultar(valor.trim(), 1),
      ESPERA_DA_DIGITACAO_MS,
    );
    if (!aberto) setEstado({ tipo: "carregando" });
  }

  function escolher(referencia: ReferenciaEscolhida | null) {
    onEscolher(referencia);
    fechar();
    anunciar(
      referencia
        ? `${rotulo} escolhido: ${rotuloDaReferenciaEscolhida(referencia)}.`
        : `${rotulo}: escolha removida.`,
    );
    campoRef.current?.focus();
  }

  const itens = estado.tipo === "pronto" ? estado.itens : [];
  // T197 — só vale para o termo que os resultados respondem: enquanto a nova
  // busca espera, a oferta some.
  const oferta =
    estado.tipo === "pronto" && estado.busca === termo.trim()
      ? nomeParaCriar(termo, itens)
      : null;
  /** Opções navegáveis: os resultados e, se houver, "Criar" no fim. */
  const totalDeOpcoes = itens.length + (oferta ? 1 : 0);

  /** T197 — pede a confirmação; a lista fecha e o termo fica no campo. */
  function pedirCriacao() {
    if (!oferta || !criacao) return;
    fecharLista();
    criacao.onCriar(oferta);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    switch (evento.key) {
      case "ArrowDown":
        evento.preventDefault();
        if (!aberto) {
          abrir();
          return;
        }
        if (totalDeOpcoes > 0)
          setAtiva((a) => Math.min(a + 1, totalDeOpcoes - 1));
        return;
      case "ArrowUp":
        if (!aberto) return;
        evento.preventDefault();
        if (totalDeOpcoes > 0) setAtiva((a) => Math.max(a - 1, 0));
        return;
      case "Enter":
        // Lista aberta: Enter é da lista, nunca envia o formulário.
        if (!aberto) return;
        evento.preventDefault();
        if (ativa >= 0 && itens[ativa]) escolher(itens[ativa]!);
        else if (oferta && ativa === itens.length) pedirCriacao();
        return;
      case "Escape":
        if (!aberto) return;
        evento.preventDefault();
        evento.stopPropagation();
        fechar();
        return;
      default:
        return;
    }
  }

  return (
    <div
      className="seletor-referencia"
      ref={raizRef}
      onBlur={(evento) => {
        const destino = evento.relatedTarget as Node | null;
        if (aberto && (!destino || !raizRef.current?.contains(destino))) {
          fechar();
        }
      }}
    >
      <FormField
        id={id}
        label={rotuloVisivel}
        required={obrigatorio}
        {...(ajuda ? { help: ajuda } : {})}
        {...(erro ? { error: erro } : {})}
      >
        {(control) => (
          <div className="seletor-referencia__linha">
            <input
              {...control}
              ref={campoRef}
              type="text"
              role="combobox"
              autoComplete="off"
              placeholder="Buscar por código ou nome"
              aria-autocomplete="list"
              aria-expanded={aberto}
              aria-controls={idLista}
              aria-describedby={[control["aria-describedby"], idEscolha]
                .filter(Boolean)
                .join(" ")}
              {...(aberto && ativa >= 0 && itens[ativa]
                ? { "aria-activedescendant": idDaOpcao(ativa) }
                : aberto && oferta && ativa === itens.length
                  ? { "aria-activedescendant": idDaCriacao }
                  : {})}
              value={termo}
              disabled={desabilitado}
              onChange={(e) => aoDigitar(e.target.value)}
              onClick={() => {
                if (!aberto) abrir();
              }}
              onKeyDown={aoTeclar}
            />
            <button
              type="button"
              className="seletor-referencia__botao"
              aria-label={`Mostrar opções de ${rotulo}`}
              aria-controls={idLista}
              aria-expanded={aberto}
              disabled={desabilitado}
              onClick={() => {
                if (aberto) {
                  fechar();
                } else {
                  abrir();
                }
                campoRef.current?.focus();
              }}
            >
              <span aria-hidden="true">▾</span>
            </button>
            {acao}
          </div>
        )}
      </FormField>

      <p id={idEscolha} className="seletor-referencia__escolha">
        {escolhida ? (
          <>
            Escolha atual:{" "}
            <strong>{rotuloDaReferenciaEscolhida(escolhida)}</strong>
          </>
        ) : (
          "Nenhuma escolha."
        )}
      </p>
      {escolhida && !obrigatorio ? (
        <button
          type="button"
          className="seletor-referencia__limpar"
          aria-label={`Limpar ${rotulo}`}
          disabled={desabilitado}
          onClick={() => escolher(null)}
        >
          Limpar escolha
        </button>
      ) : null}

      {/* Região de status sempre montada: anuncia contagens e escolhas uma
          vez, sem mover o foco. */}
      <p className="seletor-referencia__so-leitor" role="status">
        {anuncio}
      </p>

      <div className="seletor-referencia__painel" hidden={!aberto}>
        <ul
          id={idLista}
          role="listbox"
          aria-label={`Resultados de ${rotulo}`}
          className="seletor-referencia__lista"
        >
          {itens.map((item, indice) => {
            const marcada = escolhida?.id === item.id;
            return (
              <li
                key={item.id}
                id={idDaOpcao(indice)}
                role="option"
                aria-selected={marcada}
                className={[
                  "seletor-referencia__opcao",
                  indice === ativa ? "seletor-referencia__opcao--ativa" : "",
                  marcada ? "seletor-referencia__opcao--marcada" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                // O campo mantém o foco: o clique não o tira dele.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(item)}
              >
                <span>{rotuloDaReferenciaEscolhida(item)}</span>
                {marcada ? (
                  <span className="seletor-referencia__marca">
                    {" "}
                    (escolha atual)
                  </span>
                ) : null}
              </li>
            );
          })}
          {oferta ? (
            <li
              id={idDaCriacao}
              role="option"
              aria-selected={false}
              className={[
                "seletor-referencia__opcao",
                "seletor-referencia__opcao--criar",
                ativa === itens.length
                  ? "seletor-referencia__opcao--ativa"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={pedirCriacao}
            >
              Criar {rotulo.toLowerCase()} «{oferta}»
            </li>
          ) : null}
        </ul>
        {estado.tipo === "carregando" ? (
          <p className="seletor-referencia__texto">Buscando {plural}…</p>
        ) : null}
        {estado.tipo === "pronto" &&
        totalExibido(estado) === 0 &&
        !haMaisPaginas(estado) ? (
          <p className="seletor-referencia__texto">
            {termo.trim()
              ? `${nenhum} ${rotulo.toLowerCase()} ${ativo} ${encontrado} para a busca.`
              : `${nenhum} ${rotulo.toLowerCase()} ${ativo} nesta empresa.`}
          </p>
        ) : null}
        {estado.tipo === "falha" ? (
          <div className="seletor-referencia__falha" role="alert">
            <p className="seletor-referencia__texto">
              Não foi possível carregar {plural}. A escolha atual foi mantida.
            </p>
            <button
              type="button"
              className="seletor-referencia__acao"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                abrir();
                campoRef.current?.focus();
              }}
            >
              Tentar de novo
            </button>
          </div>
        ) : null}
        {estado.tipo === "pronto" && estado.falhaAoCarregarMais ? (
          <p className="seletor-referencia__texto" role="alert">
            Não foi possível carregar mais {plural}. Tente de novo.
          </p>
        ) : null}
        {estado.tipo === "pronto" && haMaisPaginas(estado) ? (
          <button
            type="button"
            ref={mostrarMaisRef}
            className="seletor-referencia__acao"
            aria-busy={estado.carregandoMais}
            onClick={() => {
              if (estado.carregandoMais) return;
              void consultar(termo.trim(), estado.pagina + 1);
            }}
          >
            {estado.carregandoMais
              ? `Carregando mais ${plural}…`
              : "Mostrar mais"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
