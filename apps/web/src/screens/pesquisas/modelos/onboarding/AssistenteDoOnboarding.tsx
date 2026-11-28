/**
 * T216 — assistente do Onboarding com envio automático (5 etapas):
 * Configurar (nome, identificação e como enviar: agora, agendado ou
 * automático aos 30/60/90 dias, com horário, prazo, lembrete, dias úteis e
 * atrasados) → Perguntas (17 em 8 blocos, editáveis) → Quem recebe (todos,
 * por grupo ou escolher pessoas) → E-mail (padrão ou personalizado, com a
 * prévia) → Enviar (revisão e ativação).
 *
 * O rascunho é gravado assim que o assistente abre (a rota passa a
 * `<id>/rascunho`) e a cada etapa; ao reabrir, volta com tudo e na etapa em
 * que a pessoa parou. O Evolli ainda não envia e-mail: os convites ficam
 * "aguardando e-mail" e o RH manda o link ("Enviar teste" fica preparado).
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  Identificacao,
  Pergunta,
  PesquisaDetalhe,
  Secao,
} from "../../../../api/pesquisasClient";
import { Button } from "../../../../components";
import { plural } from "../../../../format/plural";
import { IconButton } from "../../../../ui";
import { IconeMais, IconeRemover, IconeVoltar } from "../../../../ui/icones";
import { BarraDeEtapas, CampoDeBusca, CartaoDeSecao } from "../../componentes";
import type { ServicoDePesquisas } from "../../servicoDePesquisas";
import { CampoDoLink } from "../../TelaDeGerada";
import { lembrarRascunho, memoriaDoRascunho } from "../../rascunhosLocais";
import { enderecoDaPrevia } from "../../rotasDePesquisas";
import { IDENTIFICACOES, novoId } from "../../textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "../../tituloDasPesquisas";
import {
  HORARIOS,
  LEMBRETES,
  PRAZOS,
  RODADAS,
  TIPOS_DO_ONBOARDING,
  comTipo,
  secoesDoOnboarding,
  tipoDaPergunta,
  type RodadaAutomatica,
  type TipoDoOnboarding,
} from "./envio";
import type {
  CampoDoPublico,
  ClienteDoOnboarding,
  ConfigOnboarding,
  OnboardingDetalhe,
  PessoaDoPublico,
  PreviaDoPublico,
  Publico,
} from "./cliente";
import { ROTULO_DO_CAMPO, type GruposDoPublico } from "./gruposDoPublico";
import {
  CONFIG_PADRAO,
  CORES_DE_FUNDO,
  CORES_PRINCIPAIS,
  configParaEnviar,
  contarPerguntas,
  corDoTextoSobre,
  corValida,
  errosDaConfiguracao,
  fundoClaro,
  primeiroNome,
  resumoDoEnvio,
  siglaDaEmpresa,
  somarDias,
  textoDaContagem,
  textoDasProximas,
  textoDoBotaoFinal,
  textoDoPrazoELembrete,
} from "./regrasDoOnboarding";
import "../AvaliacaoOnboarding.css";

const ETAPAS = [
  { titulo: "Configurar", subtitulo: "Nome e envio" },
  { titulo: "Perguntas", subtitulo: "Editar perguntas" },
  { titulo: "Quem recebe", subtitulo: "Pessoas ou grupos" },
  { titulo: "E-mail", subtitulo: "Texto e aparência" },
  { titulo: "Enviar", subtitulo: "Revisar e enviar" },
] as const;

export type ServicoDoAssistente = Pick<
  ServicoDePesquisas,
  "criarPesquisa" | "alterarPesquisa"
>;

interface Props {
  readonly servico: ServicoDoAssistente;
  readonly cliente: Pick<
    ClienteDoOnboarding,
    "salvar" | "ativar" | "previaDoPublico"
  > &
    Partial<Pick<ClienteDoOnboarding, "obter">>;
  readonly listarGrupos: () => Promise<GruposDoPublico>;
  /** O rascunho retomado (`<id>/rascunho`). */
  readonly base?: PesquisaDetalhe;
  /** O nome da empresa ativa (remetente e textos do e-mail). */
  readonly empresa?: string | null;
  readonly hoje: string;
  readonly agora?: () => Date;
  /** O rascunho foi gravado pela primeira vez (a rota passa a apontar para ele). */
  readonly onRascunhoCriado?: (id: string) => void;
  /** "Abrir prévia": a pesquisa como a pessoa vê (outra aba). */
  readonly onAbrirPrevia?: (pesquisaId: string) => void;
  readonly onVoltar: () => void;
  readonly onVerEnvios: (pesquisaId: string) => void;
}

/** O público ainda sem ninguém escolhido (a API recusa a prévia vazia). */
function publicoIncompleto(p: Publico): boolean {
  return (
    (p.tipo === "pessoas" && p.colaboradorIds.length === 0) ||
    (p.tipo === "grupo" && p.condicoes.some((c) => c.valores.length === 0))
  );
}

const PREVIA_VAZIA: PreviaDoPublico = {
  total: 0,
  semEmail: 0,
  proximas: { 30: 0, 60: 0, 90: 0 },
  pessoas: [],
};

/** "na Empresa X" (ou "na empresa", sem o nome da empresa ativa). */
export function naEmpresa(empresa: string | null | undefined): string {
  const nome = empresa?.trim();
  return nome ? `na ${nome}` : "na empresa";
}

const abrirEmOutraAba = (id: string) => {
  window.open(enderecoDaPrevia(id), "_blank", "noopener");
};

