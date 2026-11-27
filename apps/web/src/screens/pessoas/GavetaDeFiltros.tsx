/**
 * T215 — a gaveta "Filtrar" da listagem de Colaboradores. Painel lateral
 * (Sheet da camada `src/ui`: `role="dialog"`, `aria-modal`, foco preso,
 * Escape, "Fechar" e clique fora fecham e devolvem o foco ao botão que abriu).
 *
 * - Grupos, na ordem: Departamento, Área, Centro de custo, Unidade, Cargo e
 *   Nível (caixas de marcar) e Tipo de contrato e Gênero (botões que ligam e
 *   desligam). Em abas sem lotação (Em admissão, Desligados), só Tipo de
 *   contrato e Gênero: a lotação vigente só existe em vínculo ativo.
 * - O que se marca é RASCUNHO: a listagem só muda em "Ver N resultados" (uma
 *   única mudança de estado, na página 1). "Limpar filtros" zera o rascunho.
 * - N é contado no servidor, ao vivo (com a aba e a busca aplicada), um
 *   instante depois da última marcação; contagem em voo é cancelada pela
 *   seguinte. Contando, ou se a contagem falha: "Ver resultados".
 */
import { useEffect, useId, useRef, useState } from "react";
import {
  FILTROS_VAZIOS,
  GENEROS_DO_PERFIL,
  NIVEIS_DE_CARREIRA,
  TIPOS_DE_VINCULO,
  type FiltrosDaListagem,
} from "../../app/rotasDoShell";
import { Button, Sheet } from "../../ui";

/** Uma referência de catálogo (departamento, área, centro, unidade, cargo). */
export interface ReferenciaDoCatalogo {
  readonly id: string;
  readonly nome: string;
  readonly codigo: string;
}

/** Os grupos da gaveta que vêm de catálogos da empresa. */
export const GRUPOS_DE_CATALOGO = [
  "departamentos",
  "areas",
  "centrosCusto",
  "unidades",
  "cargos",
] as const;
export type GrupoDeCatalogo = (typeof GRUPOS_DE_CATALOGO)[number];

/**
 * Catálogos da gaveta: só referências ATIVAS da empresa ativa (o servidor
 * escopa pela sessão), uma página de 100 cada.
 */
export type CatalogosDaGaveta =
  | { readonly status: "carregando" }
  | { readonly status: "erro" }
  | ({ readonly status: "dados" } & Readonly<
      Record<GrupoDeCatalogo, readonly ReferenciaDoCatalogo[]>
    >);

export const ROTULO_DO_GRUPO: Readonly<
  Record<keyof FiltrosDaListagem, string>
> = {
  departamentos: "Departamento",
  areas: "Área",
  centrosCusto: "Centro de custo",
  unidades: "Unidade",
  cargos: "Cargo",
  niveis: "Nível",
  tipos: "Tipo de contrato",
  generos: "Gênero",
};

export const FALHA_DOS_CATALOGOS =
  "Não foi possível carregar departamentos, áreas, centros de custo, unidades e cargos.";

/** Quanto esperar depois da última marcação para contar. */
export const ESPERA_DA_CONTAGEM_MS = 250;

export function rotuloDaReferencia(ref: {
  nome: string;
  codigo: string;
}): string {
  return `${ref.nome} (${ref.codigo})`;
}

function alternar<T>(lista: readonly T[], valor: T): T[] {
  return lista.includes(valor)
    ? lista.filter((v) => v !== valor)
    : [...lista, valor];
}

export interface GavetaDeFiltrosProps {
  readonly aberta: boolean;
  readonly onFechar: () => void;
  /** Os filtros aplicados: o rascunho começa deles a cada abertura. */
  readonly filtros: FiltrosDaListagem;
  /** A aba tem lotação (Ativos, Todos): mostra os grupos de lotação. */
  readonly comLotacao: boolean;
  readonly catalogos: CatalogosDaGaveta;
  readonly repetindoCatalogos: boolean;
  readonly onRecarregarCatalogos: () => void;
  /** Anúncio único da falha de uma recarga (o fundo fica inerte). */
  readonly anuncioDosCatalogos: string;
  /** `id` do bloco dos grupos de lotação (destino do foco na recarga). */
  readonly idDosGruposDeLotacao: string;
  readonly rotuloDoNivel: (nivel: string) => string;
  readonly rotuloDoTipo: (tipo: string) => string;
  readonly rotuloDoGenero: (genero: string) => string;
  /** Conta, no servidor, quantos o rascunho traria. */
  readonly contar: (
    rascunho: FiltrosDaListagem,
    sinal: AbortSignal,
  ) => Promise<number>;
  readonly onAplicar: (rascunho: FiltrosDaListagem) => void;
}

