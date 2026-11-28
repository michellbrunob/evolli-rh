/**
 * T216 — assistente dos modelos prontos, com a barra de etapas na
 * horizontal: Configurar (perguntas e identificação) → Colaboradores (quem
 * responde) → Enviar (revisão, prazo e gerar). Na anônima não há lista de
 * pessoas: quem tiver o link responde, e são 2 etapas.
 *
 * O rascunho é gravado sozinho no servidor (ao abrir e a cada mudança, com
 * uma pequena espera) e o cabeçalho mostra a hora da última gravação.
 * "Cancelar" guarda o rascunho e volta à galeria. Depois de publicada, as
 * mudanças só valem no "Salvar alterações".
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Pergunta, PesquisaDetalhe } from "../../api/pesquisasClient";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { IconButton } from "../../ui";
import {
  IconeArrastar,
  IconeComentario,
  IconeEditar,
  IconeFechar,
  IconeMais,
  IconeRemover,
  IconeVisto,
  IconeVoltar,
} from "../../ui/icones";
import { AvisoNaoIdentificaveis } from "./AvisoNaoIdentificaveis";
import { GarantirAvisos, useAvisar } from "./avisos";
import { usePublicarComConfirmacao } from "./confirmarPublicacao";
import { CartaoDeEncerramento } from "./CartaoDeEncerramento";
import { enderecoDaPrevia } from "./rotasDePesquisas";
import { SepararRespostasPor } from "./SepararRespostasPor";
import {
  AvisoDaSaudeFinanceira,
  InterruptorDaAutopercepcao,
} from "./modelos/isfb/Autopercepcao";
import {
  BarraDeEtapas,
  CartaoDeSecao,
  ICONE_DA_IDENTIFICACAO,
  IconeDoModelo,
} from "./componentes";
import {
  entradaDoEstado,
  entradaDoRascunho,
  estadoDoDetalhe,
  estadoDoModelo,
  excluirPergunta,
  levarPerguntaPara,
  perguntasEmOrdem,
  validarEnvio,
  validarPerguntas,
  validarSobre,
  type Erros,
  type EstadoDaPesquisa,
} from "./estadoDaPesquisa";
import { EtapaColaboradores } from "./EtapaColaboradores";
import { modeloDaGaleria, type ModeloDaGaleria } from "./modelosDePesquisa";
import { PerguntasFixas } from "./modelos/PerguntasFixas";
import {
  PerguntasDoClima,
  resumoDasPerguntasDoClima,
} from "./modelos/clima/PerguntasDoClima";
import { seloDoTipoDaPergunta } from "./modelos/selos";
import { textoParaOPainel } from "./modelos/empresa";
import { CartaoDosBlocos } from "./modelos/disc/CartaoDosBlocos";
import { minutosEstimados } from "./tempoEstimado";
import { lembrarRascunho } from "./rascunhosLocais";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import { TelaDeGerada } from "./TelaDeGerada";
import { voltarAoTopo } from "./voltarAoTopo";
import {
  IDENTIFICACOES,
  LIMITES,
  ROTULO_DA_IDENTIFICACAO,
  novoId,
} from "./textosDasPesquisas";
import { mensagemDaFalha } from "./falhasDaGravacao";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";

const ETAPAS_COMPLETAS = [
  { titulo: "Configurar", subtitulo: "Perguntas e identificação" },
  { titulo: "Colaboradores", subtitulo: "Quem vai responder" },
  { titulo: "Enviar", subtitulo: "Link e prazo" },
] as const;

/** Primeira letra minúscula, sem estragar siglas ("eNPS 0–10"). */
function minusculaSemSigla(texto: string): string {
  return /^[A-Z][a-z]/.test(texto)
    ? texto.charAt(0).toLowerCase() + texto.slice(1)
    : texto;
}

/** Selo curto do tipo da pergunta ("Escala 1–10", "eNPS 0–10"). */
export const seloDoTipo = seloDoTipoDaPergunta;

/** "Nova pesquisa Pulso", "Nova pesquisa de Clima", "Nova pesquisa Pulso e Clima". */
export function tituloDoAssistente(m: ModeloDaGaleria): string {
  return /^Pesquisa /.test(m.nome)
    ? `Nova ${m.nome.charAt(0).toLowerCase()}${m.nome.slice(1)}`
    : `Nova pesquisa ${m.nome}`;
}

