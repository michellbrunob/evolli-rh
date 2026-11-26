import { ForbiddenException, Injectable } from "@nestjs/common";
import { ParentescoDependente, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  type ErroDeCampo,
} from "../../common/erros/recusa-por-campo";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import { diaDe, hojeEmSaoPaulo } from "../ausencias/calculo-ausencias";

/**
 * T215 — dependentes do colaborador (Editar colaborador › Dependentes, como a
 * referência): para plano de saúde e benefícios. Nome, parentesco, data de
 * nascimento, CPF, telefone e e-mail (opcionais os três últimos). Remover é
 * lógico; um dependente no plano sai dele na remoção (a partir do mês).
 */

export const PARENTESCOS = [
  "conjuge",
  "filho",
  "pai_mae",
  "irmao",
  "grau_1",
  "grau_2",
  "grau_3",
  "outro",
] as const;

export interface DependenteInformado {
  nome: string;
  parentesco: string;
  dataNascimento?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  email?: string | null;
}

export interface DependenteApi {
  id: string;
  nome: string;
  parentesco: ParentescoDependente;
  dataNascimento: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
}

/** CPF com os dígitos verificadores certos (só os 11 dígitos). */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, peso: number) => {
    let soma = 0;
    for (const ch of base) soma += Number(ch) * peso--;
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return (
    dv(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    dv(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

export function conferirDependente(dto: DependenteInformado): {
  erros: ErroDeCampo[];
  dados: Omit<DependenteApi, "id"> | null;
} {
  const erros: ErroDeCampo[] = [];
  const nome = (dto.nome ?? "").trim().replace(/\s+/g, " ");
  if (!nome) erros.push({ campo: "nome", motivo: "obrigatorio" });
  else if (nome.length > 160) erros.push({ campo: "nome", motivo: "invalido" });
  if (!(PARENTESCOS as readonly string[]).includes(dto.parentesco)) {
    erros.push({ campo: "parentesco", motivo: "obrigatorio" });
  }
  const nasc = dto.dataNascimento || null;
  if (nasc !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc) || Number.isNaN(Date.parse(nasc))) {
      erros.push({ campo: "dataNascimento", motivo: "invalido" });
    } else if (nasc > hojeEmSaoPaulo()) {
      erros.push({ campo: "dataNascimento", motivo: "futura" });
    }
  }
  const cpf = (dto.cpf ?? "").replace(/\D/g, "") || null;
  if (cpf !== null && !cpfValido(cpf))
    erros.push({ campo: "cpf", motivo: "invalido" });
  const telDigitos = (dto.telefone ?? "").replace(/\D/g, "");
  const telefone = telDigitos
    ? `+55${telDigitos.replace(/^55(?=\d{10,11}$)/, "")}`
    : null;
  if (telefone !== null && !/^\+55\d{10,11}$/.test(telefone)) {
    erros.push({ campo: "telefone", motivo: "invalido" });
  }
  const email = (dto.email ?? "").trim().toLowerCase() || null;
  if (
    email !== null &&
    (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    erros.push({ campo: "email", motivo: "invalido" });
  }
  if (erros.length) return { erros, dados: null };
  return {
    erros,
    dados: {
      nome,
      parentesco: dto.parentesco as ParentescoDependente,
      dataNascimento: nasc,
      cpf,
      telefone,
      email,
    },
  };
}

type LinhaDependente = Prisma.DependenteColaboradorGetPayload<object>;

function paraApi(d: LinhaDependente): DependenteApi {
  return {
    id: d.id,
    nome: d.nome,
    parentesco: d.parentesco,
    dataNascimento: d.dataNascimento ? diaDe(d.dataNascimento) : null,
    cpf: d.cpf,
    telefone: d.telefone,
    email: d.email,
  };
}

@Injectable()
export class DependentesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  private empresaDaSessao(
    ctx: PessoasAuditContext,
    uso: "leitura" | "escrita",
  ): string {
    const papel = ctx.actor.role;
    const permitido =
      papel === "rh" ||
      papel === "dp" ||
      (papel === "master_tecnico" && uso === "leitura");
    if (!permitido || ctx.actor.companyId === null)
      throw new ForbiddenException();
    return ctx.actor.companyId;
  }

  private async conferirColaborador(
    db: Prisma.TransactionClient,
    colaboradorId: string,
    empresaId: string,
    ctx: PessoasAuditContext,
  ): Promise<void> {
    const v = await db.vinculoFuncional.findFirst({
      where: { colaboradorId, empresaId },
      select: { id: true },
    });
    if (!v)
      await this.auditoria.negarAcesso(
        ctx,
        "dependente_colaborador",
        colaboradorId,
        empresaId,
      );
  }

  private dados(dto: DependenteInformado) {
    const { erros, dados } = conferirDependente(dto);
    if (!dados) throw new CamposRecusadosException(erros);
    return {
      ...dados,
      dataNascimento: dados.dataNascimento
        ? new Date(`${dados.dataNascimento}T00:00:00Z`)
        : null,
    };
  }

  async listar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<{ dependentes: DependenteApi[] }> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    await this.conferirColaborador(this.prisma, colaboradorId, empresaId, ctx);
    const linhas = await this.prisma.dependenteColaborador.findMany({
      where: { empresaId, colaboradorId, removidoEm: null },
      orderBy: [{ criadoEm: "asc" }],
    });
    return { dependentes: linhas.map(paraApi) };
  }

  async criar(
    colaboradorId: string,
    dto: DependenteInformado,
    ctx: PessoasAuditContext,
  ): Promise<DependenteApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const dados = this.dados(dto);
    const linha = await this.prisma.$transaction(async (tx) => {
      await this.conferirColaborador(tx, colaboradorId, empresaId, ctx);
      const d = await tx.dependenteColaborador.create({
        data: { ...dados, empresaId, colaboradorId, criadoPorId: ctx.actor.id },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_dependente_criado",
        "dependente_colaborador",
        d.id,
        empresaId,
      );
      return d;
    });
    return paraApi(linha);
  }

  private async obterVivo(
    tx: Prisma.TransactionClient,
    colaboradorId: string,
    dependenteId: string,
    empresaId: string,
    ctx: PessoasAuditContext,
  ): Promise<LinhaDependente> {
    const d = await tx.dependenteColaborador.findFirst({
      where: { id: dependenteId, colaboradorId, empresaId, removidoEm: null },
    });
    if (!d)
      return this.auditoria.negarAcesso(
        ctx,
        "dependente_colaborador",
        dependenteId,
        empresaId,
      );
    return d;
  }

  async alterar(
    colaboradorId: string,
    dependenteId: string,
    dto: DependenteInformado,
    ctx: PessoasAuditContext,
  ): Promise<DependenteApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const dados = this.dados(dto);
    const linha = await this.prisma.$transaction(async (tx) => {
      const d = await this.obterVivo(
        tx,
        colaboradorId,
        dependenteId,
        empresaId,
        ctx,
      );
      const alterado = await tx.dependenteColaborador.update({
        where: { id: d.id },
        data: dados,
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_dependente_alterado",
        "dependente_colaborador",
        d.id,
        empresaId,
      );
      return alterado;
    });
    return paraApi(linha);
  }

  /** Remover: sai da lista e de todo plano a partir do mês atual. */
  async remover(
    colaboradorId: string,
    dependenteId: string,
    ctx: PessoasAuditContext,
  ): Promise<{ removido: true }> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    await this.prisma.$transaction(async (tx) => {
      const d = await this.obterVivo(
        tx,
        colaboradorId,
        dependenteId,
        empresaId,
        ctx,
      );
      await tx.dependenteColaborador.update({
        where: { id: d.id },
        data: { removidoEm: new Date() },
      });
      const inicioMes = new Date(
        `${hojeEmSaoPaulo().slice(0, 7)}-01T00:00:00Z`,
      );
      const planos = await tx.beneficioDependente.findMany({
        where: {
          dependenteId: d.id,
          OR: [{ ate: null }, { ate: { gt: inicioMes } }],
        },
      });
      for (const p of planos) {
        await tx.beneficioDependente.update({
          where: { id: p.id },
          data: { ate: p.aPartirDe >= inicioMes ? p.aPartirDe : inicioMes },
        });
      }
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_dependente_removido",
        "dependente_colaborador",
        d.id,
        empresaId,
      );
    });
    return { removido: true };
  }
}
