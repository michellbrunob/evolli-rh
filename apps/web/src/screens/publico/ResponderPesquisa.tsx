/**
 * T216 — responder uma pesquisa pelo link (`#/p/<token>`), sem login; e a
 * pré-visualização do RH, com o mesmo fluxo e nada gravado.
 *
 * Etapas: abertura (na anônima com separação, a escolha dos grupos) →
 * identificação (só identificada e confidencial) → as telas de resposta →
 * agradecimento. Nada aqui chama API autenticada: o único cliente é o público
 * (`pesquisaPublicaClient`), sem cookie nem CSRF; na prévia, nem ele.
 *
 * Telas de resposta:
 * - modelos prontos (e API sem `modelo`): UMA PERGUNTA POR TELA, com
 *   "Pergunta N de M";
 * - Personalizada: UMA SEÇÃO POR VEZ, com "Seção N de M".
 * A contagem e a barra de progresso contam só o que está VISÍVEL — a pergunta
 * escondida pela condição não entra (e a seção sem pergunta visível some).
 * "Próximo" fica desabilitado enquanto falta obrigatória na tela; Enter
 * avança quando as respostas são válidas (e mostra o erro quando não são).
 *
 * Guardado no navegador (fora da prévia), sempre com try/catch:
 * - `sessionStorage` — o rascunho das respostas e dos grupos; nunca o CPF,
 *   a data de nascimento nem o passe;
 * - `localStorage` — só na anônima: "este navegador já respondeu" (aviso,
 *   não trava).
 *
 * Foco: a cada tela nova o foco vai ao título dela (sem contorno visível:
 * o foco é programático, para o leitor de tela); ao barrar o avanço, vai ao
 * primeiro campo com erro.
 */
import { textoComEmpresa } from "../pesquisas/modelos/empresa";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import "../../app/tokens.css";
import "../../components/FormField.css";
import "./ResponderPesquisa.css";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { MarcaEvolli } from "../../app/marca/MarcaEvolli";
import { ListaDeEscolha } from "../../ui/ListaDeEscolha";
import {
  IconeAvancar,
  IconeAviso,
  IconeCadeado,
  IconeDocumento,
  IconeEmpresa,
  IconeInformacao,
  IconePerfil,
  IconeRelogio,
  IconeSeguranca,
  IconeVer,
  IconeVoltar,
} from "../../ui/icones";
import {
  ErroPesquisaPublica,
  clientePesquisaPublica,
  type CampoGrupo,
  type ClientePesquisaPublica,
  type EnvioDeRespostas,
  type GrupoPublico,
  type Identificacao,
  type ModeloPublico,
  type MotivoIndisponivel,
  type PesquisaPublica,
  type Secao,
} from "../../api/pesquisaPublicaClient";
import { plural } from "../../format/plural";
import {
  dataDigitadaParaIso,
  mascararDataDigitada,
} from "../../format/dataDigitada";
import { minutosEstimados } from "../pesquisas/tempoEstimado";
import { CampoDaPergunta } from "./CampoDaPergunta";
import { perfilDasEscolhas } from "../pesquisas/modelos/disc/perfilLocal";
import { ResultadoPublicoDisc } from "../pesquisas/modelos/disc/ResultadoPublicoDisc";
import { rodadaDaPesquisaPublica } from "../../app/rotaPublica";
import { ehAvaliacao } from "../pesquisas/modelos/avaliacao/catalogo";
import { ResponderAvaliacao } from "../pesquisas/modelos/avaliacao/ResponderAvaliacao";
import {
  cpfValido,
  erroDaPergunta,
  lerRascunho,
  mascararCpf,
  montarRespostas,
  perguntasEmOrdem,
  perguntasVisiveis,
  respondida,
  somenteDigitos,
  type PerguntaNaOrdem,
  type Respostas,
  type ValorRascunho,
} from "./regrasDaPesquisa";

/** O que a tela do RH informa para montar a pré-visualização. */
export interface DadosDaPrevia {
  readonly empresa: string;
  readonly nome: string;
  readonly boasVindas: string | null;
  readonly identificacao: Identificacao;
  readonly modelo: ModeloPublico;
  readonly secoes: readonly Secao[];
  /** Anônima com separação: os campos e as opções a mostrar. */
  readonly grupos?: readonly GrupoPublico[];
}

/**
 * T216 — os textos dos modelos trazem `{empresa}`: quem responde vê o nome
 * da empresa (sem nome, "nossa empresa").
 */
export function comNomeDaEmpresa(p: PesquisaPublica): PesquisaPublica {
  return {
    ...p,
    secoes: p.secoes.map((s) => ({
      ...s,
      perguntas: s.perguntas.map((q) => ({
        ...q,
        texto: textoComEmpresa(q.texto, p.empresa),
      })),
    })),
  };
}

/**
 * A estrutura que a página pública recebe, montada a partir do rascunho do
 * RH (sem API): conta as perguntas e usa o mesmo tempo estimado da prévia.
 */
