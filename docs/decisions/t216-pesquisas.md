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
| `POST /pesquisas/:id/duplicar`                  | → `PesquisaDetalhe` (rascunho)                                       |
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
  encerraEm: string | null; // AAAA-MM-DD, ≥ hoje
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
  encerraEm: string | null;
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
  identificacao: Identificacao;
  totalPerguntas: number;
  minutosEstimados: number;
  secoes: Secao[];
}
type AberturaPublica =
  | PesquisaPublica
  | { indisponivel: "pausada" | "encerrada" | "cancelada" | "inexistente" };
// POST identificar → { passe: string; primeiroNome: string }  (401 genérico; 429 limite; 409 já respondeu)
// POST respostas   → 201 { ok: true }  (422 erros por perguntaId; 409 já respondeu; 410 indisponível)
```
