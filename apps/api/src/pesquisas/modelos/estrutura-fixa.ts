import {
  campoDaPergunta,
  type ErroDeCampo,
} from "../../common/erros/recusa-por-campo";
import { LIMITES, type EstruturaConferida } from "../estrutura-pesquisa";
import type {
  ConfigPergunta,
  Pergunta,
  Secao,
  TipoPergunta,
} from "../pesquisas.types";

/**
 * T216 — questionário fixo (modelos com metodologia própria). A estrutura —
 * seções, ids, ordem, tipos, escalas e ids das opções — é do servidor; o
 * cliente manda só os textos (enunciado, rótulo curto e o texto de cada
 * opção), que a empresa pode trocar pela redação oficial do instrumento se
 * tiver licença. Seção opcional entra quando o corpo traz alguma pergunta
 * dela. Nada além do que a definição prevê é aceito.
 */

export interface PerguntaFixa {
  readonly id: string;
  readonly tipo: TipoPergunta;
  readonly obrigatoria: boolean;
  /** Configuração sem as opções (estas vêm em `opcoes`, só os ids). */
  readonly config: Omit<ConfigPergunta, "opcoes">;
  /** Ids das opções (escolha única e múltipla), na ordem. */
  readonly opcoes?: readonly string[];
}

export interface SecaoFixa {
  readonly id: string;
  readonly titulo: string;
  /** Entra só quando o corpo traz alguma pergunta desta seção. */
  readonly opcional?: boolean;
  readonly perguntas: readonly PerguntaFixa[];
}

export interface EstruturaFixa {
  readonly secoes: readonly SecaoFixa[];
}

type Registro = Record<string, unknown>;

const ehRegistro = (v: unknown): v is Registro =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function textoEntre(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

/** O texto opcional: aparado, vazio vira `null`; `undefined` se inválido. */
function textoOpcional(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? undefined : t;
}

/** Todas as perguntas da definição (com as opcionais). */
export function perguntasFixas(e: EstruturaFixa): PerguntaFixa[] {
  return e.secoes.flatMap((s) => s.perguntas);
}

/**
 * As seções da definição com os textos do corpo, ou os erros por campo
 * (`secoes` para forma inválida ou pergunta desconhecida; o id da pergunta
 * para texto ausente ou longo demais).
 */
export function normalizarEstruturaFixa(
  definicao: EstruturaFixa,
  entrada: unknown,
): EstruturaConferida {
  const recusa = (motivo: "invalido" | "limite"): EstruturaConferida => ({
    secoes: [],
    erros: [{ campo: "secoes", motivo }],
  });
  if (!Array.isArray(entrada)) return recusa("invalido");
  const brutas = new Map<string, Registro>();
  for (const s of entrada) {
    if (!ehRegistro(s) || !Array.isArray(s.perguntas)) {
      return recusa("invalido");
    }
    for (const p of s.perguntas) {
      if (!ehRegistro(p) || typeof p.id !== "string" || brutas.has(p.id)) {
        return recusa("invalido");
      }
      brutas.set(p.id, p);
    }
  }
  const conhecidas = new Set(perguntasFixas(definicao).map((p) => p.id));
  if ([...brutas.keys()].some((id) => !conhecidas.has(id))) {
    return recusa("invalido");
  }

  const erros: ErroDeCampo[] = [];
  const secoes: Secao[] = [];
  for (const s of definicao.secoes) {
    if (s.opcional && !s.perguntas.some((p) => brutas.has(p.id))) continue;
    const perguntas: Pergunta[] = [];
    for (const f of s.perguntas) {
      const bruta = brutas.get(f.id) ?? {};
      const campo = campoDaPergunta(f.id);
      const texto = textoEntre(bruta.texto, LIMITES.textoPergunta);
      const rotulo = textoOpcional(bruta.rotulo, LIMITES.rotuloPergunta);
      const descricao = textoOpcional(
        bruta.descricao,
        LIMITES.descricaoPergunta,
      );
      if (texto === null) {
        erros.push({
          campo,
          motivo:
            typeof bruta.texto === "string" && bruta.texto.trim()
              ? "limite"
              : "obrigatorio",
        });
      } else if (rotulo === undefined || descricao === undefined) {
        erros.push({ campo, motivo: "limite" });
      }
      const config: ConfigPergunta = { ...f.config };
      if (f.opcoes) {
        const brutasDasOpcoes = ehRegistro(bruta.config)
          ? bruta.config.opcoes
          : undefined;
        const textoDe = new Map<string, unknown>(
          Array.isArray(brutasDasOpcoes)
            ? brutasDasOpcoes
                .filter(ehRegistro)
                .map((o) => [String(o.id), o.texto] as const)
            : [],
        );
        const opcoes = f.opcoes.map((id) => ({
          id,
          texto: textoEntre(textoDe.get(id), LIMITES.textoOpcao),
        }));
        if (opcoes.some((o) => o.texto === null)) {
          erros.push({ campo, motivo: "invalido" });
        }
        config.opcoes = opcoes.map((o) => ({ id: o.id, texto: o.texto ?? "" }));
      }
      perguntas.push({
        id: f.id,
        tipo: f.tipo,
        texto: texto ?? "",
        rotulo: rotulo ?? null,
        descricao: descricao ?? null,
        obrigatoria: f.obrigatoria,
        config,
        condicao: null,
      });
    }
    secoes.push({ id: s.id, titulo: s.titulo, descricao: null, perguntas });
  }
  return erros.length ? { secoes: [], erros } : { secoes, erros };
}
