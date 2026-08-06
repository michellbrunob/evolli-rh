import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { StatusOrganizacional } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { EscopoOrganizacional, filtroEmpresa } from "./escopo.util";

/** Nó organizacional mínimo, o suficiente para validar pai e escopo. */
export interface NoPai {
  id: string;
  empresaId: string;
  status: StatusOrganizacional;
}

/**
 * Resolve a **empresa pai** de um nó a ser criado, aplicando escopo e
 * integridade de uma vez só:
 *
 * - fora do escopo do ator ou inexistente → devolve `null`, para que o
 *   service registre o evento `denied` antes de responder 404 (spec §9/§10);
 * - existente, no escopo, porém **inativa** → **422** (R-INA-3: entidade
 *   inativa não aceita novos vínculos). Não é negação de acesso, é dado
 *   inválido — por isso lança aqui e não vira evento `denied`.
 *
 * A empresa nunca vem do cliente como concessão de escopo: `empresaId` do DTO
 * é apenas *qual* empresa, e só é aceito se já estiver dentro do escopo da
 * sessão.
 */
export async function resolverEmpresaPai(
  prisma: PrismaService,
  escopo: EscopoOrganizacional,
  empresaId: string,
): Promise<{ id: string; status: StatusOrganizacional } | null> {
  // `AND` explícito, nunca dois `id` no mesmo objeto: um spread faria a
  // segunda chave sobrescrever a primeira e o ator escopado acabaria
  // encontrando a **própria** empresa ao pedir outra.
  const empresa = await prisma.empresa.findFirst({
    where: escopo.global
      ? { id: empresaId }
      : { AND: [{ id: empresaId }, { id: escopo.empresaId }] },
    select: { id: true, status: true },
  });

  if (!empresa) {
    return null;
  }

  assertPaiAtivo(empresa.status);
  return empresa;
}

/**
 * Resolve o **departamento pai**, com a mesma semântica de escopo/integridade
 * de `resolverEmpresaPai`. Devolve também `empresaId`, que é a empresa
 * efetiva do filho — derivada da estrutura, nunca informada pelo cliente.
 */
export async function resolverDepartamentoPai(
  prisma: PrismaService,
  escopo: EscopoOrganizacional,
  departamentoId: string,
): Promise<NoPai | null> {
  const departamento = await prisma.departamento.findFirst({
    where: { id: departamentoId, ...filtroEmpresa(escopo) },
    select: { id: true, empresaId: true, status: true },
  });

  if (!departamento) {
    return null;
  }

  assertPaiAtivo(departamento.status);
  return departamento;
}

/**
 * Resolve a **unidade organizacional** opcionalmente vinculada a uma equipe.
 * Além de escopo e status, exige que a unidade pertença à mesma empresa do
 * departamento (spec R5) — o banco também recusa, via FK composta, mas o erro
 * aqui é estável e sem detalhe interno.
 */
export async function resolverUnidadePai(
  prisma: PrismaService,
  escopo: EscopoOrganizacional,
  unidadeOrganizacionalId: string,
  empresaIdEsperada: string,
): Promise<NoPai | null> {
  const unidade = await prisma.unidadeOrganizacional.findFirst({
    where: { id: unidadeOrganizacionalId, ...filtroEmpresa(escopo) },
    select: { id: true, empresaId: true, status: true },
  });

  if (!unidade) {
    return null;
  }

  if (unidade.empresaId !== empresaIdEsperada) {
    // Referência cruzando empresa (R5). Não é 404: a unidade existe e está no
    // escopo do ator — o que é inválido é a combinação pedida.
    throw new UnprocessableEntityException();
  }

  assertPaiAtivo(unidade.status);
  return unidade;
}

/** R-INA-3: nada novo é vinculado sob um pai inativo. */
export function assertPaiAtivo(status: StatusOrganizacional): void {
  if (status !== StatusOrganizacional.ativo) {
    throw new UnprocessableEntityException();
  }
}

/**
 * R-INA-2 (Baseline V1, item 7): recusa a inativação quando ainda existe
 * elemento ativo vinculado. Nunca inativa em cascata.
 */
export function assertSemFilhosAtivos(quantidadeAtivos: number): void {
  if (quantidadeAtivos > 0) {
    throw new ConflictException();
  }
}

/** Inativar o que já está inativo é conflito, não no-op silencioso. */
export function assertAindaAtivo(status: StatusOrganizacional): void {
  if (status !== StatusOrganizacional.ativo) {
    throw new ConflictException();
  }
}

/**
 * R-INA-5: reativar o que já está ativo é conflito, pela mesma razão — evita
 * evento de auditoria sem transição de status correspondente.
 */
export function assertAindaInativo(status: StatusOrganizacional): void {
  if (status !== StatusOrganizacional.inativo) {
    throw new ConflictException();
  }
}

/**
 * R-INA-5 + R-INA-3: reativar um nó exige que seus pais estejam **ativos**.
 *
 * Sem isso, a reativação criaria exatamente o estado que R-INA-3 proíbe na
 * criação — filho ativo pendurado em pai inativo —, entrando pela porta dos
 * fundos. Recusa com **422**: é dado inválido para a operação, não negação de
 * acesso, e por isso não vira evento `denied`.
 *
 * Basta checar o **pai direto**: para um pai estar ativo, o avô já precisou
 * estar (a inativação é bloqueada enquanto houver filho ativo), então a
 * cadeia inteira é garantida por invariante, sem consulta recursiva.
 */
export function assertPaisAtivosParaReativar(
  statusDosPais: readonly StatusOrganizacional[],
): void {
  if (statusDosPais.some((status) => status !== StatusOrganizacional.ativo)) {
    throw new UnprocessableEntityException();
  }
}

/** Deslocamento de paginação, com página 1-indexada. */
export function deslocamento(pagina: number, tamanhoPagina: number): number {
  return (pagina - 1) * tamanhoPagina;
}
