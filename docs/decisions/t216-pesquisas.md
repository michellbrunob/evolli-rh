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

## Avaliação 90°/180° e Onboarding automático (frente M4, 27/11/2026)

Decisões:

- **Avaliação 90°/180°** (`avaliacao90`, `avaliacao180`): sempre nominal (identificada por CPF +
  nascimento). Catálogo fixo de 24 afirmações (8 competências × 3, escala 1–5 com o rótulo de cada
  ponto), gravado pela API a cada `PUT …/avaliacao` enquanto não houver resposta. Quem avalia quem vem
  da liderança: o gestor de cada pessoa é o gestor (principal; sem principal, o substituto) da equipe
  da lotação vigente. Uma pessoa por time; o gestor nunca se avalia. Na 180°, cada pessoa avaliada que
  tem CPF e nascimento também se autoavalia (sem CPF, só o gestor avalia). Não há a opção de o liderado
  avaliar o gestor (não faz parte destes modelos).
- **Cálculo** (API, `modelos/avaliacao/calculo-avaliacao.ts`): competência = média das 3; nota geral =
  média das 8; eixos Entrega (Responsabilidade, Organização, Proatividade, Resolução de problemas) e
  Pessoas (Comunicação, Trabalho em equipe, Liderança, Adaptabilidade); 1 casa, arredondamento
  simétrico. Níveis Insuficiente 1,0–1,9 · Em desenvolvimento 2,0–2,9 · Bom 3,0–3,9 · Excelente
  4,0–4,4 · Excepcional 4,5–5,0. Mapa de talentos 3×3 (alto ≥ 4, médio 3–3,9, baixo < 3). Calibração:
  média do gestor − média da empresa, com ≥ 5 avaliados; |dif| ≥ 0,4 generoso ou exigente. 180°:
  diferença = autoavaliação − gestor; |dif| < 0,5 alinhada; mapa da conversa com limiar de 1 ponto
  ("bem acima"). Recortes (tempo de casa, departamento) com mínimo de 3. Alertas: as 24 notas iguais e
  notas extremas (< 2,5 ou = 5) sem comentário. Sem plano por IA (o Evolli não tem IA): no lugar, "O
  que desenvolver" (competências < 3) e o roteiro de feedback.
- **Comentários** por competência: opcionais, pedidos nas notas extremas (padrão) ou obrigatórios;
  gravados na resposta como `comentario_<competência>`.
- **Onboarding automático**: envio agora, agendado ou automático aos 30/60/90 dias de casa (padrão
  30 e 60, só em dias úteis — nacionais e feriados locais sem unidade —, 09:00, prazo de 7 dias,
  lembrete 3 dias depois; a anônima não tem lembrete). Público: todos, por grupo (departamento, cargo,
  unidade, centro de custo; todas as condições) ou pessoas escolhidas, conferido ao criar o convite.
  Uma resposta por pessoa e rodada (`pesquisa_resposta.rodada`; 0 = envio único e as demais
  pesquisas). Identificada e confidencial: a rodada sai do convite aberto da pessoa; anônima: do link
  (`#/p/<token>?rodada=30`). Na confidencial, o convite fica "respondido" só com o dia e nada liga o
  convite à resposta; por isso o fluxo da intenção entre rodadas só existe na identificada.
- **Processo periódico** (`ProcessadorDePesquisas`; agendador com `PESQUISAS_AGENDADOR_INTERVALO_MS`,
  padrão 5 minutos, `0` desliga, desligado nos testes): cria os convites até 30 dias antes da data,
  avisa os que venceram no horário, manda o lembrete uma vez e, na avaliação com envio por e-mail,
  o convite de cada participante e os lembretes (7 e 3 dias antes, no dia e depois do prazo, às
  09:00). Idempotente: um convite por pessoa e rodada/marco (único no banco), transições condicionais.
