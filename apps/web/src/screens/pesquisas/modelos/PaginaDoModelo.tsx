/**
 * T216 — página "Sobre o modelo" (layout dos modelos da galeria): voltar,
 * ícone, título "Tema · subtítulo" com o selo cinza, texto e metadados;
 * "Ver as perguntas" (a mesma gaveta) e "Criar pesquisa"; números de
 * destaque; a faixa "O que você recebe" (3 itens e uma janela de exemplo com
 * dados fictícios); o corpo em duas colunas (o conteúdo do instrumento à
 * esquerda; ficha técnica, escalas e régua à direita) e o uso recomendado.
 */
import { useState } from "react";
import { Button } from "../../../components";
import { IconButton } from "../../../ui";
import { IconeVer, IconeVisto, IconeVoltar } from "../../../ui/icones";
import { IconeDoModelo } from "../componentes";
import { GavetaDoModelo } from "../GaleriaDeModelos";
import { PESQUISAS_TITULO_ID } from "../tituloDasPesquisas";
import type {
  BlocoDoSobre,
  ExemploDoResultado,
  ModeloDaGaleria,
  PaginaSobre,
} from "./tipos";
import "./PaginaDoModelo.css";

const cor = (token: string | undefined, padrao = "--color-action") =>
  `var(${token ?? padrao})`;

