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
  finalizada (sem job: calculado na leitura). Rascunho, ativa, pausada e finalizada editam
  (a finalizada sem mudar o encerramento); cancelada não.
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
  minutosEstimados: number; // minutos fixos do modelo (MINUTOS_POR_MODELO) ou 0,3 min por pergunta, arredondado; mínimo 3
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
- **eNPS:** a principal (0 a 10), 5 complementares de 0 a 10 e 2 abertas; ver "eNPS — modelo próprio".
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

### Avaliação e Onboarding — revisão 3 (28/11/2026)

- **Rascunho ao abrir**: os dois assistentes gravam o rascunho assim que abrem e a rota passa a
  `#/pesquisas/<id>/rascunho` (sem recarregar); `#/pesquisas/nova/<modelo>` retoma o rascunho do mesmo
  modelo, como os demais. Cada etapa regrava o mesmo rascunho — na avaliação, também a configuração e
  os times (`PUT …/avaliacao`, com `prazoAutoavaliacao: null` até concluir); no onboarding, a
  configuração do envio (`PUT …/onboarding`). Reaberto, o assistente lê `GET …/avaliacao` ou
  `GET …/onboarding` e volta na etapa em que a pessoa parou (memória local do navegador).
- **Resultados**: nos modelos com tela própria, as abas, o painel e o "Exportar" comuns não são
  desenhados; só os da tela própria.
- **Relatório em PDF** próprio pela rota `#/pesquisas/<id>/relatorio` (páginas A4, no padrão dos
  relatórios do módulo): avaliação (capa com nota, nível, competências e grupos; resultado do time,
  mapa de talentos, pessoas, calibração e recortes e, na 180°, gestor × autoavaliação) e onboarding
  (índice por rodada, o que mudou, vontade de ficar, peso dos blocos, jornada, contatos e comentários).
  "Exportar PDF" abre essa rota em outra aba (antes imprimia a tela).
- **Onboarding**: "Escolher pessoas" mostra a lista de todos os ativos mesmo sem ninguém marcado (a
  prévia vazia não vai para a API); e-mail com o nome da empresa ativa ("na {empresa}", ou "na
  empresa" sem nome), "Ver como" uma pessoa do público, abas "Texto" e "Logo e cores" no personalizado
  (cor principal e de fundo claro; o texto do botão fica branco ou preto pelo contraste; o envio do
  logo entra com o envio de e-mail e, até lá, o convite mostra a sigla da empresa), "Teste antes de
  enviar" com "Abrir prévia" e "Enviar teste para mim" preparado e desligado até o envio de e-mail;
  "Completar cadastro" no aviso de quem não tem e-mail; as rodadas de 60/90 dias dizem o marco
  ("N pessoas chegam aos 60 dias de casa nos próximos 30 dias"). Resultados: "Ver por" (departamento,
  unidade e centro de custo, fora da anônima; mínimo de 3 por rodada), a jornada de cada pessoa na
  identificada e o fluxo da intenção de ficar num diagrama.
- **Avaliação**: prévia dos e-mails com o gestor de exemplo, a empresa, a saudação e o botão; na 180°,
  também a prévia do e-mail da pessoa avaliada.
- **Perguntas do onboarding publicado** (ativo ou pausado): aba "Perguntas" nos resultados (RH e
  DP). Depois da primeira resposta, a pergunta respondida que muda (texto, tipo, opções,
  obrigatoriedade ou condição) ganha um id novo — as respostas dadas continuam ligadas à versão em
  que foram respondidas; a sem resposta muda no lugar; incluir e excluir é livre; condições que
  apontam para a pergunta passam à nova versão (`modelos/onboarding/versao-das-perguntas.ts`).
- Pendente: recortes por cargo e por gestor no onboarding (a resposta da confidencial não guarda
  cargo nem gestor — exige coluna nova).

Contrato (acréscimos):

```ts
// ConfigOnboarding.email
corPrincipal: string | null; // "#rrggbb"; só no personalizado
corFundo: string | null; // "#rrggbb", luminância ≥ 0,8; só no personalizado
// PUT /pesquisas/:id/onboarding/perguntas { secoes } → 200 { secoes, novasVersoes }
// (409 finalizada; 422 estrutura inválida ou sem pergunta)
// GET /pesquisas/:id/onboarding/envios
jornadas:
  | {
      colaboradorId: string;
      nome: string;
      admissao: string | null; // AAAA-MM-DD (vazio para quem saiu)
      cargo: string | null;
      unidade: string | null;
      rodadas: { rodada: number; dataPrevista: string; situacao: SituacaoDoEnvio }[];
      respondidas: number;
    }[]
  | null; // só na identificada
```

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

## eNPS — modelo próprio (3ª revisão, 28/11/2026)

Decisões:

- **Perguntas:** a principal (nota 0–10 com `enps`, chave `enps_principal`) é fixa: no assistente fica sem
  "Excluir" e sem arrastar, e a API recusa (`secoes` → `estrutura_do_modelo`) estrutura sem exatamente uma
  nota de eNPS, que seja a principal. As 5 complementares são escala de 0 a 10 com as pontas da principal
  ("Nada provável" / "Muito provável"); as 2 abertas são obrigatórias. O resto é livre (editar, remover,
  somar até 15); "Adicionar pergunta" oferece escala de 0 a 10 ou texto livre.
- **Nome padrão:** "eNPS – 4º trimestre 2026". Resumo da etapa Enviar: "1 principal · 5 complementares ·
  2 abertas" (plural pela quantidade; grupos vazios saem).
- **Cálculo** (`apps/api/src/pesquisas/modelos/enps/calculo.ts`): eNPS = % promotores (9–10) − %
  detratores (0–6), inteiro, de −100 a 100; zonas crítica < 0 · aperfeiçoamento 0–49 · qualidade 50–74 ·
  excelência 75–100. Complementar = toda nota 0–10 que não é de recomendação (escala 0–10 ou nota sem
  eNPS/LNPS): média com uma casa (arredonda para longe do zero), contagem 0–6 · 7–8 · 9–10 e o "peso" =
  correlação de Pearson com a principal (duas casas; `null` com menos de 3 pares ou sem variação); da
  maior média para a menor, empate pela ordem da pesquisa. Pesquisa antiga sem a chave: a nota marcada
  como eNPS é a principal.
- **Visão geral:** medidor −100..100 (marcas 0, 50, 75) com a zona e a conta "X% promotores − Y%
  detratores = Z"; "Quem respondeu o quê" (3 cartões: % e pessoas); histograma 0–10 por grupo;
  complementares (Pergunta · Distribuição 0–6 · 7–8 · 9–10 · Média) e a frase do ponto que mais pede
  atenção; "Respostas abertas" com 3 e "Ver as N respostas". Fora da identificada, as abertas seguem a
  ordem alfabética dos resultados (a de chegada ligaria o texto à pessoa); na identificada, as mais
  recentes primeiro.
- **Respostas:** pílulas Todos · Promotores · Neutros · Detratores (com contagem) e a coluna "Nota
  principal" com o grupo. **Resultado individual:** nota, grupo e o que significa, "eNPS do time … · N%
  são promotores", cada complementar com nota, time (uma casa) e diferença, e as abertas da pessoa (sem
  média geral 0–10, sem "últimos pulsos").
