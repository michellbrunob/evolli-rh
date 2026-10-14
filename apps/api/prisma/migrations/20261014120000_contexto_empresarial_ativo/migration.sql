-- ---------------------------------------------------------------------------
-- T163 — Contexto empresarial ativo e troca segura de empresa.
--
-- ATE AQUI a empresa de trabalho era `access_user.company_id`: uma coluna da
-- CONTA. Nao havia o que trocar, e por isso a T162 entregou o Hub sem troca de
-- empresa, declarando a ausencia de contrato em vez de inventar um seletor.
--
-- Esta migration cria o contrato, em duas partes:
--
--   1. `access_user_empresa` — quais empresas uma conta esta AUTORIZADA a
--      usar como contexto. A autorizacao passa a ser de servidor e auditavel.
--   2. `access_session.empresa_ativa_id` — qual delas esta ATIVA nesta sessao.
--
-- POR QUE NA SESSAO, E NAO NA CONTA. Tres consequencias que a coluna na conta
-- nao daria: duas abas da mesma pessoa mantem contextos independentes;
-- revogar uma sessao nao mexe no contexto da outra; e um login novo nasce com
-- NULL, isto e, no padrao previsivel do papel.
--
-- COMPATIBILIDADE. `empresa_ativa_id` nasce NULL em toda sessao existente, e
-- NULL significa "sem selecao" — o contexto cai em `access_user.company_id`,
-- que e exatamente o comportamento anterior. Nenhuma sessao em curso muda de
-- escopo por causa desta migration. A unica diferenca de comportamento no
-- produto nasce de uma troca explicita e autorizada.
--
-- REVOGACAO E SOFT. `access_user_empresa.revogado_em` preserva a trilha de
-- quem teve acesso a que, e quando. Apagar a linha destruiria exatamente o
-- registro que torna a associacao auditavel, entao a tabela recebe
-- REVOKE DELETE — mesmo principio e mesmo precedente das tabelas historiadas
-- do projeto:
--   20260805120000  audit_event                 (UPDATE, DELETE)
--   20260810120000  evento_ponto                (UPDATE, DELETE)
--   20261007120000  access_user_colaborador     (DELETE)
--   20261007120000  atribuicao_gestor_equipe    (DELETE)
--   20261007120000  excecao_acesso_gestor       (DELETE)
--
-- EXCLUSAO FISICA: toda FK e ON DELETE RESTRICT. Nenhuma cascata destrutiva e
-- criada, e apagar uma empresa continua impossivel enquanto houver sessao ou
-- autorizacao apontando para ela.
--
-- PRIVILEGIOS: a tabela nova nasce com SELECT/INSERT/UPDATE/DELETE para
-- `evolli_app` via ALTER DEFAULT PRIVILEGES (infra/postgres/
-- 02_schema_and_grants.sql); esta migration apenas RETIRA o DELETE. Nenhum
-- privilegio novo e concedido.
--
-- ALTER TYPE ... ADD VALUE roda dentro da transacao da migration (suportado
-- desde o PostgreSQL 12) e nenhum dos valores novos e usado nesta mesma
-- migration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Acoes de auditoria do contexto empresarial.
--
-- A troca e um ato sensivel: muda o escopo de TODA leitura e mutacao seguinte
-- da sessao. Conceder e revogar autorizacao tambem, por motivo mais obvio.
-- ---------------------------------------------------------------------------
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'acesso.contexto_empresa.trocado';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'acesso.empresa_autorizada.concedida';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'acesso.empresa_autorizada.revogada';

-- ---------------------------------------------------------------------------
-- 2. Empresas autorizadas por conta.
-- ---------------------------------------------------------------------------
CREATE TABLE "access_user_empresa" (
  "id"                      TEXT         NOT NULL,
  "user_id"                 TEXT         NOT NULL,
  "empresa_id"              TEXT         NOT NULL,
  "concedido_em"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concedido_por_user_id"   TEXT         NOT NULL,
  "revogado_em"             TIMESTAMP(3),
  "revogado_por_user_id"    TEXT,

  CONSTRAINT "access_user_empresa_pkey" PRIMARY KEY ("id")
);

-- Um par conta/empresa aparece UMA vez. Reconceder acesso revogado e limpar
-- `revogado_em` da linha existente, nao criar uma segunda — assim a trilha de
-- uma mesma autorizacao fica num unico lugar.
CREATE UNIQUE INDEX "access_user_empresa_user_id_empresa_id_key"
  ON "access_user_empresa" ("user_id", "empresa_id");

-- A consulta quente e "empresas VIGENTES desta conta".
CREATE INDEX "access_user_empresa_user_id_revogado_em_idx"
  ON "access_user_empresa" ("user_id", "revogado_em");
CREATE INDEX "access_user_empresa_empresa_id_idx"
  ON "access_user_empresa" ("empresa_id");
CREATE INDEX "access_user_empresa_concedido_por_user_id_idx"
  ON "access_user_empresa" ("concedido_por_user_id");
CREATE INDEX "access_user_empresa_revogado_por_user_id_idx"
  ON "access_user_empresa" ("revogado_por_user_id");

ALTER TABLE "access_user_empresa"
  ADD CONSTRAINT "access_user_empresa_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "access_user" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "access_user_empresa"
  ADD CONSTRAINT "access_user_empresa_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresa" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "access_user_empresa"
  ADD CONSTRAINT "access_user_empresa_concedido_por_user_id_fkey"
  FOREIGN KEY ("concedido_por_user_id") REFERENCES "access_user" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "access_user_empresa"
  ADD CONSTRAINT "access_user_empresa_revogado_por_user_id_fkey"
  FOREIGN KEY ("revogado_por_user_id") REFERENCES "access_user" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Coerencia da revogacao: as duas colunas andam juntas. Sem isto, seria
-- possivel gravar "revogado, nao se sabe por quem" ou "revogado por fulano,
-- nao se sabe quando" — e uma trilha pela metade nao e trilha.
ALTER TABLE "access_user_empresa"
  ADD CONSTRAINT "access_user_empresa_revogacao_coerente"
  CHECK (
    ("revogado_em" IS NULL     AND "revogado_por_user_id" IS NULL)
    OR
    ("revogado_em" IS NOT NULL AND "revogado_por_user_id" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 3. Contexto ativo da sessao.
-- ---------------------------------------------------------------------------
ALTER TABLE "access_session"
  ADD COLUMN "empresa_ativa_id" TEXT;

CREATE INDEX "access_session_empresa_ativa_id_idx"
  ON "access_session" ("empresa_ativa_id");

ALTER TABLE "access_session"
  ADD CONSTRAINT "access_session_empresa_ativa_id_fkey"
  FOREIGN KEY ("empresa_ativa_id") REFERENCES "empresa" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Historico append-only garantido pelo BANCO, nao pela disciplina do
--    service. Nenhuma rota DELETE existe; isto fecha tambem o caminho direto.
-- ---------------------------------------------------------------------------
REVOKE DELETE ON TABLE "access_user_empresa" FROM evolli_app;