- **E-mail**: o ponto de notificação existe (`NOTIFICADOR_DE_PESQUISAS`), mas sem provedor nada sai:
  o convite fica `aguardando_email` (ou `sem_email`, sem e-mail no cadastro). O e-mail entra na
  próxima etapa do projeto (troca do provedor do token), junto com logo e cores do e-mail personalizado.

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
// POST/PUT /pesquisas com modelo `disc`: metodologia fixa do registro (`modelos/indice.ts`,
// `ESTRUTURA_DISC`): os 28 blocos `chave` `disc_01`…`disc_28`, uma vez cada, obrigatórios
// (senão 422 `secoes`/`estrutura_do_modelo`). Bloco inválido: 422 `<id>`/`invalido`.
// Outro modelo com bloco: 422 `<id>`/`nao_se_aplica`. Os resultados comuns contam as frases (`opcoes`).

// GET /pesquisas/:id/perfil-comportamental?campo=&grupoId= (leitura de pesquisa; outro modelo: 422 `modelo`)
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
perfil: PerfilDisc | null; // o time; null sem perfis ou com o recorte oculto
totalDePessoas: number; porPredominante: Pontos;
intensidades: Record<"puro" | "acentuado" | "moderado" | "equilibrado", number>;
areas: { area: number; pessoas: number }[]; // da mais cheia para a mais vazia
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

Tela: os blocos entram no catálogo (`modelos/disc/catalogo.ts`, `secoes`); as abas de resultado e o
perfil individual próprios são registrados em `modelos/resultados.tsx` (`abasDoModelo`,
`paginaIndividualDoModelo`), porque o resultado vem da rota própria; planilha (7 abas) e relatório em
PDF em `modelos/disc/`.

// Banco: pesquisa.config_modelo (JSON); pesquisa_resposta.rodada (0|30|60|90; único por
// pesquisa+colaborador+rodada); pesquisa_avaliacao_par (avaliador, avaliado, papel
// gestor|autoavaliacao, resposta; único por pesquisa+avaliado+papel); pesquisa_envio (pessoa,
// rodada ou marco, data prevista, situação; único por pesquisa+pessoa+rodada).
// A resposta da avaliação não guarda a pessoa: o par liga avaliado e avaliador.

// ConfigPergunta (escala): rotulos?: string[] (um por ponto, do mínimo ao máximo).

// Avaliação (autenticadas; resultados e ficha pedem resposta_pesquisa e são auditados)
// GET /pesquisas/avaliacoes/organograma → { times: {gestor, pessoas}[], semGestor: {pessoa,
// motivo: "sem_gestor"|"gestor_sem_cpf"|"gestor_inativo", gestorNome}[], ativos }
// (pessoa: { id, nome, cargo, departamento, identificavel, temEmail }; sem CPF nem e-mail)
// GET /pesquisas/:id/avaliacao → { config, prazo, times, totais, lembretes, convites }
// PUT /pesquisas/:id/avaliacao { config?: ConfigAvaliacao, times: { gestorId, avaliadoIds[] }[] }
// 422 times: repetida | indisponivel | gestor_nao_identificavel | invalido | sem_pessoas;
// prazoAutoavaliacao: fora_do_prazo | fora_de_ordem | nao_se_aplica; 409 times com_respostas
// GET /pesquisas/:id/avaliacao/resultados → time, pessoas, itens, calibracao, recortes, comparativo
// GET /pesquisas/:id/avaliacao/pessoas/:colaboradorId → gestorAvaliacao, autoavaliacao,
// comparativo, roteiro, desenvolver, time
// GET /colaboradores/:id/avaliacoes → { pesquisaId, nome, modelo, respondidaEm, gestor, geral,
// nivel, autoavaliacao }[]
interface ConfigAvaliacao {
comentarios: "opcionais" | "extremos" | "obrigatorios"; // padrão: extremos
liberarNoPortal: boolean;
visibilidade: "depois_do_gestor" | "so_rh"; // só na 180°
prazoAutoavaliacao: string | null; // 180°: AAAA-MM-DDTHH:mm, ≥ 1 h e antes do prazo
lembretes: ("7_dias" | "3_dias" | "no_dia" | "depois")[];
envio: "email" | "link";
}
// Públicas (depois de POST …/identificar)
// POST /publico/pesquisas/:token/avaliacao/pendentes { passe } → { modelo, comentarios, prazo,
// prazoAutoavaliacao, itens: { parId, papel, avaliado: {nome, cargo}, respondida, aberta,
// comparativo }[] } (comparativo: 180°, gestor que já enviou, visibilidade depois_do_gestor)
// POST /publico/pesquisas/:token/avaliacao/pares/:parId { passe, respostas (24), comentarios? }
// → 201 { ok, restantes }; o passe vale até a última avaliação da pessoa (2 horas).

