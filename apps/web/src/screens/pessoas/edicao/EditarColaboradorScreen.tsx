/**
 * T215 — página "Editar colaborador" (decisão da proprietária de 2026-11-23:
 * a mesma organização e os mesmos textos da referência funcional).
 *
 * - **Cabeçalho:** voltar para Colaboradores, foto, "Editar colaborador", o
 *   nome, o Status e a lixeira (Desativar: preserva o histórico e pode ser
 *   reativado; nunca exclusão física).
 * - **Menu lateral:** Dados básicos, Dados profissionais, Endereço,
 *   Dependentes, Documentos, Dados bancários, Formação acadêmica e Campos
 *   extras. A seção é rota (`…/:id/editar/:secao`): quem troca é o shell.
 * - **Rodapé fixo:** "Última alteração em …" (ou "Você tem alterações não
 *   salvas") e as ações "Descartar" e "Salvar alterações".
 *
 * O formulário é UM só para a página: trocar de seção não perde o que foi
 * digitado, e "Salvar alterações" grava só os blocos alterados, cada um pelo
 * contrato que já existia:
 *
 * - nome: `PATCH /v1/colaboradores/:id`;
 * - identificação, nascimento, estado civil e contato de emergência: o bloco
 *   `perfilPessoal` de `PUT …/dados-pessoais` — o bloco substitui o registro
 *   inteiro, então os campos que esta página não mostra seguem como estavam;
 *   o sexo legado nunca vai (a chave ausente o mantém);
 * - endereço: o bloco `endereco` do mesmo `PUT`;
 * - e-mail e telefone pessoais: `PUT …/contatos` (o telefone fixo legado fica
 *   fora do corpo, e o servidor o mantém).
 *
 * Quem recusa é sempre o servidor. A guarda de saída do shell pergunta antes
 * de sair com alteração pendente.
 */
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  type ColaboradorApi,
  type VinculoApi,
  buscarColaborador,
  enviarFotoColaborador,
  listarDocumentosDoColaborador,
  listarVinculosDoColaborador,
  retificarColaborador,
} from "../../../api/colaboradoresClient";
import {
  type EnderecoApi,
  type PerfilPessoalApi,
  type RegistrarDadosPessoaisDto,
  consultarDadosPessoaisDoColaborador,
  registrarDadosPessoaisDoColaborador,
} from "../../../api/dadosPessoaisClient";
import {
  type ContatosApi,
  consultarContatosDoColaborador,
  registrarContatosDoColaborador,
} from "../../../api/contatosColaboradorClient";
import {
  type ContratoDoColaboradorApi,
  consultarContratoDoColaborador,
  desativarColaborador,
  reativarColaborador,
  registrarContratoDoColaborador,
} from "../../../api/edicaoColaboradorClient";
import type { SecaoDaEdicao } from "../../../app/rotasDoShell";
import { SECOES_DA_EDICAO } from "../../../app/rotasDoShell";
import { useEdicaoEmAndamento } from "../../../app/edicoesPendentes";
import { useTrilhaComplementar } from "../../../app/trilhaComplementar";
import { Button, FormActions } from "../../../components";
import {
  LinhaDoCadastro,
  SecaoDoCadastro,
} from "../../../components/cadastro/CadastroEmEtapas";
import { formatarInstante } from "../../../format/data";
import { exibirTelefone } from "../../../format/mascaras";
import { Dialog, IconButton, ListaDeEscolha } from "../../../ui";
import {
  IconeBanco,
  IconeCamposExtras,
  IconeDocumento,
  IconeEquipe,
  IconeFormacao,
  IconeLocal,
  IconeMaleta,
  IconePerfil,
  IconeRemover,
  IconeVoltar,
  type IconeDoEcossistema,
} from "../../../ui/icones";
import {
  type ChaveEndereco,
  type ValoresEndereco,
  blocoEndereco,
  enderecoParaEdicao,
  ehPaisBrasil,
  validarEndereco,
} from "../dadosPessoais";
import { normalizarTelefone, validarContatos } from "../contatosColaborador";
import { useCepAssistido } from "../cepAssistido";
import { UFS } from "../ufs";
import { vinculoPrincipal } from "../vinculoPrincipal";
import { FotoDoColaborador } from "../FotoDoColaborador";
import {
  OPCOES_ESTADO_CIVIL,
  OPCOES_GENERO,
  cpfValido,
  mascararCpf,
} from "../NovaAdmissaoScreen";
import { ArquivosDoColaborador } from "../documentos/ArquivosDoColaborador";
import {
  CATEGORIAS_PRINCIPAIS,
  principaisEnviados,
} from "../documentos/documentosDoColaborador";
import { MENSAGEM_CPF_EM_USO, useCpfEmUso } from "../useCpfEmUso";
import {
  type CampoProfissional,
  type ValoresProfissionais,
  dtoDoContrato,
  errosDaRecusaDoContrato,
  profissionaisDe,
  validarProfissionais,
} from "./dadosProfissionais";
import { SecaoDadosProfissionais } from "./SecaoDadosProfissionais";
import {
  type StatusDoColaboradorValor,
  StatusDoColaborador,
} from "./StatusDoColaborador";
import "../../../components/cadastro/CadastroEmEtapas.css";
import "./EditarColaboradorScreen.css";

export const EDITAR_COLABORADOR_TITULO_ID = "editar-colaborador-titulo";

const ROTULO_DA_SECAO: Readonly<Record<SecaoDaEdicao, string>> = {
  "dados-basicos": "Dados básicos",
  "dados-profissionais": "Dados profissionais",
  endereco: "Endereço",
  dependentes: "Dependentes",
  documentos: "Documentos",
  "dados-bancarios": "Dados bancários",
  "formacao-academica": "Formação acadêmica",
  "campos-extras": "Campos extras",
};

const ICONE_DA_SECAO: Readonly<Record<SecaoDaEdicao, IconeDoEcossistema>> = {
  "dados-basicos": IconePerfil,
  "dados-profissionais": IconeMaleta,
  endereco: IconeLocal,
  dependentes: IconeEquipe,
  documentos: IconeDocumento,
  "dados-bancarios": IconeBanco,
  "formacao-academica": IconeFormacao,
  "campos-extras": IconeCamposExtras,
};

type Status = StatusDoColaboradorValor;

/** Nome completo: pelo menos 3 letras e até 150 caracteres. */
const NOME_TRES_LETRAS = /^(?:[^\p{L}]*\p{L}){3}/u;
const NOME_MAXIMO = 150;
/** Telefone brasileiro como o servidor grava (`+55` + DDD + número). */
const TELEFONE_GRAVADO = /^\+55[1-9]{2}(?:9[0-9]{8}|[2-5][0-9]{7})$/;

