/**
 * T215 — Políticas de férias (como a referência, 2026-11-26): a página da
 * engrenagem da aba Férias e ausências.
 *
 * - **Lista:** quem fica sem política ("Ver pessoas"), a tabela (Política,
 *   Vale para, Principais regras, Quando não seguir) e o ⋯ de cada uma
 *   (Editar, Duplicar, Desativar ou Reativar — nada se apaga).
 * - **Assistente** de 6 etapas: Nome e quem entra, Direito e saldo, Pedido e
 *   períodos, Datas e equipe, Aprovação e Revisão; "Salvar rascunho".
 *
 * As regras só apontam o que não segue: o RH registra mesmo assim, com
 * motivo. Quem aprova pelo gestor e os pedidos do colaborador dependem do
 * Portal (ligação pendente): ficam gravados para quando ele existir, e a
 * tela diz isso. Além do saldo, nunca (o servidor recusa); o lembrete não
 * aparece, porque nada o usa ainda.
 */
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type {
  ListaDePoliticasApi,
  LinhaDePoliticaApi,
  PoliticaFeriasApi,
  PoliticaFeriasDto,
  RegrasDaPoliticaApi,
  TipoDeContratoDaPolitica,
} from "../../../../api/politicasFeriasClient";
import {
  Button,
  EmptyState,
  FormActions,
  StatusBadge,
} from "../../../../components";
import {
  CadastroEmEtapas,
  LinhaDoCadastro,
  SecaoDoCadastro,
} from "../../../../components/cadastro/CadastroEmEtapas";
import { diaCivilDeHoje, formatarDiaCivil } from "../../../../format/data";
import {
  Button as BotaoUi,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  ListaDeEscolha,
} from "../../../../ui";
import {
  IconeMais,
  IconeMaisAcoes,
  IconeRemover,
  IconeVoltar,
} from "../../../../ui/icones";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../../edicao/dadosProfissionais";
import { iniciaisDe } from "../../iniciais";
import type { ServicoDePoliticas, TipoDeAlvo } from "./servicoDePoliticas";
import "./PoliticasFeriasScreen.css";

export const POLITICAS_FERIAS_TITULO_ID = "politicas-ferias-titulo";

const TIPOS_DA_POLITICA: readonly TipoDeContratoDaPolitica[] = [
  "clt",
  "pj",
  "estagio",
  "aprendiz",
];