// Onboarding (autenticadas)
// GET /pesquisas/:id/onboarding → { config, ativa, ativadaEm, publico, proximas, funil,
// proximoEnvio, link }
// PUT /pesquisas/:id/onboarding { config: ConfigOnboarding } (o modo não muda depois de ativar)
// POST /pesquisas/onboarding/publico { publico, soDiasUteis } → { total, semEmail, proximas, pessoas }
// POST /pesquisas/:id/onboarding/ativar → ativa sem exigir participante (no lugar de /publicar)
// GET /pesquisas/:id/onboarding/envios → { identificacao, horario, itens: { id, colaboradorId,
// nome, rodada, dataPrevista, prazo, situacao, enviadoEm, lembreteEm }[] }
// POST /pesquisas/:id/onboarding/envios/:envioId/pular → 204 (só agendado; senão 409)
// GET /pesquisas/:id/onboarding/resultados?campo=&grupoId= → rodadas, comparacoes, peso, fluxo,
// contatos, melhorar, gosta, funil, grupos
interface ConfigOnboarding {
modo: "agora" | "agendar" | "automatizar";
rodadas: (30 | 60 | 90)[];
horario: string; // 06:00 a 21:00, de 30 em 30 minutos
agendadoPara: string | null;
prazoDias: 3 | 5 | 7 | 10 | 15;
lembreteDias: 2 | 3 | 5 | null;
soDiasUteis: boolean;
incluirAtrasados: boolean;
publico:
| { tipo: "todos" }
| { tipo: "pessoas"; colaboradorIds: string[] }
| {
tipo: "grupo";
condicoes: {
campo: "departamento" | "cargo" | "unidade" | "centroCusto";
operador: "e" | "uma_destas";
valores: string[];
}[];
};
email: {
modelo: "padrao" | "personalizado";
assunto: string | null; // até 80
titulo: string | null; // até 60
mensagem: string | null; // até 600
};
}
// Pública: POST /publico/pesquisas/:token/onboarding/respostas { passe?, rodada?, grupos?,
// respostas } → 201 { ok, rodada }; 409 rodada já respondida; 410 sem convite aberto.

```

Registro: na API, a avaliação entra em `modelos/indice.ts` com a metodologia fixa (as 24
afirmações pela `chave`, escala 1–5, obrigatórias; 422 `estrutura_do_modelo`); o onboarding acha os
papéis pela `chave` do item (`q12`…`q17`) e conta no índice os tipos `concordancia_4` e
`satisfacao_4` (e a escala de 1 a 4). Na tela, as 24 afirmações preenchem `secoes` dos cards em
`modelos/avaliacao90/catalogo.ts` e `modelos/avaliacao180/catalogo.ts` (de
`modelos/avaliacao/catalogo.ts`), o Onboarding usa o catálogo da galeria
(`modelos/onboarding/catalogo.ts`) e as telas próprias (`modelos/{avaliacao,onboarding}/`) entram
por `modelos/resultados.tsx` (resultados inteiros, no lugar das abas) e pela rota
`#/pesquisas/nova/<modelo>` (assistente próprio, `modelos/integracao.tsx`).

````

## Modelos com metodologia própria: Riscos psicossociais (NR-1) e Saúde financeira (27/11/2026)

Os dois modelos seguem o registro da frente M1: API em `modelos/<id>/` (definição, cálculo puro com
testes) e a entrada em `modelos/indice.ts`; tela em `modelos/<id>/catalogo.ts` (as perguntas, com a
chave de cada item) e `modelos/resultados.tsx` (Visão geral e resultado individual), com as abas a
mais em `modelos/registro.tsx`.

