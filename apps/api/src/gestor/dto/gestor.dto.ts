import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * Catálogo fechado de motivos de exceção (T151, ADR 0015, decisão 9).
 *
 * Código fechado pelo mesmo critério de `MOTIVOS` em pessoas: texto livre não
 * é auditável nem agregável, e "por que este gestor vê esta pessoa" é
 * exatamente a pergunta que uma auditoria precisa responder por categoria.
 * A justificativa em texto acompanha o código — não o substitui.
 */
export const MOTIVOS_EXCECAO_GESTOR = [
  "cobertura_de_ausencia",
  "projeto_temporario",
  "transicao_organizacional",
  "apuracao_formal",
] as const;

export const PAPEIS_GESTOR_EQUIPE = ["principal", "substituto"] as const;

/**
 * Data como `YYYY-MM-DD`, sem hora e sem fuso.
 *
 * `IsISO8601({ strict: true })` sozinho aceitaria `2026-01-05T10:00:00Z`, e
 * uma hora aqui criaria ambiguidade na fronteira de um escopo de autorização:
 * o dia em que alguém passa a ver outra pessoa não pode depender do fuso de
 * quem preencheu o formulário.
 */
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export class VincularContaDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  colaboradorId!: string;

  @IsISO8601({ strict: true })
  @IsString()
  vigenciaInicio!: string;
}

export class EncerrarVigenciaDto {
  @IsISO8601({ strict: true })
  @IsString()
  vigenciaFim!: string;
}

export class CriarAtribuicaoDto {
  @IsUUID()
  equipeId!: string;

  @IsUUID()
  gestorColaboradorId!: string;

  @IsIn(PAPEIS_GESTOR_EQUIPE)
  papel!: (typeof PAPEIS_GESTOR_EQUIPE)[number];

  @IsISO8601({ strict: true })
  @IsString()
  vigenciaInicio!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsString()
  vigenciaFim?: string;
}

export class CriarExcecaoDto {
  @IsUUID()
  gestorColaboradorId!: string;

  /**
   * O sujeito é o VÍNCULO, não o colaborador: um colaborador com vínculos em
   * empresas diferentes tornaria "qual pessoa, onde" ambíguo, e o vínculo é
   * quem carrega `empresa_id`.
   */
  @IsUUID()
  vinculoId!: string;

  @IsIn(MOTIVOS_EXCECAO_GESTOR)
  motivoCodigo!: (typeof MOTIVOS_EXCECAO_GESTOR)[number];

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  justificativa!: string;

  @IsISO8601({ strict: true })
  @IsString()
  vigenciaInicio!: string;

  /** Obrigatória: exceção sem prazo vira regra permanente por inércia. */
  @IsISO8601({ strict: true })
  @IsString()
  vigenciaFim!: string;
}

/**
 * Consulta consultiva do gestor: **nenhum parâmetro**.
 *
 * `dataReferencia` existia aqui e foi REMOVIDA — não por simplificação, mas
 * porque era uma falha de autorização. O serviço a usava para resolver a
 * ligação e as atribuições **do próprio ator**, de modo que um gestor cuja
 * atribuição já terminou recuperava o acesso bastando informar uma data de
 * dentro da janela antiga. Quem é autorizado passava a ser escolhido por quem
 * pergunta.
 *
 * A ADR 0015, decisão 8, é literal: *"Decisões de acesso usam o estado
 * vigente"*. Vigente é o do servidor, e não há segunda data que o cliente
 * possa oferecer.
 *
 * A classe continua existindo, vazia, de propósito: com `whitelist` e
 * `forbidNonWhitelisted` (ver `main.ts`), qualquer `?dataReferencia=...` passa
 * a responder **400**. Apagar o DTO faria o parâmetro ser silenciosamente
 * ignorado, e um cliente que o enviasse acreditaria estar consultando outra
 * data. Recusar é mais honesto que ignorar.
 *
 * Consulta histórica ("como estava a equipe em maio") não é isto, e não é
 * decisão tomada: exigiria dizer quem pode olhar para trás, até onde, e o que
 * acontece com quem saiu da equipe desde então. A ADR 0015 não cobriu nada
 * disso. Quando houver decisão, ela entra como capacidade própria.
 */
export class ConsultaEquipeQueryDto {}

export class ListarAtribuicoesQueryDto {
  @IsOptional()
  @IsUUID()
  equipeId?: string;
}

export class ListarExcecoesQueryDto {
  @IsOptional()
  @IsUUID()
  gestorColaboradorId?: string;
}

/** Valida `YYYY-MM-DD` puro, recusando data-hora. */
export function ehDiaIso(valor: string | undefined): boolean {
  return valor === undefined || DIA.test(valor);
}
