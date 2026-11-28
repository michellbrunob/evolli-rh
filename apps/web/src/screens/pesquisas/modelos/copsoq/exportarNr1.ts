/**
 * T216 — Riscos psicossociais (NR-1): os downloads gerados no navegador
 * a partir do Plano de ação e da Conformidade — o PDF do plano e o pacote
 * "Baixar tudo (.zip)" (plano e conformidade em PDF, respostas em planilha
 * e os arquivos de evidência de cada etapa). Nada é enviado a terceiros.
 */
import type {
  AcompanhamentoNr1,
  ResultadoNr1,
  ServicoDosModelos,
} from "../../../../api/modelosDePesquisaClient";
import type {
  PesquisaDetalhe,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { baixarArquivo, nomeDoArquivo } from "../../../dashboard/exportacao";
import { carregarRelatorio, respostasCompletas } from "../../carregarRelatorio";
import { planilhaDosResultados } from "../../exportarResultados";
import type { ServicoDePesquisas } from "../../servicoDePesquisas";
import {
  type ArquivoDoPacote,
  montarPacote,
  pdfDaConformidade,
  pdfDoPlano,
} from "./documentosNr1";

const resultadoNr1 = (geral: ResultadosPesquisa): ResultadoNr1 | null =>
  geral.modelo?.modelo === "copsoq" ? (geral.modelo as ResultadoNr1) : null;

/** Os bytes do arquivo baixado (FileReader quando falta `arrayBuffer`). */
function bytesDoBlob(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function")
    return blob.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(new Uint8Array(leitor.result as ArrayBuffer));
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsArrayBuffer(blob);
  });
}

async function nomeDaEmpresa(servico: ServicoDePesquisas): Promise<string> {
  const e = await Promise.resolve(servico.empresaAtiva()).catch(() => null);
  return e?.nome ?? "";
}

/** "Baixar PDF" do plano de ação. */
export async function baixarPdfDoPlano(x: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly acompanhamento: AcompanhamentoNr1 | null;
  readonly hoje: string;
}): Promise<void> {
  const empresa = await nomeDaEmpresa(x.servico);
  baixarArquivo(
    pdfDoPlano(resultadoNr1(x.geral), x.acompanhamento?.plano ?? [], {
      empresa,
      pesquisa: x.detalhe.nome,
      hoje: x.hoje,
    }),
    nomeDoArquivo([x.detalhe.nome, "plano-de-acao"], "pdf"),
    "application/pdf",
  );
}

/**
 * "Baixar tudo (.zip)": plano e conformidade em PDF, a planilha de
 * respostas (quando carregar) e os arquivos de evidência. Devolve os nomes
 * dentro do pacote.
 */
export async function baixarPacoteDaConformidade(x: {
  readonly servico: ServicoDePesquisas;
  readonly servicoDosModelos: ServicoDosModelos;
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly acompanhamento: AcompanhamentoNr1;
  readonly hoje: string;
}): Promise<string[]> {
  const empresa = await nomeDaEmpresa(x.servico);
  const ctx = { empresa, pesquisa: x.detalhe.nome, hoje: x.hoje };
  let planilha: Uint8Array | null = null;
  try {
    const carregado = await carregarRelatorio(x.servico, x.detalhe.id, x.hoje);
    const completas = await respostasCompletas(
      x.servico,
      x.detalhe.id,
      carregado.lista,
    );
    planilha = planilhaDosResultados(
      carregado.rel,
      carregado.detalhe,
      carregado.geral,
      completas,
    );
  } catch {
    // Sem a planilha, o pacote sai com o resto.
    planilha = null;
  }
  const baixar = x.servicoDosModelos.baixarEvidenciaNr1;
  const evidencias: ArquivoDoPacote[] = [];
  if (baixar) {
    for (const e of x.acompanhamento.etapas) {
      for (const a of e.arquivos ?? []) {
        const blob = await baixar(x.detalhe.id, e.id, a.id);
        evidencias.push({
          etapa: e.id,
          nome: a.nome,
          bytes: await bytesDoBlob(blob),
        });
      }
    }
  }
  const pacote = montarPacote({
    plano: pdfDoPlano(resultadoNr1(x.geral), x.acompanhamento.plano, ctx),
    conformidade: pdfDaConformidade(x.acompanhamento, ctx),
    planilha,
    evidencias,
  });
  baixarArquivo(
    pacote.bytes,
    nomeDoArquivo([x.detalhe.nome, "conformidade-nr1"], "zip"),
    "application/zip",
  );
  return pacote.arquivos;
}
