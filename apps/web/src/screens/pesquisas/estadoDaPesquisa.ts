/**
 * T216 — o estado do assistente "Nova pesquisa" (o que vai para
 * `PesquisaEntrada`), as operações sobre seções e perguntas (duplicar, mover,
 * excluir, sem deixar condição órfã) e a validação de cada etapa.
 */
import type {
  CampoGrupo,
  Identificacao,
  ModeloPesquisa,
  Pergunta,
  PesquisaDetalhe,
  PesquisaEntrada,
  Secao,
  StatusPesquisa,
} from "../../api/pesquisasClient";
import {
  diaCivilDeHoje,
  formatarCompetenciaPorExtenso,
} from "../../format/data";
import {
  HORA_PADRAO,
  encerraEmParaApi,
  erroDoEncerramento,
  partesDoEncerramento,
} from "./encerramento";
import { modeloDaGaleria, secoesDoModelo } from "./modelosDePesquisa";
import {
  LIMITES,
  novoId,
  opcoesDaCondicao,
  podeSerCondicao,
  temOpcoes,
} from "./textosDasPesquisas";

export interface PessoaEscolhida {
  readonly nome: string;
  readonly departamento: string | null;
}

export interface EstadoDaPesquisa {
  readonly id: string | null;
  readonly status: StatusPesquisa;
  readonly nome: string;
  readonly boasVindas: string;
  readonly modelo: ModeloPesquisa;
  readonly identificacao: Identificacao;
  readonly secoes: readonly Secao[];
  readonly todos: boolean;
  readonly escolhidos: Readonly<Record<string, PessoaEscolhida>>;
  /** Dia do encerramento automático (`AAAA-MM-DD`); `null` sem prazo. */
  readonly encerraEm: string | null;
  /** Hora de Brasília do encerramento (`HH:MM`). */
  readonly encerraHora: string;
  readonly minimoPorGrupo: number;
  /** Só na anônima: o que quem responde escolhe antes (até 2). */
  readonly separarPor: readonly CampoGrupo[];
  /** O comentário final fixo do modelo (sempre por último), se houver. */
  readonly comentarioId: string | null;
  /** Já há respostas: perguntas travadas. */
  readonly temRespostas: boolean;
  /** Participantes que já responderam (não saem da lista). */
  readonly responderam: readonly string[];
  readonly link: string | null;
}

/** "Pulso – Novembro 2026": mês com inicial maiúscula, sem "de". */
export function nomeSugerido(nomeBase: string, hoje: string): string {
  const [mes = "", ano = ""] = formatarCompetenciaPorExtenso(
    hoje.slice(0, 7),
    "barra",
  ).split("/");
  return `${nomeBase} – ${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${ano}`;
}

/** A última pergunta, quando é o comentário final (paragrafo opcional). */
function comentarioDe(secoes: readonly Secao[]): string | null {
  const ultima = perguntasEmOrdem(secoes).at(-1);
  return ultima &&
    (ultima.tipo === "paragrafo" || ultima.tipo === "texto_curto") &&
    !ultima.obrigatoria &&
    !ultima.condicao &&
    !ultima.chave
    ? ultima.id
    : null;
}

export function estadoDoModelo(
  id: string,
  hoje: string = diaCivilDeHoje(),
): EstadoDaPesquisa {
  const m = modeloDaGaleria(id);
  const secoes = secoesDoModelo(m);
  return {
    id: null,
    status: "rascunho",
    nome:
      m.id === "personalizada"
        ? ""
        : (m.nomeDaPesquisa?.(hoje) ?? nomeSugerido(m.nomeBase, hoje)),
    boasVindas: m.boasVindas ?? "",
    modelo: m.modelo,
    identificacao: "identificada",
    secoes,
    todos: true,
    escolhidos: {},
    encerraEm: null,
    encerraHora: HORA_PADRAO,
    minimoPorGrupo: 3,
    separarPor: [],
    comentarioId: m.comentarioFinal ? comentarioDe(secoes) : null,
    temRespostas: false,
    responderam: [],
    link: null,
  };
}

/** Uma pesquisa existente como ponto de partida (copiar), sem participantes. */
export function estadoDaCopia(
  d: PesquisaDetalhe,
  hoje: string = diaCivilDeHoje(),
): EstadoDaPesquisa {
  const base = estadoDoModelo("personalizada", hoje);
  const copia = estadoDoDetalhe(d);
  return {
    ...base,
    nome: `${d.nome} (cópia)`,
    boasVindas: copia.boasVindas,
    identificacao: d.identificacao,
    secoes: copia.secoes,
    minimoPorGrupo: d.minimoPorGrupo,
    separarPor: copia.separarPor,
  };
}

