/**
 * T216 — a Avaliação 90°/180° pelo link, depois da identificação (CPF +
 * nascimento): a lista de quem a pessoa avalia (o time do gestor e, na
 * 180°, a própria autoavaliação). Cada avaliação é uma pessoa por vez: as
 * 24 afirmações de 1 a 5, uma por tela, e no fim os comentários por
 * competência (exigidos conforme a regra). O progresso de cada avaliação
 * fica guardado nesta aba do navegador: dá para parar e continuar.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components";
import { plural } from "../../../../format/plural";
import {
  CATALOGO,
  COMPETENCIAS,
  ITENS,
  ROTULOS_DA_ESCALA,
  competencia,
  exigeComentario,
  nota1,
  type Competencia,
} from "./catalogo";
import {
  ErroDaAvaliacaoPublica,
  clientePublicoDaAvaliacao,
  type ClientePublicoDaAvaliacao,
  type ItemPendente,
  type Pendentes,
} from "./cliente";
import "../modelos.css";

interface Rascunho {
  notas: Record<string, number>;
  comentarios: Partial<Record<Competencia, string>>;
  posicao: number;
}

const chave = (parId: string) => `evolli-avaliacao-${parId}`;

function lerRascunho(parId: string): Rascunho {
  try {
    const v = sessionStorage.getItem(chave(parId));
    if (v) return JSON.parse(v) as Rascunho;
  } catch {
    // sem armazenamento: começa do zero
  }
  return { notas: {}, comentarios: {}, posicao: 0 };
}

function gravarRascunho(parId: string, r: Rascunho | null) {
  try {
    if (r) sessionStorage.setItem(chave(parId), JSON.stringify(r));
    else sessionStorage.removeItem(chave(parId));
  } catch {
    // sem armazenamento: segue sem rascunho
  }
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return `${p[0]?.[0] ?? ""}${p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : ""}`.toUpperCase();
}

export function ResponderAvaliacao({
  token,
  passe,
  primeiroNome,
  cliente = clientePublicoDaAvaliacao,
}: {
  readonly token: string;
  readonly passe: string;
  readonly primeiroNome: string;
  readonly cliente?: ClientePublicoDaAvaliacao;
}) {
  const [dados, setDados] = useState<Pendentes | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [aberto, setAberto] = useState<ItemPendente | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vivo = true;
    cliente
      .pendentes(token, passe)
      .then((d) => vivo && setDados(d))
      .catch((e: unknown) => {
        if (!vivo) return;
        const s = e instanceof ErroDaAvaliacaoPublica ? e.status : 0;
        setFalha(
          s === 401
            ? "Sua sessão nesta avaliação terminou. Entre de novo com o CPF e a data de nascimento."
            : s === 410
              ? "O prazo desta avaliação terminou."
              : "Não foi possível carregar a avaliação. Tente de novo.",
        );
      });
    return () => {
      vivo = false;
    };
  }, [cliente, token, passe, recarga]);

  if (falha) {
    return (
      <div className="pesquisa-publica__centro">
        <p role="alert" className="pesquisa-publica__texto">
          {falha}
        </p>
      </div>
    );
  }
  if (!dados) {
    return (
      <p className="pesquisa-publica__status" role="status">
        Carregando a avaliação…
      </p>
    );
  }
  if (aberto) {
    return (
      <AvaliarPessoa
        key={aberto.parId}
        item={aberto}
        regra={dados.comentarios}
        token={token}
        passe={passe}
        cliente={cliente}
        onSair={(enviada) => {
          setAberto(null);
          if (enviada) setRecarga((n) => n + 1);
        }}
      />
    );
  }

  const time = dados.itens.filter((i) => i.papel === "gestor");
  const auto = dados.itens.find((i) => i.papel === "autoavaliacao") ?? null;
  const pendentes = dados.itens.filter((i) => !i.respondida).length;

  return (
    <div className="avaliacao-publica">
      <h1 className="pesquisa-publica__titulo" tabIndex={-1}>
        {primeiroNome ? `Olá, ${primeiroNome}` : "Sua avaliação"}
      </h1>
      <p className="pesquisa-publica__texto">
        {pendentes === 0
          ? "Tudo enviado. Obrigado!"
          : `${plural(pendentes, "avaliação pendente", "avaliações pendentes")}. Leva cerca de 4 minutos cada e dá para parar e continuar depois.`}
      </p>
      {auto ? (
        <section aria-label="Sua autoavaliação" className="avaliacao-publica__grupo">
          <h2 className="avaliacao-publica__subtitulo">Sua autoavaliação</h2>
          <CartaoDoItem item={auto} rotulo="Fazer a autoavaliação" onAbrir={setAberto} />
        </section>
      ) : null}
      {time.length ? (
        <section aria-label="Seu time" className="avaliacao-publica__grupo">
          <h2 className="avaliacao-publica__subtitulo">
            {`Seu time · ${plural(time.length, "pessoa", "pessoas")}`}
          </h2>
          <ul className="avaliacao-publica__lista">
            {time.map((i) => (
              <li key={i.parId}>
                <CartaoDoItem item={i} rotulo={`Avaliar ${i.avaliado.nome}`} onAbrir={setAberto} />
                {i.comparativo ? <ComparativoDoGestor item={i} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CartaoDoItem({
  item,
  rotulo,
  onAbrir,
}: {
  readonly item: ItemPendente;
  readonly rotulo: string;
  readonly onAbrir: (i: ItemPendente) => void;
}) {
  return (
    <div className="avaliacao-publica__cartao">
      <span className="pesquisas__avatar" aria-hidden="true">
        {iniciais(item.avaliado.nome)}
      </span>
      <span className="avaliacao-publica__nome">
        <strong>{item.papel === "autoavaliacao" ? "Você" : item.avaliado.nome}</strong>
        {item.avaliado.cargo ? <span className="pesquisas__suave">{item.avaliado.cargo}</span> : null}
      </span>
      {item.respondida ? (
        <span className="avaliacao-publica__situacao">Enviada</span>
      ) : item.aberta ? (
        <Button onClick={() => onAbrir(item)} aria-label={rotulo}>
          {item.papel === "autoavaliacao" ? "Começar" : "Avaliar"}
        </Button>
      ) : (
        <span className="avaliacao-publica__situacao">Prazo encerrado</span>
      )}
    </div>
  );
}

function ComparativoDoGestor({ item }: { readonly item: ItemPendente }) {
  const c = item.comparativo!;
  return (
    <details className="avaliacao-publica__comparativo">
      <summary>{`Ver a autoavaliação de ${item.avaliado.nome}`}</summary>
      <table className="pesquisas__tabela">
        <thead>
          <tr>
            <th scope="col">Competência</th>
            <th scope="col">Você</th>
            <th scope="col">Autoavaliação</th>
          </tr>
        </thead>
        <tbody>
          {COMPETENCIAS.map((k) => (
            <tr key={k}>
              <th scope="row">{competencia(k).rotulo}</th>
              <td>{nota1(c.gestor[k])}</td>
              <td>{nota1(c.autoavaliacao[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function AvaliarPessoa({
  item,
  regra,
  token,
  passe,
  cliente,
  onSair,
}: {
  readonly item: ItemPendente;
  readonly regra: Pendentes["comentarios"];
  readonly token: string;
  readonly passe: string;
  readonly cliente: ClientePublicoDaAvaliacao;
  readonly onSair: (enviada: boolean) => void;
}) {
  const [r, setR] = useState<Rascunho>(() => lerRascunho(item.parId));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const auto = item.papel === "autoavaliacao";
  const total = ITENS.length;
  const naTelaDeComentarios = r.posicao >= total;
  const atual = ITENS[Math.min(r.posicao, total - 1)]!;
  const valor = r.notas[atual.id];

  const medias = useMemo(() => {
    const m = {} as Record<Competencia, number | null>;
    for (const c of CATALOGO) {
      const v = c.itens.map((i) => r.notas[i.id]).filter((x): x is number => typeof x === "number");
      m[c.id] = v.length ? v.reduce((t, x) => t + x, 0) / v.length : null;
    }
    return m;
  }, [r.notas]);

  function mudar(novo: Rascunho) {
    setR(novo);
    gravarRascunho(item.parId, novo);
  }

  async function enviar() {
    const faltam = COMPETENCIAS.filter(
      (c) => exigeComentario(regra, medias[c]) && !r.comentarios[c]?.trim(),
    );
    if (faltam.length) {
      setErro(
        `Escreva um comentário em ${faltam.map((c) => competencia(c).rotulo).join(", ")}.`,
      );
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await cliente.responder(token, item.parId, {
        passe,
        respostas: ITENS.map((i) => ({ perguntaId: i.id, valor: r.notas[i.id]! })),
        comentarios: Object.fromEntries(
          Object.entries(r.comentarios).filter(([, t]) => t?.trim()),
        ),
      });
      gravarRascunho(item.parId, null);
      onSair(true);
    } catch (e) {
      const s = e instanceof ErroDaAvaliacaoPublica ? e.status : 0;
      setErro(
        s === 409
          ? "Esta avaliação já foi enviada."
          : s === 410
            ? "O prazo desta avaliação terminou."
            : s === 401
              ? "Sua sessão terminou. Entre de novo: o que você marcou fica guardado nesta aba."
              : "Não foi possível enviar. Tente de novo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  const progresso = Math.round((Math.min(r.posicao, total) / total) * 100);

  return (
    <div className="avaliacao-publica">
      <div className="pesquisa-publica__progresso" role="progressbar" aria-label="Progresso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso}>
        <span style={{ width: `${progresso}%` }} />
      </div>
      <p className="avaliacao-publica__quem">
        <span className="pesquisas__avatar" aria-hidden="true">
          {iniciais(item.avaliado.nome)}
        </span>
        <strong>{auto ? "Sua autoavaliação" : item.avaliado.nome}</strong>
      </p>
      {!naTelaDeComentarios ? (
        <>
          <p className="pesquisas__suave">
            {`${r.posicao + 1} de ${total} · ${competencia(atual.competencia).rotulo}`}
          </p>
          <h2 className="pesquisa-publica__pergunta" id="avaliacao-afirmacao">
            {auto ? atual.autoavaliacao : atual.gestor}
          </h2>
          <div role="radiogroup" aria-labelledby="avaliacao-afirmacao" className="avaliacao-publica__escala">
            {ROTULOS_DA_ESCALA.map((rotulo, i) => {
              const n = i + 1;
              return (
                <label key={n} className="avaliacao-publica__ponto">
                  <input
                    type="radio"
                    name={`nota-${atual.id}`}
                    checked={valor === n}
                    onChange={() => mudar({ ...r, notas: { ...r.notas, [atual.id]: n } })}
                  />
                  <span aria-hidden="true">{n}</span>
                  <span className="pesquisas__so-leitor">{`${n} · ${rotulo}`}</span>
                </label>
              );
            })}
          </div>
          <p className="avaliacao-publica__pontas" aria-hidden="true">
            <span>{ROTULOS_DA_ESCALA[0]}</span>
            <span>{valor ? `${valor} · ${ROTULOS_DA_ESCALA[valor - 1]}` : ""}</span>
            <span>{ROTULOS_DA_ESCALA[4]}</span>
          </p>
          <div className="avaliacao-publica__navegacao">
            <Button
              variant="subtle"
              onClick={() => (r.posicao === 0 ? onSair(false) : mudar({ ...r, posicao: r.posicao - 1 }))}
            >
              {r.posicao === 0 ? "← Voltar para a lista" : "← Anterior"}
            </Button>
            <Button disabled={!valor} onClick={() => mudar({ ...r, posicao: r.posicao + 1 })}>
              Próximo →
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="pesquisa-publica__pergunta">Comentários</h2>
          <p className="pesquisa-publica__texto">
            {regra === "opcionais"
              ? "Se quiser, conte um exemplo concreto em cada competência."
              : regra === "obrigatorios"
                ? "Escreva um exemplo concreto em cada competência."
                : "Nas competências com média abaixo de 2,5 ou igual a 5, o comentário é obrigatório."}
          </p>
          {CATALOGO.map((c) => {
            const obrigatorio = exigeComentario(regra, medias[c.id]);
            return (
              <label key={c.id} className="pesquisas__campo">
                <span className="pesquisas__rotulo">
                  {`${c.rotulo} · média ${nota1(medias[c.id])}`}
                  {obrigatorio ? " *" : " (opcional)"}
                </span>
                <textarea
                  rows={2}
                  maxLength={1000}
                  required={obrigatorio}
                  value={r.comentarios[c.id] ?? ""}
                  onChange={(e) => mudar({ ...r, comentarios: { ...r.comentarios, [c.id]: e.target.value } })}
                />
              </label>
            );
          })}
          {erro ? (
            <p className="pesquisas__erro" role="alert">
              {erro}
            </p>
          ) : null}
          <div className="avaliacao-publica__navegacao">
            <Button variant="subtle" onClick={() => mudar({ ...r, posicao: total - 1 })}>
              ← Anterior
            </Button>
            <Button disabled={enviando} onClick={() => void enviar()}>
              Enviar avaliação
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
