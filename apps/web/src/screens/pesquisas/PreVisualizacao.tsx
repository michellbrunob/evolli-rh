/**
 * T216 — a pesquisa como quem responde vê (só leitura): boas-vindas,
 * quantidade de perguntas, tempo estimado, seções e cada pergunta com o
 * jeito de responder. Também mostra as perguntas travadas na edição.
 */
import type { Pergunta, Secao } from "../../api/pesquisasClient";
import { plural } from "../../format/plural";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import {
  ROTULOS_DA_CONCORDANCIA,
  rotulosDosPontos,
  opcoesDaCondicao,
} from "./textosDasPesquisas";
import { minutosEstimados } from "./tempoEstimado";

// A mesma regra da página pública de resposta (`tempoEstimado.ts`).
export { minutosEstimados };

export function PreVisualizacao({
  nome,
  boasVindas,
  secoes,
}: {
  readonly nome: string;
  readonly boasVindas: string;
  readonly secoes: readonly Secao[];
}) {
  const todas = perguntasEmOrdem(secoes);
  const numero = new Map(todas.map((p, i) => [p.id, i + 1]));
  const minutos = minutosEstimados(todas.length);
  return (
    <div className="pesquisas__previa">
      <div>
        <h3 className="pesquisas__forte">{nome || "Pesquisa sem nome"}</h3>
        {boasVindas.trim()
          ? boasVindas
              .split(/\n\s*\n/)
              .map((par, i) => <p key={i}>{par.trim()}</p>)
          : null}
        <p className="pesquisas__suave">
          {`${plural(todas.length, "pergunta", "perguntas")} · cerca de ${plural(minutos, "minuto", "minutos")}`}
        </p>
      </div>
      {secoes.map((s, si) => (
        <section
          key={s.id}
          className="pesquisas__previa-secao"
          aria-label={s.titulo || `Seção ${si + 1}`}
        >
          {s.titulo ? <h3>{s.titulo}</h3> : null}
          {s.descricao ? (
            <p className="pesquisas__suave">{s.descricao}</p>
          ) : null}
          {s.perguntas.map((p) => {
            const alvo = p.condicao
              ? todas.find((a) => a.id === p.condicao!.perguntaId)
              : undefined;
            const opcao = alvo
              ? opcoesDaCondicao(alvo).find((o) => o.id === p.condicao!.opcaoId)
              : undefined;
            return (
              <div key={p.id} className="pesquisas__previa-pergunta">
                <strong>
                  {`${numero.get(p.id)}. ${p.texto || "Pergunta sem texto"}`}
                  {p.obrigatoria ? (
                    <span className="pesquisas__suave"> (obrigatória)</span>
                  ) : null}
                </strong>
                {p.descricao ? (
                  <span className="pesquisas__suave">{p.descricao}</span>
                ) : null}
                {alvo && opcao ? (
                  <span className="pesquisas__marca">
                    {`Aparece só para quem marcou "${opcao.texto}" na pergunta ${numero.get(alvo.id)}`}
                  </span>
                ) : null}
                <JeitoDeResponder pergunta={p} />
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function JeitoDeResponder({ pergunta: p }: { readonly pergunta: Pergunta }) {
  switch (p.tipo) {
    case "texto_curto":
      return (
        <input
          className="pesquisas__campo"
          disabled
          aria-label={`Resposta da pergunta: ${p.texto}`}
        />
      );
    case "paragrafo":
      return (
        <textarea
          className="pesquisas__campo"
          disabled
          aria-label={`Resposta da pergunta: ${p.texto}`}
        />
      );
    case "data":
      return (
        <input
          type="date"
          className="pesquisas__campo pesquisas__campo--curto"
          disabled
          aria-label={`Resposta da pergunta: ${p.texto}`}
        />
      );
    case "numero":
      return (
        <input
          type="number"
          className="pesquisas__campo pesquisas__campo--curto"
          disabled
          aria-label={`Resposta da pergunta: ${p.texto}`}
        />
      );
    case "escolha_unica":
    case "escolha_forcada":
    case "multipla_escolha": {
      const tipo = p.tipo === "multipla_escolha" ? "checkbox" : "radio";
      const opcoes = [
        ...(p.config.opcoes ?? []).map((o) => o.texto),
        ...(p.config.outro ? ["Outro"] : []),
      ];
      return (
        <div className="pesquisas__etapa">
          {p.tipo === "multipla_escolha" && p.config.maximo ? (
            <span className="pesquisas__suave">{`Marque até ${p.config.maximo}.`}</span>
          ) : null}
          {opcoes.map((texto, i) => (
            <label key={i} className="pesquisas__marcacao">
              <input type={tipo} disabled />
              {texto}
            </label>
          ))}
        </div>
      );
    }
    case "sim_nao":
      return (
        <div className="pesquisas__acoes">
          {["Sim", "Não"].map((t) => (
            <label key={t} className="pesquisas__marcacao">
              <input type="radio" disabled />
              {t}
            </label>
          ))}
        </div>
      );
    case "concordancia":
    case "concordancia_4":
    case "satisfacao_4":
      return (
        <div className="pesquisas__previa-escala" aria-hidden="true">
          {(rotulosDosPontos(p) ?? ROTULOS_DA_CONCORDANCIA).map((r, i) => (
            <span key={r} title={r}>
              {i + 1}
            </span>
          ))}
        </div>
      );
    case "estrelas":
      return (
        <div className="pesquisas__previa-escala" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n}>★</span>
          ))}
        </div>
      );
    case "nota_0_10":
    case "escala": {
      const min = p.tipo === "nota_0_10" ? 0 : (p.config.minimo ?? 1);
      const max = p.tipo === "nota_0_10" ? 10 : (p.config.maximo ?? 5);
      const valores = Array.from(
        { length: Math.max(0, max - min + 1) },
        (_, i) => min + i,
      );
      return (
        <div className="pesquisas__etapa">
          <div className="pesquisas__previa-escala" aria-hidden="true">
            {valores.map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
          {p.config.rotuloMinimo || p.config.rotuloMaximo ? (
            <span className="pesquisas__suave">
              {`${min}: ${p.config.rotuloMinimo || "—"} · ${max}: ${p.config.rotuloMaximo || "—"}`}
            </span>
          ) : null}
        </div>
      );
    }
  }
}
