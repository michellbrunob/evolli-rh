/**
 * Núcleo puro do verificador de sincronia do Spec Kit (T149).
 *
 * Por que este arquivo existe: até a T148 o verificador vivia inteiro em
 * `check-spec-kit-sync.mjs`, como script de efeito colateral (lia `process.env`,
 * chamava `process.exit`, resolvia caminhos relativos). Não havia como testá-lo,
 * e a regra que ele aplicava derrubou a CI de `main` quatro vezes seguidas
 * — T065/T066 na T139, T066 na T140, T032 na T142, T040/T041 na T148 — sempre
 * sem nenhum defeito de código. Aqui a decisão fica pura e testável; o CLI
 * continua em `check-spec-kit-sync.mjs` e só injeta leitura de arquivo e saída.
 *
 * ---------------------------------------------------------------------------
 * A REGRA ANTERIOR E POR QUE ELA PRODUZIA FALSO POSITIVO
 *
 * A regra antiga extraía todo `T###` da mensagem de mudança e exigia que CADA
 * um aparecesse literalmente em `tasks.md` E em `execution-status.md`. Dois
 * defeitos estruturais se somavam:
 *
 *   1. ESCOPO. Em Pull Request o contexto é só o título; no push para `main` é
 *      a mensagem inteira do squash, que concatena os commits da branch. Toda
 *      prosa explicativa ("o parser (T040/T041) existe e é sólido") virava
 *      exigência de registro. Citar uma tarefa antiga não é entregá-la.
 *
 *   2. BUSCA. A extração usava fronteira de palavra (`\b`), mas a verificação
 *      usava `String.includes`, que é substring. Numa faixa `T104–T109` a
 *      string `T104` existe e passa, `T105` não existe e reprova: os extremos
 *      de uma faixa passavam por acidente e o miolo nunca passava. Com o ledger
 *      atual, 118 dos 149 identificadores reprovariam se fossem citados.
 *
 * ---------------------------------------------------------------------------
 * A REGRA DESTA TAREFA
 *
 * A pergunta "quais tarefas esta mudança entrega?" não é respondida por texto
 * livre — é respondida pelo próprio Spec Kit, em `.specify/sync-state.json`.
 * O contexto da mudança deixa de ser a fonte da verdade sobre a entrega e passa
 * a cumprir o único papel em que é confiável: denunciar trabalho ainda não
 * registrado.
 *
 *   a) TAREFAS ENTREGUES = a janela `(lastIntegratedTask, lastRecordedTask]`,
 *      declarada estruturalmente. Todas devem constar dos dois artefatos. Isso
 *      suporta mais de uma entrega aberta e não presume que a de maior número
 *      seja a corrente — a janela é lida, não inferida.
 *
 *   b) IDENTIFICADORES CITADOS no contexto são fiscalizados por uma única
 *      pergunta: são FUTUROS (`> lastRecordedTask`)? Se sim, há trabalho citado
 *      e não registrado — reprova. Se não, são referência histórica legítima:
 *      aquela tarefa já teve o próprio registro fiscalizado quando era a
 *      corrente, e cobrá-lo de novo não acrescenta garantia nenhuma.
 *
 *   c) COBERTURA passa a expandir faixas (`T104–T109`, `T001 a T049`) e a casar
 *      por fronteira de palavra. É mais estrito que `includes`, não menos: o
 *      extremo de uma faixa deixa de passar por acidente de substring e passa
 *      por cobertura declarada.
 *
 *   d) CONTEXTO AUSENTE é fail-closed. A variável de ambiente pode chegar como
 *      string vazia (em `workflow_dispatch` os dois lados do `||` do workflow
 *      são nulos e o GitHub injeta ""), e `??` não cai no fallback diante de "".
 *      O gate virava no-op silencioso. Vazio agora cai no fallback; sem nenhuma
 *      fonte, é erro explícito.
 *
 * O que NÃO muda: a tarefa efetivamente entregue continua obrigatória nos dois
 * artefatos, e citar tarefa futura continua reprovando. Nenhuma lista de
 * exceções, nenhum identificador tratado como caso especial.
 *
 * ---------------------------------------------------------------------------
 * A CORREÇÃO DA T152: ONDE MORA A DECLARAÇÃO DE ENTREGA
 *
 * A T149 resolveu metade do problema de escopo. Ela parou de cobrar registro de
 * referência HISTÓRICA citada em prosa, mas manteve a cobrança sobre referência
 * FUTURA em qualquer posição do texto. O squash da T151 (`a356418`) caiu
 * exatamente aí: o assunto entrega T151, e o corpo — 348 linhas — menciona a
 * T152 para dizer que ela **não foi iniciada**. Dizer "isto fica para a T152"
 * virava "estou entregando a T152".
 *
 * O defeito é verificável e não depende de interpretação: o workflow injeta
 * `github.event.pull_request.title || github.event.head_commit.message`. No
 * Pull Request isso é UMA linha; no push para `main` é a mensagem INTEIRA. E o
 * fallback local deste mesmo verificador usa `git log -1 --pretty=%s`, que é só
 * o assunto. O mesmo commit, com o mesmo conteúdo, recebia TRÊS vereditos:
 * passava no PR, passava local e reprovava no push. Um portão que muda de
 * resposta conforme o evento não é mais rigoroso — é não determinístico.
 *
 * A regra agora distingue DECLARAÇÃO de CITAÇÃO:
 *
 *   DECLARAÇÃO = a primeira linha não vazia que nomeia alguma tarefa.
 *   CITAÇÃO    = tudo o que vier depois dela.
 *
 * Só a declaração responde "o que esta mudança entrega". O resto é prosa.
 *
 * POR QUE A PRIMEIRA LINHA *COM IDENTIFICADOR*, e não simplesmente a primeira
 * linha: em seis integrações reais deste repositório (`#121` a `#127`) o GitHub
 * gravou `@` como assunto e empurrou o assunto verdadeiro para a primeira linha
 * do corpo — `feat(web): Pessoas > Documentos funcional (T133)`. Uma regra
 * "só o assunto" ficaria cega justamente nesses seis. Procurar a primeira linha
 * que nomeia tarefa cobre os dois formatos sem tratar nenhum como exceção.
 *
 * A regra foi conferida contra as 40 integrações em `main`: em todas elas a
 * declaração extraída é exatamente a tarefa entregue, incluindo as seis de
 * assunto `@`. Nenhuma detecção foi perdida; o que sumiu foi o ruído — o squash
 * da T149 citava onze identificadores em prosa, e todos eram exigência.
 *
 * LIMITE CONHECIDO, declarado e não escondido: uma mudança cuja linha de
 * declaração anuncia T151 enquanto o corpo entrega T152 em silêncio deixa de
 * ser detectada por esta regra. Isso exige violar a convenção de propósito, e
 * continua barrado do outro lado: entregar T152 obriga registrá-la em
 * `tasks.md`, em `execution-status.md` e a mover `lastRecordedTask`, e a regra
 * (a) — que não lê texto nenhum — fiscaliza essa janela. Trocar um falso
 * positivo garantido em toda integração por um falso negativo que depende de
 * má-fé deliberada é o balanço que esta tarefa escolhe, explicitamente.
 */