export function GavetaDeFiltros({
  aberta,
  onFechar,
  filtros,
  comLotacao,
  catalogos,
  repetindoCatalogos,
  onRecarregarCatalogos,
  anuncioDosCatalogos,
  idDosGruposDeLotacao,
  rotuloDoNivel,
  rotuloDoTipo,
  rotuloDoGenero,
  contar,
  onAplicar,
}: GavetaDeFiltrosProps) {
  const prefixo = useId();
  const [rascunho, setRascunho] = useState<FiltrosDaListagem>(filtros);
  const [contagem, setContagem] = useState<number | null>(null);

  // Cada abertura parte dos filtros aplicados.
  useEffect(() => {
    if (aberta) setRascunho(filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  // A contagem ao vivo: espera a última marcação e cancela a anterior.
  const contarRef = useRef(contar);
  contarRef.current = contar;
  const chave = JSON.stringify(rascunho);
  useEffect(() => {
    if (!aberta) return;
    setContagem(null);
    const controle = new AbortController();
    const espera = setTimeout(() => {
      contarRef
        .current(rascunho, controle.signal)
        .then((n) => {
          if (!controle.signal.aborted) setContagem(n);
        })
        .catch(() => {
          if (!controle.signal.aborted) setContagem(null);
        });
    }, ESPERA_DA_CONTAGEM_MS);
    return () => {
      clearTimeout(espera);
      controle.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, chave]);

  function marcar<K extends keyof FiltrosDaListagem>(
    grupo: K,
    valor: FiltrosDaListagem[K][number],
  ) {
    setRascunho((r) => ({
      ...r,
      [grupo]: alternar(r[grupo] as readonly string[], valor),
    }));
  }

  const rotuloDoBotao =
    contagem === null
      ? "Ver resultados"
      : contagem === 1
        ? "Ver 1 resultado"
        : `Ver ${contagem} resultados`;

  function grupoDeCaixas(
    grupo: keyof FiltrosDaListagem,
    opcoes: readonly { readonly valor: string; readonly rotulo: string }[],
    vazio: string,
  ) {
    const marcados = rascunho[grupo] as readonly string[];
    return (
      <fieldset key={grupo} className="gaveta-filtros__grupo">
        <legend className="gaveta-filtros__legenda">
          {ROTULO_DO_GRUPO[grupo]}
        </legend>
        {opcoes.length === 0 ? (
          <p className="gaveta-filtros__vazio">{vazio}</p>
        ) : (
          <ul className="gaveta-filtros__opcoes">
            {opcoes.map((o) => {
              const id = `${prefixo}-${grupo}-${o.valor}`;
              return (
                <li key={o.valor}>
                  <input
                    id={id}
                    type="checkbox"
                    className="gaveta-filtros__caixa"
                    checked={marcados.includes(o.valor)}
                    onChange={() => marcar(grupo, o.valor as never)}
                  />
                  <label htmlFor={id}>{o.rotulo}</label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>
    );
  }

  function grupoDeChips(
    grupo: "tipos" | "generos",
    opcoes: readonly { readonly valor: string; readonly rotulo: string }[],
  ) {
    const marcados = rascunho[grupo] as readonly string[];
    return (
      <fieldset key={grupo} className="gaveta-filtros__grupo">
        <legend className="gaveta-filtros__legenda">
          {ROTULO_DO_GRUPO[grupo]}
        </legend>
        <div className="gaveta-filtros__chips">
          {opcoes.map((o) => {
            const ligado = marcados.includes(o.valor);
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={ligado}
                className={
                  ligado
                    ? "gaveta-filtros__chip gaveta-filtros__chip--ligado"
                    : "gaveta-filtros__chip"
                }
                onClick={() => marcar(grupo, o.valor as never)}
              >
                {o.rotulo}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const deCatalogo = (grupo: GrupoDeCatalogo) =>
    catalogos.status === "dados"
      ? catalogos[grupo].map((r) => ({
          valor: r.id,
          rotulo: rotuloDaReferencia(r),
        }))
      : [];

  return (
    <Sheet
      aberto={aberta}
      titulo="Filtrar"
      onFechar={onFechar}
      className="gaveta-filtros"
      rodape={
        <>
          <Button variant="subtle" onClick={() => setRascunho(FILTROS_VAZIOS)}>
            Limpar filtros
          </Button>
          <Button variant="primary" onClick={() => onAplicar(rascunho)}>
            {rotuloDoBotao}
          </Button>
        </>
      }
    >
      <div className="gaveta-filtros__corpo">
        {comLotacao ? (
          <div
            id={idDosGruposDeLotacao}
            tabIndex={-1}
            className="gaveta-filtros__lotacao"
          >
            {catalogos.status === "erro" || repetindoCatalogos ? (
              <div className="gaveta-filtros__falha">
                <p>{FALHA_DOS_CATALOGOS}</p>
                <Button
                  variant="subtle"
                  aria-disabled={repetindoCatalogos}
                  onClick={onRecarregarCatalogos}
                >
                  Recarregar
                </Button>
              </div>
            ) : catalogos.status === "carregando" ? (
              <p className="gaveta-filtros__vazio" role="status">
                Carregando…
              </p>
            ) : (
              GRUPOS_DE_CATALOGO.map((g) =>
                grupoDeCaixas(g, deCatalogo(g), "Nenhum cadastrado."),
              )
            )}
            {grupoDeCaixas(
              "niveis",
              NIVEIS_DE_CARREIRA.map((n) => ({
                valor: n,
                rotulo: rotuloDoNivel(n),
              })),
              "",
            )}
          </div>
        ) : null}
        {grupoDeChips(
          "tipos",
          TIPOS_DE_VINCULO.map((t) => ({ valor: t, rotulo: rotuloDoTipo(t) })),
        )}
        {grupoDeChips(
          "generos",
          GENEROS_DO_PERFIL.map((g) => ({
            valor: g,
            rotulo: rotuloDoGenero(g),
          })),
        )}
        <p
          className="gaveta-filtros__anuncio colaboradores-screen__so-leitor"
          role="status"
        >
          {anuncioDosCatalogos}
        </p>
        <p className="colaboradores-screen__so-leitor" role="status">
          {contagem === null
            ? ""
            : contagem === 1
              ? "1 resultado com estes filtros."
              : `${contagem} resultados com estes filtros.`}
        </p>
      </div>
    </Sheet>
  );
}