- **Análises:** eNPS por grupo (departamento, centro de custo ou unidade; ocultos abaixo do mínimo),
  evolução do eNPS a partir da segunda pesquisa do modelo e, só na identificada, "O que mais pesa na
  nota" (o peso de cada complementar). "eNPS por tempo de casa" fica para a próxima fatia (depende da
  data de admissão nas respostas).
- **Planilha:** abas Visão geral (convidados, respondentes = todas as respostas, taxa, eNPS, zona, grupos
  "n (x%)", primeira e última resposta, identificação, escala e fórmula), Gráficos (barras em texto),
  Complementares (média e contagem por grupo), Respostas abertas e, fora da confidencial, Respostas
  individuais (nota principal e grupo). Números ocultos: nenhuma nota sai. **PDF:** relatório próprio
  (capa, 01 resultado, 02 distribuição, 03 complementares, 04 abertas, 05 como ler).
- **Sobre o modelo:** selo "8 perguntas", 4 números, cartão da principal com as 11 notas por grupo,
  complementares, abertas e "Como o eNPS é calculado" (fórmula em pílulas e a barra das zonas); sem "O
  que você recebe" nem ficha técnica.

Contrato:

```ts
// ResultadosPesquisa.modelo (modelo "enps")
interface ResultadoEnps {
  modelo: "enps";
  perguntaId: string | null;          // a principal
  respostas: number;                  // notas na principal
  promotores: number; neutros: number; detratores: number;
  indice: number | null;              // −100 a 100
  zona: "critica" | "aperfeicoamento" | "qualidade" | "excelencia" | null;
  distribuicao: { valor: number; quantidade: number }[]; // 0 a 10
  complementares: {
    perguntaId: string; respostas: number;
    media: number | null;             // 0 a 10, uma casa
    detratores: number; neutros: number; promotores: number;
    peso: number | null;              // correlação com a principal
  }[];                                // da maior média para a menor
}
// RespostaDetalhe.modelo (modelo "enps")
interface ResultadoIndividualEnps {
  modelo: "enps";
  nota: number | null; grupo: "promotor" | "neutro" | "detrator" | null;
  enpsTime: number | null; promotoresTime: number | null; zonaTime: Zona | null;
  complementares: { perguntaId: string; nota: number | null; time: number | null;
                    diferenca: number | null }[]; // na ordem da pesquisa
}
// RespostaResumo.enps (só no modelo eNPS): a nota principal e o grupo
enps?: { nota: number; grupo: "promotor" | "neutro" | "detrator" } | null;
// AnalisesPesquisa.evolucao[].enps (só no modelo eNPS; null sem nota ou oculto)
enps?: number | null;
```

Na tela: o catálogo ganhou `chavesFixas`, `tiposParaAdicionar` e `resumoDasPerguntas`; a página "Sobre"
ganhou o bloco `componente`; o registro das telas (`modelos/resultados.tsx`) ganhou `analisesDoModelo`,
`listaDeRespostasDoModelo` e `visaoIndividualDoModelo`; a API ganhou `conferir` no registro dos modelos.

## Revisão 3 — assistente da personalizada e página pública (28/11/2026)

**Contrato (API):** na abertura pública (`GET /v1/publico/pesquisas/:token`, anônima com
"Separar respostas por"), `grupos[].opcoes[].nome` de um item cujo nome se repete no catálogo
ativo da empresa (comparação sem maiúsculas, acentos e espaços nas pontas) vem com o código do
cadastro: `"Comercial (D02)"`. Os nomes únicos não mudam; o `id` continua o mesmo e o código não
vai em campo próprio. O catálogo da escolha do Onboarding usa a mesma função (`catalogoAtivo`).
O painel aplica a mesma regra em `listarGrupos` (assistente, "Separar respostas por" e prévia).

**Assistente da personalizada:**

- A lista suspensa dos tipos de pergunta mede o espaço até o rodapé fixo do assistente e abre
  para cima quando não cabe embaixo (altura limitada ao espaço que sobra).
- Rascunho retomado (`<id>/rascunho`) volta à etapa em que a pessoa parou, com "Parou na etapa
  N de M · salvo em …" no cabeçalho; as etapas depois dela ficam por ver (antes, todas apareciam
  concluídas). A lembrança é do navegador (`rascunhosLocais`): a etapa gravada é a etapa para
  onde a pessoa vai ao avançar, ou a etapa em que estava ao "Salvar rascunho". Sem lembrança,
  começa na etapa 1. Pesquisa publicada em edição segue com todas as etapas abertas.
