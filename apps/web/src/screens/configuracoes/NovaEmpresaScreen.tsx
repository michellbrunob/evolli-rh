/**
 * T209 — Configurações › Empresas › Nova empresa (decisão da proprietária de
 * 2026-11-17), no padrão de cadastro em etapas (`CadastroEmEtapas`):
 *
 * 1. **Dados da empresa** — CNPJ (máscara progressiva, aceita o formato
 *    alfanumérico de 2026, selo "Válido" com os verificadores certos) e razão
 *    social obrigatórios; porte e endereço opcionais, o endereço preenchido
 *    pelo CEP.
 * 2. **Colaboradores** — importar planilha, cadastro individual ou depois.
 *
 * Ao concluir, `POST /v1/empresas/cadastro` cria a empresa (e, para o RH, a
 * concessão). Com importar ou cadastro individual, a tela troca a empresa
 * ativa para a nova (`POST /v1/auth/contexto/empresa`) e pede ao shell a
 * tela seguinte; com "depois", volta a Empresas sem trocar. Nada é guardado
 * no navegador.
 */
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  IconeAdicionarPessoa,
  IconePlanilha,
  IconeRelogio,
  IconeSucesso,
} from "../../ui/icones";
import { Button, CampoMascarado } from "../../components";
import {
  CadastroEmEtapas,
  LinhaDoCadastro,
  SecaoDoCadastro,
} from "../../components/cadastro/CadastroEmEtapas";
import {
  EmpresasApiError,
  cadastrarEmpresa,
  type EmpresaCadastradaApi,
  type PorteDeEmpresa,
} from "../../api/empresasClient";
import {
  trocarEmpresaDoContexto,
  type EmpresaDoContextoApi,
} from "../../api/contextoEmpresarialClient";
import { cnpjValido, mascararCnpj } from "../../format/cnpj";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import { useCepAssistido } from "../pessoas/cepAssistido";
import {
  ENDERECO_INICIAL,
  type ValoresEndereco,
} from "../pessoas/dadosPessoais";
import { UFS, siglaDaUf } from "../pessoas/ufs";
import { baixarArquivo } from "../dashboard/exportacao";
import { gerarModelo } from "../pessoas/importacao/planilhaColaboradores";
import "./NovaEmpresaScreen.css";

export const NOVA_EMPRESA_TITULO_ID = "nova-empresa-titulo";
export const ROTULO_DA_EDICAO_DA_EMPRESA = "Nova empresa";

const ETAPAS = [
  {
    titulo: "Dados da empresa",
    subtitulo: "Identificação e endereço",
    descricao: "Cada CNPJ tem colaboradores e cadastros próprios no Evolli.",
  },
  {
    titulo: "Colaboradores",
    subtitulo: "Como incluir a equipe",
    descricao: "Escolha como incluir as pessoas desta empresa.",
  },
] as const;

export const OPCOES_DE_PORTE: readonly {
  readonly valor: PorteDeEmpresa;
  readonly rotulo: string;
}[] = [
  { valor: "1_10", rotulo: "1-10 colaboradores" },
  { valor: "11_50", rotulo: "11-50 colaboradores" },
  { valor: "51_200", rotulo: "51-200 colaboradores" },
  { valor: "201_500", rotulo: "201-500 colaboradores" },
  { valor: "501_1000", rotulo: "501-1000 colaboradores" },
  { valor: "mais_de_1000", rotulo: "Mais de 1000 colaboradores" },
];

type Opcao = "importar" | "individual" | "depois";

/** A tela seguinte na empresa nova, pedida ao shell. */
export type DestinoDepoisDaEmpresa = "importar-colaboradores" | "nova-admissao";

