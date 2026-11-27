-- T213 — documentos do colaborador: remoção só LÓGICA (ADR 0021, decisão 8).
--
-- Sem exclusão física de documento registrado nesta fase, garantida pelo
-- BANCO e não só pela disciplina do service (mesmo padrão de audit_event,
-- evento_ponto e solicitacao_pessoa). A remoção continua sendo um UPDATE de
-- "removido_em"/"removido_por_id"; a troca cria versão nova sem apagar a
-- anterior. A fila "limpeza_documento_colaborador_pendente" mantém o DELETE:
-- ela só guarda objetos do R2 que ainda não ganharam registro.
REVOKE DELETE ON TABLE "documento_colaborador" FROM evolli_app;
REVOKE DELETE ON TABLE "versao_documento_colaborador" FROM evolli_app;
