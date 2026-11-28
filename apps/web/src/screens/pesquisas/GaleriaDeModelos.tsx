/**
 * T216 — a galeria de modelos (passo 1 de 4): chips das 4 categorias com
 * contador ("Todos 12"), busca sem acento, o quadro "Precisa cumprir a
 * NR-1?" (o botão leva ao chip "Saúde e NR-1" e some), uma seção por
 * categoria (título, contador e frase) e os cards em duas colunas (ícone no
 * tom do modelo, selo, título, descrição, fatos com ícone, "Ver perguntas"
 * e "Usar modelo →"). "Ver perguntas" abre a gaveta com as perguntas por
 * grupo; o rodapé leva a "Sobre o modelo" e ao assistente.
 */
import { useId, useState } from "react";
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { Sheet } from "../../ui";
import { IconeEscudoNr1, IconeVer } from "../../ui/icones";
import {
  CampoDeBusca,
  ICONE_DO_FATO,
  IconeDoModelo,
  Pilulas,
} from "./componentes";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import {
  CATEGORIAS_DE_MODELO,
  MODELOS_DE_PESQUISA,
  ehComentarioDeDimensao,
  secoesDoModelo,
  totalDePerguntas,
  type CategoriaDoModelo,
  type ModeloDaGaleria,
  type SeloDoModelo,
} from "./modelosDePesquisa";
import { textoParaOPainel } from "./modelos/empresa";
import "./modelos/Galeria.css";

export const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

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
  const termo = semAcento(busca);
  return modelos.filter(
    (m) => !termo || semAcento(`${m.nome} ${m.descricao}`).includes(termo),
  );
}

const TEXTO_DO_SELO: Readonly<Record<SeloDoModelo, string>> = {
  novo: "Novo",
  nr1: "NR-1",
  complementa_nr1: "Complementa NR-1",
};

/** O selo do card ("Novo" rosa; "NR-1" e "Complementa NR-1" verdes). */
export function SeloDoModeloNoCard({ selo }: { readonly selo: SeloDoModelo }) {
  return (
    <span
      className="galeria__selo"
      data-tom={selo === "novo" ? "rosa" : "verde"}
    >
      {TEXTO_DO_SELO[selo]}
    </span>
  );
}

