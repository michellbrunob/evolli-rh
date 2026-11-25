/**
 * T215 — a gaveta "Filtros" do quadro da escala (painel lateral `Sheet`:
 * `role="dialog"`, foco preso, Escape e "Fechar"), como a referência:
 *
 * - o que se marca aqui é um RASCUNHO: o quadro só muda em "Ver N pessoas";
 *   fechar (×, Esc) descarta e, ao reabrir, volta o que está aplicado;
 * - no topo, "N de M pessoas no quadro" e "Limpar tudo";
 * - Visões salvas (quando houver), Atalhos e os grupos: listas de caixas
 *   (Unidade, Departamento), pílulas (Tipo de contrato, Turno) e linhas que
 *   abrem (Gestor, Cargo, Área, Centro de custo, Nível, Gênero), todas de
 *   várias opções, com contagem facetada (zero fica apagado);
 * - rodapé: "Salvar como visão" e "Ver N pessoas".
 */
import { type ReactNode, useEffect, useId, useState } from "react";
import type { PessoaDoQuadroApi } from "../../../api/escalaClient";
import { plural } from "../../../format/plural";
import { Button, Sheet } from "../../../ui";
import { IconeAvancar, IconeEstrela } from "../../../ui/icones";
import { corDoTurno } from "../turnos/turnos";
import {
  ATALHOS_DO_FILTRO,
  type ContextoDoFiltro,
  FILTROS_DO_QUADRO_VAZIOS,
  type FiltrosDoQuadro,
  GRUPOS_DO_FILTRO,
  type GrupoDoFiltro,
  ROTULO_DO_ATALHO,
  type RotulosDosCodigos,
  SEM_VALOR,
  alternarOpcao,
  contagemDoAtalho,
  opcoesDo,
  quantosFiltros,
  resumoDoGrupo,
} from "./filtrosDoQuadro";
import { iniciais } from "./quadroDaEscala";

export interface VisaoSalvaDoQuadro {
  readonly id: string;
  readonly nome: string;
  readonly filtros: FiltrosDoQuadro;
}

export interface GavetaDoQuadroProps {
  readonly aberta: boolean;
  readonly pessoas: readonly PessoaDoQuadroApi[];
  /** Os filtros aplicados no quadro (o rascunho começa deles). */
  readonly filtros: FiltrosDoQuadro;
  readonly contexto: ContextoDoFiltro;
  readonly rotulos: RotulosDosCodigos;
  /** Quantas pessoas passam nestes filtros (com a busca do quadro). */
  readonly contar: (f: FiltrosDoQuadro) => number;
  readonly onAplicar: (filtros: FiltrosDoQuadro) => void;
  readonly onFechar: () => void;
  /** Visões salvas de quem usa (só quem tem). */
  readonly visoes?: readonly VisaoSalvaDoQuadro[];
  readonly onSalvarVisao?: (filtros: FiltrosDoQuadro) => void;
  readonly onGerenciarVisoes?: () => void;
}