export function AssistenteDoOnboarding({
  servico,
  cliente,
  listarGrupos,
  base,
  empresa = null,
  hoje,
  agora = () => new Date(),
  onRascunhoCriado,
  onAbrirPrevia = abrirEmOutraAba,
  onVoltar,
  onVerEnvios,
}: Props) {
  const ids = useId();
  const [etapa, setEtapa] = useState(() => {
    const m = base ? memoriaDoRascunho(base.id) : null;
    return m ? Math.min(Math.max(m.etapa - 1, 0), ETAPAS.length - 1) : 0;
  });
  const [rascunho, setRascunho] = useState<PesquisaDetalhe | null>(
    base ?? null,
  );
  /** O rascunho gravado, lido na hora (a criação ao abrir é assíncrona). */
  const rascunhoRef = useRef<PesquisaDetalhe | null>(base ?? null);
  const criacaoRef = useRef<Promise<unknown> | null>(null);
  const [salvoAs, setSalvoAs] = useState<string | null>(null);
  const [nome, setNome] = useState(
    () => base?.nome ?? "Onboarding · 30 e 60 dias",
  );
  const [descricao, setDescricao] = useState(() => base?.boasVindas ?? "");
  const [identificacao, setIdentificacao] = useState<Identificacao>(
    () => base?.identificacao ?? "confidencial",
  );
  const [config, setConfig] = useState<ConfigOnboarding>(() => ({
    ...CONFIG_PADRAO,
    agendadoPara: somarDias(hoje, 1),
  }));
  const [secoes, setSecoes] = useState<Secao[]>(() =>
    base && base.secoes.length ? base.secoes : secoesDoOnboarding(),
  );
  /** Todas as pessoas ativas (para marcar), independente da escolha. */
  const [todas, setTodas] = useState<readonly PessoaDoPublico[] | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [previa, setPrevia] = useState<PreviaDoPublico | null>(null);
  const [grupos, setGrupos] = useState<GruposDoPublico | null>(null);
  const [ativada, setAtivada] = useState<OnboardingDetalhe | null>(null);

  const mudar = (m: Partial<ConfigOnboarding>) =>
    setConfig((c) => ({ ...c, ...m }));
  const anonima = identificacao === "anonima";
  const contagem = contarPerguntas(secoes);

  // A prévia do público acompanha a escolha (e os "próximos 30 dias").
  // Sem ninguém escolhido ainda, a prévia é vazia (sem pedir à API).
  useEffect(() => {
    if (publicoIncompleto(config.publico)) {
      setPrevia(PREVIA_VAZIA);
      return;
    }
    let vivo = true;
    const todos = config.publico.tipo === "todos";
    cliente
      .previaDoPublico(config.publico, config.soDiasUteis)
      .then((p) => {
        if (!vivo) return;
        setPrevia(p);
        if (todos) setTodas(p.pessoas);
      })
      .catch(() => vivo && setPrevia(null));
    return () => {
      vivo = false;
    };
  }, [cliente, config.publico, config.soDiasUteis]);

  // A lista para marcar as pessoas vem de todos os ativos, sempre.
  const precisaDaLista = todas === null && config.publico.tipo !== "todos";
  useEffect(() => {
    if (!precisaDaLista) return;
    let vivo = true;
    cliente
      .previaDoPublico({ tipo: "todos" }, config.soDiasUteis)
      .then((p) => vivo && setTodas(p.pessoas))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Uma vez: quem está ativo não muda com a escolha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, precisaDaLista]);

  // Rascunho retomado: a configuração do envio gravada.
  const baseId = base?.id ?? null;
  useEffect(() => {
    if (baseId === null || !cliente.obter) return;
    let vivo = true;
    cliente
      .obter(baseId)
      .then((d) => {
        if (vivo)
          setConfig((c) => ({
            ...d.config,
            agendadoPara: d.config.agendadoPara ?? c.agendadoPara,
          }));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Uma leitura por rascunho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseId]);

  // Modelo novo: o rascunho é gravado assim que o assistente abre.
  useEffect(() => {
    if (base || criacaoRef.current) return;
    criacaoRef.current = servico
      .criarPesquisa(entrada())
      .then(async (d) => {
        rascunhoRef.current = d;
        setRascunho(d);
        await cliente.salvar(d.id, configParaEnviar(config, identificacao));
        setSalvoAs(hora());
        guardarEtapa(d.id, 0);
        onRascunhoCriado?.(d.id);
      })
      .catch(() =>
        setFalha("Não foi possível salvar o rascunho. Tente de novo."),
      );
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (etapa !== 2 || grupos) return;
    listarGrupos()
      .then(setGrupos)
      .catch(() =>
        setGrupos({
          departamento: [],
          cargo: [],
          unidade: [],
          centroCusto: [],
        }),
      );
  }, [etapa, grupos, listarGrupos]);

  const hora = () =>
    `${String(agora().getHours()).padStart(2, "0")}:${String(agora().getMinutes()).padStart(2, "0")}`;

  const entrada = () => ({
    nome: nome.trim(),
    boasVindas: descricao.trim() || null,
    modelo: "onboarding" as const,
    identificacao,
    secoes,
    participantes: { todos: false as const, colaboradorIds: [] },
    separarPor: [],
    encerraEm: null,
    minimoPorGrupo: 3,
  });

  /** O navegador lembra a etapa em que a pessoa parou. */
  function guardarEtapa(id: string, etapaAtual: number) {
    lembrarRascunho(id, {
      etapa: etapaAtual + 1,
      totalDeEtapas: ETAPAS.length,
      salvoEm: agora().toISOString(),
    });
  }

  async function gravar(): Promise<PesquisaDetalhe | null> {
    try {
      if (criacaoRef.current) await criacaoRef.current;
      const atual = rascunhoRef.current;
      const d = atual
        ? await servico.alterarPesquisa(atual.id, entrada())
        : await servico.criarPesquisa(entrada());
      rascunhoRef.current = d;
      setRascunho(d);
      await cliente.salvar(d.id, configParaEnviar(config, identificacao));
      setSalvoAs(hora());
      if (!atual) onRascunhoCriado?.(d.id);
      return d;
    } catch {
      setFalha("Não foi possível salvar o rascunho. Tente de novo.");
      return null;
    }
  }

  async function avancar() {
    setFalha(null);
    if (etapa === 0) {
      const e = errosDaConfiguracao(nome, config, hoje);
      setErros(e);
      if (Object.keys(e).length) return;
    }
    if (etapa === 1 && contagem.perguntas === 0) {
      setFalha("Inclua pelo menos uma pergunta.");
      return;
    }
    if (etapa === 2) {
      if (
        config.publico.tipo === "pessoas" &&
        config.publico.colaboradorIds.length === 0
      ) {
        setFalha("Escolha pelo menos uma pessoa.");
        return;
      }
      if (
        config.publico.tipo === "grupo" &&
        config.publico.condicoes.some((c) => c.valores.length === 0)
      ) {
        setFalha("Escolha um valor em cada condição.");
        return;
      }
    }
    if (etapa === 3 && config.email.modelo === "personalizado") {
      const { assunto, titulo, mensagem } = config.email;
      if (!assunto?.trim() || !titulo?.trim() || !mensagem?.trim()) {
        setFalha(
          "Preencha assunto, título e mensagem do e-mail personalizado.",
        );
        return;
      }
    }
    if (etapa < ETAPAS.length - 1) {
      const d = await gravar();
      if (!d) return;
      guardarEtapa(d.id, etapa + 1);
      setEtapa(etapa + 1);
      return;
    }
    setGravando(true);
    try {
      const d = await gravar();
      if (!d) return;
      setAtivada(await cliente.ativar(d.id));
    } catch {
      setFalha(
        "Não foi possível ativar. O rascunho está guardado: tente de novo.",
      );
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
        <h1
          id={PESQUISAS_TITULO_ID}
          className="pesquisas__titulo"
          tabIndex={-1}
        >
          Nova pesquisa de Onboarding
        </h1>
        <p className="pesquisas__subtitulo">
          {`Modelo Onboarding · ${plural(contagem.perguntas, "pergunta", "perguntas")} · cerca de ${plural(contagem.minutos, "minuto", "minutos")} para responder`}
        </p>
      </div>
      <p className="pesquisas__salvo" role="status">
        {salvoAs ? (
          <>
            <span
              className="pesquisas__ponto pesquisas__ponto--sucesso"
              aria-hidden="true"
            />
            {`Rascunho salvo às ${salvoAs}`}
          </>
        ) : null}
      </p>
    </header>
  );

  if (ativada) {
    return (
      <div className="pesquisas">
        {cabecalho}
        <BarraDeEtapas etapas={ETAPAS} atual={ETAPAS.length} />
        <section className="pesquisas__cartao-secao" aria-label="Convites">
          <h2 className="pesquisas__cartao-secao-titulo">
            {config.modo === "automatizar"
              ? `Automação ativa — ${nome}`
              : `Convites criados — ${nome}`}
          </h2>
          <div className="onboarding__numeros">
            <div>
              <span className="pesquisas__suave">Convites</span>
              <strong>{ativada.funil.noPublico}</strong>
              <span className="pesquisas__suave">
                {plural(ativada.funil.semEmail, "sem e-mail", "sem e-mail")}
              </span>
            </div>
            <div>
              <span className="pesquisas__suave">Aguardando e-mail</span>
              <strong>{ativada.funil.aguardandoEmail}</strong>
            </div>
            <div>
              <span className="pesquisas__suave">Prazo</span>
              <strong>{plural(config.prazoDias, "dia", "dias")}</strong>
            </div>
          </div>
          <p className="avaliacao__aviso avaliacao__aviso--info" role="note">
            O envio por e-mail entra na próxima etapa do Evolli. Até lá, os
            convites ficam aguardando e-mail e as pessoas entram na data de cada
            uma: envie o link pelo canal que preferir.
          </p>
          {ativada.link ? <CampoDoLink link={ativada.link} principal /> : null}
          <div className="pesquisas__acoes">
            <Button variant="secondary" onClick={onVoltar}>
              Voltar para Pesquisas
            </Button>
            <Button onClick={() => onVerEnvios(ativada.pesquisaId)}>
              Ver envios
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pesquisas pesquisas--com-rodape">
      {cabecalho}
      <BarraDeEtapas etapas={ETAPAS} atual={etapa} />

      {etapa === 0 ? (
        <EtapaConfigurar
          ids={ids}
          nome={nome}
          onNome={setNome}
          descricao={descricao}
          onDescricao={setDescricao}
          identificacao={identificacao}
          onIdentificacao={setIdentificacao}
          config={config}
          mudar={mudar}
          proximas={previa?.proximas ?? null}
          erros={erros}
        />
      ) : etapa === 1 ? (
        <EtapaPerguntas secoes={secoes} onMudar={setSecoes} />
      ) : etapa === 2 ? (
        <EtapaPublico
          ids={ids}
          publico={config.publico}
          onPublico={(publico) => mudar({ publico })}
          previa={previa}
          todas={todas ?? previa?.pessoas ?? []}
          grupos={grupos}
        />
      ) : etapa === 3 ? (
        <EtapaEmail
          ids={ids}
          config={config}
          mudar={mudar}
          empresa={empresa}
          anonima={anonima}
          perguntas={contagem.perguntas}
          minutos={contagem.minutos}
          pessoas={(previa?.pessoas ?? []).filter((p) => p.noPublico)}
        />
      ) : (
        <EtapaEnviar
          nome={nome}
          identificacao={identificacao}
          config={config}
          contagem={textoDaContagem(contagem)}
          perguntas={contagem.perguntas}
          blocos={contagem.blocos}
          previa={previa}
          empresa={empresa}
          onEditar={setEtapa}
          onAbrirPrevia={
            rascunho ? () => onAbrirPrevia(rascunho.id) : undefined
          }
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
          </div>
        )}
        <span className="pesquisas__suave">
          {etapa === 2 && previa
            ? `${plural(previa.total, "pessoa", "pessoas")} no público`
            : etapa === 3
              ? `${config.email.modelo === "padrao" ? "E-mail padrão" : "E-mail personalizado"} · remetente ${empresa?.trim() || "a empresa ativa"}`
              : resumoDoEnvio(config)}
        </span>
        <Button disabled={gravando} onClick={() => void avancar()}>
          {etapa === ETAPAS.length - 1
            ? textoDoBotaoFinal(config, previa?.total ?? 0)
            : `Próximo: ${ETAPAS[etapa + 1]!.titulo} →`}
        </Button>
      </footer>
    </div>
  );
}

function EtapaConfigurar({
  ids,
  nome,
  onNome,
  descricao,
  onDescricao,
  identificacao,
  onIdentificacao,
  config,
  mudar,
  proximas,
  erros,
}: {
  readonly ids: string;
  readonly nome: string;
  readonly onNome: (v: string) => void;
  readonly descricao: string;
  readonly onDescricao: (v: string) => void;
  readonly identificacao: Identificacao;
  readonly onIdentificacao: (v: Identificacao) => void;
  readonly config: ConfigOnboarding;
  readonly mudar: (m: Partial<ConfigOnboarding>) => void;
  readonly proximas: Record<RodadaAutomatica, number> | null;
  readonly erros: Record<string, string>;
}) {
  const anonima = identificacao === "anonima";
  const prazoELembrete = (
    <div className="avaliacao__linha-campos">
      <label className="pesquisas__campo">
        <span className="pesquisas__rotulo">Prazo para responder</span>
        <select
          value={config.prazoDias}
          onChange={(e) =>
            mudar({
              prazoDias: Number(
                e.target.value,
              ) as ConfigOnboarding["prazoDias"],
            })
          }
        >
          {PRAZOS.map((p) => (
            <option key={p} value={p}>
              {plural(p, "dia", "dias")}
            </option>
          ))}
        </select>
      </label>
      <label className="pesquisas__campo">
        <span className="pesquisas__rotulo">Lembrete</span>
        <select
          disabled={anonima}
          value={
            anonima || config.lembreteDias === null ? "" : config.lembreteDias
          }
          onChange={(e) =>
            mudar({
              lembreteDias: e.target.value
                ? (Number(e.target.value) as 2 | 3 | 5)
                : null,
            })
          }
        >
          <option value="">Sem lembrete</option>
          {LEMBRETES.map((l) => (
            <option key={l} value={l}>
              {`${plural(l, "dia", "dias")} depois do envio`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
  return (
    <>
      <CartaoDeSecao
        titulo="Sobre a pesquisa"
        descricao="O nome fica visível só para o RH."
      >
        <div className="pesquisas__campos">
          <label className="pesquisas__campo">
            <span className="pesquisas__rotulo">Nome</span>
            <input
              value={nome}
              maxLength={200}
              onChange={(e) => onNome(e.target.value)}
            />
          </label>
          {erros.nome ? <p className="pesquisas__erro">{erros.nome}</p> : null}
          <label className="pesquisas__campo">
            <span className="pesquisas__rotulo">Descrição (opcional)</span>
            <textarea
              rows={3}
              maxLength={1000}
              value={descricao}
              placeholder="Conte para a pessoa por que a opinião dela importa nos primeiros dias."
              onChange={(e) => onDescricao(e.target.value)}
            />
          </label>
          <p className="pesquisas__suave">
            Sem descrição, quem responde vê um texto padrão conforme a rodada.
          </p>
        </div>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Como as respostas são identificadas"
        descricao="Define o que o RH vê nos resultados. Não muda depois do envio."
      >
        <div
          className="pesquisas__escolhas pesquisas__escolhas--tres"
          role="radiogroup"
          aria-label="Identificação"
        >
          {IDENTIFICACOES.map((i) => (
            <label
              key={i.valor}
              className="pesquisas__escolha pesquisas__escolha--vertical"
            >
              <span className="pesquisas__escolha-topo">
                <strong>{i.rotulo}</strong>
                <input
                  type="radio"
                  name={`${ids}-identificacao`}
                  checked={identificacao === i.valor}
                  onChange={() => onIdentificacao(i.valor)}
                />
              </span>
              <span className="pesquisas__suave">{i.texto}</span>
            </label>
          ))}
        </div>
        <p className="pesquisas__nota">
          {anonima
            ? "Na anônima, o convite leva o link da rodada e não há lembrete: não dá para saber quem já respondeu."
            : identificacao === "confidencial"
              ? "Com CPF confidencial, cargo, unidade e tempo de casa vêm do cadastro: você vê os resultados por grupo sem precisar perguntar. Grupos com menos de 3 respostas ficam ocultos."
              : "Na identificada, o RH vê a resposta de cada pessoa em cada rodada."}
        </p>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Como enviar"
        descricao="Escolha se a pesquisa sai agora, num dia marcado ou sozinha, na data de cada pessoa."
      >
        <div
          className="pesquisas__escolhas pesquisas__escolhas--tres"
          role="radiogroup"
          aria-label="Como enviar"
        >
          {(
            [
              [
                "agora",
                "Enviar agora",
                "Sai assim que você concluir a criação.",
              ],
              ["agendar", "Agendar", "Sai no dia e na hora que você escolher."],
              [
                "automatizar",
                "Automatizar",
                "Sai sozinha na data de cada pessoa, como 30 dias de casa.",
              ],
            ] as const
          ).map(([valor, titulo, texto]) => (
            <label
              key={valor}
              className="pesquisas__escolha pesquisas__escolha--vertical"
            >
              <span className="pesquisas__escolha-topo">
                <strong>{titulo}</strong>
                <input
                  type="radio"
                  name={`${ids}-modo`}
                  checked={config.modo === valor}
                  onChange={() => mudar({ modo: valor })}
                />
              </span>
              <span className="pesquisas__suave">{texto}</span>
            </label>
          ))}
        </div>
      </CartaoDeSecao>

      {config.modo === "automatizar" ? (
        <>
          <CartaoDeSecao
            titulo="Quando enviar"
            descricao="Cada momento é uma rodada com as mesmas perguntas. Recomendamos 30 e 60 dias, que já vêm marcados; 90 dias é opcional."
          >
            <div
              className="onboarding__rodadas"
              role="group"
              aria-label="Rodadas"
            >
              {RODADAS.map((r) => (
                <label
                  key={r.valor}
                  className="pesquisas__escolha pesquisas__escolha--vertical"
                >
                  <span className="pesquisas__escolha-topo">
                    <strong>{r.titulo}</strong>
                    <input
                      type="checkbox"
                      checked={config.rodadas.includes(r.valor)}
                      onChange={(e) =>
                        mudar({
                          rodadas: e.target.checked
                            ? [...config.rodadas, r.valor].sort((a, b) => a - b)
                            : config.rodadas.filter((x) => x !== r.valor),
                        })
                      }
                    />
                  </span>
                  <span className="pesquisas__selo">{r.selo}</span>
                  <span className="pesquisas__suave">{r.texto}</span>
                  {proximas ? (
                    <span className="pesquisas__suave">
                      {textoDasProximas(r.valor, proximas[r.valor])}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
            {erros.rodadas ? (
              <p className="pesquisas__erro">{erros.rodadas}</p>
            ) : null}
          </CartaoDeSecao>
          <CartaoDeSecao
            titulo="Horário, prazo e lembrete"
            descricao="Valem para todas as rodadas."
          >
            <div className="avaliacao__linha-campos">
              <label className="pesquisas__campo">
                <span className="pesquisas__rotulo">Horário do envio</span>
                <select
                  value={config.horario}
                  onChange={(e) => mudar({ horario: e.target.value })}
                >
                  {HORARIOS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="pesquisas__suave">
              Horário de Brasília. O prazo conta do dia em que cada pessoa
              recebe; depois, o link mostra “pesquisa encerrada”.
            </p>
            {prazoELembrete}
            <p className="pesquisas__suave">
              {anonima
                ? "Na anônima não há lembrete."
                : "O lembrete vai só para quem ainda não respondeu."}
            </p>
            <label className="avaliacao__interruptor">
              <input
                type="checkbox"
                role="switch"
                checked={config.soDiasUteis}
                onChange={(e) => mudar({ soDiasUteis: e.target.checked })}
              />
              <span>
                <strong>Só em dias úteis</strong>
                <span className="pesquisas__suave">
                  Se cair em sábado, domingo ou feriado, vai para o próximo dia
                  útil.
                </span>
              </span>
            </label>
            <label className="avaliacao__interruptor">
              <input
                type="checkbox"
                role="switch"
                checked={config.incluirAtrasados}
                onChange={(e) => mudar({ incluirAtrasados: e.target.checked })}
              />
              <span>
                <strong>Incluir quem já passou da data</strong>
                <span className="pesquisas__suave">
                  Quem passou da data há até 30 dias recebe no primeiro envio.
                </span>
              </span>
            </label>
          </CartaoDeSecao>
        </>
      ) : config.modo === "agendar" ? (
        <CartaoDeSecao
          titulo="Quando enviar"
          descricao="O convite sai nesse dia e hora. Até lá, dá para mudar tudo."
        >
          <div className="avaliacao__linha-campos">
            <label className="pesquisas__campo">
              <span className="pesquisas__rotulo">Data do envio</span>
              <input
                type="date"
                value={config.agendadoPara ?? ""}
                onChange={(e) =>
                  mudar({ agendadoPara: e.target.value || null })
                }
              />
            </label>
            <label className="pesquisas__campo">
              <span className="pesquisas__rotulo">Hora do envio</span>
              <select
                value={config.horario}
                onChange={(e) => mudar({ horario: e.target.value })}
              >
                {HORARIOS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {erros.agendadoPara ? (
            <p className="pesquisas__erro">{erros.agendadoPara}</p>
          ) : null}
          <p className="pesquisas__rotulo">
            Prazo e lembrete — contam a partir do dia do envio.
          </p>
          {prazoELembrete}
        </CartaoDeSecao>
      ) : (
        <CartaoDeSecao
          titulo="Prazo e lembrete"
          descricao="Contam a partir do dia do envio."
        >
          {prazoELembrete}
        </CartaoDeSecao>
      )}
    </>
  );
}

function EtapaPerguntas({
  secoes,
  onMudar,
}: {
  readonly secoes: Secao[];
  readonly onMudar: (s: Secao[]) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(secoes[0]?.id ?? null);
  const contagem = contarPerguntas(secoes);
  const trocar = (secaoId: string, f: (s: Secao) => Secao) =>
    onMudar(secoes.map((s) => (s.id === secaoId ? f(s) : s)));
  return (
    <CartaoDeSecao
      titulo="Perguntas"
      contador={String(contagem.perguntas)}
      descricao="Modelo Onboarding. Edite, adicione ou exclua perguntas; quem responde vê um bloco por vez."
      acao={
        <Button
          variant="secondary"
          onClick={() => {
            const id = novoId();
            onMudar([
              ...secoes,
              { id, titulo: "Novo bloco", descricao: null, perguntas: [] },
            ]);
            setAberto(id);
          }}
        >
          <IconeMais tamanho={16} /> Adicionar bloco
        </Button>
      }
    >
      <p className="pesquisas__suave">{textoDaContagem(contagem)}</p>
      <p className="pesquisas__nota">
        Depois da primeira resposta, as perguntas não mudam mais: as respostas
        já dadas continuam ligadas ao que foi perguntado.
      </p>
      {secoes.map((s) => {
        const expandido = aberto === s.id;
        return (
          <section
            key={s.id}
            className="onboarding__bloco"
            aria-label={s.titulo ?? "Bloco"}
          >
            <div className="avaliacao__time-cabeca">
              <button
                type="button"
                className="avaliacao__competencia-cabeca"
                aria-expanded={expandido}
                onClick={() => setAberto(expandido ? null : s.id)}
              >
                <strong>{s.titulo}</strong>
                <span className="pesquisas__suave">{`· ${plural(s.perguntas.length, "pergunta", "perguntas")}`}</span>
              </button>
              <IconButton
                label={`Excluir o bloco ${s.titulo ?? ""}`}
                icon={<IconeRemover tamanho={16} />}
                variant="subtle"
                onClick={() => onMudar(secoes.filter((x) => x.id !== s.id))}
              />
            </div>
            {expandido ? (
              <>
                <ol className="onboarding__lista">
                  {s.perguntas.map((p, i) =>
                    editando === p.id ? (
                      <li key={p.id}>
                        <EditorDaPergunta
                          pergunta={p}
                          onCancelar={() => setEditando(null)}
                          onSalvar={(nova) => {
                            trocar(s.id, (x) => ({
                              ...x,
                              perguntas: x.perguntas.map((y) =>
                                y.id === p.id ? nova : y,
                              ),
                            }));
                            setEditando(null);
                          }}
                          onExcluir={() => {
                            trocar(s.id, (x) => ({
                              ...x,
                              perguntas: x.perguntas.filter(
                                (y) => y.id !== p.id,
                              ),
                            }));
                            setEditando(null);
                          }}
                        />
                      </li>
                    ) : (
                      <li key={p.id} className="onboarding__pergunta">
                        <span className="pesquisas__numero-pergunta">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>
                          {p.texto}
                          {p.obrigatoria ? (
                            ""
                          ) : (
                            <span className="pesquisas__suave">
                              {" "}
                              (opcional)
                            </span>
                          )}
                        </span>
                        <span className="pesquisas__selo">
                          {
                            TIPOS_DO_ONBOARDING.find(
                              (t) => t.valor === tipoDaPergunta(p),
                            )!.rotulo
                          }
                        </span>
                        <button
                          type="button"
                          className="pesquisas__acao-texto"
                          onClick={() => setEditando(p.id)}
                        >
                          Editar
                        </button>
                      </li>
                    ),
                  )}
                </ol>
                <button
                  type="button"
                  className="pesquisas__acao-texto"
                  onClick={() => {
                    const nova = comTipo(
                      {
                        id: novoId(),
                        tipo: "escala",
                        texto: "Nova pergunta",
                        rotulo: null,
                        descricao: null,
                        obrigatoria: true,
                        config: {},
                        condicao: null,
                      },
                      "concord4",
                    );
                    trocar(s.id, (x) => ({
                      ...x,
                      perguntas: [...x.perguntas, nova],
                    }));
                    setEditando(nova.id);
                  }}
                >
                  <IconeMais tamanho={14} />{" "}
                  {`Nova pergunta em ${s.titulo ?? "este bloco"}`}
                </button>
              </>
            ) : null}
          </section>
        );
      })}
    </CartaoDeSecao>
  );
}

function EditorDaPergunta({
  pergunta,
  onSalvar,
  onCancelar,
  onExcluir,
}: {
  readonly pergunta: Pergunta;
  readonly onSalvar: (p: Pergunta) => void;
  readonly onCancelar: () => void;
  readonly onExcluir: () => void;
}) {
  const [texto, setTexto] = useState(pergunta.texto);
  const [tipo, setTipo] = useState<TipoDoOnboarding>(tipoDaPergunta(pergunta));
  const [obrigatoria, setObrigatoria] = useState(pergunta.obrigatoria);
  const ajuda = TIPOS_DO_ONBOARDING.find((t) => t.valor === tipo)!.ajuda;
  const pronta = useMemo(
    () => ({
      ...comTipo(pergunta, tipo),
      ...(tipoDaPergunta(pergunta) === tipo
        ? { config: pergunta.config, tipo: pergunta.tipo }
        : {}),
    }),
    [pergunta, tipo],
  );
  return (
    <div
      className="pesquisas__caixa-inline"
      role="group"
      aria-label="Editar pergunta"
    >
      <label className="pesquisas__campo">
        <span className="pesquisas__rotulo">Texto da pergunta</span>
        <textarea
          rows={2}
          maxLength={300}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>
      <p className="pesquisas__suave">{`${texto.length} de 300`}</p>
      <label className="pesquisas__campo">
        <span className="pesquisas__rotulo">Tipo</span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDoOnboarding)}
        >
          {TIPOS_DO_ONBOARDING.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      <p className="pesquisas__suave">{ajuda}</p>
      <label className="avaliacao__interruptor">
        <input
          type="checkbox"
          role="switch"
          checked={obrigatoria}
          onChange={(e) => setObrigatoria(e.target.checked)}
        />
        <span>
          <strong>Obrigatória</strong>
        </span>
      </label>
      <div className="pesquisas__caixa-inline-rodape">
        <Button variant="subtle" onClick={onExcluir}>
          Excluir
        </Button>
        <Button variant="secondary" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          disabled={!texto.trim()}
          onClick={() =>
            onSalvar({ ...pronta, texto: texto.trim(), obrigatoria })
          }
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function EtapaPublico({
  ids,
  publico,
  onPublico,
  previa,
  todas,
  grupos,
}: {
  readonly ids: string;
  readonly publico: Publico;
  readonly onPublico: (p: Publico) => void;
  readonly previa: PreviaDoPublico | null;
  /** Todas as pessoas ativas (a lista para marcar). */
  readonly todas: readonly PessoaDoPublico[];
  readonly grupos: GruposDoPublico | null;
}) {
  const [filtro, setFiltro] = useState<"todos" | "sim" | "nao" | "sem_email">(
    "todos",
  );
  const [busca, setBusca] = useState("");
  const escolhidos = new Set(
    publico.tipo === "pessoas" ? publico.colaboradorIds : [],
  );
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const pessoas = todas.filter((p) => {
    if (termo && !p.nome.toLocaleLowerCase("pt-BR").includes(termo))
      return false;
    if (filtro === "sim") return escolhidos.has(p.colaboradorId);
    if (filtro === "nao") return !escolhidos.has(p.colaboradorId);
    if (filtro === "sem_email") return !p.temEmail;
    return true;
  });
  return (
    <CartaoDeSecao
      titulo="Quem recebe"
      descricao="Quem recebe é conferido na hora do envio."
    >
      <div
        className="pesquisas__escolhas pesquisas__escolhas--tres"
        role="radiogroup"
        aria-label="Quem recebe"
      >
        {(
          [
            [
              "todos",
              "Todos",
              `Todos os colaboradores ativos${todas.length ? `: ${plural(todas.length, "pessoa", "pessoas")}` : ""}.`,
            ],
            [
              "grupo",
              "Por grupo",
              "Departamento, cargo, unidade ou centro de custo.",
            ],
            ["pessoas", "Escolher pessoas", "Você marca cada pessoa na lista."],
          ] as const
        ).map(([valor, titulo, texto]) => (
          <label
            key={valor}
            className="pesquisas__escolha pesquisas__escolha--vertical"
          >
            <span className="pesquisas__escolha-topo">
              <strong>{titulo}</strong>
              <input
                type="radio"
                name={`${ids}-publico`}
                checked={publico.tipo === valor}
                onChange={() =>
                  onPublico(
                    valor === "todos"
                      ? { tipo: "todos" }
                      : valor === "grupo"
                        ? {
                            tipo: "grupo",
                            condicoes: [
                              {
                                campo: "departamento",
                                operador: "e",
                                valores: [],
                              },
                            ],
                          }
                        : { tipo: "pessoas", colaboradorIds: [] },
                  )
                }
              />
            </span>
            <span className="pesquisas__suave">{texto}</span>
          </label>
        ))}
      </div>

      {publico.tipo === "grupo" ? (
        <div aria-label="Quem entra no grupo" role="group">
          <p className="pesquisas__rotulo">
            Quem entra no grupo — a pessoa precisa atender a todas as condições.
          </p>
          {publico.condicoes.map((c, i) => {
            const opcoes = grupos?.[c.campo] ?? [];
            const trocar = (nova: (typeof publico.condicoes)[number]) =>
              onPublico({
                ...publico,
                condicoes: publico.condicoes.map((x, j) =>
                  j === i ? nova : x,
                ),
              });
            return (
              <div key={i} className="onboarding__condicao">
                <select
                  aria-label={`Campo da condição ${i + 1}`}
                  value={c.campo}
                  onChange={(e) =>
                    trocar({
                      ...c,
                      campo: e.target.value as CampoDoPublico,
                      valores: [],
                    })
                  }
                >
                  {(Object.keys(ROTULO_DO_CAMPO) as CampoDoPublico[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {ROTULO_DO_CAMPO[k]}
                      </option>
                    ),
                  )}
                </select>
                <select
                  aria-label={`Operador da condição ${i + 1}`}
                  value={c.operador}
                  onChange={(e) =>
                    trocar({
                      ...c,
                      operador: e.target.value as "e" | "uma_destas",
                      valores: c.valores.slice(0, 1),
                    })
                  }
                >
                  <option value="e">é</option>
                  <option value="uma_destas">é uma destas</option>
                </select>
                <select
                  aria-label={`Valor da condição ${i + 1}`}
                  multiple={c.operador === "uma_destas"}
                  value={
                    c.operador === "uma_destas"
                      ? c.valores
                      : (c.valores[0] ?? "")
                  }
                  onChange={(e) =>
                    trocar({
                      ...c,
                      valores:
                        c.operador === "uma_destas"
                          ? Array.from(e.target.selectedOptions).map(
                              (o) => o.value,
                            )
                          : e.target.value
                            ? [e.target.value]
                            : [],
                    })
                  }
                >
                  {c.operador === "e" ? (
                    <option value="">Escolha</option>
                  ) : null}
                  {opcoes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
                <IconButton
                  label={`Tirar a condição ${i + 1}`}
                  icon={<IconeRemover tamanho={16} />}
                  variant="subtle"
                  disabled={publico.condicoes.length === 1}
                  onClick={() =>
                    onPublico({
                      ...publico,
                      condicoes: publico.condicoes.filter((_, j) => j !== i),
                    })
                  }
                />
              </div>
            );
          })}
          <button
            type="button"
            className="pesquisas__acao-texto"
            onClick={() =>
              onPublico({
                ...publico,
                condicoes: [
                  ...publico.condicoes,
                  { campo: "cargo", operador: "e", valores: [] },
                ],
              })
            }
          >
            <IconeMais tamanho={14} /> Adicionar condição
          </button>
        </div>
      ) : null}

      {publico.tipo === "pessoas" ? (
        <div>
          <div
            className="pesquisas__pilulas"
            role="group"
            aria-label="Filtrar pessoas"
          >
            {(
              [
                ["todos", "Todos"],
                ["sim", `Selecionados (${escolhidos.size})`],
                ["nao", "Não selecionados"],
                ["sem_email", "Sem e-mail"],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                aria-pressed={filtro === v}
                onClick={() => setFiltro(v)}
              >
                {r}
              </button>
            ))}
          </div>
          <CampoDeBusca
            rotulo="Buscar pessoa"
            valor={busca}
            onMudar={setBusca}
          />
          <ul className="avaliacao__escolher">
            {pessoas.map((p) => (
              <li key={p.colaboradorId} className="avaliacao__pessoa">
                <input
                  type="checkbox"
                  aria-label={`Escolher ${p.nome}`}
                  checked={escolhidos.has(p.colaboradorId)}
                  onChange={(e) =>
                    onPublico({
                      tipo: "pessoas",
                      colaboradorIds: e.target.checked
                        ? [...escolhidos, p.colaboradorId]
                        : [...escolhidos].filter((x) => x !== p.colaboradorId),
                    })
                  }
                />
                <span>
                  {p.nome}
                  <span className="pesquisas__suave">
                    {` · ${[p.cargo, p.departamento, p.unidade].filter(Boolean).join(" · ") || "Sem lotação"}`}
                  </span>
                </span>
                {!p.temEmail ? (
                  <span className="avaliacao__aviso avaliacao__aviso--atencao">
                    Sem e-mail
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {previa ? (
        <div className="pesquisas__nota" role="status">
          <strong>{`${plural(previa.total, "colaborador está", "colaboradores estão")} no público hoje`}</strong>
          {previa.semEmail ? (
            <p className="avaliacao__aviso avaliacao__aviso--atencao">
              {`${plural(previa.semEmail, "pessoa não tem", "pessoas não têm")} e-mail cadastrado e não recebe${previa.semEmail === 1 ? "" : "m"} o convite. `}
              <a
                href="#/pessoas/colaboradores"
                target="_blank"
                rel="noopener noreferrer"
              >
                Completar cadastro
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </CartaoDeSecao>
  );
}

/** O aviso do "Enviar teste" enquanto o envio de e-mail não está ligado. */
const MOTIVO_DO_TESTE =
  "O envio de e-mail entra na próxima etapa do Evolli. Até lá, use a prévia para ver o convite e a pesquisa.";

function EtapaEmail({
  ids,
  config,
  mudar,
  empresa,
  anonima,
  perguntas,
  minutos,
  pessoas,
}: {
  readonly ids: string;
  readonly config: ConfigOnboarding;
  readonly mudar: (m: Partial<ConfigOnboarding>) => void;
  readonly empresa: string | null;
  readonly anonima: boolean;
  readonly perguntas: number;
  readonly minutos: number;
  /** Quem está no público hoje (o "Ver como"). */
  readonly pessoas: readonly PessoaDoPublico[];
}) {
  const e = config.email;
  const personalizado = e.modelo === "personalizado";
  const [aba, setAba] = useState<"texto" | "aparencia">("texto");
  const [verComo, setVerComo] = useState<string | null>(null);
  const [hex, setHex] = useState(e.corPrincipal ?? "");
  const exemplo =
    pessoas.find((p) => p.colaboradorId === verComo) ?? pessoas[0] ?? null;
  const nomeDaEmpresa = empresa?.trim() || null;
  const corPrincipal = personalizado ? (e.corPrincipal ?? null) : null;
  const corFundo = personalizado ? (e.corFundo ?? null) : null;
  const assunto =
    personalizado && e.assunto
      ? e.assunto
      : `Como estão seus primeiros dias ${naEmpresa(empresa)}?`;
  const titulo =
    personalizado && e.titulo ? e.titulo : "Como estão seus primeiros dias?";
  const mensagem =
    personalizado && e.mensagem
      ? e.mensagem
      : `Você está nos primeiros dias e queremos saber como está a sua chegada. São ${plural(perguntas, "pergunta", "perguntas")}, cerca de ${plural(minutos, "minuto", "minutos")}, sem resposta certa.`;
  const mudarEmail = (m: Partial<ConfigOnboarding["email"]>) =>
    mudar({ email: { ...e, ...m } });
  return (
    <div className="avaliacao__indicadores">
      <CartaoDeSecao
        titulo="Prévia do convite"
        descricao="Assim o e-mail chega para a pessoa."
      >
        {pessoas.length ? (
          <label className="pesquisas__campo onboarding__ver-como">
            <span className="pesquisas__rotulo">Ver como</span>
            <select
              value={exemplo?.colaboradorId ?? ""}
              onChange={(x) => setVerComo(x.target.value)}
            >
              {pessoas.map((p) => (
                <option key={p.colaboradorId} value={p.colaboradorId}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div
          className="avaliacao__previa-email onboarding__convite"
          role="group"
          aria-label="Prévia do e-mail"
          style={corFundo ? { background: corFundo } : undefined}
        >
          <p className="pesquisas__suave">{`De: ${nomeDaEmpresa ?? "Empresa"}`}</p>
          <p className="pesquisas__suave">{`Para: ${exemplo?.nome ?? "[nome]"}`}</p>
          <p className="pesquisas__suave">{`Assunto: ${assunto}`}</p>
          <span
            className="onboarding__sigla"
            aria-label={`Sigla de ${nomeDaEmpresa ?? "empresa"}`}
            style={
              corPrincipal
                ? {
                    background: corPrincipal,
                    color: corDoTextoSobre(corPrincipal),
                  }
                : undefined
            }
          >
            {siglaDaEmpresa(nomeDaEmpresa)}
          </span>
          <p>
            <strong>{titulo}</strong>
          </p>
          <p>
            {exemplo ? `Olá, ${primeiroNome(exemplo.nome)},` : "Olá, [nome],"}
          </p>
          {mensagem.split(/\n\s*\n/).map((par, i) => (
            <p key={i}>{par}</p>
          ))}
          <p>
            <span
              className="avaliacao__previa-botao"
              style={
                corPrincipal
                  ? {
                      background: corPrincipal,
                      color: corDoTextoSobre(corPrincipal),
                    }
                  : undefined
              }
            >
              Responder pesquisa →
            </span>
          </p>
          <p className="pesquisas__suave">
            {anonima
              ? "Suas respostas são anônimas: ninguém fica sabendo quem respondeu."
              : "Suas respostas são confidenciais."}
          </p>
        </div>
        <p className="avaliacao__aviso avaliacao__aviso--info" role="note">
          O envio por e-mail entra na próxima etapa do Evolli. Até lá, os
          convites ficam aguardando e-mail.
        </p>
        <BotaoDeTeste ids={ids} />
      </CartaoDeSecao>
      <CartaoDeSecao titulo="Modelo do e-mail">
        <div
          className="pesquisas__escolhas"
          role="radiogroup"
          aria-label="Modelo do e-mail"
        >
          <label className="pesquisas__escolha pesquisas__escolha--vertical">
            <span className="pesquisas__escolha-topo">
              <strong>Padrão</strong>
              <input
                type="radio"
                name={`${ids}-email`}
                checked={!personalizado}
                onChange={() => mudarEmail({ modelo: "padrao" })}
              />
            </span>
            <span className="pesquisas__suave">
              Texto e visual prontos; mudam sozinhos a cada rodada. Não pode ser
              editado.
            </span>
          </label>
          <label className="pesquisas__escolha pesquisas__escolha--vertical">
            <span className="pesquisas__escolha-topo">
              <strong>Personalizado</strong>
              <input
                type="radio"
                name={`${ids}-email`}
                checked={personalizado}
                onChange={() => mudarEmail({ modelo: "personalizado" })}
              />
            </span>
            <span className="pesquisas__suave">
              Seu texto. Vale só para as pesquisas de onboarding.
            </span>
          </label>
        </div>
        {personalizado ? (
          <div
            role="tablist"
            aria-label="E-mail personalizado"
            className="pesquisas__abas"
          >
            <button
              type="button"
              role="tab"
              className="evolli-aba"
              aria-selected={aba === "texto"}
              onClick={() => setAba("texto")}
            >
              Texto
            </button>
            <button
              type="button"
              role="tab"
              className="evolli-aba"
              aria-selected={aba === "aparencia"}
              onClick={() => setAba("aparencia")}
            >
              Logo e cores
            </button>
          </div>
        ) : null}
        {personalizado && aba === "aparencia" ? (
          <div className="pesquisas__campos" role="tabpanel">
            <div className="onboarding__logo">
              <span className="pesquisas__rotulo">Logo</span>
              <span className="onboarding__sigla" aria-hidden="true">
                {siglaDaEmpresa(nomeDaEmpresa)}
              </span>
              <Button
                variant="secondary"
                disabled
                aria-describedby={`${ids}-logo-motivo`}
              >
                Enviar logo
              </Button>
              <p id={`${ids}-logo-motivo`} className="pesquisas__suave">
                O logo entra junto com o envio de e-mail. Até lá, o convite
                mostra a sigla da empresa.
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label="Cor principal"
              className="onboarding__cores"
            >
              <span className="pesquisas__rotulo">Cor principal</span>
              {CORES_PRINCIPAIS.map((c) => (
                <label key={c.cor} className="onboarding__amostra">
                  <input
                    type="radio"
                    name={`${ids}-cor`}
                    checked={e.corPrincipal === c.cor}
                    onChange={() => {
                      setHex(c.cor);
                      mudarEmail({ corPrincipal: c.cor });
                    }}
                  />
                  <span style={{ background: c.cor }} aria-hidden="true" />
                  <span className="onboarding__invisivel">{c.nome}</span>
                </label>
              ))}
              <label className="pesquisas__campo">
                <span className="pesquisas__rotulo">Código da cor</span>
                <input
                  value={hex}
                  maxLength={7}
                  placeholder="#1f6feb"
                  aria-invalid={hex && !corValida(hex) ? true : undefined}
                  onChange={(x) => {
                    const v = x.target.value.trim();
                    setHex(v);
                    if (corValida(v))
                      mudarEmail({ corPrincipal: v.toLowerCase() });
                    else if (!v) mudarEmail({ corPrincipal: null });
                  }}
                />
              </label>
              {hex && !corValida(hex) ? (
                <p className="pesquisas__erro">Use o formato #RRGGBB.</p>
              ) : null}
              <p className="pesquisas__suave">
                O texto do botão fica branco ou preto, o que der mais contraste.
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label="Cor do fundo"
              className="onboarding__cores"
            >
              <span className="pesquisas__rotulo">Cor do fundo</span>
              {CORES_DE_FUNDO.filter((c) => fundoClaro(c.cor)).map((c) => (
                <label key={c.cor} className="onboarding__amostra">
                  <input
                    type="radio"
                    name={`${ids}-fundo`}
                    checked={(e.corFundo ?? "#ffffff") === c.cor}
                    onChange={() =>
                      mudarEmail({
                        corFundo: c.cor === "#ffffff" ? null : c.cor,
                      })
                    }
                  />
                  <span style={{ background: c.cor }} aria-hidden="true" />
                  <span className="onboarding__invisivel">{c.nome}</span>
                </label>
              ))}
              <p className="pesquisas__suave">
                Só cores claras, para o texto continuar legível.
              </p>
            </div>
          </div>
        ) : null}
        {personalizado && aba === "texto" ? (
          <div className="pesquisas__campos" role="tabpanel">
            <label className="pesquisas__campo">
              <span className="pesquisas__rotulo">Assunto</span>
              <input
                maxLength={80}
                value={e.assunto ?? ""}
                onChange={(x) => mudarEmail({ assunto: x.target.value })}
              />
            </label>
            <label className="pesquisas__campo">
              <span className="pesquisas__rotulo">Título</span>
              <input
                maxLength={60}
                value={e.titulo ?? ""}
                onChange={(x) => mudarEmail({ titulo: x.target.value })}
              />
            </label>
            <label className="pesquisas__campo">
              <span className="pesquisas__rotulo">Mensagem</span>
              <textarea
                rows={5}
                maxLength={600}
                value={e.mensagem ?? ""}
                onChange={(x) => mudarEmail({ mensagem: x.target.value })}
              />
            </label>
            <p className="pesquisas__suave">
              O mesmo texto vai para todas as pessoas e em todas as rodadas. A
              saudação, o botão, o prazo e o rodapé entram sozinhos. Separe os
              parágrafos com uma linha em branco.
            </p>
          </div>
        ) : null}
      </CartaoDeSecao>
    </div>
  );
}

/** "Enviar teste para mim": preparado, desligado até o envio de e-mail. */
function BotaoDeTeste({ ids }: { readonly ids: string }) {
  return (
    <div className="onboarding__teste">
      <Button
        variant="secondary"
        disabled
        aria-describedby={`${ids}-teste-motivo`}
      >
        Enviar teste para mim
      </Button>
      <p id={`${ids}-teste-motivo`} className="pesquisas__suave">
        {MOTIVO_DO_TESTE}
      </p>
    </div>
  );
}

function EtapaEnviar({
  nome,
  identificacao,
  config,
  contagem,
  perguntas,
  blocos,
  previa,
  empresa,
  onEditar,
  onAbrirPrevia,
}: {
  readonly nome: string;
  readonly identificacao: Identificacao;
  readonly config: ConfigOnboarding;
  readonly contagem: string;
  readonly perguntas: number;
  readonly blocos: number;
  readonly previa: PreviaDoPublico | null;
  readonly empresa: string | null;
  readonly onEditar: (etapa: number) => void;
  /** Sem rascunho gravado ainda, a prévia não abre. */
  readonly onAbrirPrevia: (() => void) | undefined;
}) {
  const ids = useId();
  const ident = IDENTIFICACOES.find((i) => i.valor === identificacao)!;
  const regra =
    config.publico.tipo === "todos"
      ? "Todos os colaboradores ativos"
      : config.publico.tipo === "grupo"
        ? plural(config.publico.condicoes.length, "condição", "condições")
        : plural(
            config.publico.colaboradorIds.length,
            "pessoa escolhida",
            "pessoas escolhidas",
          );
  return (
    <>
      <CartaoDeSecao
        titulo="Revisar e enviar"
        descricao="Confira antes de enviar."
      >
        <div className="onboarding__numeros">
          <div>
            <span className="pesquisas__suave">Perguntas</span>
            <strong>{perguntas}</strong>
            <span className="pesquisas__suave">{`em ${plural(blocos, "bloco", "blocos")}`}</span>
          </div>
          <div>
            <span className="pesquisas__suave">Pessoas no grupo</span>
            <strong>{previa?.total ?? "—"}</strong>
            <span className="pesquisas__suave">
              {previa ? `${previa.total - previa.semEmail} com e-mail` : ""}
            </span>
          </div>
          <div>
            <span className="pesquisas__suave">Envio</span>
            <strong>
              {config.modo === "agora"
                ? "Agora"
                : config.modo === "agendar"
                  ? "Agendado"
                  : "Automático"}
            </strong>
            <span className="pesquisas__suave">{resumoDoEnvio(config)}</span>
          </div>
          <div>
            <span className="pesquisas__suave">Prazo</span>
            <strong>{plural(config.prazoDias, "dia", "dias")}</strong>
            <span className="pesquisas__suave">depois do envio</span>
          </div>
        </div>
      </CartaoDeSecao>
      <CartaoDeSecao titulo="Resumo">
        <dl className="avaliacao__resumo">
          <div>
            <dt>Envio</dt>
            <dd>{`${resumoDoEnvio(config)} · ${textoDoPrazoELembrete(config)}`}</dd>
            <button
              type="button"
              className="pesquisas__acao-texto"
              onClick={() => onEditar(0)}
            >
              Editar
            </button>
          </div>
          <div>
            <dt>Pesquisa</dt>
            <dd>{`${nome} · ${ident.rotulo} · ${contagem}`}</dd>
            <button
              type="button"
              className="pesquisas__acao-texto"
              onClick={() => onEditar(1)}
            >
              Editar
            </button>
          </div>
          <div>
            <dt>Quem recebe</dt>
            <dd>
              {regra}
              {previa
                ? ` · ${plural(previa.total, "pessoa", "pessoas")} no grupo hoje · ${plural(previa.semEmail, "sem e-mail", "sem e-mail")}`
                : ""}
            </dd>
            <button
              type="button"
              className="pesquisas__acao-texto"
              onClick={() => onEditar(2)}
            >
              Editar
            </button>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>
              {`Remetente ${empresa?.trim() || "a empresa ativa"} · ${config.email.modelo === "padrao" ? "Padrão" : "Personalizado"}`}
            </dd>
            <button
              type="button"
              className="pesquisas__acao-texto"
              onClick={() => onEditar(3)}
            >
              Editar
            </button>
          </div>
        </dl>
      </CartaoDeSecao>
      <CartaoDeSecao
        titulo="Teste antes de enviar"
        descricao="Receba o e-mail e veja a pesquisa como a pessoa vê. Nada entra nos resultados."
      >
        <div className="pesquisas__acoes">
          <Button
            variant="secondary"
            disabled={!onAbrirPrevia}
            onClick={() => onAbrirPrevia?.()}
          >
            Abrir prévia
          </Button>
        </div>
        <BotaoDeTeste ids={ids} />
      </CartaoDeSecao>
    </>
  );
}
