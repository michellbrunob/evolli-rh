/**
 * Seed do ambiente LOCAL de demonstração (T141).
 *
 * Preenche um banco local com dados **exclusivamente sintéticos** para que o
 * proprietário navegue visualmente pelo que já está integrado na `main`. Não é
 * funcionalidade de RH, não roda em produção e não é exposto por nenhuma rota.
 *
 * **Só cria pelo caminho que o produto já oferece.** Toda entidade de domínio
 * entra por HTTP, nos mesmos endpoints que a interface usa, com sessão e CSRF
 * reais — nenhum `INSERT` direto que pudesse produzir um estado que o próprio
 * sistema não sabe criar, e nenhuma regra nova.
 *
 * A única exceção é a conta `master_tecnico`, que **não tem endpoint de
 * criação** (`PAPEIS_COMUNS` a exclui de propósito). Ela é gravada via Prisma,
 * exatamente como `bootstrap-admin.ts` faz com o `admin_tecnico` e como os
 * próprios testes E2E fazem.
 *
 * **Idempotente por construção:** cada passo procura antes de criar e reusa o
 * que achar, varrendo **todas** as páginas da listagem — não só a primeira,
 * senão a idempotência acabaria no registro 101 e o seed passaria a duplicar
 * num banco de demonstração já povoado. Nada é apagado —
 * `solicitacao_pessoa` e `audit_event` têm `DELETE` revogado no banco, e um
 * seed que apagasse para recriar não teria como rodar duas vezes. Rodar de
 * novo converge para o mesmo conjunto.
 *
 * **Não cria:** conteúdo de documento, anexo, biometria, diagnóstico, CID, dado
 * clínico, MFA, segredo real ou qualquer acesso a serviço externo.
 */
import { PrismaClient } from "@prisma/client";
import { PasswordHashService } from "../auth/password/password-hash.service";

/** Marca visível em todo registro criado aqui. */
export const MARCA_DEMO = "Demo";

/**
 * Senha única dos perfis sintéticos. Atende à política (15+ caracteres) e é
 * deliberadamente autodescritiva: quem a vir num log ou numa tela sabe que é
 * de demonstração. Nunca deve existir fora de um banco local.
 */
export const SENHA_DEMO = "Demonstracao-Local-Evolli-2026";

/** Domínio reservado e não roteável — nenhum e-mail daqui existe de verdade. */
const DOMINIO = "evolli.local";

export interface PerfilDemo {
  readonly email: string;
  readonly papel: string;
  readonly empresa: "alfa" | "beta" | null;
  readonly finalidade: string;
  readonly limitacoes: string;
}

/**
 * Perfis sintéticos — um por papel que o RBAC já distingue hoje, para que as
 * diferenças de permissão sejam observáveis na tela.
 */
export const PERFIS_DEMO: readonly PerfilDemo[] = [
  {
    email: `master.demo@${DOMINIO}`,
    papel: "master_tecnico",
    empresa: null,
    finalidade:
      "Perfil global controlado. Cria empresas e contas, e enxerga as duas empresas de demonstração.",
    limitacoes:
      "Leitura global nas Solicitações de Pessoas; nenhuma mutação nesse módulo.",
  },
  {
    email: `rh.alfa@${DOMINIO}`,
    papel: "rh",
    empresa: "alfa",
    finalidade:
      "Papel operador da maior parte das telas funcionais: cadastros, pessoas, documentos e Solicitações.",
    limitacoes: "Só enxerga a Empresa Demo Alfa; nada da Beta.",
  },
  {
    email: `rh.beta@${DOMINIO}`,
    papel: "rh",
    empresa: "beta",
    finalidade:
      "Contraprova de isolamento entre empresas: mesmas telas, outro escopo.",
    limitacoes: "Recursos da Alfa respondem 404, nunca 403.",
  },
  {
    email: `dp.alfa@${DOMINIO}`,
    papel: "dp",
    empresa: "alfa",
    finalidade: "Mostra a diferença de capacidade entre DP e RH.",
    limitacoes:
      "Sem capacidade nas Solicitações de Pessoas (403 por deny-by-default).",
  },
  {
    email: `gestor.alfa@${DOMINIO}`,
    papel: "gestor",
    empresa: "alfa",
    finalidade:
      "Papel consultivo por `PD-SOL-01`; serve para ver o que NÃO é oferecido.",
    limitacoes: "Sem capacidade nas Solicitações de Pessoas.",
  },
  {
    email: `colaborador.alfa@${DOMINIO}`,
    papel: "colaborador",
    empresa: "alfa",
    finalidade:
      "Conta de acesso com papel colaborador. Existe para demonstrar a negação.",
    limitacoes:
      "NÃO é autoatendimento: não há vínculo autenticado entre conta e colaborador (`DP-23`).",
  },
];

