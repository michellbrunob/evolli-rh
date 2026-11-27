/** T215 — dados sintéticos do quadro da escala, só para testes. */
import type {
  EscalaApi,
  PessoaDoQuadroApi,
  TurnoDaEscalaApi,
} from "../../../api/escalaClient";
import type { TabelaHorarioApi } from "../../../api/horariosClient";

export const DIAS_UTEIS = ["segunda", "terca", "quarta", "quinta", "sexta"];

export function turno(
  nome: string,
  extra: Partial<TurnoDaEscalaApi> = {},
): TurnoDaEscalaApi {
  return {
    id: `t-${nome}`,
    codigo: null,
    nome,
    ativo: true,
    periodos: DIAS_UTEIS.map((dia) => ({ dia, inicio: "09:00", fim: "18:00" })),
    intervaloMinutos: 60,
    cor: "azul",
    sigla: nome[0]!.toUpperCase(),
    ...extra,
  };
}

export function escala(extra: Partial<EscalaApi> = {}): EscalaApi {
  return {
    id: "e1",
    modelo: "5x2",
    turno: turno("Comercial"),
    turnoNoite: null,
    folgaSemanal: null,
    diasTrabalho: [],
    inicioCiclo: null,
    vigenciaInicio: "2026-01-05",
    vigenciaFim: null,
    definidaEm: "2026-01-01T12:00:00.000Z",
    definidaPor: "RH",
    ...extra,
  };
}

export function pessoa(
  nome: string,
  extra: Partial<PessoaDoQuadroApi> = {},
): PessoaDoQuadroApi {
  return {
    colaboradorId: `c-${nome}`,
    nome,
    tipoVinculo: "clt",
    situacao: "ativo",
    dataAdmissao: "2025-01-06",
    dataDesligamento: null,
    departamento: null,
    unidade: null,
    cargo: null,
    area: null,
    centroCusto: null,
    gestor: null,
    nivel: null,
    genero: null,
    escalaDoCadastro: null,
    jornadaSemanalHoras: 44,
    escalas: [],
    dias: [],
    ...extra,
  };
}

/** O turno como a lista de turnos devolve. */
export function tabelaHorario(
  nome: string,
  extra: Partial<TabelaHorarioApi> = {},
): TabelaHorarioApi {
  return {
    id: `t-${nome}`,
    empresaId: "emp",
    codigo: null,
    nome,
    ativo: true,
    criadoPorUserId: "u",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    periodos: DIAS_UTEIS.map((dia) => ({ dia, inicio: "09:00", fim: "18:00" })),
    cor: "azul",
    sigla: nome[0]!,
    intervaloMinutos: 60,
    ...extra,
  };
}
