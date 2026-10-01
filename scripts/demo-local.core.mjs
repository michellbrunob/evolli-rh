/**
 * Núcleo do ambiente LOCAL de demonstração do Evolli RH (T141).
 *
 * Aqui mora a SEQUÊNCIA; em `demo-local.mjs` moram os efeitos reais (spawn,
 * rede, arquivos). Essa separação existe por um motivo prático: esta máquina
 * não tem Docker, então a única forma de provar a ordem dos passos, a parada
 * na primeira falha, a limpeza dos processos filhos, os timeouts e a ausência
 * de segredo em `argv` é injetar executores falsos — o que
 * `demo-local.core.test.mjs` faz, sem dependência nova.
 *
 * Garantias que este módulo impõe, não apenas documenta:
 *
 *  - **Só a própria máquina.** Banco, API e web precisam estar em
 *    `127.0.0.1`/`localhost`/`::1`, e toda URL verificada é `127.0.0.1`.
 *  - **Nenhum segredo em linha de comando.** Senha nunca vira argumento:
 *    `exigirArgumentosLiterais` recusa, em tempo de execução, qualquer
 *    argumento que não seja literal quando o shell está envolvido, e as
 *    credenciais dos papéis do banco viajam por **stdin** do `psql`.
 *  - **Nada de processo órfão.** Qualquer falha depois de subir API ou web
 *    encerra todos os filhos antes de propagar.
 *  - **"Pronto" só no fim.** O resumo só existe depois de banco, API e web
 *    responderem, nessa ordem, na verificação final.
 */

export const HOST_LOCAL = "127.0.0.1";
export const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "::1"]);
export const PORTA_API_PADRAO = 3000;
export const PORTA_WEB = 5173;
export const CONFIRMACAO_SEED = "confirmo-ambiente-local";
export const EMAIL_BOOTSTRAP = "admin.demo@evolli.local";
export const SENHA_DEMO = "Demonstracao-Local-Evolli-2026";

/**
 * Código de saída dedicado de `bootstrap-admin.ts` para "já existe um
 * administrador técnico". Reexecutar o bootstrap é esperado aqui, e este
 * contrato numérico substitui o casamento de texto em português.
 */
export const CODIGO_SAIDA_ADMIN_JA_EXISTE = 3;

/**
 * Destino deliberadamente inalcançável e sem credencial, idêntico ao que a CI
 * usa no passo de migration (ver `infra/postgres/README.md`). Serve para
 * satisfazer a validação do schema do Prisma sem colocar a credencial de
 * runtime no processo que executa DDL.
 */
/** Diretório do pacote da API, relativo à raiz do repositório. */
export const DIRETORIO_API = "apps/api";

/**
 * Orçamentos de espera, finitos e distintos. São PRAZOS DE PAREDE: o valor em
 * segundos é o tempo máximo real que o passo pode levar, já incluído o tempo
 * gasto dentro de cada tentativa e nos intervalos entre elas (T145).
 *
 * Antes da T145 estes números contavam ITERAÇÕES, não segundos. Como cada
 * iteração podia gastar até `MS_TIMEOUT_TENTATIVA_HTTP` na requisição mais
 * `MS_INTERVALO_TENTATIVA` no intervalo, "180s" chegava a 720s reais e a
 * mensagem de falha mentia sobre o prazo. Agora o laço olha o relógio.
 *
 * A API paga uma compilação do Nest a cada subida (`deleteOutDir: true`), e a
 * primeira do dia, com o cache de disco frio, é a mais cara — medida em 24s
 * de compilação nesta máquina, contra 6s com o cache morno. 180s cobre o pior
 * caso com folga e continua sendo um prazo, não uma espera indefinida; e a
 * morte do processo interrompe a espera antes disso.
 */
