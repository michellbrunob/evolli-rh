/**
 * T215 — Dados profissionais da página "Editar colaborador": o contrato do
 * vínculo principal (`GET/PUT /v1/colaboradores/:id/contrato`) como a tela o
 * edita, e de volta como o servidor o grava. O `PUT` substitui o bloco
 * inteiro: o corpo leva sempre os campos editáveis e a matrícula.
 *
 * O salário NÃO vai no corpo: aqui ele é só leitura (o espelho do período
 * vigente). Mudar o salário é registrar uma alteração com data na aba
 * Salários — assim um aumento não vira retroativo, o valor anterior fica no
 * histórico e um formulário aberto há tempo não apaga um reajuste.
 */
import type { TipoVinculo } from "../../../api/colaboradoresClient";
import type {
  ContratoDoColaboradorApi,
  RegistrarContratoDto,
} from "../../../api/edicaoColaboradorClient";
import { formatarReais } from "../salarioLiquido";

/**
 * A regra da matrícula na API (`MATRICULA_PATTERN`): 2 a 32 caracteres,
 * letras maiúsculas sem acento, dígitos, hífen e sublinhado. A tela grava em
 * maiúsculas.
 */
export const MATRICULA_PADRAO = /^[A-Z0-9_-]{2,32}$/;
export const MATRICULA_MAXIMO = 32;

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
  const pensao = v.pensaoAlimenticiaPercentual.trim().replace(",", ".");
  const registro = v.registroProfissional.trim();
  const matricula = v.matricula.trim().toUpperCase();
  return {
    nivel: v.nivel === "" || v.nivel === "sem_nivel" ? null : v.nivel,
    gestorDiretoId: v.gestorDiretoId === "" ? null : v.gestorDiretoId,
    jornadaSemanalHoras: inteiroOuNulo(v.jornadaSemanalHoras),
    escala: v.escala === "" || v.escala === "nao_informada" ? null : v.escala,
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
  const semConselho =
    v.conselhoProfissional === "" || v.conselhoProfissional === "nenhum";
  if (!semConselho && v.registroProfissional.trim() === "") {
    erros.registroProfissional = "Informe o número do registro.";
  }
  const matricula = v.matricula.trim().toUpperCase();
  if (matricula !== "" && !MATRICULA_PADRAO.test(matricula)) {
    erros.matricula =
      "Use de 2 a 32 caracteres: letras sem acento, números, hífen ou sublinhado.";
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
    } else if (campo === "salarioBruto") {
      saida.salarioBruto =
        motivo === "nao_se_aplica"
          ? "O salário mudou na aba Salários depois que esta página abriu. Recarregue para ver o valor atual."
          : motivo === "obrigatorio"
            ? "O salário não pode ficar vazio. Para mudar, registre uma alteração na aba Salários."
            : "Confira o salário na aba Salários.";
    }
  }
  return saida;
}
