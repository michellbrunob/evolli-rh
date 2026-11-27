/**
 * T215 — módulo Benefícios (Remuneração › Benefícios), como a referência
 * (2026-11-26): a lista por competência (Ativos, Pausados, Encerrados), o
 * assistente "Novo benefício", o detalhe de cada benefício (pessoas e
 * valores do mês, histórico) e a página "Adicionar pessoas".
 *
 * As subtelas vivem dentro do módulo (a rota é `#/beneficios`); abrir a
 * ficha de alguém usa a rota da ficha.
 */
import { Esqueleto } from "../../ui/movimento";
import { useCallback, useEffect, useState } from "react";
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type {
  BeneficioApi,
  ListaDeBeneficiosApi,
  LinhaDeBeneficioApi,
  SituacaoBeneficio,
} from "../../api/beneficiosClient";
import { Button } from "../../components";
import { formatarMesReferencia } from "../../format/data";
import { formatarCentavos } from "../../format/moeda";
import { plural } from "../../format/plural";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
} from "../../ui";
import {
  IconeBaixarArquivo,
  IconeBeneficios,
  IconeCarteira,
  IconeDinheiro,
  IconeEquipe,
  IconeInformacao,
  IconeMais,
  IconeMaisAcoes,
} from "../../ui/icones";
import { competenciaDoMesAtual } from "../../app/rotasDoShell";
import { baixarArquivo } from "../dashboard/exportacao";
import { SeletorDePeriodo } from "../horarios/quadro/SeletorDePeriodo";
import { TIPO_MIME_XLSX } from "../pessoas/importacao/planilhaXlsx";
import { PessoaNaLinha } from "./comuns";
import {
  nomeDaExportacao,
  pdfDaLista,
  planilhaDaLista,
} from "./exportarBeneficios";
import { AdicionarPessoasDoBeneficio } from "./AdicionarPessoasDoBeneficio";
import { AssistenteDeBeneficio } from "./AssistenteDeBeneficio";
import { DetalheDoBeneficio, JanelaDeSituacao } from "./DetalheDoBeneficio";
import {
  type PlanilhaEnviada,
  RevisaoDaImportacao,
} from "./ImportarValoresDoBeneficio";
import type { ServicoDeBeneficios } from "./servicoDeBeneficios";
import { CATEGORIAS, ICONE_DA_CATEGORIA } from "./textosDosBeneficios";
import "./Beneficios.css";

export const BENEFICIOS_TITULO_ID = "beneficios-titulo";

type Tela =
  | { readonly tipo: "lista" }
  | { readonly tipo: "novo" }
  | {
      readonly tipo: "detalhe";
      readonly id: string;
      readonly importar?: boolean;
    }
  | {
      readonly tipo: "importar";
      readonly id: string;
      readonly planilha: PlanilhaEnviada;
    }
  | { readonly tipo: "editar"; readonly base: BeneficioApi }
  | { readonly tipo: "adicionar"; readonly id: string; readonly nome: string };

