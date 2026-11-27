/**
 * T216 — a galeria de modelos: categorias, busca, um card por modelo (nome,
 * descrição e quantidade de perguntas) e a gaveta "Ver perguntas". A
 * quantidade vem de `totalDePerguntas`, a mesma do assistente.
 */
import { useId, useState } from "react";
import type { ModeloPesquisa } from "../../api/pesquisasClient";
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { Sheet } from "../../ui";
import { IconeMais, IconeVer } from "../../ui/icones";
import {
  CATEGORIAS_DE_MODELO,
  MODELOS_DE_PESQUISA,
  totalDePerguntas,
  type CategoriaDoModelo,
  type ModeloDaGaleria,
} from "./modelosDePesquisa";
import { ROTULO_DO_TIPO } from "./textosDasPesquisas";

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function quantidade(m: ModeloDaGaleria): string {
  const n = totalDePerguntas(m);
  return n === 0 ? "Em branco" : plural(n, "pergunta", "perguntas");
}

export function GaleriaDeModelos({
  onUsar,
  titulo = "Modelos",
}: {
  readonly onUsar: (modelo: ModeloPesquisa) => void;
  readonly titulo?: string;
}) {
  const idTitulo = useId();
  const [categoria, setCategoria] = useState<CategoriaDoModelo | null>(null);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<ModeloDaGaleria | null>(null);

  const termo = semAcento(busca.trim());
  const visiveis = MODELOS_DE_PESQUISA.filter(
    (m) =>
      (categoria === null || m.categoria === categoria) &&
      (!termo || semAcento(`${m.nome} ${m.descricao}`).includes(termo)),
  );
  const grupos = (Object.keys(CATEGORIAS_DE_MODELO) as CategoriaDoModelo[])
    .map((c) => ({ c, modelos: visiveis.filter((m) => m.categoria === c) }))
    .filter((g) => g.modelos.length > 0);

  return (
    <section className="pesquisas__galeria" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="pesquisas__galeria-titulo">
        {titulo}
      </h2>
      <div className="pesquisas__filtros">
        <input
          type="search"
          className="pesquisas__busca"
          aria-label="Buscar modelo"
          placeholder="Buscar modelo"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="pesquisas__pilulas" role="group" aria-label="Categoria">
          <button
            type="button"
            aria-pressed={categoria === null}
            onClick={() => setCategoria(null)}
          >
            Todos
          </button>
          {(Object.keys(CATEGORIAS_DE_MODELO) as CategoriaDoModelo[]).map(
            (c) => (
              <button
                key={c}
                type="button"
                aria-pressed={categoria === c}
                onClick={() => setCategoria(c)}
              >
                {CATEGORIAS_DE_MODELO[c]}
              </button>
            ),
          )}
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="pesquisas__aba-vazia">
          <strong>Nenhum modelo encontrado.</strong>
          <span className="pesquisas__suave">
            Tente outra palavra ou comece pela pesquisa personalizada.
          </span>
        </div>
      ) : (
        grupos.map(({ c, modelos }) => (
          <div key={c} className="pesquisas__categoria">
            <h3 className="pesquisas__categoria-titulo">
              {CATEGORIAS_DE_MODELO[c]}
            </h3>
            <div className="pesquisas__cartoes">
              {modelos.map((m) => (
                <CartaoDoModelo
                  key={m.modelo}
                  modelo={m}
                  onVer={() => setAberto(m)}
                  onUsar={() => onUsar(m.modelo)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <Sheet
        aberto={aberto !== null}
        titulo={aberto?.nome ?? ""}
        subtitulo={aberto ? quantidade(aberto) : ""}
        onFechar={() => setAberto(null)}
        rodape={
          aberto ? (
            <Button
              onClick={() => {
                const m = aberto.modelo;
                setAberto(null);
                onUsar(m);
              }}
            >
              <IconeMais tamanho={16} />
              Usar modelo
            </Button>
          ) : null
        }
      >
        {aberto ? <PerguntasDoModelo modelo={aberto} /> : null}
      </Sheet>
    </section>
  );
}

function CartaoDoModelo({
  modelo: m,
  onVer,
  onUsar,
}: {
  readonly modelo: ModeloDaGaleria;
  readonly onVer: () => void;
  readonly onUsar: () => void;
}) {
  const id = useId();
  const vazio = totalDePerguntas(m) === 0;
  return (
    <article className="pesquisas__cartao" aria-labelledby={id}>
      <h3 id={id}>{m.nome}</h3>
      <p>{m.descricao}</p>
      <p className="pesquisas__forte">{quantidade(m)}</p>
      <div className="pesquisas__acoes">
        {vazio ? null : (
          <Button
            variant="secondary"
            aria-label={`Ver perguntas de ${m.nome}`}
            onClick={onVer}
          >
            <IconeVer tamanho={16} />
            Ver perguntas
          </Button>
        )}
        <Button aria-label={`Usar o modelo ${m.nome}`} onClick={onUsar}>
          Usar modelo
        </Button>
      </div>
    </article>
  );
}

function PerguntasDoModelo({ modelo }: { readonly modelo: ModeloDaGaleria }) {
  let n = 0;
  return (
    <div>
      <p className="pesquisas__suave">{modelo.descricao}</p>
      {modelo.secoes.map((s, i) => (
        <div key={i}>
          {s.titulo ? (
            <h3 className="pesquisas__gaveta-secao">{s.titulo}</h3>
          ) : null}
          <ol className="pesquisas__gaveta-lista" start={n + 1}>
            {s.perguntas.map((p) => {
              n += 1;
              return (
                <li key={n}>
                  {p.texto}
                  <span className="pesquisas__suave">
                    {` · ${ROTULO_DO_TIPO[p.tipo]}${p.obrigatoria === false ? " · opcional" : ""}${p.condicao ? " · condicional" : ""}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
