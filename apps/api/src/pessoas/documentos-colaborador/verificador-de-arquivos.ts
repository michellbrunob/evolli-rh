import { Socket } from "node:net";

/**
 * T213 — verificação antivírus dos documentos do colaborador (ADR 0021).
 *
 * Uma porta pequena: `verificar(bytes)` responde `aprovado` ou `reprovado`,
 * ou LANÇA `VerificacaoIndisponivel` — e então o arquivo continua bloqueado
 * (quarentena fail-closed). Em produção, o ClamAV do servidor (`clamd`, pelo
 * protocolo `INSTREAM`); nos testes, o verificador falso. O arquivo nunca vai
 * a serviço de terceiros.
 */
export const VERIFICADOR_DE_ARQUIVOS = Symbol("VERIFICADOR_DE_ARQUIVOS");

export type ResultadoDaVerificacao = "aprovado" | "reprovado";

export interface VerificadorDeArquivos {
  verificar(bytes: Buffer): Promise<ResultadoDaVerificacao>;
}

/** O antivírus não respondeu, falhou ou não está configurado. */
export class VerificacaoIndisponivel extends Error {
  constructor(motivo = "verificacao_indisponivel") {
    super(motivo);
    this.name = "VerificacaoIndisponivel";
  }
}

/**
 * Assinatura de teste padrão dos antivírus (arquivo EICAR), montada em
 * partes para este código-fonte não ser ele mesmo marcado como ameaça.
 */
export const ASSINATURA_DE_TESTE_ANTIVIRUS = [
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$",
  "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
].join("");

/** Tamanho de cada bloco enviado ao clamd. */
const BLOCO = 64 * 1024;

export interface ConfiguracaoDoClamav {
  readonly host: string;
  readonly porta: number;
  readonly tempoLimiteMs: number;
}

/** Cliente mínimo do `clamd` (TCP, `zINSTREAM`), sem dependência nova. */
export class VerificadorClamav implements VerificadorDeArquivos {
  constructor(private readonly config: ConfiguracaoDoClamav) {}

  verificar(bytes: Buffer): Promise<ResultadoDaVerificacao> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let resposta = "";
      let terminado = false;
      const terminar = (
        erro: Error | null,
        resultado?: ResultadoDaVerificacao,
      ) => {
        if (terminado) return;
        terminado = true;
        clearTimeout(relogio);
        socket.destroy();
        if (erro) reject(erro);
        else resolve(resultado!);
      };
      const relogio = setTimeout(
        () =>
          terminar(new VerificacaoIndisponivel("verificacao_tempo_esgotado")),
        this.config.tempoLimiteMs,
      );
      socket.on("error", () => terminar(new VerificacaoIndisponivel()));
      socket.on("data", (parte) => {
        resposta += parte.toString("utf8");
        if (resposta.includes("\0")) interpretar();
      });
      socket.on("end", () => interpretar());
      socket.on("close", () => interpretar());

      const interpretar = () => {
        if (terminado) return;
        const texto = resposta.replace(/\0[\s\S]*$/, "").trim();
        if (/: OK$/.test(texto)) return terminar(null, "aprovado");
        if (/ FOUND$/.test(texto)) return terminar(null, "reprovado");
        terminar(new VerificacaoIndisponivel("verificacao_resposta_invalida"));
      };

      socket.connect(this.config.porta, this.config.host, () => {
        socket.write("zINSTREAM\0");
        for (let i = 0; i < bytes.length; i += BLOCO) {
          const bloco = bytes.subarray(i, i + BLOCO);
          const tamanho = Buffer.alloc(4);
          tamanho.writeUInt32BE(bloco.length, 0);
          socket.write(tamanho);
          socket.write(bloco);
        }
        socket.write(Buffer.alloc(4));
      });
    });
  }
}

/** Sem antivírus configurado: nada é aprovado (fail-closed). */
export class VerificadorIndisponivel implements VerificadorDeArquivos {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async verificar(_bytes: Buffer): Promise<ResultadoDaVerificacao> {
    throw new VerificacaoIndisponivel("verificacao_nao_configurada");
  }
}

/**
 * Para os testes e para a prévia local: reprova a assinatura de teste
 * padrão e aprova o resto; `falhar` simula o antivírus fora do ar.
 */
export class VerificadorFalso implements VerificadorDeArquivos {
  falhar = false;
  readonly verificados: Buffer[] = [];

  async verificar(bytes: Buffer): Promise<ResultadoDaVerificacao> {
    if (this.falhar) throw new VerificacaoIndisponivel();
    this.verificados.push(Buffer.from(bytes));
    return bytes.includes(Buffer.from(ASSINATURA_DE_TESTE_ANTIVIRUS))
      ? "reprovado"
      : "aprovado";
  }
}

const TEMPO_LIMITE_PADRAO_MS = 30_000;

/**
 * Padrão: o ClamAV em `CLAMAV_HOST`:`CLAMAV_PORT`; sem os dois, o
 * verificador indisponível (os arquivos ficam em verificação).
 * `EVOLLI_DOCUMENTOS_VERIFICADOR=falso` usa o falso — recusado em produção;
 * qualquer outro valor também é recusado, para nunca aprovar por engano.
 */
export function escolherVerificadorDeArquivos(
  ambiente: Readonly<Record<string, string | undefined>> = process.env,
): VerificadorDeArquivos {
  const modo = ambiente.EVOLLI_DOCUMENTOS_VERIFICADOR?.trim() ?? "";
  if (modo !== "") {
    if (modo !== "falso") {
      throw new Error("EVOLLI_DOCUMENTOS_VERIFICADOR: valor desconhecido.");
    }
    if (ambiente.NODE_ENV === "production") {
      throw new Error(
        "EVOLLI_DOCUMENTOS_VERIFICADOR=falso não é permitido em produção.",
      );
    }
    return new VerificadorFalso();
  }
  const host = ambiente.CLAMAV_HOST?.trim() ?? "";
  const portaBruta = ambiente.CLAMAV_PORT?.trim() ?? "";
  if (host === "" || portaBruta === "") return new VerificadorIndisponivel();
  const porta = Number(portaBruta);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error("CLAMAV_PORT inválida.");
  }
  return new VerificadorClamav({
    host,
    porta,
    tempoLimiteMs: TEMPO_LIMITE_PADRAO_MS,
  });
}
