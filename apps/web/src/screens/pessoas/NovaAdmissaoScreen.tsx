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
 *   da ficha da T169, lidos depois pela rota própria. T179 — opcionais: cada
 *   vazio fica fora do corpo, e o bloco some quando os três estão vazios.
 * - **Servidor como fonte.** A confirmação mostra o que o servidor gravou.
 *
 * ## Obrigatoriedade, campo a campo
 *
 * T179 — decisão da proprietária de 2026-10-21. OBRIGATÓRIOS (asterisco e
 * "obrigatório" para leitor de tela): nome completo e data de nascimento; do
 * vínculo, tipo e data de admissão; da lotação, Departamento e Cargo.
 * OPCIONAIS (rótulo com "opcional"): e-mail pessoal, celular e telefone; os
 * demais dados pessoais (sexo em lista fechada); todo o endereço; a
 * matrícula (formato conferido só quando preenchida); e Unidade, Área,
 * Equipe e Centro de custo. Opcional vazio não vai no corpo (ou vai `null`
 * nos blocos de perfil e endereço). É o mesmo contrato que o servidor exige.
 *
 * ## T179 — confirmar antes de gravar
 *
 * "Salvar" só VALIDA no navegador: com falha, a página fica e o foco vai ao
 * primeiro campo inválido; sem falha, abre o modal "Confirmar cadastro de
 * colaborador?" com o resumo do que identifica a admissão (empresa, nome,
 * matrícula, vínculo, data e lotação) — nunca contatos, endereço ou
 * nascimento. O modal não grava; só "Confirmar cadastro" envia.
 *
 * O envio leva uma chave de idempotência (`Idempotency-Key`), gerada na
 * primeira confirmação e REPETIDA em toda nova tentativa até um sucesso ou até
 * a página recomeçar. Assim, depois de uma falha de rede em que o servidor
 * pode ter gravado, confirmar de novo nunca cria um segundo cadastro.
 *
 * Recusa do servidor fecha o modal, preserva o formulário inteiro e diz, no
 * topo, QUAIS campos revisar — só os nomes, nunca os valores —, com a
 * mensagem em cada campo e o foco no primeiro.
 *
 * ## O que ela não faz
 *
 * Não coleta nome social, gênero, raça/etnia, foto, deficiência, contato de
 * emergência, documentos, CPF, dados bancários, dependentes nem dados
 * contratuais avançados — cada um tem destino na matriz de cobertura da T177.
 * Não inventa lista de opções: estado civil, escolaridade, país, cidade e
 * estado são texto validado. A única lista é a de sexo, FECHADA por decisão
 * da proprietária (T179, `OPCOES_SEXO`). Não cadastra Departamento, Cargo nem
 * Unidade: isso é do RH, em Estrutura (T179, decisão 7).
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
  CampoMascarado,
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
  DICA_DE_FORMATO,
  exibirCep,
  exibirTelefone,
} from "../../format/mascaras";
import {
  CAMPOS_ENDERECO,
  CAMPOS_TEXTO_PERFIL,
  CAMPO_SEXO,
  OPCOES_SEXO,
  type ChaveEndereco,
  type ChavePerfil,
  ENDERECO_INICIAL,
  PERFIL_VAZIO,
  ROTULO_DATA_NASCIMENTO,
  type ValoresEndereco,
  type ValoresPerfil,
  blocoEndereco,
  blocoPerfil,
  ehPaisBrasil,
  rotuloDoSexo,
  validarEndereco,
  validarPerfil,
} from "./dadosPessoais";
import {
  type CampoContato,
  type ValoresContatos,
  contatosDaAdmissao,
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

/** Rótulo de campo opcional: o "opcional" é parte do nome acessível. */
function rotuloOpcional(rotulo: string): string {
  return `${rotulo} (opcional)`;
}

/** Referência organizacional como aparece em seletor e resumo. */
interface Referencia {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

/** `CÓDIGO — Nome`: nomes repetidos são permitidos, o código distingue. */
function rotuloDaReferencia(referencia: Referencia): string {
  return `${referencia.codigo} — ${referencia.nome}`;
}

/** Só o que está ativo vira opção (o servidor já filtra; aqui, por garantia). */
function soAtivos<T extends { status: string }>(lista: readonly T[]): T[] {
  return lista.filter((item) => item.status === "ativo");
}

/** "A", "A e B", "A, B e C". */
function listaComE(itens: readonly string[]): string {
  return itens.length <= 1
    ? (itens[0] ?? "")
    : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
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

/** Só dígitos do CEP: sem hífen, espaço nem ponto. */
function digitosDoCep(cep: string): string {
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

// ---------------------------------------------------------------------------
// Erros, campo a campo.
// ---------------------------------------------------------------------------

/**
 * T179 — os seis seletores da lotação: Departamento e Cargo obrigatórios;
 * Unidade, Área, Equipe e Centro de custo opcionais.
 */
type CampoLotacao =
  "departamento" | "cargo" | "unidade" | "area" | "equipe" | "centroCusto";

type CampoErro =
  | "referencias"
  | "nome"
  | ChavePerfil
  | ChaveEndereco
  | CampoContato
  | "matricula"
  | "tipo"
  | "dataAdmissao"
  | CampoLotacao
  | "lotacao"
  | "geral";

type Erros = Partial<Record<CampoErro, string>>;

/**
 * Ordem visual dos campos: o foco vai ao primeiro desta lista com erro.
 *
 * T178 — o e-mail pessoal passou a ser exibido em Dados pessoais, ao lado do
 * nome (disposição pedida pela proprietária). É o MESMO campo dos contatos da
 * T169 — mesmo estado, mesma validação, e vai em `contatos.emailPessoal` no
 * corpo —, por isso só a posição nesta lista mudou: ela acompanha a tela.
 *
 * T179 — `referencias` é o aviso de empresa sem Departamento ou Cargo
 * ativos, no topo do formulário: com ele, nada é enviado, e é para lá que o
 * foco vai primeiro. A Unidade, opcional, não entra no aviso.
 */
const ORDEM_DOS_ERROS: readonly CampoErro[] = [
  "referencias",
  "nome",
  "emailPessoal",
  "dataNascimento",
  // T179 — o sexo é seletor, logo depois da data de nascimento na tela.
  CAMPO_SEXO.chave,
  ...CAMPOS_TEXTO_PERFIL.map((c) => c.chave),
  ...CAMPOS_ENDERECO.map((c) => c.chave),
  "celular",
  "telefone",
  "matricula",
  "tipo",
  "dataAdmissao",
  "departamento",
  "cargo",
  "unidade",
  "area",
  "equipe",
  "centroCusto",
  "lotacao",
  "geral",
];

/**
 * T179 — nome de cada campo no resumo "Revise N campos". São os rótulos da
 * tela: o resumo diz ONDE corrigir, nunca o valor digitado.
 */
const ROTULO_DO_CAMPO = {
  nome: "Nome completo",
  emailPessoal: "E-mail pessoal",
  dataNascimento: ROTULO_DATA_NASCIMENTO,
  sexo: CAMPO_SEXO.rotulo,
  ...Object.fromEntries(CAMPOS_TEXTO_PERFIL.map((c) => [c.chave, c.rotulo])),
  ...Object.fromEntries(CAMPOS_ENDERECO.map((c) => [c.chave, c.rotulo])),
  celular: "Celular",
  telefone: "Telefone",
  matricula: "Matrícula",
  tipo: "Tipo de vínculo",
  dataAdmissao: "Data de admissão",
  departamento: "Departamento",
  cargo: "Cargo",
  unidade: "Unidade",
  area: "Área",
  equipe: "Equipe",
  centroCusto: "Centro de custo",
  lotacao: "Lotação inicial",
} as Record<Exclude<CampoErro, "referencias" | "geral">, string>;

const ERRO_GERAL_ID = "nova-admissao-erro-geral";
const ID_BOTAO_SALVAR = "nova-admissao-salvar";

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

/**
 * T179 — falha sem resposta: o servidor pode ou não ter gravado. T179
 * (revisão final) — vale também para 5xx: o servidor pode ter gravado antes
 * de o proxy responder.
 */
// T179 — decisão da proprietária (2026-10-22): rede sem resposta e QUALQUER
// 5xx, inclusive 500, são envio incerto. A mensagem não afirma nem nega a
// gravação e manda conferir Colaboradores antes de tentar de novo.
const MENSAGEM_ENVIO_INCERTO =
  "Não foi possível confirmar se o cadastro foi gravado. Antes de tentar de novo, confira em Colaboradores; se ele não estiver lá, confirme de novo: o mesmo envio não cria um segundo cadastro.";

/**
 * T179 — a confirmação de descarte. "Nada foi salvo." só é verdade quando
 * nenhum envio ficou incerto; depois de falha de rede, de 5xx (T179, revisão
 * final) ou de 422 `idempotencia_conteudo_divergente`, um envio anterior pode
 * ter sido registrado, e o texto não afirma nem nega gravação.
 */
const DESCARTE_SEM_ENVIO_INCERTO =
  "Os dados digitados nesta página serão perdidos. Nada foi salvo.";
const DESCARTE_COM_ENVIO_INCERTO =
  "Os dados digitados nesta página serão descartados. Um envio anterior pode ter sido registrado: confira em Colaboradores.";

/** Limpa o erro do campo em correção e preserva os demais, inclusive `geral`. */
function semErroDe(erros: Erros, ...campos: CampoErro[]): Erros {
  const restante: Erros = { ...erros };
  for (const campo of campos) delete restante[campo];
  return restante;
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
 * T179 (revisão final) — o envio pode ter sido gravado: sem resposta (rede)
 * ou com 5xx (500, 502, 503, 504…), em que o servidor pode ter gravado antes
 * de o proxy responder.
 */
function envioSemConfirmacao(erro: unknown): boolean {
  const status = statusDe(erro);
  return status === null || status >= 500;
}

/**
 * T179 — detalhes da recusa (`erros` por campo e `codigo`), lidos por forma,
 * como o status: valem com o `ApiError` real e com o automockado dos testes.
 */
function detalhesDe(erro: unknown): {
  erros: readonly { campo: string; motivo: string }[];
  codigo: string | null;
} {
  if (typeof erro !== "object" || erro === null) {
    return { erros: [], codigo: null };
  }
  const { erros, codigo } = erro as { erros?: unknown; codigo?: unknown };
  return {
    erros: Array.isArray(erros)
      ? erros.filter(
          (e): e is { campo: string; motivo: string } =>
            typeof e === "object" &&
            e !== null &&
            typeof (e as { campo?: unknown }).campo === "string" &&
            typeof (e as { motivo?: unknown }).motivo === "string",
        )
      : [],
    codigo: typeof codigo === "string" ? codigo : null,
  };
}

/** T179 — caminho do campo no corpo da admissão → campo da tela. */
const CAMPO_DO_CONFLITO: Readonly<
  Record<string, { campo: CampoErro; mensagem: string }>
> = {
  matricula: {
    campo: "matricula",
    mensagem: "Esta matrícula já está em uso nesta empresa.",
  },
  "contatos.emailPessoal": {
    campo: "emailPessoal",
    mensagem: "Este e-mail pessoal já está em uso nesta empresa.",
  },
};

/**
 * Traduz a recusa do servidor para o campo que a causou. Vale só para
 * `POST /v1/colaboradores`:
 *
 *  - 409 — T179: o servidor diz QUAIS campos já estão em uso na empresa ativa
 *    (`erros: [{campo, motivo: "em_uso"}]`, sem o valor). Sem a lista, é outro
 *    conflito, e a mensagem é geral — não se presume mais que seja a
 *    matrícula;
 *  - 422 — com `codigo: "idempotencia_conteudo_divergente"`, a mesma chave de
 *    envio já registrou uma admissão com outro conteúdo; sem código,
 *    referência organizacional incoerente, de outra empresa ou inativa;
 *  - 404 — a empresa enviada deixou de ser a empresa ativa da sessão;
 *  - sem resposta (rede) ou 5xx (T179, revisão final) — não se sabe se
 *    gravou; confirmar de novo, com a mesma chave, é seguro.
 *
 * Em todos os casos os dados digitados ficam na página.
 */
function errosDaRecusa(erro: unknown): Erros {
  if (envioSemConfirmacao(erro)) return { geral: MENSAGEM_ENVIO_INCERTO };
  const status = statusDe(erro);
  const { erros: porCampo, codigo } = detalhesDe(erro);
  switch (status) {
    case 409: {
      const novos: Erros = {};
      for (const { campo, motivo } of porCampo) {
        const alvo = CAMPO_DO_CONFLITO[campo];
        if (alvo && motivo === "em_uso") novos[alvo.campo] = alvo.mensagem;
      }
      return Object.keys(novos).length > 0
        ? novos
        : {
            geral:
              "O cadastro não foi gravado: ele conflita com um registro que já existe nesta empresa. Revise os dados e confirme de novo.",
          };
    }
    case 422:
      return codigo === "idempotencia_conteudo_divergente"
        ? {
            geral:
              "Este envio já foi registrado antes, com outros dados, e nada novo foi gravado agora. Confira em Colaboradores se a admissão já existe antes de cadastrar de novo.",
          }
        : {
            lotacao:
              "A lotação escolhida não foi aceita: alguma referência pode ter sido inativada ou não pertencer à empresa ativa. Revise Departamento, Cargo e os campos opcionais da lotação (Unidade, Área, Equipe e Centro de custo).",
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

/**
 * T179 — chave de idempotência do envio. `crypto.randomUUID` existe em todo
 * contexto seguro (HTTPS e `localhost`); fora dele, um UUID v4 montado com
 * `getRandomValues`, a mesma fonte aleatória.
 */
function gerarChaveIdempotencia(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * T179 — o aviso de empresa sem referências obrigatórias (Departamento e
 * Cargo; a Unidade é opcional desde 2026-10-21). O RH é quem cadastra (em
 * Estrutura); o DP, e qualquer outro papel, só lê — para ele, a orientação é
 * pedir ao RH (decisões 6 e 7).
 */
function mensagemSemReferencias(
  faltando: readonly string[],
  papelDoAtor: string | null,
): string {
  const base = `Esta empresa ainda não tem cadastro ativo de ${listaComE(
    faltando,
  )}, e a admissão exige Departamento e Cargo. Nada será enviado até isso ser resolvido.`;
  if (papelDoAtor === "rh") {
    const onde: string[] = [];
    const naEstrutura = faltando.filter((f) => f !== "Cargo");
    if (naEstrutura.length > 0) {
      onde.push(`${listaComE(naEstrutura)} em Estrutura organizacional`);
    }
    if (faltando.includes("Cargo")) onde.push("Cargo em Funções e cargos");
    return `${base} Cadastre o que falta em Estrutura (${onde.join("; ")}) e depois abra esta página de novo.`;
  }
  return `${base} O RH precisa cadastrar ${listaComE(
    faltando,
  )} nesta empresa; depois disso, abra esta página de novo.`;
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
  /** T179 — lotação: um seletor por referência, cada um com o id escolhido. */
  departamentoId: string;
  cargoId: string;
  unidadeId: string;
  areaId: string;
  equipeId: string;
  centroCustoId: string;
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
  departamentoId: "",
  cargoId: "",
  unidadeId: "",
  areaId: "",
  equipeId: "",
  centroCustoId: "",
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
  /**
   * T179 — papel do ator, decidido pelo servidor (o mesmo que o shell usa).
   * Só muda a ORIENTAÇÃO do aviso de empresa sem referências: o RH cadastra
   * em Estrutura; o DP pede ao RH. Nunca concede nada.
   */
  readonly papelDoAtor?: string | null;
}

export function NovaAdmissaoScreen({
  onSair,
  onAbrirAdmitido,
  papelDoAtor = null,
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
  /** T179 — o resumo "Revise N campos" só aparece depois de uma tentativa. */
  const [tentouSalvar, setTentouSalvar] = useState(false);
  /** T179 — o modal "Confirmar cadastro de colaborador?" está aberto. */
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [admissao, setAdmissao] = useState<AdmissaoRegistradaApi | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  /**
   * T179 — o servidor disse que a chave deste envio já registrou uma admissão
   * com OUTRO conteúdo (422 `idempotencia_conteudo_divergente`). Toda nova
   * confirmação com a mesma chave repetiria a recusa: a tela oferece
   * recomeçar com uma chave nova, ou conferir a listagem.
   */
  const [envioDivergente, setEnvioDivergente] = useState(false);
  /**
   * T179 — algum envio com a chave em curso ficou sem resposta (rede), voltou
   * 5xx (revisão final) ou foi dado como divergente (422): ele pode ter sido
   * registrado. Fica até um
   * sucesso ou o recomeço da página — uma recusa posterior (409, validação)
   * não desfaz a dúvida sobre o envio anterior.
   */
  const [envioIncerto, setEnvioIncerto] = useState(false);
  /**
   * T179 (revisão final) — contador que limpa os avisos da máscara
   * (`limparAvisos`): muda ao recomeçar e depois do sucesso.
   */
  const [limpezaDosAvisos, setLimpezaDosAvisos] = useState(0);
  /** Trava síncrona contra envio duplicado (cliques no mesmo quadro). */
  const enviandoRef = useRef(false);
  /**
   * T179 — chave de idempotência do envio em curso. Nasce na primeira
   * confirmação e é REPETIDA em cada nova tentativa; só um sucesso ou o
   * recomeço da página a descartam.
   */
  const chaveIdempotenciaRef = useRef<string | null>(null);
  /** Gatilho de uma vez só: focar o primeiro erro depois que ele existe. */
  const focarPrimeiroErroRef = useRef(false);
  /** T179 — gatilho de uma vez só: devolver o foco a "Salvar". */
  const focarSalvarRef = useRef(false);
  /** Só a resposta mais recente de áreas vale (troca rápida de departamento). */
  const pedidoAreasRef = useRef(0);
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
          departamentos: soAtivos(departamentos.itens),
          unidades: soAtivos(unidades.itens),
          equipes: soAtivos(equipes.itens),
          cargos: soAtivos(cargos.itens),
          centrosCusto: soAtivos(centros.itens),
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

  // T179 — "Voltar e revisar" (ou Escape) devolve o foco a "Salvar". Pelo id:
  // o `Button` do Evolli não repassa `ref`, e o `Modal` só devolve o foco a
  // quem o tinha quando ele abriu — que pode não ser o botão.
  useEffect(() => {
    if (confirmando || !focarSalvarRef.current) return;
    focarSalvarRef.current = false;
    document.getElementById(ID_BOTAO_SALVAR)?.focus();
  }, [confirmando]);

  useEffect(() => {
    if (admissao) sucessoTituloRef.current?.focus();
  }, [admissao]);

  /**
   * T179 — o que falta para admitir nesta empresa: Departamento e Cargo são
   * obrigatórios, e o DP não pode cadastrá-los. A Unidade é opcional: empresa
   * sem unidade ativa admite sem ela. Só se calcula com a empresa resolvida:
   * sem ela, o aviso de empresa indefinida já basta.
   */
  const referenciasFaltando: string[] =
    carregandoOpcoes || !empresa
      ? []
      : [
          ...(opcoes.departamentos.length === 0 ? ["Departamento"] : []),
          ...(opcoes.cargos.length === 0 ? ["Cargo"] : []),
        ];

  const alterado =
    (Object.keys(campos) as (keyof Campos)[]).some(
      (c) => campos[c] !== CAMPOS_VAZIOS[c],
    ) ||
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
    // T179 — trocar o país muda a regra do CEP (8 dígitos só no Brasil): a
    // mensagem do CEP deixa de valer junto.
    setErros((prev) =>
      campo === "pais"
        ? semErroDe(prev, "pais", "cep")
        : semErroDe(prev, campo),
    );
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
  const cepAssistido = ehPaisBrasil(endereco.pais);

  /** A resposta ainda vale: é a do último pedido, para o CEP e país atuais. */
  function respostaVigente(pedido: number, digitos: string): boolean {
    const atual = enderecoRef.current;
    return (
      pedido === pedidoCepRef.current &&
      digitosDoCep(atual.cep) === digitos &&
      ehPaisBrasil(atual.pais)
    );
  }

  /**
   * Consulta o CEP. Só por ação: o botão, ou SAIR do campo com o CEP completo
   * e diferente do último perguntado — nunca a cada tecla, porque a consulta
   * é limitada no servidor e cada tecla gastaria uma.
   */
  async function buscarCep(origem: "botao" | "saida") {
    const atual = enderecoRef.current;
    if (!ehPaisBrasil(atual.pais)) return;
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
    // Mudar qualquer referência da lotação tira de cena a recusa do conjunto.
    setErros((prev) => semErroDe(prev, ...errosLimpos));
  }

  /**
   * T179 — o departamento filtra a área: trocá-lo limpa a área escolhida e
   * recarrega só as áreas dele. A área continua opcional.
   */
  async function selecionarDepartamento(departamentoId: string) {
    setCampos((prev) => ({ ...prev, departamentoId, areaId: "" }));
    setAreas([]);
    setErros((prev) => semErroDe(prev, "departamento", "area", "lotacao"));
    const pedido = ++pedidoAreasRef.current;
    if (!departamentoId) {
      setCarregandoAreas(false);
      return;
    }
    setCarregandoAreas(true);
    try {
      const resp = await listarAreas({
        departamentoId,
        status: "ativo",
        tamanhoPagina: 100,
      });
      if (pedido !== pedidoAreasRef.current) return;
      setAreas(soAtivos(resp.itens));
    } catch {
      if (pedido !== pedidoAreasRef.current) return;
      setAreas([]);
    } finally {
      if (pedido === pedidoAreasRef.current) setCarregandoAreas(false);
    }
  }

  function validar(): Erros {
    const novos: Erros = {};
    if (referenciasFaltando.length > 0) {
      novos.referencias = mensagemSemReferencias(
        referenciasFaltando,
        papelDoAtor,
      );
    }
    const nome = campos.nome.trim();
    if (!nome) {
      novos.nome = "Nome é obrigatório.";
    } else if (nome.length < 2 || nome.length > 160) {
      novos.nome = "Nome deve ter entre 2 e 160 caracteres.";
    }
    // T179 — matrícula opcional: o formato só é conferido quando preenchida.
    const matricula = campos.matricula.trim().toUpperCase();
    if (matricula !== "" && !MATRICULA_PATTERN.test(matricula)) {
      novos.matricula =
        "Use apenas letras maiúsculas, números, - e _ (2 a 32 caracteres).";
    }
    if (!campos.tipo) novos.tipo = "Selecione o tipo de vínculo.";
    if (!campos.dataAdmissao) {
      novos.dataAdmissao = "Informe a data de admissão.";
    }
    if (!campos.departamentoId) {
      novos.departamento =
        opcoes.departamentos.length > 0
          ? "Selecione o departamento."
          : "Não há departamento ativo nesta empresa.";
    }
    if (!campos.cargoId) {
      novos.cargo =
        opcoes.cargos.length > 0
          ? "Selecione o cargo."
          : "Não há cargo ativo nesta empresa.";
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

  /**
   * Corpo da admissão. T179 — opcional vazio fica FORA do corpo: matrícula,
   * Unidade, Área, Equipe, Centro de custo e cada contato (o bloco `contatos`
   * inteiro some quando os três estão vazios). Perfil e endereço seguem com
   * o vazio como `null` — inclusive o sexo sem seleção.
   */
  function montarDto(empresaId: string): AdmitirColaboradorDto {
    const { unidadeId, areaId, equipeId, centroCustoId } = campos;
    const matricula = campos.matricula.trim().toUpperCase();
    const blocoContatos = contatosDaAdmissao(contatos);
    return {
      nome: campos.nome.trim(),
      empresaId,
      ...(matricula ? { matricula } : {}),
      tipo: campos.tipo as TipoVinculo,
      dataAdmissao: campos.dataAdmissao,
      motivoCodigo: "admissao_inicial",
      departamentoId: campos.departamentoId,
      cargoId: campos.cargoId,
      ...(unidadeId ? { unidadeOrganizacionalId: unidadeId } : {}),
      ...(areaId ? { areaId } : {}),
      ...(equipeId ? { equipeId } : {}),
      ...(centroCustoId ? { centroCustoId } : {}),
      perfilPessoal: blocoPerfil(perfil),
      endereco: blocoEndereco(endereco),
      ...(blocoContatos ? { contatos: blocoContatos } : {}),
    };
  }

  /**
   * T179 — "Salvar": só valida. Com falha, a página fica e o foco vai ao
   * primeiro campo inválido; sem falha, abre a confirmação. Nada é enviado
   * aqui.
   */
  function pedirConfirmacao(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviandoRef.current || confirmando) return;
    setTentouSalvar(true);
    const novos = validar();
    if (Object.keys(novos).length > 0 || !empresa) {
      focarPrimeiroErroRef.current = true;
      setErros(novos);
      return;
    }
    setErros({});
    setConfirmando(true);
  }

  /** T179 — fecha a confirmação sem tocar em nada; o foco volta a "Salvar". */
  function voltarERevisar() {
    if (enviandoRef.current) return;
    focarSalvarRef.current = true;
    setConfirmando(false);
  }

  /** T179 — "Confirmar cadastro": o ÚNICO caminho que grava. */
  async function confirmarCadastro() {
    if (enviandoRef.current || !empresa) return;
    enviandoRef.current = true;
    const chave = (chaveIdempotenciaRef.current ??= gerarChaveIdempotencia());
    setSalvando(true);
    try {
      const resposta = await admitirColaborador(montarDto(empresa.id), {
        chaveIdempotencia: chave,
      });
      // Sucesso: a próxima admissão desta página será OUTRO envio.
      chaveIdempotenciaRef.current = null;
      setEnvioIncerto(false);
      setLimpezaDosAvisos((n) => n + 1);
      setConfirmando(false);
      setAdmissao(resposta);
    } catch (erro: unknown) {
      // Os dados digitados ficam: só as mensagens e o estado de envio mudam.
      // A chave também fica — a próxima confirmação é o MESMO envio.
      focarPrimeiroErroRef.current = true;
      setConfirmando(false);
      setErros(errosDaRecusa(erro));
      const divergente =
        statusDe(erro) === 422 &&
        detalhesDe(erro).codigo === "idempotencia_conteudo_divergente";
      setEnvioDivergente(divergente);
      if (divergente || envioSemConfirmacao(erro)) setEnvioIncerto(true);
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
    setTentouSalvar(false);
    setCep({ tipo: "ocioso" });
    ultimoCepConsultadoRef.current = null;
    // T179 — página recomeçada: a próxima confirmação é um envio novo.
    chaveIdempotenciaRef.current = null;
    setEnvioDivergente(false);
    setEnvioIncerto(false);
    setLimpezaDosAvisos((n) => n + 1);
    setAdmissao(null);
  }

  /**
   * T179 — "Recomeçar a admissão" depois do 422 divergente: página vazia,
   * chave nova e o foco no primeiro campo (o botão some ao recomeçar).
   */
  function recomecarComNovaChave() {
    recomecar();
    requestAnimationFrame(() =>
      document.getElementById(ID_DO_CAMPO.nome)?.focus(),
    );
  }

  /** Referência escolhida, pelo id, para o resumo da confirmação. */
  function escolhida(lista: readonly Referencia[], id: string): string | null {
    if (!id) return null;
    const achada = lista.find((r) => r.id === id);
    return achada ? rotuloDaReferencia(achada) : null;
  }

  /**
   * T178 — um campo de texto opcional do perfil, pela chave. Rótulo, limite,
   * ajuda e validação continuam vindo de `CAMPOS_TEXTO_PERFIL`; o JSX só
   * decide em que linha da grade ele aparece.
   */
  function campoPerfil(chave: Exclude<ChavePerfil, "dataNascimento" | "sexo">) {
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

  /**
   * T179 — o sexo: seletor de lista FECHADA (`OPCOES_SEXO`), opcional. A
   * opção vazia "Selecione…" é o "não informado" — vai `null`. O valor é o
   * código; o que se lê é o rótulo.
   */
  function campoSexo() {
    return (
      <FormField
        id={ID_DO_CAMPO.sexo}
        label={rotuloOpcional(CAMPO_SEXO.rotulo)}
        {...(erros.sexo ? { error: erros.sexo } : {})}
      >
        {(control) => (
          <select
            value={perfil.sexo}
            onChange={(e) => atualizarPerfil("sexo", e.target.value)}
            {...control}
          >
            <option value="">Selecione…</option>
            {OPCOES_SEXO.map((opcao) => (
              <option key={opcao.codigo} value={opcao.codigo}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        )}
      </FormField>
    );
  }

  /** T178 — idem para o endereço (`CAMPOS_ENDERECO`). */
  function campoEndereco(chave: ChaveEndereco, aoSair?: () => void) {
    const campo = CAMPOS_ENDERECO.find((c) => c.chave === chave)!;
    // T179 — CEP brasileiro tem máscara `00000-000`; com outro país, texto
    // livre como antes.
    const cepComMascara = chave === "cep" && cepAssistido;
    const ajuda =
      campo.chave === "pais"
        ? "Sugerido como Brasil; pode ser alterado."
        : cepComMascara
          ? DICA_DE_FORMATO.cep
          : campo.ajuda;
    return (
      <FormField
        id={ID_DO_CAMPO[campo.chave]}
        label={rotuloOpcional(campo.rotulo)}
        {...(ajuda ? { help: ajuda } : {})}
        {...(erros[campo.chave] ? { error: erros[campo.chave]! } : {})}
      >
        {(control) =>
          cepComMascara ? (
            <CampoMascarado
              mascara="cep"
              value={endereco.cep}
              onValorChange={(valor) => atualizarEndereco("cep", valor)}
              limparAvisos={limpezaDosAvisos}
              onBlur={aoSair}
              {...control}
            />
          ) : (
            <input
              type="text"
              maxLength={campo.limite}
              autoComplete="off"
              value={endereco[campo.chave]}
              onChange={(e) => atualizarEndereco(campo.chave, e.target.value)}
              onBlur={aoSair}
              {...control}
            />
          )
        }
      </FormField>
    );
  }

  /**
   * T179 — um seletor da lotação. Obrigatório (Departamento, Cargo) ou
   * opcional (Unidade, Área, Equipe, Centro de custo); opções `CÓDIGO — Nome`, só
   * ativas. Sem opções, o seletor diz isso no lugar de "Selecione…".
   */
  function seletorDeLotacao(definicao: {
    campo: CampoLotacao;
    rotulo: string;
    obrigatorio: boolean;
    valor: string;
    lista: readonly Referencia[];
    aoMudar: (id: string) => void;
    ajuda?: string;
    vazio: string;
    desabilitado?: boolean;
  }) {
    const { campo, rotulo, obrigatorio, valor, lista, aoMudar } = definicao;
    return (
      <FormField
        id={ID_DO_CAMPO[campo]}
        label={obrigatorio ? rotulo : rotuloOpcional(rotulo)}
        required={obrigatorio}
        {...(definicao.ajuda ? { help: definicao.ajuda } : {})}
        {...(erros[campo] ? { error: erros[campo]! } : {})}
      >
        {(control) => (
          <select
            value={valor}
            onChange={(e) => aoMudar(e.target.value)}
            disabled={carregandoOpcoes || definicao.desabilitado === true}
            {...control}
          >
            <option value="">
              {lista.length > 0 || carregandoOpcoes
                ? "Selecione…"
                : definicao.vazio}
            </option>
            {lista.map((ref) => (
              <option key={ref.id} value={ref.id}>
                {rotuloDaReferencia(ref)}
              </option>
            ))}
          </select>
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

  // T179 — campos a revisar, na ordem da tela. Só depois de uma tentativa, e
  // sem o aviso de referências (que tem bloco próprio) nem o erro geral.
  const camposARevisar = tentouSalvar
    ? ORDEM_DOS_ERROS.filter(
        (c): c is Exclude<CampoErro, "referencias" | "geral"> =>
          c !== "referencias" && c !== "geral" && Boolean(erros[c]),
      )
    : [];

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
        onSubmit={pedirConfirmacao}
      >
        {/* T179 — resumo do que revisar: só NOMES de campos, nunca valores.
            Cada nome é um botão que leva o foco ao campo. Não é região viva:
            quem anuncia é o foco, que já vai ao primeiro campo. */}
        {camposARevisar.length > 0 ? (
          <div
            className="nova-admissao__revisar"
            role="group"
            aria-labelledby="nova-admissao-revisar-titulo"
          >
            <p
              id="nova-admissao-revisar-titulo"
              className="nova-admissao__revisar-titulo"
            >
              Revise {camposARevisar.length}{" "}
              {camposARevisar.length === 1 ? "campo" : "campos"} antes de
              confirmar
            </p>
            <ul className="nova-admissao__revisar-lista">
              {camposARevisar.map((campo) => (
                <li key={campo}>
                  <Button
                    type="button"
                    variant="subtle"
                    onClick={() =>
                      document.getElementById(ID_DO_CAMPO[campo])?.focus()
                    }
                  >
                    {ROTULO_DO_CAMPO[campo]}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
          {/* T179 — empresa sem Departamento ou Cargo ativos: o aviso
              fica visível desde o carregamento e recebe o foco ao tentar
              salvar. */}
          {referenciasFaltando.length > 0 ? (
            <p
              id={ID_DO_CAMPO.referencias}
              className="nova-admissao__sem-referencias"
              role="alert"
              tabIndex={-1}
            >
              {mensagemSemReferencias(referenciasFaltando, papelDoAtor)}
            </p>
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
                posição na tela é de Dados pessoais. T179 — opcional. */}
            <FormField
              id={ID_DO_CAMPO.emailPessoal}
              label={rotuloOpcional("E-mail pessoal")}
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
            {campoSexo()}
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
              label={rotuloOpcional("Celular")}
              help={DICA_DE_FORMATO.telefone}
              {...(erros.celular ? { error: erros.celular } : {})}
            >
              {(control) => (
                <CampoMascarado
                  mascara="telefone"
                  value={contatos.celular}
                  onValorChange={(valor) => atualizarContato("celular", valor)}
                  limparAvisos={limpezaDosAvisos}
                  {...control}
                />
              )}
            </FormField>
            <FormField
              id={ID_DO_CAMPO.telefone}
              label={rotuloOpcional("Telefone")}
              help={DICA_DE_FORMATO.telefone}
              {...(erros.telefone ? { error: erros.telefone } : {})}
            >
              {(control) => (
                <CampoMascarado
                  mascara="telefone"
                  value={contatos.telefone}
                  onValorChange={(valor) => atualizarContato("telefone", valor)}
                  limparAvisos={limpezaDosAvisos}
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
              label={rotuloOpcional("Matrícula")}
              help="Letras maiúsculas, números, - e _ (2 a 32 caracteres). Pode ficar em branco."
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
          {/* T179 — um seletor por referência: Departamento e Cargo
              (obrigatórios) e a Unidade (opcional) na primeira linha; os
              demais opcionais na segunda, com a Área logo abaixo do
              Departamento que a filtra. */}
          <div className="nova-admissao__linha nova-admissao__linha--3">
            {seletorDeLotacao({
              campo: "departamento",
              rotulo: "Departamento",
              obrigatorio: true,
              valor: campos.departamentoId,
              lista: opcoes.departamentos,
              aoMudar: (id) => void selecionarDepartamento(id),
              vazio: "Nenhum departamento ativo",
            })}
            {seletorDeLotacao({
              campo: "cargo",
              rotulo: "Cargo",
              obrigatorio: true,
              valor: campos.cargoId,
              lista: opcoes.cargos,
              aoMudar: (id) => atualizar("cargoId", id, "cargo", "lotacao"),
              vazio: "Nenhum cargo ativo",
            })}
            {seletorDeLotacao({
              campo: "unidade",
              rotulo: "Unidade",
              obrigatorio: false,
              valor: campos.unidadeId,
              lista: opcoes.unidades,
              aoMudar: (id) => atualizar("unidadeId", id, "unidade", "lotacao"),
              vazio: "Nenhuma unidade ativa",
            })}
          </div>
          <div className="nova-admissao__linha nova-admissao__linha--3">
            {seletorDeLotacao({
              campo: "area",
              rotulo: "Área",
              obrigatorio: false,
              valor: campos.areaId,
              lista: areas,
              aoMudar: (id) => atualizar("areaId", id, "area", "lotacao"),
              ajuda:
                "Escolha antes o departamento: a lista mostra só as áreas dele.",
              vazio: campos.departamentoId
                ? carregandoAreas
                  ? "Carregando áreas…"
                  : "Nenhuma área ativa neste departamento"
                : "Escolha antes o departamento",
              desabilitado: !campos.departamentoId || carregandoAreas,
            })}
            {seletorDeLotacao({
              campo: "equipe",
              rotulo: "Equipe",
              obrigatorio: false,
              valor: campos.equipeId,
              lista: opcoes.equipes,
              aoMudar: (id) => atualizar("equipeId", id, "equipe", "lotacao"),
              vazio: "Nenhuma equipe ativa",
            })}
            {seletorDeLotacao({
              campo: "centroCusto",
              rotulo: "Centro de custo",
              obrigatorio: false,
              valor: campos.centroCustoId,
              lista: opcoes.centrosCusto,
              aoMudar: (id) =>
                atualizar("centroCustoId", id, "centroCusto", "lotacao"),
              vazio: "Nenhum centro de custo ativo",
            })}
          </div>
          {erros.lotacao ? (
            <p
              className="nova-admissao__erro-geral"
              role="alert"
              id={ID_DO_CAMPO.lotacao}
              tabIndex={-1}
            >
              {erros.lotacao}
            </p>
          ) : null}
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
        {erros.geral && envioDivergente ? (
          // T179 — saída clara do 422 divergente: recomeçar gera uma chave
          // nova (o formulário volta vazio, porque a admissão anterior pode
          // já existir), e conferir leva à listagem pelo caminho de sempre,
          // com a confirmação de descarte se houver dados digitados.
          <div className="nova-admissao__acoes-recusa">
            <p className="nova-admissao__texto">
              Recomeçar limpa o formulário e prepara um envio novo.
            </p>
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={pedirCancelamento}
              >
                Conferir em Colaboradores
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={recomecarComNovaChave}
              >
                Recomeçar a admissão
              </Button>
            </FormActions>
          </div>
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
            id={ID_BOTAO_SALVAR}
            disabled={salvando || carregandoOpcoes}
          >
            Salvar
          </Button>
        </FormActions>
      </form>

      {/* T179 — confirmação antes de gravar: confirmação curta, o uso de
          modal que a decisão do `DP-FLX-21` mantém. O resumo traz só o que
          identifica a admissão — nunca contatos, endereço ou nascimento. O
          modal não grava: só "Confirmar cadastro" envia, e enquanto envia ele
          não fecha (`bloqueado`). */}
      <Modal
        aberto={confirmando && empresa !== undefined}
        titulo="Confirmar cadastro de colaborador?"
        descricao="Confira os dados abaixo. Nada é gravado até você escolher Confirmar cadastro."
        onFechar={voltarERevisar}
        bloqueado={salvando}
        rodape={
          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={voltarERevisar}
              disabled={salvando}
            >
              Voltar e revisar
            </Button>
            <Button
              type="button"
              variant="primary"
              aria-disabled={salvando}
              onClick={() => void confirmarCadastro()}
            >
              {salvando ? "Cadastrando…" : "Confirmar cadastro"}
            </Button>
          </FormActions>
        }
      >
        {empresa ? (
          <dl className="nova-admissao__resumo">
            <dt>Empresa ativa</dt>
            <dd>
              {empresa.nome} ({empresa.codigo})
            </dd>
            <dt>Nome</dt>
            <dd>{campos.nome.trim()}</dd>
            <dt>Matrícula</dt>
            <dd>{campos.matricula.trim().toUpperCase() || "Não informada"}</dd>
            <dt>Tipo de vínculo</dt>
            <dd>{campos.tipo ? ROTULO_TIPO_VINCULO[campos.tipo] : ""}</dd>
            <dt>Data de admissão</dt>
            <dd>{formatarDiaCivil(campos.dataAdmissao)}</dd>
            <dt>Lotação inicial</dt>
            <dd>
              <ul className="nova-admissao__lista-lotacao">
                {/* T179 — o opcional vazio diz "Não informada/o", no
                    gênero do campo. */}
                {(
                  [
                    [
                      "Departamento",
                      escolhida(opcoes.departamentos, campos.departamentoId),
                      "Não informado",
                    ],
                    [
                      "Cargo",
                      escolhida(opcoes.cargos, campos.cargoId),
                      "Não informado",
                    ],
                    [
                      "Unidade",
                      escolhida(opcoes.unidades, campos.unidadeId),
                      "Não informada",
                    ],
                    ["Área", escolhida(areas, campos.areaId), "Não informada"],
                    [
                      "Equipe",
                      escolhida(opcoes.equipes, campos.equipeId),
                      "Não informada",
                    ],
                    [
                      "Centro de custo",
                      escolhida(opcoes.centrosCusto, campos.centroCustoId),
                      "Não informado",
                    ],
                  ] as const
                ).map(([rotulo, valor, vazio]) => (
                  <li key={rotulo}>
                    {rotulo}: {valor ?? vazio}
                  </li>
                ))}
              </ul>
            </dd>
          </dl>
        ) : null}
        {salvando ? (
          <p className="nova-admissao__texto" role="status">
            Cadastrando… Aguarde a confirmação do servidor.
          </p>
        ) : null}
      </Modal>

      {/* Confirmação de descarte: é confirmação curta, o uso de modal que a
          decisão do `DP-FLX-21` mantém. O cadastro em si nunca abre em modal. */}
      <Modal
        aberto={confirmandoDescarte}
        titulo="Descartar esta admissão?"
        descricao={
          envioIncerto ? DESCARTE_COM_ENVIO_INCERTO : DESCARTE_SEM_ENVIO_INCERTO
        }
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
 * Lotação inicial como o SERVIDOR a gravou: cada referência devolvida na
 * resposta, nomeada pelas opções que a própria página carregou do servidor.
 * Se o registro não estiver entre elas, diz só o tipo — nunca um id cru.
 */
function lotacaoGravada(
  destino: AdmissaoRegistradaApi["movimentacao"]["destino"],
  opcoes: Opcoes,
  areas: AreaApi[],
): string[] {
  const nomear = (
    lista: readonly Referencia[],
    id: string | null,
    rotulo: string,
    registrada: string,
  ): string[] => {
    if (!id) return [];
    const achado = lista.find((r) => r.id === id);
    return [achado ? `${rotulo}: ${rotuloDaReferencia(achado)}` : registrada];
  };
  const linhas = [
    ...nomear(
      opcoes.departamentos,
      destino.departamentoId,
      "Departamento",
      "Departamento registrado",
    ),
    ...nomear(opcoes.cargos, destino.cargoId, "Cargo", "Cargo registrado"),
    // T179 — a Unidade é opcional: sem ela, a confirmação diz isso.
    ...(destino.unidadeOrganizacionalId
      ? nomear(
          opcoes.unidades,
          destino.unidadeOrganizacionalId,
          "Unidade",
          "Unidade registrada",
        )
      : ["Unidade: Não informada"]),
    ...nomear(areas, destino.areaId, "Área", "Área registrada"),
    ...nomear(opcoes.equipes, destino.equipeId, "Equipe", "Equipe registrada"),
    ...nomear(
      opcoes.centrosCusto,
      destino.centroCustoId,
      "Centro de custo",
      "Centro de custo registrado",
    ),
  ];
  return linhas.length > 0 ? linhas : ["Sem referência registrada"];
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
  const enderecoGravado = admissao.endereco;
  const contatosGravados = admissao.contatos;
  const cepBrasileiro = ehPaisBrasil(enderecoGravado?.pais);
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
          {/* T179 — matrícula opcional: o servidor devolve `null`. */}
          <dd>{admissao.vinculo.matricula ?? "Não informada"}</dd>
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
            <ul className="nova-admissao__lista-lotacao">
              {lotacaoGravada(admissao.movimentacao.destino, opcoes, areas).map(
                (linha) => (
                  <li key={linha}>{linha}</li>
                ),
              )}
            </ul>
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
            // T179 — o sexo gravado é código: aparece pelo rótulo.
            [CAMPO_SEXO.rotulo, rotuloDoSexo(admissao.perfilPessoal.sexo)],
            ...CAMPOS_TEXTO_PERFIL.map(
              (c) => [c.rotulo, admissao.perfilPessoal[c.chave]] as const,
            ),
          ]}
        />
        <ResumoGravado
          titulo="Endereço"
          id="nova-admissao-sucesso-endereco"
          linhas={
            enderecoGravado
              ? CAMPOS_ENDERECO.map((c) => {
                  const valor = enderecoGravado[c.chave];
                  // T179 — CEP brasileiro gravado em 8 dígitos; exibido
                  // `00000-000`.
                  return [
                    c.rotulo,
                    c.chave === "cep" && valor !== null
                      ? exibirCep(valor, cepBrasileiro)
                      : valor,
                  ] as const;
                })
              : null
          }
        />
        <ResumoGravado
          titulo="Contatos"
          id="nova-admissao-sucesso-contatos"
          // T179 — admissão sem contatos não cria registro: o bloco diz isso
          // com o mesmo texto que a ficha mostra depois.
          vazio="Nenhum contato registrado."
          linhas={
            // T179 — contatos opcionais: sem nenhum, o bloco diz isso; cada
            // ausente aparece como "Não informado".
            contatosGravados
              ? [
                  ["E-mail pessoal", contatosGravados.emailPessoal],
                  // T179 — gravados em `+55` + DDD + número; exibidos na
                  // forma brasileira.
                  [
                    "Celular",
                    contatosGravados.celular === null
                      ? null
                      : exibirTelefone(contatosGravados.celular),
                  ],
                  [
                    "Telefone",
                    contatosGravados.telefone === null
                      ? null
                      : exibirTelefone(contatosGravados.telefone),
                  ],
                ]
              : null
          }
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
  vazio = "Nada informado neste bloco.",
}: {
  titulo: string;
  id: string;
  linhas: readonly (readonly [string, string | null])[] | null;
  /** Texto do bloco sem nenhum registro gravado. */
  vazio?: string;
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
        <p className="nova-admissao__texto">{vazio}</p>
      )}
    </section>
  );
}