- Prazo com data passada (e mínimo por grupo fora de 3 a 10) avisa no próprio campo ao digitar e
  não trava o rascunho: o corpo do rascunho (`entradaDoRascunho`) leva o último valor gravado
  desses campos e o resto continua salvando — no assistente dos modelos (gravação automática) e
  no "Salvar rascunho" da personalizada ("Rascunho salvo, menos o prazo: corrija na etapa Envio e
  prazo."). Publicar continua barrado pela validação da etapa.
- Mini-escala da faixa do assistente com borda e fundo próprios; cartões dos roteiros com quem
  responde ("Gestor avalia o time", "Gestor e autoavaliação"); a gaveta "Ver perguntas" começa
  direto na lista quando o primeiro grupo não tem nome.

**Página pública:**

- Personalizada (seção inteira): "Próximo"/"Enviar respostas" fica ativo; a tela diz "Falta
  responder N perguntas obrigatórias" e o clique marca as pendentes, foca a primeira e a traz
  para o meio da tela. Uma pergunta por tela (modelos prontos) continua esperando a resposta.
- Comentário final opcional dos modelos (última pergunta, texto, não obrigatória): caixa de
  várias linhas com "Escreva aqui, se quiser.", com o mesmo limite do tipo (300 na resposta curta).
- A barra de progresso muda de largura sem transição: na última tela já aparece cheia.

**Não aplicável:** incluir campos personalizados de seleção dos Colaboradores em "Separar
respostas por" — o Evolli ainda não tem campos personalizados (a seção "Campos extras" da ficha é
só o estado vazio, sem servidor).

## Revisão 3 — saúde financeira, DISC e ajustes transversais (28/11/2026)

- **Configuração com `null`:** a API devolve `maximo: null` (múltipla escolha) e `minimo`/`maximo:
null` (número). Os tipos do cliente dizem `number | null`; `null` e ausente valem "sem limite" na
  validação do assistente, na resposta pública e no texto de ajuda. O assistente de modelo fixo
  mostra um aviso geral quando uma pergunta tem erro.
- **Saúde financeira:** a Q13 (produtos) é obrigatória no assistente; a estrutura do servidor aceita
  também a opcional dos rascunhos antigos (ausente = 0 produtos). Resultado imediato na página
  pública, calculado no navegador com a regra da API (nada é gravado): nota em anel, faixa, diferença
  para a média do Brasil, barras por dimensão com a linha da média e cartões com a faixa de cada
  dimensão (cortes próprios); "Salvar em PDF" pela impressão. Nos cartões de dimensão do painel o
  selo mostra só a faixa. Análises: "Benefícios da empresa × necessidades do time" lê
  `GET /v1/beneficios` (permissão `beneficio:read`; só benefícios `ativo`): antecipação salarial
  (categoria `antecipacao`), educação financeira (nome com "financeir"), previdência (nome com
  "previd"), alimentação (`alimentacao` ou `multibeneficios`), plano de saúde (`saude`) e seguro de
  vida (`seguro_vida`), cada um com o dado do time; 403 mostra "sem acesso ao módulo". Visão geral
  com "Ver análises do time ›" (`visaoGeralDoModelo(detalhe, geral, onIrPara?)`).
- **DISC:** time equilibrado (tri) com frase própria (`resumoDoTime`); "Como o time funciona" com
  um ponto de cada fator principal em rodízio (`chipsDoTime`); diversidade cita só o fator ausente
  de menor presença na composição (`fatorMaisAusente`), na tela e no PDF.
- **Tempo estimado (regra única):** `max(3, round(n × 0,3))` minutos — página pública, API
  (`minutosEstimados`), assistentes, Onboarding e o texto de todos os catálogos (um teste confere
  que o número escrito em cada modelo é o da regra). Avaliações seguem "por pessoa".
- **"Separar por" na anônima:** (revisto na 4ª revisão) no Pulso e nos modelos comuns, "Prefiro
  não informar" já vem marcado e "Iniciar" entra direto; na NR-1 (`copsoq`) a escolha é
  obrigatória, sem pré-seleção, com "Prefiro não informar" entre as opções. "Prefiro não
  informar" vai como `null`.
- **Falha ao gravar:** página desatualizada (403 `csrf_invalido`), sessão expirada (401 ou renovação
  recusada), sem permissão (403), 409, 422 e 5xx têm mensagem própria; "verifique a conexão" só sem
  resposta do servidor.

### NR-1 — 3ª revisão (28/11/2026)

- **Escala de saúde (`Q64`):** passa a gravar 5 = "Excelente" (rótulos do pior ao melhor) e a aparecer
  de 5 a 1 com `config.decrescente: true` (novo campo da escala com rótulos, aceito pela API). Dados já
  gravados: nada é migrado; a pesquisa cujo 1º rótulo do `Q64` é "Excelente" (orientação antiga, 1 =
  Excelente) continua espelhada no cálculo (`saudeLegadaDe`). A planilha mostra o valor com o rótulo da
  própria pesquisa ("1 · Excelente" nas antigas, "5 · Excelente" nas novas).
- **Rótulos das pontas:** escala com rótulos em fileira e `rotuloMinimo`/`rotuloMaximo` mostra as
  pontas acima dos botões (invertidas quando `decrescente`). Vale para todo modelo com esses campos.
- **Comportamentos ofensivos:** além do sigilo por célula, se só uma frequência do tipo ficar oculta e
  o total aparecer, a menor contagem positiva visível também vira `null` (sigilo complementar, para não
  sair por subtração). Tela, planilha e relatório mostram "oculto"/"menos de N" — nunca zero. Ordem
  dos tipos: assédio, ameaça, conduta sexual, violência.
- **Plano de ação:** biblioteca própria do Evolli (`web/.../copsoq/medidasSugeridas.ts`, sem IA): 3
  medidas por dimensão (87), com controle da NR-1, prazo sugerido (encurtado pelo nível), opções A e B,
  referência e indicador; "Adicionar ao plano" copia para uma `MedidaDoPlano` editável. Busca por
  dimensão ou medida (sem acento). "Baixar PDF" e o pacote são gerados no navegador
  (`arquivos/pdfSimples` e o .zip sem compressão já existentes; nenhuma dependência nova).
- **Evidências (arquivos):**

