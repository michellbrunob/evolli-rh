/**
 * T216 — resultados dos modelos com metodologia própria (riscos
 * psicossociais NR-1 e saúde financeira) e o acompanhamento da NR-1:
 *
 *   GET /pesquisas/:id/modelo/resultado?campo=        time e recortes
 *   GET /pesquisas/:id/modelo/respostas/:respostaId   uma resposta
 *   GET /pesquisas/:id/modelo/acompanhamento          etapas e plano
 *   PUT /pesquisas/:id/modelo/acompanhamento          grava (CSRF)
 *   POST|GET|DELETE …/acompanhamento/evidencias/:etapa[/:arquivoId]
 *                                                     arquivos de evidência
 *
 * Os tipos seguem `apps/api/src/pesquisas/modelos/` (apêndice de
 * `docs/decisions/t216-pesquisas.md`).
 */
import type { CampoGrupo, MotivoOculto } from "./pesquisasClient";
import type {
  FaixaIsfb,
  NivelNr1,
  ResultadoIsfb,
  ResultadoNr1,
  SaudeFinanceira,
} from "./resultadosDosModelos";
export type * from "./resultadosDosModelos";
import { pedir } from "./pesquisasClient";
import { ApiError } from "./colaboradoresClient";
import {
  clearCsrfToken,
  repetirSeTokenDesatualizado,
  tokenCsrfParaGravacao,
} from "./csrfClient";

export interface GrupoDoModelo {
  id: string;
  nome: string;
  respostas: number;
  visivel: boolean;
  oculto: MotivoOculto | null;
  /** O resultado do grupo não carregou (erro, não sigilo). */
  falhou?: boolean;
  nr1: {
    pressao: number | null;
    recursos: number | null;
    destaque: boolean;
    niveis: Record<NivelNr1, number>;
    precisamDeAcao: number;
    dimensoes: {
      id: string;
      escore: number | null;
      percentualEmRisco: number;
      nivel: NivelNr1 | null;
    }[];
  } | null;
  isfb: {
    isfb: number | null;
    faixa: FaixaIsfb | null;
    saude: Record<SaudeFinanceira, number>;
    comTresOuMaisSinais: number;
  } | null;
}

/** O resultado montado para o painel (empresa, recortes e grupos). */
export interface ResultadoDoPainel {
  modelo: "copsoq" | "isfb";
  respostas: number;
  visivel: boolean;
  minimoPorGrupo: number;
  recortes: CampoGrupo[];
  nr1: ResultadoNr1 | null;
  isfb: ResultadoIsfb | null;
  campo: CampoGrupo | null;
  grupos: GrupoDoModelo[] | null;
  semGrupo: number;
}

export type EtapaNr1 =
  | "mapear"
  | "plano"
  | "comunicar"
  | "validar"
  | "treinar"
  | "implementar"
  | "revisar";
export type ControleNr1 =
  "eliminacao" | "substituicao" | "administrativo" | "protecao";
export type SituacaoDaMedida = "planejada" | "em_andamento" | "concluida";

export interface MedidaDoPlano {
  id: string;
  dimensaoId: string;
  titulo: string;
  descricao: string | null;
  controle: ControleNr1;
  responsavel: string | null;
  prazo: string | null;
  indicador: string | null;
  situacao: SituacaoDaMedida;
}

/** Um arquivo de evidência da etapa (PDF, imagem ou apresentação). */
export interface ArquivoDaEtapa {
  id: string;
  nome: string;
  formato: "pdf" | "jpg" | "png" | "webp" | "pptx";
  tamanhoBytes: number;
  enviadoEm: string;
}

export interface EtapaDoAcompanhamento {
  id: EtapaNr1;
  itens: boolean[];
  evidencias: string | null;
  concluidaEm: string | null;
  concluida: boolean;
  automatica: boolean;
  /** Arquivos de evidência (só nas etapas que a empresa conclui). */
  arquivos?: ArquivoDaEtapa[];
}

export interface AcompanhamentoNr1 {
  etapas: EtapaDoAcompanhamento[];
  plano: MedidaDoPlano[];
  profissionalSst: { nome: string | null; registro: string | null };
  atualizadoEm: string | null;
  concluidas: number;
  proxima: EtapaNr1 | null;
  revisarEm: string | null;
}

export interface AcompanhamentoNr1Entrada {
  etapas: {
    id: EtapaNr1;
    itens: boolean[];
    evidencias: string | null;
    concluida: boolean;
  }[];
  plano: MedidaDoPlano[];
  profissionalSst: { nome: string | null; registro: string | null };
}

