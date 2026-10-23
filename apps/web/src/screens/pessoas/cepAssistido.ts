import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react";
import { type EnderecoDoCepApi, consultarCep } from "../../api/cepClient";
import {
  CAMPOS_ENDERECO,
  type ChaveEndereco,
  type ValoresEndereco,
  ehPaisBrasil,
} from "./dadosPessoais";

// ---------------------------------------------------------------------------
// T178 — preenchimento ASSISTIDO do endereço pelo CEP (autorizado pela
// proprietária: só CEP brasileiro, campos editáveis, cadastro manual como
// alternativa). A consulta é do servidor (`GET /v1/cep/:cep`); aqui só se
// decide QUANDO perguntar e o que fazer com a resposta.
//
// T181 — extraído da página de Nova admissão para servir também à edição do
// endereço na ficha do colaborador, com o mesmo comportamento.
// ---------------------------------------------------------------------------

/** Campos que a consulta sugere. Número e complemento nunca são tocados. */
export const CAMPOS_DO_CEP = [
  "logradouro",
  "bairro",
  "cidade",
  "estado",
] as const;
export type CampoDoCep = (typeof CAMPOS_DO_CEP)[number];

/** Só dígitos do CEP: sem hífen, espaço nem ponto. */
export function digitosDoCep(cep: string): string {
  return cep.trim().replace(/[\s.-]/g, "");
}

