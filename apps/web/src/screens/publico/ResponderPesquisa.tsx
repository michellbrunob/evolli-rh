/**
 * T216 — responder uma pesquisa pelo link (`#/p/<token>`), sem login.
 *
 * Etapas: abertura (na anônima com separação, a escolha dos grupos) →
 * identificação (só identificada e confidencial) → UMA PERGUNTA POR TELA →
 * agradecimento. Nada aqui chama API autenticada: o único cliente é o público
 * (`pesquisaPublicaClient`), sem cookie nem CSRF.
 *
 * Uma pergunta por tela: a contagem ("Pergunta N de M") e a barra de
 * progresso contam só as perguntas VISÍVEIS — a escondida pela condição não
 * entra. "Próximo" fica desabilitado enquanto a obrigatória não tem resposta;
 * Enter avança quando a resposta é válida (e mostra o erro quando não é).
 *
 * Guardado no navegador, sempre com try/catch (modo privado, armazenamento
 * cheio ou bloqueado não quebram a página):
 * - `sessionStorage` — o rascunho das respostas e dos grupos, para não perder
 *   ao recarregar; nunca o CPF, a data de nascimento nem o passe;
 * - `localStorage` — só na anônima: "este navegador já respondeu" (aviso,
 *   não trava).
 *
 * Foco: a cada tela nova o foco vai ao título dela (na pergunta, o texto da
 * pergunta); ao barrar o avanço, vai ao campo com erro.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import "../../app/tokens.css";
import "../../components/FormField.css";
import "./ResponderPesquisa.css";
import { Button } from "../../components/Button";
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
  IconeSucesso,
  IconeVoltar,
} from "../../ui/icones";
import {
  ErroPesquisaPublica,
  clientePesquisaPublica,
  type CampoGrupo,
  type ClientePesquisaPublica,
  type EnvioDeRespostas,
  type Identificacao,
  type MotivoIndisponivel,
  type PesquisaPublica,
} from "../../api/pesquisaPublicaClient";
import { plural } from "../../format/plural";
import {
  dataDigitadaParaIso,
  mascararDataDigitada,
} from "../../format/dataDigitada";
import { CampoDaPergunta } from "./CampoDaPergunta";
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
  type Respostas,
  type ValorRascunho,
} from "./regrasDaPesquisa";

export interface ResponderPesquisaProps {
  readonly token: string;
  /** Injetável nos testes; em produção, o cliente público de verdade. */
  readonly cliente?: ClientePesquisaPublica;
}

type Etapa =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "falha-carga" }
  | { readonly tipo: "indisponivel"; readonly motivo: MotivoIndisponivel }
  | { readonly tipo: "abertura" }
  | { readonly tipo: "identificacao" }
  | { readonly tipo: "pergunta"; readonly id: string }
  | { readonly tipo: "ja-respondeu" }
  | { readonly tipo: "enviado" };

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
    titulo: "Esta pesquisa foi encerrada",
    texto: "O prazo para responder terminou e novas respostas não são aceitas.",
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

function tempoEstimado(minutos: number): string {
  if (minutos < 1) return "menos de 1 minuto";
  return `cerca de ${plural(Math.round(minutos), "minuto", "minutos")}`;
}

