import {
  AuthorizationAction,
  AuthorizationResource,
  AuthorizationSubject,
  AuthorizationTarget,
  isDocumentosResource,
  isHorariosResource,
  isOrganizationalResource,
  isPessoasResource,
  isPontoResource,
} from "./permission.types";

/**
 * Avaliador puro RBAC/ABAC — negação por padrão (spec §5). Nenhuma
 * dependência de banco/HTTP: recebe o sujeito (usuário autenticado) e o
 * alvo (recurso + ação + escopo), decide permitir/negar. Guard/controller
 * resolvem o alvo antes de chamar isto.
 */
export function evaluatePermission(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  switch (target.resource) {
    case "own_account":
      return evaluateOwnAccount(subject, target);
    case "other_account":
      return evaluateOtherAccount(subject, target);
    case "access_log":
      return evaluateAccessLog(subject, target);
    case "user_role":
      return evaluateUserRole(subject, target);
    case "mfa":
      return evaluateMfaReset(subject, target);
    default:
      // Recursos organizacionais (Etapa 1, Fatia 1), de pessoas (Fatia 2) e de
      // jornada/ponto (Etapa 3), cada um em seu próprio ramo. Mantém a negação
      // por padrão: qualquer recurso não reconhecido continua bloqueado.
      if (isOrganizationalResource(target.resource)) {
        return evaluateOrganizacao(subject, target);
      }
      if (isPessoasResource(target.resource)) {
        return evaluatePessoas(subject, target);
      }
      if (isPontoResource(target.resource)) {
        return evaluatePonto(subject, target);
      }
      if (isDocumentosResource(target.resource)) {
        return evaluateDocumentos(subject, target);
      }
      if (isHorariosResource(target.resource)) {
        return evaluateHorarios(subject, target);
      }
      return false;
  }
}

function evaluateOwnAccount(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action !== "read" && target.action !== "manage") {
    return false;
  }
  // Sem targetUserId explícito, assume-se "a própria conta" (uso típico:
  // GET /users/me). Com targetUserId, só permite se for o próprio.
  return (
    target.targetUserId === undefined || target.targetUserId === subject.userId
  );
}

function evaluateOtherAccount(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action === "read") {
    // T120 — Listagem paginada (`GET /v1/users`): não há alvo individual, só
    // capacidade (mesmo padrão de fase 1 de `evaluateOrganizacao`/
    // `evaluatePonto` — o escopo real, empresa própria vs. global, é aplicado
    // no service a partir da SESSÃO, nunca de um `companyId` enviado pelo
    // cliente). `admin_tecnico` fica de fora aqui pelo mesmo motivo de
    // `manage` abaixo: convergiu para bootstrap/histórico (CG-RBAC-01, ADR
    // 0012), não administra nem lista contas de terceiro.
    if (subject.role === "master_tecnico") {
      return true;
    }
    if (subject.role === "rh" || subject.role === "dp") {
      return subject.companyId !== null;
    }
    return false;
  }

  if (target.action !== "manage") {
    return false;
  }
  if (target.targetUserId === subject.userId) {
    // Gestão de "outro" usuário nunca é o próprio — negado por padrão aqui;
    // autoatendimento passa por "own_account".
    return false;
  }
  if (subject.role === "master_tecnico") {
    // Escopo: instância inteira. `master_tecnico` administra contas de acesso em
    // qualquer empresa (T030); a atribuição de PAPÉIS é regida por
    // `evaluateUserRole`, que impede promover alguém a `master_tecnico`.
    // `admin_tecnico` NÃO gerencia contas (CG-RBAC-01, ADR 0012): converge para
    // bootstrap/histórico e cai na negação por padrão abaixo.
    return true;
  }
  if (subject.role === "rh" || subject.role === "dp") {
    return isSameCompany(subject, target);
  }
  return false;
}

