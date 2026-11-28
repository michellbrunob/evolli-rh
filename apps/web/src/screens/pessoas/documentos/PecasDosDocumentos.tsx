import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui";
import { StatusBadge, type StatusVariant } from "../../../components";
import { IconeMaisAcoes, IconePlanilha } from "../../../ui/icones";
import { ROTULO_DO_ESTADO, type EstadoNaTela } from "./documentosDoColaborador";
import "./documentos.css";

/**
 * T213 — peças comuns da etapa 4 e da ficha: o selo do estado (T216: o
 * status padrão, com o texto; a cor nunca fala sozinha) e a linha do documento (nome à esquerda,
 * estado ao centro, ações à direita; empilha em telas estreitas).
 */

const VARIANTE_DO_ESTADO: Readonly<Record<EstadoNaTela, StatusVariant>> = {
  pendente: "warning",
  em_verificacao: "info",
  aprovado: "success",
  reprovado: "danger",
  nao_enviado: "danger",
};

export function EstadoDoDocumento({
  estado,
  rotulo,
}: {
  readonly estado: EstadoNaTela;
  /** Texto no lugar do rótulo padrão (ex.: "Enviando…"). */
  readonly rotulo?: string;
}) {
  return (
    <StatusBadge variant={VARIANTE_DO_ESTADO[estado]}>
      {rotulo ?? ROTULO_DO_ESTADO[estado]}
    </StatusBadge>
  );
}

/**
 * T213 — para onde o foco vai depois de uma ação que troca os botões da
 * linha (escolher, trocar ou remover arquivo): "ver" quando há arquivo,
 * "menu" (o "⋯") quando há arquivo mas ele não pode ser visto, "enviar"
 * quando não há arquivo.
 */
export type AlvoDoFoco = "ver" | "menu" | "enviar";

/** O primeiro alvo que existir na linha, na ordem pedida. */
export function naLinha(
  linha: string,
  ...alvos: readonly AlvoDoFoco[]
): () => HTMLElement | null {
  return () => {
    // Ids de `useId` e UUIDs: só aspas e barra precisam de escape no seletor.
    const elemento = document.querySelector(
      `[data-linha="${linha.replace(/["\\]/g, "\\$&")}"]`,
    );
    if (!elemento) return null;
    for (const alvo of alvos) {
      const botao = elemento.querySelector<HTMLElement>(
        `[data-foco="${alvo}"]`,
      );
      if (botao) return botao;
    }
    return null;
  };
}

/** Onde a pessoa já está interagindo: um menu ou diálogo aberto. */
const INTERACAO_ABERTA = '[role="menu"], [role="dialog"], [role="alertdialog"]';

/**
 * Pede o foco para depois do próximo desenho: os botões novos da linha já
 * existem e o menu ("⋯") já devolveu o foco ao gatilho dele — que pode ter
 * sumido. O pedido vale uma vez, e é descartado se, nesse meio-tempo, a
 * pessoa já abriu um menu ou diálogo (o foco adiado nunca o fecha).
 */
export function useFocoDepois(): (achar: () => HTMLElement | null) => void {
  const pedido = useRef<(() => HTMLElement | null) | null>(null);
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!pedido.current) return undefined;
    const achar = pedido.current;
    const relogio = window.setTimeout(() => {
      if (pedido.current !== achar) return;
      pedido.current = null;
      const ativo = document.activeElement;
      if (ativo instanceof HTMLElement && ativo.closest(INTERACAO_ABERTA)) {
        return;
      }
      achar()?.focus();
    }, 0);
    return () => window.clearTimeout(relogio);
  }, [vez]);
  return useCallback((achar) => {
    pedido.current = achar;
    setVez((v) => v + 1);
  }, []);
}

export function LinhaDoDocumento({
  id,
  nome,
  detalhe,
  estado,
  acoes,
  erro,
  categoria,
}: {
  readonly id: string;
  readonly nome: string;
  /** Linha fina abaixo do nome (arquivo escolhido, data, tamanho). */
  readonly detalhe?: ReactNode;
  readonly estado: ReactNode;
  readonly acoes?: ReactNode;
  readonly erro?: string | null;
  /** A categoria da linha (para achar a próxima da mesma categoria). */
  readonly categoria?: string;
}) {
  return (
    <li
      className="documentos__linha"
      data-linha={id}
      {...(categoria ? { "data-categoria": categoria } : {})}
    >
      <div className="documentos__identificacao">
        <span className="documentos__nome" id={`${id}-nome`}>
          {nome}
        </span>
        {detalhe ? (
          <span className="documentos__detalhe">{detalhe}</span>
        ) : null}
      </div>
      <div className="documentos__estado-celula">{estado}</div>
      <div className="documentos__acoes">{acoes}</div>
      {erro ? (
        <p className="documentos__erro" role="alert">
          {erro}
        </p>
      ) : null}
    </li>
  );
}

/**
 * O arquivo na linha: ícone, nome (cortado com reticências, completo no
 * título) e o tamanho, e o selo do estado quando já está no servidor.
 */
export function ArquivoDaLinha({
  nome,
  tamanho,
  estado,
}: {
  readonly nome: string;
  readonly tamanho: string;
  readonly estado?: ReactNode;
}) {
  return (
    <span className="documentos__arquivo">
      <span className="documentos__arquivo-icone" aria-hidden="true">
        <IconePlanilha tamanho={18} />
      </span>
      <span className="documentos__arquivo-texto">
        <span className="documentos__arquivo-nome" title={nome}>
          {nome}
        </span>
        <span className="documentos__arquivo-tamanho">{tamanho}</span>
      </span>
      {estado}
    </span>
  );
}

export interface AcaoDoMenu {
  readonly id: string;
  readonly rotulo: string;
  readonly aoEscolher: () => void;
  /** T217 — ação destrutiva (Remover): cor de perigo e ícone. */
  readonly perigo?: boolean;
  readonly icone?: ReactNode;
}

/** O "⋯" da linha: as ações do arquivo num menu acessível. */
export function MenuDoArquivo({
  nome,
  acoes,
}: {
  readonly nome: string;
  readonly acoes: readonly AcaoDoMenu[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="documentos__botao-icone"
        aria-label={`Mais ações: ${nome}`}
        data-foco="menu"
      >
        <IconeMaisAcoes />
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={`Mais ações: ${nome}`}>
        {acoes.map((acao) => (
          <DropdownMenuItem
            key={acao.id}
            onSelect={acao.aoEscolher}
            {...(acao.perigo ? { className: "documentos__item-perigo" } : {})}
          >
            {acao.icone ? (
              <span className="documentos__item-icone" aria-hidden="true">
                {acao.icone}
              </span>
            ) : null}
            {acao.rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
