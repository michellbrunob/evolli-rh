# T216 — Pesquisas (módulo do menu e aba da ficha)

**Data:** 2026-11-27 · **Estado:** em andamento · **Branch:** `codex/t216-pesquisas`

## Objetivo

O RH mede clima, engajamento e a experiência das pessoas com pesquisas próprias da empresa: escolhe um
modelo (ou monta do zero), define quem responde, publica um link e acompanha participação e resultados.
A ficha do colaborador mostra as pesquisas identificadas que a pessoa respondeu.

Referência funcional observada em 2026-11-27 (só como guia de fluxo e regra; textos, perguntas, marca e
layout são do Evolli).

## Escopo desta entrega

1. **Lista de pesquisas** (menu Pesquisas): abas por status com contagem (Todas, Ativas, Pausadas,
   Finalizadas, Canceladas), colunas Pesquisa (nome, modelo · identificação), Participação
   (respostas/participantes e %), Criada em e Status. Ações por linha: Ver resultados, Editar,
   Duplicar, Copiar link, Excluir. Sem pesquisas: página de boas-vindas com os três passos
   (modelo → quem responde → enviar e acompanhar) e a galeria de modelos.
2. **Galeria de modelos** com textos próprios, por categoria e busca:
   - Clima e engajamento: **Pulso** (6 afirmações na escala 1–10 + eNPS + comentário), **Clima**
     (afirmações de concordância 1–5 em 5 dimensões), **eNPS** (nota 0–10 + 2 complementares),
     **Onboarding · 30 dias** (para quem chegou há pouco).
   - Outros: **Entrevista de desligamento**, **Satisfação com benefícios**, **Avaliação de
     treinamento** e **Personalizada** (em branco).
   - Cada card: nome, descrição, quantidade de perguntas e "Ver perguntas" (gaveta) / "Usar modelo".
     A quantidade do card é a mesma da gaveta e do assistente (sem divergência).
3. **Assistente em 5 etapas** (rascunho gravado no servidor):
   1. _Sobre a pesquisa_: nome (obrigatório, até 120), mensagem de boas-vindas (opcional, até
      1000, parágrafos) e identificação: **Identificada** (o RH vê quem respondeu o quê),
      **Confidencial** (valida a pessoa, o RH vê só o agrupado) ou **Anônima** (sem identificação;
      quem tem o link responde). Não muda depois de publicar.
   2. _Perguntas_: seções (nome e descrição opcionais; renomear, duplicar, mover, excluir) e
      perguntas (até 60 no total) dos 11 tipos abaixo; obrigatória ou não; duplicar, mover e
      excluir; reordenar arrastando ou pelos botões; lógica condicional simples.
   3. _Participantes_: todo o time (colaboradores ativos da empresa) ou escolher pessoas, com busca
      e filtro por departamento; a contagem mostra quantos vão receber.
   4. _Envio e prazo_: o link (aparece ao publicar), encerramento automático por data (ou sem
      prazo) e o mínimo de respostas por grupo nos recortes (padrão 3, de 3 a 10).
   5. _Revisão_: resumo, pré-visualização como quem responde e **Publicar** (a pesquisa fica ativa e
      o link funciona).
4. **Resultados** de cada pesquisa: cabeçalho (nome, status com menu Ativa/Pausada/Finalizada/
   Cancelada, modelo, criada em, identificação, participação), abas:
   - _Visão geral_: por pergunta — média e distribuição (escalas), eNPS (promotores 9–10, neutros
     7–8, detratores 0–6 e o índice), contagem e percentual (escolhas e sim/não), textos (lista).
   - _Por departamento_: média de cada pergunta de escala por departamento; grupos com menos
     respostas que o mínimo aparecem como "Poucas respostas para mostrar".
   - _Respostas_ (só identificada): cada pessoa e as suas respostas.
   - Exportar CSV (respeita a identificação: confidencial e anônima nunca levam nome nem CPF).
5. **Responder pelo link** (página pública, sem login, celular primeiro): abertura (empresa, nome,
   boas-vindas, nº de perguntas, tempo estimado) → identificação (identificada e confidencial:
   CPF + data de nascimento de um participante) → uma seção por vez com progresso → envio →
   agradecimento. Pesquisa pausada, finalizada, cancelada ou vencida mostra o aviso e não aceita
   resposta. Uma resposta por participante (identificada e confidencial).
6. **Aba Pesquisas da ficha**: "Pesquisas respondidas" — as identificadas que a pessoa respondeu
   (nome, modelo, data) com as respostas dela ao abrir. Confidenciais e anônimas nunca aparecem.

### Os 11 tipos de pergunta

| Tipo (`tipo`)      | Configuração (`config`)                                            | Valor da resposta                      |
| ------------------ | ------------------------------------------------------------------ | -------------------------------------- |
| `texto_curto`      | —                                                                  | string (até 300)                       |
| `paragrafo`        | —                                                                  | string (até 3000)                      |
| `escolha_unica`    | `opcoes[]`, `outro` (bool)                                         | `{ opcao: id }` ou `{ outro: string }` |
| `multipla_escolha` | `opcoes[]`, `outro`, `maximo` (opcional)                           | `{ opcoes: id[], outro?: string }`     |
| `sim_nao`          | `respostaBoa`: `"sim"`/`"nao"`/`null`                              | `"sim"` / `"nao"`                      |
| `concordancia`     | — (1 a 5, discordo totalmente → concordo totalmente)               | inteiro 1–5                            |
| `nota_0_10`        | `enps` (bool)                                                      | inteiro 0–10                           |
| `estrelas`         | — (1 a 5)                                                          | inteiro 1–5                            |
| `escala`           | `minimo` (0 ou 1), `maximo` (2–10), `rotuloMinimo`, `rotuloMaximo` | inteiro no intervalo                   |
| `data`             | —                                                                  | `AAAA-MM-DD`                           |
| `numero`           | `minimo`, `maximo` (opcionais), `inteiro` (bool)                   | número                                 |

