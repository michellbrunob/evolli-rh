# ADR 0013 — Armazenamento privado de conteúdo documental no Cloudflare R2

- Status: **Aceito para arquitetura e provedor** em 2026-09-29.
- Escopo: escolha do armazenamento de objetos e contrato mínimo de acesso.
- Relacionado:
  [ADR 0011](0011-documentos-privados-e-admissao-digital.md),
  [aprovações de Documentos — Etapa 2](../decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md),
  [decisões de Documentos e Solicitações](../decisions/decisoes-gestao-documentos-e-solicitacoes-v1.md) e
  [pacote de decisão da Central de Solicitações](../decisions/pacote-decisao-solicitacoes-pessoas.md).

## Contexto

A ADR 0011 separou metadado e conteúdo: metadados permanecem no PostgreSQL e
o conteúdo deve ficar em armazenamento privado de objetos. O item `DP-2E-03`
mantinha pendente a escolha do provedor. Em 2026-09-29, TI/Segurança confirmou
que o serviço **Cloudflare R2** já está contratado e disponível e aprovou seu
uso como armazenamento de conteúdo documental do Evolli RH.

Esta decisão resolve **a escolha do provedor e o padrão arquitetural**. Ela não
habilita upload por configuração e não declara que os demais portões de
conteúdo estejam satisfeitos.

## Decisão

1. **Provedor.** Cloudflare R2 é o armazenamento de objetos aprovado para
   conteúdo documental e futuras evidências anexadas a solicitações.
2. **Segregação.** Metadados, autorização e estado do documento ficam no
   PostgreSQL. O R2 recebe somente o conteúdo binário e metadados técnicos
   mínimos indispensáveis.
3. **Privacidade por padrão.** Buckets de documentos permanecem privados. É
   proibido habilitar `r2.dev`, bucket público ou URL pública permanente para
   conteúdo do Evolli RH.
4. **Separação de ambientes.** Desenvolvimento, homologação, piloto e produção
   usam buckets e credenciais independentes, sem reutilização cruzada.
5. **Credenciais.** Tokens e chaves do R2 existem somente no ambiente do
   servidor, com escopo mínimo por bucket e operação. Nenhuma credencial,
   identificador de conta, nome real de bucket ou segredo pode ser versionado,
   enviado ao navegador, registrado em log ou incluído em documentação.
6. **Chaves de objeto.** O nome original do arquivo nunca é a chave do objeto.
   A aplicação gera identificador opaco e não previsível, sem CPF, matrícula,
   nome, e-mail, tipo de documento ou outro dado pessoal.
7. **Acesso temporário.** Quando houver download ou upload direto pelo
   navegador, a API autentica a sessão, autoriza o objeto e só então emite URL
   pré-assinada para uma única operação e um único objeto, com expiração curta.
   A URL é tratada como credencial temporária e nunca é persistida.
8. **CORS mínimo.** Se URLs pré-assinadas forem usadas no navegador, a política
   CORS permite somente as origens e métodos efetivamente necessários em cada
   ambiente; curingas não são aceitos para conteúdo privado.
9. **Quarentena fail-closed.** Todo novo objeto inicia indisponível. Apenas
   conteúdo aprovado pelo mecanismo de inspeção poderá ser servido. Falha,
   timeout ou indisponibilidade do inspetor mantém o objeto bloqueado.
10. **Auditoria em duas camadas.** A aplicação registra, de forma fail-safe,
    emissão de acesso, upload, leitura, download, substituição e descarte
    lógico. Os Data Access Logs do R2 são evidência complementar, nunca
    substituem a trilha de negócio, inclusive porque não cobrem todas as
    falhas de requisição.
11. **Criptografia do provedor.** O desenho considera a proteção de transporte
    e a criptografia em repouso oferecidas pelo R2, sem tratá-las como
    substitutas de autorização por objeto, minimização, retenção ou auditoria.
12. **Sem exclusão física por efeito colateral.** Retenção, descarte e eventual
    exclusão do objeto precisam alcançar PostgreSQL e R2 de forma coordenada e
    auditável. Até a aprovação dessa política, nenhum fluxo operacional pode
    apagar conteúdo definitivamente.

## O que esta ADR resolve

- `DP-2E-03`: provedor e padrão de armazenamento privado — **resolvido**.
- Destino arquitetural para futuros anexos da Central de Solicitações —
  **definido**, condicionado aos portões técnicos e jurídicos restantes.

## O que permanece pendente

- `DP-2E-04`: provisionamento e evidência da gestão das credenciais por
  ambiente.
- `DP-2E-05`: limites de tamanho, formatos e metadados técnicos.
- `DP-2E-06` e `DP-2E-15`: validade, retenção, descarte e tratamento após
  desligamento.
- `DP-2E-09`: ferramenta de inspeção/antimalware e política de quarentena.
- `DP-2E-13` e `DP-2E-14`: matriz de acesso ao conteúdo e acesso do titular.
- Auditoria de conteúdo, testes de autorização por objeto e validação humana de
  segurança.
- Gate aplicável de autenticação reforçada para conteúdo sensível, sem alterar
  a decisão vigente de lançamento inicial com `MFA_ENABLED=false`.

Enquanto qualquer portão obrigatório permanecer aberto, o fato de o R2 estar
contratado e disponível **não habilita upload nem dado real**.

## Alternativas consideradas

| Alternativa                               | Decisão                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Guardar bytes no PostgreSQL               | Rejeitada; viola a segregação definida na ADR 0011.                                                                                  |
| Bucket público ou `r2.dev`                | Rejeitada; expõe conteúdo fora da autorização por objeto da aplicação.                                                               |
| URL permanente por documento              | Rejeitada; amplia a janela de vazamento e não permite revogação efetiva por sessão.                                                  |
| Servidor atuar sempre como proxy de bytes | Permitida apenas quando justificada; não é obrigação arquitetural. URLs pré-assinadas de curta duração são aceitas após autorização. |

## Referências do provedor

- [R2 — segurança de dados](https://developers.cloudflare.com/r2/reference/data-security/)
- [R2 — URLs pré-assinadas](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 — configuração de CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [R2 — buckets públicos](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [R2 — Data Access Logs](https://developers.cloudflare.com/r2/buckets/data-access-logs/)

## Consequências

- A futura implementação deverá usar cliente compatível com a API S3 do R2,
  mantendo a autorização no backend do Evolli RH.
- Nenhum endpoint deverá devolver chave interna, bucket, credencial ou URL
  permanente.
- A ativação de upload exige implementação, migration, testes, revisão de
  segurança e evidências dos portões restantes; não será uma simples variável
  de ambiente.
- Esta ADR não declara conformidade LGPD nem autoriza produção ou uso de dados
  reais.
