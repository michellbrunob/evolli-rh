/**
 * T216 — assistente "Nova pesquisa" (e "Editar") em 5 etapas, no padrão
 * `CadastroEmEtapas`: Sobre a pesquisa, Perguntas, Participantes, Envio e
 * prazo, Revisão. O rascunho é gravado no servidor a cada etapa concluída
 * (e pelo "Salvar rascunho"); Publicar deixa a pesquisa ativa e mostra o
 * link. Depois de publicada, a identificação não muda, as perguntas só
 * mudam enquanto não houver resposta e as mudanças são gravadas só no
 * "Salvar alterações".
 */
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import type { PesquisaDetalhe } from "../../api/pesquisasClient";
import { Button, FormActions } from "../../components";
import {
  CadastroEmEtapas,
  LinhaDoCadastro,
  SecaoDoCadastro,
} from "../../components/cadastro/CadastroEmEtapas";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import { formatarDiaCivil } from "../../format/data";
import { plural } from "../../format/plural";
import { Dialog } from "../../ui";
import { AvisoNaoIdentificaveis } from "./AvisoNaoIdentificaveis";
import { SepararRespostasPor } from "./AssistenteDoModelo";
import { EditorDePerguntas } from "./EditorDePerguntas";
import { EtapaColaboradores } from "./EtapaColaboradores";
import { lembrarRascunho } from "./rascunhosLocais";
import type { GruposDaEmpresa } from "./servicoDePesquisas";
import { CampoDoLink, TelaDeGerada } from "./TelaDeGerada";
import { PreVisualizacao } from "./PreVisualizacao";
import {
  entradaDoEstado,
  estadoDoDetalhe,
  estadoDoModelo,
  perguntasEmOrdem,
  validarEtapa,
  type EstadoDaPesquisa,
  type Erros,
} from "./estadoDaPesquisa";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import {
  IDENTIFICACOES,
  LIMITES,
  ROTULO_DA_IDENTIFICACAO,
  ROTULO_DO_MODELO,
} from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";
import "./Pesquisas.css";

const ETAPAS = [
  {
    titulo: "Sobre a pesquisa",
    subtitulo: "Nome e identificação",
    descricao: "Como a pesquisa se apresenta e o que o RH pode ver.",
  },
  {
    titulo: "Perguntas",
    subtitulo: "Seções e perguntas",
    descricao:
      "Organize as perguntas em seções. Abra uma pergunta para editar o texto, o tipo e a condição.",
  },
  {
    titulo: "Participantes",
    subtitulo: "Quem responde",
    descricao: "Todo o time ou pessoas escolhidas.",
  },
  {
    titulo: "Envio e prazo",
    subtitulo: "Link e encerramento",
    descricao: "Como a pesquisa chega a quem responde e até quando.",
  },
  {
    titulo: "Revisão",
    subtitulo: "Conferir e publicar",
    descricao: "Confira o resumo e veja a pesquisa como quem responde.",
  },
] as const;

const idTituloDaEtapa = (i: number) => `pesquisa-etapa-${i}`;

