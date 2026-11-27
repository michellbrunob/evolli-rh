/**
 * T216 — página de entrada da pesquisa personalizada: "Copiar uma pesquisa"
 * (perguntas, seções e formato de uma personalizada já feita; participantes,
 * envio e prazo recomeçam), "Começar em branco", o aviso do rascunho em
 * andamento e roteiros curtos por categoria.
 */
import { useEffect, useState } from "react";
import type { PesquisaResumo } from "../../api/pesquisasClient";
import { Button } from "../../components";
import { formatarInstante } from "../../format/data";
import { plural } from "../../format/plural";
import { IconButton, Sheet } from "../../ui";
import {
  IconeCopiar,
  IconeDocumento,
  IconeEquipe,
  IconeMais,
  IconeVer,
  IconeVoltar,
} from "../../ui/icones";
import { CampoDeBusca, IconeDoModelo, Pilulas } from "./componentes";
import { estadoDaCopia, type EstadoDaPesquisa } from "./estadoDaPesquisa";
import { filtrarModelos, GavetaDoModelo, semAcento } from "./GaleriaDeModelos";
import {
  CATEGORIAS_PERSONALIZADAS,
  ROTEIROS_PERSONALIZADOS,
  totalDePerguntas,
  type CategoriaPersonalizada,
  type ModeloDaGaleria,
} from "./modelosDePesquisa";
import { minutosEstimados } from "./PreVisualizacao";
import { memoriaDoRascunho } from "./rascunhosLocais";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import { dataDoInstante } from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";

