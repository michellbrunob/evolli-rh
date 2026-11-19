import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui";
import {
  IconeEmVerificacao,
  IconeMaisAcoes,
  IconePlanilha,
  IconeNaoEnviado,
  IconeRelogio,
  IconeReprovado,
  IconeSucesso,
} from "../../../ui/icones";
import { ROTULO_DO_ESTADO, type EstadoNaTela } from "./documentosDoColaborador";
import "./documentos.css";

/**
 * T213 — peças comuns da etapa 4 e da ficha: o selo do estado (ícone e
 * texto; a cor nunca fala sozinha) e a linha do documento (nome à esquerda,
 * estado ao centro, ações à direita; empilha em telas estreitas).
 */

const ICONE_DO_ESTADO: Readonly<Record<EstadoNaTela, () => JSX.Element>> = {
  pendente: () => <IconeRelogio tamanho={14} />,
  em_verificacao: () => <IconeEmVerificacao tamanho={14} />,
  aprovado: () => <IconeSucesso tamanho={14} />,
  reprovado: () => <IconeReprovado tamanho={14} />,
  nao_enviado: () => <IconeNaoEnviado tamanho={14} />,
};

export function EstadoDoDocumento({
  estado,
  rotulo,
}: {
  readonly estado: EstadoNaTela;
  /** Texto no lugar do rótulo padrão (ex.: "Enviando…"). */
  readonly rotulo?: string;
}) {
  const Icone = ICONE_DO_ESTADO[estado];
  return (
    <span
      className={`documentos__estado documentos__estado--${estado}`}
      data-estado={estado}
    >
      <Icone />
      {rotulo ?? ROTULO_DO_ESTADO[estado]}
    </span>
  );
}

export function LinhaDoDocumento({
  id,
  nome,
  detalhe,
  estado,
  acoes,
  erro,
}: {
  readonly id: string;
  readonly nome: string;
  /** Linha fina abaixo do nome (arquivo escolhido, data, tamanho). */
  readonly detalhe?: ReactNode;
  readonly estado: ReactNode;
  readonly acoes?: ReactNode;
  readonly erro?: string | null;
}) {
  return (
    <li className="documentos__linha">
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
      >
        <IconeMaisAcoes />
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={`Mais ações: ${nome}`}>
        {acoes.map((acao) => (
          <DropdownMenuItem key={acao.id} onSelect={acao.aoEscolher}>
            {acao.rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
