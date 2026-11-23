/**
 * T215 — Dados profissionais da página "Editar colaborador": o contrato do
 * vínculo principal (`GET/PUT /v1/colaboradores/:id/contrato`) como a tela o
 * edita, e de volta como o servidor o grava. O `PUT` substitui o bloco
 * inteiro: o corpo leva sempre os nove campos e a matrícula.
 */
import type { TipoVinculo } from "../../../api/colaboradoresClient";
import type {
  ContratoDoColaboradorApi,
  RegistrarContratoDto,
} from "../../../api/edicaoColaboradorClient";
import { formatarReais, lerValorEmReais } from "../salarioLiquido";

export interface ValoresProfissionais {
  readonly nivel: string;
  readonly gestorDiretoId: string;
  readonly jornadaSemanalHoras: string;
  readonly escala: string;
  readonly matricula: string;
  /** Na máscara da tela: "5.000,00". */
  readonly salarioBruto: string;
  readonly conselhoProfissional: string;
  readonly registroProfissional: string;
  readonly dependentesIrrf: string;
  /** Com vírgula: "12,5". */
  readonly pensaoAlimenticiaPercentual: string;
}
export type CampoProfissional = keyof ValoresProfissionais;
export type ErrosProfissionais = Partial<Record<CampoProfissional, string>>;

export const ROTULO_DO_TIPO_DE_VINCULO: Readonly<Record<TipoVinculo, string>> =
  {
    clt: "CLT",
    estagio: "Estágio",
    aprendiz: "Aprendiz",
    pj: "PJ",
    temporario: "Temporário",
    outro_controlado: "Outro controlado",
    part_time: "Part-time",
    freelancer: "Freelancer",
    trainee: "Trainee",
  };

export function profissionaisDe(
  gravado: ContratoDoColaboradorApi,
): ValoresProfissionais {
  const c = gravado.contrato;
  return {
    nivel: c.nivel ?? "",
    gestorDiretoId: c.gestorDiretoId ?? "",
    jornadaSemanalHoras:
      c.jornadaSemanalHoras === null ? "" : String(c.jornadaSemanalHoras),
    escala: c.escala ?? "",
    matricula: gravado.vinculo.matricula ?? "",
    salarioBruto:
      c.salarioBruto === null ? "" : formatarReais(Number(c.salarioBruto)),
    conselhoProfissional: c.conselhoProfissional ?? "",
    registroProfissional: c.registroProfissional ?? "",
    dependentesIrrf:
      c.dependentesIrrf === null ? "" : String(c.dependentesIrrf),
    pensaoAlimenticiaPercentual:
      c.pensaoAlimenticiaPercentual === null
        ? ""
        : c.pensaoAlimenticiaPercentual.replace(".", ","),
  };
}

function inteiroOuNulo(valor: string): number | null {
  const t = valor.trim();
  return t === "" ? null : Number(t);
}

export function dtoDoContrato(v: ValoresProfissionais): RegistrarContratoDto {
  const semConselho =
    v.conselhoProfissional === "" || v.conselhoProfissional === "nenhum";
  const salario = lerValorEmReais(v.salarioBruto);
  const pensao = v.pensaoAlimenticiaPercentual.trim().replace(",", ".");
  const registro = v.registroProfissional.trim();
  const matricula = v.matricula.trim().toUpperCase();
  return {
    nivel: v.nivel === "" || v.nivel === "sem_nivel" ? null : v.nivel,
    gestorDiretoId: v.gestorDiretoId === "" ? null : v.gestorDiretoId,
    jornadaSemanalHoras: inteiroOuNulo(v.jornadaSemanalHoras),
    escala: v.escala === "" || v.escala === "nao_informada" ? null : v.escala,
    salarioBruto: salario === null ? null : salario.toFixed(2),
    conselhoProfissional: semConselho ? null : v.conselhoProfissional,
    registroProfissional: semConselho || registro === "" ? null : registro,
    dependentesIrrf: inteiroOuNulo(v.dependentesIrrf),
    pensaoAlimenticiaPercentual: pensao === "" ? null : pensao,
    matricula: matricula === "" ? null : matricula,
  };
}

export function validarProfissionais(
  v: ValoresProfissionais,
): ErrosProfissionais {
  const erros: ErrosProfissionais = {};
  const jornada = v.jornadaSemanalHoras.trim();
  if (
    jornada !== "" &&
    !(/^\d+$/.test(jornada) && +jornada >= 1 && +jornada <= 80)
  ) {
    erros.jornadaSemanalHoras = "Informe de 1 a 80 horas por semana.";
  }
  const dependentes = v.dependentesIrrf.trim();
  if (
    dependentes !== "" &&
    !(/^\d+$/.test(dependentes) && +dependentes <= 99)
  ) {
    erros.dependentesIrrf = "Informe de 0 a 99 dependentes.";
  }
  const pensao = v.pensaoAlimenticiaPercentual.trim().replace(",", ".");
  if (
    pensao !== "" &&
    !(/^\d{1,3}(\.\d{1,2})?$/.test(pensao) && Number(pensao) <= 100)
  ) {
    erros.pensaoAlimenticiaPercentual = "Informe um percentual de 0 a 100.";
  }
  if (
    v.salarioBruto.trim() !== "" &&
    lerValorEmReais(v.salarioBruto) === null
  ) {
    erros.salarioBruto = "Informe o salário em reais, como 5.000,00.";
  }
  const semConselho =
    v.conselhoProfissional === "" || v.conselhoProfissional === "nenhum";
  if (!semConselho && v.registroProfissional.trim() === "") {
    erros.registroProfissional = "Informe o número do registro.";
  }
  if (v.matricula.trim().length > 30) {
    erros.matricula = "A matrícula tem no máximo 30 caracteres.";
  }
  return erros;
}

/** Recusas por campo do servidor, na voz da tela (sem repetir o valor). */
export function errosDaRecusaDoContrato(
  erros: readonly { readonly campo: string; readonly motivo: string }[],
): ErrosProfissionais {
  const saida: ErrosProfissionais = {};
  for (const { campo, motivo } of erros) {
    if (campo === "matricula") {
      saida.matricula =
        motivo === "em_uso"
          ? "Esta matrícula já é usada por outra pessoa da empresa."
          : "Confira a matrícula.";
    } else if (campo === "gestorDiretoId") {
      saida.gestorDiretoId = "Escolha outra pessoa como gestor direto.";
    }
  }
  return saida;
}
