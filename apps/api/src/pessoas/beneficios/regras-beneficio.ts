import type { ErroDeCampo } from "../../common/erros/recusa-por-campo";
import {
  type AntecipacaoDoBeneficio,
  CATEGORIAS,
  type Categoria,
  FOLHAS,
  type Folha,
  type PlanoDoBeneficio,
  type QuemPaga,
  type RegrasDoBeneficio,
  TIPOS_DE_VALOR,
  type TipoDeValor,
  regrasAns,
} from "./calculo-beneficios";

/**
 * T215 — conferência de um benefício antes de gravar (como a referência): o
 * tipo de valor que a categoria aceita, os valores obrigatórios, o término
 * obrigatório de planos e seguros, a tabela da ANS (RN 63/2003) e os limites.
 * Devolve as regras completas (com os padrões) ou os erros por campo.
 */

const TIPOS_POR_CATEGORIA: Record<Categoria, readonly TipoDeValor[]> = {
  alimentacao: ["fixo", "dia_util", "individual"],
  mobilidade: ["dia_util", "fixo", "individual"],
  saude: ["fixo", "individual", "faixa_etaria"],
  odontologico: ["fixo", "individual", "faixa_etaria"],
  seguro_vida: ["fixo", "individual"],
  bem_estar: ["fixo", "individual"],
  saude_mental: ["fixo", "individual"],
  educacao: ["fixo", "individual"],
  trabalho_remoto: ["fixo", "individual"],
  multibeneficios: ["fixo", "dia_util", "individual"],
  antecipacao: ["antecipacao"],
  outros: ["fixo", "dia_util", "individual"],
};

export function tiposDeValorDa(categoria: Categoria): readonly TipoDeValor[] {
  return TIPOS_POR_CATEGORIA[categoria];
}

/** Planos de saúde, odontológicos e seguros pedem o término do contrato. */
export function terminoObrigatorio(categoria: Categoria): boolean {
  return (
    categoria === "saude" ||
    categoria === "odontologico" ||
    categoria === "seguro_vida"
  );
}

export interface BeneficioInformado {
  nome: string;
  categoria: string;
  folha: string;
  tipoValor: string;
  inicio: string;
  fim?: string | null;
  observacao?: string | null;
  regras: Record<string, unknown>;
}

export interface BeneficioConferido {
  nome: string;
  categoria: Categoria;
  folha: Folha;
  tipoValor: TipoDeValor;
  inicio: string;
  fim: string | null;
  observacao: string | null;
  regras: RegrasDoBeneficio;
}

const LIMITE = 10_000_000;

