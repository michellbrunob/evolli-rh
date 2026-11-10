/**
 * T207 — blocos do time na Visão Geral: Distribuição do time (por
 * departamento) e Tempo de casa. Só pessoas ativas hoje, só o vínculo
 * principal, só a empresa da sessão — e nenhum grupo com menos de 3 pessoas
 * aparece com nome ou número exato (ver `dashboardDados.ts`).
 */
import type { ReactNode } from "react";
import { ComoCalculamos } from "./componentesDoDashboard";
import {
  MINIMO_DO_GRUPO,
  calcularTempoDeCasa,
  distribuirPorDepartamento,
  duracaoEmTexto,
  plural,
  type TimeDeHoje,
} from "./dashboardDados";

interface PropsDoBloco {
  /** `id` do título (o foco vai a ele depois de uma nova tentativa). */
  readonly idTitulo: string;
  /** O time lido; `null` enquanto carrega. */
  readonly time: TimeDeHoje | null;
  /** Alerta e nova tentativa, quando a leitura falhou. */
  readonly falha: ReactNode;
}

/** O teto da leitura (20 páginas de 100), escrito para quem lê. */
const TEXTO_DO_TETO =
  "Mais de 2.000 pessoas ativas: o limite desta visão. Os números não são exibidos para não mostrar um total incompleto.";

function Carregando() {
  return (
    <p className="dashboard__nota" aria-hidden="true">
      Carregando…
    </p>
  );
}

function PoucaGente({ assunto }: { readonly assunto: string }) {
  return (
    <div className="dashboard__vazio-quadro">
      <p className="dashboard__selo dashboard__selo--estado">
        Não exibido por privacidade
      </p>
      <p className="dashboard__vazio-texto">
        Com menos de {MINIMO_DO_GRUPO} pessoas ativas, {assunto} não é mostrado
        para não identificar ninguém.
      </p>
    </div>
  );
}

function porcentagem(parte: number, total: number): string {
  return `${Math.round((parte / total) * 100)}%`;
}

export function DistribuicaoDoTimeBloco({
  idTitulo,
  time,
  falha,
}: PropsDoBloco) {
  let conteudo: ReactNode;
  if (falha) {
    conteudo = falha;
  } else if (time === null) {
    conteudo = <Carregando />;
  } else if (time.tipo === "excedido") {
    conteudo = <p className="dashboard__aviso">{TEXTO_DO_TETO}</p>;
  } else {
    const d = distribuirPorDepartamento(time.pessoas);
    if (d.tipo === "pouca-gente") {
      conteudo = <PoucaGente assunto="a distribuição" />;
    } else {
      const linhas = [
        ...d.grupos.map((g) => ({ nome: g.nome, n: g.pessoas, neutro: false })),
        ...(d.agrupadas > 0
          ? [
              {
                nome: "Grupos com menos de 3 pessoas ou sem departamento",
                n: d.agrupadas,
                neutro: true,
              },
            ]
          : []),
      ];
      conteudo = (
        <>
          <p className="dashboard__destaque">
            <span className="dashboard__destaque-valor">{String(d.total)}</span>{" "}
            {d.total === 1 ? "pessoa" : "pessoas"} em{" "}
            {plural(d.departamentos, "departamento", "departamentos")}
          </p>
          <div className="dashboard__barra-tipos" aria-hidden="true">
            {linhas.map((l, i) => (
              <span
                key={l.nome}
                className={
                  l.neutro
                    ? "dashboard__barra-tipo dashboard__barra-grupo--neutro"
                    : `dashboard__barra-tipo dashboard__barra-grupo--${i % 4}`
                }
                style={{ flexGrow: l.n }}
              />
            ))}
          </div>
          <ul className="dashboard__grupos">
            {linhas.map((l, i) => (
              <li key={l.nome} className="dashboard__grupo">
                <span
                  className={
                    l.neutro
                      ? "dashboard__marca dashboard__barra-grupo--neutro"
                      : `dashboard__marca dashboard__barra-grupo--${i % 4}`
                  }
                  aria-hidden="true"
                />
                <span className="dashboard__grupo-nome">{l.nome}</span>
                <span className="dashboard__grupo-valor">
                  {plural(l.n, "pessoa", "pessoas")} ·{" "}
                  {porcentagem(l.n, d.total)}
                </span>
              </li>
            ))}
          </ul>
          <p className="dashboard__explicacao">
            Departamentos com menos de {MINIMO_DO_GRUPO} pessoas, e quem não tem
            departamento vigente, ficam juntos para não identificar ninguém.
          </p>
          <ComoCalculamos assunto="distribuição do time">
            <p>
              Pessoas ativas hoje, pelo departamento da lotação vigente do
              vínculo principal, no cadastro de Colaboradores da empresa ativa.
              Cada pessoa conta uma vez.
            </p>
            <p>
              Centro de custo, área e unidade ainda não fazem parte do cadastro
              listado; por isso, só departamento por enquanto.
            </p>
          </ComoCalculamos>
        </>
      );
    }
  }
  return (
    <section className="dashboard__bloco" aria-labelledby={idTitulo}>
      <div className="dashboard__bloco-topo">
        <h2 id={idTitulo} tabIndex={-1} className="dashboard__subtitulo">
          Distribuição do time
        </h2>
        <p className="dashboard__explicacao">
          Pessoas ativas hoje por departamento.
        </p>
      </div>
      {conteudo}
    </section>
  );
}