function paragrafos(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function ResponderPesquisa({
  token,
  cliente = clientePesquisaPublica,
}: ResponderPesquisaProps) {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "carregando" });
  const [pesquisa, setPesquisa] = useState<PesquisaPublica | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const [respostas, setRespostas] = useState<Respostas>(() =>
    lerRascunho(lerArmazenado("sessao", chave(token, "rascunho"))),
  );
  const [grupos, setGrupos] = useState(() =>
    lerGrupos(lerArmazenado("sessao", chave(token, "grupos"))),
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
  /** Depois de reidentificar (passe vencido), volta à última pergunta. */
  const voltarAoFimRef = useRef(false);

  const [jaRespondeuAqui] = useState(
    () => lerArmazenado("local", chave(token, "respondida")) === "1",
  );

  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const formularioRef = useRef<HTMLFormElement | null>(null);
  const [focarErro, setFocarErro] = useState(0);

  // Abertura (e "Tentar de novo").
  useEffect(() => {
    let vivo = true;
    setEtapa({ tipo: "carregando" });
    cliente.abrir(token).then(
      (abertura) => {
        if (!vivo) return;
        if ("indisponivel" in abertura) {
          setEtapa({ tipo: "indisponivel", motivo: abertura.indisponivel });
          return;
        }
        setPesquisa(abertura);
        setEtapa({ tipo: "abertura" });
      },
      () => {
        if (vivo) setEtapa({ tipo: "falha-carga" });
      },
    );
    return () => {
      vivo = false;
    };
  }, [cliente, token, tentativa]);

  // Rascunho: a cada mudança, no sessionStorage desta aba.
  const encerrada = etapa.tipo === "enviado" || etapa.tipo === "ja-respondeu";
  useEffect(() => {
    if (encerrada) return;
    gravarArmazenado(
      "sessao",
      chave(token, "rascunho"),
      Object.keys(respostas).length ? JSON.stringify(respostas) : null,
    );
    gravarArmazenado(
      "sessao",
      chave(token, "grupos"),
      Object.keys(grupos).length ? JSON.stringify(grupos) : null,
    );
  }, [respostas, grupos, token, encerrada]);

  // Foco no título de cada tela nova.
  const chaveDaEtapa =
    etapa.tipo === "pergunta" ? `pergunta-${etapa.id}` : etapa.tipo;
  useEffect(() => {
    tituloRef.current?.focus();
  }, [chaveDaEtapa]);

  // Foco no campo com erro.
  useEffect(() => {
    if (focarErro === 0) return;
    const alvo = formularioRef.current?.querySelector<HTMLElement>(
      "[aria-invalid='true'] input:not(:disabled), input[aria-invalid='true'], textarea[aria-invalid='true']",
    );
    alvo?.focus();
  }, [focarErro]);

  const secoes = useMemo(() => pesquisa?.secoes ?? [], [pesquisa]);
  const gruposDaPesquisa = useMemo(
    () =>
      pesquisa?.identificacao === "anonima" ? (pesquisa.grupos ?? []) : [],
    [pesquisa],
  );
  const visiveis = useMemo(
    () => perguntasVisiveis(secoes, respostas),
    [secoes, respostas],
  );
  const ordem = useMemo(
    () => perguntasEmOrdem(secoes, visiveis),
    [secoes, visiveis],
  );

  function irParaPergunta(id: string | undefined) {
    if (id === undefined) return;
    setErros({});
    setAlerta(null);
    setEtapa({ tipo: "pergunta", id });
  }

  function iniciar() {
    if (!pesquisa) return;
    if (pesquisa.identificacao !== "anonima" && passeRef.current === null) {
      setErroIdent(null);
      setAvisoIdent(null);
      setEtapa({ tipo: "identificacao" });
      return;
    }
    irParaPergunta(ordem[0]?.pergunta.id);
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
    setIdentificando(true);
    try {
      const r = await cliente.identificar(token, {
        cpf: digitos,
        dataNascimento: iso!,
      });
      passeRef.current = r.passe;
      setPrimeiroNome(r.primeiroNome);
      setCpf("");
      setNascimento("");
      setAvisoIdent(null);
      const destino = voltarAoFimRef.current
        ? ordem[ordem.length - 1]
        : ordem[0];
      voltarAoFimRef.current = false;
      irParaPergunta(destino?.pergunta.id);
    } catch (e) {
      const erro = e instanceof ErroPesquisaPublica ? e : null;
      const status = erro?.status ?? 0;
      if (status === 409) {
        // Já respondeu: o rascunho desta aba não serve mais.
        gravarArmazenado("sessao", chave(token, "rascunho"), null);
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
    setEnviando(true);
    setAlerta(null);
    try {
      const envio: {
        -readonly [K in keyof EnvioDeRespostas]: EnvioDeRespostas[K];
      } = { respostas: montarRespostas(secoes, respostas) };
      if (passeRef.current !== null) envio.passe = passeRef.current;
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
      gravarArmazenado("sessao", chave(token, "rascunho"), null);
      gravarArmazenado("sessao", chave(token, "grupos"), null);
      if (pesquisa.identificacao === "anonima") {
        gravarArmazenado("local", chave(token, "respondida"), "1");
      }
      setEtapa({ tipo: "enviado" });
    } catch (e) {
      const erro = e instanceof ErroPesquisaPublica ? e : null;
      const status = erro?.status ?? 0;
      if (status === 409) {
        gravarArmazenado("sessao", chave(token, "rascunho"), null);
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
        const primeira = ordem.find((o) => o.pergunta.id in porPergunta);
        if (primeira) setEtapa({ tipo: "pergunta", id: primeira.pergunta.id });
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

  /** Avança (ou envia, na última) se a resposta atual for válida. */
  function avancar() {
    if (etapa.tipo !== "pergunta" || enviando) return;
    const posicao = ordem.findIndex((o) => o.pergunta.id === etapa.id);
    const atual = ordem[posicao];
    if (!atual) return;
    const erro = erroDaPergunta(atual.pergunta, respostas[atual.pergunta.id]);
    if (erro) {
      setErros({ [atual.pergunta.id]: erro });
      setFocarErro((n) => n + 1);
      return;
    }
    const proxima = ordem[posicao + 1];
    if (proxima === undefined) {
      void enviar();
      return;
    }
    irParaPergunta(proxima.pergunta.id);
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
    if (etapa.tipo !== "pergunta") return;
    const posicao = ordem.findIndex((o) => o.pergunta.id === etapa.id);
    irParaPergunta(ordem[posicao - 1]?.pergunta.id);
  }

  // ------------------------------------------------------------- desenho

  const titulo = (texto: string, className = "pesquisa-publica__titulo") => (
    <h1 ref={tituloRef} tabIndex={-1} className={className}>
      {texto}
    </h1>
  );

  let conteudo: JSX.Element;
  let progresso: { posicao: number; total: number } | null = null;

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
              <span>{tempoEstimado(p.minutosEstimados)}</span>
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
            disabled={identificando}
          >
            {identificando ? "Confirmando…" : "Continuar"}
          </Button>
        </form>
      );
      break;
    }

    case "pergunta": {
      const posicao = Math.max(
        0,
        ordem.findIndex((o) => o.pergunta.id === etapa.id),
      );
      const atual = ordem[posicao]!;
      const total = ordem.length;
      const ultima = posicao === total - 1;
      const valor = respostas[atual.pergunta.id];
      const bloqueado = atual.pergunta.obrigatoria && !respondida(valor);
      progresso = { posicao: posicao + 1, total };
      conteudo = (
        <form
          ref={formularioRef}
          noValidate
          onSubmit={aoEnviarFormulario}
          onKeyDown={aoTeclar}
          className="pesquisa-publica__formulario"
        >
          <p className="pesquisa-contador">
            Pergunta {posicao + 1} de {total}
            {atual.secao.titulo ? (
              <span className="pesquisa-contador__secao">
                {" "}
                · {atual.secao.titulo}
              </span>
            ) : null}
          </p>
          {atual.primeiraDaSecao && atual.secao.descricao ? (
            <p className="pesquisa-publica__legenda">{atual.secao.descricao}</p>
          ) : null}
          {posicao === 0 && primeiroNome ? (
            <p className="pesquisa-publica__nota">
              {pesquisa?.identificacao === "confidencial"
                ? `Olá, ${primeiroNome}. Identificação confirmada; suas respostas não ficam ligadas ao seu nome.`
                : `Olá, ${primeiroNome}. Você está respondendo com a sua identificação.`}
            </p>
          ) : null}
          {alerta ? (
            <p className="pesquisa-publica__erro" role="alert">
              {alerta}
            </p>
          ) : null}
          <CampoDaPergunta
            key={atual.pergunta.id}
            pergunta={atual.pergunta}
            valor={valor}
            erro={erros[atual.pergunta.id] ?? null}
            aoMudar={(v) => mudarResposta(atual.pergunta.id, v)}
            tituloRef={tituloRef}
          />
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

    case "enviado":
      conteudo = (
        <div className="pesquisa-publica__centro">
          <span
            className="pesquisa-publica__simbolo pesquisa-publica__simbolo--sucesso"
            aria-hidden="true"
          >
            <IconeSucesso tamanho={32} />
          </span>
          {titulo("Respostas enviadas")}
          <p className="pesquisa-publica__texto">
            Agradecemos a participação. Você já pode fechar esta página.
          </p>
        </div>
      );
      break;
  }

  return (
    <div className="pesquisa-publica">
      {progresso ? (
        <div
          className="pesquisa-progresso"
          role="progressbar"
          aria-label="Progresso da pesquisa"
          aria-valuemin={1}
          aria-valuemax={progresso.total}
          aria-valuenow={progresso.posicao}
          aria-valuetext={`Pergunta ${progresso.posicao} de ${progresso.total}`}
        >
          <span
            className="pesquisa-progresso__preenchido"
            style={{
              width: `${(progresso.posicao / Math.max(progresso.total, 1)) * 100}%`,
            }}
          />
        </div>
      ) : null}
      <header className="pesquisa-publica__topo">
        <MarcaEvolli variante="horizontal" altura={32} />
      </header>
      <main className="pesquisa-publica__principal">
        <div className="pesquisa-publica__cartao">{conteudo}</div>
      </main>
      <footer className="pesquisa-publica__rodape">
        Pesquisa aplicada pelo Evolli RH em nome da empresa.
      </footer>
    </div>
  );
}
