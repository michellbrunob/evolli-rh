/**
 * T216 — Saúde financeira: o resultado que a pessoa vê logo depois de
 * enviar, na página pública (no molde do resultado público do DISC). A nota
 * de 0 a 100 em anel na cor da faixa, a frase da faixa, a diferença para a
 * média do Brasil, as barras por dimensão com a linha da média e um cartão
 * por dimensão (com a faixa da própria dimensão). Vale só nesta tela;
 * "Salvar em PDF" usa a impressão do navegador.
 */
import type { ReactNode } from "react";
import { Button } from "../../../../components/Button";
import { etapaIsfb } from "./definicao";
import { MEDIA_DO_BRASIL, type ResultadoLocalIsfb } from "./resultadoLocal";
import { FAIXA_ISFB, umaCasaBr } from "./textos";
import "./Isfb.css";

function AnelDaNota({
  nota,
  cor,
}: {
  readonly nota: number;
  readonly cor: string;
}) {
  const raio = 52;
  const c = 2 * Math.PI * raio;
  return (
    <svg viewBox="0 0 128 128" width={128} height={128} aria-hidden="true">
      <circle
        cx={64}
        cy={64}
        r={raio}
        fill="none"
        stroke="var(--surface-neutral)"
        strokeWidth={12}
      />
      <circle
        cx={64}
        cy={64}
        r={raio}
        fill="none"
        stroke={cor}
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={`${(c * nota) / 100} ${c}`}
        transform="rotate(-90 64 64)"
      />
      <text
        x={64}
        y={66}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={34}
        fontWeight={700}
        fill="var(--color-ink)"
      >
        {nota}
      </text>
      <text
        x={64}
        y={92}
        textAnchor="middle"
        fontSize={11}
        fill="var(--color-ink-muted)"
      >
        de 100
      </text>
    </svg>
  );
}

function textoDaDiferenca(d: number): string {
  if (d === 0) return `Na média do Brasil (${umaCasaBr(MEDIA_DO_BRASIL)})`;
  const pontos = umaCasaBr(Math.abs(d));
  const lado = d > 0 ? "acima" : "abaixo";
  return `${pontos} ${Math.abs(d) === 1 ? "ponto" : "pontos"} ${lado} da média do Brasil (${umaCasaBr(MEDIA_DO_BRASIL)})`;
}

export function ResultadoPublicoIsfb({
  resultado: r,
  previa,
  titulo,
}: {
  readonly resultado: ResultadoLocalIsfb;
  readonly previa: boolean;
  /** O título da tela (recebe o foco). */
  readonly titulo: ReactNode;
}) {
  const faixa = FAIXA_ISFB[r.faixa];
  return (
    <div className="isfb-publico">
      <span
        className="pesquisa-publica__simbolo pesquisa-publica__simbolo--sucesso"
        aria-hidden="true"
      >
        ✓
      </span>
      {titulo}
      <p className="pesquisa-publica__texto">
        {previa
          ? "Esta foi uma pré-visualização: nada foi gravado. Veja como o resultado aparece para quem responde."
          : "Confira abaixo o seu resultado de saúde financeira."}
      </p>

      <section className="isfb-publico__nota" aria-label="Sua nota">
        <div
          role="img"
          aria-label={`Sua nota: ${r.isfb} de 100, faixa ${faixa.rotulo}`}
        >
          <AnelDaNota nota={r.isfb} cor={faixa.cor} />
        </div>
        <div className="isfb-publico__nota-texto">
          <span
            className="isfb-publico__selo"
            style={{ ["--cor-da-faixa" as string]: faixa.cor }}
          >
            {faixa.rotulo}
          </span>
          <h2 className="isfb-publico__subtitulo">
            Sua nota de saúde financeira
          </h2>
          <p>{faixa.frase}</p>
          <p className="isfb-publico__diferenca">
            <span aria-hidden="true">
              {r.diferencaDoBrasil > 0
                ? "↗ "
                : r.diferencaDoBrasil < 0
                  ? "↘ "
                  : ""}
            </span>
            {textoDaDiferenca(r.diferencaDoBrasil)}
          </p>
        </div>
      </section>

      <section className="isfb-publico__bloco" aria-label="Por dimensão">
        <h2 className="isfb-publico__subtitulo">Nota por dimensão</h2>
        <div className="isfb-publico__barras">
          <ul aria-label="Nota por dimensão">
            {r.dimensoes.map((d) => {
              const e = etapaIsfb(d.id);
              return (
                <li key={d.id}>
                  <span>{e.curto}</span>
                  <span
                    className="isfb-publico__trilho"
                    role="progressbar"
                    aria-label={`${e.curto}: ${d.nota} de 100`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={d.nota}
                  >
                    <span style={{ width: `${d.nota}%`, background: e.cor }} />
                    <span
                      className="isfb-publico__media"
                      style={{ left: `${MEDIA_DO_BRASIL}%` }}
                      aria-hidden="true"
                    />
                  </span>
                  <strong>{d.nota}</strong>
                </li>
              );
            })}
          </ul>
          <p className="isfb-publico__legenda">
            <span className="isfb-publico__traco" aria-hidden="true" />
            {`Média do Brasil: ${umaCasaBr(MEDIA_DO_BRASIL)}`}
          </p>
        </div>
      </section>

      <ul className="isfb-publico__cartoes" aria-label="Suas dimensões">
        {r.dimensoes.map((d) => {
          const e = etapaIsfb(d.id);
          const f = FAIXA_ISFB[d.faixa];
          return (
            <li
              key={d.id}
              className="isfb-publico__cartao"
              style={{ ["--cor-da-dimensao" as string]: e.cor }}
            >
              <div className="isfb-publico__cartao-topo">
                <h3>{e.curto}</h3>
                <span
                  className="isfb-publico__selo"
                  style={{ ["--cor-da-faixa" as string]: f.cor }}
                >
                  {f.rotulo}
                </span>
              </div>
              <strong>{d.nota}</strong>
              <span className="isfb-publico__trilho" aria-hidden="true">
                <span style={{ width: `${d.nota}%`, background: e.cor }} />
              </span>
              <p>{e.texto}</p>
              {d.id === "autopercepcao" ? (
                <p className="isfb-publico__suave">Não entra na nota geral.</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="isfb-publico__sobre">
        A nota vai de 0 a 100 e soma segurança, habilidade, comportamento e
        liberdade financeira, ajustada pela base financeira da casa (produtos,
        renda e escolaridade). A média do Brasil é a referência nacional de
        2024.
      </p>
      <p className="isfb-publico__aviso" role="note">
        Este resultado aparece só agora. Ao fechar a página, ele não pode ser
        aberto de novo — salve em PDF se quiser guardar.
      </p>
      <div className="isfb-publico__acoes">
        <Button variant="secondary" onClick={() => window.print()}>
          Salvar em PDF
        </Button>
      </div>
    </div>
  );
}
