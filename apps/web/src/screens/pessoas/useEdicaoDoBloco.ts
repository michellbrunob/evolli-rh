import { useEffect, useRef, useState } from "react";
import {
  type DadosPessoaisDoColaboradorApi,
  type RegistrarDadosPessoaisDto,
  registrarDadosPessoaisDoColaborador,
} from "../../api/dadosPessoaisClient";
import {
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../api/csrfClient";
import { mesmosValores } from "./dadosPessoais";

/**
 * T181 — edição de UM bloco da ficha (dados pessoais ou endereço), com Salvar
 * e Cancelar. O bloco começa em leitura; "Editar" abre o formulário com o que
 * o servidor gravou; Cancelar descarta o digitado e volta ao gravado; Salvar
 * valida no cliente, envia só este bloco e, aceito, volta à leitura com o que
 * o servidor devolveu.
 *
 * Nenhuma recusa apaga o que foi digitado. Sem resposta ou com 5xx, o
 * servidor pode ter gravado: a mensagem não afirma nem nega, e salvar de novo
 * é seguro, porque o bloco substitui o registro com os mesmos valores.
 */

/** Como o bloco é nomeado nas mensagens ("os dados pessoais foram…"). */
export interface NomeDoBloco {
  /** "os dados pessoais", "o endereço". */
  readonly sujeito: string;
  /** "foram salvos", "foi salvo". */
  readonly salvo: string;
  /** "não foram salvos", "não foi salvo". */
  readonly naoSalvo: string;
  /** "Dados pessoais salvos.", "Endereço salvo." */
  readonly sucesso: string;
  /** Salvo sem diferença do que já estava gravado. */
  readonly semMudanca: string;
}

export type ErrosDoBloco<K extends string> = Partial<
  Record<K | "geral", string>
>;

export interface OpcoesEdicaoDoBloco<K extends string> {
  readonly colaboradorId: string;
  /** O gravado, como o formulário o edita. */
  readonly inicial: Readonly<Record<K, string>>;
  /** Momento da última gravação do bloco: igual depois de salvar, nada mudou. */
  readonly atualizadoEm: string | null;
  /** Erros locais, por campo, ou `geral` quando não é de um campo só. */
  readonly validar: (valores: Record<K, string>) => ErrosDoBloco<K>;
  /** O corpo do `PUT`, só com este bloco. */
  readonly corpo: (valores: Record<K, string>) => RegistrarDadosPessoaisDto;
  /** Lê, na resposta, o momento da gravação deste bloco. */
  readonly atualizadoEmDa: (
    resposta: DadosPessoaisDoColaboradorApi,
  ) => string | null;
  /** Campos na ordem da tela: o foco vai ao primeiro com erro. */
  readonly ordem: readonly K[];
  readonly idDoCampo: (campo: K | "geral") => string;
  readonly idBotaoEditar: string;
  readonly nome: NomeDoBloco;
  readonly onGravado: (resposta: DadosPessoaisDoColaboradorApi) => void;
  /** Avisos de máscara e de consulta saem ao editar, cancelar ou salvar. */
  readonly onReinicio?: () => void;
}

/**
 * `status` numérico do erro, lido por forma (vale também com o cliente
 * automockado nos testes); `null` sem resposta.
 */
function statusDe(erro: unknown): number | null {
  return typeof erro === "object" &&
    erro !== null &&
    typeof (erro as { status?: unknown }).status === "number"
    ? (erro as { status: number }).status
    : null;
}

/**
 * Recusa da gravação, pelo que a rota produz. Os dados digitados ficam no
 * formulário em todos os casos.
 */
export function mensagemDaGravacaoRecusada(
  erro: unknown,
  nome: NomeDoBloco,
): string {
  if (falhaPorTokenDesatualizado(erro)) {
    return "Esta página ficou desatualizada. Salve novamente; seus dados foram mantidos.";
  }
  if (falhaPorSessaoExpirada(erro)) {
    return `Sua sessão expirou, e ${nome.sujeito} ${nome.naoSalvo}. Entre de novo para continuar; os dados digitados foram mantidos nesta ficha.`;
  }
  if (falhaAoPrepararEnvio(erro)) {
    return `Não foi possível preparar o envio, e ${nome.sujeito} ${nome.naoSalvo}. Confira a conexão e salve de novo.`;
  }
  switch (statusDe(erro)) {
    case 400:
      return "O servidor recusou algum dos dados informados. Revise os campos e tente de novo.";
    case 403:
      return `Seu perfil não tem permissão para alterar ${nome.sujeito} deste colaborador. Nada foi salvo.`;
    case 404:
      return "Colaborador não encontrado na empresa ativa. Nada foi salvo.";
    case 409:
      return `${maiuscula(nome.sujeito)} ${nome.naoSalvo}: o colaborador deixou de ter vínculo em uso nesta empresa, ou outra pessoa gravou ao mesmo tempo. Feche e abra a ficha de novo.`;
    default:
      // Rede, 5xx ou resposta inesperada: pode ter gravado.
      return `Não foi possível confirmar se ${nome.sujeito} ${nome.salvo}. O que você digitou foi mantido; salvar de novo é seguro.`;
  }
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function useEdicaoDoBloco<K extends string>(
  opcoes: OpcoesEdicaoDoBloco<K>,
) {
  const {
    colaboradorId,
    inicial,
    atualizadoEm,
    validar,
    corpo,
    atualizadoEmDa,
    ordem,
    idDoCampo,
    idBotaoEditar,
    nome,
    onGravado,
    onReinicio,
  } = opcoes;
  const [emEdicao, setEmEdicao] = useState(false);
  const [edicao, setEdicao] = useState<Record<K, string>>({ ...inicial });
  const [erros, setErros] = useState<ErrosDoBloco<K>>({});
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  /** Trava síncrona: `disabled` só chega no próximo desenho. */
  const salvandoRef = useRef(false);
  /** Foco pedido para depois do desenho: um campo, um erro ou "Editar". */
  const focoPendenteRef = useRef<string | "primeiro-erro" | null>(null);

  const alterado = emEdicao && !mesmosValores(edicao, inicial);

  useEffect(() => {
    const pedido = focoPendenteRef.current;
    if (pedido === null) return;
    focoPendenteRef.current = null;
    if (pedido === "primeiro-erro") {
      const campo = [...ordem, "geral" as const].find((c) => erros[c]);
      if (campo) document.getElementById(idDoCampo(campo))?.focus();
      return;
    }
    document.getElementById(pedido)?.focus();
  });

  function editar() {
    setEdicao({ ...inicial });
    setErros({});
    setSucesso(null);
    setEmEdicao(true);
    onReinicio?.();
    focoPendenteRef.current = idDoCampo(ordem[0]!);
  }

  /** Descarta o digitado: volta ao que o servidor gravou. */
  function cancelar() {
    if (salvandoRef.current) return;
    setEdicao({ ...inicial });
    setErros({});
    setEmEdicao(false);
    onReinicio?.();
    focoPendenteRef.current = idBotaoEditar;
  }

  function alterarCampo(campo: K, valor: string) {
    setEdicao((prev) => ({ ...prev, [campo]: valor }));
    // Só o erro do campo corrigido sai; o geral fica até o próximo envio.
    setErros((prev) => {
      const restante = { ...prev };
      delete restante[campo];
      return restante;
    });
  }

  async function salvar(evento?: React.FormEvent) {
    evento?.preventDefault();
    if (salvandoRef.current || !emEdicao) return;
    const locais = validar(edicao);
    if (Object.keys(locais).length > 0) {
      setErros(locais);
      focoPendenteRef.current = "primeiro-erro";
      return;
    }
    salvandoRef.current = true;
    setSalvando(true);
    setErros({});
    try {
      const resposta = await registrarDadosPessoaisDoColaborador(
        colaboradorId,
        corpo(edicao),
      );
      if (!resposta || resposta.colaboradorId !== colaboradorId) {
        throw new Error("resposta inesperada");
      }
      const depois = atualizadoEmDa(resposta);
      setSucesso(
        depois !== null && depois === atualizadoEm
          ? nome.semMudanca
          : nome.sucesso,
      );
      setEmEdicao(false);
      onReinicio?.();
      onGravado(resposta);
      focoPendenteRef.current = idBotaoEditar;
    } catch (erro) {
      setErros({
        geral: mensagemDaGravacaoRecusada(erro, nome),
      } as ErrosDoBloco<K>);
      focoPendenteRef.current = "primeiro-erro";
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  return {
    emEdicao,
    edicao,
    setEdicao,
    erros,
    setErros,
    salvando,
    sucesso,
    alterado,
    editar,
    cancelar,
    alterarCampo,
    salvar,
  };
}
