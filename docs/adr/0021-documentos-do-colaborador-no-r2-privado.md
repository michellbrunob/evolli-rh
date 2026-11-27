# ADR 0021 — Documentos do colaborador no Cloudflare R2 privado

- Status: **Aceito** em 2026-11-19, por ordem da proprietária na T213. Validação visual da
  primeira fatia aprovada pela proprietária em 2026-11-23.
- Escopo: arquivos opcionais do **colaborador** — RG, CPF, Comprovante de endereço, Carteira de
  Trabalho, Certidões e Outros —, enviados na etapa 4 do Novo colaborador e na ficha. Emenda as
  ADRs 0011 e 0013 para este conteúdo; não trata os metadados da Etapa 2
  (`documento_metadado`), que continuam como estão.
- Relacionado: [ADR 0011](0011-documentos-privados-e-admissao-digital.md),
  [ADR 0013](0013-armazenamento-privado-cloudflare-r2.md),
  [ADR 0020](0020-foto-do-colaborador-no-r2-privado.md) e o
  [dossiê da T213](../decisions/t213-documentos-colaborador.md).

## Portões resolvidos pela proprietária (2026-11-19)

- Upload via R2 liberado para este conteúdo, com a condição abaixo para arquivos reais.
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
5. **Antivírus antes de gravar (fail-closed):** o arquivo passa pelo antivírus (ClamAV do
   servidor, protocolo `INSTREAM`, configurado por `CLAMAV_HOST` e `CLAMAV_PORT`) **antes de
   qualquer gravação**. Sem verificador configurado e operante — ausente, fora do ar, recusando
   conexão ou sem resposta no tempo —, envio e troca respondem 503 com o código
   `documento_verificacao_indisponivel` e nada é gravado: nem no R2, nem documento, versão,
   limpeza pendente ou trilha. Com resposta, a versão nasce `aprovado` ou `reprovado`, com a
   trilha na mesma transação. Só `aprovado` pode ser baixado; o reprovado fica guardado e
   bloqueado. Versão antiga ainda `em_verificacao` só muda pela rota de nova verificação. O
   arquivo nunca vai a serviço de terceiros.
6. **Acesso só pela API:** envio e download passam por rotas autenticadas; nunca há URL do R2 no
   navegador. Resposta do download: `attachment`, `private, no-store`, `nosniff` e CSP restritiva.
7. **Papéis:** RH e DP enviam, veem, baixam, trocam e removem, só na empresa ativa;
   `master_tecnico` vê só a lista e o estado (sem o nome livre de "outros"), sem baixar; os
   demais papéis são negados. Documento de outra empresa responde como não encontrado (404).
8. **Versões e remoção:** trocar cria versão nova e preserva a anterior; remover é **lógico** (sai
   da lista e do download, o objeto fica). Nenhuma exclusão física de documento registrado
   nesta fase — garantida também no banco: o usuário da aplicação não tem `DELETE` em
   `documento_colaborador` nem em `versao_documento_colaborador` (migration
   `20261123120000_documentos_colaborador_remocao_logica`).
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

## Validação visual (2026-11-23)

A proprietária aprovou a primeira fatia na prévia local, com arquivo sintético, o R2
privado configurado no ambiente local e o verificador falso de desenvolvimento (o ClamAV
não está configurado nesse ambiente). Cenários conferidos no navegador:

- RH percorre as quatro etapas do Novo colaborador e escolhe um PDF sintético no RG: a linha
  mostra o ícone, o nome, o tamanho, o botão de ver e o menu "⋯", e a seção conta "1 de 5
  anexados.";
- ao cadastrar, a admissão é registrada e a confirmação mostra o RG como "Aprovado";
- na ficha, a seção "Arquivos do colaborador" mostra o RG "Aprovado" e as demais categorias
  "Pendente";
- o download como RH é entregue com o nome neutro `categoria-AAAA-MM-DD.ext` e sem cache;
- o `master_tecnico` vê a lista e o estado, e o download dele é recusado (403);
- a ficha em 375 px não tem rolagem horizontal.

## Consequências

- **Arquivos reais continuam bloqueados** até o ClamAV estar configurado no ambiente e a
  revisão de segurança do fluxo de envio estar concluída. Até lá, só arquivos sintéticos.
- **O envio depende tecnicamente de verificador configurado e operante:** sem ClamAV (ou com
  ele fora do ar), a API recusa o envio e a troca com 503 antes de gravar.
- O verificador falso (`EVOLLI_DOCUMENTOS_VERIFICADOR=falso`) só é aceito com `NODE_ENV` de
  desenvolvimento ou teste, e o armazenamento em memória
  (`EVOLLI_DOCUMENTOS_ARMAZENAMENTO=memoria`) só fora de produção; existem para testes e prévia
  local.
- Limites conhecidos, mantidos nesta fatia: dois envios simultâneos podem passar do limite de 5
  por categoria ou 30 por colaborador (a contagem não trava a linha); duas trocas simultâneas do
  mesmo documento sem chave de idempotência respondem 500 em vez de 409; se a versão nova for
  reprovada, a anterior aprovada fica preservada mas não é baixada; o hash não é conferido no
  download.
- Ficam para depois: MFA para baixar, retenção e descarte (DP-2E-15), obrigatoriedade por
  empresa, cargo ou vínculo (DP-2E-10/11), categorias configuráveis, outros formatos, acesso do
  próprio colaborador (DP-2E-14), OCR, assinatura, vencimentos e envio pela importação.