/** A faixa que explica a escala das perguntas que o modelo adiciona. */
function explicacaoDaEscala(m: ModeloDaGaleria): {
  titulo: string;
  texto: string;
  valores: number[];
} | null {
  const { tipo, config } = m.perguntaPadrao;
  if (tipo === "escala") {
    const min = config.minimo ?? 1;
    const max = config.maximo ?? 10;
    return {
      titulo: `Escala de ${min} a ${max}`,
      texto: `${min} = ${config.rotuloMinimo ?? "mínimo"} · ${max} = ${config.rotuloMaximo ?? "máximo"}`,
      valores: Array.from({ length: max - min + 1 }, (_, i) => min + i),
    };
  }
  if (tipo === "concordancia")
    return {
      titulo: "Concordância de 1 a 5",
      texto: "1 = Discordo totalmente · 5 = Concordo totalmente",
      valores: [1, 2, 3, 4, 5],
    };
  if (tipo === "estrelas")
    return {
      titulo: "Estrelas de 1 a 5",
      texto: "1 = muito ruim · 5 = excelente",
      valores: [1, 2, 3, 4, 5],
    };
  return null;
}

const horaDe = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** A tela sozinha (fora do módulo) ganha o próprio provedor de avisos. */
export function AssistenteDoModelo(
  props: Parameters<typeof AssistenteDoModeloInterno>[0],
) {
  return (
    <GarantirAvisos>
      <AssistenteDoModeloInterno {...props} />
    </GarantirAvisos>
  );
}

