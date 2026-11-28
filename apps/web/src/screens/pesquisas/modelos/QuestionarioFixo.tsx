/**
 * T216 — o cartão "Perguntas" dos questionários fixos no assistente
 * (riscos psicossociais NR-1 e saúde financeira): as perguntas por grupo,
 * sem editar, adicionar ou excluir — é a metodologia que permite comparar
 * os resultados. Na saúde financeira, um interruptor inclui ou tira as 3
 * perguntas opcionais de autopercepção.
 */
import type { Pergunta, Secao } from "../../../api/pesquisasClient";
import { plural } from "../../../format/plural";
import { CartaoDeSecao } from "../componentes";
import { modeloDaGaleria, secoesDoModelo } from "../modelosDePesquisa";
import { ESCALAS_NR1, ITENS_NR1, type EscalaNr1 } from "./copsoq/definicao";
import { SECAO_OPCIONAL_ISFB, etapaIsfb, itemIsfb } from "./isfb/definicao";
import "./Modelos.css";

const ESCALA_DO_ITEM = new Map(ITENS_NR1.map((i) => [i.id, i.escala]));

/** O selo do tipo de cada pergunta do questionário fixo. */
export function seloDaPerguntaFixa(modelo: string, p: Pergunta): string {
  if (modelo === "copsoq") {
    const e = ESCALA_DO_ITEM.get(p.id);
    return e ? ESCALAS_NR1[e].nome : "Escala 1–5";
  }
  if (p.tipo === "multipla_escolha") return "Marque todos que tiver";
  if (p.tipo === "escolha_unica")
    return `${p.config.opcoes?.length ?? 0} opções`;
  const rotulos = p.config.rotulos ?? [];
  const sentido = `${rotulos[0] ?? ""} → ${rotulos[rotulos.length - 1] ?? ""}`;
  return itemIsfb(p.id)?.invertido ? `${sentido} · invertida` : sentido;
}

/** Inclui ou tira a seção opcional de autopercepção (saúde financeira). */
export function comAutopercepcao(
  secoes: readonly Secao[],
  incluir: boolean,
): Secao[] {
  const sem = secoes.filter((s) => s.id !== SECAO_OPCIONAL_ISFB);
  if (!incluir) return sem;
  const opcional = secoesDoModelo(modeloDaGaleria("isfb")).find(
    (s) => s.id === SECAO_OPCIONAL_ISFB,
  )!;
  return [...sem, opcional];
}

export const temAutopercepcao = (secoes: readonly Secao[]): boolean =>
  secoes.some((s) => s.id === SECAO_OPCIONAL_ISFB);

/** "76 perguntas fixas em 8 domínios" / "15 perguntas + 3 de autopercepção". */
export function resumoDoQuestionarioFixo(
  modelo: string,
  secoes: readonly Secao[],
): string {
  if (modelo === "copsoq") {
    const n = secoes.reduce((t, s) => t + s.perguntas.length, 0);
    return `${plural(n, "pergunta fixa", "perguntas fixas")} em ${plural(secoes.length, "domínio", "domínios")}`;
  }
  return temAutopercepcao(secoes)
    ? "15 perguntas do índice + 3 de autopercepção"
    : "15 perguntas do índice";
}

export function QuestionarioFixo({
  modelo,
  secoes,
  travado,
  onMudar,
}: {
  readonly modelo: "copsoq" | "isfb";
  readonly secoes: readonly Secao[];
  /** Já publicada com respostas (ou depois de publicar): sem mudanças. */
  readonly travado: boolean;
  readonly onMudar: (secoes: Secao[]) => void;
}) {
  const total = secoes.reduce((t, s) => t + s.perguntas.length, 0);
  const nr1 = modelo === "copsoq";
  const escalas: EscalaNr1[] = [
    "frequencia",
    "intensidade",
    "concordancia",
    "satisfacao",
    "saude",
  ];
  const autopercepcao = temAutopercepcao(secoes);
  return (
    <CartaoDeSecao
      titulo="Perguntas"
      contador={nr1 ? String(total) : `${total} de 18`}
      descricao={
        nr1
          ? "Metodologia padronizada de riscos psicossociais: as perguntas não podem ser editadas."
          : "As perguntas seguem a metodologia do índice e não podem ser alteradas: é isso que permite comparar com a média do Brasil."
      }
    >
      {nr1 ? (
        <p className="modelos__escalas">
          <span className="pesquisas__suave">5 escalas de resposta:</span>
          {escalas.map((e) => (
            <span key={e} className="pesquisas__selo">
              {ESCALAS_NR1[e].nome}
            </span>
          ))}
        </p>
      ) : null}
      <div className="modelos__acordeoes">
        {secoes.map((s, i) => {
          const isfbEtapa = nr1 ? null : etapaIsfb(s.id);
          const primeira = s.perguntas[0]?.id;
          const ultima = s.perguntas[s.perguntas.length - 1]?.id;
          return (
            <details
              key={s.id}
              className="modelos__acordeao"
              {...(i === 0 ? { open: true } : {})}
            >
              <summary className="modelos__acordeao-cabeca">
                <span className="modelos__acordeao-titulo">{s.titulo}</span>
                <span className="pesquisas__suave">
                  {nr1
                    ? plural(s.perguntas.length, "pergunta", "perguntas")
                    : `${plural(s.perguntas.length, "pergunta", "perguntas")} · ${primeira} a ${ultima}`}
                </span>
                {isfbEtapa ? (
                  <span
                    className={`pesquisas__selo${isfbEtapa.papel === "opcional" ? "" : " pesquisas__selo--destaque"}`}
                  >
                    {isfbEtapa.papel === "opcional"
                      ? "Opcional"
                      : "Obrigatória"}
                  </span>
                ) : null}
              </summary>
              <ol className="modelos__perguntas">
                {s.perguntas.map((p) => (
                  <li key={p.id} className="modelos__pergunta">
                    <span className="modelos__codigo">{p.id}</span>
                    <span className="modelos__pergunta-texto">{p.texto}</span>
                    <span className="pesquisas__selo">
                      {seloDaPerguntaFixa(modelo, p)}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          );
        })}
      </div>
      {nr1 ? null : (
        <div className="modelos__opcional">
          <div>
            <strong>Incluir autopercepção (3 perguntas opcionais)</strong>
            <p className="pesquisas__suave">
              Não muda a nota. Ajuda o RH a ver quem percebe a própria situação
              e está aberto a receber apoio.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autopercepcao}
            aria-label="Incluir autopercepção"
            className="pesquisas__interruptor"
            disabled={travado}
            onClick={() => onMudar(comAutopercepcao(secoes, !autopercepcao))}
          >
            <span
              className="pesquisas__interruptor-trilho"
              aria-hidden="true"
            />
          </button>
        </div>
      )}
    </CartaoDeSecao>
  );
}

/** O aviso da saúde financeira abaixo da identificação. */
export function AvisoDaSaudeFinanceira() {
  return (
    <p className="pesquisas__nota" role="note">
      Dinheiro é um tema sensível. Com Confidencial ou Anônima as pessoas
      costumam responder com mais sinceridade; com Identificada, o RH vê o
      resultado de cada pessoa e os perfis do time.
    </p>
  );
}
