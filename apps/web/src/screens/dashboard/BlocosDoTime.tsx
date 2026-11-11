/**
 * T207 — blocos do time na Visão Geral: Distribuição do time (por
 * departamento) e Tempo de casa. Só pessoas ativas hoje, só o vínculo
 * principal, só a empresa da sessão — e nenhum grupo com menos de 3 pessoas
 * aparece com nome ou número exato, nem pode ser deduzido pelos outros números
 * do bloco (ver `dashboardDados.ts`).
 *
 * Com dado real, cada bloco tem gráfico e tabela (os mesmos números) e o
 * menu de reticências: trocar a vista, baixar o CSV e imprimir só o bloco.
 * Sem dado (carregando, falha, teto ou menos de 3 pessoas), nenhum menu.
 */
import { useRef, type ReactNode } from "react";
import { ComoCalculamos, type VistaDoBloco } from "./componentesDoDashboard";
import {
  MINIMO_DO_GRUPO,
  calcularTempoDeCasa,
  distribuirPorDepartamento,
  duracaoEmTexto,
  plural,
  type TimeDeHoje,
} from "./dashboardDados";
import {
  baixarArquivo,
  imprimirSomente,
  montarCsv,
  nomeDoArquivo,
  type CelulaDoCsv,
} from "./exportacao";
import { MenuDeAcoes, type AcaoDoMenu } from "./MenuDeAcoes";

interface PropsDoBloco {
  /** `id` do título (o foco vai a ele depois de uma nova tentativa). */
  readonly idTitulo: string;
  /** O time lido; `null` enquanto carrega. */
  readonly time: TimeDeHoje | null;
  /** Alerta e nova tentativa (ou a nota), quando a leitura falhou. */
  readonly falha: ReactNode;
  /** Nome da empresa ativa (arquivo do CSV e cabeçalho da impressão). */
  readonly empresa: string;
  readonly vista: VistaDoBloco;
  readonly onTrocarVista: (vista: VistaDoBloco) => void;
  readonly onAnunciar: (texto: string) => void;
}

/** O teto da leitura (20 páginas de 100), escrito para quem lê. */
const TEXTO_DO_TETO =
  "Mais de 2.000 pessoas ativas: o limite desta visão. Os números não são exibidos para não mostrar um total incompleto.";

export const GRUPO_NEUTRO = "Outros (agrupados por privacidade)";

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

/** Linha de um bloco do time: chave estável, nome e quantidade (já seguros). */
interface LinhaDoTime {
  readonly chave: string;
  readonly nome: string;
  readonly pessoas: number;
  readonly neutro?: boolean;
}

/** As ações do menu de um bloco do time. */
function acoesDoBloco({
  titulo,
  empresa,
  vista,
  onTrocarVista,
  onAnunciar,
  colunas,
  linhas,
  blocoRef,
}: {
  readonly titulo: string;
  readonly empresa: string;
  readonly vista: VistaDoBloco;
  readonly onTrocarVista: (vista: VistaDoBloco) => void;
  readonly onAnunciar: (texto: string) => void;
  readonly colunas: readonly string[];
  readonly linhas: readonly (readonly CelulaDoCsv[])[];
  readonly blocoRef: { readonly current: HTMLElement | null };
}): AcaoDoMenu[] {
  return [
    vista === "grafico"
      ? {
          id: "vista",
          rotulo: "Ver como tabela",
          descricao: "Grupos e números em linhas e colunas",
          aoEscolher: () => {
            onTrocarVista("tabela");
            onAnunciar(`${titulo} em tabela.`);
          },
        }
      : {
          id: "vista",
          rotulo: "Ver como gráfico",
          descricao: "Barras proporcionais a cada grupo",
          aoEscolher: () => {
            onTrocarVista("grafico");
            onAnunciar(`${titulo} em gráfico.`);
          },
        },
    {
      id: "csv",
      rotulo: "Baixar CSV",
      descricao: "Planilha com os números do bloco",
      aoEscolher: () => {
        const nome = nomeDoArquivo([titulo, empresa, "hoje"], "csv");
        baixarArquivo(montarCsv(colunas, linhas), nome);
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
          `Impressão aberta só com ${titulo}. No destino, escolha Salvar como PDF.`,
        );
        window.setTimeout(() => {
          if (blocoRef.current) imprimirSomente(blocoRef.current);
        }, 0);
      },
    },
  ];
}

