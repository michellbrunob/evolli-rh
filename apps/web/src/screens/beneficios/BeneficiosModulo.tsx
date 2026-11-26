/**
 * T215 — módulo Benefícios (Remuneração › Benefícios), como a referência
 * (2026-11-26): a lista por competência (Ativos, Pausados, Encerrados), o
 * assistente "Novo benefício", o detalhe de cada benefício (pessoas e
 * valores do mês, histórico) e a página "Adicionar pessoas".
 *
 * As subtelas vivem dentro do módulo (a rota é `#/beneficios`); abrir a
 * ficha de alguém usa a rota da ficha.
 */
import { useCallback, useEffect, useState } from "react";
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type {
  BeneficioApi,
  ListaDeBeneficiosApi,
  LinhaDeBeneficioApi,
  SituacaoBeneficio,
} from "../../api/beneficiosClient";
import { Button } from "../../components";
import {
  formatarCompetenciaPorExtenso,
  formatarMesReferencia,
} from "../../format/data";
import { formatarCentavos } from "../../format/moeda";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui";
import {
  IconeBeneficios,
  IconeInformacao,
  IconeMais,
  IconeMaisAcoes,
} from "../../ui/icones";
import {
  competenciaDoMesAtual,
  competenciaVizinha,
} from "../../app/rotasDoShell";
import { AdicionarPessoasDoBeneficio } from "./AdicionarPessoasDoBeneficio";
import { AssistenteDeBeneficio } from "./AssistenteDeBeneficio";
import { DetalheDoBeneficio, JanelaDeSituacao } from "./DetalheDoBeneficio";
import type { ServicoDeBeneficios } from "./servicoDeBeneficios";
import { CATEGORIAS, ICONE_DA_CATEGORIA } from "./textosDosBeneficios";
import "./Beneficios.css";

export const BENEFICIOS_TITULO_ID = "beneficios-titulo";

type Tela =
  | { readonly tipo: "lista" }
  | { readonly tipo: "novo" }
  | { readonly tipo: "detalhe"; readonly id: string }
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
  if (tela.tipo === "detalhe") {
    return (
      <DetalheDoBeneficio
        key={tela.id}
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
}) {
  const [dados, setDados] = useState<ListaDeBeneficiosApi | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aba, setAba] = useState<SituacaoBeneficio>("ativo");
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
  const opcoesDeMes = [-3, -2, -1, 0, 1, 2, 3].map((d) =>
    competenciaVizinha(competenciaDoMesAtual(), d),
  );

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
            <select
              className="beneficios__mes"
              aria-label="Competência"
              value={competencia}
              onChange={(e) => onCompetencia(e.target.value)}
            >
              {opcoesDeMes.map((c) => (
                <option key={c} value={c}>
                  {formatarMesReferencia(c)}
                </option>
              ))}
            </select>
            {podeEditar ? (
              <Button onClick={onNovo}>
                <IconeMais tamanho={18} />
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
        <p role="status" className="beneficios__suave">
          Carregando benefícios…
        </p>
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
                <IconeMais tamanho={18} />
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
            <p className="beneficios__suave beneficios__sem-linhas">
              {aba === "pausado"
                ? "Nenhum benefício pausado."
                : aba === "encerrado"
                  ? "Nenhum benefício encerrado."
                  : "Nenhum benefício ativo."}
            </p>
          ) : (
            <div className="beneficios__tabela-caixa">
              <table className="beneficios__tabela" aria-label="Benefícios">
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
                        <td className="beneficios__numero">{b.pessoas}</td>
                        <td className="beneficios__numero beneficios__forte">
                          {formatarCentavos(b.empresa)}
                        </td>
                        <td className="beneficios__numero">
                          {formatarCentavos(b.desconto)}
                        </td>
                        <td className="beneficios__acoes-linha">
                          <Button
                            variant="secondary"
                            onClick={() => onAbrir(b.id)}
                          >
                            Ver mais
                          </Button>
                          {podeEditar ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="beneficios__menu-botao"
                                aria-label={`Ações de ${b.nome}`}
                              >
                                <IconeMaisAcoes tamanho={18} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onSelect={() => onAbrir(b.id)}
                                >
                                  Ver valores e pessoas
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => void onEditar(b.id)}
                                >
                                  Editar configuração
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={async () => {
                                    try {
                                      const copia =
                                        await servico.duplicarBeneficio(b.id);
                                      onAbrirOutro(
                                        copia.id,
                                        "Benefício duplicado. Agora é só escolher quem recebe.",
                                      );
                                    } catch {
                                      onAviso(
                                        "Não foi possível duplicar. Tente de novo.",
                                      );
                                    }
                                  }}
                                >
                                  Duplicar benefício
                                </DropdownMenuItem>
                                <RadixMenu.Separator className="beneficios__menu-divisor" />
                                {b.situacao === "ativo" ? (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        setJanela({ tipo: "pausar", linha: b })
                                      }
                                    >
                                      Pausar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        setJanela({
                                          tipo: "encerrar",
                                          linha: b,
                                        })
                                      }
                                    >
                                      Encerrar
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <DropdownMenuItem
                                    onSelect={async () => {
                                      await servico.reativarBeneficio(b.id);
                                      onAviso(`${b.nome} reativado.`);
                                      await carregar();
                                    }}
                                  >
                                    Reativar
                                  </DropdownMenuItem>
                                )}
                                <RadixMenu.Separator className="beneficios__menu-divisor" />
                                <DropdownMenuItem
                                  className="beneficios__menu-perigo"
                                  onSelect={() =>
                                    setJanela({ tipo: "excluir", linha: b })
                                  }
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="beneficios__nota-linha">
            <IconeInformacao tamanho={14} />
            {`Custos de ${formatarCompetenciaPorExtenso(competencia)}. Clique em um benefício para ver como é calculado e o valor de cada pessoa.`}
          </p>
        </>
      )}

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
