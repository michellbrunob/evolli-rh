/**
 * T216 — a galeria de modelos: pílulas de categoria com contador, busca,
 * uma seção por categoria (título, contador e frase) e os cards em duas
 * colunas (ícone colorido, selo, descrição, destaques, "Ver perguntas" e
 * "Usar modelo"). "Ver perguntas" abre a gaveta com as perguntas numeradas
 * e o comentário final à parte. A quantidade do card, da gaveta e do
 * assistente sai de `totalDePerguntas`.
 */
import { useId, useState } from "react";
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { Sheet } from "../../ui";
import { IconeDocumento, IconeStatus, IconeVer } from "../../ui/icones";
import { CampoDeBusca, IconeDoModelo, Pilulas } from "./componentes";
import {
  CATEGORIAS_DE_MODELO,
  MODELOS_DE_PESQUISA,
  perguntasPrincipais,
  secoesDoModelo,
  totalDePerguntas,
  type ModeloDaGaleria,
} from "./modelosDePesquisa";
import { perguntasEmOrdem } from "./estadoDaPesquisa";

export const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function quantidadeDoModelo(m: ModeloDaGaleria): string {
  const n = totalDePerguntas(m);
  return n === 0
    ? "Você escolhe as perguntas"
    : plural(n, "pergunta", "perguntas");
}

/** Os modelos que casam com o texto (nome ou descrição, sem acento). */
export function filtrarModelos<T extends ModeloDaGaleria>(
  modelos: readonly T[],
  busca: string,
): T[] {
  const termo = semAcento(busca.trim());
  return modelos.filter(
    (m) => !termo || semAcento(`${m.nome} ${m.descricao}`).includes(termo),
  );
}

