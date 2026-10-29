/**
 * T197 — confirmação curta da criação inline na Nova admissão: o RH escolheu
 * "Criar «termo»" num seletor da lotação e confirma aqui. Só o nome vai ao
 * servidor; o código é gerado lá, sem prévia, e a empresa é a ativa (o
 * servidor a confere contra a sessão).
 *
 * Como o cadastro rápido da T180, este diálogo não conhece a admissão: avisa a
 * página do que aconteceu (`onCriada`, `onEscolherExistente`, `onIncerto`,
 * `onFechar`), e é a página que escolhe a referência e devolve o foco ao
 * seletor. Toda recusa fica DENTRO do diálogo, sem tocar na admissão.
 */
import { useEffect, useRef, useState } from "react";
import { Button, FormActions, Modal } from "../../components";
import {
  type CentroCustoApi,
  type DepartamentoApi,
  type ReferenciaExistenteApi,
  type UnidadeOrganizacionalApi,
  criarCentroCusto,
  criarDepartamento,
  criarUnidade,
} from "../../api/organizacaoClient";
import { type CargoApi, criarCargo } from "../../api/cargoClient";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import {
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../api/csrfClient";

/** T197 — as quatro referências com criação inline. */
export type TipoReferenciaInline =
  "departamento" | "cargo" | "unidade" | "centroCusto";

/** O que o servidor devolve no 201. */
export type ReferenciaCriadaInline =
  DepartamentoApi | CargoApi | UnidadeOrganizacionalApi | CentroCustoApi;

interface DefinicaoDoTipo {
  /** "departamento", "unidade"… — o nome do tipo no meio da frase. */
  readonly nome: string;
  readonly plural: string;
  readonly feminino: boolean;
  /** O "+" da T180 existe para este tipo (Centro de custo não tem). */
  readonly temCadastroManual: boolean;
  readonly criar: (dto: {
    nome: string;
    empresaId: string;
  }) => Promise<ReferenciaCriadaInline>;
}

const TIPOS: Readonly<Record<TipoReferenciaInline, DefinicaoDoTipo>> = {
  departamento: {
    nome: "departamento",
    plural: "departamentos",
    feminino: false,
    temCadastroManual: true,
    criar: criarDepartamento,
  },
  cargo: {
    nome: "cargo",
    plural: "cargos",
    feminino: false,
    temCadastroManual: true,
    criar: criarCargo,
  },
  unidade: {
    nome: "unidade",
    plural: "unidades",
    feminino: true,
    temCadastroManual: true,
    criar: criarUnidade,
  },
  centroCusto: {
    nome: "centro de custo",
    plural: "centros de custo",
    feminino: false,
    temCadastroManual: false,
    criar: criarCentroCusto,
  },
};

/** Concordância de gênero: `o`/`a` no fim da palavra. */
function g(tipo: DefinicaoDoTipo, masculino: string, feminino: string) {
  return tipo.feminino ? feminino : masculino;
}

/** `Criar departamento`, `Criar centro de custo`… — título do diálogo. */
export function tituloDaCriacao(tipo: TipoReferenciaInline): string {
  return `Criar ${TIPOS[tipo].nome}`;
}

/** Recusa mostrada no diálogo; `existente` só no nome já em uso. */
interface Recusa {
  readonly mensagem: string;
  /** Confirmar de novo faz sentido (sessão, token, envio incerto). */
  readonly podeRepetir: boolean;
  readonly existente?: ReferenciaExistenteApi;
}

function statusDe(erro: unknown): number | null {
  return typeof erro === "object" &&
    erro !== null &&
    typeof (erro as { status?: unknown }).status === "number"
    ? (erro as { status: number }).status
    : null;
}

function codigoDe(erro: unknown): string | undefined {
  const codigo =
    typeof erro === "object" && erro !== null
      ? (erro as { codigo?: unknown }).codigo
      : undefined;
  return typeof codigo === "string" ? codigo : undefined;
}

function existenteDe(erro: unknown): ReferenciaExistenteApi | undefined {
  return typeof erro === "object" && erro !== null
    ? (erro as { referencia?: ReferenciaExistenteApi }).referencia
    : undefined;
}

/**
 * Traduz a recusa. `incerto` é rede sem resposta ou 5xx: o servidor pode ter
 * criado; confirmar de novo é seguro, porque um nome já gravado volta como
 * `nome_em_uso`, com a referência para escolher.
 */
export function recusaDaCriacao(
  erro: unknown,
  tipoInline: TipoReferenciaInline,
): Recusa & { incerto: boolean } {
  const tipo = TIPOS[tipoInline];
  if (falhaPorTokenDesatualizado(erro)) {
    return {
      mensagem:
        "Esta página ficou desatualizada e nada foi criado. Confirme de novo.",
      podeRepetir: true,
      incerto: false,
    };
  }
  if (falhaPorSessaoExpirada(erro)) {
    return {
      mensagem:
        "Sua sessão expirou e nada foi criado. Entre de novo para continuar; os dados digitados foram mantidos nesta página.",
      podeRepetir: true,
      incerto: false,
    };
  }
  const status = statusDe(erro);
  if (status === null || status >= 500) {
    return {
      mensagem: `Não foi possível confirmar se ${g(tipo, "o", "a")} ${tipo.nome} foi ${g(tipo, "criado", "criada")}. Confirmar de novo é seguro: se já existir, você poderá escolhê-l${g(tipo, "o", "a")}.`,
      podeRepetir: true,
      incerto: true,
    };
  }
  const codigo = codigoDe(erro);
  const existente = existenteDe(erro);
  if (status === 409 && codigo === "nome_em_uso" && existente) {
    return {
      mensagem: `Já existe ${g(tipo, "um", "uma")} ${tipo.nome} ${g(tipo, "ativo", "ativa")} com este nome. Escolha ${g(tipo, "o existente", "a existente")} em vez de criar outr${g(tipo, "o", "a")}.`,
      podeRepetir: false,
      existente,
      incerto: false,
    };
  }
  if (status === 409 && codigo === "nome_inativo") {
    return {
      mensagem: `Já existe ${g(tipo, "um", "uma")} ${tipo.nome} ${g(tipo, "inativo", "inativa")} com este nome, e nada foi criado. A reativação é feita na Estrutura.`,
      podeRepetir: false,
      incerto: false,
    };
  }
  if (status === 409 && codigo === "codigo_indisponivel") {
    return {
      mensagem: tipo.temCadastroManual
        ? `Não há código automático livre para este nome, e nada foi criado. Use outro nome ou o botão "+" para escolher o código.`
        : "Não há código automático livre para este nome, e nada foi criado. Use outro nome.",
      podeRepetir: false,
      incerto: false,
    };
  }
  switch (status) {
    case 403:
      return {
        mensagem: `Seu perfil não tem permissão para criar ${tipo.plural}.`,
        podeRepetir: false,
        incerto: false,
      };
    case 404:
      return {
        mensagem:
          "A empresa ativa não pôde ser confirmada, e nada foi criado. Feche e abra a página de novo.",
        podeRepetir: false,
        incerto: false,
      };
    default:
      return {
        mensagem:
          "O servidor recusou este nome, e nada foi criado. Volte à busca e revise o nome.",
        podeRepetir: false,
        incerto: false,
      };
  }
}

export interface ModalCriacaoInlineProps {
  /** A criação pedida no seletor; `null` com o diálogo fechado. */
  readonly pedido: { tipo: TipoReferenciaInline; nome: string } | null;
  /** Empresa ativa que o servidor informou à página. */
  readonly empresaId: string;
  /** Cancelar, Escape ou Fechar: nada foi criado por este diálogo. */
  readonly onFechar: () => void;
  /** 201: a referência que o SERVIDOR criou. */
  readonly onCriada: (
    tipo: TipoReferenciaInline,
    criada: ReferenciaCriadaInline,
  ) => void;
  /** 409 `nome_em_uso`: o RH escolheu a referência que já existia. */
  readonly onEscolherExistente: (
    tipo: TipoReferenciaInline,
    existente: ReferenciaExistenteApi,
  ) => void;
  /** Rede ou 5xx: a página relê a busca daquela referência. */
  readonly onIncerto: (tipo: TipoReferenciaInline) => void;
}

export function ModalCriacaoInline({
  pedido,
  empresaId,
  onFechar,
  onCriada,
  onEscolherExistente,
  onIncerto,
}: ModalCriacaoInlineProps) {
  const [enviando, setEnviando] = useState(false);
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  /** Trava síncrona contra envio duplicado (cliques no mesmo quadro). */
  const enviandoRef = useRef(false);
  /**
   * Pedido em curso. Uma resposta só vale se ainda for deste pedido e se o
   * diálogo continuar montado (troca de empresa remonta a página, T189).
   */
  const pedidoRef = useRef(0);

  // O diálogo aberto é edição pendente (a troca de empresa avisa antes); o
  // envio em andamento, salvamento.
  useEdicaoEmAndamento(pedido ? tituloDaCriacao(pedido.tipo) : "Criação", {
    pendente: pedido !== null,
    salvando: pedido !== null && enviando,
  });

  // Novo pedido (ou fechado): começa sem recusa, e respostas antigas não valem.
  useEffect(() => {
    pedidoRef.current += 1;
    setRecusa(null);
  }, [pedido]);

  useEffect(
    () => () => {
      pedidoRef.current += 1;
    },
    [],
  );

  function fechar() {
    if (enviandoRef.current) return;
    onFechar();
  }

  async function criar() {
    if (!pedido || enviandoRef.current) return;
    enviandoRef.current = true;
    const meu = pedidoRef.current;
    setEnviando(true);
    setRecusa(null);
    try {
      const criada = await TIPOS[pedido.tipo].criar({
        nome: pedido.nome,
        empresaId,
      });
      if (meu !== pedidoRef.current) return;
      onCriada(pedido.tipo, criada);
    } catch (erro: unknown) {
      if (meu !== pedidoRef.current) return;
      const { incerto, ...resto } = recusaDaCriacao(erro, pedido.tipo);
      setRecusa(resto);
      if (incerto) onIncerto(pedido.tipo);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  const tipo = pedido ? TIPOS[pedido.tipo] : null;
  const existente = recusa?.existente;
  const mostrarCriar = !recusa || recusa.podeRepetir;

  return (
    <Modal
      aberto={pedido !== null}
      titulo={pedido ? tituloDaCriacao(pedido.tipo) : ""}
      descricao={
        tipo
          ? `${g(tipo, "O", "A")} ${tipo.nome} será ${g(tipo, "criado", "criada")} na empresa ativa e ${g(tipo, "escolhido", "escolhida")} nesta admissão. O código é gerado automaticamente.`
          : ""
      }
      onFechar={fechar}
      bloqueado={enviando}
      rodape={
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={fechar}
            disabled={enviando}
          >
            Cancelar
          </Button>
          {existente && pedido ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => onEscolherExistente(pedido.tipo, existente)}
            >
              {`Escolher ${existente.codigo} — ${existente.nome}`}
            </Button>
          ) : mostrarCriar ? (
            // `aria-disabled`, e não `disabled`: o botão em foco não perde o
            // foco durante o envio; a trava é `enviandoRef`.
            <Button
              type="button"
              variant="primary"
              aria-disabled={enviando}
              onClick={() => void criar()}
            >
              {enviando ? "Criando…" : "Criar e escolher"}
            </Button>
          ) : null}
        </FormActions>
      }
    >
      {pedido ? (
        <p className="nova-admissao__texto">
          Nome: <strong>{pedido.nome}</strong>
        </p>
      ) : null}
      {recusa ? (
        <p className="nova-admissao__erro-geral" role="alert">
          {recusa.mensagem}
          {existente ? (
            <>
              {" "}
              Existente:{" "}
              <strong>{`${existente.codigo} — ${existente.nome}`}</strong>.
            </>
          ) : null}
        </p>
      ) : null}
      {enviando ? (
        <p className="nova-admissao__texto" role="status">
          Criando… Aguarde a confirmação do servidor.
        </p>
      ) : null}
    </Modal>
  );
}