type Filtro = "todas" | CategoriaDoModelo;

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
  const [categoria, setCategoria] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<ModeloDaGaleria | null>(null);
  const [nr1Visto, setNr1Visto] = useState(false);

  const daBusca = filtrarModelos(MODELOS_DE_PESQUISA, busca);
  const chaves = Object.keys(CATEGORIAS_DE_MODELO) as CategoriaDoModelo[];
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

      <section className="galeria__nr1" aria-labelledby="galeria-nr1-titulo">
        <span className="galeria__nr1-icone" aria-hidden="true">
          <IconeEscudoNr1 tamanho={22} />
        </span>
        <div className="galeria__nr1-textos">
          <h2 id="galeria-nr1-titulo" className="galeria__nr1-titulo">
            Precisa cumprir a NR-1?
            <span className="galeria__selo" data-tom="verde">
              Portaria MTE 1.419/2024
            </span>
          </h2>
          <p className="pesquisas__suave">
            A NR-1 pede a avaliação dos riscos psicossociais no trabalho. O
            modelo de Riscos psicossociais cobre os 8 domínios, e o de Saúde
            financeira complementa com o bem-estar financeiro.
          </p>
        </div>
        {nr1Visto ? null : (
          <Button
            variant="secondary"
            onClick={() => {
              setCategoria("saude");
              setNr1Visto(true);
            }}
          >
            Ver os 2 modelos →
          </Button>
        )}
      </section>

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
                {CATEGORIAS_DE_MODELO[c].titulo}
              </h2>
              <span className="pesquisas__contagem">{modelos.length}</span>
              {CATEGORIAS_DE_MODELO[c].texto ? (
                <span className="pesquisas__suave">
                  {CATEGORIAS_DE_MODELO[c].texto}
                </span>
              ) : null}
            </header>
            <div className="pesquisas__cartoes">
              {modelos.map((m) => (
                <CartaoDoModelo
                  key={m.id}
                  modelo={m}
                  recomendado={comRecomendacao && m.recomendado === true}
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

/** O card: todo ele leva ao assistente; "Ver perguntas" abre a gaveta. */
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
  const IconeFormato = ICONE_DO_FATO.duas_pessoas;
  return (
    <article
      className="pesquisas__cartao galeria__cartao"
      aria-labelledby={id}
      onClick={(e) => {
        // O card inteiro é clicável; os botões de dentro decidem sozinhos.
        if ((e.target as HTMLElement).closest("button")) return;
        onUsar();
      }}
      {...(recomendado ? { "data-recomendado": "" } : {})}
    >
      <div className="pesquisas__cartao-topo">
        <IconeDoModelo id={m.id} tamanho="lg" />
        {recomendado ? (
          <span className="pesquisas__selo pesquisas__selo--destaque">
            <span className="pesquisas__ponto" aria-hidden="true" />
            Recomendado para começar
          </span>
        ) : m.selo ? (
          <SeloDoModeloNoCard selo={m.selo} />
        ) : null}
      </div>
      <h3 id={id}>{m.nome}</h3>
      <p className="pesquisas__cartao-descricao">{m.descricao}</p>
      <ul className="pesquisas__destaques galeria__fatos">
        {m.fatos.map((f) => {
          const Icone = ICONE_DO_FATO[f.icone];
          return (
            <li key={f.texto}>
              <Icone tamanho={14} />
              {f.texto}
            </li>
          );
        })}
        {m.formato ? (
          <li>
            <IconeFormato tamanho={14} />
            {m.formato}
          </li>
        ) : null}
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

export interface GrupoDaGaveta {
  readonly titulo: string | null;
  readonly cor: string | undefined;
  readonly perguntas: readonly { id: string; texto: string }[];
  /** Sem as perguntas no catálogo: só a quantidade. */
  readonly quantidade: number;
}

/** Os grupos da gaveta: agrupamento por chave, seções ou grupos resumidos. */
export function gruposDaGaveta(m: ModeloDaGaleria): GrupoDaGaveta[] {
  if (m.secoes.length === 0 && m.grupos) {
    return m.grupos.map((g) => ({
      titulo: g.titulo,
      cor: g.cor,
      perguntas: [],
      quantidade: g.quantidade,
    }));
  }
  const secoes = secoesDoModelo(m);
  const todas = perguntasEmOrdem(secoes).filter(
    (p) => !ehComentarioDeDimensao(p),
  );
  // Bloco do DISC: as 4 frases (o enunciado é o mesmo em todos).
  const comTexto = (ps: typeof todas) =>
    ps.map((p) => ({
      id: p.id,
      texto:
        p.tipo === "escolha_forcada"
          ? (p.config.opcoes ?? []).map((o) => o.texto).join(" · ")
          : textoParaOPainel(p.texto),
    }));
  if (m.agrupamento) {
    return m.agrupamento.map((g) => {
      const ps = todas.filter((p) => p.chave && g.chaves.includes(p.chave));
      return {
        titulo: g.titulo,
        cor: g.cor,
        perguntas: comTexto(ps),
        quantidade: ps.length,
      };
    });
  }
  const comentarioId =
    m.comentarioFinal && todas.length > 0 ? todas.at(-1)!.id : null;
  const grupos: GrupoDaGaveta[] = m.secoes.map((s, i) => {
    const ps = secoes[i]!.perguntas.filter(
      (p) => !ehComentarioDeDimensao(p) && p.id !== comentarioId,
    );
    return {
      titulo: s.titulo,
      cor: s.cor,
      perguntas: comTexto(ps),
      quantidade: ps.length,
    };
  });
  if (m.comentarioFinal) {
    grupos.push({
      titulo: "Comentário final (opcional)",
      cor: "--modelo-cinza",
      perguntas: [{ id: "comentario", texto: m.comentarioFinal }],
      quantidade: 1,
    });
  }
  return grupos.filter((g) => g.quantidade > 0);
}

/** A lista numerada de perguntas por grupo (gaveta e página "Sobre"). */
export function PerguntasPorGrupo({
  grupos,
}: {
  readonly grupos: readonly GrupoDaGaveta[];
}) {
  const doisDigitos = (i: number) => String(i).padStart(2, "0");
  let numero = 0;
  return (
    <div className="pesquisas__gaveta">
      {grupos.map((g, i) => {
        const inicio = numero + 1;
        numero += g.perguntas.length;
        return (
          <section
            key={`${g.titulo ?? "grupo"}-${i}`}
            className="galeria__gaveta-grupo"
            aria-label={g.titulo ?? "Perguntas"}
          >
            {g.titulo || grupos.length > 1 ? (
              <p className="pesquisas__gaveta-grupo">
                <span
                  className="galeria__bolinha"
                  style={{
                    background: `var(${g.cor ?? "--color-ink-subtle"})`,
                  }}
                  aria-hidden="true"
                />
                {g.titulo ?? "Perguntas"}
                <span className="pesquisas__suave">{` · ${g.quantidade}`}</span>
              </p>
            ) : null}
            {g.perguntas.length > 0 ? (
              <ol
                className="pesquisas__lista-numerada"
                start={inicio}
                aria-label={g.titulo ?? "Perguntas"}
              >
                {g.perguntas.map((p, j) => (
                  <li key={p.id}>
                    <span
                      className="pesquisas__numero-pergunta"
                      aria-hidden="true"
                    >
                      {doisDigitos(inicio + j)}
                    </span>
                    <span>{p.texto}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="pesquisas__suave galeria__gaveta-resumo">
                {plural(g.quantidade, "pergunta", "perguntas")}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** A gaveta "Ver perguntas": perguntas numeradas por grupo. */
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
  return (
    <Sheet
      aberto={m !== null}
      className="pesquisas__janela"
      titulo={m?.nome ?? ""}
      subtitulo={
        m
          ? n === 0
            ? "Você monta as perguntas do zero"
            : `${plural(n, "pergunta pronta", "perguntas prontas")} · você pode ajustar antes de enviar`
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
          <PerguntasPorGrupo grupos={gruposDaGaveta(m)} />
        )
      ) : null}
    </Sheet>
  );
}