const id = encodeURIComponent;

export const acompanhamentoNr1 = (pesquisaId: string) =>
  pedir<AcompanhamentoNr1>(
    `/pesquisas/${id(pesquisaId)}/modelo/acompanhamento`,
    "GET",
  );

export const gravarAcompanhamentoNr1 = (
  pesquisaId: string,
  entrada: AcompanhamentoNr1Entrada,
) =>
  pedir<AcompanhamentoNr1>(
    `/pesquisas/${id(pesquisaId)}/modelo/acompanhamento`,
    "PUT",
    entrada,
  );

const rotaDaEvidencia = (pesquisaId: string, etapa: string, arquivo = "") =>
  `/v1/pesquisas/${id(pesquisaId)}/modelo/acompanhamento/evidencias/${id(etapa)}${arquivo ? `/${id(arquivo)}` : ""}`;

/** "Ata.PDF" → "pdf"; sem extensão, vazio. */
function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  return ponto < 0 ? "" : nome.slice(ponto + 1).toLowerCase();
}

/**
 * Uma gravação com o token CSRF da aba: o mesmo mecanismo do `pedir` das
 * pesquisas (403 `csrf_invalido` renova o token e repete UMA vez); o 401
 * descarta o token.
 */
async function gravarComToken(
  enviar: (token: string) => Promise<Response>,
): Promise<Response> {
  const res = await repetirSeTokenDesatualizado(async () =>
    enviar(await tokenCsrfParaGravacao()),
  );
  if (res.status === 401) clearCsrfToken();
  return res;
}

async function falha(res: Response): Promise<never> {
  const erro: unknown = await res.json().catch(() => ({}));
  throw new ApiError(res.status, "Erro na requisição.", erro);
}

/** Anexa um arquivo à etapa: bytes no corpo; tipo, extensão e nome nos cabeçalhos. */
export async function enviarEvidenciaNr1(
  pesquisaId: string,
  etapa: EtapaNr1,
  arquivo: File,
): Promise<AcompanhamentoNr1> {
  const res = await gravarComToken((token) =>
    fetch(rotaDaEvidencia(pesquisaId, etapa), {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/octet-stream",
        "x-csrf-token": token,
        "x-evolli-evidencia-tipo": arquivo.type || "application/octet-stream",
        "x-evolli-evidencia-extensao": extensaoDe(arquivo.name),
        "x-evolli-evidencia-nome": encodeURIComponent(arquivo.name),
      },
      body: arquivo,
    }),
  );
  if (!res.ok) return falha(res);
  return res.json() as Promise<AcompanhamentoNr1>;
}

/** O arquivo da etapa, em memória do navegador (download privado). */
export async function baixarEvidenciaNr1(
  pesquisaId: string,
  etapa: EtapaNr1,
  arquivoId: string,
): Promise<Blob> {
  const res = await fetch(rotaDaEvidencia(pesquisaId, etapa, arquivoId), {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "*/*" },
  });
  if (res.status === 401) clearCsrfToken();
  if (!res.ok) return falha(res);
  return res.blob();
}

/** Remove o arquivo da etapa. */
export async function removerEvidenciaNr1(
  pesquisaId: string,
  etapa: EtapaNr1,
  arquivoId: string,
): Promise<AcompanhamentoNr1> {
  const res = await gravarComToken((token) =>
    fetch(rotaDaEvidencia(pesquisaId, etapa, arquivoId), {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "x-csrf-token": token,
      },
    }),
  );
  if (!res.ok) return falha(res);
  return res.json() as Promise<AcompanhamentoNr1>;
}

/** As chamadas dos modelos (as telas recebem um falso nos testes). */
export interface ServicoDosModelos {
  readonly acompanhamentoNr1: typeof acompanhamentoNr1;
  readonly gravarAcompanhamentoNr1: typeof gravarAcompanhamentoNr1;
  /** Arquivos de evidência (ausentes: a tela não oferece o envio). */
  readonly enviarEvidenciaNr1?: typeof enviarEvidenciaNr1;
  readonly baixarEvidenciaNr1?: typeof baixarEvidenciaNr1;
  readonly removerEvidenciaNr1?: typeof removerEvidenciaNr1;
}

export const SERVICO_DOS_MODELOS: ServicoDosModelos = {
  acompanhamentoNr1,
  gravarAcompanhamentoNr1,
  enviarEvidenciaNr1,
  baixarEvidenciaNr1,
  removerEvidenciaNr1,
};
