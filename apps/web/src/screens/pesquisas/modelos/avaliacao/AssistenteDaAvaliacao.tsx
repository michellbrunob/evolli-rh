/**
 * T216 — assistente da Avaliação 90° e 180° (3 etapas na horizontal):
 * Configurar (nome, mensagem, competências fixas, comentários, quem vê o
 * quê) → Gestores e times (pelo organograma da liderança, ou à mão) →
 * Prazo e envio (prazos, lembretes, como os gestores recebem e o resumo).
 *
 * O rascunho é gravado ao sair da 1ª etapa; ao concluir, a avaliação grava
 * os times e a configuração e é publicada. O Evolli ainda não envia e-mail:
 * os convites ficam "aguardando e-mail" e o RH manda o link.
 */
import { useEffect, useId, useMemo, useState } from "react";
import type { PesquisaDetalhe } from "../../../../api/pesquisasClient";
import { Button } from "../../../../components";
import { plural } from "../../../../format/plural";
import { IconButton } from "../../../../ui";
import {
  IconeFechar,
  IconeMais,
  IconeVoltar,
} from "../../../../ui/icones";
import { Esqueleto } from "../../../../ui/movimento";
import {
  Avatar,
  BarraDeEtapas,
  CampoDeBusca,
  CartaoDeSecao,
  iniciaisDe,
} from "../../componentes";
import type { ServicoDePesquisas } from "../../servicoDePesquisas";
import { CampoDoLink } from "../../TelaDeGerada";
import { PESQUISAS_TITULO_ID } from "../../tituloDasPesquisas";
import {
  CATALOGO,
  MENSAGEM_PADRAO,
  REGRAS_DE_COMENTARIOS,
  nomePadrao,
  secoesDaAvaliacao,
  type ModeloDeAvaliacao,
  type RegraDeComentarios,
} from "./catalogo";
import type {
  ClienteDaAvaliacao,
  Lembrete,
  Organograma,
  PessoaResumida,
} from "./cliente";
import {
  ROTULO_DO_LEMBRETE,
  candidatosAoTime,
  contar,
  diaMes,
  erroDoNome,
  erroDoPrazo,
  erroDoPrazoDaAutoavaliacao,
  instante,
  legendaDoPrazo,
  somarDias,
  textoDaContagem,
  textoDosLembretes,
  timesDoOrganograma,
  timesParaEnviar,
  type TimeNoAssistente,
} from "./regrasDoAssistente";
import "../modelos.css";

const ETAPAS: Readonly<
  Record<ModeloDeAvaliacao, readonly { titulo: string; subtitulo: string }[]>
> = {
  avaliacao90: [
    { titulo: "Configurar", subtitulo: "Nome e competências" },
    { titulo: "Gestores e times", subtitulo: "Quem avalia quem" },
    { titulo: "Prazo e envio", subtitulo: "Data limite e convite" },
  ],
  avaliacao180: [
    { titulo: "Configurar", subtitulo: "Nome e competências" },
    { titulo: "Gestores e times", subtitulo: "Quem avalia e se avalia" },
    { titulo: "Prazo e envio", subtitulo: "Prazos e convites" },
  ],
};

const LEMBRETES: readonly Lembrete[] = ["7_dias", "3_dias", "no_dia", "depois"];

export type ServicoDoAssistente = Pick<
  ServicoDePesquisas,
  "criarPesquisa" | "alterarPesquisa" | "publicarPesquisa"
>;

interface Props {
  readonly modelo: ModeloDeAvaliacao;
  readonly servico: ServicoDoAssistente;
  readonly cliente: Pick<ClienteDaAvaliacao, "organograma" | "salvar">;
  readonly hoje: string;
  readonly agora?: () => Date;
  readonly onVoltar: () => void;
  readonly onAcompanhar: (pesquisaId: string) => void;
}

