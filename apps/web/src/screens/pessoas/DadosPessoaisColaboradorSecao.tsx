import { useCallback, useEffect, useRef, useState } from "react";
import { Button, CampoMascarado, FormField } from "../../components";
import { ApiError } from "../../api/colaboradoresClient";
import {
  type DadosPessoaisDoColaboradorApi,
  type EnderecoApi,
  type PerfilPessoalApi,
  consultarDadosPessoaisDoColaborador,
} from "../../api/dadosPessoaisClient";
import { formatarDiaCivil } from "../../format/data";
import { DICA_DE_FORMATO, exibirCep } from "../../format/mascaras";
import {
  CAMPOS_ENDERECO,
  CAMPOS_TEXTO_PERFIL,
  CAMPO_SEXO,
  type ChaveEndereco,
  type ChavePerfil,
  OPCOES_SEXO,
  ROTULO_DATA_NASCIMENTO,
  type ValoresEndereco,
  blocoEndereco,
  blocoPerfil,
  ehPaisBrasil,
  enderecoParaEdicao,
  normalizarTexto,
  perfilParaEdicao,
  rotuloDoSexo,
  validarEndereco,
  validarPerfil,
} from "./dadosPessoais";
import { useCepAssistido } from "./cepAssistido";
import {
  type ErrosDoBloco,
  type NomeDoBloco,
  useEdicaoDoBloco,
} from "./useEdicaoDoBloco";

/**
 * Dados pessoais e endereço na ficha do colaborador (T177, Módulo 1). Cada
 * abertura é uma consulta auditada no servidor.
 *
 * Leem: `rh` e `dp` na empresa ativa, e o `master_tecnico` em qualquer
 * empresa (com empresa ativa, só nela) — Emenda 2 da ADR 0012. Perfil sem
 * acesso recebe a recusa do servidor e vê um aviso, nunca um valor.
 *
 * T179 — o sexo é gravado como código da lista fechada e aparece pelo
 * rótulo; sem valor, "Não informado" (nada é inferido); texto livre de um
 * cadastro anterior à lista aparece como veio.
 *
 * T181 — os dois blocos passam a ser EDITÁVEIS na ficha, cada um com o seu
 * "Editar", Salvar e Cancelar (decisão da proprietária de 2026-10-23). A
 * edição só aparece depois de uma leitura aceita: no servidor, quem lê estas
 * categorias também as edita, na mesma empresa, então a ficha nunca oferece
 * um botão que ele recusaria. Vínculo encerrado (`bloqueado`) não tem edição.
 * Cada bloco envia só ele mesmo (`PUT .../dados-pessoais`); o outro fica como
 * está. A empresa nunca é enviada: o servidor a resolve pela sessão.
 */
type Carga =
  | { status: "carregando" }
  | { status: "erro"; mensagem: string }
  | { status: "dados"; dados: DadosPessoaisDoColaboradorApi };

/**
 * Recusa da leitura, pelo que a rota produz — a mesma tradução dos contatos:
 *  - 403 — perfil sem acesso a estas categorias;
 *  - 404 — colaborador inexistente ou fora da empresa ativa (indistinguíveis);
 *  - 409 — `master_tecnico` sem empresa ativa e colaborador com vínculo em
 *    mais de uma empresa: a leitura seria ambígua, e nada foi lido.
 */
function mensagemDaRecusa(erro: unknown): string {
  const status = erro instanceof ApiError ? erro.status : null;
  switch (status) {
    case 403:
      return "Seu perfil não tem acesso aos dados pessoais e ao endereço deste colaborador.";
    case 404:
      return "Colaborador não encontrado na empresa ativa.";
    case 409:
      return "Este colaborador tem vínculo em mais de uma empresa. Selecione a empresa ativa para ver os dados pessoais e o endereço.";
    case 401:
      return "Seu acesso expirou. Entre novamente para ver os dados pessoais.";
    default:
      return "Não foi possível carregar os dados pessoais e o endereço agora.";
  }
}

/** T181 — rótulo de campo opcional: o "opcional" é parte do nome acessível. */
function rotuloOpcional(rotulo: string): string {
  return `${rotulo} (opcional)`;
}

