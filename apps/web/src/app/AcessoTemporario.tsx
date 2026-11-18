/**
 * T209 — tela mínima e neutra para quem ainda não tem destino funcional
 * próprio (colaborador, financeiro, auditor, DPO, administração técnica)
 * enquanto o Hub está desativado como destino de uso normal.
 *
 * Não é módulo nem destino: não aparece no menu, não tem rota, não lista
 * nada, não oferece atalho e não faz requisição. O único controle é Sair.
 * Não amplia permissão alguma — as rotas que o papel já abria (Meu perfil,
 * por exemplo) continuam abrindo pela URL, como antes.
 */
import { useEffect, useRef } from "react";
import { MarcaEvolli } from "./IconeModulo";
import "./AcessoTemporario.css";

export const TITULO_ACESSO_TEMPORARIO = "Acesso em configuração";

export interface AcessoTemporarioProps {
  readonly onSair: () => void;
  /** A tela nasce com o foco no título (aterrissagem). */
  readonly focarTituloAoAbrir?: boolean;
}

export function AcessoTemporario({
  onSair,
  focarTituloAoAbrir = false,
}: AcessoTemporarioProps) {
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (focarTituloAoAbrir) tituloRef.current?.focus();
  }, [focarTituloAoAbrir]);

  return (
    <main
      className="acesso-temporario"
      aria-labelledby="acesso-temporario-titulo"
    >
      <div className="acesso-temporario__cartao">
        <span className="acesso-temporario__marca" aria-hidden="true">
          <MarcaEvolli />
          <span>Evolli RH</span>
        </span>
        <h1
          id="acesso-temporario-titulo"
          ref={tituloRef}
          tabIndex={-1}
          className="acesso-temporario__titulo"
        >
          {TITULO_ACESSO_TEMPORARIO}
        </h1>
        <p className="acesso-temporario__texto">
          Seu acesso está sendo configurado. Novos recursos serão liberados
          conforme o seu papel.
        </p>
        <button
          type="button"
          className="acesso-temporario__sair"
          onClick={onSair}
        >
          Sair
        </button>
      </div>
    </main>
  );
}
