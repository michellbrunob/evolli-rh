/**
 * T216 — responder uma pesquisa pelo link (`#/p/<token>`), sem login.
 *
 * Etapas: abertura → identificação (só identificada e confidencial) → uma
 * seção por vez → agradecimento. Nada aqui chama API autenticada: o único
 * cliente é o público (`pesquisaPublicaClient`), sem cookie nem CSRF.
 *
 * Guardado no navegador, sempre com try/catch (modo privado, armazenamento
 * cheio ou bloqueado não quebram a página):
 * - `sessionStorage` — o rascunho das respostas, para não perder ao
 *   recarregar; nunca o CPF, a data de nascimento nem o passe;
 * - `localStorage` — só na anônima: "este navegador já respondeu" (aviso,
 *   não trava).
 *
 * Foco: a cada etapa nova o foco vai ao título dela; ao barrar o avanço, vai
 * ao primeiro campo com erro.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import "../../app/tokens.css";
import "../../components/FormField.css";
import "./ResponderPesquisa.css";
import { Button } from "../../components/Button";
import { MarcaEvolli } from "../../app/marca/MarcaEvolli";
import {
  ErroPesquisaPublica,
  clientePesquisaPublica,
  type ClientePesquisaPublica,
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
  errosDaSecao,
  lerRascunho,
  mascararCpf,
  montarRespostas,
  perguntasVisiveis,
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
  | { readonly tipo: "secao"; readonly indice: number }
  | { readonly tipo: "ja-respondeu" }
  | { readonly tipo: "enviado" };

export const MENSAGEM_NAO_ENCONTRADO =
  "Não encontramos você nesta pesquisa. Confira o CPF e a data de nascimento.";
export const MENSAGEM_MUITAS_TENTATIVAS =
  "Muitas tentativas. Tente de novo em alguns minutos.";

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

function chaveRascunho(token: string): string {
  return `evolli.pesquisa.${token}.rascunho`;
}

function chaveRespondida(token: string): string {
  return `evolli.pesquisa.${token}.respondida`;
}

function lerArmazenado(qual: "local" | "sessao", chave: string): string | null {
  try {
    const area = qual === "local" ? window.localStorage : window.sessionStorage;
    return area.getItem(chave);
  } catch {
    return null;
  }
}

function gravarArmazenado(
  qual: "local" | "sessao",
  chave: string,
  valor: string | null,
): void {
  try {
    const area = qual === "local" ? window.localStorage : window.sessionStorage;
    if (valor === null) area.removeItem(chave);
    else area.setItem(chave, valor);
  } catch {
    // Sem armazenamento (modo privado, bloqueado, cheio): segue sem guardar.
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
    lerRascunho(lerArmazenado("sessao", chaveRascunho(token))),
  );
  const [errosSecao, setErrosSecao] = useState<Record<string, string>>({});
  const [alertaSecao, setAlertaSecao] = useState<string | null>(null);
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
  /** Depois de reidentificar (passe vencido), volta à última seção. */
  const voltarAoFimRef = useRef(false);

  const [jaRespondeuAqui] = useState(
    () => lerArmazenado("local", chaveRespondida(token)) === "1",
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
  useEffect(() => {
    if (etapa.tipo === "enviado" || etapa.tipo === "ja-respondeu") return;
    gravarArmazenado(
      "sessao",
      chaveRascunho(token),
      Object.keys(respostas).length ? JSON.stringify(respostas) : null,
    );
  }, [respostas, token, etapa.tipo]);

  // Foco no título de cada etapa nova.
  const chaveDaEtapa =
    etapa.tipo === "secao" ? `secao-${etapa.indice}` : etapa.tipo;
  useEffect(() => {
    tituloRef.current?.focus();
  }, [chaveDaEtapa]);

  // Foco no primeiro campo com erro.
  useEffect(() => {
    if (focarErro === 0) return;
    const alvo = formularioRef.current?.querySelector<HTMLElement>(
      "[aria-invalid='true'] input:not(:disabled), [aria-invalid='true'] textarea, input[aria-invalid='true'], textarea[aria-invalid='true']",
    );
    alvo?.focus();
  }, [focarErro]);

  const secoes = useMemo(() => pesquisa?.secoes ?? [], [pesquisa]);
  const visiveis = useMemo(
    () => perguntasVisiveis(secoes, respostas),
    [secoes, respostas],
  );
  /** Índices das seções com alguma pergunta visível. */
  const ordem = useMemo(
    () =>
      secoes.flatMap((s, i) =>
        s.perguntas.some((p) => visiveis.has(p.id)) ? [i] : [],
      ),
    [secoes, visiveis],
  );

  const irParaSecao = useCallback((indice: number) => {
    setErrosSecao({});
    setAlertaSecao(null);
    setEtapa({ tipo: "secao", indice });
  }, []);

  function comecar() {
    if (!pesquisa) return;
    if (pesquisa.identificacao !== "anonima" && passeRef.current === null) {
      setErroIdent(null);
      setAvisoIdent(null);
      setEtapa({ tipo: "identificacao" });
      return;
    }
    if (ordem.length) irParaSecao(ordem[0]!);
  }

  function mudarResposta(id: string, valor: ValorRascunho) {
    setRespostas((r) => ({ ...r, [id]: valor }));
    setErrosSecao((e) => {
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
    const erros: { cpf?: string; nascimento?: string } = {};
    if (!cpfValido(digitos))
      erros.cpf = "Informe um CPF válido, com 11 números.";
    if (iso === null) {
      erros.nascimento = "Informe a data de nascimento no formato dd/mm/aaaa.";
    }
    setErrosIdent(erros);
    setErroIdent(null);
    if (erros.cpf || erros.nascimento) {
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
      if (destino !== undefined) irParaSecao(destino);
    } catch (e) {
      const status = e instanceof ErroPesquisaPublica ? e.status : 0;
      if (status === 409) {
        // Já respondeu: o rascunho desta aba não serve mais.
        gravarArmazenado("sessao", chaveRascunho(token), null);
        setEtapa({ tipo: "ja-respondeu" });
      } else if (status === 410 && e instanceof ErroPesquisaPublica) {
        setEtapa({
          tipo: "indisponivel",
          motivo: e.indisponivel ?? "encerrada",
        });
      } else if (status === 404) {
        setEtapa({ tipo: "indisponivel", motivo: "inexistente" });
      } else if (status === 429) setErroIdent(MENSAGEM_MUITAS_TENTATIVAS);
      else if (status === 401 || status === 422) {
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
    setAlertaSecao(null);
    try {
      const envio: {
        passe?: string;
        respostas: ReturnType<typeof montarRespostas>;
      } = { respostas: montarRespostas(secoes, respostas) };
      if (passeRef.current !== null) envio.passe = passeRef.current;
      await cliente.enviarRespostas(token, envio);
      passeRef.current = null;
      gravarArmazenado("sessao", chaveRascunho(token), null);
      if (pesquisa.identificacao === "anonima") {
        gravarArmazenado("local", chaveRespondida(token), "1");
      }
      setEtapa({ tipo: "enviado" });
    } catch (e) {
      const erro = e instanceof ErroPesquisaPublica ? e : null;
      const status = erro?.status ?? 0;
      if (status === 409) {
        gravarArmazenado("sessao", chaveRascunho(token), null);
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
        const primeira = ordem.find((i) =>
          secoes[i]!.perguntas.some((p) => p.id in porPergunta),
        );
        if (primeira !== undefined)
          setEtapa({ tipo: "secao", indice: primeira });
        setErrosSecao(porPergunta);
        setAlertaSecao(
          "Algumas respostas precisam de ajuste antes do envio. Revise as perguntas indicadas.",
        );
        setFocarErro((n) => n + 1);
      } else {
        setAlertaSecao(
          "Não foi possível enviar suas respostas agora. Elas continuam preenchidas; tente de novo.",
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  function continuar(evento: FormEvent) {
    evento.preventDefault();
    if (etapa.tipo !== "secao") return;
    const secao = secoes[etapa.indice];
    if (!secao) return;
    const erros = errosDaSecao(secao, visiveis, respostas);
    if (Object.keys(erros).length) {
      setErrosSecao(erros);
      setAlertaSecao(
        Object.keys(erros).length === 1
          ? "Revise a pergunta indicada antes de continuar."
          : "Revise as perguntas indicadas antes de continuar.",
      );
      setFocarErro((n) => n + 1);
      return;
    }
    const posicao = ordem.indexOf(etapa.indice);
    const proxima = ordem[posicao + 1];
    if (proxima === undefined) {
      void enviar();
      return;
    }
    irParaSecao(proxima);
  }

  function voltar() {
    if (etapa.tipo !== "secao") return;
    const anterior = ordem[ordem.indexOf(etapa.indice) - 1];
    if (anterior !== undefined) irParaSecao(anterior);
  }

  // ------------------------------------------------------------- desenho

  let conteudo: JSX.Element;
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
        <>
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="pesquisa-publica__titulo"
          >
            Não foi possível abrir a pesquisa
          </h1>
          <p role="alert" className="pesquisa-publica__texto">
            Verifique sua conexão e tente de novo.
          </p>
          <div className="pesquisa-publica__acoes">
            <Button onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </Button>
          </div>
        </>
      );
      break;

    case "indisponivel": {
      const { titulo, texto } = INDISPONIVEL[etapa.motivo];
      conteudo = (
        <>
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="pesquisa-publica__titulo"
          >
            {titulo}
          </h1>
          <p className="pesquisa-publica__texto">{texto}</p>
        </>
      );
      break;
    }

    case "abertura": {
      const p = pesquisa!;
      conteudo = (
        <>
          <p className="pesquisa-publica__empresa">{p.empresa}</p>
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="pesquisa-publica__titulo"
          >
            {p.nome}
          </h1>
          {paragrafos(p.boasVindas).map((texto, i) => (
            <p key={i} className="pesquisa-publica__texto">
              {texto}
            </p>
          ))}
          <p className="pesquisa-publica__resumo">
            {plural(p.totalPerguntas, "pergunta", "perguntas")} ·{" "}
            {tempoEstimado(p.minutosEstimados)}
          </p>
          <p className="pesquisa-publica__nota">
            {p.identificacao === "anonima"
              ? "Esta pesquisa é anônima: não pedimos seus dados e as respostas não mostram quem respondeu."
              : p.identificacao === "confidencial"
                ? "Esta pesquisa é confidencial: vamos confirmar que você participa dela, mas as respostas não ficam ligadas ao seu nome. O RH vê só o resultado do grupo."
                : "Esta pesquisa é identificada: o RH da empresa vê as suas respostas junto com o seu nome."}
          </p>
          {p.identificacao === "anonima" && jaRespondeuAqui ? (
            <p className="pesquisa-publica__aviso" role="status">
              Este navegador já enviou uma resposta para esta pesquisa. Se outra
              pessoa usa este aparelho, ela pode responder normalmente.
            </p>
          ) : null}
          <div className="pesquisa-publica__acoes">
            <Button onClick={comecar}>Começar</Button>
          </div>
        </>
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
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="pesquisa-publica__titulo"
          >
            Confirme seus dados
          </h1>
          <p className="pesquisa-publica__texto">
            Use o CPF e a data de nascimento do seu cadastro na empresa. Eles
            servem só para confirmar que você participa desta pesquisa.
          </p>
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
          <div className="pesquisa-publica__acoes">
            <Button type="submit" disabled={identificando}>
              {identificando ? "Confirmando…" : "Continuar"}
            </Button>
          </div>
        </form>
      );
      break;
    }

    case "secao": {
      const secao = secoes[etapa.indice]!;
      const posicao = ordem.indexOf(etapa.indice) + 1;
      const total = ordem.length;
      const ultima = posicao === total;
      const temObrigatoria = secao.perguntas.some(
        (p) => p.obrigatoria && visiveis.has(p.id),
      );
      conteudo = (
        <form
          ref={formularioRef}
          noValidate
          onSubmit={continuar}
          className="pesquisa-publica__formulario"
        >
          <div className="pesquisa-progresso">
            <p className="pesquisa-progresso__texto" id="pesquisa-progresso">
              Seção {posicao} de {total}
            </p>
            <div
              className="pesquisa-progresso__barra"
              role="progressbar"
              aria-labelledby="pesquisa-progresso"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={posicao}
              aria-valuetext={`Seção ${posicao} de ${total}`}
            >
              <span
                className="pesquisa-progresso__preenchido"
                style={{ width: `${(posicao / Math.max(total, 1)) * 100}%` }}
              />
            </div>
          </div>
          {posicao === 1 && primeiroNome ? (
            <p className="pesquisa-publica__nota">
              {pesquisa?.identificacao === "confidencial"
                ? `Olá, ${primeiroNome}. Identificação confirmada; suas respostas não ficam ligadas ao seu nome.`
                : `Olá, ${primeiroNome}. Você está respondendo com a sua identificação.`}
            </p>
          ) : null}
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="pesquisa-publica__titulo"
          >
            {secao.titulo ?? `Seção ${posicao}`}
          </h1>
          {secao.descricao ? (
            <p className="pesquisa-publica__texto">{secao.descricao}</p>
          ) : null}
          {temObrigatoria ? (
            <p className="pesquisa-publica__legenda">
              As perguntas marcadas com * são obrigatórias.
            </p>
          ) : null}
          {alertaSecao ? (
            <p className="pesquisa-publica__erro" role="alert">
              {alertaSecao}
            </p>
          ) : null}
          <div className="pesquisa-publica__perguntas">
            {secao.perguntas
              .filter((p) => visiveis.has(p.id))
              .map((p) => (
                <CampoDaPergunta
                  key={p.id}
                  pergunta={p}
                  valor={respostas[p.id]}
                  erro={errosSecao[p.id] ?? null}
                  aoMudar={(v) => mudarResposta(p.id, v)}
                />
              ))}
          </div>
          <div className="pesquisa-publica__acoes pesquisa-publica__acoes--navegacao">
            {posicao > 1 ? (
              <Button variant="secondary" onClick={voltar} disabled={enviando}>
                Voltar
              </Button>
            ) : null}
            <Button type="submit" disabled={enviando}>
              {ultima
                ? enviando
                  ? "Enviando…"
                  : "Enviar respostas"
                : "Continuar"}
            </Button>
          </div>
        </form>
      );
      break;
    }

    case "ja-respondeu":
      conteudo = (
        <>
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="pesquisa-publica__titulo"
          >
            Você já respondeu esta pesquisa
          </h1>
          <p className="pesquisa-publica__texto">
            Sua resposta já está registrada e cada participante responde uma vez
            só. Agradecemos a participação.
          </p>
        </>
      );
      break;

    case "enviado":
      conteudo = (
        <>
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="pesquisa-publica__titulo"
          >
            Respostas enviadas
          </h1>
          <p className="pesquisa-publica__texto">
            Agradecemos a participação. Você já pode fechar esta página.
          </p>
        </>
      );
      break;
  }

  return (
    <div className="pesquisa-publica">
      <header className="pesquisa-publica__topo">
        <MarcaEvolli variante="horizontal" altura={32} />
      </header>
      <main className="pesquisa-publica__principal">
        <div className="pesquisa-publica__cartao">{conteudo}</div>
      </main>
    </div>
  );
}
