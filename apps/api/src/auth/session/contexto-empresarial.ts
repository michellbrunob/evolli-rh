/**
 * Contexto empresarial ativo (T163) — política e resolução.
 *
 * ## O problema
 *
 * Até a T162, a empresa de trabalho era `access_user.company_id`: uma coluna
 * da conta. O Hub entrou **sem** troca de empresa porque não havia o que
 * trocar — e disse isso, em vez de inventar um seletor.
 *
 * ## A regra, e quem decide
 *
 * | Papel | Empresas autorizadas | Troca |
 * | --- | --- | --- |
 * | `rh` | as vigentes em `access_user_empresa` **∪** a própria `company_id` | sim |
 * | `master_tecnico` | **todas as empresas ativas** | sim |
 * | demais | — | **não**: não listam nem trocam |
 *
 * **A política do `master_tecnico` não é invenção desta tarefa.** Ele já é o
 * único acesso global standing (ADR 0012) e `resolverEscopo` já lhe devolve
 * `{ global: true }` em todos os módulos. Aqui essa política fica **explícita
 * e testável** — e, principalmente, resolvida no servidor: a lista dele vem de
 * `empresa`, não de um array escrito no frontend.
 *
 * A união com a própria `company_id` para `rh` é deliberada. Sem ela, ligar
 * esta tarefa tiraria acesso de quem já trabalha, porque a tabela nasce vazia.
 * Perda de acesso silenciosa é pior que regra declarada.
 *
 * ## Por que o contexto mora na sessão
 *
 * Três consequências que uma coluna na conta não daria, e que são requisito:
 * duas abas da mesma pessoa mantêm contextos independentes; revogar uma sessão
 * não mexe na outra; e um login novo nasce em `NULL`, isto é, no padrão
 * previsível do papel.
 *
 * ## A propriedade que torna isto revisável
 *
 * **Sem seleção, o contexto é idêntico ao de antes da T163.** `NULL` resolve
 * para `access_user.company_id` — que para `master_tecnico` é nulo, ou seja,
 * escopo global preservado. Para quem não pode trocar, é sempre idêntico, por
 * construção. A única diferença de comportamento no produto inteiro nasce de
 * uma troca explícita e autorizada.
 *
 * ## Fail-closed na revogação
 *
 * A autorização é reconferida **a cada requisição**, não só na troca. Se a
 * associação foi revogada ou a empresa saiu do ar, o contexto é **rebaixado**
 * ao padrão do papel — nunca promovido a escopo mais amplo. Transformar perda
 * de acesso em ganho de acesso seria o pior defeito possível aqui.
 */
import { AccessRole, AccessUser, Prisma } from "@prisma/client";

/**
 * Papéis que escolhem empresa de trabalho. Qualquer outro papel **não lista e
 * não troca** — nem por requisição forjada, porque é esta função que o
 * controlador consulta antes de qualquer coisa.
 */
const PAPEIS_QUE_SELECIONAM: readonly AccessRole[] = ["rh", "master_tecnico"];

/**
 * Papéis cuja política de autorização é **global**, por decisão já registrada
 * (ADR 0012). Hoje só `master_tecnico`. Mantido como lista para que ampliar
 * exija editar esta linha — e o teste que a prende.
 */
const PAPEIS_DE_POLITICA_GLOBAL: readonly AccessRole[] = ["master_tecnico"];

export function papelSelecionaEmpresa(role: AccessRole): boolean {
  return PAPEIS_QUE_SELECIONAM.includes(role);
}

export function papelTemPoliticaGlobal(role: AccessRole): boolean {
  return PAPEIS_DE_POLITICA_GLOBAL.includes(role);
}