`opcoes`: `{ id, texto }` (2 a 20, texto até 200). **Lógica condicional**: uma pergunta pode ter
`condicao: { perguntaId, opcaoId }` (para `sim_nao`, `opcaoId` é `"sim"`/`"nao"`) — só aparece para quem
marcou aquela opção numa pergunta **anterior** de escolha única, múltipla escolha ou sim/não. Escondida,
não é exigida; no resultado, mostra quantas pessoas a viram.

## Regras

- **Status:** `rascunho` → `ativa` (Publicar) ⇄ `pausada`; `ativa`/`pausada` → `finalizada` ou
  `cancelada`. Finalizada e cancelada não voltam. Com `encerraEm` vencido, a pesquisa conta como
  finalizada (sem job: calculado na leitura). Só rascunho, ativa e pausada editam.
- **Edição depois de publicar:** nome, boas-vindas, prazo e mínimo por grupo sempre; perguntas só
  enquanto não houver resposta; participantes podem ser incluídos (nunca removidos depois de
  responderem). Identificação nunca.
- **Excluir:** pede confirmação e explica o que se perde; é lógica (some de tudo; o registro e a
  trilha ficam).
- **Duplicar:** copia nome ("cópia"), identificação, perguntas e participantes como rascunho novo.
- **Confidencial:** a resposta não guarda quem respondeu; o participante só fica marcado como
  "respondeu" (com o dia, sem horário) para a participação e para impedir segunda resposta.
- **Mínimo por grupo:** recortes (departamento) com menos respostas que o mínimo não mostram
  números. Vale para todas as identificações.
- **Identificação no link (identificada/confidencial):** CPF + data de nascimento precisam bater com
  um participante ativo da pesquisa; erro genérico ("Não encontramos você nesta pesquisa"), sem dizer
  qual dado falhou; no máximo 5 tentativas erradas por IP e pesquisa em 15 minutos (429). Deu certo:
  o servidor devolve um passe da resposta (aleatório, 32 bytes, 2 horas, uso único) que acompanha o
  envio.
- **Anônima:** sem identificação; o navegador guarda que já respondeu (aviso, não trava).
- **Participação:** respostas ÷ participantes (anônima: respostas ÷ participantes convidados, até
  100%).
- **Privacidade (LGPD):** o RH só vê respostas individuais na identificada; a leitura das respostas
  individuais é auditada; CSV segue a mesma regra.

## Permissões e auditoria

Recurso `pesquisa`: `rh` e `dp` leem, criam e alteram na empresa ativa; `master_tecnico` só lê;
demais papéis negados. Recurso `resposta_pesquisa` (respostas individuais e aba da ficha): `rh` e `dp`
leem. A página pública não usa sessão. Auditoria: pesquisa criada, alterada, publicada, status alterado,
excluída, duplicada; respostas individuais consultadas; resposta recebida (sem conteúdo).

## Contrato da API (`/v1`)

Autenticadas (sessão + CSRF nas escritas, empresa ativa):

| Método e rota                                   | Uso                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `GET /pesquisas?status=&pagina=&tamanhoPagina=` | lista (`ResultadoPaginado<PesquisaResumo>`) + `contagens` por status |
| `POST /pesquisas`                               | cria rascunho (`PesquisaEntrada`) → `PesquisaDetalhe`                |
| `GET /pesquisas/:id`                            | `PesquisaDetalhe` (estrutura completa, participantes, link)          |
| `PUT /pesquisas/:id`                            | atualiza (respeita as regras de edição) → `PesquisaDetalhe`          |
| `POST /pesquisas/:id/publicar`                  | rascunho → ativa (valida estrutura e ≥1 participante)                |
| `POST /pesquisas/:id/status`                    | `{ status }` → `PesquisaDetalhe`                                     |
| `POST /pesquisas/:id/duplicar`                  | `{ empresaId? }` → `PesquisaDetalhe` (ativa; ver revisão no fim)     |
| `DELETE /pesquisas/:id`                         | exclusão lógica (204)                                                |
| `GET /pesquisas/:id/resultados?departamentoId=` | `ResultadosPesquisa` (agregados)                                     |
| `GET /pesquisas/:id/respostas`                  | só identificada: respostas por pessoa (auditado)                     |
| `GET /colaboradores/:id/pesquisas`              | aba da ficha: identificadas respondidas, com as respostas            |

Públicas (sem sessão; token da pesquisa na rota):

| Método e rota                                | Uso                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `GET /publico/pesquisas/:token`              | abertura e estrutura (sem participantes) ou `{ indisponivel: motivo }` |
| `POST /publico/pesquisas/:token/identificar` | `{ cpf, dataNascimento }` → `{ passe, primeiroNome }`                  |
| `POST /publico/pesquisas/:token/respostas`   | `{ passe?, respostas: [{ perguntaId, valor }] }` → 201                 |