export function TempoDeCasaBloco({ idTitulo, time, falha }: PropsDoBloco) {
  let conteudo: ReactNode;
  if (falha) {
    conteudo = falha;
  } else if (time === null) {
    conteudo = <Carregando />;
  } else if (time.tipo === "excedido") {
    conteudo = <p className="dashboard__aviso">{TEXTO_DO_TETO}</p>;
  } else {
    const t = calcularTempoDeCasa(time.pessoas);
    if (t.tipo === "pouca-gente") {
      conteudo = <PoucaGente assunto="o tempo de casa" />;
    } else {
      const maior = Math.max(1, ...t.faixas.map((f) => f.pessoas));
      conteudo = (
        <>
          <p className="dashboard__destaque">
            <span className="dashboard__destaque-valor">
              {duracaoEmTexto(t.medianaEmMeses)}
            </span>{" "}
            na mediana
          </p>
          <ul className="dashboard__faixas">
            {t.faixas.map((f) => (
              <li key={f.rotulo} className="dashboard__faixa">
                <span className="dashboard__faixa-rotulo">{f.rotulo}</span>
                <span className="dashboard__faixa-trilho" aria-hidden="true">
                  <span
                    className="dashboard__faixa-barra"
                    style={{ width: `${(f.pessoas / maior) * 100}%` }}
                  />
                </span>
                <span className="dashboard__faixa-valor">
                  {plural(f.pessoas, "pessoa", "pessoas")}
                </span>
              </li>
            ))}
          </ul>
          {t.semData > 0 ? (
            <p className="dashboard__nota">
              {plural(t.semData, "pessoa sem", "pessoas sem")} data de admissão
              legível não entram no cálculo.
            </p>
          ) : null}
          <p className="dashboard__explicacao">
            Faixa com menos de {MINIMO_DO_GRUPO} pessoas se junta à faixa
            vizinha, para não identificar ninguém.
          </p>
          <ComoCalculamos assunto="tempo de casa">
            <p>
              Meses completos entre a admissão do vínculo principal de cada
              pessoa ativa e o dia de hoje (pelo relógio deste navegador). Uma
              readmissão conta a partir do vínculo atual.
            </p>
            <p>
              A mediana é o tempo do meio: metade do time está há menos tempo e
              metade há mais. Não usamos média para que poucos vínculos muito
              antigos não distorçam o número.
            </p>
          </ComoCalculamos>
        </>
      );
    }
  }
  return (
    <section className="dashboard__bloco" aria-labelledby={idTitulo}>
      <div className="dashboard__bloco-topo">
        <h2 id={idTitulo} tabIndex={-1} className="dashboard__subtitulo">
          Tempo de casa
        </h2>
        <p className="dashboard__explicacao">
          Há quanto tempo as pessoas ativas estão no vínculo atual.
        </p>
      </div>
      {conteudo}
    </section>
  );
}