function AssistenteDoModeloInterno({
  servico,
  modeloId,
  base,
  hoje,
  agora = () => new Date(),
  atrasoDoRascunho = 1200,
  onCancelar,
  onConcluir,
  onVerResultados,
  onEditarGerada,
  onRascunhoCriado,
}: {
  readonly servico: ServicoDePesquisas;
  /** O primeiro rascunho foi gravado (a rota passa a apontar para ele). */
  readonly onRascunhoCriado?: (id: string) => void;
  /** Nova pesquisa a partir do modelo pronto. */
  readonly modeloId?: string;
  /** Rascunho retomado ou pesquisa publicada em edição. */
  readonly base?: PesquisaDetalhe;
  readonly hoje: string;
  readonly agora?: () => Date;
  /** Espera (ms) antes de gravar o rascunho depois de uma mudança. */
  readonly atrasoDoRascunho?: number;
  /** Sair: rascunho guardado (ou edição descartada). */
  readonly onCancelar: (mensagem?: string) => void;
  readonly onConcluir: () => void;
  readonly onVerResultados: (id: string, mensagem?: string) => void;
  readonly onEditarGerada: (pesquisa: PesquisaDetalhe) => void;
}) {
  const ids = useId();
  const [estado, setEstado] = useState<EstadoDaPesquisa>(() =>
    base ? estadoDoDetalhe(base) : estadoDoModelo(modeloId ?? "pulso", hoje),
  );
  const m = modeloDaGaleria(base ? base.modelo : (modeloId ?? "pulso"));
  const publicadaAntes = estado.status !== "rascunho";
  const anonima = estado.identificacao === "anonima";
  const etapas = anonima
    ? [ETAPAS_COMPLETAS[0], ETAPAS_COMPLETAS[2]]
    : [...ETAPAS_COMPLETAS];
  const [etapa, setEtapa] = useState(0);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvoAs, setSalvoAs] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const confirmacao = usePublicarComConfirmacao(servico);
  const [gravada, setGravada] = useState<PesquisaDetalhe | null>(base ?? null);
  const [gerada, setGerada] = useState<PesquisaDetalhe | null>(null);
  const [criadaAs, setCriadaAs] = useState<string | null>(null);
  const [totalDoTime, setTotalDoTime] = useState<number | null>(null);
  const [referencia, setReferencia] = useState(() =>
    base ? JSON.stringify(entradaDoEstado(estadoDoDetalhe(base))) : "",
  );

  const idRef = useRef<string | null>(estado.id);
  const filaRef = useRef<Promise<unknown>>(Promise.resolve());
  /** O conteúdo cuja gravação automática falhou: só tenta de novo com outra mudança. */
  const falhouRef = useRef<string | null>(null);
  /** Funções vindas de fora, lidas na hora (o shell as recria a cada desenho). */
  const externosRef = useRef({
    servico,
    agora,
    onRascunhoCriado,
    hoje,
    gravada,
  });
  externosRef.current = { servico, agora, onRascunhoCriado, hoje, gravada };
  // Prazo ou mínimo ainda inválidos não barram o resto do rascunho.
  const entrada = useMemo(
    () => entradaDoRascunho(estado, hoje, gravada),
    [estado, hoje, gravada],
  );
  const serial = JSON.stringify(entrada);
  const pendente = serial !== referencia;
  const etapaDaApi = anonima && etapa === 1 ? 2 : etapa;

  useEdicaoEmAndamento(
    publicadaAntes ? `Editar ${estado.nome}` : tituloDoAssistente(m),
    {
      pendente: pendente && gerada === null,
      salvando: gravando,
    },
  );

  /** Grava o rascunho (cria na primeira vez), em fila. */
  const gravar = useCallback((e: EstadoDaPesquisa): Promise<string | null> => {
    const corpo = entradaDoRascunho(
      e,
      externosRef.current.hoje,
      externosRef.current.gravada,
    );
    const texto = JSON.stringify(corpo);
    const passo = filaRef.current.then(async () => {
      if (!corpo.nome) return idRef.current;
      setGravando(true);
      try {
        let d: PesquisaDetalhe;
        const ext = externosRef.current;
        if (idRef.current === null) {
          d = await ext.servico.criarPesquisa(corpo);
          idRef.current = d.id;
          setEstado((s) => ({ ...s, id: d.id, link: d.link }));
          ext.onRascunhoCriado?.(d.id);
        } else {
          d = await ext.servico.alterarPesquisa(idRef.current, corpo);
        }
        if (d) setGravada(d);
        falhouRef.current = null;
        setReferencia(texto);
        const quando = ext.agora();
        setSalvoAs(horaDe(quando));
        setFalha(null);
        return idRef.current;
      } finally {
        setGravando(false);
      }
    });
    filaRef.current = passo.catch(() => undefined);
    return passo;
  }, []);

  // Rascunho gravado ao abrir (modelo novo) e a cada mudança, com espera.
  useEffect(() => {
    if (publicadaAntes || gerada || serial === referencia) return;
    if (falhouRef.current === serial) return;
    const t = window.setTimeout(
      () => {
        gravar(estado).catch(() => {
          falhouRef.current = serial;
          setFalha(
            "Não foi possível salvar o rascunho. Vamos tentar de novo na próxima mudança.",
          );
        });
      },
      idRef.current === null ? 0 : atrasoDoRascunho,
    );
    return () => window.clearTimeout(t);
    // `estado` acompanha `serial`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial, referencia, publicadaAntes, gerada, atrasoDoRascunho, gravar]);

  // O navegador lembra onde a pessoa parou.
  useEffect(() => {
    if (estado.id && !publicadaAntes && salvoAs)
      lembrarRascunho(estado.id, {
        etapa: etapaDaApi + 1,
        totalDeEtapas: 3,
        salvoEm: agora().toISOString(),
      });
    // `agora` é estável na prática.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.id, etapaDaApi, salvoAs, publicadaAntes]);

  const mudar = (mudanca: Partial<EstadoDaPesquisa>) =>
    setEstado((e) => ({ ...e, ...mudanca }));

  const errosDaEtapa = (): Erros => {
    if (etapaDaApi === 0)
      return { ...validarSobre(estado), ...validarPerguntas(estado) };
    if (etapaDaApi === 1)
      return !estado.todos && Object.keys(estado.escolhidos).length === 0
        ? { participantes: "Escolha pelo menos uma pessoa." }
        : {};
    return validarEnvio(estado, hoje);
  };
  const erros = mostrarErros ? errosDaEtapa() : null;

  function irPara(i: number) {
    setEtapa(i);
    setMostrarErros(false);
    // A etapa nova começa do topo da página.
    requestAnimationFrame?.(() => voltarAoTopo());
  }

  async function avancar() {
    if (Object.keys(errosDaEtapa()).length > 0) {
      setMostrarErros(true);
      return;
    }
    const ultima = etapa === etapas.length - 1;
    if (!ultima) {
      irPara(etapa + 1);
      return;
    }
    try {
      if (publicadaAntes) {
        const id = await gravar(estado);
        if (id) onVerResultados(id, "Alterações salvas.");
        return;
      }
      const id = await gravar(estado);
      if (!id) return;
      const publicada = await confirmacao.publicar(id);
      if (!publicada) return;
      setCriadaAs(horaDe(agora()));
      setGerada(publicada);
    } catch (erro) {
      setFalha(
        mensagemDaFalha(
          erro,
          publicadaAntes ? "salvar as alterações" : "gerar a pesquisa",
        ),
      );
    }
  }

  /** Pré-visualizar: grava o que falta e abre a prévia em outra aba. */
  async function previsualizar() {
    try {
      const id =
        pendente || idRef.current === null
          ? await gravar(estado)
          : idRef.current;
      if (id) window.open(enderecoDaPrevia(id), "_blank", "noopener");
    } catch {
      setFalha("Não foi possível abrir a pré-visualização. Tente de novo.");
    }
  }

  async function cancelar() {
    if (publicadaAntes) {
      onCancelar();
      return;
    }
    try {
      if (pendente) await gravar(estado);
    } catch {
      /* o que já estava gravado fica */
    }
    onCancelar("Rascunho guardado. Você pode continuar depois.");
  }

  const principais = perguntasEmOrdem(estado.secoes).filter(
    (p) => p.id !== estado.comentarioId,
  );
  const comentario = perguntasEmOrdem(estado.secoes).find(
    (p) => p.id === estado.comentarioId,
  );
  const vaoReceber = estado.todos
    ? totalDoTime
    : Object.keys(estado.escolhidos).length;

  const cabecalho = (
    <header className="pesquisas__cabecalho">
      <IconButton
        label="Voltar"
        icon={<IconeVoltar tamanho={18} />}
        className="pesquisas__voltar"
        onClick={() => (gerada ? onConcluir() : void cancelar())}
      />
      <IconeDoModelo id={m.id} tamanho="lg" />
      <div className="pesquisas__titulos">
        <h1
          id={PESQUISAS_TITULO_ID}
          className="pesquisas__titulo"
          tabIndex={-1}
        >
          {publicadaAntes && !gerada
            ? `Editar ${estado.nome}`
            : tituloDoAssistente(m)}
        </h1>
        <p className="pesquisas__subtitulo">
          {m.modelo === "disc"
            ? `${principais.length} blocos · cerca de ${minutosEstimados(principais.length)} minutos para responder.`
            : m.descricao}
        </p>
      </div>
      {publicadaAntes && !gerada ? null : (
        <p className="pesquisas__salvo" role="status">
          {gerada && criadaAs ? (
            <>
              <span
                className="pesquisas__ponto pesquisas__ponto--sucesso"
                aria-hidden="true"
              />
              {`Pesquisa criada às ${criadaAs}`}
            </>
          ) : gravando && !salvoAs ? (
            "Salvando rascunho…"
          ) : salvoAs ? (
            <>
              <span
                className="pesquisas__ponto pesquisas__ponto--sucesso"
                aria-hidden="true"
              />
              {`Rascunho salvo às ${salvoAs}`}
            </>
          ) : null}
        </p>
      )}
    </header>
  );

  if (gerada) {
    return (
      <div className="pesquisas pesquisas--com-rodape">
        {cabecalho}
        <BarraDeEtapas etapas={etapas} atual={etapas.length} />
        <TelaDeGerada
          pesquisa={gerada}
          comCabecalhoDaPagina
          onVerResultados={(id) => onVerResultados(id)}
          onEditar={onEditarGerada}
          onConcluir={onConcluir}
        />
      </div>
    );
  }

  const ultima = etapa === etapas.length - 1;
  const proxima = etapas[etapa + 1];

  return (
    <div className="pesquisas pesquisas--com-rodape">
      {confirmacao.janela}
      {cabecalho}

      <BarraDeEtapas etapas={etapas} atual={etapa} />

      {etapaDaApi === 0 ? (
        <EtapaConfigurar
          ids={ids}
          estado={estado}
          modelo={m}
          principais={principais}
          comentario={comentario ?? null}
          travado={publicadaAntes && estado.temRespostas}
          servico={servico}
          erros={erros}
          onMudar={mudar}
        />
      ) : etapaDaApi === 1 ? (
        <CartaoDeSecao
          titulo="Quem vai responder"
          descricao="Escolha o time todo ou só algumas pessoas. Cada uma recebe o mesmo link."
        >
          <EtapaColaboradores
            servico={servico}
            todos={estado.todos}
            escolhidos={estado.escolhidos}
            responderam={estado.responderam}
            publicada={publicadaAntes}
            erro={erros?.participantes}
            onMudar={(x) => mudar(x)}
            onTotalDoTime={setTotalDoTime}
          />
        </CartaoDeSecao>
      ) : (
        <EtapaEnviar
          estado={estado}
          principais={principais}
          vaoReceber={vaoReceber}
          hoje={hoje}
          erros={erros}
          gravada={gravada}
          onMudar={mudar}
          onPrevia={() => void previsualizar()}
        />
      )}

      {falha ? (
        <p className="pesquisas__erro" role="alert">
          {falha}
        </p>
      ) : null}

      <footer className="pesquisas__rodape">
        {etapa === 0 ? (
          <Button variant="subtle" onClick={() => void cancelar()}>
            Cancelar
          </Button>
        ) : (
          <div className="pesquisas__rodape-esquerda">
            <Button variant="secondary" onClick={() => irPara(etapa - 1)}>
              ‹ Voltar
            </Button>
            {!anonima && vaoReceber !== null ? (
              <span className="pesquisas__suave">
                {`${plural(vaoReceber, "pessoa vai", "pessoas vão")} receber`}
              </span>
            ) : null}
          </div>
        )}
        <Button disabled={gravando && ultima} onClick={() => void avancar()}>
          {ultima
            ? publicadaAntes
              ? "Salvar alterações"
              : "✓ Gerar pesquisa"
            : `Próximo: ${proxima?.titulo ?? ""} →`}
        </Button>
      </footer>
    </div>
  );
}

function EtapaConfigurar({
  ids,
  estado,
  modelo: m,
  principais,
  comentario,
  travado,
  servico,
  erros,
  onMudar,
}: {
  readonly ids: string;
  readonly estado: EstadoDaPesquisa;
  readonly modelo: ModeloDaGaleria;
  readonly principais: readonly Pergunta[];
  readonly comentario: Pergunta | null;
  readonly travado: boolean;
  readonly servico: ServicoDePesquisas;
  readonly erros: Erros | null;
  readonly onMudar: (m: Partial<EstadoDaPesquisa>) => void;
}) {
  const avisar = useAvisar();
  const [adicionando, setAdicionando] = useState(false);
  const [rascunhoDaPergunta, setRascunhoDaPergunta] = useState("");
  // O tipo da pergunta nova, quando o modelo oferece mais de um (eNPS).
  const [tipoNovo, setTipoNovo] = useState(0);
  const [editando, setEditando] = useState<{
    id: string;
    texto: string;
  } | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const publicada = estado.status !== "rascunho";
  const escala = explicacaoDaEscala(m);
  const temEnps = principais.some(
    (p) => p.tipo === "nota_0_10" && p.config.enps,
  );
  const noLimite = principais.length >= m.limite;
  // Modelo fixo: as perguntas não aparecem uma a uma, então um erro nelas
  // (que barra o avanço) precisa de um aviso geral.
  const erroDasFixas =
    m.modelo === "disc" || m.fixo
      ? (erros?.perguntas ??
        Object.entries(erros ?? {}).find(([k]) =>
          k.startsWith("pergunta:"),
        )?.[1] ??
        null)
      : null;
  const idNome = `${ids}-nome`;
  const idDescricao = `${ids}-descricao`;

  const fixa = (p: Pergunta) =>
    typeof p.chave === "string" && (m.chavesFixas ?? []).includes(p.chave);

  function adicionar() {
    const texto = rascunhoDaPergunta.trim();
    if (!texto) return;
    const padrao =
      m.tiposParaAdicionar?.[tipoNovo]?.pergunta ?? m.perguntaPadrao;
    const nova: Pergunta = {
      id: novoId(),
      tipo: padrao.tipo,
      texto,
      descricao: null,
      obrigatoria: true,
      config: { ...padrao.config },
      condicao: null,
      rotulo: null,
    };
    // Entra antes do comentário final (que fica sempre por último).
    const secoes = estado.secoes.map((s, i) => {
      if (i !== estado.secoes.length - 1) return s;
      const fim = s.perguntas.findIndex((p) => p.id === estado.comentarioId);
      const perguntas = [...s.perguntas];
      perguntas.splice(fim >= 0 ? fim : perguntas.length, 0, nova);
      return { ...s, perguntas };
    });
    onMudar({ secoes });
    setRascunhoDaPergunta("");
    setAdicionando(false);
  }

  function salvarEdicao() {
    if (!editando || !editando.texto.trim()) return;
    onMudar({
      secoes: estado.secoes.map((s) => ({
        ...s,
        perguntas: s.perguntas.map((p) =>
          p.id === editando.id ? { ...p, texto: editando.texto } : p,
        ),
      })),
    });
    setEditando(null);
  }

  const tituloDaSecao = new Map(
    estado.secoes.length > 1
      ? estado.secoes
          .filter((s) => s.perguntas.length > 0 && s.titulo)
          .map((s) => [s.perguntas[0]!.id, s.titulo!])
      : [],
  );

  return (
    <>
      <CartaoDeSecao
        titulo="Sobre a pesquisa"
        descricao="Só o RH vê o nome. A descrição aparece para quem responde."
      >
        <div className="pesquisas__campos">
          <label htmlFor={idNome} className="pesquisas__rotulo">
            Nome da pesquisa
          </label>
          <input
            id={idNome}
            className="pesquisas__campo"
            value={estado.nome}
            aria-invalid={erros?.nome ? true : undefined}
            {...(erros?.nome ? { "aria-describedby": `${idNome}-erro` } : {})}
            onChange={(e) => onMudar({ nome: e.target.value })}
          />
          {erros?.nome ? (
            <p id={`${idNome}-erro`} className="pesquisas__erro">
              {erros.nome}
            </p>
          ) : null}
          <label htmlFor={idDescricao} className="pesquisas__rotulo">
            Descrição <span className="pesquisas__suave">opcional</span>
          </label>
          <textarea
            id={idDescricao}
            className="pesquisas__campo"
            value={estado.boasVindas}
            aria-describedby={`${idDescricao}-ajuda`}
            onChange={(e) => onMudar({ boasVindas: e.target.value })}
          />
          <p id={`${idDescricao}-ajuda`} className="pesquisas__suave">
            Enter quebra o texto em parágrafos.
          </p>
          {erros?.boasVindas ? (
            <p className="pesquisas__erro">{erros.boasVindas}</p>
          ) : null}
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
          {IDENTIFICACOES.map((i) => {
            const Icone = ICONE_DA_IDENTIFICACAO[i.valor];
            return (
              <label
                key={i.valor}
                className="pesquisas__escolha pesquisas__escolha--vertical"
              >
                <span className="pesquisas__escolha-topo">
                  <span className="pesquisas__escolha-icone" aria-hidden="true">
                    <Icone tamanho={16} />
                  </span>
                  <strong>{i.rotulo}</strong>
                  <input
                    type="radio"
                    name={`${ids}-identificacao`}
                    checked={estado.identificacao === i.valor}
                    disabled={publicada}
                    onChange={() => onMudar({ identificacao: i.valor })}
                  />
                </span>
                <span className="pesquisas__suave">{i.texto}</span>
              </label>
            );
          })}
        </div>
      </CartaoDeSecao>

      {estado.modelo === "isfb" ? <AvisoDaSaudeFinanceira /> : null}

      {estado.identificacao === "anonima" ? (
        <SepararRespostasPor
          servico={servico}
          separarPor={estado.separarPor}
          travado={publicada}
          onMudar={(separarPor) => onMudar({ separarPor })}
        />
      ) : null}

      {erroDasFixas ? (
        <p className="pesquisas__erro" role="alert">
          {`Há um problema nas perguntas deste modelo e a pesquisa não pode seguir: ${erroDasFixas} Recarregue a página; se continuar, fale com o suporte.`}
        </p>
      ) : null}
      {m.modelo === "disc" ? (
        <CartaoDosBlocos blocos={principais} />
      ) : m.modelo === "clima" ? (
        <PerguntasDoClima
          secoes={estado.secoes}
          travado={travado}
          erro={erros?.perguntas}
          onMudar={(secoes) => onMudar({ secoes })}
        />
      ) : m.fixo ? (
        <>
          <PerguntasFixas modelo={m} secoes={estado.secoes} />
          {estado.modelo === "isfb" ? (
            <InterruptorDaAutopercepcao
              secoes={estado.secoes}
              travado={publicada}
              onMudar={(secoes) => onMudar({ secoes })}
            />
          ) : null}
        </>
      ) : (
        <CartaoDeSecao
          titulo="Perguntas"
          contador={`${principais.length} de ${m.limite}${comentario ? " · + comentário" : ""}`}
          acao={
            travado ? null : (
              <Button
                variant="secondary"
                disabled={noLimite}
                aria-expanded={adicionando}
                onClick={() => setAdicionando(true)}
              >
                <IconeMais tamanho={16} />
                Adicionar pergunta
              </Button>
            )
          }
        >
          {travado ? (
            <p className="pesquisas__nota">
              Esta pesquisa já tem respostas: as perguntas não mudam mais.
            </p>
          ) : null}
          {escala ? (
            <div className="pesquisas__faixa-escala">
              <div>
                <strong>{escala.titulo}</strong>
                <span className="pesquisas__suave">{escala.texto}</span>
              </div>
              <span
                className="pesquisas__previa-escala pesquisas__previa-escala--mini"
                aria-hidden="true"
              >
                {escala.valores.map((v) => (
                  <span key={v}>{v}</span>
                ))}
              </span>
            </div>
          ) : null}
          {erros?.perguntas ? (
            <p className="pesquisas__erro" role="alert">
              {erros.perguntas}
            </p>
          ) : null}
          <ol
            className="pesquisas__linhas-perguntas"
            aria-label="Perguntas da pesquisa"
          >
            {principais.map((p, i) => {
              const n = String(i + 1).padStart(2, "0");
              const erro = erros?.[`pergunta:${p.id}`];
              const secao = tituloDaSecao.get(p.id);
              return (
                <li
                  key={p.id}
                  className="pesquisas__linha-pergunta"
                  aria-label={`Pergunta ${i + 1}`}
                  draggable={!travado && !fixa(p)}
                  {...(arrastando === p.id ? { "data-arrastando": "" } : {})}
                  {...(erro ? { "data-invalida": "" } : {})}
                  onDragStart={() => setArrastando(p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (arrastando)
                      onMudar({
                        secoes: levarPerguntaPara(
                          estado.secoes,
                          arrastando,
                          p.id,
                        ),
                      });
                    setArrastando(null);
                  }}
                  onDragEnd={() => setArrastando(null)}
                >
                  {secao ? (
                    <p className="pesquisas__linha-secao">{secao}</p>
                  ) : null}
                  <div className="pesquisas__linha-corpo">
                    <span className="pesquisas__pegador" aria-hidden="true">
                      <IconeArrastar tamanho={14} />
                    </span>
                    <span
                      className="pesquisas__numero-pergunta"
                      aria-hidden="true"
                    >
                      {n}
                    </span>
                    {editando?.id === p.id ? (
                      <div className="pesquisas__caixa-inline pesquisas__caixa-inline--linha">
                        <input
                          className="pesquisas__campo"
                          aria-label={`Texto da pergunta ${i + 1}`}
                          aria-describedby={`${ids}-dica-${p.id}`}
                          maxLength={LIMITES.textoPergunta}
                          value={editando.texto}
                          // Abre com o texto selecionado, pronto para trocar.
                          ref={(el) => {
                            if (el && document.activeElement !== el) {
                              el.focus();
                              el.select();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              salvarEdicao();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditando(null);
                            }
                          }}
                          onChange={(e) =>
                            setEditando({ id: p.id, texto: e.target.value })
                          }
                        />
                        <span
                          id={`${ids}-dica-${p.id}`}
                          className="pesquisas__suave"
                        >
                          {`Enter salva · Esc cancela · ${editando.texto.length}/${LIMITES.textoPergunta}`}
                        </span>
                        <IconButton
                          label="Salvar a pergunta"
                          icon={<IconeVisto tamanho={14} />}
                          variant="subtle"
                          disabled={!editando.texto.trim()}
                          onClick={salvarEdicao}
                        />
                        <IconButton
                          label="Cancelar a edição"
                          icon={<IconeFechar tamanho={14} />}
                          variant="subtle"
                          onClick={() => setEditando(null)}
                        />
                      </div>
                    ) : (
                      <span className="pesquisas__linha-texto">
                        {textoParaOPainel(p.texto) || "Pergunta sem texto"}
                      </span>
                    )}
                    <span
                      className={`pesquisas__selo${p.tipo === "nota_0_10" && p.config.enps ? " pesquisas__selo--destaque" : ""}`}
                    >
                      {seloDoTipo(p)}
                    </span>
                    {travado || editando?.id === p.id ? null : (
                      <span className="pesquisas__linha-acoes">
                        <IconButton
                          label={`Editar pergunta ${i + 1}`}
                          icon={<IconeEditar tamanho={14} />}
                          variant="subtle"
                          onClick={() =>
                            setEditando({ id: p.id, texto: p.texto })
                          }
                        />
                        {fixa(p) ? null : (
                          <IconButton
                            label={`Excluir pergunta ${i + 1}`}
                            icon={<IconeRemover tamanho={14} />}
                            variant="subtle"
                            onClick={() => {
                              const antes = estado.secoes;
                              onMudar({ secoes: excluirPergunta(antes, p.id) });
                              avisar("Pergunta excluída.", {
                                acao: {
                                  rotulo: "Desfazer",
                                  onClick: () => onMudar({ secoes: antes }),
                                },
                              });
                            }}
                          />
                        )}
                      </span>
                    )}
                  </div>
                  {erro ? <p className="pesquisas__erro">{erro}</p> : null}
                </li>
              );
            })}
          </ol>
          {adicionando ? (
            <div className="pesquisas__caixa-inline pesquisas__caixa-inline--nova">
              {m.tiposParaAdicionar ? (
                <div
                  className="pesquisas__pilulas"
                  role="radiogroup"
                  aria-label="Tipo da nova pergunta"
                >
                  {m.tiposParaAdicionar.map((t, i) => (
                    <label key={t.rotulo} className="pesquisas__escolha">
                      <input
                        type="radio"
                        name={`${ids}-tipo-novo`}
                        checked={tipoNovo === i}
                        onChange={() => setTipoNovo(i)}
                      />
                      {t.rotulo}
                    </label>
                  ))}
                </div>
              ) : null}
              <textarea
                className="pesquisas__campo"
                aria-label="Nova pergunta"
                placeholder="Escreva a pergunta como quem responde vai ler"
                maxLength={LIMITES.textoPergunta}
                value={rascunhoDaPergunta}
                onChange={(e) => setRascunhoDaPergunta(e.target.value)}
              />
              <div className="pesquisas__caixa-inline-rodape">
                <span className="pesquisas__suave">{`${rascunhoDaPergunta.length}/${LIMITES.textoPergunta}`}</span>
                <Button
                  variant="subtle"
                  onClick={() => {
                    setAdicionando(false);
                    setRascunhoDaPergunta("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={!rascunhoDaPergunta.trim()}
                  onClick={adicionar}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          ) : null}
          {comentario ? (
            <div className="pesquisas__linha-comentario">
              <IconeComentario tamanho={16} />
              <span>{textoParaOPainel(comentario.texto)}</span>
              <span className="pesquisas__selo">Sempre opcional · fixa</span>
            </div>
          ) : null}
          {temEnps && m.chavesFixas?.length ? (
            <p className="pesquisas__nota">
              A pergunta principal é fixa: é ela que calcula o eNPS (promotores
              menos detratores).
            </p>
          ) : temEnps ? (
            <p className="pesquisas__nota">
              A pergunta de eNPS pode sair. Se ficar, os resultados mostram
              promotores, neutros e detratores.
            </p>
          ) : null}
          {comentario ? (
            <p className="pesquisas__suave">
              O comentário livre fica sempre por último e não entra nas médias.
            </p>
          ) : null}
        </CartaoDeSecao>
      )}
    </>
  );
}

function EtapaEnviar({
  estado,
  principais,
  vaoReceber,
  hoje,
  erros,
  gravada,
  onMudar,
  onPrevia,
}: {
  readonly estado: EstadoDaPesquisa;
  readonly principais: readonly Pergunta[];
  readonly vaoReceber: number | null;
  readonly hoje: string;
  readonly erros: Erros | null;
  readonly gravada: PesquisaDetalhe | null;
  readonly onMudar: (m: Partial<EstadoDaPesquisa>) => void;
  readonly onPrevia: () => void;
}) {
  const tipos = [
    ...new Set(principais.map((p) => minusculaSemSigla(seloDoTipo(p)))),
  ];
  return (
    <>
      <CartaoDeSecao
        titulo="Revise antes de gerar"
        descricao="Ao gerar, a pesquisa fica ativa e o link já funciona."
        acao={
          <Button variant="secondary" onClick={onPrevia}>
            Pré-visualizar
          </Button>
        }
      >
        <dl
          className="pesquisas__resumo-grade pesquisas__resumo-celulas"
          aria-label="Resumo da pesquisa"
        >
          <div>
            <dt>Nome</dt>
            <dd>{estado.nome.trim() || "—"}</dd>
          </div>
          <div>
            <dt>Identificação</dt>
            <dd>{ROTULO_DA_IDENTIFICACAO[estado.identificacao]}</dd>
          </div>
          <div>
            <dt>Perguntas</dt>
            <dd>
              {estado.modelo === "disc"
                ? `${principais.length} blocos de frases do DISC`
                : estado.modelo === "clima"
                  ? resumoDasPerguntasDoClima(principais)
                  : (modeloDaGaleria(estado.modelo).resumoDasPerguntas?.(
                      principais,
                    ) ?? `${principais.length} · ${tipos.join(" + ")}`)}
            </dd>
          </div>
          <div>
            <dt>Participantes</dt>
            <dd>
              {estado.identificacao === "anonima"
                ? "Quem tiver o link (anônima)"
                : vaoReceber === null
                  ? "Todo o time"
                  : plural(vaoReceber, "colaborador", "colaboradores")}
            </dd>
          </div>
          <div className="pesquisas__resumo-largo">
            <dt>Descrição</dt>
            <dd>{estado.boasVindas.trim() || "Sem descrição"}</dd>
          </div>
        </dl>
      </CartaoDeSecao>

      <CartaoDeEncerramento
        data={estado.encerraEm}
        hora={estado.encerraHora}
        hoje={hoje}
        erro={erros?.encerraEm}
        onMudar={onMudar}
      />

      {gravada ? (
        <AvisoNaoIdentificaveis
          identificacao={estado.identificacao}
          naoIdentificaveis={gravada.naoIdentificaveis}
          participantes={gravada.participantesLista ?? []}
        />
      ) : null}
    </>
  );
}