/** Empresa oferecida na seleção. Projeção mínima: nada além do necessário. */
export interface EmpresaAutorizada {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

/** O contexto resolvido para uma requisição. */
export interface ContextoEmpresarial {
  /**
   * A empresa em que esta requisição opera. É o valor que vira
   * `actor.companyId` para toda a camada de aplicação — e portanto o que os
   * oito resolvedores de escopo leem.
   */
  readonly empresaAtivaId: string | null;
  /** A empresa da CONTA, preservada para quem precisa dela de fato. */
  readonly contaEmpresaId: string | null;
  /** O papel pode escolher empresa? Decide se o Hub mostra seletor. */
  readonly podeTrocarEmpresa: boolean;
  /**
   * A seleção guardada na sessão não vale mais (revogada, inativada ou
   * inexistente) e foi rebaixada ao padrão. O chamador limpa a coluna.
   */
  readonly selecaoInvalidada: boolean;
}

/** Cliente mínimo exigido — facilita teste sem subir Prisma inteiro. */
export interface LeitorDeAutorizacao {
  accessUserEmpresa: {
    findFirst(args: Prisma.AccessUserEmpresaFindFirstArgs): Promise<unknown>;
    findMany(args: Prisma.AccessUserEmpresaFindManyArgs): Promise<unknown[]>;
  };
  empresa: {
    findFirst(args: Prisma.EmpresaFindFirstArgs): Promise<unknown>;
    findMany(args: Prisma.EmpresaFindManyArgs): Promise<unknown[]>;
  };
}

/**
 * A empresa está autorizada para esta conta, **agora**?
 *
 * Uma consulta, sempre no servidor, sempre contra o estado atual. Note que
 * nenhuma resposta desta função distingue "não existe" de "não autorizada":
 * quem chama devolve 404 nos dois casos (anti-enumeração).
 */
export async function empresaEstaAutorizada(
  prisma: LeitorDeAutorizacao,
  user: Pick<AccessUser, "id" | "role" | "companyId">,
  empresaId: string,
): Promise<boolean> {
  if (!papelSelecionaEmpresa(user.role)) {
    // Quem não seleciona só "está autorizado" na própria empresa, e nem por
    // isso recebe seletor: a rota de troca recusa o papel antes de chegar aqui.
    return user.companyId !== null && user.companyId === empresaId;
  }

  if (papelTemPoliticaGlobal(user.role)) {
    // Política global (ADR 0012): qualquer empresa ATIVA. "Ativa" importa —
    // sem isso, uma empresa inativada continuaria selecionável.
    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, status: "ativo" },
      select: { id: true },
    });
    return empresa !== null;
  }

  // A própria empresa da conta é sempre autorizada — ver o bloco de cabeçalho.
  if (user.companyId !== null && user.companyId === empresaId) {
    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, status: "ativo" },
      select: { id: true },
    });
    return empresa !== null;
  }

  const concessao = await prisma.accessUserEmpresa.findFirst({
    where: {
      userId: user.id,
      empresaId,
      revogadoEm: null,
      empresa: { status: "ativo" },
    },
    select: { id: true },
  });
  return concessao !== null;
}

/**
 * As empresas que esta conta pode escolher.
 *
 * Devolve lista **vazia** para papel que não seleciona. Isso é o princípio 10
 * em código: empresa autorizada não é exposta a quem não tem poder de seleção,
 * e a rota que chama esta função nem é alcançável por esses papéis.
 */
