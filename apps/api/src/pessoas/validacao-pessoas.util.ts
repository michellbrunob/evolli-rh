import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  Prisma,
  SituacaoVinculo,
  StatusMovimentacao,
  StatusOrganizacional,
  TipoMovimentacao,
} from "@prisma/client";
import { DestinoOrganizacional } from "./pessoas.types";

/**
 * Máquina de estados da movimentação (spec §8).
 *
 * `aprovada` e `rejeitada` **não têm transição** nesta V1: não há workflow de
 * aprovação (Baseline V1, item 7). Os valores sequer existem no enum de banco
 * — a ausência aqui é consequência, não duplicação de regra.
 *
 * A partir de `efetivada`, a **única** transição admitida é `retificada`
 * (RI-M1). `cancelada` e `retificada` são terminais.
 */
const TRANSICOES_MOVIMENTACAO: Readonly<
  Record<StatusMovimentacao, readonly StatusMovimentacao[]>
> = {
  solicitada: ["efetivada", "cancelada"],
  programada: ["efetivada", "cancelada"],
  efetivada: ["retificada"],
  cancelada: [],
  retificada: [],
};

export function assertTransicaoMovimentacao(
  de: StatusMovimentacao,
  para: StatusMovimentacao,
): void {
  if (!TRANSICOES_MOVIMENTACAO[de].includes(para)) {
    throw new ConflictException();
  }
}

/**
 * Situação em que o vínculo precisa estar para cada tipo de movimentação ser
 * efetivada. É **registro de estado**, nunca decisão trabalhista: o sistema
 * recusa uma admissão sobre vínculo já ativo porque o estado é incoerente,
 * não porque avaliou legalidade nenhuma.
 */
const SITUACAO_EXIGIDA: Readonly<Record<TipoMovimentacao, SituacaoVinculo>> = {
  admissao: "previsto",
  transferencia_organizacional: "ativo",
  mudanca_cargo: "ativo",
  desligamento: "ativo",
};

export function assertSituacaoVinculoParaEfetivar(
  tipo: TipoMovimentacao,
  situacao: SituacaoVinculo,
): void {
  if (SITUACAO_EXIGIDA[tipo] !== situacao) {
    throw new ConflictException();
  }
}

/**
 * Tipos que produzem uma alocação nova ao efetivar. `desligamento` apenas
 * encerra a vigente — por isso não aceita destino.
 */
export function produzAlocacao(tipo: TipoMovimentacao): boolean {
  return tipo !== "desligamento";
}

/** Ao menos uma referência organizacional, espelhando o CHECK do banco. */
export function assertDestinoCoerente(
  tipo: TipoMovimentacao,
  destino: DestinoOrganizacional,
): void {
  const referencias = [
    destino.unidadeOrganizacionalId,
    destino.departamentoId,
    destino.areaId,
    destino.equipeId,
    destino.cargoId,
    destino.centroCustoId,
  ].filter((valor) => valor !== null);

  if (produzAlocacao(tipo)) {
    if (referencias.length === 0) {
      // Alocação obrigatória antes de efetivar vínculo ativo (Baseline V1,
      // item 10). Uma alocação sem nenhuma referência satisfaria a regra na
      // forma e a esvaziaria no conteúdo.
      throw new UnprocessableEntityException();
    }
  } else if (referencias.length > 0) {
    // Desligamento não realoca ninguém.
    throw new UnprocessableEntityException();
  }

  if (destino.areaId !== null && destino.departamentoId === null) {
    // Sem departamento, a FK composta (area_id, departamento_id) não seria
    // verificada — MATCH SIMPLE ignora a checagem quando há NULL na tupla.
    throw new UnprocessableEntityException();
  }
}

/**
 * Valida que **cada** referência organizacional do destino existe, pertence à
 * empresa informada e está **ativa** (RI-A3, análogo de R-INA-3).
 *
 * As FKs compostas do banco já recusariam referência de outra empresa; esta
 * checagem existe para (a) produzir erro estável e sem detalhe interno e
 * (b) cobrir o status, que FK nenhuma expressa.
 *
 * Responde sempre **422**, tanto para inexistente quanto para outra empresa ou
 * inativo — respostas indistinguíveis, para que a rota não vire oráculo de
 * existência de nó organizacional de terceiro.
 */