export function GavetaDoQuadro({
  aberta,
  pessoas,
  filtros,
  contexto,
  rotulos,
  contar,
  onAplicar,
  onFechar,
  visoes = [],
  onSalvarVisao,
  onGerenciarVisoes,
}: GavetaDoQuadroProps) {
  const prefixo = useId();
  const [rascunho, setRascunho] = useState(filtros);
  const [abertos, setAbertos] = useState<ReadonlySet<GrupoDoFiltro>>(
    () => new Set(),
  );
  // Ao abrir, o rascunho começa do que está aplicado.
  useEffect(() => {
    if (aberta) {
      setRascunho(filtros);
      setAbertos(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  const quantas = contar(rascunho);
  const ligados = quantosFiltros(rascunho);
  const alternarGrupo = (g: GrupoDoFiltro) =>
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(g)) novo.delete(g);
      else novo.add(g);
      return novo;
    });
  // O gestor também é pessoa do quadro: cargo e departamento ao lado.
  const subtituloDoGestor = (id: string): string | null => {
    const p = pessoas.find((x) => x.colaboradorId === id);
    if (!p) return null;
    return (
      [p.cargo?.nome, p.departamento?.nome].filter(Boolean).join(" · ") || null
    );
  };

  return (
    <Sheet
      aberto={aberta}
      titulo="Filtros"
      subtitulo={`${quantas} de ${plural(pessoas.length, "pessoa", "pessoas")} no quadro`}
      onFechar={onFechar}
      className="gaveta-quadro"
      acaoDoCabecalho={
        ligados > 0 ? (
          <Button
            variant="subtle"
            onClick={() => setRascunho(FILTROS_DO_QUADRO_VAZIOS)}
          >
            Limpar tudo
          </Button>
        ) : null
      }
      rodape={
        <>
          {onSalvarVisao ? (
            <Button
              variant="subtle"
              className="gaveta-quadro__salvar"
              disabled={ligados === 0}
              onClick={() => onSalvarVisao(rascunho)}
            >
              <IconeEstrela tamanho={16} />
              Salvar como visão
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => onAplicar(rascunho)}>
            {`Ver ${plural(quantas, "pessoa", "pessoas")}`}
          </Button>
        </>
      }
    >
      <div className="gaveta-quadro__corpo">
        <p className="sr-only" role="status">
          {`${quantas} de ${plural(pessoas.length, "pessoa", "pessoas")} no quadro`}
        </p>

        {visoes.length > 0 ? (
          <section
            className="gaveta-quadro__grupo"
            aria-labelledby={`${prefixo}-visoes`}
          >
            <div className="gaveta-quadro__cabeca">
              <h3 id={`${prefixo}-visoes`} className="gaveta-quadro__legenda">
                Visões salvas
              </h3>
              {onGerenciarVisoes ? (
                <button
                  type="button"
                  className="gaveta-quadro__link"
                  onClick={onGerenciarVisoes}
                >
                  Gerenciar
                </button>
              ) : null}
            </div>
            <div className="gaveta-quadro__pilulas">
              {visoes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="gaveta-quadro__pilula"
                  aria-pressed={
                    JSON.stringify(v.filtros) === JSON.stringify(rascunho)
                  }
                  onClick={() => setRascunho(v.filtros)}
                >
                  {v.nome}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section
          className="gaveta-quadro__grupo"
          aria-labelledby={`${prefixo}-atalhos`}
        >
          <h3 id={`${prefixo}-atalhos`} className="gaveta-quadro__legenda">
            Atalhos
          </h3>
          <div className="gaveta-quadro__pilulas">
            {ATALHOS_DO_FILTRO.map((a) => {
              const n = contagemDoAtalho(pessoas, a, rascunho, contexto);
              return (
                <Pilula
                  key={a}
                  ligada={rascunho[a]}
                  zerada={n === 0 && !rascunho[a]}
                  quantas={n}
                  onClick={() =>
                    setRascunho({ ...rascunho, [a]: !rascunho[a] })
                  }
                >
                  {ROTULO_DO_ATALHO[a]}
                </Pilula>
              );
            })}
          </div>
        </section>

        {GRUPOS_DO_FILTRO.map(({ grupo, rotulo, todos, forma }) => {
          const opcoes = opcoesDo(pessoas, grupo, rascunho, contexto, rotulos);
          const marcados = rascunho[grupo];
          const idTitulo = `${prefixo}-${grupo}`;
          const titulo = (
            <h3 id={idTitulo} className="gaveta-quadro__legenda">
              {rotulo}
              {marcados.length > 0 ? (
                <span className="gaveta-quadro__marcados">
                  <span aria-hidden="true">{marcados.length}</span>
                  <span className="sr-only">
                    {`, ${plural(marcados.length, "marcado", "marcados")}`}
                  </span>
                </span>
              ) : null}
            </h3>
          );
          if (forma === "recolhida" && !abertos.has(grupo)) {
            return (
              <section
                key={grupo}
                className="gaveta-quadro__grupo gaveta-quadro__grupo--linha"
              >
                <button
                  type="button"
                  className="gaveta-quadro__linha"
                  aria-expanded={false}
                  onClick={() => alternarGrupo(grupo)}
                >
                  <span className="gaveta-quadro__linha-rotulo">
                    {rotulo}
                    {marcados.length > 0 ? (
                      <span
                        className="gaveta-quadro__marcados"
                        aria-hidden="true"
                      >
                        {marcados.length}
                      </span>
                    ) : null}
                  </span>
                  <span className="gaveta-quadro__linha-resumo">
                    {resumoDoGrupo(opcoes, marcados, todos)}
                  </span>
                  <IconeAvancar tamanho={14} />
                </button>
              </section>
            );
          }
          return (
            <section
              key={grupo}
              className="gaveta-quadro__grupo"
              aria-labelledby={idTitulo}
            >
              {forma === "recolhida" ? (
                <div className="gaveta-quadro__cabeca">
                  {titulo}
                  <button
                    type="button"
                    className="gaveta-quadro__link"
                    aria-expanded
                    onClick={() => alternarGrupo(grupo)}
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                titulo
              )}
              {forma === "pilulas" ? (
                <div
                  className="gaveta-quadro__pilulas"
                  role="group"
                  aria-labelledby={idTitulo}
                >
                  {opcoes.map((o) => (
                    <Pilula
                      key={o.valor}
                      ligada={marcados.includes(o.valor)}
                      zerada={o.quantas === 0 && !marcados.includes(o.valor)}
                      quantas={o.quantas}
                      cor={
                        grupo === "turnos" && o.valor !== SEM_VALOR
                          ? corDoTurno(o.cor)
                          : null
                      }
                      onClick={() =>
                        setRascunho(alternarOpcao(rascunho, grupo, o.valor))
                      }
                    >
                      {o.rotulo}
                    </Pilula>
                  ))}
                </div>
              ) : (
                <ul
                  className="gaveta-quadro__opcoes"
                  role="group"
                  aria-labelledby={idTitulo}
                >
                  {opcoes.map((o) => {
                    const id = `${prefixo}-${grupo}-${o.valor}`;
                    const sub =
                      grupo === "gestores" && o.valor !== SEM_VALOR
                        ? subtituloDoGestor(o.valor)
                        : null;
                    const marcado = marcados.includes(o.valor);
                    return (
                      <li
                        key={o.valor}
                        className={
                          o.quantas === 0 && !marcado
                            ? "gaveta-quadro__opcao--zerada"
                            : undefined
                        }
                      >
                        <input
                          id={id}
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setRascunho(alternarOpcao(rascunho, grupo, o.valor))
                          }
                        />
                        <label htmlFor={id}>
                          {grupo === "gestores" && o.valor !== SEM_VALOR ? (
                            <span
                              className="gaveta-quadro__avatar"
                              aria-hidden="true"
                            >
                              {iniciais(o.rotulo)}
                            </span>
                          ) : null}
                          <span className="gaveta-quadro__opcao-nome">
                            {o.rotulo}
                          </span>
                          {sub ? <small>{sub}</small> : null}
                        </label>
                        <span
                          className="gaveta-quadro__numero"
                          aria-label={plural(o.quantas, "pessoa", "pessoas")}
                        >
                          {o.quantas}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}

function Pilula({
  ligada,
  zerada,
  quantas,
  cor,
  onClick,
  children,
}: {
  readonly ligada: boolean;
  readonly zerada: boolean;
  readonly quantas: number;
  readonly cor?: string | null;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`gaveta-quadro__pilula${zerada ? " gaveta-quadro__pilula--zerada" : ""}`}
      aria-pressed={ligada}
      onClick={onClick}
    >
      {cor ? (
        <span
          className="gaveta-quadro__cor"
          style={{ background: cor }}
          aria-hidden="true"
        />
      ) : null}
      <span>{children}</span>
      <span
        className="gaveta-quadro__numero"
        aria-label={plural(quantas, "pessoa", "pessoas")}
      >
        {quantas}
      </span>
    </button>
  );
}