/** Texto comparável: sem acento, sem diferença de caixa e sem espaços extras. */
function textoComparavel(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** "A", "A e B", "A, B e C". */
export function listaComE(itens: readonly string[]): string {
  return itens.length <= 1
    ? (itens[0] ?? "")
    : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** `status` numérico do erro, lido por forma; `null` quando não há resposta. */
function statusDe(erro: unknown): number | null {
  return typeof erro === "object" &&
    erro !== null &&
    typeof (erro as { status?: unknown }).status === "number"
    ? (erro as { status: number }).status
    : null;
}

/**
 * Mensagem da recusa. Nenhuma bloqueia: o cadastro manual segue. O status é
 * lido por forma (`status` numérico), e não por `instanceof`, para valer
 * também com o cliente automockado nos testes.
 */
function mensagemDoErroDeCep(erro: unknown): string {
  switch (statusDe(erro)) {
    case 404:
      return "CEP não encontrado. Preencha o endereço manualmente.";
    case 503:
      return "Não foi possível consultar o CEP agora. Preencha o endereço manualmente ou tente de novo.";
    case 429:
      return "Muitas consultas de CEP em pouco tempo. Aguarde alguns minutos ou preencha manualmente.";
    case 400:
      return "CEP inválido. Use os 8 dígitos.";
    default:
      return "A consulta de CEP está indisponível agora. Preencha o endereço manualmente.";
  }
}

/** "Logradouro, Bairro e Cidade" — os rótulos da tela, na ordem da tela. */
function listaDeRotulos(chaves: readonly CampoDoCep[]): string {
  return listaComE(
    chaves.map((c) => CAMPOS_ENDERECO.find((d) => d.chave === c)?.rotulo ?? c),
  );
}

/**
 * A sugestão da resposta, campo a campo, já aparada e no limite do campo.
 * Estado usa a SIGLA (`uf`, "MG"), como os dados existentes; sem sigla, o
 * nome por extenso.
 */
function sugestaoDoCep(
  resposta: EnderecoDoCepApi,
): Partial<Record<CampoDoCep, string>> {
  const bruto: Record<CampoDoCep, string | null> = {
    logradouro: resposta.logradouro,
    bairro: resposta.bairro,
    cidade: resposta.cidade,
    estado: resposta.uf?.trim() ? resposta.uf : resposta.estado,
  };
  const sugestao: Partial<Record<CampoDoCep, string>> = {};
  for (const chave of CAMPOS_DO_CEP) {
    const limite = CAMPOS_ENDERECO.find((c) => c.chave === chave)?.limite;
    const valor = (bruto[chave] ?? "").trim().slice(0, limite);
    if (valor) sugestao[chave] = valor;
  }
  return sugestao;
}

/** Estado da consulta de CEP — a única região viva própria do bloco. */
export type EstadoCep =
  | { readonly tipo: "ocioso" }
  | { readonly tipo: "buscando" }
  | { readonly tipo: "aviso"; readonly mensagem: string }
  | {
      readonly tipo: "sugerido";
      readonly mensagem: string;
      /** Campos que já tinham outro valor: mantidos até a ação explícita. */
      readonly mantidos: readonly {
        readonly chave: CampoDoCep;
        readonly sugerido: string;
      }[];
    };

export interface OpcoesCepAssistido {
  /** O endereço em edição, como está agora. */
  readonly endereco: ValoresEndereco;
  readonly setEndereco: Dispatch<SetStateAction<ValoresEndereco>>;
  /** "Buscar CEP" com CEP incompleto: a mensagem vai para o campo CEP. */
  readonly onErroNoCep: (mensagem: string) => void;
  /** Campos que a consulta preencheu ou substituiu: os erros deles saem. */
  readonly onCamposAjustados: (campos: readonly ChaveEndereco[]) => void;
  /** Id do "Buscar CEP", que recebe o foco depois de "Usar endereço do CEP". */
  readonly idBotaoBuscar: string;
}

export interface CepAssistido {
  readonly estado: EstadoCep;
  /** O país é o Brasil: há consulta e máscara. */
  readonly assistido: boolean;
  readonly buscar: (origem: "botao" | "saida") => Promise<void>;
  readonly usarEnderecoDoCep: () => void;
  /** CEP ou país mudaram: o que a consulta anterior disse deixa de valer. */
  readonly descartarResultado: () => void;
  /** Recomeço do formulário: nada da consulta anterior fica. */
  readonly reiniciar: () => void;
}

/**
 * A consulta assistida de CEP de um formulário de endereço. Só por ação: o
 * botão, ou SAIR do campo com o CEP completo e diferente do último perguntado
 * — nunca a cada tecla, porque a consulta é limitada no servidor e cada tecla
 * gastaria uma.
 */
export function useCepAssistido({
  endereco,
  setEndereco,
  onErroNoCep,
  onCamposAjustados,
  idBotaoBuscar,
}: OpcoesCepAssistido): CepAssistido {
  const [estado, setEstado] = useState<EstadoCep>({ tipo: "ocioso" });
  /** O endereço mais recente, para decidir fora do ciclo de render. */
  const enderecoRef = useRef(endereco);
  enderecoRef.current = endereco;
  /** Último CEP (8 dígitos) já perguntado: sair do campo não repergunta. */
  const ultimoCepConsultadoRef = useRef<string | null>(null);
  /** CEP em voo: trava síncrona contra duplo clique e saída + clique. */
  const cepEmVooRef = useRef<string | null>(null);
  /** Sequência do pedido, contra resposta obsoleta. */
  const pedidoCepRef = useRef(0);

  /** A resposta ainda vale: é a do último pedido, para o CEP e país atuais. */
  function respostaVigente(pedido: number, digitos: string): boolean {
    const atual = enderecoRef.current;
    return (
      pedido === pedidoCepRef.current &&
      digitosDoCep(atual.cep) === digitos &&
      ehPaisBrasil(atual.pais)
    );
  }

  async function buscar(origem: "botao" | "saida") {
    const atual = enderecoRef.current;
    if (!ehPaisBrasil(atual.pais)) return;
    const digitos = digitosDoCep(atual.cep);
    if (!/^\d{8}$/.test(digitos)) {
      // Na saída do campo, CEP incompleto é só um CEP ainda sendo digitado.
      if (origem === "botao") onErroNoCep("Informe os 8 dígitos do CEP.");
      return;
    }
    if (cepEmVooRef.current === digitos) return;
    if (origem === "saida" && digitos === ultimoCepConsultadoRef.current) {
      return;
    }
    cepEmVooRef.current = digitos;
    ultimoCepConsultadoRef.current = digitos;
    const pedido = ++pedidoCepRef.current;
    setEstado({ tipo: "buscando" });
    try {
      const resposta = await consultarCep(digitos);
      if (!respostaVigente(pedido, digitos)) return;
      aplicarSugestao(resposta);
    } catch (erro: unknown) {
      if (!respostaVigente(pedido, digitos)) return;
      setEstado({ tipo: "aviso", mensagem: mensagemDoErroDeCep(erro) });
    } finally {
      if (cepEmVooRef.current === digitos) cepEmVooRef.current = null;
    }
  }

  /**
   * Preenche só o que está VAZIO. Campo já digitado com outro valor fica como
   * está e vai para a lista de "mantidos", que só a ação explícita "Usar
   * endereço do CEP" substitui — nada é sobrescrito em silêncio.
   */
  function aplicarSugestao(resposta: EnderecoDoCepApi) {
    const sugestao = sugestaoDoCep(resposta);
    const atual = enderecoRef.current;
    const preenchidos: CampoDoCep[] = [];
    const mantidos: { chave: CampoDoCep; sugerido: string }[] = [];
    for (const chave of CAMPOS_DO_CEP) {
      const sugerido = sugestao[chave];
      if (!sugerido) continue;
      const valor = atual[chave];
      if (valor.trim() === "") preenchidos.push(chave);
      else if (textoComparavel(valor) !== textoComparavel(sugerido)) {
        mantidos.push({ chave, sugerido });
      }
    }
    if (Object.keys(sugestao).length === 0) {
      setEstado({
        tipo: "aviso",
        mensagem:
          "O CEP foi encontrado, mas sem endereço detalhado. Preencha o endereço manualmente.",
      });
      return;
    }
    if (preenchidos.length > 0) {
      setEndereco((prev) => {
        const proximo = { ...prev };
        for (const chave of preenchidos) {
          if (prev[chave].trim() === "") proximo[chave] = sugestao[chave]!;
        }
        return proximo;
      });
      onCamposAjustados(["cep", ...preenchidos]);
    }
    const partes: string[] = [];
    if (preenchidos.length > 0) {
      partes.push(
        `Endereço sugerido pelo CEP em ${listaDeRotulos(preenchidos)}. Confira e ajuste se precisar.`,
      );
    }
    if (mantidos.length > 0) {
      partes.push(
        `O que já estava digitado foi mantido em ${listaDeRotulos(
          mantidos.map((m) => m.chave),
        )}.`,
      );
    }
    if (partes.length === 0) partes.push("O endereço já confere com o CEP.");
    setEstado({ tipo: "sugerido", mensagem: partes.join(" "), mantidos });
  }

  /** Ação explícita: substitui os campos mantidos pelo que o CEP sugeriu. */
  function usarEnderecoDoCep() {
    if (estado.tipo !== "sugerido" || estado.mantidos.length === 0) return;
    const { mantidos } = estado;
    setEndereco((prev) => {
      const proximo = { ...prev };
      for (const { chave, sugerido } of mantidos) proximo[chave] = sugerido;
      return proximo;
    });
    onCamposAjustados(mantidos.map((m) => m.chave));
    setEstado({
      tipo: "sugerido",
      mensagem: `Endereço do CEP aplicado em ${listaDeRotulos(
        mantidos.map((m) => m.chave),
      )}. Os campos continuam editáveis.`,
      mantidos: [],
    });
    // O botão acionado some: o foco volta para "Buscar CEP", ao lado. Por id:
    // o `Button` do Evolli não repassa `ref`.
    document.getElementById(idBotaoBuscar)?.focus();
  }

  const descartarResultado = useCallback(
    () => setEstado({ tipo: "ocioso" }),
    [],
  );

  const reiniciar = useCallback(() => {
    setEstado({ tipo: "ocioso" });
    ultimoCepConsultadoRef.current = null;
  }, []);

  return {
    estado,
    assistido: ehPaisBrasil(endereco.pais),
    buscar,
    usarEnderecoDoCep,
    descartarResultado,
    reiniciar,
  };
}
