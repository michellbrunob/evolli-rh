/**
 * T207 — Quadro de colaboradores (Visão Geral).
 *
 * Entradas e saídas são as movimentações efetivadas de admissão e de
 * desligamento de cada mês (as mesmas da T205), e o saldo é a diferença
 * delas. "Ativos no fim" e "Turnover" ainda não têm fonte nem regra
 * aprovada: aparecem como "—" (lidos como "indisponível"), nunca como zero,
 * no gráfico, na tabela e no CSV.
 *
 * Gráfico e tabela mostram os mesmos números; o menu de reticências troca a
 * vista, baixa o CSV e abre a impressão só deste quadro (salvar como PDF).
 */
import { useRef, type ReactNode } from "react";
import {
  InfoComoCalculamos,
  type VistaDoBloco,
} from "./componentesDoDashboard";
import { nomeDoMes, type PeriodoDoDashboard } from "./dashboardDados";
import {
  baixarArquivo,
  imprimirSomente,
  montarCsv,
  nomeDoArquivo,
} from "./exportacao";
import { GraficoMensal } from "./GraficoMensal";
import { MenuDeAcoes, type AcaoDoMenu } from "./MenuDeAcoes";

export const TITULO_DO_QUADRO = "Quadro de colaboradores";
export const SUBTITULO_DO_QUADRO =
  "Pessoas ativas no fim de cada mês e quem entrou e saiu";
/** As colunas do quadro, na tabela e no CSV. */
export const COLUNAS_DO_QUADRO = [
  "Mês",
  "Ativos no fim",
  "Entradas",
  "Saídas",
  "Turnover",
] as const;

export interface DadosDoQuadro {
  /** Entradas (admissões efetivadas) por mês, do primeiro ao último. */
  readonly entradas: readonly number[];
  /** Saídas (desligamentos efetivados) por mês. */
  readonly saidas: readonly number[];
}

/** As linhas do quadro: o mesmo conteúdo da tabela e do CSV. */
export function linhasDoQuadro(
  periodo: PeriodoDoDashboard,
  dados: DadosDoQuadro,
) {
  return Array.from({ length: periodo.meses }, (_, i) => ({
    mes: i,
    ativosNoFim: null,
    entradas: dados.entradas[i] ?? 0,
    saidas: dados.saidas[i] ?? 0,
    turnover: null,
  }));
}

/** O CSV do quadro: um mês por linha, "—" no que não tem fonte. */
export function csvDoQuadro(
  periodo: PeriodoDoDashboard,
  dados: DadosDoQuadro,
): string {
  return montarCsv(
    COLUNAS_DO_QUADRO,
    linhasDoQuadro(periodo, dados).map((l) => [
      `${nomeDoMes(l.mes)} de ${String(periodo.ano)}`,
      l.ativosNoFim,
      l.entradas,
      l.saidas,
      l.turnover,
    ]),
  );
}

function sinal(n: number): string {
  if (n > 0) return `+${String(n)}`;
  if (n < 0) return `−${String(Math.abs(n))}`;
  return "0";
}

const soma = (valores: readonly number[]) => valores.reduce((a, b) => a + b, 0);

/** Célula sem fonte: "—" à vista, "indisponível" para o leitor de tela. */
export function CelulaIndisponivel() {
  return (
    <td className="dashboard__celula-indisponivel">
      <span aria-hidden="true">—</span>
      <span className="dashboard__so-leitor">indisponível</span>
    </td>
  );
}

export interface QuadroDeColaboradoresProps {
  readonly idTitulo: string;
  readonly empresa: string;
  readonly periodo: PeriodoDoDashboard;
  /** "em 2026, até hoje" / "em 2025". */
  readonly quando: string;
  /** Pessoas ativas hoje (contadores), ou `null` se não lidas. */
  readonly ativosHoje: number | null;
  /** Os números do ano exibido, ou `null` (carregando, falha ou teto). */
  readonly dados: DadosDoQuadro | null;
  /** O que mostrar sem números: carregando, falha ou teto. */
  readonly semDados: ReactNode;
  readonly vista: VistaDoBloco;
  readonly onTrocarVista: (vista: VistaDoBloco) => void;
  /** Um anúncio no status da tela (sem mexer na hora da leitura). */
  readonly onAnunciar: (texto: string) => void;
}

