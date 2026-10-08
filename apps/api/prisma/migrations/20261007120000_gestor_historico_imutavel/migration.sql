-- ---------------------------------------------------------------------------
-- T151 (corretiva) — Historico do gestor garantido pelo BANCO.
--
-- A migration 20261006120000 criou as tres tabelas afirmando que o historico
-- nao e apagavel. A afirmacao se apoiava em "nenhuma rota DELETE e ON DELETE
-- RESTRICT em toda FK" — que protege o registro PAI, nao a propria linha.
-- Nada impedia DELETE direto em atribuicao_gestor_equipe, nem reabrir uma
-- atribuicao encerrada pondo vigencia_fim de volta em NULL, nem reescrever
-- quem criou o registro e quando.
--
-- O criterio do repositorio e explicito desde a T139: historico append-only
-- garantido pelo BANCO e nao pela disciplina do service. Migrations anteriores
-- do projeto ja aplicam REVOKE DELETE a tabelas cujo historico deve ser
-- preservado; esta migration mantem o mesmo principio para as estruturas da
-- T151, que estavam fora dele.
--
-- Os precedentes, conferidos como SQL EXECUTAVEL (nao mencao em comentario),
-- sao oito tabelas em quatro migrations:
--   20260805120000  audit_event                 (UPDATE, DELETE)
--   20260810120000  evento_ponto                (UPDATE, DELETE)
--   20260810120000  ajuste_ponto                (UPDATE, DELETE)
--   20260826120000  tabela_horario              (DELETE)
--   20260826120000  periodo_horario             (UPDATE, DELETE)
--   20260826120000  vinculo_horario             (DELETE)
--   20260929120000  solicitacao_pessoa          (DELETE)
--   20260929120000  solicitacao_pessoa_evento   (UPDATE, DELETE)
--
-- A distincao importa: 20260814120000 (documentos) CITA REVOKE, mas apenas num
-- comentario que explica por que NAO revoga UPDATE ali. Contar arquivos por
-- `grep REVOKE` daria cinco migrations e estaria errado.
--
-- POR QUE PRIVILEGIO **E** TRIGGER, e nao so um dos dois:
--
--   * REVOKE DELETE resolve a exclusao, mas nao a REESCRITA. UPDATE precisa
--     continuar disponivel — encerrar vigencia e um UPDATE legitimo, e
--     revogar UPDATE quebraria as rotas de encerramento.
--   * Os triggers limitam o UPDATE a transicao permitida. Sem eles, manter
--     UPDATE equivaleria a permitir reescrever o passado por outro verbo.
--
-- O que um UPDATE pode mudar, e so isso:
--   access_user_colaborador  -> vigencia_fim, encerrado_por_user_id
--   atribuicao_gestor_equipe -> vigencia_fim, encerrado_por_user_id
--   excecao_acesso_gestor    -> encerrada_em,  encerrado_por_user_id
--   (mais atualizado_em, que o Prisma escreve em todo UPDATE)
--
-- E so uma vez: uma vez preenchido, o campo de encerramento nao volta a NULL
-- nem muda de valor. "Encerrada" e um estado terminal, nao um atributo.
--
-- BEFORE UPDATE, e nao CONSTRAINT TRIGGER DEFERRED como as da 20261006120000:
-- aquelas verificam invariantes que atravessam TABELAS, e precisam do COMMIT
-- para tolerar estados intermediarios legitimos dentro da transacao. Estas
-- olham uma unica linha contra ela mesma — nao existe estado intermediario
-- legitimo em que uma coluna imutavel esteja temporariamente errada, e falhar
-- na hora aponta o UPDATE culpado em vez do COMMIT.
--
-- LIMITE CONHECIDO, declarado: privilegio nao alcanca o OWNER da tabela nem
-- superusuario. evolli_migrator e qualquer superusuario continuam podendo
-- apagar — e tambem podem ALTER TABLE ... DISABLE TRIGGER. A garantia e
-- contra a APLICACAO e contra qualquer caminho que use evolli_app, que e o
-- unico papel com que o produto roda. Correcao deliberada por DBA segue
-- possivel, como deve ser, mas exige ato administrativo explicito — nao
-- acontece por bug de service nem por script distraido.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Colunas imutaveis.
--
-- Uma unica funcao, parametrizada por TG_ARGV, em vez de tres quase iguais: a
-- lista de colunas protegidas fica visivel na declaracao do trigger, onde se
-- confere, e nao enterrada em tres corpos que divergem com o tempo.
--
-- to_jsonb(OLD)/to_jsonb(NEW) permitem comparar coluna nomeada em tempo de
-- execucao — plpgsql nao tem acesso dinamico a campo de record. Colunas nulas
-- viram jsonb 'null' dos dois lados, que IS DISTINCT FROM trata como iguais:
-- nulo continua nulo, e so mudanca real dispara.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "app"."assert_colunas_imutaveis"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  coluna TEXT;
  antes  JSONB := to_jsonb(OLD);
  depois JSONB := to_jsonb(NEW);