export function GaleriaDeModelos({
  onUsar,
  onSobre,
  comRecomendacao = false,
}: {
  readonly onUsar: (id: string) => void;
  readonly onSobre: (id: string) => void;
  /** Página inicial: o modelo recomendado ganha selo e botão cheio. */
  readonly comRecomendacao?: boolean;
}) {
  const [categoria, setCategoria] = useState<
    "todas" | keyof typeof CATEGORIAS_DE_MODELO
  >("todas");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<ModeloDaGaleria | null>(null);

  const daBusca = filtrarModelos(MODELOS_DE_PESQUISA, busca);
  const chaves = Object.keys(
    CATEGORIAS_DE_MODELO,
  ) as (keyof typeof CATEGORIAS_DE_MODELO)[];
  const grupos = chaves
    .filter((c) => categoria === "todas" || categoria === c)
    .map((c) => ({ c, modelos: daBusca.filter((m) => m.categoria === c) }))
    .filter((g) => g.modelos.length > 0);

  return (
    <div className="pesquisas__galeria">
      <div className="pesquisas__filtros">
        <Pilulas
          rotulo="Categoria"
          valor={categoria}
          onMudar={setCategoria}
          opcoes={[
            {
              valor: "todas",
              rotulo: "Todos",
              contagem: MODELOS_DE_PESQUISA.length,
            },
            ...chaves.map((c) => ({
              valor: c,
              rotulo: CATEGORIAS_DE_MODELO[c].nome,
              contagem: MODELOS_DE_PESQUISA.filter((m) => m.categoria === c)
                .length,
            })),
          ]}
        />
        <CampoDeBusca rotulo="Buscar modelo" valor={busca} onMudar={setBusca} />
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
          <section
            key={c}
            className="pesquisas__categoria"
            aria-labelledby={`categoria-${c}`}
          >
            <header className="pesquisas__categoria-cabeca">
              <h2 id={`categoria-${c}`} className="pesquisas__categoria-titulo">
                {CATEGORIAS_DE_MODELO[c].nome}
              </h2>
              <span className="pesquisas__contagem">{modelos.length}</span>
              <span className="pesquisas__suave">
                {CATEGORIAS_DE_MODELO[c].texto}
              </span>
            </header>
            <div className="pesquisas__cartoes">
              {modelos.map((m) => (
                <CartaoDoModelo
                  key={m.id}
                  modelo={m}
                  recomendado={comRecomendacao && m.selo === "recomendado"}
                  onVer={() => setAberto(m)}
                  onUsar={() => onUsar(m.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <GavetaDoModelo
        modelo={aberto}
        onFechar={() => setAberto(null)}
        onUsar={(id) => {
          setAberto(null);
          onUsar(id);
        }}
        onSobre={(id) => {
          setAberto(null);
          onSobre(id);
        }}
      />
    </div>
  );
}

export function CartaoDoModelo({
  modelo: m,
  recomendado,
  onVer,
  onUsar,
}: {
  readonly modelo: ModeloDaGaleria;
  readonly recomendado: boolean;
  readonly onVer: () => void;
  readonly onUsar: () => void;
}) {
  const id = useId();
  return (
    <article
      className="pesquisas__cartao"
      aria-labelledby={id}
      {...(recomendado ? { "data-recomendado": "" } : {})}
    >
      <div className="pesquisas__cartao-topo">
        <IconeDoModelo id={m.id} tamanho="lg" />
        {recomendado ? (
          <span className="pesquisas__selo pesquisas__selo--destaque">
            <span className="pesquisas__ponto" aria-hidden="true" />
            Recomendado para começar
          </span>
        ) : m.selo === "novo" ? (
          <span className="pesquisas__selo pesquisas__selo--destaque">
            Novo
          </span>
        ) : null}
      </div>
      <h3 id={id}>{m.nome}</h3>
      <p className="pesquisas__cartao-descricao">{m.descricao}</p>
      <ul className="pesquisas__destaques">
        <li>
          <IconeDocumento tamanho={14} />
          {quantidadeDoModelo(m)}
        </li>
        {m.destaques.slice(0, 2).map((d) => (
          <li key={d}>
            <IconeStatus tamanho={14} />
            {d}
          </li>
        ))}
      </ul>
      <div className="pesquisas__cartao-rodape">
        <button
          type="button"
          className="pesquisas__acao-texto"
          aria-label={`Ver perguntas de ${m.nome}`}
          onClick={onVer}
        >
          <IconeVer tamanho={16} />
          Ver perguntas
        </button>
        {recomendado ? (
          <Button aria-label={`Usar o modelo ${m.nome}`} onClick={onUsar}>
            Usar modelo →
          </Button>
        ) : (
          <button
            type="button"
            className="pesquisas__acao-texto pesquisas__acao-texto--primaria"
            aria-label={`Usar o modelo ${m.nome}`}
            onClick={onUsar}
          >
            Usar modelo →
          </button>
        )}
      </div>
    </article>
  );
}

/** A gaveta "Ver perguntas": perguntas numeradas e o comentário final à parte. */
export function GavetaDoModelo({
  modelo,
  onFechar,
  onUsar,
  onSobre,
}: {
  readonly modelo: ModeloDaGaleria | null;
  readonly onFechar: () => void;
  readonly onUsar: (id: string) => void;
  readonly onSobre?: (id: string) => void;
}) {
  const m = modelo;
  const n = m ? totalDePerguntas(m) : 0;
  const principais = m
    ? perguntasEmOrdem(secoesDoModelo(m)).slice(0, perguntasPrincipais(m))
    : [];
  const doisDigitos = (i: number) => String(i).padStart(2, "0");
  return (
    <Sheet
      aberto={m !== null}
      titulo={m?.nome ?? ""}
      subtitulo={
        m
          ? n === 0
            ? "Você monta as perguntas do zero"
            : `${plural(n, "pergunta pronta", "perguntas prontas")} · dá para ajustar antes de enviar`
          : ""
      }
      icone={m ? <IconeDoModelo id={m.id} /> : undefined}
      onFechar={onFechar}
      rodape={
        m ? (
          <div className="pesquisas__gaveta-rodape">
            {onSobre ? (
              <Button variant="secondary" onClick={() => onSobre(m.id)}>
                Sobre o modelo
              </Button>
            ) : null}
            <Button onClick={() => onUsar(m.id)}>Usar modelo →</Button>
          </div>
        ) : null
      }
    >
      {m ? (
        n === 0 ? (
          <p className="pesquisas__suave">{m.sobre}</p>
        ) : (
          <div className="pesquisas__gaveta">
            <ol className="pesquisas__lista-numerada" aria-label="Perguntas">
              {principais.map((p, i) => (
                <li key={p.id}>
                  <span
                    className="pesquisas__numero-pergunta"
                    aria-hidden="true"
                  >
                    {doisDigitos(i + 1)}
                  </span>
                  <span>{p.texto}</span>
                </li>
              ))}
            </ol>
            {m.comentarioFinal ? (
              <>
                <p className="pesquisas__gaveta-grupo">
                  Comentário final (opcional)
                  <span className="pesquisas__suave"> · 1</span>
                </p>
                <ol
                  className="pesquisas__lista-numerada"
                  aria-label="Comentário final"
                  start={principais.length + 1}
                >
                  <li>
                    <span
                      className="pesquisas__numero-pergunta"
                      aria-hidden="true"
                    >
                      {doisDigitos(principais.length + 1)}
                    </span>
                    <span>{m.comentarioFinal}</span>
                  </li>
                </ol>
              </>
            ) : null}
          </div>
        )
      ) : null}
    </Sheet>
  );
}