const NAO_INFORMADO = "Não informado";

export interface DadosPessoaisColaboradorSecaoProps {
  readonly colaboradorId: string;
  /**
   * T181 — o perfil pode consultar o CEP. A consulta é do servidor e exige a
   * mesma capacidade de admitir (RH e DP); sem ela, não há botão nem consulta
   * ao sair do campo, e o endereço é preenchido à mão.
   */
  readonly consultaCepDisponivel?: boolean;
  /** T181 — há edição não salva em algum dos blocos. */
  readonly onAlteradoChange?: (alterado: boolean) => void;
  /** T181 — algum dos blocos está gravando. */
  readonly onSalvandoChange?: (salvando: boolean) => void;
}

export function DadosPessoaisColaboradorSecao({
  colaboradorId,
  consultaCepDisponivel = false,
  onAlteradoChange,
  onSalvandoChange,
}: DadosPessoaisColaboradorSecaoProps) {
  const [carga, setCarga] = useState<Carga>({ status: "carregando" });
  const [alterado, setAlterado] = useState({ perfil: false, endereco: false });
  const [salvando, setSalvando] = useState({ perfil: false, endereco: false });

  useEffect(() => {
    let vigente = true;
    setCarga({ status: "carregando" });
    consultarDadosPessoaisDoColaborador(colaboradorId)
      .then((dados) => {
        if (vigente && dados.colaboradorId === colaboradorId) {
          setCarga({ status: "dados", dados });
        }
      })
      .catch((erro: unknown) => {
        if (vigente)
          setCarga({ status: "erro", mensagem: mensagemDaRecusa(erro) });
      });
    return () => {
      vigente = false;
    };
  }, [colaboradorId]);

  const algumAlterado = alterado.perfil || alterado.endereco;
  const algumSalvando = salvando.perfil || salvando.endereco;
  useEffect(() => {
    onAlteradoChange?.(algumAlterado);
  }, [algumAlterado, onAlteradoChange]);
  useEffect(() => {
    onSalvandoChange?.(algumSalvando);
  }, [algumSalvando, onSalvandoChange]);
  // Ao sair (fechar a ficha, trocar de colaborador), nada fica pendurado.
  useEffect(
    () => () => {
      onAlteradoChange?.(false);
      onSalvandoChange?.(false);
    },
    [onAlteradoChange, onSalvandoChange],
  );

  const aoAlterarPerfil = useCallback(
    (v: boolean) => setAlterado((prev) => ({ ...prev, perfil: v })),
    [],
  );
  const aoAlterarEndereco = useCallback(
    (v: boolean) => setAlterado((prev) => ({ ...prev, endereco: v })),
    [],
  );
  const aoSalvarPerfil = useCallback(
    (v: boolean) => setSalvando((prev) => ({ ...prev, perfil: v })),
    [],
  );
  const aoSalvarEndereco = useCallback(
    (v: boolean) => setSalvando((prev) => ({ ...prev, endereco: v })),
    [],
  );
  // O `PUT` devolve os dois blocos: o outro ganha o gravado novo como base,
  // e o que ele estiver editando fica como está.
  const aoGravar = useCallback(
    (dados: DadosPessoaisDoColaboradorApi) =>
      setCarga({ status: "dados", dados }),
    [],
  );

  if (carga.status !== "dados" || carga.dados.situacao === "bloqueado") {
    return (
      <section
        className="colaboradores-screen__dados-pessoais"
        aria-labelledby="dados-pessoais-colaborador-titulo"
      >
        <h3
          id="dados-pessoais-colaborador-titulo"
          className="colaboradores-screen__section-title"
        >
          Dados pessoais e endereço
        </h3>
        {carga.status === "carregando" ? (
          <p className="colaboradores-screen__carregando" role="status">
            Carregando dados pessoais…
          </p>
        ) : carga.status === "erro" ? (
          <p className="colaboradores-screen__contatos-aviso">
            {carga.mensagem}
          </p>
        ) : (
          <p className="colaboradores-screen__contatos-aviso">
            O vínculo deste colaborador foi encerrado: o uso dos dados pessoais
            está bloqueado.
          </p>
        )}
      </section>
    );
  }

  const { dados } = carga;
  return (
    <>
      <BlocoPerfilPessoal
        colaboradorId={colaboradorId}
        perfil={dados.perfilPessoal}
        onGravado={aoGravar}
        onAlteradoChange={aoAlterarPerfil}
        onSalvandoChange={aoSalvarPerfil}
      />
      <BlocoEndereco
        colaboradorId={colaboradorId}
        endereco={dados.endereco}
        consultaCepDisponivel={consultaCepDisponivel}
        onGravado={aoGravar}
        onAlteradoChange={aoAlterarEndereco}
        onSalvandoChange={aoSalvarEndereco}
      />
    </>
  );
}

