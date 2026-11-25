/**
 * T215 — a gaveta "Filtros" do quadro da escala (painel lateral `Sheet`:
 * `role="dialog"`, foco preso, Escape e "Fechar"). O filtro vale na hora; a
 * contagem do topo e o botão "Ver N pessoas" acompanham.
 */
import { useId } from "react";
import type { PessoaDoQuadroApi } from "../../../api/escalaClient";
import { plural } from "../../../format/plural";
import { Button, Sheet } from "../../../ui";
import {
  type FiltrosDoQuadro,
  type GrupoDeLista,
  type GrupoDeSeletor,
  type RotulosDosCodigos,
  FILTROS_DO_QUADRO_VAZIOS,
  alternarOpcao,
  opcoesDo,
  semEscala,
} from "./filtrosDoQuadro";

const LISTAS: readonly [GrupoDeLista, string][] = [
  ["unidades", "Unidade"],
  ["departamentos", "Departamento"],
  ["tipos", "Tipo de contrato"],
  ["turnos", "Turno"],
];

const SELETORES: readonly [GrupoDeSeletor, string, string][] = [
  ["gestor", "Gestor", "Todos"],
  ["cargo", "Cargo", "Todos"],
  ["area", "Área", "Todas"],
  ["centroCusto", "Centro de custo", "Todos"],
  ["nivel", "Nível", "Todos"],
  ["genero", "Gênero", "Todos"],
];

export interface GavetaDoQuadroProps {
  readonly aberta: boolean;
  readonly pessoas: readonly PessoaDoQuadroApi[];
  /** Quantas pessoas passam nos filtros (com a busca). */
  readonly quantas: number;
  readonly filtros: FiltrosDoQuadro;
  readonly referencia: string;
  readonly rotulos: RotulosDosCodigos;
  /** Quem tem aviso da CLT no período. */
  readonly idsComAviso?: ReadonlySet<string>;
  readonly onMudar: (filtros: FiltrosDoQuadro) => void;
  readonly onFechar: () => void;
}

export function GavetaDoQuadro({
  aberta,
  pessoas,
  quantas,
  filtros,
  referencia,
  rotulos,
  idsComAviso = new Set(),
  onMudar,
  onFechar,
}: GavetaDoQuadroProps) {
  const prefixo = useId();
  const semEscalaQuantas = pessoas.filter(semEscala).length;

  return (
    <Sheet
      aberto={aberta}
      titulo="Filtros"
      onFechar={onFechar}
      className="gaveta-quadro"
      rodape={
        <>
          <Button
            variant="subtle"
            onClick={() => onMudar(FILTROS_DO_QUADRO_VAZIOS)}
          >
            Limpar filtros
          </Button>
          <Button variant="primary" onClick={onFechar}>
            {`Ver ${plural(quantas, "pessoa", "pessoas")}`}
          </Button>
        </>
      }
    >
      <div className="gaveta-quadro__corpo">
        <p className="gaveta-quadro__contagem" role="status">
          <strong>{quantas}</strong>
          {` de ${plural(pessoas.length, "pessoa", "pessoas")} no quadro`}
        </p>

        <fieldset className="gaveta-quadro__grupo">
          <legend className="gaveta-quadro__legenda">Atalhos</legend>
          <div className="gaveta-quadro__atalhos">
            <button
              type="button"
              className="gaveta-quadro__atalho"
              aria-pressed={filtros.comAviso}
              onClick={() =>
                onMudar({ ...filtros, comAviso: !filtros.comAviso })
              }
            >
              <span>Com aviso da CLT</span>
              <span className="gaveta-quadro__numero">
                {pessoas.filter((p) => idsComAviso.has(p.colaboradorId)).length}
              </span>
            </button>
            <button
              type="button"
              className="gaveta-quadro__atalho"
              aria-pressed={filtros.semEscala}
              onClick={() =>
                onMudar({ ...filtros, semEscala: !filtros.semEscala })
              }
            >
              <span>Sem escala</span>
              <span className="gaveta-quadro__numero">{semEscalaQuantas}</span>
            </button>
          </div>
        </fieldset>

        {LISTAS.map(([grupo, rotulo]) => {
          const opcoes = opcoesDo(pessoas, grupo, referencia, rotulos);
          return (
            <fieldset key={grupo} className="gaveta-quadro__grupo">
              <legend className="gaveta-quadro__legenda">{rotulo}</legend>
              <ul className="gaveta-quadro__opcoes">
                {opcoes.map((o) => {
                  const id = `${prefixo}-${grupo}-${o.valor}`;
                  return (
                    <li key={o.valor}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={filtros[grupo].includes(o.valor)}
                        onChange={() =>
                          onMudar(alternarOpcao(filtros, grupo, o.valor))
                        }
                      />
                      <label htmlFor={id}>{o.rotulo}</label>
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
            </fieldset>
          );
        })}

        <div className="gaveta-quadro__seletores">
          {SELETORES.map(([grupo, rotulo, todos]) => {
            const opcoes = opcoesDo(pessoas, grupo, referencia, rotulos);
            return (
              <label key={grupo} className="gaveta-quadro__seletor">
                <span>{rotulo}</span>
                <select
                  value={filtros[grupo]}
                  onChange={(e) =>
                    onMudar({ ...filtros, [grupo]: e.target.value })
                  }
                >
                  <option value="">{todos}</option>
                  {opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {`${o.rotulo} (${o.quantas})`}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