export async function listarEmpresasAutorizadas(
  prisma: LeitorDeAutorizacao,
  user: Pick<AccessUser, "id" | "role" | "companyId">,
): Promise<EmpresaAutorizada[]> {
  if (!papelSelecionaEmpresa(user.role)) return [];

  const projecao = { id: true, codigo: true, nome: true };

  if (papelTemPoliticaGlobal(user.role)) {
    return (await prisma.empresa.findMany({
      where: { status: "ativo" },
      select: projecao,
      orderBy: { codigo: "asc" },
    })) as EmpresaAutorizada[];
  }

  const concedidas = (await prisma.accessUserEmpresa.findMany({
    where: { userId: user.id, revogadoEm: null, empresa: { status: "ativo" } },
    select: { empresa: { select: projecao } },
  })) as Array<{ empresa: EmpresaAutorizada }>;

  const porId = new Map<string, EmpresaAutorizada>();
  for (const { empresa } of concedidas) porId.set(empresa.id, empresa);

  // A própria empresa entra mesmo sem linha na tabela.
  if (user.companyId !== null && !porId.has(user.companyId)) {
    const propria = (await prisma.empresa.findFirst({
      where: { id: user.companyId, status: "ativo" },
      select: projecao,
    })) as EmpresaAutorizada | null;
    if (propria !== null) porId.set(propria.id, propria);
  }

  return [...porId.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/**
 * Resolve o contexto de uma requisição a partir da sessão.
 *
 * Chamada em `validateAndTouch`, isto é, **uma vez por requisição autenticada**
 * e antes de qualquer controlador. É este ponto único que cobre as 45 chamadas
 * de resolvedor de escopo sem tocá-las.
 */
export async function resolverContextoEmpresarial(
  prisma: LeitorDeAutorizacao,
  user: Pick<AccessUser, "id" | "role" | "companyId">,
  empresaAtivaIdDaSessao: string | null,
): Promise<ContextoEmpresarial> {
  const podeTrocarEmpresa = papelSelecionaEmpresa(user.role);
  const padrao: ContextoEmpresarial = {
    empresaAtivaId: user.companyId,
    contaEmpresaId: user.companyId,
    podeTrocarEmpresa,
    selecaoInvalidada: false,
  };

  if (empresaAtivaIdDaSessao === null) return padrao;

  // Papel perdeu o direito de selecionar depois de já ter selecionado (troca
  // de papel administrativa). A seleção morre junto com o direito.
  if (!podeTrocarEmpresa) {
    return { ...padrao, selecaoInvalidada: true };
  }

  const autorizada = await empresaEstaAutorizada(
    prisma,
    user,
    empresaAtivaIdDaSessao,
  );
  if (!autorizada) {
    // REBAIXA ao padrão, nunca promove. Se a seleção caísse para "sem filtro",
    // revogar acesso ampliaria o escopo — o pior defeito possível aqui.
    return { ...padrao, selecaoInvalidada: true };
  }

  return { ...padrao, empresaAtivaId: empresaAtivaIdDaSessao };
}

/**
 * O ator entregue aos serviços: o usuário da sessão com `companyId`
 * **substituído** pela empresa ativa.
 *
 * É a substituição que torna a mudança central em vez de espalhada. Os oito
 * resolvedores de escopo continuam lendo `actor.companyId`, e esse campo passa
 * a significar, para toda a camada de aplicação, "a empresa em que esta
 * requisição opera". A empresa da conta continua acessível em
 * `contaEmpresaId`, para quem precisar dela de fato.
 */
export interface AtorDaRequisicao extends AccessUser {
  /** A empresa da CONTA, antes da resolução de contexto. */
  readonly contaEmpresaId: string | null;
  readonly podeTrocarEmpresa: boolean;
}

export function aplicarContextoAoAtor(
  user: AccessUser,
  contexto: ContextoEmpresarial,
): AtorDaRequisicao {
  return {
    ...user,
    companyId: contexto.empresaAtivaId,
    contaEmpresaId: contexto.contaEmpresaId,
    podeTrocarEmpresa: contexto.podeTrocarEmpresa,
  };
}

/**
 * O ator opera em **escopo global** nesta requisição?
 *
 * Esta função existe por causa de um defeito que o E2E da própria T163 pegou:
 * os sete resolvedores de leitura do produto devolviam `{ global: true }`
 * olhando o **papel** (`actor.role === "master_tecnico"`), e não o contexto.
 * Resultado medido: o `master_tecnico` selecionava a empresa D e continuava
 * enxergando as duas — a troca não trocava nada para ele.
 *
 * A regra correta tem duas condições, e as duas importam:
 *
 * - o papel tem política global (hoje só `master_tecnico`), **e**
 * - **não há empresa ativa selecionada** nesta sessão.
 *
 * Com empresa ativa, o global vira escopado nela — que é a regra de negócio
 * aprovada: toda leitura usa o contexto empresarial ativo. Sem seleção,
 * `companyId` é nulo e o comportamento é **idêntico** ao de antes da T163.
 */
export function atorOperaEmEscopoGlobal(
  actor: Pick<AccessUser, "role" | "companyId">,
): boolean {
  return papelTemPoliticaGlobal(actor.role) && actor.companyId === null;
}
