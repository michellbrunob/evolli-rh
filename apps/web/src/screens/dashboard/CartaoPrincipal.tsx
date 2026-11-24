/**
 * T214 — o card principal da Visão Geral: um card só, com o selo "Resumo do
 * time", a hora da leitura, a frase do time (números em destaque) e quatro
 * indicadores lado a lado.
 *
 * Só números com fonte: colaboradores ativos (hoje) e o saldo de vínculos do
 * período; turnover, absenteísmo e custo por pessoa aparecem como "—" com o
 * motivo numa linha, nunca como zero.
 */
import { NumeroSuave } from "../../ui/movimento";
import { Fragment, type ReactNode } from "react";
import { InfoComoCalculamos } from "./componentesDoDashboard";
import {
  fraseDoTime,
  saldoAcumulado,
  type PeriodoDoDashboard,
} from "./dashboardDados";

/** O que o card precisa das movimentações do período (só a leitura completa). */
export interface MovimentoDoPeriodo {
  readonly total: number;
  readonly porMes: readonly number[];
}

function sinal(n: number): string {
  if (n > 0) return `+${String(n)}`;
  if (n < 0) return `−${String(Math.abs(n))}`;
  return "0";
}

/**
 * Minilinha do saldo acumulado mês a mês (decorativa: o número e o saldo
 * estão escritos ao lado). Sem eixo, sem rótulo, sem cor como informação.
 */
function MiniLinha({ valores }: { readonly valores: readonly number[] }) {
  const L = 96;
  const A = 32;
  const M = 3;
  if (valores.length === 0) return null;
  const min = Math.min(0, ...valores);
  const max = Math.max(0, ...valores);
  const faixa = max - min || 1;
  const pontos = valores.map((v, i) => {
    const x =
      valores.length === 1
        ? L - M
        : M + (i * (L - 2 * M)) / (valores.length - 1);
    const y = A - M - ((v - min) / faixa) * (A - 2 * M);
    return [x, y] as const;
  });
  const linha = pontos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);
  const [ultX, ultY] = pontos[pontos.length - 1]!;
  const area = `${linha.join(" ")} ${ultX.toFixed(1)},${String(A)} ${pontos[0]![0].toFixed(1)},${String(A)}`;
  return (
    <svg
      className="dashboard__minilinha"
      viewBox={`0 0 ${String(L)} ${String(A)}`}
      width={L}
      height={A}
      aria-hidden="true"
      focusable="false"
    >
      <polygon className="dashboard__minilinha-area" points={area} />
      <polyline
        className="dashboard__minilinha-linha"
        points={linha.join(" ")}
      />
      <circle
        className="dashboard__minilinha-ponto"
        cx={ultX}
        cy={ultY}
        r="3"
      />
    </svg>
  );
}

/** Indicador sem dado: "—" à vista, o motivo numa linha. */
function IndicadorSemDado({
  id,
  rotulo,
  motivo,
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly motivo: string;
}) {
  return (
    <li>
      <article
        className="dashboard__indicador dashboard__indicador--sem-dado"
        aria-labelledby={id}
      >
        <h3 id={id} className="dashboard__indicador-rotulo">
          {rotulo}
        </h3>
        <p className="dashboard__indicador-valor" aria-hidden="true">
          —
        </p>
        <p className="dashboard__indicador-nota dashboard__indicador-nota--motivo">
          {motivo}
        </p>
      </article>
    </li>
  );
}

