/**
 * T203 — aba "Solicitações" da ficha do colaborador. **Só consulta.**
 *
 * Mostra as Solicitações de Pessoas (ajuste de ponto, ausência, férias,
 * atualização cadastral, atestado e benefícios) da pessoa aberta, na empresa
 * ativa da sessão: um bloco por vínculo dela nessa empresa (o principal
 * primeiro, inclusive encerrados — S-4), cada solicitação com detalhe e linha
 * do tempo. Solicitações de documento ficam na aba Documentos.
 *
 * Contratos que já existiam (os mesmos de Pessoas › Solicitações), sem
 * endpoint novo:
 * - `GET /v1/users/me` — a empresa ativa da SESSÃO;
 * - `GET /v1/solicitacoes-pessoas?vinculoId=` — uma consulta por vínculo (o
 *   servidor não filtra por pessoa), lendo TODAS as páginas (100 por página);
 * - `GET /v1/solicitacoes-pessoas/:id` e `/:id/historico` — o detalhe e a
 *   linha do tempo, ao abrir uma solicitação.
 * Os vínculos já vêm da ficha (`GET /v1/colaboradores/:id/vinculos`).
 *
 * T204 — a primeira ação: o RH (só `rh` com empresa ativa) registra e envia
 * uma solicitação da pessoa pela "Nova solicitação" (decisões A-1 a A-6):
 * - `POST /v1/solicitacoes-pessoas` e, em seguida,
 *   `POST /v1/solicitacoes-pessoas/:id/transicoes` com `acao: "enviar"` — os
 *   mesmos contratos da Central, nesta ordem, sem repetição automática;
 * - se o registro falhar ou ficar incerto, nada é enviado e a pessoa confere a
 *   lista; se o envio falhar depois do registro, o detalhe daquele rascunho
 *   abre com "Enviar" (só para ele);
 * - analisar, encaminhar, recusar, reabrir e cancelar continuam na Central
 *   (Pessoas › Solicitações). "Atestado" é um tipo como os outros (S-5):
 *   tipo, motivo e datas, sem anexo nem CID.
 * O formulário vive numa janela do Evolli (`NovaSolicitacaoModal`), que se
 * declara na guarda de saída (T200) enquanto houver alteração ou envio.
 *
 * Empresa ativa (S-2): sem ela — o `master_tecnico` global —, a leitura do
 * servidor é de todas as empresas; a aba não consulta nada e orienta a
 * escolher a empresa. O DP nem chega aqui: o shell não oferece a aba (S-3).
 * O `master_tecnico` com empresa só lê: nenhum controle de escrita.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, DataTable, StatusBadge } from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import { obterUsuarioAtual } from "../../api/usersClient";
import {
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../api/csrfClient";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import type {
  SituacaoVinculo,
  TipoVinculo,
  VinculoApi,
} from "../../api/colaboradoresClient";
import {
  ApiError,
  ROTULO_ACAO,
  ROTULO_MOTIVO,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  VARIANTE_SITUACAO,
  type SolicitacaoPessoaApi,
  type SolicitacaoPessoaEventoApi,
  detalharSolicitacaoPessoa,
  historicoSolicitacaoPessoa,
  listarSolicitacoesPessoas,
  registrarSolicitacaoPessoa,
  transicionarSolicitacaoPessoa,
} from "../../api/solicitacoesPessoasClient";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import {
  NovaSolicitacaoModal,
  type DadosDaNovaSolicitacao,
} from "./NovaSolicitacaoModal";
import "./SolicitacoesColaboradorSecao.css";

/** Itens por página pedidos ao servidor: o máximo que ele aceita. */
export const TAMANHO_PAGINA_SOLICITACOES = 100;

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

const ROTULO_SITUACAO_VINCULO: Record<SituacaoVinculo, string> = {
  ativo: "Ativo",
  previsto: "Previsto",
  encerrado: "Encerrado",
};

const VARIANTE_SITUACAO_VINCULO: Record<SituacaoVinculo, StatusVariant> = {
  ativo: "success",
  previsto: "info",
  encerrado: "neutral",
};

/** Falha com nova tentativa: o aviso e o botão ficam no lugar ao reler. */
interface Falha {
  readonly tipo: "erro";
  readonly relendo: boolean;
  readonly falhas: number;
}

function proximaFalha(anterior: { readonly tipo: string }): Falha {
  const falhas = anterior.tipo === "erro" ? (anterior as Falha).falhas : 0;
  return { tipo: "erro", relendo: false, falhas: falhas + 1 };
}

function emNovaLeitura<T extends { readonly tipo: string }>(anterior: T): T {
  return anterior.tipo === "erro" ? { ...anterior, relendo: true } : anterior;
}

type EstadoDaSessao =
  | { readonly tipo: "carregando" }
  | Falha
  | { readonly tipo: "sem-empresa" }
  | {
      readonly tipo: "pronta";
      readonly empresaId: string;
      /** T204 — só `rh` com empresa registra e envia (espelha a Central). */
      readonly podeRegistrar: boolean;
    };