/**
 * Redefinição administrativa de MFA de OUTRA conta (T125).
 *
 * Escopo confirmado no ticket: só `master_tecnico` (instância inteira) e `rh`
 * (própria empresa). `dp` é NEGADO — diferença deliberada em relação a
 * `other_account/manage` (que permite `dp`), por isso esta capacidade é
 * própria e não reusa `other_account`. Nunca é o próprio usuário (reset do
 * próprio MFA não passa por aqui). O ato é sempre "remover fator + forçar nova
 * configuração"; este avaliador só decide QUEM pode disparar isso sobre quem.
 */
function evaluateMfaReset(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action !== "reset") {
    return false;
  }
  if (
    target.targetUserId !== undefined &&
    target.targetUserId === subject.userId
  ) {
    // Reset administrativo é sempre sobre outra conta.
    return false;
  }
  if (subject.role === "master_tecnico") {
    return true;
  }
  if (subject.role === "rh") {
    return isSameCompany(subject, target);
  }
  // `dp` e todos os demais: negados.
  return false;
}

function evaluateAccessLog(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action !== "read") {
    return false;
  }
  // `master_tecnico` (T030) lê a trilha em escopo global — a consulta abrange
  // as duas empresas, sem depender de filtro do cliente (o serviço de auditoria
  // não confina a consulta por empresa; para um papel global isso é o desejado).
  // A própria leitura gera evento `audit_log_read` (fail-closed, sem recursão).
  // `admin_tecnico` deixa de ler a trilha (CG-RBAC-01, ADR 0012): converge para
  // bootstrap/histórico e não opera a auditoria. `auditor`/`dpo` seguem não
  // provisionados (ADR 0010, decisão 4); `dpo` está formalmente depreciado
  // (ADR 0012) — nenhum papel comum ganha acesso (deny-by-default).
  return (
    subject.role === "master_tecnico" ||
    subject.role === "auditor" ||
    subject.role === "dpo"
  );
}

function evaluateUserRole(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action === "alter") {
    if (!target.targetUserId || target.targetUserId === subject.userId) {
      // Ninguém altera o próprio papel/escopo — previne autoelevação.
      return false;
    }
  } else if (target.action !== "create") {
    return false;
  }

  // Nenhuma rota comum cria, atribui, remove ou promove alguém a um papel
  // NÃO PROVISIONÁVEL:
  // - `master_tecnico` (T030; Constituição, Princípio II) e `admin_tecnico`
  //   (CG-RBAC-01, ADR 0012): perfis privilegiados; o Master exige runbook
  //   próprio (MFA) e o admin converge para bootstrap/histórico.
  // - `dpo` (CG-DPO-01, ADR 0012) e `auditor` (CG-DPO-03): papéis legados NÃO
  //   provisionados nesta fase. `dpo` está formalmente depreciado; `auditor`
  //   tem escopo pendente (DP-7, ADR 0005 Emenda 1 item 3; ADR 0010 decisão 4)
  //   e não deve ser provisionado. Ambos os valores permanecem no enum, no
  //   schema, nas migrations e no histórico (não são removidos); só a
  //   atribuição por rota é recusada. A capacidade latente de leitura da trilha
  //   (`evaluateAccessLog`) permanece inalterada para registros históricos.
  // O bloqueio vale para TODOS os atores — ninguém se autoperpetua nem cunha
  // um papel não provisionável por aqui.
  if (
    target.targetNewRole === "master_tecnico" ||
    target.targetNewRole === "admin_tecnico" ||
    target.targetNewRole === "dpo" ||
    target.targetNewRole === "auditor"
  ) {
    return false;
  }

  if (subject.role === "master_tecnico") {
    // Administra papéis COMUNS em qualquer empresa (escopo global, T030). Os
    // papéis privilegiados já foram bloqueados acima.
    return true;
  }
  if (subject.role === "rh") {
    // RH atribui papéis comuns na própria empresa (privilegiados já bloqueados).
    return isSameCompany(subject, target);
  }
  // `admin_tecnico` deixa de atribuir papéis (CG-RBAC-01): cai aqui, negado.
  return false;
}