export function estadoDoDetalhe(d: PesquisaDetalhe): EstadoDaPesquisa {
  const secoes =
    d.secoes.length > 0
      ? d.secoes
      : [{ id: novoId(), titulo: null, descricao: null, perguntas: [] }];
  return {
    id: d.id,
    status: d.status,
    nome: d.nome,
    boasVindas: d.boasVindas ?? "",
    modelo: d.modelo,
    identificacao: d.identificacao,
    secoes,
    todos: d.todos,
    // "Todo o time" resolvido no servidor não vira escolha de pessoas: quem
    // troca para "Escolher pessoas" começa do zero.
    escolhidos: d.todos
      ? {}
      : Object.fromEntries(
          (d.participantesLista ?? []).map((p) => [
            p.colaboradorId,
            { nome: p.nome, departamento: p.departamento },
          ]),
        ),
    encerraEm: partesDoEncerramento(d.encerraEm)?.data ?? null,
    encerraHora: partesDoEncerramento(d.encerraEm)?.hora ?? HORA_PADRAO,
    minimoPorGrupo: d.minimoPorGrupo,
    separarPor: d.separarPor ?? [],
    comentarioId:
      d.modelo !== "personalizada" && modeloDaGaleria(d.modelo).comentarioFinal
        ? comentarioDe(secoes)
        : null,
    temRespostas: d.temRespostas,
    responderam: (d.participantesLista ?? [])
      .filter((p) => p.respondeu === true)
      .map((p) => p.colaboradorId),
    link: d.link,
  };
}

export function entradaDoEstado(e: EstadoDaPesquisa): PesquisaEntrada {
  const vazio = (t: string | null | undefined) =>
    t && t.trim() ? t.trim() : null;
  const anonima = e.identificacao === "anonima";
  return {
    nome: e.nome.trim(),
    boasVindas: vazio(e.boasVindas),
    modelo: e.modelo,
    identificacao: e.identificacao,
    secoes: e.secoes.map((s) => ({
      id: s.id,
      titulo: vazio(s.titulo),
      descricao: vazio(s.descricao),
      perguntas: s.perguntas.map((p) => ({
        ...p,
        texto: p.texto.trim(),
        descricao: vazio(p.descricao),
        rotulo: vazio(p.rotulo),
      })),
    })),
    // Na anônima quem tiver o link responde: a lista não vale.
    participantes:
      e.todos || anonima
        ? { todos: true }
        : { todos: false, colaboradorIds: Object.keys(e.escolhidos) },
    encerraEm: e.encerraEm
      ? encerraEmParaApi({ data: e.encerraEm, hora: e.encerraHora })
      : null,
    minimoPorGrupo: e.minimoPorGrupo,
    ...(anonima ? { separarPor: [...e.separarPor] } : {}),
  };
}

/**
 * O corpo do rascunho: igual a `entradaDoEstado`, mas o prazo e o mínimo por
 * grupo ainda inválidos (data passada, número fora de 3 a 10) vão com o último
 * valor gravado — o resto continua salvando enquanto o campo mostra o erro.
 * Publicar continua barrado pela validação da etapa.
 */
export function entradaDoRascunho(
  e: EstadoDaPesquisa,
  hoje: string,
  gravado: Pick<PesquisaDetalhe, "encerraEm" | "minimoPorGrupo"> | null,
): PesquisaEntrada {
  const entrada = entradaDoEstado(e);
  const erros = validarEnvio(e, hoje);
  const prazoGravado = partesDoEncerramento(gravado?.encerraEm);
  return {
    ...entrada,
    ...(erros.encerraEm
      ? { encerraEm: prazoGravado ? encerraEmParaApi(prazoGravado) : null }
      : {}),
    ...(erros.minimoPorGrupo
      ? {
          minimoPorGrupo:
            gravado?.minimoPorGrupo ?? LIMITES.minimoPorGrupoMenor,
        }
      : {}),
  };
}

/** Todas as perguntas, na ordem em que aparecem. */
export function perguntasEmOrdem(secoes: readonly Secao[]): Pergunta[] {
  return secoes.flatMap((s) => s.perguntas);
}

