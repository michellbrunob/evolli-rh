/**
 * T215 — Benefícios (como a referência): o contrato de `/v1/beneficios`, da
 * ficha (`/v1/colaboradores/:id/beneficios`) e dos dependentes
 * (`/v1/colaboradores/:id/dependentes`). Valores calculados em CENTAVOS;
 * valores das regras em reais. Escritas com CSRF; nada se apaga.
 */
import { ApiError } from "./colaboradoresClient";
import {
  clearCsrfToken,
  descartarTokenSeDesatualizado,
  getCsrfToken,
  refreshCsrfToken,
} from "./csrfClient";

export type CategoriaBeneficio =
  | "alimentacao"
  | "mobilidade"
  | "saude"
  | "odontologico"
  | "seguro_vida"
  | "bem_estar"
  | "saude_mental"
  | "educacao"
  | "trabalho_remoto"
  | "multibeneficios"
  | "antecipacao"
  | "outros";
export type FolhaBeneficio = "desconto" | "adicional" | "fora_da_folha";
export type TipoDeValorBeneficio =
  "fixo" | "dia_util" | "individual" | "faixa_etaria" | "antecipacao";
export type SituacaoBeneficio = "ativo" | "pausado" | "encerrado";

export interface QuemPagaApi {
  modo: "empresa_parte" | "colaborador_tudo" | "empresa_tudo";
  calculo: "percentual" | "valor";
  empresa: number;
}

export interface PlanoApi {
  id: string;
  nome: string;
  valor: number;
}

export interface AntecipacaoApi {
  mensalidade: number | null;
  mensalidadeQuemPaga: "empresa" | "colaborador";
  modo: "variavel" | "percentual";
  percentual: number | null;
  diaDesconto: number | null;
}

export interface RegrasDoBeneficioApi {
  categoria: CategoriaBeneficio;
  folha: FolhaBeneficio;
  tipoValor: TipoDeValorBeneficio;
  valorMensal: number | null;
  valorDia: number | null;
  diasModo: "uteis" | "escala";
  individualModo: "plano" | "livre";
  planos: PlanoApi[];
  faixas: number[];
  colaboradorPaga: {
    calculo: "percentual" | "valor";
    titular: number;
    dependente: number;
  };
  coparticipacao: boolean;
  quemPaga: QuemPagaApi;
  vt: { percentualSalario: number; empresaCusteiaTudo: boolean };
  antecipacao: AntecipacaoApi | null;
}

export interface BeneficioDto {
  nome: string;
  categoria: CategoriaBeneficio;
  folha: FolhaBeneficio;
  tipoValor: TipoDeValorBeneficio;
  inicio: string;
  fim: string | null;
  observacao: string | null;
  regras: Partial<RegrasDoBeneficioApi>;
  pessoas?: {
    colaboradorId: string;
    planoId?: string | null;
    valorIndividual?: number | null;
  }[];
  aPartirDe?: string;
}

