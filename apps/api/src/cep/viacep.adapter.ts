import {
  CEP_BRASILEIRO,
  EnderecoSugerido,
  FornecedorCep,
  ResultadoFornecedorCep,
} from "./cep.types";

/** Base pública do ViaCEP. O CEP vai no caminho; nada vai em query ou corpo. */
export const VIACEP_BASE_URL = "https://viacep.com.br/ws";

/**
 * Timeout curto: o preenchimento é assistência, não etapa obrigatória. Passado
 * o prazo, a tela segue pelo cadastro manual.
 */
export const VIACEP_TIMEOUT_MS = 3000;

/**
 * Limites iguais aos do endereço do colaborador (`LIMITES_ENDERECO`, T177): um
 * valor que o banco recusaria não vira sugestão.
 */
const LIMITES = { logradouro: 200, bairro: 120, cidade: 120, estado: 80 };

// eslint-disable-next-line no-control-regex
const CONTROLE = /[\u0000-\u001F\u007F]/;

/** Texto do fornecedor aparado; vazio, longo demais ou com controle vira `null`. */
function texto(valor: unknown, limite: number): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().replace(/\s{2,}/g, " ");
  if (limpo === "" || limpo.length > limite || CONTROLE.test(limpo)) {
    return null;
  }
  return limpo;
}

function uf(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(limpo) ? limpo : null;
}

/**
 * Adaptador do ViaCEP. Isolado: nenhuma outra parte do Evolli conhece a URL,
 * o formato da resposta nem os códigos do fornecedor.
 *
 * - Requisição `GET` sem corpo, sem cabeçalho de identificação do usuário e
 *   sem cookie — a função de busca recebe só a URL e o sinal de cancelamento.
 * - A resposta é lida, reduzida aos campos da sugestão e descartada: nada da
 *   resposta bruta sai daqui.
 */
export class ViaCepAdapter implements FornecedorCep {
  readonly nome = "viacep";

  constructor(
    private readonly buscar: (
      url: string,
      init: { method: "GET"; signal: AbortSignal; redirect: "error" },
    ) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }> = (
      url,
      init,
    ) => fetch(url, init),
    private readonly timeoutMs: number = VIACEP_TIMEOUT_MS,
  ) {}

  async consultar(cep: string): Promise<ResultadoFornecedorCep> {
    if (!CEP_BRASILEIRO.test(cep)) {
      // Defesa em profundidade: o serviço já validou, e o fornecedor nunca
      // recebe um valor fora da forma de CEP.
      return { tipo: "inexistente" };
    }
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), this.timeoutMs);
    try {
      const resposta = await this.buscar(`${VIACEP_BASE_URL}/${cep}/json/`, {
        method: "GET",
        signal: controle.signal,
        redirect: "error",
      });
      if (resposta.status === 400) return { tipo: "inexistente" };
      if (!resposta.ok) return { tipo: "indisponivel", motivo: "falha" };
      const corpo = await resposta.json();
      if (typeof corpo !== "object" || corpo === null) {
        return { tipo: "indisponivel", motivo: "falha" };
      }
      const dados = corpo as Record<string, unknown>;
      if (dados.erro === true || dados.erro === "true") {
        return { tipo: "inexistente" };
      }
      const endereco: EnderecoSugerido = {
        cep,
        logradouro: texto(dados.logradouro, LIMITES.logradouro),
        bairro: texto(dados.bairro, LIMITES.bairro),
        cidade: texto(dados.localidade, LIMITES.cidade),
        uf: uf(dados.uf),
        estado: texto(dados.estado, LIMITES.estado),
      };
      return { tipo: "encontrado", endereco };
    } catch {
      return {
        tipo: "indisponivel",
        motivo: controle.signal.aborted ? "timeout" : "falha",
      };
    } finally {
      clearTimeout(relogio);
    }
  }
}
