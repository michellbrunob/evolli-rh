/**
 * T216 — etapa "Perguntas" do assistente: seções (nome, descrição, mover,
 * duplicar, excluir) e perguntas (os 11 tipos, cada um com o seu editor;
 * obrigatória; duplicar, mover, excluir; arrastar para reordenar; lógica
 * condicional por opção de uma pergunta anterior).
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import type {
  ConfigPergunta,
  Pergunta,
  Secao,
  TipoPergunta,
} from "../../api/pesquisasClient";
import { Button, FormActions } from "../../components";
import { plural } from "../../format/plural";
import { Dialog, IconButton, ListaDeEscolha } from "../../ui";
import {
  IconeArrastar,
  IconeCalendario,
  IconeConcordancia,
  IconeConcordancia4,
  IconeSatisfacao4,
  IconeCopiar,
  IconeDescer,
  IconeEscala,
  IconeEscolhaUnica,
  IconeEstrela,
  IconeMais,
  IconeMultiplaEscolha,
  IconeNota,
  IconeNumero,
  IconeParagrafo,
  IconeRemover,
  IconeSecoes,
  IconeSimNao,
  IconeSubir,
  IconeTextoCurto,
  type IconeDoEcossistema,
} from "../../ui/icones";
import { useAvisar } from "./avisos";
import { minutosEstimados, textoDoTempoEstimado } from "./tempoEstimado";
import {
  adicionarPergunta,
  adicionarSecao,
  alterarPergunta,
  alterarSecao,
  duplicarPergunta,
  duplicarSecao,
  excluirPergunta,
  excluirSecao,
  levarPerguntaPara,
  moverPergunta,
  moverSecao,
  perguntasEmOrdem,
  type Erros,
} from "./estadoDaPesquisa";
import {
  LIMITES,
  ROTULOS_DA_CONCORDANCIA,
  rotulosDosPontos,
  ROTULO_DO_TIPO,
  TIPOS_DE_PERGUNTA,
  configInicial,
  novaPergunta,
  novoId,
  opcoesDaCondicao,
  podeSerCondicao,
  temOpcoes,
} from "./textosDasPesquisas";

/** Mudança na configuração; `undefined` apaga o campo. */
type MudancaDeConfig = {
  [K in keyof ConfigPergunta]?: ConfigPergunta[K] | undefined;
};

/** Os tipos agrupados (Texto, Escolha, Escala, Outros), cada um com ícone. */
const GRUPOS_DE_TIPO: readonly {
  readonly titulo: string;
  readonly tipos: readonly TipoPergunta[];
}[] = [
  { titulo: "Texto", tipos: ["texto_curto", "paragrafo"] },
  {
    titulo: "Escolha",
    tipos: ["escolha_unica", "multipla_escolha", "sim_nao"],
  },
  {
    titulo: "Escala",
    tipos: [
      "escala",
      "nota_0_10",
      "concordancia",
      "concordancia_4",
      "satisfacao_4",
      "estrelas",
    ],
  },
  { titulo: "Outros", tipos: ["data", "numero"] },
];

/** Um ícone próprio para cada tipo (na lista suspensa). */
const ICONE_DO_TIPO: Readonly<Record<TipoPergunta, IconeDoEcossistema>> = {
  texto_curto: IconeTextoCurto,
  paragrafo: IconeParagrafo,
  escolha_unica: IconeEscolhaUnica,
  multipla_escolha: IconeMultiplaEscolha,
  sim_nao: IconeSimNao,
  escala: IconeEscala,
  nota_0_10: IconeNota,
  concordancia: IconeConcordancia,
  concordancia_4: IconeConcordancia4,
  satisfacao_4: IconeSatisfacao4,
  estrelas: IconeEstrela,
  data: IconeCalendario,
  numero: IconeNumero,
  escolha_forcada: IconeEscolhaUnica,
};

const SEMPRE = "__sempre__";
const SEPARADOR = "::";

/** Número digitado → número, ou `undefined` quando vazio. */
const numeroDe = (v: string): number | undefined =>
  v.trim() === "" ? undefined : Number(v);

/**
 * A lista suspensa dos tipos, agrupada (Texto, Escolha, Escala, Outros):
 * fecha com Esc e com clique fora; o foco vai para o primeiro tipo.
 */