type EstadoDaLista =
  | { readonly tipo: "carregando" }
  | Falha
  | {
      readonly tipo: "dados";
      readonly porVinculo: ReadonlyMap<string, readonly SolicitacaoPessoaApi[]>;
    };

type ConteudoDoDetalhe =
  | { readonly tipo: "carregando" }
  | Falha
  | { readonly tipo: "indisponivel" }
  | {
      readonly tipo: "dados";
      readonly solicitacao: SolicitacaoPessoaApi;
      readonly eventos: readonly SolicitacaoPessoaEventoApi[];
    };

interface Detalhe {
  /** A linha que abriu o detalhe (e cujo botão recebe o foco de volta). */
  readonly linha: SolicitacaoPessoaApi;
  readonly conteudo: ConteudoDoDetalhe;
}

/** "Férias, registrada em 05/10/2026 às 09:00" — nome acessível da linha. */
function descricaoDaLinha(s: SolicitacaoPessoaApi): string {
  return `${ROTULO_TIPO[s.tipo] ?? s.tipo}, registrada em ${formatarInstante(s.criadoEm)}`;
}

/** Um texto anunciado uma vez (a `n` muda a cada evento). */
interface Aviso {
  readonly texto: string;
  readonly n: number;
}

/**
 * T204 — falha do REGISTRO. Recusa do servidor (ou pedido que nem saiu) diz
 * que nada foi registrado; sem resposta (rede) ou 5xx é incerto: o registro
 * pode ter sido gravado, então nada é repetido e a pessoa confere a lista.
 */
function falhaDoRegistro(erro: unknown): {
  readonly texto: string;
  readonly incerto: boolean;
} {
  if (falhaPorSessaoExpirada(erro)) {
    return {
      texto:
        "Sua sessão expirou e nada foi registrado. Entre de novo para continuar.",
      incerto: false,
    };
  }
  // Outra aba renovou o token CSRF: o servidor recusou, o token já foi
  // descartado e confirmar de novo pede um novo.
  if (falhaPorTokenDesatualizado(erro)) {
    return {
      texto:
        "Esta página ficou desatualizada e nada foi registrado. Confirme de novo.",
      incerto: false,
    };
  }
  // B2 — o token não pôde ser obtido: o pedido nem saiu. Não é incerto.
  if (falhaAoPrepararEnvio(erro)) {
    return {
      texto:
        "Não foi possível preparar o envio e nada foi registrado. Confira a conexão e tente de novo.",
      incerto: false,
    };
  }
  if (erro instanceof ApiError && erro.status < 500) {
    switch (erro.status) {
      case 403:
        return {
          texto:
            "Seu perfil não tem permissão para registrar solicitações nesta empresa. Nada foi registrado.",
          incerto: false,
        };
      case 404:
        return {
          texto:
            "O vínculo escolhido não está disponível na empresa ativa. Nada foi registrado.",
          incerto: false,
        };
      default:
        return {
          texto:
            "Os dados foram recusados e nada foi registrado. Confira o tipo, o vínculo, o motivo e o dia.",
          incerto: false,
        };
    }
  }
  return {
    texto:
      "Não foi possível confirmar se a solicitação foi registrada. Feche esta janela e confira a lista antes de tentar de novo; nada é repetido automaticamente.",
    incerto: true,
  };
}

/** T204 — falha do ENVIO de um rascunho; a situação é relida em seguida. */
function falhaDoEnvio(erro: unknown): string {
  if (falhaPorSessaoExpirada(erro)) {
    return "Sua sessão expirou e nada foi enviado. Entre de novo para continuar.";
  }
  if (falhaPorTokenDesatualizado(erro)) {
    return "Esta página ficou desatualizada e nada foi enviado. A solicitação foi atualizada: se ainda estiver em rascunho, use “Enviar” de novo.";
  }
  if (falhaAoPrepararEnvio(erro)) {
    return "Não foi possível preparar o envio e nada foi enviado. Confira a conexão e tente de novo.";
  }
  if (erro instanceof ApiError && erro.status < 500) {
    switch (erro.status) {
      case 403:
        return "Seu perfil não tem permissão para enviar esta solicitação. Nada foi alterado.";
      case 404:
        return "Esta solicitação não está mais disponível na empresa ativa.";
      default:
        return "O envio não é mais possível na situação atual. A solicitação foi atualizada.";
    }
  }
  return "Não foi possível confirmar o envio. A solicitação foi atualizada: se ainda estiver em rascunho, use “Enviar” de novo.";
}

export interface SolicitacoesColaboradorSecaoProps {
  readonly colaboradorId: string;
  readonly nomeColaborador: string;
  /** Os vínculos da pessoa, como a ficha os leu (escopo da sessão). */
  readonly vinculos: readonly VinculoApi[];
  /** O vínculo principal (mesma regra do cabeçalho), ou `null`. */
  readonly vinculoPrincipalId: string | null;
}

