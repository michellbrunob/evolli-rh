/**
 * Nova admissão (T176; Módulo 1 do cadastro na T177) — a admissão em página
 * própria, fora de modal.
 *
 * ## Blocos
 *
 * Empresa (só leitura) · Dados pessoais · Endereço · Contatos · Vínculo ·
 * Lotação inicial. Dados pessoais, endereço e contatos são o **Módulo 1** do
 * cadastro modular (T177), gravados de verdade na MESMA transação da admissão:
 * falhou qualquer parte, nada fica.
 *
 * ## O que a página preserva do contrato
 *
 * - **Admissão atômica.** Uma chamada cria colaborador, vínculo `previsto`,
 *   ato de admissão, perfil, endereço e contatos (Baseline V1, decisão 15).
 * - **Empresa só da sessão.** A empresa é a única que `GET /v1/empresas`
 *   devolve para a sessão. Nenhuma, ou mais de uma, é estado que a página não
 *   sabe resolver, e então ela não envia.
 * - **Contatos com uma só fonte.** E-mail pessoal, celular e telefone são os
 *   da ficha da T169: obrigatórios, juntos, e lidos depois pela rota própria.
 * - **Servidor como fonte.** A confirmação mostra o que o servidor gravou.
 *
 * ## Obrigatoriedade, campo a campo
 *
 * OBRIGATÓRIOS (asterisco e "obrigatório" para leitor de tela): nome
 * completo, data de nascimento, e-mail pessoal, celular e telefone — e, do
 * vínculo, matrícula, tipo, data de admissão e lotação inicial. OPCIONAIS
 * (rótulo com "opcional"): os demais dados pessoais e todo o endereço. É o
 * mesmo contrato que o servidor exige.
 *
 * ## O que ela não faz
 *
 * Não coleta nome social, gênero, raça/etnia, foto, deficiência, contato de
 * emergência, documentos, CPF, dados bancários, dependentes nem dados
 * contratuais avançados — cada um tem destino na matriz de cobertura da T177.
 * Não inventa lista de opções: sexo, estado civil, escolaridade, país, cidade
 * e estado são texto validado.
 *
 * T178 — o CEP brasileiro pode SUGERIR logradouro, bairro, cidade e estado
 * (consulta autorizada pela proprietária, feita pelo servidor em
 * `GET /v1/cep/:cep`). É assistência, não fonte: preenche só campo vazio,
 * nunca toca número nem complemento, tudo continua editável, e falha da
 * consulta não impede o cadastro manual nem o envio.
 *
 * ## Única porta da admissão
 *
 * O formulário transitório em modal da tela de Colaboradores (T176) foi
 * aposentado na T177: não coletava os campos obrigatórios. "Novo colaborador"
 * traz para esta página.
 */