/**
 * Estrutura organizacional (Etapa 1 — Fatia 1, spec §8; ADR 0006).
 *
 * Avaliado em **duas fases**, porque o alvo organizacional não é um
 * `AccessUser` e o `AuthorizationGuard` não o carrega:
 *
 * 1. **Capacidade** (`targetCompanyId === undefined`) — roda no guard. Decide
 *    só se o papel pode, em princípio, executar esta ação sobre este tipo de
 *    recurso. Não concede acesso a dado nenhum: a requisição apenas chega ao
 *    service.
 * 2. **Escopo** (`targetCompanyId` definido) — roda no service, depois de
 *    resolver a empresa da entidade. É aqui que a fronteira por empresa é
 *    aplicada.
 *
 * O isolamento não depende de o service lembrar de chamar a fase 2: toda
 * consulta do módulo organizacional já é construída com o filtro de empresa
 * derivado da sessão (ver `escopoEmpresa` em organizacao/escopo.util.ts), de
 * modo que um ator fora do escopo não encontra a linha. A fase 2 é a checagem
 * explícita adicional sobre a entidade carregada.
 *
 * Departamento e Area são recurso, nunca escopo: a fronteira continua sendo
 * `empresa` (Baseline V1, item 2).
 */
function evaluateOrganizacao(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  const escopoResolvido = target.targetCompanyId !== undefined;

  switch (subject.role) {
    // `admin_tecnico` NÃO tem mais visão nem gestão global da estrutura
    // organizacional (CG-RBAC-01, ADR 0012): a exceção temporária da Emenda 1
    // da ADR 0005 converge para `master_tecnico`. `admin_tecnico` cai na
    // negação por padrão (default) abaixo — reservado a bootstrap/histórico.

    // Perfil global controlado (T030; Constituição, Princípio II): lê e
    // administra a estrutura organizacional de qualquer empresa. Toda consulta
    // em escopo global é auditada (registrarConsultaAmpla, fail-safe). É o
    // ÚNICO acesso global standing (ADR 0012).
    case "master_tecnico":
      return true;

    // Matriz §8: lê e administra a estrutura da própria empresa.
    case "rh":
      // Criar uma empresa nova está fora de "própria empresa" — a empresa
      // criada, por definição, não é a do ator, e conceder isso ampliaria o
      // escopo do papel por interpretação. Só escopo global cria empresa.
      if (target.resource === "empresa" && target.action === "create") {
        return false;
      }
      return escopoResolvido
        ? isSameCompany(subject, target)
        : subject.companyId !== null;

    // Matriz §8: leitura na própria empresa, sem escrita.
    case "dp":
      if (target.action !== "read") {
        return false;
      }
      return escopoResolvido
        ? isSameCompany(subject, target)
        : subject.companyId !== null;

    // Matriz §8: "Leitura de `centro_custo` e estrutura mínima". Só a parte
    // inequívoca é concedida — `centro_custo`. "Estrutura mínima" não define
    // quais nós nem em que profundidade; conceder por interpretação seria
    // decidir escopo de acesso por suposição, o que a spec proíbe. Os demais
    // recursos ficam negados até deliberação explícita.
    case "financeiro":
      if (target.action !== "read" || target.resource !== "centro_custo") {
        return false;
      }
      return escopoResolvido
        ? isSameCompany(subject, target)
        : subject.companyId !== null;

    // `gestor`: a matriz marca leitura "restrita", mas o escopo exato é
    // pendência declarada (DP-8) e depende da entidade colaborador, que não
    // existe nesta fatia. Sem escopo definido, conceder leitura seria
    // escolher a fronteira por conta própria — negado por padrão.
    //
    // `auditor` e `dpo`: não são provisionados nesta fatia e seu escopo é
    // pendência declarada (DP-7, Emenda 1 da ADR 0005, item 3). O critério de
    // aceite da spec §12 exige que não sejam provisionáveis por nenhum fluxo
    // desta fatia — negado por padrão. A leitura da trilha de auditoria
    // (`access_log`) que eles já possuem permanece inalterada.
    //
    // `colaborador`: sem acesso à estrutura nesta fatia (matriz §8).
    default:
      return false;
  }
}

