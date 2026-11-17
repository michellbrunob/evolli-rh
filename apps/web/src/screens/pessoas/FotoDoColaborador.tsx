import { type ReactNode, useState } from "react";
import type { FotoAnunciadaApi } from "../../api/colaboradoresClient";

/** Tamanhos que a rota da foto entrega (ADR 0020). */
export type TamanhoDaFotoDoColaborador = 96 | 256 | 512;

/**
 * T209 — a rota autenticada da foto do colaborador. A versão vai na URL: a
 * imagem muda quando a foto muda. Nada do armazenamento (chave, endereço)
 * chega ao navegador — quem lê o objeto é a API, depois de conferir empresa,
 * papel e vínculo.
 */
export function urlDaFotoDoColaborador(
  colaboradorId: string,
  tamanho: TamanhoDaFotoDoColaborador,
  versao: number,
): string {
  return `/v1/colaboradores/${encodeURIComponent(colaboradorId)}/foto?tamanho=${tamanho}&v=${versao}`;
}

/**
 * T209 — o avatar do colaborador: a foto (preguiçosa, decorativa — o nome já
 * está ao lado) quando o servidor a anuncia; senão, ou se a leitura falhar,
 * o conteúdo de reserva (as iniciais). Uma versão nova tenta a imagem de
 * novo.
 */
export function FotoDoColaborador({
  colaboradorId,
  foto,
  tamanho,
  className,
  children,
}: {
  readonly colaboradorId: string;
  readonly foto: FotoAnunciadaApi | null | undefined;
  readonly tamanho: TamanhoDaFotoDoColaborador;
  readonly className?: string;
  /** O avatar de reserva: as iniciais. */
  readonly children: ReactNode;
}) {
  const src = foto
    ? urlDaFotoDoColaborador(colaboradorId, tamanho, foto.versao)
    : null;
  const [falhou, setFalhou] = useState<string | null>(null);
  const mostrarFoto = src !== null && falhou !== src;
  const classes = [
    className,
    mostrarFoto && className ? `${className.split(" ")[0]}--foto` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes || undefined} aria-hidden="true">
      {mostrarFoto ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          width={tamanho}
          height={tamanho}
          onError={() => setFalhou(src)}
        />
      ) : (
        children
      )}
    </span>
  );
}
