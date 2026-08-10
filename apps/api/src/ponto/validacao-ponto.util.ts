import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  AjustePonto,
  EventoPonto,
  Prisma,
  SituacaoVinculo,
  TipoEventoPonto,
} from "@prisma/client";
import {
  competenciaDe,
  dataDeColunaDate,
  dataLocalDe,
} from "./competencia.util";
import { ValorEfetivoPonto } from "./ponto.types";

/** Só o que o módulo precisa saber do vínculo — nenhum dado pessoal. */
export interface VinculoParaPonto {
  situacao: SituacaoVinculo;
  dataAdmissao: Date;
  dataDesligamento: Date | null;
}

/**
 * Um vínculo aceita ponto quando está `ativo` ou `encerrado`, e o momento cai
 * dentro da vigência.
 *
 * **`previsto` é recusado** porque a spec (§6.7) exclui explicitamente vínculo
 * previsto — registrar presença de alguém que ainda não foi admitido não tem
 * sentido de negócio.
 *
 * **`encerrado` é aceito** porque bloqueá-lo inutilizaria a correção justamente
 * onde ela mais ocorre: fechar ou corrigir o último mês de quem foi desligado é
 * tarefa rotineira de DP, e um erro detectado no dia seguinte ao desligamento
 * ficaria sem caminho de conserto.
 *
 * **A janela de vigência é validada** para que não seja possível registrar
 * presença em data na qual a pessoa não estava vinculada à empresa. Comparação
 * feita em data **local** (ver `dataLocalDe`): comparar o instante UTC direto
 * com a coluna `date` erraria a fronteira do primeiro e do último dia.
 */
export function assertVinculoAceitaPonto(
  vinculo: VinculoParaPonto,
  momento: Date,
): void {
  if (vinculo.situacao === "previsto") {
    throw new UnprocessableEntityException(
      "Vinculo ainda nao efetivado nao aceita registro de ponto.",
    );
  }

  const dia = dataLocalDe(momento);

  if (dia < dataDeColunaDate(vinculo.dataAdmissao)) {
    throw new UnprocessableEntityException(
      "Momento anterior a admissao do vinculo.",
    );
  }

  if (
    vinculo.dataDesligamento !== null &&
    dia > dataDeColunaDate(vinculo.dataDesligamento)
  ) {
    throw new UnprocessableEntityException(
      "Momento posterior ao desligamento do vinculo.",
    );
  }
}

/**
 * Anulação é **terminal**: um evento anulado não aceita mais ajuste.
 *
 * A alternativa — permitir que um ajuste posterior "desanule" — criaria um
 * efeito colateral surpreendente (corrigir o horário de um evento anulado o
 * traria de volta à existência) e daria ao ajuste um poder que a decisão 4 não
 * lhe deu. Se a própria anulação foi um erro, o caminho é registrar um evento
 * **novo** com o dado correto: nada se perde, e a trilha mostra exatamente o
 * que aconteceu.
 */
export function assertEventoAjustavel(efetivo: ValorEfetivoPonto): void {
  if (efetivo.anulado) {
    throw new ConflictException(
      "Evento ja anulado nao aceita novo ajuste. Registre um evento novo.",
    );
  }
}

/**
 * Um ajuste não pode mover o evento para outra competência.
 *
 * `competencia` é gravada no evento e imutável (decisão 6) — é o mês em que o
 * registro foi arquivado. Deixar um ajuste mover o registro de mês faria o
 * conteúdo de uma competência mudar sem nenhuma escrita naquela competência, e
 * esta V1 não tem reabertura nem fechamento (decisão 7) que tornassem isso
 * seguro.
 *
 * **Não bloqueia a correção legítima:** o caminho é anular o evento no mês
 * errado e registrar um evento novo no mês certo. Duas operações explícitas,
 * ambas rastreáveis, em vez de uma que reescreve silenciosamente o passado.
 */
export function assertAjusteMantemCompetencia(
  competenciaDoEvento: string,
  momentoCorrigido: Date,
): void {
  if (competenciaDe(momentoCorrigido) !== competenciaDoEvento) {
    throw new UnprocessableEntityException(
      "Ajuste nao pode mover o evento para outra competencia. " +
        "Anule o evento e registre um novo na competencia correta.",
    );
  }
}

/**
 * Resolve o valor **efetivo** do evento aplicando os ajustes em ordem
 * cronológica.
 *
 * O original nunca é tocado — este cálculo acontece na leitura, sobre linhas
 * imutáveis. `ajustes` precisa vir ordenado por `registradoEm` ascendente.
 */
export function resolverEfetivo(
  evento: Pick<EventoPonto, "tipo" | "momento">,
  ajustes: Pick<
    AjustePonto,
    "anula" | "momentoCorrigido" | "tipoCorrigido" | "registradoEm"
  >[],
): ValorEfetivoPonto {
  let tipo: TipoEventoPonto = evento.tipo;
  let momento: Date = evento.momento;
  let anulado = false;

  for (const ajuste of ajustes) {
    if (ajuste.anula) {
      // Terminal: `assertEventoAjustavel` impede ajuste posterior, então nada
      // depois disto deveria existir. Manter o loop simples (sem `break`) faz
      // a leitura permanecer correta mesmo se uma linha for inserida por fora
      // da API — SQL direto, manutenção manual, módulo futuro.
      anulado = true;
      continue;
    }
    if (ajuste.momentoCorrigido !== null) {
      momento = ajuste.momentoCorrigido;
    }
    if (ajuste.tipoCorrigido !== null) {
      tipo = ajuste.tipoCorrigido;
    }
  }

  return { tipo, momento, anulado, totalAjustes: ajustes.length };
}

/**
 * Traduz falha de restrição do banco em erro HTTP estável, sem vazar nome de
 * tabela, coluna, constraint ou SQL.
 */
export function traduzirErroPonto(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ConflictException();
    }
    // P2003: FK — inclui as FKs compostas que garantem "mesma empresa".
    if (error.code === "P2003") {
      throw new UnprocessableEntityException();
    }
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    // 23514 — CHECK: efeito do ajuste incoerente, competência fora do formato.
    if (
      /23514/.test(error.message) ||
      /violates check constraint/i.test(error.message)
    ) {
      throw new UnprocessableEntityException();
    }
  }

  // Erro de privilégio (42501) **não** é traduzido de propósito.
  //
  // Esta API nunca tenta `UPDATE`/`DELETE` nas tabelas append-only, e nunca
  // escreve fora do escopo concedido a `evolli_app`. Se um erro de privilégio
  // chegar aqui, ou a base está mal provisionada ou algo tentou uma escrita
  // que não deveria existir — nos dois casos é falha do servidor, não do
  // cliente. Traduzi-lo para 4xx diria ao chamador que **ele** errou, e daria
  // a um atacante um sinal de qual privilégio falta. Deixar propagar leva ao
  // `AllExceptionsFilter` (ADR 0001), que responde 500 genérico e registra o
  // caso no log estruturado — que é onde um problema desses precisa aparecer.
  throw error;
}
