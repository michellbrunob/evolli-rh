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
 * ---------------------------------------------------------------------------
 * POR QUE A POSIÇÃO NÃO BASTOU, E O QUE A SUBSTITUIU (correção de B1)
 *
 * A revisão adversarial da PR #143 derrubou a regra por posição com um caso
 * que não exige má-fé nenhuma:
 *
 *     Retoma o critério da T151 e ajusta o verificador   <- 1ª linha, histórico
 *
 *     Esta mudança entrega a T153.                       <- entrega real
 *
 * Com o ledger em T152, a T153 passava sem registro. O assunto citar a tarefa
 * anterior é padrão neste repositório (`T145 — Hardening pós-T141`,
 * `T148 — Convergência da T147`), então o bypass estava a um commit de
 * distância. Posição é determinística, mas não é declaração: "fica para a
 * T153" e "entrega a T153" ocupam a mesma posição e têm sentidos opostos.
 *
 * Nenhuma heurística de texto separa os dois. O que separa é o AUTOR dizer,
 * de forma estruturada e auditável, o que está entregando:
 *
 *     Spec-Kit-Entrega: T152
 *     Spec-Kit-Nao-Entrega: T153
 *
 * REGRA, quando o protocolo é obrigatório:
 *
 *   1. há exatamente um trailer `Spec-Kit-Entrega`, com ao menos um `T###`;
 *   2. toda tarefa declarada como entrega existe em `tasks.md` E em
 *      `execution-status.md`, e não está acima de `lastRecordedTask`;
 *   3. TODO identificador acima de `lastRecordedTask` encontrado em QUALQUER
 *      posição do contexto está classificado — em entrega ou em não-entrega.
 *      Citar sem classificar reprova;
 *   4. nenhum identificador aparece nos dois trailers ao mesmo tempo;
 *   5. trailer ausente, duplicado, malformado ou contraditório reprova.
 *
 * O corpo volta a ser varrido por inteiro (item 3): o bypass some porque a
 * menção não é mais julgada pelo lugar onde aparece, e sim pela classificação
 * que o autor deu a ela. Esquecer de classificar falha FECHADO.
 *
 * ONDE OS TRAILERS PRECISAM ESTAR. O squash do GitHub monta a mensagem com o
 * título da PR mais as mensagens dos COMMITS — não a descrição da PR. Já o
 * evento `pull_request` entrega título e descrição. Como o verificador roda
 * nos dois, os trailers precisam aparecer **na mensagem de commit** (para o
 * push do squash) **e na descrição da PR** (para o evento de PR). O workflow
 * passou a fornecer título + descrição no evento de PR exatamente para que os
 * dois eventos vejam a mesma informação.
 *
 * CORTE DE ADOÇÃO, objetivo e sem hash: o protocolo é obrigatório quando
 * `lastRecordedTask >= TAREFA_DE_ADOCAO_DO_PROTOCOLO` (a T152, que o
 * introduziu). Abaixo disso o contexto é MODO HISTÓRICO: só a regra (a) vale,
 * porque exigir trailer de commit que já está em `main` seria exigir reescrita
 * de histórico. Não há lista de hashes nem exceção por identificador — o corte
 * é um número de tarefa, versionado neste arquivo, e movê-lo exige PR.
 *
 * A constante vive no CÓDIGO e não em `sync-state.json` de propósito: em
 * estado, a mesma mudança que deveria ser fiscalizada poderia baixar o corte
 * e desligar o protocolo junto.
 *
 * NÃO TRATADO, e declarado: identificador em caixa baixa (`t153`) e com
 * caractere de largura zero continuam escapando de `IDENTIFICADOR`, exatamente
 * como antes desta tarefa. É dívida anterior, já registrada no ledger, e esta
 * tarefa não a corrige nem alega corrigir.
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
 * Tarefa que introduziu o protocolo de trailers. A partir dela, declarar é
 * obrigatório.
 *
 * Corte por NÚMERO DE TAREFA, nunca por hash: listar commits exigiria manter a
 * lista, e uma lista que envelhece é a forma mais silenciosa de um gate
 * afrouxar. Abaixo do corte o contexto é histórico — aqueles commits já estão
 * em `main` e não podem ganhar trailer sem reescrita de histórico.
 */
export const TAREFA_DE_ADOCAO_DO_PROTOCOLO = 152;

/** `Spec-Kit-Entrega: T152, T153` — chave no início da linha, sem indentação. */
const TRAILER_ENTREGA = /^Spec-Kit-Entrega:(.*)$/i;
/** `Spec-Kit-Nao-Entrega: T153` — citação deliberada, não entrega. */
const TRAILER_NAO_ENTREGA = /^Spec-Kit-Nao-Entrega:(.*)$/i;

/** Valor aceito num trailer: `T###`, separados por vírgula e/ou espaço. */
const VALOR_DE_TRAILER = /^T\d{3}$/;

/**
 * O protocolo é obrigatório para este estado?
 *
 * Lê `lastRecordedTask`, que é a tarefa que a mudança declara ter registrado.
 * Um contexto histórico (replay de squash antigo, cujo estado tinha
 * `lastRecordedTask` menor) cai em modo histórico sozinho, sem exceção
 * codificada.
 */
export function protocoloObrigatorio(state) {
  // Tipo ESTRITO, sem coerção: `Number("152")` daria 152 e ligaria o protocolo
  // a partir de um estado que `validarEstado` recusa. Quem decide sobre estado
  // inválido é `validarEstado`, que roda antes e encerra a avaliação — aqui a
  // resposta para entrada inválida é simplesmente "não sei dizer".
  const registrada = state?.lastRecordedTask;
  return (
    typeof registrada === "number" &&
    Number.isSafeInteger(registrada) &&
    registrada >= TAREFA_DE_ADOCAO_DO_PROTOCOLO
  );
}