export function BeneficiosModulo({
  servico,
  podeEditar,
  onAbrirFicha,
}: {
  readonly servico: ServicoDeBeneficios;
  readonly podeEditar: boolean;
  readonly onAbrirFicha: (colaboradorId: string) => void;
}) {
  const [tela, setTela] = useState<Tela>({ tipo: "lista" });
  const [competencia, setCompetencia] = useState(competenciaDoMesAtual());
  const [aviso, setAviso] = useState<string | null>(null);

  const irPara = (t: Tela, mensagem?: string) => {
    setTela(t);
    setAviso(mensagem ?? null);
    window.scrollTo?.(0, 0);
  };

  if (tela.tipo === "novo" || tela.tipo === "editar") {
    return (
      <AssistenteDeBeneficio
        servico={servico}
        {...(tela.tipo === "editar"
          ? {
              base: tela.base,
              competenciaDaEdicao: competencia,
              onVerPessoas: () => irPara({ tipo: "detalhe", id: tela.base.id }),
            }
          : {})}
        onSair={() =>
          irPara(
            tela.tipo === "editar"
              ? { tipo: "detalhe", id: tela.base.id }
              : { tipo: "lista" },
          )
        }
        onSalvo={(id, mensagem) => irPara({ tipo: "detalhe", id }, mensagem)}
      />
    );
  }
  if (tela.tipo === "importar") {
    return (
      <RevisaoDaImportacao
        servico={servico}
        beneficioId={tela.id}
        planilha={tela.planilha}
        onTrocarArquivo={() =>
          irPara({ tipo: "detalhe", id: tela.id, importar: true })
        }
        onCancelar={() => irPara({ tipo: "detalhe", id: tela.id })}
        onImportado={(mensagem) => {
          setCompetencia(tela.planilha.competencia);
          irPara({ tipo: "detalhe", id: tela.id }, mensagem);
        }}
      />
    );
  }
  if (tela.tipo === "detalhe") {
    return (
      <DetalheDoBeneficio
        key={`${tela.id}-${tela.importar ? "i" : ""}`}
        abrirImportacao={tela.importar === true}
        onImportar={(planilha) =>
          irPara({ tipo: "importar", id: tela.id, planilha })
        }
        servico={servico}
        beneficioId={tela.id}
        podeEditar={podeEditar}
        competenciaInicial={competencia}
        avisoInicial={aviso}
        onVoltar={(mensagem) => irPara({ tipo: "lista" }, mensagem)}
        onEditar={(base) => irPara({ tipo: "editar", base })}
        onAdicionar={(nome) => irPara({ tipo: "adicionar", id: tela.id, nome })}
        onAbrirOutro={(id, mensagem) =>
          irPara({ tipo: "detalhe", id }, mensagem)
        }
        onAbrirFicha={onAbrirFicha}
        onCompetencia={setCompetencia}
      />
    );
  }
  if (tela.tipo === "adicionar") {
    return (
      <AdicionarPessoasDoBeneficio
        servico={servico}
        beneficioId={tela.id}
        nome={tela.nome}
        competenciaInicial={competencia}
        onSair={(mensagem) =>
          irPara({ tipo: "detalhe", id: tela.id }, mensagem)
        }
      />
    );
  }
  return (
    <ListaDeBeneficios
      servico={servico}
      podeEditar={podeEditar}
      competencia={competencia}
      onCompetencia={setCompetencia}
      aviso={aviso}
      onNovo={() => irPara({ tipo: "novo" })}
      onAbrir={(id) => irPara({ tipo: "detalhe", id })}
      onEditar={async (id) => {
        const d = await servico.obterBeneficio(id, competencia);
        irPara({ tipo: "editar", base: d.beneficio });
      }}
      onAbrirOutro={(id, mensagem) => irPara({ tipo: "detalhe", id }, mensagem)}
      onAviso={setAviso}
      onAbrirFicha={onAbrirFicha}
    />
  );
}

const ABAS: readonly { valor: SituacaoBeneficio; rotulo: string }[] = [
  { valor: "ativo", rotulo: "Ativos" },
  { valor: "pausado", rotulo: "Pausados" },
  { valor: "encerrado", rotulo: "Encerrados" },
];

