# ADR 0021 — Documentos do colaborador no Cloudflare R2 privado

- Status: **Aceito** em 2026-11-19, por ordem da proprietária na T213.
- Escopo: arquivos opcionais do **colaborador** — RG, CPF, Comprovante de endereço, Carteira de
  Trabalho, Certidões e Outros —, enviados na etapa 4 do Novo colaborador e na ficha. Emenda as
  ADRs 0011 e 0013 para este conteúdo; não trata os metadados da Etapa 2
  (`documento_metadado`), que continuam como estão.
- Relacionado: [ADR 0011](0011-documentos-privados-e-admissao-digital.md),
  [ADR 0013](0013-armazenamento-privado-cloudflare-r2.md),
  [ADR 0020](0020-foto-do-colaborador-no-r2-privado.md) e o
  [dossiê da T213](../decisions/t213-documentos-colaborador.md).

## Portões resolvidos pela proprietária (2026-11-19)

- Upload real via R2 liberado para este conteúdo.
- Finalidade e base legal validadas por Jurídico e DPO (registro só da confirmação).
- Formatos, limites, matriz de acesso ao conteúdo e quarentena: decisões abaixo.
- MFA para baixar **não** é exigido nesta primeira fase; fica como endurecimento futuro.

## Decisão

1. **Opcional:** nenhum documento é obrigatório e a falta de arquivo nunca bloqueia a admissão.
2. **Categorias iniciais, fixas:** rg, cpf, comprovante_endereco, carteira_trabalho, certidoes e
   outros (este com nome curto de até 60 caracteres, dado por quem envia).
3. **Formatos e limites:** PDF, JPG e PNG; extensão, tipo declarado e assinatura do conteúdo
   precisam concordar, e o arquivo precisa estar inteiro (marcador de fim do formato). Até
   10 MB por arquivo, 5 por categoria e 30 por colaborador (documentos não removidos).
4. **Onde ficam os bytes:** bucket R2 **privado**, pelo mesmo cliente e porta de armazenamento da
   foto (ADR 0020). Chave só com ids internos:
   `v1/empresas/{empresa}/colaboradores/{colaborador}/documentos/{documento}/{versao}`. O nome
   original do arquivo **não** é guardado; o download sai como `categoria-AAAA-MM-DD.ext`.
5. **Quarentena fail-closed:** toda versão nasce `em_verificacao`; o antivírus (ClamAV do
   servidor, protocolo `INSTREAM`, configurado por `CLAMAV_HOST` e `CLAMAV_PORT`) aprova ou
   reprova. Falha, tempo esgotado ou falta de configuração mantêm a versão bloqueada; há rota de
   nova verificação. Só `aprovado` pode ser baixado. O arquivo nunca vai a serviço de terceiros.
6. **Acesso só pela API:** envio e download passam por rotas autenticadas; nunca há URL do R2 no
   navegador. Resposta do download: `attachment`, `private, no-store`, `nosniff` e CSP restritiva.
7. **Papéis:** RH e DP enviam, veem, baixam, trocam e removem, só na empresa ativa;
   `master_tecnico` vê só a lista e o estado (sem o nome livre de "outros"), sem baixar; os
   demais papéis são negados. Documento de outra empresa responde como não encontrado (404).
8. **Versões e remoção:** trocar cria versão nova e preserva a anterior; remover é **lógico** (sai
   da lista e do download, o objeto fica). Nenhuma exclusão física de documento registrado
   nesta fase.
9. **Limpeza pendente:** o objeto é registrado como pendente antes de ser gravado no R2 e baixado
   quando o registro conclui; o que sobrar sem registro (falha, ou envio parado há mais de
   15 minutos) é apagado na passagem seguinte.
10. **Idempotência:** cada envio leva uma chave própria; reenviar com a mesma chave e o mesmo
    arquivo devolve o já registrado; outro arquivo com a mesma chave é recusado.
11. **Auditoria:** envio, troca, remoção, aprovação, reprovação, falha da verificação e download,
    com ator, papel, empresa, id do documento, resultado e requisição. Nunca conteúdo, nome,
    categoria, tamanho, hash ou chave. Sem trilha gravada, o download não é entregue.
12. **Depois do cadastro:** os arquivos escolhidos na etapa 4 ficam só na memória da aba (nunca
    no rascunho) e sobem um por vez depois de o colaborador ser criado. Falha de um nunca desfaz
    a admissão: fica "Não enviado"; só falha transitória oferece nova tentativa.

## Consequências

- Em ambiente sem ClamAV configurado, os arquivos ficam em verificação e não podem ser baixados.
- O verificador falso (`EVOLLI_DOCUMENTOS_VERIFICADOR=falso`) e o armazenamento em memória
  (`EVOLLI_DOCUMENTOS_ARMAZENAMENTO=memoria`) existem só para testes e prévia local; ambos são
  recusados em produção.
- Ficam para depois: MFA para baixar, retenção e descarte (DP-2E-15), obrigatoriedade por
  empresa, cargo ou vínculo (DP-2E-10/11), categorias configuráveis, outros formatos, acesso do
  próprio colaborador (DP-2E-14), OCR, assinatura, vencimentos e envio pela importação.