export function SolicitacoesColaboradorSecao({
  colaboradorId,
  nomeColaborador,
  vinculos,
  vinculoPrincipalId,
}: SolicitacoesColaboradorSecaoProps) {
  const prefixo = useId();
  const ids = useMemo(
    () => ({
      titulo: `${prefixo}-titulo`,
      novaTentativa: `${prefixo}-nova-tentativa`,
      novaSolicitacao: `${prefixo}-nova-solicitacao`,
      tituloDetalhe: `${prefixo}-detalhe`,
      tentarDetalhe: `${prefixo}-tentar-detalhe`,
      vinculo: (vinculoId: string) => `${prefixo}-vinculo-${vinculoId}`,
      verDetalhe: (solicitacaoId: string) => `${prefixo}-ver-${solicitacaoId}`,
    }),
    [prefixo],
  );

  const [sessao, setSessao] = useState<EstadoDaSessao>({ tipo: "carregando" });
  const [lista, setLista] = useState<EstadoDaLista>({ tipo: "carregando" });
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  /**
   * O resultado da lista já foi anunciado e outra fala tomou o lugar (o
   * detalhe ou um aviso de envio): abrir, concluir, falhar ou fechar o
   * detalhe não repete o anúncio da lista. Só uma nova leitura da lista volta
   * a anunciar.
   */
  const [detalheDesdeALista, setDetalheDesdeALista] = useState(false);

  // ---- T204: Nova solicitação ------------------------------------------------
  const [novaAberta, setNovaAberta] = useState(false);
  const [enviandoNova, setEnviandoNova] = useState(false);
  const [erroNova, setErroNova] = useState<Aviso | null>(null);
  /** Registro incerto: ao fechar a janela, a lista é relida para conferir. */
  const conferirAoFecharRef = useRef(false);
  /** Trava contra clique repetido, síncrona (o estado só vale no desenho). */
  const enviandoRef = useRef(false);
  /** Aviso de sucesso no nó de status (um por evento). */
  const [aviso, setAviso] = useState<Aviso | null>(null);
  /** Rascunhos que ESTA ficha registrou e não conseguiu enviar. */
  const [rascunhosDaFicha, setRascunhosDaFicha] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [enviandoRascunho, setEnviandoRascunho] = useState(false);
  /** Aviso do painel de detalhe (envio não confirmado ou recusado). */
  const [avisoDoDetalhe, setAvisoDoDetalhe] = useState<Aviso | null>(null);
  const contadorRef = useRef(0);
  const proximoN = () => ++contadorRef.current;

  // O envio de um rascunho em curso é salvamento: a guarda de saída espera.
  // (A janela "Nova solicitação" se declara sozinha, pelo `Modal`.)
  useEdicaoEmAndamento("Envio da solicitação", {
    pendente: false,
    salvando: enviandoRascunho,
  });

  /** `id` do elemento que recebe o foco depois do próximo desenho. */
  const focoRef = useRef<string | null>(null);
  const vivaRef = useRef(true);
  useEffect(() => {
    vivaRef.current = true;
    return () => {
      vivaRef.current = false;
    };
  }, []);
  /** Só vale a leitura mais recente de cada tipo. */
  const geracaoRef = useRef({ lista: 0, detalhe: 0 });

  // ---- Sessão: empresa ativa -------------------------------------------------
  const carregarSessao = useCallback(
    async (novaLeitura = false) => {
      if (novaLeitura) setSessao(emNovaLeitura);
      else setSessao({ tipo: "carregando" });
      try {
        const ator = await obterUsuarioAtual();
        if (!vivaRef.current) return;
        const empresaId =
          typeof ator.companyId === "string" && ator.companyId.length > 0
            ? ator.companyId
            : null;
        if (novaLeitura) focoRef.current = ids.titulo;
        setSessao(
          empresaId === null
            ? { tipo: "sem-empresa" }
            : {
                tipo: "pronta",
                empresaId,
                podeRegistrar: ator.role === "rh",
              },
        );
      } catch {
        if (vivaRef.current) setSessao(proximaFalha);
      }
    },
    [ids],
  );

  useEffect(() => {
    void carregarSessao();
  }, [carregarSessao]);

  const empresaId = sessao.tipo === "pronta" ? sessao.empresaId : null;
  const podeRegistrar = sessao.tipo === "pronta" && sessao.podeRegistrar;

  /** Os vínculos desta pessoa NESTA empresa, o principal primeiro (S-4). */
  const vinculosDaEmpresa = useMemo(() => {
    if (empresaId === null) return [];
    const daEmpresa = vinculos.filter(
      (v) => v.colaboradorId === colaboradorId && v.empresaId === empresaId,
    );
    const principal = daEmpresa.find((v) => v.id === vinculoPrincipalId);
    return principal
      ? [principal, ...daEmpresa.filter((v) => v.id !== principal.id)]
      : daEmpresa;
  }, [vinculos, colaboradorId, empresaId, vinculoPrincipalId]);
  const idsDosVinculos = useMemo(
    () => new Set(vinculosDaEmpresa.map((v) => v.id)),
    [vinculosDaEmpresa],
  );

  // ---- Lista: todas as páginas de cada vínculo --------------------------------
  /**
   * `inicial` e `novaTentativa` anunciam a carga e o resultado. `silenciosa`
   * (T204, depois de gravar) troca a lista no lugar, sem "Carregando…" e sem
   * anúncio: quem fala é o aviso da gravação.
   */
  const carregarLista = useCallback(
    async (modo: "inicial" | "novaTentativa" | "silenciosa" = "inicial") => {
      if (empresaId === null) return;
      const geracao = ++geracaoRef.current.lista;
      if (modo !== "silenciosa") {
        setDetalheDesdeALista(false);
        setAviso(null);
      }
      if (modo === "novaTentativa") setLista(emNovaLeitura);
      else if (modo === "inicial") setLista({ tipo: "carregando" });
      try {
        const lidas = await Promise.all(
          vinculosDaEmpresa.map(async (vinculo) => {
            const consulta = (pagina: number) =>
              listarSolicitacoesPessoas({
                vinculoId: vinculo.id,
                pagina,
                tamanhoPagina: TAMANHO_PAGINA_SOLICITACOES,
              });
            const primeira = await consulta(1);
            const paginas = Math.max(
              1,
              Math.ceil(primeira.total / TAMANHO_PAGINA_SOLICITACOES),
            );
            const demais = await Promise.all(
              Array.from({ length: paginas - 1 }, (_, i) => consulta(i + 2)),
            );
            // Defesa além do servidor: só deste vínculo e desta empresa, sem
            // repetir (um registro novo entre duas páginas empurraria uma
            // linha para a página seguinte).
            const vistos = new Set<string>();
            const itens = [primeira, ...demais]
              .flatMap((p) => p.itens)
              .filter((s) => {
                if (
                  s.vinculoId !== vinculo.id ||
                  s.empresaId !== empresaId ||
                  vistos.has(s.id)
                ) {
                  return false;
                }
                vistos.add(s.id);
                return true;
              });
            return [vinculo.id, itens] as const;
          }),
        );
        if (!vivaRef.current || geracao !== geracaoRef.current.lista) return;
        if (modo === "novaTentativa") focoRef.current = ids.titulo;
        setLista({ tipo: "dados", porVinculo: new Map(lidas) });
      } catch {
        if (!vivaRef.current || geracao !== geracaoRef.current.lista) return;
        // Na releitura silenciosa, os blocos (e o foco neles) somem: o foco
        // vai à nova tentativa, nunca ao `body`.
        if (modo === "silenciosa") focoRef.current = ids.novaTentativa;
        setLista(proximaFalha);
      }
    },
    [empresaId, vinculosDaEmpresa, ids],
  );

  useEffect(() => {
    if (empresaId === null) return;
    void carregarLista();
  }, [empresaId, carregarLista]);

  // ---- Detalhe e linha do tempo -----------------------------------------------
  const carregarDetalhe = useCallback(
    async (linha: SolicitacaoPessoaApi, novaLeitura = false) => {
      if (empresaId === null) return;
      const geracao = ++geracaoRef.current.detalhe;
      setDetalheDesdeALista(true);
      if (!novaLeitura) {
        setAviso(null);
        setAvisoDoDetalhe(null);
      }
      setDetalhe((atual) =>
        novaLeitura && atual && atual.linha.id === linha.id
          ? { linha, conteudo: emNovaLeitura(atual.conteudo) }
          : { linha, conteudo: { tipo: "carregando" } },
      );
      try {
        const [solicitacao, eventos] = await Promise.all([
          detalharSolicitacaoPessoa(linha.id),
          historicoSolicitacaoPessoa(linha.id),
        ]);
        if (!vivaRef.current || geracao !== geracaoRef.current.detalhe) return;
        // Defesa além do servidor: o detalhe tem de ser o pedido, desta
        // empresa e de um vínculo desta pessoa; a linha do tempo, só dele.
        if (
          solicitacao.id !== linha.id ||
          solicitacao.empresaId !== empresaId ||
          !idsDosVinculos.has(solicitacao.vinculoId)
        ) {
          setDetalhe({ linha, conteudo: { tipo: "indisponivel" } });
          return;
        }
        const daSolicitacao = eventos
          .filter(
            (e) => e.solicitacaoId === linha.id && e.empresaId === empresaId,
          )
          .sort(
            (a, b) =>
              Date.parse(a.ocorridoEm) - Date.parse(b.ocorridoEm) ||
              a.id.localeCompare(b.id),
          );
        focoRef.current = ids.tituloDetalhe;
        setDetalhe({
          linha,
          conteudo: { tipo: "dados", solicitacao, eventos: daSolicitacao },
        });
      } catch (erro) {
        if (!vivaRef.current || geracao !== geracaoRef.current.detalhe) return;
        const foraDoEscopo =
          erro instanceof ApiError &&
          (erro.status === 404 || erro.status === 403);
        setDetalhe((atual) => ({
          linha,
          conteudo: foraDoEscopo
            ? { tipo: "indisponivel" }
            : proximaFalha(
                atual && atual.linha.id === linha.id
                  ? atual.conteudo
                  : { tipo: "carregando" },
              ),
        }));
      }
    },
    [empresaId, idsDosVinculos, ids],
  );

  function fecharDetalhe() {
    if (detalhe === null || enviandoRascunho) return;
    // Fechar descarta qualquer leitura em curso do detalhe.
    geracaoRef.current.detalhe++;
    focoRef.current = ids.verDetalhe(detalhe.linha.id);
    setAvisoDoDetalhe(null);
    setDetalhe(null);
  }

  // ---- T204: registrar e enviar ------------------------------------------------
  function abrirNova() {
    if (!podeRegistrar || enviandoRef.current) return;
    setErroNova(null);
    conferirAoFecharRef.current = false;
    setNovaAberta(true);
  }

  function fecharNova() {
    if (enviandoRef.current) return;
    setNovaAberta(false);
    setErroNova(null);
    // A janela devolve o foco a "Nova solicitação"; se o botão sumiu, o
    // título da aba o recebe.
    if (!document.getElementById(ids.novaSolicitacao)) {
      focoRef.current = ids.titulo;
    }
    if (conferirAoFecharRef.current) {
      conferirAoFecharRef.current = false;
      void carregarLista("silenciosa");
    }
  }

  async function confirmarNova(dados: DadosDaNovaSolicitacao) {
    if (enviandoRef.current || empresaId === null || !podeRegistrar) return;
    // Defesa: só um vínculo desta pessoa nesta empresa.
    if (!idsDosVinculos.has(dados.vinculoId)) return;
    enviandoRef.current = true;
    setEnviandoNova(true);
    setErroNova(null);

    // 1. Registrar. Sem repetição automática: o contrato não é idempotente.
    let registrada: SolicitacaoPessoaApi;
    try {
      registrada = await registrarSolicitacaoPessoa({
        empresaId,
        vinculoId: dados.vinculoId,
        tipo: dados.tipo,
        motivo: dados.motivo,
        ...(dados.periodoReferencia
          ? { periodoReferencia: dados.periodoReferencia }
          : {}),
      });
    } catch (erro: unknown) {
      if (!vivaRef.current) return;
      enviandoRef.current = false;
      setEnviandoNova(false);
      const { texto, incerto } = falhaDoRegistro(erro);
      if (incerto) conferirAoFecharRef.current = true;
      setErroNova({ texto, n: proximoN() });
      return;
    }
    // Defesa: a resposta tem de ser do vínculo e da empresa pedidos. Se não
    // for, nada é enviado e a pessoa confere a lista.
    if (
      registrada.empresaId !== empresaId ||
      registrada.vinculoId !== dados.vinculoId
    ) {
      enviandoRef.current = false;
      if (!vivaRef.current) return;
      setEnviandoNova(false);
      conferirAoFecharRef.current = true;
      setErroNova({ texto: falhaDoRegistro(null).texto, n: proximoN() });
      return;
    }

    // 2. Enviar o registro recém-criado — e só ele. Mesmo que a aba tenha
    // sido desmontada no meio (a guarda impede, mas não custa): a pessoa
    // confirmou o envio, e parar aqui deixaria um rascunho sem saída.
    try {
      await transicionarSolicitacaoPessoa(registrada.id, { acao: "enviar" });
    } catch (erro: unknown) {
      if (!vivaRef.current) return;
      enviandoRef.current = false;
      setEnviandoNova(false);
      setNovaAberta(false);
      setRascunhosDaFicha((atual) => new Set(atual).add(registrada.id));
      // O detalhe daquele registro abre com "Enviar"; nada é registrado de
      // novo. A situação real vem do servidor.
      void carregarDetalhe(registrada);
      setAvisoDoDetalhe({
        texto: falhaPorSessaoExpirada(erro)
          ? "A solicitação foi registrada, mas não foi enviada: sua sessão expirou. Entre de novo e use “Enviar” para concluir."
          : falhaAoPrepararEnvio(erro)
            ? "A solicitação foi registrada, mas não foi enviada: não foi possível preparar o envio. Confira a conexão e use “Enviar” para concluir."
            : "A solicitação foi registrada, mas o envio não foi confirmado. Se ela estiver em rascunho, use “Enviar” para concluir.",
        n: proximoN(),
      });
      void carregarLista("silenciosa");
      return;
    }
    if (!vivaRef.current) return;
    enviandoRef.current = false;
    setEnviandoNova(false);
    setNovaAberta(false);
    setAviso({
      texto: `Solicitação de ${ROTULO_TIPO[dados.tipo]} registrada e enviada.`,
      n: proximoN(),
    });
    focoRef.current = ids.vinculo(dados.vinculoId);
    void carregarLista("silenciosa");
  }

  async function enviarRascunho(linha: SolicitacaoPessoaApi) {
    if (
      enviandoRef.current ||
      !podeRegistrar ||
      !rascunhosDaFicha.has(linha.id)
    ) {
      return;
    }
    enviandoRef.current = true;
    setEnviandoRascunho(true);
    setAvisoDoDetalhe(null);
    try {
      await transicionarSolicitacaoPessoa(linha.id, { acao: "enviar" });
      if (!vivaRef.current) return;
      setRascunhosDaFicha((atual) => {
        const proximo = new Set(atual);
        proximo.delete(linha.id);
        return proximo;
      });
      void carregarDetalhe(linha, true);
      setAviso({
        texto: `Solicitação de ${ROTULO_TIPO[linha.tipo] ?? linha.tipo} enviada.`,
        n: proximoN(),
      });
    } catch (erro: unknown) {
      if (!vivaRef.current) return;
      setAvisoDoDetalhe({ texto: falhaDoEnvio(erro), n: proximoN() });
      // B2 — o pedido nem saiu: nada mudou no servidor, então nada é relido
      // e "Enviar" continua ali para a nova tentativa.
      if (falhaAoPrepararEnvio(erro)) {
        enviandoRef.current = false;
        setEnviandoRascunho(false);
        return;
      }
      // A situação é relida do servidor: nada é projetado localmente.
      void carregarDetalhe(linha, true);
    } finally {
      if (vivaRef.current && enviandoRef.current) {
        enviandoRef.current = false;
        setEnviandoRascunho(false);
        focoRef.current = ids.tituloDetalhe;
        void carregarLista("silenciosa");
      }
    }
  }

  function rotuloDoVinculo(v: VinculoApi): string {
    return `${ROTULO_TIPO_VINCULO[v.tipo] ?? v.tipo} · ${exibirMatricula(
      v.matricula,
    )} · ${ROTULO_SITUACAO_VINCULO[v.situacao] ?? v.situacao}${
      v.id === vinculoPrincipalId ? " · vínculo principal" : ""
    }`;
  }

  // ---- Foco depois do desenho -----------------------------------------------
  useEffect(() => {
    const id = focoRef.current;
    if (id === null) return;
    const alvo = document.getElementById(id);
    if (!alvo) return;
    focoRef.current = null;
    alvo.focus();
  });

  // ---- Desenho ----------------------------------------------------------------
  const cabecalho = (
    <>
      <h2
        id={ids.titulo}
        tabIndex={-1}
        className="ficha-colaborador__subtitulo"
      >
        Solicitações
      </h2>
      {podeRegistrar ? (
        <p className="solicitacoes-colaborador__aviso">
          <StatusBadge variant="info">Registro e envio</StatusBadge> Pedidos de
          Pessoas desta pessoa, com detalhe e linha do tempo. Aqui o RH registra
          e envia novos pedidos; analisar, encaminhar, recusar, reabrir e
          cancelar continuam em Pessoas › Solicitações. Solicitações de
          documento ficam na aba Documentos.
        </p>
      ) : (
        <p className="solicitacoes-colaborador__aviso">
          <StatusBadge variant="info">Somente consulta</StatusBadge> Pedidos de
          Pessoas desta pessoa, com detalhe e linha do tempo. Registrar e dar
          andamento às solicitações continua em Pessoas › Solicitações.
          Solicitações de documento ficam na aba Documentos.
        </p>
      )}
    </>
  );

  // Um só nó de status do começo ao fim (lição do B3 da T201): sessão e lista
  // carregando dizem o MESMO texto; o detalhe anuncia só a própria carga, e o
  // resultado da lista é anunciado uma vez por leitura (B1).
  const carregandoLista =
    sessao.tipo === "carregando" ||
    (sessao.tipo === "pronta" &&
      (lista.tipo === "carregando" ||
        (lista.tipo === "erro" && lista.relendo)));
  const carregandoDetalhe =
    detalhe !== null &&
    (detalhe.conteudo.tipo === "carregando" ||
      (detalhe.conteudo.tipo === "erro" && detalhe.conteudo.relendo));
  const totalDeItens =
    lista.tipo === "dados"
      ? [...lista.porVinculo.values()].reduce((n, l) => n + l.length, 0)
      : 0;
  // T204 — o aviso de gravação vale como fala própria (um `span` novo por
  // evento, no MESMO nó de status), sem repetir o anúncio da lista.
  const textoDoStatus = carregandoLista
    ? "Carregando solicitações…"
    : carregandoDetalhe
      ? "Carregando o detalhe da solicitação…"
      : aviso
        ? null
        : !detalheDesdeALista &&
            sessao.tipo === "pronta" &&
            lista.tipo === "dados" &&
            vinculosDaEmpresa.length > 0
          ? totalDeItens === 0
            ? `Nenhuma solicitação registrada para ${nomeColaborador}.`
            : `Solicitações de ${nomeColaborador} carregadas.`
          : "";

  const colunas: DataTableColumn<SolicitacaoPessoaApi>[] = [
    {
      key: "tipo",
      header: "Tipo",
      cell: (s) => ROTULO_TIPO[s.tipo] ?? s.tipo,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (s) => (
        <StatusBadge variant={VARIANTE_SITUACAO[s.situacao] ?? "neutral"}>
          {ROTULO_SITUACAO[s.situacao] ?? s.situacao}
        </StatusBadge>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      cell: (s) => ROTULO_MOTIVO[s.motivo] ?? s.motivo,
    },
    {
      key: "referencia",
      header: "Dia de referência",
      cell: (s) => formatarDiaCivil(s.periodoReferencia),
    },
    {
      key: "registrada",
      header: "Registrada em",
      cell: (s) => formatarInstante(s.criadoEm),
    },
    {
      key: "detalhe",
      header: "Detalhe",
      cell: (s) => (
        <Button
          id={ids.verDetalhe(s.id)}
          variant="secondary"
          aria-expanded={detalhe?.linha.id === s.id}
          onClick={() => void carregarDetalhe(s)}
        >
          Ver detalhe
          <span className="ficha-colaborador__so-leitor">
            {` da solicitação de ${descricaoDaLinha(s)}`}
          </span>
        </Button>
      ),
    },
  ];

  function painelDoDetalhe(vinculoId: string) {
    if (detalhe === null || detalhe.linha.vinculoId !== vinculoId) return null;
    const { linha, conteudo } = detalhe;
    return (
      <section
        className="solicitacoes-colaborador__detalhe"
        aria-labelledby={ids.tituloDetalhe}
      >
        <h4
          id={ids.tituloDetalhe}
          tabIndex={-1}
          className="solicitacoes-colaborador__detalhe-titulo"
        >
          {`Detalhe da solicitação de ${ROTULO_TIPO[linha.tipo] ?? linha.tipo}`}
        </h4>
        {avisoDoDetalhe ? (
          <p
            key={avisoDoDetalhe.n}
            role="alert"
            className="solicitacoes-colaborador__erro"
          >
            {avisoDoDetalhe.texto}
          </p>
        ) : null}
        {conteudo.tipo === "carregando" ? (
          <p className="ficha-colaborador__texto" aria-hidden="true">
            Carregando…
          </p>
        ) : conteudo.tipo === "indisponivel" ? (
          <p role="alert" className="ficha-colaborador__texto">
            Esta solicitação não está disponível na empresa ativa.
          </p>
        ) : conteudo.tipo === "erro" ? (
          <FalhaComNovaTentativa
            id={ids.tentarDetalhe}
            falha={conteudo}
            texto="Não foi possível carregar o detalhe da solicitação."
            onTentar={() => void carregarDetalhe(linha, true)}
          />
        ) : (
          <>
            <dl className="solicitacoes-colaborador__campos">
              <div>
                <dt>Tipo</dt>
                <dd>
                  {ROTULO_TIPO[conteudo.solicitacao.tipo] ??
                    conteudo.solicitacao.tipo}
                </dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd>
                  <StatusBadge
                    variant={
                      VARIANTE_SITUACAO[conteudo.solicitacao.situacao] ??
                      "neutral"
                    }
                  >
                    {ROTULO_SITUACAO[conteudo.solicitacao.situacao] ??
                      conteudo.solicitacao.situacao}
                  </StatusBadge>
                </dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>
                  {ROTULO_MOTIVO[conteudo.solicitacao.motivo] ??
                    conteudo.solicitacao.motivo}
                </dd>
              </div>
              <div>
                <dt>Dia de referência</dt>
                <dd>
                  {formatarDiaCivil(conteudo.solicitacao.periodoReferencia)}
                </dd>
              </div>
              <div>
                <dt>Registrada em</dt>
                <dd>{formatarInstante(conteudo.solicitacao.criadoEm)}</dd>
              </div>
              <div>
                <dt>Enviada em</dt>
                <dd>{formatarInstante(conteudo.solicitacao.enviadaEm)}</dd>
              </div>
              <div>
                <dt>Primeira revisão em</dt>
                <dd>
                  {formatarInstante(conteudo.solicitacao.primeiraRevisaoEm)}
                </dd>
              </div>
            </dl>
            <h5 className="solicitacoes-colaborador__linha-titulo">
              Linha do tempo
            </h5>
            {conteudo.eventos.length === 0 ? (
              <p className="ficha-colaborador__texto">
                Nenhum evento registrado.
              </p>
            ) : (
              <ol className="solicitacoes-colaborador__linha">
                {conteudo.eventos.map((e) => (
                  <li key={e.id}>
                    <span className="solicitacoes-colaborador__quando">
                      {formatarInstante(e.ocorridoEm)}
                    </span>{" "}
                    <strong>{ROTULO_ACAO[e.acao] ?? e.acao}</strong>
                    {` — ${
                      e.situacaoDe
                        ? `${ROTULO_SITUACAO[e.situacaoDe] ?? e.situacaoDe} → `
                        : ""
                    }${ROTULO_SITUACAO[e.situacaoPara] ?? e.situacaoPara}`}
                    {e.motivo
                      ? ` · Motivo: ${ROTULO_MOTIVO[e.motivo] ?? e.motivo}`
                      : ""}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        <div className="solicitacoes-colaborador__acoes">
          {podeRegistrar &&
          conteudo.tipo === "dados" &&
          conteudo.solicitacao.situacao === "rascunho" &&
          rascunhosDaFicha.has(linha.id) ? (
            // T204 — só o rascunho que esta ficha registrou e não enviou.
            <Button
              variant="primary"
              aria-disabled={enviandoRascunho}
              onClick={() => void enviarRascunho(linha)}
            >
              {enviandoRascunho ? "Enviando…" : "Enviar"}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            aria-disabled={enviandoRascunho}
            onClick={fecharDetalhe}
          >
            Fechar detalhe
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="ficha-colaborador__cartao solicitacoes-colaborador"
      aria-labelledby={ids.titulo}
    >
      {cabecalho}
      <p role="status" className="ficha-colaborador__so-leitor">
        {textoDoStatus === null && aviso ? (
          <span key={aviso.n}>{aviso.texto}</span>
        ) : (
          textoDoStatus
        )}
      </p>
      {podeRegistrar &&
      lista.tipo === "dados" &&
      vinculosDaEmpresa.length > 0 ? (
        <div className="solicitacoes-colaborador__acoes">
          <Button
            id={ids.novaSolicitacao}
            variant="primary"
            onClick={abrirNova}
          >
            Nova solicitação
          </Button>
        </div>
      ) : null}
      {podeRegistrar ? (
        <NovaSolicitacaoModal
          aberto={novaAberta}
          vinculos={vinculosDaEmpresa}
          vinculoPrincipalId={vinculoPrincipalId}
          rotuloDoVinculo={rotuloDoVinculo}
          enviando={enviandoNova}
          erro={erroNova}
          onConfirmar={(dados) => void confirmarNova(dados)}
          onFechar={fecharNova}
        />
      ) : null}
      {sessao.tipo === "carregando" ? (
        <p className="ficha-colaborador__texto" aria-hidden="true">
          Carregando…
        </p>
      ) : sessao.tipo === "sem-empresa" ? (
        <div className="solicitacoes-colaborador__orientacao">
          <p className="ficha-colaborador__texto">
            Escolha uma empresa ativa para consultar as solicitações de{" "}
            {nomeColaborador}.
          </p>
          <p className="ficha-colaborador__cartao-contexto">
            Sem empresa ativa, as solicitações de empresas diferentes ficariam
            misturadas. Use o seletor de empresa do menu.
          </p>
        </div>
      ) : sessao.tipo === "erro" ? (
        <FalhaComNovaTentativa
          id={ids.novaTentativa}
          falha={sessao}
          texto="Não foi possível conferir o seu acesso às solicitações."
          onTentar={() => void carregarSessao(true)}
        />
      ) : vinculosDaEmpresa.length === 0 ? (
        <p className="ficha-colaborador__texto">
          {`${nomeColaborador} não tem vínculo nesta empresa: não há solicitações a consultar.`}
        </p>
      ) : lista.tipo === "erro" ? (
        <FalhaComNovaTentativa
          id={ids.novaTentativa}
          falha={lista}
          texto="Não foi possível carregar as solicitações."
          onTentar={() => void carregarLista("novaTentativa")}
        />
      ) : lista.tipo === "carregando" ? (
        <p className="ficha-colaborador__texto" aria-hidden="true">
          Carregando…
        </p>
      ) : (
        vinculosDaEmpresa.map((vinculo) => {
          const itens = lista.porVinculo.get(vinculo.id) ?? [];
          return (
            <section
              key={vinculo.id}
              className="solicitacoes-colaborador__vinculo"
              aria-labelledby={ids.vinculo(vinculo.id)}
            >
              <h3
                id={ids.vinculo(vinculo.id)}
                tabIndex={-1}
                className="ficha-colaborador__cartao-titulo solicitacoes-colaborador__vinculo-titulo"
              >
                {ROTULO_TIPO_VINCULO[vinculo.tipo] ?? vinculo.tipo} ·{" "}
                {exibirMatricula(vinculo.matricula)}
                {vinculo.id === vinculoPrincipalId
                  ? " · vínculo principal"
                  : ""}
              </h3>
              <p className="solicitacoes-colaborador__situacao">
                <StatusBadge
                  variant={VARIANTE_SITUACAO_VINCULO[vinculo.situacao]}
                >
                  {ROTULO_SITUACAO_VINCULO[vinculo.situacao] ??
                    vinculo.situacao}
                </StatusBadge>
              </p>
              {itens.length === 0 ? (
                <p className="ficha-colaborador__texto">
                  Nenhuma solicitação neste vínculo.
                </p>
              ) : (
                <div className="ficha-colaborador__quadro">
                  <DataTable
                    caption={`Solicitações — ${ROTULO_TIPO_VINCULO[vinculo.tipo] ?? vinculo.tipo} ${exibirMatricula(vinculo.matricula)}`}
                    columns={colunas}
                    rows={[...itens]}
                    rowKey={(s) => s.id}
                  />
                </div>
              )}
              {painelDoDetalhe(vinculo.id)}
            </section>
          );
        })
      )}
    </section>
  );
}

/**
 * Aviso de falha com o botão de nova tentativa. Durante a nova leitura o
 * botão fica no lugar, focado, com `aria-disabled`; cada falha monta um
 * alerta novo (a `key`), anunciado uma vez.
 */
function FalhaComNovaTentativa({
  id,
  falha,
  texto,
  onTentar,
}: {
  readonly id: string;
  readonly falha: Falha;
  readonly texto: string;
  readonly onTentar: () => void;
}) {
  return (
    <div className="ficha-colaborador__aviso">
      <p key={falha.falhas} role="alert" className="ficha-colaborador__texto">
        {texto}
      </p>
      <Button
        id={id}
        variant="secondary"
        aria-disabled={falha.relendo}
        onClick={() => {
          if (!falha.relendo) onTentar();
        }}
      >
        Tentar de novo
      </Button>
    </div>
  );
}
