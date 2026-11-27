/** T216 — o selo curto do tipo da pergunta ("Escala 1–10", "LNPS 0–10"). */
import type { Pergunta } from "../../../api/pesquisasClient";

export function seloDoTipoDaPergunta(p: Pergunta): string {
  switch (p.tipo) {
    case "escala":
      return `Escala ${p.config.minimo ?? 1}–${p.config.maximo ?? 5}`;
    case "nota_0_10":
      return p.config.lnps
        ? "LNPS 0–10"
        : p.config.enps
          ? "eNPS 0–10"
          : "Nota 0–10";
    case "concordancia":
      return "1–5";
    case "concordancia_4":
      return "Concordância · 4 pontos";
    case "satisfacao_4":
      return "Satisfação · 4 pontos";
    case "estrelas":
      return "Estrelas 1–5";
    case "escolha_unica":
      return "Escolha única";
    case "escolha_forcada":
      return "Bloco de frases";
    case "multipla_escolha":
      return "Múltipla escolha";
    case "sim_nao":
      return "Sim ou não";
    case "paragrafo":
      return "Texto livre";
    case "texto_curto":
      return "Texto curto";
    case "data":
      return "Data";
    default:
      return "Número";
  }
}
