/**
 * T215 — Benefícios: os rótulos, ajudas e regras de tela por categoria
 * (como a referência, 2026-11-26). O servidor confere tudo de novo; aqui só
 * o que a tela mostra e oferece.
 */
import {
  IconeBeneficios,
  IconeCarteira,
  IconeCasa,
  IconeComentario,
  IconeDinheiro,
  IconeEstrela,
  IconeFamilia,
  IconeFormacao,
  IconeHospital,
  IconeLocal,
  IconePresente,
  IconeSaude,
  type IconeDoEcossistema,
} from "../../ui/icones";
import { modeloDe } from "../pessoas/ficha/escala/modelosDeEscala";
import type {
  CategoriaBeneficio,
  FolhaBeneficio,
  ObservacaoBeneficio,
  OrigemDosDias,
  Parentesco,
  PendenciaBeneficio,
  TipoDeValorBeneficio,
} from "../../api/beneficiosClient";

export interface InfoDaCategoria {
  readonly rotulo: string;
  /** Nome curto (lista, ficha, "Por categoria"). */
  readonly curta: string;
  /** Linha de baixo na lista de categorias. */
  readonly sub: string | null;
  /** A regra da lei que vale (abaixo do campo Categoria). */
  readonly ajuda: string;
  readonly tipos: readonly TipoDeValorBeneficio[];
  readonly folhaPadrao: FolhaBeneficio;
  readonly terminoObrigatorio: boolean;
  /** "Tipo" na revisão. */
  readonly regraNaRevisao: string | null;
}

const SEM_REGRA =
  "Sem regra legal específica: você define quanto a empresa paga.";

export const CATEGORIAS: Readonly<Record<CategoriaBeneficio, InfoDaCategoria>> =
  {
    alimentacao: {
      rotulo: "Alimentação (VA/VR)",
      curta: "Alimentação",
      sub: "Regras do PAT",
      ajuda:
        "Alimentação segue o PAT: o desconto do colaborador fica em até 20% do valor.",
      tipos: ["fixo", "dia_util", "individual"],
      folhaPadrao: "desconto",
      terminoObrigatorio: false,
      regraNaRevisao: "segue as regras do PAT",
    },
    mobilidade: {
      rotulo: "Mobilidade (vale-transporte)",
      curta: "Mobilidade",
      sub: "Desconto de até 6% do salário",
      ajuda:
        "Vale-transporte segue a Lei 7.418/85: desconto de até 6% do salário base (menos, se a convenção coletiva mandar), nunca maior que o próprio VT.",
      tipos: ["dia_util", "fixo", "individual"],
      folhaPadrao: "desconto",
      terminoObrigatorio: false,
      regraNaRevisao: "segue a Lei 7.418/85",
    },
    saude: {
      rotulo: "Plano de saúde",
      curta: "Saúde",
      sub: "Faixas da ANS",
      ajuda: "Planos por faixa etária seguem a tabela da ANS (RN 63/2003).",
      tipos: ["fixo", "individual", "faixa_etaria"],
      folhaPadrao: "desconto",
      terminoObrigatorio: true,
      regraNaRevisao: "segue as regras da ANS",
    },
    odontologico: {
      rotulo: "Odontológico",
      curta: "Odontológico",
      sub: "Faixas da ANS",
      ajuda: "Planos por faixa etária seguem a tabela da ANS (RN 63/2003).",
      tipos: ["fixo", "individual", "faixa_etaria"],
      folhaPadrao: "desconto",
      terminoObrigatorio: true,
      regraNaRevisao: "segue as regras da ANS",
    },
    seguro_vida: {
      rotulo: "Seguro de vida",
      curta: "Seguro de vida",
      sub: null,
      ajuda:
        "Seguro de vida em grupo costuma ser pago pela empresa e não entrar na folha.",
      tipos: ["fixo", "individual"],
      folhaPadrao: "fora_da_folha",
      terminoObrigatorio: true,
      regraNaRevisao: null,
    },
    bem_estar: {
      rotulo: "Bem-estar e academia",
      curta: "Bem-estar",
      sub: null,
      ajuda: SEM_REGRA,
      tipos: ["fixo", "individual"],
      folhaPadrao: "desconto",
      terminoObrigatorio: false,
      regraNaRevisao: null,
    },
    saude_mental: {
      rotulo: "Saúde mental",
      curta: "Saúde mental",
      sub: null,
      ajuda: SEM_REGRA,
      tipos: ["fixo", "individual"],
      folhaPadrao: "desconto",
      terminoObrigatorio: false,
      regraNaRevisao: null,
    },
    educacao: {
      rotulo: "Educação",
      curta: "Educação",
      sub: null,
      ajuda:
        "Bolsas e cursos pagos direto à instituição não entram no salário (CLT, art. 458, §2º, II).",
      tipos: ["fixo", "individual"],
      folhaPadrao: "fora_da_folha",
      terminoObrigatorio: false,
      regraNaRevisao: null,
    },
    trabalho_remoto: {
      rotulo: "Trabalho remoto",
      curta: "Trabalho remoto",
      sub: null,
      ajuda:
        "Ajuda de custo paga junto com o salário, como adicional no holerite.",
      tipos: ["fixo", "individual"],
      folhaPadrao: "adicional",
      terminoObrigatorio: false,
      regraNaRevisao: null,
    },
    multibeneficios: {
      rotulo: "Multibenefícios (flexível)",
      curta: "Multibenefícios",
      sub: null,
      ajuda:
        "Se a maior parte for alimentação, prefira a categoria Alimentação para seguir o PAT.",
      tipos: ["fixo", "dia_util", "individual"],
      folhaPadrao: "desconto",
      terminoObrigatorio: false,
      regraNaRevisao: null,
    },
    antecipacao: {
      rotulo: "Antecipação de salário",
      curta: "Antecipação",
      sub: null,
      ajuda:
        "Configure a mensalidade do produto (se houver) e como o valor antecipado é descontado do colaborador.",
      tipos: ["antecipacao"],
      folhaPadrao: "desconto",
      terminoObrigatorio: false,
      regraNaRevisao: null,
    },
    outros: {
      rotulo: "Outros",
      curta: "Outros",
      sub: null,
      ajuda: SEM_REGRA,
      tipos: ["fixo", "dia_util", "individual"],
      folhaPadrao: "desconto",
      terminoObrigatorio: false,
      regraNaRevisao: null,
    },
  };

