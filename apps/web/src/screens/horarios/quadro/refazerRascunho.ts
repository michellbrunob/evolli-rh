/**
 * T215 — "Refazer o rascunho do quadro" ao definir ou alterar o padrão de
 * escala na ficha (como a referência): os próximos 28 dias a partir da data
 * do padrão novo voltam ao padrão no RASCUNHO do quadro. Dias com férias ou
 * ausência aprovada e fora do vínculo não mudam; a observação de cada dia
 * fica; o publicado só muda quando a escala for publicada de novo.
 */
import {
  type GravarDiaDto,
  type PessoaDoQuadroApi,
  consultarQuadro,
  gravarDias,
  limparDias,
} from "../../../api/escalaClient";
import { somarDias } from "../../pessoas/ficha/escala/calendarioDaEscala";
import { type PlanoDoLote, valorDaCelula } from "./acoesEmMassa";
import { ausenciaDoDia } from "./ausenciasDoQuadro";
import { celulaDoDia, diaGravado, diasDoPeriodo } from "./quadroDaEscala";

/** Quantos dias o rascunho refaz (4 semanas). */
export const DIAS_DO_REFAZER = 28;

/** O lote que põe o padrão da pessoa no rascunho, nos dias dados. */
export function planoDeRefazer(
  p: PessoaDoQuadroApi,
  dias: readonly string[],
): PlanoDoLote {
  const gravar: GravarDiaDto[] = [];
  const limpar: { colaboradorId: string; dia: string }[] = [];
  // O padrão puro: sem os dias gravados e sem as ausências.
  const padrao = { ...p, dias: [], ausencias: [] };
  for (const dia of dias) {
    const c = celulaDoDia(padrao, dia);
    if (c.tipo === "fora" || ausenciaDoDia(p, dia)) continue;
    const valor = valorDaCelula(c);
    if (valor) {
      gravar.push({
        ...valor,
        observacao: diaGravado(p, dia)?.observacao ?? null,
        colaboradorId: p.colaboradorId,
        dia,
      });
    } else {
      limpar.push({ colaboradorId: p.colaboradorId, dia });
    }
  }
  return { gravar, limpar };
}

/**
 * Refaz o rascunho da pessoa nos 28 dias a partir de `inicio`; devolve
 * quantos dias mudaram (0 se ela não está no quadro do período).
 */
export async function refazerRascunhoDoQuadro(
  colaboradorId: string,
  inicio: string,
): Promise<number> {
  const fim = somarDias(inicio, DIAS_DO_REFAZER - 1);
  const quadro = await consultarQuadro(inicio, fim);
  const p = quadro.pessoas.find((x) => x.colaboradorId === colaboradorId);
  if (!p) return 0;
  const plano = planoDeRefazer(p, diasDoPeriodo(inicio, fim));
  if (plano.gravar.length > 0) await gravarDias(plano.gravar);
  if (plano.limpar.length > 0) await limparDias(plano.limpar);
  return plano.gravar.length + plano.limpar.length;
}
