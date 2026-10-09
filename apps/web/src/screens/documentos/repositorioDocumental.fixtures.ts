/**
 * Dados sintéticos da tela "Documentos > Repositório documental" (T070).
 *
 * Visão demonstrativa de um repositório documental — não é o backend real
 * (`apps/api/src/documentos/`, ADR 0011) nem o chama. É uma amostra própria,
 * independente do catálogo de `documentosMetadados.fixtures.ts`, pensada só
 * para ilustrar como uma listagem de referências técnicas e sua situação
 * poderiam aparecer, sem qualquer conteúdo de arquivo.
 *
 * Nomes de tipo documental continuam administrativos e neutros (endereço,
 * identificação, escolaridade, contratual) — nunca uma categoria que revele
 * informação sensível por inferência (saúde, família, filiação — ADR 0011,
 * O3). "Responsável técnico" é um identificador abstrato de equipe/papel
 * (nunca nome de pessoa). Validade é sempre ilustrativa.
 */
import { formatarDiaCivil } from "../../format/data";

export interface TipoRepositorioExemplo {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export type SituacaoRepositorio =
  "vigente" | "a_vencer" | "vencido" | "pendente_verificacao";

export interface RegistroRepositorioExemplo {
  readonly id: string;
  readonly referenciaTecnica: string;
  readonly tipoDocumento: string;
  readonly situacao: SituacaoRepositorio;
  readonly validade?: string;
  readonly responsavelTecnico: string;
  readonly pendencia: string;
}

export const ROTULO_SITUACAO_REPOSITORIO: Record<SituacaoRepositorio, string> =
  {
    vigente: "Vigente",
    a_vencer: "A vencer",
    vencido: "Vencido",
    pendente_verificacao: "Pendente de verificação",
  };

/**
 * Validade do registro — data civil em `DD/MM/AAAA` (T154).
 *
 * Mesma ressalva de `formatarValidade` (`documentosMetadados.fixtures.ts`): a
 * ausência mantém o texto longo em vez do traço porque a coluna desta tela é
 * declaradamente ilustrativa (o próprio cabeçalho diz "(ilustrativa)"). A T154
 * uniformiza o formato da data, não o vocabulário de ausência desta amostra.
 */
export function formatarValidadeRepositorio(
  item: RegistroRepositorioExemplo,
): string {
  return item.validade
    ? formatarDiaCivil(item.validade)
    : "Sem validade definida (exemplo)";
}

export const TIPOS_REPOSITORIO_EXEMPLO: readonly TipoRepositorioExemplo[] = [
  {
    id: "tipo-repo-1",
    codigo: "ENDERECO",
    nome: "Comprovante de Endereço (exemplo)",
  },
  {
    id: "tipo-repo-2",
    codigo: "IDENTIFICACAO",
    nome: "Documento de Identificação (exemplo)",
  },
  {
    id: "tipo-repo-3",
    codigo: "ESCOLARIDADE",
    nome: "Comprovante de Escolaridade (exemplo)",
  },
  {
    id: "tipo-repo-4",
    codigo: "CONTRATUAL",
    nome: "Registro Contratual (exemplo)",
  },
];

export const REGISTROS_REPOSITORIO_EXEMPLO: readonly RegistroRepositorioExemplo[] =
  [
    {
      id: "repo-exemplo-1",
      referenciaTecnica: "REP-2026-0001",
      tipoDocumento: "Comprovante de Endereço (exemplo)",
      situacao: "vigente",
      validade: "2026-11-10",
      responsavelTecnico: "RT-Documentos-01 (exemplo)",
      pendencia: "Nenhuma pendência",
    },
    {
      id: "repo-exemplo-2",
      referenciaTecnica: "REP-2026-0002",
      tipoDocumento: "Documento de Identificação (exemplo)",
      situacao: "a_vencer",
      validade: "2026-09-20",
      responsavelTecnico: "RT-Documentos-02 (exemplo)",
      pendencia: "Nenhuma pendência",
    },
    {
      id: "repo-exemplo-3",
      referenciaTecnica: "REP-2026-0003",
      tipoDocumento: "Comprovante de Escolaridade (exemplo)",
      situacao: "vencido",
      validade: "2026-05-01",
      responsavelTecnico: "RT-Documentos-01 (exemplo)",
      pendencia: "Pendência de atualização (exemplo)",
    },
    {
      id: "repo-exemplo-4",
      referenciaTecnica: "REP-2026-0004",
      tipoDocumento: "Registro Contratual (exemplo)",
      situacao: "pendente_verificacao",
      responsavelTecnico: "RT-Documentos-03 (exemplo)",
      pendencia: "Pendência de verificação técnica (exemplo)",
    },
    {
      id: "repo-exemplo-5",
      referenciaTecnica: "REP-2026-0005",
      tipoDocumento: "Comprovante de Endereço (exemplo)",
      situacao: "vigente",
      validade: "2027-01-15",
      responsavelTecnico: "RT-Documentos-02 (exemplo)",
      pendencia: "Nenhuma pendência",
    },
  ];
