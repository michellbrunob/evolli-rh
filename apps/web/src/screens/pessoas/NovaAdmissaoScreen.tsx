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
 * da proprietária (T179, `OPCOES_SEXO`).
 *
 * T180 — o RH cadastra Departamento, Cargo e Unidade sem sair da página, pelo
 * botão "+" ao lado de cada seletor (`ModalReferenciaRapida`: só código e
 * nome). A referência criada entra no seletor já escolhida, e cancelar não
 * toca na admissão. O DP não vê o botão; o servidor continua decidindo quem
 * grava. Área, Equipe e Centro de custo seguem sem cadastro rápido.
 *
 * T178 — o CEP brasileiro pode SUGERIR logradouro, bairro, cidade e estado
 * (consulta autorizada pela proprietária, feita pelo servidor em
 * `GET /v1/cep/:cep`). É assistência, não fonte: preenche só campo vazio,
 * nunca toca número nem complemento, tudo continua editável, e falha da
 * consulta não impede o cadastro manual nem o envio.
 *
 * ## T195 — quatro etapas
 *
 * A página é um fluxo guiado (fatia 2 do dossiê da T194): **Dados pessoais**
 * (dados pessoais e contatos), **Dados profissionais e vínculo** (vínculo,
 * lotação e, para o RH, jornada), **Endereço** e **Revisão e conclusão**. Os
 * campos, as regras, as máscaras e o contrato são os de sempre; só a
 * disposição mudou.
 *
 * - Os quatro painéis ficam montados e só o da etapa atual aparece (`hidden`):
 *   "Voltar", o indicador e "Editar" nunca perdem nada, nem o estado interno
 *   das máscaras e do CEP.
 * - "Próxima etapa" (ou Enter) valida SÓ a etapa atual; com erro, a etapa fica e
 *   o foco vai ao primeiro campo inválido. O indicador volta a qualquer etapa
 *   alcançada e, para ir adiante, valida as etapas do caminho, uma a uma: não
 *   há salto sem validar.
 * - Ao mudar de etapa, o foco vai ao título dela.
 * - A revisão mostra o que foi digitado (opcional em branco não aparece),
 *   cada bloco com "Editar", e avisa que documentos virão em entrega própria
 *   — nada de arquivo aqui. "Concluir" valida TUDO e abre a mesma
 *   confirmação da T179; erro, inclusive recusa do servidor, abre a etapa do
 *   primeiro campo a corrigir.
 * - Sem rascunho no servidor nem no navegador: recarregar a página começa do
 *   zero, na etapa 1, como antes.
 *
 * ## Única porta da admissão
 *
 * O formulário transitório em modal da tela de Colaboradores (T176) foi
 * aposentado na T177: não coletava os campos obrigatórios. "Novo colaborador"
 * traz para esta página.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  CadastroEmEtapas,
  LinhaDoCadastro,
  SecaoDoCadastro,
} from "../../components/cadastro/CadastroEmEtapas";
import {
  Button,
  CampoMascarado,
  FormActions,
  FormField,
  Modal,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import { IconeSucesso } from "../../ui/icones";
import {
  type AdmissaoRegistradaApi,
  type AdmitirColaboradorDto,
  type ContratoAdmissaoApi,
  listarColaboradores,
  type ColaboradorApi,
  type TipoVinculo,
  admitirColaborador,
  descartarRascunhoAdmissao,
  enviarFotoColaborador,
  obterRascunhoAdmissao,
  salvarRascunhoAdmissao,
  type DadosDoRascunhoApi,
  type RascunhoAdmissaoApi,
} from "../../api/colaboradoresClient";
import {
  type AreaApi,
  type EmpresaApi,
  type EquipeApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { criarCargo, listarCargos } from "../../api/cargoClient";
import {
  calcularSalarioLiquido,
  formatarReais,
  lerValorEmReais,
} from "./salarioLiquido";
import { completarReais, mascararReais } from "../../format/moeda";
import {
  type TabelaHorarioApi,
  listarTabelasHorario,
} from "../../api/horariosClient";
import { rotuloDaJornada } from "./jornadaColaborador";
import { UFS, siglaDaUf } from "./ufs";
import {
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../api/csrfClient";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import { exibirCep, exibirTelefone } from "../../format/mascaras";
import {
  CAMPOS_ENDERECO,
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
  validarEndereco,
  validarPerfil,
} from "./dadosPessoais";
import {
  type CampoContato,
  type ValoresContatos,
  contatosDaAdmissao,
  normalizarTelefone,
  validarContatos,
} from "./contatosColaborador";
import {
  ModalReferenciaRapida,
  type ReferenciaCriada,
  type TipoReferenciaRapida,
} from "./ModalReferenciaRapida";
import {
  ModalCriacaoInline,
  type TipoReferenciaInline,
} from "./ModalCriacaoInline";
import { listaComE, useCepAssistido } from "./cepAssistido";
import {
  type ListarReferencias,
  type ReferenciaEscolhida,
  rotuloDaReferenciaEscolhida,
  SeletorDeReferencia,
  TAMANHO_DA_PAGINA_DE_REFERENCIAS,
} from "./SeletorDeReferencia";
import { MENSAGEM_CPF_EM_USO, useCpfEmUso } from "./useCpfEmUso";
import {
  EtapaDocumentos,
  documentosIniciais,
  type DocumentoDaEtapa,
} from "./documentos/EtapaDocumentos";
import {
  EnvioDosDocumentos,
  algumEnviando,
  enviarDocumentoDaEtapa,
  type EnvioDeDocumento,
} from "./documentos/EnvioDosDocumentos";
import { novaChaveDeEnvio } from "./documentos/documentosDoColaborador";
import "./NovaAdmissaoScreen.css";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import { useGuardaDeSaida } from "../../app/guardaDeSaida";
import { plural } from "../../format/plural";

export const NOVA_ADMISSAO_TITULO_ID = "nova-admissao-titulo";

/** Mesmo padrão de `MATRICULA_PATTERN` do contrato (`pessoas.dto.ts`). */
const MATRICULA_PATTERN = /^[A-Z0-9_-]{2,32}$/;

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  aprendiz: "Aprendiz",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
  part_time: "Part-time",
  freelancer: "Freelancer",
  trainee: "Trainee",
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

/**
 * T180 — a referência criada entra na lista na posição do código, a ordem em
 * que o servidor já devolve (`codigo` crescente); o resto da lista fica como
 * veio. Se o id já estiver lá (recarga anterior), não duplica.
 */
function comReferenciaNova<T extends Referencia>(
  lista: readonly T[],
  nova: T,
): T[] {
  const sem = lista.filter((r) => r.id !== nova.id);
  const posicao = sem.findIndex((r) => r.codigo > nova.codigo);
  return posicao === -1
    ? [...sem, nova]
    : [...sem.slice(0, posicao), nova, ...sem.slice(posicao)];
}

/** T180 — nome acessível do "+" de cada seletor. */
const ROTULO_DO_BOTAO_REFERENCIA: Record<TipoReferenciaRapida, string> = {
  departamento: "Cadastrar novo departamento",
  cargo: "Cadastrar novo cargo",
  unidade: "Cadastrar nova unidade",
};

// T178 — preenchimento ASSISTIDO do endereço pelo CEP: a consulta e o que
// fazer com a resposta ficam em `cepAssistido.ts` (T181), compartilhados com
// a edição do endereço na ficha do colaborador.

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
  | ChaveIdentificacao
  | ChavePerfil
  | ChaveEndereco
  | CampoContato
  | "matricula"
  | "tipo"
  | "dataAdmissao"
  | CampoLotacao
  | "lotacao"
  // T209 — etapa 2: contrato da admissão.
  | "nivel"
  | "gestorDireto"
  | "jornadaSemanalHoras"
  | "escala"
  | "salarioBruto"
  | "conselhoProfissional"
  | "registroProfissional"
  | "dependentesIrrf"
  | "pensaoAlimenticiaPercentual"
  // T183 — jornada de trabalho opcional (só o RH a vê).
  | "jornada"
  | "geral";

type Erros = Partial<Record<CampoErro, string>>;

/**
 * T195 — as quatro etapas do cadastro individual, na ordem da tela.
 */
const ETAPAS = [
  // T209 — etapa 1 do Novo colaborador (2026-11-17): títulos, subtítulos e
  // descrições do novo cadastro. T213 — a etapa 4 é "Documentos" (opcional).
  "Dados básicos",
  "Dados profissionais",
  "Endereço",
  "Documentos",
] as const;

/** T209 — o subtítulo de cada etapa, na coluna das etapas. */
const SUBTITULOS_DAS_ETAPAS = [
  "Informações pessoais",
  "Cargo e contrato",
  "Residência",
  "Envio de arquivos",
] as const;

/** T209 — a descrição de cada etapa, no cabeçalho dela. */
const DESCRICOES_DAS_ETAPAS = [
  "Informações pessoais e de contato do novo colaborador.",
  "Cargo, contrato e remuneração do novo colaborador.",
  "Residência usada em correspondências e no eSocial.",
  "Opcional. Os arquivos são enviados ao concluir o cadastro.",
] as const;

type IndiceEtapa = 0 | 1 | 2 | 3;

const ULTIMA_ETAPA: IndiceEtapa = 3;

/** T195 — o título de cada etapa recebe o foco ao avançar e ao voltar. */
function idDoTituloDaEtapa(indice: IndiceEtapa): string {
  return `nova-admissao-etapa-${indice + 1}-titulo`;
}

/**
 * T195 — os campos de cada etapa, na ordem visual dentro dela. A revisão não
 * tem campo próprio.
 *
 * T178 — o e-mail pessoal fica ao lado do nome (disposição pedida pela
 * proprietária). É o MESMO campo dos contatos da T169 — mesmo estado, mesma
 * validação, e vai em `contatos.emailPessoal` no corpo.
 *
 * T179 — `referencias` é o aviso de empresa sem Departamento ou Cargo
 * ativos, no bloco da empresa, sempre visível: com ele, nada é enviado. T195 —
 * conta como da etapa da lotação, onde o "+" do RH resolve o que falta.
 */
const CAMPOS_DA_ETAPA: readonly (readonly CampoErro[])[] = [
  [
    // T209 — a ordem da etapa 1: identificação, contato e emergência.
    "nome",
    "cpf",
    "rg",
    "dataNascimento",
    "genero",
    "estadoCivil",
    "emailPessoal",
    "celular",
    "contatoEmergenciaNome",
    "contatoEmergenciaTelefone",
  ],
  [
    // T209 — a ordem da etapa 2: cargo e estrutura, contrato, remuneração e
    // informações adicionais.
    "referencias",
    "cargo",
    "nivel",
    "departamento",
    "area",
    "centroCusto",
    "unidade",
    "gestorDireto",
    "tipo",
    "dataAdmissao",
    "jornadaSemanalHoras",
    "escala",
    "matricula",
    "salarioBruto",
    "conselhoProfissional",
    "registroProfissional",
    "dependentesIrrf",
    "pensaoAlimenticiaPercentual",
    "equipe",
    "lotacao",
    "jornada",
  ],
  CAMPOS_ENDERECO.map((c) => c.chave),
  [],
];

/** T195 — a etapa de um campo; `null` para o erro geral, visível em todas. */
function etapaDoCampo(campo: CampoErro): IndiceEtapa | null {
  const indice = CAMPOS_DA_ETAPA.findIndex((campos) => campos.includes(campo));
  return indice === -1 ? null : (indice as IndiceEtapa);
}

/**
 * Ordem visual dos campos, etapa a etapa: o foco vai ao primeiro desta lista
 * com erro.
 */
const ORDEM_DOS_ERROS: readonly CampoErro[] = [
  ...CAMPOS_DA_ETAPA.flat(),
  "geral",
];

const ERRO_GERAL_ID = "nova-admissao-erro-geral";
const ID_BOTAO_SALVAR = "nova-admissao-salvar";
const ID_BOTAO_CONTINUAR = "nova-admissao-continuar";

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
 * T179 (revisão final) — sessão expirada: 401 da admissão ou 401 na renovação
 * do token (`CsrfSessionExpiredError`). O servidor não aceitou ESTE pedido (ou
 * ele nem saiu): não é envio incerto.
 */
const MENSAGEM_SESSAO_EXPIRADA =
  "Sua sessão expirou e o cadastro não foi gravado. Entre de novo para continuar; os dados digitados foram mantidos nesta página.";

/**
 * T179 (revisão final) — a renovação do token falhou por rede ou 5xx
 * (`CsrfRequestError`): o pedido de admissão nem saiu.
 */
const MENSAGEM_FALHA_AO_PREPARAR =
  "Não foi possível preparar o envio e o cadastro não foi enviado. Confira a conexão e confirme de novo.";

/**
 * T179 (revisão definitiva) — 403 `csrf_invalido`: a sessão vale, mas o token
 * desta página ficou desatualizado (outra aba o renovou). O cliente já o
 * descartou; confirmar de novo renova o token e reenvia o MESMO pedido, com a
 * mesma chave. Não afirma nem nega gravação de um envio anterior.
 */
const MENSAGEM_PAGINA_DESATUALIZADA =
  "Esta página ficou desatualizada. Confirme novamente; seus dados foram mantidos.";

/**
 * T179 (revisão definitiva) — depois de um envio incerto, a falha de sessão ou
 * de preparo de um pedido SEGUINTE nada diz sobre o anterior: as mensagens não
 * podem negar a gravação e mantêm a orientação de conferir Colaboradores. A
 * chave segue a mesma, então reconfirmar não duplica.
 */
const MENSAGEM_SESSAO_EXPIRADA_APOS_INCERTO =
  "Sua sessão expirou. Um envio anterior pode ter sido registrado: depois de entrar de novo, confira em Colaboradores; se ele não estiver lá, confirme de novo nesta página — o mesmo envio não cria um segundo cadastro. Os dados digitados foram mantidos.";
const MENSAGEM_FALHA_AO_PREPARAR_APOS_INCERTO =
  "Não foi possível preparar o envio agora. Um envio anterior pode ter sido registrado: confira em Colaboradores antes de tentar de novo; o mesmo envio não cria um segundo cadastro.";

/**
 * T179 — a confirmação de descarte. "Nada foi salvo." só é verdade quando
 * nenhum envio ficou incerto; depois de falha de rede, de 5xx (T179, revisão
 * final) ou de 422 `idempotencia_conteudo_divergente`, um envio anterior pode
 * ter sido registrado, e o texto não afirma nem nega gravação.
 */
/**
 * T179/T200 — a frase a mais que a Nova admissão declara para o diálogo único
 * da guarda, em qualquer saída: sem envio incerto, é certo que nada foi
 * salvo; com ele, descartar a página não desfaz o que pode ter sido gravado.
 */
const AVISO_NADA_SALVO = "Nada da Nova admissão foi salvo.";
const AVISO_ENVIO_INCERTO =
  "Um envio anterior da Nova admissão pode ter sido registrado: confira em Colaboradores.";

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
 * de o proxy responder. T179 (revisão final) — sessão expirada e falha ao
 * renovar o token não têm `status`, mas não são envio incerto: o servidor não
 * aceitou o cadastro, ou ele nem saiu.
 */
function envioSemConfirmacao(erro: unknown): boolean {
  if (
    falhaPorSessaoExpirada(erro) ||
    falhaAoPrepararEnvio(erro) ||
    falhaPorTokenDesatualizado(erro)
  ) {
    return false;
  }
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
  // T209 — CPF único na empresa.
  "perfilPessoal.cpf": {
    campo: "cpf",
    mensagem: MENSAGEM_CPF_EM_USO,
  },
  // T209 — gestor direto sem vínculo na empresa.
  "contrato.gestorDiretoId": {
    campo: "gestorDireto",
    mensagem: "Este gestor não está disponível nesta empresa.",
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
 *    gravou; confirmar de novo, com a mesma chave, é seguro;
 *  - T179 (revisão final) — 401 ou `CsrfSessionExpiredError`: sessão
 *    expirada; T179 (revisão definitiva) — 403 com `codigo: "csrf_invalido"`:
 *    página desatualizada (sessão válida), confirmar de novo reenvia o mesmo
 *    pedido; o 403 sem código continua sendo de permissão. Depois de um envio
 *    incerto, nenhuma dessas mensagens nega a gravação do anterior;
 *  - T179 (revisão final) — `CsrfRequestError`: o token não foi renovado e o
 *    pedido nem saiu.
 *
 * Em todos os casos os dados digitados ficam na página.
 */
function errosDaRecusa(erro: unknown, envioJaIncerto: boolean): Erros {
  if (falhaPorTokenDesatualizado(erro)) {
    return { geral: MENSAGEM_PAGINA_DESATUALIZADA };
  }
  if (falhaPorSessaoExpirada(erro)) {
    return {
      geral: envioJaIncerto
        ? MENSAGEM_SESSAO_EXPIRADA_APOS_INCERTO
        : MENSAGEM_SESSAO_EXPIRADA,
    };
  }
  if (falhaAoPrepararEnvio(erro)) {
    return {
      geral: envioJaIncerto
        ? MENSAGEM_FALHA_AO_PREPARAR_APOS_INCERTO
        : MENSAGEM_FALHA_AO_PREPARAR,
    };
  }
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
      // T183 — a jornada escolhida deixou de estar disponível (inativada, ou
      // não é da empresa ativa): o erro vai ao campo, sem o valor.
      if (porCampo.some(({ campo }) => campo === "tabelaHorarioId")) {
        return {
          jornada:
            "A jornada escolhida não está mais disponível. Escolha outra jornada ativa ou siga sem jornada.",
        };
      }
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
    // T179 (revisão final) — o 401 é sessão expirada, tratado acima com o 403
    // `csrf_invalido` e a renovação recusada: uma mensagem só.
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
 * Cargo; a Unidade é opcional desde 2026-10-21). O DP, e qualquer outro
 * papel, só lê — para ele, a orientação é pedir ao RH (decisões 6 e 7).
 *
 * T180 — o RH cadastra aqui mesmo, pelo "+" ao lado do seletor, sem sair da
 * página. O aviso é calculado das opções: some quando elas passam a existir.
 */
function mensagemSemReferencias(
  faltando: readonly string[],
  papelDoAtor: string | null,
): string {
  const base = `Esta empresa ainda não tem cadastro ativo de ${listaComE(
    faltando,
  )}, e a admissão exige Departamento e Cargo. Nada será enviado até isso ser resolvido.`;
  if (papelDoAtor === "rh") {
    return `${base} Use o botão "+" ao lado de ${listaComE(
      faltando,
    )}, em Lotação inicial, para cadastrar sem sair desta página.`;
  }
  return `${base} O RH precisa cadastrar ${listaComE(
    faltando,
  )} nesta empresa; depois disso, abra esta página de novo.`;
}

interface Opcoes {
  empresas: EmpresaApi[];
  /**
   * T196 — Departamento, Cargo, Unidade e Centro de custo são escolhidos pela
   * busca no servidor (`SeletorDeReferencia`), não por lista carregada. Estas
   * quatro listas guardam só as referências CONHECIDAS pela página — as
   * escolhidas e as criadas pelo "+" (T180) —, que nomeiam a escolha na
   * revisão, na confirmação e na tela de sucesso.
   */
  departamentos: Referencia[];
  unidades: Referencia[];
  equipes: EquipeApi[];
  cargos: Referencia[];
  centrosCusto: Referencia[];
  /** T183 — só as jornadas ATIVAS, e só para o RH. */
  jornadas: TabelaHorarioApi[];
}

const OPCOES_VAZIAS: Opcoes = {
  empresas: [],
  departamentos: [],
  unidades: [],
  equipes: [],
  cargos: [],
  centrosCusto: [],
  jornadas: [],
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
  /** T183 — jornada de trabalho opcional; vazio é "sem jornada". */
  tabelaHorarioId: string;
  /** T209 — etapa 2: cargo digitado (vira cargo do cadastro ao concluir). */
  cargoNome: string;
  nivel: string;
  gestorDiretoId: string;
  jornadaSemanalHoras: string;
  escala: string;
  /** Em reais, como digitado: "5.000,00". */
  salarioBruto: string;
  conselhoProfissional: string;
  registroProfissional: string;
  dependentesIrrf: string;
  pensaoAlimenticiaPercentual: string;
}

const CONTATOS_VAZIOS: ValoresContatos = {
  emailPessoal: "",
  celular: "",
  telefone: "",
};

const CAMPOS_VAZIOS: Campos = {
  cargoNome: "",
  nivel: "",
  gestorDiretoId: "",
  jornadaSemanalHoras: "",
  escala: "",
  salarioBruto: "",
  conselhoProfissional: "",
  registroProfissional: "",
  dependentesIrrf: "",
  pensaoAlimenticiaPercentual: "",
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
  tabelaHorarioId: "",
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
   * Muda a ORIENTAÇÃO do aviso de empresa sem referências: o RH cadastra; o
   * DP pede ao RH. T180 — e mostra o "+" do cadastro rápido só ao RH. Nunca
   * concede nada: quem grava ou recusa é o servidor.
   */
  readonly papelDoAtor?: string | null;
}

// ---- T209 — foto opcional do colaborador (ADR 0020) ------------------------

/** Mesmo teto do servidor: 5 MB. */
const FOTO_LIMITE_BYTES = 5 * 1024 * 1024;
const FOTO_TIPOS_ACEITOS = "image/png,image/jpeg";
const FOTO_TIPO_POR_EXTENSAO: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
const ID_FOTO_ARQUIVO = "nova-admissao-foto-arquivo";
const ID_FOTO_ENVIAR = "nova-admissao-foto-enviar";
const ID_FOTO_OUTRA = "nova-admissao-foto-outra";

/** A foto escolhida: o arquivo e a URL local da prévia (só nesta aba). */
interface FotoEscolhida {
  readonly arquivo: File;
  readonly url: string;
}

/** O envio da foto, que só acontece depois da admissão concluída. */
type EnvioDaFoto =
  | { readonly estado: "nenhum" }
  | { readonly estado: "enviando" }
  | { readonly estado: "enviada" }
  | {
      readonly estado: "falhou";
      readonly mensagem: string;
      /** Falha passageira: o mesmo arquivo pode ser enviado de novo. */
      readonly podeRepetir: boolean;
    };

/**
 * Conferência rápida no navegador (o servidor confere de novo, pelo
 * conteúdo): PNG ou JPEG, extensão de acordo com o tipo, até 5 MB.
 */
function recusaDaFotoNoNavegador(arquivo: File): string | null {
  const ponto = arquivo.name.lastIndexOf(".");
  const extensao =
    ponto === -1 ? "" : arquivo.name.slice(ponto + 1).toLowerCase();
  const tipoDaExtensao = FOTO_TIPO_POR_EXTENSAO[extensao];
  if (!tipoDaExtensao || tipoDaExtensao !== arquivo.type) {
    return "Use uma imagem PNG ou JPEG.";
  }
  if (arquivo.size > FOTO_LIMITE_BYTES) return "A foto deve ter até 5 MB.";
  return null;
}

const MENSAGEM_DA_RECUSA_DA_FOTO: Readonly<Record<string, string>> = {
  foto_formato_invalido: "Use uma imagem PNG ou JPEG.",
  foto_tipo_divergente:
    "O conteúdo do arquivo não é do formato informado. Use uma imagem PNG ou JPEG.",
  foto_grande_demais: "A imagem é grande demais.",
  foto_pequena: "A imagem é pequena demais: use ao menos 64 × 64 pixels.",
  foto_invalida: "Não foi possível ler a imagem. Escolha outro arquivo.",
};

/** O que dizer da falha do envio, e se repetir o mesmo arquivo adianta. */
function falhaDoEnvioDaFoto(erro: unknown): {
  readonly mensagem: string;
  readonly podeRepetir: boolean;
} {
  const status = statusDe(erro);
  const { codigo } = detalhesDe(erro);
  if (status === 413) {
    return { mensagem: "A foto deve ter até 5 MB.", podeRepetir: false };
  }
  if (status === 422 || status === 415) {
    return {
      mensagem:
        (codigo && MENSAGEM_DA_RECUSA_DA_FOTO[codigo]) ??
        "A imagem foi recusada. Escolha outro arquivo.",
      podeRepetir: false,
    };
  }
  if (status === 403 || status === 404) {
    return {
      mensagem: "Sem permissão para enviar a foto deste colaborador.",
      podeRepetir: false,
    };
  }
  return {
    mensagem: "O envio não foi concluído. Tente de novo em instantes.",
    podeRepetir: true,
  };
}

// ---- T209 — etapa 2 do Novo colaborador ------------------------------------

/** Tipo de contratação, na ordem da etapa 2 (sete opções). */
const TIPOS_DE_CONTRATACAO: readonly TipoVinculo[] = [
  "clt",
  "pj",
  "estagio",
  "aprendiz",
  "part_time",
  "freelancer",
  "trainee",
];

export const OPCOES_NIVEL = [
  { codigo: "sem_nivel", rotulo: "Sem nível" },
  { codigo: "primeiro_emprego", rotulo: "Primeiro emprego" },
  { codigo: "junior", rotulo: "Júnior" },
  { codigo: "pleno", rotulo: "Pleno" },
  { codigo: "senior", rotulo: "Sênior" },
  { codigo: "lider_tecnico", rotulo: "Líder técnico" },
  { codigo: "coordenador", rotulo: "Coordenador" },
  { codigo: "gerente", rotulo: "Gerente" },
  { codigo: "head", rotulo: "Head" },
  { codigo: "diretor", rotulo: "Diretor" },
  { codigo: "vp", rotulo: "VP" },
  { codigo: "c_level", rotulo: "C-Level" },
] as const;

/** Escalas: nome e descrição (dias de trabalho no mês). */
export const OPCOES_ESCALA = [
  { codigo: "nao_informada", nome: "Não informada", descricao: "" },
  {
    codigo: "5x2",
    nome: "5x2",
    descricao: "Dias fixos na semana · Segunda a sexta, folga sábado e domingo",
  },
  {
    codigo: "6x1",
    nome: "6x1",
    descricao:
      "Dias fixos na semana · Seis dias de trabalho e uma folga · 26 dias no mês",
  },
  {
    codigo: "semana_espanhola",
    nome: "Semana espanhola",
    descricao:
      "Dias fixos na semana · Semanas de 5 e 6 dias alternadas (sábado sim, sábado não) · 24 dias no mês",
  },
  {
    codigo: "4x3",
    nome: "4x3",
    descricao:
      "Dias fixos na semana · Quatro dias de trabalho e três de folga · 17 dias no mês",
  },
  {
    codigo: "fim_de_semana",
    nome: "Fim de semana",
    descricao: "Dias fixos na semana · Só sábado e domingo · 9 dias no mês",
  },
  {
    codigo: "5x1",
    nome: "5x1",
    descricao:
      "Revezamento em dias · Cinco dias de trabalho e uma folga, em rodízio · 25 dias no mês",
  },
  {
    codigo: "6x2",
    nome: "6x2",
    descricao:
      "Revezamento em dias · Seis dias de trabalho e duas folgas · 23 dias no mês",
  },
  {
    codigo: "4x2",
    nome: "4x2",
    descricao:
      "Revezamento em dias · Quatro dias de trabalho e duas folgas · 20 dias no mês",
  },
  {
    codigo: "2x2",
    nome: "2x2",
    descricao:
      "Revezamento em dias · Dois dias de trabalho e dois de folga · 15 dias no mês",
  },
  {
    codigo: "3x3",
    nome: "3x3",
    descricao:
      "Revezamento em dias · Três dias de trabalho e três de folga · 15 dias no mês",
  },
  {
    codigo: "4x4",
    nome: "4x4",
    descricao:
      "Revezamento em dias · Quatro dias de trabalho e quatro de folga · 15 dias no mês",
  },
  {
    codigo: "12x36",
    nome: "12x36",
    descricao:
      "Plantão em horas · 12 horas de trabalho e 36 de descanso · 15 dias no mês",
  },
  {
    codigo: "12x60",
    nome: "12x60",
    descricao:
      "Plantão em horas · 12 horas de trabalho e 60 de descanso · 10 dias no mês",
  },
  {
    codigo: "12x72",
    nome: "12x72",
    descricao:
      "Plantão em horas · 12 horas de trabalho e 72 de descanso · 9 dias no mês",
  },
  {
    codigo: "18x36",
    nome: "18x36",
    descricao:
      "Plantão em horas · 18 horas de trabalho e 36 de descanso · 13 dias no mês",
  },
  {
    codigo: "24x48",
    nome: "24x48",
    descricao:
      "Plantão em horas · 24 horas de trabalho e 48 de descanso · 10 dias no mês",
  },
  {
    codigo: "24x72",
    nome: "24x72",
    descricao:
      "Plantão em horas · 24 horas de trabalho e 72 de descanso · 8 dias no mês",
  },
  {
    codigo: "7x7",
    nome: "7x7",
    descricao:
      "Embarque e alojamento · Sete dias embarcado e sete de folga · 15 dias no mês",
  },
  {
    codigo: "14x14",
    nome: "14x14",
    descricao:
      "Embarque e alojamento · 14 dias embarcado e 14 de folga · 15 dias no mês",
  },
  {
    codigo: "14x21",
    nome: "14x21",
    descricao:
      "Embarque e alojamento · 14 dias embarcado e 21 de folga · 12 dias no mês",
  },
  {
    codigo: "15x15",
    nome: "15x15",
    descricao:
      "Embarque e alojamento · 15 dias de trabalho e 15 de folga · 15 dias no mês",
  },
  {
    codigo: "20x10",
    nome: "20x10",
    descricao:
      "Embarque e alojamento · 20 dias de trabalho e 10 de folga · 20 dias no mês",
  },
  {
    codigo: "21x21",
    nome: "21x21",
    descricao:
      "Embarque e alojamento · 21 dias de trabalho e 21 de folga · 15 dias no mês",
  },
  {
    codigo: "28x28",
    nome: "28x28",
    descricao:
      "Embarque e alojamento · 28 dias de trabalho e 28 de folga · 15 dias no mês",
  },
  {
    codigo: "outra",
    nome: "Outra",
    descricao: "Outra · Escala diferente: benefícios usam os dias úteis do mês",
  },
] as const;

export const OPCOES_CONSELHO = [
  { codigo: "nenhum", rotulo: "Nenhum" },
  ...(
    [
      "oab",
      "crm",
      "coren",
      "cro",
      "crp",
      "crea",
      "cau",
      "cra",
      "crc",
      "crf",
      "crn",
      "cref",
      "crefito",
      "crbm",
      "crtr",
    ] as const
  ).map((codigo) => ({ codigo, rotulo: codigo.toUpperCase() })),
];

/** Dica da matrícula (ícone de ajuda ao lado do rótulo). */
const DICA_DA_MATRICULA =
  "Código da pessoa na folha ou na contabilidade (matrícula, registro ou chapa). Serve para achar a pessoa quando um documento não traz o CPF.";

/** T209 — o cargo digitado não pôde virar cargo do cadastro. */
class CargoIndisponivel extends Error {}

/** Gestor direto: as pessoas da empresa ativa, com o cargo vigente. */
interface OpcaoDeGestor {
  readonly id: string;
  readonly nome: string;
  readonly cargo: string | null;
}

// ---- T209 — etapa 1 do Novo colaborador ------------------------------------

/** Campos novos da etapa 1, fora do perfil compartilhado com a ficha. */
type ChaveIdentificacao =
  | "cpf"
  | "rg"
  | "genero"
  | "contatoEmergenciaNome"
  | "contatoEmergenciaTelefone";
type ValoresIdentificacao = Record<ChaveIdentificacao, string>;

const IDENTIFICACAO_VAZIA: ValoresIdentificacao = {
  cpf: "",
  rg: "",
  genero: "",
  contatoEmergenciaNome: "",
  contatoEmergenciaTelefone: "",
};

const CHAVES_IDENTIFICACAO = Object.keys(
  IDENTIFICACAO_VAZIA,
) as ChaveIdentificacao[];

/** Gênero em lista fechada (o código vai ao servidor). */
export const OPCOES_GENERO = [
  { codigo: "feminino", rotulo: "Feminino" },
  { codigo: "masculino", rotulo: "Masculino" },
  { codigo: "outro", rotulo: "Outro" },
  { codigo: "prefiro_nao_informar", rotulo: "Prefiro não informar" },
] as const;

/** Estado civil: o texto da opção é o que fica gravado. */
export const OPCOES_ESTADO_CIVIL = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
] as const;

function rotuloDoGenero(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return OPCOES_GENERO.find((o) => o.codigo === codigo)?.rotulo ?? codigo;
}

/** `00000000000` → `000.000.000-00`, conforme se digita. */
export function mascararCpf(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** CPF gravado (11 dígitos) como a tela mostra. */
function exibirCpf(cpf: string | null | undefined): string | null {
  return cpf ? mascararCpf(cpf) : null;
}

/** Dígitos verificadores do CPF (a mesma regra do servidor). */
export function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const n = [...digitos].map(Number);
  const dv = (quantos: number) => {
    let soma = 0;
    for (let i = 0; i < quantos; i++) soma += n[i]! * (quantos + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === n[9] && dv(10) === n[10];
}

/** Nome completo: pelo menos 3 letras e até 150 caracteres. */
const NOME_TRES_LETRAS = /^(?:[^\p{L}]*\p{L}){3}/u;
const NOME_MAXIMO = 150;

/** Telefone brasileiro como o servidor grava (`+55` + DDD + número). */
const TELEFONE_GRAVADO = /^\+55[1-9]{2}(?:9[0-9]{8}|[2-5][0-9]{7})$/;

function blocoIdentificacao(
  valores: ValoresIdentificacao,
): Record<ChaveIdentificacao, string | null> {
  const limpo = (v: string) => {
    const t = v.trim().replace(/ {2,}/g, " ");
    return t === "" ? null : t;
  };
  const telefone = limpo(valores.contatoEmergenciaTelefone);
  return {
    cpf: limpo(valores.cpf.replace(/\D/g, "")),
    rg: limpo(valores.rg),
    genero: limpo(valores.genero),
    contatoEmergenciaNome: limpo(valores.contatoEmergenciaNome),
    contatoEmergenciaTelefone:
      telefone === null ? null : normalizarTelefone(telefone),
  };
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
  /** T209 — etapa 2: as pessoas da empresa para "Gestor direto". */
  const [gestores, setGestores] = useState<OpcaoDeGestor[]>([]);
  const [dicaDaMatricula, setDicaDaMatricula] = useState(false);
  /** T209 — CPF, RG, gênero e contato de emergência (etapa 1). */
  const [identificacao, setIdentificacao] =
    useState<ValoresIdentificacao>(IDENTIFICACAO_VAZIA);
  const [erros, setErros] = useState<Erros>({});
  // T215 — o CPF repetido aparece enquanto se digita, não só ao gravar.
  const cpfEmUso = useCpfEmUso(identificacao.cpf, cpfValido);
  useEffect(() => {
    if (!cpfEmUso) return;
    setErros((prev) =>
      prev.cpf === MENSAGEM_CPF_EM_USO
        ? prev
        : { ...prev, cpf: MENSAGEM_CPF_EM_USO },
    );
  }, [cpfEmUso]);
  /** T179 — o resumo "Revise N campos" só aparece depois de uma tentativa. */
  /** T179 — o modal "Confirmar cadastro de colaborador?" está aberto. */
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [admissao, setAdmissao] = useState<AdmissaoRegistradaApi | null>(null);
  /** T209 — a foto escolhida (prévia local) e o seu envio, pós-admissão. */
  const [foto, setFoto] = useState<FotoEscolhida | null>(null);
  const [recusaDaFoto, setRecusaDaFoto] = useState<string | null>(null);
  // T213 — documentos da etapa 4: só na memória desta aba (nunca no
  // rascunho); sobem depois de o colaborador ser criado.
  const [documentos, setDocumentos] =
    useState<DocumentoDaEtapa[]>(documentosIniciais);
  const [enviosDosDocumentos, setEnviosDosDocumentos] = useState<
    Record<string, EnvioDeDocumento>
  >({});
  const [envioDaFoto, setEnvioDaFoto] = useState<EnvioDaFoto>({
    estado: "nenhum",
  });
  /** Gatilho de uma vez só: devolver o foco a "Enviar foto". */
  const focarEnviarFotoRef = useRef(false);
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
  /** T195 — a etapa na tela e a mais adiantada já alcançada. */
  const [etapa, setEtapa] = useState<IndiceEtapa>(0);
  const [etapaAlcancada, setEtapaAlcancada] = useState<IndiceEtapa>(0);
  /** T209 — o rascunho salvo ou recuperado, para o aviso curto. */
  const [rascunho, setRascunho] = useState<{
    readonly estado: "salvo" | "recuperado";
    readonly quando: string;
  } | null>(null);
  const [falhaDoRascunho, setFalhaDoRascunho] = useState<string | null>(null);
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);
  /** Os valores do último rascunho salvo ou recuperado (para a guarda). */
  const [assinaturaSalva, setAssinaturaSalva] = useState<string | null>(null);
  /** Depois de recuperar, a assinatura é a do formulário já preenchido. */
  const sincronizarAssinaturaRef = useRef(false);
  /** Trava síncrona contra envio duplicado (cliques no mesmo quadro). */
  const enviandoRef = useRef(false);
  /**
   * T179 — chave de idempotência do envio em curso. Nasce na primeira
   * confirmação e é REPETIDA em cada nova tentativa; só um sucesso ou o
   * recomeço da página a descartam.
   */
  const chaveIdempotenciaRef = useRef<string | null>(null);
  /**
   * Gatilho de uma vez só: o id a focar depois do próximo render — o primeiro
   * erro, já com a mensagem, ou (T195) o título da etapa. O contador garante
   * esse render mesmo quando nada mais muda.
   */
  const focoPendenteRef = useRef<string | null>(null);
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  /** T179 — gatilho de uma vez só: devolver o foco a "Salvar". */
  const focarSalvarRef = useRef(false);
  /** Só a resposta mais recente de áreas vale (troca rápida de departamento). */
  const pedidoAreasRef = useRef(0);
  const sucessoTituloRef = useRef<HTMLHeadingElement | null>(null);
  /** T180 — a referência em cadastro rápido; `null` com o modal fechado. */
  const [referenciaEmCadastro, setReferenciaEmCadastro] =
    useState<TipoReferenciaRapida | null>(null);
  /** T180 — gatilho de uma vez só: devolver o foco ao seletor da referência. */
  const focarSeletorRef = useRef<TipoReferenciaRapida | null>(null);
  /**
   * T180 (revisão) — versão da leitura de cada referência do cadastro rápido.
   * A criação e cada recarga a avançam, e a resposta de uma recarga só vale se
   * ainda for a mais recente.
   */
  const versaoDaListaRef = useRef<Record<TipoReferenciaRapida, number>>({
    departamento: 0,
    cargo: 0,
    unidade: 0,
  });
  /**
   * T196 — a busca de cada seletor relida depois de um cadastro rápido com
   * falha de rede (o servidor pode ter gravado): o seletor descarta o que
   * mostrava e consulta de novo na próxima abertura.
   */
  const [versaoDaBusca, setVersaoDaBusca] = useState<
    Record<TipoReferenciaInline, number>
  >({ departamento: 0, cargo: 0, unidade: 0, centroCusto: 0 });
  /** T197 — a criação inline pedida num seletor; `null` sem confirmação. */
  const [criacaoInline, setCriacaoInline] = useState<{
    tipo: TipoReferenciaInline;
    nome: string;
  } | null>(null);
  /** T197 — gatilho de uma vez só: devolver o foco ao seletor da criação. */
  const focarSeletorDaCriacaoRef = useRef<TipoReferenciaInline | null>(null);
  /** T197 — anúncio da referência criada (ou escolhida), por seletor. */
  const [avisoDaCriacao, setAvisoDaCriacao] = useState<
    Partial<Record<TipoReferenciaInline, { id: number; texto: string }>>
  >({});
  /**
   * T179/T196 — a empresa tem Departamento e Cargo ativos? Sem um deles a
   * admissão não pode seguir (aviso de referências). Sabido por uma consulta
   * de um item só (`total`), não pela lista inteira.
   */
  const [existemAtivos, setExistemAtivos] = useState({
    departamento: true,
    cargo: true,
  });

  const empresa = opcoes.empresas.length === 1 ? opcoes.empresas[0] : undefined;

  // T183 — as jornadas ATIVAS, só para o RH (o DP admite sem jornada). Uma
  // falha aqui não impede a admissão: a jornada é opcional.
  const [carregandoJornadas, setCarregandoJornadas] = useState(
    papelDoAtor === "rh",
  );
  const [jornadasIndisponiveis, setJornadasIndisponiveis] = useState(false);
  // T209 — etapa 2: a jornada da tabela de horário saiu da admissão
  // (decisão de 2026-11-17); a leitura fica para a revisão e o rascunho antigo.
  void carregandoJornadas;
  void jornadasIndisponiveis;
  useEffect(() => {
    if (papelDoAtor !== "rh") return;
    let vigente = true;
    void (async () => {
      try {
        const resp = await listarTabelasHorario({
          ativo: true,
          tamanhoPagina: 100,
        });
        if (!vigente) return;
        setOpcoes((prev) => ({
          ...prev,
          jornadas: resp.itens.filter((j) => j.ativo),
        }));
      } catch {
        if (vigente) setJornadasIndisponiveis(true);
      } finally {
        if (vigente) setCarregandoJornadas(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [papelDoAtor]);
  const jornadaEscolhida = opcoes.jornadas.find(
    (j) => j.id === campos.tabelaHorarioId,
  );

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        // T196 — Departamento e Cargo: só se EXISTE algum ativo (um item);
        // a escolha é pela busca. Unidade e Centro de custo nem são lidos
        // aqui. A Equipe segue como lista.
        const [empresas, departamentos, equipes, cargos] = await Promise.all([
          listarEmpresasMulti(),
          listarDepartamentos({ status: "ativo", tamanhoPagina: 1 }),
          listarEquipes({ status: "ativo", tamanhoPagina: 100 }),
          listarCargos({ status: "ativo", tamanhoPagina: 1 }),
        ]);
        if (!vigente) return;
        setOpcoes((prev) => ({
          ...prev,
          empresas: empresas.itens,
          equipes: soAtivos(equipes.itens),
        }));
        setExistemAtivos({
          departamento: departamentos.total > 0,
          cargo: cargos.total > 0,
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
    const id = focoPendenteRef.current;
    if (!id) return;
    focoPendenteRef.current = null;
    document.getElementById(id)?.focus();
  }, [pedidoDeFoco]);

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

  // T209 — etapa 2: as pessoas da empresa ativa, para "Gestor direto".
  // Falha na leitura deixa a lista só com "Sem gestor".
  useEffect(() => {
    if (!empresa) return undefined;
    let vivo = true;
    void Promise.resolve(listarColaboradores({ tamanhoPagina: 100 }))
      .then((pagina) => {
        if (!vivo) return;
        setGestores(
          (pagina?.itens ?? []).map((c) => ({
            id: c.id,
            nome: c.nome,
            cargo: c.vinculos?.[0]?.lotacaoVigente?.cargo?.nome ?? null,
          })),
        );
      })
      .catch(() => {
        if (vivo) setGestores([]);
      });
    return () => {
      vivo = false;
    };
  }, [empresa]);

  // T209 — a URL local da prévia vale só enquanto a foto é a escolhida:
  // trocada, removida ou a página desmontada, ela é liberada.
  useEffect(() => {
    if (!foto) return undefined;
    return () => URL.revokeObjectURL(foto.url);
  }, [foto]);

  useEffect(() => {
    if (foto || !focarEnviarFotoRef.current) return;
    focarEnviarFotoRef.current = false;
    document.getElementById(ID_FOTO_ENVIAR)?.focus();
  }, [foto]);

  // T180 — ao fechar o cadastro rápido por qualquer caminho, o foco vai ao
  // SELETOR, não ao "+". Este efeito roda depois da limpeza do `Modal`, que
  // devolve o foco a quem o abriu (o botão), e assim prevalece.
  useEffect(() => {
    if (referenciaEmCadastro || !focarSeletorRef.current) return;
    const campo = focarSeletorRef.current;
    focarSeletorRef.current = null;
    document.getElementById(ID_DO_CAMPO[campo])?.focus();
  }, [referenciaEmCadastro]);

  // T197 — ao fechar a confirmação da criação inline por qualquer caminho, o
  // foco volta ao campo de busca do seletor (depois da limpeza do `Modal`).
  useEffect(() => {
    if (criacaoInline || !focarSeletorDaCriacaoRef.current) return;
    const campo = focarSeletorDaCriacaoRef.current;
    focarSeletorDaCriacaoRef.current = null;
    document.getElementById(ID_DO_CAMPO[campo])?.focus();
  }, [criacaoInline]);

  /**
   * T179 — o que falta para admitir nesta empresa: Departamento e Cargo são
   * obrigatórios, e o DP não pode cadastrá-los. A Unidade é opcional: empresa
   * sem unidade ativa admite sem ela. Só se calcula com a empresa resolvida:
   * sem ela, o aviso de empresa indefinida já basta.
   */
  // T209 — etapa 2: Departamento e Cargo passaram a opcionais; empresa sem
  // eles admite do mesmo jeito (o cargo digitado vira cargo do cadastro).
  const referenciasFaltando: string[] = [];
  void existemAtivos;

  const alterado =
    (Object.keys(campos) as (keyof Campos)[]).some(
      (c) => campos[c] !== CAMPOS_VAZIOS[c],
    ) ||
    CHAVES_IDENTIFICACAO.some((c) => identificacao[c] !== "") ||
    (Object.keys(perfil) as ChavePerfil[]).some(
      (c) => perfil[c] !== PERFIL_VAZIO[c],
    ) ||
    (Object.keys(endereco) as ChaveEndereco[]).some(
      (c) => endereco[c] !== ENDERECO_INICIAL[c],
    ) ||
    (Object.keys(contatos) as CampoContato[]).some((c) => contatos[c] !== "");

  // T189 — o cadastro com dados digitados e ainda não registrado é edição
  // pendente; o envio, salvamento em andamento. A troca de empresa pergunta
  // antes de descartar, e espera o envio terminar.
  // T200 — e toda saída do shell, pelo diálogo único, com a frase da T179
  // sobre o que pode (ou não) ter sido gravado.
  // ---- T209 — rascunho persistente (servidor, por conta e empresa) --------

  /** O que o rascunho guarda: só os valores do formulário e a etapa. */
  function dadosDoRascunho(): DadosDoRascunhoApi {
    const preenchidos = (valores: Readonly<Record<string, string>>) =>
      Object.fromEntries(
        Object.entries(valores).filter(([, v]) => v !== ""),
      ) as Record<string, string>;
    const referencia = (lista: readonly Referencia[], id: string) => {
      const r = id ? lista.find((x) => x.id === id) : undefined;
      return r ? { id: r.id, codigo: r.codigo, nome: r.nome } : undefined;
    };
    const referencias = Object.fromEntries(
      (
        [
          [
            "departamento",
            referencia(opcoes.departamentos, campos.departamentoId),
          ],
          ["cargo", referencia(opcoes.cargos, campos.cargoId)],
          ["unidade", referencia(opcoes.unidades, campos.unidadeId)],
          [
            "centroCusto",
            referencia(opcoes.centrosCusto, campos.centroCustoId),
          ],
        ] as const
      ).filter(([, v]) => v !== undefined),
    );
    return {
      etapa,
      campos: preenchidos(campos as unknown as Record<string, string>),
      perfil: preenchidos({
        ...(perfil as unknown as Record<string, string>),
        ...identificacao,
      }),
      endereco: preenchidos(endereco as unknown as Record<string, string>),
      contatos: preenchidos(contatos as unknown as Record<string, string>),
      ...(Object.keys(referencias).length > 0 ? { referencias } : {}),
    };
  }
  const assinaturaAtual = JSON.stringify(dadosDoRascunho());

  // Com o rascunho salvo e nada mudado desde então, sair não perde nada.
  // T209 — a foto nunca vai para o rascunho: escolhida, sair a perde.
  // T213 — os documentos escolhidos também (só na memória desta aba).
  const comDocumentoEscolhido = documentos.some((d) => d.arquivo !== null);
  const pendenteSemRascunho =
    admissao === null &&
    ((alterado && assinaturaAtual !== assinaturaSalva) ||
      foto !== null ||
      comDocumentoEscolhido);
  // T213 — enquanto os documentos sobem, a página não pode ser trocada.
  const enviandoDocumentos =
    admissao !== null && algumEnviando(documentos, enviosDosDocumentos);

  useEdicaoEmAndamento("Nova admissão", {
    pendente: pendenteSemRascunho,
    salvando:
      salvando || envioDaFoto.estado === "enviando" || enviandoDocumentos,
    aviso: envioIncerto ? AVISO_ENVIO_INCERTO : AVISO_NADA_SALVO,
  });

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
    if (campo === "cep" || campo === "pais") consultaCep.descartarResultado();
  }

  // ---- T178 — consulta assistida de CEP (T181: `useCepAssistido`) ---------
  const consultaCep = useCepAssistido({
    endereco,
    // T209 — o Estado é um seletor de siglas: o que o CEP sugerir por
    // extenso entra como sigla.
    setEndereco: (acao) =>
      setEndereco((prev) => {
        const proximo = typeof acao === "function" ? acao(prev) : acao;
        return { ...proximo, estado: siglaDaUf(proximo.estado) };
      }),
    onErroNoCep: (mensagem) => setErros((prev) => ({ ...prev, cep: mensagem })),
    onCamposAjustados: (campos) =>
      setErros((prev) => semErroDe(prev, ...campos)),
    // T209 — sem "Buscar CEP" (a consulta sai ao completar o CEP): o foco
    // volta ao próprio CEP.
    idBotaoBuscar: ID_DO_CAMPO.cep,
  });
  const cep = consultaCep.estado;
  const buscarCep = consultaCep.buscar;
  const usarEnderecoDoCep = consultaCep.usarEnderecoDoCep;
  /**
   * T209 — completar os 8 dígitos do CEP consulta sozinho (o Evolli
   * completa o endereço). A consulta sai depois que o
   * CEP novo chega ao estado (o hook lê o endereço atual), e só por digitação:
   * abrir um rascunho com CEP não consulta.
   */
  const consultarCepAoCompletarRef = useRef(false);
  useEffect(() => {
    if (!consultarCepAoCompletarRef.current) return;
    consultarCepAoCompletarRef.current = false;
    void buscarCep("botao");
  }, [endereco.cep, buscarCep]);

  function atualizarIdentificacao(campo: ChaveIdentificacao, valor: string) {
    setIdentificacao((prev) => ({ ...prev, [campo]: valor }));
    setErros((prev) => semErroDe(prev, campo));
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

  // ---- T180 — cadastro rápido de Departamento, Cargo e Unidade ------------

  /** Fecha o modal sem tocar na admissão; o foco volta ao seletor. */
  function fecharCadastroRapido() {
    focarSeletorRef.current = referenciaEmCadastro;
    setReferenciaEmCadastro(null);
  }

  /**
   * 201: a referência entra nas opções e fica escolhida pelo MESMO caminho
   * da troca manual do seletor — no Departamento, o que limpa e recarrega as
   * Áreas. O erro do campo sai junto, e o foco volta ao seletor.
   */
  function referenciaCriada(
    tipo: TipoReferenciaRapida,
    criada: ReferenciaCriada,
  ) {
    // Uma recarga ainda em curso foi lida antes desta criação: fica obsoleta.
    versaoDaListaRef.current[tipo] += 1;
    switch (tipo) {
      case "departamento":
        setOpcoes((prev) => ({
          ...prev,
          departamentos: comReferenciaNova(prev.departamentos, criada),
        }));
        setExistemAtivos((prev) => ({ ...prev, departamento: true }));
        void selecionarDepartamento(criada.id);
        break;
      case "cargo":
        setOpcoes((prev) => ({
          ...prev,
          cargos: comReferenciaNova(prev.cargos, criada),
        }));
        setExistemAtivos((prev) => ({ ...prev, cargo: true }));
        atualizar("cargoId", criada.id, "cargo", "lotacao");
        break;
      case "unidade":
        setOpcoes((prev) => ({
          ...prev,
          unidades: comReferenciaNova(prev.unidades, criada),
        }));
        atualizar("unidadeId", criada.id, "unidade", "lotacao");
        break;
    }
    focarSeletorRef.current = tipo;
    setReferenciaEmCadastro(null);
  }

  /**
   * Rede ou 5xx no cadastro rápido: o servidor pode ter gravado. T196 — a
   * busca daquela referência é descartada e relida na próxima abertura do
   * seletor; aqui, uma leitura de um item confere se o servidor responde (e,
   * para Departamento e Cargo, se já existe algum ativo). Responde se a lista
   * foi de fato atualizada: `false` quando a leitura falhou ou chegou
   * obsoleta, depois de uma criação ou de outra recarga. A escolha atual
   * nunca muda aqui.
   */
  async function recarregarReferencia(
    tipo: TipoReferenciaRapida,
  ): Promise<boolean> {
    const versao = ++versaoDaListaRef.current[tipo];
    const vigente = () => versao === versaoDaListaRef.current[tipo];
    const filtro = { status: "ativo", tamanhoPagina: 1 };
    try {
      const { total } = await {
        departamento: listarDepartamentos,
        cargo: listarCargos,
        unidade: listarUnidades,
      }[tipo](filtro);
      if (!vigente()) return false;
      if (tipo === "departamento" || tipo === "cargo") {
        setExistemAtivos((prev) => ({ ...prev, [tipo]: total > 0 }));
      }
      setVersaoDaBusca((prev) => ({ ...prev, [tipo]: prev[tipo] + 1 }));
      return true;
    } catch {
      // A busca atual fica; o modal diz que ela não pôde ser atualizada.
      return false;
    }
  }

  /**
   * O "+" ao lado do seletor: só para o RH. Desabilitado enquanto as opções
   * carregam, sem empresa resolvida e durante o envio da admissão; na tela
   * de sucesso o formulário nem existe.
   */
  function botaoNovaReferencia(tipo: TipoReferenciaRapida): ReactNode {
    if (papelDoAtor !== "rh") return null;
    return (
      <Button
        type="button"
        variant="secondary"
        className="nova-admissao__botao-referencia"
        aria-label={ROTULO_DO_BOTAO_REFERENCIA[tipo]}
        disabled={carregandoOpcoes || !empresa || salvando}
        onClick={() => setReferenciaEmCadastro(tipo)}
      >
        <span aria-hidden="true">+</span>
      </Button>
    );
  }

  // ---- T197 — criação inline a partir da busca ----------------------------

  /**
   * "Criar «termo»" no seletor: só para o RH, com a empresa resolvida, fora do
   * carregamento e do envio da admissão. O DP nunca recebe a oferta.
   */
  function criacaoDe(
    tipo: TipoReferenciaInline,
  ): { onCriar: (nome: string) => void } | undefined {
    if (papelDoAtor !== "rh" || !empresa || carregandoOpcoes || salvando) {
      return undefined;
    }
    return { onCriar: (nome) => setCriacaoInline({ tipo, nome }) };
  }

  /** Fecha a confirmação sem tocar na admissão; o foco volta ao seletor. */
  function fecharCriacaoInline() {
    focarSeletorDaCriacaoRef.current = criacaoInline?.tipo ?? null;
    setCriacaoInline(null);
  }

  /**
   * A referência criada (ou a já existente, escolhida no lugar) fica escolhida
   * pelo MESMO caminho da escolha manual — no Departamento, o que limpa e relê
   * as Áreas. A busca daquele seletor é relida, o anúncio sai uma vez e o foco
   * volta ao campo. Nada da admissão é perdido.
   */
  function escolherDaCriacao(
    tipo: TipoReferenciaInline,
    referencia: ReferenciaEscolhida,
    criada: boolean,
  ) {
    const r = {
      id: referencia.id,
      codigo: referencia.codigo,
      nome: referencia.nome,
    };
    switch (tipo) {
      case "departamento":
        conhecer("departamentos", r);
        setExistemAtivos((prev) => ({ ...prev, departamento: true }));
        void selecionarDepartamento(r.id);
        break;
      case "cargo":
        conhecer("cargos", r);
        setExistemAtivos((prev) => ({ ...prev, cargo: true }));
        atualizar("cargoId", r.id, "cargo", "lotacao");
        break;
      case "unidade":
        conhecer("unidades", r);
        atualizar("unidadeId", r.id, "unidade", "lotacao");
        break;
      case "centroCusto":
        conhecer("centrosCusto", r);
        atualizar("centroCustoId", r.id, "centroCusto", "lotacao");
        break;
    }
    if (tipo !== "centroCusto") versaoDaListaRef.current[tipo] += 1;
    setVersaoDaBusca((prev) => ({ ...prev, [tipo]: prev[tipo] + 1 }));
    setAvisoDaCriacao((prev) => ({
      ...prev,
      [tipo]: {
        id: (prev[tipo]?.id ?? 0) + 1,
        texto: `${criada ? "Criado e escolhido" : "Escolhido"}: ${rotuloDaReferenciaEscolhida(r)}.`,
      },
    }));
    focarSeletorDaCriacaoRef.current = tipo;
    setCriacaoInline(null);
  }

  function validar(): Erros {
    const novos: Erros = {};
    if (referenciasFaltando.length > 0) {
      novos.referencias = mensagemSemReferencias(
        referenciasFaltando,
        papelDoAtor,
      );
    }
    // T209 — nome com pelo menos 3 letras e até 150 caracteres; CPF
    // obrigatório e válido; os demais da etapa 1 são opcionais.
    const nome = campos.nome.trim();
    if (!NOME_TRES_LETRAS.test(nome)) {
      novos.nome = "Informe o nome completo (pelo menos 3 letras).";
    } else if (nome.length > NOME_MAXIMO) {
      novos.nome = `O nome completo deve ter no máximo ${NOME_MAXIMO} caracteres.`;
    }
    const cpf = identificacao.cpf.replace(/\D/g, "");
    if (cpf === "") {
      novos.cpf = "Informe o CPF.";
    } else if (!cpfValido(cpf)) {
      novos.cpf = "CPF inválido. Confira os números digitados.";
    } else if (cpfEmUso) {
      novos.cpf = MENSAGEM_CPF_EM_USO;
    }
    if (identificacao.rg.trim().length > 20) {
      novos.rg = "O RG deve ter no máximo 20 caracteres.";
    }
    if (identificacao.contatoEmergenciaNome.trim().length > 150) {
      novos.contatoEmergenciaNome =
        "O nome do contato deve ter no máximo 150 caracteres.";
    }
    const telefoneEmergencia = identificacao.contatoEmergenciaTelefone.trim();
    if (
      telefoneEmergencia !== "" &&
      !TELEFONE_GRAVADO.test(normalizarTelefone(telefoneEmergencia))
    ) {
      novos.contatoEmergenciaTelefone =
        "Informe o telefone com DDD, no formato (00) 00000-0000.";
    }
    // T179 — matrícula opcional: o formato só é conferido quando preenchida.
    const matricula = campos.matricula.trim().toUpperCase();
    if (matricula !== "" && !MATRICULA_PATTERN.test(matricula)) {
      novos.matricula =
        "Use apenas letras maiúsculas, números, - e _ (2 a 32 caracteres).";
    }
    // T209 — etapa 2: tipo e data de admissão obrigatórios; da lotação, ao
    // menos uma referência (Baseline V1, item 10); salário bruto obrigatório.
    if (!campos.tipo) novos.tipo = "Selecione o tipo de contratação.";
    if (!campos.dataAdmissao) {
      novos.dataAdmissao = "Informe a data de admissão.";
    }
    if (
      !campos.cargoNome.trim() &&
      !campos.cargoId &&
      !campos.departamentoId &&
      !campos.unidadeId &&
      !campos.centroCustoId
    ) {
      novos.cargo =
        "Informe ao menos o cargo, o departamento, a unidade ou o centro de custo.";
    } else if (campos.cargoNome.trim().length > 120) {
      novos.cargo = "O cargo deve ter no máximo 120 caracteres.";
    }
    const jornada = campos.jornadaSemanalHoras.trim();
    if (
      jornada !== "" &&
      (!/^\d+$/.test(jornada) || Number(jornada) < 1 || Number(jornada) > 80)
    ) {
      novos.jornadaSemanalHoras = "Informe de 1 a 80 horas por semana.";
    }
    const bruto = lerValorEmReais(campos.salarioBruto);
    if (bruto === null || bruto <= 0) {
      novos.salarioBruto =
        "Informe o salário bruto. Ele é usado na folha de pagamento.";
    }
    if (campos.registroProfissional.trim().length > 40) {
      novos.registroProfissional =
        "O número do registro deve ter no máximo 40 caracteres.";
    }
    const dependentes = campos.dependentesIrrf.trim();
    if (
      dependentes !== "" &&
      (!/^\d+$/.test(dependentes) || Number(dependentes) > 99)
    ) {
      novos.dependentesIrrf = "Informe de 0 a 99 dependentes.";
    }
    const pensao = campos.pensaoAlimenticiaPercentual.trim().replace(",", ".");
    if (
      pensao !== "" &&
      (!/^\d{1,3}(\.\d{1,2})?$/.test(pensao) || Number(pensao) > 100)
    ) {
      novos.pensaoAlimenticiaPercentual = "Informe um percentual de 0 a 100.";
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

  function pedirFoco(id: string) {
    focoPendenteRef.current = id;
    setPedidoDeFoco((n) => n + 1);
  }

  /**
   * O foco vai ao primeiro erro, na ordem da tela. T195 — a etapa dele abre
   * antes; o erro geral aparece em todas, e a etapa fica.
   */
  function focarPrimeiroErro(novos: Erros) {
    const campo = ORDEM_DOS_ERROS.find((c) => novos[c]);
    if (!campo) return;
    const alvo = etapaDoCampo(campo);
    if (alvo !== null) setEtapa(alvo);
    pedirFoco(ID_DO_CAMPO[campo]);
  }

  /** T195 — os erros só dos campos de uma etapa, pela validação de sempre. */
  function errosDaEtapa(indice: IndiceEtapa): Erros {
    const todos = validar();
    const daEtapa: Erros = {};
    for (const campo of CAMPOS_DA_ETAPA[indice]!) {
      if (todos[campo]) daEtapa[campo] = todos[campo];
    }
    return daEtapa;
  }

  /**
   * T195 — muda de etapa. Voltar nunca valida nem perde nada. Avançar valida,
   * uma a uma, a etapa atual e as do caminho até o alvo, só com as regras de
   * cada uma, e para na primeira com erro, com o foco no primeiro campo
   * inválido; erros de outras etapas ficam como estão. Adiante, só até a
   * próxima etapa ou a mais adiantada já alcançada. Nada é enviado aqui.
   */
  function irParaEtapa(
    alvo: IndiceEtapa,
    idDoFoco: string = idDoTituloDaEtapa(alvo),
  ) {
    if (enviandoRef.current || salvando) return;
    if (alvo > etapa) {
      // A etapa 1 não depende das opções: só dela em diante se espera a carga.
      if (
        (carregandoOpcoes && alvo > 1) ||
        alvo > Math.max(etapaAlcancada, etapa + 1)
      ) {
        return;
      }
      for (let indice = etapa; indice < alvo; indice++) {
        const novos = errosDaEtapa(indice as IndiceEtapa);
        if (Object.keys(novos).length > 0) {
          setErros((prev) => ({ ...prev, ...novos }));
          focarPrimeiroErro(novos);
          return;
        }
      }
    }
    setEtapa(alvo);
    setEtapaAlcancada((prev) => (alvo > prev ? alvo : prev));
    pedirFoco(idDoFoco);
  }

  /**
   * Corpo da admissão. T179 — opcional vazio fica FORA do corpo: matrícula,
   * Unidade, Área, Equipe, Centro de custo e cada contato (o bloco `contatos`
   * inteiro some quando os três estão vazios). Perfil e endereço seguem com
   * o vazio como `null` — inclusive o sexo sem seleção.
   */
  function montarDto(
    empresaId: string,
    cargoResolvido: string | null = campos.cargoId || null,
  ): AdmitirColaboradorDto {
    const { unidadeId, areaId, equipeId, centroCustoId } = campos;
    const contrato = blocoDoContrato();
    const matricula = campos.matricula.trim().toUpperCase();
    const blocoContatos = contatosDaAdmissao(contatos);
    return {
      nome: campos.nome.trim(),
      empresaId,
      ...(matricula ? { matricula } : {}),
      tipo: campos.tipo as TipoVinculo,
      dataAdmissao: campos.dataAdmissao,
      motivoCodigo: "admissao_inicial",
      ...(campos.departamentoId
        ? { departamentoId: campos.departamentoId }
        : {}),
      ...(cargoResolvido ? { cargoId: cargoResolvido } : {}),
      ...(unidadeId ? { unidadeOrganizacionalId: unidadeId } : {}),
      ...(areaId ? { areaId } : {}),
      ...(equipeId ? { equipeId } : {}),
      ...(centroCustoId ? { centroCustoId } : {}),
      perfilPessoal: {
        ...blocoPerfil(perfil),
        ...blocoIdentificacao(identificacao),
      },
      endereco: blocoEndereco(endereco),
      ...(blocoContatos ? { contatos: blocoContatos } : {}),
      // T183 — jornada opcional: só vai quando escolhida (e só o RH a vê).
      ...(campos.tabelaHorarioId
        ? { tabelaHorarioId: campos.tabelaHorarioId }
        : {}),
      ...(contrato ? { contrato } : {}),
    };
  }

  /** T209 — o bloco `contrato` da etapa 2; sem nenhum valor, nada vai. */
  function blocoDoContrato(): ContratoAdmissaoApi | null {
    const bruto = lerValorEmReais(campos.salarioBruto);
    const pensao = campos.pensaoAlimenticiaPercentual.trim().replace(",", ".");
    const conselho =
      campos.conselhoProfissional && campos.conselhoProfissional !== "nenhum"
        ? campos.conselhoProfissional
        : null;
    const registro = campos.registroProfissional.trim();
    const bloco: ContratoAdmissaoApi = {
      ...(campos.nivel && campos.nivel !== "sem_nivel"
        ? { nivel: campos.nivel }
        : {}),
      ...(campos.gestorDiretoId && campos.gestorDiretoId !== "sem_gestor"
        ? { gestorDiretoId: campos.gestorDiretoId }
        : {}),
      ...(campos.jornadaSemanalHoras.trim()
        ? { jornadaSemanalHoras: Number(campos.jornadaSemanalHoras.trim()) }
        : {}),
      ...(campos.escala && campos.escala !== "nao_informada"
        ? { escala: campos.escala }
        : {}),
      ...(bruto !== null && bruto > 0
        ? { salarioBruto: bruto.toFixed(2) }
        : {}),
      ...(conselho ? { conselhoProfissional: conselho } : {}),
      ...(conselho && registro ? { registroProfissional: registro } : {}),
      ...(campos.dependentesIrrf.trim()
        ? { dependentesIrrf: Number(campos.dependentesIrrf.trim()) }
        : {}),
      ...(pensao ? { pensaoAlimenticiaPercentual: pensao } : {}),
    };
    return Object.keys(bloco).length > 0 ? bloco : null;
  }

  /**
   * T209 — o cargo digitado vira cargo do cadastro: o que já existe com esse
   * nome (ativo) é usado; senão, o RH o cria (código automático, T197). O DP
   * não cria cargo: sem ele no cadastro, a recusa fica no campo. Vazio, sem
   * cargo (ou o escolhido antes, de um rascunho antigo).
   */
  async function resolverCargo(): Promise<string | null> {
    const nomeDigitado = campos.cargoNome.trim().replace(/\s+/g, " ");
    if (!nomeDigitado) return campos.cargoId || null;
    const chave = nomeDigitado.toLocaleLowerCase("pt-BR");
    const achados = await listarCargos({
      busca: nomeDigitado,
      status: "ativo",
      pagina: 1,
      tamanhoPagina: TAMANHO_DA_PAGINA_DE_REFERENCIAS,
    });
    const existente = (achados?.itens ?? []).find(
      (c) => c.nome.trim().toLocaleLowerCase("pt-BR") === chave,
    );
    if (existente) return existente.id;
    if (papelDoAtor !== "rh") {
      throw new CargoIndisponivel(
        "Este cargo não está no cadastro. Peça ao RH para cadastrá-lo, ou deixe o campo em branco.",
      );
    }
    try {
      return (await criarCargo({ nome: nomeDigitado, empresaId: empresa!.id }))
        .id;
    } catch (erro: unknown) {
      const existenteNoConflito = (erro as { referencia?: { id?: string } })
        ?.referencia?.id;
      if (existenteNoConflito) return existenteNoConflito;
      throw new CargoIndisponivel(
        "Não foi possível usar este cargo. Confira o nome e tente de novo.",
      );
    }
  }

  /**
   * T179 — "Salvar" (T195: "Concluir", na revisão): só valida, e
   * TUDO. Com falha, o foco vai ao primeiro campo inválido (T195: na etapa
   * dele); sem falha, abre a confirmação. Nada é enviado aqui. T195 — antes da
   * revisão, o envio do formulário (Enter ou "Próxima etapa") avança uma etapa.
   */
  function pedirConfirmacao(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviandoRef.current || confirmando) return;
    if (etapa < ULTIMA_ETAPA) {
      irParaEtapa((etapa + 1) as IndiceEtapa);
      return;
    }
    const novos = validar();
    if (Object.keys(novos).length > 0 || !empresa) {
      setErros(novos);
      focarPrimeiroErro(novos);
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
      // T209 — o cargo digitado vira cargo do cadastro antes de admitir.
      let cargoResolvido: string | null;
      try {
        cargoResolvido = await resolverCargo();
      } catch (erro: unknown) {
        if (erro instanceof CargoIndisponivel) {
          setConfirmando(false);
          const recusa: Erros = { cargo: erro.message };
          setErros(recusa);
          focarPrimeiroErro(recusa);
          return;
        }
        throw erro;
      }
      const resposta = await admitirColaborador(
        montarDto(empresa.id, cargoResolvido),
        { chaveIdempotencia: chave },
      );
      // Sucesso: a próxima admissão desta página será OUTRO envio.
      chaveIdempotenciaRef.current = null;
      setEnvioIncerto(false);
      setLimpezaDosAvisos((n) => n + 1);
      setConfirmando(false);
      setAdmissao(resposta);
      // T209 — a foto vai só agora, para o colaborador já criado; a falha
      // dela nunca desfaz a admissão.
      if (foto) void enviarFoto(resposta.id, foto.arquivo);
      // T213 — os documentos também: um por vez, e a falha de um nunca
      // desfaz a admissão.
      void enviarDocumentos(resposta.id);
      // T209 — concluída a admissão, o rascunho deixa de existir.
      setRascunho(null);
      setAssinaturaSalva(null);
      void descartarRascunhoAdmissao().catch(() => undefined);
    } catch (erro: unknown) {
      // Os dados digitados ficam: só as mensagens e o estado de envio mudam.
      // A chave também fica — a próxima confirmação é o MESMO envio.
      // T195 — o campo recusado pode ser de outra etapa: ela abre.
      setConfirmando(false);
      const recusa = errosDaRecusa(erro, envioIncerto);
      setErros(recusa);
      focarPrimeiroErro(recusa);
      const divergente =
        statusDe(erro) === 422 &&
        detalhesDe(erro).codigo === "idempotencia_conteudo_divergente";
      setEnvioDivergente(divergente);
      // T179 (revisão final) — só liga, nunca desliga: a sessão expirada
      // depois de um envio incerto não apaga a dúvida sobre o anterior.
      if (divergente || envioSemConfirmacao(erro)) setEnvioIncerto(true);
    } finally {
      setSalvando(false);
      enviandoRef.current = false;
    }
  }

  // T200 — a confirmação de descarte é a do shell (diálogo único): com
  // edição pendente, ele pergunta; com envio em andamento, bloqueia e diz
  // por quê. Sem nada digitado, sai direto.
  const guarda = useGuardaDeSaida();
  function pedirCancelamento() {
    guarda.solicitarSaida({ executar: onSair });
  }

  // T209 — a assinatura do rascunho recuperado só existe depois de o
  // formulário ser preenchido com ele.
  useEffect(() => {
    if (!sincronizarAssinaturaRef.current) return;
    sincronizarAssinaturaRef.current = false;
    setAssinaturaSalva(assinaturaAtual);
  }, [assinaturaAtual]);

  // T209 — recupera o rascunho da conta na empresa ativa, depois de as
  // opções carregarem (para as referências escolhidas aparecerem). Falha na
  // leitura: a página começa vazia, como antes.
  useEffect(() => {
    if (carregandoOpcoes) return;
    let vigente = true;
    void (async () => {
      let salvo: RascunhoAdmissaoApi | null | undefined;
      try {
        salvo = await obterRascunhoAdmissao();
      } catch {
        return;
      }
      if (!vigente || !salvo) return;
      aplicarRascunho(salvo);
    })();
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoOpcoes]);

  function aplicarRascunho(salvo: RascunhoAdmissaoApi) {
    const d = salvo.dados;
    const refs = d.referencias ?? {};
    if (refs.departamento) conhecer("departamentos", refs.departamento);
    if (refs.cargo) conhecer("cargos", refs.cargo);
    if (refs.unidade) conhecer("unidades", refs.unidade);
    if (refs.centroCusto) conhecer("centrosCusto", refs.centroCusto);
    const so = <T extends object>(
      base: T,
      extra?: Readonly<Record<string, string>>,
    ) =>
      ({
        ...base,
        ...Object.fromEntries(
          Object.entries(extra ?? {}).filter(([k]) => k in base),
        ),
      }) as T;
    const novosCampos = so(CAMPOS_VAZIOS, d.campos);
    setCampos(novosCampos);
    setPerfil(so(PERFIL_VAZIO, d.perfil));
    setIdentificacao(so(IDENTIFICACAO_VAZIA, d.perfil));
    setEndereco(so(ENDERECO_INICIAL, d.endereco));
    setContatos(so(CONTATOS_VAZIOS, d.contatos));
    const etapaSalva = Math.min(
      Math.max(d.etapa ?? 0, 0),
      ULTIMA_ETAPA,
    ) as IndiceEtapa;
    setEtapa(etapaSalva);
    setEtapaAlcancada(etapaSalva);
    if (novosCampos.departamentoId) {
      void carregarAreasDe(novosCampos.departamentoId);
    }
    setRascunho({ estado: "recuperado", quando: salvo.atualizadoEm });
    sincronizarAssinaturaRef.current = true;
  }

  /** As áreas do departamento recuperado, sem limpar a área escolhida. */
  async function carregarAreasDe(departamentoId: string) {
    const pedido = ++pedidoAreasRef.current;
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

  /** "Salvar rascunho": grava o formulário no servidor; nunca admite. */
  async function salvarRascunho() {
    if (salvandoRascunho || admissao !== null) return;
    const dados = dadosDoRascunho();
    setSalvandoRascunho(true);
    setFalhaDoRascunho(null);
    try {
      const resposta = await salvarRascunhoAdmissao(dados);
      setAssinaturaSalva(JSON.stringify(dados));
      setRascunho({ estado: "salvo", quando: resposta.atualizadoEm });
    } catch {
      setFalhaDoRascunho(
        "Não foi possível salvar o rascunho agora. Os dados digitados continuam aqui.",
      );
    } finally {
      setSalvandoRascunho(false);
    }
  }

  /** "Descartar rascunho": apaga no servidor e recomeça a página. */
  async function descartarRascunho() {
    setFalhaDoRascunho(null);
    try {
      await descartarRascunhoAdmissao();
    } catch {
      setFalhaDoRascunho(
        "Não foi possível descartar o rascunho agora. Tente de novo.",
      );
      return;
    }
    recomecar();
    setRascunho(null);
    setAssinaturaSalva(null);
  }

  /** T209 — o arquivo escolhido no seletor da etapa 1. */
  function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return;
    const recusa = recusaDaFotoNoNavegador(arquivo);
    setRecusaDaFoto(recusa);
    if (recusa) return;
    setFoto({ arquivo, url: URL.createObjectURL(arquivo) });
  }

  function removerFoto() {
    focarEnviarFotoRef.current = true;
    setFoto(null);
    setRecusaDaFoto(null);
  }

  /** T209 — envia a foto do colaborador já admitido (e as novas tentativas). */
  async function enviarFoto(colaboradorId: string, arquivo: File) {
    setEnvioDaFoto({ estado: "enviando" });
    try {
      await enviarFotoColaborador(colaboradorId, arquivo);
      setEnvioDaFoto({ estado: "enviada" });
    } catch (erro: unknown) {
      setEnvioDaFoto({ estado: "falhou", ...falhaDoEnvioDaFoto(erro) });
    }
  }

  /** Depois de uma recusa: outro arquivo, conferido e enviado na hora. */
  function enviarOutraFoto(colaboradorId: string, arquivo: File | undefined) {
    if (!arquivo) return;
    const recusa = recusaDaFotoNoNavegador(arquivo);
    if (recusa) {
      setEnvioDaFoto({
        estado: "falhou",
        mensagem: recusa,
        podeRepetir: false,
      });
      return;
    }
    setFoto({ arquivo, url: URL.createObjectURL(arquivo) });
    void enviarFoto(colaboradorId, arquivo);
  }

  /** T213 — envia os documentos escolhidos (todos, ou só os indicados). */
  async function enviarDocumentos(
    colaboradorId: string,
    somente?: readonly string[],
  ) {
    const alvo = documentos.filter(
      (d) => d.arquivo && (!somente || somente.includes(d.id)),
    );
    for (const documento of alvo) {
      setEnviosDosDocumentos((atual) => ({
        ...atual,
        [documento.id]: { estado: "enviando" },
      }));
      const resultado = await enviarDocumentoDaEtapa(colaboradorId, documento);
      setEnviosDosDocumentos((atual) => ({
        ...atual,
        [documento.id]: resultado,
      }));
    }
  }

  function recomecar() {
    setDocumentos(documentosIniciais());
    setEnviosDosDocumentos({});
    setFoto(null);
    setRecusaDaFoto(null);
    setEnvioDaFoto({ estado: "nenhum" });
    setCampos(CAMPOS_VAZIOS);
    setPerfil(PERFIL_VAZIO);
    setEndereco(ENDERECO_INICIAL);
    setContatos(CONTATOS_VAZIOS);
    setIdentificacao(IDENTIFICACAO_VAZIA);
    setAreas([]);
    setErros({});
    setEtapa(0);
    setEtapaAlcancada(0);
    consultaCep.reiniciar();
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

  /**
   * T196 — a consulta de cada seletor pesquisável: só ativos, 20 por página,
   * busca por código ou nome no servidor. A empresa é a da sessão.
   */
  function consultaDe(
    listar: (q: {
      status: string;
      tamanhoPagina: number;
      pagina: number;
      busca?: string;
    }) => Promise<{
      itens: readonly (Referencia & { status: string })[];
      total: number;
      pagina: number;
      tamanhoPagina: number;
    }>,
  ): ListarReferencias {
    return async ({ busca, pagina }) => {
      const r = await listar({
        status: "ativo",
        tamanhoPagina: TAMANHO_DA_PAGINA_DE_REFERENCIAS,
        pagina,
        ...(busca ? { busca } : {}),
      });
      // Defesa do cliente (a mesma `soAtivos` de antes da T196): referência
      // inativa devolvida indevidamente nunca vira opção. O total e a página
      // do servidor seguem intactos (só eles decidem a próxima página); o
      // seletor apenas desconta os descartados da contagem exibida.
      const ativos = soAtivos(r.itens);
      return {
        ...r,
        itens: ativos.map(({ id, codigo, nome }) => ({ id, codigo, nome })),
        descartados: r.itens.length - ativos.length,
      };
    };
  }

  /** T196 — a escolha guardada entre as referências conhecidas da página. */
  function conhecer(
    chave: "departamentos" | "cargos" | "unidades" | "centrosCusto",
    referencia: ReferenciaEscolhida,
  ) {
    setOpcoes((prev) => ({
      ...prev,
      [chave]: comReferenciaNova(prev[chave], referencia),
    }));
  }

  function referenciaPorId(
    lista: readonly Referencia[],
    id: string,
  ): ReferenciaEscolhida | null {
    return id ? (lista.find((r) => r.id === id) ?? null) : null;
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
    /** T180 — o "+" do cadastro rápido, na mesma linha do seletor. */
    acao?: ReactNode;
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
        {(control) => {
          const seletor = (
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
          );
          return definicao.acao ? (
            <div className="nova-admissao__seletor-com-acao">
              {seletor}
              {definicao.acao}
            </div>
          ) : (
            seletor
          );
        }}
      </FormField>
    );
  }

  if (admissao) {
    return (
      <ConfirmacaoDaAdmissao
        admissao={admissao}
        cargoDigitado={campos.cargoNome.trim().replace(/\s+/g, " ")}
        opcoes={opcoes}
        areas={areas}
        tituloRef={sucessoTituloRef}
        onAbrirAdmitido={onAbrirAdmitido}
        onRecomecar={recomecar}
        onSair={onSair}
        foto={foto}
        envioDaFoto={envioDaFoto}
        onTentarFotoDeNovo={() => {
          if (foto) void enviarFoto(admissao.id, foto.arquivo);
        }}
        onEscolherOutraFoto={(arquivo) => enviarOutraFoto(admissao.id, arquivo)}
        documentos={documentos}
        enviosDosDocumentos={enviosDosDocumentos}
        onTentarDocumentoDeNovo={(id) =>
          void enviarDocumentos(admissao.id, [id])
        }
      />
    );
  }

  // T209 — o líquido estimado, recalculado a cada mudança da remuneração.
  const salarioLiquido = calcularSalarioLiquido({
    bruto: lerValorEmReais(campos.salarioBruto) ?? 0,
    dependentes: Number(campos.dependentesIrrf || 0),
    pensaoPercentual: Number(
      campos.pensaoAlimenticiaPercentual.replace(",", ".") || 0,
    ),
  });
  const salarioLiquidoExibido =
    salarioLiquido === null ? "" : formatarReais(salarioLiquido);

  /** T209 — id, estado inválido e descrição do erro de um campo da linha. */
  function propsDoCampo(campo: CampoErro) {
    const id = ID_DO_CAMPO[campo];
    return {
      id,
      "aria-invalid": erros[campo] ? ("true" as const) : undefined,
      "aria-describedby": erros[campo] ? `${id}-erro` : undefined,
    };
  }

  /** T209 — a mensagem do erro, embaixo do campo. */
  function erroDoCampo(campo: CampoErro) {
    return erros[campo] ? (
      <p
        id={`${ID_DO_CAMPO[campo]}-erro`}
        className="nova-admissao__linha-erro"
      >
        {erros[campo]}
      </p>
    ) : null;
  }

  return (
    <>
      {/* T209 — o padrão compartilhado de cadastro em etapas: cabeçalho com
          voltar (o mesmo caminho do Cancelar, com a guarda), título e Salvar
          rascunho; etapas à esquerda; os quatro painéis sempre montados (só
          o atual visível, nada do que foi digitado sai do documento); rodapé
          fixo com o progresso e as ações. Enter num campo faz o mesmo que
          "Próxima etapa" (envio implícito); duplo clique não salta etapa. */}
      <CadastroEmEtapas
        className="nova-admissao"
        tituloId={NOVA_ADMISSAO_TITULO_ID}
        titulo="Novo colaborador"
        descricao="Preencha os dados em 4 etapas. Você pode salvar e continuar depois."
        rotuloVoltar="Voltar para Colaboradores"
        onVoltarDaPagina={pedirCancelamento}
        acaoDoCabecalho={
          admissao === null ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void salvarRascunho()}
              disabled={salvando || salvandoRascunho || carregandoOpcoes}
            >
              {salvandoRascunho ? "Salvando rascunho…" : "Salvar rascunho"}
            </Button>
          ) : undefined
        }
        aposCabecalho={
          rascunho || falhaDoRascunho ? (
            <div className="nova-admissao__rascunho">
              <p
                className="nova-admissao__texto"
                role={falhaDoRascunho ? "alert" : "status"}
              >
                {falhaDoRascunho ??
                  (rascunho?.estado === "recuperado"
                    ? `Rascunho de ${formatarInstante(rascunho.quando)} recuperado.`
                    : `Rascunho salvo em ${formatarInstante(rascunho?.quando)}.`)}
              </p>
              {rascunho?.estado === "recuperado" && admissao === null ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void descartarRascunho()}
                  disabled={salvando || salvandoRascunho}
                >
                  Descartar rascunho
                </Button>
              ) : null}
            </div>
          ) : null
        }
        etapas={ETAPAS.map((titulo, i) => ({
          titulo,
          subtitulo: SUBTITULOS_DAS_ETAPAS[i]!,
          descricao: DESCRICOES_DAS_ETAPAS[i]!,
        }))}
        atual={etapa}
        alcancada={etapaAlcancada}
        onIrParaEtapa={(alvo) => irParaEtapa(alvo as IndiceEtapa)}
        idDoTituloDaEtapa={(i) => idDoTituloDaEtapa(i as IndiceEtapa)}
        rotuloDoFormulario="Formulário de nova admissão"
        onSubmit={pedirConfirmacao}
        rotuloConcluir="Cadastrar colaborador"
        idBotaoPrincipal={
          etapa === ULTIMA_ETAPA ? ID_BOTAO_SALVAR : ID_BOTAO_CONTINUAR
        }
        principalDesabilitado={carregandoOpcoes && etapa > 0}
        ocupado={salvando}
        antesDoConteudo={
          <>
            {/* T209 — só a empresa ativa, numa frase; sem empresa ativa, o
              bloqueio de sempre (nenhuma empresa é escolhida em silêncio). */}
            {carregandoOpcoes ? (
              <p className="nova-admissao__texto" role="status">
                Carregando a empresa ativa…
              </p>
            ) : empresa ? (
              <p className="nova-admissao__empresa" id="nova-admissao-empresa">
                Você está cadastrando um novo colaborador para:{" "}
                <strong>{empresa.nome}</strong>
              </p>
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
          </>
        }
        paineis={[
          <>
            <SecaoDoCadastro
              id="nova-admissao-secao-identificacao"
              titulo="Identificação"
              descricao="Aparecem no perfil, nos documentos e no eSocial."
            >
              <BlocoDaFoto
                foto={foto}
                recusa={recusaDaFoto}
                onEscolher={escolherFoto}
                onRemover={removerFoto}
              />
              <LinhaDoCadastro
                rotulo="Nome completo"
                ajuda="Como está nos documentos oficiais."
                paraId={ID_DO_CAMPO.nome}
              >
                <input
                  type="text"
                  maxLength={NOME_MAXIMO}
                  autoComplete="off"
                  placeholder="Nome completo"
                  aria-required="true"
                  value={campos.nome}
                  onChange={(e) => atualizar("nome", e.target.value, "nome")}
                  {...propsDoCampo("nome")}
                />
                {erroDoCampo("nome")}
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="CPF e RG"
                ajuda="Usados na folha e no eSocial."
              >
                <div className="nova-admissao__linha-par">
                  <div className="nova-admissao__linha-celula">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={14}
                      placeholder="000.000.000-00"
                      aria-label="CPF"
                      aria-required="true"
                      value={identificacao.cpf}
                      onChange={(e) =>
                        atualizarIdentificacao(
                          "cpf",
                          mascararCpf(e.target.value),
                        )
                      }
                      {...propsDoCampo("cpf")}
                    />
                    {erroDoCampo("cpf")}
                  </div>
                  <div className="nova-admissao__linha-celula">
                    <input
                      type="text"
                      autoComplete="off"
                      maxLength={20}
                      placeholder="00.000.000-0"
                      aria-label="RG"
                      value={identificacao.rg}
                      onChange={(e) =>
                        atualizarIdentificacao("rg", e.target.value)
                      }
                      {...propsDoCampo("rg")}
                    />
                    {erroDoCampo("rg")}
                  </div>
                </div>
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo={ROTULO_DATA_NASCIMENTO}
                paraId={ID_DO_CAMPO.dataNascimento}
              >
                <input
                  type="date"
                  value={perfil.dataNascimento}
                  onChange={(e) =>
                    atualizarPerfil("dataNascimento", e.target.value)
                  }
                  {...propsDoCampo("dataNascimento")}
                />
                {erroDoCampo("dataNascimento")}
              </LinhaDoCadastro>
              <LinhaDoCadastro rotulo="Gênero e estado civil">
                <div className="nova-admissao__linha-par">
                  <div className="nova-admissao__linha-celula">
                    <select
                      aria-label="Gênero"
                      value={identificacao.genero}
                      onChange={(e) =>
                        atualizarIdentificacao("genero", e.target.value)
                      }
                      {...propsDoCampo("genero")}
                    >
                      <option value="">Selecione</option>
                      {OPCOES_GENERO.map((o) => (
                        <option key={o.codigo} value={o.codigo}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                    {erroDoCampo("genero")}
                  </div>
                  <div className="nova-admissao__linha-celula">
                    <select
                      aria-label="Estado civil"
                      value={perfil.estadoCivil}
                      onChange={(e) =>
                        atualizarPerfil("estadoCivil", e.target.value)
                      }
                      {...propsDoCampo("estadoCivil")}
                    >
                      <option value="">Selecione</option>
                      {/* Valor gravado antes da lista (rascunho antigo):
                          continua visível como opção. */}
                      {perfil.estadoCivil !== "" &&
                      !(OPCOES_ESTADO_CIVIL as readonly string[]).includes(
                        perfil.estadoCivil,
                      ) ? (
                        <option value={perfil.estadoCivil}>
                          {perfil.estadoCivil}
                        </option>
                      ) : null}
                      {OPCOES_ESTADO_CIVIL.map((opcao) => (
                        <option key={opcao} value={opcao}>
                          {opcao}
                        </option>
                      ))}
                    </select>
                    {erroDoCampo("estadoCivil")}
                  </div>
                </div>
              </LinhaDoCadastro>
            </SecaoDoCadastro>
            <SecaoDoCadastro
              id="nova-admissao-secao-contato"
              titulo="Contato"
              descricao="Canais pessoais para falar com o colaborador."
            >
              <LinhaDoCadastro
                rotulo="E-mail pessoal"
                ajuda="Diferente do e-mail corporativo."
                paraId={ID_DO_CAMPO.emailPessoal}
              >
                <input
                  type="email"
                  maxLength={254}
                  autoComplete="off"
                  placeholder="email@exemplo.com"
                  value={contatos.emailPessoal}
                  onChange={(e) =>
                    atualizarContato("emailPessoal", e.target.value)
                  }
                  {...propsDoCampo("emailPessoal")}
                />
                {erroDoCampo("emailPessoal")}
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Telefone pessoal"
                ajuda="Com DDD."
                paraId={ID_DO_CAMPO.celular}
              >
                <CampoMascarado
                  mascara="telefone"
                  placeholder="(00) 00000-0000"
                  value={contatos.celular}
                  onValorChange={(valor) => atualizarContato("celular", valor)}
                  limparAvisos={limpezaDosAvisos}
                  {...propsDoCampo("celular")}
                />
                {erroDoCampo("celular")}
              </LinhaDoCadastro>
            </SecaoDoCadastro>
            <SecaoDoCadastro
              id="nova-admissao-secao-emergencia"
              titulo="Contato de emergência"
              descricao="Acionado apenas em situações de urgência."
            >
              <LinhaDoCadastro
                rotulo="Nome do contato"
                paraId={ID_DO_CAMPO.contatoEmergenciaNome}
              >
                <input
                  type="text"
                  maxLength={150}
                  autoComplete="off"
                  placeholder="Nome do contato"
                  value={identificacao.contatoEmergenciaNome}
                  onChange={(e) =>
                    atualizarIdentificacao(
                      "contatoEmergenciaNome",
                      e.target.value,
                    )
                  }
                  {...propsDoCampo("contatoEmergenciaNome")}
                />
                {erroDoCampo("contatoEmergenciaNome")}
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Telefone do contato"
                paraId={ID_DO_CAMPO.contatoEmergenciaTelefone}
              >
                <CampoMascarado
                  mascara="telefone"
                  placeholder="(00) 00000-0000"
                  value={identificacao.contatoEmergenciaTelefone}
                  onValorChange={(valor) =>
                    atualizarIdentificacao("contatoEmergenciaTelefone", valor)
                  }
                  limparAvisos={limpezaDosAvisos}
                  {...propsDoCampo("contatoEmergenciaTelefone")}
                />
                {erroDoCampo("contatoEmergenciaTelefone")}
              </LinhaDoCadastro>
            </SecaoDoCadastro>
          </>,
          <>
            <SecaoDoCadastro
              id="nova-admissao-secao-cargo"
              titulo="Cargo e estrutura"
              descricao="Onde o colaborador está na organização."
            >
              <LinhaDoCadastro rotulo="Cargo e nível">
                <div className="nova-admissao__linha-par">
                  <div className="nova-admissao__linha-celula">
                    <input
                      type="text"
                      maxLength={120}
                      autoComplete="off"
                      placeholder="Ex.: Analista de RH"
                      aria-label="Cargo"
                      value={campos.cargoNome}
                      onChange={(e) =>
                        atualizar(
                          "cargoNome",
                          e.target.value,
                          "cargo",
                          "lotacao",
                        )
                      }
                      {...propsDoCampo("cargo")}
                    />
                    {erroDoCampo("cargo")}
                  </div>
                  <div className="nova-admissao__linha-celula">
                    <select
                      aria-label="Nível"
                      value={campos.nivel}
                      onChange={(e) =>
                        atualizar("nivel", e.target.value, "nivel")
                      }
                      {...propsDoCampo("nivel")}
                    >
                      <option value="">Nível</option>
                      {OPCOES_NIVEL.map((o) => (
                        <option key={o.codigo} value={o.codigo}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </LinhaDoCadastro>
              <LinhaDoCadastro rotulo="Departamento e área">
                <div className="nova-admissao__linha-par nova-admissao__linha-par--seletores">
                  <SeletorDeReferencia
                    id={ID_DO_CAMPO.departamento}
                    rotulo="Departamento"
                    rotuloVisivel="Departamento"
                    plural="departamentos"
                    nenhum="Nenhum"
                    ativo="ativo"
                    obrigatorio={false}
                    placeholder="Departamento"
                    {...(erros.departamento
                      ? { erro: erros.departamento }
                      : {})}
                    escolhida={referenciaPorId(
                      opcoes.departamentos,
                      campos.departamentoId,
                    )}
                    onEscolher={(r) => {
                      if (r) conhecer("departamentos", r);
                      void selecionarDepartamento(r?.id ?? "");
                    }}
                    listar={consultaDe(listarDepartamentos)}
                    desabilitado={carregandoOpcoes}
                    versao={versaoDaBusca.departamento}
                    acao={botaoNovaReferencia("departamento")}
                    criacao={criacaoDe("departamento")}
                    aviso={avisoDaCriacao.departamento}
                  />
                  {seletorDeLotacao({
                    campo: "area",
                    rotulo: "Área",
                    obrigatorio: false,
                    valor: campos.areaId,
                    lista: areas,
                    aoMudar: (id) => atualizar("areaId", id, "area", "lotacao"),
                    vazio: campos.departamentoId
                      ? carregandoAreas
                        ? "Carregando áreas…"
                        : "Área"
                      : "Área",
                    desabilitado: !campos.departamentoId || carregandoAreas,
                  })}
                </div>
              </LinhaDoCadastro>
              <LinhaDoCadastro rotulo="Centro de custo" grupo={false}>
                <SeletorDeReferencia
                  id={ID_DO_CAMPO.centroCusto}
                  rotulo="Centro de custo"
                  rotuloVisivel="Centro de custo"
                  plural="centros de custo"
                  nenhum="Nenhum"
                  ativo="ativo"
                  obrigatorio={false}
                  placeholder="Selecione"
                  {...(erros.centroCusto ? { erro: erros.centroCusto } : {})}
                  escolhida={referenciaPorId(
                    opcoes.centrosCusto,
                    campos.centroCustoId,
                  )}
                  onEscolher={(r) => {
                    if (r) conhecer("centrosCusto", r);
                    atualizar(
                      "centroCustoId",
                      r?.id ?? "",
                      "centroCusto",
                      "cargo",
                      "lotacao",
                    );
                  }}
                  listar={consultaDe(listarCentrosCusto)}
                  desabilitado={carregandoOpcoes}
                  versao={versaoDaBusca.centroCusto}
                  criacao={criacaoDe("centroCusto")}
                  aviso={avisoDaCriacao.centroCusto}
                />
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Unidade"
                ajuda="Filial, loja ou local de trabalho."
                grupo={false}
              >
                <SeletorDeReferencia
                  id={ID_DO_CAMPO.unidade}
                  rotulo="Unidade"
                  rotuloVisivel="Unidade"
                  plural="unidades"
                  nenhum="Nenhuma"
                  ativo="ativa"
                  obrigatorio={false}
                  placeholder="Selecione"
                  {...(erros.unidade ? { erro: erros.unidade } : {})}
                  escolhida={referenciaPorId(opcoes.unidades, campos.unidadeId)}
                  onEscolher={(r) => {
                    if (r) conhecer("unidades", r);
                    atualizar(
                      "unidadeId",
                      r?.id ?? "",
                      "unidade",
                      "cargo",
                      "lotacao",
                    );
                  }}
                  listar={consultaDe(listarUnidades)}
                  desabilitado={carregandoOpcoes}
                  versao={versaoDaBusca.unidade}
                  acao={botaoNovaReferencia("unidade")}
                  criacao={criacaoDe("unidade")}
                  aviso={avisoDaCriacao.unidade}
                />
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Gestor direto"
                ajuda="Recebe as solicitações do colaborador."
                paraId={ID_DO_CAMPO.gestorDireto}
              >
                <select
                  value={campos.gestorDiretoId}
                  onChange={(e) =>
                    atualizar("gestorDiretoId", e.target.value, "gestorDireto")
                  }
                  {...propsDoCampo("gestorDireto")}
                >
                  <option value="">Selecione</option>
                  <option value="sem_gestor">Sem gestor</option>
                  {gestores.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.cargo ? `${g.nome} — ${g.cargo}` : g.nome}
                    </option>
                  ))}
                </select>
                {erroDoCampo("gestorDireto")}
              </LinhaDoCadastro>
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
            </SecaoDoCadastro>
            <SecaoDoCadastro
              id="nova-admissao-secao-contrato"
              titulo="Contrato"
              descricao="Tipo de vínculo, admissão, jornada, escala e matrícula."
            >
              <LinhaDoCadastro
                rotulo="Tipo de contratação"
                paraId={ID_DO_CAMPO.tipo}
              >
                <select
                  aria-required="true"
                  value={campos.tipo}
                  onChange={(e) =>
                    atualizar("tipo", e.target.value as TipoVinculo, "tipo")
                  }
                  {...propsDoCampo("tipo")}
                >
                  <option value="">Selecione</option>
                  {TIPOS_DE_CONTRATACAO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_TIPO_VINCULO[tipo]}
                    </option>
                  ))}
                </select>
                {erroDoCampo("tipo")}
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Data de admissão"
                paraId={ID_DO_CAMPO.dataAdmissao}
              >
                <input
                  type="date"
                  aria-required="true"
                  value={campos.dataAdmissao}
                  onChange={(e) =>
                    atualizar("dataAdmissao", e.target.value, "dataAdmissao")
                  }
                  {...propsDoCampo("dataAdmissao")}
                />
                {erroDoCampo("dataAdmissao")}
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Jornada de trabalho"
                paraId={ID_DO_CAMPO.jornadaSemanalHoras}
              >
                <div className="nova-admissao__com-sufixo">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="Ex.: 44"
                    value={campos.jornadaSemanalHoras}
                    onChange={(e) =>
                      atualizar(
                        "jornadaSemanalHoras",
                        e.target.value.replace(/\D/g, ""),
                        "jornadaSemanalHoras",
                      )
                    }
                    {...propsDoCampo("jornadaSemanalHoras")}
                  />
                  <span aria-hidden="true">horas por semana</span>
                </div>
                {erroDoCampo("jornadaSemanalHoras")}
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Escala de trabalho"
                ajuda="Sem escala, os benefícios usam os dias úteis do mês."
                paraId={ID_DO_CAMPO.escala}
              >
                <select
                  value={campos.escala}
                  onChange={(e) =>
                    atualizar("escala", e.target.value, "escala")
                  }
                  {...propsDoCampo("escala")}
                >
                  <option value="">Selecione a escala</option>
                  {OPCOES_ESCALA.map((o) => (
                    <option key={o.codigo} value={o.codigo}>
                      {o.descricao ? `${o.nome} — ${o.descricao}` : o.nome}
                    </option>
                  ))}
                </select>
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Matrícula"
                paraId={ID_DO_CAMPO.matricula}
                dica={
                  <>
                    <button
                      type="button"
                      className="nova-admissao__dica"
                      aria-label="Sobre Matrícula"
                      aria-expanded={dicaDaMatricula}
                      aria-controls="nova-admissao-dica-matricula"
                      onClick={() => setDicaDaMatricula((v) => !v)}
                    >
                      ?
                    </button>
                    {dicaDaMatricula ? (
                      <span
                        id="nova-admissao-dica-matricula"
                        role="tooltip"
                        className="nova-admissao__dica-texto"
                      >
                        {DICA_DA_MATRICULA}
                      </span>
                    ) : null}
                  </>
                }
              >
                <input
                  type="text"
                  maxLength={30}
                  autoComplete="off"
                  placeholder="Ex.: 000123"
                  value={campos.matricula}
                  onChange={(e) =>
                    atualizar(
                      "matricula",
                      e.target.value.toUpperCase(),
                      "matricula",
                    )
                  }
                  {...propsDoCampo("matricula")}
                />
                {erroDoCampo("matricula")}
              </LinhaDoCadastro>
            </SecaoDoCadastro>
            <SecaoDoCadastro
              id="nova-admissao-secao-remuneracao"
              titulo="Remuneração"
              descricao="Valores mensais usados na folha."
            >
              <LinhaDoCadastro
                rotulo="Salário bruto"
                paraId={ID_DO_CAMPO.salarioBruto}
              >
                <div className="nova-admissao__com-prefixo">
                  <span aria-hidden="true">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-required="true"
                    value={campos.salarioBruto}
                    onChange={(e) =>
                      atualizar(
                        "salarioBruto",
                        mascararReais(e.target.value),
                        "salarioBruto",
                      )
                    }
                    onBlur={(e) => {
                      const completo = completarReais(e.target.value);
                      if (completo !== campos.salarioBruto)
                        atualizar("salarioBruto", completo, "salarioBruto");
                    }}
                    {...propsDoCampo("salarioBruto")}
                  />
                </div>
                {erroDoCampo("salarioBruto")}
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Salário líquido"
                ajuda="Calculado a partir do bruto."
                paraId="nova-admissao-salario-liquido"
              >
                <div className="nova-admissao__com-prefixo">
                  <span aria-hidden="true">R$</span>
                  <input
                    id="nova-admissao-salario-liquido"
                    type="text"
                    readOnly
                    placeholder="—"
                    value={salarioLiquidoExibido}
                  />
                </div>
              </LinhaDoCadastro>
            </SecaoDoCadastro>
            <SecaoDoCadastro
              id="nova-admissao-secao-adicionais"
              titulo="Informações adicionais"
              descricao="Registro profissional e deduções."
            >
              <LinhaDoCadastro
                rotulo="Conselho e registro"
                ajuda="Obrigatório para algumas profissões."
              >
                <div className="nova-admissao__linha-par">
                  <div className="nova-admissao__linha-celula">
                    <select
                      aria-label="Conselho"
                      value={campos.conselhoProfissional}
                      onChange={(e) => {
                        const valor = e.target.value;
                        atualizar(
                          "conselhoProfissional",
                          valor,
                          "conselhoProfissional",
                          "registroProfissional",
                        );
                        if (!valor || valor === "nenhum") {
                          atualizar("registroProfissional", "");
                        }
                      }}
                      {...propsDoCampo("conselhoProfissional")}
                    >
                      <option value="">Selecione</option>
                      {OPCOES_CONSELHO.map((o) => (
                        <option key={o.codigo} value={o.codigo}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="nova-admissao__linha-celula">
                    <input
                      type="text"
                      maxLength={40}
                      autoComplete="off"
                      placeholder="Número do registro"
                      aria-label="Número do registro"
                      disabled={
                        !campos.conselhoProfissional ||
                        campos.conselhoProfissional === "nenhum"
                      }
                      value={campos.registroProfissional}
                      onChange={(e) =>
                        atualizar(
                          "registroProfissional",
                          e.target.value,
                          "registroProfissional",
                        )
                      }
                      {...propsDoCampo("registroProfissional")}
                    />
                    {erroDoCampo("registroProfissional")}
                  </div>
                </div>
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Dependentes (IRRF)"
                paraId={ID_DO_CAMPO.dependentesIrrf}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={campos.dependentesIrrf}
                  onChange={(e) =>
                    atualizar(
                      "dependentesIrrf",
                      e.target.value.replace(/\D/g, ""),
                      "dependentesIrrf",
                    )
                  }
                  {...propsDoCampo("dependentesIrrf")}
                />
                {erroDoCampo("dependentesIrrf")}
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Pensão alimentícia"
                paraId={ID_DO_CAMPO.pensaoAlimenticiaPercentual}
              >
                <div className="nova-admissao__com-sufixo">
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={6}
                    value={campos.pensaoAlimenticiaPercentual}
                    onChange={(e) =>
                      atualizar(
                        "pensaoAlimenticiaPercentual",
                        e.target.value.replace(/[^\d,.]/g, ""),
                        "pensaoAlimenticiaPercentual",
                      )
                    }
                    {...propsDoCampo("pensaoAlimenticiaPercentual")}
                  />
                  <span aria-hidden="true">%</span>
                </div>
                {erroDoCampo("pensaoAlimenticiaPercentual")}
              </LinhaDoCadastro>
            </SecaoDoCadastro>
          </>,
          <>
            {/* T209 — etapa 3 do Novo colaborador: endereço residencial,
                tudo opcional; o CEP preenche o resto sozinho. */}
            <SecaoDoCadastro
              id="nova-admissao-secao-endereco"
              titulo="Endereço residencial"
              descricao="Preenchemos o restante automaticamente a partir do CEP."
            >
              <LinhaDoCadastro rotulo="CEP" paraId={ID_DO_CAMPO.cep}>
                <div className="nova-admissao__campo-cep">
                  <CampoMascarado
                    mascara="cep"
                    placeholder="00000-000"
                    value={endereco.cep}
                    onValorChange={(valor) => {
                      atualizarEndereco("cep", valor);
                      if (/^\d{8}$/.test(valor.replace(/\D/g, ""))) {
                        consultarCepAoCompletarRef.current = true;
                      }
                    }}
                    limparAvisos={limpezaDosAvisos}
                    onBlur={() => void buscarCep("saida")}
                    {...propsDoCampo("cep")}
                  />
                </div>
                {erroDoCampo("cep")}
                {/* A única região viva do bloco: anuncia o resultado sem
                    mover o foco. Sempre montada, para que o anúncio saia. */}
                <p
                  id="nova-admissao-cep-status"
                  className={
                    cep.tipo === "sugerido" && cep.encontrado
                      ? "nova-admissao__cep-status nova-admissao__cep-status--encontrado"
                      : "nova-admissao__cep-status"
                  }
                  role="status"
                >
                  {cep.tipo === "buscando" ? (
                    "Buscando endereço…"
                  ) : cep.tipo === "sugerido" && cep.encontrado ? (
                    <>
                      <IconeSucesso tamanho={14} />
                      Endereço encontrado
                    </>
                  ) : cep.tipo === "aviso" || cep.tipo === "sugerido" ? (
                    cep.mensagem
                  ) : (
                    ""
                  )}
                </p>
                {cep.tipo === "sugerido" && cep.mantidos.length > 0 ? (
                  <div className="nova-admissao__cep-acoes">
                    <Button
                      type="button"
                      variant="subtle"
                      onClick={usarEnderecoDoCep}
                    >
                      Usar endereço do CEP
                    </Button>
                  </div>
                ) : null}
                {cep.tipo === "aviso" && cep.repetivel ? (
                  <div className="nova-admissao__cep-acoes">
                    <Button
                      type="button"
                      variant="subtle"
                      onClick={() => void buscarCep("botao")}
                    >
                      Consultar de novo
                    </Button>
                  </div>
                ) : null}
              </LinhaDoCadastro>
              <LinhaDoCadastro rotulo="Logradouro e número">
                <div className="nova-admissao__linha-par nova-admissao__linha-par--larga-estreita">
                  <div className="nova-admissao__linha-celula">
                    <input
                      type="text"
                      maxLength={200}
                      autoComplete="off"
                      placeholder="Rua, avenida…"
                      aria-label="Logradouro"
                      value={endereco.logradouro}
                      onChange={(e) =>
                        atualizarEndereco("logradouro", e.target.value)
                      }
                      {...propsDoCampo("logradouro")}
                    />
                    {erroDoCampo("logradouro")}
                  </div>
                  <div className="nova-admissao__linha-celula">
                    <input
                      type="text"
                      maxLength={20}
                      autoComplete="off"
                      placeholder="Nº"
                      aria-label="Número"
                      value={endereco.numero}
                      onChange={(e) =>
                        atualizarEndereco("numero", e.target.value)
                      }
                      {...propsDoCampo("numero")}
                    />
                    {erroDoCampo("numero")}
                  </div>
                </div>
              </LinhaDoCadastro>
              <LinhaDoCadastro
                rotulo="Complemento"
                paraId={ID_DO_CAMPO.complemento}
              >
                <input
                  type="text"
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Apto, bloco, sala…"
                  value={endereco.complemento}
                  onChange={(e) =>
                    atualizarEndereco("complemento", e.target.value)
                  }
                  {...propsDoCampo("complemento")}
                />
                {erroDoCampo("complemento")}
              </LinhaDoCadastro>
              <LinhaDoCadastro rotulo="Bairro" paraId={ID_DO_CAMPO.bairro}>
                <input
                  type="text"
                  maxLength={120}
                  autoComplete="off"
                  value={endereco.bairro}
                  onChange={(e) => atualizarEndereco("bairro", e.target.value)}
                  {...propsDoCampo("bairro")}
                />
                {erroDoCampo("bairro")}
              </LinhaDoCadastro>
              <LinhaDoCadastro rotulo="Cidade e estado">
                <div className="nova-admissao__linha-par nova-admissao__linha-par--larga-estreita">
                  <div className="nova-admissao__linha-celula">
                    <input
                      type="text"
                      maxLength={120}
                      autoComplete="off"
                      placeholder="Cidade"
                      aria-label="Cidade"
                      value={endereco.cidade}
                      onChange={(e) =>
                        atualizarEndereco("cidade", e.target.value)
                      }
                      {...propsDoCampo("cidade")}
                    />
                    {erroDoCampo("cidade")}
                  </div>
                  <div className="nova-admissao__linha-celula">
                    <select
                      aria-label="Estado"
                      value={siglaDaUf(endereco.estado)}
                      onChange={(e) =>
                        atualizarEndereco("estado", e.target.value)
                      }
                      {...propsDoCampo("estado")}
                    >
                      <option value="">UF</option>
                      {UFS.map((uf) => (
                        <option key={uf.sigla} value={uf.sigla}>
                          {uf.sigla}
                        </option>
                      ))}
                    </select>
                    {erroDoCampo("estado")}
                  </div>
                </div>
              </LinhaDoCadastro>
            </SecaoDoCadastro>
          </>,
          <EtapaDocumentos
            key="documentos"
            documentos={documentos}
            onEscolherArquivo={(id, arquivo) =>
              setDocumentos((atual) =>
                atual.map((d) =>
                  d.id === id
                    ? { ...d, arquivo, chaveDeEnvio: novaChaveDeEnvio() }
                    : d,
                ),
              )
            }
            onTirarArquivo={(id) =>
              setDocumentos((atual) =>
                atual.map((d) =>
                  d.id === id ? { ...d, arquivo: null, chaveDeEnvio: null } : d,
                ),
              )
            }
            onAdicionarOutro={(nome) =>
              setDocumentos((atual) => [
                ...atual,
                {
                  id: `outro-${novaChaveDeEnvio()}`,
                  categoria: "outros",
                  nome,
                  arquivo: null,
                  chaveDeEnvio: null,
                },
              ])
            }
            onRemoverOutro={(id) =>
              setDocumentos((atual) => atual.filter((d) => d.id !== id))
            }
          />,
        ]}
        mensagem={
          <>
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
          </>
        }
      />

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
                      campos.cargoNome.trim()
                        ? campos.cargoNome.trim().replace(/\s+/g, " ")
                        : escolhida(opcoes.cargos, campos.cargoId),
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
            <dt>Jornada semanal</dt>
            <dd>
              {campos.jornadaSemanalHoras
                ? `${plural(Number(campos.jornadaSemanalHoras), "hora", "horas")} por semana`
                : "Não informada"}
            </dd>
            {papelDoAtor === "rh" ? (
              <>
                <dt>Horário de trabalho</dt>
                <dd>
                  {campos.tabelaHorarioId
                    ? `${jornadaEscolhida ? rotuloDaJornada(jornadaEscolhida) : "Jornada escolhida"}, a partir de ${formatarDiaCivil(campos.dataAdmissao)}`
                    : "Sem jornada"}
                </dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {salvando ? (
          <p className="nova-admissao__texto" role="status">
            Cadastrando… Aguarde a confirmação do servidor.
          </p>
        ) : null}
      </Modal>

      {/* T180 — cadastro rápido de Departamento, Cargo ou Unidade: modal
          curto, fora do formulário da admissão, que nada perde ao fechar. */}
      {empresa ? (
        <ModalReferenciaRapida
          tipo={referenciaEmCadastro}
          empresaId={empresa.id}
          onFechar={fecharCadastroRapido}
          onCriada={referenciaCriada}
          onRecarregar={recarregarReferencia}
        />
      ) : null}

      {/* T197 — confirmação curta da criação inline, pedida no seletor. */}
      {empresa ? (
        <ModalCriacaoInline
          pedido={criacaoInline}
          empresaId={empresa.id}
          onFechar={fecharCriacaoInline}
          onCriada={(tipo, criada) => escolherDaCriacao(tipo, criada, true)}
          onEscolherExistente={(tipo, existente) =>
            escolherDaCriacao(tipo, existente, false)
          }
          onIncerto={(tipo) =>
            setVersaoDaBusca((prev) => ({ ...prev, [tipo]: prev[tipo] + 1 }))
          }
        />
      ) : null}
    </>
  );
}

/**
 * T178 — trilha da página: módulo › Colaboradores › Nova admissão. Os nomes
 * vêm do mapa de navegação, os mesmos da barra lateral. Quem decide o que
 * acontece ao voltar é o chamador (com ou sem confirmação de descarte).
 */
/** T195 — rótulo e valor, só os preenchidos, sem espaços nas pontas. */
interface ConfirmacaoProps {
  /** O cargo digitado na admissão (criado agora, fora da lista carregada). */
  readonly cargoDigitado?: string;
  admissao: AdmissaoRegistradaApi;
  opcoes: Opcoes;
  areas: AreaApi[];
  tituloRef: React.RefObject<HTMLHeadingElement>;
  onAbrirAdmitido: NovaAdmissaoScreenProps["onAbrirAdmitido"];
  onRecomecar: () => void;
  onSair: () => void;
  /** T209 — a foto escolhida e o seu envio, depois da admissão. */
  foto: FotoEscolhida | null;
  envioDaFoto: EnvioDaFoto;
  onTentarFotoDeNovo: () => void;
  onEscolherOutraFoto: (arquivo: File | undefined) => void;
  /** T213 — os documentos da etapa 4 e o envio de cada um. */
  documentos: readonly DocumentoDaEtapa[];
  enviosDosDocumentos: Readonly<Record<string, EnvioDeDocumento>>;
  onTentarDocumentoDeNovo: (id: string) => void;
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
  /** O cargo digitado (criado na admissão, ainda fora da lista carregada). */
  cargoDigitado = "",
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
    ...nomear(
      opcoes.cargos,
      destino.cargoId,
      "Cargo",
      cargoDigitado ? `Cargo: ${cargoDigitado}` : "Cargo registrado",
    ),
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

/** T183 — a jornada gravada, nomeada pelas opções da página, nunca por id. */
function jornadaGravada(tabelaHorarioId: string, opcoes: Opcoes): string {
  const jornada = opcoes.jornadas.find((j) => j.id === tabelaHorarioId);
  return jornada ? rotuloDaJornada(jornada) : "Jornada registrada";
}

function ConfirmacaoDaAdmissao({
  admissao,
  cargoDigitado = "",
  opcoes,
  areas,
  tituloRef,
  onAbrirAdmitido,
  onRecomecar,
  onSair,
  foto,
  envioDaFoto,
  onTentarFotoDeNovo,
  onEscolherOutraFoto,
  documentos,
  enviosDosDocumentos,
  onTentarDocumentoDeNovo,
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
    <div className="cadastro-etapas nova-admissao">
      {/* Depois da admissão a trilha da barra superior e "Voltar para
          Colaboradores", abaixo, saem direto (não há o que descartar). */}
      <header className="cadastro-etapas__cabecalho">
        <PageHeader
          headingLevel={1}
          titleId={NOVA_ADMISSAO_TITULO_ID}
          title="Novo colaborador"
        />
      </header>
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
              {lotacaoGravada(
                admissao.movimentacao.destino,
                opcoes,
                areas,
                cargoDigitado,
              ).map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          </dd>
          {/* T183 — a jornada que o SERVIDOR gravou com a admissão. */}
          {admissao.jornada ? (
            <>
              <dt>Jornada de trabalho</dt>
              <dd>
                {`${jornadaGravada(admissao.jornada.tabelaHorarioId, opcoes)}, a partir de ${formatarDiaCivil(admissao.jornada.vigenciaInicio)}`}
              </dd>
            </>
          ) : null}
        </dl>
        <ResumoGravado
          titulo="Dados básicos"
          id="nova-admissao-sucesso-dados-pessoais"
          linhas={
            admissao.perfilPessoal
              ? [
                  ["CPF", exibirCpf(admissao.perfilPessoal.cpf)],
                  ["RG", admissao.perfilPessoal.rg ?? null],
                  [
                    ROTULO_DATA_NASCIMENTO,
                    admissao.perfilPessoal.dataNascimento
                      ? formatarDiaCivil(admissao.perfilPessoal.dataNascimento)
                      : null,
                  ],
                  ["Gênero", rotuloDoGenero(admissao.perfilPessoal.genero)],
                  ["Estado civil", admissao.perfilPessoal.estadoCivil],
                  [
                    "Contato de emergência",
                    admissao.perfilPessoal.contatoEmergenciaNome ?? null,
                  ],
                  [
                    "Telefone do contato",
                    admissao.perfilPessoal.contatoEmergenciaTelefone
                      ? exibirTelefone(
                          admissao.perfilPessoal.contatoEmergenciaTelefone,
                        )
                      : null,
                  ],
                ]
              : null
          }
        />
        {/* T209 — o contrato que o servidor gravou (etapa 2). */}
        {admissao.contrato ? (
          <ResumoGravado
            titulo="Contrato"
            id="nova-admissao-sucesso-contrato"
            linhas={[
              [
                "Nível",
                OPCOES_NIVEL.find((o) => o.codigo === admissao.contrato?.nivel)
                  ?.rotulo ?? null,
              ],
              [
                "Jornada de trabalho",
                admissao.contrato.jornadaSemanalHoras
                  ? `${plural(admissao.contrato.jornadaSemanalHoras, "hora", "horas")} por semana`
                  : null,
              ],
              [
                "Escala de trabalho",
                OPCOES_ESCALA.find(
                  (o) => o.codigo === admissao.contrato?.escala,
                )?.nome ?? null,
              ],
              [
                "Salário bruto",
                admissao.contrato.salarioBruto
                  ? `R$ ${formatarReais(Number(admissao.contrato.salarioBruto))}`
                  : null,
              ],
              [
                "Conselho e registro",
                admissao.contrato.conselhoProfissional
                  ? [
                      admissao.contrato.conselhoProfissional.toUpperCase(),
                      admissao.contrato.registroProfissional ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : null,
              ],
              [
                "Dependentes (IRRF)",
                admissao.contrato.dependentesIrrf === null ||
                admissao.contrato.dependentesIrrf === undefined
                  ? null
                  : String(admissao.contrato.dependentesIrrf),
              ],
              [
                "Pensão alimentícia",
                admissao.contrato.pensaoAlimenticiaPercentual
                  ? `${admissao.contrato.pensaoAlimenticiaPercentual.replace(".", ",")}%`
                  : null,
              ],
            ]}
          />
        ) : null}
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
        {envioDaFoto.estado !== "nenhum" ? (
          <EstadoDaFotoEnviada
            foto={foto}
            envio={envioDaFoto}
            onTentarDeNovo={onTentarFotoDeNovo}
            onEscolherOutra={onEscolherOutraFoto}
          />
        ) : null}
        <EnvioDosDocumentos
          documentos={documentos}
          envios={enviosDosDocumentos}
          onTentarDeNovo={onTentarDocumentoDeNovo}
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
            Revisar contatos
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onRecomecar}
            // T213 — com documento subindo, recomeçar perderia o envio.
            disabled={algumEnviando(documentos, enviosDosDocumentos)}
            aria-describedby={
              algumEnviando(documentos, enviosDosDocumentos)
                ? "nova-admissao-documentos-aguarde"
                : undefined
            }
          >
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

/**
 * T209 — a foto opcional na etapa 1: prévia local, "Enviar foto" (abre o
 * seletor) e "Remover". Nada sai do navegador aqui: a foto é enviada só
 * depois de a admissão ser concluída, e nunca vai para o rascunho.
 */
function BlocoDaFoto({
  foto,
  recusa,
  onEscolher,
  onRemover,
}: {
  readonly foto: FotoEscolhida | null;
  readonly recusa: string | null;
  readonly onEscolher: (arquivo: File | undefined) => void;
  readonly onRemover: () => void;
}) {
  const campoRef = useRef<HTMLInputElement | null>(null);
  return (
    <LinhaDoCadastro
      rotulo="Foto"
      ajuda="Aparece na lista de colaboradores e no perfil."
    >
      <div
        className="nova-admissao__foto"
        aria-describedby={`nova-admissao-foto-ajuda${recusa ? " nova-admissao-foto-recusa" : ""}`}
      >
        {foto ? (
          <img
            className="nova-admissao__foto-avatar"
            src={foto.url}
            alt="Prévia da foto do colaborador"
          />
        ) : (
          <span
            className="nova-admissao__foto-avatar nova-admissao__foto-avatar--vazio"
            aria-hidden="true"
          >
            <IconePessoaNeutra />
          </span>
        )}
        <div className="nova-admissao__foto-corpo">
          <div className="nova-admissao__foto-acoes">
            <Button
              id={ID_FOTO_ENVIAR}
              type="button"
              variant="secondary"
              onClick={() => campoRef.current?.click()}
            >
              Enviar foto
            </Button>
            {foto ? (
              <Button type="button" variant="subtle" onClick={onRemover}>
                Remover
              </Button>
            ) : null}
          </div>
          <p
            id="nova-admissao-foto-ajuda"
            className="nova-admissao__foto-ajuda"
          >
            PNG ou JPG, até 5 MB.
          </p>
          {recusa ? (
            <p
              id="nova-admissao-foto-recusa"
              className="nova-admissao__foto-recusa"
              role="alert"
            >
              {recusa}
            </p>
          ) : null}
        </div>
        <input
          ref={campoRef}
          id={ID_FOTO_ARQUIVO}
          type="file"
          accept={FOTO_TIPOS_ACEITOS}
          hidden
          tabIndex={-1}
          onChange={(e) => {
            onEscolher(e.target.files?.[0]);
            // Escolher o mesmo arquivo de novo também conta.
            e.target.value = "";
          }}
        />
      </div>
    </LinhaDoCadastro>
  );
}

/** T209 — o envio da foto na confirmação da admissão. */
function EstadoDaFotoEnviada({
  foto,
  envio,
  onTentarDeNovo,
  onEscolherOutra,
}: {
  readonly foto: FotoEscolhida | null;
  readonly envio: EnvioDaFoto;
  readonly onTentarDeNovo: () => void;
  readonly onEscolherOutra: (arquivo: File | undefined) => void;
}) {
  const campoRef = useRef<HTMLInputElement | null>(null);
  return (
    <section
      className="nova-admissao__bloco-gravado nova-admissao__foto-envio"
      aria-labelledby="nova-admissao-sucesso-foto"
    >
      <h3 id="nova-admissao-sucesso-foto" className="nova-admissao__subtitulo">
        Foto
      </h3>
      {foto && envio.estado === "enviada" ? (
        <img
          className="nova-admissao__foto-avatar"
          src={foto.url}
          alt="Foto do colaborador"
        />
      ) : null}
      {envio.estado === "enviando" ? (
        <p className="nova-admissao__texto" role="status">
          Enviando a foto…
        </p>
      ) : null}
      {envio.estado === "enviada" ? (
        <p className="nova-admissao__texto" role="status">
          Foto salva.
        </p>
      ) : null}
      {envio.estado === "falhou" ? (
        <>
          <div className="nova-admissao__erro-geral" role="alert">
            <p className="nova-admissao__texto">
              O colaborador foi criado, mas a foto não foi salva.
            </p>
            <p className="nova-admissao__texto">{envio.mensagem}</p>
          </div>
          <div className="nova-admissao__foto-acoes">
            {envio.podeRepetir && foto ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onTentarDeNovo}
              >
                Tentar enviar foto novamente
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => campoRef.current?.click()}
              >
                Escolher outra foto
              </Button>
            )}
          </div>
          <input
            ref={campoRef}
            id={ID_FOTO_OUTRA}
            type="file"
            accept={FOTO_TIPOS_ACEITOS}
            hidden
            tabIndex={-1}
            onChange={(e) => {
              onEscolherOutra(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </>
      ) : null}
    </section>
  );
}

/** Silhueta neutra da foto vazia (decorativa). */
function IconePessoaNeutra() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" focusable="false">
      <circle cx="12" cy="8.5" r="4" fill="currentColor" />
      <path d="M4 20.5c0-4.1 3.6-7 8-7s8 2.9 8 7z" fill="currentColor" />
    </svg>
  );
}
