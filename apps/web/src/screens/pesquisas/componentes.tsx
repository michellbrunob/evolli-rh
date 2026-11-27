/**
 * T216 — peças de interface do módulo Pesquisas: ícone colorido do modelo,
 * pílulas com contador, busca com atalho, a barra de passos da página
 * inicial, a barra horizontal de etapas dos assistentes e os avatares.
 * Só tokens do sistema de design; nada de cor literal.
 */
import { useEffect, useRef, type ReactNode } from "react";
import type { Identificacao } from "../../api/pesquisasClient";
import {
  IconeAdicionarPessoa,
  IconeBuscar,
  IconeCadeado,
  IconeDesligar,
  IconeEquipe,
  IconeEstrela,
  IconeFormacao,
  IconeModelo,
  IconeOcultarSenha,
  IconePerfil,
  IconePresente,
  IconeStatus,
  type IconeDoEcossistema,
} from "../../ui/icones";
import { modeloDaGaleria } from "./modelosDePesquisa";

const ICONE_DO_MODELO: Readonly<Record<string, IconeDoEcossistema>> = {
  pulso: IconeStatus,
  clima: IconeEquipe,
  enps: IconeEstrela,
  onboarding: IconeAdicionarPessoa,
  desligamento: IconeDesligar,
  beneficios: IconePresente,
  treinamento: IconeFormacao,
  personalizada: IconeModelo,
  "integracao-semana": IconeAdicionarPessoa,
  "satisfacao-espaco": IconeEquipe,
  "satisfacao-evento": IconeEstrela,
  "saida-curta": IconeDesligar,
};

/** O ícone do modelo num quadrado arredondado, na cor do modelo. */
export function IconeDoModelo({
  id,
  tamanho = "md",
}: {
  readonly id: string;
  readonly tamanho?: "sm" | "md" | "lg";
}) {
  const m = modeloDaGaleria(id);
  const Icone = ICONE_DO_MODELO[m.id] ?? IconeModelo;
  return (
    <span
      className={`pesquisas__icone-modelo pesquisas__icone-modelo--${tamanho}`}
      style={{ ["--cor-do-modelo" as string]: `var(${m.cor})` }}
      aria-hidden="true"
    >
      <Icone tamanho={tamanho === "sm" ? 14 : tamanho === "lg" ? 22 : 18} />
    </span>
  );
}

export const ICONE_DA_IDENTIFICACAO: Readonly<
  Record<Identificacao, IconeDoEcossistema>
> = {
  identificada: IconePerfil,
  confidencial: IconeCadeado,
  anonima: IconeOcultarSenha,
};

export interface OpcaoDePilula<T extends string> {
  readonly valor: T;
  readonly rotulo: string;
  readonly contagem?: number;
}