import { useEffect, useRef, useState } from "react";
import {
  Button,
  FormActions,
  FormField,
  Modal,
  PageHeader,
  StatusBadge,
  Surface,
  TrilhaNavegacao,
} from "../../components";
import { destinoPorId, tituloDoGrupoDe } from "../../app/mapaNavegacao";
import {
  ApiError,
  type AdmissaoRegistradaApi,
  type AdmitirColaboradorDto,
  type ColaboradorApi,
  type TipoVinculo,
  admitirColaborador,
} from "../../api/colaboradoresClient";
import {
  type AreaApi,
  type CentroCustoApi,
  type DepartamentoApi,
  type EmpresaApi,
  type EquipeApi,
  type UnidadeOrganizacionalApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { type CargoApi, listarCargos } from "../../api/cargoClient";
import { type EnderecoDoCepApi, consultarCep } from "../../api/cepClient";
import { formatarDiaCivil } from "../../format/data";
import {
  CAMPOS_ENDERECO,
  CAMPOS_TEXTO_PERFIL,
  type ChaveEndereco,
  type ChavePerfil,
  ENDERECO_INICIAL,
  PERFIL_VAZIO,
  ROTULO_DATA_NASCIMENTO,
  type ValoresEndereco,
  type ValoresPerfil,
  blocoEndereco,
  blocoPerfil,
  validarEndereco,
  validarPerfil,
} from "./dadosPessoais";
import {
  type CampoContato,
  type ValoresContatos,
  normalizarContatos,
  validarContatos,
} from "./contatosColaborador";
import "./NovaAdmissaoScreen.css";

export const NOVA_ADMISSAO_TITULO_ID = "nova-admissao-titulo";

/** Mesmo padrão de `MATRICULA_PATTERN` do contrato (`pessoas.dto.ts`). */
const MATRICULA_PATTERN = /^[A-Z0-9_-]{2,32}$/;

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

const ROTULO_SITUACAO_VINCULO: Record<string, string> = {
  previsto: "Previsto",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

const ROTULO_STATUS_ADMISSAO: Record<string, string> = {
  solicitada: "Registrada, aguardando efetivação",
  programada: "Programada para a data de admissão",
};

type TipoDestino =
  "" | "unidade" | "departamento" | "area" | "equipe" | "cargo" | "centroCusto";

const OPCOES_TIPO_DESTINO: {
  valor: Exclude<TipoDestino, "">;
  rotulo: string;
}[] = [
  { valor: "unidade", rotulo: "Unidade organizacional" },
  { valor: "departamento", rotulo: "Departamento" },
  { valor: "area", rotulo: "Área" },
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "cargo", rotulo: "Cargo" },
  { valor: "centroCusto", rotulo: "Centro de custo" },
];

/** Rótulo de campo opcional: o "opcional" é parte do nome acessível. */
function rotuloOpcional(rotulo: string): string {
  return `${rotulo} (opcional)`;
}

// ---------------------------------------------------------------------------
// T178 — preenchimento ASSISTIDO do endereço pelo CEP (autorizado pela
// proprietária: só CEP brasileiro, campos editáveis, cadastro manual como
// alternativa). A consulta é do servidor (`GET /v1/cep/:cep`); aqui só se
// decide QUANDO perguntar e o que fazer com a resposta.
// ---------------------------------------------------------------------------

const ID_BOTAO_BUSCAR_CEP = "nova-admissao-buscar-cep";

/** Campos que a consulta sugere. Número e complemento nunca são tocados. */
const CAMPOS_DO_CEP = ["logradouro", "bairro", "cidade", "estado"] as const;
type CampoDoCep = (typeof CAMPOS_DO_CEP)[number];

/** Só dígitos do CEP: sem hífen, espaço nem ponto. O campo não é reescrito. */
function digitosDoCep(cep: string): string {
  return cep.trim().replace(/[\s.-]/g, "");
}

/** Texto comparável: sem acento, sem diferença de caixa e sem espaços extras. */
function textoComparavel(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** O país é o Brasil? A consulta só existe para CEP brasileiro. */
function ehBrasil(pais: string): boolean {
  return textoComparavel(pais).replace(/ /g, "") === "brasil";
}

/**
 * Mensagem da recusa. Nenhuma bloqueia: o cadastro manual segue. O status é
 * lido por forma (`status` numérico), e não por `instanceof`, para valer
 * também com o cliente automockado nos testes.
 */
function mensagemDoErroDeCep(erro: unknown): string {
  const status =
    typeof erro === "object" &&
    erro !== null &&
    typeof (erro as { status?: unknown }).status === "number"
      ? (erro as { status: number }).status
      : null;
  switch (status) {
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
  const rotulos = chaves.map(
    (c) => CAMPOS_ENDERECO.find((d) => d.chave === c)?.rotulo ?? c,
  );
  return rotulos.length <= 1
    ? (rotulos[0] ?? "")
    : `${rotulos.slice(0, -1).join(", ")} e ${rotulos[rotulos.length - 1]}`;
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
type EstadoCep =
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

function rotuloTipoDestino(tipo: TipoDestino): string {
  return (
    OPCOES_TIPO_DESTINO.find((o) => o.valor === tipo)?.rotulo ?? "Registro"
  );
}

type CampoErro =
  | "nome"
  | ChavePerfil
  | ChaveEndereco
  | CampoContato
  | "matricula"
  | "tipo"
  | "dataAdmissao"
  | "tipoDestino"
  | "departamentoArea"
  | "destino"
  | "geral";

type Erros = Partial<Record<CampoErro, string>>;

/**
 * Ordem visual dos campos: o foco vai ao primeiro desta lista com erro.
 *
 * T178 — o e-mail pessoal passou a ser exibido em Dados pessoais, ao lado do
 * nome (disposição pedida pela proprietária). É o MESMO campo dos contatos da
 * T169 — mesmo estado, mesma validação, e vai em `contatos.emailPessoal` no
 * corpo —, por isso só a posição nesta lista mudou: ela acompanha a tela.
 */
const ORDEM_DOS_ERROS: readonly CampoErro[] = [
  "nome",
  "emailPessoal",
  "dataNascimento",
  ...CAMPOS_TEXTO_PERFIL.map((c) => c.chave),
  ...CAMPOS_ENDERECO.map((c) => c.chave),
  "celular",
  "telefone",
  "matricula",
  "tipo",
  "dataAdmissao",
  "tipoDestino",
  "departamentoArea",
  "destino",
  "geral",
];

const ERRO_GERAL_ID = "nova-admissao-erro-geral";

/** `nomeMae` -> `nova-admissao-nome-mae`. */
function idDoCampo(campo: CampoErro): string {
  const especiais: Partial<Record<CampoErro, string>> = {
    tipo: "nova-admissao-tipo-vinculo",
    geral: ERRO_GERAL_ID,
  };
  return (
    especiais[campo] ??
    `nova-admissao-${campo.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}`
  );
}

const ID_DO_CAMPO = Object.fromEntries(
  ORDEM_DOS_ERROS.map((campo) => [campo, idDoCampo(campo)]),
) as Record<CampoErro, string>;

const MENSAGEM_EMPRESA_INDEFINIDA =
  "Não foi possível confirmar a empresa ativa em que você está trabalhando. Nada será enviado. Volte para Colaboradores e abra esta página de novo.";

/** Limpa o erro do campo em correção e preserva os demais, inclusive `geral`. */
function semErroDe(erros: Erros, ...campos: CampoErro[]): Erros {
  const restante: Erros = { ...erros };
  for (const campo of campos) delete restante[campo];
  return restante;
}

/**
 * Traduz a recusa do servidor para o campo que a causou. O servidor responde
 * com mensagem fixa por status, sem dizer o campo; o mapeamento vale só para
 * `POST /v1/colaboradores` e é o mesmo do formulário da T167:
 *
 *  - 409 — a única unicidade que a admissão pode violar é a da matrícula
 *    dentro da empresa;
 *  - 422 — referência organizacional incoerente, de outra empresa ou inativa;
 *  - 404 — a empresa enviada deixou de ser a empresa ativa da sessão.
 *
 * Em todos os casos os dados digitados ficam na página.
 */
function errosDaRecusa(erro: unknown, temDestino: boolean): Erros {
  const status = erro instanceof ApiError ? erro.status : null;
  switch (status) {
    case 409:
      return {
        matricula:
          "Esta matrícula já está em uso nesta empresa. Informe outra.",
      };
    case 422:
      return temDestino
        ? {
            destino:
              "A referência organizacional escolhida não foi aceita: ela pode ter sido inativada ou não pertencer à empresa ativa. Escolha outra.",
          }
        : {
            geral:
              "O servidor recusou a referência organizacional. Revise a lotação inicial e tente de novo.",
          };
    case 404:
      return {
        geral:
          "A empresa ativa mudou desde que esta página foi aberta. Nada foi salvo. Volte para Colaboradores e abra a página de novo para admitir na empresa atual.",
      };
    case 403:
      return {
        geral:
          "Seu perfil não tem permissão para admitir colaboradores. Nada foi salvo.",
      };
    case 401:
      return {
        geral:
          "Seu acesso expirou. Nada foi salvo. Entre novamente para concluir a admissão.",
      };
    case 400:
      return {
        geral:
          "O servidor recusou algum dos dados informados. Revise os campos e tente de novo.",
      };
    default:
      return {
        geral:
          "Não foi possível admitir o colaborador agora. Os dados digitados foram mantidos; tente de novo.",
      };
  }
}

interface Opcoes {
  empresas: EmpresaApi[];
  departamentos: DepartamentoApi[];
  unidades: UnidadeOrganizacionalApi[];
  equipes: EquipeApi[];
  cargos: CargoApi[];
  centrosCusto: CentroCustoApi[];
}

const OPCOES_VAZIAS: Opcoes = {
  empresas: [],
  departamentos: [],
  unidades: [],
  equipes: [],
  cargos: [],
  centrosCusto: [],
};

interface Campos {
  nome: string;
  matricula: string;
  tipo: TipoVinculo | "";
  dataAdmissao: string;
  tipoDestino: TipoDestino;
  destinoId: string;
  departamentoIdArea: string;
}

const CONTATOS_VAZIOS: ValoresContatos = {
  emailPessoal: "",
  celular: "",
  telefone: "",
};

const CAMPOS_VAZIOS: Campos = {
  nome: "",
  matricula: "",
  tipo: "",
  dataAdmissao: "",
  tipoDestino: "",
  destinoId: "",
  departamentoIdArea: "",
};

/** Para onde levar quem acabou de admitir. */
export type FocoDoAdmitido = "ficha" | "contatos";

export interface NovaAdmissaoScreenProps {
  /** Sair da página sem admitir (depois da confirmação de descarte, se houver). */
  readonly onSair: () => void;
  /**
   * Abrir o colaborador que o SERVIDOR acabou de criar — a ficha, ou a ficha
   * já na seção de contatos aprovados (T169).
   */
  readonly onAbrirAdmitido: (
    colaborador: ColaboradorApi,
    foco: FocoDoAdmitido,
  ) => void;
}

export function NovaAdmissaoScreen({
  onSair,
  onAbrirAdmitido,
}: NovaAdmissaoScreenProps) {
  const [opcoes, setOpcoes] = useState<Opcoes>(OPCOES_VAZIAS);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true);
  const [areas, setAreas] = useState<AreaApi[]>([]);
  const [carregandoAreas, setCarregandoAreas] = useState(false);
  const [campos, setCampos] = useState<Campos>(CAMPOS_VAZIOS);
  // T177 — Módulo 1. País começa sugerido como Brasil, e é editável.
  const [perfil, setPerfil] = useState<ValoresPerfil>(PERFIL_VAZIO);
  const [endereco, setEndereco] = useState<ValoresEndereco>(ENDERECO_INICIAL);
  const [contatos, setContatos] = useState<ValoresContatos>(CONTATOS_VAZIOS);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [admissao, setAdmissao] = useState<AdmissaoRegistradaApi | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  /** Trava síncrona contra envio duplicado (cliques no mesmo quadro). */
  const enviandoRef = useRef(false);
  /** Gatilho de uma vez só: focar o primeiro erro depois que ele existe. */
  const focarPrimeiroErroRef = useRef(false);
  const sucessoTituloRef = useRef<HTMLHeadingElement | null>(null);

  const empresa = opcoes.empresas.length === 1 ? opcoes.empresas[0] : undefined;

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const [empresas, departamentos, unidades, equipes, cargos, centros] =
          await Promise.all([
            listarEmpresasMulti(),
            listarDepartamentos({ status: "ativo", tamanhoPagina: 100 }),
            listarUnidades({ status: "ativo", tamanhoPagina: 100 }),
            listarEquipes({ status: "ativo", tamanhoPagina: 100 }),
            listarCargos({ status: "ativo", tamanhoPagina: 100 }),
            listarCentrosCusto({ status: "ativo", tamanhoPagina: 100 }),
          ]);
        if (!vigente) return;
        setOpcoes({
          empresas: empresas.itens,
          departamentos: departamentos.itens,
          unidades: unidades.itens,
          equipes: equipes.itens,
          cargos: cargos.itens,
          centrosCusto: centros.itens,
        });
        if (empresas.itens.length !== 1) {
          setErros({ geral: MENSAGEM_EMPRESA_INDEFINIDA });
        }
      } catch {
        if (!vigente) return;
        setErros({
          geral:
            "Não foi possível carregar a empresa ativa e as opções de lotação. Volte para Colaboradores e tente novamente.",
        });
      } finally {
        if (vigente) setCarregandoOpcoes(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!focarPrimeiroErroRef.current) return;
    focarPrimeiroErroRef.current = false;
    const campo = ORDEM_DOS_ERROS.find((c) => erros[c]);
    if (campo) document.getElementById(ID_DO_CAMPO[campo])?.focus();
  }, [erros]);

  useEffect(() => {
    if (admissao) sucessoTituloRef.current?.focus();
  }, [admissao]);

  const alterado =
    campos.nome !== "" ||
    campos.matricula !== "" ||
    campos.tipo !== "" ||
    campos.dataAdmissao !== "" ||
    campos.tipoDestino !== "" ||
    campos.destinoId !== "" ||
    (Object.keys(perfil) as ChavePerfil[]).some(
      (c) => perfil[c] !== PERFIL_VAZIO[c],
    ) ||
    (Object.keys(endereco) as ChaveEndereco[]).some(
      (c) => endereco[c] !== ENDERECO_INICIAL[c],
    ) ||
    (Object.keys(contatos) as CampoContato[]).some((c) => contatos[c] !== "");

  function atualizarPerfil(campo: ChavePerfil, valor: string) {
    setPerfil((prev) => ({ ...prev, [campo]: valor }));
    setErros((prev) => semErroDe(prev, campo));
  }

  function atualizarEndereco(campo: ChaveEndereco, valor: string) {
    setEndereco((prev) => ({ ...prev, [campo]: valor }));
    setErros((prev) => semErroDe(prev, campo));
    // T178 — mudar o CEP ou o país tira de cena o que a consulta anterior
    // disse: a mensagem falava de OUTRO CEP. Uma resposta ainda em voo é
    // descartada ao chegar (ver `respostaVigente`).
    if (campo === "cep" || campo === "pais") setCep({ tipo: "ocioso" });
  }

  // ---- T178 — consulta assistida de CEP -----------------------------------
  const [cep, setCep] = useState<EstadoCep>({ tipo: "ocioso" });
  /** O endereço mais recente, para decidir fora do ciclo de render. */
  const enderecoRef = useRef(endereco);
  enderecoRef.current = endereco;
  /** Último CEP (8 dígitos) já perguntado: sair do campo não repergunta. */
  const ultimoCepConsultadoRef = useRef<string | null>(null);
  /** CEP em voo: trava síncrona contra duplo clique e saída + clique. */
  const cepEmVooRef = useRef<string | null>(null);
  /** Sequência do pedido, contra resposta obsoleta. */
  const pedidoCepRef = useRef(0);
  const cepAssistido = ehBrasil(endereco.pais);

  /** A resposta ainda vale: é a do último pedido, para o CEP e país atuais. */
  function respostaVigente(pedido: number, digitos: string): boolean {
    const atual = enderecoRef.current;
    return (
      pedido === pedidoCepRef.current &&
      digitosDoCep(atual.cep) === digitos &&
      ehBrasil(atual.pais)
    );
  }

  /**
   * Consulta o CEP. Só por ação: o botão, ou SAIR do campo com o CEP completo
   * e diferente do último perguntado — nunca a cada tecla, porque a consulta
   * é limitada no servidor e cada tecla gastaria uma.
   */
  async function buscarCep(origem: "botao" | "saida") {
    const atual = enderecoRef.current;
    if (!ehBrasil(atual.pais)) return;
    const digitos = digitosDoCep(atual.cep);
    if (!/^\d{8}$/.test(digitos)) {
      // Na saída do campo, CEP incompleto é só um CEP ainda sendo digitado.
      if (origem === "botao") {
        setErros((prev) => ({ ...prev, cep: "Informe os 8 dígitos do CEP." }));
      }
      return;
    }
    if (cepEmVooRef.current === digitos) return;
    if (origem === "saida" && digitos === ultimoCepConsultadoRef.current) {
      return;
    }
    cepEmVooRef.current = digitos;
    ultimoCepConsultadoRef.current = digitos;
    const pedido = ++pedidoCepRef.current;
    setCep({ tipo: "buscando" });
    try {
      const resposta = await consultarCep(digitos);
      if (!respostaVigente(pedido, digitos)) return;
      aplicarSugestaoDoCep(resposta);
    } catch (erro: unknown) {
      if (!respostaVigente(pedido, digitos)) return;
      setCep({ tipo: "aviso", mensagem: mensagemDoErroDeCep(erro) });
    } finally {
      if (cepEmVooRef.current === digitos) cepEmVooRef.current = null;
    }
  }

  /**
   * Preenche só o que está VAZIO. Campo já digitado com outro valor fica como
   * está e vai para a lista de "mantidos", que só a ação explícita "Usar
   * endereço do CEP" substitui — nada é sobrescrito em silêncio.
   */
  function aplicarSugestaoDoCep(resposta: EnderecoDoCepApi) {
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
      setCep({
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
      setErros((prev) => semErroDe(prev, "cep", ...preenchidos));
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
    setCep({ tipo: "sugerido", mensagem: partes.join(" "), mantidos });
  }

  /** Ação explícita: substitui os campos mantidos pelo que o CEP sugeriu. */
  function usarEnderecoDoCep() {
    if (cep.tipo !== "sugerido" || cep.mantidos.length === 0) return;
    const { mantidos } = cep;
    setEndereco((prev) => {
      const proximo = { ...prev };
      for (const { chave, sugerido } of mantidos) proximo[chave] = sugerido;
      return proximo;
    });
    setErros((prev) => semErroDe(prev, ...mantidos.map((m) => m.chave)));
    setCep({
      tipo: "sugerido",
      mensagem: `Endereço do CEP aplicado em ${listaDeRotulos(
        mantidos.map((m) => m.chave),
      )}. Os campos continuam editáveis.`,
      mantidos: [],
    });
    // O botão acionado some: o foco volta para "Buscar CEP", ao lado. Por id:
    // o `Button` do Evolli não repassa `ref`.
    document.getElementById(ID_BOTAO_BUSCAR_CEP)?.focus();
  }

  function atualizarContato(campo: CampoContato, valor: string) {
    setContatos((prev) => ({ ...prev, [campo]: valor }));
    setErros((prev) => semErroDe(prev, campo));
  }

  function atualizar<K extends keyof Campos>(
    campo: K,
    valor: Campos[K],
    ...errosLimpos: CampoErro[]
  ) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
    setErros((prev) => semErroDe(prev, ...errosLimpos));
  }

  function selecionarTipoDestino(tipoDestino: TipoDestino) {
    setCampos((prev) => ({
      ...prev,
      tipoDestino,
      destinoId: "",
      departamentoIdArea: "",
    }));
    setAreas([]);
    setErros((prev) =>
      semErroDe(prev, "tipoDestino", "departamentoArea", "destino"),
    );
  }

  async function selecionarDepartamentoArea(departamentoId: string) {
    setCampos((prev) => ({
      ...prev,
      departamentoIdArea: departamentoId,
      destinoId: "",
    }));
    setAreas([]);
    setErros((prev) => semErroDe(prev, "departamentoArea", "destino"));
    if (!departamentoId) return;
    setCarregandoAreas(true);
    try {
      const resp = await listarAreas({
        departamentoId,
        status: "ativo",
        tamanhoPagina: 100,
      });
      setAreas(resp.itens);
    } catch {
      setAreas([]);
    } finally {
      setCarregandoAreas(false);
    }
  }

  function validar(): Erros {
    const novos: Erros = {};
    const nome = campos.nome.trim();
    if (!nome) {
      novos.nome = "Nome é obrigatório.";
    } else if (nome.length < 2 || nome.length > 160) {
      novos.nome = "Nome deve ter entre 2 e 160 caracteres.";
    }
    if (!MATRICULA_PATTERN.test(campos.matricula.trim().toUpperCase())) {
      novos.matricula =
        "Use apenas letras maiúsculas, números, - e _ (2 a 32 caracteres).";
    }
    if (!campos.tipo) novos.tipo = "Selecione o tipo de vínculo.";
    if (!campos.dataAdmissao) {
      novos.dataAdmissao = "Informe a data de admissão.";
    }
    if (!campos.tipoDestino) {
      novos.tipoDestino = "Escolha o tipo de referência organizacional.";
    } else if (campos.tipoDestino === "area" && !campos.departamentoIdArea) {
      novos.departamentoArea = "Selecione o departamento da área.";
    } else if (!campos.destinoId) {
      novos.destino = `Selecione o registro de ${rotuloTipoDestino(
        campos.tipoDestino,
      ).toLowerCase()}.`;
    }
    Object.assign(
      novos,
      validarPerfil(perfil),
      validarEndereco(endereco),
      validarContatos(contatos),
    );
    if (!empresa) novos.geral = MENSAGEM_EMPRESA_INDEFINIDA;
    return novos;
  }

  function montarDto(empresaId: string): AdmitirColaboradorDto {
    const { tipoDestino, destinoId, departamentoIdArea } = campos;
    return {
      nome: campos.nome.trim(),
      empresaId,
      matricula: campos.matricula.trim().toUpperCase(),
      tipo: campos.tipo as TipoVinculo,
      dataAdmissao: campos.dataAdmissao,
      motivoCodigo: "admissao_inicial",
      ...(tipoDestino === "unidade"
        ? { unidadeOrganizacionalId: destinoId }
        : {}),
      ...(tipoDestino === "departamento" ? { departamentoId: destinoId } : {}),
      ...(tipoDestino === "area"
        ? { areaId: destinoId, departamentoId: departamentoIdArea }
        : {}),
      ...(tipoDestino === "equipe" ? { equipeId: destinoId } : {}),
      ...(tipoDestino === "cargo" ? { cargoId: destinoId } : {}),
      ...(tipoDestino === "centroCusto" ? { centroCustoId: destinoId } : {}),
      perfilPessoal: blocoPerfil(perfil),
      endereco: blocoEndereco(endereco),
      contatos: normalizarContatos(contatos),
    };
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviandoRef.current) return;

    const novos = validar();
    if (Object.keys(novos).length > 0 || !empresa) {
      focarPrimeiroErroRef.current = true;
      setErros(novos);
      return;
    }

    enviandoRef.current = true;
    setSalvando(true);
    setErros({});
    try {
      const resposta = await admitirColaborador(montarDto(empresa.id));
      setAdmissao(resposta);
    } catch (erro: unknown) {
      // Os dados digitados ficam: só as mensagens e o estado de envio mudam.
      focarPrimeiroErroRef.current = true;
      setErros(errosDaRecusa(erro, campos.tipoDestino !== ""));
    } finally {
      setSalvando(false);
      enviandoRef.current = false;
    }
  }

  function pedirCancelamento() {
    if (salvando) return;
    if (alterado) {
      setConfirmandoDescarte(true);
      return;
    }
    onSair();
  }

  function recomecar() {
    setCampos(CAMPOS_VAZIOS);
    setPerfil(PERFIL_VAZIO);
    setEndereco(ENDERECO_INICIAL);
    setContatos(CONTATOS_VAZIOS);
    setAreas([]);
    setErros({});
    setAdmissao(null);
  }

  const opcoesDestino: { id: string; rotulo: string }[] = (() => {
    const rotular = (r: { id: string; codigo: string; nome: string }) => ({
      id: r.id,
      rotulo: `${r.codigo} — ${r.nome}`,
    });
    switch (campos.tipoDestino) {
      case "unidade":
        return opcoes.unidades.map(rotular);
      case "departamento":
        return opcoes.departamentos.map(rotular);
      case "area":
        return areas.map(rotular);
      case "equipe":
        return opcoes.equipes.map(rotular);
      case "cargo":
        return opcoes.cargos.map(rotular);
      case "centroCusto":
        return opcoes.centrosCusto.map(rotular);
      default:
        return [];
    }
  })();

  /**
   * T178 — um campo de texto opcional do perfil, pela chave. Rótulo, limite,
   * ajuda e validação continuam vindo de `CAMPOS_TEXTO_PERFIL`; o JSX só
   * decide em que linha da grade ele aparece.
   */
  function campoPerfil(chave: Exclude<ChavePerfil, "dataNascimento">) {
    const campo = CAMPOS_TEXTO_PERFIL.find((c) => c.chave === chave)!;
    return (
      <FormField
        id={ID_DO_CAMPO[campo.chave]}
        label={rotuloOpcional(campo.rotulo)}
        {...(campo.ajuda ? { help: campo.ajuda } : {})}
        {...(erros[campo.chave] ? { error: erros[campo.chave]! } : {})}
      >
        {(control) => (
          <input
            type="text"
            maxLength={campo.limite}
            autoComplete="off"
            value={perfil[campo.chave]}
            onChange={(e) => atualizarPerfil(campo.chave, e.target.value)}
            {...control}
          />
        )}
      </FormField>
    );
  }

  /** T178 — idem para o endereço (`CAMPOS_ENDERECO`). */
  function campoEndereco(chave: ChaveEndereco, aoSair?: () => void) {
    const campo = CAMPOS_ENDERECO.find((c) => c.chave === chave)!;
    return (
      <FormField
        id={ID_DO_CAMPO[campo.chave]}
        label={rotuloOpcional(campo.rotulo)}
        {...(campo.chave === "pais"
          ? { help: "Sugerido como Brasil; pode ser alterado." }
          : campo.ajuda
            ? { help: campo.ajuda }
            : {})}
        {...(erros[campo.chave] ? { error: erros[campo.chave]! } : {})}
      >
        {(control) => (
          <input
            type="text"
            maxLength={campo.limite}
            autoComplete="off"
            value={endereco[campo.chave]}
            onChange={(e) => atualizarEndereco(campo.chave, e.target.value)}
            onBlur={aoSair}
            {...control}
          />
        )}
      </FormField>
    );
  }

  if (admissao) {
    return (
      <ConfirmacaoDaAdmissao
        admissao={admissao}
        opcoes={opcoes}
        areas={areas}
        tituloRef={sucessoTituloRef}
        onAbrirAdmitido={onAbrirAdmitido}
        onRecomecar={recomecar}
        onSair={onSair}
      />
    );
  }

  return (
    <div className="nova-admissao">
      {/* T178 — "Colaboradores" na trilha é o MESMO caminho do Cancelar:
          com dados digitados, pede a confirmação de descarte antes de sair. */}
      <TrilhaDaNovaAdmissao onColaboradores={pedirCancelamento} />
      <PageHeader
        headingLevel={1}
        titleId={NOVA_ADMISSAO_TITULO_ID}
        title="Nova admissão"
        description="Registre a admissão de um colaborador na empresa ativa. Uma só operação cria o colaborador, o vínculo previsto e o ato de admissão; a efetivação continua sendo feita depois, pelo RH ou DP."
      />

      <Surface
        as="section"
        padding="md"
        className="nova-admissao__aviso"
        aria-labelledby="nova-admissao-aviso-titulo"
      >
        <StatusBadge variant="info">Módulo 1 do cadastro</StatusBadge>
        <p id="nova-admissao-aviso-titulo" className="nova-admissao__texto">
          Dados pessoais, endereço e contatos são gravados junto com a admissão.
          Nome social, gênero, documentos, CPF, dados bancários, dependentes e
          dados contratuais avançados ainda não são coletados: entram nos
          próximos módulos.
        </p>
      </Surface>

      <form
        className="nova-admissao__form"
        aria-label="Formulário de nova admissão"
        noValidate
        onSubmit={(e) => void enviar(e)}
      >
        <p className="nova-admissao__texto nova-admissao__legenda">
          Campos com * são obrigatórios. Os marcados como opcionais podem ficar
          em branco.
        </p>
        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-empresa"
        >
          <h2
            id="nova-admissao-grupo-empresa"
            className="nova-admissao__grupo-titulo"
          >
            Empresa
          </h2>
          {carregandoOpcoes ? (
            <p className="nova-admissao__texto" role="status">
              Carregando a empresa ativa…
            </p>
          ) : empresa ? (
            <dl className="nova-admissao__leitura">
              <dt>Empresa ativa</dt>
              <dd id="nova-admissao-empresa">
                <strong>{empresa.nome}</strong> ({empresa.codigo})
                <span className="nova-admissao__ajuda">
                  {" "}
                  — a empresa em que você está trabalhando. Não é editável aqui.
                </span>
              </dd>
            </dl>
          ) : null}
        </section>

        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-dados-pessoais"
        >
          <h2
            id="nova-admissao-grupo-dados-pessoais"
            className="nova-admissao__grupo-titulo"
          >
            Dados pessoais
          </h2>
          {/* T178 — disposição em linhas (pedido da proprietária): nome e
              e-mail pessoal; data de nascimento, sexo e saudação; estado
              civil, nacionalidade e naturalidade; escolaridade e curso; pai e
              mãe. Em tela estreita cada linha vira uma coluna só. */}
          <div className="nova-admissao__linha nova-admissao__linha--2">
            <FormField
              id={ID_DO_CAMPO.nome}
              label="Nome completo"
              required
              help="2 a 160 caracteres."
              {...(erros.nome ? { error: erros.nome } : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={160}
                  autoComplete="off"
                  value={campos.nome}
                  onChange={(e) => atualizar("nome", e.target.value, "nome")}
                  {...control}
                />
              )}
            </FormField>
            {/* O e-mail pessoal é o MESMO campo dos contatos (T169): mesmo
                estado e validação, e segue em `contatos.emailPessoal`. Só a
                posição na tela é de Dados pessoais. */}
            <FormField
              id={ID_DO_CAMPO.emailPessoal}
              label="E-mail pessoal"
              required
              {...(erros.emailPessoal ? { error: erros.emailPessoal } : {})}
            >
              {(control) => (
                <input
                  type="email"
                  maxLength={254}
                  autoComplete="off"
                  value={contatos.emailPessoal}
                  onChange={(e) =>
                    atualizarContato("emailPessoal", e.target.value)
                  }
                  {...control}
                />
              )}
            </FormField>
          </div>
          <div className="nova-admissao__linha nova-admissao__linha--3">
            <FormField
              id={ID_DO_CAMPO.dataNascimento}
              label={ROTULO_DATA_NASCIMENTO}
              required
              {...(erros.dataNascimento ? { error: erros.dataNascimento } : {})}
            >
              {(control) => (
                <input
                  type="date"
                  value={perfil.dataNascimento}
                  onChange={(e) =>
                    atualizarPerfil("dataNascimento", e.target.value)
                  }
                  {...control}
                />
              )}
            </FormField>
            {campoPerfil("sexo")}
            {campoPerfil("saudacao")}
          </div>
          <div className="nova-admissao__linha nova-admissao__linha--3">
            {campoPerfil("estadoCivil")}
            {campoPerfil("nacionalidade")}
            {campoPerfil("naturalidade")}
          </div>
          <div className="nova-admissao__linha nova-admissao__linha--2">
            {campoPerfil("escolaridade")}
            {campoPerfil("curso")}
          </div>
          <div className="nova-admissao__linha nova-admissao__linha--2">
            {campoPerfil("nomePai")}
            {campoPerfil("nomeMae")}
          </div>
        </section>

        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-endereco"
        >
          <h2
            id="nova-admissao-grupo-endereco"
            className="nova-admissao__grupo-titulo"
          >
            Endereço
          </h2>
          {/* T178 — país e CEP; logradouro (largo) e número (estreito);
              complemento e bairro; cidade e estado. */}
          <div className="nova-admissao__linha nova-admissao__linha--2">
            {campoEndereco("pais")}
            {/* T178 — CEP com consulta assistida, só para o Brasil. Com outro
                país não há botão nem consulta: o CEP é só texto. */}
            <div className="nova-admissao__cep">
              {campoEndereco(
                "cep",
                cepAssistido ? () => void buscarCep("saida") : undefined,
              )}
              {cepAssistido ? (
                <div className="nova-admissao__cep-acoes">
                  <Button
                    type="button"
                    variant="secondary"
                    id={ID_BOTAO_BUSCAR_CEP}
                    aria-disabled={cep.tipo === "buscando"}
                    aria-describedby="nova-admissao-cep-status"
                    onClick={() => {
                      if (cep.tipo === "buscando") return;
                      void buscarCep("botao");
                    }}
                  >
                    {cep.tipo === "buscando" ? "Buscando CEP…" : "Buscar CEP"}
                  </Button>
                  {/* A única região viva do bloco: anuncia o resultado sem
                      mover o foco. Sempre montada, para que o anúncio saia. */}
                  <p
                    id="nova-admissao-cep-status"
                    className="nova-admissao__texto nova-admissao__cep-status"
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
                      onClick={usarEnderecoDoCep}
                    >
                      Usar endereço do CEP
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="nova-admissao__linha nova-admissao__linha--larga-estreita">
            {campoEndereco("logradouro")}
            {campoEndereco("numero")}
          </div>
          <div className="nova-admissao__linha nova-admissao__linha--2">
            {campoEndereco("complemento")}
            {campoEndereco("bairro")}
          </div>
          <div className="nova-admissao__linha nova-admissao__linha--2">
            {campoEndereco("cidade")}
            {campoEndereco("estado")}
          </div>
        </section>

        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-contatos"
        >
          <h2
            id="nova-admissao-grupo-contatos"
            className="nova-admissao__grupo-titulo"
          >
            Contatos
          </h2>
          <p className="nova-admissao__texto nova-admissao__ajuda">
            O e-mail pessoal fica em Dados pessoais, ao lado do nome.
          </p>
          <div className="nova-admissao__linha nova-admissao__linha--2">
            <FormField
              id={ID_DO_CAMPO.celular}
              label="Celular"
              required
              help="Só dígitos, com + opcional no início. Espaço, parênteses, hífen e ponto são aceitos e removidos ao salvar."
              {...(erros.celular ? { error: erros.celular } : {})}
            >
              {(control) => (
                <input
                  type="tel"
                  autoComplete="off"
                  value={contatos.celular}
                  onChange={(e) => atualizarContato("celular", e.target.value)}
                  {...control}
                />
              )}
            </FormField>
            <FormField
              id={ID_DO_CAMPO.telefone}
              label="Telefone"
              required
              help="Só dígitos, com + opcional no início. Espaço, parênteses, hífen e ponto são aceitos e removidos ao salvar."
              {...(erros.telefone ? { error: erros.telefone } : {})}
            >
              {(control) => (
                <input
                  type="tel"
                  autoComplete="off"
                  value={contatos.telefone}
                  onChange={(e) => atualizarContato("telefone", e.target.value)}
                  {...control}
                />
              )}
            </FormField>
          </div>
        </section>

        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-vinculo"
        >
          <h2
            id="nova-admissao-grupo-vinculo"
            className="nova-admissao__grupo-titulo"
          >
            Vínculo
          </h2>
          <div className="nova-admissao__linha nova-admissao__linha--3">
            <FormField
              id={ID_DO_CAMPO.matricula}
              label="Matrícula"
              required
              help="Letras maiúsculas, números, - e _ (2 a 32 caracteres)."
              {...(erros.matricula ? { error: erros.matricula } : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={32}
                  autoComplete="off"
                  value={campos.matricula}
                  onChange={(e) =>
                    atualizar(
                      "matricula",
                      e.target.value.toUpperCase(),
                      "matricula",
                    )
                  }
                  {...control}
                />
              )}
            </FormField>
            <FormField
              id={ID_DO_CAMPO.tipo}
              label="Tipo de vínculo"
              required
              {...(erros.tipo ? { error: erros.tipo } : {})}
            >
              {(control) => (
                <select
                  value={campos.tipo}
                  onChange={(e) =>
                    atualizar("tipo", e.target.value as TipoVinculo, "tipo")
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {(Object.keys(ROTULO_TIPO_VINCULO) as TipoVinculo[]).map(
                    (tipo) => (
                      <option key={tipo} value={tipo}>
                        {ROTULO_TIPO_VINCULO[tipo]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>
            <FormField
              id={ID_DO_CAMPO.dataAdmissao}
              label="Data de admissão"
              required
              help="Data futura deixa o ato de admissão programado para ela."
              {...(erros.dataAdmissao ? { error: erros.dataAdmissao } : {})}
            >
              {(control) => (
                <input
                  type="date"
                  value={campos.dataAdmissao}
                  onChange={(e) =>
                    atualizar("dataAdmissao", e.target.value, "dataAdmissao")
                  }
                  {...control}
                />
              )}
            </FormField>
          </div>
        </section>

        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-lotacao"
        >
          <h2
            id="nova-admissao-grupo-lotacao"
            className="nova-admissao__grupo-titulo"
          >
            Lotação inicial
          </h2>
          {/* T178 — tipo e registro lado a lado; com "Área", o departamento
              entra ENTRE os dois, na ordem em que precisa ser escolhido. */}
          <div
            className={`nova-admissao__linha ${
              campos.tipoDestino === "area"
                ? "nova-admissao__linha--3"
                : "nova-admissao__linha--2"
            }`}
          >
            <FormField
              id={ID_DO_CAMPO.tipoDestino}
              label="Tipo de referência organizacional"
              required
              help="Primeiro escolha o tipo; o registro é escolhido no campo seguinte."
              {...(erros.tipoDestino ? { error: erros.tipoDestino } : {})}
            >
              {(control) => (
                <select
                  value={campos.tipoDestino}
                  onChange={(e) =>
                    selecionarTipoDestino(e.target.value as TipoDestino)
                  }
                  disabled={carregandoOpcoes}
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {OPCOES_TIPO_DESTINO.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {campos.tipoDestino === "area" ? (
              <FormField
                id={ID_DO_CAMPO.departamentoArea}
                label="Departamento da área"
                required
                help="A área só identifica a lotação junto com o departamento a que pertence."
                {...(erros.departamentoArea
                  ? { error: erros.departamentoArea }
                  : {})}
              >
                {(control) => (
                  <select
                    value={campos.departamentoIdArea}
                    onChange={(e) =>
                      void selecionarDepartamentoArea(e.target.value)
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {opcoes.departamentos.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.codigo} — {dep.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {campos.tipoDestino ? (
              <FormField
                id={ID_DO_CAMPO.destino}
                label="Registro da referência organizacional"
                required
                help={`Tipo escolhido: ${rotuloTipoDestino(campos.tipoDestino)}. Uma referência é suficiente para efetivar a admissão.`}
                {...(erros.destino ? { error: erros.destino } : {})}
              >
                {(control) => (
                  <select
                    value={campos.destinoId}
                    onChange={(e) =>
                      atualizar("destinoId", e.target.value, "destino")
                    }
                    disabled={
                      campos.tipoDestino === "area" &&
                      (!campos.departamentoIdArea || carregandoAreas)
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {opcoesDestino.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}
          </div>
        </section>

        {erros.geral ? (
          <p
            className="nova-admissao__erro-geral"
            role="alert"
            id={ERRO_GERAL_ID}
            tabIndex={-1}
          >
            {erros.geral}
          </p>
        ) : null}

        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={pedirCancelamento}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={salvando || carregandoOpcoes}
          >
            {salvando ? "Admitindo…" : "Admitir colaborador"}
          </Button>
        </FormActions>
      </form>

      {/* Confirmação de descarte: é confirmação curta, o uso de modal que a
          decisão do `DP-FLX-21` mantém. O cadastro em si nunca abre em modal. */}
      <Modal
        aberto={confirmandoDescarte}
        titulo="Descartar esta admissão?"
        descricao="Os dados digitados nesta página serão perdidos. Nada foi salvo."
        onFechar={() => setConfirmandoDescarte(false)}
      >
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmandoDescarte(false)}
          >
            Continuar preenchendo
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setConfirmandoDescarte(false);
              onSair();
            }}
          >
            Descartar e sair
          </Button>
        </FormActions>
      </Modal>
    </div>
  );
}

/**
 * T178 — trilha da página: módulo › Colaboradores › Nova admissão. Os nomes
 * vêm do mapa de navegação, os mesmos da barra lateral. Quem decide o que
 * acontece ao voltar é o chamador (com ou sem confirmação de descarte).
 */
function TrilhaDaNovaAdmissao({
  onColaboradores,
}: {
  readonly onColaboradores: () => void;
}) {
  return (
    <TrilhaNavegacao
      itens={[
        { rotulo: tituloDoGrupoDe("nova-admissao") ?? "Gestão de Pessoas" },
        {
          rotulo: destinoPorId("pessoas")?.label ?? "Colaboradores",
          onSelecionar: onColaboradores,
        },
        { rotulo: "Nova admissão" },
      ]}
    />
  );
}

interface ConfirmacaoProps {
  admissao: AdmissaoRegistradaApi;
  opcoes: Opcoes;
  areas: AreaApi[];
  tituloRef: React.RefObject<HTMLHeadingElement>;
  onAbrirAdmitido: NovaAdmissaoScreenProps["onAbrirAdmitido"];
  onRecomecar: () => void;
  onSair: () => void;
}

/**
 * Lotação inicial como o SERVIDOR a gravou: a referência devolvida na
 * resposta, nomeada pelas opções que a própria página carregou do servidor.
 * Se o registro não estiver entre elas, diz só o tipo — nunca um id cru.
 */
function lotacaoGravada(
  destino: AdmissaoRegistradaApi["movimentacao"]["destino"],
  opcoes: Opcoes,
  areas: AreaApi[],
): string {
  const nomear = (
    lista: { id: string; codigo: string; nome: string }[],
    id: string,
    rotulo: string,
  ) => {
    const achado = lista.find((r) => r.id === id);
    return achado
      ? `${rotulo}: ${achado.codigo} — ${achado.nome}`
      : `${rotulo} registrada`;
  };
  if (destino.areaId) return nomear(areas, destino.areaId, "Área");
  if (destino.departamentoId)
    return nomear(opcoes.departamentos, destino.departamentoId, "Departamento");
  if (destino.unidadeOrganizacionalId)
    return nomear(
      opcoes.unidades,
      destino.unidadeOrganizacionalId,
      "Unidade organizacional",
    );
  if (destino.equipeId)
    return nomear(opcoes.equipes, destino.equipeId, "Equipe");
  if (destino.cargoId) return nomear(opcoes.cargos, destino.cargoId, "Cargo");
  if (destino.centroCustoId)
    return nomear(
      opcoes.centrosCusto,
      destino.centroCustoId,
      "Centro de custo",
    );
  return "Sem referência registrada";
}

function ConfirmacaoDaAdmissao({
  admissao,
  opcoes,
  areas,
  tituloRef,
  onAbrirAdmitido,
  onRecomecar,
  onSair,
}: ConfirmacaoProps) {
  const colaborador: ColaboradorApi = {
    id: admissao.id,
    nome: admissao.nome,
    situacao: admissao.situacao,
    criadoEm: admissao.criadoEm,
    atualizadoEm: admissao.atualizadoEm,
  };
  return (
    <div className="nova-admissao">
      {/* Depois da admissão não há o que descartar: a trilha sai direto, como
          "Voltar para Colaboradores". */}
      <TrilhaDaNovaAdmissao onColaboradores={onSair} />
      <PageHeader
        headingLevel={1}
        titleId={NOVA_ADMISSAO_TITULO_ID}
        title="Nova admissão"
      />
      <Surface
        as="section"
        padding="lg"
        className="nova-admissao__sucesso"
        aria-labelledby="nova-admissao-sucesso-titulo"
      >
        <StatusBadge variant="success">Admissão registrada</StatusBadge>
        <h2
          id="nova-admissao-sucesso-titulo"
          className="nova-admissao__grupo-titulo"
          tabIndex={-1}
          ref={tituloRef}
        >
          Admissão de {admissao.nome} registrada
        </h2>
        <p className="nova-admissao__texto" role="status">
          O servidor confirmou a admissão. Os dados abaixo são os que ele
          gravou. O colaborador fica{" "}
          {admissao.situacao === "ativo" ? "Ativo" : "Inativo"} e o vínculo{" "}
          {ROTULO_SITUACAO_VINCULO[admissao.vinculo.situacao] ??
            admissao.vinculo.situacao}{" "}
          até a efetivação da admissão.
        </p>
        <dl className="nova-admissao__resumo">
          <dt>Colaborador</dt>
          <dd>{admissao.nome}</dd>
          <dt>Matrícula</dt>
          <dd>{admissao.vinculo.matricula}</dd>
          <dt>Tipo de vínculo</dt>
          <dd>
            {ROTULO_TIPO_VINCULO[admissao.vinculo.tipo] ??
              admissao.vinculo.tipo}
          </dd>
          <dt>Situação do vínculo</dt>
          <dd>
            {ROTULO_SITUACAO_VINCULO[admissao.vinculo.situacao] ??
              admissao.vinculo.situacao}
          </dd>
          <dt>Data de admissão</dt>
          <dd>{formatarDiaCivil(admissao.vinculo.dataAdmissao)}</dd>
          <dt>Ato de admissão</dt>
          <dd>
            {ROTULO_STATUS_ADMISSAO[admissao.movimentacao.status] ??
              admissao.movimentacao.status}
          </dd>
          <dt>Lotação inicial</dt>
          <dd>
            {lotacaoGravada(admissao.movimentacao.destino, opcoes, areas)}
          </dd>
        </dl>
        <ResumoGravado
          titulo="Dados pessoais"
          id="nova-admissao-sucesso-dados-pessoais"
          linhas={[
            [
              ROTULO_DATA_NASCIMENTO,
              formatarDiaCivil(admissao.perfilPessoal.dataNascimento),
            ],
            ...CAMPOS_TEXTO_PERFIL.map(
              (c) => [c.rotulo, admissao.perfilPessoal[c.chave]] as const,
            ),
          ]}
        />
        <ResumoGravado
          titulo="Endereço"
          id="nova-admissao-sucesso-endereco"
          linhas={
            admissao.endereco
              ? CAMPOS_ENDERECO.map(
                  (c) => [c.rotulo, admissao.endereco![c.chave]] as const,
                )
              : null
          }
        />
        <ResumoGravado
          titulo="Contatos"
          id="nova-admissao-sucesso-contatos"
          linhas={[
            ["E-mail pessoal", admissao.contatos.emailPessoal],
            ["Celular", admissao.contatos.celular],
            ["Telefone", admissao.contatos.telefone],
          ]}
        />
        <FormActions>
          <Button
            type="button"
            variant="primary"
            onClick={() => onAbrirAdmitido(colaborador, "ficha")}
          >
            Abrir ficha de {admissao.nome}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onAbrirAdmitido(colaborador, "contatos")}
          >
            Revisar contatos na ficha
          </Button>
          <Button type="button" variant="secondary" onClick={onRecomecar}>
            Registrar outra admissão
          </Button>
          <Button type="button" variant="secondary" onClick={onSair}>
            Voltar para Colaboradores
          </Button>
        </FormActions>
      </Surface>
    </div>
  );
}

/**
 * Um bloco da confirmação, com o que o SERVIDOR gravou. Campo sem valor
 * aparece como "Não informado" — é o estado gravado, não um campo falso.
 */
function ResumoGravado({
  titulo,
  id,
  linhas,
}: {
  titulo: string;
  id: string;
  linhas: readonly (readonly [string, string | null])[] | null;
}) {
  return (
    <section className="nova-admissao__bloco-gravado" aria-labelledby={id}>
      <h3 id={id} className="nova-admissao__subtitulo">
        {titulo}
      </h3>
      {linhas ? (
        <dl className="nova-admissao__resumo">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="nova-admissao__resumo-linha">
              <dt>{rotulo}</dt>
              <dd>{valor ?? "Não informado"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="nova-admissao__texto">Nada informado neste bloco.</p>
      )}
    </section>
  );
}