export function montarPreviaPublica(dados: DadosDaPrevia): PesquisaPublica {
  const total = dados.secoes.reduce((n, s) => n + s.perguntas.length, 0);
  const base: PesquisaPublica = {
    modelo: dados.modelo,
    empresa: dados.empresa,
    nome: dados.nome,
    boasVindas: dados.boasVindas,
    identificacao: dados.identificacao,
    totalPerguntas: total,
    minutosEstimados: minutosEstimados(total),
    secoes: dados.secoes,
  };
  return dados.grupos ? { ...base, grupos: dados.grupos } : base;
}

export type ResponderPesquisaProps =
  | {
      /** Token do link público (`#/p/<token>`). */
      readonly token: string;
      /** Injetável nos testes; em produção, o cliente público de verdade. */
      readonly cliente?: ClientePesquisaPublica;
      readonly previa?: undefined;
      readonly aoSairDaPrevia?: undefined;
    }
  | {
      /**
       * Pré-visualização do RH: a estrutura já carregada (veja
       * `montarPreviaPublica`). Não chama API, não guarda nada no navegador,
       * simula a identificação e o envio.
       */
      readonly previa: PesquisaPublica;
      /** Mostra "Sair da pré-visualização" na faixa do topo. */
      readonly aoSairDaPrevia?: () => void;
      readonly token?: undefined;
      readonly cliente?: undefined;
    };

type Etapa =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "falha-carga" }
  | { readonly tipo: "indisponivel"; readonly motivo: MotivoIndisponivel }
  | { readonly tipo: "abertura" }
  | { readonly tipo: "identificacao" }
  | { readonly tipo: "tela"; readonly id: string }
  | { readonly tipo: "ja-respondeu" }
  | { readonly tipo: "enviado" }
  // T216 — Avaliação 90°/180°: depois da identificação, quem a pessoa avalia.
  | { readonly tipo: "avaliacao" };

/** Uma tela de resposta: uma pergunta, ou uma seção inteira. */
interface Tela {
  readonly id: string;
  readonly secao: Secao;
  readonly perguntas: readonly PerguntaNaOrdem[];
}

export const MENSAGEM_NAO_ENCONTRADO =
  "Não encontramos você nesta pesquisa. Confira o CPF e a data de nascimento.";
export const MENSAGEM_MUITAS_TENTATIVAS =
  "Muitas tentativas. Tente de novo em alguns minutos.";

/** Valor do "Prefiro não informar" na escolha de grupo (vai como `null`). */
const NAO_INFORMAR = "";

const INDISPONIVEL: Record<
  MotivoIndisponivel,
  { readonly titulo: string; readonly texto: string }
> = {
  pausada: {
    titulo: "Esta pesquisa está pausada",
    texto:
      "As respostas estão suspensas por enquanto. Tente de novo mais tarde ou fale com o RH da empresa.",
  },
  encerrada: {
    titulo: "O prazo desta pesquisa terminou",
    texto: "A data de encerramento passou e novas respostas não são aceitas.",
  },
  finalizada: {
    titulo: "Esta pesquisa foi encerrada pelo RH",
    texto: "Ela foi finalizada e não recebe mais respostas.",
  },
  cancelada: {
    titulo: "Esta pesquisa foi cancelada",
    texto: "Ela não recebe mais respostas.",
  },
  inexistente: {
    titulo: "Pesquisa não encontrada",
    texto:
      "Confira se o link está completo ou peça um novo link ao RH da empresa.",
  },
};

const IDENTIFICACAO: Record<
  Identificacao,
  { readonly rotulo: string; readonly nota: string }
> = {
  anonima: {
    rotulo: "Anônima",
    nota: "Ninguém pede seus dados, e as respostas não mostram quem respondeu.",
  },
  confidencial: {
    rotulo: "Confidencial",
    nota: "Vamos confirmar que você participa, mas as respostas não ficam ligadas ao seu nome. O RH vê só o resultado do grupo.",
  },
  identificada: {
    rotulo: "Identificada",
    nota: "O RH da empresa vê as suas respostas junto com o seu nome.",
  },
};

function chave(token: string, qual: "rascunho" | "grupos" | "respondida") {
  return `evolli.pesquisa.${token}.${qual}`;
}

function lerArmazenado(qual: "local" | "sessao", nome: string): string | null {
  try {
    const area = qual === "local" ? window.localStorage : window.sessionStorage;
    return area.getItem(nome);
  } catch {
    return null;
  }
}

function gravarArmazenado(
  qual: "local" | "sessao",
  nome: string,
  valor: string | null,
): void {
  try {
    const area = qual === "local" ? window.localStorage : window.sessionStorage;
    if (valor === null) area.removeItem(nome);
    else area.setItem(nome, valor);
  } catch {
    // Sem armazenamento (modo privado, bloqueado, cheio): segue sem guardar.
  }
}

/** Grupos guardados: só texto por campo; o resto é descartado. */
function lerGrupos(texto: string | null): Partial<Record<CampoGrupo, string>> {
  if (!texto) return {};
  try {
    const dados: unknown = JSON.parse(texto);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) return {};
    const saida: Partial<Record<CampoGrupo, string>> = {};
    for (const campo of ["departamento", "centroCusto", "unidade"] as const) {
      const v = (dados as Record<string, unknown>)[campo];
      if (typeof v === "string") saida[campo] = v;
    }
    return saida;
  } catch {
    return {};
  }
}