/**
 * Lê os trailers do contexto.
 *
 * Devolve `{ entrega, naoEntrega, falhas }`. `falhas` não vazio significa
 * protocolo malformado — e, quando ele é obrigatório, isso basta para reprovar.
 *
 * Trata como MALFORMADO, e não como ausência:
 *   - trailer repetido (duas linhas `Spec-Kit-Entrega`);
 *   - valor vazio;
 *   - qualquer token que não seja exatamente `T###`.
 * Tolerar qualquer um deles transformaria erro de digitação em dispensa
 * silenciosa, que é precisamente o modo de falha que este protocolo existe
 * para fechar.
 */
export function lerTrailers(contexto) {
  const falhas = [];
  const achados = { entrega: null, naoEntrega: null };

  if (typeof contexto !== "string") {
    return { entrega: [], naoEntrega: [], falhas };
  }

  for (const linha of contexto.split(/\r?\n/)) {
    // COLUNA ZERO, sem aparar a esquerda. Um trailer e declaracao; um
    // exemplo indentado dentro da prosa — como o do commit que documenta
    // este protocolo — e texto. Sem essa exigencia, explicar o protocolo
    // numa mensagem de commit disparava "trailer duplicado", e a unica
    // saida seria nao poder falar dele. E tambem a convencao do git:
    // trailer vive na margem.
    const texto = linha.replace(/\s+$/, "");
    for (const [chave, padrao, rotulo] of [
      ["entrega", TRAILER_ENTREGA, "Spec-Kit-Entrega"],
      ["naoEntrega", TRAILER_NAO_ENTREGA, "Spec-Kit-Nao-Entrega"],
    ]) {
      const casado = texto.match(padrao);
      if (!casado) continue;

      if (achados[chave] !== null) {
        falhas.push(
          `Trailer ${rotulo} aparece mais de uma vez: declare todas as tarefas numa linha só.`,
        );
        continue;
      }

      const tokens = casado[1]
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      if (tokens.length === 0) {
        falhas.push(`Trailer ${rotulo} está vazio.`);
        achados[chave] = [];
        continue;
      }

      const invalidos = tokens.filter((t) => !VALOR_DE_TRAILER.test(t));
      if (invalidos.length > 0) {
        falhas.push(
          `Trailer ${rotulo} tem valor malformado (${invalidos.join(", ")}): use o formato T000.`,
        );
      }
      achados[chave] = tokens.filter((t) => VALOR_DE_TRAILER.test(t));
    }
  }

  const entrega = achados.entrega ?? [];
  const naoEntrega = achados.naoEntrega ?? [];

  // Contradição: o mesmo identificador nos dois lados não tem leitura possível,
  // e escolher um deles seria inventar a intenção do autor.
  const nosDois = entrega.filter((id) => naoEntrega.includes(id));
  for (const id of new Set(nosDois)) {
    falhas.push(
      `${id} está declarado como entrega E como não-entrega: a classificação precisa ser uma só.`,
    );
  }

  return {
    entrega: [...new Set(entrega)],
    naoEntrega: [...new Set(naoEntrega)],
    declarouEntrega: achados.entrega !== null,
    falhas,
  };
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

  // (b) MODO HISTÓRICO x PROTOCOLO. Abaixo do corte de adoção não há trailer a
  //     exigir — aqueles commits já estão em `main`. Acima dele, declarar é
  //     obrigatório e a ausência falha fechado.
  if (!protocoloObrigatorio(state)) return falhas;

  const registrada = Number(state?.lastRecordedTask);
  const {
    entrega,
    naoEntrega,
    declarouEntrega,
    falhas: falhasDeTrailer,
  } = lerTrailers(contexto);
  falhas.push(...falhasDeTrailer);

  if (!declarouEntrega) {
    falhas.push(
      `Trailer Spec-Kit-Entrega ausente: a partir da T${TAREFA_DE_ADOCAO_DO_PROTOCOLO} toda mudança declara o que entrega.`,
    );
    // Sem declaração não há o que conferir contra os artefatos, e varrer
    // citações só produziria ruído sobre um protocolo já violado.
    return falhas;
  }

  // (b1) O que foi declarado como entrega precisa existir nos dois artefatos e
  //      não pode estar acima do que o Spec Kit registra.
  for (const id of entrega) {
    const numero = Number(id.slice(1));
    if (numero > registrada) {
      falhas.push(
        `${id} está declarado em Spec-Kit-Entrega, mas lastRecordedTask=${registrada}: registre a tarefa no Spec Kit antes de entregá-la.`,
      );
      continue;
    }
    const faltas = [];
    if (!emTasks.has(id)) faltas.push("tasks.md");
    if (!noLedger.has(id)) faltas.push("execution-status.md");
    if (faltas.length > 0) {
      falhas.push(
        `${id} está declarado em Spec-Kit-Entrega, mas não está registrado em ${faltas.join(" nem em ")}.`,
      );
    }
  }

  // (b2) Todo identificador FUTURO citado em qualquer posição precisa estar
  //      classificado. É isto que fecha o bypass da posição: a menção deixa de
  //      ser julgada pelo lugar onde aparece e passa a depender de o autor
  //      dizer o que ela é. Esquecer de classificar reprova.
  const classificados = new Set([...entrega, ...naoEntrega]);
  for (const { id, numero } of identificadoresCitados(contexto)) {
    if (numero > registrada && !classificados.has(id)) {
      falhas.push(
        `${id} aparece no contexto, está acima de lastRecordedTask=${registrada} e não foi classificado: declare-o em Spec-Kit-Entrega ou em Spec-Kit-Nao-Entrega.`,
      );
    }
  }

  return falhas;
}