interface BlocoProps {
  readonly colaboradorId: string;
  readonly onGravado: (dados: DadosPessoaisDoColaboradorApi) => void;
  readonly onAlteradoChange: (alterado: boolean) => void;
  readonly onSalvandoChange: (salvando: boolean) => void;
}

/** Avisa o pai do que o bloco está fazendo, e zera ao desmontar. */
function useAvisarPai(
  alterado: boolean,
  salvando: boolean,
  { onAlteradoChange, onSalvandoChange }: BlocoProps,
) {
  useEffect(() => onAlteradoChange(alterado), [alterado, onAlteradoChange]);
  useEffect(() => onSalvandoChange(salvando), [salvando, onSalvandoChange]);
  useEffect(
    () => () => {
      onAlteradoChange(false);
      onSalvandoChange(false);
    },
    [onAlteradoChange, onSalvandoChange],
  );
}

/** As ações do formulário em edição: Salvar e Cancelar, lado a lado. */
function AcoesDaEdicao({
  rotuloSalvar,
  salvando,
  onCancelar,
}: {
  readonly rotuloSalvar: string;
  readonly salvando: boolean;
  readonly onCancelar: () => void;
}) {
  return (
    <div className="colaboradores-screen__bloco-acoes">
      {/* `aria-disabled`, e não `disabled`: o botão em foco não perde o foco
          durante o envio; a trava é a do hook. */}
      <Button type="submit" variant="primary" aria-disabled={salvando}>
        {salvando ? "Salvando…" : rotuloSalvar}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={onCancelar}
        disabled={salvando}
      >
        Cancelar
      </Button>
    </div>
  );
}

/** A mensagem de sucesso e o botão que abre a edição, no modo de leitura. */
function RodapeDaLeitura({
  sucesso,
  idBotao,
  rotuloBotao,
  onEditar,
}: {
  readonly sucesso: string | null;
  readonly idBotao: string;
  readonly rotuloBotao: string;
  readonly onEditar: () => void;
}) {
  return (
    <>
      {sucesso ? (
        <p className="colaboradores-screen__sucesso-texto" role="status">
          {sucesso}
        </p>
      ) : null}
      <div className="colaboradores-screen__bloco-acoes">
        <Button
          type="button"
          variant="secondary"
          id={idBotao}
          onClick={onEditar}
        >
          {rotuloBotao}
        </Button>
      </div>
    </>
  );
}

/** O erro que não é de um campo só, com foco programático. */
function ErroGeral({
  id,
  mensagem,
}: {
  readonly id: string;
  readonly mensagem: string | undefined;
}) {
  return mensagem ? (
    <p
      id={id}
      className="colaboradores-screen__form-erro"
      role="alert"
      tabIndex={-1}
    >
      {mensagem}
    </p>
  ) : null;
}

// ---- Dados pessoais ---------------------------------------------------------

