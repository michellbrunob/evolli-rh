/**
 * T215 — "Regras da escala" (sub-página do quadro), no desenho da
 * referência: Jornada e transição (EC 141/2026), Acordos e convenção,
 * Feriados locais, Avisos (cada aviso da CLT liga ou desliga) e Publicação.
 * As regras valem para o quadro de toda a empresa; feriados locais entram na
 * hora; o resto, em "Salvar regras" (a guarda de saída protege o que não foi
 * salvo). Quem só consulta vê sem poder mudar.
 */
import { useEffect, useId, useRef, useState } from "react";
import {
  type ChaveDaConvencao,
  type ChaveDoAviso,
  type FeriadoLocalApi,
  type RegrasDaEscalaApi,
  consultarQuadro,
  consultarRegras,
  criarFeriadoLocal,
  removerFeriadoLocal,
  salvarRegras,
} from "../../../api/escalaClient";
import {
  listarUnidades,
  type UnidadeOrganizacionalApi,
} from "../../../api/organizacaoClient";
import { useEdicaoEmAndamento } from "../../../app/edicoesPendentes";
import {
  PaginaComSecoes,
  type SecaoDaPagina,
} from "../../../components/PaginaComSecoes";
import { Button, Dialog } from "../../../ui";
import {
  IconeAviso,
  IconeCalendario,
  IconeDocumento,
  IconeEnviar,
  IconeMais,
  IconeRelogio,
  IconeVoltar,
} from "../../../ui/icones";
import { Esqueleto, Revelar } from "../../../ui/movimento";
import {
  diaCivilDeHoje,
  diaMesCurto,
  formatarDiaCivil,
} from "../../../format/data";
import { plural } from "../../../format/plural";
import { somarDias } from "../../pessoas/ficha/escala/calendarioDaEscala";
import { CATEGORIA, pessoasEm6x1NaTransicao } from "./avisosDaEscala";
import { diasDoPeriodo } from "./quadroDaEscala";
import "./QuadroDaEscalaScreen.css";

export const REGRAS_ESCALA_TITULO_ID = "regras-escala-titulo";

const SECOES: readonly SecaoDaPagina[] = [
  { id: "jornada", rotulo: "Jornada e transição", Icone: IconeRelogio },
  { id: "convencao", rotulo: "Acordos e convenção", Icone: IconeDocumento },
  { id: "feriados", rotulo: "Feriados locais", Icone: IconeCalendario },
  { id: "avisos", rotulo: "Avisos", Icone: IconeAviso },
  { id: "publicacao", rotulo: "Publicação", Icone: IconeEnviar },
];

const CONVENCAO: readonly [ChaveDaConvencao, string, string][] = [
  [
    "6x1_autorizada",
    "6x1 autorizada por convenção depois de {transicao}",
    "Sem isso, quem estiver em 6x1 recebe aviso a partir da transição (EC 141/2026).",
  ],
  [
    "jornada_ampliada",
    "Jornada diária ampliada na transição",
    "A convenção pode passar de 8 h por dia para fechar as 42 h, mantendo 2 descansos por semana.",
  ],
  [
    "12x36_acordo",
    "12x36 em acordo escrito ou convenção",
    "CLT, art. 59-A. Atenção: a 12x36 tem média de 42 h por semana e passa do limite de 40 h a partir de {transicao2}.",
  ],
  [
    "revezamento_8h",
    "Turnos de revezamento com até 8 h",
    "Quem alterna turnos de dia e de noite tem jornada de 6 h, salvo negociação coletiva (Constituição, art. 7º, XIV).",
  ],
  [
    "intervalo_30min",
    "Intervalo reduzido para 30 min",
    "Em jornadas acima de 6 h (CLT, art. 611-A, III).",
  ],
  [
    "comercio",
    "A empresa é do comércio",
    "Domingo de folga a cada 3 semanas em vez de 7 (Lei 10.101/2000, art. 6º) e aviso de feriado sem convenção (Lei 10.101/2000, art. 6º-A).",
  ],
  [
    "feriado_convencao",
    "Convenção autoriza trabalho em feriados",
    "Exigida no comércio (Lei 10.101/2000, art. 6º-A), salvo nas atividades da lista da Portaria MTE 1.316/2026.",
  ],
  [
    "portaria_1316",
    "A atividade está na lista da Portaria MTE 1.316/2026",
    "Padaria, farmácia, floricultura, barbearia e salão de beleza, posto de combustível, revenda de gás, hotel, restaurante e bar, feira-livre, portaria de prédio residencial, agência de turismo, lavanderia e funerária, entre outras, trabalham no feriado sem convenção. O domingo continua com a regra do comércio.",
  ],
];