function ListaDeBeneficios({
  servico,
  podeEditar,
  competencia,
  onCompetencia,
  aviso,
  onNovo,
  onAbrir,
  onEditar,
  onAbrirOutro,
  onAviso,
  onAbrirFicha,
}: {
  readonly servico: ServicoDeBeneficios;
  readonly podeEditar: boolean;
  readonly competencia: string;
  readonly onCompetencia: (c: string) => void;
  readonly aviso: string | null;
  readonly onNovo: () => void;
  readonly onAbrir: (id: string) => void;
  readonly onEditar: (id: string) => Promise<void>;
  readonly onAbrirOutro: (id: string, mensagem: string) => void;
  readonly onAviso: (m: string | null) => void;
  readonly onAbrirFicha: (colaboradorId: string) => void;
}) {
  const [dados, setDados] = useState<ListaDeBeneficiosApi | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aba, setAba] = useState<SituacaoBeneficio>("ativo");
  const [verQuem, setVerQuem] = useState(false);
  const [janela, setJanela] = useState<{
    tipo: "pausar" | "encerrar" | "excluir";
    linha: LinhaDeBeneficioApi;
  } | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await servico.listarBeneficios(competencia));
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [servico, competencia]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const linhas = (dados?.beneficios ?? []).filter((b) => b.situacao === aba);
  const contagem = (s: SituacaoBeneficio) =>
    (dados?.beneficios ?? []).filter((b) => b.situacao === s).length;
  const vazio = dados !== null && dados.beneficios.length === 0;
  const resumo = dados?.resumo ?? null;
  const mesCurto = formatarMesReferencia(competencia);

  function exportar(formato: "xlsx" | "pdf") {
    if (!dados) return;
    if (formato === "xlsx") {
      baixarArquivo(
        planilhaDaLista(dados),
        nomeDaExportacao(competencia, "xlsx"),
        TIPO_MIME_XLSX,
      );
    } else {
      baixarArquivo(
        pdfDaLista(dados),
        nomeDaExportacao(competencia, "pdf"),
        "application/pdf",
      );
    }
  }

  return (
    <div className="beneficios">
      <header className="beneficios__cabecalho">
        <div className="beneficios__titulos">
          <h1 id={BENEFICIOS_TITULO_ID} className="beneficios__titulo">
            Benefícios
          </h1>
          <p className="beneficios__subtitulo">
            Configure o que a empresa oferece, quem recebe e quanto entra na
            folha.
          </p>
        </div>
        {!vazio ? (
          <div className="beneficios__acoes-topo">
            <SeletorDePeriodo
              tamanho="mes"
              ancora={`${competencia}-01`}
              semanaComeca={0}
              onEscolher={(dia) => onCompetencia(dia.slice(0, 7))}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                className="evolli-button evolli-button--secondary"
                aria-label="Exportar"
                disabled={!dados}
              >
                <IconeBaixarArquivo tamanho={16} />
                Exportar
              </DropdownMenuTrigger>
              <DropdownMenuContent className="beneficios__menu-exportar">
                <DropdownMenuItem onSelect={() => exportar("pdf")}>
                  <span className="beneficios__menu-opcao">
                    <strong>Exportar em PDF</strong>
                    <span className="beneficios__suave">
                      Relatório da competência
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportar("xlsx")}>
                  <span className="beneficios__menu-opcao">
                    <strong>Exportar em Excel</strong>
                    <span className="beneficios__suave">
                      Planilha com custos e descontos
                    </span>
                  </span>
                </DropdownMenuItem>
                <RadixMenu.Separator className="beneficios__menu-divisor" />
                <p className="beneficios__menu-nota">
                  {`Competência ${mesCurto}. Entram todos os benefícios, de todas as abas.`}
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
            {podeEditar ? (
              <Button onClick={onNovo}>
                <IconeMais tamanho={16} />
                Novo benefício
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {aviso ? (
        <p className="beneficios__aviso" role="status">
          {aviso}
        </p>
      ) : null}

      {falhou ? (
        <div className="beneficios__erro" role="alert">
          <p>Não foi possível carregar os benefícios.</p>
          <Button variant="secondary" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </div>
      ) : !dados ? (
        <Esqueleto rotulo="Carregando benefícios…" linhas={5} />
      ) : vazio ? (
        <div className="beneficios__vazio">
          <div className="beneficios__vazio-cartao">
            <span className="beneficios__vazio-icone" aria-hidden="true">
              <IconeBeneficios tamanho={28} />
            </span>
            <h2>Nenhum benefício cadastrado ainda</h2>
            <p>
              Cadastre o que a empresa oferece para calcular o custo de cada
              benefício, mostrar o desconto e o adicional de cada pessoa e
              acompanhar tudo na ficha do colaborador.
            </p>
            {podeEditar ? (
              <Button onClick={onNovo}>
                <IconeMais tamanho={16} />
                Cadastrar primeiro benefício
              </Button>
            ) : null}
          </div>
          <ol className="beneficios__passos">
            <li>
              <span className="beneficios__passo-numero">Passo 1</span>
              <strong>Escolha o benefício</strong>
              <span>
                Dê o nome do benefício ou do fornecedor e escolha a categoria:
                ela traz as regras da lei.
              </span>
            </li>
            <li>
              <span className="beneficios__passo-numero">Passo 2</span>
              <strong>Defina quem paga o quê</strong>
              <span>
                Valor fixo, por dia útil, por faixa etária ou individual. A
                prévia mostra o desconto na folha.
              </span>
            </li>
            <li>
              <span className="beneficios__passo-numero">Passo 3</span>
              <strong>Vincule as pessoas</strong>
              <span>
                Escolha quem recebe. A partir daí o valor de cada pessoa é
                calculado mês a mês.
              </span>
            </li>
          </ol>
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Situação"
            className="beneficios__abas"
          >
            {ABAS.map((a) => (
              <button
                key={a.valor}
                type="button"
                role="tab"
                aria-selected={aba === a.valor}
                onClick={() => setAba(a.valor)}
              >
                {a.rotulo}{" "}
                <span className="beneficios__contagem">
                  {contagem(a.valor)}
                </span>
              </button>
            ))}
          </div>
          {linhas.length === 0 ? (
            <div className="beneficios__aba-vazia">
              <strong>{VAZIO_DA_ABA[aba].titulo}</strong>
              <span className="beneficios__suave">
                {VAZIO_DA_ABA[aba].texto}
              </span>
            </div>
          ) : (
            <div className="beneficios__tabela-caixa">
              <table
                className="beneficios__tabela beneficios__tabela--lista"
                aria-label="Benefícios"
              >
                <thead>
                  <tr>
                    <th scope="col">Benefício</th>
                    <th scope="col" className="beneficios__numero">
                      Pessoas
                    </th>
                    <th scope="col" className="beneficios__numero">
                      Custo da empresa
                    </th>
                    <th scope="col" className="beneficios__numero">
                      Desconto em folha
                    </th>
                    <th scope="col">
                      <span className="beneficios__so-leitor">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((b) => {
                    const Icone = ICONE_DA_CATEGORIA[b.categoria];
                    return (
                      <tr key={b.id}>
                        <td>
                          <button
                            type="button"
                            className="beneficios__nome-botao"
                            onClick={() => onAbrir(b.id)}
                          >
                            <span
                              className="beneficios__icone-cat"
                              aria-hidden="true"
                            >
                              <Icone tamanho={18} />
                            </span>
                            <span className="beneficios__pessoa-textos">
                              <span className="beneficios__pessoa-nome">
                                {b.nome}
                              </span>
                              <span className="beneficios__suave">
                                {CATEGORIAS[b.categoria].curta}
                                {b.suspensoAPartirDe
                                  ? ` · ${b.situacao === "pausado" ? "pausado" : "encerrado"} a partir de ${formatarMesReferencia(b.suspensoAPartirDe)}`
                                  : ""}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="beneficios__numero">
                          {b.pessoas}
                          {b.dependentes > 0 ? (
                            <span className="beneficios__suave beneficios__dep">
                              {` + ${b.dependentes} dep.`}
                            </span>
                          ) : null}
                        </td>
                        <td className="beneficios__numero beneficios__forte">
                          {formatarCentavos(b.empresa)}
                        </td>
                        <td className="beneficios__numero">
                          {formatarCentavos(b.desconto)}
                        </td>
                        <td>
                          <div className="beneficios__acoes-linha">
                            <Button
                              variant="secondary"
                              aria-label={`Ver mais sobre ${b.nome}`}
                              onClick={() => onAbrir(b.id)}
                            >
                              Ver mais
                            </Button>
                            {podeEditar ? (
                              <MenuDaLinha
                                linha={b}
                                servico={servico}
                                onAbrir={onAbrir}
                                onEditar={onEditar}
                                onAbrirOutro={onAbrirOutro}
                                onAviso={onAviso}
                                onJanela={(tipo) =>
                                  setJanela({ tipo, linha: b })
                                }
                                onRecarregar={carregar}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {aba === "ativo" && resumo ? (
                  <tfoot>
                    <tr>
                      <th scope="row">
                        <span className="beneficios__pessoa-textos">
                          <span className="beneficios__pessoa-nome">
                            Total da competência
                          </span>
                          <span className="beneficios__suave">
                            {`${plural(resumo.beneficiosAtivos, "benefício ativo", "benefícios ativos")} · ${plural(resumo.pessoas, "pessoa", "pessoas")}`}
                          </span>
                        </span>
                      </th>
                      <td />
                      <td className="beneficios__numero beneficios__forte">
                        {formatarCentavos(resumo.empresa)}
                      </td>
                      <td className="beneficios__numero beneficios__forte">
                        {formatarCentavos(resumo.desconto)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}
          <p className="beneficios__nota-linha">
            <IconeInformacao tamanho={14} />
            {`Custos da competência ${mesCurto}. Clique em um benefício para ver como é calculado e o valor de cada pessoa.`}
          </p>
          {resumo ? (
            <ResumoDaCompetencia
              resumo={resumo}
              competencia={competencia}
              onVerQuem={() => setVerQuem(true)}
            />
          ) : null}
        </>
      )}

      {resumo ? (
        <Sheet
          aberto={verQuem}
          titulo="Sem nenhum benefício"
          subtitulo={`${plural(resumo.semBeneficio.length, "pessoa ativa", "pessoas ativas")} em ${mesCurto}`}
          onFechar={() => setVerQuem(false)}
        >
          {resumo.semBeneficio.length === 0 ? (
            <p className="beneficios__suave">
              Todas as pessoas ativas recebem pelo menos um benefício.
            </p>
          ) : (
            <ul className="beneficios__lista-pessoas">
              {resumo.semBeneficio.map((p) => (
                <li key={p.colaboradorId}>
                  <button
                    type="button"
                    className="beneficios__pessoa-botao"
                    onClick={() => onAbrirFicha(p.colaboradorId)}
                  >
                    <PessoaNaLinha nome={p.nome} detalhe={p.cargo} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      ) : null}

      {janela ? (
        <JanelaDeSituacao
          tipo={janela.tipo}
          nome={janela.linha.nome}
          pessoas={janela.linha.pessoas}
          desconto={janela.linha.desconto}
          servico={servico}
          beneficioId={janela.linha.id}
          onFechar={() => setJanela(null)}
          onFeito={async (mensagem) => {
            setJanela(null);
            onAviso(mensagem);
            await carregar();
          }}
        />
      ) : null}
    </div>
  );
}

const VAZIO_DA_ABA: Readonly<
  Record<SituacaoBeneficio, { titulo: string; texto: string }>
> = {
  ativo: {
    titulo: "Nenhum benefício ativo",
    texto: "Benefícios ativos entram no cálculo de cada competência.",
  },
  pausado: {
    titulo: "Nenhum benefício pausado",
    texto:
      "Benefícios pausados aparecem aqui e podem ser reativados quando quiser.",
  },
  encerrado: {
    titulo: "Nenhum benefício encerrado",
    texto: "Benefícios encerrados ficam aqui com todo o histórico de valores.",
  },
};

/** Os três números da competência, embaixo da tabela. */
function ResumoDaCompetencia({
  resumo,
  competencia,
  onVerQuem,
}: {
  readonly resumo: ListaDeBeneficiosApi["resumo"];
  readonly competencia: string;
  readonly onVerQuem: () => void;
}) {
  const cobertos = resumo.ativos - resumo.semBeneficio.length;
  const pct =
    resumo.ativos > 0 ? Math.round((cobertos / resumo.ativos) * 100) : 0;
  return (
    <section className="beneficios__painel" aria-label="Resumo da competência">
      <div className="beneficios__painel-item">
        <h2 className="beneficios__painel-titulo">
          <span className="beneficios__icone-cat" aria-hidden="true">
            <IconeDinheiro tamanho={16} />
          </span>
          Investimento da empresa
        </h2>
        <p className="beneficios__painel-valor">
          {formatarCentavos(resumo.empresa)}
          <span className="beneficios__suave">/mês</span>
        </p>
        <p className="beneficios__suave">
          {`Competência ${formatarMesReferencia(competencia)} · ${plural(resumo.beneficiosAtivos, "benefício ativo", "benefícios ativos")}`}
        </p>
      </div>
      <div className="beneficios__painel-item">
        <h2 className="beneficios__painel-titulo">
          <span className="beneficios__icone-cat" aria-hidden="true">
            <IconeCarteira tamanho={16} />
          </span>
          Descontado em folha
        </h2>
        <p className="beneficios__painel-valor">
          {formatarCentavos(resumo.desconto)}
        </p>
        <p className="beneficios__suave">
          {`Parte paga pelos colaboradores · ${plural(resumo.comDesconto, "pessoa", "pessoas")}`}
        </p>
      </div>
      <div className="beneficios__painel-item">
        <div className="beneficios__painel-cabeca">
          <h2 className="beneficios__painel-titulo">
            <span className="beneficios__icone-cat" aria-hidden="true">
              <IconeEquipe tamanho={16} />
            </span>
            Cobertura do time
          </h2>
          <button
            type="button"
            className="beneficios__link"
            onClick={onVerQuem}
          >
            Ver quem
          </button>
        </div>
        <p className="beneficios__painel-valor">
          {cobertos}
          <span className="beneficios__suave">{`de ${resumo.ativos} ativos`}</span>
        </p>
        <div className="beneficios__painel-barra">
          <span
            role="progressbar"
            aria-label="Cobertura do time"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="beneficios__barra"
          >
            <span style={{ width: `${pct}%` }} />
          </span>
          <span className="beneficios__suave">
            {`${resumo.semBeneficio.length} sem nenhum benefício`}
          </span>
        </div>
      </div>
    </section>
  );
}

/** O ⋯ de cada benefício da lista. */
function MenuDaLinha({
  linha: b,
  servico,
  onAbrir,
  onEditar,
  onAbrirOutro,
  onAviso,
  onJanela,
  onRecarregar,
}: {
  readonly linha: LinhaDeBeneficioApi;
  readonly servico: ServicoDeBeneficios;
  readonly onAbrir: (id: string) => void;
  readonly onEditar: (id: string) => Promise<void>;
  readonly onAbrirOutro: (id: string, mensagem: string) => void;
  readonly onAviso: (m: string | null) => void;
  readonly onJanela: (tipo: "pausar" | "encerrar" | "excluir") => void;
  readonly onRecarregar: () => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="beneficios__menu-botao"
        aria-label={`Ações de ${b.nome}`}
      >
        <IconeMaisAcoes tamanho={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onAbrir(b.id)}>
          Ver valores e pessoas
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onEditar(b.id)}>
          Editar configuração
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            try {
              const copia = await servico.duplicarBeneficio(b.id);
              onAbrirOutro(
                copia.id,
                "Benefício duplicado. Agora é só escolher quem recebe.",
              );
            } catch {
              onAviso("Não foi possível duplicar. Tente de novo.");
            }
          }}
        >
          Duplicar benefício
        </DropdownMenuItem>
        <RadixMenu.Separator className="beneficios__menu-divisor" />
        {b.situacao === "ativo" ? (
          <>
            <DropdownMenuItem onSelect={() => onJanela("pausar")}>
              Pausar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onJanela("encerrar")}>
              Encerrar
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            onSelect={async () => {
              await servico.reativarBeneficio(b.id);
              onAviso(`${b.nome} reativado.`);
              await onRecarregar();
            }}
          >
            Reativar
          </DropdownMenuItem>
        )}
        <RadixMenu.Separator className="beneficios__menu-divisor" />
        <DropdownMenuItem
          className="beneficios__menu-perigo"
          onSelect={() => onJanela("excluir")}
        >
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
