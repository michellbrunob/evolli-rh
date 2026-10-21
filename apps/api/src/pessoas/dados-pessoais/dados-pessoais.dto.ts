import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import {
  CEP_BRASILEIRO,
  CEP_FORMA,
  DATA_NASCIMENTO_MINIMA,
  LIMITES_ENDERECO,
  LIMITES_PERFIL,
  SEM_CONTROLE,
  SEXOS,
  type Sexo,
  ehPaisBrasil,
  normalizarCep,
  normalizarTextoPessoal,
} from "./normalizacao-dados-pessoais.util";

/**
 * T179 — com país Brasil, o CEP é obrigatoriamente os 8 dígitos já
 * normalizados (`normalizarCep`); com outro país, vale só `CEP_FORMA`.
 */
@ValidatorConstraint({ name: "cepCoerenteComPais", async: false })
export class CepCoerenteComPais implements ValidatorConstraintInterface {
  validate(valor: unknown, args: ValidationArguments): boolean {
    const pais = (args.object as { pais?: unknown }).pais;
    return (
      !ehPaisBrasil(pais) ||
      (typeof valor === "string" && CEP_BRASILEIRO.test(valor))
    );
  }
}

/**
 * Data de nascimento no intervalo aceito: de 1900-01-01 até hoje (UTC). O
 * banco guarda a borda inferior por CHECK; a superior depende do relógio, e
 * por isso fica só aqui. Não presume idade mínima: essa regra não foi dada.
 */
@ValidatorConstraint({ name: "dataNascimentoNoIntervalo", async: false })
export class DataNascimentoNoIntervalo implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    if (typeof valor !== "string") return false;
    const hoje = new Date().toISOString().slice(0, 10);
    return valor >= DATA_NASCIMENTO_MINIMA && valor <= hoje;
  }

  defaultMessage(): string {
    return "dataNascimento fora do intervalo aceito";
  }
}

/**
 * Dados pessoais básicos (T177, Módulo 1).
 *
 * OBRIGATÓRIO: `dataNascimento` — todo registro de perfil a tem, na admissão
 * e na edição (o banco a exige por NOT NULL). OPCIONAIS: os demais. Sexo, em
 * opções fechadas (`SEXOS`, T179); saudação, estado civil, nacionalidade,
 * naturalidade e escolaridade, em texto controlado — não há catálogo canônico
 * para eles, e esta fatia não inventa taxonomia. O servidor apara, colapsa
 * espaços e grava vazio como `null`.
 *
 * Nome completo NÃO está aqui: continua sendo `nome` da admissão, no
 * `Colaborador`. Nome social e gênero ficaram fora do Módulo 1 (matriz da PR).
 */
export class PerfilPessoalDto {
  @IsString()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @Validate(DataNascimentoNoIntervalo)
  dataNascimento!: string;

  /** T179 — opções fechadas (`SEXOS`); sem seleção, `null`. */
  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsIn(SEXOS)
  sexo?: Sexo | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_PERFIL.saudacao)
  @Matches(SEM_CONTROLE)
  saudacao?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_PERFIL.estadoCivil)
  @Matches(SEM_CONTROLE)
  estadoCivil?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_PERFIL.nacionalidade)
  @Matches(SEM_CONTROLE)
  nacionalidade?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_PERFIL.naturalidade)
  @Matches(SEM_CONTROLE)
  naturalidade?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_PERFIL.escolaridade)
  @Matches(SEM_CONTROLE)
  escolaridade?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_PERFIL.curso)
  @Matches(SEM_CONTROLE)
  curso?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_PERFIL.nomePai)
  @Matches(SEM_CONTROLE)
  nomePai?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_PERFIL.nomeMae)
  @Matches(SEM_CONTROLE)
  nomeMae?: string | null;
}

/**
 * Endereço (T177, Módulo 1). Todos opcionais, em texto controlado. País,
 * cidade e estado são texto validado nesta primeira entrega: não há catálogo
 * de país, UF ou município no sistema, e não há consulta externa de CEP
 * (integração externa exige aprovação — ADR 0016, `DP-ADM-12`).
 */
export class EnderecoDto {
  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_ENDERECO.pais)
  @Matches(SEM_CONTROLE)
  pais?: string | null;

  @Transform(({ value, obj }) =>
    normalizarCep(value, (obj as { pais?: unknown }).pais),
  )
  @IsOptional()
  @IsString()
  @Matches(CEP_FORMA)
  @Validate(CepCoerenteComPais)
  cep?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_ENDERECO.logradouro)
  @Matches(SEM_CONTROLE)
  logradouro?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_ENDERECO.numero)
  @Matches(SEM_CONTROLE)
  numero?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_ENDERECO.complemento)
  @Matches(SEM_CONTROLE)
  complemento?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_ENDERECO.bairro)
  @Matches(SEM_CONTROLE)
  bairro?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_ENDERECO.cidade)
  @Matches(SEM_CONTROLE)
  cidade?: string | null;

  @Transform(({ value }) => normalizarTextoPessoal(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES_ENDERECO.estado)
  @Matches(SEM_CONTROLE)
  estado?: string | null;
}

/**
 * Corpo de `PUT /colaboradores/:colaboradorId/dados-pessoais`. Cada bloco
 * informado SUBSTITUI o registro da categoria: campo ausente vira `null`. Sem
 * `empresaId` — a empresa vem da sessão e do vínculo, nunca do navegador.
 */
export class RegistrarDadosPessoaisDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PerfilPessoalDto)
  perfilPessoal?: PerfilPessoalDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco?: EnderecoDto;
}