**Estrutura (metodologia fixa, conferida pela chave):**

- NR-1 (`copsoq`): 76 escalas de 1 a 5 (`Q1`…`Q76`), obrigatórias, cada uma com os 5 rótulos
  (`config.rotulos`) da sua escala (frequência, intensidade, concordância, satisfação, saúde). Valor
  gravado = posição do ponto como aparece; `Q53`, `Q54` e a escala de saúde (exibida do melhor para o
  pior) pontuam `6 − posição`.
- Saúde financeira (`isfb`): `Q1`, `Q14`, `Q15` escolha única (5, 7 e 6 opções), `Q13` múltipla (14,
  opcional: sem produto, segue), `Q2`–`Q12` escalas de 0 a 4 com rótulos (`Q2`–`Q4` pontuam
  `4 − posição`) e a autopercepção `O1`–`O3` (opcional na estrutura: o assistente tem o interruptor).
  As opções valem pela **posição** (os ids são gerados pela tela; a ordem é a da metodologia).
- `config.somenteRotulos` (escala com `rotulos`): a resposta pelo link mostra só os rótulos, em lista.

**Resultado** em `ResultadosPesquisa.modelo` (sobre as respostas visíveis do recorte) e o da pessoa em
`RespostaDetalhe.modelo` (comparado com o time). O cálculo recebe um contexto
(`ContextoDoModelo { sigilo; minimoPorGrupo }`): fora da identificada (e para quem não vê o autor), as
contagens de comportamentos ofensivos abaixo do mínimo por grupo viram `null` ("menos de N pessoas").