export interface BeneficioApi {
  id: string;
  nome: string;
  categoria: CategoriaBeneficio;
  folha: FolhaBeneficio;
  tipoValor: TipoDeValorBeneficio;
  inicio: string;
  fim: string | null;
  observacao: string | null;
  regras: RegrasDoBeneficioApi;
  situacao: SituacaoBeneficio;
  suspensoAPartirDe: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export type OrigemDosDias = "uteis" | "escala" | "catalogo" | "digitado";
export type PendenciaBeneficio =
  "sem_nascimento" | "sem_salario" | "sem_plano" | "sem_valor";
export type ObservacaoBeneficio = "estagio_sem_desconto" | "limitado_ao_vt";

export interface CalculoApi {
  dias: number | null;
  origemDias: OrigemDosDias | null;
  valorDia: number | null;
  faixa: string | null;
  dependentesNoPlano: number;
  valor: number;
  empresa: number;
  desconto: number;
  adicional: number;
  parteColaborador: number;
  pendencia: PendenciaBeneficio | null;
  observacao: ObservacaoBeneficio | null;
}

export interface PessoaDoBeneficioApi extends CalculoApi {
  colaboradorId: string;
  nome: string;
  /** Só para RH e DP (busca, colar lista, importar). */
  cpf: string | null;
  cargo: string | null;
  departamento: string | null;
  departamentoId: string | null;
  contrato: string;
  escala: string | null;
  planoId: string | null;
  valorIndividual: number | null;
  ajustado: boolean;
  /** Digitados no mês (reais). */
  coparticipacao: number | null;
  antecipado: number | null;
  dependentesCadastrados: number;
  desligado: boolean;
}

export interface TotaisApi {
  pessoas: number;
  comPendencia: number;
  dependentes: number;
  valor: number;
  empresa: number;
  desconto: number;
  adicional: number;
}

export interface DetalheDoBeneficioApi {
  beneficio: BeneficioApi;
  competencia: string;
  diasUteis: number;
  totais: TotaisApi;
  pessoas: PessoaDoBeneficioApi[];
  historico: number;
}

export interface LinhaDeBeneficioApi {
  id: string;
  nome: string;
  categoria: CategoriaBeneficio;
  situacao: SituacaoBeneficio;
  suspensoAPartirDe: string | null;
  pessoas: number;
  /** Dependentes no plano (faixa etária). */
  dependentes: number;
  empresa: number;
  desconto: number;
}

export interface PessoaSemBeneficioApi {
  colaboradorId: string;
  nome: string;
  cargo: string | null;
}

export interface ResumoDaListaApi {
  /** Pessoas distintas nos benefícios ativos do mês. */
  pessoas: number;
  /** Pessoas com desconto em folha no mês. */
  comDesconto: number;
  empresa: number;
  desconto: number;
  beneficiosAtivos: number;
  /** Pessoas ativas da empresa. */
  ativos: number;
  semBeneficio: PessoaSemBeneficioApi[];
}

export interface ListaDeBeneficiosApi {
  competencia: string;
  beneficios: LinhaDeBeneficioApi[];
  resumo: ResumoDaListaApi;
}

export type ColunaDaImportacao =
  "dias" | "valorDia" | "valorMes" | "coparticipacao" | "antecipado";

export interface LinhaDaPlanilhaDto {
  linha: number;
  cpf: string;
  valores: Partial<Record<ColunaDaImportacao, string | null>>;
}

export interface ProblemaDaLinhaApi {
  campo: "cpf" | "valores" | ColunaDaImportacao;
  motivo:
    "obrigatorio" | "invalido" | "nao_encontrado" | "nao_recebe" | "duplicado";
}

export interface ValoresDaPessoaApi {
  valor: number;
  empresa: number;
  desconto: number;
}

export interface LinhaConferidaApi {
  linha: number;
  cpf: string;
  colaboradorId: string | null;
  nome: string | null;
  situacao: "pronta" | "sem_mudanca" | "pendencia";
  problemas: ProblemaDaLinhaApi[];
  valores: Partial<Record<ColunaDaImportacao, number>>;
  antes: ValoresDaPessoaApi | null;
  depois: ValoresDaPessoaApi | null;
}

export interface ImportacaoConferidaApi {
  competencia: string;
  colunas: ColunaDaImportacao[];
  linhas: LinhaConferidaApi[];
}

export interface SimulacaoDeDependentesApi {
  competencia: string;
  antes: ValoresDaPessoaApi;
  depois: ValoresDaPessoaApi;
}

export interface PreviaApi {
  competencia: string;
  diasUteis: number;
  exemplo: CalculoApi;
  exemplosVt: {
    rotulo: "salario" | "estagio" | "sem_salario";
    salario: number | null;
    calculo: CalculoApi;
  }[];
  ans: {
    vezes: number;
    seisVezesOk: boolean;
    variacao1a7: number;
    variacao7a10: number;
    variacaoOk: boolean;
    maximoUltima: number;
  } | null;
  pat: { percentualColaborador: number; dentro: boolean } | null;
  pessoas: PessoaDoBeneficioApi[];
  totais: TotaisApi;
}

export interface HistoricoApi {
  itens: {
    id: string;
    tipo: string;
    aPartirDe: string;
    descricao: string;
    criadoEm: string;
  }[];
}

export interface FichaDeBeneficiosApi {
  competencia: string;
  salarioBruto: number | null;
  beneficios: {
    id: string;
    nome: string;
    categoria: CategoriaBeneficio;
    situacao: SituacaoBeneficio;
    valor: number;
    empresa: number;
    desconto: number;
    adicional: number;
    pendencia: PendenciaBeneficio | null;
  }[];
}

export type Parentesco =
  | "conjuge"
  | "filho"
  | "pai_mae"
  | "irmao"
  | "grau_1"
  | "grau_2"
  | "grau_3"
  | "outro";

export interface DependenteApi {
  id: string;
  nome: string;
  parentesco: Parentesco;
  dataNascimento: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
}

export interface DependenteDto {
  nome: string;
  parentesco: Parentesco | "";
  dataNascimento: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
}

export interface DependenteDoPlanoApi {
  id: string;
  nome: string;
  parentesco: Parentesco;
  dataNascimento: string | null;
  noPlano: boolean;
}

export interface LinhaDeValoresDto {
  colaboradorId: string;
  dias?: number | null;
  valorDia?: number | null;
  valorMes?: number | null;
  coparticipacao?: number | null;
  antecipado?: number | null;
  planoId?: string | null;
  valorIndividual?: number | null;
}

export interface AlterarEmLoteDto {
  competencia: string;
  para: "todos" | "selecionados" | "grupo";
  colaboradorIds?: string[];
  escalas?: string[];
  departamentoIds?: string[];
  valorDia?: number | null;
  reajustePercentual?: number | null;
  dias?: number | null;
  duracao: "mes" | "em_diante";
}

async function pedir<T>(
  rota: string,
  metodo: "GET" | "POST" | "PUT",
  corpo?: unknown,
): Promise<T> {
  const escrita = metodo !== "GET";
  const res = await fetch(`/v1${rota}`, {
    method: metodo,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(escrita
        ? { "x-csrf-token": getCsrfToken() ?? (await refreshCsrfToken()) }
        : {}),
    },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  });
  if (res.status === 401) clearCsrfToken();
  if (escrita) await descartarTokenSeDesatualizado(res);
  if (!res.ok) {
    const erro: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, "Erro na requisição.", erro);
  }
  return res.json() as Promise<T>;
}

