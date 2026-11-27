import { describe, expect, it } from "vitest";
import {
  algumEnviando,
  falhaDoEnvio,
  type EnvioDeDocumento,
} from "./EnvioDosDocumentos";
import type { DocumentoDaEtapa } from "./EtapaDocumentos";

/** T213 — tradução das recusas: nova tentativa só para falha transitória. */

const erro = (status?: number, codigo?: string) =>
  Object.assign(new Error("x"), {
    ...(status !== undefined ? { status } : {}),
    ...(codigo ? { codigo } : {}),
  });

describe("falhaDoEnvio (T213)", () => {
  it.each([
    [
      "formato",
      erro(422, "documento_formato_invalido"),
      /PDF, JPG ou PNG válido/,
    ],
    ["malformado", erro(422, "documento_arquivo_malformado"), /corrompido/],
    ["vazio", erro(422, "documento_arquivo_vazio"), /vazio/],
    ["tamanho (código)", erro(422, "documento_arquivo_grande_demais"), /10 MB/],
    ["tamanho (413)", erro(413), /10 MB/],
    ["tipo de corpo (415)", erro(415), /PDF, JPG ou PNG/],
    [
      "limite da categoria",
      erro(422, "documento_limite_categoria"),
      /5 arquivos/,
    ],
    [
      "limite do colaborador",
      erro(422, "documento_limite_colaborador"),
      /30 documentos/,
    ],
    ["nome inválido", erro(422, "documento_nome_invalido"), /60 caracteres/],
    [
      "categoria inválida",
      erro(422, "documento_categoria_invalida"),
      /não aceito/,
    ],
    [
      "chave divergente",
      erro(422, "idempotencia_conteudo_divergente"),
      /outro arquivo/,
    ],
    ["sessão expirada", erro(401), /sessão expirou/],
    ["acesso recusado (403)", erro(403), /acesso não permite/],
    ["fora do escopo (404)", erro(404), /acesso não permite/],
    ["outra recusa 4xx", erro(409), /não aceitou o arquivo/],
  ])("%s: definitiva, com o que fazer", (_, e, mensagem) => {
    const falha = falhaDoEnvio(e);
    expect(falha.transitoria).toBe(false);
    expect(falha.motivo).toMatch(mensagem);
  });

  it.each([
    ["rede (sem status)", new Error("rede")],
    ["servidor (500)", erro(500)],
    ["armazenamento indisponível (503)", erro(503)],
    ["tempo esgotado (408)", erro(408)],
    ["muitas requisições (429)", erro(429)],
  ])("%s: transitória, tentar de novo é seguro", (_, e) => {
    const falha = falhaDoEnvio(e);
    expect(falha.transitoria).toBe(true);
    expect(falha.motivo).toMatch(/Tentar de novo é seguro/);
  });

  it("antivírus indisponível (503 com código): transitória, diz que nada foi enviado e o que fazer", () => {
    const falha = falhaDoEnvio(erro(503, "documento_verificacao_indisponivel"));
    expect(falha.transitoria).toBe(true);
    expect(falha.motivo).toBe(
      "A verificação antivírus está indisponível agora e o arquivo não foi enviado. Tente de novo em alguns minutos.",
    );
  });
});

describe("algumEnviando (T213)", () => {
  const com = (id: string): DocumentoDaEtapa => ({
    id,
    categoria: "rg",
    arquivo: new File(["x"], `${id}.pdf`, { type: "application/pdf" }),
    chaveDeEnvio: "chave",
  });
  const sem: DocumentoDaEtapa = {
    id: "cpf",
    categoria: "cpf",
    arquivo: null,
    chaveDeEnvio: null,
  };

  it("arquivo ainda na fila ou subindo conta; concluído ou falho, não", () => {
    const envios: Record<string, EnvioDeDocumento> = {};
    expect(algumEnviando([com("a"), sem], envios)).toBe(true);
    envios.a = { estado: "enviando" };
    expect(algumEnviando([com("a")], envios)).toBe(true);
    envios.a = { estado: "aprovado" };
    expect(algumEnviando([com("a"), sem], envios)).toBe(false);
    envios.a = { estado: "nao_enviado", motivo: "x", transitoria: true };
    expect(algumEnviando([com("a")], envios)).toBe(false);
  });
});