// ---- o formulário ---------------------------------------------------------

interface DadosBasicos {
  readonly nome: string;
  readonly cpf: string;
  readonly rg: string;
  readonly dataNascimento: string;
  readonly genero: string;
  readonly estadoCivil: string;
  readonly emailPessoal: string;
  readonly telefonePessoal: string;
  readonly contatoEmergenciaNome: string;
  readonly contatoEmergenciaTelefone: string;
}

/** O que o servidor tem, como a página o edita. */
interface Gravado {
  readonly colaborador: ColaboradorApi;
  readonly vinculo: VinculoApi | null;
  readonly perfil: PerfilPessoalApi | null;
  readonly endereco: EnderecoApi | null;
  readonly contatos: ContatosApi | null;
}

type CampoComErro =
  | "nome"
  | "cpf"
  | "dataNascimento"
  | "emailPessoal"
  | "telefonePessoal"
  | "contatoEmergenciaTelefone"
  | ChaveEndereco
  | CampoProfissional;
type Erros = Partial<Record<CampoComErro, string>>;

const ORDEM_DOS_ERROS: readonly CampoComErro[] = [
  "nome",
  "cpf",
  "dataNascimento",
  "emailPessoal",
  "telefonePessoal",
  "contatoEmergenciaTelefone",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "estado",
  "gestorDiretoId",
  "jornadaSemanalHoras",
  "matricula",
  "salarioBruto",
  "registroProfissional",
  "dependentesIrrf",
  "pensaoAlimenticiaPercentual",
];

const CAMPOS_PROFISSIONAIS: readonly CampoProfissional[] = [
  "nivel",
  "gestorDiretoId",
  "jornadaSemanalHoras",
  "escala",
  "matricula",
  "salarioBruto",
  "conselhoProfissional",
  "registroProfissional",
  "dependentesIrrf",
  "pensaoAlimenticiaPercentual",
];

/** O contrato do vínculo principal: lido à parte (a página segue sem ele). */
type CargaDoContrato =
  | { readonly status: "carregando" }
  | { readonly status: "erro" }
  | { readonly status: "dados"; readonly gravado: ContratoDoColaboradorApi };

/** Os erros sem o do campo que mudou. */
function semErroDe(erros: Erros, campo: CampoComErro): Erros {
  const resto = { ...erros };
  delete resto[campo];
  return resto;
}

function dadosBasicosDe(g: Gravado): DadosBasicos {
  const p = g.perfil;
  return {
    nome: g.colaborador.nome,
    cpf: p?.cpf ? mascararCpf(p.cpf) : "",
    rg: p?.rg ?? "",
    dataNascimento: p?.dataNascimento ?? "",
    genero: p?.genero ?? "",
    estadoCivil: p?.estadoCivil ?? "",
    emailPessoal: g.contatos?.emailPessoal ?? "",
    telefonePessoal: exibirTelefone(g.contatos?.celular),
    contatoEmergenciaNome: p?.contatoEmergenciaNome ?? "",
    contatoEmergenciaTelefone: exibirTelefone(p?.contatoEmergenciaTelefone),
  };
}

function limpo(valor: string): string | null {
  const t = valor.trim().replace(/ {2,}/g, " ");
  return t === "" ? null : t;
}

/** O status do cabeçalho pelo que o servidor diz hoje. */
function statusDe(g: Gravado): Status {
  if (g.colaborador.situacao === "inativo") return "inativo";
  if (g.vinculo?.situacao === "encerrado") return "desligado";
  return "ativo";
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima =
    partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}