const id = encodeURIComponent;
const comp = (c?: string, extra = "") =>
  c ? `?competencia=${id(c)}${extra}` : extra ? `?${extra.slice(1)}` : "";

export const listarBeneficios = (competencia?: string) =>
  pedir<ListaDeBeneficiosApi>(`/beneficios${comp(competencia)}`, "GET");
export const previaDoBeneficio = (
  dto: Partial<BeneficioDto> & {
    competencia?: string;
    incluirDesligados?: boolean;
  },
) => pedir<PreviaApi>("/beneficios/previa", "POST", dto);
export const criarBeneficio = (dto: BeneficioDto) =>
  pedir<BeneficioApi>("/beneficios", "POST", dto);
export const obterBeneficio = (beneficioId: string, competencia?: string) =>
  pedir<DetalheDoBeneficioApi>(
    `/beneficios/${id(beneficioId)}${comp(competencia)}`,
    "GET",
  );
export const alterarBeneficio = (
  beneficioId: string,
  dto: BeneficioDto & { aPartirDe?: string },
) => pedir<BeneficioApi>(`/beneficios/${id(beneficioId)}`, "PUT", dto);
export const historicoDoBeneficio = (beneficioId: string) =>
  pedir<HistoricoApi>(`/beneficios/${id(beneficioId)}/historico`, "GET");
export const candidatosDoBeneficio = (
  beneficioId: string,
  competencia: string,
  incluirDesligados: boolean,
) =>
  pedir<{ competencia: string; pessoas: PessoaDoBeneficioApi[] }>(
    `/beneficios/${id(beneficioId)}/candidatos${comp(competencia, incluirDesligados ? "&incluirDesligados=true" : "")}`,
    "GET",
  );
export const adicionarPessoasAoBeneficio = (
  beneficioId: string,
  aPartirDe: string,
  pessoas: { colaboradorId: string }[],
) =>
  pedir<{ adicionadas: number }>(
    `/beneficios/${id(beneficioId)}/pessoas`,
    "POST",
    {
      aPartirDe,
      pessoas,
    },
  );
export const removerPessoaDoBeneficio = (
  beneficioId: string,
  colaboradorId: string,
) =>
  pedir<{ removida: true }>(
    `/beneficios/${id(beneficioId)}/pessoas/${id(colaboradorId)}/remover`,
    "POST",
  );