export function totalDePerguntasDoEstado(secoes: readonly Secao[]): number {
  return perguntasEmOrdem(secoes).length;
}

// ---- operações --------------------------------------------------------------

type Secoes = readonly Secao[];

function trocar<T>(lista: readonly T[], i: number, j: number): T[] {
  const nova = [...lista];
  if (j < 0 || j >= nova.length) return nova;
  [nova[i], nova[j]] = [nova[j]!, nova[i]!];
  return nova;
}

/** Tira condições que apontam para perguntas (ou opções) que não existem mais. */
export function limparCondicoes(secoes: Secoes): Secao[] {
  const todas = new Map(perguntasEmOrdem(secoes).map((p) => [p.id, p]));
  return secoes.map((s) => ({
    ...s,
    perguntas: s.perguntas.map((p) => {
      if (!p.condicao) return p;
      const alvo = todas.get(p.condicao.perguntaId);
      const ok =
        alvo &&
        podeSerCondicao(alvo.tipo) &&
        opcoesDaCondicao(alvo).some((o) => o.id === p.condicao!.opcaoId);
      return ok ? p : { ...p, condicao: null };
    }),
  }));
}

export function alterarPergunta(
  secoes: Secoes,
  perguntaId: string,
  mudar: (p: Pergunta) => Pergunta,
): Secao[] {
  return limparCondicoes(
    secoes.map((s) => ({
      ...s,
      perguntas: s.perguntas.map((p) => (p.id === perguntaId ? mudar(p) : p)),
    })),
  );
}

export function adicionarPergunta(
  secoes: Secoes,
  secaoId: string,
  pergunta: Pergunta,
): Secao[] {
  return secoes.map((s) =>
    s.id === secaoId ? { ...s, perguntas: [...s.perguntas, pergunta] } : s,
  );
}

export function excluirPergunta(secoes: Secoes, perguntaId: string): Secao[] {
  return limparCondicoes(
    secoes.map((s) => ({
      ...s,
      perguntas: s.perguntas.filter((p) => p.id !== perguntaId),
    })),
  );
}

function copiaDaPergunta(p: Pergunta): Pergunta {
  const opcoes = p.config.opcoes?.map((o) => ({ ...o, id: novoId() }));
  return {
    ...p,
    id: novoId(),
    config: { ...p.config, ...(opcoes ? { opcoes } : {}) },
  };
}

export function duplicarPergunta(secoes: Secoes, perguntaId: string): Secao[] {
  return secoes.map((s) => {
    const i = s.perguntas.findIndex((p) => p.id === perguntaId);
    if (i < 0) return s;
    const perguntas = [...s.perguntas];
    perguntas.splice(i + 1, 0, copiaDaPergunta(s.perguntas[i]!));
    return { ...s, perguntas };
  });
}

/**
 * Move uma pergunta uma posição (−1 sobe, +1 desce); na ponta da seção,
 * passa para a seção vizinha.
 */
export function moverPergunta(
  secoes: Secoes,
  perguntaId: string,
  passo: -1 | 1,
): Secao[] {
  const si = secoes.findIndex((s) =>
    s.perguntas.some((p) => p.id === perguntaId),
  );
  if (si < 0) return [...secoes];
  const secao = secoes[si]!;
  const pi = secao.perguntas.findIndex((p) => p.id === perguntaId);
  const alvo = pi + passo;
  if (alvo >= 0 && alvo < secao.perguntas.length) {
    return secoes.map((s, i) =>
      i === si ? { ...s, perguntas: trocar(s.perguntas, pi, alvo) } : s,
    );
  }
  const vizinha = si + passo;
  if (vizinha < 0 || vizinha >= secoes.length) return [...secoes];
  const pergunta = secao.perguntas[pi]!;
  return secoes.map((s, i) => {
    if (i === si)
      return {
        ...s,
        perguntas: s.perguntas.filter((p) => p.id !== perguntaId),
      };
    if (i === vizinha)
      return {
        ...s,
        perguntas:
          passo === 1 ? [pergunta, ...s.perguntas] : [...s.perguntas, pergunta],
      };
    return s;
  });
}