const AVISOS: readonly [string, readonly [ChaveDoAviso, string, string][]][] = [
  [
    "Descanso e jornada",
    [
      [
        "interjornada",
        "Descanso entre jornadas abaixo de 11 h",
        "CLT, art. 66",
      ],
      [
        "dois_descansos",
        "Menos de 2 descansos por semana, em média no mês",
        "EC 141/2026 · a partir de {transicao}",
      ],
      [
        "seis_dias",
        "Mais de 6 dias seguidos sem folga",
        "CLT, art. 67 · Lei 605/1949 · fora da 12x36 e dos plantões",
      ],
      [
        "dez_horas",
        "Mais de 10 h no dia",
        "CLT, art. 59 · na 12x36, acima de 12 h",
      ],
      [
        "jornada_semanal",
        "Acima da jornada semanal",
        "44 h, 42 h ou 40 h conforme a data · ou a do contrato",
      ],
      [
        "revezamento",
        "Turno ininterrupto de revezamento acima de 6 h",
        "Constituição, art. 7º, XIV",
      ],
      ["intervalo", "Intervalo abaixo do mínimo", "CLT, art. 71"],
      [
        "sobrepostos",
        "Turnos sobrepostos no mesmo dia",
        "Um turno começa antes de o anterior terminar · o Evolli já não deixa gravar",
      ],
      [
        "plantao_descanso",
        "Plantão com descanso menor que o da escala",
        "CLT, art. 59-A · 12x36 pede 36 h seguidas",
      ],
      [
        "ausencia",
        "Escalado durante ausência aprovada",
        "Férias e ausências · o dia não conta como trabalhado · calculado quando o quadro mostrar as ausências",
      ],
    ],
  ],
  [
    "Domingos e feriados",
    [
      [
        "domingo",
        "Domingo sem folga (2, 3 ou 7 semanas)",
        "Mulheres: CLT, art. 386 · comércio: Lei 10.101/2000, art. 6º · demais: Portaria MTP 671/2021, art. 58, § 2º",
      ],
      [
        "feriado_comercio",
        "Feriado no comércio sem convenção",
        "Lei 10.101/2000, art. 6º-A · Portaria MTE 1.316/2026 · fora das atividades da lista",
      ],
      [
        "feriado",
        "Trabalho em feriado",
        "Lei 605/1949 · na 12x36 o feriado já está compensado (CLT, art. 59-A)",
      ],
    ],
  ],
  [
    "Contratos especiais",
    [
      ["6x1_transicao", "6x1 sem convenção depois da transição", "EC 141/2026"],
      [
        "aprendiz_estagio",
        "Aprendiz acima de 6 h ou estagiário acima de 6 h/30 h",
        "CLT, art. 432 · Lei 11.788/2008, art. 10",
      ],
      ["menor_noturno", "Menor de 18 anos em turno noturno", "CLT, art. 404"],
      [
        "tempo_parcial",
        "Tempo parcial acima de 30 h (ou 26 h + 6 extras)",
        "CLT, art. 58-A",
      ],
      [
        "intermitente",
        "Intermitente convocado com menos de 3 dias",
        "CLT, art. 452-A · o Evolli ainda não tem contrato intermitente",
      ],
    ],
  ],
  [
    "Informativos",
    [
      [
        "noturno",
        "Turno noturno (22h às 5h)",
        "CLT, art. 73 · adicional na folha",
      ],
      [
        "sobreaviso",
        "Sobreaviso",
        "Súmula 428 do TST · fora do trabalho, esperando chamado · 1/3 da hora na folha",
      ],
      [
        "12x36_2027",
        "12x36 depois de {transicao2}",
        "CLT, art. 59-A · EC 141/2026 · média de 42 h passa de 40 h",
      ],
    ],
  ],
];

const ANTECEDENCIAS = [0, 1, 2, 3, 5, 7, 10, 14, 15, 21, 30] as const;
const DIAS_DA_SEMANA = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