Erros seguem o padrão do sistema: 422 com `erros: [{ campo, motivo }]`, 404 para pesquisa
inexistente/excluída/de outra empresa, 409 para transição de status inválida ou resposta repetida.

## Fora de escopo (próximas fatias)

- Avaliações respondidas pelo gestor (90° e 180°) — dependem do acesso do gestor.
- Convite e lembretes por e-mail — o Evolli ainda não envia e-mail; nesta entrega o envio é pelo link.
- Instrumentos de terceiros com licença própria (questionários padronizados de riscos psicossociais,
  saúde financeira e perfil comportamental). Para a NR-1, a empresa decide o instrumento; o módulo
  aceita a pesquisa personalizada.
- Análise por IA, evolução entre pesquisas e envio automático por tempo de casa.
- Banco de perguntas reutilizáveis.

## Apêndice — tipos do contrato (JSON)

```ts
type Identificacao = "identificada" | "confidencial" | "anonima";
type StatusPesquisa =
  "rascunho" | "ativa" | "pausada" | "finalizada" | "cancelada";
type Modelo =
  | "pulso"
  | "clima"
  | "enps"
  | "onboarding"
  | "desligamento"
  | "beneficios"
  | "treinamento"
  | "personalizada";
type TipoPergunta =
  | "texto_curto"
  | "paragrafo"
  | "escolha_unica"
  | "multipla_escolha"
  | "sim_nao"
  | "concordancia"
  | "nota_0_10"
  | "estrelas"
  | "escala"
  | "data"
  | "numero";

interface Opcao {
  id: string;
  texto: string;
} // id: gerado pelo cliente (até 40)
interface ConfigPergunta {
  opcoes?: Opcao[];
  outro?: boolean;
  maximo?: number; // escolhas
  respostaBoa?: "sim" | "nao" | null; // sim_nao
  enps?: boolean; // nota_0_10
  minimo?: number;
  rotuloMinimo?: string;
  rotuloMaximo?: string; // escala/numero (+ maximo)
  inteiro?: boolean; // numero
}
interface Pergunta {
  id: string; // gerado pelo cliente (uuid); estável entre gravações
  tipo: TipoPergunta;
  texto: string; // 1..300
  descricao: string | null; // até 500
  obrigatoria: boolean;
  config: ConfigPergunta;
  condicao: { perguntaId: string; opcaoId: string } | null;
}
interface Secao {
  id: string;
  titulo: string | null;
  descricao: string | null;
  perguntas: Pergunta[];
}

// POST/PUT /pesquisas
interface PesquisaEntrada {
  nome: string; // 1..120
  boasVindas: string | null; // até 1000
  modelo: Modelo;
  identificacao: Identificacao; // ignorado no PUT depois de publicar (422 se mudar)
  secoes: Secao[]; // 1..20 seções; 0..60 perguntas no total (publicar exige ≥1)
  participantes: { todos: true } | { todos: false; colaboradorIds: string[] };
  encerraEm: string | null; // AAAA-MM-DDTHH:mm (Brasília), ≥ agora; só a data = 23:59
  minimoPorGrupo: number; // 3..10
}

interface PesquisaResumo {
  id: string;
  nome: string;
  modelo: Modelo;
  identificacao: Identificacao;
  status: StatusPesquisa; // já considera encerraEm vencido (finalizada)
  participantes: number;
  respostas: number;
  criadaEm: string; // ISO
  publicadaEm: string | null;
  encerraEm: string | null; // ISO com fuso de Brasília, ex.: 2026-12-01T18:30:00-03:00
  link: string | null; // caminho público "#/p/<token>" (só depois de publicar)
}
interface PesquisaDetalhe extends PesquisaResumo {
  boasVindas: string | null;
  secoes: Secao[];
  minimoPorGrupo: number;
  todos: boolean; // participantes = todos os ativos (resolvido ao publicar)
  participantesLista: {
    colaboradorId: string;
    nome: string;
    departamento: string | null;
    respondeu: boolean | null;
    identificavel: boolean; // tem CPF e nascimento na ficha (o link exige); anônima: sempre true
  }[];
  // respondeu: null na anônima; na confidencial só true/false
  naoIdentificaveis: number; // participantes com identificavel=false (0 na anônima); CPF e data nunca saem
  participantesTotal: number | null; // painel da edição; os três são null na anônima
  responderam: number | null;
  pendentes: number | null;
  temRespostas: boolean;
}
// GET /pesquisas → ResultadoPaginado<PesquisaResumo> & { contagens: Record<"todas"|StatusPesquisa, number> }

interface ResultadosPesquisa {
  pesquisaId: string;
  respostas: number;
  participantes: number;
  departamentos: {
    id: string;
    nome: string;
    respostas: number;
    visivel: boolean;
  }[];
  filtro: { departamentoId: string | null; visivel: boolean }; // visivel=false: abaixo do mínimo
  perguntas: ResultadoPergunta[]; // vazio quando filtro.visivel=false
}
type ResultadoPergunta = {
  perguntaId: string;
  tipo: TipoPergunta;
  respondidas: number;
  viram: number;
} & (
  | {
      media: number | null;
      distribuicao: { valor: number; quantidade: number }[];
    } // escalas/estrelas/nota/numero
  | {
      enps: {
        promotores: number;
        neutros: number;
        detratores: number;
        indice: number | null;
      };
    } // + media/distribuicao quando enps
  | { opcoes: { opcaoId: string; quantidade: number }[]; outros: string[] } // escolhas
  | { sim: number; nao: number }
  | { textos: { texto: string; autor: string | null }[] } // autor só na identificada
  | { datas: { valor: string; quantidade: number }[] }
);

// GET /pesquisas/:id/respostas (só identificada)
interface RespostaIndividual {
  colaboradorId: string;
  nome: string;
  departamento: string | null;
  respondidaEm: string;
  valores: { perguntaId: string; valor: unknown }[];
}

// GET /colaboradores/:id/pesquisas
interface PesquisaDaFicha {
  pesquisaId: string;
  nome: string;
  modelo: Modelo;
  respondidaEm: string;
  secoes: Secao[];
  valores: { perguntaId: string; valor: unknown }[];
}

// Públicas
interface PesquisaPublica {
  empresa: string;
  nome: string;
  boasVindas: string | null;
  modelo: Modelo; // a personalizada mostra uma seção por vez
  identificacao: Identificacao;
  totalPerguntas: number;
  minutosEstimados: number; // 20 s por pergunta, arredondado ao minuto mais próximo; mínimo 1
  secoes: Secao[];
}
type AberturaPublica =
  | PesquisaPublica
  | {
      indisponivel:
        | "pausada"
        | "finalizada" // encerrada à mão
        | "encerrada" // prazo vencido
        | "cancelada"
        | "inexistente";
    };
// POST identificar → { passe: string; primeiroNome: string }  (401 genérico; 429 limite; 409 já respondeu)
// POST respostas   → 201 { ok: true }  (422 erros por perguntaId; 409 já respondeu; 410 indisponível)
```

