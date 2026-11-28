# T217 — Documentos da ficha do colaborador (revisão completa)

**Estado:** em andamento. **Base:** `main` em `41a586c` (T216 integrada pela PR #208).

## Objetivo

Revisar a aba Documentos da ficha do colaborador entregue na T213 e completá-la: todas as
funcionalidades, regras de negócio, estados, mensagens e permissões, conferidos com cenários reais de
RH e DP, com arquivos sintéticos.

## Regras que continuam valendo (T213)

- Arquivo no armazenamento privado, com quarentena e verificação antivírus antes de gravar.
- Só arquivos sintéticos em testes e na prévia.
- Segredos de armazenamento e antivírus só nas variáveis de ambiente.

## Fora de escopo

Envio de e-mail (etapa posterior, depois de fechar a ficha do colaborador), assinatura eletrônica,
OCR e leitura automática.

## Apêndice — contrato e decisões desta entrega

(acrescentado durante a entrega)

### Frente A — tabela da ficha e regras de arquivo

**Decisões aplicadas (proprietária, 2026-11-28):** (1) a aba Documentos da ficha mostra só a
tabela do que foi enviado; o checklist de envio fica na edição e na etapa 4 do cadastro; (2) o nome
original do arquivo é guardado e mostrado, e os formatos aceitos passam a ser PDF, DOC, DOCX, JPG,
PNG e WebP (sem HEIC), até 10 MB, com conferência do conteúdo e antivírus como antes; (3)
colaborador desligado continua com documentos editáveis. Decisões do coordenador: o histórico de
versões continua guardado e não aparece na tela; removidos ficam invisíveis; "Enviado por" aparece
para quem lê a aba, inclusive o `master_tecnico`.

**Banco** — migration aditiva `20261128064100_documentos_nome_original_formatos`:

- `versao_documento_colaborador.nome_original VARCHAR(255)` (nulo nas versões anteriores);
- `FormatoDocumentoColaborador` ganha `doc`, `docx` e `webp`.

**API** (`/v1/colaboradores/:colaboradorId/documentos`):

- Envio e troca aceitam o cabeçalho opcional `x-evolli-documento-arquivo` (nome original
  codificado com `encodeURIComponent`). O servidor guarda só o último trecho do caminho, sem
  caracteres de controle ou invisíveis, com espaços simples e até 255 caracteres (cortado antes da
  extensão). Ausente, vazio ou malformado vira `null`; nunca recusa o envio. A auditoria continua
  sem nome, categoria, tamanho, hash ou chave.
- Conferência do arquivo (extensão, tipo declarado e conteúdo precisam concordar):
  - DOC: contêiner OLE com o fluxo `WordDocument`, setores inteiros de 512 bytes (mínimo 3);
  - DOCX: pacote ZIP com `[Content_Types].xml` e `word/document.xml` e o registro de fim do
    diretório; outro ZIP (planilha, por exemplo) é recusado;
  - WebP: `RIFF` + `WEBP`, com o tamanho declarado cobrindo exatamente o arquivo;
  - DOC ou DOCX com macro (`_VBA_PROJECT`, `Macros`, `VBA` no OLE; `vbaProject.bin` no ZIP):
    recusa `documento_com_macro` (422).
- A lista (e as respostas de envio, troca e nova verificação) passa a trazer:
  - `nomeArquivo: string | null` — nome original da versão atual; `null` para o
    `master_tecnico` (como o nome livre de "outros");
  - `enviadoPor: { nome: string | null, papel: AccessRole } | null` — autor da versão atual (nome
    de exibição da conta; sem ele, só o papel), visível a todos que leem a lista.
- O download pela API continua com o nome neutro (`categoria-AAAA-MM-DD.ext`); a tela é que salva
  com o nome original quando ele existe. DOC: `application/msword`; DOCX:
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; WebP: `image/webp`.

**Tela — ficha › Documentos** (`TabelaDeDocumentosDaFicha`):

- Cabeçalho: título, resumo "N arquivo(s) · último envio em dd/mm/aaaa" (sem arquivos: "Nada
  enviado ainda") e "Enviar documento", que abre a edição na seção Documentos (só RH e DP).
- Contador na aba (pílula com a quantidade; some em 0). Lido com a ficha e atualizado pela aba a
  cada carga; aberta já na aba, uma leitura só.
- Colunas: Documento (ícone, tipo e nome original — sem ele, formato e tamanho), Enviado por
  ("Nome (Papel)"), Data de envio ("dd/mm/aaaa às HH:MM", fuso de Brasília) e ações.
- Ordem: do envio mais recente para o mais antigo (versão atual); empate mantém a ordem da API.
- Ações (RH e DP, só no aprovado): Ver (PDF e imagens; DOC e DOCX só baixam), Baixar e "⋯" com
  Remover (em vermelho, com ícone) — e "Verificar de novo" enquanto o antivírus não respondeu.
  Em verificação e reprovado aparecem como selo na linha, sem Ver nem Baixar.
- Remover pede confirmação citando tipo e arquivo e dizendo que ele continua guardado; ao
  confirmar, aviso flutuante, lista, resumo e contador atualizados, foco na linha vizinha (ou no
  título). Falhas de ver, baixar, verificar e remover viram aviso flutuante de erro.
- Estados: esqueleto de três linhas na carga ("Carregando…" no resumo), falha com "Tentar de novo"
  e vazio ilustrado dentro da tabela, com o cabeçalho das colunas e "Enviar documento".
- Telas estreitas (até 40rem): cada linha vira um cartão, sem rolagem horizontal; toque com alvo
  de 44 px.

**Tela — edição e etapa 4** (mínimo, porque a lista por vínculo é da frente B): Baixar fora do
"⋯", nome original e "Enviado em dd/mm/aaaa" na linha, limite e formatos no subtítulo, mensagem
de tamanho com o tamanho do arquivo e o limite, recusa de macro traduzida e textos próprios no lugar
dos que repetiam a referência ("Documentos principais", "N de 5 anexados.", "Nome do documento",
exemplo sem dado de saúde, confirmação de remoção dizendo que o arquivo continua guardado).

**Diferenças conscientes:** DOC e DOCX não têm "Ver" (o navegador não abre; só baixar); o arquivo
nunca sai por link do armazenamento, sempre pela rota autenticada; a confirmação usa a janela padrão
do Evolli (ícone ao lado do título e botões à direita).

**Provas:** unitários da API (conferência dos formatos, macro, nome original e projeção da lista);
e2e `documentos-colaborador` atualizado (nome original saneado, quem enviou, DOCX e WebP aceitos,
DOCX com macro recusado, `master_tecnico` sem nome do arquivo) — não executado nesta frente;
testes de tela da tabela, da ficha (contador, envio pela edição, desligado editável) e da edição.