```ts
// POST   /pesquisas/:id/modelo/acompanhamento/evidencias/:etapa   (CSRF, pesquisa.alter; RH e DP)
//   corpo application/octet-stream (até 20 MB); cabeçalhos x-evolli-evidencia-tipo,
//   x-evolli-evidencia-extensao e x-evolli-evidencia-nome (encodeURIComponent).
//   PDF, JPG, PNG, WEBP ou PPTX (sem macro); até 10 por etapa (comunicar…revisar).
//   422 evidencia_arquivo_vazio | _grande_demais | _formato_invalido | _arquivo_malformado |
//       evidencia_com_macro | evidencia_reprovada_antivirus; etapas.<id> limite | nao_se_aplica.
//   503 evidencia_verificacao_indisponivel | evidencia_armazenamento_indisponivel. 404 etapa ou modelo.
// GET    …/evidencias/:etapa/:arquivoId   download privado (RH e DP; o master técnico não lê)
// DELETE …/evidencias/:etapa/:arquivoId   tira da etapa e apaga o objeto (CSRF, pesquisa.alter)
// Resposta de POST/DELETE: o acompanhamento (como o GET). Cada etapa ganha:
type ArquivoDaEtapa = {
  id;
  nome;
  formato: "pdf" | "jpg" | "png" | "webp" | "pptx";
  tamanhoBytes;
  enviadoEm;
}; // chave do objeto e hash ficam só no banco
```

Armazenamento e antivírus: os mesmos dos documentos do colaborador (R2 privado + ClamAV, ADR 0021),
sem configuração nova; o registro fica em `pesquisa.acompanhamento` (sem migration), gravado com a
linha da pesquisa travada (`FOR UPDATE`). O PUT do acompanhamento não altera os arquivos e aceita
concluir a etapa só com arquivo. Envio e remoção auditados como `pesquisas_pesquisa_alterada`.

- **"Baixar tudo (.zip)":** `01-plano-de-acao.pdf`, `02-conformidade.pdf`, `03-respostas.xlsx` e
  `evidencias/NN-etapa/arquivo`. O relatório completo da NR-1 continua no "Exportar › PDF" (impressão do
  navegador) e não entra no pacote.
- **Telas:** Visão geral com "Como o nível é definido", "Ver todas", chips e "+N" da matriz clicáveis,
  "Ver o plano de ação desta dimensão", linhas do ranking clicáveis e atalhos para Plano e Conformidade;
  contadores nas abas (medidas; "N/7"). Por grupo com ranking clicável, "onde está o risco" (6
  dimensões, grupo × empresa), mapa de calor por domínio e exigências × recursos (quadrantes pelo meio
  da escala); falha ao carregar um grupo aparece como erro, não como sigilo. Selos: crítico vermelho,
  alto laranja, médio âmbar, baixo verde. Página "Sobre" com os mesmos nomes de dimensão e de ação dos
  resultados e o exemplo com 29 quadradinhos e a mini matriz.

## 3ª revisão — evolução, resultado individual e exportações gerais (28/11/2026)

Decisões (valem para a exportação genérica, usada pela Personalizada e pelo Pulso):

- **Evolução** (`GET /pesquisas/:id/analises`, `evolucao`): sai de `montarEvolucao` (função pura em
  `analises-pesquisa.ts`). Pesquisa **cancelada nunca conta**; pesquisa sem média visível (sem
  resposta ou confidencial abaixo do mínimo) fica fora — a lista não traz mais `mediaGeral: null`.
- **Faixas de escalas de 4 pontos:** só duas (1–2 desfavorável, 3–4 favorável), sem a faixa do meio.
- **Cartões dos resultados:** perguntas de texto (comentários) não têm número nem contam; as demais
  seguem 1, 2, 3… A legenda do eNPS no cartão de indicador usa rótulos curtos ("prom.", "detr.").
- **Mapa por grupo:** a contagem de respostas fica embaixo do nome de cada grupo, inclusive do grupo
  oculto por mínimo; o vizinho oculto para proteger um grupo menor continua sem a contagem (decisão
  A1). Rótulos de média: "de 1 a 10".
- **Resultado individual:** a recomendação (0 a 10) entra no fim de "Respostas por pergunta"; os
  quatro cartões mostram o número grande colorido pela faixa, com "/10" (ou o máximo da escala da
  pergunta); a diferença arredonda o meio para cima no valor com sinal (−2,75 → −2,7); diferença zero
  diz "igual ao time".
- **Planilha (.xlsx):** a linha 2 de toda aba traz empresa · pesquisa · identificação · "emitido em
  <data> por <nome de exibição>" (e a regra da aba, quando há). Período das respostas com as horas da
  primeira e da última. Nova aba **"Por <campo do recorte>"** (Respostas, Média geral, Favorável, eNPS
  e uma coluna por tema; grupo abaixo do mínimo "Oculto · menos de N respostas") e, na aba eNPS, a
  tabela **eNPS por <campo>**. **Alertas** só com regras críticas, uma linha por pergunta (texto da
  pergunta; departamento vazio quando é a empresa toda): média abaixo de 6,5 ou menos da metade
  favorável; grupos visíveis com média abaixo de 6,5 ou 1 ponto (ou mais) abaixo da empresa.
  **Participantes da anônima** em ordem embaralhada de forma estável pela pesquisa e numerados nessa
  ordem; o que não foi respondido fica vazio.
- **PDF:** o rodapé da capa traz o período com as horas e "Emitido em <data> · <nome>"; rótulos de
  média "de 1 a 10"; o rótulo da pergunta quebra entre palavras (nunca no meio de uma palavra).

Contrato novo (web):

