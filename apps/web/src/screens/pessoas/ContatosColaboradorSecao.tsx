import { useCallback, useEffect, useRef, useState } from "react";
import { Button, CampoMascarado, FormField } from "../../components";
import { ApiError } from "../../api/colaboradoresClient";
import {
  type ContatosApi,
  consultarContatosDoColaborador,
  registrarContatosDoColaborador,
} from "../../api/contatosColaboradorClient";
import {
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../api/csrfClient";
import {
  type CampoContato,
  type CampoTelefone,
  type ErrosContatos,
  type ValoresContatos,
  LIMITE_EMAIL_PESSOAL,
  contatosParaEdicao,
  contatosParaRegistro,
  contatosVazios,
  legadoIntacto,
  telefonesLegados,
  validarContatos,
} from "./contatosColaborador";
import { DICA_DE_FORMATO } from "../../format/mascaras";

/**
 * T169 — seção "Contatos" do detalhe do colaborador.
 *
 * Lê e grava pelas rotas próprias de contatos; nada daqui passa pela
 * listagem. A empresa nunca é enviada: o servidor a resolve pelo vínculo.
 *
 * T179 — os três campos são OPCIONAIS (decisão da proprietária de
 * 2026-10-21): o formato só é conferido no que está preenchido, e o vazio vai
 * `null` no `PUT` — é assim que um contato gravado é apagado. Sem registro,
 * salvar os três vazios não cria nada: pede ao menos um. Com registro, limpar
 * os três e salvar REMOVE os contatos: o servidor responde `sem_registro`
 * (`removido`) e a seção volta ao estado "Nenhum contato registrado", o mesmo
 * de quem nunca teve contato. O não informado
 * aparece como "Não informado" no próprio campo vazio. A
 * confirmação de descarte é a do `Modal`: a seção avisa o detalhe quando há
 * edição não salva (`onAlteradoChange`) e quando está gravando
 * (`onSalvandoChange`), e o detalhe soma isso ao que ele próprio edita.
 *
 * T179 — celular e telefone são só brasileiros: gravados em `+55` + DDD +
 * número e editados na máscara `(00) 00000-0000` / `(00) 0000-0000`. O e-mail
 * pessoal é único na empresa: o 409 com `emailPessoal` em uso vai para o
 * campo, sem repetir o valor.
 *
 * T179 (revisão final) — telefone gravado fora da forma atual é LEGADO: o
 * campo o mostra exatamente como gravado, com a dica `DICA_LEGADO`. Intacto,
 * não é validado nem enviado (a chave sai do `PUT`, e o servidor mantém o
 * gravado); alterado, só um número brasileiro válido é aceito, e apagar tudo
 * envia `null`. Os avisos da máscara somem ao salvar, remover ou recarregar.
 */

const VAZIO: ValoresContatos = { emailPessoal: "", celular: "", telefone: "" };

const ORDEM_DOS_ERROS: readonly (CampoContato | "geral")[] = [
  "emailPessoal",
  "celular",
  "telefone",
  "geral",
];

const ERRO_GERAL_ID = "contatos-colaborador-erro-geral";

/**
 * T179 — estado "Nenhum contato registrado" (colaborador admitido sem
 * contatos). Tem id próprio para a seção apontar para ele: quem chega por
 * leitor de tela ouve, junto do título, que não há contato cadastrado.
 */
const SEM_CONTATOS_ID = "contatos-colaborador-sem-registro";
const TEXTO_SEM_CONTATOS =
  "Nenhum contato registrado. Este colaborador não tem e-mail pessoal, celular nem telefone cadastrados. Os três campos são opcionais: informe os que tiver.";

const ID_DO_CAMPO: Record<CampoContato | "geral", string> = {
  emailPessoal: "contatos-colaborador-email-pessoal",
  celular: "contatos-colaborador-celular",
  telefone: "contatos-colaborador-telefone",
  geral: ERRO_GERAL_ID,
};

type Carga =
  | { status: "carregando" }
  | { status: "erro"; mensagem: string }
  | { status: "bloqueado" }
  | { status: "dados"; gravado: ContatosApi | null };

/**
 * O que foi gravado, como a tela edita: telefones já mascarados (T179). O
 * não informado (`null`) vira campo vazio.
 */
function valoresDe(contatos: ContatosApi): ValoresContatos {
  return contatosParaEdicao(contatos);
}

/** T179 — rótulo de campo opcional: o "opcional" é parte do nome acessível. */
function rotuloOpcional(rotulo: string): string {
  return `${rotulo} (opcional)`;
}

/** T179 — o que o campo vazio mostra: o estado gravado, não um valor. */
const NAO_INFORMADO = "Não informado";

/**
 * T179 (revisão final) — a marca do telefone LEGADO, ligada ao campo por
 * `aria-describedby` enquanto ele ainda tem o valor gravado.
 */
const DICA_LEGADO =
  "Formato antigo, mantido exatamente como gravado. Para trocar, apague e digite um número brasileiro.";

/** T179 — o campo apontado pelo 409 de e-mail em uso, lido por forma. */
function emailEmUso(erro: unknown): boolean {
  const erros =
    typeof erro === "object" && erro !== null
      ? (erro as { erros?: unknown }).erros
      : undefined;
  return (
    Array.isArray(erros) &&
    erros.some(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        (e as { campo?: unknown }).campo === "emailPessoal" &&
        (e as { motivo?: unknown }).motivo === "em_uso",
    )
  );
}

/**
 * Recusa da LEITURA. O servidor responde com mensagem fixa por status; a
 * tradução abaixo se apoia no que a rota produz:
 *  - 404 — colaborador inexistente ou fora da empresa ativa (indistinguíveis);
 *  - 409 — perfil global sem empresa ativa e colaborador com vínculo em mais
 *    de uma empresa: a operação seria ambígua.
 */
function mensagemDaLeituraRecusada(erro: unknown): string {
  const status = erro instanceof ApiError ? erro.status : null;
  switch (status) {
    case 404:
      return "Colaborador não encontrado na empresa ativa.";
    case 403:
      return "Seu perfil não tem acesso aos contatos deste colaborador.";
    case 409:
      return "Este colaborador tem vínculo em mais de uma empresa. Selecione a empresa ativa para ver os contatos.";
    case 401:
      return "Seu acesso expirou. Entre novamente para ver os contatos.";
    default:
      return "Não foi possível carregar os contatos deste colaborador.";
  }
}

/**
 * Recusa da GRAVAÇÃO — os dados digitados ficam no formulário em todos os casos.
 *
 * T179 (revisão final) — sessão expirada (401 ou `CsrfSessionExpiredError` na
 * renovação do token) tem mensagem própria; T179 (revisão definitiva) — 403
 * com `codigo: "csrf_invalido"` é página desatualizada (sessão válida, token
 * desta aba renovado por outra): o cliente já descartou o token, e salvar de
 * novo funciona. O 403 sem código continua sendo de permissão. `CsrfRequestError` (token não renovado por rede
 * ou 5xx) diz que o pedido nem saiu. Aqui não há envio incerto: os contatos
 * não têm chave de idempotência.
 */
function errosDaGravacaoRecusada(erro: unknown): ErrosContatos {
  if (falhaPorTokenDesatualizado(erro)) {
    return {
      geral:
        "Esta página ficou desatualizada. Salve novamente; seus dados foram mantidos.",
    };
  }
  if (falhaPorSessaoExpirada(erro)) {
    return {
      geral:
        "Sua sessão expirou e os contatos não foram salvos. Entre de novo para continuar; os dados digitados foram mantidos nesta ficha.",
    };
  }
  if (falhaAoPrepararEnvio(erro)) {
    return {
      geral:
        "Não foi possível preparar o envio e os contatos não foram salvos. Confira a conexão e salve de novo.",
    };
  }
  const status = erro instanceof ApiError ? erro.status : null;
  switch (status) {
    case 400:
      return {
        geral:
          "O servidor recusou algum dos contatos informados. Revise os campos e tente de novo.",
      };
    case 409:
      // T179 — com a lista de campos, é o e-mail de outro colaborador desta
      // empresa; sem ela, o bloqueio de antes (vínculo encerrado).
      if (emailEmUso(erro)) {
        return {
          emailPessoal: "Este e-mail pessoal já está em uso nesta empresa.",
        };
      }
      return {
        geral:
          "Os contatos não foram salvos: o colaborador deixou de ter vínculo em uso nesta empresa, ou outra pessoa os gravou ao mesmo tempo. Feche e abra a ficha de novo.",
      };
    case 404:
      return {
        geral: "Colaborador não encontrado na empresa ativa. Nada foi salvo.",
      };
    case 403:
      return {
        geral:
          "Seu perfil não tem permissão para alterar contatos. Nada foi salvo.",
      };
    default:
      // T181 — rede ou 5xx: o servidor pode ter gravado. A mensagem não
      // afirma nem nega; salvar de novo é seguro, porque o `PUT` com os mesmos
      // valores não muda nada.
      return {
        geral:
          "Não foi possível confirmar se os contatos foram salvos. O que você digitou foi mantido; salvar de novo é seguro.",
      };
  }
}

export interface ContatosColaboradorSecaoProps {
  readonly colaboradorId: string;
  readonly onAlteradoChange: (alterado: boolean) => void;
  readonly onSalvandoChange: (salvando: boolean) => void;
  /**
   * T176 — levar o foco ao primeiro campo assim que os contatos carregarem.
   * É o "Completar contatos" da página de Nova admissão: quem acabou de
   * admitir chega direto ao que vai preencher. Só vale uma vez por montagem.
   */
  readonly focarAoCarregar?: boolean;
}

export function ContatosColaboradorSecao({
  colaboradorId,
  onAlteradoChange,
  onSalvandoChange,
  focarAoCarregar = false,
}: ContatosColaboradorSecaoProps) {
  const [carga, setCarga] = useState<Carga>({ status: "carregando" });
  const [edicao, setEdicao] = useState<ValoresContatos>(VAZIO);
  const [erros, setErros] = useState<ErrosContatos>({});
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  /** Trava síncrona: `disabled` só chega no próximo desenho. */
  const salvandoRef = useRef(false);
  /** Pedido de foco no primeiro erro, atendido depois do desenho. */
  const focarPrimeiroErroRef = useRef(false);
  /** Só a resposta mais recente é aplicada (troca rápida de colaborador). */
  const pedidoRef = useRef(0);
  /** T176 — o foco pedido por `focarAoCarregar` é atendido uma vez só. */
  const focoInicialAtendidoRef = useRef(false);
  /**
   * T179 (revisão final) — contador que limpa os avisos da máscara
   * (`limparAvisos`): muda ao recarregar, salvar ou remover.
   */
  const [limpezaDosAvisos, setLimpezaDosAvisos] = useState(0);

  const carregar = useCallback(async () => {
    const pedido = ++pedidoRef.current;
    setLimpezaDosAvisos((n) => n + 1);
    setCarga({ status: "carregando" });
    try {
      const resposta = await consultarContatosDoColaborador(colaboradorId);
      if (pedido !== pedidoRef.current) return;
      if (!resposta || resposta.colaboradorId !== colaboradorId) {
        throw new Error("resposta inesperada");
      }
      if (resposta.situacao === "bloqueado") {
        setCarga({ status: "bloqueado" });
        setEdicao(VAZIO);
        return;
      }
      const gravado =
        resposta.situacao === "registrado" ? resposta.contatos : null;
      setCarga({ status: "dados", gravado });
      setEdicao(gravado ? valoresDe(gravado) : VAZIO);
    } catch (erro) {
      if (pedido !== pedidoRef.current) return;
      setCarga({ status: "erro", mensagem: mensagemDaLeituraRecusada(erro) });
    }
  }, [colaboradorId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const gravado = carga.status === "dados" ? carga.gravado : null;
  // T179 (revisão final) — telefones gravados fora da forma atual, brutos.
  const legados = telefonesLegados(gravado);
  // T179 — comparado com o gravado como a tela o exibe (mascarado na forma
  // atual; o legado, bruto): abrir a ficha não conta como alteração.
  const inicial = gravado ? valoresDe(gravado) : VAZIO;
  const alterado =
    carga.status === "dados" &&
    (edicao.emailPessoal !== inicial.emailPessoal ||
      edicao.celular !== inicial.celular ||
      edicao.telefone !== inicial.telefone);

  useEffect(() => {
    onAlteradoChange(alterado);
  }, [alterado, onAlteradoChange]);

  useEffect(() => {
    onSalvandoChange(salvando);
  }, [salvando, onSalvandoChange]);

  // Ao sair (fechar o detalhe, trocar de colaborador), nada fica pendurado.
  useEffect(
    () => () => {
      onAlteradoChange(false);
      onSalvandoChange(false);
    },
    [onAlteradoChange, onSalvandoChange],
  );

  useEffect(() => {
    if (!focarAoCarregar || focoInicialAtendidoRef.current) return;
    if (carga.status !== "dados") return;
    focoInicialAtendidoRef.current = true;
    document.getElementById(ID_DO_CAMPO.emailPessoal)?.focus();
  }, [carga.status, focarAoCarregar]);

  useEffect(() => {
    if (!focarPrimeiroErroRef.current) return;
    focarPrimeiroErroRef.current = false;
    const campo = ORDEM_DOS_ERROS.find((c) => erros[c]);
    if (!campo) return;
    document.getElementById(ID_DO_CAMPO[campo])?.focus();
  }, [erros]);

  function alterarCampo(campo: CampoContato, valor: string) {
    setEdicao((prev) => ({ ...prev, [campo]: valor }));
    setSucesso(null);
    // Limpa só o erro do campo corrigido; o geral fica até o próximo envio.
    setErros((prev) => {
      const restante = { ...prev };
      delete restante[campo];
      return restante;
    });
  }

  /**
   * T181 — Cancelar: descarta o que foi digitado e volta ao gravado (ou ao
   * vazio, sem registro). O foco vai ao primeiro campo, porque o botão fica
   * inativo depois de cancelar.
   */
  function cancelar() {
    if (salvandoRef.current) return;
    setEdicao(gravado ? valoresDe(gravado) : VAZIO);
    setErros({});
    setSucesso(null);
    setLimpezaDosAvisos((n) => n + 1);
    document.getElementById(ID_DO_CAMPO.emailPessoal)?.focus();
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (salvandoRef.current || carga.status !== "dados") return;
    setSucesso(null);

    const errosLocais: ErrosContatos = validarContatos(edicao, legados);
    // T179 — sem registro, os três vazios não criam nada: não há o que gravar.
    if (gravado === null && contatosVazios(edicao)) {
      errosLocais.geral =
        "Nenhum contato preenchido: informe ao menos um para salvar.";
    }
    if (Object.keys(errosLocais).length > 0) {
      focarPrimeiroErroRef.current = true;
      setErros(errosLocais);
      return;
    }

    salvandoRef.current = true;
    setSalvando(true);
    setErros({});
    try {
      const resposta = await registrarContatosDoColaborador(
        colaboradorId,
        contatosParaRegistro(edicao, legados),
      );
      // T179 — os três vazios removem o registro (`removido`) ou confirmam
      // que não havia nenhum (`sem_alteracao`): a seção fica sem registro.
      if (resposta?.situacao === "sem_registro") {
        setLimpezaDosAvisos((n) => n + 1);
        setCarga({ status: "dados", gravado: null });
        setEdicao(VAZIO);
        setSucesso(
          resposta.resultado === "removido"
            ? "Contatos removidos."
            : "Nada mudou: este colaborador já não tinha contatos.",
        );
        return;
      }
      if (!resposta?.contatos) {
        throw new Error("resposta inesperada");
      }
      setLimpezaDosAvisos((n) => n + 1);
      setCarga({ status: "dados", gravado: resposta.contatos });
      setEdicao(valoresDe(resposta.contatos));
      setSucesso(
        resposta.resultado === "sem_alteracao"
          ? "Nada mudou: os contatos já estavam com estes valores."
          : "Contatos salvos.",
      );
    } catch (erro) {
      focarPrimeiroErroRef.current = true;
      setErros(errosDaGravacaoRecusada(erro));
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  /**
   * T179 — um campo de telefone. T179 (revisão final) — com o legado intacto,
   * a dica `DICA_LEGADO` aparece e entra na descrição do campo.
   */
  function campoTelefone(campo: CampoTelefone, rotulo: string) {
    const id = ID_DO_CAMPO[campo];
    const legado = legadoIntacto(edicao, legados, campo);
    const idDoLegado = `${id}-legado`;
    const erro = erros[campo];
    return (
      <FormField
        id={id}
        label={rotuloOpcional(rotulo)}
        help={DICA_DE_FORMATO.telefone}
        disabled={salvando}
        {...(erro ? { error: erro } : {})}
      >
        {(control) => (
          <>
            <CampoMascarado
              mascara="telefone"
              placeholder={NAO_INFORMADO}
              value={edicao[campo]}
              onValorChange={(valor) => alterarCampo(campo, valor)}
              limparAvisos={limpezaDosAvisos}
              {...control}
              {...(legado
                ? {
                    "aria-describedby": [
                      control["aria-describedby"],
                      idDoLegado,
                    ]
                      .filter(Boolean)
                      .join(" "),
                  }
                : {})}
            />
            {legado ? (
              <p id={idDoLegado} className="evolli-field__help">
                {DICA_LEGADO}
              </p>
            ) : null}
          </>
        )}
      </FormField>
    );
  }

  return (
    <section
      className="colaboradores-screen__contatos"
      aria-labelledby="contatos-colaborador-titulo"
      {...(carga.status === "dados" && gravado === null
        ? { "aria-describedby": SEM_CONTATOS_ID }
        : {})}
    >
      <h3
        id="contatos-colaborador-titulo"
        className="colaboradores-screen__section-title"
      >
        Contatos
      </h3>

      {carga.status === "carregando" ? (
        <p className="colaboradores-screen__carregando" role="status">
          Carregando contatos…
        </p>
      ) : carga.status === "erro" ? (
        <p className="colaboradores-screen__form-erro" role="alert">
          {carga.mensagem}{" "}
          <Button variant="secondary" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </p>
      ) : carga.status === "bloqueado" ? (
        <p className="colaboradores-screen__contatos-aviso" role="status">
          Os contatos deste colaborador estão bloqueados: ele não tem vínculo
          previsto ou ativo nesta empresa. Depois do desligamento, os contatos
          ficam guardados, mas não são exibidos nem alterados.
        </p>
      ) : (
        <form
          className="colaboradores-screen__contatos-form"
          noValidate
          onSubmit={(e) => void salvar(e)}
        >
          {gravado === null ? (
            // T179 — estado, não erro: `status` anuncia sem interromper.
            <p
              id={SEM_CONTATOS_ID}
              className="colaboradores-screen__contatos-aviso"
              role="status"
            >
              {TEXTO_SEM_CONTATOS}
            </p>
          ) : null}

          <FormField
            id={ID_DO_CAMPO.emailPessoal}
            label={rotuloOpcional("E-mail pessoal")}
            disabled={salvando}
            {...(erros.emailPessoal ? { error: erros.emailPessoal } : {})}
          >
            {(control) => (
              <input
                type="email"
                autoComplete="off"
                maxLength={LIMITE_EMAIL_PESSOAL + 10}
                placeholder={NAO_INFORMADO}
                value={edicao.emailPessoal}
                onChange={(e) => alterarCampo("emailPessoal", e.target.value)}
                {...control}
                // T179 — o foco de "Revisar contatos na ficha" cai direto
                // aqui, sem passar pelo título da seção: o estado "Nenhum
                // contato registrado" entra na descrição do primeiro campo,
                // junto da ajuda e do erro que o `FormField` já liga.
                {...(gravado === null
                  ? {
                      "aria-describedby": [
                        control["aria-describedby"],
                        SEM_CONTATOS_ID,
                      ]
                        .filter(Boolean)
                        .join(" "),
                    }
                  : {})}
              />
            )}
          </FormField>

          {campoTelefone("celular", "Celular")}

          {campoTelefone("telefone", "Telefone")}

          {erros.geral ? (
            <p
              id={ERRO_GERAL_ID}
              className="colaboradores-screen__form-erro"
              role="alert"
              tabIndex={-1}
            >
              {erros.geral}
            </p>
          ) : null}

          {sucesso ? (
            <p className="colaboradores-screen__sucesso-texto" role="status">
              {sucesso}
            </p>
          ) : null}

          <div className="colaboradores-screen__bloco-acoes">
            <Button
              type="submit"
              variant="primary"
              // Sem registro, o botão fica disponível mesmo vazio: é clicando
              // que a pessoa descobre o que falta. Com registro, só quando há
              // o que salvar.
              disabled={salvando || (gravado !== null && !alterado)}
            >
              {salvando ? "Salvando…" : "Salvar contatos"}
            </Button>
            {/* T181 — Cancelar restaura o gravado; sem nada digitado, não há
                o que descartar. */}
            <Button
              type="button"
              variant="secondary"
              onClick={cancelar}
              disabled={salvando || !alterado}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