export function AssistenteDaAvaliacao({
  modelo,
  servico,
  cliente,
  hoje,
  agora = () => new Date(),
  onVoltar,
  onAcompanhar,
}: Props) {
  const ids = useId();
  const e180 = modelo === "avaliacao180";
  const etapas = ETAPAS[modelo];
  const [etapa, setEtapa] = useState(0);
  const [rascunho, setRascunho] = useState<PesquisaDetalhe | null>(null);
  const [salvoAs, setSalvoAs] = useState<string | null>(null);
  const [gerada, setGerada] = useState<{
    pesquisa: PesquisaDetalhe;
    gestores: number;
    pessoas: number;
    lembretes: number;
  } | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);

  // 1. Configurar
  const [nome, setNome] = useState(() => nomePadrao(modelo, hoje));
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO[modelo]);
  const [comentarios, setComentarios] =
    useState<RegraDeComentarios>("extremos");
  const [visibilidade, setVisibilidade] = useState<
    "depois_do_gestor" | "so_rh"
  >("depois_do_gestor");
  const [liberar, setLiberar] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);

  // 2. Gestores e times
  const [org, setOrg] = useState<Organograma | null>(null);
  const [falhaOrg, setFalhaOrg] = useState(false);
  const [modo, setModo] = useState<"organograma" | "manual">("organograma");
  const [timesOrg, setTimesOrg] = useState<TimeNoAssistente[]>([]);
  const [timesManuais, setTimesManuais] = useState<TimeNoAssistente[]>([]);
  const [deFora, setDeFora] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [erroTimes, setErroTimes] = useState<string | null>(null);

  // 3. Prazo e envio
  const [prazoDia, setPrazoDia] = useState(() => somarDias(hoje, 30));
  const [prazoHora, setPrazoHora] = useState("23:59");
  const [autoAntes, setAutoAntes] = useState(false);
  const [autoDia, setAutoDia] = useState(() => somarDias(hoje, 23));
  const [autoHora, setAutoHora] = useState("23:59");
  const [lembrar, setLembrar] = useState(true);
  const [lembretes, setLembretes] = useState<Lembrete[]>([
    "7_dias",
    "3_dias",
    "no_dia",
  ]);
  const [envio, setEnvio] = useState<"email" | "link">("email");
  const [errosPrazo, setErrosPrazo] = useState<{
    prazo?: string | null;
    auto?: string | null;
  }>({});

  useEffect(() => {
    let vivo = true;
    cliente
      .organograma()
      .then((o) => {
        if (!vivo) return;
        setOrg(o);
        setTimesOrg(timesDoOrganograma(o));
      })
      .catch(() => vivo && setFalhaOrg(true));
    return () => {
      vivo = false;
    };
  }, [cliente]);

  const times = modo === "organograma" ? timesOrg : timesManuais;
  const setTimes = modo === "organograma" ? setTimesOrg : setTimesManuais;
  const contagem = useMemo(() => contar(modelo, times), [modelo, times]);
  const gestoresSemCpf = useMemo(
    () =>
      new Set(
        (org?.semGestor ?? [])
          .filter((s) => s.motivo === "gestor_sem_cpf")
          .map((s) => s.gestorNome ?? ""),
      ).size,
    [org],
  );
  const semGestor = useMemo(() => {
    const ja = new Set(times.flatMap((t) => t.pessoas.map((p) => p.id)));
    return (org?.semGestor ?? []).filter(
      (s) => !ja.has(s.pessoa.id) && !deFora.has(s.pessoa.id),
    );
  }, [org, times, deFora]);

  const hora = () =>
    agora().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function entradaDaPesquisa(encerraEm: string | null) {
    return {
      nome: nome.trim(),
      boasVindas: mensagem.trim() || null,
      modelo,
      identificacao: "identificada" as const,
      secoes: secoesDaAvaliacao(),
      participantes: { todos: false as const, colaboradorIds: [] },
      separarPor: [],
      encerraEm,
      minimoPorGrupo: 3,
    };
  }

  async function gravarRascunho(): Promise<PesquisaDetalhe | null> {
    try {
      const d = rascunho
        ? await servico.alterarPesquisa(rascunho.id, entradaDaPesquisa(null))
        : await servico.criarPesquisa(entradaDaPesquisa(null));
      setRascunho(d);
      setSalvoAs(hora());
      return d;
    } catch {
      setFalha("Não foi possível salvar o rascunho. Tente de novo.");
      return null;
    }
  }

  async function avancar() {
    setFalha(null);
    if (etapa === 0) {
      const e = erroDoNome(nome);
      setErroNome(e);
      if (e) return;
      if (!(await gravarRascunho())) return;
      setEtapa(1);
      return;
    }
    if (etapa === 1) {
      if (org && org.ativos.length === 0) {
        setErroTimes("Não há colaboradores ativos para avaliar.");
        return;
      }
      if (contagem.gestores === 0) {
        setErroTimes("Escolha pelo menos um gestor com uma pessoa no time.");
        return;
      }
      setErroTimes(null);
      setEtapa(2);
      return;
    }
    await criar();
  }

  async function criar() {
    const prazo = erroDoPrazo(prazoDia, prazoHora, agora());
    const prazoGestor = instante(prazoDia, prazoHora);
    const auto =
      e180 && autoAntes
        ? erroDoPrazoDaAutoavaliacao(autoDia, autoHora, prazoGestor, agora())
        : null;
    setErrosPrazo({ prazo, auto });
    if (prazo || auto) return;
    setGravando(true);
    setFalha(null);
    try {
      const base = rascunho ?? (await gravarRascunho());
      if (!base) return;
      await servico.alterarPesquisa(
        base.id,
        entradaDaPesquisa(`${prazoDia}T${prazoHora}`),
      );
      const lembretesFinais = lembrar ? lembretes : [];
      const det = await cliente.salvar(base.id, {
        config: {
          comentarios,
          liberarNoPortal: liberar,
          ...(e180 ? { visibilidade } : {}),
          prazoAutoavaliacao:
            e180 && autoAntes ? `${autoDia}T${autoHora}` : null,
          lembretes: lembretesFinais,
          envio,
        },
        times: timesParaEnviar(times),
      });
      const publicada = await servico.publicarPesquisa(base.id);
      setGerada({
        pesquisa: publicada,
        gestores: det.totais.gestores,
        pessoas: det.totais.pessoas,
        lembretes: det.lembretes.length,
      });
    } catch {
      setFalha("Não foi possível criar a avaliação. Rascunho guardado: você pode continuar depois.");
    } finally {
      setGravando(false);
    }
  }

  const cabecalho = (
    <header className="pesquisas__cabecalho">
      <IconButton
        label="Voltar"
        icon={<IconeVoltar tamanho={18} />}
        className="pesquisas__voltar"
        onClick={onVoltar}
      />
      <div className="pesquisas__titulos">
        <h1 id={PESQUISAS_TITULO_ID} className="pesquisas__titulo" tabIndex={-1}>
          {e180 ? "Nova Avaliação 180°" : "Nova Avaliação 90°"}
        </h1>
        <p className="pesquisas__subtitulo">
          {e180
            ? "8 competências · 24 afirmações de 1 a 5 · o gestor avalia e cada pessoa faz a autoavaliação."
            : "8 competências · 24 afirmações de 1 a 5 · o gestor direto avalia cada pessoa do time."}
        </p>
      </div>
      <p className="pesquisas__salvo" role="status">
        {gerada ? (
          <>
            <span className="pesquisas__ponto pesquisas__ponto--sucesso" aria-hidden="true" />
            {`Avaliação criada às ${hora()}`}
          </>
        ) : salvoAs ? (
          <>
            <span className="pesquisas__ponto pesquisas__ponto--sucesso" aria-hidden="true" />
            {`Rascunho salvo às ${salvoAs}`}
          </>
        ) : null}
      </p>
    </header>
  );

  if (gerada) {
    return (
      <div className="pesquisas">
        {cabecalho}
        <BarraDeEtapas etapas={etapas} atual={etapas.length} />
        <section className="pesquisas__cartao-secao avaliacao__sucesso" aria-label="Avaliação criada">
          <h2 className="pesquisas__cartao-secao-titulo">
            {`${plural(gerada.gestores, "gestor avalia", "gestores avaliam")} ${plural(gerada.pessoas, "pessoa", "pessoas")}`}
          </h2>
          <p className="pesquisas__suave">
            {envio === "email"
              ? `O envio por e-mail ainda não está ligado no Evolli: os convites ficam aguardando e-mail. Envie o link aos gestores pelo canal que preferir.${gerada.lembretes ? ` ${plural(gerada.lembretes, "lembrete fica agendado", "lembretes ficam agendados")} para quando o e-mail entrar.` : ""}`
              : "Envie o link aos gestores pelo canal que preferir."}
          </p>
          {gerada.pesquisa.link ? (
            <CampoDoLink link={gerada.pesquisa.link} principal />
          ) : null}
          <div className="pesquisas__acoes">
            <Button onClick={() => onAcompanhar(gerada.pesquisa.id)}>
              Acompanhar a avaliação
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const ultima = etapa === etapas.length - 1;

  return (
    <div className="pesquisas pesquisas--com-rodape">
      {cabecalho}
      <BarraDeEtapas etapas={etapas} atual={etapa} />

      {etapa === 0 ? (
        <>
          <CartaoDeSecao
            titulo="Sobre a avaliação"
            descricao={
              e180
                ? "O nome fica visível só para o RH. A mensagem aparece para gestores e pessoas antes de começar."
                : "O nome fica visível só para o RH. A mensagem aparece para os gestores antes de começar."
            }
          >
            <div className="pesquisas__campos">
              <label className="pesquisas__campo">
                <span className="pesquisas__rotulo">Nome da avaliação</span>
                <input
                  value={nome}
                  maxLength={200}
                  aria-invalid={erroNome ? true : undefined}
                  onChange={(e) => setNome(e.target.value)}
                />
              </label>
              {erroNome ? <p className="pesquisas__erro">{erroNome}</p> : null}
              <label className="pesquisas__campo">
                <span className="pesquisas__rotulo">
                  {e180 ? "Mensagem antes de começar (opcional)" : "Mensagem para os gestores (opcional)"}
                </span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                />
              </label>
            </div>
          </CartaoDeSecao>

          <CartaoDeSecao
            titulo="Competências avaliadas"
            contador="8 competências · 24 afirmações"
            descricao={
              e180
                ? "O modelo é fixo. Na autoavaliação, a pessoa lê cada afirmação na 1ª pessoa. Cada afirmação vai de 1 (Insuficiente) a 5 (Excepcional)."
                : "O modelo é fixo para dar para comparar times e ciclos. Cada afirmação vai de 1 (Insuficiente) a 5 (Excepcional)."
            }
          >
            <ListaDeCompetencias />
          </CartaoDeSecao>

          <CartaoDeSecao
            titulo="Comentários"
            descricao={
              e180
                ? "Vale para o gestor e para a pessoa. Um exemplo concreto ajuda a calibrar as notas e vira a base do plano de desenvolvimento."
                : "Um exemplo concreto ajuda a calibrar as notas e vira a base do plano de desenvolvimento."
            }
          >
            <div className="pesquisas__escolhas pesquisas__escolhas--tres" role="radiogroup" aria-label="Comentários">
              {REGRAS_DE_COMENTARIOS.map((r) => (
                <label key={r.valor} className="pesquisas__escolha pesquisas__escolha--vertical">
                  <span className="pesquisas__escolha-topo">
                    <strong>{r.titulo}</strong>
                    <input
                      type="radio"
                      name={`${ids}-comentarios`}
                      checked={comentarios === r.valor}
                      onChange={() => setComentarios(r.valor)}
                    />
                  </span>
                  <span className="pesquisas__suave">
                    {e180 && r.valor === "obrigatorios"
                      ? "Um comentário por competência, nas duas avaliações."
                      : r.texto}
                  </span>
                </label>
              ))}
            </div>
          </CartaoDeSecao>

          {e180 ? (
            <CartaoDeSecao
              titulo="Quando cada um vê a outra avaliação"
              descricao="As duas avaliações são feitas sem ver a outra. Escolha o que o gestor vê depois de enviar."
            >
              <div className="pesquisas__escolhas" role="radiogroup" aria-label="Quem vê o quê">
                {(
                  [
                    ["depois_do_gestor", "Depois que o gestor enviar", "O gestor vê a autoavaliação só depois de enviar a dele."],
                    ["so_rh", "Só o RH vê o comparativo", "O gestor nunca vê a autoavaliação."],
                  ] as const
                ).map(([valor, titulo, texto]) => (
                  <label key={valor} className="pesquisas__escolha pesquisas__escolha--vertical">
                    <span className="pesquisas__escolha-topo">
                      <strong>{titulo}</strong>
                      <input
                        type="radio"
                        name={`${ids}-visibilidade`}
                        checked={visibilidade === valor}
                        onChange={() => setVisibilidade(valor)}
                      />
                    </span>
                    <span className="pesquisas__suave">{texto}</span>
                  </label>
                ))}
              </div>
              <p className="pesquisas__nota">
                A pessoa nunca vê a nota do gestor antes de enviar a autoavaliação.
              </p>
            </CartaoDeSecao>
          ) : null}

          <CartaoDeSecao
            titulo={e180 ? "Comparativo para a pessoa" : "Resultado para a pessoa avaliada"}
            descricao="Por padrão, só o RH vê os resultados."
          >
            <label className="avaliacao__interruptor">
              <input
                type="checkbox"
                role="switch"
                checked={liberar}
                onChange={(e) => setLiberar(e.target.checked)}
              />
              <span>
                <strong>
                  {e180 ? "Liberar o comparativo no Portal do Colaborador" : "Liberar o resultado no Portal do Colaborador"}
                </strong>
                <span className="pesquisas__suave">
                  {e180
                    ? "A pessoa vê a nota do gestor ao lado da própria, os comentários e o plano; nunca a dos colegas."
                    : "Cada pessoa vê a própria nota, os comentários e o plano de desenvolvimento; nunca a dos colegas."}
                </span>
              </span>
            </label>
          </CartaoDeSecao>
        </>
      ) : etapa === 1 ? (
        <CartaoDeSecao
          titulo={e180 ? "Quem avalia e se avalia" : "Quem avalia quem"}
          descricao={
            e180
              ? "Usamos o gestor direto de cada pessoa no cadastro. Cada pessoa avaliada também faz a própria autoavaliação. Você pode tirar gestores, mover pessoas ou adicionar alguém."
              : "Usamos o gestor direto de cada pessoa no cadastro. Você pode tirar gestores, mover pessoas ou adicionar alguém."
          }
        >
          {falhaOrg ? (
            <p className="pesquisas__erro" role="alert">
              Não foi possível carregar os gestores e times.
            </p>
          ) : !org ? (
            <Esqueleto rotulo="Carregando gestores e times…" linhas={4} />
          ) : (
            <EtapaTimes
              modelo={modelo}
              org={org}
              modo={modo}
              onModo={setModo}
              times={times}
              setTimes={setTimes}
              semGestor={semGestor}
              gestoresSemCpf={gestoresSemCpf}
              contagem={textoDaContagem(modelo, contagem)}
              pessoasSemCpf={contagem.pessoasSemCpf}
              busca={busca}
              onBusca={setBusca}
              aberto={aberto}
              onAbrir={setAberto}
              onDeixarDeFora={(id) => setDeFora((s) => new Set([...s, id]))}
            />
          )}
          {erroTimes ? (
            <p className="pesquisas__erro" role="alert">
              {erroTimes}
            </p>
          ) : null}
        </CartaoDeSecao>
      ) : (
        <EtapaPrazo
          ids={ids}
          e180={e180}
          hoje={hoje}
          nome={nome}
          comentarios={comentarios}
          visibilidade={visibilidade}
          liberar={liberar}
          contagem={contagem}
          prazoDia={prazoDia}
          prazoHora={prazoHora}
          onPrazo={(d, h) => {
            setPrazoDia(d);
            setPrazoHora(h);
          }}
          autoAntes={autoAntes}
          onAutoAntes={setAutoAntes}
          autoDia={autoDia}
          autoHora={autoHora}
          onAuto={(d, h) => {
            setAutoDia(d);
            setAutoHora(h);
          }}
          lembrar={lembrar}
          onLembrar={setLembrar}
          lembretes={lembretes}
          onLembretes={setLembretes}
          envio={envio}
          onEnvio={setEnvio}
          erros={errosPrazo}
          onEditar={setEtapa}
        />
      )}

      {falha ? (
        <p className="pesquisas__erro" role="alert">
          {falha}
        </p>
      ) : null}

      <footer className="pesquisas__rodape">
        {etapa === 0 ? (
          <Button variant="subtle" onClick={onVoltar}>
            Cancelar
          </Button>
        ) : (
          <div className="pesquisas__rodape-esquerda">
            <Button variant="secondary" onClick={() => setEtapa(etapa - 1)}>
              ‹ Voltar
            </Button>
            <span className="pesquisas__suave">
              {textoDaContagem(modelo, contagem)}
            </span>
          </div>
        )}
        <Button disabled={gravando} onClick={() => void avancar()}>
          {ultima
            ? envio === "email"
              ? e180
                ? "Criar e enviar convites"
                : "Criar e enviar aos gestores"
              : "Criar avaliação"
            : `Próximo: ${etapas[etapa + 1]!.titulo} →`}
        </Button>
      </footer>
    </div>
  );
}

function ListaDeCompetencias() {
  const [aberta, setAberta] = useState<string | null>(CATALOGO[0]!.id);
  return (
    <ul className="avaliacao__competencias">
      {CATALOGO.map((c, ic) => (
        <li key={c.id}>
          <button
            type="button"
            className="avaliacao__competencia-cabeca"
            aria-expanded={aberta === c.id}
            onClick={() => setAberta(aberta === c.id ? null : c.id)}
          >
            <span className="avaliacao__bolinha" style={{ ["--cor" as string]: `var(${c.cor})` }} aria-hidden="true" />
            <strong>{c.rotulo}</strong>
            <span className="pesquisas__suave">· 3 afirmações</span>
          </button>
          {aberta === c.id ? (
            <ol className="avaliacao__afirmacoes">
              {c.itens.map((i, ii) => (
                <li key={i.id}>
                  <span className="pesquisas__numero-pergunta">
                    {String(ic * 3 + ii + 1).padStart(2, "0")}
                  </span>
                  <span>{i.gestor}</span>
                  <span className="pesquisas__selo">Escala 1 a 5</span>
                </li>
              ))}
            </ol>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EtapaTimes({
  modelo,
  org,
  modo,
  onModo,
  times,
  setTimes,
  semGestor,
  gestoresSemCpf,
  contagem,
  pessoasSemCpf,
  busca,
  onBusca,
  aberto,
  onAbrir,
  onDeixarDeFora,
}: {
  readonly modelo: ModeloDeAvaliacao;
  readonly org: Organograma;
  readonly modo: "organograma" | "manual";
  readonly onModo: (m: "organograma" | "manual") => void;
  readonly times: TimeNoAssistente[];
  readonly setTimes: (f: (t: TimeNoAssistente[]) => TimeNoAssistente[]) => void;
  readonly semGestor: Organograma["semGestor"];
  readonly gestoresSemCpf: number;
  readonly contagem: string;
  readonly pessoasSemCpf: number;
  readonly busca: string;
  readonly onBusca: (b: string) => void;
  readonly aberto: string | null;
  readonly onAbrir: (id: string | null) => void;
  readonly onDeixarDeFora: (id: string) => void;
}) {
  const [adicionandoEm, setAdicionandoEm] = useState<string | null>(null);
  const [novoGestor, setNovoGestor] = useState(false);
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = times.filter(
    (t) =>
      !termo ||
      t.gestor.nome.toLocaleLowerCase("pt-BR").includes(termo) ||
      t.pessoas.some((p) => p.nome.toLocaleLowerCase("pt-BR").includes(termo)),
  );
  const mudarTime = (gestorId: string, f: (t: TimeNoAssistente) => TimeNoAssistente) =>
    setTimes((ts) => ts.map((t) => (t.gestor.id === gestorId ? f(t) : t)));
  const adicionarPessoa = (gestorId: string, p: PessoaResumida) => {
    setTimes((ts) => {
      if (!ts.some((t) => t.gestor.id === gestorId)) {
        const g = org.ativos.find((a) => a.id === gestorId)!;
        return [...ts, { gestor: g, pessoas: [p], incluido: true }];
      }
      return ts.map((t) =>
        t.gestor.id === gestorId ? { ...t, pessoas: [...t.pessoas, p] } : t,
      );
    });
  };
  const gestoresPossiveis = org.ativos.filter(
    (a) => a.identificavel && !times.some((t) => t.gestor.id === a.id),
  );
  const semCpfMotivo = (s: Organograma["semGestor"][number]) =>
    s.motivo === "gestor_sem_cpf"
      ? `Gestor sem CPF: ${s.gestorNome ?? ""}`
      : s.motivo === "gestor_inativo"
        ? "Gestor fora da lista de ativos"
        : "Sem gestor no cadastro";
  return (
    <div className="avaliacao__times">
      <div className="pesquisas__pilulas" role="group" aria-label="Como montar os times">
        <button type="button" aria-pressed={modo === "organograma"} onClick={() => onModo("organograma")}>
          Pelo organograma
        </button>
        <button type="button" aria-pressed={modo === "manual"} onClick={() => onModo("manual")}>
          Escolher manualmente
        </button>
      </div>
      <p className="avaliacao__contagem">
        <strong>{contagem}</strong>
        {modo === "organograma" && org.semGestor.length ? (
          <span className="avaliacao__aviso avaliacao__aviso--atencao">
            {plural(org.semGestor.length, "pessoa sem gestor", "pessoas sem gestor")}
          </span>
        ) : null}
        {modo === "organograma" && gestoresSemCpf ? (
          <span className="avaliacao__aviso avaliacao__aviso--erro">
            {plural(gestoresSemCpf, "gestor sem CPF", "gestores sem CPF")}
          </span>
        ) : null}
        {modelo === "avaliacao180" && pessoasSemCpf ? (
          <span className="avaliacao__aviso avaliacao__aviso--atencao">
            {`${plural(pessoasSemCpf, "pessoa sem CPF", "pessoas sem CPF")}: só o gestor avalia`}
          </span>
        ) : null}
      </p>
      {times.length > 0 ? (
        <CampoDeBusca rotulo="Buscar gestor ou pessoa" valor={busca} onMudar={onBusca} />
      ) : null}

      {modo === "manual" && times.length === 0 ? (
        <div className="pesquisas__sem-respostas">
          <h3 className="pesquisas__cartao-secao-titulo">Nenhum gestor ainda</h3>
          <p className="pesquisas__suave">
            Adicione os gestores e, em cada um, as pessoas que ele avalia.
          </p>
        </div>
      ) : null}

      <ul className="avaliacao__lista-times">
        {visiveis.map((t) => {
          const expandido = aberto === t.gestor.id;
          const candidatos = candidatosAoTime(org.ativos, times, t.gestor.id);
          return (
            <li key={t.gestor.id} className="avaliacao__time">
              <div className="avaliacao__time-cabeca">
                <input
                  type="checkbox"
                  aria-label={`Incluir ${t.gestor.nome}`}
                  checked={t.incluido}
                  onChange={(e) => mudarTime(t.gestor.id, (x) => ({ ...x, incluido: e.target.checked }))}
                />
                <Avatar texto={iniciaisDe(t.gestor.nome)} />
                <span className="avaliacao__time-nome">
                  <strong>{t.gestor.nome}</strong>
                  <span className="pesquisas__suave">
                    {[t.gestor.cargo, t.gestor.departamento].filter(Boolean).join(" · ") || "Sem cargo"}
                  </span>
                </span>
                <span className="pesquisas__suave">{plural(t.pessoas.length, "pessoa", "pessoas")}</span>
                <button
                  type="button"
                  className="pesquisas__acao-texto"
                  aria-expanded={expandido}
                  aria-label={`${expandido ? "Recolher" : "Ver"} o time de ${t.gestor.nome}`}
                  onClick={() => onAbrir(expandido ? null : t.gestor.id)}
                >
                  {expandido ? "Recolher" : "Ver time"}
                </button>
              </div>
              {expandido ? (
                <div className="avaliacao__time-corpo">
                  <ul>
                    {t.pessoas.map((p) => (
                      <li key={p.id} className="avaliacao__pessoa">
                        <Avatar texto={iniciaisDe(p.nome)} />
                        <span>
                          {p.nome}
                          {p.cargo ? <span className="pesquisas__suave">{` · ${p.cargo}`}</span> : null}
                        </span>
                        <IconButton
                          label={`Tirar ${p.nome} do time`}
                          icon={<IconeFechar tamanho={14} />}
                          variant="subtle"
                          onClick={() =>
                            mudarTime(t.gestor.id, (x) => ({
                              ...x,
                              pessoas: x.pessoas.filter((y) => y.id !== p.id),
                            }))
                          }
                        />
                      </li>
                    ))}
                  </ul>
                  {adicionandoEm === t.gestor.id ? (
                    <EscolherPessoa
                      rotulo={`Adicionar ao time de ${t.gestor.nome}`}
                      pessoas={candidatos}
                      onEscolher={(p) => {
                        adicionarPessoa(t.gestor.id, p);
                        setAdicionandoEm(null);
                      }}
                      onCancelar={() => setAdicionandoEm(null)}
                    />
                  ) : (
                    <button type="button" className="pesquisas__acao-texto" onClick={() => setAdicionandoEm(t.gestor.id)}>
                      <IconeMais tamanho={14} /> {`Adicionar pessoa ao time de ${t.gestor.nome}`}
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {modo === "manual" ? (
        novoGestor ? (
          <EscolherPessoa
            rotulo="Adicionar gestor"
            pessoas={gestoresPossiveis}
            onEscolher={(g) => {
              setTimes((ts) => [...ts, { gestor: g, pessoas: [], incluido: true }]);
              onAbrir(g.id);
              setNovoGestor(false);
            }}
            onCancelar={() => setNovoGestor(false)}
          />
        ) : (
          <Button variant="secondary" onClick={() => setNovoGestor(true)}>
            <IconeMais tamanho={16} /> Adicionar gestor
          </Button>
        )
      ) : null}

      {modo === "organograma" && semGestor.length ? (
        <section className="avaliacao__sem-gestor" aria-label="Pessoas sem gestor no cadastro">
          <h3 className="pesquisas__cartao-secao-titulo">Pessoas sem gestor no cadastro</h3>
          <p className="pesquisas__suave">Escolha quem avalia ou deixe de fora desta avaliação.</p>
          <ul>
            {semGestor.map((s) => (
              <li key={s.pessoa.id} className="avaliacao__pessoa">
                <Avatar texto={iniciaisDe(s.pessoa.nome)} />
                <span>
                  {s.pessoa.nome}
                  <span className="pesquisas__suave">{` · ${semCpfMotivo(s)}`}</span>
                </span>
                <select
                  aria-label={`Escolher gestor de ${s.pessoa.nome}`}
                  value=""
                  onChange={(e) => {
                    const g = org.ativos.find((a) => a.id === e.target.value);
                    if (g) adicionarPessoa(g.id, s.pessoa);
                  }}
                >
                  <option value="">Escolher gestor</option>
                  {org.ativos
                    .filter((a) => a.identificavel && a.id !== s.pessoa.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                </select>
                <Button variant="subtle" onClick={() => onDeixarDeFora(s.pessoa.id)}>
                  Deixar de fora
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EscolherPessoa({
  rotulo,
  pessoas,
  onEscolher,
  onCancelar,
}: {
  readonly rotulo: string;
  readonly pessoas: readonly PessoaResumida[];
  readonly onEscolher: (p: PessoaResumida) => void;
  readonly onCancelar: () => void;
}) {
  const [termo, setTermo] = useState("");
  const t = termo.trim().toLocaleLowerCase("pt-BR");
  const lista = pessoas.filter((p) => !t || p.nome.toLocaleLowerCase("pt-BR").includes(t)).slice(0, 20);
  return (
    <div className="pesquisas__caixa-inline" role="group" aria-label={rotulo}>
      <CampoDeBusca rotulo={`${rotulo}: buscar`} valor={termo} onMudar={setTermo} />
      <ul className="avaliacao__escolher">
        {lista.length === 0 ? (
          <li className="pesquisas__suave">Ninguém disponível.</li>
        ) : (
          lista.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onEscolher(p)}>
                <strong>{p.nome}</strong>
                {p.cargo ? <span className="pesquisas__suave">{` · ${p.cargo}`}</span> : null}
              </button>
            </li>
          ))
        )}
      </ul>
      <Button variant="subtle" onClick={onCancelar}>
        Cancelar
      </Button>
    </div>
  );
}

function EtapaPrazo(p: {
  readonly ids: string;
  readonly e180: boolean;
  readonly hoje: string;
  readonly nome: string;
  readonly comentarios: RegraDeComentarios;
  readonly visibilidade: "depois_do_gestor" | "so_rh";
  readonly liberar: boolean;
  readonly contagem: ReturnType<typeof contar>;
  readonly prazoDia: string;
  readonly prazoHora: string;
  readonly onPrazo: (d: string, h: string) => void;
  readonly autoAntes: boolean;
  readonly onAutoAntes: (v: boolean) => void;
  readonly autoDia: string;
  readonly autoHora: string;
  readonly onAuto: (d: string, h: string) => void;
  readonly lembrar: boolean;
  readonly onLembrar: (v: boolean) => void;
  readonly lembretes: Lembrete[];
  readonly onLembretes: (l: Lembrete[]) => void;
  readonly envio: "email" | "link";
  readonly onEnvio: (e: "email" | "link") => void;
  readonly erros: { prazo?: string | null; auto?: string | null };
  readonly onEditar: (etapa: number) => void;
}) {
  const c = p.contagem;
  const regra = REGRAS_DE_COMENTARIOS.find((r) => r.valor === p.comentarios)!;
  const prazoTexto = `${diaMes(p.prazoDia)} às ${p.prazoHora}`;
  return (
    <>
      <CartaoDeSecao
        titulo="Prazo"
        descricao="Os gestores veem a data no link. Depois do prazo, o link fecha e o RH pode reabrir."
      >
        <div className="avaliacao__linha-campos">
          <label className="pesquisas__campo">
            <span className="pesquisas__rotulo">Data limite</span>
            <input type="date" value={p.prazoDia} onChange={(e) => p.onPrazo(e.target.value, p.prazoHora)} />
          </label>
          <label className="pesquisas__campo">
            <span className="pesquisas__rotulo">Horário</span>
            <input type="time" value={p.prazoHora} onChange={(e) => p.onPrazo(p.prazoDia, e.target.value)} />
          </label>
        </div>
        <p className="pesquisas__suave">{legendaDoPrazo(p.hoje, p.prazoDia)}</p>
        {p.erros.prazo ? <p className="pesquisas__erro">{p.erros.prazo}</p> : null}
        {p.e180 ? (
          <div className="avaliacao__prazo-auto">
            <div className="pesquisas__pilulas" role="group" aria-label="Como fica o prazo da autoavaliação">
              <button type="button" aria-pressed={!p.autoAntes} onClick={() => p.onAutoAntes(false)}>
                Mesmo prazo para os dois
              </button>
              <button type="button" aria-pressed={p.autoAntes} onClick={() => p.onAutoAntes(true)}>
                Autoavaliação termina antes
              </button>
            </div>
            {p.autoAntes ? (
              <>
                <div className="avaliacao__linha-campos">
                  <label className="pesquisas__campo">
                    <span className="pesquisas__rotulo">Prazo da autoavaliação</span>
                    <input type="date" value={p.autoDia} onChange={(e) => p.onAuto(e.target.value, p.autoHora)} />
                  </label>
                  <label className="pesquisas__campo">
                    <span className="pesquisas__rotulo">Horário da autoavaliação</span>
                    <input type="time" value={p.autoHora} onChange={(e) => p.onAuto(p.autoDia, e.target.value)} />
                  </label>
                </div>
                <p className="pesquisas__suave">
                  {`Termina antes: a pessoa responde primeiro. A pessoa tem até ${diaMes(p.autoDia)} e o gestor, até ${diaMes(p.prazoDia)}.`}
                </p>
                {p.erros.auto ? <p className="pesquisas__erro">{p.erros.auto}</p> : null}
              </>
            ) : null}
          </div>
        ) : null}
      </CartaoDeSecao>

      <CartaoDeSecao titulo="Lembrar quem não terminou" descricao="Aviso automático só para quem ainda tem pessoas pendentes.">
        <label className="avaliacao__interruptor">
          <input type="checkbox" role="switch" checked={p.lembrar} onChange={(e) => p.onLembrar(e.target.checked)} />
          <span>
            <strong>Lembrar quem não terminou</strong>
            <span className="pesquisas__suave">Os lembretes saem às 09:00.</span>
          </span>
        </label>
        {p.lembrar ? (
          <div className="avaliacao__checks" role="group" aria-label="Quando lembrar">
            {LEMBRETES.map((l) => (
              <label key={l}>
                <input
                  type="checkbox"
                  checked={p.lembretes.includes(l)}
                  onChange={(e) =>
                    p.onLembretes(e.target.checked ? [...p.lembretes, l] : p.lembretes.filter((x) => x !== l))
                  }
                />
                {ROTULO_DO_LEMBRETE[l]}
              </label>
            ))}
          </div>
        ) : null}
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo={p.e180 ? "Como cada um recebe" : "Como os gestores recebem"}
        descricao="Cada pessoa entra com o próprio CPF e a data de nascimento e vê só o que é dela."
      >
        <div className="pesquisas__escolhas" role="radiogroup" aria-label="Envio">
          <label className="pesquisas__escolha pesquisas__escolha--vertical">
            <span className="pesquisas__escolha-topo">
              <strong>{p.e180 ? "Enviar e-mail para gestores e pessoas" : "Enviar e-mail para cada gestor"}</strong>
              <input type="radio" name={`${p.ids}-envio`} checked={p.envio === "email"} onChange={() => p.onEnvio("email")} />
            </span>
            <span className="pesquisas__suave">
              {p.e180
                ? `${plural(c.gestores, "e-mail", "e-mails")} para os gestores e ${c.autoavaliacoes} para as pessoas.`
                : `${plural(c.gestores, "e-mail", "e-mails")}, cada um com o número de pessoas do time.`}
            </span>
          </label>
          <label className="pesquisas__escolha pesquisas__escolha--vertical">
            <span className="pesquisas__escolha-topo">
              <strong>Só gerar o link</strong>
              <input type="radio" name={`${p.ids}-envio`} checked={p.envio === "link"} onChange={() => p.onEnvio("link")} />
            </span>
            <span className="pesquisas__suave">Você copia e envia pelo canal que preferir.</span>
          </label>
        </div>
        {p.envio === "email" ? (
          <>
            <p className="pesquisas__nota">
              {c.gestoresComEmail === c.gestores
                ? c.gestores === 1
                  ? "O gestor tem e-mail no cadastro."
                  : "Todos os gestores têm e-mail no cadastro."
                : `${c.gestoresComEmail} de ${plural(c.gestores, "gestor tem", "gestores têm")} e-mail no cadastro. Para quem não tem, envie o link.`}
            </p>
            <p className="avaliacao__aviso avaliacao__aviso--info" role="note">
              O envio por e-mail entra na próxima etapa do Evolli. Até lá, os convites ficam aguardando e-mail e você envia o link.
            </p>
            <div className="avaliacao__previa-email" aria-label="Prévia do e-mail">
              <p className="pesquisas__suave">Prévia do e-mail</p>
              <p>
                <strong>{`Avalie o seu time até ${diaMes(p.prazoDia)}`}</strong>
              </p>
              <p>
                {`Você vai avaliar as pessoas do seu time em 8 competências. Leva cerca de 4 minutos por pessoa e dá para parar e continuar depois.${p.e180 ? " Cada pessoa também faz a própria autoavaliação." : ""}`}
              </p>
              <p className="pesquisas__suave">Você vai entrar com o seu CPF.</p>
            </div>
          </>
        ) : null}
      </CartaoDeSecao>

      <CartaoDeSecao titulo="Resumo" descricao="Confira antes de enviar.">
        <dl className="avaliacao__resumo">
          <div>
            <dt>Avaliação</dt>
            <dd>{`${p.nome} · 8 competências · comentários: ${regra.titulo.toLocaleLowerCase("pt-BR")}`}</dd>
            <button type="button" className="pesquisas__acao-texto" onClick={() => p.onEditar(0)}>Editar</button>
          </div>
          <div>
            <dt>{p.e180 ? "Quem participa" : "Quem avalia"}</dt>
            <dd>
              {`${plural(c.gestores, "gestor avalia", "gestores avaliam")} ${plural(c.pessoas, "pessoa", "pessoas")}`}
              {p.e180 ? ` · ${plural(c.autoavaliacoes, "autoavaliação", "autoavaliações")}` : ""}
            </dd>
            <button type="button" className="pesquisas__acao-texto" onClick={() => p.onEditar(1)}>Editar</button>
          </div>
          <div>
            <dt>Prazo</dt>
            <dd>
              {p.e180
                ? p.autoAntes
                  ? `Gestor até ${prazoTexto} · autoavaliação até ${diaMes(p.autoDia)} às ${p.autoHora}`
                  : `${prazoTexto} para os dois`
                : prazoTexto}
              {` · ${textoDosLembretes(p.lembrar ? p.lembretes : [])}`}
            </dd>
            <button type="button" className="pesquisas__acao-texto" onClick={() => p.onEditar(2)}>Editar</button>
          </div>
          <div>
            <dt>Envio</dt>
            <dd>
              {p.envio === "email"
                ? p.e180
                  ? "E-mail para gestores e pessoas ao criar (aguardando e-mail)"
                  : "E-mail para cada gestor ao criar (aguardando e-mail)"
                : "Só o link"}
            </dd>
          </div>
          <div>
            <dt>{p.e180 ? "Quem vê o quê" : "Resultado para a pessoa"}</dt>
            <dd>
              {p.e180
                ? `${p.visibilidade === "depois_do_gestor" ? "O gestor vê a autoavaliação depois de enviar a dele." : "Só o RH vê o comparativo."} ${p.liberar ? "A pessoa vê o comparativo no Portal quando você liberar." : "A pessoa não vê o comparativo."}`
                : p.liberar
                  ? "Vai para o Portal do Colaborador quando você liberar."
                  : "Só o RH vê. Dá para liberar no Portal depois."}
            </dd>
          </div>
        </dl>
      </CartaoDeSecao>
    </>
  );
}