```ts
// ServicoDePesquisas.quemEmite?: () => Promise<string | null>  // nome de exibição (GET /users/me)
// montarRelatorio({ …, emitidoPor?: string | null,
//                   porGrupo?: Map<grupoId, ResultadosPesquisa> })  // resultados de cada grupo visível
// RelatorioDeResultados ganha:
//   periodoComHoras: string;          // "dd/mm/aaaa hh:mm a dd/mm/aaaa hh:mm" (sem lista: os dias)
//   emitidoPor: string | null;
//   grupos: { campo; colunas: string[];
//             linhas: { grupoId | null; nome; respostas; visivel; oculto;
//                       mediaGeral; favoravel; enps: { indice; promotores; neutros; detratores;
//                       total } | null; medias }[] } | null;
// carregarRelatorio pede GET /pesquisas/:id/resultados?campo=&grupoId= de cada grupo visível do
// recorte (o servidor reaplica o mínimo) para o favorável e o eNPS por grupo.
// embaralharDeFormaEstavel(itens, semente): permutação determinística (FNV-1a + xorshift).
```

## Revisão 3 — lista, fluxo e ações (28/11/2026)

- **Finalizada edita:** `PUT /v1/pesquisas/:id` aceita a finalizada (nome, boas-vindas,
  participantes); mudar ou tirar `encerraEm` dela é 422 `{ campo: "encerraEm", motivo:
"nao_editavel" }` (reabriria o link de uma pesquisa encerrada pelo prazo). Cancelada continua 409.
  Na tela, a finalizada mantém "Editar" (cabeçalho e menu da linha) e mostra "Copiar link"
  desabilitado; a página Editar troca o cartão de encerramento por um aviso.
- **Aviso flutuante:** `ConteudoDoAviso.tom?: "sucesso" | "erro"` (componente do sistema). Erro:
  cor e ícone de erro e `role="alert"`. Falha com janela ou gaveta aberta aparece dentro dela.
- **Rascunho retomado:** a rota `<id>/rascunho` vale pela primeira leitura; publicar mostra a tela
  final mesmo se a pesquisa for relida.
- **Trilha:** "Pesquisas / Nova pesquisa / <modelo>" (sobre o modelo, assistente, rascunho);
  "Nova pesquisa / Pesquisa personalizada"; resultados com o nome da pesquisa.
- **Lista:** as pílulas contam o que a busca e o tipo deixam; sem resultado, estado vazio com
  "Limpar filtros" e colunas de largura fixa.
- **Resultados:** recorte que falha mostra erro com "Tentar novamente" (nunca números antigos sob o
  filtro novo; só vale a resposta do último pedido); o seletor abre para baixo
  (`ListaDeEscolha.direcao = "abaixo"`), mais largo e alinhado à direita.
- **Rotas inválidas:** 400/404 ao abrir resultados ou resultado individual → "Pesquisa não
  encontrada" com a volta; outra falha → "Tentar novamente".
- **Assistentes:** trocar de etapa e a tela final voltam ao topo; com pouco conteúdo, o rodapé
  fica no pé da tela.

## Pulso e Clima e Motivação (TAD): régua do modelo em todas as telas (revisão 3, 28/11/2026)

Contrato acrescentado (só campos novos; nada muda para os outros modelos):

```ts
// GET /pesquisas/:id/respostas — `resumoDoModelo` ganha os dois modelos
type ResumoDaRespostaDoModelo =
  | ResumoDaRespostaClima
  | { modelo: "tad"; valor: number | null; nivel: NivelTad | null } // 1 a 7
  | { modelo: "pulso_clima"; valor: number | null; faixa: FaixaDeScore | null }; // 0–100

// GET /pesquisas/:id/respostas/:respostaId — `modelo`
interface ResultadoIndividualTad {
  // ...geral, nivel, pilares
  time: { geral: number | null; pilares: (number | null)[] } | null; // média das pessoas
}
interface ResultadoIndividualPulsoClima {
  modelo: "pulso_clima";
  score: number | null; // média dos scores das afirmações respondidas
  faixa: FaixaDeScore | null;
  scoreTime: number | null;
  favoraveis: number;
  neutras: number;
  desfavoraveis: number; // contagens 4–5, 3, 1–2
  dimensoes: {
    chave: string;
    rotulo: string;
    score: number | null;
    faixa: FaixaDeScore | null;
    scoreTime: number | null;
  }[];
  distribuicao: { valor: number; resposta: number; time: number }[]; // 1–5; time em %
  enps: { nota: number | null; indiceTime: number | null };
  lnps: { nota: number | null; indiceTime: number | null };
  comentarios: { dimensao: string; texto: string }[];
}

// GET /pesquisas/:id/resultados — Pulso e Clima, `modelo.comentarios[]`
interface ComentarioDoModelo {
  // ...dimensao, perguntaId, quantidade
  textos: { texto: string; mes: string | null; departamento: string | null }[];
}
```

Regras:

- Comentários do Pulso e Clima: do mês mais recente ao mais antigo (mês de
  Brasília, `AAAA-MM`) e, no mesmo mês, em ordem alfabética (a ordem de
  chegada ligaria o texto a quem respondeu). O departamento só vai quando o
  grupo dele aparece pelo mínimo por grupo (com a supressão secundária);
  fora disso, `null` ("Departamento oculto").
- O registro (`modelos/indice.ts`) usa o mesmo `resumoDaResposta` do Clima;
  a tela usa os ganchos `listaDeRespostasDoModelo` e
  `visaoIndividualDoModelo` (`modelos/RespostasNaRegua.tsx`).
- Tela: aba Respostas com a coluna do modelo; resultado individual na régua
  do modelo (sem a média de 0 a 10); aba Comentários no Pulso e Clima
  (`?aba=comentarios`), com o atalho "Ver em Comentários" no detalhe por
  pergunta; página pública do Pulso e Clima por dimensão (abertura, selo,
  "Pergunta N de T" só das perguntas, comentário em tela própria e o do
  LNPS/eNPS na tela da nota, até 2000 caracteres); resultado da TAD ao fim
  da página pública, calculado no navegador com a regra da API, sem gravar.
- Exportações: a planilha do Pulso e Clima (Dimensões, Visão geral,
  Resultados por pergunta, eNPS e LNPS, Respondentes × perguntas, Matriz de
  distribuição, Ranking, Alertas, Por grupo com recorte, Comentários,
  Metodologia) e a da TAD (Resumo, Afirmações com a média pontuada
  `8 − média` nas invertidas, Respostas individuais, Metodologia) trocam as
  abas genéricas; com números ocultos, vale a planilha comum. PDF próprio de
  cada modelo e, no PDF de uma resposta, os cartões na régua do modelo.
