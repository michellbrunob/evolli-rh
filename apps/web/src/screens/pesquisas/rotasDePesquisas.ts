/**
 * T216 — as rotas do módulo Pesquisas (`#/pesquisas…`). Cada tela tem
 * endereço próprio: recarregar, voltar e avançar do navegador e compartilhar
 * o link funcionam. O shell trata tudo o que começa com `#/pesquisas` como o
 * destino `pesquisas` e entrega a rota ao módulo.
 *
 *   #/pesquisas                                   lista (ou página inicial)
 *   #/pesquisas/nova                              galeria (passo 1)
 *   #/pesquisas/nova/<modelo>                     assistente do modelo pronto
 *   #/pesquisas/modelos/<modelo>                  sobre o modelo
 *   #/pesquisas/nova/personalizada                página da personalizada
 *   #/pesquisas/nova/personalizada/<roteiro>      assistente (branco/roteiro)
 *   #/pesquisas/nova/personalizada/copia/<id>     assistente a partir de cópia
 *   #/pesquisas/<id>/rascunho                     assistente com o rascunho
 *   #/pesquisas/<id>[?aba=analises|respostas]     resultados
 *   #/pesquisas/<id>/editar                       editar (publicada)
 *   #/pesquisas/<id>/respostas/<respostaId>       resultado individual
 *   #/pesquisas/<id>/previa                       pré-visualização
 *   #/pesquisas/<id>/relatorio                    relatório em PDF
 *   #/pesquisas/<id>/respostas/<rid>/relatorio    PDF de uma resposta
 */

import { modeloDaGaleria } from "./modelosDePesquisa";

/** `plano` e `conformidade`: abas próprias da NR-1 (modelos/registro). */
export type AbaDosResultados =
  "geral" | "analises" | "respostas" | "plano" | "conformidade";

export type RotaDePesquisas =
  | { readonly tela: "lista" }
  | { readonly tela: "nova" }
  | { readonly tela: "modelo"; readonly modelo: string }
  | { readonly tela: "sobre"; readonly modelo: string }
  | { readonly tela: "personalizada" }
  | { readonly tela: "aberta"; readonly roteiro: string }
  | { readonly tela: "copia"; readonly id: string }
  | { readonly tela: "rascunho"; readonly id: string }
  | {
      readonly tela: "resultados";
      readonly id: string;
      readonly aba: AbaDosResultados;
    }
  | { readonly tela: "editar"; readonly id: string }
  | {
      readonly tela: "resposta";
      readonly id: string;
      readonly respostaId: string;
    }
  | { readonly tela: "previa"; readonly id: string }
  | { readonly tela: "relatorio"; readonly id: string }
  | {
      readonly tela: "relatorioDaResposta";
      readonly id: string;
      readonly respostaId: string;
    };

export const ROTA_DA_LISTA: RotaDePesquisas = { tela: "lista" };

const PREFIXO = "#/pesquisas";
const PREFIXO_COM_BARRA = "#/pesquisas/";
const PREFIXO_COM_BUSCA = "#/pesquisas?";
const ABAS: readonly AbaDosResultados[] = [
  "geral",
  "analises",
  "respostas",
  "plano",
  "conformidade",
];

const parte = (t: string) => {
  try {
    return decodeURIComponent(t);
  } catch {
    return null;
  }
};

/** A rota do fragmento, ou `null` se ele não é do módulo. */
export function rotaDePesquisasDoFragmento(
  fragmento: string,
): RotaDePesquisas | null {
  if (
    fragmento !== PREFIXO &&
    !fragmento.startsWith(PREFIXO_COM_BARRA) &&
    !fragmento.startsWith(PREFIXO_COM_BUSCA)
  )
    return null;
  const [caminho = "", busca = ""] = fragmento.slice(PREFIXO.length).split("?");
  const pedacos = caminho.split("/").filter(Boolean).map(parte);
  if (pedacos.some((p) => p === null || p === "")) return null;
  const p = pedacos as string[];
  if (p.length === 0) return ROTA_DA_LISTA;
  if (p[0] === "nova") {
    if (p.length === 1) return { tela: "nova" };
    if (p[1] === "personalizada") {
      if (p.length === 2) return { tela: "personalizada" };
      if (p[2] === "copia" && p.length === 4)
        return { tela: "copia", id: p[3]! };
      if (p.length === 3) return { tela: "aberta", roteiro: p[2]! };
      return null;
    }
    return p.length === 2 ? { tela: "modelo", modelo: p[1]! } : null;
  }
  if (p[0] === "modelos") {
    return p.length === 2 ? { tela: "sobre", modelo: p[1]! } : null;
  }
  const id = p[0]!;
  if (p.length === 1) {
    const aba = new URLSearchParams(busca).get("aba");
    return {
      tela: "resultados",
      id,
      aba: ABAS.includes(aba as AbaDosResultados)
        ? (aba as AbaDosResultados)
        : "geral",
    };
  }
  if (p.length === 2 && p[1] === "rascunho") return { tela: "rascunho", id };
  if (p.length === 2 && p[1] === "editar") return { tela: "editar", id };
  if (p.length === 2 && p[1] === "previa") return { tela: "previa", id };
  if (p.length === 2 && p[1] === "relatorio") return { tela: "relatorio", id };
  if (p.length === 3 && p[1] === "respostas")
    return { tela: "resposta", id, respostaId: p[2]! };
  if (p.length === 4 && p[1] === "respostas" && p[3] === "relatorio")
    return { tela: "relatorioDaResposta", id, respostaId: p[2]! };
  return null;
}