BEGIN
  FOREACH coluna IN ARRAY TG_ARGV LOOP
    -- Guarda contra FAIL-OPEN: `jsonb -> 'coluna_inexistente'` devolve SQL
    -- NULL, e `NULL IS DISTINCT FROM NULL` e falso — um nome errado na
    -- declaracao do trigger desligaria a protecao em silencio, deixando a
    -- coluna aberta justamente onde o codigo afirma protege-la. Erro de
    -- configuracao tem de ser ruidoso.
    IF NOT (antes ? coluna) THEN
      RAISE EXCEPTION
        'trigger mal configurado: coluna "%" nao existe em %', coluna, TG_TABLE_NAME
        USING ERRCODE = 'internal_error';
    END IF;

    IF (antes -> coluna) IS DISTINCT FROM (depois -> coluna) THEN
      RAISE EXCEPTION
        'coluna imutavel alterada: %.%', TG_TABLE_NAME, coluna
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Encerramento irreversivel e unico.
--
-- TG_ARGV[0] nomeia a coluna que marca o encerramento. Regra:
--   NULL  -> valor      : permitido (e o encerramento);
--   NULL  -> NULL       : permitido (UPDATE que nao encerra);
--   valor -> outro/NULL : RECUSADO;
--   valor -> mesmo valor: permitido, e nao ha como ser diferente — no nivel do
--     tuple todo UPDATE reescreve todas as colunas, entao "tocou a coluna" e
--     "manteve o valor" sao indistinguiveis para um trigger. Tambem e inocuo:
--     gravar o valor que ja estava la nao altera o historico.
--
-- Isto e o que impede reabrir (vigencia_fim de volta a NULL) e o que impede
-- reescrever a data de encerramento depois do fato. Com o mesmo gatilho sobre
-- encerrado_por_user_id, o par "quem encerrou e quando" fica gravado de uma
-- vez so.
--
-- Nao substitui o controle de concorrencia na aplicacao: duas transacoes
-- simultaneas que encerram o mesmo registro sao serializadas pelo lock de
-- linha, e a segunda e recusada AQUI mesmo se o service esquecer o predicado.
-- E a mesma invariante dita duas vezes, de proposito — o service devolve 409
-- legivel, o banco garante que nao ha terceira via.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "app"."assert_encerramento_irreversivel"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  coluna TEXT  := TG_ARGV[0];
  antes  JSONB := to_jsonb(OLD);
  depois JSONB := to_jsonb(NEW);