/** "Última alteração": o instante mais recente entre os blocos lidos. */
function ultimaAlteracao(g: Gravado): string | null {
  const instantes = [
    g.colaborador.atualizadoEm,
    g.perfil?.atualizadoEm,
    g.endereco?.atualizadoEm,
    g.contatos?.atualizadoEm,
  ].filter((v): v is string => typeof v === "string");
  if (instantes.length === 0) return null;
  return instantes.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

function diaDoInstante(instante: string): string {
  return formatarInstante(instante).split(" ")[0] ?? "";
}

// ---- a página -------------------------------------------------------------

export interface EditarColaboradorScreenProps {
  readonly colaboradorId: string;
  readonly secao: SecaoDaEdicao;
  /** Outra seção: o shell troca a rota. */
  readonly onTrocarSecao: (secao: SecaoDaEdicao) => void;
  /** Voltar (à ficha de origem ou à lista: quem decide é o shell). */
  readonly onVoltar: () => void;
  /** T215 — o nome do botão voltar ("Voltar para a ficha" vindo da ficha). */
  readonly rotuloVoltar?: string;
}

type Carga =
  | { readonly status: "carregando" }
  | { readonly status: "erro" }
  | { readonly status: "dados"; readonly gravado: Gravado };

export function EditarColaboradorScreen({
  colaboradorId,
  secao,
  onTrocarSecao,
  onVoltar,
  rotuloVoltar = "Voltar para Colaboradores",
}: EditarColaboradorScreenProps) {
  const base = useId();
  const id = (campo: string) => `${base}-${campo}`;
  const [carga, setCarga] = useState<Carga>({ status: "carregando" });
  const [basicos, setBasicos] = useState<DadosBasicos | null>(null);
  const [endereco, setEndereco] = useState<ValoresEndereco | null>(null);
  const [contrato, setContrato] = useState<CargaDoContrato>({
    status: "carregando",
  });
  /** Desativação feita nesta página (até lá, vale a do servidor). */
  const [desativadoAgora, setDesativadoAgora] = useState<boolean | null>(null);
  const [confirmacao, setConfirmacao] = useState<
    "desativar" | "reativar" | null
  >(null);
  const [alternando, setAlternando] = useState(false);
  const [profissionais, setProfissionais] =
    useState<ValoresProfissionais | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  // Como a referência: ponto em "Documentos" enquanto faltar obrigatório.
  const [docsPendentes, setDocsPendentes] = useState(false);
  const [fotoEnviando, setFotoEnviando] = useState(false);
  const [falhaDaFoto, setFalhaDaFoto] = useState<string | null>(null);
  const focoPendente = useRef<CampoComErro | null>(null);
  const entradaDaFoto = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarga({ status: "carregando" });
    try {
      const [colaborador, vinculos, dados, contatos] = await Promise.all([
        buscarColaborador(colaboradorId),
        listarVinculosDoColaborador(colaboradorId),
        consultarDadosPessoaisDoColaborador(colaboradorId),
        consultarContatosDoColaborador(colaboradorId),
      ]);
      const gravado: Gravado = {
        colaborador,
        vinculo: vinculoPrincipal(vinculos),
        perfil: dados.perfilPessoal,
        endereco: dados.endereco,
        contatos: contatos.contatos,
      };
      setCarga({ status: "dados", gravado });
      setBasicos(dadosBasicosDe(gravado));
      setEndereco(enderecoParaEdicao(gravado.endereco));
    } catch {
      setCarga({ status: "erro" });
    }
  }, [colaboradorId]);

  const carregarContrato = useCallback(async () => {
    setContrato({ status: "carregando" });
    try {
      const gravado = await consultarContratoDoColaborador(colaboradorId);
      setContrato({ status: "dados", gravado });
      setProfissionais(profissionaisDe(gravado));
    } catch {
      setContrato({ status: "erro" });
    }
  }, [colaboradorId]);

  useEffect(() => {
    void carregar();
    void carregarContrato();
  }, [carregar, carregarContrato]);

  // A pendência de documentos aparece no menu desde a abertura; sem a lista
  // (falha ou sem permissão), nada é mostrado.
  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const docs = await listarDocumentosDoColaborador(colaboradorId);
        if (ativo && Array.isArray(docs)) {
          setDocsPendentes(
            principaisEnviados(docs) < CATEGORIAS_PRINCIPAIS.length,
          );
        }
      } catch {
        // Sem a lista, o menu fica sem o ponto.
      }
    })();
    return () => {
      ativo = false;
    };
  }, [colaboradorId]);

  // O aviso de "salvo" é da seção em que se salvou.
  useEffect(() => {
    setAviso(null);
  }, [secao]);

  const gravado = carga.status === "dados" ? carga.gravado : null;
  const basicosGravados = useMemo(
    () => (gravado ? dadosBasicosDe(gravado) : null),
    [gravado],
  );

  // T215 — CPF trocado: o repetido na empresa aparece enquanto se digita
  // (a própria pessoa não conta). O gravado não é consultado.
  const soDigitos = (v: string | undefined) => (v ?? "").replace(/D/g, "");
  const cpfEmUso = useCpfEmUso(
    basicos && soDigitos(basicos.cpf) !== soDigitos(basicosGravados?.cpf)
      ? basicos.cpf
      : "",
    cpfValido,
    colaboradorId,
  );
  useEffect(() => {
    if (!cpfEmUso) return;
    setErros((prev) =>
      prev.cpf === MENSAGEM_CPF_EM_USO
        ? prev
        : { ...prev, cpf: MENSAGEM_CPF_EM_USO },
    );
  }, [cpfEmUso]);
  const enderecoGravado = useMemo(
    () => (gravado ? enderecoParaEdicao(gravado.endereco) : null),
    [gravado],
  );

  const contratoGravado = contrato.status === "dados" ? contrato.gravado : null;
  const profissionaisGravados = useMemo(
    () => (contratoGravado ? profissionaisDe(contratoGravado) : null),
    [contratoGravado],
  );

  const mudou = useMemo(() => {
    const nome = !!basicos && basicos.nome !== basicosGravados?.nome;
    const perfil =
      !!basicos &&
      !!basicosGravados &&
      (
        [
          "cpf",
          "rg",
          "dataNascimento",
          "genero",
          "estadoCivil",
          "contatoEmergenciaNome",
          "contatoEmergenciaTelefone",
        ] as const
      ).some((c) => basicos[c] !== basicosGravados[c]);
    const contatos =
      !!basicos &&
      !!basicosGravados &&
      (basicos.emailPessoal !== basicosGravados.emailPessoal ||
        basicos.telefonePessoal !== basicosGravados.telefonePessoal);
    const enderecoMudou =
      !!endereco &&
      !!enderecoGravado &&
      (Object.keys(endereco) as ChaveEndereco[]).some(
        (c) => endereco[c] !== enderecoGravado[c],
      );
    const contratoMudou =
      !!profissionais &&
      !!profissionaisGravados &&
      CAMPOS_PROFISSIONAIS.some(
        (c) => profissionais[c] !== profissionaisGravados[c],
      );
    return {
      nome,
      perfil,
      contatos,
      endereco: enderecoMudou,
      contrato: contratoMudou,
    };
  }, [
    basicos,
    basicosGravados,
    endereco,
    enderecoGravado,
    profissionais,
    profissionaisGravados,
  ]);
  const pendente =
    mudou.nome ||
    mudou.perfil ||
    mudou.contatos ||
    mudou.endereco ||
    mudou.contrato;

  useEdicaoEmAndamento("Editar colaborador", { pendente, salvando });
  // A barra mostra "Pessoas / Colaboradores / Editar colaborador".
  useTrilhaComplementar("Editar colaborador", onVoltar);

  // O foco vai ao primeiro campo recusado, depois de a seção dele aparecer.
  useEffect(() => {
    const campo = focoPendente.current;
    if (!campo) return;
    const alvo = document.getElementById(id(campo));
    if (alvo) {
      focoPendente.current = null;
      alvo.focus();
    }
  });

  function atualizarBasicos<K extends keyof DadosBasicos>(
    campo: K,
    valor: DadosBasicos[K],
  ) {
    setBasicos((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    setErros((atual) => {
      if (!(campo in atual)) return atual;
      return semErroDe(atual, campo as CampoComErro);
    });
    setAviso(null);
  }

  function atualizarProfissionais(campo: CampoProfissional, valor: string) {
    setProfissionais((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    setErros((atual) => {
      if (!(campo in atual)) return atual;
      return semErroDe(atual, campo);
    });
    setAviso(null);
  }

  function atualizarEndereco(campo: ChaveEndereco, valor: string) {
    setEndereco((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    setErros((atual) => {
      if (!(campo in atual)) return atual;
      return semErroDe(atual, campo);
    });
    setAviso(null);
  }

  const cep = useCepAssistido({
    endereco: endereco ?? enderecoParaEdicao(null),
    setEndereco: (acao) =>
      setEndereco((atual) => {
        const anterior = atual ?? enderecoParaEdicao(null);
        return typeof acao === "function" ? acao(anterior) : acao;
      }),
    onErroNoCep: (mensagem) => setErros((e) => ({ ...e, cep: mensagem })),
    onCamposAjustados: (campos) =>
      setErros((e) => {
        const novo = { ...e };
        for (const c of campos) delete novo[c];
        return novo;
      }),
    idBotaoBuscar: id("buscar-cep"),
  });

  function validar(): Erros {
    const novos: Erros = {};
    if (!basicos) return novos;
    if (mudou.nome) {
      const nome = basicos.nome.trim();
      if (!NOME_TRES_LETRAS.test(nome) || nome.length > NOME_MAXIMO) {
        novos.nome = "Informe o nome completo (pelo menos 3 letras).";
      }
    }
    if (mudou.perfil) {
      const digitos = basicos.cpf.replace(/\D/g, "");
      if (digitos === "") novos.cpf = "Informe o CPF.";
      else if (!cpfValido(digitos)) novos.cpf = "Informe um CPF válido.";
      else if (cpfEmUso) novos.cpf = MENSAGEM_CPF_EM_USO;
      const telefone = basicos.contatoEmergenciaTelefone.trim();
      if (
        telefone !== "" &&
        !TELEFONE_GRAVADO.test(normalizarTelefone(telefone))
      ) {
        novos.contatoEmergenciaTelefone =
          "Informe o telefone com DDD, como (00) 00000-0000.";
      }
    }
    if (mudou.contatos) {
      const errosContatos = validarContatos({
        emailPessoal: basicos.emailPessoal,
        celular: basicos.telefonePessoal,
        telefone: "",
      });
      if (errosContatos.emailPessoal) {
        novos.emailPessoal = errosContatos.emailPessoal;
      }
      if (errosContatos.celular) {
        novos.telefonePessoal =
          "Informe o telefone com DDD, como (00) 00000-0000.";
      }
    }
    if (mudou.endereco && endereco) {
      Object.assign(novos, validarEndereco(endereco));
    }
    if (mudou.contrato && profissionais) {
      Object.assign(novos, validarProfissionais(profissionais));
    }
    return novos;
  }

  /** A seção em que cada campo mora (para levar até o primeiro erro). */
  function secaoDoCampo(campo: CampoComErro): SecaoDaEdicao {
    if ((CAMPOS_PROFISSIONAIS as readonly string[]).includes(campo)) {
      return "dados-profissionais";
    }
    return [
      "cep",
      "logradouro",
      "numero",
      "complemento",
      "bairro",
      "cidade",
      "estado",
      "pais",
    ].includes(campo)
      ? "endereco"
      : "dados-basicos";
  }

  async function salvar(evento?: FormEvent) {
    evento?.preventDefault();
    if (!gravado || !basicos || !endereco || salvando) return;
    setAviso(null);
    setFalha(null);
    const novos = validar();
    setErros(novos);
    const primeiro = ORDEM_DOS_ERROS.find((c) => novos[c]);
    if (primeiro) {
      focoPendente.current = primeiro;
      const destino = secaoDoCampo(primeiro);
      if (destino !== secao) onTrocarSecao(destino);
      else document.getElementById(id(primeiro))?.focus();
      return;
    }
    if (!pendente) return;
    setSalvando(true);
    let atual = gravado;
    try {
      if (mudou.nome) {
        const colaborador = await retificarColaborador(colaboradorId, {
          nome: basicos.nome.trim().replace(/ {2,}/g, " "),
        });
        atual = {
          ...atual,
          colaborador: { ...atual.colaborador, ...colaborador },
        };
      }
      if (mudou.perfil || mudou.endereco) {
        const dto: RegistrarDadosPessoaisDto = {};
        if (mudou.perfil) {
          const p = gravado.perfil;
          const telefone = limpo(basicos.contatoEmergenciaTelefone);
          dto.perfilPessoal = {
            dataNascimento: basicos.dataNascimento || null,
            cpf: basicos.cpf.replace(/\D/g, "") || null,
            rg: limpo(basicos.rg),
            genero: basicos.genero || null,
            estadoCivil: basicos.estadoCivil || null,
            contatoEmergenciaNome: limpo(basicos.contatoEmergenciaNome),
            contatoEmergenciaTelefone:
              telefone === null ? null : normalizarTelefone(telefone),
            // O que esta página não mostra segue como está.
            saudacao: p?.saudacao ?? null,
            nacionalidade: p?.nacionalidade ?? null,
            naturalidade: p?.naturalidade ?? null,
            escolaridade: p?.escolaridade ?? null,
            curso: p?.curso ?? null,
            nomePai: p?.nomePai ?? null,
            nomeMae: p?.nomeMae ?? null,
          };
        }
        if (mudou.endereco) dto.endereco = blocoEndereco(endereco);
        const dados = await registrarDadosPessoaisDoColaborador(
          colaboradorId,
          dto,
        );
        atual = {
          ...atual,
          perfil: dados.perfilPessoal,
          endereco: dados.endereco,
        };
      }
      if (mudou.contatos) {
        const email = basicos.emailPessoal.trim().toLowerCase();
        const celular = basicos.telefonePessoal.trim();
        const resposta = await registrarContatosDoColaborador(colaboradorId, {
          emailPessoal: email === "" ? null : email,
          celular: celular === "" ? null : normalizarTelefone(celular),
        });
        atual = { ...atual, contatos: resposta.contatos };
      }
      if (mudou.contrato && profissionais) {
        try {
          const gravadoDoContrato = await registrarContratoDoColaborador(
            colaboradorId,
            dtoDoContrato(profissionais),
          );
          setContrato({ status: "dados", gravado: gravadoDoContrato });
          setProfissionais(profissionaisDe(gravadoDoContrato));
        } catch (erro) {
          const porCampo =
            erro instanceof ApiError && erro.erros
              ? errosDaRecusaDoContrato(erro.erros)
              : {};
          const primeiroCampo = ORDEM_DOS_ERROS.find(
            (c) => (porCampo as Erros)[c],
          );
          if (primeiroCampo) {
            setErros((e) => ({ ...e, ...porCampo }));
            focoPendente.current = primeiroCampo;
            if (secao !== "dados-profissionais") {
              onTrocarSecao("dados-profissionais");
            }
          }
          throw erro;
        }
      }
      setCarga({ status: "dados", gravado: atual });
      setBasicos(dadosBasicosDe(atual));
      setEndereco(enderecoParaEdicao(atual.endereco));
      setAviso("Alterações salvas.");
    } catch {
      // O que já foi gravado fica como gravado; o resto segue pendente.
      setCarga({ status: "dados", gravado: atual });
      setFalha(
        "Não foi possível salvar todas as alterações. Confira os dados e tente de novo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  function descartar() {
    if (!gravado) return;
    setBasicos(dadosBasicosDe(gravado));
    setEndereco(enderecoParaEdicao(gravado.endereco));
    if (contratoGravado) setProfissionais(profissionaisDe(contratoGravado));
    setErros({});
    setFalha(null);
    setAviso(null);
    cep.reiniciar();
  }

  async function enviarFoto(arquivo: File) {
    setFalhaDaFoto(null);
    setFotoEnviando(true);
    try {
      const resposta = await enviarFotoColaborador(colaboradorId, arquivo);
      setCarga((c) =>
        c.status === "dados"
          ? {
              status: "dados",
              gravado: {
                ...c.gravado,
                colaborador: {
                  ...c.gravado.colaborador,
                  foto: { versao: resposta.versao },
                },
              },
            }
          : c,
      );
      setAviso("Foto enviada.");
    } catch {
      setFalhaDaFoto(
        "Não foi possível enviar a foto. Use PNG ou JPG de até 5 MB.",
      );
    } finally {
      setFotoEnviando(false);
    }
  }

  /**
   * Férias e Afastado chegam com o módulo de Férias e ausências; o
   * desligamento é um ato com data, no Histórico funcional. Inativo e Ativo
   * são a desativação e a reativação (ver `desativar`).
   */
  function escolherStatus(novo: Status) {
    setFalha(null);
    if (novo === "inativo") {
      if (!desativado) setConfirmacao("desativar");
      return;
    }
    if (novo === "ativo") {
      if (desativado) setConfirmacao("reativar");
      return;
    }
    setAviso(
      novo === "ferias" || novo === "afastado"
        ? "Férias e afastamentos serão registrados em Férias e ausências, que chega na próxima versão."
        : "O desligamento é registrado no Histórico funcional, com a data e o motivo.",
    );
  }

  /** Desativar (lixeira) ou reativar: nunca apaga; o histórico fica. */
  async function alternarDesativacao(acao: "desativar" | "reativar") {
    setConfirmacao(null);
    setAlternando(true);
    setAviso(null);
    setFalha(null);
    try {
      const resposta =
        acao === "desativar"
          ? await desativarColaborador(colaboradorId)
          : await reativarColaborador(colaboradorId);
      setDesativadoAgora(resposta.desativado);
      setAviso(
        resposta.desativado
          ? "Colaborador desativado."
          : "Colaborador reativado.",
      );
    } catch {
      setFalha(
        acao === "desativar"
          ? "Não foi possível desativar agora. Tente de novo."
          : "Não foi possível reativar agora. Tente de novo.",
      );
    } finally {
      setAlternando(false);
    }
  }

  // ---- peças de campo -----------------------------------------------------

  function propsDoCampo(campo: CampoComErro) {
    const erro = erros[campo];
    return {
      id: id(campo),
      ...(erro
        ? {
            "aria-invalid": true as const,
            "aria-describedby": id(`${campo}-erro`),
          }
        : {}),
    };
  }
  function erroDe(campo: CampoComErro): ReactNode {
    const erro = erros[campo];
    return erro ? (
      <p id={id(`${campo}-erro`)} className="cadastro-etapas__linha-erro">
        {erro}
      </p>
    ) : null;
  }

  // ---- render -------------------------------------------------------------

  const nome = gravado?.colaborador.nome ?? "";
  const desativado = desativadoAgora ?? contratoGravado?.desativado ?? false;
  const status: Status = desativado
    ? "inativo"
    : gravado
      ? statusDe(gravado)
      : "ativo";
  const ultima = gravado
    ? [ultimaAlteracao(gravado), contratoGravado?.atualizadoEm ?? null]
        .filter((v): v is string => v !== null)
        .reduce<string | null>(
          (a, b) => (a === null || Date.parse(b) > Date.parse(a) ? b : a),
          null,
        )
    : null;

  return (
    <div className="cadastro-etapas editar-colaborador">
      <header className="editar-colaborador__cabecalho">
        <IconButton
          label={rotuloVoltar}
          variant="subtle"
          icon={<IconeVoltar />}
          onClick={onVoltar}
        />
        <span className="editar-colaborador__avatar" aria-hidden="true">
          {gravado ? (
            <FotoDoColaborador
              colaboradorId={colaboradorId}
              foto={gravado.colaborador.foto}
              tamanho={96}
            >
              {iniciais(nome)}
            </FotoDoColaborador>
          ) : null}
        </span>
        <div className="editar-colaborador__identidade">
          <h1
            id={EDITAR_COLABORADOR_TITULO_ID}
            tabIndex={-1}
            className="editar-colaborador__titulo"
          >
            Editar colaborador
          </h1>
          <p className="editar-colaborador__nome">{nome}</p>
        </div>
        <div className="editar-colaborador__acoes-do-topo">
          <StatusDoColaborador
            valor={status}
            desabilitado={!gravado || alternando || !contratoGravado}
            onEscolher={escolherStatus}
          />
          {desativado ? null : (
            <button
              type="button"
              className="editar-colaborador__lixeira"
              aria-label="Desativar colaborador"
              disabled={!gravado || alternando}
              onClick={() => setConfirmacao("desativar")}
            >
              <IconeRemover tamanho={20} />
            </button>
          )}
        </div>
      </header>

      <Dialog
        aberto={confirmacao !== null}
        titulo={
          confirmacao === "reativar"
            ? `Reativar ${nome}?`
            : `Desativar ${nome}?`
        }
        descricao={
          confirmacao === "reativar"
            ? "A pessoa volta às listas de ativos, com os dados e o histórico de antes."
            : "A pessoa sai das listas de ativos. Os dados e o histórico ficam guardados, e dá para reativar depois."
        }
        onFechar={() => setConfirmacao(null)}
        rodape={
          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmacao(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() =>
                confirmacao && void alternarDesativacao(confirmacao)
              }
            >
              {confirmacao === "reativar" ? "Reativar" : "Desativar"}
            </Button>
          </FormActions>
        }
      >
        <p className="editar-colaborador__texto-janela">
          {confirmacao === "reativar"
            ? "Ela aparece de novo em Ativos."
            : "Ela continua em Todos, marcada como Inativo."}
        </p>
      </Dialog>

      {carga.status === "erro" ? (
        <div className="editar-colaborador__falha" role="alert">
          <p>Não foi possível carregar os dados do colaborador.</p>
          <Button variant="secondary" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <form
        className="editar-colaborador__corpo"
        noValidate
        onSubmit={(e) => void salvar(e)}
        aria-label="Editar colaborador"
      >
        <nav
          className="editar-colaborador__menu"
          aria-label="Seções do colaborador"
        >
          <ul>
            {SECOES_DA_EDICAO.map((s) => (
              <li key={s}>
                <a
                  href={`#/pessoas/colaboradores/${colaboradorId}/editar/${s}`}
                  className={
                    s === secao
                      ? "editar-colaborador__item editar-colaborador__item--atual"
                      : "editar-colaborador__item"
                  }
                  {...(s === "documentos" && docsPendentes
                    ? { "aria-describedby": id("docs-pendentes") }
                    : {})}
                  {...(s === secao ? { "aria-current": "page" as const } : {})}
                  onClick={(e) => {
                    e.preventDefault();
                    if (s !== secao) onTrocarSecao(s);
                  }}
                >
                  {(() => {
                    const Icone = ICONE_DA_SECAO[s];
                    return <Icone tamanho={18} />;
                  })()}
                  {ROTULO_DA_SECAO[s]}
                  {s === "documentos" && docsPendentes ? (
                    <span
                      className="editar-colaborador__pendencia"
                      aria-hidden="true"
                    />
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
          <span id={id("docs-pendentes")} className="sr-only">
            Documentos obrigatórios pendentes
          </span>
        </nav>

        <div className="editar-colaborador__conteudo">
          {carga.status === "carregando" ? (
            <p role="status" className="editar-colaborador__carregando">
              Carregando…
            </p>
          ) : null}
          {gravado && basicos && endereco ? (
            <section
              className="editar-colaborador__secao"
              aria-labelledby={id("titulo-secao")}
            >
              <header className="cadastro-etapas__etapa-cabecalho">
                <div className="cadastro-etapas__etapa-textos">
                  <h2
                    id={id("titulo-secao")}
                    className="cadastro-etapas__etapa-titulo"
                  >
                    {ROTULO_DA_SECAO[secao]}
                  </h2>
                  <p className="cadastro-etapas__etapa-descricao">
                    {descricaoDaSecao(secao, primeiroNome(nome))}
                  </p>
                </div>
              </header>
              {secao === "dados-basicos" ? (
                <>
                  <SecaoDoCadastro
                    titulo="Identificação"
                    descricao="Aparecem no perfil, nos documentos e no eSocial."
                  >
                    <LinhaDoCadastro
                      rotulo="Foto"
                      ajuda="Aparece na lista de colaboradores e no perfil."
                      grupo={false}
                    >
                      <div className="editar-colaborador__foto">
                        <span
                          className="editar-colaborador__avatar editar-colaborador__avatar--grande"
                          aria-hidden="true"
                        >
                          <FotoDoColaborador
                            colaboradorId={colaboradorId}
                            foto={gravado.colaborador.foto}
                            tamanho={96}
                          >
                            {iniciais(nome)}
                          </FotoDoColaborador>
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={fotoEnviando}
                          onClick={() => entradaDaFoto.current?.click()}
                        >
                          {fotoEnviando ? "Enviando…" : "Enviar foto"}
                        </Button>
                        <input
                          ref={entradaDaFoto}
                          type="file"
                          accept="image/png,image/jpeg"
                          hidden
                          tabIndex={-1}
                          onChange={(e) => {
                            const arquivo = e.target.files?.[0];
                            e.target.value = "";
                            if (arquivo) void enviarFoto(arquivo);
                          }}
                        />
                      </div>
                      <p className="cadastro-etapas__linha-ajuda">
                        PNG ou JPG, até 5 MB.
                      </p>
                      {falhaDaFoto ? (
                        <p className="cadastro-etapas__linha-erro" role="alert">
                          {falhaDaFoto}
                        </p>
                      ) : null}
                    </LinhaDoCadastro>
                    <LinhaDoCadastro
                      rotulo="Nome completo"
                      ajuda="Como está nos documentos oficiais."
                      paraId={id("nome")}
                    >
                      <input
                        type="text"
                        maxLength={NOME_MAXIMO}
                        autoComplete="off"
                        placeholder="Nome completo"
                        aria-required="true"
                        value={basicos.nome}
                        onChange={(e) =>
                          atualizarBasicos("nome", e.target.value)
                        }
                        {...propsDoCampo("nome")}
                      />
                      {erroDe("nome")}
                    </LinhaDoCadastro>
                    <LinhaDoCadastro
                      rotulo="CPF e RG"
                      ajuda="Usados na folha e no eSocial."
                    >
                      <div className="cadastro-etapas__linha-par editar-colaborador__par">
                        <div className="cadastro-etapas__linha-celula">
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={14}
                            placeholder="000.000.000-00"
                            aria-label="CPF"
                            aria-required="true"
                            value={basicos.cpf}
                            onChange={(e) =>
                              atualizarBasicos(
                                "cpf",
                                mascararCpf(e.target.value),
                              )
                            }
                            {...propsDoCampo("cpf")}
                          />
                          {erroDe("cpf")}
                        </div>
                        <div className="cadastro-etapas__linha-celula">
                          <input
                            type="text"
                            autoComplete="off"
                            maxLength={20}
                            placeholder="00.000.000-0"
                            aria-label="RG"
                            value={basicos.rg}
                            onChange={(e) =>
                              atualizarBasicos("rg", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </LinhaDoCadastro>
                    <LinhaDoCadastro
                      rotulo="Data de nascimento"
                      paraId={id("dataNascimento")}
                    >
                      <input
                        type="date"
                        value={basicos.dataNascimento}
                        onChange={(e) =>
                          atualizarBasicos("dataNascimento", e.target.value)
                        }
                        {...propsDoCampo("dataNascimento")}
                      />
                      {erroDe("dataNascimento")}
                    </LinhaDoCadastro>
                    <LinhaDoCadastro rotulo="Gênero e estado civil">
                      <div className="cadastro-etapas__linha-par editar-colaborador__par">
                        <div className="cadastro-etapas__linha-celula">
                          <ListaDeEscolha
                            aria-label="Gênero"
                            vazio="Selecione"
                            valor={basicos.genero}
                            opcoes={OPCOES_GENERO.map((o) => ({
                              valor: o.codigo,
                              rotulo: o.rotulo,
                            }))}
                            onMudar={(v) => atualizarBasicos("genero", v)}
                          />
                        </div>
                        <div className="cadastro-etapas__linha-celula">
                          <ListaDeEscolha
                            aria-label="Estado civil"
                            vazio="Selecione"
                            valor={basicos.estadoCivil}
                            opcoes={OPCOES_ESTADO_CIVIL.map((o) => ({
                              valor: o,
                              rotulo: o,
                            }))}
                            onMudar={(v) => atualizarBasicos("estadoCivil", v)}
                          />
                        </div>
                      </div>
                    </LinhaDoCadastro>
                  </SecaoDoCadastro>
                  <SecaoDoCadastro
                    titulo="Contato"
                    descricao="Canais pessoais para falar com a pessoa."
                  >
                    <LinhaDoCadastro
                      rotulo="E-mail pessoal"
                      ajuda="Diferente do e-mail corporativo."
                      paraId={id("emailPessoal")}
                    >
                      <input
                        type="email"
                        maxLength={254}
                        autoComplete="off"
                        placeholder="email@exemplo.com"
                        value={basicos.emailPessoal}
                        onChange={(e) =>
                          atualizarBasicos("emailPessoal", e.target.value)
                        }
                        {...propsDoCampo("emailPessoal")}
                      />
                      {erroDe("emailPessoal")}
                    </LinhaDoCadastro>
                    <LinhaDoCadastro
                      rotulo="Telefone pessoal"
                      ajuda="Com DDD."
                      paraId={id("telefonePessoal")}
                    >
                      <input
                        type="tel"
                        autoComplete="off"
                        placeholder="(00) 00000-0000"
                        value={basicos.telefonePessoal}
                        onChange={(e) =>
                          atualizarBasicos("telefonePessoal", e.target.value)
                        }
                        {...propsDoCampo("telefonePessoal")}
                      />
                      {erroDe("telefonePessoal")}
                    </LinhaDoCadastro>
                  </SecaoDoCadastro>
                  <SecaoDoCadastro
                    titulo="Contato de emergência"
                    descricao="Acionado apenas em situações de urgência."
                  >
                    <LinhaDoCadastro
                      rotulo="Nome do contato"
                      paraId={id("contatoEmergenciaNome")}
                    >
                      <input
                        id={id("contatoEmergenciaNome")}
                        type="text"
                        maxLength={150}
                        autoComplete="off"
                        placeholder="Nome do contato"
                        value={basicos.contatoEmergenciaNome}
                        onChange={(e) =>
                          atualizarBasicos(
                            "contatoEmergenciaNome",
                            e.target.value,
                          )
                        }
                      />
                    </LinhaDoCadastro>
                    <LinhaDoCadastro
                      rotulo="Telefone do contato"
                      paraId={id("contatoEmergenciaTelefone")}
                    >
                      <input
                        type="tel"
                        autoComplete="off"
                        placeholder="(00) 00000-0000"
                        value={basicos.contatoEmergenciaTelefone}
                        onChange={(e) =>
                          atualizarBasicos(
                            "contatoEmergenciaTelefone",
                            e.target.value,
                          )
                        }
                        {...propsDoCampo("contatoEmergenciaTelefone")}
                      />
                      {erroDe("contatoEmergenciaTelefone")}
                    </LinhaDoCadastro>
                  </SecaoDoCadastro>
                </>
              ) : secao === "endereco" ? (
                <SecaoDoCadastro
                  titulo="Endereço residencial"
                  descricao="Preenchemos o restante automaticamente a partir do CEP."
                >
                  <LinhaDoCadastro rotulo="CEP" paraId={id("cep")}>
                    <input
                      type="text"
                      className="editar-colaborador__cep"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={12}
                      placeholder="00000-000"
                      value={endereco.cep}
                      onChange={(e) => {
                        atualizarEndereco("cep", e.target.value);
                        cep.descartarResultado();
                      }}
                      onBlur={() => void cep.buscar("saida")}
                      {...propsDoCampo("cep")}
                    />
                    {erroDe("cep")}
                    {cep.estado.tipo === "buscando" ? (
                      <p className="cadastro-etapas__linha-ajuda" role="status">
                        Buscando o endereço do CEP…
                      </p>
                    ) : cep.estado.tipo === "aviso" ? (
                      <p className="cadastro-etapas__linha-ajuda" role="status">
                        {cep.estado.mensagem}
                      </p>
                    ) : cep.estado.tipo === "sugerido" ? (
                      <p className="cadastro-etapas__linha-ajuda" role="status">
                        {cep.estado.encontrado
                          ? "Endereço localizado pelo CEP."
                          : cep.estado.mensagem}
                      </p>
                    ) : null}
                    {cep.estado.tipo === "sugerido" &&
                    cep.estado.mantidos.length > 0 ? (
                      <div>
                        <Button
                          id={id("buscar-cep")}
                          type="button"
                          variant="subtle"
                          onClick={cep.usarEnderecoDoCep}
                        >
                          Usar endereço do CEP
                        </Button>
                      </div>
                    ) : null}
                  </LinhaDoCadastro>
                  <LinhaDoCadastro rotulo="Logradouro e número">
                    <div className="editar-colaborador__par editar-colaborador__par--largo">
                      <div className="cadastro-etapas__linha-celula">
                        <input
                          type="text"
                          maxLength={200}
                          aria-label="Logradouro"
                          placeholder="Rua, avenida…"
                          value={endereco.logradouro}
                          onChange={(e) =>
                            atualizarEndereco("logradouro", e.target.value)
                          }
                          {...propsDoCampo("logradouro")}
                        />
                        {erroDe("logradouro")}
                      </div>
                      <div className="cadastro-etapas__linha-celula">
                        <input
                          type="text"
                          maxLength={20}
                          aria-label="Número"
                          placeholder="Nº"
                          value={endereco.numero}
                          onChange={(e) =>
                            atualizarEndereco("numero", e.target.value)
                          }
                          {...propsDoCampo("numero")}
                        />
                        {erroDe("numero")}
                      </div>
                    </div>
                  </LinhaDoCadastro>
                  <LinhaDoCadastro
                    rotulo="Complemento"
                    paraId={id("complemento")}
                  >
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="Apto, bloco, sala…"
                      value={endereco.complemento}
                      onChange={(e) =>
                        atualizarEndereco("complemento", e.target.value)
                      }
                      {...propsDoCampo("complemento")}
                    />
                    {erroDe("complemento")}
                  </LinhaDoCadastro>
                  <LinhaDoCadastro rotulo="Bairro" paraId={id("bairro")}>
                    <input
                      type="text"
                      maxLength={120}
                      value={endereco.bairro}
                      onChange={(e) =>
                        atualizarEndereco("bairro", e.target.value)
                      }
                      {...propsDoCampo("bairro")}
                    />
                    {erroDe("bairro")}
                  </LinhaDoCadastro>
                  <LinhaDoCadastro rotulo="Cidade e estado">
                    <div className="editar-colaborador__par editar-colaborador__par--largo">
                      <div className="cadastro-etapas__linha-celula">
                        <input
                          type="text"
                          maxLength={120}
                          aria-label="Cidade"
                          value={endereco.cidade}
                          onChange={(e) =>
                            atualizarEndereco("cidade", e.target.value)
                          }
                          {...propsDoCampo("cidade")}
                        />
                        {erroDe("cidade")}
                      </div>
                      <div className="cadastro-etapas__linha-celula">
                        {ehPaisBrasil(endereco.pais) ? (
                          <ListaDeEscolha
                            aria-label="Estado"
                            vazio="UF"
                            valor={endereco.estado}
                            opcoes={UFS.map((u) => ({
                              valor: u.sigla,
                              rotulo: u.sigla,
                            }))}
                            onMudar={(v) => atualizarEndereco("estado", v)}
                            {...propsDoCampo("estado")}
                          />
                        ) : (
                          <input
                            type="text"
                            maxLength={80}
                            aria-label="Estado"
                            value={endereco.estado}
                            onChange={(e) =>
                              atualizarEndereco("estado", e.target.value)
                            }
                            {...propsDoCampo("estado")}
                          />
                        )}
                        {erroDe("estado")}
                      </div>
                    </div>
                  </LinhaDoCadastro>
                </SecaoDoCadastro>
              ) : secao === "documentos" ? (
                <div className="editar-colaborador__documentos">
                  <ArquivosDoColaborador
                    colaboradorId={colaboradorId}
                    podeOperar
                    onDocumentos={(docs) =>
                      setDocsPendentes(
                        principaisEnviados(docs) < CATEGORIAS_PRINCIPAIS.length,
                      )
                    }
                  />
                </div>
              ) : secao === "dados-profissionais" ? (
                contratoGravado && profissionais ? (
                  <SecaoDadosProfissionais
                    colaboradorId={colaboradorId}
                    contrato={contratoGravado}
                    valores={profissionais}
                    onAlterar={atualizarProfissionais}
                    propsDoCampo={propsDoCampo}
                    erroDe={erroDe}
                  />
                ) : contrato.status === "erro" ? (
                  <div className="editar-colaborador__falha" role="alert">
                    <p>Não foi possível carregar os dados profissionais.</p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void carregarContrato()}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <p className="cadastro-etapas__linha-ajuda" role="status">
                    Carregando os dados profissionais…
                  </p>
                )
              ) : (
                <SecaoVazia secao={secao} />
              )}
            </section>
          ) : null}
        </div>

        <div
          className="cadastro-etapas__rodape editar-colaborador__rodape"
          role="region"
          aria-label="Ações da edição"
        >
          <p className="editar-colaborador__estado">
            {pendente
              ? "Você tem alterações não salvas"
              : ultima
                ? `Última alteração em ${diaDoInstante(ultima)}`
                : null}
          </p>
          <div className="cadastro-etapas__rodape-acoes">
            <Button
              type="button"
              variant="subtle"
              onClick={descartar}
              disabled={salvando || !gravado || !pendente}
            >
              Descartar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={salvando || !gravado || !pendente}
            >
              {salvando ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
        {aviso ? (
          <p className="editar-colaborador__aviso" role="status">
            {aviso}
          </p>
        ) : null}
        {falha ? (
          <p className="editar-colaborador__falha-texto" role="alert">
            {falha}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function descricaoDaSecao(secao: SecaoDaEdicao, nome: string): string {
  switch (secao) {
    case "dados-basicos":
      return `Informações pessoais e de contato de ${nome}.`;
    case "dados-profissionais":
      return `Cargo, contrato e remuneração de ${nome}.`;
    case "endereco":
      return "Residência usada em correspondências e no eSocial.";
    case "dependentes":
      return "Pessoas vinculadas para IRRF, plano de saúde e benefícios.";
    case "documentos":
      return "Arquivos de quem colabora · até 10 MB por arquivo.";
    case "dados-bancarios":
      return "Contas usadas para pagamento de salário e reembolsos.";
    case "formacao-academica":
      return "Grau de instrução, graduação, pós e cursos complementares.";
    case "campos-extras":
      return "Informações personalizadas pela sua empresa.";
  }
}

const VAZIO_DA_SECAO: Partial<
  Record<
    SecaoDaEdicao,
    { readonly acao: string; readonly titulo: string; readonly texto: string }
  >
> = {
  dependentes: {
    acao: "Adicionar dependente",
    titulo: "Nenhum dependente cadastrado",
    texto:
      "Filhos, cônjuge e outras pessoas vinculadas para IRRF, plano de saúde e benefícios.",
  },
  "dados-bancarios": {
    acao: "Adicionar conta",
    titulo: "Nenhuma conta cadastrada",
    texto:
      "Cadastre a conta que recebe o salário. Dá para ter mais de uma, como a de reembolsos.",
  },
  "formacao-academica": {
    acao: "Adicionar formação",
    titulo: "Nenhuma formação cadastrada",
    texto:
      "Registre graduação, pós e cursos complementares. O certificado pode ser anexado.",
  },
  "campos-extras": {
    acao: "Gerenciar campos",
    titulo: "Nenhum campo extra criado",
    texto:
      "Crie campos próprios da sua empresa, como tamanho da camiseta ou matrícula interna.",
  },
};

/**
 * Seções cujo cadastro no servidor chega nas próximas entregas (decisão de
 * 2026-11-23: construir o servidor de cada uma). Até lá, o estado vazio da
 * referência e a ação desabilitada, com o motivo dito.
 */
function SecaoVazia({ secao }: { readonly secao: SecaoDaEdicao }) {
  const vazio = VAZIO_DA_SECAO[secao];
  const idMotivo = useId();
  if (!vazio) return null;
  return (
    <div className="editar-colaborador__vazio">
      <div className="editar-colaborador__vazio-acao">
        <Button
          type="button"
          variant="secondary"
          aria-disabled="true"
          aria-describedby={idMotivo}
          onClick={(e) => e.preventDefault()}
        >
          {vazio.acao}
        </Button>
      </div>
      <p className="editar-colaborador__vazio-titulo">{vazio.titulo}</p>
      <p className="editar-colaborador__vazio-texto">{vazio.texto}</p>
      <p id={idMotivo} className="editar-colaborador__vazio-motivo">
        O cadastro desta seção chega na próxima versão.
      </p>
    </div>
  );
}