export const SEGUNDOS_ESPERA_API = 180;
/** O Vite sobe em segundos; 90s já é folga larga. */
export const SEGUNDOS_ESPERA_WEB = 90;
/**
 * Tolerância da confirmação FINAL (passo 8/8), não uma segunda espera longa:
 * o passo 7/8 já provou que a web responde. Cobre só a oscilação momentânea
 * de um Vite ainda terminando de compilar a primeira requisição a frio entre
 * o fim daquele passo e esta releitura.
 *
 * Por que 30s e não os 10 de antes: o número mudou de UNIDADE na T145, não de
 * intenção. Antes eram 10 TENTATIVAS, e a tolerância real que elas davam
 * chegava a 39s — o Vite frio aceita a conexão e a segura enquanto transforma
 * o módulo, então cada tentativa custava o timeout inteiro, não uma recusa
 * instantânea. Mantido em 10, o prazo de parede cortaria essa tolerância para
 * menos de um quarto e passaria a reprovar ambiente que antes subia. 30s
 * preserva a tolerância que a T144 de fato oferecia, agora dita em segundos
 * verdadeiros.
 */
export const SEGUNDOS_CONFIRMACAO_FINAL_WEB = 30;
/** Prazo do banco no passo 2/8, também de parede. */
export const SEGUNDOS_ESPERA_BANCO = 60;
/**
 * Prazo de CADA tentativa HTTP, não do orçamento inteiro. Sem isto, uma
 * conexão aceita por um servidor que nunca responde prende a tentativa
 * indefinidamente: o laço de espera nunca re-checa se o processo morreu nem
 * reavalia o relógio, e o diagnóstico "não respondeu em Ns" ficaria errado —
 * na verdade ficou preso numa tentativa só.
 *
 * O prazo efetivo de uma tentativa é o MENOR entre este valor e o que sobra do
 * orçamento global: perto do fim, a tentativa encurta em vez de estourar o
 * prazo declarado.
 */
export const MS_TIMEOUT_TENTATIVA_HTTP = 3000;
/** Intervalo entre tentativas, também descontado do orçamento global. */
export const MS_INTERVALO_TENTATIVA = 1000;

export const DESTINO_INALCANCAVEL =
  "postgresql://unused:unused@127.0.0.1:1/unused";

export const NOMES_PASSOS = [
  "1/8 Pré-requisitos",
  "2/8 PostgreSQL local (docker compose)",
  "3/8 Papéis, schema e extensões (infra/postgres)",
  "4/8 Migrations (prisma migrate deploy)",
  "5/8 API em 127.0.0.1",
  "6/8 Conta de bootstrap e seed sintético",
  "7/8 Web em 127.0.0.1:5173",
  "8/8 Verificação final",
];

const ARQUIVOS_INFRA = [
  "01_create_roles.sql",
  "02_schema_and_grants.sql",
  "04_extensions.sql",
];

/**
 * Um argumento de linha de comando só é aceito quando é literal e inofensivo.
 * Qualquer coisa fora disto (espaço, aspas, `&`, `^`, `%`, `|`, `$`) indica
 * ou um segredo ou um caminho — nenhum dos dois pode ir para `argv` quando há
 * shell no caminho.
 */
const ARGUMENTO_LITERAL = /^[A-Za-z0-9@._:/=+-]+$/;

/** Falha nomeada: sabe em que passo aconteceu e o que fazer em seguida. */
export class FalhaDePasso extends Error {
  constructor(passo, motivo, proximoPasso) {
    super(motivo);
    this.name = "FalhaDePasso";
    this.passo = passo;
    this.proximoPasso = proximoPasso;
  }
}

/** Substitui qualquer segredo conhecido antes de o texto virar log. */
export function censurar(texto, segredos) {
  let saida = String(texto ?? "");
  for (const segredo of segredos) {
    if (typeof segredo === "string" && segredo.length > 0) {
      saida = saida.split(segredo).join("***");
    }
  }
  return saida;
}