/**
 * Colaboradores e vida funcional (Etapa 1 — Fatia 2, ADR 0007; spec §6).
 *
 * Mesma avaliação em **duas fases** do ramo organizacional — capacidade no
 * guard (`targetCompanyId === undefined`), escopo no service, com a empresa do
 * **vínculo** já resolvida. A fronteira é `empresa_id` do vínculo, nunca do
 * colaborador: a pessoa pode ter vínculos históricos em empresas distintas
 * (Baseline V1, item 2).
 *
 * **`admin_tecnico` é NEGADO aqui — e isso é deliberado, não omissão.**
 *
 * A exceção temporária de acesso global (Emenda 1 da ADR 0005) foi concedida
 * sobre a estrutura organizacional da Fatia 1, que declaradamente não continha
 * dado pessoal. Estendê-la a este domínio por herança ampliaria materialmente
 * uma exceção aprovada em outro contexto — exatamente o que a Baseline V1
 * (item 8) fechou ao negar o papel neste módulo, de forma **definitiva**, não
 * apenas para esta V1. Note a assimetria com `evaluateOrganizacao`, onde
 * `admin_tecnico` retorna `true`: as duas coisas convivem por decisão
 * registrada, não por inconsistência.
 */
function evaluatePessoas(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  const escopoResolvido = target.targetCompanyId !== undefined;

  switch (subject.role) {
    // Perfil global controlado (T030): LÊ dado de pessoas/vida funcional em
    // qualquer empresa; NÃO executa nenhuma mutação (admissão, efetivação,
    // retificação, movimentação) — estas seguem exclusivas de rh/dp, com
    // alçada. Leitura global auditada (registrarConsultaGlobal, fail-safe). A
    // negação de mutação é reforçada em duas camadas: aqui (só `read`) e no
    // resolver de escopo de mutação, que recusa o papel.
    case "master_tecnico":
      return target.action === "read";

    // Baseline V1, itens 7 e 12: RH e DP registram e efetivam diretamente,
    // restritos à própria empresa, sempre auditados. Não há aprovador distinto
    // do solicitante nesta V1 — quem registra responde pelo registro.
    case "rh":
    case "dp":
      return escopoResolvido
        ? isSameCompany(subject, target)
        : subject.companyId !== null;

    // Negados por decisão explícita, cada um por um motivo distinto:
    //
    // `admin_tecnico` — Baseline V1, item 8 (ver bloco acima).
    // `gestor`        — escopo pendente (DP-8/DP-16); conceder exigiria
    //                   escolher a fronteira (equipe? departamento? direto ou
    //                   indireto?) por conta própria.
    // `auditor`/`dpo` — não provisionados; escopo pendente (DP-7). A leitura
    //                   da trilha (`access_log`) que já possuem fica intacta.
    // `financeiro`    — nada na Baseline concede acesso a pessoas; mantém só
    //                   `centro_custo` da Fatia 1.
    // `colaborador`   — o que ele acessaria é o Portal do Colaborador, que não
    //                   existe (DP-23); conceder aqui exporia dado de terceiro.
    default:
      return false;
  }
}

/**
 * Jornada e Ponto (Etapa 3, ADR 0008; Baseline Jornada V1, decisão 5).
 *
 * Mesma avaliação em **duas fases** dos ramos anteriores — capacidade no guard
 * (`targetCompanyId === undefined`), escopo no service, com a empresa do
 * **vínculo** já resolvida. A fronteira continua sendo `empresa_id`; esta
 * fatia não introduz nenhuma nova.
 *
 * **A lista de quem pode é exatamente `rh` e `dp`, e nada mais.** A Baseline
 * (decisão 5) preencheu duas células de uma matriz que estava inteiramente
 * vazia; toda célula não preenchida continua negada — não "aberta a
 * interpretação".
 *
 * **`admin_tecnico` é NEGADO — deliberado, não omissão.** Pelo mesmo raciocínio
 * já aplicado em `evaluatePessoas`: a exceção de acesso global (Emenda 1 da
 * ADR 0005) foi concedida sobre estrutura organizacional sem dado pessoal, e
 * dado de comportamento/presença está na mesma categoria de sensibilidade que
 * motivou a negação em Pessoas. Note de novo a assimetria com
 * `evaluateOrganizacao`, onde o papel retorna `true`: as duas coisas convivem
 * por decisão registrada.
 *
 * Não há ação `manage` nem `alter` neste domínio — o evento é imutável
 * (decisão 4) e não existe aprovação nem fechamento (decisão 7). Só `create` e
 * `read` são reconhecidos; qualquer outra ação cai na negação por padrão,
 * mesmo vinda de `rh`/`dp`.
 */
