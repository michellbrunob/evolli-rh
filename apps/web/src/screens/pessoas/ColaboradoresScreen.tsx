import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  BUSCA_COLABORADORES_MAXIMO,
  type ColaboradorApi,
  type ColaboradorListadoApi,
  type ContadoresColaboradoresApi,
  type ListarColaboradoresQuery,
  type RetificarColaboradorDto,
  type TipoVinculo,
  type LotacaoListadaApi,
  type VinculoApi,
  type VinculoListadoApi,
  listarColaboradores,
  listarVinculosDoColaborador,
  retificarColaborador,
} from "../../api/colaboradoresClient";
import { formatarDiaCivil } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import { ContatosColaboradorSecao } from "./ContatosColaboradorSecao";
import { JornadaColaboradorSecao } from "./JornadaColaboradorSecao";
import {
  diaDeHoje,
  rotuloDaJornada,
  situacaoDaVigencia,
} from "./jornadaColaborador";
import { DadosPessoaisColaboradorSecao } from "./DadosPessoaisColaboradorSecao";
import "./ColaboradoresScreen.css";

export const COLABORADORES_TITULO_ID = "colaboradores-titulo";

type FiltroSituacao = "todos" | "ativo" | "inativo";
type FiltroSituacaoVinculo = "todos" | "previsto" | "ativo" | "encerrado";

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

const VARIANTE_SITUACAO_COLABORADOR: Record<string, StatusVariant> = {
  ativo: "success",
  inativo: "neutral",
};

const VARIANTE_SITUACAO_VINCULO: Record<string, StatusVariant> = {
  previsto: "info",
  ativo: "success",
  encerrado: "neutral",
};