/** Leva a pergunta arrastada para a posição de outra (arrastar e soltar). */
export function levarPerguntaPara(
  secoes: Secoes,
  perguntaId: string,
  destinoId: string,
): Secao[] {
  if (perguntaId === destinoId) return [...secoes];
  const pergunta = perguntasEmOrdem(secoes).find((p) => p.id === perguntaId);
  if (!pergunta) return [...secoes];
  const sem = secoes.map((s) => ({
    ...s,
    perguntas: s.perguntas.filter((p) => p.id !== perguntaId),
  }));
  return sem.map((s) => {
    const i = s.perguntas.findIndex((p) => p.id === destinoId);
    if (i < 0) return s;
    const perguntas = [...s.perguntas];
    perguntas.splice(i, 0, pergunta);
    return { ...s, perguntas };
  });
}

export function adicionarSecao(secoes: Secoes): Secao[] {
  return [
    ...secoes,
    { id: novoId(), titulo: null, descricao: null, perguntas: [] },
  ];
}

export function alterarSecao(
  secoes: Secoes,
  secaoId: string,
  mudar: Partial<Pick<Secao, "titulo" | "descricao">>,
): Secao[] {
  return secoes.map((s) => (s.id === secaoId ? { ...s, ...mudar } : s));
}

export function moverSecao(
  secoes: Secoes,
  secaoId: string,
  passo: -1 | 1,
): Secao[] {
  const i = secoes.findIndex((s) => s.id === secaoId);
  return trocar(secoes, i, i + passo);
}

export function excluirSecao(secoes: Secoes, secaoId: string): Secao[] {
  return limparCondicoes(secoes.filter((s) => s.id !== secaoId));
}

/** Copia a seção logo abaixo, com ids novos (condições internas seguem a cópia). */
export function duplicarSecao(secoes: Secoes, secaoId: string): Secao[] {
  const i = secoes.findIndex((s) => s.id === secaoId);
  if (i < 0) return [...secoes];
  const original = secoes[i]!;
  const idDaPergunta = new Map<string, string>();
  const idDaOpcao = new Map<string, string>();
  const perguntas = original.perguntas.map((p) => {
    const id = novoId();
    idDaPergunta.set(p.id, id);
    const opcoes = p.config.opcoes?.map((o) => {
      const novo = novoId();
      idDaOpcao.set(o.id, novo);
      return { ...o, id: novo };
    });
    return { ...p, id, config: { ...p.config, ...(opcoes ? { opcoes } : {}) } };
  });
  const copia: Secao = {
    id: novoId(),
    titulo: original.titulo ? `${original.titulo} (cópia)` : null,
    descricao: original.descricao,
    perguntas: perguntas.map((p) => {
      const c = p.condicao;
      if (!c || !idDaPergunta.has(c.perguntaId)) return p;
      return {
        ...p,
        condicao: {
          perguntaId: idDaPergunta.get(c.perguntaId)!,
          opcaoId: idDaOpcao.get(c.opcaoId) ?? c.opcaoId,
        },
      };
    }),
  };
  const nova = [...secoes];
  nova.splice(i + 1, 0, copia);
  return nova;
}

// ---- validação --------------------------------------------------------------

/** Erros por chave (`nome`, `pergunta:<id>`, `participantes`…). */
export type Erros = Readonly<Record<string, string>>;

