import { AccessSession } from "@prisma/client";
import { AtorDaRequisicao } from "./contexto-empresarial";

declare module "express" {
  interface Request {
    /**
     * T163 — o ator da requisição, com `companyId` já **resolvido para a
     * empresa ativa da sessão**. Continua sendo um `AccessUser` para todo
     * efeito de tipo, então nenhum controlador ou serviço precisou mudar de
     * assinatura; o que mudou é o significado do campo, declarado em
     * `contexto-empresarial.ts`. A empresa da conta fica em `contaEmpresaId`.
     */
    authUser?: AtorDaRequisicao;
    authSession?: AccessSession;
  }
}