function ListaDeTipos({
  onFechar,
  children,
}: {
  readonly onFechar: () => void;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function fora(e: MouseEvent) {
      const alvo = e.target as HTMLElement | null;
      if (!ref.current || !alvo || ref.current.contains(alvo)) return;
      // O gatilho alterna a lista sozinho.
      if (alvo.closest?.(".pesquisas__nova-pergunta")) return;
      onFechar();
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [onFechar]);
  return (
    <div
      ref={ref}
      className="pesquisas__tipos pesquisas__tipos--agrupados pesquisas__tipos--suspensa"
      role="group"
      aria-label="Tipo da nova pergunta"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onFechar();
        }
      }}
    >
      {children}
    </div>
  );
}

export function EditorDePerguntas({
  secoes,
  onMudar,
  erros,
}: {
  readonly secoes: readonly Secao[];
  readonly onMudar: (secoes: Secao[]) => void;
  /** Erros a mostrar (só depois de tentar avançar). */
  readonly erros: Erros | null;
}) {
  const avisar = useAvisar();
  const [aberta, setAberta] = useState<string | null>(null);
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<Secao | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  // A seção com o nome e a descrição abertos (recolhidos até clicar).
  const [secaoAberta, setSecaoAberta] = useState<string | null>(null);

  const todas = perguntasEmOrdem(secoes);
  const total = todas.length;
  const numero = new Map(todas.map((p, i) => [p.id, i + 1]));
  const noLimite = total >= LIMITES.perguntas;

  function adicionar(secaoId: string, tipo: TipoPergunta) {
    const p = novaPergunta(tipo);
    onMudar(adicionarPergunta(secoes, secaoId, p));
    setEscolhendo(null);
    setAberta(p.id);
    requestAnimationFrame?.(() =>
      document.getElementById(`pergunta-texto-${p.id}`)?.focus(),
    );
  }

  function soltar(e: DragEvent, destinoId: string) {
    e.preventDefault();
    if (arrastando) onMudar(levarPerguntaPara(secoes, arrastando, destinoId));
    setArrastando(null);
  }

  function novaSecao() {
    const novas = adicionarSecao(secoes);
    onMudar(novas);
    // A seção nova abre com o nome para preencher.
    setSecaoAberta(novas.at(-1)?.id ?? null);
  }

  const fecharComTecla = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      setSecaoAberta(null);
    }
  };

  return (
    <div className="pesquisas__etapa">
      <div className="pesquisas__editor-resumo">
        <p className="pesquisas__suave">
          {[
            plural(total, "pergunta", "perguntas"),
            plural(secoes.length, "seção", "seções"),
            textoDoTempoEstimado(minutosEstimados(total)),
          ].join(" · ")}
        </p>
        <Button
          variant="secondary"
          disabled={secoes.length >= LIMITES.secoes}
          onClick={novaSecao}
        >
          <IconeSecoes tamanho={16} />
          Adicionar seção
        </Button>
      </div>
      {erros?.perguntas ? (
        <p className="pesquisas__erro" role="alert">
          {erros.perguntas}
        </p>
      ) : null}

      {secoes.map((s, si) => {
        const n = si + 1;
        return (
          <section
            key={s.id}
            className="pesquisas__secao"
            aria-label={`Seção ${n}`}
          >
            <div className="pesquisas__secao-cabecalho">
              <span className="pesquisas__secao-selo">{`Seção ${n}`}</span>
              {secaoAberta === s.id ? (
                <div className="pesquisas__secao-campos">
                  <input
                    className="pesquisas__campo"
                    aria-label={`Nome da seção ${n}`}
                    placeholder="Nome da seção (opcional)"
                    value={s.titulo ?? ""}
                    // Aberta agora, a seção leva o foco ao nome.
                    autoFocus
                    onChange={(e) =>
                      onMudar(
                        alterarSecao(secoes, s.id, { titulo: e.target.value }),
                      )
                    }
                    onKeyDown={fecharComTecla}
                  />
                  <input
                    className="pesquisas__campo"
                    aria-label={`Descrição da seção ${n}`}
                    placeholder="Descrição (opcional)"
                    value={s.descricao ?? ""}
                    onChange={(e) =>
                      onMudar(
                        alterarSecao(secoes, s.id, {
                          descricao: e.target.value,
                        }),
                      )
                    }
                    onKeyDown={fecharComTecla}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="pesquisas__secao-nome"
                  aria-label={`Editar nome da seção ${n}`}
                  onClick={() => setSecaoAberta(s.id)}
                >
                  <span
                    className={
                      s.titulo?.trim() ? "pesquisas__forte" : "pesquisas__suave"
                    }
                  >
                    {s.titulo?.trim() || "Sem nome"}
                  </span>
                  {s.descricao?.trim() ? (
                    <span className="pesquisas__suave">{s.descricao}</span>
                  ) : null}
                </button>
              )}
              <span className="pesquisas__suave pesquisas__secao-contagem">
                {plural(s.perguntas.length, "pergunta", "perguntas")}
              </span>
              <div className="pesquisas__botoes-icone">
                <IconButton
                  label={`Subir seção ${n}`}
                  icon={<IconeSubir tamanho={16} />}
                  variant="subtle"
                  disabled={si === 0}
                  onClick={() => onMudar(moverSecao(secoes, s.id, -1))}
                />
                <IconButton
                  label={`Descer seção ${n}`}
                  icon={<IconeDescer tamanho={16} />}
                  variant="subtle"
                  disabled={si === secoes.length - 1}
                  onClick={() => onMudar(moverSecao(secoes, s.id, 1))}
                />
                <IconButton
                  label={`Duplicar seção ${n}`}
                  icon={<IconeCopiar tamanho={16} />}
                  variant="subtle"
                  disabled={
                    secoes.length >= LIMITES.secoes ||
                    total + s.perguntas.length > LIMITES.perguntas
                  }
                  onClick={() => onMudar(duplicarSecao(secoes, s.id))}
                />
                <IconButton
                  label={`Excluir seção ${n}`}
                  icon={<IconeRemover tamanho={16} />}
                  variant="subtle"
                  disabled={secoes.length === 1}
                  onClick={() =>
                    s.perguntas.length === 0
                      ? onMudar(excluirSecao(secoes, s.id))
                      : setConfirmar(s)
                  }
                />
              </div>
            </div>

            {s.perguntas.length === 0 ? (
              <p className="pesquisas__suave">Nenhuma pergunta nesta seção.</p>
            ) : (
              <ol className="pesquisas__perguntas">
                {s.perguntas.map((p) => {
                  const pn = numero.get(p.id)!;
                  const erro = erros?.[`pergunta:${p.id}`];
                  const idErro = `pergunta-erro-${p.id}`;
                  return (
                    <li
                      key={p.id}
                      className="pesquisas__pergunta"
                      aria-label={`Pergunta ${pn}`}
                      {...(erro ? { "data-invalida": "" } : {})}
                      {...(arrastando === p.id
                        ? { "data-arrastando": "" }
                        : {})}
                      draggable
                      onDragStart={(e) => {
                        setArrastando(p.id);
                        e.dataTransfer?.setData("text/plain", p.id);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => soltar(e, p.id)}
                      onDragEnd={() => setArrastando(null)}
                    >
                      <div className="pesquisas__pergunta-cabeca">
                        <span className="pesquisas__pegador" aria-hidden="true">
                          <IconeArrastar tamanho={16} />
                        </span>
                        <button
                          type="button"
                          className="pesquisas__pergunta-resumo"
                          aria-expanded={aberta === p.id}
                          aria-label={`Editar pergunta ${pn}`}
                          {...(erro ? { "aria-describedby": idErro } : {})}
                          onClick={() =>
                            setAberta(aberta === p.id ? null : p.id)
                          }
                        >
                          <span className="pesquisas__forte">
                            {`${pn}. ${p.texto.trim() || "Pergunta sem texto"}`}
                          </span>
                          <span className="pesquisas__suave">
                            {[
                              ROTULO_DO_TIPO[p.tipo],
                              p.obrigatoria ? "Obrigatória" : "Opcional",
                              p.condicao ? "Condicional" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                        <div className="pesquisas__botoes-icone">
                          <IconButton
                            label={`Subir pergunta ${pn}`}
                            icon={<IconeSubir tamanho={16} />}
                            variant="subtle"
                            disabled={pn === 1}
                            onClick={() =>
                              onMudar(moverPergunta(secoes, p.id, -1))
                            }
                          />
                          <IconButton
                            label={`Descer pergunta ${pn}`}
                            icon={<IconeDescer tamanho={16} />}
                            variant="subtle"
                            disabled={pn === total}
                            onClick={() =>
                              onMudar(moverPergunta(secoes, p.id, 1))
                            }
                          />
                          <IconButton
                            label={`Duplicar pergunta ${pn}`}
                            icon={<IconeCopiar tamanho={16} />}
                            variant="subtle"
                            disabled={noLimite}
                            onClick={() =>
                              onMudar(duplicarPergunta(secoes, p.id))
                            }
                          />
                          <IconButton
                            label={`Excluir pergunta ${pn}`}
                            icon={<IconeRemover tamanho={16} />}
                            variant="subtle"
                            onClick={() => {
                              if (aberta === p.id) setAberta(null);
                              const antes = secoes;
                              onMudar(excluirPergunta(secoes, p.id));
                              avisar("Pergunta excluída.", {
                                acao: {
                                  rotulo: "Desfazer",
                                  onClick: () => onMudar([...antes]),
                                },
                              });
                            }}
                          />
                        </div>
                      </div>
                      {erro ? (
                        <p id={idErro} className="pesquisas__erro">
                          {erro}
                        </p>
                      ) : null}
                      {aberta === p.id ? (
                        <EditorDaPergunta
                          pergunta={p}
                          numero={pn}
                          anteriores={todas.slice(0, pn - 1)}
                          onMudar={(mudar) =>
                            onMudar(alterarPergunta(secoes, p.id, mudar))
                          }
                          onConcluir={() => setAberta(null)}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="pesquisas__nova-pergunta">
              <button
                type="button"
                className="pesquisas__acao-texto pesquisas__acao-texto--primaria pesquisas__com-icone"
                aria-label={`Adicionar pergunta na seção ${n}`}
                aria-expanded={escolhendo === s.id}
                disabled={noLimite}
                onClick={() => setEscolhendo(escolhendo === s.id ? null : s.id)}
              >
                <IconeMais tamanho={14} />
                Nova pergunta nesta seção
              </button>
              {escolhendo === s.id ? (
                <ListaDeTipos onFechar={() => setEscolhendo(null)}>
                  {GRUPOS_DE_TIPO.map((g) => (
                    <div key={g.titulo} className="pesquisas__tipos-grupo">
                      <p className="pesquisas__menu-titulo" aria-hidden="true">
                        {g.titulo}
                      </p>
                      {g.tipos.map((valor) => {
                        const t = TIPOS_DE_PERGUNTA.find(
                          (x) => x.valor === valor,
                        )!;
                        const Icone = ICONE_DO_TIPO[valor];
                        return (
                          <button
                            key={valor}
                            type="button"
                            className="pesquisas__tipo"
                            onClick={() => adicionar(s.id, valor)}
                          >
                            <span
                              className="pesquisas__tipo-icone"
                              aria-hidden="true"
                            >
                              <Icone tamanho={16} />
                            </span>
                            <span className="pesquisas__tipo-textos">
                              <span className="pesquisas__forte">
                                {t.rotulo}
                              </span>
                              <span className="pesquisas__suave">
                                {t.texto}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </ListaDeTipos>
              ) : null}
            </div>
          </section>
        );
      })}

      <p className="pesquisas__suave pesquisas__editor-dica">
        Arraste pela alça para mudar a ordem das perguntas.
      </p>

      <Dialog
        aberto={confirmar !== null}
        titulo="Excluir a seção?"
        onFechar={() => setConfirmar(null)}
        rodape={
          <FormActions>
            <Button variant="secondary" onClick={() => setConfirmar(null)}>
              Cancelar
            </Button>
            <Button
              className="pesquisas__botao-perigo"
              onClick={() => {
                if (confirmar) onMudar(excluirSecao(secoes, confirmar.id));
                setConfirmar(null);
              }}
            >
              Excluir seção
            </Button>
          </FormActions>
        }
      >
        {confirmar ? (
          <p>
            {`A seção sai da pesquisa junto com ${plural(confirmar.perguntas.length, "pergunta", "perguntas")}. Perguntas que dependiam delas voltam a aparecer para todos.`}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}

function Interruptor({
  ligado,
  onMudar,
  children,
}: {
  readonly ligado: boolean;
  readonly onMudar: (v: boolean) => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      className="pesquisas__interruptor"
      onClick={() => onMudar(!ligado)}
    >
      <span className="pesquisas__interruptor-trilho" aria-hidden="true" />
      {children}
    </button>
  );
}

function Rotulado({
  rotulo,
  id: idPedido,
  children,
}: {
  readonly rotulo: string;
  readonly id?: string;
  readonly children: (id: string) => ReactNode;
}) {
  const gerado = useId();
  const id = idPedido ?? gerado;
  return (
    <div className="pesquisas__rotulado">
      <label htmlFor={id}>
        <span>{rotulo}</span>
      </label>
      {children(id)}
    </div>
  );
}

/** O editor aberto de uma pergunta. */
function EditorDaPergunta({
  pergunta: p,
  numero,
  anteriores,
  onMudar,
  onConcluir,
}: {
  readonly pergunta: Pergunta;
  readonly numero: number;
  readonly anteriores: readonly Pergunta[];
  readonly onMudar: (mudar: (p: Pergunta) => Pergunta) => void;
  readonly onConcluir: () => void;
}) {
  const config = (mudanca: MudancaDeConfig) =>
    onMudar((q) => {
      const nova: Record<string, unknown> = { ...q.config, ...mudanca };
      for (const chave of Object.keys(nova))
        if (nova[chave] === undefined) delete nova[chave];
      return { ...q, config: nova as ConfigPergunta };
    });

  // Condição: "Sempre" ou uma opção de pergunta anterior de escolha/sim-não.
  const opcoesDaLista = [
    { valor: SEMPRE, rotulo: "Sempre" },
    ...anteriores.flatMap((a, i) =>
      podeSerCondicao(a.tipo)
        ? opcoesDaCondicao(a).map((o) => ({
            valor: `${a.id}${SEPARADOR}${o.id}`,
            rotulo: `Só para quem marcou "${o.texto || "opção sem texto"}"`,
            descricao: `na pergunta ${i + 1}. ${a.texto || "Pergunta sem texto"}`,
          }))
        : [],
    ),
  ];
  const valorDaCondicao = p.condicao
    ? `${p.condicao.perguntaId}${SEPARADOR}${p.condicao.opcaoId}`
    : SEMPRE;

  return (
    <div className="pesquisas__pergunta-editor">
      <div className="pesquisas__lado-a-lado">
        <Rotulado rotulo="Tipo">
          {(id) => (
            <ListaDeEscolha
              id={id}
              opcoes={TIPOS_DE_PERGUNTA.map((t) => ({
                valor: t.valor,
                rotulo: t.rotulo,
              }))}
              valor={p.tipo}
              onMudar={(v) =>
                onMudar((q) => ({
                  ...q,
                  tipo: v as TipoPergunta,
                  config: configInicial(v as TipoPergunta),
                }))
              }
            />
          )}
        </Rotulado>
        <Rotulado rotulo={`Mostrar a pergunta ${numero}`}>
          {(id) => (
            <ListaDeEscolha
              id={id}
              opcoes={opcoesDaLista}
              valor={valorDaCondicao}
              onMudar={(v) =>
                onMudar((q) => {
                  if (v === SEMPRE) return { ...q, condicao: null };
                  const [perguntaId, opcaoId] = v.split(SEPARADOR) as [
                    string,
                    string,
                  ];
                  return { ...q, condicao: { perguntaId, opcaoId } };
                })
              }
            />
          )}
        </Rotulado>
      </div>
      <Rotulado rotulo="Texto da pergunta" id={`pergunta-texto-${p.id}`}>
        {(id) => (
          <input
            id={id}
            className="pesquisas__campo"
            value={p.texto}
            onChange={(e) => {
              const texto = e.target.value;
              onMudar((q) => ({ ...q, texto }));
            }}
          />
        )}
      </Rotulado>
      <Rotulado rotulo="Descrição (opcional)">
        {(id) => (
          <input
            id={id}
            className="pesquisas__campo"
            value={p.descricao ?? ""}
            onChange={(e) => {
              const descricao = e.target.value;
              onMudar((q) => ({ ...q, descricao }));
            }}
          />
        )}
      </Rotulado>

      <ConfiguracaoDoTipo pergunta={p} config={config} />

      <div className="pesquisas__acoes">
        <Interruptor
          ligado={p.obrigatoria}
          onMudar={(obrigatoria) => onMudar((q) => ({ ...q, obrigatoria }))}
        >
          Obrigatória
        </Interruptor>
        <Button variant="subtle" onClick={onConcluir}>
          Concluir
        </Button>
      </div>
    </div>
  );
}

function ConfiguracaoDoTipo({
  pergunta: p,
  config,
}: {
  readonly pergunta: Pergunta;
  readonly config: (mudanca: MudancaDeConfig) => void;
}) {
  if (temOpcoes(p.tipo)) {
    const opcoes = p.config.opcoes ?? [];
    return (
      <div className="pesquisas__etapa">
        <ul className="pesquisas__opcoes-editor" aria-label="Opções">
          {opcoes.map((o, i) => (
            <li key={o.id}>
              <input
                className="pesquisas__campo"
                aria-label={`Opção ${i + 1}`}
                value={o.texto}
                onChange={(e) => {
                  const texto = e.target.value;
                  config({
                    opcoes: opcoes.map((x) =>
                      x.id === o.id ? { ...x, texto } : x,
                    ),
                  });
                }}
              />
              <IconButton
                label={`Remover opção ${i + 1}`}
                icon={<IconeRemover tamanho={16} />}
                variant="subtle"
                disabled={opcoes.length <= LIMITES.opcoesMinimo}
                onClick={() =>
                  config({ opcoes: opcoes.filter((x) => x.id !== o.id) })
                }
              />
            </li>
          ))}
        </ul>
        <div className="pesquisas__acoes">
          <Button
            variant="secondary"
            disabled={opcoes.length >= LIMITES.opcoesMaximo}
            onClick={() =>
              config({
                opcoes: [
                  ...opcoes,
                  { id: novoId(), texto: `Opção ${opcoes.length + 1}` },
                ],
              })
            }
          >
            <IconeMais tamanho={16} />
            Adicionar opção
          </Button>
        </div>
        <label className="pesquisas__marcacao">
          <input
            type="checkbox"
            checked={p.config.outro === true}
            onChange={(e) => config({ outro: e.target.checked })}
          />
          Incluir a opção &quot;Outro&quot;, com espaço para escrever
        </label>
        {p.tipo === "multipla_escolha" ? (
          <Rotulado rotulo="Máximo de marcações (opcional)">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                className="pesquisas__campo pesquisas__campo--curto"
                value={p.config.maximo ?? ""}
                onChange={(e) => config({ maximo: numeroDe(e.target.value) })}
              />
            )}
          </Rotulado>
        ) : null}
      </div>
    );
  }
  switch (p.tipo) {
    case "sim_nao":
      return (
        <Rotulado rotulo="Resposta esperada">
          {(id) => (
            <ListaDeEscolha
              id={id}
              opcoes={[
                { valor: "", rotulo: "Nenhuma" },
                { valor: "sim", rotulo: "Sim" },
                { valor: "nao", rotulo: "Não" },
              ]}
              valor={p.config.respostaBoa ?? ""}
              onMudar={(v) =>
                config({ respostaBoa: v === "" ? null : (v as "sim" | "nao") })
              }
            />
          )}
        </Rotulado>
      );
    case "nota_0_10":
      return (
        <div className="pesquisas__lado-a-lado">
          <label className="pesquisas__marcacao">
            <input
              type="checkbox"
              checked={p.config.enps === true}
              onChange={(e) =>
                config({
                  enps: e.target.checked,
                  ...(e.target.checked ? { lnps: undefined } : {}),
                })
              }
            />
            Calcular o eNPS (promotores 9–10, neutros 7–8, detratores 0–6)
          </label>
          <Rotulado rotulo="Rótulo do 0 (opcional)">
            {(id) => (
              <input
                id={id}
                className="pesquisas__campo"
                placeholder="Ex.: Nada"
                value={p.config.rotuloMinimo ?? ""}
                onChange={(e) => config({ rotuloMinimo: e.target.value })}
              />
            )}
          </Rotulado>
          <Rotulado rotulo="Rótulo do 10 (opcional)">
            {(id) => (
              <input
                id={id}
                className="pesquisas__campo"
                placeholder="Ex.: Muito"
                value={p.config.rotuloMaximo ?? ""}
                onChange={(e) => config({ rotuloMaximo: e.target.value })}
              />
            )}
          </Rotulado>
        </div>
      );
    case "escala":
      return (
        <div className="pesquisas__lado-a-lado">
          <Rotulado rotulo="Começa em">
            {(id) => (
              <ListaDeEscolha
                id={id}
                opcoes={[
                  { valor: "0", rotulo: "0" },
                  { valor: "1", rotulo: "1" },
                ]}
                valor={String(p.config.minimo ?? 1)}
                onMudar={(v) => config({ minimo: Number(v) })}
              />
            )}
          </Rotulado>
          <Rotulado rotulo="Termina em">
            {(id) => (
              <input
                id={id}
                type="number"
                min={2}
                max={10}
                className="pesquisas__campo pesquisas__campo--curto"
                value={p.config.maximo ?? ""}
                onChange={(e) => config({ maximo: numeroDe(e.target.value) })}
              />
            )}
          </Rotulado>
          <Rotulado rotulo="Rótulo do início">
            {(id) => (
              <input
                id={id}
                className="pesquisas__campo"
                value={p.config.rotuloMinimo ?? ""}
                onChange={(e) => config({ rotuloMinimo: e.target.value })}
              />
            )}
          </Rotulado>
          <Rotulado rotulo="Rótulo do fim">
            {(id) => (
              <input
                id={id}
                className="pesquisas__campo"
                value={p.config.rotuloMaximo ?? ""}
                onChange={(e) => config({ rotuloMaximo: e.target.value })}
              />
            )}
          </Rotulado>
        </div>
      );
    case "numero":
      return (
        <div className="pesquisas__lado-a-lado">
          <Rotulado rotulo="Mínimo (opcional)">
            {(id) => (
              <input
                id={id}
                type="number"
                className="pesquisas__campo pesquisas__campo--curto"
                value={p.config.minimo ?? ""}
                onChange={(e) => config({ minimo: numeroDe(e.target.value) })}
              />
            )}
          </Rotulado>
          <Rotulado rotulo="Máximo (opcional)">
            {(id) => (
              <input
                id={id}
                type="number"
                className="pesquisas__campo pesquisas__campo--curto"
                value={p.config.maximo ?? ""}
                onChange={(e) => config({ maximo: numeroDe(e.target.value) })}
              />
            )}
          </Rotulado>
          <label className="pesquisas__marcacao">
            <input
              type="checkbox"
              checked={p.config.inteiro === true}
              onChange={(e) => config({ inteiro: e.target.checked })}
            />
            Só números inteiros
          </label>
        </div>
      );
    case "concordancia":
      return (
        <p className="pesquisas__suave">
          {`Quem responde escolhe de 1 a 5: ${ROTULOS_DA_CONCORDANCIA.join(", ").toLowerCase()}.`}
        </p>
      );
    case "concordancia_4":
    case "satisfacao_4":
      return (
        <p className="pesquisas__suave">
          {`Escala de 4 pontos, sem meio-termo: ${(rotulosDosPontos(p) ?? []).join(", ").toLowerCase()}.`}
        </p>
      );
    case "estrelas":
      return (
        <p className="pesquisas__suave">Quem responde dá de 1 a 5 estrelas.</p>
      );
    case "data":
      return (
        <p className="pesquisas__suave">
          Quem responde escolhe um dia no calendário.
        </p>
      );
    case "texto_curto":
      return (
        <p className="pesquisas__suave">
          Resposta em uma linha, até 300 caracteres.
        </p>
      );
    default:
      return (
        <p className="pesquisas__suave">Resposta longa, até 3000 caracteres.</p>
      );
  }
}