export async function assertDestinoValidoEAtivo(
  tx: Prisma.TransactionClient,
  empresaId: string,
  destino: DestinoOrganizacional,
): Promise<void> {
  const ativo = StatusOrganizacional.ativo;

  const checagens: Promise<boolean>[] = [];

  if (destino.unidadeOrganizacionalId !== null) {
    checagens.push(
      tx.unidadeOrganizacional
        .count({
          where: {
            id: destino.unidadeOrganizacionalId,
            empresaId,
            status: ativo,
          },
        })
        .then((total) => total === 1),
    );
  }

  if (destino.departamentoId !== null) {
    checagens.push(
      tx.departamento
        .count({
          where: { id: destino.departamentoId, empresaId, status: ativo },
        })
        .then((total) => total === 1),
    );
  }

  if (destino.areaId !== null) {
    if (destino.departamentoId === null) {
      // `assertDestinoCoerente` já recusa este caso antes; aqui é defesa em
      // profundidade, para que a checagem da área nunca rode sem o par que a
      // torna verificável.
      throw new UnprocessableEntityException();
    }
    // A área herda a empresa do departamento; exigir o par (area, dept) fecha
    // a cadeia area -> departamento -> empresa sem `empresa_id` próprio.
    const departamentoId = destino.departamentoId;
    checagens.push(
      tx.area
        .count({
          where: {
            id: destino.areaId,
            departamentoId,
            status: ativo,
            departamento: { empresaId },
          },
        })
        .then((total) => total === 1),
    );
  }

  if (destino.equipeId !== null) {
    checagens.push(
      tx.equipe
        .count({ where: { id: destino.equipeId, empresaId, status: ativo } })
        .then((total) => total === 1),
    );
  }

  if (destino.cargoId !== null) {
    checagens.push(
      tx.cargo
        .count({ where: { id: destino.cargoId, empresaId, status: ativo } })
        .then((total) => total === 1),
    );
  }

  if (destino.centroCustoId !== null) {
    checagens.push(
      tx.centroCusto
        .count({
          where: { id: destino.centroCustoId, empresaId, status: ativo },
        })
        .then((total) => total === 1),
    );
  }

  const resultados = await Promise.all(checagens);
  if (resultados.some((valido) => !valido)) {
    throw new UnprocessableEntityException();
  }
}

/**
 * RI-M4: a vigência de uma movimentação nunca precede a admissão do vínculo,
 * nem sucede um desligamento já efetivado.
 */
export function assertVigenciaCoerente(
  vigenciaInicio: Date,
  dataAdmissao: Date,
  dataDesligamento: Date | null,
): void {
  if (vigenciaInicio < dataAdmissao) {
    throw new UnprocessableEntityException();
  }
  if (dataDesligamento !== null && vigenciaInicio > dataDesligamento) {
    throw new UnprocessableEntityException();
  }
}

/**
 * A sucessão de alocações exige que a nova vigência seja **estritamente
 * posterior** ao início da alocação vigente: `vigente_ate` é exclusivo, e o
 * CHECK do banco recusa `vigente_ate <= vigente_de`.
 *
 * Efeito prático: duas movimentações não podem ser efetivadas na mesma data
 * para o mesmo vínculo — a segunda produziria um intervalo vazio, que não é
 * histórico, é ruído.
 */
export function assertSucessaoCoerente(
  vigenciaInicio: Date,
  vigenteDeAtual: Date,
): void {
  if (vigenciaInicio <= vigenteDeAtual) {
    throw new UnprocessableEntityException();
  }
}

/**
 * Movimentação programada só é efetivada a partir da sua data de vigência.
 * Não há job que a efetive sozinha: a efetivação é sempre ato explícito, com
 * executor identificado (spec §4.9) — o sistema apenas recusa antecipação.
 */
export function assertVigenciaAlcancada(
  vigenciaInicio: Date,
  hoje: Date,
): void {
  if (vigenciaInicio > hoje) {
    throw new ConflictException();
  }
}

/** Data (sem hora) em UTC, para comparação com colunas `DATE`. */
export function dataUtc(valor: Date): Date {
  return new Date(
    Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()),
  );
}