export const ORDEM_DAS_CATEGORIAS = Object.keys(
  CATEGORIAS,
) as CategoriaBeneficio[];

export const FOLHAS: Readonly<
  Record<FolhaBeneficio, { titulo: string; ajuda: string; naRevisao: string }>
> = {
  desconto: {
    titulo: "Desconto do colaborador",
    ajuda: "A parte que a pessoa paga é descontada do salário.",
    naRevisao: "Vira desconto do colaborador",
  },
  adicional: {
    titulo: "Adicional no salário",
    ajuda: "A empresa paga junto com o salário, como o auxílio home office.",
    naRevisao: "Entra como adicional no salário",
  },
  fora_da_folha: {
    titulo: "Não entra na folha",
    ajuda:
      "Nada vai para o holerite. Serve para controlar o custo e aparecer no Portal.",
    naRevisao: "Não entra na folha",
  },
};

export const TIPOS_DE_VALOR: Readonly<
  Record<TipoDeValorBeneficio, { titulo: string; ajuda: string }>
> = {
  fixo: {
    titulo: "Valor fixo mensal",
    ajuda: "Todo mês, o mesmo valor para todos",
  },
  dia_util: {
    titulo: "Por dia útil",
    ajuda: "Valor do dia × dias trabalhados",
  },
  individual: {
    titulo: "Valor individual",
    ajuda: "Você informa o valor de cada pessoa",
  },
  faixa_etaria: {
    titulo: "Por faixa etária",
    ajuda: "O valor muda conforme a idade (tabela da ANS)",
  },
  antecipacao: { titulo: "Antecipação", ajuda: "" },
};

/** No vale-transporte, o dia útil fala de passagens. */
export function tituloDoTipo(c: CategoriaBeneficio, t: TipoDeValorBeneficio) {
  if (c === "mobilidade" && t === "dia_util") {
    return { titulo: "Por dia útil", ajuda: "Passagens × dias trabalhados" };
  }
  return TIPOS_DE_VALOR[t];
}