export function errosDaPergunta(
  p: Pergunta,
  anteriores: readonly Pergunta[],
): string[] {
  const erros: string[] = [];
  const texto = p.texto.trim();
  if (!texto) erros.push("Escreva a pergunta.");
  else if (texto.length > LIMITES.textoPergunta)
    erros.push(`A pergunta passa de ${LIMITES.textoPergunta} caracteres.`);
  if ((p.rotulo ?? "").length > LIMITES.rotulo)
    erros.push(`O rótulo curto pode ter até ${LIMITES.rotulo} caracteres.`);
  if ((p.descricao ?? "").length > LIMITES.descricaoPergunta)
    erros.push(`A descrição passa de ${LIMITES.descricaoPergunta} caracteres.`);
  if (temOpcoes(p.tipo)) {
    const opcoes = p.config.opcoes ?? [];
    if (opcoes.length < LIMITES.opcoesMinimo)
      erros.push("Ofereça pelo menos 2 opções.");
    if (opcoes.length > LIMITES.opcoesMaximo)
      erros.push(`Ofereça no máximo ${LIMITES.opcoesMaximo} opções.`);
    if (opcoes.some((o) => !o.texto.trim()))
      erros.push("Preencha o texto de todas as opções.");
    if (opcoes.some((o) => o.texto.length > LIMITES.textoOpcao))
      erros.push(`Cada opção pode ter até ${LIMITES.textoOpcao} caracteres.`);
    const textos = opcoes.map((o) => o.texto.trim().toLowerCase());
    if (new Set(textos).size !== textos.length)
      erros.push("Há opções repetidas.");
    const m = p.config.maximo;
    // `null` (como a API devolve) e ausente: sem limite.
    if (p.tipo === "multipla_escolha" && m != null) {
      const total = opcoes.length + (p.config.outro ? 1 : 0);
      if (!Number.isInteger(m) || m < 1 || m > total)
        erros.push(`O máximo de marcações vai de 1 a ${total}.`);
    }
  }
  if (p.tipo === "escala") {
    const min = p.config.minimo ?? 1;
    const max = p.config.maximo;
    if (min !== 0 && min !== 1) erros.push("A escala começa em 0 ou em 1.");
    if (max == null || !Number.isInteger(max) || max < 2 || max > 10)
      erros.push("A escala termina entre 2 e 10.");
  }
  if (p.tipo === "numero") {
    const { minimo, maximo } = p.config;
    if (minimo != null && maximo != null && minimo > maximo)
      erros.push("O mínimo não pode ser maior que o máximo.");
  }
  if (p.condicao) {
    const alvo = anteriores.find((a) => a.id === p.condicao!.perguntaId);
    if (!alvo || !podeSerCondicao(alvo.tipo))
      erros.push(
        "A condição precisa apontar para uma pergunta anterior de escolha ou de sim ou não.",
      );
    else if (!opcoesDaCondicao(alvo).some((o) => o.id === p.condicao!.opcaoId))
      erros.push("A opção da condição não existe mais.");
  }
  return erros;
}

export function validarSobre(e: EstadoDaPesquisa): Erros {
  const erros: Record<string, string> = {};
  const nome = e.nome.trim();
  if (!nome) erros.nome = "Dê um nome à pesquisa.";
  else if (nome.length > LIMITES.nome)
    erros.nome = `O nome pode ter até ${LIMITES.nome} caracteres.`;
  if (e.boasVindas.length > LIMITES.boasVindas)
    erros.boasVindas = `A mensagem pode ter até ${LIMITES.boasVindas} caracteres.`;
  return erros;
}

export function validarPerguntas(e: EstadoDaPesquisa): Erros {
  const erros: Record<string, string> = {};
  const todas = perguntasEmOrdem(e.secoes);
  if (todas.length === 0) erros.perguntas = "Inclua pelo menos uma pergunta.";
  if (todas.length > LIMITES.perguntas)
    erros.perguntas = `A pesquisa pode ter até ${LIMITES.perguntas} perguntas (hoje são ${todas.length}).`;
  if (e.secoes.length > LIMITES.secoes)
    erros.perguntas = `A pesquisa pode ter até ${LIMITES.secoes} seções.`;
  todas.forEach((p, i) => {
    const lista = errosDaPergunta(p, todas.slice(0, i));
    if (lista.length > 0) erros[`pergunta:${p.id}`] = lista.join(" ");
  });
  return erros;
}

export function validarParticipantes(e: EstadoDaPesquisa): Erros {
  if (e.identificacao === "anonima") return {};
  if (!e.todos && Object.keys(e.escolhidos).length === 0)
    return { participantes: "Escolha pelo menos uma pessoa." };
  return {};
}

export function validarEnvio(e: EstadoDaPesquisa, hoje: string): Erros {
  const erros: Record<string, string> = {};
  const prazo = erroDoEncerramento(e.encerraEm, e.encerraHora, hoje);
  if (prazo) erros.encerraEm = prazo;
  const m = e.minimoPorGrupo;
  if (
    !Number.isInteger(m) ||
    m < LIMITES.minimoPorGrupoMenor ||
    m > LIMITES.minimoPorGrupoMaior
  )
    erros.minimoPorGrupo = `Informe um número de ${LIMITES.minimoPorGrupoMenor} a ${LIMITES.minimoPorGrupoMaior}.`;
  return erros;
}

export function validarEtapa(
  e: EstadoDaPesquisa,
  etapa: number,
  hoje: string,
): Erros {
  switch (etapa) {
    case 0:
      return validarSobre(e);
    case 1:
      return validarPerguntas(e);
    case 2:
      return validarParticipantes(e);
    case 3:
      return validarEnvio(e, hoje);
    default:
      return {
        ...validarSobre(e),
        ...validarPerguntas(e),
        ...validarParticipantes(e),
        ...validarEnvio(e, hoje),
      };
  }
}