type Editavel = Pick<
  RegrasDaEscalaApi,
  "semanaComeca" | "convencao" | "avisos" | "antecedenciaDias" | "avisarPadrao"
> & { inicioTransicao: string };

function editavelDe(r: RegrasDaEscalaApi): Editavel {
  return {
    inicioTransicao: r.inicioTransicao,
    semanaComeca: r.semanaComeca,
    convencao: { ...r.convencao },
    avisos: { ...r.avisos },
    antecedenciaDias: r.antecedenciaDias,
    avisarPadrao: r.avisarPadrao,
  };
}

function umAnoDepois(dia: string): string {
  return `${Number(dia.slice(0, 4)) + 1}${dia.slice(4)}`;
}

function Interruptor({
  ligado,
  rotulo,
  ajuda,
  desabilitado,
  onMudar,
  categoria,
}: {
  ligado: boolean;
  rotulo: string;
  ajuda: string;
  desabilitado: boolean;
  onMudar: (v: boolean) => void;
  /** Avisos: o ponto da cor da categoria (atenção, conferir, informativo). */
  categoria?: "atencao" | "conferir" | "informativo";
}) {
  const id = useId();
  return (
    <div className="regras__interruptor">
      {categoria ? (
        <span
          className={`regras__ponto regras__ponto--${categoria}`}
          aria-hidden="true"
        />
      ) : null}
      <span className="regras__interruptor-textos">
        <span id={`${id}-r`} className="regras__interruptor-rotulo">
          {rotulo}
        </span>
        <span id={`${id}-a`} className="regras__interruptor-ajuda">
          {ajuda}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-labelledby={`${id}-r`}
        aria-describedby={`${id}-a`}
        disabled={desabilitado}
        className="regras__chave"
        onClick={() => onMudar(!ligado)}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}

export function RegrasDaEscalaScreen({
  podeOperar,
  onVoltar,
  onAbrirTransicao,
}: {
  readonly podeOperar: boolean;
  readonly onVoltar: () => void;
  readonly onAbrirTransicao?: () => void;
}) {
  const [regras, setRegras] = useState<RegrasDaEscalaApi | null>(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [form, setForm] = useState<Editavel | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [em6x1, setEm6x1] = useState<number | null>(null);
  const [unidades, setUnidades] = useState<UnidadeOrganizacionalApi[]>([]);
  const [novoFeriado, setNovoFeriado] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    tituloRef.current?.focus();
    consultarRegras().then(
      (r) => {
        setRegras(r);
        setForm(editavelDe(r));
      },
      () => setErroCarga(true),
    );
    listarUnidades({ status: "ativo", tamanhoPagina: 100 }).then(
      (r) => setUnidades(r.itens),
      () => undefined,
    );
  }, []);

  // Quantas pessoas estão em 6x1 na semana em que a transição começa.
  const transicao = form?.inicioTransicao ?? regras?.inicioTransicao ?? null;
  useEffect(() => {
    if (!transicao || !regras) return;
    let vivo = true;
    const fim = somarDias(transicao, 6);
    consultarQuadro(transicao, fim).then(
      (q) => {
        if (!vivo) return;
        setEm6x1(
          pessoasEm6x1NaTransicao(q.pessoas, diasDoPeriodo(transicao, fim), {
            ...regras,
            inicioTransicao: transicao,
            convencao: { ...regras.convencao, "6x1_autorizada": false },
          }).length,
        );
      },
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [transicao, regras]);

  const alterado =
    regras !== null &&
    form !== null &&
    JSON.stringify(form) !== JSON.stringify(editavelDe(regras));
  useEdicaoEmAndamento("Regras da escala", {
    pendente: alterado,
    salvando,
  });

  const mudar = (parcial: Partial<Editavel>) => {
    setMensagem(null);
    setErro(null);
    setForm((f) => (f ? { ...f, ...parcial } : f));
  };

  const salvar = async () => {
    if (!form || !regras) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.inicioTransicao)) {
      setErro("Informe o início da transição.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarRegras(form);
      setRegras(r);
      setForm(editavelDe(r));
      setMensagem("Regras salvas. Valem para o quadro a partir de agora.");
    } catch {
      setErro("Não foi possível salvar as regras. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  const removerFeriado = async (f: FeriadoLocalApi) => {
    setErro(null);
    try {
      const r = await removerFeriadoLocal(f.id);
      setRegras((atual) => (atual ? { ...atual, feriados: r.feriados } : r));
      setMensagem(`Feriado "${f.nome}" removido.`);
    } catch {
      setErro("Não foi possível remover o feriado. Tente de novo.");
    }
  };

  const textos = (t: string) =>
    t
      .replace(
        "{transicao}",
        form
          ? diaMesCurto(form.inicioTransicao) +
              `/${form.inicioTransicao.slice(0, 4)}`
          : "",
      )
      .replace(
        "{transicao2}",
        form ? formatarDiaCivil(umAnoDepois(form.inicioTransicao)) : "",
      );

  const hoje = diaCivilDeHoje();
  const etapa =
    form === null || hoje < form.inicioTransicao
      ? 0
      : hoje < umAnoDepois(form.inicioTransicao)
        ? 1
        : 2;

  return (
    <Revelar>
      <section
        className="regras regras--pagina"
        aria-labelledby={REGRAS_ESCALA_TITULO_ID}
      >
        <header className="quadro__cabeca">
          <button
            type="button"
            className="quadro__icone-botao"
            aria-label="Voltar para a escala de trabalho"
            onClick={onVoltar}
          >
            <IconeVoltar tamanho={18} />
          </button>
          <div className="quadro__cabeca-textos">
            <h1
              id={REGRAS_ESCALA_TITULO_ID}
              ref={tituloRef}
              tabIndex={-1}
              className="quadro__titulo"
            >
              Regras da escala
            </h1>
            <p className="quadro__subtitulo">
              Valem para o quadro de toda a empresa. Mudanças valem para o
              rascunho a partir de hoje.
            </p>
          </div>
        </header>

        {erroCarga ? (
          <p role="alert" className="quadro__falha">
            Não foi possível carregar as regras da escala.
          </p>
        ) : form === null || regras === null ? (
          <Esqueleto rotulo="Carregando as regras…" linhas={6} />
        ) : (
          <>
            <PaginaComSecoes
              secoes={SECOES}
              prefixo="regras"
              rotulo="Seções das regras"
            >
              <section
                id="regras-jornada"
                className="regras__bloco regras__bloco--secao"
                aria-labelledby="regras-jornada-titulo"
              >
                <h2
                  id="regras-jornada-titulo"
                  tabIndex={-1}
                  className="regras__titulo"
                >
                  Jornada e transição
                </h2>
                <p className="regras__texto">
                  A EC 141/2026, promulgada em 16/10/2026, acaba com a escala
                  6x1 e reduz a jornada.
                </p>
                <div className="regras__transicao">
                  <ol className="regras__linha-do-tempo">
                    {[
                      [
                        `Até ${formatarDiaCivil(somarDias(form.inicioTransicao, -1))}`,
                        "44 h por semana",
                        "1 descanso semanal (DSR)",
                      ],
                      [
                        `De ${formatarDiaCivil(form.inicioTransicao)}`,
                        "42 h por semana",
                        "2 descansos por semana, em média no mês",
                      ],
                      [
                        `De ${formatarDiaCivil(umAnoDepois(form.inicioTransicao))}`,
                        "40 h por semana",
                        "2 descansos por semana; até 8 h por dia",
                      ],
                    ].map(([quando, horas, descanso], i) => (
                      <li
                        key={quando}
                        className={
                          i === etapa
                            ? "regras__etapa regras__etapa--agora"
                            : "regras__etapa"
                        }
                      >
                        <span className="regras__etapa-quando">
                          <span
                            className="regras__etapa-ponto"
                            aria-hidden="true"
                          />
                          {quando}
                          {i === etapa ? (
                            <span className="regras__agora">Agora</span>
                          ) : null}
                        </span>
                        <strong>{horas}</strong>
                        <span>{descanso}</span>
                      </li>
                    ))}
                  </ol>
                  {em6x1 !== null &&
                  em6x1 > 0 &&
                  !form.convencao["6x1_autorizada"] ? (
                    <div className="regras__nota-6x1">
                      <span
                        className="regras__ponto regras__ponto--conferir"
                        aria-hidden="true"
                      />
                      <p>
                        {`${em6x1 === 1 ? "1 pessoa está" : `${em6x1} pessoas estão`} em 6x1. A partir de ${formatarDiaCivil(form.inicioTransicao)} ${em6x1 === 1 ? "ela precisa" : "elas precisam"} de 2 descansos por semana, a não ser que a convenção coletiva autorize a 6x1.`}
                      </p>
                      {onAbrirTransicao ? (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={onAbrirTransicao}
                        >
                          Planejar a transição
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="regras__linha">
                  <div className="regras__linha-rotulo">
                    <label htmlFor="regras-inicio-transicao">
                      Início da transição
                    </label>
                    <small id="regras-inicio-transicao-ajuda">
                      Dois meses depois da publicação no Diário Oficial
                      (16/10/2026). Confira com a contabilidade.
                    </small>
                  </div>
                  <input
                    id="regras-inicio-transicao"
                    className="regras__controle"
                    type="date"
                    value={form.inicioTransicao}
                    disabled={!podeOperar}
                    aria-describedby="regras-inicio-transicao-ajuda"
                    onChange={(e) => mudar({ inicioTransicao: e.target.value })}
                  />
                </div>
                <div className="regras__linha">
                  <div className="regras__linha-rotulo">
                    <span id="regras-jornada-padrao">Jornada padrão</span>
                    <small>
                      Para quem não tem jornada no cadastro. Segue as datas
                      acima.
                    </small>
                  </div>
                  <span
                    className="regras__controle regras__controle--leitura"
                    aria-labelledby="regras-jornada-padrao"
                  >
                    44 h, depois 42 h e 40 h
                  </span>
                </div>
                <div className="regras__linha">
                  <div className="regras__linha-rotulo">
                    <label htmlFor="regras-semana">A semana começa em</label>
                  </div>
                  <select
                    id="regras-semana"
                    className="regras__controle"
                    value={form.semanaComeca}
                    disabled={!podeOperar}
                    onChange={(e) =>
                      mudar({ semanaComeca: Number(e.target.value) })
                    }
                  >
                    {DIAS_DA_SEMANA.map((d, i) => (
                      <option key={d} value={i + 1}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section
                id="regras-convencao"
                className="regras__bloco regras__bloco--secao"
                aria-labelledby="regras-convencao-titulo"
              >
                <h2
                  id="regras-convencao-titulo"
                  tabIndex={-1}
                  className="regras__titulo"
                >
                  Acordos e convenção
                </h2>
                <p className="regras__texto">
                  Marque o que a convenção ou o acordo coletivo da sua categoria
                  permite. Os avisos mudam conforme o que estiver marcado.
                </p>
                {CONVENCAO.map(([chave, rotulo, ajuda]) => (
                  <Interruptor
                    key={chave}
                    ligado={form.convencao[chave]}
                    rotulo={textos(rotulo)}
                    ajuda={textos(ajuda)}
                    desabilitado={!podeOperar}
                    onMudar={(v) =>
                      mudar({ convencao: { ...form.convencao, [chave]: v } })
                    }
                  />
                ))}
              </section>

              <section
                id="regras-feriados"
                className="regras__bloco regras__bloco--secao"
                aria-labelledby="regras-feriados-titulo"
              >
                <div className="regras__titulo-linha">
                  <div>
                    <h2
                      id="regras-feriados-titulo"
                      tabIndex={-1}
                      className="regras__titulo"
                    >
                      Feriados locais
                    </h2>
                    <p className="regras__texto">
                      Nacionais já vêm do calendário. Cadastre aqui os
                      municipais e os pontos facultativos de cada unidade.
                    </p>
                  </div>
                  {podeOperar ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setNovoFeriado(true)}
                    >
                      <IconeMais tamanho={16} />
                      Adicionar feriado
                    </Button>
                  ) : null}
                </div>
                <div className="regras__cartao-tabela">
                  <table className="regras__tabela">
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Feriado</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Unidades</th>
                        {podeOperar ? (
                          <th scope="col">
                            <span className="sr-only">Ações</span>
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {regras.feriados.length === 0 ? (
                        <tr>
                          <td
                            colSpan={podeOperar ? 5 : 4}
                            className="regras__tabela-vazia"
                          >
                            Nenhum feriado local cadastrado. Use “Adicionar
                            feriado” para o aniversário da cidade e os pontos
                            facultativos.
                          </td>
                        </tr>
                      ) : (
                        regras.feriados.map((f) => (
                          <tr key={f.id}>
                            <td>{formatarDiaCivil(f.data)}</td>
                            <td>{f.nome}</td>
                            <td>
                              {f.tipo === "municipal"
                                ? "Municipal"
                                : "Ponto facultativo"}
                            </td>
                            <td>
                              {f.unidadeIds.length === 0
                                ? "Todas as unidades"
                                : f.unidadeIds
                                    .map(
                                      (id) =>
                                        unidades.find((u) => u.id === id)
                                          ?.nome ?? "Unidade",
                                    )
                                    .join(", ")}
                            </td>
                            {podeOperar ? (
                              <td>
                                <Button
                                  type="button"
                                  variant="subtle"
                                  aria-label={`Remover ${f.nome}`}
                                  onClick={() => void removerFeriado(f)}
                                >
                                  Remover
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="regras__nota">
                  Feriado aparece em âmbar no quadro. Trabalhar nele gera aviso
                  e vai para a folha como “feriado trabalhado”.
                </p>
              </section>

              <section
                id="regras-avisos"
                className="regras__bloco regras__bloco--secao"
                aria-labelledby="regras-avisos-titulo"
              >
                <h2
                  id="regras-avisos-titulo"
                  tabIndex={-1}
                  className="regras__titulo"
                >
                  Avisos
                </h2>
                <p className="regras__texto">
                  Aviso não bloqueia: aparece na célula, no painel e ao
                  publicar. PJ e autônomos só recebem os informativos.
                </p>
                {AVISOS.map(([grupo, itens]) => (
                  <div key={grupo} className="regras__grupo">
                    <h3 className="regras__subtitulo">{grupo}</h3>
                    {itens.map(([chave, rotulo, ajuda]) => (
                      <Interruptor
                        key={chave}
                        ligado={form.avisos[chave]}
                        rotulo={textos(rotulo)}
                        ajuda={textos(ajuda)}
                        desabilitado={!podeOperar}
                        categoria={CATEGORIA[chave]}
                        onMudar={(v) =>
                          mudar({ avisos: { ...form.avisos, [chave]: v } })
                        }
                      />
                    ))}
                  </div>
                ))}
              </section>

              <section
                id="regras-publicacao"
                className="regras__bloco regras__bloco--secao"
                aria-labelledby="regras-publicacao-titulo"
              >
                <h2
                  id="regras-publicacao-titulo"
                  tabIndex={-1}
                  className="regras__titulo"
                >
                  Publicação
                </h2>
                <div className="regras__linha">
                  <div className="regras__linha-rotulo">
                    <label htmlFor="regras-antecedencia">
                      Antecedência mínima
                    </label>
                    <small id="regras-antecedencia-ajuda">
                      Publicar com menos tempo mostra um aviso.
                    </small>
                  </div>
                  <select
                    id="regras-antecedencia"
                    className="regras__controle"
                    value={form.antecedenciaDias}
                    disabled={!podeOperar}
                    aria-describedby="regras-antecedencia-ajuda"
                    onChange={(e) =>
                      mudar({ antecedenciaDias: Number(e.target.value) })
                    }
                  >
                    {ANTECEDENCIAS.map((n) => (
                      <option key={n} value={n}>
                        {n === 0
                          ? "Sem antecedência mínima"
                          : `${plural(n, "dia", "dias")} antes do início`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="regras__linha">
                  <div className="regras__linha-rotulo">
                    <span>Avisar as pessoas</span>
                  </div>
                  <Interruptor
                    ligado={form.avisarPadrao}
                    rotulo="Marcado por padrão no diálogo de publicar"
                    ajuda="Portal e e-mail, só para quem teve a escala mudada."
                    desabilitado={!podeOperar}
                    onMudar={(v) => mudar({ avisarPadrao: v })}
                  />
                </div>
              </section>
            </PaginaComSecoes>

            {podeOperar ? (
              <footer className="regras__rodape pagina-secoes__rodape">
                <p className="regras__estado" role="status">
                  {erro ??
                    mensagem ??
                    (alterado
                      ? "Alterações não salvas."
                      : regras.personalizadas
                        ? "Regras salvas."
                        : "Ainda sem alterações: valem as regras padrão.")}
                </p>
                <Button
                  type="button"
                  variant="subtle"
                  disabled={!alterado || salvando}
                  onClick={() => {
                    setForm(editavelDe(regras));
                    setMensagem(null);
                  }}
                >
                  Descartar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!alterado || salvando}
                  onClick={() => void salvar()}
                >
                  Salvar regras
                </Button>
              </footer>
            ) : null}
          </>
        )}

        {novoFeriado ? (
          <DialogoFeriado
            unidades={unidades}
            onFechar={() => setNovoFeriado(false)}
            onCriar={async (dto) => {
              const r = await criarFeriadoLocal(dto);
              setRegras((atual) =>
                atual ? { ...atual, feriados: r.feriados } : r,
              );
              setNovoFeriado(false);
              setMensagem(`Feriado "${dto.nome}" adicionado.`);
            }}
          />
        ) : null}
      </section>
    </Revelar>
  );
}

function DialogoFeriado({
  unidades,
  onCriar,
  onFechar,
}: {
  readonly unidades: readonly UnidadeOrganizacionalApi[];
  readonly onCriar: (dto: {
    data: string;
    nome: string;
    tipo: FeriadoLocalApi["tipo"];
    unidadeIds: string[];
  }) => Promise<void>;
  readonly onFechar: () => void;
}) {
  const id = useId();
  const [data, setData] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<FeriadoLocalApi["tipo"]>("municipal");
  const [todas, setTodas] = useState(true);
  const [escolhidas, setEscolhidas] = useState<ReadonlySet<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const criar = async () => {
    if (!data || !nome.trim()) {
      setErro("Informe a data e o nome do feriado.");
      return;
    }
    if (!todas && escolhidas.size === 0) {
      setErro("Escolha ao menos uma unidade.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await onCriar({
        data,
        nome: nome.trim(),
        tipo,
        unidadeIds: todas ? [] : [...escolhidas],
      });
    } catch {
      setErro("Não foi possível adicionar o feriado. Tente de novo.");
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto
      titulo="Adicionar feriado"
      descricao="Aparece no quadro como os outros feriados e entra nos avisos e na folha (feriado trabalhado)."
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={data !== "" || nome !== ""}
      className="dialogo-massa"
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => void criar()}
            disabled={enviando}
          >
            Adicionar feriado
          </Button>
        </>
      }
    >
      <div className="dialogo-massa__corpo">
        <label className="painel-dia__campo">
          <span>Data</span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        <label className="painel-dia__campo painel-dia__campo--largo">
          <span>Nome</span>
          <input
            type="text"
            maxLength={80}
            placeholder="Ex.: Aniversário da cidade"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <fieldset className="dialogo-massa__grupo">
          <legend>Tipo</legend>
          <div className="quadro__visao" role="group" aria-label="Tipo">
            {(
              [
                ["municipal", "Municipal"],
                ["ponto_facultativo", "Ponto facultativo"],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                className="quadro__visao-botao"
                aria-pressed={tipo === v}
                onClick={() => setTipo(v)}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="dialogo-massa__grupo">
          <legend>Unidades</legend>
          <label className="dialogo-massa__opcao">
            <input
              type="radio"
              name={`${id}-u`}
              checked={todas}
              onChange={() => setTodas(true)}
            />
            <span>
              <strong>Todas as unidades</strong>
            </span>
          </label>
          <label className="dialogo-massa__opcao">
            <input
              type="radio"
              name={`${id}-u`}
              checked={!todas}
              onChange={() => setTodas(false)}
            />
            <span>
              <strong>Só algumas</strong>
            </span>
          </label>
          {!todas ? (
            <ul className="gaveta-quadro__opcoes">
              {unidades.map((u) => (
                <li key={u.id}>
                  <input
                    id={`${id}-${u.id}`}
                    type="checkbox"
                    checked={escolhidas.has(u.id)}
                    onChange={() =>
                      setEscolhidas((atual) => {
                        const n = new Set(atual);
                        if (n.has(u.id)) n.delete(u.id);
                        else n.add(u.id);
                        return n;
                      })
                    }
                  />
                  <label htmlFor={`${id}-${u.id}`}>{u.nome}</label>
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>
        {erro ? (
          <p role="alert" className="painel-dia__erro">
            {erro}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