const ID = {
  cnpj: "nova-empresa-cnpj",
  nome: "nova-empresa-nome",
  porte: "nova-empresa-porte",
  cep: "nova-empresa-cep",
  logradouro: "nova-empresa-logradouro",
  numero: "nova-empresa-numero",
  complemento: "nova-empresa-complemento",
  bairro: "nova-empresa-bairro",
  cidade: "nova-empresa-cidade",
  uf: "nova-empresa-uf",
} as const;

type CampoComErro = "cnpj" | "nome";

export interface NovaEmpresaScreenProps {
  /** Voltar a Empresas (cancelar, ou "Ir para Empresas"). */
  readonly onSair: () => void;
  /** "Incluir depois": criada, sem trocar a empresa ativa. */
  readonly onCriadaSemAbrir: (empresa: EmpresaCadastradaApi) => void;
  /** A empresa ativa já é a nova (o servidor confirmou): a tela seguinte. */
  readonly onEmpresaAberta: (
    empresa: EmpresaDoContextoApi,
    destino: DestinoDepoisDaEmpresa,
  ) => void;
}

export function NovaEmpresaScreen({
  onSair,
  onCriadaSemAbrir,
  onEmpresaAberta,
}: NovaEmpresaScreenProps) {
  const [atual, setAtual] = useState(0);
  const [alcancada, setAlcancada] = useState(0);
  const [cnpj, setCnpj] = useState("");
  const [nome, setNome] = useState("");
  const [porte, setPorte] = useState<PorteDeEmpresa | "">("");
  const [endereco, setEndereco] = useState<ValoresEndereco>(ENDERECO_INICIAL);
  const [opcao, setOpcao] = useState<Opcao>("importar");
  const [erros, setErros] = useState<Partial<Record<CampoComErro, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [falha, setFalha] = useState<string | null>(null);
  /** Criada, mas a troca para ela falhou: não se cria de novo. */
  const [criadaSemTroca, setCriadaSemTroca] =
    useState<EmpresaCadastradaApi | null>(null);
  const focarRef = useRef<CampoComErro | "titulo" | null>(null);
  /**
   * Criada (e, se for o caso, já aberta): a navegação sai DEPOIS de a tela
   * soltar o "salvando" e o "pendente" — senão a guarda de saída a barra.
   */
  const [concluida, setConcluida] = useState<
    | { readonly tipo: "sem-abrir"; readonly empresa: EmpresaCadastradaApi }
    | {
        readonly tipo: "aberta";
        readonly ativa: EmpresaDoContextoApi;
        readonly destino: DestinoDepoisDaEmpresa;
      }
    | null
  >(null);
  const consultarAoCompletarRef = useRef(false);

  const alterado =
    cnpj !== "" ||
    nome.trim() !== "" ||
    porte !== "" ||
    Object.entries(endereco).some(
      ([chave, valor]) => chave !== "pais" && valor.trim() !== "",
    );
  useEdicaoEmAndamento(ROTULO_DA_EDICAO_DA_EMPRESA, {
    pendente: alterado && criadaSemTroca === null && concluida === null,
    salvando: enviando,
  });

  // Declarado depois do registro da edição: roda quando ele já foi solto.
  useEffect(() => {
    if (concluida === null || enviando) return;
    if (concluida.tipo === "sem-abrir") onCriadaSemAbrir(concluida.empresa);
    else onEmpresaAberta(concluida.ativa, concluida.destino);
  }, [concluida, enviando, onCriadaSemAbrir, onEmpresaAberta]);

  const consultaCep = useCepAssistido({
    endereco,
    setEndereco: (acao) =>
      setEndereco((prev) => {
        const proximo = typeof acao === "function" ? acao(prev) : acao;
        return { ...proximo, estado: siglaDaUf(proximo.estado) };
      }),
    onErroNoCep: () => {},
    onCamposAjustados: () => {},
    idBotaoBuscar: ID.cep,
  });
  const cep = consultaCep.estado;
  const buscarCep = consultaCep.buscar;

  useEffect(() => {
    if (!consultarAoCompletarRef.current) return;
    consultarAoCompletarRef.current = false;
    void buscarCep("botao");
  }, [endereco.cep, buscarCep]);

  // Foco depois do desenho: no campo com erro, ou no título da etapa nova.
  useEffect(() => {
    const alvo = focarRef.current;
    if (alvo === null) return;
    focarRef.current = null;
    if (alvo === "titulo") {
      document
        .querySelector<HTMLElement>(".cadastro-etapas__etapa-titulo")
        ?.focus();
    } else {
      document.getElementById(ID[alvo])?.focus();
    }
  });

  function atualizarEndereco(campo: keyof ValoresEndereco, valor: string) {
    setEndereco((prev) => ({ ...prev, [campo]: valor }));
    if (campo === "cep") consultaCep.descartarResultado();
  }

  const nomeLimpo = nome.trim().replace(/\s+/g, " ");
  const cnpjOk = cnpjValido(cnpj);

  function validarEtapa1(): boolean {
    const novos: Partial<Record<CampoComErro, string>> = {};
    if (cnpj.trim() === "") novos.cnpj = "CNPJ é obrigatório";
    else if (!cnpjOk) novos.cnpj = "CNPJ inválido. Confira os números.";
    if (nomeLimpo === "") novos.nome = "Informe o nome da empresa";
    setErros(novos);
    const primeiro = (["cnpj", "nome"] as const).find((c) => novos[c]);
    if (primeiro) {
      focarRef.current = primeiro;
      return false;
    }
    return true;
  }

  function irPara(indice: number) {
    if (enviando) return;
    setAtual(indice);
    setFalha(null);
    focarRef.current = "titulo";
  }

  function montarDto() {
    const e = endereco;
    const enderecoDto = Object.fromEntries(
      (
        [
          ["cep", e.cep.replace(/\D/g, "")],
          ["logradouro", e.logradouro.trim()],
          ["numero", e.numero.trim()],
          ["complemento", e.complemento.trim()],
          ["bairro", e.bairro.trim()],
          ["cidade", e.cidade.trim()],
          ["uf", siglaDaUf(e.estado)],
        ] as const
      ).filter(([, v]) => v !== ""),
    );
    return {
      cnpj: cnpj.replace(/[^0-9A-Za-z]/g, "").toUpperCase(),
      nome: nomeLimpo,
      ...(porte ? { porte } : {}),
      ...(Object.keys(enderecoDto).length > 0 ? { endereco: enderecoDto } : {}),
    };
  }

  async function abrirNaEmpresaNova(empresa: EmpresaCadastradaApi) {
    const destino: DestinoDepoisDaEmpresa =
      opcao === "importar" ? "importar-colaboradores" : "nova-admissao";
    try {
      const ativa = await trocarEmpresaDoContexto(empresa.id);
      setConcluida({ tipo: "aberta", ativa, destino });
    } catch {
      setCriadaSemTroca(empresa);
    }
  }

  async function concluir() {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setFalha(null);
    try {
      const empresa = await cadastrarEmpresa(montarDto());
      if (opcao === "depois") {
        setConcluida({ tipo: "sem-abrir", empresa });
        return;
      }
      await abrirNaEmpresaNova(empresa);
    } catch (erro) {
      const doCnpj =
        erro instanceof EmpresasApiError
          ? erro.erros.find((e) => e.campo === "cnpj")
          : undefined;
      if (doCnpj) {
        setErros({
          cnpj:
            doCnpj.motivo === "em_uso"
              ? "Este CNPJ já está cadastrado."
              : "CNPJ inválido. Confira os números.",
        });
        setAtual(0);
        focarRef.current = "cnpj";
      } else {
        setFalha("Não foi possível criar a empresa agora. Tente de novo.");
      }
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || criadaSemTroca || concluida) return;
    if (atual === 0) {
      if (!validarEtapa1()) return;
      setAlcancada((a) => Math.max(a, 1));
      irPara(1);
      return;
    }
    void concluir();
  }

  const erroDe = (campo: CampoComErro) =>
    erros[campo] ? (
      <p id={`${ID[campo]}-erro`} className="cadastro-etapas__linha-erro">
        {erros[campo]}
      </p>
    ) : null;
  const propsDe = (campo: CampoComErro, extra: string[] = []) => {
    const descritos = [...extra, erros[campo] ? `${ID[campo]}-erro` : null]
      .filter(Boolean)
      .join(" ");
    return {
      id: ID[campo],
      "aria-invalid": erros[campo] ? ("true" as const) : undefined,
      "aria-describedby": descritos || undefined,
    };
  };

  const mensagem: ReactNode = criadaSemTroca ? (
    <div className="nova-empresa__aviso" role="alert">
      <p>
        A empresa {criadaSemTroca.nome} foi criada, mas não foi possível abri-la
        agora. Troque para ela pelo seletor de empresa.
      </p>
      <Button type="button" variant="secondary" onClick={onSair}>
        Ir para Empresas
      </Button>
    </div>
  ) : falha ? (
    <p className="nova-empresa__falha" role="alert">
      {falha}
    </p>
  ) : null;

  return (
    <CadastroEmEtapas
      tituloId={NOVA_EMPRESA_TITULO_ID}
      titulo="Nova empresa"
      descricao="Duas etapas: os dados do CNPJ e, se quiser, a equipe."
      rotuloVoltar="Voltar para Empresas"
      onVoltarDaPagina={onSair}
      etapas={ETAPAS}
      atual={atual}
      alcancada={alcancada}
      onIrParaEtapa={irPara}
      onSubmit={aoEnviar}
      rotuloConcluir={
        opcao === "importar" ? "Criar e importar" : "Criar empresa"
      }
      ocupado={enviando}
      mensagem={mensagem}
      {...(atual === 1 && nomeLimpo
        ? { tituloDaEtapa: `Colaboradores da ${nomeLimpo}` }
        : {})}
    >
      {atual === 0 ? (
        <>
          <SecaoDoCadastro
            titulo="Identificação"
            descricao="Como a empresa aparece no seletor e nos cadastros."
          >
            <LinhaDoCadastro rotulo="CNPJ" paraId={ID.cnpj}>
              <div className="nova-empresa__cnpj">
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                  aria-required="true"
                  value={cnpj}
                  onChange={(e) => {
                    setCnpj(mascararCnpj(e.target.value));
                    setErros(({ cnpj: _cnpj, ...resto }) => resto);
                  }}
                  {...propsDe(
                    "cnpj",
                    cnpjOk && !erros.cnpj ? ["nova-empresa-cnpj-valido"] : [],
                  )}
                />
                {/* Com recusa do servidor (já cadastrado), o selo sai: os dois
                    juntos se contradiriam. */}
                {cnpjOk && !erros.cnpj ? (
                  <span
                    id="nova-empresa-cnpj-valido"
                    className="nova-empresa__selo-valido"
                  >
                    <span aria-hidden="true">Válido</span>
                    <span className="cadastro-etapas__so-leitor">
                      CNPJ válido
                    </span>
                  </span>
                ) : null}
              </div>
              {erroDe("cnpj")}
            </LinhaDoCadastro>
            <LinhaDoCadastro
              rotulo="Razão social ou nome"
              ajuda="O nome mostrado no seletor de empresas."
              paraId={ID.nome}
            >
              <input
                type="text"
                autoComplete="off"
                maxLength={160}
                aria-required="true"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  setErros(({ nome: _nome, ...resto }) => resto);
                }}
                {...propsDe("nome")}
              />
              {erroDe("nome")}
            </LinhaDoCadastro>
            <LinhaDoCadastro
              rotulo="Porte"
              ajuda="Faixa de pessoas que trabalham aqui."
              paraId={ID.porte}
            >
              <select
                id={ID.porte}
                value={porte}
                onChange={(e) =>
                  setPorte(e.target.value as PorteDeEmpresa | "")
                }
              >
                <option value="">Selecione</option>
                {OPCOES_DE_PORTE.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </LinhaDoCadastro>
          </SecaoDoCadastro>

          <SecaoDoCadastro
            titulo="Endereço"
            descricao="O CEP completa o endereço; revise número e complemento."
          >
            <LinhaDoCadastro rotulo="CEP" paraId={ID.cep}>
              <div className="cadastro-etapas__campo-cep">
                <CampoMascarado
                  id={ID.cep}
                  mascara="cep"
                  placeholder="00000-000"
                  value={endereco.cep}
                  onValorChange={(valor) => {
                    atualizarEndereco("cep", valor);
                    if (/^\d{8}$/.test(valor.replace(/\D/g, ""))) {
                      consultarAoCompletarRef.current = true;
                    }
                  }}
                  onBlur={() => void buscarCep("saida")}
                />
              </div>
              <p
                className={
                  cep.tipo === "sugerido" && cep.encontrado
                    ? "cadastro-etapas__cep-status cadastro-etapas__cep-status--encontrado"
                    : "cadastro-etapas__cep-status"
                }
                role="status"
              >
                {cep.tipo === "buscando" ? (
                  "Buscando endereço…"
                ) : cep.tipo === "sugerido" && cep.encontrado ? (
                  <>
                    <IconeSucesso tamanho={14} />
                    Endereço localizado pelo CEP
                  </>
                ) : cep.tipo === "aviso" || cep.tipo === "sugerido" ? (
                  cep.mensagem
                ) : (
                  ""
                )}
              </p>
            </LinhaDoCadastro>
            <LinhaDoCadastro rotulo="Logradouro e número">
              <div className="cadastro-etapas__linha-par cadastro-etapas__linha-par--larga-estreita">
                <input
                  id={ID.logradouro}
                  type="text"
                  maxLength={200}
                  autoComplete="off"
                  placeholder="Rua, avenida…"
                  aria-label="Logradouro"
                  value={endereco.logradouro}
                  onChange={(e) =>
                    atualizarEndereco("logradouro", e.target.value)
                  }
                />
                <input
                  id={ID.numero}
                  type="text"
                  maxLength={20}
                  autoComplete="off"
                  placeholder="Número"
                  aria-label="Número"
                  value={endereco.numero}
                  onChange={(e) => atualizarEndereco("numero", e.target.value)}
                />
              </div>
            </LinhaDoCadastro>
            <LinhaDoCadastro rotulo="Complemento e bairro">
              <div className="cadastro-etapas__linha-par">
                <input
                  id={ID.complemento}
                  type="text"
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Complemento (opcional)"
                  aria-label="Complemento"
                  value={endereco.complemento}
                  onChange={(e) =>
                    atualizarEndereco("complemento", e.target.value)
                  }
                />
                <input
                  id={ID.bairro}
                  type="text"
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Bairro"
                  aria-label="Bairro"
                  value={endereco.bairro}
                  onChange={(e) => atualizarEndereco("bairro", e.target.value)}
                />
              </div>
            </LinhaDoCadastro>
            <LinhaDoCadastro rotulo="Cidade e UF">
              <div className="cadastro-etapas__linha-par cadastro-etapas__linha-par--larga-estreita">
                <input
                  id={ID.cidade}
                  type="text"
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Cidade"
                  aria-label="Cidade"
                  value={endereco.cidade}
                  onChange={(e) => atualizarEndereco("cidade", e.target.value)}
                />
                <select
                  id={ID.uf}
                  aria-label="UF"
                  value={siglaDaUf(endereco.estado)}
                  onChange={(e) => atualizarEndereco("estado", e.target.value)}
                >
                  <option value="">UF</option>
                  {UFS.map((uf) => (
                    <option key={uf.sigla} value={uf.sigla}>
                      {uf.sigla}
                    </option>
                  ))}
                </select>
              </div>
            </LinhaDoCadastro>
          </SecaoDoCadastro>
        </>
      ) : (
        <EtapaColaboradores cnpj={cnpj} opcao={opcao} onOpcao={setOpcao} />
      )}
    </CadastroEmEtapas>
  );
}