function evaluatePonto(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action !== "create" && target.action !== "read") {
    return false;
  }

  const escopoResolvido = target.targetCompanyId !== undefined;

  switch (subject.role) {
    // Perfil global controlado (T030): LÊ dado de jornada/ponto de qualquer
    // empresa; NUNCA registra evento nem ajuste (`create` é negado) — o registro
    // de ponto segue exclusivo de rh/dp. Leitura de ponto já é auditada por si
    // (`ponto_consultado`), inclusive a do Master.
    case "master_tecnico":
      return target.action === "read";

    case "rh":
    case "dp":
      return escopoResolvido
        ? isSameCompany(subject, target)
        : subject.companyId !== null;

    // Negados, cada um por um motivo próprio já registrado:
    //
    // `admin_tecnico` — Baseline Jornada V1, decisão 5 (ver bloco acima).
    // `gestor`        — escopo pendente (DP-8/DP-3J-12). "Gestor aprova o
    //                   ponto da equipe" é o fluxo natural do domínio, e é
    //                   exatamente por isso que conceder aqui sem a decisão
    //                   seria escolher a fronteira por conta própria.
    // `colaborador`   — o que ele acessaria é o Portal do Colaborador, fora de
    //                   escopo (spec §4); conceder exporia dado de terceiro.
    // `auditor`/`dpo` — leem a trilha (`access_log`), que é outro escopo; o
    //                   dado de ponto em si é pendência própria (DP-3J-05).
    // `financeiro`    — nada na Baseline concede acesso a ponto.
    default:
      return false;
  }
}

/**
 * Documentos — V1 de METADADOS (Etapa 2, ADR 0011, T008).
 *
 * Mesma avaliação em **duas fases** dos ramos organizacional e de pessoas —
 * capacidade no guard (`targetCompanyId === undefined`), escopo no service, com
 * a empresa do documento já resolvida. A fronteira é `empresa_id`, sem variante
 * global (ADR 0011, decisão 5).
 *
 * **`admin_tecnico` é NEGADO aqui — deliberado, não omissão.** Documento sobre
 * colaborador é dado pessoal desse colaborador; a Baseline V1 item 8 (ADR 0007)
 * e a decisão 6 da ADR 0011 negam o papel neste domínio. A exceção de acesso
 * global da Emenda 1 da ADR 0005 (estrutura sem dado pessoal) não se estende
 * por herança — mesma assimetria já registrada em `evaluatePessoas`.
 *
 * Distribuição de capacidade (ADR 0011, decisões aprovadas de Nível 1):
 * - `rh`: catálogo (criar/alterar/ler), metadado (criar/alterar/ler) e
 *   solicitação (criar/ler);
 * - `dp`: **lê** o catálogo (para referenciá-lo), mas **não** o cria nem altera
 *   ("apenas RH" — Emenda 1); metadado (criar/alterar/ler) e solicitação
 *   (criar/ler);
 * - demais papéis: negados.
 */
function evaluateDocumentos(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (subject.role === "master_tecnico") {
    // Perfil global controlado (T030): LÊ metadados, solicitações e catálogo de
    // qualquer empresa; NÃO cria, substitui nem altera nada (metadado, catálogo
    // e conteúdo de Nível 2 seguem com rh/dp e alçada de RH/DPO). Leitura global
    // auditada (registrarConsultaGlobal, fail-safe).
    return target.action === "read";
  }
  if (subject.role !== "rh" && subject.role !== "dp") {
    // Inclui admin_tecnico, gestor, colaborador, financeiro, auditor, dpo.
    return false;
  }

  if (!podeAcaoDocumentos(subject.role, target.resource, target.action)) {
    return false;
  }

  const escopoResolvido = target.targetCompanyId !== undefined;
  return escopoResolvido
    ? isSameCompany(subject, target)
    : subject.companyId !== null;
}

