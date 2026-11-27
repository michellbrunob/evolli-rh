import { Prisma, SituacaoVinculo } from "@prisma/client";
import { escaparCuringas } from "../../common/busca.util";

/**
 * T215 — peças puras da página inicial de Colaboradores (o desenho da
 * referência): a busca ampliada e os indicadores do cartão "Colaboradores
 * ativos". O serviço monta a consulta com elas; o banco decide.
 */

/** UUID canônico (o id do colaborador). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** CPF digitado: só dígitos e os separadores da máscara. */
const FORMA_DE_CPF = /^[\d.\-\s]+$/;

/** Mínimo de dígitos para procurar CPF (um prefixo menor casa com todos). */
const MINIMO_DIGITOS_CPF = 3;

export interface OpcoesDaBusca {
  /** O filtro de empresa dos vínculos (`{ empresaId }` ou `{}` global). */
  readonly noEscopo: Prisma.VinculoFuncionalWhereInput;
  /** Empresa ativa; `undefined` para o `master_tecnico` sem empresa. */
  readonly empresaId: string | undefined;
  /** O ator lê dados pessoais na empresa (CPF). */
  readonly podeCpf: boolean;
  /** O ator lê contatos na empresa (e-mail pessoal). */
  readonly podeEmail: boolean;
}

/**
 * Busca da listagem (`busca`): qualquer uma das cláusulas.
 *
 * - **Nome** contém o termo, sem diferenciar maiúsculas (T178).
 * - **Matrícula** contém o termo, só em vínculos do escopo (T178).
 * - **CPF** (T215): termo só com dígitos e máscara, com 3 dígitos ou mais —
 *   PREFIXO dos dígitos do CPF do perfil pessoal da empresa. Só de quem está
 *   em uso operacional na empresa (vínculo previsto ou ativo): o dado do
 *   desligado é bloqueado, e procurar por ele revelaria a quem pertence.
 * - **E-mail pessoal** (T215): contém o termo, no contato ATIVO da empresa,
 *   com o mesmo bloqueio.
 * - **Id** (T215): o termo é um UUID → o colaborador com esse id.
 *
 * CPF e e-mail só entram para quem os lê (a permissão da ficha). Sem empresa
 * ativa (`master_tecnico` global), procura em qualquer empresa.
 */
export function clausulasDeBusca(
  busca: string,
  opcoes: OpcoesDaBusca,
): Prisma.ColaboradorWhereInput[] {
  const termo = escaparCuringas(busca);
  const ou: Prisma.ColaboradorWhereInput[] = [
    { nome: { contains: termo, mode: "insensitive" } },
    {
      vinculos: {
        some: {
          ...opcoes.noEscopo,
          matricula: { contains: termo, mode: "insensitive" },
        },
      },
    },
  ];
  const daEmpresa =
    opcoes.empresaId !== undefined ? { empresaId: opcoes.empresaId } : {};
  const operacional: Prisma.ColaboradorWhereInput | null =
    opcoes.empresaId !== undefined
      ? {
          vinculos: {
            some: {
              empresaId: opcoes.empresaId,
              situacao: { in: ["previsto", "ativo"] },
            },
          },
        }
      : null;
  const comBloqueio = (
    clausula: Prisma.ColaboradorWhereInput,
  ): Prisma.ColaboradorWhereInput =>
    operacional ? { AND: [clausula, operacional] } : clausula;

  const digitos = busca.replace(/\D/g, "");
  if (
    opcoes.podeCpf &&
    FORMA_DE_CPF.test(busca) &&
    digitos.length >= MINIMO_DIGITOS_CPF &&
    digitos.length <= 11
  ) {
    ou.push(
      comBloqueio({
        perfisPessoais: {
          some: { ...daEmpresa, cpf: { startsWith: digitos } },
        },
      }),
    );
  }
  if (opcoes.podeEmail) {
    ou.push(
      comBloqueio({
        contatos: {
          some: {
            ...daEmpresa,
            ativo: true,
            emailPessoal: { contains: termo, mode: "insensitive" },
          },
        },
      }),
    );
  }
  if (UUID.test(busca)) ou.push({ id: busca.toLowerCase() });
  return ou;
}

/** Um vínculo do escopo, só com o que os indicadores usam. */
export interface VinculoParaIndicadores {
  readonly colaboradorId: string;
  readonly situacao: SituacaoVinculo;
  readonly dataAdmissao: Date;
  readonly dataDesligamento: Date | null;
}

export interface IndicadoresDoEscopo {
  /** Pessoas com vínculo ATIVO admitido no mês civil de hoje. */
  readonly admitidosNoMes: number;
  /** Pessoas com vínculo encerrado no ano civil de hoje. */
  readonly desligadosNoAno: number;
  /**
   * Ativos ao fim de cada um dos 6 meses até hoje (o mais antigo primeiro);
   * o mês atual fecha hoje.
   */
  readonly serieAtivos: number[];
}

const MESES_DA_SERIE = 6;

/** `Date` de coluna `@db.Date` (meia-noite UTC) → `YYYY-MM-DD`. */
function dia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * O dia que fecha cada mês da série: o último dia dos 5 meses anteriores e,
 * no mês atual, hoje. `hoje` é o dia civil (`YYYY-MM-DD`, America/Sao_Paulo).
 */
export function diasDeFechamentoDaSerie(hoje: string): string[] {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7)); // 1–12
  const dias: string[] = [];
  for (let atras = MESES_DA_SERIE - 1; atras >= 1; atras -= 1) {
    // Dia 0 do mês seguinte = último dia do mês (UTC, sem fuso no caminho).
    const ultimo = new Date(Date.UTC(ano, mes - atras, 0));
    dias.push(dia(ultimo));
  }
  dias.push(hoje);
  return dias;
}

/**
 * Indicadores do cartão "Colaboradores ativos", a partir dos vínculos do
 * escopo (quem foi desativado na empresa já vem fora). Cada pessoa conta uma
 * vez por número. Ativo num dia = vínculo admitido até ele (nunca o
 * previsto) e sem desligamento até ele (o desligamento naquele dia já tira).
 */
export function indicadoresDoEscopo(
  vinculos: readonly VinculoParaIndicadores[],
  hoje: string,
): IndicadoresDoEscopo {
  const mesAtual = hoje.slice(0, 7);
  const anoAtual = hoje.slice(0, 4);
  const admitidos = new Set<string>();
  const desligados = new Set<string>();
  for (const v of vinculos) {
    if (
      v.situacao === "ativo" &&
      dia(v.dataAdmissao).slice(0, 7) === mesAtual
    ) {
      admitidos.add(v.colaboradorId);
    }
    if (
      v.situacao === "encerrado" &&
      v.dataDesligamento &&
      dia(v.dataDesligamento).slice(0, 4) === anoAtual
    ) {
      desligados.add(v.colaboradorId);
    }
  }
  const serieAtivos = diasDeFechamentoDaSerie(hoje).map((fechamento) => {
    const ativos = new Set<string>();
    for (const v of vinculos) {
      if (v.situacao === "previsto") continue;
      if (dia(v.dataAdmissao) > fechamento) continue;
      if (v.dataDesligamento && dia(v.dataDesligamento) <= fechamento) continue;
      ativos.add(v.colaboradorId);
    }
    return ativos.size;
  });
  return {
    admitidosNoMes: admitidos.size,
    desligadosNoAno: desligados.size,
    serieAtivos,
  };
}
