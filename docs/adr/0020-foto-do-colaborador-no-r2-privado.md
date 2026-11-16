# ADR 0020 — Foto do colaborador no Cloudflare R2 privado

- Status: **Aceito** em 2026-11-16, por ordem da proprietária na T209.
- Escopo: foto opcional do **colaborador** (pessoa admitida), enviada na Nova admissão. Não
  trata a foto da conta de acesso (ADR 0018, que continua no PostgreSQL), documentos nem anexos.
- Relacionado: [ADR 0013](0013-armazenamento-privado-cloudflare-r2.md),
  [ADR 0018](0018-foto-de-perfil-da-conta-no-postgresql.md) e o
  [dossiê da T209](../decisions/t209-dossie-colaboradores.md) (seção 32).

## Decisão

1. **Dono da foto:** o colaborador, naquela empresa (`foto_colaborador`, uma linha por
   colaborador e empresa). Nunca reaproveita nem aponta para a foto da conta (`access_user_foto`).
2. **Onde ficam os bytes:** bucket R2 **privado**, sem URL pública. A configuração (chaves,
   bucket, endpoint) fica só em variáveis de ambiente locais, nunca no repositório, em log ou em
   resposta.
3. **Chave do objeto:** só ids internos —
   `v1/empresas/{empresa-id}/colaboradores/{colaborador-id}/foto/{arquivo-id}/foto-{96|256|512}.webp`.
   Nunca nome, CPF, e-mail, matrícula ou outro dado pessoal. CHECK no banco confere a forma.
4. **O que é guardado:** só três versões geradas pelo servidor, em WebP, 96, 256 e 512 px, sem
   metadados. O arquivo enviado nunca é guardado.
5. **Entrada:** só PNG e JPEG, até 5 MB. Extensão, tipo declarado e assinatura do conteúdo
   precisam concordar; depois, teto de pixels, lado mínimo, decodificação com falha em qualquer
   erro, orientação corrigida, corte quadrado (Sharp).
6. **Ordem segura:** as versões novas são gravadas antes de o banco apontar para elas; só depois
   as antigas são apagadas. Falha ao gravar apaga o que já foi gravado; o que não puder ser
   apagado vira **limpeza pendente** (`limpeza_foto_colaborador_pendente`: só ids, a chave e o
   motivo), tentada de novo a cada operação de foto da empresa.
7. **Acesso:** escrita (enviar, substituir, remover) por RH e DP, só na empresa ativa, para
   colaborador com vínculo nela; `master_tecnico` e os demais papéis não escrevem. Leitura só pela
   rota autenticada do Evolli, por RH, DP e `master_tecnico` com empresa ativa, depois de conferir
   o vínculo — antes de buscar o objeto. O prefixo do bucket não é autorização. A resposta é
   `private, no-store`.
8. **Quando:** a foto é enviada só depois de a admissão ser concluída. Falha da foto nunca
   desfaz a admissão; a tela avisa e permite nova tentativa.
9. **Auditoria:** envio, substituição e remoção, dentro da transação, sem conteúdo, hash,
   tamanho, dimensões ou chave do objeto.
10. **Cliente do R2:** assinatura AWS SigV4 implementada com o `crypto` do Node (conferida
    contra o exemplo oficial da AWS), sem SDK nem dependência nova.

## Consequências

- Os testes automatizados usam armazenamento em memória com falhas injetáveis; nenhum teste
  fala com o bucket.
- Retenção e descarte da foto acompanham a regra geral de dados do colaborador, ainda aberta
  (`DP-2E-15`); a remoção pela ficha fica para quando houver tela para isso.