const OPCOES: readonly {
  readonly valor: Opcao;
  readonly titulo: string;
  readonly descricao: string;
  readonly selo?: string;
  readonly icone: ReactNode;
}[] = [
  {
    valor: "importar",
    titulo: "Importar planilha",
    descricao: "Várias pessoas de uma vez, pelo modelo CSV.",
    selo: "Para equipes maiores",
    icone: <IconePlanilha tamanho={20} />,
  },
  {
    valor: "individual",
    titulo: "Cadastro individual",
    descricao: "Uma pessoa por vez, logo depois de criar a empresa.",
    selo: "Para poucas pessoas",
    icone: <IconeAdicionarPessoa tamanho={20} />,
  },
  {
    valor: "depois",
    titulo: "Incluir depois",
    descricao: "Cria a empresa sem pessoas; inclua depois em Colaboradores.",
    icone: <IconeRelogio tamanho={20} />,
  },
];

function EtapaColaboradores({
  cnpj,
  opcao,
  onOpcao,
}: {
  readonly cnpj: string;
  readonly opcao: Opcao;
  readonly onOpcao: (opcao: Opcao) => void;
}) {
  return (
    <SecaoDoCadastro
      titulo="Como incluir a equipe?"
      descricao={`As pessoas ficarão no CNPJ ${cnpj}.`}
    >
      <div
        className="nova-empresa__opcoes"
        role="radiogroup"
        aria-label="Como incluir a equipe?"
      >
        {OPCOES.map((o) => {
          const marcada = o.valor === opcao;
          return (
            <div
              key={o.valor}
              className={
                marcada
                  ? "nova-empresa__opcao nova-empresa__opcao--marcada"
                  : "nova-empresa__opcao"
              }
            >
              <label className="nova-empresa__opcao-cabeca">
                <span className="nova-empresa__opcao-icone">{o.icone}</span>
                <span className="nova-empresa__opcao-textos">
                  <span className="nova-empresa__opcao-titulo">{o.titulo}</span>
                  <span className="nova-empresa__opcao-descricao">
                    {o.descricao}
                  </span>
                  {o.selo ? (
                    <span className="nova-empresa__opcao-selo">{o.selo}</span>
                  ) : null}
                </span>
                <input
                  type="radio"
                  name="nova-empresa-opcao"
                  className="nova-empresa__opcao-radio"
                  value={o.valor}
                  checked={marcada}
                  onChange={() => onOpcao(o.valor)}
                />
              </label>
              {marcada && o.valor === "importar" ? (
                <ol className="nova-empresa__passos">
                  <li>
                    <span className="nova-empresa__passo-titulo">
                      Baixe o modelo
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        baixarArquivo(
                          gerarModelo(),
                          "modelo-importacao-colaboradores.csv",
                        )
                      }
                    >
                      Baixar modelo (.csv)
                    </Button>
                  </li>
                  <li>
                    <span className="nova-empresa__passo-titulo">
                      Preencha uma linha por pessoa
                    </span>
                    <span className="nova-empresa__passo-texto">
                      Use as colunas do modelo, sem mudar a ordem.
                    </span>
                  </li>
                  <li>
                    <span className="nova-empresa__passo-titulo">
                      Envie o arquivo na tela seguinte
                    </span>
                    <span className="nova-empresa__passo-texto">
                      Depois de criar a empresa, você escolhe o arquivo e
                      confere linha a linha antes de importar.
                    </span>
                  </li>
                </ol>
              ) : null}
            </div>
          );
        })}
      </div>
    </SecaoDoCadastro>
  );
}