```ts
// ResultadosPesquisa.modelo
type ResultadoNr1 = {
  modelo: "copsoq";
  respostas: number;
  dimensoes: {
    id; dominio; tipo: "risco" | "protecao"; pessoas; escore: number | null; // 1–5, 2 casas
    tercil: 1 | 2 | 3 | null; faixa: "risco" | "intermediario" | "favoravel" | null;
    distribuicao: Record<Faixa, number>; percentuais: Record<Faixa, number>;
    severidade: 1 | 2 | 3 | 4 | null; prevalencia: 1 | 2 | 3 | 4 | null;
    nivel: "critico" | "alto" | "medio" | "baixo" | null; regraDeProtecao: boolean;
  }[];
  prioridades: string[]; niveis: Record<Nivel, number>; precisamDeAcao: number;
  matriz: string[][][]; // linhas: severidade 4→1; colunas: prevalência 1→4
  dominios: { id; dimensoes; precisamDeAcao; percentualEmRisco: number | null }[];
  saude: { id; pessoasEmRisco; pessoas; percentualEmRisco; nivel }[];
  ofensivos: { pessoas; relataram: number | null; percentual: number | null;
    tipos: { id; raramente; asVezes; frequentementeOuSempre; relataram }[] }; // null = sigilo
  pressao: number | null; recursos: number | null; // médias dos escores (exigências × apoio)
};
type ResultadoIsfb = {
  modelo: "isfb"; pessoas; isfb: number | null; faixa; diferencaDoBrasil; mediaDoBrasil: 56.7;
  dimensoes: { id; nota; faixa; pessoas }[]; distribuicao: number[]; // 20 faixas de 5 pontos
  saude; sinais; sinaisAcumulados: number[]; perfis; pontoDoTime; perguntas; produtos; base;
  creditoReserva; temas; aberturas; comAutopercepcao;
  porRenda: { id; respostas; visivel; oculto; saude | null }[]; // mínimo + proteção do grupo menor
};
// RespostaDetalhe.modelo: { modelo: "copsoq"; dimensoes (com escoreDoTime e comparacao); niveis;
//   ofensivos } | { modelo: "isfb"; isfb; faixa; dimensoes; autopercepcao; perfil; sinais; abertura;
//   isfbDoTime; mediaDoBrasil; dimensoesDoTime } (null sem a parte que forma a nota)

// GET|PUT /pesquisas/:id/modelo/acompanhamento  (só NR-1; leitura de pesquisa; PUT com CSRF e
//   pesquisa.alter, auditado como pesquisas_pesquisa_alterada; gravado em pesquisa.acompanhamento)
interface AcompanhamentoNr1Entrada {
  etapas: { id: "comunicar" | "validar" | "treinar" | "implementar" | "revisar";
            itens: boolean[]; evidencias: string | null; concluida: boolean }[];
  plano: { id; dimensaoId; titulo; descricao; controle: "eliminacao" | "substituicao" |
           "administrativo" | "protecao"; responsavel; prazo: "AAAA-MM-DD" | null; indicador;
           situacao: "planejada" | "em_andamento" | "concluida" }[]; // até 200
  profissionalSst: { nome: string | null; registro: string | null };
}
// Resposta: as 7 etapas (`concluida`, `automatica`, `concluidaEm`), `concluidas`, `proxima` e
// `revisarEm` (AAAA-MM, 1 ano depois da publicação). "mapear" conclui sozinha (anônima: 1ª resposta;
// demais: todos os convidados); "plano" com a 1ª medida; concluir as outras exige item ou evidência.
````

**Telas:** NR-1 com Visão geral (panorama, níveis, matriz, ranking, saúde, comportamentos ofensivos,
perfil por domínio), Por grupo (um resultado por grupo visível: pressão, recursos e destaque), Plano de
ação (escrito pelo RH) e Conformidade NR-1; saúde financeira com Visão geral e Análises. Planilha: as
abas do modelo entram depois do Resumo (`abasDoModelo`); relatório imprimível próprio dos dois.

Fora desta entrega: plano de ação gerado por IA, análise por IA, anexos de evidências (a etapa guarda
a descrição de onde estão), "Baixar tudo (.zip)", benefícios × necessidades (depende do módulo
Benefícios), recortes por faixa salarial/etária/tempo de casa/sexo e o resultado individual imediato
na página pública da saúde financeira.

## Ajustes da 3ª revisão — Personalizada e gerais (28/11/2026)

- **Marcador `{empresa}` no painel:** a pesquisa gravada guarda o marcador; o painel troca por "nossa
  empresa" ao carregar a pesquisa para os resultados (Visão geral, maior e menor média, Análises),
  o resultado individual, as respostas da pessoa (também na ficha), a planilha e o PDF
  (`modelos/empresa.ts`: `detalheParaOPainel`, `secoesParaOPainel`, `analisesParaOPainel`). Editar
  recebe a pesquisa como foi gravada. A página pública continua trocando pelo nome da empresa.
- **Nome padrão por mês:** "Pulso – Novembro 2026" (mês com inicial maiúscula, sem "de") em todo
  modelo sem nome próprio; semestre, ciclo, data e nomes fixos não mudam.
- **Página pública:** a concordância de 1 a 5 é uma fileira de 5 quadrados com número e rótulo, com
  as pontas acima; a escala de 7 pontos com rótulo por ponto (TAD) tem os botões em degradê.
- **Personalizada:** Benefícios ("O que você usa" 3 / "O que mudaria" 3), Treinamento ("O
  treinamento" 4 / "Para melhorar" 3) e Desligamento ("Sua saída" 3 / "Sua experiência" 5) em duas
  seções. `ModeloDaGaleria.minutos` guarda o tempo do modelo pronto (2, 3, 2, 1, 2 e 2 min) e o card
  mostra o formato do modelo. A gaveta do modelo pronto (`GavetaDoSubmodelo`) mostra "N perguntas ·
  N min · formato", a descrição, "Quando usar", "Seção N · título", o tipo de cada pergunta,
  "Mostra outra pergunta" (origem de condição), "Opcional", a nota "Tudo pode ser editado depois de
  usar o modelo." e "Fechar" / "Usar este modelo" (sem "Sobre o modelo").
- **"Sobre o modelo" do Pulso:** `PaginaSobre.layout = "perguntas"` usa a página das perguntas com o
  título, o selo, o texto, os botões e os 4 números do catálogo (5 de 1 a 10 · 1 de recomendação ·
  1 comentário · Mensal), as perguntas agrupadas pelo jeito de responder (obrigatórias e opcionais),
  "Como a pessoa responde" com uma prévia em que dá para marcar a nota e "O que o RH vê" (rosca e
  barras). Sem "O que você recebe", ficha técnica ou janela de exemplo.

## Pesquisa de Clima — revisão 3 (28/11/2026)

- **Faixas do índice** (% de respostas favoráveis, 4 e 5): crítica < 50 · atenção 50–64 · boa 65–79 ·
  excelente ≥ 80 — no geral, em cada dimensão e subdimensão, na tela, no "Sobre o modelo", na planilha
  e no PDF. Não há score 0–100 nas telas do Clima (o campo `score` continua no contrato).
- **Perguntas editáveis:** o RH muda o texto, remove e acrescenta afirmações (numa dimensão) ou perguntas
  de texto livre. A API confere só chave e tipo (`conferirEstruturaDoClima`, registrada em `conferir`):
  `clima_01`…`clima_60` e `clima_<dimensão>_<sufixo>` são concordância; `clima_aberta_*` é texto livre;
  cada chave uma vez; pelo menos uma afirmação. As abertas do modelo são obrigatórias.
- **Telas:** Visão geral (medidor do índice, todas as notas, anéis das dimensões por resultado ou na
  ordem do modelo, puxa para cima / pede atenção, destaques, resultado por afirmação com filtro, "menor
  favorável primeiro" e 8 por página, respostas abertas); Análises (resultado por departamento ou outro
  recorte, evolução desde a Pesquisa de Clima anterior, "Duplicar para o próximo ciclo"; fora da
  identificada, o aviso das leituras que exigem identificação; na identificada, pessoas por faixa);
  Respostas (índice e departamento de cada resposta) e o resultado individual próprio.
- **Exportações:** planilha própria (Resumo, Dimensões, Ranking, Respostas individuais com a linha da
  média; nunca individuais na confidencial; na anônima sem nome e sem data) e PDF próprio em 8 páginas.
  As telas e exportações próprias valem quando a API manda `ResultadosPesquisa.modelo` (mesmo `null`).

```ts
type FaixaClima = "critica" | "atencao" | "boa" | "excelente";