export const FAIXAS_DA_ANS = [
  "0 a 18 anos",
  "19 a 23 anos",
  "24 a 28 anos",
  "29 a 33 anos",
  "34 a 38 anos",
  "39 a 43 anos",
  "44 a 48 anos",
  "49 a 53 anos",
  "54 a 58 anos",
  "59 anos ou mais",
] as const;

export const ROTULO_DA_ORIGEM: Readonly<Record<OrigemDosDias, string>> = {
  uteis: "Dias úteis do mês",
  escala: "Escala publicada",
  catalogo: "Escala do cadastro",
  digitado: "Digitado no mês",
};

export const TEXTO_DA_PENDENCIA: Readonly<Record<PendenciaBeneficio, string>> =
  {
    sem_nascimento: "Sem nascimento: completar cadastro",
    sem_salario: "Sem salário: completar cadastro",
    sem_plano: "Sem plano: escolha o plano da pessoa",
    sem_valor: "Sem valor: digite o valor da pessoa",
  };

export const TEXTO_DA_OBSERVACAO: Readonly<
  Record<ObservacaoBeneficio, string>
> = {
  estagio_sem_desconto: "Estágio: sem desconto",
  limitado_ao_vt: "Desconto limitado ao VT",
};

export const PARENTESCOS: readonly { valor: Parentesco; rotulo: string }[] = [
  { valor: "conjuge", rotulo: "Cônjuge" },
  { valor: "filho", rotulo: "Filho(a)" },
  { valor: "pai_mae", rotulo: "Pai/Mãe" },
  { valor: "irmao", rotulo: "Irmão/Irmã" },
  { valor: "grau_1", rotulo: "1° grau" },
  { valor: "grau_2", rotulo: "2° grau" },
  { valor: "grau_3", rotulo: "3° grau" },
  { valor: "outro", rotulo: "Outro" },
];

export const rotuloDoParentesco = (p: Parentesco) =>
  PARENTESCOS.find((x) => x.valor === p)?.rotulo ?? p;

export const pessoas = (n: number) => (n === 1 ? "1 pessoa" : `${n} pessoas`);

/** "1 benefício ativo" / "2 benefícios ativos". */
export const beneficiosAtivos = (n: number) =>
  n === 1 ? "1 benefício ativo" : `${n} benefícios ativos`;

/** Primeira letra maiúscula. */
export const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** O ícone de cada categoria (lista, detalhe e ficha). */
export const ICONE_DA_CATEGORIA: Readonly<
  Record<CategoriaBeneficio, IconeDoEcossistema>
> = {
  alimentacao: IconeCarteira,
  mobilidade: IconeLocal,
  saude: IconeSaude,
  odontologico: IconeHospital,
  seguro_vida: IconeFamilia,
  bem_estar: IconeEstrela,
  saude_mental: IconeComentario,
  educacao: IconeFormacao,
  trabalho_remoto: IconeCasa,
  multibeneficios: IconeBeneficios,
  antecipacao: IconeDinheiro,
  outros: IconePresente,
};

/** O nome da escala (ex.: "Semana espanhola"); sem escala, "—". */
export const nomeDaEscala = (codigo: string | null) =>
  codigo ? (modeloDe(codigo)?.nome ?? codigo) : "—";

/**
 * A faixa da ANS do dependente na competência: idade completa no último dia
 * do mês anterior (a pessoa muda de faixa no mês seguinte ao aniversário).
 */
export function faixaNaCompetencia(nascimento: string, competencia: string) {
  const [a, m] = competencia.split("-").map(Number) as [number, number];
  const [na, nm, nd] = nascimento.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  // Último dia do mês anterior.
  const ref = new Date(Date.UTC(a, m - 1, 0));
  let idade = ref.getUTCFullYear() - na;
  const mesRef = ref.getUTCMonth() + 1;
  if (mesRef < nm || (mesRef === nm && ref.getUTCDate() < nd)) idade -= 1;
  const limites = [18, 23, 28, 33, 38, 43, 48, 53, 58];
  const i = limites.findIndex((l) => idade <= l);
  return FAIXAS_DA_ANS[i === -1 ? 9 : i]!;
}