export function EntradaPersonalizada({
  servico,
  aviso,
  onVoltar,
  onComecar,
  onSobre,
  onCopiar,
  onContinuar,
}: {
  readonly servico: ServicoDePesquisas;
  readonly aviso?: string | null;
  /** Copiar uma pesquisa pela rota (`copia/<id>`); sem ela, abre aqui. */
  readonly onCopiar?: (id: string) => void;
  /** Continuar o rascunho pela rota (`<id>/rascunho`); sem ela, abre aqui. */
  readonly onContinuar?: (id: string) => void;
  readonly onVoltar: () => void;
  /** Abre o assistente de 5 etapas (em branco, roteiro, cópia ou rascunho). */
  readonly onComecar: (x: {
    roteiro?: string;
    inicial?: EstadoDaPesquisa;
    base?: Awaited<ReturnType<ServicoDePesquisas["obterPesquisa"]>>;
  }) => void;
  readonly onSobre: (id: string) => void;
}) {
  const [categoria, setCategoria] = useState<"todas" | CategoriaPersonalizada>(
    "todas",
  );
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState<PesquisaResumo | null>(null);
  const [copiar, setCopiar] = useState(false);
  const [aberto, setAberto] = useState<ModeloDaGaleria | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.resolve(
      servico.listarPesquisas({ status: "rascunho", tamanhoPagina: 100 }),
    )
      .then((r) => {
        const meu = (r?.itens ?? []).find((p) => p.modelo === "personalizada");
        if (vivo) setRascunho(meu ?? null);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [servico]);

  async function abrir(id: string, comoCopia: boolean) {
    if (comoCopia && onCopiar) return onCopiar(id);
    if (!comoCopia && onContinuar) return onContinuar(id);
    try {
      const d = await servico.obterPesquisa(id);
      onComecar(comoCopia ? { inicial: estadoDaCopia(d) } : { base: d });
    } catch {
      setFalha("Não foi possível abrir a pesquisa. Tente de novo.");
    }
  }

  const chaves = Object.keys(
    CATEGORIAS_PERSONALIZADAS,
  ) as CategoriaPersonalizada[];
  const visiveis = filtrarModelos(ROTEIROS_PERSONALIZADOS, busca).filter(
    (m) => categoria === "todas" || m.categoria === categoria,
  );
  const memoria = rascunho ? memoriaDoRascunho(rascunho.id) : null;

  return (
    <div className="pesquisas">
      <header className="pesquisas__cabecalho">
        <IconButton
          label="Voltar"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <IconeDoModelo id="personalizada" tamanho="lg" />
        <div className="pesquisas__titulos">
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            Pesquisa personalizada
          </h1>
          <p className="pesquisas__subtitulo">
            Parta de um roteiro e ajuste as perguntas, ou monte do zero.
          </p>
        </div>
        <div className="pesquisas__acoes-topo">
          <Button variant="secondary" onClick={() => setCopiar(true)}>
            <IconeCopiar tamanho={16} />
            Copiar uma pesquisa
          </Button>
          <Button onClick={() => onComecar({})}>
            <IconeMais tamanho={16} />
            Começar em branco
          </Button>
        </div>
      </header>

      {aviso ? (
        <p className="pesquisas__aviso" role="status">
          {aviso}
        </p>
      ) : null}
      {falha ? (
        <p className="pesquisas__erro" role="alert">
          {falha}
        </p>
      ) : null}

      {rascunho ? (
        <section
          className="pesquisas__rascunho"
          aria-label="Rascunho em andamento"
        >
          <IconeDocumento tamanho={18} />
          <div>
            <p className="pesquisas__forte">{`Há um rascunho em andamento: ${rascunho.nome}`}</p>
            <p className="pesquisas__suave">
              {memoria
                ? `Parou na etapa ${memoria.etapa} de ${memoria.totalDeEtapas} · salvo em ${formatarInstante(memoria.salvoEm)}`
                : `Criado em ${dataDoInstante(rascunho.criadaEm)}`}
            </p>
          </div>
          <Button onClick={() => void abrir(rascunho.id, false)}>
            Continuar rascunho
          </Button>
        </section>
      ) : null}

      <div className="pesquisas__filtros">
        <Pilulas
          rotulo="Categoria"
          valor={categoria}
          onMudar={setCategoria}
          opcoes={[
            {
              valor: "todas",
              rotulo: "Todos",
              contagem: ROTEIROS_PERSONALIZADOS.length,
            },
            ...chaves.map((c) => ({
              valor: c,
              rotulo: CATEGORIAS_PERSONALIZADAS[c],
              contagem: ROTEIROS_PERSONALIZADOS.filter((m) => m.categoria === c)
                .length,
            })),
          ]}
        />
        <CampoDeBusca rotulo="Buscar modelo" valor={busca} onMudar={setBusca} />
      </div>

      {visiveis.length === 0 ? (
        <div className="pesquisas__aba-vazia">
          <strong>Nenhum roteiro encontrado.</strong>
          <span className="pesquisas__suave">
            Tente outra palavra ou comece em branco.
          </span>
        </div>
      ) : (
        <div className="pesquisas__cartoes">
          {visiveis.map((m) => {
            const n = totalDePerguntas(m);
            return (
              <article
                key={m.id}
                className="pesquisas__cartao"
                aria-label={m.nome}
              >
                <IconeDoModelo id={m.id} />
                <h3>{m.nome}</h3>
                <p className="pesquisas__cartao-descricao">{m.descricao}</p>
                <ul className="pesquisas__destaques">
                  <li>
                    <IconeDocumento tamanho={14} />
                    {`${plural(n, "pergunta", "perguntas")} · ${plural(minutosEstimados(n), "min", "min")}`}
                  </li>
                  <li>
                    <IconeEquipe tamanho={14} />
                    Cada pessoa responde
                  </li>
                </ul>
                <div className="pesquisas__cartao-rodape">
                  <button
                    type="button"
                    className="pesquisas__acao-texto"
                    aria-label={`Ver perguntas de ${m.nome}`}
                    onClick={() => setAberto(m)}
                  >
                    <IconeVer tamanho={16} />
                    Ver perguntas
                  </button>
                  <button
                    type="button"
                    className="pesquisas__acao-texto pesquisas__acao-texto--primaria"
                    aria-label={`Usar o modelo ${m.nome}`}
                    onClick={() => onComecar({ roteiro: m.id })}
                  >
                    Usar modelo →
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <GavetaDoModelo
        modelo={aberto}
        onFechar={() => setAberto(null)}
        onUsar={(id) => {
          setAberto(null);
          onComecar({ roteiro: id });
        }}
        onSobre={(id) => {
          setAberto(null);
          onSobre(id);
        }}
      />

      <CopiarPesquisa
        aberto={copiar}
        servico={servico}
        onFechar={() => setCopiar(false)}
        onEscolher={(id) => {
          setCopiar(false);
          void abrir(id, true);
        }}
      />
    </div>
  );
}

/** Gaveta "Copiar uma pesquisa": as personalizadas já feitas, com busca. */
function CopiarPesquisa({
  aberto,
  servico,
  onFechar,
  onEscolher,
}: {
  readonly aberto: boolean;
  readonly servico: ServicoDePesquisas;
  readonly onFechar: () => void;
  readonly onEscolher: (id: string) => void;
}) {
  const [lista, setLista] = useState<PesquisaResumo[] | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    Promise.resolve(servico.listarPesquisas({ tamanhoPagina: 100 }))
      .then((r) => {
        if (vivo)
          setLista(
            (r?.itens ?? []).filter(
              (p) => p.modelo === "personalizada" && p.status !== "rascunho",
            ),
          );
      })
      .catch(() => {
        if (vivo) setLista([]);
      });
    return () => {
      vivo = false;
    };
  }, [aberto, servico]);

  const termo = semAcento(busca.trim());
  const visiveis = (lista ?? []).filter(
    (p) => !termo || semAcento(p.nome).includes(termo),
  );

  return (
    <Sheet
      aberto={aberto}
      titulo="Copiar uma pesquisa"
      subtitulo="Vêm as perguntas, as seções e o formato. Participantes, envio e prazo recomeçam."
      icone={<IconeCopiar tamanho={18} />}
      onFechar={onFechar}
    >
      <div className="pesquisas__etapa">
        <CampoDeBusca
          rotulo="Buscar pesquisa"
          valor={busca}
          onMudar={setBusca}
        />
        {lista === null ? (
          <p className="pesquisas__suave">Carregando…</p>
        ) : visiveis.length === 0 ? (
          <div className="pesquisas__aba-vazia">
            <strong>Nenhuma pesquisa personalizada ainda</strong>
            <span className="pesquisas__suave">
              Quando você criar uma, ela aparece aqui para copiar.
            </span>
          </div>
        ) : (
          <ul className="pesquisas__ficha-lista">
            {visiveis.map((p) => (
              <li key={p.id} className="pesquisas__ficha-item">
                <button
                  type="button"
                  className="pesquisas__ficha-botao"
                  onClick={() => onEscolher(p.id)}
                >
                  <span className="pesquisas__forte">{p.nome}</span>
                  <span className="pesquisas__suave">{`Criada em ${dataDoInstante(p.criadaEm)}`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