const enc = encodeURIComponent;

/** O fragmento canônico da rota. */
export function fragmentoDaRotaDePesquisas(rota: RotaDePesquisas): string {
  switch (rota.tela) {
    case "lista":
      return PREFIXO;
    case "nova":
      return `${PREFIXO}/nova`;
    case "modelo":
      return `${PREFIXO}/nova/${enc(rota.modelo)}`;
    case "sobre":
      return `${PREFIXO}/modelos/${enc(rota.modelo)}`;
    case "personalizada":
      return `${PREFIXO}/nova/personalizada`;
    case "aberta":
      return `${PREFIXO}/nova/personalizada/${enc(rota.roteiro)}`;
    case "copia":
      return `${PREFIXO}/nova/personalizada/copia/${enc(rota.id)}`;
    case "rascunho":
      return `${PREFIXO}/${enc(rota.id)}/rascunho`;
    case "resultados":
      return rota.aba === "geral"
        ? `${PREFIXO}/${enc(rota.id)}`
        : `${PREFIXO}/${enc(rota.id)}?aba=${rota.aba}`;
    case "editar":
      return `${PREFIXO}/${enc(rota.id)}/editar`;
    case "resposta":
      return `${PREFIXO}/${enc(rota.id)}/respostas/${enc(rota.respostaId)}`;
    case "previa":
      return `${PREFIXO}/${enc(rota.id)}/previa`;
    case "relatorio":
      return `${PREFIXO}/${enc(rota.id)}/relatorio`;
    case "relatorioDaResposta":
      return `${PREFIXO}/${enc(rota.id)}/respostas/${enc(rota.respostaId)}/relatorio`;
  }
}

/** O endereço completo de uma tela (para abrir em outra aba). */
export function enderecoDaRota(rota: RotaDePesquisas): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${fragmentoDaRotaDePesquisas(rota)}`;
}

/** O endereço completo da prévia (abre em outra aba). */
export function enderecoDaPrevia(id: string): string {
  return enderecoDaRota({ tela: "previa", id });
}

/** O último nível da trilha de cada tela. */
export function rotuloDaTrilha(rota: RotaDePesquisas): string | null {
  switch (rota.tela) {
    case "lista":
      return null;
    case "nova":
      return "Nova pesquisa";
    case "modelo":
    case "aberta":
    case "copia":
    case "rascunho":
      return "Nova pesquisa";
    case "sobre":
      // O tema da página do modelo ("NR-1 · Riscos psicossociais").
      return modeloDaGaleria(rota.modelo).pagina?.titulo ?? "Sobre o modelo";
    case "personalizada":
      return "Pesquisa personalizada";
    case "resultados":
      return "Resultados";
    case "editar":
      return "Editar pesquisa";
    case "resposta":
      return "Resultado individual";
    case "previa":
      return "Pré-visualização";
    case "relatorio":
    case "relatorioDaResposta":
      return "Relatório em PDF";
  }
}

/** Um nível da trilha depois de "Pesquisas" (o último é a página atual). */
export interface NivelDaTrilhaDePesquisas {
  readonly rotulo: string;
  readonly onSelecionar?: () => void;
}

/** O nome do modelo na trilha ("Pesquisa Pulso", "Pesquisa personalizada"). */
function nomeNaTrilha(modelo: string): string {
  const m = modeloDaGaleria(modelo);
  return m.modelo === "personalizada" ? "Pesquisa personalizada" : m.nome;
}

/**
 * T216 — os níveis da trilha de cada tela, depois de "Pesquisas" (que volta
 * à lista): "Nova pesquisa / <modelo>" no sobre o modelo e nos assistentes,
 * "Nova pesquisa / Pesquisa personalizada" na personalizada. `undefined`:
 * a própria página declara (resultados: o nome da pesquisa; resposta).
 */
export function niveisDaTrilha(
  rota: RotaDePesquisas,
  x: {
    /** O modelo do rascunho aberto, quando já conhecido. */
    readonly modeloDoRascunho?: string | null;
    readonly onNova: () => void;
  },
): readonly NivelDaTrilhaDePesquisas[] | null | undefined {
  const nova = { rotulo: "Nova pesquisa", onSelecionar: x.onNova };
  switch (rota.tela) {
    case "resultados":
    case "resposta":
      return undefined;
    case "modelo":
    case "sobre":
      return [nova, { rotulo: nomeNaTrilha(rota.modelo) }];
    case "personalizada":
    case "aberta":
    case "copia":
      return [nova, { rotulo: "Pesquisa personalizada" }];
    case "rascunho":
      return x.modeloDoRascunho
        ? [nova, { rotulo: nomeNaTrilha(x.modeloDoRascunho) }]
        : [{ rotulo: "Nova pesquisa" }];
    default: {
      const rotulo = rotuloDaTrilha(rota);
      return rotulo === null ? null : [{ rotulo }];
    }
  }
}