/**
 * Matriz recurso × ação por papel, independente de escopo. Só `rh` e `dp`
 * chegam aqui. A única diferença entre eles é o catálogo: criar/alterar tipo é
 * exclusivo de `rh`.
 */
function podeAcaoDocumentos(
  role: "rh" | "dp",
  resource: AuthorizationResource,
  action: AuthorizationAction,
): boolean {
  switch (resource) {
    case "tipo_documento":
      if (action === "read") {
        return true; // rh e dp leem o catálogo
      }
      // Criar/alterar catálogo: apenas RH, e com aprovação de DPO registrada
      // (validada no service). `alter`/`create` de dp caem aqui como negados.
      return role === "rh" && (action === "create" || action === "alter");

    case "documento_metadado":
      // Consultar, criar e substituir (substituir usa `alter`).
      return action === "read" || action === "create" || action === "alter";

    case "solicitacao_documento":
      // Solicitar (`create`) e consultar (`read`). Não há alteração de
      // solicitação nesta V1.
      return action === "read" || action === "create";

    default:
      return false;
  }
}

/**
 * Cadastros — Horarios (T038). Tabelas de horario por empresa e vínculo
 * histórico ao colaborador.
 *
 * Mesma avaliação em **duas fases** dos ramos anteriores — capacidade no guard
 * (`targetCompanyId === undefined`), escopo no service, com a empresa da tabela
 * ou do colaborador já resolvida. A fronteira é `empresa_id`.
 *
 * **RH é o ÚNICO perfil operacional** (T037): cria tabela, altera estado
 * (desativar/reativar), vincula e encerra vínculo — sempre na própria empresa.
 * `master_tecnico` (T030) **só lê**, em escopo global; nunca cria, altera,
 * desativa nem vincula. **DP, `gestor`, `colaborador`, `financeiro`,
 * `admin_tecnico`, `auditor` e `dpo` são NEGADOS** — diferentemente de ponto
 * (que era RH+DP), aqui a alçada operacional é exclusiva de RH (T037), e a
 * matriz não deixa nenhuma célula "aberta a interpretação".
 *
 * Ações reconhecidas: `create` (tabela/vínculo), `read` (consulta) e `alter`
 * (mudança de estado da tabela e encerramento de vínculo). Não há `manage`.
 */
function evaluateHorarios(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (
    target.action !== "create" &&
    target.action !== "read" &&
    target.action !== "alter"
  ) {
    return false;
  }

  const escopoResolvido = target.targetCompanyId !== undefined;

  switch (subject.role) {
    // Perfil global controlado (T030): LÊ tabelas e vínculos de qualquer
    // empresa; NUNCA cria, altera, desativa nem vincula (`create`/`alter`
    // negados). A leitura global é auditada por si (`horarios.consultado`).
    case "master_tecnico":
      return target.action === "read";

    // Único operador do domínio (T037), restrito à própria empresa.
    case "rh":
      return escopoResolvido
        ? isSameCompany(subject, target)
        : subject.companyId !== null;

    // Negados, cada um por decisão registrada:
    //
    // `dp`            — a alçada de ponto/horário no V1 é exclusiva de RH
    //                   (T037). DP não opera horários, ao contrário de ponto.
    // `admin_tecnico` — mesmo raciocínio de pessoas/ponto: sem exceção global.
    // `gestor`        — escopo pendente (DP-8).
    // `colaborador`   — Portal do Colaborador fora de escopo.
    // `financeiro`/`auditor`/`dpo` — nada concede acesso a horários.
    default:
      return false;
  }
}

function isSameCompany(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  return (
    subject.companyId !== null &&
    subject.companyId !== undefined &&
    subject.companyId === target.targetCompanyId
  );
}