export const salvarValoresDoBeneficio = (
  beneficioId: string,
  competencia: string,
  linhas: LinhaDeValoresDto[],
  origem: "tela" | "importacao" = "tela",
) =>
  pedir<{ alteradas: number }>(
    `/beneficios/${id(beneficioId)}/valores`,
    "PUT",
    {
      competencia,
      linhas,
      ...(origem === "importacao" ? { origem } : {}),
    },
  );
export const conferirImportacaoDoBeneficio = (
  beneficioId: string,
  competencia: string,
  linhas: LinhaDaPlanilhaDto[],
) =>
  pedir<ImportacaoConferidaApi>(
    `/beneficios/${id(beneficioId)}/importacao/conferir`,
    "POST",
    { competencia, linhas },
  );
export const simularDependentesNoPlano = (
  beneficioId: string,
  colaboradorId: string,
  dependenteIds: string[],
  aPartirDe: string,
) =>
  pedir<SimulacaoDeDependentesApi>(
    `/beneficios/${id(beneficioId)}/pessoas/${id(colaboradorId)}/dependentes/simular`,
    "POST",
    { dependenteIds, aPartirDe },
  );
export const alterarValoresEmLote = (
  beneficioId: string,
  dto: AlterarEmLoteDto,
) =>
  pedir<{ alteradas: number }>(
    `/beneficios/${id(beneficioId)}/valores/lote`,
    "POST",
    dto,
  );
export const dependentesDaPessoaNoBeneficio = (
  beneficioId: string,
  colaboradorId: string,
  competencia: string,
) =>
  pedir<{ dependentes: DependenteDoPlanoApi[] }>(
    `/beneficios/${id(beneficioId)}/pessoas/${id(colaboradorId)}/dependentes${comp(competencia)}`,
    "GET",
  );
export const salvarDependentesNoPlano = (
  beneficioId: string,
  colaboradorId: string,
  dependenteIds: string[],
  aPartirDe: string,
) =>
  pedir<{ noPlano: number }>(
    `/beneficios/${id(beneficioId)}/pessoas/${id(colaboradorId)}/dependentes`,
    "PUT",
    { dependenteIds, aPartirDe },
  );
export const pausarBeneficio = (beneficioId: string, aPartirDe: string) =>
  pedir<BeneficioApi>(`/beneficios/${id(beneficioId)}/pausar`, "POST", {
    aPartirDe,
  });
export const encerrarBeneficio = (beneficioId: string, aPartirDe: string) =>
  pedir<BeneficioApi>(`/beneficios/${id(beneficioId)}/encerrar`, "POST", {
    aPartirDe,
  });
export const reativarBeneficio = (beneficioId: string) =>
  pedir<BeneficioApi>(`/beneficios/${id(beneficioId)}/reativar`, "POST");
export const excluirBeneficio = (beneficioId: string) =>
  pedir<{ excluido: true }>(`/beneficios/${id(beneficioId)}/excluir`, "POST");
export const duplicarBeneficio = (beneficioId: string) =>
  pedir<BeneficioApi>(`/beneficios/${id(beneficioId)}/duplicar`, "POST");

export const beneficiosDaFicha = (
  colaboradorId: string,
  competencia?: string,
) =>
  pedir<FichaDeBeneficiosApi>(
    `/colaboradores/${id(colaboradorId)}/beneficios${comp(competencia)}`,
    "GET",
  );

export const listarDependentes = (colaboradorId: string) =>
  pedir<{ dependentes: DependenteApi[] }>(
    `/colaboradores/${id(colaboradorId)}/dependentes`,
    "GET",
  );
export const criarDependente = (colaboradorId: string, dto: DependenteDto) =>
  pedir<DependenteApi>(
    `/colaboradores/${id(colaboradorId)}/dependentes`,
    "POST",
    dto,
  );
export const alterarDependente = (
  colaboradorId: string,
  dependenteId: string,
  dto: DependenteDto,
) =>
  pedir<DependenteApi>(
    `/colaboradores/${id(colaboradorId)}/dependentes/${id(dependenteId)}`,
    "PUT",
    dto,
  );
export const removerDependente = (
  colaboradorId: string,
  dependenteId: string,
) =>
  pedir<{ removido: true }>(
    `/colaboradores/${id(colaboradorId)}/dependentes/${id(dependenteId)}/remover`,
    "POST",
  );