/** Número em reais, ≥ 0, com até 2 casas; `null` se ausente; NaN se inválido. */
function reais(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > LIMITE) {
    return Number.NaN;
  }
  return Math.round(v * 100) / 100;
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;
/** `AAAA-MM-DD` de um dia que existe (30/02 não passa). */
export function diaValido(texto: string): boolean {
  if (!FORMATO_DIA.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}
const DIA = { test: (t: string) => diaValido(t) };

export function conferirBeneficio(dto: BeneficioInformado): {
  erros: ErroDeCampo[];
  beneficio: BeneficioConferido | null;
} {
  const erros: ErroDeCampo[] = [];
  const erro = (campo: ErroDeCampo["campo"], motivo: ErroDeCampo["motivo"]) => {
    if (!erros.some((e) => e.campo === campo)) erros.push({ campo, motivo });
  };

  const nome = (dto.nome ?? "").trim().replace(/\s+/g, " ");
  if (!nome) erro("nome", "obrigatorio");
  else if (nome.length > 120) erro("nome", "invalido");

  const categoria = dto.categoria as Categoria;
  if (!(CATEGORIAS as readonly string[]).includes(categoria)) {
    erro("categoria", "obrigatorio");
  }
  const folha = dto.folha as Folha;
  if (!(FOLHAS as readonly string[]).includes(folha))
    erro("folha", "obrigatorio");
  const tipoValor = dto.tipoValor as TipoDeValor;
  if (!(TIPOS_DE_VALOR as readonly string[]).includes(tipoValor)) {
    erro("tipoValor", "obrigatorio");
  } else if (
    TIPOS_POR_CATEGORIA[categoria] &&
    !TIPOS_POR_CATEGORIA[categoria].includes(tipoValor)
  ) {
    erro("tipoValor", "nao_se_aplica");
  }

  if (!DIA.test(dto.inicio ?? "")) erro("inicio", "obrigatorio");
  const fim = dto.fim ?? null;
  if (fim !== null && !DIA.test(fim)) erro("fim", "invalido");
  else if (
    fim === null &&
    TIPOS_POR_CATEGORIA[categoria] &&
    terminoObrigatorio(categoria)
  ) {
    erro("fim", "obrigatorio");
  } else if (fim !== null && DIA.test(dto.inicio ?? "") && fim < dto.inicio) {
    erro("fim", "fim_antes_do_inicio");
  }
  const observacao = (dto.observacao ?? "").trim() || null;
  if (observacao && observacao.length > 500) erro("observacao", "invalido");

  const r = objeto(dto.regras);

  // Quem paga.
  const q = objeto(r.quemPaga);
  let quemPaga: QuemPaga = {
    modo:
      q.modo === "colaborador_tudo" || q.modo === "empresa_tudo"
        ? q.modo
        : "empresa_parte",
    calculo: q.calculo === "valor" ? "valor" : "percentual",
    empresa: reais(q.empresa) ?? 0,
  };
  if (
    Number.isNaN(quemPaga.empresa) ||
    (quemPaga.calculo === "percentual" && quemPaga.empresa > 100)
  ) {
    erro("regras.quemPaga", "invalido");
  }
  if (folha === "adicional") {
    quemPaga = { modo: "empresa_tudo", calculo: "percentual", empresa: 100 };
  } else if (folha === "desconto" && quemPaga.modo === "empresa_tudo") {
    erro("regras.quemPaga", "nao_se_aplica");
  } else if (
    folha === "fora_da_folha" &&
    quemPaga.modo === "colaborador_tudo"
  ) {
    erro("regras.quemPaga", "nao_se_aplica");
  }

  // Valores por tipo.
  const valorMensal = reais(r.valorMensal);
  const valorDia = reais(r.valorDia);
  if (tipoValor === "fixo") {
    if (valorMensal === null || valorMensal === 0)
      erro("regras.valorMensal", "obrigatorio");
    else if (Number.isNaN(valorMensal)) erro("regras.valorMensal", "invalido");
  }
  if (tipoValor === "dia_util") {
    if (valorDia === null || valorDia === 0)
      erro("regras.valorDia", "obrigatorio");
    else if (Number.isNaN(valorDia)) erro("regras.valorDia", "invalido");
  }

  const individualModo = r.individualModo === "plano" ? "plano" : "livre";
  const planos: PlanoDoBeneficio[] = [];
  if (Array.isArray(r.planos)) {
    for (const [i, bruto] of r.planos.entries()) {
      const pl = objeto(bruto);
      const nomePlano = typeof pl.nome === "string" ? pl.nome.trim() : "";
      const valor = reais(pl.valor);
      const id =
        typeof pl.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(pl.id)
          ? pl.id
          : `plano-${i + 1}`;
      if (
        !nomePlano ||
        nomePlano.length > 60 ||
        valor === null ||
        Number.isNaN(valor)
      ) {
        erro("regras.planos", "invalido");
        continue;
      }
      planos.push({ id, nome: nomePlano, valor });
    }
  }
  if (
    tipoValor === "individual" &&
    individualModo === "plano" &&
    planos.length === 0
  ) {
    erro("regras.planos", "obrigatorio");
  }

  let faixas: number[] = [];
  const cp = objeto(r.colaboradorPaga);
  const colaboradorPaga = {
    calculo:
      cp.calculo === "valor" ? ("valor" as const) : ("percentual" as const),
    titular: reais(cp.titular) ?? 0,
    dependente: reais(cp.dependente) ?? 0,
  };
  if (tipoValor === "faixa_etaria") {
    const brutas = Array.isArray(r.faixas) ? r.faixas.map(reais) : [];
    if (brutas.length !== 10 || brutas.some((f) => f === null || f === 0)) {
      erro("regras.faixas", "obrigatorio");
    } else if (brutas.some((f) => Number.isNaN(f))) {
      erro("regras.faixas", "invalido");
    } else {
      faixas = brutas as number[];
      const ans = regrasAns(faixas);
      if (!ans || !ans.seisVezesOk || !ans.variacaoOk) {
        erro("regras.faixas", "fora_das_regras_ans");
      }
    }
    if (
      Number.isNaN(colaboradorPaga.titular) ||
      Number.isNaN(colaboradorPaga.dependente) ||
      (colaboradorPaga.calculo === "percentual" &&
        (colaboradorPaga.titular > 100 || colaboradorPaga.dependente > 100))
    ) {
      erro("regras.colaboradorPaga", "invalido");
    }
  }

  const vtBruto = objeto(r.vt);
  const vt = {
    percentualSalario:
      vtBruto.percentualSalario === undefined
        ? 6
        : (reais(vtBruto.percentualSalario) ?? 6),
    empresaCusteiaTudo: vtBruto.empresaCusteiaTudo === true,
  };
  if (Number.isNaN(vt.percentualSalario) || vt.percentualSalario > 6) {
    erro("regras.vt", "invalido");
  }

  let antecipacao: AntecipacaoDoBeneficio | null = null;
  if (tipoValor === "antecipacao") {
    const a = objeto(r.antecipacao);
    const modo = a.modo === "percentual" ? "percentual" : "variavel";
    const percentual = reais(a.percentual);
    const dia =
      typeof a.diaDesconto === "number" && Number.isInteger(a.diaDesconto)
        ? a.diaDesconto
        : null;
    const mensalidade = reais(a.mensalidade);
    antecipacao = {
      mensalidade:
        mensalidade && !Number.isNaN(mensalidade) ? mensalidade : null,
      mensalidadeQuemPaga:
        a.mensalidadeQuemPaga === "colaborador" ? "colaborador" : "empresa",
      modo,
      percentual: modo === "percentual" ? percentual : null,
      diaDesconto: modo === "percentual" ? dia : null,
    };
    if (Number.isNaN(mensalidade)) erro("regras.antecipacao", "invalido");
    if (modo === "percentual") {
      if (percentual === null || percentual === 0 || dia === null) {
        erro("regras.antecipacao", "obrigatorio");
      } else if (
        Number.isNaN(percentual) ||
        percentual > 100 ||
        dia < 1 ||
        dia > 31
      ) {
        erro("regras.antecipacao", "invalido");
      }
    }
  }

  if (erros.length > 0) return { erros, beneficio: null };
  return {
    erros,
    beneficio: {
      nome,
      categoria,
      folha,
      tipoValor,
      inicio: dto.inicio,
      fim,
      observacao,
      regras: {
        categoria,
        folha,
        tipoValor,
        valorMensal: tipoValor === "fixo" ? valorMensal : null,
        valorDia: tipoValor === "dia_util" ? valorDia : null,
        diasModo: r.diasModo === "escala" ? "escala" : "uteis",
        individualModo,
        planos:
          tipoValor === "individual" && individualModo === "plano"
            ? planos
            : [],
        faixas,
        colaboradorPaga,
        coparticipacao:
          tipoValor === "faixa_etaria" && r.coparticipacao === true,
        quemPaga,
        vt,
        antecipacao,
      },
    },
  };
}