/** Pílulas de filtro com contador (a ativa preenchida). */
export function Pilulas<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
}: {
  readonly rotulo: string;
  readonly opcoes: readonly OpcaoDePilula<T>[];
  readonly valor: T;
  readonly onMudar: (v: T) => void;
}) {
  return (
    <div className="pesquisas__pilulas" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onMudar(o.valor)}
        >
          {o.rotulo}
          {o.contagem !== undefined ? (
            <span className="pesquisas__contagem">{o.contagem}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Busca com lupa; com `atalho`, a tecla "/" leva o foco até ela. */
export function CampoDeBusca({
  rotulo,
  valor,
  onMudar,
  atalho = false,
}: {
  readonly rotulo: string;
  readonly valor: string;
  readonly onMudar: (v: string) => void;
  readonly atalho?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!atalho) return;
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo?.tagName === "INPUT" ||
        alvo?.tagName === "TEXTAREA" ||
        alvo?.isContentEditable;
      if (e.key === "/" && !digitando) {
        e.preventDefault();
        ref.current?.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [atalho]);
  return (
    <label className="pesquisas__busca">
      <IconeBuscar tamanho={16} />
      <input
        ref={ref}
        type="search"
        aria-label={rotulo}
        placeholder={rotulo}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
      />
      {atalho ? (
        <kbd className="pesquisas__atalho" aria-hidden="true">
          /
        </kbd>
      ) : null}
    </label>
  );
}

/** Os três passos da página inicial, numa barra horizontal. */
export function PassosIniciais({
  passos,
}: {
  readonly passos: readonly { titulo: string; texto: string }[];
}) {
  return (
    <ol className="pesquisas__passos-barra" aria-label="Como funciona">
      {passos.map((p, i) => (
        <li key={p.titulo} {...(i === 0 ? { "data-atual": "" } : {})}>
          <span className="pesquisas__passo-circulo" aria-hidden="true">
            {i + 1}
          </span>
          <span className="pesquisas__passo-textos">
            <strong>{p.titulo}</strong>
            <span>{p.texto}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export interface EtapaHorizontal {
  readonly titulo: string;
  readonly subtitulo: string;
}

/** Etapas do assistente, na horizontal: concluída com visto, atual em destaque. */
export function BarraDeEtapas({
  etapas,
  atual,
}: {
  readonly etapas: readonly EtapaHorizontal[];
  /** Índice da atual; `etapas.length` = todas concluídas. */
  readonly atual: number;
}) {
  return (
    <ol className="pesquisas__etapas-barra" aria-label="Etapas">
      {etapas.map((e, i) => {
        const estado =
          i < atual ? "concluida" : i === atual ? "atual" : "pendente";
        return (
          <li
            key={e.titulo}
            data-estado={estado}
            {...(estado === "atual" ? { "aria-current": "step" as const } : {})}
          >
            <span className="pesquisas__etapa-circulo" aria-hidden="true">
              {estado === "concluida" ? "✓" : i + 1}
            </span>
            <span className="pesquisas__etapa-textos">
              <strong>{e.titulo}</strong>
              <span>{e.subtitulo}</span>
            </span>
            <span className="pesquisas__so-leitor">
              {estado === "concluida"
                ? ", concluída"
                : estado === "atual"
                  ? ", etapa atual"
                  : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function iniciaisDe(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return `${p[0]?.[0] ?? ""}${p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : ""}`.toUpperCase();
}

export function Avatar({
  texto,
  rotulo,
}: {
  readonly texto: string;
  readonly rotulo?: string;
}) {
  return (
    <span
      className="pesquisas__avatar"
      {...(rotulo ? { title: rotulo } : { "aria-hidden": true })}
    >
      {texto}
    </span>
  );
}

/** Avatares empilhados: os primeiros e "+N". */
export function PilhaDeAvatares({
  nomes,
  maximo = 5,
}: {
  readonly nomes: readonly string[];
  readonly maximo?: number;
}) {
  const resto = nomes.length - maximo;
  return (
    <span className="pesquisas__pilha" aria-hidden="true">
      {nomes.slice(0, maximo).map((n, i) => (
        <Avatar key={`${n}-${i}`} texto={iniciaisDe(n)} />
      ))}
      {resto > 0 ? (
        <span className="pesquisas__avatar">{`+${resto}`}</span>
      ) : null}
    </span>
  );
}

/** Cartão de seção (título, descrição e conteúdo). */
export function CartaoDeSecao({
  titulo,
  descricao,
  acao,
  contador,
  children,
}: {
  readonly titulo: string;
  readonly descricao?: ReactNode;
  readonly acao?: ReactNode;
  readonly contador?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="pesquisas__cartao-secao" aria-label={titulo}>
      <header className="pesquisas__cartao-secao-cabeca">
        <div>
          <h2 className="pesquisas__cartao-secao-titulo">
            {titulo}
            {contador ? (
              <span className="pesquisas__contagem">{contador}</span>
            ) : null}
          </h2>
          {descricao ? <p className="pesquisas__suave">{descricao}</p> : null}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}