- Zona da afirmação (planilha/PDF): média ≥ 4 favorável, 3–3,99 neutra,
  abaixo desfavorável. Alerta: atenção com desfavorável ≥ 30% ou média < 3;
  alto com ≥ 50% ou média < 2,5.

## Clima, eNPS e tempo estimado — revisão 4 (28/11/2026)

- **Evolução sem recorte:** `GET /pesquisas/:id/evolucao` (leitura de pesquisa) devolve
  `{ evolucao: AnalisesPesquisa["evolucao"] }`, a mesma lista de `analises` (mesmas regras de mínimo e de
  cancelada), sem exigir `campo`. A aba Análises do eNPS lê a evolução por esse caminho: a anônima sem
  "separar por" também mostra a evolução. `analises` continua exigindo `campo` (400 sem ele).
- **Tempo estimado sem literal:** nenhum catálogo escreve os minutos à mão. `tempoEstimado.ts` ganhou
  `perguntasParaOTempo` (conta como a página pública: todas as perguntas das seções, com os comentários
  por dimensão, e o comentário final), `minutosDoModelo`, `tempoParaResponder` ("Cerca de N minutos"),
  `tempoNoTexto` e `minutosCurtos`; os catálogos e o "Como a pessoa responde" do Sobre usam essas
  funções (Pulso e Clima passa a 10 minutos, igual à página pública; Clima, 19 em todo lugar). Um teste
  lê o código dos catálogos e recusa qualquer "N min"/"N minutos" escrito; ficam de fora o tempo "por
  pessoa"/"por avaliação" das Avaliações e o `minutos` dos modelos prontos da Personalizada.
- **eNPS individual:** a diferença de cada complementar (`individualDoEnps`) usa
  `diferencaComUmaCasa` (o meio sobe no valor com sinal: −4,25 → −4,2; sem erro de ponto flutuante),
  a mesma regra do resultado individual genérico; a tela mostra inteiro sem casa ("−3", "0").
- **eNPS no assistente:** as `chavesFixas` (a principal) são somente leitura: sem "Editar" nem "Excluir".
- **Análises do Clima e do eNPS:** o seletor "Agrupar por" aparece sempre (sem recorte, só
  "Departamento"); no vazio de uma pesquisa sem "separar por", o botão "Ativar segmentação na próxima
  pesquisa" abre a duplicação (a pessoa liga "Separar respostas por" no assistente da cópia).
- **Visão geral do eNPS:** abertas em blocos por pergunta (`modelos/RespostasAbertas.tsx`: "N respostas",
  as 3 primeiras, "Ver as N respostas", atalho "Ver temas em Análises"); identificada, as mais recentes
  primeiro; fora dela, a ordem alfabética do servidor (privacidade). Complementares com a contagem de
  cada grupo sob a barra, a média num selo da cor do grupo (`grupoDaMedia`: ≥ 9, 7 a 8,9, abaixo de 7) e
  a legenda.
- **PDF do eNPS** (espelha o do Clima, 4 páginas): capa (medidor, quem respondeu, complementares),
  sumário com 6 seções e "Como ler este relatório", 01 resumo executivo, 02 quem respondeu o quê,
  03 complementares, 04 eNPS por departamento (vazio explicado), 05 evolução, 06 comentários em 2
  colunas e metodologia. `carregarRelatorio` usa `GET /pesquisas/:id/evolucao` quando não há recorte
  (`montarRelatorio` ganhou a entrada `evolucao`).
- **Visão geral do Clima:** medidor e "Todas as respostas" à esquerda, anéis à direita; "Puxa para
  cima"/"Pede atenção" com o que a dimensão representa, empates juntos ("Todas as dimensões" quando
  todas empatam), "abaixo da faixa Boa" e a afirmação mais baixa (`leituraDasDimensoes`); Destaques com
  "Ver todas as afirmações"; "Resultado por afirmação" abre com o menor favorável primeiro; abertas no
  bloco comum, com "Ver temas em Análises".
- **Clima individual — onde difere do time:** `diferencasDoTime` compara a nota da resposta com o %
  favorável do time na afirmação: "Mais positivo que o time" (favorável aqui, time abaixo de 50%) e
  "Mais negativo que o time" (desfavorável aqui, time a partir de 50%); neutra nunca entra; até 5 em
  cada, da maior distância; vazios explicados; "Ver todas as respostas" abre a aba Respostas do
  individual, que no Clima conta só as afirmações (`contagemIndividualDoModelo`; as abertas à parte).
- **Clima — aba Respostas:** pílula "Todos N", colunas Resposta | Departamento | Respondeu em | Índice e
  data com o ano ("28/11/2026 · 07:26"). **Página pública do Clima:** sem o nome nem a descrição da
  dimensão nas perguntas. **Assistentes** (modelo e personalizada): `maxLength` 120 no nome e 1000 na
  descrição/boas-vindas, os limites que a API já confere (`LIMITE_NOME`, `LIMITE_BOAS_VINDAS`, 422
  `limite`).
- **Assistente do Clima:** grupos por dimensão recolhíveis (só o primeiro aberto; o cabeçalho mostra
  "Afirmações 13–24"; "Expandir todas"/"Recolher todas"; o grupo que recebe uma pergunta nova abre) e a
  alça "Arrastar pergunta N" reordena só dentro da mesma dimensão (arrastar ou setas ↑/↓).

## 4ª revisão — base, fluxo, resultados gerais e exportação geral (28/11/2026)

Decisões:

- **CSRF desatualizado:** toda escrita do cliente de Pesquisas (`pedir`) que recebe 403
  `csrf_invalido` descarta o token, renova e repete UMA vez (o pedido não foi aplicado); outro 403
  ou a segunda recusa seguem como erro. Vale para rascunho, publicação, status, duplicar e excluir.