## Ampliação de 27/11/2026 (revisão do fluxo e dos resultados)

Decisões:

- **Modelos prontos em 3 etapas** (Configurar → Colaboradores → Enviar, barra horizontal); a anônima
  fica em 2 (sem participantes: quem tiver o link responde; a participação mostra só as respostas e
  "link aberto"). A Personalizada mantém as 5 etapas.
- **Anônima com separação por grupo:** até 2 campos (`departamento`, `centroCusto`, `unidade`) que quem
  responde escolhe antes das perguntas ("Prefiro não informar" permitido); os recortes da anônima usam
  essa escolha, sempre com o mínimo por grupo.
- **Uma pergunta por tela** na resposta pelo link, com barra de progresso.
- **Respostas individuais:** identificada (com o nome) e anônima (numeradas "#1, #2…", sem pessoa);
  a confidencial nunca as mostra.
- **Rótulo curto por pergunta** (`rotulo`, até 40) para as tabelas de análise.
- **Indicadores e faixas:** média geral (média das perguntas de escala, na escala 0–10), maior e menor
  média, "% favorável" por pergunta (escala 1–10 e nota: 8 a 10; concordância e estrelas: 4 e 5;
  escala personalizada: o terço superior) e as três faixas da distribuição; eNPS com zona (crítica
  < 0, aperfeiçoamento 0–49, qualidade 50–74, excelência 75–100).
- **Análises:** mapa de médias por grupo (departamento, centro de custo ou unidade) × pergunta, com a
  linha "Toda a empresa" e grupos abaixo do mínimo ocultos; evolução da média geral entre pesquisas do
  mesmo modelo.
- **Exportação:** Excel (.xlsx, todas as respostas permitidas pela identificação + resultados) e PDF
  (relatório dos resultados), gerados no navegador.

Contrato (acréscimos):

```ts
type CampoGrupo = "departamento" | "centroCusto" | "unidade";
interface Pergunta {
  /* … */ rotulo: string | null;
} // até 40
interface PesquisaEntrada {
  /* … */ separarPor: CampoGrupo[];
} // 0..2; só na anônima (senão 422)
// Anônima: `participantes` é ignorado; PesquisaResumo.participantes = null; publicar não exige participante.

interface PesquisaPublica {
  /* … */
  grupos: {
    campo: CampoGrupo;
    rotulo: string;
    opcoes: { id: string; nome: string }[];
  }[];
}
// POST /publico/pesquisas/:token/respostas → { passe?, grupos?: Partial<Record<CampoGrupo, string | null>>, respostas }

interface ResultadosPesquisa {
  /* … */
  indicadores: {
    mediaGeral: number | null;
    perguntasDeEscala: number;
    maiorMedia: { perguntaId: string; media: number } | null;
    menorMedia: { perguntaId: string; media: number } | null;
    enps: {
      indice: number;
      zona: "critica" | "aperfeicoamento" | "qualidade" | "excelencia";
      promotores: number;
      neutros: number;
      detratores: number;
    } | null;
  };
  recortes: CampoGrupo[]; // filtros disponíveis (anônima: os de separarPor)
}
// GET /pesquisas/:id/resultados?campo=<CampoGrupo>&grupoId=<id>  (departamentoId continua aceito)
// Perguntas de escala/nota/estrelas ganham: favoravel: number | null (0–100); faixas: { baixa; media; alta }
// eNPS ganha: zona

// GET /pesquisas/:id/analises?campo=<CampoGrupo>
interface AnalisesPesquisa {
  campo: CampoGrupo;
  colunas: { perguntaId: string; rotulo: string }[];
  linhas: {
    grupoId: string | null;
    nome: string;
    respostas: number;
    visivel: boolean;
    media: number | null;
    medias: (number | null)[];
  }[]; // 1ª linha: "Toda a empresa" (grupoId null)
  evolucao: {
    pesquisaId: string;
    nome: string;
    publicadaEm: string;
    mediaGeral: number | null;
  }[];
}

// GET /pesquisas/:id/respostas  (identificada e anônima; confidencial → 404)
interface RespostaResumo {
  id: string;
  numero: number;
  colaboradorId: string | null;
  nome: string | null;
  departamento: string | null;
  respondidaEm: string;
  media: number | null;
  grupos: {
    campo: CampoGrupo;
    grupo: string | null;
    oculto: "minimo" | "protege_grupo_menor" | null;
  }[]; // só na anônima com separar por (senão []); grupo oculto → grupo null + motivo
}
// GET /pesquisas/:id/respostas/:respostaId
interface RespostaDetalhe extends RespostaResumo {
  anteriorId: string | null;
  proximaId: string | null;
  posicao: number;
  total: number;
  valores: { perguntaId: string; valor: unknown; mediaTime: number | null }[];
  indicadores: {
    media: number | null;
    mediaTime: number | null;
    mediaUltimosPulsos: number | null; // mesma pessoa, pesquisas anteriores do mesmo modelo; só identificada
    recomendacao: number | null;
    enpsTime: number | null;
    maior: { perguntaId: string; valor: number } | null;
    menor: { perguntaId: string; valor: number } | null;
  };
}
// A aba da ficha abre o RespostaDetalhe da pessoa (GET /colaboradores/:id/pesquisas devolve também respostaId).
```

