/**
 * Fixtures sintéticas para testes de CentrosCustoScreen (T109).
 * Nenhum dado real, pessoal ou financeiro.
 */

export interface CentroCustoFixture {
  id: string;
  empresaId: string;
  codigo: string;
  nome: string;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

export const empresaFixture = {
  id: "00000000-0000-0000-0000-000000000001",
  codigo: "EMP-01",
  nome: "Empresa Exemplo (teste)",
  status: "ativo",
} as const;

export const empresaB = {
  id: "00000000-0000-0000-0000-000000000002",
  codigo: "EMP-02",
  nome: "Empresa B (teste)",
  status: "ativo",
} as const;

export const centroCusto1: CentroCustoFixture = {
  id: "00000000-0000-0000-0000-000000000011",
  empresaId: empresaFixture.id,
  codigo: "CC_ADM",
  nome: "Centro Administrativo (teste)",
  status: "ativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};

export const centroCusto2: CentroCustoFixture = {
  id: "00000000-0000-0000-0000-000000000012",
  empresaId: empresaFixture.id,
  codigo: "CC_OPS",
  nome: "Centro Operacional (teste)",
  status: "inativo",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
};
