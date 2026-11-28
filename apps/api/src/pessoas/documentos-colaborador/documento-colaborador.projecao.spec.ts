import { projetarDocumento } from "./documento-colaborador.projecao";

const documento = {
  id: "d1",
  categoria: "outros" as const,
  nomeOutros: "Contrato de experiência",
};
const versao = {
  estado: "aprovado" as const,
  formato: "docx" as const,
  tamanhoBytes: 2048,
  numero: 2,
  criadoEm: new Date("2026-11-28T13:45:00.000Z"),
  verificadoEm: new Date("2026-11-28T13:45:01.000Z"),
  nomeOriginal: "contrato-experiencia.docx",
  enviadaPor: { nomeExibicao: "Ana Souza", role: "rh" as const },
};

describe("projetarDocumento (T217)", () => {
  it("traz o nome original, quem enviou (nome e papel) e a data da versão", () => {
    expect(
      projetarDocumento(documento, versao, { mostrarNomes: true }),
    ).toEqual({
      id: "d1",
      categoria: "outros",
      nome: "Contrato de experiência",
      nomeArquivo: "contrato-experiencia.docx",
      enviadoPor: { nome: "Ana Souza", papel: "rh" },
      estado: "aprovado",
      formato: "docx",
      tamanhoBytes: 2048,
      versao: 2,
      enviadoEm: "2026-11-28T13:45:00.000Z",
      verificadoEm: "2026-11-28T13:45:01.000Z",
    });
  });

  it("master técnico: sem o nome livre e sem o nome do arquivo, mas vê quem enviou", () => {
    const dto = projetarDocumento(documento, versao, { mostrarNomes: false });
    expect(dto.nome).toBeNull();
    expect(dto.nomeArquivo).toBeNull();
    expect(dto.enviadoPor).toEqual({ nome: "Ana Souza", papel: "rh" });
  });

  it("conta sem nome de exibição: só o papel", () => {
    const dto = projetarDocumento(
      documento,
      { ...versao, enviadaPor: { nomeExibicao: null, role: "dp" as const } },
      { mostrarNomes: true },
    );
    expect(dto.enviadoPor).toEqual({ nome: null, papel: "dp" });
  });

  it("versão anterior à T217 (sem nome original): nomeArquivo nulo", () => {
    const dto = projetarDocumento(
      documento,
      { ...versao, nomeOriginal: null },
      { mostrarNomes: true },
    );
    expect(dto.nomeArquivo).toBeNull();
    expect(dto.nome).toBe("Contrato de experiência");
  });

  it("autor ausente: enviadoPor nulo", () => {
    const dto = projetarDocumento(
      documento,
      { ...versao, enviadaPor: null },
      { mostrarNomes: true },
    );
    expect(dto.enviadoPor).toBeNull();
  });

  it("verificação ainda não feita: verificadoEm nulo", () => {
    const dto = projetarDocumento(
      documento,
      { ...versao, estado: "em_verificacao" as const, verificadoEm: null },
      { mostrarNomes: true },
    );
    expect(dto.verificadoEm).toBeNull();
    expect(dto.estado).toBe("em_verificacao");
  });
});