const rotuloDoContrato = (t: TipoDeContratoDaPolitica) =>
  (ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[t] ?? t;

const pessoas = (n: number) => (n === 1 ? "1 pessoa" : `${n} pessoas`);

const REGRAS_INICIAIS: RegrasDaPoliticaApi = {
  antecedenciaMinimaDias: null,
  antecedenciaMaximaMeses: null,
  alemDoSaldo: "nao_aceitar",
  duracaoMinimaDias: null,
  duracaoMaximaDias: null,
  periodosPorAno: null,
  periodoMaiorDias: null,
  intervaloDias: null,
  inicioNaoAntesDeDescanso: false,
  inicioNaoNoFimDeSemana: false,
  voltaNaoNaSexta: false,
  voltaNaoNaVespera: false,
  bloqueios: [],
  foraAoMesmoTempo: null,
};

/** "Fulano, Beltrano e mais 4 não entram em nenhuma política." */
function frasePessoasSemPolitica(
  nomes: readonly string[],
  total: number,
): string {
  const verbo = total === 1 ? "não entra" : "não entram";
  const fim = `${verbo} em nenhuma política. Para quem é CLT, valem só os pisos da lei, como aviso.`;
  if (total <= 3) {
    const lista =
      nomes.length === 1
        ? nomes[0]!
        : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
    return `${lista} ${fim}`;
  }
  return `${nomes.slice(0, 3).join(", ")} e mais ${total - 3} ${fim}`;
}

type Modo =
  | { tipo: "lista" }
  | {
      tipo: "editor";
      base: PoliticaFeriasApi | null;
      editandoId: string | null;
    };

export function PoliticasFeriasScreen({
  servico,
  podeEditar,
  onVoltar,
}: {
  readonly servico: ServicoDePoliticas;
  /** RH e DP criam e alteram; quem só lê vê a lista. */
  readonly podeEditar: boolean;
  readonly onVoltar: () => void;
}) {
  const [modo, setModo] = useState<Modo>({ tipo: "lista" });
  const [aviso, setAviso] = useState("");

  async function abrirEditor(id: string | null, duplicar: boolean) {
    if (!id) {
      setModo({ tipo: "editor", base: null, editandoId: null });
      return;
    }
    try {
      const p = await servico.obter(id);
      setModo({
        tipo: "editor",
        base: duplicar ? { ...p, nome: `${p.nome} (cópia)` } : p,
        editandoId: duplicar ? null : id,
      });
    } catch {
      setAviso("Não foi possível abrir a política. Tente de novo.");
    }
  }

  if (modo.tipo === "editor") {
    return (
      <EditorDePolitica
        servico={servico}
        base={modo.base}
        editandoId={modo.editandoId}
        onSair={(mensagem) => {
          setModo({ tipo: "lista" });
          if (mensagem) setAviso(mensagem);
        }}
      />
    );
  }
  return (
    <ListaDePoliticas
      servico={servico}
      podeEditar={podeEditar}
      onVoltar={onVoltar}
      aviso={aviso}
      onAviso={setAviso}
      onNova={() => void abrirEditor(null, false)}
      onEditar={(id) => void abrirEditor(id, false)}
      onDuplicar={(id) => void abrirEditor(id, true)}
    />
  );
}

function ListaDePoliticas({
  servico,
  podeEditar,
  onVoltar,
  aviso,
  onAviso,
  onNova,
  onEditar,
  onDuplicar,
}: {
  readonly servico: ServicoDePoliticas;
  readonly podeEditar: boolean;
  readonly onVoltar: () => void;
  readonly aviso: string;
  readonly onAviso: (texto: string) => void;
  readonly onNova: () => void;
  readonly onEditar: (id: string) => void;
  readonly onDuplicar: (id: string) => void;
}) {
  const [dados, setDados] = useState<ListaDePoliticasApi | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [verPessoas, setVerPessoas] = useState(false);
  const [aDesativar, setADesativar] = useState<LinhaDePoliticaApi | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDados(await servico.listar());
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [servico]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function mudar(linha: LinhaDePoliticaApi, ativar: boolean) {
    setTrabalhando(true);
    try {
      if (ativar) await servico.reativar(linha.id);
      else await servico.desativar(linha.id);
      setADesativar(null);
      onAviso(ativar ? "Política reativada." : "Política desativada.");
      await carregar();
    } catch {
      onAviso("Não foi possível concluir. Tente de novo.");
    } finally {
      setTrabalhando(false);
    }
  }

  const sem = dados?.semPolitica;

  return (
    <div className="politicas">
      <header className="politicas__cabecalho">
        <IconButton
          label="Voltar para Férias e ausências"
          icon={<IconeVoltar tamanho={18} />}
          onClick={onVoltar}
        />
        <div className="politicas__titulos">
          <h1 id={POLITICAS_FERIAS_TITULO_ID} className="politicas__titulo">
            Políticas de férias
          </h1>
          <p className="politicas__subtitulo">
            O Evolli confere estas regras em cada registro de férias do RH.
          </p>
        </div>
        {podeEditar ? (
          <Button onClick={onNova}>
            <IconeMais tamanho={18} />
            Nova política
          </Button>
        ) : null}
      </header>

      {aviso ? (
        <p className="politicas__aviso" role="status">
          {aviso}
        </p>
      ) : null}

      {falhou ? (
        <div className="politicas__falha" role="alert">
          <p>Não foi possível carregar as políticas.</p>
          <Button variant="secondary" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </div>
      ) : !dados ? (
        <p role="status" className="politicas__carregando">
          Carregando políticas…
        </p>
      ) : (
        <>
          {sem && sem.total > 0 ? (
            <section
              className="politicas__faixa"
              aria-label="Pessoas sem política de férias"
            >
              <span className="politicas__avatares" aria-hidden="true">
                {sem.pessoas.slice(0, 3).map((p) => (
                  <span key={p.id} className="politicas__avatar">
                    {iniciaisDe(p.nome)}
                  </span>
                ))}
              </span>
              <span className="politicas__faixa-textos">
                <strong className="politicas__faixa-titulo">
                  {`${pessoas(sem.total)} sem política de férias`}
                </strong>
                <span className="politicas__faixa-texto">
                  {frasePessoasSemPolitica(
                    sem.pessoas.map((p) => p.nome),
                    sem.total,
                  )}
                </span>
              </span>
              <Button variant="secondary" onClick={() => setVerPessoas(true)}>
                Ver pessoas
              </Button>
            </section>
          ) : null}

          {dados.politicas.length === 0 ? (
            <EmptyState
              headingLevel={2}
              title="Nenhuma política de férias"
              description="Crie a primeira para o sistema conferir os pedidos."
              {...(podeEditar
                ? {
                    action: (
                      <Button onClick={onNova}>
                        <IconeMais tamanho={18} />
                        Nova política
                      </Button>
                    ),
                  }
                : {})}
            />
          ) : (
            <div className="politicas__tabela-caixa">
              <table
                className="politicas__tabela"
                aria-label="Políticas de férias"
              >
                <thead>
                  <tr>
                    <th scope="col">Política</th>
                    <th scope="col">Vale para</th>
                    <th scope="col">Principais regras</th>
                    <th scope="col">Quando não seguir</th>
                    <th scope="col">
                      <span className="politicas__so-leitor">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.politicas.map((p) => (
                    <tr
                      key={p.id}
                      className={
                        p.ativa ? undefined : "politicas__linha--inativa"
                      }
                    >
                      <td>
                        <span className="politicas__nome">{p.nome}</span>
                        {!p.ativa ? (
                          <StatusBadge variant="neutral">Inativa</StatusBadge>
                        ) : p.rascunho ? (
                          <StatusBadge variant="info">Rascunho</StatusBadge>
                        ) : null}
                      </td>
                      <td>
                        <span className="politicas__duas-linhas">
                          <span>
                            {p.tiposVinculo.map(rotuloDoContrato).join(", ")}
                          </span>
                          <span className="politicas__suave">
                            {`${p.abrangencia === "todos" ? "Todas as pessoas" : "Algumas pessoas"} · ${pessoas(p.pessoas)}`}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="politicas__duas-linhas">
                          <span>{p.principaisRegras.primeira}</span>
                          {p.principaisRegras.segunda ? (
                            <span className="politicas__suave">
                              {p.principaisRegras.mais > 0
                                ? `${p.principaisRegras.segunda} · e mais ${p.principaisRegras.mais}`
                                : p.principaisRegras.segunda}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td>
                        <span className="politicas__quando">
                          <span
                            className={`politicas__ponto politicas__ponto--${p.foraDaPolitica}`}
                            aria-hidden="true"
                          />
                          <span className="politicas__duas-linhas">
                            <span>
                              {p.foraDaPolitica === "avisar"
                                ? "Avisa e deixa enviar"
                                : "Não deixa enviar"}
                            </span>
                            <span className="politicas__suave">
                              Quando o Portal existir
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {podeEditar ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="politicas__acoes"
                              aria-label={`Ações da política ${p.nome}`}
                            >
                              <IconeMaisAcoes tamanho={18} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onSelect={() => onEditar(p.id)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => onDuplicar(p.id)}
                              >
                                Duplicar
                              </DropdownMenuItem>
                              <RadixMenu.Separator className="politicas__menu-divisor" />
                              {p.ativa ? (
                                <DropdownMenuItem
                                  className="politicas__menu-perigo"
                                  onSelect={() => setADesativar(p)}
                                >
                                  Desativar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onSelect={() => void mudar(p, true)}
                                >
                                  Reativar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dados.politicas.length > 0 ? (
            <p className="politicas__rodape">
              {dados.politicas.length === 1
                ? "1 política"
                : `${dados.politicas.length} políticas`}
            </p>
          ) : null}
        </>
      )}

      <Dialog
        aberto={verPessoas}
        titulo="Pessoas sem política de férias"
        descricao='Para que entrem numa política, marque o contrato delas numa política ou escolha essas pessoas em "Só algumas pessoas".'
        onFechar={() => setVerPessoas(false)}
        rodape={
          <FormActions>
            <Button variant="secondary" onClick={() => setVerPessoas(false)}>
              Fechar
            </Button>
          </FormActions>
        }
      >
        <ul className="politicas__pessoas">
          {sem?.pessoas.map((p) => (
            <li key={p.id} className="politicas__pessoa">
              <span className="politicas__avatar" aria-hidden="true">
                {iniciaisDe(p.nome)}
              </span>
              <span className="politicas__pessoa-nome">{p.nome}</span>
              <span className="politicas__suave">
                {rotuloDoContrato(p.contrato)}
              </span>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        aberto={aDesativar !== null}
        titulo={aDesativar ? `Desativar a política ${aDesativar.nome}?` : ""}
        icone={<IconeRemover tamanho={20} />}
        descricao={
          aDesativar
            ? `${aDesativar.pessoas === 1 ? "1 pessoa fica" : `${aDesativar.pessoas} pessoas ficam`} sem política de férias, e os pedidos novos não passam mais por estas regras. Nada é apagado: dá para reativar depois.`
            : ""
        }
        onFechar={() => setADesativar(null)}
        bloqueado={trabalhando}
        rodape={
          <FormActions>
            <Button variant="secondary" onClick={() => setADesativar(null)}>
              Cancelar
            </Button>
            <BotaoUi
              type="button"
              variant="danger"
              disabled={trabalhando}
              onClick={() => aDesativar && void mudar(aDesativar, false)}
            >
              Desativar
            </BotaoUi>
          </FormActions>
        }
      >
        {null}
      </Dialog>
    </div>
  );
}

// ---- assistente ----------------------------------------------------------------

const ETAPAS = [
  {
    titulo: "Nome e quem entra",
    subtitulo: "Nome, contrato e pessoas",
    descricao: "Dê um nome à política e diga para quem ela vale.",
  },
  {
    titulo: "Direito e saldo",
    subtitulo: "Dias por ano e carência",
    descricao: "Quantos dias cada pessoa ganha e até quando pode usar.",
  },
  {
    titulo: "Pedido e períodos",
    subtitulo: "Antecedência e divisão",
    descricao: "Quando o pedido pode ser feito e como as férias se dividem.",
  },
  {
    titulo: "Datas e equipe",
    subtitulo: "Bloqueios e quem fica",
    descricao: "Datas que não podem e quantas pessoas podem sair juntas.",
  },
  {
    titulo: "Aprovação",
    subtitulo: "Quem aprova e avisos",
    descricao: "Quem responde aos pedidos e o que fazer fora da política.",
  },
  {
    titulo: "Revisão",
    subtitulo: "Conferir e salvar",
    descricao: "Confira as regras antes de salvar.",
  },
] as const;

/** Campo numérico opcional ("" = sem regra). */
const numero = (v: string): number | null => {
  const n = Number(v);
  return v.trim() === "" || !Number.isInteger(n) || n < 1 ? null : n;
};
const texto = (n: number | null) => (n === null ? "" : String(n));

function EditorDePolitica({
  servico,
  base,
  editandoId,
  onSair,
}: {
  readonly servico: ServicoDePoliticas;
  readonly base: PoliticaFeriasApi | null;
  readonly editandoId: string | null;
  readonly onSair: (mensagem?: string) => void;
}) {
  const id = useId();
  const [atual, setAtual] = useState(0);
  const [alcancada, setAlcancada] = useState(base ? ETAPAS.length - 1 : 0);
  const [nome, setNome] = useState(base?.nome ?? "");
  const [descricao, setDescricao] = useState(base?.descricao ?? "");
  const [textoColaborador, setTextoColaborador] = useState(
    base?.textoColaborador ?? "",
  );
  const [tipos, setTipos] = useState<TipoDeContratoDaPolitica[]>(
    base?.tiposVinculo ?? [],
  );
  const [abrangencia, setAbrangencia] = useState<"todos" | "algumas">(
    base?.abrangencia ?? "todos",
  );
  const [alvos, setAlvos] = useState<
    { tipo: TipoDeAlvo; id: string; nome: string }[]
  >(base?.alvos ?? []);
  const [porTipo, setPorTipo] = useState<TipoDeAlvo>("departamento");
  const [opcoes, setOpcoes] = useState<readonly { id: string; nome: string }[]>(
    [],
  );
  const [escolhido, setEscolhido] = useState("");
  const [valeAPartirDe, setValeAPartirDe] = useState(
    base?.valeAPartirDe ?? diaCivilDeHoje(),
  );
  const [regras, setRegras] = useState<RegrasDaPoliticaApi>(
    base?.regras ?? REGRAS_INICIAIS,
  );
  const [aprovacao, setAprovacao] = useState(
    base?.aprovacao ?? {
      quem: "rh" as const,
      lembreteDias: null,
      foraDaPolitica: "avisar" as const,
    },
  );
  const [falha, setFalha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (abrangencia !== "algumas") return;
    let vivo = true;
    servico.opcoesDeAlvo(porTipo).then(
      (o) => {
        if (vivo) setOpcoes(o);
      },
      () => {
        if (vivo) setOpcoes([]);
      },
    );
    return () => {
      vivo = false;
    };
  }, [abrangencia, porTipo, servico]);

  const regra = <K extends keyof RegrasDaPoliticaApi>(
    chave: K,
    valor: RegrasDaPoliticaApi[K],
  ) => setRegras((r) => ({ ...r, [chave]: valor }));

  const etapa1Ok =
    nome.trim() !== "" &&
    tipos.length > 0 &&
    valeAPartirDe !== "" &&
    (abrangencia === "todos" || alvos.length > 0);
  const soClt = tipos.length > 0 && tipos.every((t) => t === "clt");

  function dto(rascunho: boolean): PoliticaFeriasDto {
    return {
      nome: nome.trim(),
      ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
      ...(textoColaborador.trim()
        ? { textoColaborador: textoColaborador.trim() }
        : {}),
      tiposVinculo: tipos,
      abrangencia,
      alvos:
        abrangencia === "algumas"
          ? alvos.map((a) => ({ tipo: a.tipo, id: a.id }))
          : [],
      valeAPartirDe,
      // Além do saldo, o servidor sempre recusa: grava o que ele cumpre.
      regras: { ...regras, alemDoSaldo: "nao_aceitar" },
      aprovacao,
      rascunho,
    };
  }

  async function salvar(rascunho: boolean) {
    if (!etapa1Ok || salvando) return;
    setSalvando(true);
    setFalha(null);
    try {
      if (editandoId) await servico.alterar(editandoId, dto(rascunho));
      else await servico.criar(dto(rascunho));
      onSair(rascunho ? "Rascunho salvo." : "Política salva.");
    } catch (erro) {
      setFalha(mensagemDaRecusa(erro));
    } finally {
      setSalvando(false);
    }
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (atual === 0 && !etapa1Ok) {
      setFalha(
        "Preencha o nome, escolha ao menos um contrato e diga quem entra.",
      );
      return;
    }
    setFalha(null);
    if (atual === ETAPAS.length - 1) {
      void salvar(false);
      return;
    }
    const proxima = atual + 1;
    setAtual(proxima);
    setAlcancada((a) => Math.max(a, proxima));
  }

  const caixa = (
    rotulo: string,
    marcado: boolean,
    aoMudar: (v: boolean) => void,
  ) => (
    <label className="politicas__caixa">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
      />
      {rotulo}
    </label>
  );

  const campoNumero = (
    rotulo: string,
    valor: number | null,
    aoMudar: (v: number | null) => void,
  ) => (
    <input
      type="number"
      min={1}
      inputMode="numeric"
      aria-label={rotulo}
      className="politicas__numero"
      value={texto(valor)}
      onChange={(e) => aoMudar(numero(e.target.value))}
    />
  );

  const paineis = [
    // 1 — nome e quem entra
    <div key="1" className="politicas__etapa">
      <LinhaDoCadastro
        rotulo="Nome da política"
        ajuda="Aparece na tabela de políticas."
        paraId={`${id}-nome`}
      >
        <input
          id={`${id}-nome`}
          type="text"
          maxLength={120}
          placeholder="Ex.: Férias do administrativo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </LinhaDoCadastro>
      <LinhaDoCadastro
        rotulo="Descrição opcional"
        ajuda="Ajuda o RH a saber para que serve."
        paraId={`${id}-desc`}
      >
        <input
          id={`${id}-desc`}
          type="text"
          maxLength={300}
          placeholder="Ex.: Equipe do escritório"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </LinhaDoCadastro>
      <LinhaDoCadastro
        rotulo="Texto para o colaborador opcional"
        ajuda="Vai aparecer no pedido de férias do Portal, quando ele existir."
        paraId={`${id}-texto`}
      >
        <textarea
          id={`${id}-texto`}
          maxLength={2000}
          value={textoColaborador}
          onChange={(e) => setTextoColaborador(e.target.value)}
        />
        <span className="politicas__suave">{`${textoColaborador.length}/2000`}</span>
      </LinhaDoCadastro>
      <LinhaDoCadastro
        rotulo="Tipo de contrato"
        ajuda="Pode marcar mais de um."
      >
        <div className="politicas__caixas">
          {TIPOS_DA_POLITICA.map((t) =>
            caixa(rotuloDoContrato(t), tipos.includes(t), (v) =>
              setTipos((atuais) =>
                v ? [...atuais, t] : atuais.filter((x) => x !== t),
              ),
            ),
          )}
        </div>
      </LinhaDoCadastro>
      <LinhaDoCadastro
        rotulo="Quem entra"
        ajuda="Cada pessoa fica em uma política só."
      >
        <div
          role="radiogroup"
          aria-label="Quem entra"
          className="politicas__opcoes"
        >
          {(
            [
              [
                "todos",
                "Todas as pessoas com esse contrato",
                "Inclui quem for cadastrado depois.",
              ],
              [
                "algumas",
                "Só algumas pessoas",
                "Escolha por departamento, unidade ou pessoa.",
              ],
            ] as const
          ).map(([valor, titulo, ajuda]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={abrangencia === valor}
              className="politicas__opcao"
              onClick={() => setAbrangencia(valor)}
            >
              <span className="politicas__opcao-titulo">{titulo}</span>
              <span className="politicas__suave">{ajuda}</span>
            </button>
          ))}
        </div>
        {abrangencia === "algumas" ? (
          <div className="politicas__alvos">
            <div className="politicas__alvos-linha">
              <ListaDeEscolha
                aria-label="Por"
                valor={porTipo}
                opcoes={[
                  { valor: "departamento", rotulo: "Por: Departamento" },
                  { valor: "unidade", rotulo: "Por: Unidade" },
                  { valor: "pessoa", rotulo: "Por: Pessoa" },
                ]}
                onMudar={(v) => {
                  setPorTipo(v as TipoDeAlvo);
                  setEscolhido("");
                }}
              />
              <ListaDeEscolha
                aria-label="Escolha"
                vazio={
                  porTipo === "pessoa"
                    ? "Escolha a pessoa"
                    : porTipo === "unidade"
                      ? "Escolha a unidade"
                      : "Escolha o departamento"
                }
                valor={escolhido}
                opcoes={opcoes
                  .filter((o) => !alvos.some((a) => a.id === o.id))
                  .map((o) => ({ valor: o.id, rotulo: o.nome }))}
                onMudar={setEscolhido}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={escolhido === ""}
                onClick={() => {
                  const o = opcoes.find((x) => x.id === escolhido);
                  if (!o) return;
                  setAlvos((a) => [
                    ...a,
                    { tipo: porTipo, id: o.id, nome: o.nome },
                  ]);
                  setEscolhido("");
                }}
              >
                Adicionar
              </Button>
            </div>
            {alvos.length > 0 ? (
              <ul className="politicas__alvos-lista" aria-label="Quem entra">
                {alvos.map((a) => (
                  <li key={a.id} className="politicas__alvo">
                    {`${a.tipo === "pessoa" ? "Pessoa" : a.tipo === "unidade" ? "Unidade" : "Departamento"}: ${a.nome}`}
                    <button
                      type="button"
                      className="politicas__alvo-remover"
                      aria-label={`Tirar ${a.nome}`}
                      onClick={() =>
                        setAlvos((xs) => xs.filter((x) => x.id !== a.id))
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <p className="politicas__suave">
          Se alguém entrar em duas políticas, vale a escolha mais específica:
          pessoa, depois departamento ou unidade, e por último o contrato.
        </p>
      </LinhaDoCadastro>
      <LinhaDoCadastro
        rotulo="Vale a partir de"
        ajuda="Pedidos e registros anteriores não mudam."
        paraId={`${id}-data`}
      >
        <input
          id={`${id}-data`}
          type="date"
          value={valeAPartirDe}
          onChange={(e) => setValeAPartirDe(e.target.value)}
        />
      </LinhaDoCadastro>
    </div>,

    // 2 — direito e saldo
    <div key="2" className="politicas__etapa">
      <p className="politicas__nota">
        {soClt
          ? "Esta política é só para CLT, então esta etapa não se aplica: o direito segue a lei, 30 dias a cada 12 meses, menos as faltas sem justificativa (art. 130). Siga para a próxima etapa."
          : "CLT e Estágio seguem a lei (30 dias a cada 12 meses). Para os demais contratos, o Evolli ainda não calcula o saldo: a política vale só para conferir os pedidos."}
      </p>
    </div>,

    // 3 — pedido e períodos
    <div key="3" className="politicas__etapa">
      <SecaoDoCadastro titulo="Pedido" descricao="">
        <LinhaDoCadastro
          rotulo="Antecedência mínima opcional"
          ajuda="Dias corridos antes do início."
        >
          <span className="politicas__com-sufixo">
            {campoNumero(
              "Antecedência mínima em dias",
              regras.antecedenciaMinimaDias,
              (v) => regra("antecedenciaMinimaDias", v),
            )}
            dias antes do início
          </span>
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Antecedência máxima opcional"
          ajuda="Evita pedido para muito longe."
        >
          <span className="politicas__com-sufixo">
            até
            {campoNumero(
              "Antecedência máxima em meses",
              regras.antecedenciaMaximaMeses,
              (v) => regra("antecedenciaMaximaMeses", v),
            )}
            meses antes do início
          </span>
        </LinhaDoCadastro>
        <LinhaDoCadastro rotulo="Pedido além do saldo">
          <p className="politicas__nota">
            Não aceita. O Evolli não registra férias além do saldo do período
            (CLT).
          </p>
        </LinhaDoCadastro>
      </SecaoDoCadastro>
      <SecaoDoCadastro titulo="Divisão em períodos" descricao="">
        <LinhaDoCadastro
          rotulo="Duração de cada período opcional"
          ajuda="Dias corridos."
        >
          <span className="politicas__com-sufixo">
            de
            {campoNumero(
              "Duração mínima em dias",
              regras.duracaoMinimaDias,
              (v) => regra("duracaoMinimaDias", v),
            )}
            a
            {campoNumero(
              "Duração máxima em dias",
              regras.duracaoMaximaDias,
              (v) => regra("duracaoMaximaDias", v),
            )}
            dias
          </span>
        </LinhaDoCadastro>
        <LinhaDoCadastro rotulo="Períodos por ano opcional">
          <span className="politicas__com-sufixo">
            até
            {campoNumero("Períodos por ano", regras.periodosPorAno, (v) =>
              regra("periodosPorAno", v),
            )}
            períodos
          </span>
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Um período maior opcional"
          ajuda="Exige que um dos períodos seja longo."
        >
          <span className="politicas__com-sufixo">
            um deles com pelo menos
            {campoNumero(
              "Dias do período maior",
              regras.periodoMaiorDias,
              (v) => regra("periodoMaiorDias", v),
            )}
            dias
          </span>
        </LinhaDoCadastro>
        <LinhaDoCadastro rotulo="Intervalo entre períodos opcional">
          <span className="politicas__com-sufixo">
            {campoNumero("Intervalo em dias", regras.intervaloDias, (v) =>
              regra("intervaloDias", v),
            )}
            dias entre o fim de um e o início do outro
          </span>
        </LinhaDoCadastro>
        {tipos.includes("clt") ? (
          <p className="politicas__nota">
            Em CLT, a lei vale por cima: até 3 períodos, um com 14 dias ou mais
            e os outros com 5 ou mais (art. 134, § 1º).
          </p>
        ) : null}
      </SecaoDoCadastro>
    </div>,

    // 4 — datas e equipe
    <div key="4" className="politicas__etapa">
      <SecaoDoCadastro titulo="Datas" descricao="">
        <LinhaDoCadastro rotulo="O início não pode cair opcional">
          <div className="politicas__caixas politicas__caixas--coluna">
            {caixa(
              "Nos 2 dias antes de feriado ou folga",
              regras.inicioNaoAntesDeDescanso,
              (v) => regra("inicioNaoAntesDeDescanso", v),
            )}
            {caixa(
              "Em sábado, domingo ou feriado",
              regras.inicioNaoNoFimDeSemana,
              (v) => regra("inicioNaoNoFimDeSemana", v),
            )}
          </div>
          {tipos.includes("clt") ? (
            <p className="politicas__suave">
              Em CLT, a primeira regra já vale pela lei (art. 134, § 3º).
            </p>
          ) : null}
        </LinhaDoCadastro>
        <LinhaDoCadastro rotulo="A volta não pode cair opcional">
          <div className="politicas__caixas politicas__caixas--coluna">
            {caixa("Em sexta-feira", regras.voltaNaoNaSexta, (v) =>
              regra("voltaNaoNaSexta", v),
            )}
            {caixa("Em véspera de feriado", regras.voltaNaoNaVespera, (v) =>
              regra("voltaNaoNaVespera", v),
            )}
          </div>
          <p className="politicas__suave">
            Feriados nacionais. A volta é o primeiro dia útil depois do
            descanso.
          </p>
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Períodos bloqueados opcional"
          ajuda="Ninguém tira descanso nessas datas, como fechamento do ano ou inventário."
        >
          <div className="politicas__bloqueios">
            {regras.bloqueios.map((b, i) => (
              <div key={i} className="politicas__bloqueio">
                <input
                  type="text"
                  aria-label={`Nome do bloqueio ${i + 1}`}
                  placeholder="Ex.: Fechamento do ano"
                  maxLength={80}
                  value={b.nome}
                  onChange={(e) =>
                    regra(
                      "bloqueios",
                      regras.bloqueios.map((x, j) =>
                        j === i ? { ...x, nome: e.target.value } : x,
                      ),
                    )
                  }
                />
                <input
                  type="date"
                  aria-label={`Início do bloqueio ${i + 1}`}
                  value={b.inicio}
                  onChange={(e) =>
                    regra(
                      "bloqueios",
                      regras.bloqueios.map((x, j) =>
                        j === i ? { ...x, inicio: e.target.value } : x,
                      ),
                    )
                  }
                />
                <input
                  type="date"
                  aria-label={`Fim do bloqueio ${i + 1}`}
                  value={b.fim}
                  onChange={(e) =>
                    regra(
                      "bloqueios",
                      regras.bloqueios.map((x, j) =>
                        j === i ? { ...x, fim: e.target.value } : x,
                      ),
                    )
                  }
                />
                {caixa("Todo ano", b.todoAno, (v) =>
                  regra(
                    "bloqueios",
                    regras.bloqueios.map((x, j) =>
                      j === i ? { ...x, todoAno: v } : x,
                    ),
                  ),
                )}
                <IconButton
                  label={`Tirar o bloqueio ${i + 1}`}
                  icon={<IconeRemover tamanho={16} />}
                  variant="subtle"
                  onClick={() =>
                    regra(
                      "bloqueios",
                      regras.bloqueios.filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                regra("bloqueios", [
                  ...regras.bloqueios,
                  { nome: "", inicio: "", fim: "", todoAno: false },
                ])
              }
            >
              <IconeMais tamanho={16} />
              Adicionar período
            </Button>
            <p className="politicas__suave">
              Com "Todo ano", o bloqueio se repete sem precisar cadastrar de
              novo. Pedido que encosta no bloqueio aparece como fora da
              política.
            </p>
          </div>
        </LinhaDoCadastro>
      </SecaoDoCadastro>
      <SecaoDoCadastro titulo="Equipe" descricao="">
        <LinhaDoCadastro
          rotulo="Fora ao mesmo tempo opcional"
          ajuda="Conta pedidos aprovados e em análise."
        >
          <span className="politicas__com-sufixo">
            até
            {campoNumero(
              "Pessoas fora ao mesmo tempo",
              regras.foraAoMesmoTempo,
              (v) => regra("foraAoMesmoTempo", v),
            )}
            pessoas do mesmo departamento
          </span>
        </LinhaDoCadastro>
      </SecaoDoCadastro>
    </div>,

    // 5 — aprovação
    <div key="5" className="politicas__etapa">
      <LinhaDoCadastro rotulo="Quem aprova">
        <div
          role="radiogroup"
          aria-label="Quem aprova"
          className="politicas__opcoes"
        >
          {(
            [
              ["rh", "RH", "RH e DP da empresa, como hoje."],
              [
                "gestor_rh",
                "Gestor direto e depois o RH",
                "Quando o Portal existir.",
              ],
              ["gestor", "Só o gestor direto", "Quando o Portal existir."],
            ] as const
          ).map(([valor, titulo, ajuda]) => {
            // Sem o Portal, o gestor não responde: só o RH aprova hoje.
            const semPortal = valor !== "rh";
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={aprovacao.quem === valor}
                disabled={semPortal}
                className="politicas__opcao"
                onClick={() => setAprovacao((a) => ({ ...a, quem: valor }))}
              >
                <span className="politicas__opcao-titulo">{titulo}</span>
                <span className="politicas__suave">{ajuda}</span>
              </button>
            );
          })}
        </div>
      </LinhaDoCadastro>
      <LinhaDoCadastro
        rotulo="Pedido do colaborador fora da política"
        ajuda="Vale para os pedidos do colaborador, quando o Portal existir. Hoje, o RH registra com motivo."
      >
        <div
          role="radiogroup"
          aria-label="Pedido fora da política"
          className="politicas__opcoes"
        >
          {(
            [
              [
                "avisar",
                "Avisar e deixar enviar",
                "No Portal, o colaborador verá o que não segue, e quem aprova decide.",
              ],
              [
                "bloquear",
                "Não deixar enviar",
                "No Portal, o pedido só irá se seguir todas as regras.",
              ],
            ] as const
          ).map(([valor, titulo, ajuda]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={aprovacao.foraDaPolitica === valor}
              className="politicas__opcao"
              onClick={() =>
                setAprovacao((a) => ({ ...a, foraDaPolitica: valor }))
              }
            >
              <span className="politicas__opcao-titulo">{titulo}</span>
              <span className="politicas__suave">{ajuda}</span>
            </button>
          ))}
        </div>
      </LinhaDoCadastro>
      <LinhaDoCadastro rotulo="Registro pelo RH">
        <p className="politicas__nota">
          O RH sempre vê o que não segue a política e pode registrar mesmo
          assim, informando o motivo. O motivo fica no histórico da ausência.
        </p>
      </LinhaDoCadastro>
    </div>,

    // 6 — revisão
    <div key="6" className="politicas__etapa">
      <Revisao
        nome={nome}
        tipos={tipos}
        abrangencia={abrangencia}
        alvos={alvos}
        valeAPartirDe={valeAPartirDe}
        textoColaborador={textoColaborador}
        regras={regras}
        aprovacao={aprovacao}
        onEditar={(i) => setAtual(i)}
      />
    </div>,
  ];

  return (
    <CadastroEmEtapas
      tituloId={POLITICAS_FERIAS_TITULO_ID}
      titulo={
        editandoId ? "Editar política de férias" : "Nova política de férias"
      }
      descricao="O Evolli confere estas regras em cada registro de férias do RH."
      rotuloVoltar="Voltar para Políticas de férias"
      onVoltarDaPagina={() => onSair()}
      acaoDoCabecalho={
        <Button
          type="button"
          variant="secondary"
          disabled={!etapa1Ok || salvando}
          onClick={() => void salvar(true)}
        >
          Salvar rascunho
        </Button>
      }
      etapas={ETAPAS}
      atual={atual}
      alcancada={alcancada}
      onIrParaEtapa={setAtual}
      onSubmit={aoEnviar}
      rotuloConcluir="Salvar política"
      ocupado={salvando}
      paineis={paineis}
      mensagem={
        falha ? (
          <p className="politicas__falha" role="alert">
            {falha}
          </p>
        ) : null
      }
      rotuloDoFormulario={
        editandoId ? "Editar política de férias" : "Nova política de férias"
      }
    />
  );
}

/** A 6ª etapa: cada bloco com o resumo e o "Editar" (volta à etapa). */
function Revisao({
  nome,
  tipos,
  abrangencia,
  alvos,
  valeAPartirDe,
  textoColaborador,
  regras: r,
  aprovacao,
  onEditar,
}: {
  readonly nome: string;
  readonly tipos: readonly TipoDeContratoDaPolitica[];
  readonly abrangencia: "todos" | "algumas";
  readonly alvos: readonly { tipo: TipoDeAlvo; nome: string }[];
  readonly valeAPartirDe: string;
  readonly textoColaborador: string;
  readonly regras: RegrasDaPoliticaApi;
  readonly aprovacao: PoliticaFeriasDto["aprovacao"];
  readonly onEditar: (etapa: number) => void;
}) {
  const bloco = (
    titulo: string,
    etapa: number,
    itens: readonly [string, string][],
  ) => (
    <section className="politicas__revisao-bloco" aria-label={titulo}>
      <header className="politicas__revisao-cabeca">
        <h3 className="politicas__revisao-titulo">{titulo}</h3>
        <Button type="button" variant="subtle" onClick={() => onEditar(etapa)}>
          Editar
        </Button>
      </header>
      <dl className="politicas__revisao-lista">
        {itens.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
  const ou = (v: number | null, f: (n: number) => string, nada: string) =>
    v === null ? nada : f(v);
  return (
    <div className="politicas__revisao">
      {bloco(nome || "Sem nome", 0, [
        ["Tipo de contrato", tipos.map(rotuloDoContrato).join(", ") || "—"],
        [
          "Quem entra",
          abrangencia === "todos"
            ? `Todas as pessoas com contrato ${tipos.map(rotuloDoContrato).join(", ")}`
            : alvos.map((a) => a.nome).join(", ") || "—",
        ],
        ["Vale a partir de", formatarDiaCivil(valeAPartirDe)],
        [
          "Texto para o colaborador",
          textoColaborador.trim() ? "Com texto" : "Sem texto",
        ],
      ])}
      {bloco("Direito e saldo", 1, [
        ["Direito", "Segue a lei: 30 dias a cada 12 meses (art. 130)"],
      ])}
      {bloco("Pedido e períodos", 2, [
        [
          "Antecedência",
          ou(
            r.antecedenciaMinimaDias,
            (n) => `${n} ${n === 1 ? "dia" : "dias"}, no mínimo`,
            "Sem mínimo",
          ),
        ],
        [
          "Antecedência máxima",
          ou(
            r.antecedenciaMaximaMeses,
            (n) => `Até ${n} ${n === 1 ? "mês" : "meses"} antes`,
            "Sem limite máximo",
          ),
        ],
        [
          "Duração de cada período",
          textoDaDuracao(r.duracaoMinimaDias, r.duracaoMaximaDias),
        ],
        [
          "Divisão",
          ou(
            r.periodosPorAno,
            (n) => `até ${n} ${n === 1 ? "período" : "períodos"} por ano`,
            "Sem limite de períodos",
          ),
        ],
        ["Pedido além do saldo", "Não aceita (a CLT não deixa)"],
      ])}
      {bloco("Datas e equipe", 3, [
        [
          "O início não pode cair",
          [
            r.inicioNaoAntesDeDescanso
              ? "Nos 2 dias antes de feriado ou folga"
              : null,
            r.inicioNaoNoFimDeSemana ? "Em sábado, domingo ou feriado" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Sem regra",
        ],
        [
          "A volta não pode cair",
          [
            r.voltaNaoNaSexta ? "Em sexta-feira" : null,
            r.voltaNaoNaVespera ? "Em véspera de feriado" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Sem regra",
        ],
        [
          "Períodos bloqueados",
          r.bloqueios.length === 0
            ? "Nenhum"
            : r.bloqueios
                .map(
                  (b) =>
                    `${b.nome || "Sem nome"} (${formatarDiaCivil(b.inicio)} a ${formatarDiaCivil(b.fim)})`,
                )
                .join(" · "),
        ],
        [
          "Fora ao mesmo tempo",
          ou(
            r.foraAoMesmoTempo,
            (n) => `Até ${n} por departamento`,
            "Sem limite",
          ),
        ],
      ])}
      {bloco("Aprovação", 4, [
        [
          "Quem aprova",
          aprovacao.quem === "rh"
            ? "RH"
            : aprovacao.quem === "gestor_rh"
              ? "Gestor direto e depois o RH (quando o Portal existir)"
              : "Só o gestor direto (quando o Portal existir)",
        ],
        [
          "Pedido do colaborador fora da política",
          `${
            aprovacao.foraDaPolitica === "avisar"
              ? "Avisa e deixa enviar"
              : "Não deixa enviar"
          } (quando o Portal existir)`,
        ],
        ["Registro pelo RH", "O RH registra com motivo"],
      ])}
      <p className="politicas__nota">
        {`Ao salvar, a política passa a valer em ${formatarDiaCivil(valeAPartirDe)}. Os registros daí em diante passam a mostrar o que não segue a política.`}
      </p>
    </div>
  );
}

/** A recusa do servidor ao salvar, na voz da tela (sem repetir valor). */
function mensagemDaRecusa(erro: unknown): string {
  const primeiro = (
    erro as { erros?: readonly { campo: string; motivo: string }[] }
  ).erros?.[0];
  switch (`${primeiro?.campo}:${primeiro?.motivo}`) {
    case "regras.bloqueios:fim_antes_do_inicio":
      return "Um período bloqueado termina antes de começar. Confira as datas ou marque Todo ano.";
    case "regras.duracaoMaximaDias:fora_de_ordem":
      return "A duração mínima de cada período passa da máxima.";
    case "alvos:indisponivel":
      return "Algum departamento, unidade ou pessoa não é desta empresa. Escolha de novo.";
    default:
      return "Não foi possível salvar a política. Confira e tente de novo.";
  }
}

/** A duração de cada período na revisão: os dois limites, só um ou nenhum. */
function textoDaDuracao(min: number | null, max: number | null): string {
  const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
  if (min !== null && max !== null) return `De ${min} a ${max} dias`;
  if (min !== null) return `${dias(min)} ou mais`;
  if (max !== null) return `Até ${dias(max)}`;
  return "Sem regra";
}
