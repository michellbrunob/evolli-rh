/**
 * T215 — Benefícios: peças pequenas da tela (campo em reais, cartões de
 * opção, segmentado, pessoa com avatar).
 */
import { type ReactNode, useEffect, useState } from "react";
import { formatarReaisDoCampo, lerReais } from "../../format/moeda";
import { iniciaisDe } from "../pessoas/iniciais";

/** Campo de dinheiro: digita `1.234,56`; confirma ao sair do campo. */
export function CampoReais({
  valor,
  onMudar,
  rotulo,
  sufixo,
  id,
  invalido,
  disabled,
}: {
  readonly valor: number | null;
  readonly onMudar: (v: number | null) => void;
  readonly rotulo: string;
  readonly sufixo?: string;
  readonly id?: string;
  readonly invalido?: boolean;
  readonly disabled?: boolean;
}) {
  const [texto, setTexto] = useState(formatarReaisDoCampo(valor));
  useEffect(() => {
    setTexto((atual) =>
      lerReais(atual) === valor ? atual : formatarReaisDoCampo(valor),
    );
  }, [valor]);
  return (
    <span className="beneficios__dinheiro">
      <span className="beneficios__dinheiro-prefixo" aria-hidden="true">
        R$
      </span>
      <input
        {...(id ? { id } : {})}
        type="text"
        inputMode="decimal"
        aria-label={rotulo}
        aria-invalid={invalido || undefined}
        disabled={disabled}
        placeholder="0,00"
        value={texto}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, "");
          setTexto(t);
          onMudar(lerReais(t));
        }}
        onBlur={() => setTexto(formatarReaisDoCampo(lerReais(texto)))}
      />
      {sufixo ? (
        <span className="beneficios__dinheiro-sufixo" aria-hidden="true">
          {sufixo}
        </span>
      ) : null}
    </span>
  );
}

/** Campo numérico curto (percentual, dias), com sufixo. */
export function CampoNumero({
  valor,
  onMudar,
  rotulo,
  sufixo,
  max,
  decimal = false,
  id,
}: {
  readonly valor: number | null;
  readonly onMudar: (v: number | null) => void;
  readonly rotulo: string;
  readonly sufixo?: string;
  readonly max?: number;
  readonly decimal?: boolean;
  readonly id?: string;
}) {
  return (
    <span className="beneficios__dinheiro beneficios__dinheiro--curto">
      <input
        {...(id ? { id } : {})}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        aria-label={rotulo}
        placeholder="0"
        value={valor === null ? "" : String(valor).replace(".", ",")}
        onChange={(e) => {
          const t = e.target.value.replace(decimal ? /[^\d,]/g : /\D/g, "");
          if (t === "") return onMudar(null);
          const n = Number(t.replace(",", "."));
          if (!Number.isFinite(n)) return;
          onMudar(max !== undefined ? Math.min(n, max) : n);
        }}
      />
      {sufixo ? (
        <span className="beneficios__dinheiro-sufixo" aria-hidden="true">
          {sufixo}
        </span>
      ) : null}
    </span>
  );
}

/** Cartões de opção (uma escolha), com título, ajuda e conteúdo aberto. */
export function CartoesDeOpcao<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
  linha = false,
}: {
  readonly rotulo: string;
  readonly opcoes: readonly {
    readonly valor: T;
    readonly titulo: string;
    readonly ajuda?: string;
    readonly conteudo?: ReactNode;
  }[];
  readonly valor: T | null;
  readonly onMudar: (v: T) => void;
  readonly linha?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={`beneficios__opcoes${linha ? " beneficios__opcoes--linha" : ""}`}
    >
      {opcoes.map((o) => (
        <div
          key={o.valor}
          className="beneficios__opcao-caixa"
          data-marcada={valor === o.valor || undefined}
        >
          <button
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            className="beneficios__opcao"
            onClick={() => onMudar(o.valor)}
          >
            <span className="beneficios__radio" aria-hidden="true" />
            <span className="beneficios__opcao-textos">
              <span className="beneficios__opcao-titulo">{o.titulo}</span>
              {o.ajuda ? (
                <span className="beneficios__suave">{o.ajuda}</span>
              ) : null}
            </span>
          </button>
          {valor === o.valor && o.conteudo ? (
            <div className="beneficios__opcao-conteudo">{o.conteudo}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Segmentado de duas ou três opções. */
export function Segmentado<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
}: {
  readonly rotulo: string;
  readonly opcoes: readonly { readonly valor: T; readonly rotulo: string }[];
  readonly valor: T;
  readonly onMudar: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className="beneficios__segmentado"
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onMudar(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Pessoa na tabela: avatar com iniciais, nome e a linha de baixo. */
export function PessoaNaLinha({
  nome,
  detalhe,
  alerta,
}: {
  readonly nome: string;
  readonly detalhe: string | null;
  readonly alerta?: string | null;
}) {
  return (
    <span className="beneficios__pessoa">
      <span className="beneficios__avatar" aria-hidden="true">
        {iniciaisDe(nome)}
      </span>
      <span className="beneficios__pessoa-textos">
        <span className="beneficios__pessoa-nome">{nome}</span>
        {detalhe || alerta ? (
          <span className="beneficios__suave">
            {detalhe}
            {detalhe && alerta ? " · " : null}
            {alerta ? (
              <span className="beneficios__alerta">{alerta}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}
