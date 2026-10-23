/**
 * T180 — cadastro rápido de Departamento, Cargo e Unidade na Nova admissão,
 * sem sair do formulário (decisão da proprietária de 2026-10-23).
 *
 * Um modal curto, só com os mínimos do contrato atual: **código** (maiúsculas,
 * dígitos e `_`, de 2 a 32 caracteres, imutável) e **nome** (até 160
 * caracteres). Nada de CBO, salário, descrição, atividades, hierarquia ou
 * responsáveis. A empresa é sempre a ativa, que a página já recebeu do
 * servidor; o servidor a confere contra a sessão.
 *
 * O modal não conhece a admissão: só avisa a página do que aconteceu
 * (`onCriada`, `onFechar`, `onRecarregar`). Quem atualiza o seletor, escolhe
 * a referência nova e devolve o foco ao seletor é a página. Toda recusa fica
 * DENTRO do modal, sem fechá-lo e sem tocar na admissão.
 */
import { useEffect, useRef, useState } from "react";
import { Button, FormActions, FormField, Modal } from "../../components";
import {
  type DepartamentoApi,
  type UnidadeOrganizacionalApi,
  criarDepartamento,
  criarUnidade,
} from "../../api/organizacaoClient";
import { type CargoApi, criarCargo } from "../../api/cargoClient";
import {
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../api/csrfClient";

/** T180 — as três referências com cadastro rápido. */
export type TipoReferenciaRapida = "departamento" | "cargo" | "unidade";

/** T180 — o que o servidor devolve no 201, de qualquer das três. */
export type ReferenciaCriada =
  DepartamentoApi | CargoApi | UnidadeOrganizacionalApi;

interface DefinicaoDaReferencia {
  readonly titulo: string;
  /** Plural da mensagem de permissão ("cadastrar departamentos"). */
  readonly plural: string;
  readonly criar: (dto: {
    codigo: string;
    nome: string;
    empresaId: string;
  }) => Promise<ReferenciaCriada>;
}

const REFERENCIAS: Readonly<
  Record<TipoReferenciaRapida, DefinicaoDaReferencia>
> = {
  departamento: {
    titulo: "Cadastrar departamento",
    plural: "departamentos",
    criar: criarDepartamento,
  },
  cargo: {
    titulo: "Cadastrar cargo",
    plural: "cargos",
    criar: criarCargo,
  },
  unidade: {
    titulo: "Cadastrar unidade",
    plural: "unidades",
    criar: criarUnidade,
  },
};

/** Mesmo padrão do contrato e de Estrutura (`CODIGO_PATTERN`). */
const CODIGO_PATTERN = /^[A-Z0-9_]{2,32}$/;
const NOME_MAXIMO = 160;

export const ID_CODIGO_REFERENCIA = "nova-admissao-referencia-codigo";
export const ID_NOME_REFERENCIA = "nova-admissao-referencia-nome";
const ID_FORM_REFERENCIA = "nova-admissao-referencia-form";

/** T180 — textos da recusa, um por situação do contrato. */
export const MENSAGENS_REFERENCIA = {
  codigoEmUso: "Este código já está em uso nesta empresa.",
  recusada: "O servidor recusou os dados. Revise código e nome.",
  paginaDesatualizada:
    "Esta página ficou desatualizada. Cadastre novamente; seus dados foram mantidos.",
  sessaoExpirada:
    "Sua sessão expirou. Entre de novo para continuar; os dados digitados foram mantidos nesta página.",
  empresaNaoConfirmada:
    "A empresa ativa não pôde ser confirmada. Feche este cadastro e abra a página de novo.",
  incerto:
    "Não foi possível confirmar se o cadastro foi feito. A lista foi atualizada: confira se a referência já aparece antes de tentar de novo.",
} as const;

/** T180 — 403 sem `codigo`: o perfil não escreve na estrutura (o DP só lê). */
export function mensagemSemPermissao(tipo: TipoReferenciaRapida): string {
  return `Seu perfil não tem permissão para cadastrar ${REFERENCIAS[tipo].plural}.`;
}

interface ErrosDaReferencia {
  codigo?: string;
  nome?: string;
  geral?: string;
}

/** Limpa o erro do campo em correção e preserva os demais. */
function semErroDe(
  erros: ErrosDaReferencia,
  campo: keyof ErrosDaReferencia,
): ErrosDaReferencia {
  const restante = { ...erros };
  delete restante[campo];
  return restante;
}

/** Validação local, com as mensagens de Estrutura e de Funções e cargos. */
function validar(codigo: string, nome: string): ErrosDaReferencia {
  const erros: ErrosDaReferencia = {};
  if (!codigo) erros.codigo = "Código é obrigatório.";
  else if (!CODIGO_PATTERN.test(codigo)) {
    erros.codigo =
      "Código deve conter apenas letras maiúsculas, dígitos e _ (2 a 32 caracteres).";
  }
  if (!nome) erros.nome = "Nome é obrigatório.";
  else if (nome.length > NOME_MAXIMO) {
    erros.nome = "Nome deve ter no máximo 160 caracteres.";
  }
  return erros;
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
 * T180 — traduz a recusa. `incerto` é rede sem resposta ou 5xx: o servidor
 * pode ter gravado, e a página recarrega a lista daquela referência.
 */
function errosDaRecusa(
  erro: unknown,
  tipo: TipoReferenciaRapida,
): { erros: ErrosDaReferencia; incerto: boolean } {
  if (falhaPorTokenDesatualizado(erro)) {
    return {
      erros: { geral: MENSAGENS_REFERENCIA.paginaDesatualizada },
      incerto: false,
    };
  }
  if (falhaPorSessaoExpirada(erro)) {
    return {
      erros: { geral: MENSAGENS_REFERENCIA.sessaoExpirada },
      incerto: false,
    };
  }
  const status = statusDe(erro);
  if (status === null || status >= 500) {
    return { erros: { geral: MENSAGENS_REFERENCIA.incerto }, incerto: true };
  }
  switch (status) {
    case 409:
      return {
        erros: { codigo: MENSAGENS_REFERENCIA.codigoEmUso },
        incerto: false,
      };
    case 403:
      return { erros: { geral: mensagemSemPermissao(tipo) }, incerto: false };
    case 404:
      return {
        erros: { geral: MENSAGENS_REFERENCIA.empresaNaoConfirmada },
        incerto: false,
      };
    // 400 e qualquer outra recusa 4xx: os dados não foram aceitos.
    default:
      return {
        erros: { geral: MENSAGENS_REFERENCIA.recusada },
        incerto: false,
      };
  }
}

export interface ModalReferenciaRapidaProps {
  /** Referência em cadastro; `null` com o modal fechado. */
  readonly tipo: TipoReferenciaRapida | null;
  /** Empresa ativa que o servidor informou à página. */
  readonly empresaId: string;
  /** Escape, "Fechar" ou "Cancelar": nada foi gravado por este modal. */
  readonly onFechar: () => void;
  /** 201: a referência que o SERVIDOR criou. */
  readonly onCriada: (
    tipo: TipoReferenciaRapida,
    criada: ReferenciaCriada,
  ) => void;
  /** Rede ou 5xx: a página recarrega a lista daquela referência. */
  readonly onRecarregar: (tipo: TipoReferenciaRapida) => void;
}

export function ModalReferenciaRapida({
  tipo,
  empresaId,
  onFechar,
  onCriada,
  onRecarregar,
}: ModalReferenciaRapidaProps) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [erros, setErros] = useState<ErrosDaReferencia>({});
  const [enviando, setEnviando] = useState(false);
  /** Trava síncrona contra envio duplicado (cliques no mesmo quadro). */
  const enviandoRef = useRef(false);

  // T180 — foco inicial no Código. Este efeito roda DEPOIS do efeito do
  // `Modal` (filho), que leva o foco ao título ao abrir.
  useEffect(() => {
    if (tipo) document.getElementById(ID_CODIGO_REFERENCIA)?.focus();
  }, [tipo]);

  /** Volta ao estado vazio: o próximo cadastro começa do zero. */
  function limpar() {
    setCodigo("");
    setNome("");
    setErros({});
  }

  function fechar() {
    if (enviandoRef.current) return;
    limpar();
    onFechar();
  }

  async function cadastrar(evento?: React.FormEvent) {
    evento?.preventDefault();
    if (!tipo || enviandoRef.current) return;
    const codigoLimpo = codigo.trim();
    const nomeLimpo = nome.trim();
    const novos = validar(codigoLimpo, nomeLimpo);
    if (novos.codigo || novos.nome) {
      setErros(novos);
      document
        .getElementById(
          novos.codigo ? ID_CODIGO_REFERENCIA : ID_NOME_REFERENCIA,
        )
        ?.focus();
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    setErros({});
    try {
      const criada = await REFERENCIAS[tipo].criar({
        codigo: codigoLimpo,
        nome: nomeLimpo,
        empresaId,
      });
      limpar();
      onCriada(tipo, criada);
    } catch (erro: unknown) {
      // O que foi digitado no modal fica: só as mensagens mudam.
      const recusa = errosDaRecusa(erro, tipo);
      setErros(recusa.erros);
      if (recusa.erros.codigo) {
        document.getElementById(ID_CODIGO_REFERENCIA)?.focus();
      }
      if (recusa.incerto) onRecarregar(tipo);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto={tipo !== null}
      titulo={tipo ? REFERENCIAS[tipo].titulo : ""}
      descricao="Só código e nome, na empresa ativa. A admissão em edição continua como está."
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
          {/* `aria-disabled`, e não `disabled`: o botão em foco não perde o
              foco durante o envio; a trava é `enviandoRef`. */}
          <Button
            type="submit"
            form={ID_FORM_REFERENCIA}
            variant="primary"
            aria-disabled={enviando}
          >
            {enviando ? "Cadastrando…" : "Cadastrar"}
          </Button>
        </FormActions>
      }
    >
      <form
        id={ID_FORM_REFERENCIA}
        className="nova-admissao__referencia-form"
        noValidate
        onSubmit={(e) => void cadastrar(e)}
      >
        <FormField
          id={ID_CODIGO_REFERENCIA}
          label="Código"
          required
          help="Letras maiúsculas, números e _ (2 a 32 caracteres). Não pode ser alterado depois."
          {...(erros.codigo ? { error: erros.codigo } : {})}
        >
          {(control) => (
            <input
              type="text"
              maxLength={32}
              autoComplete="off"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value.toUpperCase());
                setErros((prev) => semErroDe(prev, "codigo"));
              }}
              {...control}
            />
          )}
        </FormField>
        <FormField
          id={ID_NOME_REFERENCIA}
          label="Nome"
          required
          help="Até 160 caracteres."
          {...(erros.nome ? { error: erros.nome } : {})}
        >
          {(control) => (
            <input
              type="text"
              maxLength={NOME_MAXIMO}
              autoComplete="off"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setErros((prev) => semErroDe(prev, "nome"));
              }}
              {...control}
            />
          )}
        </FormField>
        {erros.geral ? (
          <p className="nova-admissao__erro-geral" role="alert">
            {erros.geral}
          </p>
        ) : null}
        {enviando ? (
          <p className="nova-admissao__texto" role="status">
            Cadastrando… Aguarde a confirmação do servidor.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