const ID_PERFIL: Record<ChavePerfil | "geral", string> = {
  dataNascimento: "ficha-perfil-data-nascimento",
  sexo: "ficha-perfil-sexo",
  saudacao: "ficha-perfil-saudacao",
  estadoCivil: "ficha-perfil-estado-civil",
  nacionalidade: "ficha-perfil-nacionalidade",
  naturalidade: "ficha-perfil-naturalidade",
  escolaridade: "ficha-perfil-escolaridade",
  curso: "ficha-perfil-curso",
  nomePai: "ficha-perfil-nome-pai",
  nomeMae: "ficha-perfil-nome-mae",
  geral: "ficha-perfil-erro-geral",
};
const ORDEM_PERFIL: readonly ChavePerfil[] = [
  "dataNascimento",
  "sexo",
  ...CAMPOS_TEXTO_PERFIL.map((c) => c.chave),
];
const ID_EDITAR_PERFIL = "ficha-perfil-editar";
const ID_SEXO_ANTERIOR = "ficha-perfil-sexo-anterior";
const NOME_PERFIL: NomeDoBloco = {
  sujeito: "os dados pessoais",
  salvo: "foram salvos",
  naoSalvo: "não foram salvos",
  sucesso: "Dados pessoais salvos.",
  semMudanca: "Nada mudou: os dados pessoais já estavam com estes valores.",
};