export function QuadroDeColaboradores({
  idTitulo,
  empresa,
  periodo,
  quando,
  ativosHoje,
  dados,
  semDados,
  vista,
  onTrocarVista,
  onAnunciar,
}: QuadroDeColaboradoresProps) {
  const blocoRef = useRef<HTMLElement | null>(null);

  const acoes: AcaoDoMenu[] = dados
    ? [
        vista === "grafico"
          ? {
              id: "vista",
              rotulo: "Ver como tabela",
              descricao: "Mês a mês, em linhas e colunas",
              aoEscolher: () => {
                onTrocarVista("tabela");
                onAnunciar("Quadro de colaboradores em tabela.");
              },
            }
          : {
              id: "vista",
              rotulo: "Ver como gráfico",
              descricao: "Barras de entradas e saídas por mês",
              aoEscolher: () => {
                onTrocarVista("grafico");
                onAnunciar("Quadro de colaboradores em gráfico.");
              },
            },
        {
          id: "csv",
          rotulo: "Baixar CSV",
          descricao: "Planilha com os números do quadro",
          aoEscolher: () => {
            const nome = nomeDoArquivo(
              [TITULO_DO_QUADRO, empresa, periodo.ano],
              "csv",
            );
            baixarArquivo(csvDoQuadro(periodo, dados), nome);
            onAnunciar(`Arquivo ${nome} baixado.`);
          },
        },
        {
          id: "pdf",
          rotulo: "Exportar PDF",
          descricao:
            "Abre a impressão do navegador; no destino, escolha Salvar como PDF",
          aoEscolher: () => {
            onAnunciar(
              "Impressão aberta só com o Quadro de colaboradores. No destino, escolha Salvar como PDF.",
            );
            // Depois do desenho: o menu já fechou e o foco já voltou.
            window.setTimeout(() => {
              if (blocoRef.current) imprimirSomente(blocoRef.current);
            }, 0);
          },
        },
      ]
    : [];

  let conteudo: ReactNode = semDados;
  if (dados) {
    const linhas = linhasDoQuadro(periodo, dados);
    const totalEntradas = soma(linhas.map((l) => l.entradas));
    const totalSaidas = soma(linhas.map((l) => l.saidas));
    conteudo = (
      <>
        <div className="dashboard__quadro-topo">
          <p className="dashboard__destaque">
            {ativosHoje !== null ? (
              <>
                <span className="dashboard__destaque-valor">
                  {String(ativosHoje)}
                </span>{" "}
                {ativosHoje === 1 ? "pessoa ativa hoje" : "pessoas ativas hoje"}
              </>
            ) : null}
          </p>
          <ul className="dashboard__totais">
            <li className="dashboard__total">
              <span
                className="dashboard__marca dashboard__marca--admissao"
                aria-hidden="true"
              />
              <span className="dashboard__total-rotulo">Entradas</span>
              <span className="dashboard__total-valor">
                {String(totalEntradas)}
              </span>
            </li>
            <li className="dashboard__total">
              <span
                className="dashboard__marca dashboard__marca--desligamento"
                aria-hidden="true"
              />
              <span className="dashboard__total-rotulo">Saídas</span>
              <span className="dashboard__total-valor">
                {String(totalSaidas)}
              </span>
            </li>
            <li className="dashboard__total">
              <span className="dashboard__total-rotulo">Saldo</span>
              <span className="dashboard__total-valor">
                {sinal(totalEntradas - totalSaidas)}
              </span>
            </li>
          </ul>
        </div>
        {vista === "tabela" ? (
          <div className="dashboard__quadro">
            <table className="dashboard__tabela dashboard__tabela--quadro">
              <caption>Quadro de colaboradores por mês, {quando}</caption>
              <thead>
                <tr>
                  {COLUNAS_DO_QUADRO.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.mes}>
                    <th scope="row">{nomeDoMes(l.mes)}</th>
                    <CelulaIndisponivel />
                    <td>{l.entradas}</td>
                    <td>{l.saidas}</td>
                    <CelulaIndisponivel />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <CelulaIndisponivel />
                  <td>{totalEntradas}</td>
                  <td>{totalSaidas}</td>
                  <CelulaIndisponivel />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : totalEntradas + totalSaidas === 0 ? (
          <p className="dashboard__vazio">
            Nenhuma entrada ou saída efetivada {quando}.
          </p>
        ) : (
          <GraficoMensal
            ano={periodo.ano}
            meses={periodo.meses}
            tipos={["admissao", "desligamento"]}
            porTipo={{
              admissao: dados.entradas,
              desligamento: dados.saidas,
              transferencia_organizacional: [],
              mudanca_cargo: [],
            }}
            rotulos={{ admissao: "Entradas", desligamento: "Saídas" }}
            rotuloDoSaldo="Saldo"
            indisponiveis={["Ativos no fim", "Turnover"]}
            rotulo="Entradas e saídas por mês — use as setas para percorrer os meses"
          />
        )}
      </>
    );
  }

  return (
    <section
      ref={blocoRef}
      className="dashboard__bloco dashboard__bloco--quadro"
      aria-labelledby={idTitulo}
    >
      {dados ? (
        <p className="dashboard__so-impressao">
          {empresa} · {TITULO_DO_QUADRO} · {nomeDoMes(0)} a{" "}
          {nomeDoMes(periodo.meses - 1)} de {String(periodo.ano)}
        </p>
      ) : null}
      <div className="dashboard__bloco-cabeca">
        <div className="dashboard__bloco-topo">
          <div className="dashboard__titulo-com-info">
            <h2 id={idTitulo} tabIndex={-1} className="dashboard__subtitulo">
              {TITULO_DO_QUADRO}
            </h2>
            <InfoComoCalculamos assunto="quadro de colaboradores">
              <p>
                <strong>Entradas</strong>: admissões efetivadas com vigência no
                mês (no ano corrente, até hoje). <strong>Saídas</strong>:
                desligamentos efetivados, pela mesma regra.{" "}
                <strong>Saldo</strong>: entradas menos saídas. A contagem é em
                vínculos: uma pessoa readmitida conta de novo.
              </p>
              <p>
                Programadas, solicitadas, canceladas e retificadas não contam; a
                retificação conta pela movimentação nova, quando efetivada. Cada
                tipo é lido até 2.000 movimentações no ano; acima disso, nada é
                exibido.
              </p>
              <p>
                <strong>Ativos no fim</strong> e <strong>turnover</strong>{" "}
                aguardam fonte e definição: o Evolli sabe quem está ativo hoje,
                mas ainda não guarda um histórico confiável de quem estava ativo
                no último dia de cada mês, nem tem uma fórmula de turnover
                aprovada. Por isso aparecem como “—”, nunca como zero.
              </p>
            </InfoComoCalculamos>
          </div>
          <p className="dashboard__explicacao">{SUBTITULO_DO_QUADRO}</p>
        </div>
        {dados ? (
          <MenuDeAcoes assunto={TITULO_DO_QUADRO} acoes={acoes} />
        ) : null}
      </div>
      {conteudo}
      <p className="dashboard__nota dashboard__nota--discreta">
        Ativos no fim e turnover ainda não têm fonte no Evolli e aparecem como
        “—”. Entradas e saídas são movimentações efetivadas, contadas em
        vínculos.
      </p>
    </section>
  );
}