/** A janela de exemplo do resultado (dados fictícios, decorativa). */
export function JanelaDeExemplo({ e }: { readonly e: ExemploDoResultado }) {
  return (
    <figure className="sobre__janela" aria-label="Exemplo do resultado">
      <div className="sobre__janela-topo" aria-hidden="true">
        <span />
        <span />
        <span />
        <strong>{e.cabecalho}</strong>
      </div>
      <div className="sobre__janela-corpo">
        {e.destaque ? (
          <p className="sobre__destaque">
            <strong style={{ color: cor(e.destaque.cor, "--color-ink") }}>
              {e.destaque.valor}
              {e.destaque.sufixo ? (
                <span className="pesquisas__suave">{e.destaque.sufixo}</span>
              ) : null}
            </strong>
            <span className="pesquisas__suave">{e.destaque.texto}</span>
          </p>
        ) : null}
        {e.quadradinhos ? (
          <span
            className="sobre__quadradinhos"
            role="img"
            aria-label={`${e.quadradinhos.length} itens por nível`}
          >
            {e.quadradinhos.map((c, i) => (
              <span key={i} style={{ background: cor(c) }} />
            ))}
          </span>
        ) : null}
        {e.matriz ? (
          <div className="sobre__mini-matriz">
            <span className="pesquisas__suave">{e.matriz.titulo}</span>
            <div
              className="sobre__mini-matriz-grade"
              role="img"
              aria-label={e.matriz.titulo}
            >
              {e.matriz.celulas.flatMap((linha, l) =>
                linha.map((c, k) => (
                  <span
                    key={`${l}-${k}`}
                    style={{
                      background: `color-mix(in srgb, ${cor(c.cor)} 28%, transparent)`,
                    }}
                  >
                    {c.valor || ""}
                  </span>
                )),
              )}
            </div>
          </div>
        ) : null}
        {e.barras ? (
          <ul className="sobre__barras">
            {e.barras.map((b) => (
              <li key={b.rotulo}>
                <span className="sobre__barra-rotulo">{b.rotulo}</span>
                <span className="sobre__barra-trilho" aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.max(0, Math.min(100, (b.valor / b.maximo) * 100))}%`,
                      background: cor(b.cor),
                    }}
                  />
                </span>
                <span className="sobre__barra-valor">
                  {b.texto ?? String(b.valor)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {e.halteres ? (
          <ul className="sobre__barras">
            {e.halteres.map((h) => {
              const pos = (v: number) => `${((v - 1) / 4) * 100}%`;
              const dif = h.b - h.a;
              return (
                <li key={h.rotulo}>
                  <span className="sobre__barra-rotulo">{h.rotulo}</span>
                  <span className="sobre__halter" aria-hidden="true">
                    <span
                      className="sobre__halter-linha"
                      style={{
                        left: pos(Math.min(h.a, h.b)),
                        width: `${(Math.abs(dif) / 4) * 100}%`,
                      }}
                    />
                    <span
                      className="sobre__halter-ponto"
                      data-lado="a"
                      style={{ left: pos(h.a) }}
                    />
                    <span
                      className="sobre__halter-ponto"
                      data-lado="b"
                      style={{ left: pos(h.b) }}
                    />
                  </span>
                  <span className="sobre__barra-valor">
                    {`${dif >= 0 ? "+" : "−"}${Math.abs(dif).toFixed(1).replace(".", ",")}`}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {e.cartoes ? (
          <ul className="sobre__cartoes">
            {e.cartoes.map((c) => (
              <li
                key={c.titulo}
                style={{ borderColor: cor(c.cor, "--hairline") }}
              >
                <span className="pesquisas__suave">{c.titulo}</span>
                <strong>{c.valor}</strong>
                {c.texto ? (
                  <span className="pesquisas__suave">{c.texto}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {e.tabela ? (
          <table className="sobre__tabela">
            <thead>
              <tr>
                {e.tabela.colunas.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {e.tabela.linhas.map((l) => (
                <tr key={l.join("|")}>
                  {l.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {e.rodape ? <p className="pesquisas__suave">{e.rodape}</p> : null}
      </div>
    </figure>
  );
}

function Bloco({ b }: { readonly b: BlocoDoSobre }) {
  switch (b.tipo) {
    case "grupos":
      return (
        <section className="sobre__bloco" aria-label={b.titulo}>
          <h2 className="sobre__bloco-titulo">{b.titulo}</h2>
          {b.descricao ? (
            <p className="pesquisas__suave">{b.descricao}</p>
          ) : null}
          {b.legenda ? (
            <ul className="sobre__legenda">
              {b.legenda.map((l) => (
                <li key={l.texto}>
                  <span
                    className="galeria__bolinha"
                    style={{ background: cor(l.cor) }}
                    aria-hidden="true"
                  />
                  {l.texto}
                </li>
              ))}
            </ul>
          ) : null}
          <ol className="sobre__grupos">
            {b.itens.map((g) => (
              <li key={g.titulo}>
                {g.numero ? (
                  <span
                    className="sobre__numero"
                    style={{ color: cor(g.cor, "--color-ink-muted") }}
                    aria-hidden="true"
                  >
                    {g.numero}
                  </span>
                ) : (
                  <span
                    className="galeria__bolinha"
                    style={{ background: cor(g.cor) }}
                    aria-hidden="true"
                  />
                )}
                <div className="sobre__grupo-textos">
                  <p className="sobre__grupo-titulo">
                    <strong>{g.titulo}</strong>
                    {g.selo ? (
                      <span className="galeria__selo" data-tom="cinza">
                        {g.selo}
                      </span>
                    ) : null}
                  </p>
                  {g.subtitulo ? (
                    <span className="pesquisas__suave">{g.subtitulo}</span>
                  ) : null}
                  {g.chips ? (
                    <ul className="sobre__chips">
                      {g.chips.map((c) => (
                        <li key={c.texto}>
                          <span
                            className="galeria__bolinha"
                            style={{ background: cor(c.cor) }}
                            aria-hidden="true"
                          />
                          {c.texto}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {g.quantidade ? (
                  <span className="pesquisas__suave sobre__quantidade">
                    {g.quantidade}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      );
    case "passos":
      return (
        <section className="sobre__bloco" aria-label={b.titulo}>
          <h2 className="sobre__bloco-titulo">{b.titulo}</h2>
          {b.descricao ? (
            <p className="pesquisas__suave">{b.descricao}</p>
          ) : null}
          <ol className="sobre__passos">
            {b.itens.map((p) => (
              <li key={p.rotulo}>
                <span className="sobre__passo-rotulo">{p.rotulo}</span>
                <strong>{p.titulo}</strong>
                <span className="pesquisas__suave">{p.texto}</span>
              </li>
            ))}
          </ol>
        </section>
      );
    case "tabela":
      return (
        <section className="sobre__bloco" aria-label={b.titulo}>
          <h2 className="sobre__bloco-titulo">{b.titulo}</h2>
          {b.descricao ? (
            <p className="pesquisas__suave">{b.descricao}</p>
          ) : null}
          <table className="sobre__tabela">
            <thead>
              <tr>
                {b.colunas.map((c, i) => (
                  <th key={`${c}-${i}`} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.linhas.map((l, i) => (
                <tr key={i}>
                  {l.map((c, j) => (
                    <td key={j} data-nivel={c || undefined}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {b.rodape ? <p className="pesquisas__suave">{b.rodape}</p> : null}
        </section>
      );
    case "componente":
      return (
        <section className="sobre__bloco" aria-label={b.titulo}>
          <h2 className="sobre__bloco-titulo">{b.titulo}</h2>
          <b.Componente />
        </section>
      );
    default:
      return (
        <section className="sobre__bloco" aria-label={b.titulo}>
          <h2 className="sobre__bloco-titulo">{b.titulo}</h2>
          {b.paragrafos.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      );
  }
}

function Lateral({ p }: { readonly p: PaginaSobre }) {
  return (
    <aside className="sobre__lateral">
      {p.ficha ? (
        <section className="sobre__cartao" aria-label="Ficha técnica">
          <h2 className="sobre__bloco-titulo">Ficha técnica</h2>
          <dl className="sobre__ficha">
            {p.ficha.map(([r, v]) => (
              <div key={r}>
                <dt>{r}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {p.escalas ? (
        <section className="sobre__cartao" aria-label="Escalas de resposta">
          <h2 className="sobre__bloco-titulo">
            {p.escalas.length === 1
              ? "A escala de resposta"
              : `${p.escalas.length} escalas de resposta`}
          </h2>
          <ul className="sobre__escalas">
            {p.escalas.map((e) => (
              <li key={e.titulo}>
                <strong>{e.titulo}</strong>
                <span className="pesquisas__suave">{e.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {p.regua ? (
        <section className="sobre__cartao" aria-label={p.regua.titulo}>
          <h2 className="sobre__bloco-titulo">{p.regua.titulo}</h2>
          {p.regua.descricao ? (
            <p className="pesquisas__suave">{p.regua.descricao}</p>
          ) : null}
          <ul className="sobre__regua">
            {p.regua.faixas.map((f) => (
              <li key={f.rotulo}>
                <span
                  className="sobre__regua-cor"
                  style={{ background: cor(f.cor) }}
                  aria-hidden="true"
                />
                <strong>{f.rotulo}</strong>
                <span className="pesquisas__suave">{f.intervalo}</span>
                {f.texto ? (
                  <span className="sobre__regua-texto">{f.texto}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

export function PaginaDoModelo({
  modelo: m,
  pagina: p,
  onVoltar,
  onUsar,
}: {
  readonly modelo: ModeloDaGaleria;
  readonly pagina: PaginaSobre;
  readonly onVoltar: () => void;
  readonly onUsar: (id: string) => void;
}) {
  const [gaveta, setGaveta] = useState(false);
  return (
    <div className="pesquisas sobre">
      <header className="pesquisas__cabecalho">
        <IconButton
          label="Voltar"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <IconeDoModelo id={m.id} tamanho="lg" />
        <div className="pesquisas__titulos">
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            {p.titulo}
            {p.selo ? (
              <span className="galeria__selo" data-tom="cinza">
                {p.selo}
              </span>
            ) : null}
            {m.selo === "novo" ? (
              <span className="galeria__selo" data-tom="rosa">
                Novo
              </span>
            ) : null}
          </h1>
          <p className="pesquisas__subtitulo">{p.texto}</p>
          <ul className="sobre__metadados">
            {p.metadados.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="pesquisas__acoes-topo">
          <Button variant="secondary" onClick={() => setGaveta(true)}>
            <IconeVer tamanho={16} />
            {p.botaoVer}
          </Button>
          <Button onClick={() => onUsar(m.id)}>{p.botaoCriar}</Button>
        </div>
      </header>

      {p.numeros ? (
        <dl className="pesquisas__faixa sobre__numeros" aria-label="Em números">
          {p.numeros.map((x) => (
            <div key={x.rotulo}>
              <dt>{x.rotulo}</dt>
              <dd>{x.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {p.recebe ? (
        <section className="sobre__recebe" aria-labelledby="sobre-recebe">
          <div className="sobre__recebe-textos">
            <p className="sobre__sobretitulo">O que você recebe</p>
            <h2 id="sobre-recebe" className="sobre__recebe-titulo">
              {p.recebe.titulo}
            </h2>
            <ul className="sobre__itens">
              {p.recebe.itens.map((i) => (
                <li key={i.titulo}>
                  <span className="sobre__visto" aria-hidden="true">
                    <IconeVisto tamanho={14} />
                  </span>
                  <span>
                    <strong>{i.titulo}</strong>
                    <span className="pesquisas__suave">{i.texto}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <JanelaDeExemplo e={p.recebe.exemplo} />
        </section>
      ) : null}

      {p.conteudo.length > 0 || p.ficha || p.escalas || p.regua ? (
        <div
          className="sobre__colunas"
          {...(p.ficha || p.escalas || p.regua
            ? {}
            : { "data-sem-lateral": "" })}
        >
          <div className="sobre__conteudo">
            {p.conteudo.map((b) => (
              <Bloco key={b.titulo} b={b} />
            ))}
          </div>
          {p.ficha || p.escalas || p.regua ? <Lateral p={p} /> : null}
        </div>
      ) : null}

      {p.uso ? (
        <section className="sobre__uso" aria-label="Uso recomendado">
          <strong>Uso recomendado</strong>
          <p className="pesquisas__suave">{p.uso}</p>
        </section>
      ) : null}

      <GavetaDoModelo
        modelo={gaveta ? m : null}
        onFechar={() => setGaveta(false)}
        onUsar={onUsar}
      />
    </div>
  );
}