export interface ResumoSeed {
  readonly empresas: number;
  readonly usuarios: number;
  readonly colaboradores: number;
  readonly vinculos: number;
  readonly criados: number;
  readonly reaproveitados: number;
}

interface Sessao {
  readonly cookie: string;
  readonly csrfToken: string;
}

interface Contexto {
  readonly baseUrl: string;
  criados: number;
  reaproveitados: number;
}

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

async function pedir(
  ctx: Contexto,
  metodo: string,
  rota: string,
  sessao?: Sessao,
  corpo?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (sessao) headers["Cookie"] = sessao.cookie;
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  if (sessao && metodo !== "GET") headers["x-csrf-token"] = sessao.csrfToken;

  return fetch(`${ctx.baseUrl}${rota}`, {
    method: metodo,
    headers,
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
}

async function ler<T>(ctx: Contexto, rota: string, sessao: Sessao): Promise<T> {
  const res = await pedir(ctx, "GET", rota, sessao);
  if (!res.ok) {
    throw new Error(`GET ${rota} respondeu ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Cria o recurso apenas se `procurar` não achar um equivalente. É daqui que
 * vem a idempotência: a segunda execução encontra tudo e não escreve nada.
 */
async function garantir<T>(
  ctx: Contexto,
  rotulo: string,
  procurar: () => Promise<T | undefined>,
  criar: () => Promise<Response>,
): Promise<T> {
  const existente = await procurar();
  if (existente !== undefined) {
    ctx.reaproveitados += 1;
    return existente;
  }

  const res = await criar();
  if (!res.ok) {
    const status = res.status;
    throw new Error(
      `Falha ao criar ${rotulo}: a API respondeu ${status}. ` +
        "O seed não continua com o ambiente pela metade.",
    );
  }
  ctx.criados += 1;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Varredura completa (idempotência que não depende do tamanho do banco)
// ---------------------------------------------------------------------------

/** Teto de `tamanhoPagina` nos contratos de listagem (`*.types.ts`). */
const TAMANHO_PAGINA = 100;
/** Teto de `limit` em `GET /v1/users` (`listar-usuarios.util.ts`). */
const LIMITE_USUARIOS = 100;
/**
 * Trava contra laço infinito se uma listagem devolver página cheia para
 * sempre. Em 1000 páginas de 100, falha alto em vez de girar calado.
 */
const LIMITE_PAGINAS = 1000;

/**
 * Percorre **todas** as páginas de uma listagem, não só a primeira.
 *
 * Os contratos de listagem não têm filtro por código, nome ou texto livre —
 * é decisão de segurança (sem enumeração), não esquecimento. Então a única
 * busca exata possível é a varredura completa. Ela é o que garante que a
 * segunda execução continue encontrando o conjunto sintético depois que o
 * banco local passar de 100 registros de algum tipo; com uma página só, o
 * seed deixaria de achar o que já criou e tentaria recriar.
 */
async function varrerPaginado<T>(
  ctx: Contexto,
  rota: string,
  sessao: Sessao,
  visitar: (item: T) => void,
): Promise<void> {
  const separador = rota.includes("?") ? "&" : "?";
  let vistos = 0;

  for (let pagina = 1; pagina <= LIMITE_PAGINAS; pagina += 1) {
    const resposta = await ler<Paginado<T>>(
      ctx,
      `${rota}${separador}pagina=${pagina}&tamanhoPagina=${TAMANHO_PAGINA}`,
      sessao,
    );

    for (const item of resposta.itens) {
      vistos += 1;
      visitar(item);
    }

    if (resposta.itens.length < TAMANHO_PAGINA) return;
    if (typeof resposta.total === "number" && vistos >= resposta.total) return;
  }

  throw new Error(
    `Listagem ${rota} passou de ${LIMITE_PAGINAS} páginas. O seed para em vez ` +
      "de varrer indefinidamente.",
  );
}

/** Primeiro item que casa, varrendo todas as páginas. */
async function procurarPaginado<T>(
  ctx: Contexto,
  rota: string,
  sessao: Sessao,
  combina: (item: T) => boolean,
): Promise<T | undefined> {
  let achado: T | undefined;
  await varrerPaginado<T>(ctx, rota, sessao, (item) => {
    if (achado === undefined && combina(item)) achado = item;
  });
  return achado;
}

/** Conta, varrendo todas as páginas, os itens que casam. */
async function contarPaginado<T>(
  ctx: Contexto,
  rota: string,
  sessao: Sessao,
  combina: (item: T) => boolean,
): Promise<number> {
  let total = 0;
  await varrerPaginado<T>(ctx, rota, sessao, (item) => {
    if (combina(item)) total += 1;
  });
  return total;
}

/**
 * `GET /v1/users` é keyset puro (sem `total`, sem busca por e-mail — ambos
 * deliberados no contrato T119/T120), então a varredura segue `nextCursor`.
 */
async function varrerUsuarios(
  ctx: Contexto,
  master: Sessao,
  visitar: (usuario: UsuarioApi) => void,
): Promise<void> {
  let cursor: string | null = null;

  for (let pagina = 1; pagina <= LIMITE_PAGINAS; pagina += 1) {
    const sufixo: string =
      cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`;
    const resposta: PaginadoPorCursor<UsuarioApi> = await ler<
      PaginadoPorCursor<UsuarioApi>
    >(ctx, `/v1/users?limit=${LIMITE_USUARIOS}${sufixo}`, master);

    for (const usuario of resposta.items) visitar(usuario);
    if (resposta.nextCursor === null) return;
    cursor = resposta.nextCursor;
  }

  throw new Error(
    `Listagem de contas passou de ${LIMITE_PAGINAS} páginas. O seed para em ` +
      "vez de varrer indefinidamente.",
  );
}

async function entrar(ctx: Contexto, email: string): Promise<Sessao> {
  const res = await pedir(ctx, "POST", "/v1/auth/login", undefined, {
    email,
    password: SENHA_DEMO,
  });
  if (!res.ok) {
    throw new Error(`Login do perfil ${email} respondeu ${res.status}.`);
  }
  const cookies = res.headers.getSetCookie?.() ?? [];
  const sessao = cookies.find((c) => c.startsWith("evolli_session="));
  if (!sessao) {
    throw new Error(`Login de ${email} não devolveu cookie de sessão.`);
  }
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  return { cookie: sessao.split(";")[0]!, csrfToken };
}

// ---------------------------------------------------------------------------
// Tipos mínimos das respostas usadas
// ---------------------------------------------------------------------------

interface ComId {
  id: string;
}
interface ComCodigo extends ComId {
  codigo: string;
}
interface Paginado<T> {
  itens: T[];
  total?: number;
}
interface PaginadoPorCursor<T> {
  items: T[];
  nextCursor: string | null;
}
interface ColaboradorApi extends ComId {
  nome: string;
}
interface VinculoApi extends ComId {
  matricula: string;
}
interface UsuarioApi extends ComId {
  email: string;
}
interface HorarioApi extends ComId {
  nome: string;
}
interface MovimentacaoApi extends ComId {
  tipo: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

/**
 * A conta `master_tecnico` não tem endpoint de criação. É gravada aqui, pelo
 * mesmo caminho que `bootstrap-admin.ts` usa para o `admin_tecnico`.
 */
async function garantirMaster(prisma: PrismaClient): Promise<void> {
  const email = PERFIS_DEMO[0]!.email;
  const existente = await prisma.accessUser.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existente) return;

  const passwordHash = await new PasswordHashService().hash(SENHA_DEMO);
  await prisma.accessUser.create({
    data: { email, passwordHash, role: "master_tecnico", status: "active" },
  });
}

async function garantirEmpresa(
  ctx: Contexto,
  master: Sessao,
  codigo: string,
  nome: string,
): Promise<ComCodigo> {
  return garantir<ComCodigo>(
    ctx,
    `empresa ${codigo}`,
    () =>
      procurarPaginado<ComCodigo>(
        ctx,
        "/v1/empresas",
        master,
        (e) => e.codigo === codigo,
      ),
    () => pedir(ctx, "POST", "/v1/empresas", master, { codigo, nome }),
  );
}

async function garantirUsuario(
  ctx: Contexto,
  master: Sessao,
  perfil: PerfilDemo,
  empresaId: string | null,
): Promise<void> {
  await garantir<UsuarioApi>(
    ctx,
    `conta ${perfil.email}`,
    async () => {
      let achado: UsuarioApi | undefined;
      await varrerUsuarios(ctx, master, (u) => {
        if (achado === undefined && u.email === perfil.email) achado = u;
      });
      return achado;
    },
    () =>
      pedir(ctx, "POST", "/v1/users", master, {
        email: perfil.email,
        password: SENHA_DEMO,
        role: perfil.papel,
        ...(empresaId ? { companyId: empresaId } : {}),
      }),
  );
}

async function garantirCatalogo(
  ctx: Contexto,
  rh: Sessao,
  rota: string,
  codigo: string,
  corpo: Record<string, unknown>,
): Promise<ComCodigo> {
  return garantir<ComCodigo>(
    ctx,
    `${rota} ${codigo}`,
    () =>
      procurarPaginado<ComCodigo>(ctx, rota, rh, (i) => i.codigo === codigo),
    () => pedir(ctx, "POST", rota, rh, corpo),
  );
}

async function garantirColaborador(
  ctx: Contexto,
  rh: Sessao,
  nome: string,
  corpo: Record<string, unknown>,
): Promise<ColaboradorApi> {
  return garantir<ColaboradorApi>(
    ctx,
    `colaborador ${nome}`,
    () =>
      procurarPaginado<ColaboradorApi>(
        ctx,
        "/v1/colaboradores",
        rh,
        (c) => c.nome === nome,
      ),
    () => pedir(ctx, "POST", "/v1/colaboradores", rh, corpo),
  );
}

/**
 * Efetiva a admissão de um vínculo, se ela ainda não estiver efetivada.
 *
 * Por que isto existe: admitir NÃO ativa ninguém. `POST /v1/colaboradores`
 * cria o colaborador `inativo`, o vínculo `previsto` e a movimentação de
 * admissão `solicitada` — a **alocação organizacional** (cargo e lotação
 * vigentes) só nasce em `POST /v1/movimentacoes/:id/efetivar`. Sem este passo,
 * o ambiente de demonstração exibia todo mundo inativo, com "Cargo vigente —",
 * "Lotação vigente —" e "Sem alocação registrada" em Dados contratuais: o
 * conjunto sintético não conseguia mostrar o estado que as telas existem para
 * mostrar.
 *
 * Idempotência pela ALOCAÇÃO, não pela movimentação: a alocação é o efeito que
 * se quer garantir, e conferi-la é o que torna a segunda execução inerte.
 * Efetivar de novo responderia 409 e derrubaria o seed.
 */
async function garantirAdmissaoEfetivada(
  ctx: Contexto,
  rh: Sessao,
  colaboradorId: string,
  matricula: string,
): Promise<void> {
  const vinculos = await ler<VinculoApi[]>(
    ctx,
    `/v1/colaboradores/${colaboradorId}/vinculos`,
    rh,
  );
  const vinculo = vinculos.find((v) => v.matricula === matricula);
  if (!vinculo) {
    throw new Error(
      `Vínculo ${matricula} não encontrado para efetivar a admissão.`,
    );
  }

  const alocacoes = await ler<ComId[]>(
    ctx,
    `/v1/vinculos/${vinculo.id}/alocacoes`,
    rh,
  );
  if (alocacoes.length > 0) {
    ctx.reaproveitados += 1;
    return;
  }

  const linha = await ler<MovimentacaoApi[]>(
    ctx,
    `/v1/vinculos/${vinculo.id}/linha-do-tempo`,
    rh,
  );
  const admissao = linha.find(
    (m) =>
      m.tipo === "admissao" &&
      (m.status === "solicitada" || m.status === "programada"),
  );
  if (!admissao) {
    throw new Error(
      `Movimentação de admissão pendente não encontrada para ${matricula}.`,
    );
  }

  const res = await pedir(
    ctx,
    "POST",
    `/v1/movimentacoes/${admissao.id}/efetivar`,
    rh,
  );
  if (!res.ok) {
    throw new Error(
      `Falha ao efetivar a admissão de ${matricula}: a API respondeu ${res.status}. ` +
        "O seed não continua com o ambiente pela metade.",
    );
  }
  ctx.criados += 1;
}

/**
 * Monta o escopo sintético do gestor consultivo (T151, ADR 0015).
 *
 * Por que isto existe: sem atribuição, `gestor.alfa` loga e vê lista vazia —
 * que é o comportamento CORRETO, e justamente por isso não demonstra nada. O
 * cenário mínimo precisa de alguém DENTRO da equipe e alguém FORA dela, para
 * que a diferença seja visível na tela em vez de precisar ser explicada.
 *
 * Idempotente pelo EFEITO, como `garantirAdmissaoEfetivada`: confere se a
 * ligação e a atribuição já existem antes de criar. A segunda execução não
 * duplica e não derruba o seed — o banco recusaria com 409 (EXCLUSION
 * CONSTRAINT), e um seed que quebra na segunda execução é pior que um seed que
 * não roda.
 *
 * Não toca `DEMO-A-0001`/`cargoId`: a dívida de convergência de atributos é
 * anterior e tem tarefa própria. Aqui ela não é corrigida nem agravada.
 */
async function garantirEscopoDeGestor(
  ctx: Contexto,
  rh: Sessao,
  master: Sessao,
  alvo: {
    gestorEmail: string;
    gestorMatricula: string;
    equipeId: string;
    matriculaNaEquipe: string;
  },
): Promise<void> {
  // 1. a conta do gestor
  let gestorUserId: string | null = null;
  await varrerUsuarios(ctx, master, (u) => {
    if (u.email === alvo.gestorEmail) gestorUserId = u.id;
  });
  if (!gestorUserId) {
    throw new Error(
      `Conta ${alvo.gestorEmail} não encontrada para montar o escopo do gestor.`,
    );
  }

  // 2. a PESSOA do gestor, alcançada pela matrícula — nunca pelo e-mail. A
  //    ADR 0015, decisão 6, proíbe inferir a pessoa por campo textual, e o
  //    seed segue a mesma regra que a aplicação.
  const colaboradorDoGestor = await colaboradorPorMatricula(
    ctx,
    rh,
    alvo.gestorMatricula,
  );
  if (!colaboradorDoGestor) {
    throw new Error(
      `Matrícula ${alvo.gestorMatricula} não encontrada para o gestor sintético.`,
    );
  }

  // 3. ligação conta ↔ colaborador (DP-23)
  const ligacoes = await ler<{ userId: string; vigenciaFim: string | null }[]>(
    ctx,
    "/v1/gestor/administracao/ligacoes",
    rh,
  );
  const jaLigado = ligacoes.some(
    (l) => l.userId === gestorUserId && l.vigenciaFim === null,
  );
  if (jaLigado) {
    ctx.reaproveitados += 1;
  } else {
    const res = await pedir(
      ctx,
      "POST",
      "/v1/gestor/administracao/ligacoes",
      rh,
      {
        userId: gestorUserId,
        colaboradorId: colaboradorDoGestor.colaboradorId,
        vigenciaInicio: "2026-01-05",
      },
    );
    if (!res.ok) {
      throw new Error(
        `Falha ao ligar a conta do gestor ao colaborador: a API respondeu ${res.status}.`,
      );
    }
    ctx.criados += 1;
  }

  // 4. atribuição da equipe
  const atribuicoes = await ler<
    { equipeId: string; papel: string; vigenciaFim: string | null }[]
  >(ctx, "/v1/gestor/administracao/atribuicoes", rh);
  const jaAtribuido = atribuicoes.some(
    (a) =>
      a.equipeId === alvo.equipeId &&
      a.papel === "principal" &&
      a.vigenciaFim === null,
  );
  if (jaAtribuido) {
    ctx.reaproveitados += 1;
    return;
  }

  const res = await pedir(
    ctx,
    "POST",
    "/v1/gestor/administracao/atribuicoes",
    rh,
    {
      equipeId: alvo.equipeId,
      gestorColaboradorId: colaboradorDoGestor.colaboradorId,
      papel: "principal",
      vigenciaInicio: "2026-01-05",
    },
  );
  if (!res.ok) {
    throw new Error(
      `Falha ao atribuir a equipe ao gestor: a API respondeu ${res.status}.`,
    );
  }
  ctx.criados += 1;
}

/** Resolve `colaboradorId` a partir de uma matrícula sintética. */
async function colaboradorPorMatricula(
  ctx: Contexto,
  rh: Sessao,
  matricula: string,
): Promise<{ colaboradorId: string; vinculoId: string } | null> {
  const colaboradores = await ler<{ itens: ColaboradorApi[] }>(
    ctx,
    "/v1/colaboradores?tamanhoPagina=100",
    rh,
  );
  for (const colaborador of colaboradores.itens ?? []) {
    const vinculos = await ler<VinculoApi[]>(
      ctx,
      `/v1/colaboradores/${colaborador.id}/vinculos`,
      rh,
    );
    const alvo = vinculos.find((v) => v.matricula === matricula);
    if (alvo) {
      return { colaboradorId: colaborador.id, vinculoId: alvo.id };
    }
  }
  return null;
}

/**
 * Popula um banco LOCAL com dados sintéticos e devolve o resumo.
 *
 * @param baseUrl origem da API já em execução (ex.: `http://127.0.0.1:3000`).
 * @param databaseUrl conexão usada só para a conta `master_tecnico`.
 */
export async function semearDemonstracao(
  baseUrl: string,
  databaseUrl: string,
): Promise<ResumoSeed> {
  const host = new URL(baseUrl).hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error(
      `O seed de demonstração só aceita API local; recebeu "${host}". ` +
        "Ele nunca deve apontar para homologação ou produção.",
    );
  }

  const ctx: Contexto = { baseUrl, criados: 0, reaproveitados: 0 };
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    await garantirMaster(prisma);
    const master = await entrar(ctx, PERFIS_DEMO[0]!.email);

    // --- Empresas ---------------------------------------------------------
    const alfa = await garantirEmpresa(
      ctx,
      master,
      "DEMOALFA",
      `Empresa ${MARCA_DEMO} Alfa (sintetica)`,
    );
    const beta = await garantirEmpresa(
      ctx,
      master,
      "DEMOBETA",
      `Empresa ${MARCA_DEMO} Beta (sintetica)`,
    );

    // --- Contas de acesso -------------------------------------------------
    for (const perfil of PERFIS_DEMO.slice(1)) {
      const empresaId = perfil.empresa === "beta" ? beta.id : alfa.id;
      await garantirUsuario(ctx, master, perfil, empresaId);
    }

    const rhAlfa = await entrar(ctx, `rh.alfa@${DOMINIO}`);
    const rhBeta = await entrar(ctx, `rh.beta@${DOMINIO}`);

    // --- Estrutura organizacional da Alfa ---------------------------------
    await garantirCatalogo(
      ctx,
      rhAlfa,
      "/v1/unidades-organizacionais",
      "MATRIZ",
      {
        empresaId: alfa.id,
        codigo: "MATRIZ",
        nome: `Matriz ${MARCA_DEMO}`,
      },
    );
    const operacoes = await garantirCatalogo(
      ctx,
      rhAlfa,
      "/v1/departamentos",
      "OPER",
      { empresaId: alfa.id, codigo: "OPER", nome: `Operacoes ${MARCA_DEMO}` },
    );
    await garantirCatalogo(ctx, rhAlfa, "/v1/departamentos", "ADM", {
      empresaId: alfa.id,
      codigo: "ADM",
      nome: `Administrativo ${MARCA_DEMO}`,
    });
    await garantirCatalogo(ctx, rhAlfa, "/v1/areas", "SUPORTE", {
      departamentoId: operacoes.id,
      codigo: "SUPORTE",
      nome: `Suporte ${MARCA_DEMO}`,
    });
    // A equipe pendura no DEPARTAMENTO (a área é irmã, não pai) e a empresa é
    // derivada dele — o cliente nunca informa `empresaId` aqui.
    const turnoA = await garantirCatalogo(
      ctx,
      rhAlfa,
      "/v1/equipes",
      "TURNOA",
      {
        departamentoId: operacoes.id,
        codigo: "TURNOA",
        nome: `Turno A ${MARCA_DEMO}`,
      },
    );
    const analista = await garantirCatalogo(
      ctx,
      rhAlfa,
      "/v1/cargos",
      "ANALISTA",
      {
        empresaId: alfa.id,
        codigo: "ANALISTA",
        nome: `Analista ${MARCA_DEMO}`,
      },
    );
    await garantirCatalogo(ctx, rhAlfa, "/v1/centros-de-custo", "CCDEMO", {
      empresaId: alfa.id,
      codigo: "CCDEMO",
      nome: `Centro de custo ${MARCA_DEMO}`,
    });

    // --- Tabela de horário ------------------------------------------------
    const nomeHorario = `Comercial 44h ${MARCA_DEMO}`;
    await garantir<HorarioApi>(
      ctx,
      `horario ${nomeHorario}`,
      () =>
        procurarPaginado<HorarioApi>(
          ctx,
          "/v1/horarios",
          rhAlfa,
          (h) => h.nome === nomeHorario,
        ),
      () =>
        pedir(ctx, "POST", "/v1/horarios", rhAlfa, {
          nome: nomeHorario,
          periodos: ["segunda", "terca", "quarta", "quinta", "sexta"].map(
            (dia) => ({ dia, inicio: "08:00", fim: "17:00" }),
          ),
        }),
    );

    // --- Colaboradores ----------------------------------------------------
    // Um com UM vínculo e outro com DOIS: é exatamente a diferença que as
    // telas tratam (resolve sozinho x exige escolha explícita).
    const umVinculo = `Pessoa ${MARCA_DEMO} Alfa Um`;
    const doisVinculos = `Pessoa ${MARCA_DEMO} Alfa Dois`;

    const colabUm = await garantirColaborador(ctx, rhAlfa, umVinculo, {
      nome: umVinculo,
      empresaId: alfa.id,
      matricula: "DEMO-A-0001",
      tipo: "clt",
      dataAdmissao: "2026-01-05",
      motivoCodigo: "admissao_inicial",
      cargoId: analista.id,
      departamentoId: operacoes.id,
    });

    const colabDois = await garantirColaborador(ctx, rhAlfa, doisVinculos, {
      nome: doisVinculos,
      empresaId: alfa.id,
      matricula: "DEMO-A-0002",
      tipo: "clt",
      dataAdmissao: "2026-01-05",
      motivoCodigo: "admissao_inicial",
      departamentoId: operacoes.id,
    });

    await garantir<VinculoApi>(
      ctx,
      "segundo vinculo DEMO-A-0003",
      async () => {
        const vinculos = await ler<VinculoApi[]>(
          ctx,
          `/v1/colaboradores/${colabDois.id}/vinculos`,
          rhAlfa,
        );
        return vinculos.find((v) => v.matricula === "DEMO-A-0003");
      },
      () =>
        pedir(ctx, "POST", "/v1/vinculos", rhAlfa, {
          colaboradorId: colabDois.id,
          empresaId: alfa.id,
          matricula: "DEMO-A-0003",
          tipo: "temporario",
          dataAdmissao: "2026-03-02",
          motivoCodigo: "admissao_inicial",
          departamentoId: operacoes.id,
        }),
    );

    // --- Efetivação das admissões -----------------------------------------
    // Sem este passo o conjunto sintético fica inteiro em `previsto`/`inativo`
    // e sem nenhuma alocação: Dados contratuais mostraria "Sem alocação
    // registrada" para todo mundo, e não haveria o que homologar.
    //
    // UM vínculo efetivado por (colaborador, empresa): o índice parcial
    // `vinculo_funcional_ativo_unico` recusa o segundo com 409. O
    // `DEMO-A-0003` fica deliberadamente em `previsto` — é ele que dá à
    // demonstração um exemplo de vínculo ainda não efetivado, ao lado de um
    // já ativo do mesmo colaborador.
    await garantirAdmissaoEfetivada(ctx, rhAlfa, colabUm.id, "DEMO-A-0001");
    await garantirAdmissaoEfetivada(ctx, rhAlfa, colabDois.id, "DEMO-A-0002");

    // --- Empresa Beta: mínimo para provar isolamento ----------------------
    const departamentoBeta = await garantirCatalogo(
      ctx,
      rhBeta,
      "/v1/departamentos",
      "BETAOP",
      {
        empresaId: beta.id,
        codigo: "BETAOP",
        nome: `Operacoes ${MARCA_DEMO} Beta`,
      },
    );
    const colabBeta = `Pessoa ${MARCA_DEMO} Beta Um`;
    const registroBeta = await garantirColaborador(ctx, rhBeta, colabBeta, {
      nome: colabBeta,
      empresaId: beta.id,
      matricula: "DEMO-B-0001",
      tipo: "clt",
      dataAdmissao: "2026-02-10",
      motivoCodigo: "admissao_inicial",
      departamentoId: departamentoBeta.id,
    });
    await garantirAdmissaoEfetivada(
      ctx,
      rhBeta,
      registroBeta.id,
      "DEMO-B-0001",
    );

    // --- Gestor consultivo (T151, ADR 0015) -------------------------------
    // Sem isto, `gestor.alfa` continua logando e vendo lista vazia — que e o
    // comportamento CORRETO de um gestor sem atribuicao, mas nao demonstra a
    // capacidade. O conjunto abaixo monta o cenario minimo que a prova exige:
    // alguem DENTRO da equipe, alguem FORA dela e uma segunda empresa como
    // contraprova de isolamento.
    await garantirEscopoDeGestor(ctx, rhAlfa, master, {
      gestorEmail: `gestor.alfa@${DOMINIO}`,
      gestorMatricula: "DEMO-A-0001",
      equipeId: turnoA.id,
      matriculaNaEquipe: "DEMO-A-0002",
    });

    // --- Resumo -----------------------------------------------------------
    // Conta só o conjunto SINTÉTICO, varrendo todas as páginas: o número não
    // pode mudar porque alguém criou registros próprios navegando na
    // demonstração.
    const empresas = await contarPaginado<ComCodigo>(
      ctx,
      "/v1/empresas",
      master,
      (e) => e.codigo.startsWith("DEMO"),
    );
    let usuarios = 0;
    await varrerUsuarios(ctx, master, (u) => {
      if (u.email.endsWith(DOMINIO)) usuarios += 1;
    });
    const colaboradores = await contarPaginado<ColaboradorApi>(
      ctx,
      "/v1/colaboradores",
      rhAlfa,
      (c) => c.nome.includes(MARCA_DEMO),
    );
    const vinculosDois = await ler<VinculoApi[]>(
      ctx,
      `/v1/colaboradores/${colabDois.id}/vinculos`,
      rhAlfa,
    );

    return {
      empresas,
      usuarios,
      colaboradores,
      vinculos: vinculosDois.length,
      criados: ctx.criados,
      reaproveitados: ctx.reaproveitados,
    };
  } finally {
    await prisma.$disconnect();
  }
}