export function CartaoPrincipal({
  idTitulo,
  prefixo,
  lidoEm,
  ativos,
  emAdmissao,
  falhouAoLer,
  entradas,
  saidas,
  periodo,
  falha,
}: {
  readonly idTitulo: string;
  readonly prefixo: string;
  readonly lidoEm: string | null;
  /** Pessoas ativas hoje; `null` enquanto lê ou se falhou. */
  readonly ativos: number | null;
  readonly emAdmissao: number | null;
  readonly falhouAoLer: boolean;
  /** Admissões e desligamentos efetivados do período (leitura completa). */
  readonly entradas: MovimentoDoPeriodo | null;
  readonly saidas: MovimentoDoPeriodo | null;
  readonly periodo: PeriodoDoDashboard;
  /** Alerta e nova tentativa dos totais de pessoas. */
  readonly falha: ReactNode;
}) {
  const comMovimento = entradas !== null && saidas !== null;
  const saldo = comMovimento ? entradas.total - saidas.total : null;
  const noPeriodo = periodo.ateHoje ? "no ano" : `em ${String(periodo.ano)}`;
  const idAtivos = `${prefixo}-ind-ativos`;

  return (
    <section className="dashboard__resumo" aria-labelledby={idTitulo}>
      <div className="dashboard__resumo-topo">
        <div className="dashboard__chip">
          <span className="dashboard__chip-marca" aria-hidden="true">
            ✦
          </span>
          {/* O título do card (o foco volta aqui depois de uma nova
              tentativa); o ano vem logo depois, no mesmo selo. */}
          <h2 id={idTitulo} tabIndex={-1} className="dashboard__chip-titulo">
            Resumo do time
          </h2>
          {/* `key` pelo ano: o rótulo é remontado, nunca reescrito. */}
          <span key={periodo.ano} className="dashboard__chip-ano">
            · {String(periodo.ano)}
          </span>
        </div>
        {/* A hora da leitura, uma vez só: na Visão Geral fica aqui; nas
            outras abas, junto de "Atualizar". */}
        <span className="dashboard__selo dashboard__selo--leitura">
          {lidoEm ? `Dados lidos em ${lidoEm}` : "Ainda não lido"}
        </span>
      </div>

      {ativos !== null && emAdmissao !== null ? (
        <p className="dashboard__frase">
          {fraseDoTime({
            ativos,
            emAdmissao,
            entradas: comMovimento ? entradas.total : null,
            saidas: comMovimento ? saidas.total : null,
            periodo,
          }).map((t, i) =>
            t.destaque ? (
              <strong key={i} className="dashboard__frase-destaque">
                {t.texto}
              </strong>
            ) : (
              <Fragment key={i}>{t.texto}</Fragment>
            ),
          )}
        </p>
      ) : null}
      {falha}

      <ul className="dashboard__indicadores">
        <li>
          <article className="dashboard__indicador" aria-labelledby={idAtivos}>
            <div className="dashboard__titulo-com-info dashboard__ancora-info">
              <h3 id={idAtivos} className="dashboard__indicador-rotulo">
                Colaboradores ativos
              </h3>
              {ativos !== null ? (
                <InfoComoCalculamos assunto="colaboradores ativos">
                  <p>
                    Pessoas com vínculo principal ativo hoje, no cadastro de
                    Colaboradores da empresa ativa. Cada pessoa conta uma vez.
                  </p>
                  <p>
                    O saldo é a diferença entre admissões e desligamentos
                    efetivados no período, contados em vínculos (uma pessoa pode
                    ter mais de um vínculo).
                  </p>
                </InfoComoCalculamos>
              ) : null}
            </div>
            {ativos !== null ? (
              <>
                <p className="dashboard__indicador-valor">
                  <NumeroSuave valor={ativos} />
                  <span className="dashboard__so-leitor">
                    {ativos === 1 ? " pessoa" : " pessoas"}
                  </span>
                </p>
                {/* Saldo à esquerda e minilinha à direita, na mesma linha:
                    nunca um por cima do outro. */}
                <div className="dashboard__indicador-rodape">
                  <p className="dashboard__indicador-nota">
                    {saldo !== null ? (
                      <>
                        <span
                          className={`dashboard__variacao dashboard__variacao--${
                            saldo > 0 ? "alta" : saldo < 0 ? "baixa" : "neutra"
                          }`}
                        >
                          {sinal(saldo)}
                        </span>{" "}
                        {noPeriodo}
                        <span className="dashboard__so-leitor">
                          {" "}
                          (saldo de vínculos)
                        </span>
                      </>
                    ) : (
                      "com vínculo ativo hoje"
                    )}
                  </p>
                  {comMovimento ? (
                    <MiniLinha
                      valores={saldoAcumulado(entradas.porMes, saidas.porMes)}
                    />
                  ) : null}
                </div>
              </>
            ) : falhouAoLer ? (
              <p className="dashboard__indicador-nota">
                Totais de pessoas indisponíveis no momento.
              </p>
            ) : (
              <p className="dashboard__nota" aria-hidden="true">
                Carregando…
              </p>
            )}
          </article>
        </li>
        <IndicadorSemDado
          id={`${prefixo}-ind-turnover`}
          rotulo="Turnover no ano"
          motivo="aguarda a regra de cálculo"
        />
        <IndicadorSemDado
          id={`${prefixo}-ind-absenteismo`}
          rotulo="Absenteísmo"
          motivo="depende da apuração do ponto"
        />
        <IndicadorSemDado
          id={`${prefixo}-ind-custo`}
          rotulo="Custo por pessoa"
          motivo="a folha é feita fora do Evolli"
        />
      </ul>
    </section>
  );
}