/** Faixas: `T104–T109`, `T104—T109`, `T104-T109` e a forma textual `T001 a T049`. */
const FAIXA = /\bT(\d{3})\s*(?:[–—-]|\s+a\s+)\s*T(\d{3})\b/g;

/** Identificador isolado, com fronteira de palavra nas duas pontas. */
const IDENTIFICADOR = /\bT(\d{3})\b/g;

/** Maior distância aceita numa faixa; acima disso é ruído, não registro. */
const FAIXA_MAXIMA = 200;

/** Formata um número de tarefa no identificador canônico (`7` → `T007`). */
export function identificadorDe(numero) {
  return `T${String(numero).padStart(3, "0")}`;
}

/** Campos de `sync-state.json` sem os quais não há o que fiscalizar. */
const CAMPOS_DE_JANELA = ["lastIntegratedTask", "lastRecordedTask"];

/**
 * Descreve um valor recusado sem ecoar o conteúdo.
 *
 * A mensagem de erro vai para o log público da CI: ela nomeia o campo e o tipo,
 * nunca o conteúdo de uma string nem um stack.
 */
function descreverValor(valor) {
  if (valor === null) return "null";
  if (valor === undefined) return "ausente";
  if (Array.isArray(valor)) return "lista";
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return "número não finito";
    return Number.isInteger(valor) ? String(valor) : "número decimal";
  }
  return typeof valor;
}