/** Literal de `\set` do psql: barra invertida e aspas simples escapadas. */
export function comoLiteralPsql(valor) {
  return `'${String(valor).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function hostDe(url) {
  return new URL(url).hostname.replace(/^\[|\]$/g, "");
}

function exigirHostLocal(passo, rotulo, valor) {
  let host;
  try {
    host = hostDe(valor);
  } catch {
    throw new FalhaDePasso(
      passo,
      `${rotulo} não é uma URL válida.`,
      `Corrija ${rotulo} e rode "pnpm demo:up" de novo.`,
    );
  }
  if (!HOSTS_LOCAIS.has(host)) {
    throw new FalhaDePasso(
      passo,
      `${rotulo} aponta para um host que não é local ("${host}").`,
      "A demonstração só roda contra a própria máquina. Aponte para " +
        "127.0.0.1 — nunca homologação ou produção.",
    );
  }
}

/** Trava de execução: nenhum argumento não literal quando há shell. */
export function exigirArgumentosLiterais(passo, comando, args, shell) {
  if (!shell) return;
  for (const arg of args) {
    if (!ARGUMENTO_LITERAL.test(arg)) {
      throw new FalhaDePasso(
        passo,
        `Argumento não literal em "${comando}" com shell habilitado. ` +
          "Credencial e caminho nunca vão para a linha de comando.",
        "Isto é defeito do orquestrador, não do ambiente: reporte.",
      );
    }
  }
}

/** Lê `CHAVE=valor` de um arquivo de ambiente, sem interpretar nada além. */
export function lerEnv(conteudo) {
  const mapa = {};
  if (typeof conteudo !== "string") return mapa;
  for (const linha of conteudo.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linha);
    if (m) mapa[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return mapa;
}

/** Senha do papel: do ambiente, ou da própria URL de conexão já exigida. */
export function senhaDoPapel(doAmbiente, url) {
  if (typeof doAmbiente === "string" && doAmbiente.length > 0) {
    return doAmbiente;
  }
  try {
    const bruta = new URL(url).password;
    return bruta ? decodeURIComponent(bruta) : "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------

/**
 * Sobe o ambiente local, na ordem, e devolve o resumo — só depois de banco,
 * API e web responderem.
 *
 * Todo efeito colateral chega por `deps`, para que o teste possa provar a
 * sequência sem Docker, sem rede e sem processo real.
 */
export async function subirAmbiente(deps) {
  const {
    raiz,
    plataforma,
    ambiente,
    lerArquivo,
    executar,
    iniciar,
    buscarHttp,
    portaLivre,
    dormir,
    registrar = () => {},
    // Relógio injetável: os prazos passaram a ser de parede (T145), então o
    // teste precisa controlar o tempo para provar o orçamento sem dormir de
    // verdade. O padrão é MONOTÔNICO de propósito — `Date.now()` pode andar
    // para trás num ajuste de NTP ou de horário, o que esticaria ou encurtaria
    // uma espera; `performance.now()` só avança.
    agora = () => performance.now(),
    tentativas = SEGUNDOS_ESPERA_BANCO,
    sha = null,
  } = deps;

  const usarShell = plataforma === "win32";
  const passosExecutados = [];
  const processos = [];
  const segredos = [];
  let passoAtual = NOMES_PASSOS[0];

  const passo = (nome) => {
    passoAtual = nome;
    passosExecutados.push(nome);
    registrar(`\n── ${nome}`);
  };

  const falhar = (motivo, proximoPasso) => {
    throw new FalhaDePasso(passoAtual, motivo, proximoPasso);
  };

  /** Encerra tudo o que este orquestrador iniciou. Nunca deixa órfão. */
  const encerrarProcessos = () => {
    for (const processo of processos.splice(0).reverse()) {
      try {
        processo.matar();
      } catch {
        // Encerramento é melhor-esforço: um filho que já morreu não é falha.
      }
    }
  };

  /** Roda um comando; falha nomeada, saída censurada. */
  const rodar = (comando, args, opcoes = {}) => {
    const shell = opcoes.shell ?? usarShell;
    exigirArgumentosLiterais(passoAtual, comando, args, shell);
    const resultado = executar({
      passo: passoAtual,
      comando,
      args,
      shell,
      ...(opcoes.cwd ? { cwd: opcoes.cwd } : {}),
      ...(opcoes.env ? { env: opcoes.env } : {}),
      ...(opcoes.entrada !== undefined ? { entrada: opcoes.entrada } : {}),
    });
    const status = resultado?.status ?? 1;
    const saida = censurar(resultado?.saida ?? "", segredos);
    return { status, saida };
  };

  const exigirSucesso = (comando, args, opcoes = {}) => {
    const { status, saida } = rodar(comando, args, opcoes);
    const aceitos = opcoes.statusAceitos ?? [0];
    if (!aceitos.includes(status)) {
      falhar(
        `${comando} terminou com código ${status}.` +
          (saida.trim() ? `\n${saida.trim()}` : ""),
        opcoes.proximoPasso ??
          "Leia a saída acima, corrija a causa e rode de novo.",
      );
    }
    // A saída de migration e seed é evidência que o dono precisa ver (quantos
    // registros foram criados e quantos reaproveitados), então vai para a tela
    // mesmo quando o passo dá certo — já censurada.
    if (opcoes.ecoar && saida.trim()) registrar(saida.trimEnd());
    return { status, saida };
  };

  /**
   * Toda verificação HTTP é local, por construção. `timeoutMs` é o prazo DESTA
   * tentativa — quem chama o encurta perto do fim do orçamento global, para
   * que uma única tentativa não estoure o prazo declarado do passo.
   */
  const verificarHttp = async (url, timeoutMs = MS_TIMEOUT_TENTATIVA_HTTP) => {
    if (!url.startsWith(`http://${HOST_LOCAL}:`)) {
      falhar(
        `Verificação HTTP fora de ${HOST_LOCAL} ("${url}").`,
        "Isto é defeito do orquestrador, não do ambiente: reporte.",
      );
    }
    const resposta = await buscarHttp(url, timeoutMs);
    return resposta !== null && resposta.ok === true;
  };

  /**
   * Espera algo ficar pronto dentro de um PRAZO DE PAREDE (T145).
   *
   * O orçamento é tempo real, não contagem de voltas: o relógio é lido a cada
   * passagem, e tanto a requisição quanto o intervalo saem do mesmo bolso. Daí
   * as três consequências que o laço antigo não tinha:
   *
   *  - a tentativa é encurtada quando sobra menos que `MS_TIMEOUT_TENTATIVA_HTTP`,
   *    em vez de estourar o prazo;
   *  - nenhuma tentativa NOVA começa com o orçamento zerado;
   *  - o intervalo nunca passa do que resta, então o laço termina exatamente
   *    no prazo anunciado — "dentro de 10s" quer dizer 10s, não 39s.
   *
   * Se o processo morrer no caminho — erro de configuração, porta tomada,
   * falha de compilação — não faz sentido continuar batendo na porta: a espera
   * termina na hora, dizendo que o processo encerrou, em vez de gastar o
   * orçamento inteiro para depois culpar um prazo que não foi a causa.
   *
   * Devolve `true` se ficou pronto e `false` se o prazo acabou. Quem chama
   * decide se isso vira falha (passos 5/8 e 7/8) ou uma linha do relatório
   * agregado (passo 8/8).
   */
  const aguardarComPrazo = async ({
    url,
    segundos,
    processo = null,
    aoMorrer,
  }) => {
    const prazoFinal = agora() + segundos * 1000;
    const restante = () => prazoFinal - agora();

    // Teto de voltas: rede de segurança para um relógio que NÃO anda — um
    // `agora` injetado que devolve sempre o mesmo valor, por exemplo. Quem
    // decide o fim é o prazo; isto só impede que um relógio parado vire espera
    // infinita. Em execução real nunca é alcançado: a tentativa mais barata
    // que existe (conexão recusada) ainda paga um intervalo inteiro.
    const teto = Math.ceil((segundos * 1000) / MS_INTERVALO_TENTATIVA) + 2;

    for (let volta = 1; volta <= teto; volta += 1) {
      const sobra = restante();
      // Orçamento esgotado: não inicia tentativa nova.
      if (sobra <= 0) return false;

      if (
        await verificarHttp(url, Math.min(MS_TIMEOUT_TENTATIVA_HTTP, sobra))
      ) {
        return true;
      }
      if (processo && typeof processo.vivo === "function" && !processo.vivo()) {
        aoMorrer();
      }

      const sobraParaDormir = restante();
      if (sobraParaDormir <= 0) return false;
      await dormir(Math.min(MS_INTERVALO_TENTATIVA, sobraParaDormir));
    }
    return false;
  };

  /** Espera um servidor responder; o prazo esgotado é falha do passo. */
  const esperar = async (rotulo, url, proximoPasso, opcoes = {}) => {
    const segundos = opcoes.segundos ?? tentativas;
    const pronto = await aguardarComPrazo({
      url,
      segundos,
      processo: opcoes.processo ?? null,
      aoMorrer: () =>
        falhar(
          `O processo de ${rotulo} encerrou antes de responder em ${url}.`,
          proximoPasso,
        ),
    });
    if (!pronto) {
      falhar(
        `${rotulo} não respondeu em ${url} dentro de ${segundos}s.`,
        proximoPasso,
      );
    }
  };

  /**
   * Confirmação FINAL da web (passo 8/8): prazo CURTO, não uma segunda espera
   * longa — o passo 7/8 já provou prontidão. Tolera só a oscilação momentânea
   * de um Vite ainda terminando a primeira compilação a frio. Devolve
   * `true`/`false` em vez de lançar, para compor o relatório agregado de
   * `banco`/`api`/`web`; processo morto, esse sim, falha na hora.
   */
  const confirmarProntoWeb = (rotulo, url, processo) =>
    aguardarComPrazo({
      url,
      segundos: SEGUNDOS_CONFIRMACAO_FINAL_WEB,
      processo,
      aoMorrer: () =>
        falhar(
          `O processo de ${rotulo} encerrou antes da confirmação final em ${url}.`,
          "O ambiente NÃO está pronto. Rode de novo depois de corrigir.",
        ),
    });

  try {
    // ---- 1/8 ---------------------------------------------------------------
    passo(NOMES_PASSOS[0]);

    if (rodar("docker", ["--version"]).status !== 0) {
      falhar(
        "Docker não está disponível no PATH.",
        "Instale o Docker Desktop e deixe-o em execução — o PostgreSQL " +
          "local vem do docker-compose.yml da raiz.",
      );
    }

    const envRaiz = lerEnv(lerArquivo(".env"));
    if (
      !envRaiz.POSTGRES_DB ||
      !envRaiz.POSTGRES_USER ||
      !envRaiz.POSTGRES_PASSWORD
    ) {
      falhar(
        "Falta o .env da raiz (POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD).",
        "Copie .env.example para .env (PowerShell: Copy-Item .env.example .env) e preencha com valores locais.",
      );
    }
    segredos.push(envRaiz.POSTGRES_PASSWORD);

    const envApi = lerEnv(lerArquivo("apps/api/.env"));
    const envMigrate = lerEnv(lerArquivo("apps/api/.env.migrate"));
    const databaseUrl = envApi.DATABASE_URL ?? ambiente.DATABASE_URL;
    const migrateUrl =
      envMigrate.MIGRATE_DATABASE_URL ?? ambiente.MIGRATE_DATABASE_URL;

    if (!databaseUrl || !migrateUrl) {
      falhar(
        "Faltam as conexões da API (DATABASE_URL e/ou MIGRATE_DATABASE_URL).",
        "Crie apps/api/.env (papel evolli_app) e apps/api/.env.migrate " +
          "(papel evolli_migrator) conforme infra/postgres/README.md.",
      );
    }
    exigirHostLocal(passoAtual, "DATABASE_URL", databaseUrl);
    exigirHostLocal(passoAtual, "MIGRATE_DATABASE_URL", migrateUrl);

    const senhaMigrator = senhaDoPapel(
      ambiente.EVOLLI_MIGRATOR_PASSWORD,
      migrateUrl,
    );
    const senhaApp = senhaDoPapel(ambiente.EVOLLI_APP_PASSWORD, databaseUrl);
    if (!senhaMigrator || !senhaApp) {
      falhar(
        "Não foi possível descobrir as senhas dos papéis evolli_migrator e " +
          "evolli_app.",
        "Inclua a senha nas próprias URLs de apps/api/.env e " +
          "apps/api/.env.migrate, ou defina EVOLLI_MIGRATOR_PASSWORD e " +
          "EVOLLI_APP_PASSWORD no ambiente do processo.",
      );
    }
    segredos.push(senhaMigrator, senhaApp);

    if (ambiente.HOST !== undefined && ambiente.HOST !== HOST_LOCAL) {
      falhar(
        `HOST está definido como "${ambiente.HOST}" no ambiente.`,
        `A demonstração só escuta em ${HOST_LOCAL}. Remova a variável HOST ` +
          "do shell e rode de novo.",
      );
    }

    const portaApi = Number(ambiente.PORT ?? PORTA_API_PADRAO);
    if (!Number.isInteger(portaApi) || portaApi < 1 || portaApi > 65535) {
      falhar(
        `PORT inválida ("${ambiente.PORT}").`,
        "Use um número de porta válido ou remova a variável PORT.",
      );
    }

    for (const [rotulo, porta] of [
      ["API", portaApi],
      ["web", PORTA_WEB],
    ]) {
      if (!(await portaLivre(HOST_LOCAL, porta))) {
        falhar(
          `A porta ${porta} (${rotulo}) já está ocupada em ${HOST_LOCAL}.`,
          "Provavelmente uma demonstração anterior continua de pé. Encerre-a " +
            "(Ctrl+C na janela dela) e rode de novo. A porta é fixa de " +
            "propósito: subir em outra porta calada esconderia qual ambiente " +
            "está aberto.",
        );
      }
    }

    // ---- 2/8 ---------------------------------------------------------------
    passo(NOMES_PASSOS[1]);
    // `docker` é executável nativo: roda sem shell, então nenhum argumento
    // passa por interpretação — é isto que torna seguro ter usuário e base
    // vindos de arquivo.
    exigirSucesso("docker", ["compose", "up", "-d"], {
      shell: false,
      proximoPasso:
        "Confirme que o Docker Desktop está em execução e rode de novo.",
    });

    const bancoDePe = async () =>
      rodar(
        "docker",
        [
          "compose",
          "exec",
          "-T",
          "postgres",
          "pg_isready",
          "-U",
          envRaiz.POSTGRES_USER,
          "-d",
          envRaiz.POSTGRES_DB,
        ],
        { shell: false },
      ).status === 0;

    // Mesmo prazo de parede dos demais passos (T145): o `pg_isready` roda num
    // subprocesso e também consome tempo, então contar voltas faria "60s"
    // significar bem mais do que 60s.
    const prazoBanco = agora() + tentativas * 1000;
    let pronto = false;
    while (!pronto && agora() < prazoBanco) {
      pronto = await bancoDePe();
      if (pronto) break;
      const sobra = prazoBanco - agora();
      if (sobra <= 0) break;
      await dormir(Math.min(MS_INTERVALO_TENTATIVA, sobra));
    }
    if (!pronto) {
      falhar(
        `PostgreSQL não ficou disponível em ${tentativas}s.`,
        'Veja "docker compose logs postgres" e rode de novo.',
      );
    }

    // ---- 3/8 ---------------------------------------------------------------
    passo(NOMES_PASSOS[2]);
    // As senhas dos papéis entram por STDIN do psql, nunca por argv: é o
    // único ponto do fluxo em que um segredo precisa atravessar processos.
    const preludio =
      `\\set migrator_password ${comoLiteralPsql(senhaMigrator)}\n` +
      `\\set app_password ${comoLiteralPsql(senhaApp)}\n`;

    for (const arquivo of ARQUIVOS_INFRA) {
      const sql = lerArquivo(`infra/postgres/${arquivo}`);
      if (typeof sql !== "string" || sql.length === 0) {
        falhar(
          `Não consegui ler infra/postgres/${arquivo}.`,
          "Rode o comando a partir da raiz do repositório.",
        );
      }
      exigirSucesso(
        "docker",
        [
          "compose",
          "exec",
          "-T",
          "postgres",
          "psql",
          "-U",
          envRaiz.POSTGRES_USER,
          "-d",
          envRaiz.POSTGRES_DB,
          "-v",
          "ON_ERROR_STOP=1",
          "-w",
          "-f",
          "-",
        ],
        {
          shell: false,
          entrada: (arquivo === ARQUIVOS_INFRA[0] ? preludio : "") + sql,
          proximoPasso:
            `Falhou aplicando ${arquivo}. Corrija o erro acima e rode de novo ` +
            "— os três scripts são idempotentes.",
        },
      );
    }

    // ---- 4/8 ---------------------------------------------------------------
    passo(NOMES_PASSOS[3]);
    // O outro lado da ADR 0002: o processo que executa DDL não pode receber a
    // credencial de RUNTIME. O Prisma 5 exige que `env("DATABASE_URL")`
    // resolva antes de migrar — se não a declarássemos aqui, ele a carregaria
    // sozinho de apps/api/.env e o `evolli_app` entraria no processo de
    // migration. Declaramos o mesmo destino inalcançável que a CI usa: se a
    // migration tentasse usá-lo, falharia na conexão; o sucesso do passo é,
    // portanto, evidência de que só a conexão do `evolli_migrator` foi aberta.
    exigirSucesso(
      "pnpm",
      ["--filter", "@evolli/api", "run", "db:migrate:deploy"],
      {
        ecoar: true,
        env: {
          ...ambiente,
          DATABASE_URL: DESTINO_INALCANCAVEL,
          MIGRATE_DATABASE_URL: migrateUrl,
        },
        proximoPasso:
          "A migration não foi aplicada. Corrija o erro acima e rode de novo.",
      },
    );

    // ---- 5/8 ---------------------------------------------------------------
    passo(NOMES_PASSOS[4]);
    // O processo da API nunca pode receber a credencial de DDL (ADR 0002) —
    // `validateEnv` recusa subir se ela estiver presente. Removemos aqui em
    // vez de confiar em o shell do dono não tê-la exportado.
    const ambienteApi = { ...ambiente };
    delete ambienteApi.MIGRATE_DATABASE_URL;
    const argsApi = ["--filter", "@evolli/api", "run", "dev"];
    exigirArgumentosLiterais(passoAtual, "pnpm", argsApi, usarShell);
    const processoApi = iniciar({
      nome: "API",
      comando: "pnpm",
      args: argsApi,
      shell: usarShell,
      env: {
        ...ambienteApi,
        DATABASE_URL: databaseUrl,
        PORT: String(portaApi),
        // A restrição de escuta é do SERVIDOR: `validateEnv` recusa qualquer
        // host que não seja 127.0.0.1 quando o modo de demonstração está on.
        EVOLLI_DEMO_MODE: "true",
        HOST: HOST_LOCAL,
      },
    });
    processos.push(processoApi);

    const urlApi = `http://${HOST_LOCAL}:${portaApi}`;
    await esperar(
      "A API",
      `${urlApi}/v1/health/ready`,
      "Veja o log da API acima. Causas comuns: senha do evolli_app diferente " +
        "da que está em apps/api/.env, ou migration não aplicada.",
      { processo: processoApi, segundos: SEGUNDOS_ESPERA_API },
    );

    // ---- 6/8 ---------------------------------------------------------------
    passo(NOMES_PASSOS[5]);
    const ambienteComandos = {
      ...ambienteApi,
      DATABASE_URL: databaseUrl,
    };

    // `pnpm --filter <pkg> exec` NORMALIZA qualquer falha do filho para 1
    // (ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL), o que apagaria o código dedicado
    // do bootstrap e faria toda reexecução do ambiente abortar aqui. Rodando
    // DENTRO do pacote, sem a camada recursiva, o código real chega intacto —
    // provado por subprocesso real em `demo-local.core.test.mjs`.
    exigirSucesso(
      "pnpm",
      ["exec", "ts-node", "-T", "src/bootstrap/bootstrap-admin.ts"],
      {
        cwd: DIRETORIO_API,
        // 0 = criado agora; 3 = já existe, que é o caso de toda reexecução.
        // Qualquer outro código interrompe o orquestrador.
        statusAceitos: [0, CODIGO_SAIDA_ADMIN_JA_EXISTE],
        env: {
          ...ambienteComandos,
          ADMIN_BOOTSTRAP_EMAIL: EMAIL_BOOTSTRAP,
          ADMIN_BOOTSTRAP_PASSWORD: SENHA_DEMO,
        },
        proximoPasso:
          "O bootstrap do administrador técnico falhou. Corrija o erro acima " +
          "e rode de novo.",
      },
    );

    exigirSucesso(
      "pnpm",
      ["exec", "ts-node", "-T", "src/seed/demo-seed.cli.ts"],
      {
        cwd: DIRETORIO_API,
        ecoar: true,
        env: {
          ...ambienteComandos,
          EVOLLI_DEMO_SEED: CONFIRMACAO_SEED,
          EVOLLI_DEMO_API_URL: urlApi,
        },
        proximoPasso:
          "O seed parou no meio. Ele é idempotente: corrija a causa acima e " +
          "rode de novo — o que já existe é reaproveitado.",
      },
    );

    // ---- 7/8 ---------------------------------------------------------------
    passo(NOMES_PASSOS[6]);
    const argsWeb = [
      "--filter",
      "@evolli/web",
      "exec",
      "vite",
      "--host",
      HOST_LOCAL,
      "--port",
      String(PORTA_WEB),
      // Sem isto o Vite subiria calado em 5174 e o endereço impresso deixaria
      // de corresponder ao que está no ar.
      "--strictPort",
    ];
    exigirArgumentosLiterais(passoAtual, "pnpm", argsWeb, usarShell);
    const processoWeb = iniciar({
      nome: "Web",
      comando: "pnpm",
      args: argsWeb,
      shell: usarShell,
      env: {
        ...ambienteApi,
        VITE_API_PROXY_TARGET: urlApi,
      },
    });
    processos.push(processoWeb);

    const urlWeb = `http://${HOST_LOCAL}:${PORTA_WEB}`;
    await esperar(
      "A interface web",
      `${urlWeb}/`,
      `A porta ${PORTA_WEB} é obrigatória e estrita. Encerre o que estiver ` +
        "usando essa porta e rode de novo.",
      { processo: processoWeb, segundos: SEGUNDOS_ESPERA_WEB },
    );

    // ---- 8/8 ---------------------------------------------------------------
    passo(NOMES_PASSOS[7]);
    const verificacoes = {
      banco: await bancoDePe(),
      api: await verificarHttp(`${urlApi}/v1/health/ready`),
      web: await confirmarProntoWeb(
        "A interface web",
        `${urlWeb}/`,
        processoWeb,
      ),
    };
    const falhas = Object.entries(verificacoes)
      .filter(([, ok]) => !ok)
      .map(([nome]) => nome);
    if (falhas.length > 0) {
      falhar(
        `Na verificação final não respondeu: ${falhas.join(", ")}.`,
        "O ambiente NÃO está pronto. Rode de novo depois de corrigir.",
      );
    }

    return {
      passos: passosExecutados,
      verificacoes,
      processos,
      encerrarProcessos,
      urlApi,
      urlWeb,
      resumo: [
        "",
        "  AMBIENTE LOCAL DE DEMONSTRAÇÃO — dados exclusivamente sintéticos.",
        "  Desenvolvimento. Não é homologação, não é produção, proibido dado real.",
        "",
        `  Web ......... ${urlWeb}`,
        `  API ......... ${urlApi}   (escuta só em ${HOST_LOCAL})`,
        `  SHA ......... ${sha ?? "(desconhecido)"}`,
        "",
        "  Perfis e senha: docs/AMBIENTE-DEMONSTRACAO-LOCAL.md",
        "  O que já dá para navegar: docs/GUIA-VISUAL-FUNCIONALIDADES.md",
        "",
        "  Ctrl+C encerra API e web. O banco continua de pé.",
        "",
      ],
      raiz,
    };
  } catch (erro) {
    // Qualquer falha depois de subir API ou web encerra os filhos antes de
    // propagar: o comando nunca deixa servidor rodando por trás de um erro.
    encerrarProcessos();
    throw erro;
  }
}
