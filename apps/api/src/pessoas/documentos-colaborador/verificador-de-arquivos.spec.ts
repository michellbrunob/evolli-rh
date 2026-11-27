import { createServer, type Server, type Socket } from "node:net";
import {
  ASSINATURA_DE_TESTE_ANTIVIRUS,
  VerificacaoIndisponivel,
  VerificadorClamav,
  VerificadorFalso,
  VerificadorIndisponivel,
  escolherVerificadorDeArquivos,
} from "./verificador-de-arquivos";

/**
 * Um clamd falso: lê o comando INSTREAM e os blocos, e responde como o
 * ClamAV (OK, FOUND ou ERROR) — ou não responde (para o tempo limite).
 */
function clamdFalso(
  responder: (recebido: Buffer) => string | null,
): Promise<{ servidor: Server; porta: number; recebidos: Buffer[] }> {
  const recebidos: Buffer[] = [];
  return new Promise((resolve) => {
    const servidor = createServer((socket: Socket) => {
      let acumulado = Buffer.alloc(0);
      socket.on("data", (parte) => {
        acumulado = Buffer.concat([acumulado, parte]);
        // Fim do fluxo: bloco de tamanho zero.
        if (acumulado.subarray(-4).equals(Buffer.alloc(4))) {
          recebidos.push(acumulado);
          const resposta = responder(acumulado);
          if (resposta !== null) socket.end(`${resposta}\0`);
        }
      });
    });
    servidor.listen(0, "127.0.0.1", () => {
      const endereco = servidor.address();
      const porta =
        typeof endereco === "object" && endereco ? endereco.port : 0;
      resolve({ servidor, porta, recebidos });
    });
  });
}

describe("VerificadorClamav (T213)", () => {
  let servidor: Server | undefined;
  afterEach(() => servidor?.close());

  it("envia zINSTREAM, os bytes em blocos com tamanho e o bloco final; OK = aprovado", async () => {
    const falso = await clamdFalso(() => "stream: OK");
    servidor = falso.servidor;
    const verificador = new VerificadorClamav({
      host: "127.0.0.1",
      porta: falso.porta,
      tempoLimiteMs: 2000,
    });
    const bytes = Buffer.from("conteudo sintetico");
    await expect(verificador.verificar(bytes)).resolves.toBe("aprovado");
    const recebido = falso.recebidos[0]!;
    expect(recebido.subarray(0, 10).toString("latin1")).toBe("zINSTREAM\0");
    expect(recebido.readUInt32BE(10)).toBe(bytes.length);
    expect(recebido.subarray(14, 14 + bytes.length)).toEqual(bytes);
  });

  it("FOUND = reprovado", async () => {
    const falso = await clamdFalso(() => "stream: Eicar-Signature FOUND");
    servidor = falso.servidor;
    const verificador = new VerificadorClamav({
      host: "127.0.0.1",
      porta: falso.porta,
      tempoLimiteMs: 2000,
    });
    await expect(verificador.verificar(Buffer.from("x"))).resolves.toBe(
      "reprovado",
    );
  });

  it.each([
    ["ERROR", "INSTREAM size limit exceeded. ERROR"],
    ["resposta desconhecida", "algo estranho"],
  ])("%s: falha (o arquivo continua bloqueado)", async (_, resposta) => {
    const falso = await clamdFalso(() => resposta);
    servidor = falso.servidor;
    const verificador = new VerificadorClamav({
      host: "127.0.0.1",
      porta: falso.porta,
      tempoLimiteMs: 2000,
    });
    await expect(
      verificador.verificar(Buffer.from("x")),
    ).rejects.toBeInstanceOf(VerificacaoIndisponivel);
  });

  it("sem resposta no tempo limite: falha", async () => {
    const falso = await clamdFalso(() => null);
    servidor = falso.servidor;
    const verificador = new VerificadorClamav({
      host: "127.0.0.1",
      porta: falso.porta,
      tempoLimiteMs: 200,
    });
    await expect(
      verificador.verificar(Buffer.from("x")),
    ).rejects.toBeInstanceOf(VerificacaoIndisponivel);
  });

  it("serviço fora do ar: falha", async () => {
    const verificador = new VerificadorClamav({
      host: "127.0.0.1",
      porta: 1,
      tempoLimiteMs: 1000,
    });
    await expect(
      verificador.verificar(Buffer.from("x")),
    ).rejects.toBeInstanceOf(VerificacaoIndisponivel);
  });
});

describe("VerificadorFalso e indisponível (T213)", () => {
  it("o falso reprova a assinatura de teste e aprova o resto", async () => {
    const falso = new VerificadorFalso();
    await expect(
      falso.verificar(Buffer.from(`x${ASSINATURA_DE_TESTE_ANTIVIRUS}x`)),
    ).resolves.toBe("reprovado");
    await expect(falso.verificar(Buffer.from("limpo"))).resolves.toBe(
      "aprovado",
    );
  });

  it("o falso pode ser posto em falha", async () => {
    const falso = new VerificadorFalso();
    falso.falhar = true;
    await expect(falso.verificar(Buffer.from("x"))).rejects.toBeInstanceOf(
      VerificacaoIndisponivel,
    );
  });

  it("o indisponível sempre falha (fail-closed)", async () => {
    await expect(
      new VerificadorIndisponivel().verificar(Buffer.from("x")),
    ).rejects.toBeInstanceOf(VerificacaoIndisponivel);
  });
});

describe("escolherVerificadorDeArquivos (T213)", () => {
  it("padrão com CLAMAV_HOST e CLAMAV_PORT: ClamAV", () => {
    expect(
      escolherVerificadorDeArquivos({
        CLAMAV_HOST: "127.0.0.1",
        CLAMAV_PORT: "3310",
      }),
    ).toBeInstanceOf(VerificadorClamav);
  });

  it("sem configuração do ClamAV: indisponível (nada é aprovado)", () => {
    expect(escolherVerificadorDeArquivos({})).toBeInstanceOf(
      VerificadorIndisponivel,
    );
  });

  it("porta inválida: recusa subir", () => {
    expect(() =>
      escolherVerificadorDeArquivos({
        CLAMAV_HOST: "127.0.0.1",
        CLAMAV_PORT: "abc",
      }),
    ).toThrow(/CLAMAV_PORT/);
  });

  it("falso só em desenvolvimento e testes; nunca em produção nem em ambiente desconhecido", () => {
    // Sem NODE_ENV vale o padrão da configuração: desenvolvimento.
    for (const NODE_ENV of [undefined, "development", "test"]) {
      expect(
        escolherVerificadorDeArquivos({
          EVOLLI_DOCUMENTOS_VERIFICADOR: "falso",
          ...(NODE_ENV ? { NODE_ENV } : {}),
        }),
      ).toBeInstanceOf(VerificadorFalso);
    }
    expect(() =>
      escolherVerificadorDeArquivos({
        EVOLLI_DOCUMENTOS_VERIFICADOR: "falso",
        NODE_ENV: "staging",
      }),
    ).toThrow(/produção/);
    expect(() =>
      escolherVerificadorDeArquivos({
        EVOLLI_DOCUMENTOS_VERIFICADOR: "falso",
        NODE_ENV: "production",
      }),
    ).toThrow(/produção/);
    expect(() =>
      escolherVerificadorDeArquivos({ EVOLLI_DOCUMENTOS_VERIFICADOR: "outro" }),
    ).toThrow(/desconhecido/);
  });
});