function paragrafos(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Uma tela por pergunta, ou uma por seção (com as perguntas visíveis). */
function montarTelas(
  ordem: readonly PerguntaNaOrdem[],
  porSecao: boolean,
): Tela[] {
  if (!porSecao) {
    return ordem.map((o) => ({
      id: o.pergunta.id,
      secao: o.secao,
      perguntas: [o],
    }));
  }
  const telas: { id: string; secao: Secao; perguntas: PerguntaNaOrdem[] }[] =
    [];
  for (const o of ordem) {
    const ultima = telas[telas.length - 1];
    if (ultima && ultima.secao.id === o.secao.id) ultima.perguntas.push(o);
    else telas.push({ id: o.secao.id, secao: o.secao, perguntas: [o] });
  }
  return telas;
}

export function ResponderPesquisa(props: ResponderPesquisaProps) {
  const previa = props.previa ?? null;
  const token = props.token ?? "";
  const cliente = props.cliente ?? clientePesquisaPublica;
  const aoSairDaPrevia = props.aoSairDaPrevia;

  // Na prévia, nada é lido nem gravado no navegador.
  const ler = (qual: "local" | "sessao", nome: string) =>
    previa ? null : lerArmazenado(qual, nome);
  const gravar = (
    qual: "local" | "sessao",
    nome: string,
    valor: string | null,
  ) => {
    if (!previa) gravarArmazenado(qual, nome, valor);
  };

  const [etapa, setEtapa] = useState<Etapa>(() =>
    previa ? { tipo: "abertura" } : { tipo: "carregando" },
  );
  const [pesquisa, setPesquisa] = useState<PesquisaPublica | null>(() =>
    previa ? comNomeDaEmpresa(previa) : null,
  );
  const [tentativa, setTentativa] = useState(0);
  const [dialogoDaPrevia, setDialogoDaPrevia] = useState(previa !== null);

  const [respostas, setRespostas] = useState<Respostas>(() =>
    lerRascunho(ler("sessao", chave(token, "rascunho"))),
  );
  const [grupos, setGrupos] = useState(() =>
    lerGrupos(ler("sessao", chave(token, "grupos"))),
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [errosIdent, setErrosIdent] = useState<{
    cpf?: string;
    nascimento?: string;
  }>({});
  const [erroIdent, setErroIdent] = useState<string | null>(null);
  const [avisoIdent, setAvisoIdent] = useState<string | null>(null);
  const [identificando, setIdentificando] = useState(false);
  const passeRef = useRef<string | null>(null);
  const [primeiroNome, setPrimeiroNome] = useState("");
  /** Depois de reidentificar (passe vencido), volta à última tela. */
  const voltarAoFimRef = useRef(false);

  const [jaRespondeuAqui] = useState(
    () => ler("local", chave(token, "respondida")) === "1",
  );

  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const formularioRef = useRef<HTMLFormElement | null>(null);
  const [focarErro, setFocarErro] = useState(0);

  // Abertura (e "Tentar de novo"). A prévia já chega carregada.
  useEffect(() => {
    if (previa) return;
    let vivo = true;
    setEtapa({ tipo: "carregando" });
    cliente.abrir(token).then(
      (abertura) => {
        if (!vivo) return;
        if ("indisponivel" in abertura) {
          setEtapa({ tipo: "indisponivel", motivo: abertura.indisponivel });
          return;
        }
        setPesquisa(comNomeDaEmpresa(abertura));
        setEtapa({ tipo: "abertura" });
      },
      () => {
        if (vivo) setEtapa({ tipo: "falha-carga" });
      },
    );
    return () => {
      vivo = false;
    };
    // `previa` é fixa durante a vida da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, token, tentativa]);

  // Título da aba do navegador: "<nome da pesquisa> | Pesquisa".
  useEffect(() => {
    const antes = document.title;
    return () => {
      document.title = antes;
    };
  }, []);
  useEffect(() => {
    document.title = pesquisa ? `${pesquisa.nome} | Pesquisa` : "Pesquisa";
  }, [pesquisa]);

  // Rascunho: a cada mudança, no sessionStorage desta aba.
  const encerrada = etapa.tipo === "enviado" || etapa.tipo === "ja-respondeu";
  useEffect(() => {
    if (encerrada) return;
    gravar(
      "sessao",
      chave(token, "rascunho"),
      Object.keys(respostas).length ? JSON.stringify(respostas) : null,
    );
    gravar(
      "sessao",
      chave(token, "grupos"),
      Object.keys(grupos).length ? JSON.stringify(grupos) : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respostas, grupos, token, encerrada]);

  // Foco no título de cada tela nova (depois do diálogo da prévia). No
  // mesmo quadro da troca: o leitor de tela anuncia a tela já pronta.
  const chaveDaEtapa = etapa.tipo === "tela" ? `tela-${etapa.id}` : etapa.tipo;
  useLayoutEffect(() => {
    if (dialogoDaPrevia) return;
    tituloRef.current?.focus({ preventScroll: true });
  }, [chaveDaEtapa, dialogoDaPrevia]);

  // Foco no primeiro campo com erro.
  useEffect(() => {
    if (focarErro === 0) return;
    const alvo = formularioRef.current?.querySelector<HTMLElement>(
      "[aria-invalid='true'] input:not(:disabled), input[aria-invalid='true'], textarea[aria-invalid='true']",
    );
    alvo?.focus();
  }, [focarErro]);

  const secoes = useMemo(() => pesquisa?.secoes ?? [], [pesquisa]);
  const porSecao = pesquisa?.modelo === "personalizada";
  const gruposDaPesquisa = useMemo(
    () =>
      pesquisa?.identificacao === "anonima" ? (pesquisa.grupos ?? []) : [],
    [pesquisa],
  );
  const visiveis = useMemo(
    () => perguntasVisiveis(secoes, respostas),
    [secoes, respostas],
  );
  const telas = useMemo(
    () => montarTelas(perguntasEmOrdem(secoes, visiveis), porSecao),
    [secoes, visiveis, porSecao],
  );

  function irParaTela(id: string | undefined) {
    if (id === undefined) return;
    setErros({});
    setAlerta(null);
    setEtapa({ tipo: "tela", id });
  }

  function iniciar() {
    if (!pesquisa) return;
    if (pesquisa.identificacao !== "anonima" && passeRef.current === null) {
      setErroIdent(null);
      setAvisoIdent(null);
      setEtapa({ tipo: "identificacao" });
      return;
    }
    irParaTela(telas[0]?.id);
  }

  function mudarResposta(id: string, valor: ValorRascunho) {
    setRespostas((r) => ({ ...r, [id]: valor }));
    setErros((e) => {
      if (!(id in e)) return e;
      const resto = { ...e };
      delete resto[id];
      return resto;
    });
  }

  function aposIdentificar(passe: string, nome: string) {
    passeRef.current = passe;
    setPrimeiroNome(nome);
    if (!previa && pesquisa?.modelo && ehAvaliacao(pesquisa.modelo)) {
      setEtapa({ tipo: "avaliacao" });
      return;
    }
    setCpf("");
    setNascimento("");
    setAvisoIdent(null);
    const destino = voltarAoFimRef.current ? telas[telas.length - 1] : telas[0];
    voltarAoFimRef.current = false;
    irParaTela(destino?.id);
  }

  async function identificar(evento: FormEvent) {
    evento.preventDefault();
    if (identificando) return;
    const digitos = somenteDigitos(cpf);
    const iso = dataDigitadaParaIso(nascimento);
    const errosNovos: { cpf?: string; nascimento?: string } = {};
    if (!cpfValido(digitos)) {
      errosNovos.cpf = "Informe um CPF válido, com 11 números.";
    }
    if (iso === null) {
      errosNovos.nascimento =
        "Informe a data de nascimento no formato dd/mm/aaaa.";
    }
    setErrosIdent(errosNovos);
    setErroIdent(null);
    if (errosNovos.cpf || errosNovos.nascimento) {
      setFocarErro((n) => n + 1);
      return;
    }
    // Prévia: a identificação é simulada, sem servidor.
    if (previa) {
      aposIdentificar("previa", "");
      return;
    }
    setIdentificando(true);
    try {
      const r = await cliente.identificar(token, {
        cpf: digitos,
        dataNascimento: iso!,
      });
      aposIdentificar(r.passe, r.primeiroNome);
    } catch (e) {
      const erro = e instanceof ErroPesquisaPublica ? e : null;
      const status = erro?.status ?? 0;
      if (status === 409) {
        // Já respondeu: o rascunho desta aba não serve mais.
        gravar("sessao", chave(token, "rascunho"), null);
        setEtapa({ tipo: "ja-respondeu" });
      } else if (status === 410) {
        setEtapa({
          tipo: "indisponivel",
          motivo: erro?.indisponivel ?? "encerrada",
        });
      } else if (status === 404) {
        setEtapa({ tipo: "indisponivel", motivo: "inexistente" });
      } else if (status === 429) {
        setErroIdent(MENSAGEM_MUITAS_TENTATIVAS);
      } else if (status === 401 || status === 422) {
        setErroIdent(MENSAGEM_NAO_ENCONTRADO);
      } else {
        setErroIdent(
          "Não foi possível confirmar seus dados agora. Tente de novo.",
        );
      }
    } finally {
      setIdentificando(false);
    }
  }

  async function enviar() {
    if (!pesquisa || enviando) return;
    // Prévia: agradece sem gravar nada.
    if (previa) {
      setEtapa({ tipo: "enviado" });
      return;
    }
    setEnviando(true);
    setAlerta(null);
    try {
      const envio: {
        -readonly [K in keyof EnvioDeRespostas]: EnvioDeRespostas[K];
      } = { respostas: montarRespostas(secoes, respostas) };
      if (passeRef.current !== null) envio.passe = passeRef.current;
      // T216 — onboarding: a resposta vai com a rodada do convite.
      if (pesquisa.modelo === "onboarding") {
        envio.onboarding = {
          rodada: rodadaDaPesquisaPublica(window.location.hash),
        };
      }
      if (gruposDaPesquisa.length) {
        const escolhidos: Partial<Record<CampoGrupo, string | null>> = {};
        for (const g of gruposDaPesquisa) {
          const v = grupos[g.campo] ?? NAO_INFORMAR;
          escolhidos[g.campo] = g.opcoes.some((o) => o.id === v) ? v : null;
        }
        envio.grupos = escolhidos;
      }
      await cliente.enviarRespostas(token, envio);
      passeRef.current = null;
      gravar("sessao", chave(token, "rascunho"), null);
      gravar("sessao", chave(token, "grupos"), null);
      if (pesquisa.identificacao === "anonima") {
        gravar("local", chave(token, "respondida"), "1");
      }
      setEtapa({ tipo: "enviado" });
    } catch (e) {
      const erro = e instanceof ErroPesquisaPublica ? e : null;
      const status = erro?.status ?? 0;
      if (status === 409) {
        gravar("sessao", chave(token, "rascunho"), null);
        setEtapa({ tipo: "ja-respondeu" });
      } else if (status === 410) {
        setEtapa({
          tipo: "indisponivel",
          motivo: erro?.indisponivel ?? "encerrada",
        });
      } else if (status === 401 && pesquisa.identificacao !== "anonima") {
        passeRef.current = null;
        voltarAoFimRef.current = true;
        setErroIdent(null);
        setAvisoIdent(
          "Por segurança, confirme seus dados de novo para enviar. Suas respostas continuam preenchidas.",
        );
        setEtapa({ tipo: "identificacao" });
      } else if (status === 422 && erro && erro.erros.length) {
        const porPergunta: Record<string, string> = {};
        for (const { campo } of erro.erros) {
          porPergunta[campo] = "Revise esta resposta.";
        }
        const primeira = telas.find((t) =>
          t.perguntas.some((o) => o.pergunta.id in porPergunta),
        );
        if (primeira) setEtapa({ tipo: "tela", id: primeira.id });
        setErros(porPergunta);
        setAlerta(
          "Algumas respostas precisam de ajuste antes do envio. Revise e envie de novo.",
        );
        setFocarErro((n) => n + 1);
      } else {
        setAlerta(
          "Não foi possível enviar suas respostas agora. Elas continuam preenchidas; tente de novo.",
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  /** Avança (ou envia, na última) se as respostas da tela forem válidas. */
  function avancar() {
    if (etapa.tipo !== "tela" || enviando) return;
    const posicao = telas.findIndex((t) => t.id === etapa.id);
    const atual = telas[posicao];
    if (!atual) return;
    const novos: Record<string, string> = {};
    for (const { pergunta } of atual.perguntas) {
      const erro = erroDaPergunta(pergunta, respostas[pergunta.id]);
      if (erro) novos[pergunta.id] = erro;
    }
    const quantos = Object.keys(novos).length;
    if (quantos) {
      setErros(novos);
      setAlerta(
        porSecao
          ? quantos === 1
            ? "Revise a pergunta indicada antes de continuar."
            : "Revise as perguntas indicadas antes de continuar."
          : null,
      );
      setFocarErro((n) => n + 1);
      return;
    }
    const proxima = telas[posicao + 1];
    if (proxima === undefined) {
      void enviar();
      return;
    }
    irParaTela(proxima.id);
  }

  function aoEnviarFormulario(evento: FormEvent) {
    evento.preventDefault();
    avancar();
  }

  /**
   * Enter num campo de resposta (texto, número, data, opção) avança quando a
   * resposta é válida. No parágrafo, Enter continua sendo quebra de linha;
   * num botão, vale o próprio botão.
   */
  function aoTeclar(evento: KeyboardEvent<HTMLFormElement>) {
    if (evento.key !== "Enter" || evento.shiftKey || evento.altKey) return;
    const alvo = evento.target as HTMLElement;
    if (alvo.tagName !== "INPUT") return;
    evento.preventDefault();
    avancar();
  }

  function anterior() {
    if (etapa.tipo !== "tela") return;
    const posicao = telas.findIndex((t) => t.id === etapa.id);
    irParaTela(telas[posicao - 1]?.id);
  }

  // ------------------------------------------------------------- desenho

  const titulo = (texto: string, className = "pesquisa-publica__titulo") => (
    <h1 ref={tituloRef} tabIndex={-1} className={className}>
      {texto}
    </h1>
  );

  let conteudo: JSX.Element;
  let progresso: {
    posicao: number;
    total: number;
    rotulo: "Pergunta" | "Seção";
  } | null = null;

  switch (etapa.tipo) {
    case "carregando":
      conteudo = (
        <p className="pesquisa-publica__status" role="status">
          Carregando a pesquisa…
        </p>
      );
      break;

    case "falha-carga":
      conteudo = (
        <div className="pesquisa-publica__centro">
          {titulo("Não foi possível abrir a pesquisa")}
          <p role="alert" className="pesquisa-publica__texto">
            Verifique sua conexão e tente de novo.
          </p>
          <Button
            className="pesquisa-publica__largo"
            onClick={() => setTentativa((n) => n + 1)}
          >
            Tentar de novo
          </Button>
        </div>
      );
      break;

    case "indisponivel": {
      const { titulo: t, texto } = INDISPONIVEL[etapa.motivo];
      conteudo = (
        <div className="pesquisa-publica__centro">
          <span className="pesquisa-publica__simbolo" aria-hidden="true">
            <IconeAviso tamanho={28} />
          </span>
          {titulo(t)}
          <p className="pesquisa-publica__texto">{texto}</p>
        </div>
      );
      break;
    }

    case "abertura": {
      const p = pesquisa!;
      const ident = IDENTIFICACAO[p.identificacao];
      const IconeIdent =
        p.identificacao === "anonima"
          ? IconeCadeado
          : p.identificacao === "confidencial"
            ? IconeSeguranca
            : IconePerfil;
      conteudo = (
        <div className="pesquisa-publica__centro">
          <p className="pesquisa-publica__selo">
            <IconeEmpresa tamanho={16} />
            <span>{p.empresa}</span>
          </p>
          {titulo(
            p.nome,
            "pesquisa-publica__titulo pesquisa-publica__titulo--grande",
          )}
          {paragrafos(p.boasVindas).map((texto, i) => (
            <p key={i} className="pesquisa-publica__texto">
              {texto}
            </p>
          ))}
          <ul className="pesquisa-meta" aria-label="Sobre esta pesquisa">
            <li>
              <IconeDocumento tamanho={16} />
              <span>{plural(p.totalPerguntas, "pergunta", "perguntas")}</span>
            </li>
            <li>
              <IconeRelogio tamanho={16} />
              <span>
                {`cerca de ${plural(minutosEstimados(p.totalPerguntas), "minuto", "minutos")}`}
              </span>
            </li>
            <li>
              <IconeIdent tamanho={16} />
              <span>{ident.rotulo}</span>
            </li>
          </ul>
          <p className="pesquisa-publica__nota">{ident.nota}</p>
          {gruposDaPesquisa.length ? (
            <div className="pesquisa-grupos">
              {gruposDaPesquisa.map((g) => {
                const idRotulo = `grupo-${g.campo}-rotulo`;
                return (
                  <div key={g.campo} className="pesquisa-grupos__campo">
                    <span
                      id={idRotulo}
                      className="pesquisa-pergunta__rotulo-menor"
                    >
                      {g.rotulo}
                    </span>
                    <ListaDeEscolha
                      id={`grupo-${g.campo}`}
                      aria-labelledby={idRotulo}
                      aria-describedby="grupos-nota"
                      vazio="Prefiro não informar"
                      valor={grupos[g.campo] ?? NAO_INFORMAR}
                      onMudar={(v) =>
                        setGrupos((atual) => ({ ...atual, [g.campo]: v }))
                      }
                      opcoes={[
                        { valor: NAO_INFORMAR, rotulo: "Prefiro não informar" },
                        ...g.opcoes.map((o) => ({
                          valor: o.id,
                          rotulo: o.nome,
                        })),
                      ]}
                    />
                  </div>
                );
              })}
              <p id="grupos-nota" className="pesquisa-publica__legenda">
                Serve só para ver os resultados por grupo, somados. A resposta
                continua anônima.
              </p>
            </div>
          ) : null}
          {p.identificacao === "anonima" && jaRespondeuAqui ? (
            <p className="pesquisa-publica__aviso" role="status">
              Este navegador já enviou uma resposta para esta pesquisa. Se outra
              pessoa usa este aparelho, ela pode responder normalmente.
            </p>
          ) : null}
          <Button className="pesquisa-publica__largo" onClick={iniciar}>
            Iniciar pesquisa
          </Button>
        </div>
      );
      break;
    }

    case "identificacao": {
      const confidencial = pesquisa?.identificacao === "confidencial";
      const completa =
        somenteDigitos(cpf).length === 11 && nascimento.length === 10;
      const desc = (campo: "cpf" | "nascimento", ajuda: string) =>
        [ajuda, errosIdent[campo] ? `ident-${campo}-erro` : null]
          .filter(Boolean)
          .join(" ");
      conteudo = (
        <form
          ref={formularioRef}
          noValidate
          onSubmit={identificar}
          className="pesquisa-publica__formulario"
        >
          <div className="pesquisa-publica__centro">
            <span className="pesquisa-publica__simbolo" aria-hidden="true">
              <IconeSeguranca tamanho={28} />
            </span>
            {titulo("Confirme seus dados")}
            <p className="pesquisa-publica__texto">
              Use o CPF e a data de nascimento do seu cadastro na empresa. Eles
              servem só para confirmar que você participa desta pesquisa.
            </p>
          </div>
          {previa ? (
            <p className="pesquisa-publica__nota">
              Na pré-visualização a confirmação é simulada: qualquer CPF válido
              e qualquer data serve, e nada é consultado.
            </p>
          ) : null}
          {confidencial ? (
            <p className="pesquisa-publica__nota">
              Esta pesquisa é confidencial: depois da confirmação, as respostas
              não ficam ligadas ao seu nome. O RH vê só o resultado do grupo.
            </p>
          ) : null}
          {avisoIdent ? (
            <p className="pesquisa-publica__aviso" role="status">
              {avisoIdent}
            </p>
          ) : null}
          <div
            className="evolli-field"
            data-invalid={errosIdent.cpf ? true : undefined}
          >
            <label htmlFor="ident-cpf" className="evolli-field__label">
              CPF
            </label>
            <p id="ident-cpf-ajuda" className="evolli-field__help">
              Só os números; os pontos e o traço entram sozinhos.
            </p>
            <input
              id="ident-cpf"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              maxLength={14}
              value={cpf}
              aria-required="true"
              aria-invalid={errosIdent.cpf ? true : undefined}
              aria-describedby={desc("cpf", "ident-cpf-ajuda")}
              onChange={(e) => {
                setCpf(mascararCpf(e.target.value));
                setErrosIdent(({ cpf: _cpf, ...resto }) => resto);
              }}
            />
            {errosIdent.cpf ? (
              <p
                id="ident-cpf-erro"
                className="evolli-field__error"
                role="alert"
              >
                {errosIdent.cpf}
              </p>
            ) : null}
          </div>
          <div
            className="evolli-field"
            data-invalid={errosIdent.nascimento ? true : undefined}
          >
            <label htmlFor="ident-nascimento" className="evolli-field__label">
              Data de nascimento
            </label>
            <p id="ident-nascimento-ajuda" className="evolli-field__help">
              No formato dd/mm/aaaa.
            </p>
            <input
              id="ident-nascimento"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="dd/mm/aaaa"
              maxLength={10}
              value={nascimento}
              aria-required="true"
              aria-invalid={errosIdent.nascimento ? true : undefined}
              aria-describedby={desc("nascimento", "ident-nascimento-ajuda")}
              onChange={(e) => {
                setNascimento(mascararDataDigitada(e.target.value));
                setErrosIdent(({ nascimento: _n, ...resto }) => resto);
              }}
            />
            {errosIdent.nascimento ? (
              <p
                id="ident-nascimento-erro"
                className="evolli-field__error"
                role="alert"
              >
                {errosIdent.nascimento}
              </p>
            ) : null}
          </div>
          {erroIdent ? (
            <p className="pesquisa-publica__erro" role="alert">
              {erroIdent}
            </p>
          ) : null}
          <Button
            type="submit"
            className="pesquisa-publica__largo"
            disabled={identificando || !completa}
          >
            {identificando ? "Confirmando…" : "Continuar"}
          </Button>
        </form>
      );
      break;
    }

    case "tela": {
      const posicao = Math.max(
        0,
        telas.findIndex((t) => t.id === etapa.id),
      );
      const atual = telas[posicao]!;
      const total = telas.length;
      const ultima = posicao === total - 1;
      const bloqueado = atual.perguntas.some(
        ({ pergunta }) =>
          pergunta.obrigatoria && !respondida(respostas[pergunta.id]),
      );
      const rotulo = porSecao ? "Seção" : "Pergunta";
      progresso = { posicao: posicao + 1, total, rotulo };
      const primeira = atual.perguntas[0]!;
      const saudacao =
        posicao === 0 && primeiroNome ? (
          <p className="pesquisa-publica__nota">
            {pesquisa?.identificacao === "confidencial"
              ? `Olá, ${primeiroNome}. Identificação confirmada; suas respostas não ficam ligadas ao seu nome.`
              : `Olá, ${primeiroNome}. Você está respondendo com a sua identificação.`}
          </p>
        ) : null;
      conteudo = (
        <form
          ref={formularioRef}
          noValidate
          onSubmit={aoEnviarFormulario}
          onKeyDown={aoTeclar}
          className="pesquisa-publica__formulario"
        >
          <p className="pesquisa-contador">
            {`${rotulo} ${posicao + 1} de ${total}`}
            {!porSecao && atual.secao.titulo ? (
              <span className="pesquisa-contador__secao">
                {" "}
                · {atual.secao.titulo}
              </span>
            ) : null}
          </p>
          {porSecao ? (
            <>
              {titulo(atual.secao.titulo ?? `Seção ${posicao + 1}`)}
              {atual.secao.descricao ? (
                <p className="pesquisa-publica__texto">
                  {atual.secao.descricao}
                </p>
              ) : null}
            </>
          ) : primeira.primeiraDaSecao && atual.secao.descricao ? (
            <p className="pesquisa-publica__legenda">{atual.secao.descricao}</p>
          ) : null}
          {saudacao}
          {alerta ? (
            <p className="pesquisa-publica__erro" role="alert">
              {alerta}
            </p>
          ) : null}
          <div
            className={
              porSecao ? "pesquisa-publica__perguntas" : "pesquisa-publica__uma"
            }
          >
            {atual.perguntas.map(({ pergunta }) => (
              <CampoDaPergunta
                key={pergunta.id}
                pergunta={pergunta}
                valor={respostas[pergunta.id]}
                erro={erros[pergunta.id] ?? null}
                aoMudar={(v) => mudarResposta(pergunta.id, v)}
                nivel={porSecao ? 2 : 1}
                {...(porSecao ? {} : { tituloRef })}
              />
            ))}
          </div>
          <div className="pesquisa-publica__navegacao">
            <Button
              variant="subtle"
              onClick={anterior}
              disabled={posicao === 0 || enviando}
            >
              <IconeVoltar tamanho={16} />
              Anterior
            </Button>
            <Button type="submit" disabled={bloqueado || enviando}>
              {ultima ? (
                enviando ? (
                  "Enviando…"
                ) : (
                  "Enviar respostas"
                )
              ) : (
                <>
                  Próximo
                  <IconeAvancar tamanho={16} />
                </>
              )}
            </Button>
          </div>
        </form>
      );
      break;
    }

    case "avaliacao":
      conteudo = (
        <ResponderAvaliacao
          token={token}
          passe={passeRef.current ?? ""}
          primeiroNome={primeiroNome}
        />
      );
      break;

    case "ja-respondeu":
      conteudo = (
        <div className="pesquisa-publica__centro">
          <span className="pesquisa-publica__simbolo" aria-hidden="true">
            <IconeInformacao tamanho={28} />
          </span>
          {titulo("Você já respondeu esta pesquisa")}
          <p className="pesquisa-publica__texto">
            Sua resposta já está registrada e cada participante responde uma vez
            só. Agradecemos a participação.
          </p>
        </div>
      );
      break;

    case "enviado": {
      // Perfil comportamental (DISC): o resultado da própria pessoa.
      const perfilDisc =
        pesquisa?.modelo === "disc"
          ? perfilDasEscolhas(secoes, respostas)
          : null;
      if (perfilDisc) {
        conteudo = (
          <ResultadoPublicoDisc
            perfil={perfilDisc}
            previa={previa !== null}
            titulo={titulo(
              "Respostas enviadas!",
              "pesquisa-publica__titulo pesquisa-publica__titulo--grande",
            )}
          />
        );
        break;
      }
      conteudo = (
        <div className="pesquisa-publica__centro">
          <span
            className="pesquisa-publica__simbolo pesquisa-publica__simbolo--sucesso"
            aria-hidden="true"
          >
            ✓
          </span>
          {titulo(
            "Agradecemos a sua participação!",
            "pesquisa-publica__titulo pesquisa-publica__titulo--grande",
          )}
          <p className="pesquisa-publica__texto">
            {previa
              ? "Esta foi uma pré-visualização: nenhuma resposta foi gravada."
              : "Suas respostas foram enviadas. Você já pode fechar esta página."}
          </p>
        </div>
      );
      break;
    }
  }

  const limpa = etapa.tipo === "tela";

  return (
    <div
      className={[
        "pesquisa-publica",
        limpa ? "pesquisa-publica--limpa" : null,
        previa ? "pesquisa-publica--previa" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pesquisa-publica__fixo">
        {previa ? (
          <div className="pesquisa-previa-faixa" role="note">
            <IconeVer tamanho={16} />
            <span>
              Pré-visualização: nada do que for respondido aqui é gravado.
            </span>
            {aoSairDaPrevia ? (
              <Button
                variant="subtle"
                className="pesquisa-previa-faixa__sair"
                onClick={aoSairDaPrevia}
              >
                Sair da pré-visualização
              </Button>
            ) : null}
          </div>
        ) : null}
        {progresso ? (
          <div
            className="pesquisa-progresso"
            role="progressbar"
            aria-label="Progresso da pesquisa"
            aria-valuemin={1}
            aria-valuemax={progresso.total}
            aria-valuenow={progresso.posicao}
            aria-valuetext={`${progresso.rotulo} ${progresso.posicao} de ${progresso.total}`}
          >
            <span
              className="pesquisa-progresso__preenchido"
              style={{
                width: `${(progresso.posicao / Math.max(progresso.total, 1)) * 100}%`,
              }}
            />
          </div>
        ) : null}
      </div>
      <header className="pesquisa-publica__topo">
        <MarcaEvolli variante="horizontal" altura={32} />
      </header>
      <main className="pesquisa-publica__principal">
        <div className="pesquisa-publica__cartao">{conteudo}</div>
      </main>
      <footer className="pesquisa-publica__rodape">
        Pesquisa aplicada pelo Evolli RH em nome da empresa.
      </footer>
      {previa ? (
        <Modal
          aberto={dialogoDaPrevia}
          titulo="Esta é uma pré-visualização"
          onFechar={() => setDialogoDaPrevia(false)}
          rodape={
            <Button onClick={() => setDialogoDaPrevia(false)}>
              Começar a pré-visualização
            </Button>
          }
        >
          <p>
            Você vai ver a pesquisa como quem responde: a abertura, a
            identificação, as perguntas (inclusive as que dependem de outra
            resposta) e o agradecimento.
          </p>
          <p>
            Nenhuma resposta é gravada e nada é enviado. A identificação é
            simulada: qualquer CPF válido serve.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
