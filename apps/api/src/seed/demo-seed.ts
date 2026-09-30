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
 * que achar. Nada é apagado — `solicitacao_pessoa` e `audit_event` têm `DELETE`
 * revogado no banco, e um seed que apagasse para recriar não teria como rodar
 * duas vezes. Rodar de novo converge para o mesmo conjunto.
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
    async () => {
      const lista = await ler<Paginado<ComCodigo>>(
        ctx,
        "/v1/empresas?tamanhoPagina=100",
        master,
      );
      return lista.itens.find((e) => e.codigo === codigo);
    },
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
      const lista = await ler<{ items: UsuarioApi[] }>(
        ctx,
        "/v1/users?limit=100",
        master,
      );
      return lista.items.find((u) => u.email === perfil.email);
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
    async () => {
      const lista = await ler<Paginado<ComCodigo>>(
        ctx,
        `${rota}?tamanhoPagina=100`,
        rh,
      );
      return lista.itens.find((i) => i.codigo === codigo);
    },
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
    async () => {
      const lista = await ler<Paginado<ColaboradorApi>>(
        ctx,
        "/v1/colaboradores?tamanhoPagina=100",
        rh,
      );
      return lista.itens.find((c) => c.nome === nome);
    },
    () => pedir(ctx, "POST", "/v1/colaboradores", rh, corpo),
  );
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
    await garantirCatalogo(ctx, rhAlfa, "/v1/equipes", "TURNOA", {
      departamentoId: operacoes.id,
      codigo: "TURNOA",
      nome: `Turno A ${MARCA_DEMO}`,
    });
    await garantirCatalogo(ctx, rhAlfa, "/v1/cargos", "ANALISTA", {
      empresaId: alfa.id,
      codigo: "ANALISTA",
      nome: `Analista ${MARCA_DEMO}`,
    });
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
      async () => {
        const lista = await ler<Paginado<HorarioApi>>(
          ctx,
          "/v1/horarios?tamanhoPagina=100",
          rhAlfa,
        );
        return lista.itens.find((h) => h.nome === nomeHorario);
      },
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

    await garantirColaborador(ctx, rhAlfa, umVinculo, {
      nome: umVinculo,
      empresaId: alfa.id,
      matricula: "DEMO-A-0001",
      tipo: "clt",
      dataAdmissao: "2026-01-05",
      motivoCodigo: "admissao_inicial",
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
    await garantirColaborador(ctx, rhBeta, colabBeta, {
      nome: colabBeta,
      empresaId: beta.id,
      matricula: "DEMO-B-0001",
      tipo: "clt",
      dataAdmissao: "2026-02-10",
      motivoCodigo: "admissao_inicial",
      departamentoId: departamentoBeta.id,
    });

    // --- Resumo -----------------------------------------------------------
    const empresas = await ler<Paginado<ComCodigo>>(
      ctx,
      "/v1/empresas?tamanhoPagina=100",
      master,
    );
    const usuarios = await ler<{ items: UsuarioApi[] }>(
      ctx,
      "/v1/users?limit=100",
      master,
    );
    const colaboradores = await ler<Paginado<ColaboradorApi>>(
      ctx,
      "/v1/colaboradores?tamanhoPagina=100",
      rhAlfa,
    );
    const vinculosDois = await ler<VinculoApi[]>(
      ctx,
      `/v1/colaboradores/${colabDois.id}/vinculos`,
      rhAlfa,
    );

    return {
      empresas: empresas.itens.filter((e) => e.codigo.startsWith("DEMO"))
        .length,
      usuarios: usuarios.items.filter((u) => u.email.endsWith(DOMINIO)).length,
      colaboradores: colaboradores.itens.length,
      vinculos: vinculosDois.length,
      criados: ctx.criados,
      reaproveitados: ctx.reaproveitados,
    };
  } finally {
    await prisma.$disconnect();
  }
}
