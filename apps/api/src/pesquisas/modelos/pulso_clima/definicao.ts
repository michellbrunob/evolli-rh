/**
 * T216 — Pulso e Clima: 8 dimensões de clima com 22 afirmações de
 * concordância (1 a 5), a recomendação da liderança direta (LNPS, 0–10) e a
 * da empresa (eNPS, 0–10). Cada dimensão e cada recomendação têm um
 * comentário opcional. Metodologia fixa: a API confere os itens.
 */
import type { EstruturaFixa, ItemFixo } from "../tipos";

export const DIMENSOES_PULSO_CLIMA = [
  { chave: "alinhamento_estrategia", rotulo: "Alinhamento e Estratégia" },
  { chave: "lideranca", rotulo: "Liderança" },
  { chave: "ambiente_colaboracao", rotulo: "Ambiente e Colaboração" },
  { chave: "condicoes", rotulo: "Condições de Trabalho" },
  { chave: "inovacao", rotulo: "Inovação e Melhoria Contínua" },
  { chave: "desenvolvimento", rotulo: "Desenvolvimento e Carreira" },
  { chave: "reconhecimento", rotulo: "Reconhecimento e Recompensas" },
  { chave: "bem_estar", rotulo: "Bem-estar e Segurança Psicossocial" },
] as const;

/** As 22 afirmações, na ordem, com a dimensão de cada uma. */
export const AFIRMACOES_PULSO_CLIMA: readonly {
  chave: string;
  dimensao: string;
}[] = [
  ["pc_ae_01", "alinhamento_estrategia"],
  ["pc_ae_02", "alinhamento_estrategia"],
  ["pc_ae_03", "alinhamento_estrategia"],
  ["pc_lid_01", "lideranca"],
  ["pc_lid_02", "lideranca"],
  ["pc_lid_03", "lideranca"],
  ["pc_lid_04", "lideranca"],
  ["pc_amb_01", "ambiente_colaboracao"],
  ["pc_amb_02", "ambiente_colaboracao"],
  ["pc_amb_03", "ambiente_colaboracao"],
  ["pc_cond_01", "condicoes"],
  ["pc_cond_02", "condicoes"],
  ["pc_inov_01", "inovacao"],
  ["pc_inov_02", "inovacao"],
  ["pc_desv_01", "desenvolvimento"],
  ["pc_desv_02", "desenvolvimento"],
  ["pc_desv_03", "desenvolvimento"],
  ["pc_rec_01", "reconhecimento"],
  ["pc_rec_02", "reconhecimento"],
  ["pc_rec_03", "reconhecimento"],
  ["pc_bem_01", "bem_estar"],
  ["pc_bem_02", "bem_estar"],
].map(([chave, dimensao]) => ({ chave: chave!, dimensao: dimensao! }));

export const CHAVE_LNPS = "pc_lnps_01";
export const CHAVE_ENPS = "pc_enps_01";

/** O comentário opcional de uma dimensão (ou de `lnps`/`enps`). */
export function chaveDoComentario(dimensao: string): string {
  return `__comentario_${dimensao}__`;
}

const comentario = (dimensao: string): ItemFixo => ({
  chave: chaveDoComentario(dimensao),
  tipo: "paragrafo",
  obrigatoria: false,
});

export const ESTRUTURA_PULSO_CLIMA: EstruturaFixa = {
  itens: [
    ...AFIRMACOES_PULSO_CLIMA.map((a): ItemFixo => ({
      chave: a.chave,
      tipo: "concordancia",
    })),
    {
      chave: CHAVE_LNPS,
      tipo: "nota_0_10",
      config: (c) => c.lnps === true && c.enps !== true,
    },
    {
      chave: CHAVE_ENPS,
      tipo: "nota_0_10",
      config: (c) => c.enps === true && c.lnps !== true,
    },
  ],
  opcionais: [
    ...DIMENSOES_PULSO_CLIMA.map((d) => comentario(d.chave)),
    comentario("lnps"),
    comentario("enps"),
  ],
};
