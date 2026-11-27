/**
 * T215 — o detalhe de um benefício (como a referência): a competência (mês)
 * com o que a empresa paga, o desconto em folha e quantas pessoas; a aba
 * Pessoas (valores do mês editáveis por pessoa, "Alterar valor por dia",
 * "Adicionar pessoas", dependentes no plano, remover) e a aba Histórico.
 * Sem Folha no Evolli, toda competência é "valores previstos".
 */
import { Esqueleto } from "../../ui/movimento";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type {
  AlterarEmLoteDto,
  BeneficioApi,
  DependenteDoPlanoApi,
  DetalheDoBeneficioApi,
  HistoricoApi,
  LinhaDeValoresDto,
  PessoaDoBeneficioApi,
} from "../../api/beneficiosClient";
import { Button, FormActions, StatusBadge } from "../../components";
import {
  formatarCompetenciaAbreviada,
  formatarCompetenciaPorExtenso,
  formatarDiaCivil,
  formatarInstante,
  formatarMesReferencia,
} from "../../format/data";
import type {
  OrigemDosDias,
  SimulacaoDeDependentesApi,
  TotaisApi,
} from "../../api/beneficiosClient";
import { formatarCentavos, formatarPercentual } from "../../format/moeda";
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  ListaDeEscolha,
  Sheet,
} from "../../ui";
import {
  IconeAdicionarPessoa,
  IconeAvancar,
  IconeCalendario,
  IconeEditar,
  IconeEnviarArquivo,
  IconeMaisAcoes,
  IconeModelo,
  IconeTempo,
  IconeVoltar,
} from "../../ui/icones";
import { baixarArquivo } from "../dashboard/exportacao";
import { SeletorDePeriodo } from "../horarios/quadro/SeletorDePeriodo";
import { TIPO_MIME_XLSX, montarXlsx } from "../pessoas/importacao/planilhaXlsx";
import {
  GavetaDeImportacao,
  type PlanilhaEnviada,
} from "./ImportarValoresDoBeneficio";
import {
  baseDoArquivo,
  colunasDaImportacao,
  formatarCpf,
} from "./planilhaDeValores";
import {
  competenciaDoMesAtual,
  competenciaVizinha,
} from "../../app/rotasDoShell";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../pessoas/edicao/dadosProfissionais";
import {
  CampoNumero,
  CampoReais,
  CartoesDeOpcao,
  PessoaNaLinha,
  Segmentado,
} from "./comuns";
import type { ServicoDeBeneficios } from "./servicoDeBeneficios";
import {
  CATEGORIAS,
  ICONE_DA_CATEGORIA,
  ROTULO_DA_ORIGEM,
  TEXTO_DA_OBSERVACAO,
  TEXTO_DA_PENDENCIA,
  faixaNaCompetencia,
  maiuscula,
  nomeDaEscala,
  pessoas as nPessoas,
  rotuloDoParentesco,
} from "./textosDosBeneficios";

export const DETALHE_TITULO_ID = "beneficio-detalhe-titulo";

type Edicao = Omit<LinhaDeValoresDto, "colaboradorId">;

