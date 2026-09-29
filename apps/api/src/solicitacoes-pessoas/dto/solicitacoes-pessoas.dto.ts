import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from "class-validator";
import {
  AcaoSolicitacaoPessoa,
  MotivoSolicitacaoPessoa,
  SituacaoSolicitacaoPessoa,
  TipoSolicitacaoPessoa,
} from "@prisma/client";
import {
  TAMANHO_PAGINA_MAXIMO,
  TAMANHO_PAGINA_PADRAO,
} from "../solicitacoes-pessoas.types";

/** Catálogo aprovado por `PD-SOL-01`. `documento` não está aqui. */
const TIPOS = [
  "contestacao_ajuste_ponto",
  "ausencia",
  "ferias",
  "atualizacao_cadastral",
  "atestado",
  "beneficios",
] as const satisfies readonly TipoSolicitacaoPessoa[];

const MOTIVOS = [
  "divergencia_marcacao",
  "ausencia_programada",
  "periodo_ferias",
  "dado_cadastral_desatualizado",
  "atestado_apresentado",
  "beneficio_solicitado",
  "informacao_insuficiente",
  "fora_do_escopo_da_central",
  "duplicidade",
  "reanalise_administrativa",
  "correcao_de_registro",
  "outro_controlado",
] as const satisfies readonly MotivoSolicitacaoPessoa[];

const SITUACOES = [
  "rascunho",
  "enviada",
  "em_revisao_rh",
  "aguardando_informacao",
  "encaminhada_para_operacao_rh",
  "recusada",
  "cancelada",
] as const satisfies readonly SituacaoSolicitacaoPessoa[];

/**
 * Ações aceitas pela API. `criar` **não** está aqui: criar não é transição, é o
 * nascimento do registro, e tem rota própria.
 */
const ACOES = [
  "enviar",
  "cancelar",
  "iniciar_revisao",
  "aguardar_informacao",
  "retomar_revisao",
  "encaminhar_para_operacao",
  "recusar",
  "reabrir",
] as const satisfies readonly AcaoSolicitacaoPessoa[];

/** Dia de referência técnico, `AAAA-MM-DD`. A existência real do dia é
 * conferida no service (`2026-02-30` passa no formato e falha no calendário). */
const DIA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Paginação e ordenação fixas no servidor — nada vem do cliente. */
export class ListarPaginadoQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TAMANHO_PAGINA_MAXIMO)
  tamanhoPagina: number = TAMANHO_PAGINA_PADRAO;
}

/**
 * Registro de uma solicitação. Nasce em `rascunho` — a situação **não** é
 * aceita do cliente, senão seria possível pular a máquina de estados.
 *
 * Não existe campo de anexo, arquivo, URL, texto livre, diagnóstico, CID ou
 * descrição clínica: `PD-SOL-05` aprovou campos mínimos e manteve anexo
 * bloqueado, e `atestado` usa exatamente a mesma estrutura dos demais tipos.
 *
 * `empresaId` vem no corpo apenas para ser **conferido** contra o escopo da
 * sessão (e recusado quando divergir); ele nunca concede acesso.
 */
export class RegistrarSolicitacaoPessoaDto {
  @IsUUID()
  empresaId!: string;

  @IsUUID()
  vinculoId!: string;

  @IsIn(TIPOS)
  tipo!: TipoSolicitacaoPessoa;

  @IsIn(MOTIVOS)
  motivo!: MotivoSolicitacaoPessoa;

  /**
   * Opcional para todos os tipos: nenhuma decisão fixou quais tipos o exigem, e
   * exigir por inferência seria inventar regra de elegibilidade.
   */
  @IsOptional()
  @Matches(DIA_PATTERN)
  periodoReferencia?: string;
}

/**
 * Execução de uma transição aprovada. O motivo é obrigatório em `recusar` e
 * `reabrir` (a "justificativa auditada" de `PD-SOL-03`) — conferido no service,
 * porque é regra entre campos.
 */
export class TransicionarSolicitacaoPessoaDto {
  /** `criar` é excluído no TIPO, não só na validação: a rota de transição não
   * pode receber o nascimento do registro nem por engano. */
  @IsIn(ACOES)
  acao!: Exclude<AcaoSolicitacaoPessoa, "criar">;

  @IsOptional()
  @IsIn(MOTIVOS)
  motivo?: MotivoSolicitacaoPessoa;
}

/** Filtros de listagem. Todos opcionais; nenhum amplia escopo. */
export class ListarSolicitacoesPessoaQueryDto extends ListarPaginadoQueryDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @IsOptional()
  @IsUUID()
  vinculoId?: string;

  @IsOptional()
  @IsIn(TIPOS)
  tipo?: TipoSolicitacaoPessoa;

  @IsOptional()
  @IsIn(SITUACOES)
  situacao?: SituacaoSolicitacaoPessoa;
}