Notas da implementação (API):

- `ResultadosPesquisa.participantes` também é `null` na anônima (como no resumo).
- Acréscimos em `ResultadosPesquisa`: `grupos` (os grupos de cada recorte disponível, no formato de
  `departamentos`) e `filtro.campo`/`filtro.grupoId` (além de `departamentoId`). Recorte fora dos
  disponíveis responde `visivel=false` e sem números; `analises` com `campo` fora deles é 422.
- `PesquisaDetalhe.separarPor` devolve os campos gravados. `separarPor` muda só enquanto não houver
  resposta (409 `com_respostas`), como as perguntas.
- Perguntas de escala da média geral: concordância, estrelas, escala e a nota 0–10 sem eNPS. A
  conversão para 0–10 é proporcional ao máximo (`valor × 10 ÷ máximo`); `maiorMedia`/`menorMedia` e o
  mapa das análises também vão em 0–10. Faixas: escalas de 5 pontos 1–2 · 3 · 4–5; as demais em terços
  (1–10 e 0–10: favorável 8 a 10).
- `RespostaDetalhe.valores[].mediaTime` vai na escala da própria pergunta (escalas e número; `null`
  nas demais). Na anônima, `RespostaResumo.departamento` é `null` (a escolha de grupo não aparece por
  resposta).

Revisão lado a lado (27/11/2026):

- **Encerramento com hora:** `encerraEm` entra como `AAAA-MM-DDTHH:mm` no horário de Brasília (só a
  data ainda é aceita e vale até 23:59) e sai em ISO com o fuso (`-03:00`). Precisa ser no futuro; o
  vencimento compara com o instante atual. Os prazos já gravados (só a data) viraram 23:59 daquele dia.
- **Duplicar:** `POST /pesquisas/:id/duplicar` com `{ empresaId? }` (destino; padrão a empresa ativa;
  empresa que a conta não acessa → 403). A cópia nasce **ativa** (publicada, link novo), com
  "(cópia)" no nome e as mesmas perguntas, identificação, separação e prazo (vencido: sem prazo).
  Participantes: mesma empresa → os mesmos; outra → todo o time ativo dela; anônima → nenhum. Sem
  pergunta ou sem participante: 422 como no publicar. Responde 201 com o `PesquisaDetalhe`; auditado
  na empresa de destino.
- **Textos sem autor** (confidencial, anônima e a leitura do master) saem em ordem alfabética, assim
  como os "outro" das escolhas; na identificada, a ordem de chegada com o autor.