function BlocoPerfilPessoal(
  props: BlocoProps & { readonly perfil: PerfilPessoalApi | null },
) {
  const { colaboradorId, perfil, onGravado } = props;
  const { valores: inicial, sexoAnterior } = perfilParaEdicao(perfil);
  const edicao = useEdicaoDoBloco<ChavePerfil>({
    colaboradorId,
    inicial,
    atualizadoEm: perfil?.atualizadoEm ?? null,
    validar: validarPerfil,
    corpo: (valores) => ({ perfilPessoal: blocoPerfil(valores) }),
    atualizadoEmDa: (r) => r.perfilPessoal?.atualizadoEm ?? null,
    ordem: ORDEM_PERFIL,
    idDoCampo: (campo) => ID_PERFIL[campo],
    idBotaoEditar: ID_EDITAR_PERFIL,
    nome: NOME_PERFIL,
    onGravado,
  });
  useAvisarPai(edicao.alterado, edicao.salvando, props);
  const { erros, salvando } = edicao;

  return (
    <section
      className="colaboradores-screen__dados-pessoais"
      aria-labelledby="ficha-perfil-titulo"
    >
      <h3
        id="ficha-perfil-titulo"
        className="colaboradores-screen__section-title"
      >
        Dados pessoais
      </h3>
      {!edicao.emEdicao ? (
        <>
          {perfil === null ? (
            <p className="colaboradores-screen__contatos-aviso">
              Nenhum dado pessoal registrado.
            </p>
          ) : (
            <dl className="colaboradores-screen__dados-pessoais-lista">
              <div className="colaboradores-screen__par">
                <dt>{ROTULO_DATA_NASCIMENTO}</dt>
                <dd>{formatarDiaCivil(perfil.dataNascimento)}</dd>
              </div>
              <div className="colaboradores-screen__par">
                <dt>{CAMPO_SEXO.rotulo}</dt>
                <dd>{rotuloDoSexo(perfil.sexo) ?? NAO_INFORMADO}</dd>
              </div>
              {CAMPOS_TEXTO_PERFIL.map((c) => (
                <div key={c.chave} className="colaboradores-screen__par">
                  <dt>{c.rotulo}</dt>
                  <dd>{perfil[c.chave] ?? NAO_INFORMADO}</dd>
                </div>
              ))}
            </dl>
          )}
          <RodapeDaLeitura
            sucesso={edicao.sucesso}
            idBotao={ID_EDITAR_PERFIL}
            rotuloBotao={
              perfil === null
                ? "Preencher dados pessoais"
                : "Editar dados pessoais"
            }
            onEditar={edicao.editar}
          />
        </>
      ) : (
        <form
          className="colaboradores-screen__contatos-form"
          aria-labelledby="ficha-perfil-titulo"
          noValidate
          onSubmit={(e) => void edicao.salvar(e)}
        >
          <FormField
            id={ID_PERFIL.dataNascimento}
            label={ROTULO_DATA_NASCIMENTO}
            required
            disabled={salvando}
            {...(erros.dataNascimento ? { error: erros.dataNascimento } : {})}
          >
            {(control) => (
              <input
                type="date"
                value={edicao.edicao.dataNascimento}
                onChange={(e) =>
                  edicao.alterarCampo("dataNascimento", e.target.value)
                }
                {...control}
              />
            )}
          </FormField>
          <FormField
            id={ID_PERFIL.sexo}
            label={rotuloOpcional(CAMPO_SEXO.rotulo)}
            disabled={salvando}
            {...(erros.sexo ? { error: erros.sexo } : {})}
          >
            {(control) => (
              <>
                <select
                  value={edicao.edicao.sexo}
                  onChange={(e) => edicao.alterarCampo("sexo", e.target.value)}
                  {...control}
                  {...(sexoAnterior !== null
                    ? {
                        "aria-describedby": [
                          control["aria-describedby"],
                          ID_SEXO_ANTERIOR,
                        ]
                          .filter(Boolean)
                          .join(" "),
                      }
                    : {})}
                >
                  <option value="">Selecione…</option>
                  {OPCOES_SEXO.map((opcao) => (
                    <option key={opcao.codigo} value={opcao.codigo}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </select>
                {sexoAnterior !== null ? (
                  // T181 — cadastro anterior à lista fechada: o servidor só
                  // aceita a lista, então salvar substitui o valor anterior.
                  <p id={ID_SEXO_ANTERIOR} className="evolli-field__help">
                    {`Valor gravado anteriormente, fora da lista: "${sexoAnterior}". Escolha uma opção ou deixe sem seleção; ao salvar, ele é substituído.`}
                  </p>
                ) : null}
              </>
            )}
          </FormField>
          {CAMPOS_TEXTO_PERFIL.map((campo) => (
            <FormField
              key={campo.chave}
              id={ID_PERFIL[campo.chave]}
              label={rotuloOpcional(campo.rotulo)}
              disabled={salvando}
              {...(campo.ajuda ? { help: campo.ajuda } : {})}
              {...(erros[campo.chave] ? { error: erros[campo.chave]! } : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={campo.limite}
                  autoComplete="off"
                  placeholder={NAO_INFORMADO}
                  value={edicao.edicao[campo.chave]}
                  onChange={(e) =>
                    edicao.alterarCampo(campo.chave, e.target.value)
                  }
                  {...control}
                />
              )}
            </FormField>
          ))}
          <ErroGeral id={ID_PERFIL.geral} mensagem={erros.geral} />
          <AcoesDaEdicao
            rotuloSalvar="Salvar dados pessoais"
            salvando={salvando}
            onCancelar={edicao.cancelar}
          />
        </form>
      )}
    </section>
  );
}

// ---- Endereço ---------------------------------------------------------------

const ID_ENDERECO: Record<ChaveEndereco | "geral", string> = {
  pais: "ficha-endereco-pais",
  cep: "ficha-endereco-cep",
  logradouro: "ficha-endereco-logradouro",
  numero: "ficha-endereco-numero",
  complemento: "ficha-endereco-complemento",
  bairro: "ficha-endereco-bairro",
  cidade: "ficha-endereco-cidade",
  estado: "ficha-endereco-estado",
  geral: "ficha-endereco-erro-geral",
};
const ORDEM_ENDERECO: readonly ChaveEndereco[] = CAMPOS_ENDERECO.map(
  (c) => c.chave,
);
const ID_EDITAR_ENDERECO = "ficha-endereco-editar";
const ID_BUSCAR_CEP = "ficha-endereco-buscar-cep";
const ID_STATUS_CEP = "ficha-endereco-cep-status";
const NOME_ENDERECO: NomeDoBloco = {
  sujeito: "o endereço",
  salvo: "foi salvo",
  naoSalvo: "não foi salvo",
  sucesso: "Endereço salvo.",
  semMudanca: "Nada mudou: o endereço já estava com estes valores.",
};

/**
 * T181 — sem endereço gravado, o país sugerido sozinho não cria um endereço:
 * é preciso ao menos um campo além dele (a mesma ideia dos contatos, que não
 * criam registro vazio).
 */
function validarEnderecoDaFicha(
  valores: ValoresEndereco,
  semRegistro: boolean,
): ErrosDoBloco<ChaveEndereco> {
  const erros: ErrosDoBloco<ChaveEndereco> = validarEndereco(valores);
  const algumAlemDoPais = ORDEM_ENDERECO.some(
    (c) => c !== "pais" && normalizarTexto(valores[c]) !== "",
  );
  if (semRegistro && !algumAlemDoPais && Object.keys(erros).length === 0) {
    erros.geral =
      "Nenhum endereço preenchido: informe ao menos um campo além do país para salvar.";
  }
  return erros;
}

function BlocoEndereco(
  props: BlocoProps & {
    readonly endereco: EnderecoApi | null;
    readonly consultaCepDisponivel: boolean;
  },
) {
  const { colaboradorId, endereco, consultaCepDisponivel, onGravado } = props;
  /** T179 — contador que limpa os avisos da máscara do CEP. */
  const [limpezaDosAvisos, setLimpezaDosAvisos] = useState(0);
  /** O recomeço da consulta de CEP, ligado depois que ela existe. */
  const reiniciarCepRef = useRef<() => void>(() => undefined);
  const edicao = useEdicaoDoBloco<ChaveEndereco>({
    colaboradorId,
    inicial: enderecoParaEdicao(endereco),
    atualizadoEm: endereco?.atualizadoEm ?? null,
    validar: (valores) => validarEnderecoDaFicha(valores, endereco === null),
    corpo: (valores) => ({ endereco: blocoEndereco(valores) }),
    atualizadoEmDa: (r) => r.endereco?.atualizadoEm ?? null,
    ordem: ORDEM_ENDERECO,
    idDoCampo: (campo) => ID_ENDERECO[campo],
    idBotaoEditar: ID_EDITAR_ENDERECO,
    nome: NOME_ENDERECO,
    onGravado,
    onReinicio: () => {
      setLimpezaDosAvisos((n) => n + 1);
      reiniciarCepRef.current();
    },
  });
  const { erros, salvando, setErros } = edicao;
  const consultaCep = useCepAssistido({
    endereco: edicao.edicao,
    setEndereco: edicao.setEdicao,
    onErroNoCep: (mensagem) => setErros((prev) => ({ ...prev, cep: mensagem })),
    onCamposAjustados: (campos) =>
      setErros((prev) => {
        const restante = { ...prev };
        for (const campo of campos) delete restante[campo];
        return restante;
      }),
    idBotaoBuscar: ID_BUSCAR_CEP,
  });
  reiniciarCepRef.current = consultaCep.reiniciar;
  useAvisarPai(edicao.alterado, edicao.salvando, props);
  // Consulta só para quem o servidor a aceita, e só com país Brasil.
  const cepAssistido = consultaCepDisponivel && consultaCep.assistido;
  const cep = consultaCep.estado;

  function alterar(campo: ChaveEndereco, valor: string) {
    edicao.alterarCampo(campo, valor);
    // T179 — trocar o país muda a regra do CEP: a mensagem dele sai junto.
    if (campo === "pais") {
      setErros((prev) => {
        const restante = { ...prev };
        delete restante.cep;
        return restante;
      });
    }
    // T178 — a mensagem da consulta falava de OUTRO CEP ou país.
    if (campo === "cep" || campo === "pais") consultaCep.descartarResultado();
  }

  function campo(chave: ChaveEndereco, aoSair?: () => void) {
    const definicao = CAMPOS_ENDERECO.find((c) => c.chave === chave)!;
    // T179 — CEP brasileiro tem máscara `00000-000`; outro país, texto livre.
    const cepComMascara = chave === "cep" && ehPaisBrasil(edicao.edicao.pais);
    const ajuda = cepComMascara ? DICA_DE_FORMATO.cep : definicao.ajuda;
    return (
      <FormField
        id={ID_ENDERECO[chave]}
        label={rotuloOpcional(definicao.rotulo)}
        disabled={salvando}
        {...(ajuda ? { help: ajuda } : {})}
        {...(erros[chave] ? { error: erros[chave]! } : {})}
      >
        {(control) =>
          cepComMascara ? (
            <CampoMascarado
              mascara="cep"
              value={edicao.edicao.cep}
              onValorChange={(valor) => alterar("cep", valor)}
              limparAvisos={limpezaDosAvisos}
              placeholder={NAO_INFORMADO}
              onBlur={aoSair}
              {...control}
            />
          ) : (
            <input
              type="text"
              maxLength={definicao.limite}
              autoComplete="off"
              placeholder={NAO_INFORMADO}
              value={edicao.edicao[chave]}
              onChange={(e) => alterar(chave, e.target.value)}
              onBlur={aoSair}
              {...control}
            />
          )
        }
      </FormField>
    );
  }

  return (
    <section
      className="colaboradores-screen__dados-pessoais"
      aria-labelledby="ficha-endereco-titulo"
    >
      <h3
        id="ficha-endereco-titulo"
        className="colaboradores-screen__section-title"
      >
        Endereço
      </h3>
      {!edicao.emEdicao ? (
        <>
          {endereco === null ? (
            <p className="colaboradores-screen__contatos-aviso">
              Nenhum endereço registrado.
            </p>
          ) : (
            <dl className="colaboradores-screen__dados-pessoais-lista">
              {CAMPOS_ENDERECO.map((c) => {
                const valor = endereco[c.chave];
                return (
                  <div key={c.chave} className="colaboradores-screen__par">
                    <dt>{c.rotulo}</dt>
                    <dd>
                      {valor === null
                        ? NAO_INFORMADO
                        : c.chave === "cep"
                          ? // T179 — CEP brasileiro gravado em 8 dígitos e
                            // exibido `00000-000`; outro país, como veio.
                            exibirCep(valor, ehPaisBrasil(endereco.pais))
                          : valor}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          <RodapeDaLeitura
            sucesso={edicao.sucesso}
            idBotao={ID_EDITAR_ENDERECO}
            rotuloBotao={
              endereco === null ? "Preencher endereço" : "Editar endereço"
            }
            onEditar={edicao.editar}
          />
        </>
      ) : (
        <form
          className="colaboradores-screen__contatos-form"
          aria-labelledby="ficha-endereco-titulo"
          noValidate
          onSubmit={(e) => void edicao.salvar(e)}
        >
          {campo("pais")}
          <div className="colaboradores-screen__cep">
            {campo(
              "cep",
              cepAssistido ? () => void consultaCep.buscar("saida") : undefined,
            )}
            {cepAssistido ? (
              <div className="colaboradores-screen__cep-acoes">
                <Button
                  type="button"
                  variant="secondary"
                  id={ID_BUSCAR_CEP}
                  aria-disabled={cep.tipo === "buscando" || salvando}
                  aria-describedby={ID_STATUS_CEP}
                  onClick={() => {
                    if (cep.tipo === "buscando" || salvando) return;
                    void consultaCep.buscar("botao");
                  }}
                >
                  {cep.tipo === "buscando" ? "Buscando CEP…" : "Buscar CEP"}
                </Button>
                {/* A região viva do CEP: anuncia o resultado sem mover o foco.
                    Sempre montada, para que o anúncio saia. */}
                <p
                  id={ID_STATUS_CEP}
                  className="colaboradores-screen__cep-status"
                  role="status"
                >
                  {cep.tipo === "buscando"
                    ? "Buscando CEP…"
                    : cep.tipo === "aviso" || cep.tipo === "sugerido"
                      ? cep.mensagem
                      : ""}
                </p>
                {cep.tipo === "sugerido" && cep.mantidos.length > 0 ? (
                  <Button
                    type="button"
                    variant="subtle"
                    onClick={consultaCep.usarEnderecoDoCep}
                  >
                    Usar endereço do CEP
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          {campo("logradouro")}
          {campo("numero")}
          {campo("complemento")}
          {campo("bairro")}
          {campo("cidade")}
          {campo("estado")}
          <ErroGeral id={ID_ENDERECO.geral} mensagem={erros.geral} />
          <AcoesDaEdicao
            rotuloSalvar="Salvar endereço"
            salvando={salvando}
            onCancelar={edicao.cancelar}
          />
        </form>
      )}
    </section>
  );
}