/**
 * Valida o estado de `sync-state.json` antes de qualquer decisão.
 *
 * Por que isto existe: a primeira versão da T149 derivava a janela de entrega
 * de `lastIntegratedTask`/`lastRecordedTask` sem conferir nada. Com o campo
 * ausente, `NaN`, decimal ou string não numérica, `tarefasEntregues` devolvia
 * uma lista vazia e `numero > NaN` era sempre falso: **os dois braços do gate
 * desligavam em silêncio** e o verificador aprovava até com os dois artefatos
 * vazios. A regra anterior à T149 falhava fechado por acidente, ao procurar o
 * literal `"Tundefined"`. Esta função transforma esse acidente em garantia.
 *
 * É a validação ÚNICA: `avaliarSincronia` a chama antes de calcular a janela e
 * o CLI a chama antes de ler artefato, para que não existam duas noções de
 * estado válido que possam divergir.
 */
export function validarEstado(state) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    return [
      `sync-state.json não contém um objeto de estado (veio ${descreverValor(state)}).`,
    ];
  }

  const falhas = [];
  for (const campo of CAMPOS_DE_JANELA) {
    const valor = state[campo];
    if (!(campo in state) || valor === undefined) {
      falhas.push(`${campo} ausente em sync-state.json.`);
      continue;
    }
    if (typeof valor !== "number" || !Number.isSafeInteger(valor)) {
      falhas.push(
        `${campo} deve ser um inteiro seguro em sync-state.json (veio ${descreverValor(valor)}).`,
      );
      continue;
    }
    if (valor < 0) {
      falhas.push(
        `${campo} não pode ser negativo em sync-state.json (veio ${valor}).`,
      );
    }
  }

  // A coerência entre os dois só faz sentido se ambos forem válidos.
  if (falhas.length > 0) return falhas;

  if (state.lastIntegratedTask > state.lastRecordedTask) {
    falhas.push(
      `lastIntegratedTask (${state.lastIntegratedTask}) não pode ser maior que lastRecordedTask (${state.lastRecordedTask}).`,
    );
  }
  return falhas;
}

/**
 * Conjunto de tarefas que um artefato cobre, expandindo faixas.
 *
 * `"| T104–T109 | Integrada |"` cobre T104, T105, T106, T107, T108 e T109 —
 * o ledger registra marcos comprimidos e isso é registro legítimo, não lacuna.
 */
export function coberturaDeTarefas(texto) {
  const cobertas = new Set();
  if (typeof texto !== "string") return cobertas;

  const semFaixas = texto.replace(FAIXA, (trecho, inicio, fim) => {
    const de = Number(inicio);
    const ate = Number(fim);
    if (ate < de || ate - de > FAIXA_MAXIMA) return trecho;
    for (let n = de; n <= ate; n += 1) cobertas.add(identificadorDe(n));
    return " ";
  });

  for (const achado of semFaixas.matchAll(IDENTIFICADOR)) {
    cobertas.add(achado[0]);
  }
  return cobertas;
}

/** Identificadores citados num texto livre, em ordem de aparição e sem repetir. */
export function identificadoresCitados(texto) {
  if (typeof texto !== "string") return [];
  const vistos = new Set();
  const citados = [];
  for (const achado of texto.matchAll(IDENTIFICADOR)) {
    if (vistos.has(achado[0])) continue;
    vistos.add(achado[0]);
    citados.push({ id: achado[0], numero: Number(achado[1]) });
  }
  return citados;
}

/**
 * Resolve o contexto da mudança, tratando vazio como ausência.
 *
 * `lerSubject` é injetado para manter esta função pura; o CLI passa o `git log`.
 */
export function resolverContexto({ variavelDeAmbiente, lerSubject }) {
  const daEsteira =
    typeof variavelDeAmbiente === "string" ? variavelDeAmbiente.trim() : "";
  if (daEsteira) return { contexto: daEsteira, origem: "esteira" };

  let subject = "";
  try {
    subject = (lerSubject?.() ?? "").trim();
  } catch {
    subject = "";
  }
  if (subject) return { contexto: subject, origem: "git" };

  return { contexto: null, origem: "ausente" };
}