- **Respostas individuais:** a lista sai da mais recente para a mais antiga (`numero` = ordem de
  chegada, #1 a primeira); `anteriorId`/`proximaId`/`posicao` seguem a ordem da lista.

Lacunas das telas (27/11/2026):

- **`RespostaDetalhe.indicadores.mediaUltimosPulsos`:** a média geral (0–10) das respostas da mesma
  pessoa nas pesquisas anteriores do mesmo modelo (não excluídas, identificadas e publicadas antes
  desta): a média de cada resposta nas perguntas de escala e, delas, a média. `null` sem anterior e
  sempre na anônima (não há como ligar a pessoa).
- **`GET /pesquisas/candidatos`** (leitura de pesquisa; antes de `/:id`), para "Escolher pessoas":

```ts
// GET /pesquisas/candidatos?busca=&departamentoId=&centroCustoId=&unidadeId=&pagina=&tamanhoPagina=
// Colaboradores ativos da empresa ativa (sem os desativados), pela lotação vigente, por nome.
// busca: parte do nome, sem diferenciar maiúsculas; filtros por id (uuid).
type ListaDeCandidatos = ResultadoPaginado<{
  colaboradorId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  centroCusto: string | null;
  unidade: string | null;
}>;
```

Segunda revisão (27/11/2026):

- **Supressão secundária (privacidade):** além do grupo abaixo do mínimo (`oculto: "minimo"`), o que
  não aparece — grupos ocultos e as respostas sem grupo — precisa ter ao menos duas partes; senão o
  total menos os grupos visíveis daria o grupo oculto. Enquanto houver uma parte só, o MENOR grupo
  visível também fica oculto (`oculto: "protege_grupo_menor"`). Vale por campo em
  `ResultadosPesquisa.grupos`/`departamentos` (`DepartamentoDoResultado.oculto`), no recorte filtrado
  (`filtro.visivel`), nas linhas das análises (`linhas[].oculto`) e no grupo de cada resposta da
  anônima (`RespostaResumo.grupos`). A contagem de respostas de cada grupo continua visível.
- **`filtro.respostas`:** as respostas do recorte (sem filtro, o total).
- **Publicar sem ninguém identificável:** na identificada e na confidencial, se nenhum participante
  tem CPF e nascimento no perfil, `POST /pesquisas/:id/publicar` responde 422
  `{ campo: "participantes", motivo: "ninguem_identificavel" }`; reenviar com
  `{ confirmarSemIdentificaveis: true }` publica mesmo assim.
- **Evolução** (análises): só as pesquisas que têm respostas.
- **`GET /pesquisas/candidatos/contagem`** (leitura de pesquisa), para "Todo o time" sem baixar a
  lista: `{ total: number; departamentos: { departamentoId: string | null; departamento: string |
null; quantidade: number }[] }` (por departamento da lotação vigente; `null` = sem departamento; a
  soma é o total).

## Modelos da galeria completa e cálculo próprio (frente M1, 27/11/2026)

Decisões:

- **Galeria de 12 modelos** em 4 categorias (Clima e engajamento 6 · Saúde e NR-1 2 · Desempenho 2 ·
  Outros 2): Pesquisa Pulso, Pulso e Clima, Pesquisa de Clima, eNPS, Pesquisa de Onboarding, Motivação
  (TAD), Riscos psicossociais (NR-1), Saúde financeira, Avaliação 90°, Avaliação 180°, Perfil
  comportamental (DISC) e Personalizada. Quadro "Precisa cumprir a NR-1?" (o botão filtra os 2 modelos de
  Saúde e some). Selos: Novo, NR-1, Complementa NR-1 (e "Recomendado para começar" só na página
  inicial). Ícones Bulk do sistema por modelo e por fato do card; tons em `tokens.css`
  (`--modelo-<tom>` e `--modelo-<tom>-fundo`).
- **Registro na tela:** `apps/web/src/screens/pesquisas/modelos/indice.ts` (ordem dos cards), com um
  catálogo por modelo em `modelos/<id>/catalogo.ts` (card, gaveta, assistente e a página "Sobre o
  modelo"). Os modelos das outras frentes (riscos psicossociais, saúde financeira, 90°, 180° e DISC) já
  têm card, gaveta (grupos e quantidades) e página; a frente de cada um preenche `secoes` no próprio
  catálogo. Telas de resultado: `modelos/resultados.tsx`; abas da planilha: `modelos/exportacao.ts`.
- **Registro na API:** `apps/api/src/pesquisas/modelos/indice.ts` (`MODELOS_REGISTRADOS`): metodologia
  fixa conferida ao gravar, cálculo agregado e individual. Uma entrada por modelo.
- **Metodologia fixa** (Pulso e Clima, Pesquisa de Clima, TAD): o assistente mostra as perguntas em
  acordeões (por dimensão; a TAD por pilar) sem editar; a API recusa estrutura fora do modelo.
- **Textos próprios:** os enunciados são do Evolli e medem o mesmo ponto de cada item (mesma chave,
  ordem e grupo); a empresa pode trocar os textos depois. O marcador `{empresa}` vira o nome da empresa
  para quem responde (sem nome, e no painel, "nossa empresa").
- **Pulso:** 5 afirmações de 1 a 10, eNPS e comentário curto opcional; de 1 a 15 perguntas.
- **Pulso e Clima:** 22 afirmações de 1 a 5 em 8 dimensões, LNPS e eNPS (0 a 10) e um comentário
  opcional por dimensão e por recomendação. Score 0–100 por afirmação (`(média − 1) ÷ 4 × 100`), por
  dimensão (média das afirmações) e geral (média das 22); faixas crítico < 50 · atenção 50–69 ·
  saudável 70–84 · forte ≥ 85; eNPS e LNPS com crítico < 0 · em ajuste 0–29 · bom 30–69 · excelente ≥ 70.
- **Pesquisa de Clima:** 60 afirmações (5 dimensões × 3 subdimensões × 4) e 2 abertas; % favorável
  (4–5), neutro e desfavorável por dimensão e subdimensão, com a faixa pelo % favorável.
- **eNPS:** a principal (0 a 10), 5 complementares de 1 a 5 e 2 abertas; as zonas do eNPS de sempre.
- **Motivação (TAD):** 21 afirmações de 1 a 7 (os 7 pontos com rótulo), 9 invertidas (`8 − resposta`);
  pilar = média dos itens; geral = média dos 3 pilares; time = média das pessoas; alto ≥ 5,5 · moderado
  3,5 a 5,49 · baixo < 3,5. A pessoa tem o próprio resultado (resultado individual).
- **Onboarding:** catálogo das 17 perguntas em 8 blocos (escalas de 4 pontos); o envio automático
  30/60/90 e o resultado por rodada ficam com a frente do Onboarding.
- **Personalizada:** 6 modelos prontos (Onboarding · 30 dias, Experiência · 90 dias, Avaliação 180°,
  Satisfação com benefícios, Avaliação de treinamento, Entrevista de desligamento) e 13 tipos de
  pergunta. Os formatos com gestor aparecem no card; responder pelo gestor depende do acesso do gestor.
- **Exportação:** a planilha ganha, logo depois do Resumo, a aba do modelo ("Dimensões" no Pulso e
  Clima e no Clima; "Pilares" na TAD).

Perfil comportamental (DISC) — modelo `disc` (27/11/2026):

- **Questionário:** 28 blocos de escolha forçada, textos do Evolli (`modelos/disc/blocos.ts` na tela). Cada
  bloco tem o enunciado fixo e 4 frases, uma por fator (D, I, S, C); quem responde escolhe a que mais
  combina com ela. A página de resposta embaralha as frases de cada bloco (ordem estável por bloco). A
  empresa pode trocar os textos mantendo o fator de cada frase. Os blocos não são editáveis no assistente.
- **Cálculo** (`apps/api/src/pesquisas/modelos/disc/calculo-disc.ts`): 1 ponto por bloco no fator da
  frase; percentual `round(pontos ÷ blocos respondidos × 100)`; predominante pelo maior número de pontos
  (empate D, I, S, C). Classificação sobre os percentuais ordenados: mono (1º ≥ 45 e 15 à frente; puro
  ≥ 60, acentuado ≥ 50, moderado), bi (1º − 2º < 15 e 2º − 3º ≥ 10; acentuado com 1º ≥ 40), tri
  (1º − 3º < 20, equilibrado), senão bi moderado. Mapa de talentos: `x = 50 + ((S+C) − (D+I)) ÷ 2`,
  `y = 50 − ((I+S) − (D+C)) ÷ 2`, limitados a 2..98, em 13 áreas. Time: soma dos pontos de todas as
  pessoas; pessoas por predominante; intensidades; diversidade = entropia de Shannon da distribuição de
  pessoas por predominante ÷ 2 × 100 (um só critério, também na planilha), faixas 0–39/40–59/60–79/
  80–100; fatores ausentes; lacunas (< 20% das pessoas, até 2); compatibilidade por pares de pessoas
  (mesmo fator n(n−1)/2, fatores diferentes nA × nB; mesmo fator = mesma linguagem, atrito D×S e I×C =
  pede atenção, demais = complementar).
- **Resultado da própria pessoa:** logo depois do envio, na página pública, calculado no navegador pela
  mesma regra (percentuais e predominante); nada é gravado; "Salvar em PDF" usa a impressão.
- **Fora desta fatia:** análise por IA, gestor × time e líderes × demais (dependem da hierarquia).

Contrato (acréscimos):

```ts
type TipoPergunta = /* … */ "concordancia_4" | "satisfacao_4"; // 1 a 4, sem meio-termo (3 e 4 favoráveis)
interface Pergunta {
  /* … */ chave?: string | null; // item do modelo (formato dos ids, até 40)
}
interface ConfigPergunta {
  /* … */
  lnps?: boolean; // nota_0_10: recomendação da liderança (nunca junto com enps)
  rotuloMinimo?: string | null; // também na nota_0_10
  rotuloMaximo?: string | null;
  rotulos?: string[] | null; // escala: um rótulo por ponto (máximo − mínimo + 1)
}
// Teto de perguntas: 100 (a Pesquisa de Clima tem 62).
// POST/PUT /pesquisas num modelo de metodologia fixa com estrutura fora do modelo:
//   422 { campo: "secoes", motivo: "estrutura_do_modelo" }
interface IndicadoresPesquisa {
  /* … */ lnps?: IndicadorNps | null; // só com pergunta de LNPS; o LNPS fica fora da média geral
}
interface ResultadosPesquisa {
  /* … */ modelo?: ResultadoDoModelo | null; // null sem respostas visíveis ou sem cálculo próprio
}
interface RespostaDetalhe {
  /* … */ modelo?: ResultadoIndividualDoModelo | null;
}

type FaixaDeScore = "critico" | "atencao" | "saudavel" | "forte";
type FaixaDeRecomendacao = "critico" | "em_ajuste" | "bom" | "excelente";
interface RecomendacaoDoModelo {
  perguntaId: string | null;
  respostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  indice: number | null;
  faixa: FaixaDeRecomendacao | null;
  distribuicao: { valor: number; quantidade: number }[]; // 0 a 10
}
interface AfirmacaoDoModelo {
  chave: string;
  perguntaId: string;
  dimensao: string;
  subdimensao: string | null;
  respostas: number;
  media: number | null; // 1 a 5
  score: number | null; // 0 a 100
  favoravel: number | null; // %
  neutro: number | null;
  desfavoravel: number | null;
}
interface DimensaoDoModelo {
  chave: string;
  rotulo: string;
  afirmacoes: number;
  respostas: number;
  score: number | null;
  faixa: FaixaDeScore | null; // pelo score (Pulso e Clima) ou pelo % favorável (Clima)
  favoravel: number | null;
  neutro: number | null;
  desfavoravel: number | null;
  comentarios: number;
  subdimensoes?: DimensaoDoModelo[]; // Clima
}
type NivelTad = "alto" | "moderado" | "baixo";
interface PilarTad {
  chave: string;
  rotulo: string;
  perguntas: number;
  score: number | null; // 1 a 7
  nivel: NivelTad | null;
}
type ResultadoDoModelo =
  | {
      modelo: "pulso_clima";
      score: number | null;
      faixa: FaixaDeScore | null;
      favoravel: number | null;
      neutro: number | null;
      desfavoravel: number | null;
      dimensoes: DimensaoDoModelo[];
      afirmacoes: AfirmacaoDoModelo[];
      enps: RecomendacaoDoModelo;
      lnps: RecomendacaoDoModelo;
      comentarios: {
        dimensao: string;
        perguntaId: string;
        quantidade: number;
      }[];
    }
  | {
      modelo: "clima";
      favoravel: number | null;
      neutro: number | null;
      desfavoravel: number | null;
      score: number | null;
      faixa: FaixaDeScore | null;
      dimensoes: DimensaoDoModelo[];
      afirmacoes: AfirmacaoDoModelo[];
    }
  | {
      modelo: "tad";
      respondentes: number;
      geral: number | null;
      nivel: NivelTad | null;
      pilares: PilarTad[];
      niveis: Record<NivelTad, number>;
    };
type ResultadoIndividualDoModelo = {
  modelo: "tad";
  geral: number | null;
  nivel: NivelTad | null;
  pilares: PilarTad[];
};
```

Chaves dos itens: Pulso `pulso_*`; Pulso e Clima `pc_ae_01` a `pc_bem_02`, `pc_lnps_01`, `pc_enps_01`
e `__comentario_<dimensão|lnps|enps>__`; Clima `clima_01` a `clima_60` e `clima_aberta_01/02`; eNPS
`enps_*`; Onboarding `q1` a `q17`; TAD `tad_01` a `tad_21`.

Pendências desta frente: na página pública do Pulso e Clima, a abertura de cada dimensão e o
comentário depois da nota seguem como perguntas comuns (uma por tela); a trilha da página "Sobre o
modelo" mostra "Pesquisas / {tema}" (o nível "Nova pesquisa" do meio depende de a trilha aceitar dois
níveis declarados); os comentários do Pulso e Clima ficam na Visão geral (sem aba própria) para não
mexer nas rotas compartilhadas.

type TipoPergunta = /* … */ | "escolha_forcada"; // só no modelo `disc`
interface Opcao { id: string; texto: string; fator?: "D" | "I" | "S" | "C" } // `fator` só nos blocos
// Bloco: config = { opcoes: 4 frases, cada fator uma vez (texto até 200) }; resposta = { opcao: id }.
// POST/PUT /pesquisas com modelo `disc`: exatamente 28 blocos obrigatórios, sem condição
//   (422 `secoes`/`limite`; pergunta de outro tipo, opcional ou com condição: 422 `<id>`/`invalido`).
// Outro modelo com bloco: 422 `<id>`/`nao_se_aplica`. Os resultados comuns contam as frases (`opcoes`).

// GET /pesquisas/:id/perfil-comportamental?campo=&grupoId=   (leitura de pesquisa; outro modelo: 422 `modelo`)
type Pontos = Record<"D" | "I" | "S" | "C", number>;
interface PerfilDisc {
  pontos: Pontos; total: number; percentuais: Pontos; predominante: "D" | "I" | "S" | "C";
  classe: { tipo: "mono" | "bi" | "tri"; fatores: string[]; codigo: string;
            intensidade: "puro" | "acentuado" | "moderado" | "equilibrado" };
  posicao: { x: number; y: number; area: number };
}
interface ResultadoDisc {
  pesquisaId: string; respostas: number; recortes: CampoGrupo[];
  grupos: Partial<Record<CampoGrupo, DepartamentoDoResultado[]>>;
  filtro: { campo: CampoGrupo | null; grupoId: string | null; respostas: number; visivel: boolean };
  perfil: PerfilDisc | null;            // o time; null sem perfis ou com o recorte oculto
  totalDePessoas: number; porPredominante: Pontos;
  intensidades: Record<"puro" | "acentuado" | "moderado" | "equilibrado", number>;
  areas: { area: number; pessoas: number }[];           // da mais cheia para a mais vazia
  diversidade: { score: number; faixa: "pouco_diverso" | "moderado" | "equilibrado" | "altamente_diverso";
                 ausentes: string[] };
  lacunas: string[];
  compatibilidade: { matriz: { a; b; relacao: "sinergia" | "neutro" | "atrito";
                               tipo: "mesma_linguagem" | "complementar" | "pede_atencao"; pares: number }[];
                     totalDePares: number; porTipo: Record<tipo, { pares: number; percentual: number }>;
                     maiorAtencao: { a; b; pares: number } | null };
  pontos: { x: number; y: number; area: number; fator: string }[]; // ordenados pela posição, sem a pessoa
  pessoas: { respostaId: string; numero: number; nome: string | null; departamento: string | null;
             respondidaEm: string; perfil: PerfilDisc }[];
}
// Recorte e mínimo como nos resultados (na confidencial, a visão geral também exige o mínimo).
// `pessoas`: só RH e DP, na identificada (com o nome) e na anônima (numeradas); vazio na confidencial
// e para o master. Com pessoas, a leitura é auditada (`pesquisas_respostas_consultadas`).
```

Tela: registro do modelo em `apps/web/src/screens/pesquisas/modelos/disc/definicao.ts` (`MODELO_DISC`,
para a galeria incluir em `MODELOS_DE_PESQUISA`); resultados, perfil individual, planilha (7 abas) e
relatório em PDF em `modelos/disc/`.