BEGIN
  -- Mesma guarda contra fail-open de `assert_colunas_imutaveis`: sem ela,
  -- `jsonb_typeof(NULL)` e NULL, a condicao inteira vira NULL e o IF nunca
  -- dispara — um registro encerrado voltaria a ser reaberto sem reclamacao.
  IF NOT (antes ? coluna) THEN
    RAISE EXCEPTION
      'trigger mal configurado: coluna "%" nao existe em %', coluna, TG_TABLE_NAME
      USING ERRCODE = 'internal_error';
  END IF;

  IF jsonb_typeof(antes -> coluna) <> 'null'
     AND (antes -> coluna) IS DISTINCT FROM (depois -> coluna) THEN
    RAISE EXCEPTION
      'registro ja encerrado nao admite reabertura nem reescrita: %.%',
      TG_TABLE_NAME, coluna
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Aplicacao, tabela a tabela.
--
-- encerrado_por_user_id NAO entra na lista de imutaveis: precisa ir de NULL
-- para um valor no encerramento. Quem o protege depois e o seu proprio
-- gatilho de irreversibilidade, logo abaixo de cada tabela.
-- ---------------------------------------------------------------------------

CREATE TRIGGER "access_user_colaborador_colunas_imutaveis"
  BEFORE UPDATE ON "access_user_colaborador"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_colunas_imutaveis"(
    'id', 'user_id', 'colaborador_id', 'empresa_id',
    'vigencia_inicio', 'criado_por_user_id', 'criado_em'
  );

CREATE TRIGGER "access_user_colaborador_encerramento_unico"
  BEFORE UPDATE ON "access_user_colaborador"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_encerramento_irreversivel"('vigencia_fim');

CREATE TRIGGER "access_user_colaborador_autoria_imutavel"
  BEFORE UPDATE ON "access_user_colaborador"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_encerramento_irreversivel"('encerrado_por_user_id');

CREATE TRIGGER "atribuicao_gestor_equipe_colunas_imutaveis"
  BEFORE UPDATE ON "atribuicao_gestor_equipe"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_colunas_imutaveis"(
    'id', 'empresa_id', 'equipe_id', 'gestor_colaborador_id', 'papel',
    'vigencia_inicio', 'criado_por_user_id', 'criado_em'
  );

CREATE TRIGGER "atribuicao_gestor_equipe_encerramento_unico"
  BEFORE UPDATE ON "atribuicao_gestor_equipe"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_encerramento_irreversivel"('vigencia_fim');

CREATE TRIGGER "atribuicao_gestor_equipe_autoria_imutavel"
  BEFORE UPDATE ON "atribuicao_gestor_equipe"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_encerramento_irreversivel"('encerrado_por_user_id');

-- Na excecao, vigencia_fim e o PRAZO acordado (NOT NULL desde a criacao) e nao
-- o encerramento — por isso entra entre as imutaveis, e quem marca o fim
-- antecipado e encerrada_em.
CREATE TRIGGER "excecao_acesso_gestor_colunas_imutaveis"
  BEFORE UPDATE ON "excecao_acesso_gestor"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_colunas_imutaveis"(
    'id', 'empresa_id', 'gestor_colaborador_id', 'vinculo_id',
    'motivo_codigo', 'justificativa', 'vigencia_inicio', 'vigencia_fim',
    'criado_por_user_id', 'criado_em'
  );

CREATE TRIGGER "excecao_acesso_gestor_encerramento_unico"
  BEFORE UPDATE ON "excecao_acesso_gestor"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_encerramento_irreversivel"('encerrada_em');

CREATE TRIGGER "excecao_acesso_gestor_autoria_imutavel"
  BEFORE UPDATE ON "excecao_acesso_gestor"
  FOR EACH ROW
  EXECUTE FUNCTION "app"."assert_encerramento_irreversivel"('encerrado_por_user_id');

-- ---------------------------------------------------------------------------
-- 4. Sem exclusao fisica.
--
-- UPDATE permanece — encerrar depende dele, e os triggers acima ja o limitam.
-- Nenhum privilegio novo e concedido. Mesmo bloco de vinculo_horario
-- (20260826120000), que tambem encerra por vigencia.
-- ---------------------------------------------------------------------------
REVOKE DELETE ON TABLE "access_user_colaborador"  FROM evolli_app;
REVOKE DELETE ON TABLE "atribuicao_gestor_equipe" FROM evolli_app;
REVOKE DELETE ON TABLE "excecao_acesso_gestor"    FROM evolli_app;