/**
 * A linha que DECLARA a entrega: a primeira não vazia que nomeia uma tarefa.
 *
 * Devolve `null` quando nenhuma linha nomeia tarefa — o que não libera nada: a
 * regra (a) continua fiscalizando a janela declarada em `sync-state.json`, que
 * não depende de texto.
 *
 * Trabalha sobre linhas, nunca sobre o texto inteiro, porque é a quebra de
 * linha que separa o assunto da prosa nos três fluxos reais do projeto (título
 * de PR, mensagem de squash e push direto).
 */
export function declaracaoDeEntrega(contexto) {
  if (typeof contexto !== "string") return null;
  for (const linha of contexto.split(/\r?\n/)) {
    const texto = linha.trim();
    // `identificadoresCitados` em vez de `IDENTIFICADOR.test`: o regexp é
    // global e `.test` guarda `lastIndex` entre chamadas, o que faria a
    // varredura pular linhas de forma dependente da ordem.
    if (texto && identificadoresCitados(texto).length > 0) return texto;
  }
  return null;
}

/**
 * Tarefas que a mudança entrega, segundo o Spec Kit — não segundo o texto.
 *
 * Janela `(lastIntegratedTask, lastRecordedTask]`. Quando nada está aberto
 * (integrada == registrada), a própria última registrada continua fiscalizada,
 * para que convergir não desligue a verificação.
 */
export function tarefasEntregues(state) {
  const registrada = Number(state?.lastRecordedTask);
  const integrada = Number(state?.lastIntegratedTask);
  if (!Number.isInteger(registrada)) return [];

  const inicio = Number.isInteger(integrada)
    ? Math.min(integrada + 1, registrada)
    : registrada;

  const entregues = [];
  for (let n = Math.max(inicio, 1); n <= registrada; n += 1) {
    entregues.push(identificadorDe(n));
  }
  return entregues;
}

/**
 * Avalia a sincronia entre o estado declarado, os artefatos e o contexto.
 *
 * Devolve a lista de falhas (vazia = sincronizado). Não lança, não imprime,
 * não encerra o processo: quem decide isso é o CLI.
 */
export function avaliarSincronia({ state, tasks, ledger, contexto }) {
  // Estado inválido encerra aqui: sem janela confiável, nada mais pode ser
  // concluído, e prosseguir produziria uma lista vazia de tarefas entregues
  // — o fail-open que esta validação existe para impedir.
  const falhasDeEstado = validarEstado(state);
  if (falhasDeEstado.length > 0) return falhasDeEstado;

  const falhas = [];
  const emTasks = coberturaDeTarefas(tasks);
  const noLedger = coberturaDeTarefas(ledger);

  // (a) As tarefas efetivamente entregues precisam estar registradas nos dois
  //     artefatos. É aqui que o gate morde — e ele não depende do texto livre.
  for (const id of tarefasEntregues(state)) {
    const faltas = [];
    if (!emTasks.has(id)) faltas.push("tasks.md");
    if (!noLedger.has(id)) faltas.push("execution-status.md");
    if (faltas.length > 0) {
      falhas.push(
        `${id} é tarefa entregue (janela lastIntegratedTask=${state?.lastIntegratedTask} → lastRecordedTask=${state?.lastRecordedTask}), mas não está registrada em ${faltas.join(" nem em ")}.`,
      );
    }
  }

  // (d) Sem contexto não há como detectar trabalho não registrado: fail-closed.
  if (contexto === null || contexto === undefined) {
    falhas.push(
      "Contexto da mudança ausente: defina SPEC_KIT_CHANGE_CONTEXT ou execute dentro de um repositório com commits.",
    );
    return falhas;
  }

  // (b) Só a DECLARAÇÃO é lida — a primeira linha que nomeia tarefa. Dentro
  //     dela, interessa o que é futuro: entrega anunciada e não registrada.
  //     Referência histórica e menção a trabalho futuro feitas na prosa que
  //     vem depois são narrativa legítima, e não são entrega.
  const declaracao = declaracaoDeEntrega(contexto);
  for (const { id, numero } of identificadoresCitados(declaracao ?? "")) {
    if (numero > Number(state?.lastRecordedTask)) {
      falhas.push(
        `${id} é declarado como entrega desta mudança, mas lastRecordedTask=${state?.lastRecordedTask}: registre a tarefa no Spec Kit antes de entregá-la.`,
      );
    }
  }

  return falhas;
}