- **Gravação automática do assistente dos modelos:** a falha troca "Rascunho salvo às" por
  "Rascunho não salvo" (com "· tentando de novo" enquanto houver tentativa) e mostra a mensagem
  de `mensagemDaFalha`. Falha passageira (`falhaPassageira`: rede, pedido que não saiu, 5xx, token
  desatualizado) tenta de novo sozinha com recuo — 2 s, 4 s e 8 s — e para; sessão expirada,
  permissão, 409 e 422 não tentam sozinhos. Depois disso, só uma nova mudança regrava. A mudança
  de status mostra o motivo (`motivoDaFalha`) no aviso.
- **Nome da empresa no painel:** o shell entrega `nomeDaEmpresa` ao módulo; enquanto o módulo
  está na tela, o marcador `{empresa}` das perguntas vira o nome da empresa ativa no Sobre o
  modelo, assistente, resultados, resultado individual, planilha e PDF (sem nome, "nossa
  empresa"). A pesquisa gravada continua com o marcador.
- **Grupos de nome repetido:** "Nome (código)" também nos resultados (filtro, mapa das Análises),
  participantes, planilha e PDF — a API compara com o catálogo ativo e os grupos pedidos.
- **Filtros dos resultados:** Departamento, Centro de custo e Unidade aparecem sempre; os que não
  separam a pesquisa ficam em "Todos", desabilitados. Recorte pequeno: cartão "Recorte com poucas
  respostas" (borda, ícone em círculo e o texto).
- **Grupo oculto para proteger um menor:** mostra a contagem de respostas (no mapa e na planilha);
  os números seguem ocultos (supressão secundária mantida). No PDF, "—" como antes.
- **Resultado individual:** os quatro cartões (média geral e recomendação em cor neutra, com o
  selo da faixa ou do grupo ao lado; nota mais alta e mais baixa coloridas; sem régua na média);
  depois "Respostas por pergunta" (nota num quadrado colorido, cabeçalho "Resposta | Média do
  time" e "1 … 10", diferença "+1,5 acima do time", "−0,4 abaixo do time" ou "igual ao time");
  por fim "Média nos últimos pulsos" e "Comentário livre". Anônima e confidencial: "Ainda sem
  histórico". Resposta inexistente (400/404): "Resposta não encontrada", só com a volta.
- **Quem emitiu:** sem nome de exibição, o outro identificador da conta (o e-mail de acesso) na
  linha 2 da planilha e nos PDFs (o geral e o de uma resposta).
- **Sobre o modelo do Pulso:** título "Pesquisa Pulso" com o selo "Rápida · recorrente"; faixa de
  números com ícone, número em destaque e o rótulo embaixo; a prévia "Como a pessoa responde"
  funciona (nota na cor da faixa, rótulos das pontas, "Próxima →" só com a nota, comentário
  opcional e "Recomeçar" na última tela).
- **Planilha geral (Pulso e Personalizada):** o Resumo ganha o índice "Abas desta planilha" (as abas
  que existem, com o que cada uma traz); novas abas **Preenchimento** (convidados, respostas,
  faltam, % e ação "ok" com 50% ou mais, "cobrar" abaixo — por departamento com o total, por
  centro de custo e por unidade quando o cadastro tem) e **Participação** (por combinação de
  departamento × centro de custo × unidade e por pessoa, Sim/Não) — só presença, nunca a nota; só
  com convidados (a anônima não tem as duas). **Evolução** com a média geral e o eNPS das pesquisas
  do mesmo modelo (o dado das Análises); na primeira, o aviso de que a evolução vem a partir da
  próxima. Participantes: cabeçalhos com o texto inteiro ("1. <texto>") e "eNPS · <texto>" na
  recomendação; "Média (1 a 10)". Sem "Análise por IA".
- **Página pública com "Separar por":** ver a regra revista acima (pré-seleção fora da NR-1).

Contrato novo:

```ts
// API
// ParticipanteDaLista (GET /pesquisas/:id → participantesLista[]) ganha:
//   centroCusto: string | null; unidade: string | null;   // da lotação vigente
// AnalisesPesquisa.evolucao[].enps?: number   // fora do modelo eNPS, só quando há índice
// nomesDosGrupos(db, empresaId, ids): nome repetido no catálogo → "Nome (código)"
// Identificada: RespostaResumo.departamento com o mesmo nome dos grupos.

// Web
// pedir(): repete UMA vez a escrita recusada com 403 csrf_invalido.
// falhaPassageira(erro): boolean; motivoDaFalha(erro): string   (falhasDaGravacao.ts)
// AssistenteDoModelo: prop recuoDoRascunho?: number (ms; dobra a cada tentativa, até 3)
// PesquisasModulo: prop nomeDaEmpresa?: string | null
// modelos/empresa.ts: definirEmpresaDoPainel(nome), useEmpresaDoPainel(nome);
//   textoParaOPainel(texto, empresa?), secoesParaOPainel(secoes, empresa?),
//   detalheParaOPainel(detalhe, empresa?), analisesParaOPainel(analises, empresa?)
// posicaoDaLista(gatilho, limiteDeBaixo, altura, limiteDeCima = 0)
// quemEmiteDaConta({ nomeExibicao, email }): string | null
// DocumentoDaResposta: prop emitidoPor?: string | null
// PaginaSobre.numeros[].icone?: "perguntas" | "recomendacao" | "comentario" | "frequencia"
// PreviaDeResposta / telasDaPrevia(perguntas, comentarioFinal)
// ParticipanteDaPesquisa: centroCusto?: string | null; unidade?: string | null
```

## 4ª revisão — recorte C: NR-1, saúde financeira, DISC, avaliação e onboarding (28/11/2026)

- **Conformidade NR-1, etapa 2 (decisão de paridade):** "Elaborar o plano de
  ação" conclui sozinha quando há resultado (`respostas > 0`): a biblioteca
  de estratégias é fixa, então o plano sugerido existe desde a 1ª resposta
  (anônima com a 1ª resposta: 2/7, próxima "comunicar"). As medidas que o RH
  registra não mudam a etapa. Contrato do `GET|PUT …/modelo/acompanhamento`
  sem mudança de forma; muda só o valor de `concluida` da etapa `plano`.
- **Conformidade (tela):** uma etapa por vez — lista das 7 etapas e o
  detalhe da escolhida (sem escolha, a próxima pendente), com "Etapa N de 7",
  "O que fazer N de M" (itens marcados) e "Etapa anterior/Próxima etapa".
- **Plano:** "estratégias sugeridas" = 3 por dimensão com nível, inclusive
  as preventivas do nível baixo (87 com as 29), o mesmo número no contador
  da aba Plano, no cartão "Plano de ação" da Visão geral (com "N medidas no
  plano") e na lista (`estrategiasSugeridas`). O PDF do plano segue com as
  sugestões de crítico, alto e médio.
- **Visão geral:** "Principais achados" por regra, sem IA
  (`principaisAchadosNr1`): o maior risco (1ª das prioridades com gente em
  risco, com o %), o ponto mais forte (maior % favorável; empate pela ordem
  do catálogo) e os comportamentos ofensivos (contagem oculta = "menos de
  N"). Cada tipo de comportamento ofensivo mostra "N pessoas (x%)" (% sobre
  quem respondeu o bloco; nada com sigilo). Perfil por domínio com o 1º
  domínio aberto; os 5 indicadores de saúde numa linha a partir de 1280 px.
  Matriz: com até 4 dimensões na célula, todas aparecem ("+N" só a partir de
  5); os chips usam `DimensaoNr1.rotuloCurto` (rótulos curtos do Evolli, até
  20 caracteres; o nome inteiro no título).
- **Por grupo:** "onde está o risco" pelo % em risco e, no empate, pela ordem
  do catálogo (`DIMENSOES_NR1`). Mapa de calor e "% do time em risco" do
  grupo pela média dos % já arredondados de cada dimensão, arredondada ao
  inteiro (`mediaArredondada`). Ranking em tabela: #, grupo (com "N
  respostas"), precisam de ação ("N de 29"), % do time em risco e barra
  empilhada por nível com os números. Exigências × recursos: pressão na
  vertical, apoio na horizontal, escala pelos dados com folga de 0,25 e o
  meio (3) sempre dentro (`escalaDoEixo`), bolha pela quantidade de
  respostas (`raioDaBolha`), cor pelo % em risco (verde → âmbar →
  vermelho) e legenda.
- **Assistente da NR-1:** na anônima, "Separar respostas por" nasce com
  Departamento ligado (`ModeloDaGaleria.separarPorPadrao`); desligado, aviso
  de que a aba Por grupo e o inventário por área ficam sem recorte (ou só
  com o outro campo). A escolha obrigatória na página pública é da frente
  geral.
- **Evidências:** envio e remoção renovam o token CSRF e repetem UMA vez no
  403 `csrf_invalido`; as falhas usam as mensagens comuns de gravação
  (`mensagemDaFalha`).
- **Saúde financeira:** resumo do assistente "15 perguntas do índice + 3 de
  autopercepção"; blocos das perguntas fixas com "Obrigatória"/"Opcional"
  (`ModeloDaGaleria.obrigatoriedadeNosBlocos`); base financeira "N de 14
  possíveis" (inteiro); "Por renda da casa" só com as faixas que têm
  respostas.
- **DISC:** sob o título do "Perfil do time", "Intensidade alta" (puro ou
  acentuado), "moderada" (moderado) ou "baixa" (equilibrado).
- **Avaliação 90°/180°:** tempo pela mesma regra nos e-mails e na página
  pública — 4 minutos por pessoa avaliada × a quantidade
  (`textoDoTempoDaAvaliacao`); os e-mails dizem que a pessoa entra com o CPF
  e a data de nascimento.
- **Onboarding:** no e-mail Padrão, "Conteúdo do padrão" com remetente,
  assunto, título e mensagem em somente leitura, além da prévia.
- **Seed de demonstração:** o gestor sintético (`DEMO-A-0001`) nasce com CPF
  fictício válido e data de nascimento, para testar o link da avaliação
  (bancos semeados do zero; o seed não reescreve quem já existe).

## Tempo estimado por modelo (28/11/2026)

Decisão da proprietária: o tempo estimado passa a seguir números fixos por modelo.

- **Mapa único:** `MINUTOS_POR_MODELO` em `apps/api/src/pesquisas/regras-pesquisa.ts`, com o espelho
  exato em `apps/web/src/screens/pesquisas/tempoEstimado.ts` (um teste da tela lê o código da API e
  exige os dois iguais): Pulso 2, Clima 15, Riscos psicossociais (NR-1) 15, Perfil comportamental
  (DISC) 8, Saúde financeira 6 e Onboarding 5 minutos.
- **`minutosDaPesquisa(modelo, totalPerguntas)`** (API e tela): o número do mapa quando o modelo está
  nele; fora dele (eNPS, Pulso e Clima, Motivação (TAD), Personalizada) e sem modelo, a regra
  `max(3, round(n × 0,3))` (`minutosEstimados`).
- **Vale em todo lugar:** abertura da página pública (`minutosEstimados` do contrato) e o texto que
  ela mostra, prévia da página pública, Sobre ("Como a pessoa responde"), textos dos catálogos
  (`tempoParaResponder`, `minutosCurtos` e `tempoNoTexto` recebem o id do modelo), assistente do
  DISC, resumo e pré-visualização do editor (recebem o modelo), e contagem/e-mails/textos do
  Onboarding (`minutosDoOnboarding`).
- **Paridade com perguntas alteradas:** quando o RH acrescenta ou tira perguntas de um modelo do mapa
  (Pulso, Clima), o tempo continua o número do mapa — não recalcula pela quantidade.
- **Sem mudança:** os modelos prontos da Personalizada mantêm o tempo do card (2, 3, 2, 1, 2 e 2 min,
  `ModeloDaGaleria.minutos`); Avaliação 90°/180° mantém 4 minutos por pessoa avaliada.
- **Nenhum minuto à mão nos catálogos:** os números moram só no mapa; o teste que recusa "N min" ou
  "N minutos" escritos no código dos catálogos continua valendo.