function TabelaDoTime({
  legenda,
  primeiraColuna,
  linhas,
  total,
}: {
  readonly legenda: string;
  readonly primeiraColuna: string;
  readonly linhas: readonly LinhaDoTime[];
  readonly total: number;
}) {
  return (
    <div className="dashboard__quadro">
      <table className="dashboard__tabela">
        <caption>{legenda}</caption>
        <thead>
          <tr>
            <th scope="col">{primeiraColuna}</th>
            <th scope="col">Pessoas</th>
            <th scope="col">Percentual</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave}>
              <th scope="row">{l.nome}</th>
              <td>{l.pessoas}</td>
              <td>{porcentagem(l.pessoas, total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{total}</td>
            <td>100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Cabeçalho do bloco: título, subtítulo e (com dado) o menu. */
function Cabecalho({
  idTitulo,
  titulo,
  subtitulo,
  acoes,
}: {
  readonly idTitulo: string;
  readonly titulo: string;
  readonly subtitulo: string;
  readonly acoes: readonly AcaoDoMenu[] | null;
}) {
  return (
    <div className="dashboard__bloco-cabeca">
      <div className="dashboard__bloco-topo">
        <h2 id={idTitulo} tabIndex={-1} className="dashboard__subtitulo">
          {titulo}
        </h2>
        <p className="dashboard__explicacao">{subtitulo}</p>
      </div>
      {acoes ? <MenuDeAcoes assunto={titulo} acoes={acoes} /> : null}
    </div>
  );
}

export function DistribuicaoDoTimeBloco({
  idTitulo,
  time,
  falha,
  empresa,
  vista,
  onTrocarVista,
  onAnunciar,
}: PropsDoBloco) {
  const titulo = "Distribuição do time";
  const blocoRef = useRef<HTMLElement | null>(null);
  let conteudo: ReactNode;
  let acoes: AcaoDoMenu[] | null = null;
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
      const linhas: LinhaDoTime[] = [
        ...d.grupos.map((g) => ({
          chave: g.id,
          nome: g.nome,
          pessoas: g.pessoas,
        })),
        ...(d.agrupadas > 0
          ? [
              {
                chave: "neutro",
                nome: GRUPO_NEUTRO,
                pessoas: d.agrupadas,
                neutro: true,
              },
            ]
          : []),
      ];
      acoes = acoesDoBloco({
        titulo,
        empresa,
        vista,
        onTrocarVista,
        onAnunciar,
        colunas: ["Grupo", "Pessoas", "Percentual"],
        linhas: linhas.map((l) => [
          l.nome,
          l.pessoas,
          porcentagem(l.pessoas, d.total),
        ]),
        blocoRef,
      });
      conteudo = (
        <>
          <p className="dashboard__destaque">
            <span className="dashboard__destaque-valor">{String(d.total)}</span>{" "}
            pessoas ativas
          </p>
          {vista === "tabela" ? (
            <TabelaDoTime
              legenda="Pessoas ativas hoje por departamento"
              primeiraColuna="Grupo"
              linhas={linhas}
              total={d.total}
            />
          ) : (
            <>
              <div className="dashboard__barra-tipos" aria-hidden="true">
                {linhas.map((l, i) => (
                  <span
                    key={l.chave}
                    className={
                      l.neutro
                        ? "dashboard__barra-tipo dashboard__barra-grupo--neutro"
                        : `dashboard__barra-tipo dashboard__barra-grupo--${i % 4}`
                    }
                    style={{ flexGrow: l.pessoas }}
                  />
                ))}
              </div>
              <ul className="dashboard__grupos">
                {linhas.map((l, i) => (
                  <li key={l.chave} className="dashboard__grupo">
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
                      {plural(l.pessoas, "pessoa", "pessoas")} ·{" "}
                      {porcentagem(l.pessoas, d.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="dashboard__explicacao">
            Departamentos com menos de {MINIMO_DO_GRUPO} pessoas e quem não tem
            departamento vigente ficam num grupo sem nome; se esse grupo ficaria
            com 1 ou 2 pessoas, o menor departamento entra nele. Assim nenhum
            número permite identificar alguém.
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
    <section
      ref={blocoRef}
      className="dashboard__bloco"
      aria-labelledby={idTitulo}
    >
      {acoes ? (
        <p className="dashboard__so-impressao">
          {empresa} · {titulo} · pessoas ativas hoje
        </p>
      ) : null}
      <Cabecalho
        idTitulo={idTitulo}
        titulo={titulo}
        subtitulo="Pessoas ativas hoje por departamento."
        acoes={acoes}
      />
      {conteudo}
    </section>
  );
}

export function TempoDeCasaBloco({
  idTitulo,
  time,
  falha,
  empresa,
  vista,
  onTrocarVista,
  onAnunciar,
}: PropsDoBloco) {
  const titulo = "Tempo de casa";
  const blocoRef = useRef<HTMLElement | null>(null);
  let conteudo: ReactNode;
  let acoes: AcaoDoMenu[] | null = null;
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
      const linhas: LinhaDoTime[] = t.faixas.map((f) => ({
        chave: f.rotulo,
        nome: f.rotulo,
        pessoas: f.pessoas,
      }));
      acoes = acoesDoBloco({
        titulo,
        empresa,
        vista,
        onTrocarVista,
        onAnunciar,
        colunas: ["Faixa de tempo de casa", "Pessoas", "Percentual"],
        linhas: linhas.map((l) => [
          l.nome,
          l.pessoas,
          porcentagem(l.pessoas, t.total),
        ]),
        blocoRef,
      });
      const maior = Math.max(1, ...linhas.map((l) => l.pessoas));
      conteudo = (
        <>
          <p className="dashboard__destaque">
            <span className="dashboard__destaque-valor">
              {duracaoEmTexto(t.medianaEmMeses)}
            </span>{" "}
            na mediana
          </p>
          {vista === "tabela" ? (
            <TabelaDoTime
              legenda="Pessoas ativas hoje por tempo de casa"
              primeiraColuna="Faixa de tempo de casa"
              linhas={linhas}
              total={t.total}
            />
          ) : (
            <ul className="dashboard__faixas">
              {linhas.map((f) => (
                <li key={f.nome} className="dashboard__faixa">
                  <span className="dashboard__faixa-rotulo">{f.nome}</span>
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
          )}
          {t.semData > 0 ? (
            <p className="dashboard__nota">
              {/* Com 1 ou 2, nenhuma contagem: só o aviso. */}
              {t.semData < MINIMO_DO_GRUPO
                ? "Há pessoas sem data de admissão legível; elas não entram no cálculo."
                : `${String(t.semData)} pessoas sem data de admissão legível não entram no cálculo.`}
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
    <section
      ref={blocoRef}
      className="dashboard__bloco"
      aria-labelledby={idTitulo}
    >
      {acoes ? (
        <p className="dashboard__so-impressao">
          {empresa} · {titulo} · pessoas ativas hoje
        </p>
      ) : null}
      <Cabecalho
        idTitulo={idTitulo}
        titulo={titulo}
        subtitulo="Há quanto tempo as pessoas ativas estão no vínculo atual."
        acoes={acoes}
      />
      {conteudo}
    </section>
  );
}