interface DimensaoClima extends Omit<
  DimensaoDoModelo,
  "faixa" | "subdimensoes"
> {
  faixa: FaixaClima | null; // pelo % favorável
  subdimensoes?: DimensaoClima[]; // as 3 do modelo; acrescentadas não têm subdimensão
}

interface ResultadoClima {
  modelo: "clima";
  favoravel: number | null; // o índice do time
  neutro: number | null;
  desfavoravel: number | null;
  notas: { favoraveis: number; neutras: number; desfavoraveis: number };
  score: number | null;
  faixa: FaixaClima | null;
  dimensoes: DimensaoClima[];
  afirmacoes: AfirmacaoDoModelo[]; // na ordem da pesquisa (com as acrescentadas)
}

// RespostaResumo.resumoDoModelo (GET /pesquisas/:id/respostas e a resposta individual)
interface ResumoDaRespostaClima {
  modelo: "clima";
  indice: number | null;
  faixa: FaixaClima | null;
}

// RespostaDetalhe.modelo
interface ResultadoIndividualClima {
  modelo: "clima";
  indice: number | null;
  faixa: FaixaClima | null;
  favoraveis: number;
  neutras: number;
  desfavoraveis: number;
  time: { indice: number | null; faixa: FaixaClima | null } | null;
  dimensoes: {
    chave: string;
    rotulo: string;
    indice: number | null;
    faixa: FaixaClima | null;
    time: number | null;
  }[];
  afirmacoes: {
    chave: string;
    perguntaId: string;
    dimensao: string;
    nota: number | null;
    mediaTime: number | null;
    favoravelTime: number | null;
  }[];
  distribuicao: { resposta: number[]; time: number[] | null }; // notas 1 a 5: quantas da pessoa; % do time
}
```
