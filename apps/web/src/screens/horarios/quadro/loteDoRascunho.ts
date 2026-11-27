/**
 * T215 — um lote no RASCUNHO do quadro (ações em massa, copiar e repetir
 * semana, aplicar modelo, refazer pelo padrão) como "tudo ou nada": o
 * servidor aceita até cem dias por envio (limite do corpo JSON), cada envio
 * numa transação. Se um envio falha no meio, o que os envios anteriores já
 * fizeram é desfeito (cada dia volta ao rascunho que tinha, ou fica sem
 * rascunho) e sobe `LoteDoRascunhoError`, dizendo se deu para desfazer.
 */
import {
  type DiaGravadoApi,
  type GravarDiaDto,
  gravarDias,
  limparDias,
} from "../../../api/escalaClient";
import { chaveDoDia, valorDoGravado } from "./acoesEmMassa";

/** Dias por envio (o servidor aceita 500; o corpo JSON tem 100 kB). */
export const DIAS_POR_ENVIO = 100;

/**
 * O lote parou no meio. `desfeito`: o rascunho ficou como antes do lote;
 * senão, parte do lote ficou gravada e o quadro precisa ser conferido.
 */
export class LoteDoRascunhoError extends Error {
  constructor(
    readonly desfeito: boolean,
    readonly causa: unknown,
  ) {
    super(
      desfeito
        ? "O lote falhou e o rascunho ficou como antes."
        : "O lote falhou no meio e não foi possível desfazer tudo.",
    );
    this.name = "LoteDoRascunhoError";
  }
}

/** A mensagem para quem usa o quadro quando um lote do rascunho falha. */
export function mensagemDoLote(erro: unknown): string {
  if (erro instanceof LoteDoRascunhoError && !erro.desfeito) {
    return "A gravação parou no meio e não foi possível desfazer tudo. Confira o rascunho no quadro antes de publicar.";
  }
  return "Não foi possível gravar no rascunho. Nada mudou; tente de novo.";
}

type DiaDaPessoa = { readonly colaboradorId: string; readonly dia: string };

/**
 * Aplica o lote (primeiro limpa, depois grava). `anteriores`: o rascunho de
 * cada dia antes do lote, por `pessoa|dia` (`chaveDoDia`).
 */
export async function aplicarLoteNoRascunho(
  plano: {
    readonly gravar: readonly GravarDiaDto[];
    readonly limpar: readonly DiaDaPessoa[];
  },
  anteriores: ReadonlyMap<string, DiaGravadoApi>,
): Promise<void> {
  const envios: (
    | { tipo: "limpar"; dias: DiaDaPessoa[] }
    | { tipo: "gravar"; dias: GravarDiaDto[] }
  )[] = [];
  for (let i = 0; i < plano.limpar.length; i += DIAS_POR_ENVIO) {
    envios.push({
      tipo: "limpar",
      dias: plano.limpar.slice(i, i + DIAS_POR_ENVIO),
    });
  }
  for (let i = 0; i < plano.gravar.length; i += DIAS_POR_ENVIO) {
    envios.push({
      tipo: "gravar",
      dias: plano.gravar.slice(i, i + DIAS_POR_ENVIO),
    });
  }
  const feitos: DiaDaPessoa[] = [];
  for (const envio of envios) {
    try {
      if (envio.tipo === "limpar") await limparDias(envio.dias);
      else await gravarDias(envio.dias);
    } catch (causa) {
      if (feitos.length === 0) throw new LoteDoRascunhoError(true, causa);
      // Desfaz os envios que já passaram (cada dia uma vez).
      const vistos = new Set<string>();
      const regravar: GravarDiaDto[] = [];
      const limpar: DiaDaPessoa[] = [];
      for (const d of feitos) {
        const chave = chaveDoDia(d.colaboradorId, d.dia);
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        const antes = anteriores.get(chave);
        if (antes) {
          regravar.push({
            ...valorDoGravado(antes),
            colaboradorId: d.colaboradorId,
            dia: d.dia,
          });
        } else {
          limpar.push({ colaboradorId: d.colaboradorId, dia: d.dia });
        }
      }
      try {
        if (limpar.length > 0) await limparDias(limpar);
        if (regravar.length > 0) await gravarDias(regravar);
      } catch {
        throw new LoteDoRascunhoError(false, causa);
      }
      throw new LoteDoRascunhoError(true, causa);
    }
    feitos.push(
      ...envio.dias.map((d) => ({
        colaboradorId: d.colaboradorId,
        dia: d.dia,
      })),
    );
  }
}
