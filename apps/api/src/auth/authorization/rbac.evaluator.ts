import {
  AuthorizationAction,
  AuthorizationResource,
  AuthorizationSubject,
  AuthorizationTarget,
  isDocumentosResource,
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
  if (target.action !== "manage") {
    return false;
  }
  if (target.targetUserId === subject.userId) {
    // Gestão de "outro" usuário nunca é o próprio — negado por padrão aqui;
    // autoatendimento passa por "own_account".
    return false;
  }
  if (subject.role === "admin_tecnico") {
    return true; // escopo: instância inteira
  }
  if (subject.role === "rh" || subject.role === "dp") {
    return isSameCompany(subject, target);
  }
  return false;
}

function evaluateAccessLog(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action !== "read") {
    return false;
  }
  return (
    subject.role === "admin_tecnico" ||
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

  if (subject.role === "admin_tecnico") {
    return true;
  }
  if (subject.role === "rh") {
    if (target.targetNewRole === "admin_tecnico") {
      // RH não pode se auto-promover nem criar/promover terceiro a admin
      // técnico.
      return false;
    }
    return isSameCompany(subject, target);
  }
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
    // Exceção temporária e condicionada aprovada na Emenda 1 da ADR 0005:
    // acesso global ao ambiente interno, sempre auditado. Toda leitura de
    // escopo amplo gera evento (spec §9).
    case "admin_tecnico":
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
