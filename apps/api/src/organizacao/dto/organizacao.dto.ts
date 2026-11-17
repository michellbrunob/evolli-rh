import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { StatusOrganizacional } from "@prisma/client";
import {
  TAMANHO_PAGINA_MAXIMO,
  TAMANHO_PAGINA_PADRAO,
} from "../organizacao.types";
import { LIMITE_BUSCA, normalizarBusca } from "../../pessoas/dto/pessoas.dto";

/**
 * Código estável e imutável de um nó organizacional (spec R1). Restrito a
 * maiúsculas, dígitos e `_`: sem acento, sem espaço, sem hífen interno e sem
 * caractere especial, conforme a decisão de nomenclatura (ADR 0006,
 * Emenda 1). Comprimento limitado para evitar entrada abusiva.
 */
const CODIGO_PATTERN = /^[A-Z0-9_]{2,32}$/;

const STATUS_ORGANIZACIONAL = [
  "ativo",
  "inativo",
] as const satisfies readonly StatusOrganizacional[];

export class CodigoNomeDto {
  @Matches(CODIGO_PATTERN)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(160)
  nome!: string;
}

/**
 * Atualização de nó organizacional: **só o nome**.
 *
 * `codigo` é imutável (R1) e a empresa é imutável (R7). As referências
 * estruturais (departamento, unidade) também não mudam aqui: reclassificar um
 * nó para outro pai é exatamente o fluxo de transferência que a Baseline V1
 * (item 7) declarou futuro, fora desta fatia.
 */
export class AtualizarNoOrganizacionalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(160)
  nome!: string;
}

export class CriarEmpresaDto extends CodigoNomeDto {}

/** T209 — faixas de pessoas no CNPJ (o "Porte" da Nova empresa). */
export const PORTES_DE_EMPRESA = [
  "1_10",
  "11_50",
  "51_200",
  "201_500",
  "501_1000",
  "mais_de_1000",
] as const;
export type PorteDeEmpresa = (typeof PORTES_DE_EMPRESA)[number];

/** T209 — as 27 unidades da federação. */
export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

/** Texto opcional: aparado; vazio vira ausente. */
const textoOpcional = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() || undefined : value;

/** T209 — endereço da empresa: tudo opcional (preenchido pelo CEP na tela). */
export class EnderecoDaEmpresaDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.replace(/\D/g, "") || undefined : value,
  )
  @Matches(/^[0-9]{8}$/)
  cep?: string;

  @IsOptional()
  @Transform(textoOpcional)
  @IsString()
  @MaxLength(200)
  logradouro?: string;

  @IsOptional()
  @Transform(textoOpcional)
  @IsString()
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @Transform(textoOpcional)
  @IsString()
  @MaxLength(120)
  complemento?: string;

  @IsOptional()
  @Transform(textoOpcional)
  @IsString()
  @MaxLength(120)
  bairro?: string;

  @IsOptional()
  @Transform(textoOpcional)
  @IsString()
  @MaxLength(120)
  cidade?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() || undefined : value,
  )
  @IsIn(UFS)
  uf?: string;
}

/**
 * T209 — Nova empresa (Configurações › Empresas). O código é gerado pelo
 * servidor a partir do nome; o CNPJ chega com ou sem máscara e os
 * verificadores são conferidos no serviço (422 no campo, sem eco).
 */
export class CadastrarEmpresaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  cnpj!: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome!: string;

  @IsOptional()
  @IsIn(PORTES_DE_EMPRESA)
  porte?: PorteDeEmpresa;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EnderecoDaEmpresaDto)
  endereco?: EnderecoDaEmpresaDto;
}

/**
 * T197 — criação de Departamento, Unidade, Cargo ou Centro de custo. Com
 * `codigo`, o caminho manual de sempre (Estrutura, Funções e cargos e o "+" da
 * T180), com as mesmas regras. Sem `codigo`, a criação inline da Nova
 * admissão: o SERVIDOR gera o código a partir do nome e recusa nome repetido
 * na empresa (`criacao-automatica.ts`). `null` ou vazio não contam como
 * ausente: são recusados pela regra do código.
 */
export class CodigoOpcionalNomeDto {
  @ValidateIf((o: { codigo?: unknown }) => o.codigo !== undefined)
  @Matches(CODIGO_PATTERN)
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(160)
  nome!: string;
}

export class CriarUnidadeOrganizacionalDto extends CodigoOpcionalNomeDto {
  @IsUUID()
  empresaId!: string;
}

export class CriarDepartamentoDto extends CodigoOpcionalNomeDto {
  @IsUUID()
  empresaId!: string;
}

export class CriarAreaDto extends CodigoNomeDto {
  @IsUUID()
  departamentoId!: string;
}

export class CriarEquipeDto extends CodigoNomeDto {
  /** Obrigatório: equipe sempre pertence a um departamento (Baseline V1, 3). */
  @IsUUID()
  departamentoId!: string;

  /** Opcional: vínculo com unidade é facultativo (Baseline V1, 3). */
  @IsOptional()
  @IsUUID()
  unidadeOrganizacionalId?: string;
}

export class CriarCargoDto extends CodigoOpcionalNomeDto {
  @IsUUID()
  empresaId!: string;
}

export class CriarCentroCustoDto extends CodigoOpcionalNomeDto {
  @IsUUID()
  empresaId!: string;
}

/**
 * Filtros de listagem. Apenas o necessário e autorizado (spec §10): sem
 * ordenação vinda do cliente e, fora das referências da lotação (T196,
 * `ListarReferenciasQueryDto`), sem texto livre. A ordenação é fixa por `codigo` no
 * service, e o escopo de empresa é sempre interseccionado com o da sessão —
 * `empresaId` aqui é filtro, nunca concessão de escopo.
 */
export class ListarNosOrganizacionaisQueryDto {
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

  @IsOptional()
  @IsIn(STATUS_ORGANIZACIONAL)
  status?: StatusOrganizacional;
}

export class ListarPorEmpresaQueryDto extends ListarNosOrganizacionaisQueryDto {
  @IsOptional()
  @IsUUID()
  empresaId?: string;
}

/**
 * T196 — listagem das referências usadas na lotação (Departamento, Cargo,
 * Unidade e Centro de custo), com busca opcional por **código ou nome**. Mesma
 * normalização da T178/T182: aparada, espaços colapsados, vazia vale como
 * ausente; até 160 caracteres e sem caractere de controle. A mensagem de erro
 * de validação diz só a regra, nunca o termo.
 */
export class ListarReferenciasQueryDto extends ListarPorEmpresaQueryDto {
  @Transform(({ value }) => normalizarBusca(value))
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE_BUSCA)
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\u0000-\u001F\u007F]*$/)
  busca?: string;
}

export class ListarAreasQueryDto extends ListarNosOrganizacionaisQueryDto {
  @IsOptional()
  @IsUUID()
  departamentoId?: string;
}

export class ListarEquipesQueryDto extends ListarPorEmpresaQueryDto {
  @IsOptional()
  @IsUUID()
  departamentoId?: string;

  @IsOptional()
  @IsUUID()
  unidadeOrganizacionalId?: string;
}