const ROTULO_SITUACAO_VINCULO: Record<string, string> = {
  previsto: "Previsto",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

interface DetalheState {
  colaborador: ColaboradorApi;
  statusVinculos: "carregando" | "erro" | "dados";
  vinculos: VinculoApi[];
  nomeEdicao: string;
  salvandoNome: boolean;
  erroNome: string | null;
}

/**
 * Quantas linhas por página.
 *
 * Explícito, e não herdado do padrão do servidor, porque a paginação só é
 * honesta se a tela souber o tamanho que pediu: é esse número que faz
 * "Página 2 de 5" significar alguma coisa. Vinte é o padrão do backend
 * (`TAMANHO_PAGINA_PADRAO`), bem abaixo do teto de 100.
 */
const TAMANHO_PAGINA = 20;

/**
 * R-1 — o tamanho de página da resposta, quando ele é utilizável.
 *
 * Recusa o que não serve para dividir: ausente, não numérico, zero, negativo,
 * fracionário ou não finito. Qualquer um deles produziria uma contagem de
 * páginas sem sentido — `Infinity`, `NaN` ou uma divisão por zero —, e uma
 * paginação inventada é pior que nenhuma.
 *
 * A recusa **volta ao tamanho pedido**, que é o que a tela de fato usou na
 * requisição. Não há degradação para "sem paginação": o comportamento fica
 * exatamente o de antes desta correção.
 */
function tamanhoDePaginaValido(valor: unknown): number {
  return typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor > 0 &&
    Number.isFinite(valor)
    ? valor
    : TAMANHO_PAGINA;
}

/**
 * T178 — o termo como o servidor o aceita: aparado e no teto de 160; `""` é
 * "sem busca". É também o termo exibido no estado vazio ("Nenhum colaborador
 * encontrado para …"), para que a tela mostre exatamente o que pediu.
 *
 * Mora aqui, e não no cliente, porque os testes automockam o cliente inteiro:
 * uma função de lá viraria `vi.fn` e a normalização sumiria justo neles.
 */
function normalizarBusca(termo: string): string {
  return termo.trim().slice(0, BUSCA_COLABORADORES_MAXIMO).trim();
}

/** Concordância de "N vínculo(s)", para o texto lido por leitor de tela. */
function vinculosAMais(quantidade: number): string {
  return quantidade === 1 ? "1 vínculo" : `${quantidade} vínculos`;
}

export interface ColaboradoresScreenProps {
  /**
   * T164 — a empresa de trabalho ATIVA, resolvida pelo servidor e repassada
   * pelo shell. É contexto, não controle: quem troca de empresa é o Hub, e só
   * para os papéis que o servidor autoriza.
   *
   * Vem por prop em vez de uma leitura própria porque o `AutenticacaoApp` já
   * tem o ator — pedir `/v1/users/me` de novo aqui seria uma requisição a mais
   * para um dado que já está em memória.
   */
  readonly empresaAtiva?: {
    readonly nome: string;
    readonly codigo: string;
  } | null;
  readonly onTituloIdChange?: (tituloId: string) => void;
  /**
   * T176 — colaborador a abrir assim que a tela montar: é o destino das ações
   * "Abrir ficha" e "Completar contatos" da página de Nova admissão. Vem da
   * RESPOSTA da admissão, não de nova busca. `foco: "contatos"` leva o foco ao
   * primeiro campo de contatos quando eles carregam.
   */
  readonly aberturaInicial?: {
    readonly colaborador: ColaboradorApi;
    readonly foco: "ficha" | "contatos";
  } | null;
  /** Avisa que `aberturaInicial` foi atendida, para o shell não repeti-la. */
  readonly onAberturaAtendida?: () => void;
  /**
   * T177 — a admissão acontece só na página de Nova admissão. O modal
   * transitório da T176 foi aposentado porque não coletava os campos que a
   * admissão passou a exigir (data de nascimento e os três contatos).
   * "Nova admissão" (T178; era "Novo colaborador") leva até a página; sem esta
   * prop — perfil que não pode admitir —, o botão não aparece.
   */
  readonly onNovaAdmissao?: () => void;
  /**
   * T181 — o perfil edita, na ficha, dados pessoais, endereço e contatos: só
   * RH e DP (`PAPEIS_EDICAO_FICHA`). Sem isso, os blocos ficam só em leitura,
   * sem Preencher, Editar, Salvar nem Cancelar. Os mesmos papéis consultam o
   * CEP. Só orienta a tela: quem recusa é o servidor.
   */
  readonly podeEditarFicha?: boolean;
  /**
   * T183 — o perfil atribui, troca e encerra a jornada do colaborador na
   * ficha: só o RH (`PAPEIS_OPERACAO_JORNADAS`). Sem isso, a seção "Jornada
   * de trabalho" é só consulta. Só orienta a tela: quem recusa é o servidor.
   */
  readonly podeOperarJornada?: boolean;
}

/**
 * T184 — cargo ou departamento da lotação vigente do vínculo principal. Sem
 * lotação vigente, o texto neutro diz isso; lotação vigente sem a referência
 * diz "Não informado". Sem vínculo, o mesmo "—" das outras colunas.
 */
function celulaDaLotacao(
  principal: VinculoListadoApi | undefined,
  campo: keyof LotacaoListadaApi,
): React.ReactNode {
  if (!principal) return "—";
  const lotacao = principal.lotacaoVigente;
  if (!lotacao) {
    return (
      <span className="colaboradores-screen__sem-lotacao">
        Sem lotação vigente
      </span>
    );
  }
  const referencia = lotacao[campo];
  return referencia ? (
    referencia.nome
  ) : (
    <span className="colaboradores-screen__sem-lotacao">Não informado</span>
  );
}

/**
 * T185 — jornada vigente HOJE (dia civil do navegador) do vínculo principal
 * ativo. Sem vínculo, o mesmo "—" das outras colunas.
 */
function celulaDaJornada(
  principal: VinculoListadoApi | undefined,
  hoje: string,
): React.ReactNode {
  if (!principal) return "—";
  const vigente =
    principal.situacao === "ativo"
      ? principal.vigenciasDeJornada.find(
          (v) => situacaoDaVigencia(v, hoje) === "vigente",
        )
      : undefined;
  if (!vigente) {
    return (
      <span className="colaboradores-screen__sem-lotacao">
        Sem jornada vigente
      </span>
    );
  }
  return (
    <>
      {rotuloDaJornada(vigente.jornada)}
      {vigente.jornada.ativo ? null : (
        <>
          {" "}
          <StatusBadge variant="warning">Jornada inativa</StatusBadge>
        </>
      )}
    </>
  );
}

export function ColaboradoresScreen({
  empresaAtiva = null,
  aberturaInicial = null,
  onAberturaAtendida,
  onNovaAdmissao,
  podeEditarFicha = false,
  podeOperarJornada = false,
}: ColaboradoresScreenProps = {}) {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  // T178 — a lista vive só nesta montagem, de propósito: sem cache entre
  // montagens, voltar da Nova admissão relê o servidor e o admitido aparece.
  const [colaboradores, setColaboradores] = useState<ColaboradorListadoApi[]>(
    [],
  );
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>("todos");
  const [filtroSituacaoVinculo, setFiltroSituacaoVinculo] =
    useState<FiltroSituacaoVinculo>("todos");
  /**
   * T178 — busca por nome ou matrícula, em dois tempos: o que está no campo
   * (`buscaDigitada`) e o que foi PEDIDO ao servidor (`buscaAplicada`, já
   * normalizada). Separados porque a busca vai ao servidor só quando a pessoa
   * envia — consultar a cada tecla dispararia uma requisição por caractere e
   * deixaria a lista mudando por baixo de quem ainda digita.
   *
   * Nunca se filtra no cliente: a página tem 20 linhas de um conjunto maior, e
   * filtrar só o que chegou esconderia quem está nas outras páginas.
   */
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const campoBuscaRef = useRef<HTMLInputElement | null>(null);
  /**
   * T178 — contagem do escopo inteiro, vinda do servidor (`contadores`), SEM
   * filtros nem busca. `null` até a primeira resposta. Não é somada no
   * cliente: a página só tem parte do conjunto, e a soma dela mentiria.
   */
  const [contadores, setContadores] =
    useState<ContadoresColaboradoresApi | null>(null);
  /**
   * T164 — paginação real.
   *
   * Antes desta tarefa a tela pedia a lista **sem** `pagina`, recebia a
   * primeira página do servidor e descartava o `total`. O efeito era silencioso
   * e grave: a partir do vigésimo primeiro colaborador, as pessoas seguintes
   * simplesmente não existiam na interface, sem nada na tela sugerindo que
   * houvesse mais. Uma lista que esconde registros é pior que uma lista vazia,
   * porque parece completa.
   *
   * `pagina` e `total` vêm da RESPOSTA, não do que a tela pediu: o servidor é
   * quem sabe quantos registros o escopo ativo tem.
   */
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  /**
   * R-1 — o tamanho de página que o SERVIDOR aplicou.
   *
   * Contar as páginas com a constante local assumia que o servidor sempre
   * honra o tamanho pedido. Ele honra hoje, mas a resposta carrega o valor
   * efetivo justamente para que o cliente não precise supor: no dia em que a
   * rota limitar a página, contar com 20 um conjunto servido de 10 em 10
   * ofereceria metade das páginas — e cada uma delas voltaria vazia.
   *
   * Começa na constante porque é o que foi pedido na primeira carga.
   */
  const [tamanhoPaginaEfetivo, setTamanhoPaginaEfetivo] =
    useState(TAMANHO_PAGINA);
  const [detalhe, setDetalhe] = useState<DetalheState | null>(null);
  // T169 — a seção de contatos do detalhe edita por conta própria e avisa
  // aqui quando há edição não salva e quando está gravando, para que o
  // `Modal` peça confirmação de descarte e não feche no meio da gravação.
  const [contatosAlterados, setContatosAlterados] = useState(false);
  const [salvandoContatos, setSalvandoContatos] = useState(false);
  // T181 — idem para os dados pessoais e o endereço, agora editáveis.
  const [dadosPessoaisAlterados, setDadosPessoaisAlterados] = useState(false);
  const [salvandoDadosPessoais, setSalvandoDadosPessoais] = useState(false);
  // T183 — idem para a jornada de trabalho (atribuir, trocar e encerrar).
  const [jornadaAlterada, setJornadaAlterada] = useState(false);
  const [salvandoJornada, setSalvandoJornada] = useState(false);
  // T176 — "Completar contatos" vindo da página de Nova admissão.
  const [focarContatos, setFocarContatos] = useState(false);
  /** Salvamento do nome em curso — trava síncrona, ver `handleSalvarNome`. */
  const salvandoNomeRef = useRef(false);
  /**
   * Sequência do pedido de lista em voo.
   *
   * Trocar um filtro dispara `carregarDados` sem cancelar o anterior. Se a
   * primeira resposta chegar DEPOIS da segunda, ela sobrescreve a lista com
   * dados que não correspondem ao filtro na tela. O contador resolve sem
   * `AbortController`: a resposta só é aplicada se ainda for a mais recente.
   */
  const pedidoListaRef = useRef(0);

  // T144 (R1) — o detalhe também edita, e portanto também tem o que perder: o
  // nome. Um só derivado governa a confirmação de descarte do `Modal` e o
  // botão de salvar; se divergissem, a janela fecharia calada com o botão
  // ainda habilitado. Compara o valor normalizado com o nome já carregado, e
  // por isso volta sozinho a `false` depois de salvar, quando o nome gravado
  // passa a ser o nome em edição.
  const detalheNomeAlterado =
    detalhe !== null && detalhe.nomeEdicao.trim() !== detalhe.colaborador.nome;

  const carregarDados = useCallback(
    async (
      situacao: FiltroSituacao,
      situacaoVinculo: FiltroSituacaoVinculo,
      busca: string,
      paginaPedida: number,
    ) => {
      const pedido = ++pedidoListaRef.current;
      setStatusCarregamento("carregando");
      try {
        // A empresa nunca entra na query: é a da sessão, resolvida no servidor.
        const query: ListarColaboradoresQuery = {
          pagina: paginaPedida,
          tamanhoPagina: TAMANHO_PAGINA,
        };
        if (situacao !== "todos") query.situacao = situacao;
        if (situacaoVinculo !== "todos")
          query.situacaoVinculo = situacaoVinculo;
        // T178 — vazio é "sem busca": a chave nem vai.
        if (busca) query.busca = busca;
        const resp = await listarColaboradores(query);
        // Resposta obsoleta: outro filtro (ou outra busca) já pediu a lista
        // depois desta. Aplicá-la mostraria dados que não correspondem ao que
        // está na tela — inclusive os contadores, que vêm na mesma resposta.
        if (pedido !== pedidoListaRef.current) return null;
        setColaboradores(resp.itens);
        // Página e total saem da RESPOSTA. Se a tela guardasse o que pediu, um
        // servidor que ajustasse a página (ou um filtro que encolhesse o
        // conjunto) deixaria o rodapé mentindo sobre onde a pessoa está.
        setPagina(resp.pagina);
        setTotal(resp.total);
        setTamanhoPaginaEfetivo(tamanhoDePaginaValido(resp.tamanhoPagina));
        setContadores(resp.contadores);
        setStatusCarregamento("dados");
        return resp.itens;
      } catch {
        if (pedido !== pedidoListaRef.current) return null;
        setStatusCarregamento("erro");
        return null;
      }
    },
    [],
  );

  /**
   * Trocar de filtro volta para a PRIMEIRA página.
   *
   * Sem isto, quem estivesse na página 3 e filtrasse por "Ativo" pediria a
   * página 3 de um conjunto que talvez tenha uma só — e receberia uma lista
   * vazia que parece "nenhum colaborador ativo", quando na verdade há vários
   * na página 1. O filtro muda o conjunto; a posição dentro dele não
   * sobrevive à mudança.
   */
  //
  // T178 — a busca entra na mesma regra: um termo novo é um conjunto novo.
  useEffect(() => {
    void carregarDados(filtroSituacao, filtroSituacaoVinculo, buscaAplicada, 1);
  }, [filtroSituacao, filtroSituacaoVinculo, buscaAplicada, carregarDados]);

  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPaginaEfetivo));
  const carregando = statusCarregamento === "carregando";
  const temFiltro =
    filtroSituacao !== "todos" || filtroSituacaoVinculo !== "todos";
  const filtrando = temFiltro || buscaAplicada !== "";

  function irParaPagina(destino: number) {
    if (destino < 1 || destino > totalPaginas || carregando) return;
    void carregarDados(
      filtroSituacao,
      filtroSituacaoVinculo,
      buscaAplicada,
      destino,
    );
  }

  /**
   * T178 — enviar a busca. Um termo novo dispara a releitura pelo efeito; o
   * MESMO termo reenviado também relê (página 1), porque reenviar é pedir de
   * novo — e o efeito não rodaria, já que o estado não mudou.
   */
  function handleBuscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const termo = normalizarBusca(buscaDigitada);
    setBuscaDigitada(termo);
    if (termo === buscaAplicada) {
      void carregarDados(filtroSituacao, filtroSituacaoVinculo, termo, 1);
      return;
    }
    setBuscaAplicada(termo);
  }

  /**
   * T178 — "Limpar busca": volta ao conjunto sem termo. O foco vai ao campo,
   * porque o botão acionado some junto com o termo — sem isto o foco cairia
   * no `<body>`.
   */
  function limparBusca() {
    setBuscaDigitada("");
    setBuscaAplicada("");
    campoBuscaRef.current?.focus();
  }

  /** T178 — do estado vazio por busca/filtro: tudo volta ao conjunto inteiro. */
  function limparBuscaEFiltros() {
    setFiltroSituacao("todos");
    setFiltroSituacaoVinculo("todos");
    limparBusca();
  }

  // T176 — atende a abertura pedida pela página de Nova admissão, uma vez.
  const aberturaAtendidaRef = useRef(false);
  useEffect(() => {
    if (!aberturaInicial || aberturaAtendidaRef.current) return;
    aberturaAtendidaRef.current = true;
    abrirDetalhe(aberturaInicial.colaborador);
    setFocarContatos(aberturaInicial.foco === "contatos");
    onAberturaAtendida?.();
    // `abrirDetalhe` é recriada a cada desenho; a abertura vale só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberturaInicial, onAberturaAtendida]);

  function abrirDetalhe(colaborador: ColaboradorApi) {
    setDetalhe({
      colaborador,
      statusVinculos: "carregando",
      vinculos: [],
      nomeEdicao: colaborador.nome,
      salvandoNome: false,
      erroNome: null,
    });
    void carregarVinculos(colaborador.id);
  }

  async function carregarVinculos(colaboradorId: string) {
    setDetalhe((prev) =>
      prev ? { ...prev, statusVinculos: "carregando" } : prev,
    );
    try {
      const vinculos = await listarVinculosDoColaborador(colaboradorId);
      // Só escreve se o detalhe aberto ainda for o MESMO colaborador. Sem esta
      // conferência, fechar o detalhe de A e abrir o de B fazia a resposta
      // atrasada de A gravar os vínculos de A no painel de B — dado de uma
      // pessoa aparecendo na ficha de outra.
      setDetalhe((prev) =>
        prev && prev.colaborador.id === colaboradorId
          ? { ...prev, vinculos, statusVinculos: "dados" }
          : prev,
      );
    } catch {
      setDetalhe((prev) =>
        prev && prev.colaborador.id === colaboradorId
          ? { ...prev, statusVinculos: "erro" }
          : prev,
      );
    }
  }

  function fecharDetalhe() {
    setDetalhe(null);
    setFocarContatos(false);
  }

  async function handleSalvarNome() {
    if (!detalhe) return;
    // Trava síncrona contra envio duplicado: `disabled` depende de um
    // `setState`, que só chega no próximo render, e cliques no mesmo quadro
    // escapam dele.
    if (salvandoNomeRef.current) return;
    const nome = detalhe.nomeEdicao.trim();
    if (!nome) {
      setDetalhe((prev) =>
        prev ? { ...prev, erroNome: "Nome é obrigatório." } : prev,
      );
      return;
    }
    if (nome.length > 160) {
      setDetalhe((prev) =>
        prev
          ? { ...prev, erroNome: "Nome deve ter no máximo 160 caracteres." }
          : prev,
      );
      return;
    }

    salvandoNomeRef.current = true;
    setDetalhe((prev) =>
      prev ? { ...prev, salvandoNome: true, erroNome: null } : prev,
    );
    try {
      const dto: RetificarColaboradorDto = { nome };
      const atualizado = await retificarColaborador(
        detalhe.colaborador.id,
        dto,
      );
      // T178 — só o NOME vem da resposta. O `PATCH` devolve a situação
      // GLOBAL do colaborador, e a linha (e a ficha aberta a partir dela)
      // mostra a situação NA EMPRESA ATIVA: copiar o objeto inteiro trocaria
      // "Inativo nesta empresa" por "Ativo" só porque o nome foi corrigido — e
      // apagaria os vínculos que a listagem projetou.
      setDetalhe((prev) =>
        prev
          ? {
              ...prev,
              colaborador: { ...prev.colaborador, nome: atualizado.nome },
              nomeEdicao: atualizado.nome,
              salvandoNome: false,
            }
          : prev,
      );
      setColaboradores((prev) =>
        prev.map((c) =>
          c.id === atualizado.id ? { ...c, nome: atualizado.nome } : c,
        ),
      );
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o nome. Tente novamente.";
      setDetalhe((prev) =>
        prev ? { ...prev, salvandoNome: false, erroNome: mensagem } : prev,
      );
    } finally {
      // Libera só depois que a tentativa termina — sucesso ou falha —, para
      // que corrigir e reenviar continue possível.
      salvandoNomeRef.current = false;
    }
  }

  /**
   * T178 — colunas da porta principal.
   *
   * Matrícula e admissão saem do VÍNCULO PRINCIPAL: o primeiro de `vinculos`,
   * que o servidor já ordena (ativo, previsto, encerrado; admissão mais
   * recente primeiro). Vêm na mesma resposta da lista — nenhuma leitura por
   * pessoa. A coluna "Cadastrado em" (T164) saiu: ela existia porque a
   * admissão não vinha na listagem, e `criadoEm` não é admissão.
   *
   * T184 — Cargo e Departamento são os da LOTAÇÃO VIGENTE do vínculo
   * principal (a alocação organizacional aberta), que o servidor já devolve
   * na mesma resposta. Vínculo previsto (admissão não efetivada) ou encerrado
   * não tem lotação vigente e mostra "Sem lotação vigente" — nunca o destino
   * planejado nem a última lotação (decisão da proprietária de 2026-10-26).
   * O Banco de Horas segue fora: não tem operação.
   *
   * T185 — Jornada de trabalho: a vigência (T183) que contém o dia civil do
   * navegador — a mesma regra da ficha —, do colaborador na empresa do
   * vínculo principal ATIVO. Previsto, encerrado, sem jornada ou com
   * vigência futura: "Sem jornada vigente". Jornada inativada aparece com a
   * indicação (decisões da proprietária de 2026-10-26).
   */
  const hoje = diaDeHoje();
  const colunasColaboradores: DataTableColumn<ColaboradorListadoApi>[] = [
    { key: "nome", header: "Nome", cell: (c) => c.nome },
    {
      key: "matricula",
      header: "Matrícula",
      cell: (c) => {
        const principal = c.vinculos[0];
        if (!principal) return "—";
        const aMais = c.vinculos.length - 1;
        return (
          <>
            {/* T179 — matrícula opcional: sem ela, "Sem matrícula". */}
            {exibirMatricula(principal.matricula)}
            {aMais > 0 ? (
              <>
                {/* "+N" é o atalho visual; quem usa leitor de tela ouve a
                    frase inteira, em vez de "mais um" solto. */}
                <span
                  className="colaboradores-screen__vinculos-a-mais"
                  aria-hidden="true"
                >
                  {" "}
                  +{aMais}
                </span>
                <span className="sr-only"> e mais {vinculosAMais(aMais)}</span>
              </>
            ) : null}
          </>
        );
      },
    },
    {
      key: "cargo",
      header: "Cargo",
      cell: (c) => celulaDaLotacao(c.vinculos[0], "cargo"),
    },
    {
      key: "departamento",
      header: "Departamento",
      cell: (c) => celulaDaLotacao(c.vinculos[0], "departamento"),
    },
    {
      key: "jornada",
      header: "Jornada de trabalho",
      cell: (c) => celulaDaJornada(c.vinculos[0], hoje),
    },
    {
      // Situação do ITEM: para `rh`/`dp`, na empresa ativa (tem vínculo ativo
      // nela) — decidida pelo servidor, não derivada dos vínculos aqui.
      key: "situacao",
      header: "Situação",
      cell: (c) => (
        <StatusBadge
          variant={VARIANTE_SITUACAO_COLABORADOR[c.situacao] ?? "neutral"}
        >
          {c.situacao === "ativo" ? "Ativo" : "Inativo"}
        </StatusBadge>
      ),
    },
    {
      // Dia civil (`@db.Date`): `formatarDiaCivil` corta a string, sem `Date`,
      // e devolve "—" quando não há vínculo — nunca uma data inventada.
      key: "admissao",
      header: "Admissão",
      cell: (c) => formatarDiaCivil(c.vinculos[0]?.dataAdmissao),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (c) => (
        <Button
          variant="secondary"
          onClick={(evento) => {
            evento.currentTarget.focus();
            abrirDetalhe(c);
          }}
          aria-haspopup="dialog"
          aria-expanded={detalhe?.colaborador.id === c.id}
        >
          Abrir ficha
          <span className="sr-only"> de {c.nome}</span>
        </Button>
      ),
    },
  ];

  const colunasVinculos: DataTableColumn<VinculoApi>[] = [
    {
      key: "matricula",
      header: "Matrícula",
      cell: (v) => exibirMatricula(v.matricula),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (v) => ROTULO_TIPO_VINCULO[v.tipo] ?? v.tipo,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (v) => (
        <StatusBadge
          variant={VARIANTE_SITUACAO_VINCULO[v.situacao] ?? "neutral"}
        >
          {ROTULO_SITUACAO_VINCULO[v.situacao] ?? v.situacao}
        </StatusBadge>
      ),
    },
    {
      // Dias civis (`@db.Date`): o Prisma os entrega como datetime ISO, e
      // `formatarDiaCivil` lê os componentes direto da string — `Date` não
      // entra no caminho, logo o dia exibido nunca recua a oeste de Greenwich.
      key: "admissao",
      header: "Admissão",
      cell: (v) => formatarDiaCivil(v.dataAdmissao),
    },
    {
      key: "desligamento",
      header: "Desligamento",
      cell: (v) => formatarDiaCivil(v.dataDesligamento),
    },
  ];

  return (
    <div className="colaboradores-screen">
      <PageHeader
        headingLevel={1}
        titleId={COLABORADORES_TITULO_ID}
        title="Colaboradores"
        description="Consulte os colaboradores da empresa ativa, abra a ficha de cada um e inicie uma nova admissão. Situação e vínculo seguem sempre a fonte de verdade do backend."
        actions={
          /* T178 — contadores do escopo inteiro, como o servidor os contou,
             no cabeçalho: são o tamanho da área, não um detalhe da lista.

             Rotulados "sem filtros" porque NÃO acompanham a busca nem os
             filtros: dizem quantos ativos e inativos há, enquanto o total da
             lista diz quantos a consulta atual achou. Sem o rótulo, "Ativos
             40" ao lado de uma busca com três resultados pareceria erro.

             Antes da primeira resposta, reticências; depois, o último valor
             do servidor fica à vista durante as releituras — ele não depende
             do filtro, e trocá-lo por reticências a cada consulta só
             piscaria. Sem `role="status"`, pelo mesmo motivo do total da
             lista: regiões vivas a mais atropelam as que já existem. */
          <div
            className="colaboradores-screen__contadores"
            role="group"
            aria-labelledby="colaboradores-contadores-rotulo"
          >
            <p
              id="colaboradores-contadores-rotulo"
              className="colaboradores-screen__contadores-rotulo"
            >
              {empresaAtiva ? "Na empresa ativa" : "No seu escopo"}, sem filtros
            </p>
            <dl className="colaboradores-screen__contadores-lista">
              <div className="colaboradores-screen__contador">
                <dt>Ativos</dt>
                <dd>{contadores ? contadores.ativos : "…"}</dd>
              </div>
              <div className="colaboradores-screen__contador">
                <dt>Inativos</dt>
                <dd>{contadores ? contadores.inativos : "…"}</dd>
              </div>
            </dl>
          </div>
        }
      />

      {/* T178 — barra de ações: "Nova admissão" é a ação principal da área e
          a busca fica ao lado. Só o que existe: nada de importar, exportar ou
          pedir preenchimento — botão sem operação por trás é promessa falsa. */}
      <div className="colaboradores-screen__barra-acoes">
        {onNovaAdmissao ? (
          <Button onClick={onNovaAdmissao}>Nova admissão</Button>
        ) : null}
        <form
          role="search"
          aria-label="Buscar colaboradores"
          className="colaboradores-screen__busca"
          onSubmit={handleBuscar}
        >
          <FormField
            id="colaboradores-busca"
            label="Buscar por nome ou matrícula"
          >
            {(control) => (
              <input
                ref={campoBuscaRef}
                type="search"
                maxLength={BUSCA_COLABORADORES_MAXIMO}
                autoComplete="off"
                value={buscaDigitada}
                onChange={(e) => setBuscaDigitada(e.target.value)}
                {...control}
              />
            )}
          </FormField>
          <div className="colaboradores-screen__busca-acoes">
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
            {buscaDigitada !== "" || buscaAplicada !== "" ? (
              <Button type="button" variant="subtle" onClick={limparBusca}>
                Limpar busca
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <Surface
        as="section"
        padding="md"
        className="colaboradores-screen__aviso"
        aria-labelledby="colaboradores-aviso-rh-titulo"
      >
        <StatusBadge variant="info">RH e DP</StatusBadge>
        {/* T178 — o texto antigo dizia "operado exclusivamente pelo RH e DP",
            e o suporte técnico (`master_tecnico`) também abre esta tela, só
            para consultar. Operar continua sendo do RH e do DP; ler, não. */}
        <p
          id="colaboradores-aviso-rh-titulo"
          className="colaboradores-screen__aviso-texto"
        >
          Admissão e correções deste cadastro são feitas pelo RH e pelo DP da
          própria empresa; o suporte técnico apenas consulta. Consulta e
          alteração de nome geram trilha de auditoria automática; a admissão é
          registrada na página de Nova admissão.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="colaboradores-screen__aviso"
        aria-labelledby="colaboradores-aviso-indisponivel-titulo"
      >
        <StatusBadge variant="warning">Ainda indisponível</StatusBadge>
        <p
          id="colaboradores-aviso-indisponivel-titulo"
          className="colaboradores-screen__aviso-texto"
        >
          Transferência, mudança de cargo, desligamento, reclassificação de
          vínculo, Folha, documentos, benefícios, dependentes, afastamentos e
          Banco de Horas ainda não têm operação nesta tela.
        </p>
      </Surface>

      {statusCarregamento === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="colaboradores-screen__erro"
          aria-labelledby="colaboradores-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="colaboradores-erro-titulo"
            className="colaboradores-screen__section-title"
          >
            Não foi possível carregar os colaboradores
          </h2>
          <p>
            Verifique sua conexão e tente novamente. Se o problema persistir,
            contate o suporte.
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              void carregarDados(
                filtroSituacao,
                filtroSituacaoVinculo,
                buscaAplicada,
                pagina,
              )
            }
          >
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section
          className="colaboradores-screen__lista"
          aria-labelledby="colaboradores-lista-titulo"
        >
          {/* O H1 da página já diz "Colaboradores"; repetir aqui só somava
              ruído. A seção passa a nomear o que a lista realmente é. */}
          <h2
            id="colaboradores-lista-titulo"
            className="colaboradores-screen__section-title"
          >
            {empresaAtiva
              ? `Colaboradores de ${empresaAtiva.nome}`
              : "Colaboradores desta empresa"}
          </h2>

          {/* T164 — contexto e tamanho do conjunto, lado a lado.

              O total vem do SERVIDOR, do mesmo `total` que paginou a consulta.
              Não é `colaboradores.length`: esse número seria o da página, e
              exibi-lo como total faria "20" significar "vinte pessoas" numa
              empresa com duzentas.

              T178 — a contagem por situação passou a existir NO SERVIDOR
              (`contadores`) e fica no cabeçalho da página. */}
          <p className="colaboradores-screen__contexto">
            {empresaAtiva ? (
              <span className="colaboradores-screen__empresa">
                {empresaAtiva.nome}{" "}
                <span className="colaboradores-screen__empresa-codigo">
                  ({empresaAtiva.codigo})
                </span>
              </span>
            ) : null}
            {/* Sem `role="status"`: a tela ja tem duas regioes vivas - a
                mensagem de carregamento e a posicao da paginacao. Uma terceira
                faria o leitor de tela anunciar o total a cada filtro, por cima
                das outras duas, e tres avisos simultaneos nao informam: atropelam. */}
            <span className="colaboradores-screen__total">
              {statusCarregamento === "dados"
                ? total === 1
                  ? "1 colaborador no filtro atual"
                  : `${total} colaboradores no filtro atual`
                : "Contando…"}
            </span>
          </p>

          <div className="colaboradores-screen__filtros">
            <FormField id="colaboradores-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(e) =>
                    setFiltroSituacao(e.target.value as FiltroSituacao)
                  }
                  disabled={statusCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todas as situações</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              )}
            </FormField>

            <FormField
              id="colaboradores-filtro-situacao-vinculo"
              label="Situação do vínculo"
            >
              {(control) => (
                <select
                  value={filtroSituacaoVinculo}
                  onChange={(e) =>
                    setFiltroSituacaoVinculo(
                      e.target.value as FiltroSituacaoVinculo,
                    )
                  }
                  disabled={statusCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todas</option>
                  <option value="previsto">Previsto</option>
                  <option value="ativo">Ativo</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              )}
            </FormField>
          </div>

          {statusCarregamento === "carregando" ? (
            <p className="colaboradores-screen__carregando" role="status">
              Carregando colaboradores…
            </p>
          ) : colaboradores.length === 0 ? (
            /* T178 — três vazios diferentes, porque pedem ações diferentes.

               (b) Busca ou filtro sem resultado: o conjunto existe, a consulta
               é que não achou — oferecer "Nova admissão" aqui sugeriria
               cadastrar de novo quem talvez só tenha sido digitado errado.
               (a) Sem busca nem filtro e o servidor contando zero: a empresa
               ainda não tem colaborador, e a ação é admitir.
               Fora dos dois — sem filtro, contadores acima de zero e página
               vazia —, o conjunto provavelmente mudou entre uma leitura e
               outra; a saída é voltar à primeira página, não admitir. */
            filtrando ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhum colaborador encontrado"
                description={
                  buscaAplicada
                    ? temFiltro
                      ? `Nenhum colaborador corresponde a “${buscaAplicada}” com os filtros selecionados.`
                      : `Nenhum colaborador corresponde a “${buscaAplicada}” por nome ou matrícula.`
                    : "Nenhum colaborador corresponde aos filtros selecionados."
                }
                action={
                  <Button variant="secondary" onClick={limparBuscaEFiltros}>
                    Limpar busca e filtros
                  </Button>
                }
              />
            ) : contadores !== null &&
              contadores.ativos + contadores.inativos > 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhum colaborador nesta página"
                description="Esta página voltou vazia, embora a empresa tenha colaboradores: o conjunto pode ter mudado desde a última leitura."
                action={
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void carregarDados(
                        filtroSituacao,
                        filtroSituacaoVinculo,
                        buscaAplicada,
                        1,
                      )
                    }
                  >
                    Ir para a primeira página
                  </Button>
                }
              />
            ) : (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhum colaborador cadastrado nesta empresa"
                description={
                  onNovaAdmissao
                    ? "Registre a admissão do primeiro colaborador desta empresa."
                    : "Ainda não há colaboradores admitidos nesta empresa."
                }
                {...(onNovaAdmissao
                  ? {
                      action: (
                        <Button onClick={onNovaAdmissao}>Nova admissão</Button>
                      ),
                    }
                  : {})}
              />
            )
          ) : (
            <DataTable
              caption="Colaboradores desta empresa"
              captionVisible={false}
              columns={colunasColaboradores}
              rows={colaboradores}
              rowKey={(c) => c.id}
            />
          )}

          {/* T164, com a correção R-2 da revisão adversarial.

              A navegação fica FORA do ramo que troca durante o carregamento.
              Antes ela vivia junto da tabela, dentro do `else`: acionar
              "Próxima página" desmontava o botão que tinha o foco, e o foco
              caía no `<body>` — quem navega por teclado perdia a posição a
              cada troca de página e tinha de tabular de volta.

              Os controles ficam inertes por `aria-disabled`, e não por
              `disabled`. A diferença é exatamente o ponto: um botão
              `disabled` que tem o foco também o perde, porque deixa de ser
              focalizável. Com `aria-disabled` ele permanece no foco e na
              ordem de tabulação, anuncia o estado ao leitor de tela, e quem
              recusa a ação é `irParaPagina` — que já retorna cedo quando a
              página é inválida ou há carga em voo.

              `aria-busy` no `<nav>` informa o carregamento sem depender de o
              texto mudar. */}
          {totalPaginas > 1 ? (
            <nav
              className="colaboradores-screen__paginacao"
              aria-label="Paginação de colaboradores"
              aria-busy={carregando}
            >
              <Button
                variant="secondary"
                onClick={() => irParaPagina(pagina - 1)}
                aria-disabled={pagina <= 1 || carregando}
              >
                Página anterior
              </Button>
              <span
                role="status"
                className="colaboradores-screen__paginacao-posicao"
              >
                {carregando
                  ? "Carregando página…"
                  : `Página ${pagina} de ${totalPaginas}`}
              </span>
              <Button
                variant="secondary"
                onClick={() => irParaPagina(pagina + 1)}
                aria-disabled={pagina >= totalPaginas || carregando}
              >
                Próxima página
              </Button>
            </nav>
          ) : null}
        </section>
      )}

      <Modal
        aberto={detalhe !== null}
        titulo={detalhe?.colaborador.nome ?? ""}
        onFechar={fecharDetalhe}
        bloqueado={
          (detalhe?.salvandoNome ?? false) ||
          salvandoContatos ||
          salvandoDadosPessoais ||
          salvandoJornada
        }
        alterado={
          detalheNomeAlterado ||
          contatosAlterados ||
          dadosPessoaisAlterados ||
          jornadaAlterada
        }
        largura="media"
      >
        {detalhe ? (
          <>
            <p>
              <StatusBadge
                variant={
                  VARIANTE_SITUACAO_COLABORADOR[detalhe.colaborador.situacao] ??
                  "neutral"
                }
              >
                {detalhe.colaborador.situacao === "ativo" ? "Ativo" : "Inativo"}
              </StatusBadge>
            </p>
            <p className="colaboradores-screen__aviso-texto">
              Matrícula, tipo de vínculo e data de admissão são imutáveis nesta
              tela. O nome, os dados pessoais, o endereço e os contatos podem
              ser corrigidos abaixo.
            </p>

            <div className="colaboradores-screen__edicao-nome">
              <FormField
                id="colaboradores-detalhe-nome"
                label="Nome"
                {...(detalhe.erroNome ? { error: detalhe.erroNome } : {})}
              >
                {(control) => (
                  <input
                    type="text"
                    maxLength={160}
                    value={detalhe.nomeEdicao}
                    onChange={(e) =>
                      setDetalhe((prev) =>
                        prev
                          ? {
                              ...prev,
                              nomeEdicao: e.target.value,
                              erroNome: null,
                            }
                          : prev,
                      )
                    }
                    {...control}
                  />
                )}
              </FormField>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleSalvarNome()}
                disabled={detalhe.salvandoNome || !detalheNomeAlterado}
              >
                {detalhe.salvandoNome ? "Salvando…" : "Salvar nome"}
              </Button>
            </div>

            {/* T177 — Módulo 1: dados pessoais e endereço. T181 — editáveis,
                cada bloco com Salvar e Cancelar. */}
            <DadosPessoaisColaboradorSecao
              key={`dados-${detalhe.colaborador.id}`}
              colaboradorId={detalhe.colaborador.id}
              podeEditar={podeEditarFicha}
              onAlteradoChange={setDadosPessoaisAlterados}
              onSalvandoChange={setSalvandoDadosPessoais}
            />

            <ContatosColaboradorSecao
              key={detalhe.colaborador.id}
              colaboradorId={detalhe.colaborador.id}
              onAlteradoChange={setContatosAlterados}
              onSalvandoChange={setSalvandoContatos}
              focarAoCarregar={focarContatos}
              podeEditar={podeEditarFicha}
            />

            {/* T183 — a jornada atual e o histórico de vigências; o RH
                atribui, troca e encerra. */}
            <JornadaColaboradorSecao
              key={`jornada-${detalhe.colaborador.id}`}
              colaboradorId={detalhe.colaborador.id}
              podeOperar={podeOperarJornada}
              onAlteradoChange={setJornadaAlterada}
              onSalvandoChange={setSalvandoJornada}
            />

            <div className="colaboradores-screen__vinculos">
              <h3 className="colaboradores-screen__section-title">Vínculos</h3>
              {detalhe.statusVinculos === "carregando" ? (
                <p className="colaboradores-screen__carregando" role="status">
                  Carregando vínculos…
                </p>
              ) : detalhe.statusVinculos === "erro" ? (
                <p className="colaboradores-screen__form-erro" role="alert">
                  Não foi possível carregar os vínculos deste colaborador.{" "}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void carregarVinculos(detalhe.colaborador.id)
                    }
                  >
                    Tentar novamente
                  </Button>
                </p>
              ) : detalhe.vinculos.length === 0 ? (
                <p>Nenhum vínculo encontrado.</p>
              ) : (
                <DataTable
                  caption={`Vínculos — ${detalhe.colaborador.nome}`}
                  columns={colunasVinculos}
                  rows={detalhe.vinculos}
                  rowKey={(v) => v.id}
                />
              )}
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