export function AssistenteDePesquisa({
  servico,
  modelo,
  inicial,
  base,
  hoje,
  onSair,
  onVerResultados,
  onConcluir,
  onEditarGerada,
}: {
  readonly servico: ServicoDePesquisas;
  /** Nova pesquisa a partir de um modelo (id da galeria ou roteiro). */
  readonly modelo?: string;
  /** Ponto de partida pronto (cópia de outra pesquisa). */
  readonly inicial?: EstadoDaPesquisa;
  /** Depois de gerada: voltar à lista. */
  readonly onConcluir?: () => void;
  readonly onEditarGerada?: (pesquisa: PesquisaDetalhe) => void;
  /** Edição de uma pesquisa existente. */
  readonly base?: PesquisaDetalhe;
  /** Dia civil de hoje (`AAAA-MM-DD`). */
  readonly hoje: string;
  readonly onSair: (mensagem?: string) => void;
  readonly onVerResultados: (id: string, mensagem?: string) => void;
}) {
  const ids = useId();
  const [estado, setEstado] = useState<EstadoDaPesquisa>(() =>
    base
      ? estadoDoDetalhe(base)
      : (inicial ?? estadoDoModelo(modelo ?? "personalizada", hoje)),
  );
  const [grupos, setGrupos] = useState<GruposDaEmpresa | null>(null);
  const [referencia, setReferencia] = useState(() =>
    JSON.stringify(entradaDoEstado(estado)),
  );
  const [atual, setAtual] = useState(0);
  const [alcancada, setAlcancada] = useState(base ? 4 : 0);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [avisoRascunho, setAvisoRascunho] = useState<string | null>(null);
  const [sair, setSair] = useState(false);
  const [previa, setPrevia] = useState(false);
  const [publicada, setPublicada] = useState<PesquisaDetalhe | null>(null);
  /** O que o servidor devolveu na última gravação (quem não se identifica). */
  const [gravada, setGravada] = useState<PesquisaDetalhe | null>(base ?? null);

  const rascunho = estado.status === "rascunho";
  const editando = base !== undefined;
  const entradaAtual = useMemo(() => entradaDoEstado(estado), [estado]);
  const pendente = JSON.stringify(entradaAtual) !== referencia;
  const erros: Erros | null = mostrarErros
    ? validarEtapa(estado, atual, hoje)
    : null;
  const qtdErros = erros ? Object.keys(erros).length : 0;

  useEdicaoEmAndamento(editando ? `Editar ${base.nome}` : "Nova pesquisa", {
    pendente: pendente && publicada === null,
    salvando,
  });

  // Erros resolvidos: some a faixa.
  useEffect(() => {
    if (mostrarErros && qtdErros === 0) setMostrarErros(false);
  }, [mostrarErros, qtdErros]);

  const mudar = (m: Partial<EstadoDaPesquisa>) => {
    setEstado((e) => ({ ...e, ...m }));
    setAvisoRascunho(null);
  };

  useEffect(() => {
    if (estado.identificacao !== "anonima" || grupos) return;
    let vivo = true;
    Promise.resolve(servico.listarGrupos())
      .then((g) => {
        if (vivo && g) setGrupos(g);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [estado.identificacao, grupos, servico]);

  function irPara(indice: number) {
    setAtual(indice);
    setAlcancada((a) => Math.max(a, indice));
    setMostrarErros(false);
    setFalha(null);
    requestAnimationFrame?.(() =>
      document.getElementById(idTituloDaEtapa(indice))?.focus(),
    );
  }

  /** Grava o rascunho (cria na primeira vez). Devolve o id. */
  async function gravar(): Promise<string> {
    const entrada = entradaDoEstado(estado);
    let id = estado.id;
    if (id === null) {
      const criada = await servico.criarPesquisa(entrada);
      id = criada.id;
      setEstado((e) => ({ ...e, id: criada.id, link: criada.link }));
      setGravada(criada ?? null);
    } else {
      const alterada = await servico.alterarPesquisa(id, entrada);
      if (alterada) setGravada(alterada);
    }
    setReferencia(JSON.stringify(entrada));
    lembrarRascunho(id, {
      etapa: Math.min(atual + 2, 5),
      totalDeEtapas: 5,
      salvoEm: new Date().toISOString(),
    });
    return id;
  }

  function mensagemDaFalha(erro: unknown, acao: string): string {
    const status = (erro as { status?: unknown } | null)?.status;
    if (status === 409)
      return `Não foi possível ${acao}: a pesquisa mudou de situação. Volte à lista e abra de novo.`;
    if (status === 422)
      return `Não foi possível ${acao}: o servidor recusou algum campo. Revise as etapas e tente de novo.`;
    return `Não foi possível ${acao}. Verifique a conexão e tente de novo.`;
  }

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (salvando) return;
    const encontrados = validarEtapa(estado, atual, hoje);
    if (Object.keys(encontrados).length > 0) {
      setMostrarErros(true);
      return;
    }
    setFalha(null);
    const ultima = atual === ETAPAS.length - 1;
    if (!ultima && !rascunho) {
      irPara(atual + 1);
      return;
    }
    setSalvando(true);
    try {
      if (!ultima) {
        await gravar();
        irPara(atual + 1);
      } else if (rascunho) {
        let id: string;
        try {
          id = await gravar();
        } catch (erro) {
          setFalha(mensagemDaFalha(erro, "gravar a pesquisa"));
          return;
        }
        try {
          setPublicada(await servico.publicarPesquisa(id));
        } catch (erro) {
          setFalha(mensagemDaFalha(erro, "publicar a pesquisa"));
        }
      } else {
        const id = await gravar();
        onVerResultados(id, "Alterações salvas.");
      }
    } catch (erro) {
      setFalha(mensagemDaFalha(erro, "gravar a pesquisa"));
    } finally {
      setSalvando(false);
    }
  }

  async function salvarRascunho(depois?: () => void) {
    setSalvando(true);
    setFalha(null);
    try {
      await gravar();
      setAvisoRascunho("Rascunho salvo.");
      depois?.();
    } catch (erro) {
      setFalha(mensagemDaFalha(erro, "salvar o rascunho"));
    } finally {
      setSalvando(false);
    }
  }

  if (publicada) {
    return (
      <div className="pesquisas">
        <TelaDeGerada
          pesquisa={publicada}
          onVerResultados={(id) => onVerResultados(id)}
          onEditar={(p) => (onEditarGerada ? onEditarGerada(p) : onSair())}
          onConcluir={() =>
            onConcluir ? onConcluir() : onSair("Pesquisa publicada.")
          }
        />
      </div>
    );
  }

  const travarPerguntas = !rascunho && estado.temRespostas;
  const todas = perguntasEmOrdem(estado.secoes);

  // ---- etapa 1 --------------------------------------------------------------
  const idNome = `${ids}-nome`;
  const idBoas = `${ids}-boas`;
  const etapa1 = (
    <>
      <SecaoDoCadastro
        titulo="Apresentação"
        descricao="O nome aparece para quem responde e na lista de pesquisas."
      >
        <LinhaDoCadastro
          rotulo="Nome"
          paraId={idNome}
          ajuda={`Até ${LIMITES.nome} caracteres.`}
        >
          <input
            id={idNome}
            className="pesquisas__campo"
            value={estado.nome}
            aria-invalid={erros?.nome ? true : undefined}
            {...(erros?.nome ? { "aria-describedby": `${idNome}-erro` } : {})}
            onChange={(e) => mudar({ nome: e.target.value })}
          />
          {erros?.nome ? (
            <p id={`${idNome}-erro`} className="pesquisas__erro">
              {erros.nome}
            </p>
          ) : null}
        </LinhaDoCadastro>
        <LinhaDoCadastro
          rotulo="Mensagem de boas-vindas"
          paraId={idBoas}
          ajuda="Opcional. Aparece na abertura, antes das perguntas. Deixe uma linha em branco entre os parágrafos."
        >
          <textarea
            id={idBoas}
            className="pesquisas__campo"
            value={estado.boasVindas}
            aria-invalid={erros?.boasVindas ? true : undefined}
            onChange={(e) => mudar({ boasVindas: e.target.value })}
          />
          <p className="pesquisas__contador">
            {`${estado.boasVindas.length}/${LIMITES.boasVindas}`}
          </p>
          {erros?.boasVindas ? (
            <p className="pesquisas__erro">{erros.boasVindas}</p>
          ) : null}
        </LinhaDoCadastro>
      </SecaoDoCadastro>
      <SecaoDoCadastro
        titulo="Identificação"
        descricao={
          rascunho
            ? "Define o que o RH pode ver das respostas. Não muda depois de publicar."
            : "A identificação não muda depois de publicar."
        }
      >
        <div
          className="pesquisas__opcoes-cartao"
          role="radiogroup"
          aria-label="Identificação"
        >
          {IDENTIFICACOES.map((i) => (
            <label key={i.valor} className="pesquisas__opcao-cartao">
              <input
                type="radio"
                name={`${ids}-identificacao`}
                checked={estado.identificacao === i.valor}
                disabled={!rascunho}
                onChange={() => mudar({ identificacao: i.valor })}
              />
              <span>
                <strong>{i.rotulo}</strong>
                <span className="pesquisas__suave">{i.texto}</span>
              </span>
            </label>
          ))}
        </div>
      </SecaoDoCadastro>
      {estado.identificacao === "anonima" ? (
        <SepararRespostasPor
          separarPor={estado.separarPor}
          grupos={grupos}
          travado={!rascunho}
          onMudar={(separarPor) => mudar({ separarPor })}
        />
      ) : null}
    </>
  );

  // ---- etapa 2 --------------------------------------------------------------
  const etapa2 = travarPerguntas ? (
    <div className="pesquisas__etapa">
      <p className="pesquisas__nota">
        Esta pesquisa já tem respostas: as perguntas não mudam mais. Nome,
        boas-vindas, prazo, mínimo por grupo e novos participantes ainda podem
        mudar.
      </p>
      <PreVisualizacao
        nome={estado.nome}
        boasVindas=""
        secoes={estado.secoes}
      />
    </div>
  ) : (
    <EditorDePerguntas
      secoes={estado.secoes}
      onMudar={(secoes) => mudar({ secoes })}
      erros={atual === 1 ? erros : null}
    />
  );

  // ---- etapa 3 --------------------------------------------------------------
  const etapa3 =
    estado.identificacao === "anonima" ? (
      <p className="pesquisas__nota">
        Na pesquisa anônima não há lista de participantes: quem tiver o link
        responde, sem ligação com a pessoa.
      </p>
    ) : (
      <EtapaColaboradores
        servico={servico}
        todos={estado.todos}
        escolhidos={estado.escolhidos}
        responderam={estado.responderam}
        publicada={!rascunho}
        erro={atual === 2 ? erros?.participantes : undefined}
        onMudar={(m) => mudar(m)}
      />
    );

  // ---- etapa 4 --------------------------------------------------------------
  const idData = `${ids}-data`;
  const idMinimo = `${ids}-minimo`;
  const etapa4 = (
    <>
      <SecaoDoCadastro
        titulo="Link da pesquisa"
        descricao="Quem tem o link responde pelo celular ou pelo computador."
      >
        {estado.link ? (
          <CampoDoLink link={estado.link} />
        ) : (
          <p className="pesquisas__suave">
            O link aparece quando a pesquisa for publicada.
          </p>
        )}
      </SecaoDoCadastro>
      <SecaoDoCadastro
        titulo="Encerramento"
        descricao="Depois da data escolhida, a pesquisa não recebe mais respostas e conta como finalizada."
      >
        <div
          className="pesquisas__opcoes-cartao"
          role="radiogroup"
          aria-label="Encerramento"
        >
          <label className="pesquisas__opcao-cartao">
            <input
              type="radio"
              name={`${ids}-prazo`}
              checked={estado.encerraEm === null}
              onChange={() => mudar({ encerraEm: null })}
            />
            <span>
              <strong>Sem prazo</strong>
              <span className="pesquisas__suave">
                A pesquisa fica aberta até ser finalizada.
              </span>
            </span>
          </label>
          <label className="pesquisas__opcao-cartao">
            <input
              type="radio"
              name={`${ids}-prazo`}
              checked={estado.encerraEm !== null}
              onChange={() => mudar({ encerraEm: estado.encerraEm ?? "" })}
            />
            <span>
              <strong>Encerrar em uma data</strong>
              <span className="pesquisas__suave">
                Encerramento automático no fim do dia.
              </span>
            </span>
          </label>
        </div>
        {estado.encerraEm !== null ? (
          <LinhaDoCadastro rotulo="Data de encerramento" paraId={idData}>
            <input
              id={idData}
              type="date"
              min={hoje}
              className="pesquisas__campo pesquisas__campo--curto"
              value={estado.encerraEm}
              aria-invalid={erros?.encerraEm ? true : undefined}
              onChange={(e) => mudar({ encerraEm: e.target.value })}
            />
            {erros?.encerraEm ? (
              <p className="pesquisas__erro">{erros.encerraEm}</p>
            ) : null}
          </LinhaDoCadastro>
        ) : null}
      </SecaoDoCadastro>
      <SecaoDoCadastro
        titulo="Privacidade nos recortes"
        descricao="Protege quem responde em grupos pequenos."
      >
        <LinhaDoCadastro
          rotulo="Mínimo de respostas por grupo"
          paraId={idMinimo}
          ajuda="Departamentos com menos respostas que isso não mostram números nos resultados. De 3 a 10; o padrão é 3."
        >
          <input
            id={idMinimo}
            type="number"
            min={LIMITES.minimoPorGrupoMenor}
            max={LIMITES.minimoPorGrupoMaior}
            className="pesquisas__campo pesquisas__campo--curto"
            value={
              Number.isNaN(estado.minimoPorGrupo) ? "" : estado.minimoPorGrupo
            }
            aria-invalid={erros?.minimoPorGrupo ? true : undefined}
            onChange={(e) =>
              mudar({
                minimoPorGrupo:
                  e.target.value === "" ? Number.NaN : Number(e.target.value),
              })
            }
          />
          {erros?.minimoPorGrupo ? (
            <p className="pesquisas__erro">{erros.minimoPorGrupo}</p>
          ) : null}
        </LinhaDoCadastro>
      </SecaoDoCadastro>
    </>
  );

  // ---- etapa 5 --------------------------------------------------------------
  const obrigatorias = todas.filter((p) => p.obrigatoria).length;
  const condicionais = todas.filter((p) => p.condicao).length;
  const qtdEscolhidos = Object.keys(estado.escolhidos).length;
  const etapa5 = (
    <div className="pesquisas__etapa">
      <section aria-label="Resumo da pesquisa">
        <dl className="pesquisas__resumo">
          <LinhaDoResumo rotulo="Nome" onAlterar={() => irPara(0)}>
            {estado.nome.trim() || "—"}
          </LinhaDoResumo>
          <LinhaDoResumo rotulo="Modelo">
            {ROTULO_DO_MODELO[estado.modelo]}
          </LinhaDoResumo>
          <LinhaDoResumo
            rotulo="Identificação"
            onAlterar={rascunho ? () => irPara(0) : undefined}
          >
            {ROTULO_DA_IDENTIFICACAO[estado.identificacao]}
          </LinhaDoResumo>
          <LinhaDoResumo rotulo="Perguntas" onAlterar={() => irPara(1)}>
            {`${plural(estado.secoes.length, "seção", "seções")} · ${plural(todas.length, "pergunta", "perguntas")} (${plural(obrigatorias, "obrigatória", "obrigatórias")}${condicionais > 0 ? `, ${plural(condicionais, "condicional", "condicionais")}` : ""})`}
          </LinhaDoResumo>
          <LinhaDoResumo rotulo="Participantes" onAlterar={() => irPara(2)}>
            {estado.todos
              ? "Todo o time (colaboradores ativos)"
              : plural(qtdEscolhidos, "pessoa escolhida", "pessoas escolhidas")}
          </LinhaDoResumo>
          <LinhaDoResumo rotulo="Encerramento" onAlterar={() => irPara(3)}>
            {estado.encerraEm
              ? formatarDiaCivil(estado.encerraEm)
              : "Sem prazo"}
          </LinhaDoResumo>
          <LinhaDoResumo rotulo="Mínimo por grupo" onAlterar={() => irPara(3)}>
            {plural(estado.minimoPorGrupo, "resposta", "respostas")}
          </LinhaDoResumo>
        </dl>
      </section>
      {gravada ? (
        <AvisoNaoIdentificaveis
          identificacao={estado.identificacao}
          naoIdentificaveis={gravada.naoIdentificaveis}
          participantes={gravada.participantesLista ?? []}
        />
      ) : null}
      <div className="pesquisas__acoes">
        <Button variant="secondary" onClick={() => setPrevia(true)}>
          Pré-visualizar como quem responde
        </Button>
      </div>
      <p className="pesquisas__nota">
        {rascunho
          ? "Ao publicar, a pesquisa fica ativa e o link passa a aceitar respostas. A identificação não muda depois."
          : "As mudanças valem a partir de agora. Quem já respondeu continua contado."}
      </p>
    </div>
  );

  return (
    <>
      <CadastroEmEtapas
        tituloId={PESQUISAS_TITULO_ID}
        titulo={editando ? `Editar ${base.nome}` : "Nova pesquisa"}
        descricao={
          rascunho
            ? "Configure em 5 etapas. O rascunho é gravado a cada etapa concluída."
            : "A pesquisa está publicada: algumas mudanças têm limite."
        }
        rotuloVoltar="Voltar para Pesquisas"
        onVoltarDaPagina={() => (pendente ? setSair(true) : onSair())}
        acaoDoCabecalho={
          rascunho ? (
            <Button
              variant="secondary"
              disabled={salvando || !estado.nome.trim()}
              onClick={() => void salvarRascunho()}
            >
              Salvar rascunho
            </Button>
          ) : undefined
        }
        etapas={ETAPAS}
        atual={atual}
        alcancada={alcancada}
        onIrParaEtapa={irPara}
        onSubmit={(e) => void aoEnviar(e)}
        rotuloConcluir={rascunho ? "Publicar pesquisa" : "Salvar alterações"}
        ocupado={salvando}
        paineis={[etapa1, etapa2, etapa3, etapa4, etapa5]}
        idDoTituloDaEtapa={idTituloDaEtapa}
        rotuloDoFormulario={editando ? "Editar pesquisa" : "Nova pesquisa"}
        mensagem={
          falha ? (
            <p className="pesquisas__erro" role="alert">
              {falha}
            </p>
          ) : qtdErros > 0 ? (
            <div className="pesquisas__faixa-erro">
              <strong>
                {qtdErros === 1
                  ? "Falta corrigir 1 ponto nesta etapa."
                  : `Faltam corrigir ${qtdErros} pontos nesta etapa.`}
              </strong>
              <span>Corrija o que está marcado em vermelho.</span>
            </div>
          ) : avisoRascunho ? (
            <p className="pesquisas__aviso" role="status">
              {avisoRascunho}
            </p>
          ) : undefined
        }
      />

      <Dialog
        aberto={previa}
        titulo="Pré-visualização"
        subtitulo="Como quem responde vê a pesquisa"
        onFechar={() => setPrevia(false)}
        className="pesquisas__janela-previa"
      >
        <PreVisualizacao
          nome={estado.nome}
          boasVindas={estado.boasVindas}
          secoes={estado.secoes}
        />
      </Dialog>

      <Dialog
        aberto={sair}
        titulo="Sair sem salvar?"
        descricao={
          rascunho
            ? "Há mudanças que ainda não foram gravadas no rascunho."
            : "Há mudanças que ainda não foram salvas."
        }
        onFechar={() => setSair(false)}
        rodape={
          <FormActions>
            <Button variant="secondary" onClick={() => setSair(false)}>
              Continuar editando
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSair(false);
                onSair();
              }}
            >
              Sair sem salvar
            </Button>
            {rascunho && estado.nome.trim() ? (
              <Button
                onClick={() =>
                  void salvarRascunho(() => {
                    setSair(false);
                    onSair("Rascunho salvo.");
                  })
                }
              >
                Salvar rascunho e sair
              </Button>
            ) : null}
          </FormActions>
        }
      >
        {null}
      </Dialog>
    </>
  );
}

function LinhaDoResumo({
  rotulo,
  onAlterar,
  children,
}: {
  readonly rotulo: string;
  readonly onAlterar?: (() => void) | undefined;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd className="pesquisas__acoes">
        <span>{children}</span>
        {onAlterar ? (
          <Button
            variant="subtle"
            aria-label={`Alterar ${rotulo.toLowerCase()}`}
            onClick={onAlterar}
          >
            Alterar
          </Button>
        ) : null}
      </dd>
    </div>
  );
}
