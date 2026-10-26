/**
 * T183 — regras puras da jornada de trabalho do colaborador na tela.
 *
 * O servidor guarda a vigência como `[início, fim)`: `vigenciaInicio` é o
 * primeiro dia com a jornada e `vigenciaFim` o primeiro dia SEM ela. Na tela,
 * quem lê pensa em "de … até …", então o término mostrado é o ÚLTIMO dia com
 * a jornada (`vigenciaFim` menos um dia), e o encerramento pergunta o último
 * dia e envia o seguinte.
 *
 * "Hoje" é o dia civil do navegador; fuso horário não faz parte do produto.
 */
import type {
  JornadaDoVinculoApi,
  VinculoHorarioApi,
} from "../../api/vinculoHorarioClient";
import {
  diaDeHoje,
  proximoDiaCivil,
} from "../administracao/AdministracaoLiderancaScreen";

export { diaDeHoje, proximoDiaCivil };

export type SituacaoDaVigencia = "vigente" | "programada" | "encerrada";

/** Dia civil anterior (`AAAA-MM-DD`), com a aritmética em UTC (só calendário). */
export function diaAnteriorCivil(dia: string): string {
  const base = Date.UTC(
    Number(dia.slice(0, 4)),
    Number(dia.slice(5, 7)) - 1,
    Number(dia.slice(8, 10)),
  );
  const d = new Date(base - 24 * 60 * 60 * 1000);
  const ano = String(d.getUTCFullYear()).padStart(4, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const diaDoMes = String(d.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${diaDoMes}`;
}

/** A vigência em relação a hoje: começa depois, já terminou, ou vale hoje. */
export function situacaoDaVigencia(
  vinculo: Pick<VinculoHorarioApi, "vigenciaInicio" | "vigenciaFim">,
  hoje: string,
): SituacaoDaVigencia {
  if (vinculo.vigenciaInicio > hoje) return "programada";
  if (vinculo.vigenciaFim !== null && vinculo.vigenciaFim <= hoje) {
    return "encerrada";
  }
  return "vigente";
}

/** A vigência que vale hoje, se houver (no máximo uma: o banco garante). */
export function jornadaDeHoje(
  vinculos: readonly VinculoHorarioApi[],
  hoje: string,
): VinculoHorarioApi | null {
  return (
    vinculos.find((v) => situacaoDaVigencia(v, hoje) === "vigente") ?? null
  );
}

/**
 * A vigência ABERTA (sem fim), se houver — é ela que a troca e o
 * encerramento alcançam, mesmo quando começa depois de hoje.
 */
export function vigenciaAberta(
  vinculos: readonly VinculoHorarioApi[],
): VinculoHorarioApi | null {
  return vinculos.find((v) => v.vigenciaFim === null) ?? null;
}

/** Último dia com a jornada, ou `null` sem término. */
export function ultimoDiaDaVigencia(
  vinculo: Pick<VinculoHorarioApi, "vigenciaFim">,
): string | null {
  return vinculo.vigenciaFim === null
    ? null
    : diaAnteriorCivil(vinculo.vigenciaFim);
}

/** "COMERCIAL_44H — Comercial 44 horas", ou só o nome sem código. */
export function rotuloDaJornada(
  jornada: Pick<JornadaDoVinculoApi, "codigo" | "nome">,
): string {
  return jornada.codigo ? `${jornada.codigo} — ${jornada.nome}` : jornada.nome;
}

export type CampoDaJornada =
  "tabelaHorarioId" | "vigenciaInicio" | "vigenciaFim";

/**
 * Mensagem de uma recusa por campo do servidor (campo e motivo, nunca o
 * valor). `null` para combinação desconhecida: quem chama cai na mensagem
 * geral.
 */
export function mensagemDoCampo(
  campo: string,
  motivo: string,
): { campo: CampoDaJornada; mensagem: string } | null {
  const chave = `${campo}:${motivo}`;
  switch (chave) {
    case "tabelaHorarioId:indisponivel":
      return {
        campo: "tabelaHorarioId",
        mensagem:
          "Esta jornada não está disponível. Escolha uma jornada ativa da empresa.",
      };
    case "tabelaHorarioId:igual_a_vigente":
      return {
        campo: "tabelaHorarioId",
        mensagem: "Escolha uma jornada diferente da atual.",
      };
    case "vigenciaInicio:fora_de_ordem":
      return {
        campo: "vigenciaInicio",
        mensagem:
          "A nova jornada precisa começar depois do início da jornada atual.",
      };
    case "vigenciaInicio:sobreposta":
      return {
        campo: "vigenciaInicio",
        mensagem:
          "Este período cruza outra vigência do colaborador. Escolha outra data.",
      };
    case "vigenciaFim:fora_de_ordem":
      return {
        campo: "vigenciaFim",
        mensagem: "O último dia não pode ser antes do primeiro dia da jornada.",
      };
    case "vigenciaFim:ja_encerrada":
      return {
        campo: "vigenciaFim",
        mensagem:
          "Esta jornada já foi encerrada. Atualize o histórico para conferir.",
      };
    default:
      return null;
  }
}