export function DetalheDoBeneficio({
  servico,
  beneficioId,
  podeEditar,
  competenciaInicial,
  avisoInicial,
  onVoltar,
  onEditar,
  onAdicionar,
  onAbrirOutro,
  onAbrirFicha,
  onCompetencia,
  onImportar,
  abrirImportacao = false,
}: {
  readonly servico: ServicoDeBeneficios;
  readonly beneficioId: string;
  readonly podeEditar: boolean;
  readonly competenciaInicial: string;
  readonly avisoInicial: string | null;
  readonly onVoltar: (mensagem?: string) => void;
  readonly onEditar: (base: BeneficioApi) => void;
  readonly onAdicionar: (nome: string) => void;
  readonly onAbrirOutro: (id: string, mensagem: string) => void;
  readonly onAbrirFicha: (colaboradorId: string) => void;
  readonly onCompetencia: (c: string) => void;
  /** Planilha enviada: o módulo abre a página Revisar. */
  readonly onImportar?: (planilha: PlanilhaEnviada) => void;
  /** Volta de "Trocar arquivo": a gaveta já aberta. */
  readonly abrirImportacao?: boolean;
}) {
  const [competencia, setCompetencia] = useState(competenciaInicial);
  const [dados, setDados] = useState<DetalheDoBeneficioApi | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aba, setAba] = useState<"pessoas" | "historico">("pessoas");
  const [historico, setHistorico] = useState<HistoricoApi | null>(null);
  const [aviso, setAviso] = useState<string | null>(avisoInicial);
  const [edicoes, setEdicoes] = useState<Record<string, Edicao>>({});
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<
    "todos" | "ajustado" | "observacao" | "dependente" | "pendencia"
  >("todos");
  const [janela, setJanela] = useState<
    "pausar" | "encerrar" | "excluir" | "lote" | null
  >(null);
  const [aRemover, setARemover] = useState<PessoaDoBeneficioApi | null>(null);
  const [dependentesDe, setDependentesDe] =
    useState<PessoaDoBeneficioApi | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [importando, setImportando] = useState(abrirImportacao);
  const [origem, setOrigem] = useState<OrigemDosDias | "">("");
  const [porPagina, setPorPagina] = useState(25);
  const [pagina, setPagina] = useState(1);
  const [previa, setPrevia] = useState<{
    antes: TotaisApi;
    depois: TotaisApi;
  } | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await servico.obterBeneficio(beneficioId, competencia));
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [servico, beneficioId, competencia]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (aba !== "historico") return;
    servico
      .historicoDoBeneficio(beneficioId)
      .then(setHistorico)
      .catch(() => setHistorico({ itens: [] }));
  }, [aba, servico, beneficioId, dados]);

  const mudarCompetencia = (c: string) => {
    setEdicoes({});
    setCompetencia(c);
    onCompetencia(c);
  };

  const b = dados?.beneficio;
  const r = b?.regras;
  const tipo = b?.tipoValor;
  const pessoasVisiveis = useMemo(
    () =>
      (dados?.pessoas ?? []).filter((p) => {
        const termo = busca.trim().toLowerCase();
        const digitos = termo.replace(/\D/g, "");
        if (
          termo &&
          !p.nome.toLowerCase().includes(termo) &&
          !(digitos.length >= 3 && (p.cpf ?? "").includes(digitos))
        )
          return false;
        if (origem && p.origemDias !== origem) return false;
        if (filtro === "ajustado") return p.ajustado;
        if (filtro === "observacao") return !!p.observacao || !!p.pendencia;
        if (filtro === "dependente") return p.dependentesNoPlano > 0;
        if (filtro === "pendencia") return !!p.pendencia;
        return true;
      }),
    [dados, busca, filtro, origem],
  );

  // Totais antes e depois do que foi digitado (a barra de alterações).
  useEffect(() => {
    const linhas = Object.entries(edicoes)
      .map(([colaboradorId, e]) => ({ colaboradorId, ...e }))
      .filter(
        (l) =>
          l.dias !== undefined ||
          l.valorDia !== undefined ||
          l.valorMes !== undefined ||
          l.coparticipacao !== undefined ||
          l.antecipado !== undefined,
      );
    if (linhas.length === 0) {
      setPrevia(null);
      return;
    }
    let vivo = true;
    const t = window.setTimeout(() => {
      servico
        .simularValoresDoBeneficio(beneficioId, competencia, linhas)
        .then((r) => {
          if (vivo) setPrevia(r);
        })
        .catch(() => {
          if (vivo) setPrevia(null);
        });
    }, 250);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [edicoes, servico, beneficioId, competencia]);

  if (falhou) {
    return (
      <div className="beneficios">
        <div className="beneficios__erro" role="alert">
          <p>Não foi possível carregar o benefício.</p>
          <Button variant="secondary" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
          <Button variant="secondary" onClick={() => onVoltar()}>
            Voltar para Benefícios
          </Button>
        </div>
      </div>
    );
  }
  if (!dados || !b || !r) {
    return <Esqueleto rotulo="Carregando o benefício…" linhas={6} />;
  }

  const info = CATEGORIAS[b.categoria];
  const Icone = ICONE_DA_CATEGORIA[b.categoria];
  const t = dados.totais;
  const nEdicoes = Object.keys(edicoes).length;
  const colunasImportaveis = colunasDaImportacao(tipo!, r);
  const total = pessoasVisiveis.length;
  const ultimaPagina = Math.max(1, Math.ceil(total / porPagina));
  const paginaAtual = Math.min(pagina, ultimaPagina);
  const daPagina = pessoasVisiveis.slice(
    (paginaAtual - 1) * porPagina,
    paginaAtual * porPagina,
  );
  const pctDesconto = t.valor ? (t.desconto / t.valor) * 100 : 0;

  const editar = (id: string, parcial: Edicao) =>
    setEdicoes((e) => ({ ...e, [id]: { ...e[id], ...parcial } }));

  async function salvarValores() {
    setSalvando(true);
    try {
      await servico.salvarValoresDoBeneficio(
        beneficioId,
        competencia,
        Object.entries(edicoes).map(([colaboradorId, e]) => ({
          colaboradorId,
          ...e,
        })),
      );
      const n = nEdicoes;
      setEdicoes({});
      setAviso(
        `Valores de ${formatarMesReferencia(competencia)} salvos para ${nPessoas(n)}.`,
      );
      await carregar();
    } catch {
      setAviso("Não foi possível salvar os valores. Confira e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const situacaoBadge =
    b.situacao === "ativo" ? (
      <StatusBadge variant="success">Ativo</StatusBadge>
    ) : b.situacao === "pausado" ? (
      <StatusBadge variant="warning">Pausado</StatusBadge>
    ) : (
      <StatusBadge variant="neutral">Encerrado</StatusBadge>
    );

  const subtitulo =
    info.terminoObrigatorio && b.fim
      ? `${info.curta} · contrato ${formatarDiaCivil(b.inicio)} → ${formatarDiaCivil(b.fim)}`
      : `${info.curta} · desde ${formatarDiaCivil(b.inicio)}${b.fim ? ` até ${formatarDiaCivil(b.fim)}` : ""}`;

  const pilulas: { valor: typeof filtro; rotulo: string; n: number }[] =
    tipo === "faixa_etaria"
      ? [
          { valor: "todos", rotulo: "Todos", n: dados.pessoas.length },
          {
            valor: "dependente",
            rotulo: "Com dependente",
            n: dados.pessoas.filter((p) => p.dependentesNoPlano > 0).length,
          },
          { valor: "pendencia", rotulo: "Com pendência", n: t.comPendencia },
        ]
      : [
          { valor: "todos", rotulo: "Todos", n: dados.pessoas.length },
          {
            valor: "ajustado",
            rotulo: "Valor ajustado",
            n: dados.pessoas.filter((p) => p.ajustado).length,
          },
          {
            valor: "observacao",
            rotulo: "Com observação",
            n: dados.pessoas.filter((p) => p.observacao || p.pendencia).length,
          },
        ];

  function exportar() {
    const linhas = [
      [
        "Colaborador",
        "CPF",
        "Contrato",
        "Escala",
        "Dias",
        "Valor do mês",
        "Empresa paga",
        b!.folha === "adicional" ? "Adicional" : "Desconto",
        "Observação",
      ],
      ...dados!.pessoas.map((p) => [
        p.nome,
        formatarCpf(p.cpf),
        (ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[p.contrato] ??
          p.contrato,
        nomeDaEscala(p.escala),
        p.dias ?? "",
        p.valor / 100,
        p.empresa / 100,
        (b!.folha === "adicional" ? p.adicional : p.desconto) / 100,
        p.pendencia
          ? TEXTO_DA_PENDENCIA[p.pendencia]
          : p.observacao
            ? TEXTO_DA_OBSERVACAO[p.observacao]
            : "",
      ]),
      [
        "Total",
        "",
        "",
        "",
        "",
        t.valor / 100,
        t.empresa / 100,
        (b!.folha === "adicional" ? t.adicional : t.desconto) / 100,
        "",
      ],
    ];
    baixarArquivo(
      montarXlsx([
        {
          nome: formatarMesReferencia(competencia).replace("/", "-"),
          cabecalho: true,
          larguras: [32, 16, 14, 16, 8, 14, 14, 14, 30],
          linhas,
        },
      ]),
      `${baseDoArquivo(b!.nome, competencia)}.xlsx`,
      TIPO_MIME_XLSX,
    );
  }

  return (
    <div className="beneficios">
      <header className="beneficios__cabecalho">
        <IconButton
          label="Voltar para Benefícios"
          icon={<IconeVoltar tamanho={18} />}
          onClick={() => onVoltar()}
        />
        <span
          className="beneficios__icone-cat beneficios__icone-cat--grande"
          aria-hidden="true"
        >
          <Icone tamanho={22} />
        </span>
        <div className="beneficios__titulos">
          <h1 id={DETALHE_TITULO_ID} className="beneficios__titulo">
            {b.nome} {situacaoBadge}
          </h1>
          <p className="beneficios__subtitulo">{subtitulo}</p>
        </div>
        {podeEditar ? (
          <div className="beneficios__acoes-topo">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="beneficios__menu-botao beneficios__menu-botao--borda"
                aria-label="Mais ações do benefício"
              >
                <IconeMaisAcoes tamanho={18} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onSelect={exportar}
                >{`Exportar Excel de ${formatarMesReferencia(competencia)}`}</DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    try {
                      const copia = await servico.duplicarBeneficio(b.id);
                      onAbrirOutro(
                        copia.id,
                        "Benefício duplicado. Agora é só escolher quem recebe.",
                      );
                    } catch {
                      setAviso("Não foi possível duplicar. Tente de novo.");
                    }
                  }}
                >
                  Duplicar
                </DropdownMenuItem>
                <RadixMenu.Separator className="beneficios__menu-divisor" />
                {b.situacao === "ativo" ? (
                  <>
                    <DropdownMenuItem onSelect={() => setJanela("pausar")}>
                      Pausar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setJanela("encerrar")}>
                      Encerrar
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onSelect={async () => {
                      await servico.reativarBeneficio(b.id);
                      setAviso(`${b.nome} reativado.`);
                      await carregar();
                    }}
                  >
                    Reativar
                  </DropdownMenuItem>
                )}
                <RadixMenu.Separator className="beneficios__menu-divisor" />
                <DropdownMenuItem
                  className="beneficios__menu-perigo"
                  onSelect={() => setJanela("excluir")}
                >
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {colunasImportaveis.length > 0 && onImportar ? (
              <Button variant="secondary" onClick={() => setImportando(true)}>
                <IconeEnviarArquivo tamanho={16} />
                Importar valores
              </Button>
            ) : null}
            <Button onClick={() => onEditar(b)}>
              <IconeEditar tamanho={16} />
              Editar configuração
            </Button>
          </div>
        ) : null}
      </header>

      {aviso ? (
        <p className="beneficios__aviso" role="status">
          {aviso}
        </p>
      ) : null}

      <div className="beneficios__faixa-numeros">
        <div className="beneficios__competencia">
          <span className="beneficios__suave">Competência</span>
          <div className="beneficios__competencia-controles">
            <IconButton
              label="Mês anterior"
              icon={<IconeVoltar tamanho={16} />}
              variant="subtle"
              onClick={() =>
                mudarCompetencia(competenciaVizinha(competencia, -1))
              }
            />
            <SeletorDePeriodo
              tamanho="mes"
              ancora={`${competencia}-01`}
              semanaComeca={0}
              onEscolher={(dia) => mudarCompetencia(dia.slice(0, 7))}
            />
            <IconButton
              label="Mês seguinte"
              icon={<IconeAvancar tamanho={16} />}
              variant="subtle"
              onClick={() =>
                mudarCompetencia(competenciaVizinha(competencia, 1))
              }
            />
          </div>
          <span className="beneficios__chip-info">
            <IconeCalendario tamanho={12} /> Valores previstos · sem folha no
            Evolli
          </span>
        </div>
        <dl className="beneficios__numeros beneficios__numeros--tres">
          <div>
            <dt>Empresa paga</dt>
            <dd>
              <strong>{formatarCentavos(t.empresa)}</strong>
              <span>por mês</span>
            </dd>
          </div>
          <div>
            <dt>
              {b.folha === "adicional"
                ? "Adicional em folha"
                : "Desconto em folha"}
            </dt>
            <dd>
              <strong>
                {formatarCentavos(
                  b.folha === "adicional" ? t.adicional : t.desconto,
                )}
              </strong>
              <span>
                {tipo === "faixa_etaria"
                  ? `por mês · titular ${formatarPercentual(r.colaboradorPaga.titular)}${r.colaboradorPaga.calculo === "percentual" ? "%" : ""} · dep. ${formatarPercentual(r.colaboradorPaga.dependente)}${r.colaboradorPaga.calculo === "percentual" ? "%" : ""}`
                  : t.desconto
                    ? `por mês · ${formatarPercentual(Math.round(pctDesconto))}% do valor`
                    : "por mês"}
              </span>
            </dd>
          </div>
          <div>
            <dt>Pessoas</dt>
            <dd>
              <strong>
                {t.dependentes
                  ? `${t.pessoas} + ${t.dependentes} dep.`
                  : t.pessoas}
              </strong>
              <span
                className={t.comPendencia ? "beneficios__alerta" : undefined}
              >
                {t.pessoas === 0
                  ? "ninguém vinculado"
                  : t.comPendencia
                    ? `${t.comPendencia} com pendência`
                    : ""}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div
        role="tablist"
        aria-label="Seções do benefício"
        className="beneficios__abas"
      >
        <button
          type="button"
          role="tab"
          aria-selected={aba === "pessoas"}
          onClick={() => setAba("pessoas")}
        >
          Pessoas <span className="beneficios__contagem">{t.pessoas}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === "historico"}
          onClick={() => setAba("historico")}
        >
          Histórico de alterações{" "}
          <span className="beneficios__contagem">{dados.historico}</span>
        </button>
      </div>

      {aba === "historico" ? (
        <ul
          className="beneficios__historico"
          aria-label="Histórico de alterações"
        >
          {(historico?.itens ?? []).map((h) => (
            <li key={h.id}>
              <span className="beneficios__icone-cat" aria-hidden="true">
                <IconeEditar tamanho={14} />
              </span>
              <span className="beneficios__pessoa-textos">
                <span>
                  <strong>{TITULO_DO_HISTORICO[h.tipo] ?? "Alteração"}</strong>{" "}
                  <span className="beneficios__selo">{`a partir de ${formatarMesReferencia(h.aPartirDe)}`}</span>
                </span>
                <span className="beneficios__suave">{h.descricao}</span>
              </span>
              <span className="beneficios__suave">
                {formatarInstante(h.criadoEm)}
              </span>
            </li>
          ))}
        </ul>
      ) : t.pessoas === 0 && dados.pessoas.length === 0 ? (
        <div className="beneficios__vazio-cartao">
          <span className="beneficios__vazio-icone" aria-hidden="true">
            <IconeAdicionarPessoa tamanho={24} />
          </span>
          <h2>Ninguém recebe este benefício ainda</h2>
          <p>{`Adicione as pessoas que vão receber o ${b.nome}. Os valores já vêm calculados para cada pessoa.`}</p>
          {podeEditar && b.situacao === "ativo" ? (
            <div className="beneficios__acoes-topo">
              <Button onClick={() => onAdicionar(b.nome)}>
                <IconeAdicionarPessoa tamanho={16} />
                Adicionar pessoas
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="beneficios__filtros">
            <input
              type="search"
              className="beneficios__busca"
              aria-label="Buscar colaborador"
              placeholder="Nome ou CPF"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
            <div
              role="tablist"
              aria-label="Mostrar"
              className="beneficios__pilulas"
            >
              {pilulas.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  role="tab"
                  aria-selected={filtro === p.valor}
                  onClick={() => {
                    setFiltro(p.valor);
                    setPagina(1);
                  }}
                >
                  {p.rotulo} <span className="beneficios__contagem">{p.n}</span>
                </button>
              ))}
            </div>
            {tipo === "dia_util" ? (
              <ListaDeEscolha
                aria-label="Origem dos dias"
                className="beneficios__filtro-origem"
                valor={origem}
                onMudar={(v) => {
                  setOrigem(v as OrigemDosDias | "");
                  setPagina(1);
                }}
                opcoes={[
                  { valor: "", rotulo: "Origem dos dias: todas" },
                  ...(["escala", "catalogo", "uteis", "digitado"] as const).map(
                    (o) => ({ valor: o, rotulo: ROTULO_DA_ORIGEM[o] }),
                  ),
                ]}
              />
            ) : null}
          </div>
          {podeEditar ? (
            <div className="beneficios__acoes-tabela">
              {tipo === "dia_util" ? (
                <Button variant="secondary" onClick={() => setJanela("lote")}>
                  <IconeCalendario tamanho={16} />
                  Alterar valor por dia
                </Button>
              ) : null}
              {b.situacao === "ativo" ? (
                <Button variant="secondary" onClick={() => onAdicionar(b.nome)}>
                  <IconeAdicionarPessoa tamanho={16} />
                  Adicionar pessoas
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="beneficios__tabela-caixa">
            <table
              className="beneficios__tabela beneficios__tabela--pessoas"
              aria-label="Pessoas do benefício"
            >
              <thead>
                <tr>
                  {tipo === "dia_util" && podeEditar ? (
                    <th scope="col">
                      <span className="beneficios__so-leitor">Selecionar</span>
                    </th>
                  ) : null}
                  <th scope="col">Colaborador</th>
                  {tipo === "dia_util" ? (
                    <>
                      <th scope="col">Escala</th>
                      <th scope="col">Dias</th>
                      <th scope="col">Valor por dia</th>
                    </>
                  ) : null}
                  {tipo === "faixa_etaria" ? (
                    <>
                      <th scope="col">Faixa</th>
                      <th scope="col">No plano</th>
                      {r.coparticipacao ? (
                        <th scope="col">Coparticipação</th>
                      ) : null}
                    </>
                  ) : null}
                  {tipo === "individual" ? (
                    <th scope="col">
                      {r.individualModo === "plano" ? "Plano" : "Valor"}
                    </th>
                  ) : null}
                  {tipo === "antecipacao" &&
                  r.antecipacao?.modo === "variavel" ? (
                    <th scope="col">Antecipado</th>
                  ) : null}
                  <th scope="col" className="beneficios__numero">
                    {tipo === "faixa_etaria" ? "Mensalidade" : "Valor do mês"}
                  </th>
                  <th scope="col" className="beneficios__numero">
                    Empresa paga
                  </th>
                  <th scope="col" className="beneficios__numero">
                    {b.folha === "adicional" ? "Adicional" : "Desconto"}
                  </th>
                  <th scope="col">
                    <span className="beneficios__so-leitor">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {daPagina.map((p) => {
                  const ed = edicoes[p.colaboradorId] ?? {};
                  const alterada = !!edicoes[p.colaboradorId];
                  return (
                    <tr
                      key={p.colaboradorId}
                      data-alterada={alterada || undefined}
                    >
                      {tipo === "dia_util" && podeEditar ? (
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${p.nome}`}
                            checked={selecionados.includes(p.colaboradorId)}
                            onChange={(e) =>
                              setSelecionados((s) =>
                                e.target.checked
                                  ? [...s, p.colaboradorId]
                                  : s.filter((x) => x !== p.colaboradorId),
                              )
                            }
                          />
                        </td>
                      ) : null}
                      <td>
                        <PessoaNaLinha
                          nome={p.nome}
                          detalhe={
                            [
                              p.cargo ??
                                (
                                  ROTULO_DO_TIPO_DE_VINCULO as Record<
                                    string,
                                    string
                                  >
                                )[p.contrato],
                              p.departamento,
                            ]
                              .filter(Boolean)
                              .join(" · ") || null
                          }
                          alerta={
                            p.pendencia
                              ? TEXTO_DA_PENDENCIA[p.pendencia]
                              : p.observacao
                                ? TEXTO_DA_OBSERVACAO[p.observacao]
                                : null
                          }
                        />
                      </td>
                      {tipo === "dia_util" ? (
                        <>
                          <td>{nomeDaEscala(p.escala)}</td>
                          <td>
                            <span className="beneficios__celula-dias">
                              {podeEditar ? (
                                <CampoNumero
                                  rotulo={`Dias de ${p.nome}`}
                                  max={31}
                                  valor={
                                    ed.dias !== undefined
                                      ? (ed.dias ?? null)
                                      : p.dias
                                  }
                                  onMudar={(dias) =>
                                    editar(p.colaboradorId, { dias })
                                  }
                                />
                              ) : (
                                p.dias
                              )}
                              {p.origemDias ? (
                                <IconeDaOrigem origem={p.origemDias} />
                              ) : null}
                            </span>
                          </td>
                          <td>
                            {podeEditar ? (
                              <CampoReais
                                rotulo={`Valor por dia de ${p.nome}`}
                                valor={
                                  ed.valorDia !== undefined
                                    ? (ed.valorDia ?? null)
                                    : (p.valorDia ?? 0) / 100
                                }
                                onMudar={(valorDia) =>
                                  editar(p.colaboradorId, { valorDia })
                                }
                              />
                            ) : (
                              formatarCentavos(p.valorDia ?? 0)
                            )}
                          </td>
                        </>
                      ) : null}
                      {tipo === "faixa_etaria" ? (
                        <>
                          <td>{p.faixa ?? "—"}</td>
                          <td>
                            {p.dependentesCadastrados > p.dependentesNoPlano
                              ? `${p.dependentesNoPlano} de ${p.dependentesCadastrados}`
                              : p.dependentesNoPlano}
                          </td>
                          {r.coparticipacao ? (
                            <td>
                              {podeEditar ? (
                                <CampoReais
                                  rotulo={`Coparticipação de ${p.nome}`}
                                  valor={
                                    ed.coparticipacao !== undefined
                                      ? (ed.coparticipacao ?? null)
                                      : p.coparticipacao
                                  }
                                  onMudar={(coparticipacao) =>
                                    editar(p.colaboradorId, { coparticipacao })
                                  }
                                />
                              ) : p.coparticipacao !== null ? (
                                formatarCentavos(
                                  Math.round(p.coparticipacao * 100),
                                )
                              ) : (
                                "—"
                              )}
                            </td>
                          ) : null}
                        </>
                      ) : null}
                      {tipo === "individual" ? (
                        <td>
                          {r.individualModo === "plano" ? (
                            <select
                              aria-label={`Plano de ${p.nome}`}
                              disabled={!podeEditar}
                              value={
                                ed.planoId !== undefined
                                  ? (ed.planoId ?? "")
                                  : (p.planoId ?? "")
                              }
                              onChange={(e) =>
                                editar(p.colaboradorId, {
                                  planoId: e.target.value || null,
                                })
                              }
                            >
                              <option value="">Escolha</option>
                              {r.planos.map((pl) => (
                                <option key={pl.id} value={pl.id}>
                                  {`${pl.nome} · ${formatarCentavos(Math.round(pl.valor * 100))}`}
                                </option>
                              ))}
                            </select>
                          ) : podeEditar ? (
                            <CampoReais
                              rotulo={`Valor de ${p.nome}`}
                              valor={
                                ed.valorIndividual !== undefined
                                  ? (ed.valorIndividual ?? null)
                                  : p.valorIndividual
                              }
                              onMudar={(valorIndividual) =>
                                editar(p.colaboradorId, { valorIndividual })
                              }
                            />
                          ) : (
                            formatarCentavos(p.valor)
                          )}
                        </td>
                      ) : null}
                      {tipo === "antecipacao" &&
                      r.antecipacao?.modo === "variavel" ? (
                        <td>
                          {podeEditar ? (
                            <CampoReais
                              rotulo={`Antecipado de ${p.nome}`}
                              valor={
                                ed.antecipado !== undefined
                                  ? (ed.antecipado ?? null)
                                  : p.antecipado
                              }
                              onMudar={(antecipado) =>
                                editar(p.colaboradorId, { antecipado })
                              }
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                      <td className="beneficios__numero">
                        {formatarCentavos(p.valor)}
                      </td>
                      <td className="beneficios__numero beneficios__suave">
                        {formatarCentavos(p.empresa)}
                      </td>
                      <td className="beneficios__numero beneficios__forte">
                        {p.pendencia ? (
                          <span className="beneficios__alerta">Pendente</span>
                        ) : (
                          formatarCentavos(
                            b.folha === "adicional" ? p.adicional : p.desconto,
                          )
                        )}
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="beneficios__menu-botao"
                            aria-label={`Ações de ${p.nome}`}
                          >
                            <IconeMaisAcoes tamanho={18} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onSelect={() => onAbrirFicha(p.colaboradorId)}
                            >
                              Ver colaborador
                            </DropdownMenuItem>
                            {tipo === "faixa_etaria" && podeEditar ? (
                              <DropdownMenuItem
                                onSelect={() => setDependentesDe(p)}
                              >
                                Dependentes no plano
                              </DropdownMenuItem>
                            ) : null}
                            {podeEditar ? (
                              <>
                                <RadixMenu.Separator className="beneficios__menu-divisor" />
                                <DropdownMenuItem
                                  className="beneficios__menu-perigo"
                                  onSelect={() => setARemover(p)}
                                >
                                  Remover do benefício
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="beneficios__rodape-tabela">
            <span className="beneficios__suave" role="status">
              {total === 0
                ? "Nenhuma pessoa com esses filtros."
                : `Mostrando ${(paginaAtual - 1) * porPagina + 1}–${Math.min(paginaAtual * porPagina, total)} de ${total}`}
            </span>
            {ultimaPagina > 1 ? (
              <span className="beneficios__paginas">
                <IconButton
                  label="Página anterior"
                  icon={<IconeVoltar tamanho={16} />}
                  variant="subtle"
                  disabled={paginaAtual === 1}
                  onClick={() => setPagina(paginaAtual - 1)}
                />
                <span className="beneficios__suave">{`${paginaAtual} de ${ultimaPagina}`}</span>
                <IconButton
                  label="Próxima página"
                  icon={<IconeAvancar tamanho={16} />}
                  variant="subtle"
                  disabled={paginaAtual === ultimaPagina}
                  onClick={() => setPagina(paginaAtual + 1)}
                />
              </span>
            ) : null}
            {tipo === "dia_util" ? (
              <span className="beneficios__legenda">
                {(["escala", "catalogo", "uteis", "digitado"] as const).map(
                  (o) => (
                    <span key={o}>
                      <IconeDaOrigem origem={o} decorativo />
                      {ROTULO_DA_ORIGEM[o]}
                    </span>
                  ),
                )}
              </span>
            ) : null}
            <ListaDeEscolha
              aria-label="Pessoas por página"
              className="beneficios__por-pagina"
              valor={String(porPagina)}
              onMudar={(v) => {
                setPorPagina(Number(v));
                setPagina(1);
              }}
              opcoes={["25", "50", "100"].map((n) => ({
                valor: n,
                rotulo: `${n} por página`,
              }))}
            />
          </div>
        </>
      )}

      {nEdicoes > 0 ? (
        <div
          className="beneficios__barra-salvar"
          role="region"
          aria-label="Alterações não salvas"
        >
          <span>
            {`${nEdicoes === 1 ? "1 alteração não salva" : `${nEdicoes} alterações não salvas`} em ${formatarMesReferencia(competencia)}`}
            {previa
              ? ` · ${b.folha === "adicional" ? "Adicionais" : "Descontos"}: ${formatarCentavos(b.folha === "adicional" ? previa.antes.adicional : previa.antes.desconto)} → ${formatarCentavos(b.folha === "adicional" ? previa.depois.adicional : previa.depois.desconto)}`
              : ""}
          </span>
          <Button
            variant="secondary"
            disabled={salvando}
            onClick={() => setEdicoes({})}
          >
            Descartar
          </Button>
          <Button disabled={salvando} onClick={() => void salvarValores()}>
            Salvar valores
          </Button>
        </div>
      ) : null}

      {janela === "pausar" || janela === "encerrar" || janela === "excluir" ? (
        <JanelaDeSituacao
          tipo={janela}
          nome={b.nome}
          pessoas={t.pessoas}
          desconto={t.desconto}
          servico={servico}
          beneficioId={b.id}
          onFechar={() => setJanela(null)}
          onFeito={async (mensagem) => {
            setJanela(null);
            if (janela === "excluir") onVoltar(mensagem);
            else {
              setAviso(mensagem);
              await carregar();
            }
          }}
        />
      ) : null}

      {janela === "lote" ? (
        <GavetaDoLote
          servico={servico}
          beneficioId={b.id}
          competencia={competencia}
          valorDia={r.valorDia ?? 0}
          pessoas={dados.pessoas}
          selecionados={selecionados}
          onFechar={() => setJanela(null)}
          onFeito={async (mensagem) => {
            setJanela(null);
            setSelecionados([]);
            setAviso(mensagem);
            await carregar();
          }}
        />
      ) : null}

      {importando && onImportar ? (
        <GavetaDeImportacao
          nome={b.nome}
          colunas={colunasImportaveis}
          competenciaInicial={competencia}
          pessoas={dados.pessoas}
          onFechar={() => setImportando(false)}
          onRevisar={(planilha) => {
            setImportando(false);
            onImportar(planilha);
          }}
        />
      ) : null}

      {dependentesDe ? (
        <GavetaDeDependentes
          servico={servico}
          beneficioId={b.id}
          pessoa={dependentesDe}
          competencia={competencia}
          onFechar={() => setDependentesDe(null)}
          onFeito={async (mensagem) => {
            setDependentesDe(null);
            setAviso(mensagem);
            await carregar();
          }}
        />
      ) : null}

      <Dialog
        aberto={aRemover !== null}
        titulo={aRemover ? `Remover ${aRemover.nome} do benefício?` : ""}
        descricao="A pessoa deixa de receber o benefício a partir de agora. O histórico fica guardado."
        onFechar={() => setARemover(null)}
        rodape={
          <FormActions>
            <Button variant="secondary" onClick={() => setARemover(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!aRemover) return;
                await servico.removerPessoaDoBeneficio(
                  b.id,
                  aRemover.colaboradorId,
                );
                setAviso(`${aRemover.nome} removida do benefício.`);
                setARemover(null);
                await carregar();
              }}
            >
              Remover
            </Button>
          </FormActions>
        }
      >
        {null}
      </Dialog>
    </div>
  );
}

const TITULO_DO_HISTORICO: Readonly<Record<string, string>> = {
  criado: "Benefício criado",
  valores: "Valores do mês",
  configuracao: "Configuração alterada",
  pessoas: "Pessoas",
  dependentes: "Dependentes no plano",
  pausado: "Benefício pausado",
  encerrado: "Benefício encerrado",
  reativado: "Benefício reativado",
};

/** Pausar, Encerrar e Excluir (a partir de qual competência; o que acontece). */
export function JanelaDeSituacao({
  tipo,
  nome,
  pessoas,
  desconto,
  servico,
  beneficioId,
  onFechar,
  onFeito,
}: {
  readonly tipo: "pausar" | "encerrar" | "excluir";
  readonly nome: string;
  readonly pessoas: number;
  readonly desconto: number;
  readonly servico: ServicoDeBeneficios;
  readonly beneficioId: string;
  readonly onFechar: () => void;
  readonly onFeito: (mensagem: string) => void | Promise<void>;
}) {
  const atual = competenciaDoMesAtual();
  const proxima = competenciaVizinha(atual, 1);
  const [aPartirDe, setAPartirDe] = useState(proxima);
  const [trabalhando, setTrabalhando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  async function confirmar() {
    setTrabalhando(true);
    setFalha(null);
    try {
      if (tipo === "pausar")
        await servico.pausarBeneficio(beneficioId, aPartirDe);
      else if (tipo === "encerrar")
        await servico.encerrarBeneficio(beneficioId, aPartirDe);
      else await servico.excluirBeneficio(beneficioId);
      await onFeito(
        tipo === "pausar"
          ? `${nome} pausado a partir de ${formatarMesReferencia(aPartirDe)}.`
          : tipo === "encerrar"
            ? `${nome} encerrado a partir de ${formatarMesReferencia(aPartirDe)}.`
            : `${nome} excluído.`,
      );
    } catch {
      setFalha("Não foi possível concluir. Tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }

  const titulo =
    tipo === "pausar"
      ? `Pausar ${nome}?`
      : tipo === "encerrar"
        ? `Encerrar ${nome}?`
        : `Excluir ${nome}?`;
  const descricao =
    tipo === "pausar"
      ? "Use quando o benefício vai voltar. Para parar de oferecer de vez, use Encerrar."
      : tipo === "encerrar"
        ? "Para de oferecer o benefício. As pessoas, os valores e o histórico ficam guardados."
        : "Excluir tira o benefício da lista e da ficha das pessoas. O registro fica guardado no histórico do sistema.";
  return (
    <Dialog
      aberto
      titulo={titulo}
      descricao={descricao}
      onFechar={onFechar}
      bloqueado={trabalhando}
      rodape={
        <FormActions>
          <Button variant="secondary" disabled={trabalhando} onClick={onFechar}>
            Cancelar
          </Button>
          <Button disabled={trabalhando} onClick={() => void confirmar()}>
            {tipo === "pausar"
              ? "Pausar benefício"
              : tipo === "encerrar"
                ? "Encerrar benefício"
                : "Excluir benefício"}
          </Button>
        </FormActions>
      }
    >
      {tipo !== "excluir" ? (
        <div className="beneficios__janela">
          <p className="beneficios__rotulo-campo">A partir de</p>
          <CartoesDeOpcao
            rotulo="A partir de"
            valor={aPartirDe}
            onMudar={setAPartirDe}
            opcoes={[
              {
                valor: proxima,
                titulo: `Competência ${formatarMesReferencia(proxima)} (próximo mês)`,
                ajuda: `${maiuscula(formatarCompetenciaPorExtenso(atual))} fica como está.`,
              },
              {
                valor: atual,
                titulo: `Competência ${formatarMesReferencia(atual)} (mês atual)`,
                ajuda: "Tira o benefício do mês em andamento.",
              },
            ]}
          />
          <div className="beneficios__o-que-acontece">
            <p className="beneficios__suave">O que acontece</p>
            <ul>
              <li>{`${pessoas === 1 ? "1 pessoa deixa" : `${pessoas} pessoas deixam`} de ter o benefício${desconto ? ` e o desconto em folha (${formatarCentavos(desconto)} por mês, somando todos)` : ""} a partir da competência escolhida.`}</li>
              <li>Os meses anteriores e o histórico de valores não mudam.</li>
              <li>{`Na ficha das pessoas, o benefício sai da conta do mês. No Portal (quando existir), aparece como “${tipo === "pausar" ? "Pausado" : "Encerrado"}”.`}</li>
            </ul>
          </div>
        </div>
      ) : null}
      {falha ? (
        <p className="beneficios__erro" role="alert">
          {falha}
        </p>
      ) : null}
    </Dialog>
  );
}

/** "Alterar valor por dia": para quem, o que mudar e por quanto tempo. */
function GavetaDoLote({
  servico,
  beneficioId,
  competencia,
  valorDia,
  pessoas,
  selecionados,
  onFechar,
  onFeito,
}: {
  readonly servico: ServicoDeBeneficios;
  readonly beneficioId: string;
  readonly competencia: string;
  readonly valorDia: number;
  readonly pessoas: readonly PessoaDoBeneficioApi[];
  readonly selecionados: readonly string[];
  readonly onFechar: () => void;
  readonly onFeito: (mensagem: string) => void | Promise<void>;
}) {
  const [para, setPara] = useState<AlterarEmLoteDto["para"]>("todos");
  const [escalas, setEscalas] = useState<string[]>([]);
  const [deps, setDeps] = useState<string[]>([]);
  const [oQue, setOQue] = useState<"valor" | "dias" | "dois">("valor");
  const [modoValor, setModoValor] = useState<"novo" | "reajuste">("novo");
  const [novo, setNovo] = useState<number | null>(null);
  const [reajuste, setReajuste] = useState<number | null>(null);
  const [dias, setDias] = useState<number | null>(null);
  const [duracao, setDuracao] = useState<"mes" | "em_diante">("mes");
  const [falha, setFalha] = useState<string | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const todasEscalas = [
    ...new Set(pessoas.map((p) => p.escala).filter((e): e is string => !!e)),
  ];
  const todosDeps = [
    ...new Map(
      pessoas
        .filter((p) => p.departamentoId)
        .map((p) => [p.departamentoId!, p.departamento ?? ""]),
    ).entries(),
  ];
  const alvos =
    para === "todos"
      ? pessoas.length
      : para === "selecionados"
        ? selecionados.length
        : pessoas.filter(
            (p) =>
              (p.escala && escalas.includes(p.escala)) ||
              (p.departamentoId && deps.includes(p.departamentoId)),
          ).length;
  const mes = formatarCompetenciaPorExtenso(competencia);
  const mesSeguinte = formatarCompetenciaPorExtenso(
    competenciaVizinha(competencia, 1),
  ).split(" de ")[0];

  async function aplicar() {
    setTrabalhando(true);
    setFalha(null);
    try {
      const mudaValor = oQue !== "dias";
      const r = await servico.alterarValoresEmLote(beneficioId, {
        competencia,
        para,
        ...(para === "selecionados"
          ? { colaboradorIds: [...selecionados] }
          : {}),
        ...(para === "grupo" ? { escalas, departamentoIds: deps } : {}),
        ...(mudaValor && modoValor === "novo" ? { valorDia: novo } : {}),
        ...(mudaValor && modoValor === "reajuste"
          ? { reajustePercentual: reajuste }
          : {}),
        ...(oQue !== "valor" ? { dias } : {}),
        duracao,
      });
      await onFeito(`Valores alterados para ${nPessoas(r.alteradas)}.`);
    } catch {
      setFalha("Não foi possível aplicar. Confira os campos e tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }

  const podeEmDiante = para === "todos" && oQue === "valor";
  return (
    <Sheet
      aberto
      titulo="Alterar valor por dia"
      descricao={`Muda o valor de várias pessoas de uma vez em ${mes}.`}
      onFechar={onFechar}
      bloqueado={trabalhando}
      rodape={
        <FormActions>
          <Button variant="secondary" onClick={onFechar} disabled={trabalhando}>
            Cancelar
          </Button>
          <Button
            disabled={trabalhando || alvos === 0}
            onClick={() => void aplicar()}
          >
            {`Aplicar em ${nPessoas(alvos)} · ${duracao === "mes" ? `só ${formatarCompetenciaAbreviada(competencia)}` : "daqui em diante"}`}
          </Button>
        </FormActions>
      }
    >
      <div className="beneficios__gaveta">
        <section>
          <h3>1 · Para quem?</h3>
          <CartoesDeOpcao
            rotulo="Para quem"
            valor={para}
            onMudar={setPara}
            opcoes={[
              {
                valor: "todos" as const,
                titulo: `Todas as pessoas do benefício (${pessoas.length})`,
              },
              {
                valor: "selecionados" as const,
                titulo: `Só as selecionadas na tabela (${selecionados.length})`,
              },
              {
                valor: "grupo" as const,
                titulo: "Por escala ou departamento",
                ajuda: "Ex.: só quem trabalha 12x36",
                conteudo: (
                  <div className="beneficios__chips">
                    {todasEscalas.map((e) => (
                      <label key={e} className="beneficios__chip">
                        <input
                          type="checkbox"
                          checked={escalas.includes(e)}
                          onChange={(x) =>
                            setEscalas((s) =>
                              x.target.checked
                                ? [...s, e]
                                : s.filter((y) => y !== e),
                            )
                          }
                        />
                        {`Escala ${nomeDaEscala(e)}`}
                      </label>
                    ))}
                    {todosDeps.map(([id, nome]) => (
                      <label key={id} className="beneficios__chip">
                        <input
                          type="checkbox"
                          checked={deps.includes(id)}
                          onChange={(x) =>
                            setDeps((s) =>
                              x.target.checked
                                ? [...s, id]
                                : s.filter((y) => y !== id),
                            )
                          }
                        />
                        {nome}
                      </label>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </section>
        <section>
          <h3>2 · O que mudar?</h3>
          <Segmentado
            rotulo="O que mudar"
            valor={oQue}
            onMudar={(v) => {
              setOQue(v);
              if (v !== "valor") setDuracao("mes");
            }}
            opcoes={[
              { valor: "valor", rotulo: "Valor por dia" },
              { valor: "dias", rotulo: "Dias no mês" },
              { valor: "dois", rotulo: "Os dois" },
            ]}
          />
          {oQue !== "dias" ? (
            <div className="beneficios__parte">
              <Segmentado
                rotulo="Como mudar o valor"
                valor={modoValor}
                onMudar={setModoValor}
                opcoes={[
                  { valor: "novo", rotulo: "Novo valor" },
                  { valor: "reajuste", rotulo: "Reajuste em %" },
                ]}
              />
              <div className="beneficios__parte-linha">
                <span>{`Hoje ${formatarCentavos(Math.round(valorDia * 100))} →`}</span>
                {modoValor === "novo" ? (
                  <CampoReais
                    rotulo="Novo valor por dia"
                    sufixo="por dia"
                    valor={novo}
                    onMudar={setNovo}
                  />
                ) : (
                  <CampoNumero
                    rotulo="Reajuste em %"
                    decimal
                    sufixo="%"
                    valor={reajuste}
                    onMudar={setReajuste}
                  />
                )}
              </div>
            </div>
          ) : null}
          {oQue !== "valor" ? (
            <div className="beneficios__parte-linha">
              <span>Dias no mês</span>
              <CampoNumero
                rotulo="Dias no mês"
                max={31}
                sufixo="dias"
                valor={dias}
                onMudar={setDias}
              />
            </div>
          ) : null}
        </section>
        <section>
          <h3>3 · Por quanto tempo?</h3>
          <CartoesDeOpcao
            rotulo="Por quanto tempo"
            valor={duracao}
            onMudar={setDuracao}
            opcoes={[
              {
                valor: "mes" as const,
                titulo: `Só em ${mes}`,
                ajuda: `Ajuste pontual. Em ${mesSeguinte} volta ao valor do benefício (${formatarCentavos(Math.round(valorDia * 100))}).`,
              },
              ...(podeEmDiante
                ? [
                    {
                      valor: "em_diante" as const,
                      titulo: `De ${mes} em diante`,
                      ajuda:
                        "Muda a regra do benefício para os próximos meses também.",
                    },
                  ]
                : []),
            ]}
          />
        </section>
        {falha ? (
          <p className="beneficios__erro" role="alert">
            {falha}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

/** "Dependentes no plano": quem está no plano e a partir de quando. */
function GavetaDeDependentes({
  servico,
  beneficioId,
  pessoa,
  competencia,
  onFechar,
  onFeito,
}: {
  readonly servico: ServicoDeBeneficios;
  readonly beneficioId: string;
  readonly pessoa: PessoaDoBeneficioApi;
  readonly competencia: string;
  readonly onFechar: () => void;
  readonly onFeito: (mensagem: string) => void | Promise<void>;
}) {
  const [lista, setLista] = useState<DependenteDoPlanoApi[] | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [aPartirDe, setAPartirDe] = useState(competencia);
  const [trabalhando, setTrabalhando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [impacto, setImpacto] = useState<SimulacaoDeDependentesApi | null>(
    null,
  );
  const primeiro = pessoa.nome.split(" ")[0];

  // O impacto no mês escolhido, sem gravar.
  useEffect(() => {
    if (lista === null || lista.length === 0) return;
    let vivo = true;
    servico
      .simularDependentesNoPlano(
        beneficioId,
        pessoa.colaboradorId,
        marcados,
        aPartirDe,
      )
      .then((r) => {
        if (vivo) setImpacto(r);
      })
      .catch(() => {
        if (vivo) setImpacto(null);
      });
    return () => {
      vivo = false;
    };
  }, [servico, beneficioId, pessoa.colaboradorId, marcados, aPartirDe, lista]);

  useEffect(() => {
    servico
      .dependentesDaPessoaNoBeneficio(
        beneficioId,
        pessoa.colaboradorId,
        competencia,
      )
      .then((r) => {
        setLista(r.dependentes);
        setMarcados(r.dependentes.filter((d) => d.noPlano).map((d) => d.id));
      })
      .catch(() => setLista([]));
  }, [servico, beneficioId, pessoa.colaboradorId, competencia]);

  async function salvar() {
    setTrabalhando(true);
    try {
      await servico.salvarDependentesNoPlano(
        beneficioId,
        pessoa.colaboradorId,
        marcados,
        aPartirDe,
      );
      await onFeito(
        `Dependentes de ${primeiro} salvos a partir de ${formatarMesReferencia(aPartirDe)}.`,
      );
    } catch {
      setFalha("Não foi possível salvar. Tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }

  const seguinte = competenciaVizinha(competencia, 1);
  return (
    <Sheet
      aberto
      titulo="Dependentes no plano"
      descricao={`${pessoa.nome} · marque quem está no plano. Dependente sem marca não entra no valor.`}
      onFechar={onFechar}
      bloqueado={trabalhando}
      rodape={
        <FormActions>
          <Button variant="secondary" onClick={onFechar} disabled={trabalhando}>
            Cancelar
          </Button>
          {lista && lista.length ? (
            <Button disabled={trabalhando} onClick={() => void salvar()}>
              {`Salvar · ${marcados.length} no plano a partir de ${formatarMesReferencia(aPartirDe)}`}
            </Button>
          ) : null}
        </FormActions>
      }
    >
      <div className="beneficios__gaveta">
        <section>
          <h3>1 · Quem está no plano?</h3>
          {lista === null ? (
            <p className="beneficios__suave">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="beneficios__suave">{`${primeiro} não tem dependentes no cadastro. Para incluir alguém no plano, cadastre o dependente em Editar colaborador › Dependentes.`}</p>
          ) : (
            <>
              {lista.map((d) => (
                <label key={d.id} className="beneficios__dependente">
                  <input
                    type="checkbox"
                    checked={marcados.includes(d.id)}
                    onChange={(e) =>
                      setMarcados((m) =>
                        e.target.checked
                          ? [...m, d.id]
                          : m.filter((x) => x !== d.id),
                      )
                    }
                  />
                  <span className="beneficios__pessoa-textos">
                    <span className="beneficios__pessoa-nome">{d.nome}</span>
                    <span className="beneficios__suave">
                      {`${rotuloDoParentesco(d.parentesco)}${d.dataNascimento ? ` · nasceu em ${formatarDiaCivil(d.dataNascimento)} · faixa ${faixaNaCompetencia(d.dataNascimento, aPartirDe)}` : " · sem data de nascimento"}`}
                    </span>
                  </span>
                </label>
              ))}
              <p className="beneficios__suave">
                Lista do cadastro do colaborador. Para incluir alguém, cadastre
                o dependente em Editar colaborador › Dependentes.
              </p>
            </>
          )}
        </section>
        {lista && lista.length ? (
          <section>
            <h3>2 · A partir de quando?</h3>
            <CartoesDeOpcao
              rotulo="A partir de quando"
              valor={aPartirDe}
              onMudar={setAPartirDe}
              opcoes={[
                {
                  valor: competencia,
                  titulo: maiuscula(
                    formatarCompetenciaPorExtenso(competencia, "barra"),
                  ),
                  ajuda: "Vale a partir deste mês.",
                },
                {
                  valor: seguinte,
                  titulo: maiuscula(
                    formatarCompetenciaPorExtenso(seguinte, "barra"),
                  ),
                  ajuda: `${maiuscula(formatarCompetenciaPorExtenso(competencia, "barra"))} fica como está.`,
                },
              ]}
            />
          </section>
        ) : null}
        {impacto ? (
          <section
            className="beneficios__impacto"
            aria-label={`Impacto em ${formatarCompetenciaPorExtenso(aPartirDe, "barra")}`}
          >
            <div className="beneficios__impacto-cabeca">
              <h3>{`Impacto em ${formatarCompetenciaPorExtenso(aPartirDe, "barra")}`}</h3>
              <span className="beneficios__suave">{pessoa.nome}</span>
            </div>
            <table className="beneficios__tabela">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="beneficios__so-leitor">Valor</span>
                  </th>
                  <th scope="col" className="beneficios__numero">
                    Antes
                  </th>
                  <th scope="col" className="beneficios__numero">
                    Depois
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Mensalidade", "valor"],
                    ["Empresa paga", "empresa"],
                    ["Desconto em folha", "desconto"],
                  ] as const
                ).map(([rotulo, k]) => (
                  <tr key={k}>
                    <th scope="row">{rotulo}</th>
                    <td className="beneficios__numero">
                      {formatarCentavos(impacto.antes[k])}
                    </td>
                    <td
                      className={`beneficios__numero${impacto.antes[k] !== impacto.depois[k] ? " beneficios__forte" : ""}`}
                    >
                      {formatarCentavos(impacto.depois[k])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
        {falha ? (
          <p className="beneficios__erro" role="alert">
            {falha}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

const ICONE_DA_ORIGEM: Readonly<Record<OrigemDosDias, typeof IconeCalendario>> =
  {
    escala: IconeCalendario,
    catalogo: IconeModelo,
    uteis: IconeTempo,
    digitado: IconeEditar,
  };

/** O ícone de onde vieram os dias (a legenda dá o nome). */
function IconeDaOrigem({
  origem,
  decorativo = false,
}: {
  readonly origem: OrigemDosDias;
  readonly decorativo?: boolean;
}) {
  const Icone = ICONE_DA_ORIGEM[origem];
  return (
    <span
      className={`beneficios__origem beneficios__origem--${origem}`}
      {...(decorativo
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": ROTULO_DA_ORIGEM[origem] })}
      title={decorativo ? undefined : ROTULO_DA_ORIGEM[origem]}
    >
      <Icone tamanho={14} />
    </span>
  );
}
