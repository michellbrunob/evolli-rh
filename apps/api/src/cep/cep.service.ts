import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  CEP_BRASILEIRO,
  EnderecoSugerido,
  FORNECEDOR_CEP,
  FornecedorCep,
} from "./cep.types";

/**
 * Limite de consultas por usuário: 30 em 10 minutos. Folgado para quem
 * cadastra à mão (uma consulta por admissão, algumas por correção) e curto
 * para quem tentasse varrer CEPs.
 *
 * A janela vive em memória, por instância da API: reinício zera, e duas
 * instâncias não somam. Basta para esta primeira versão, de instância única;
 * escalar horizontalmente pede um contador compartilhado.
 */
export const CEP_LIMITE_CONSULTAS = 30;
export const CEP_JANELA_MS = 10 * 60 * 1000;

/** Resultado registrado — só metadado técnico, nunca CEP nem endereço. */
export type ResultadoConsultaCep =
  "encontrado" | "inexistente" | "invalido" | "limite" | "timeout" | "falha";

/**
 * Consulta de CEP para o preenchimento assistido (T178).
 *
 * Ordem das recusas, de propósito: CEP fora da forma é recusado **antes** do
 * limite e antes do fornecedor (não gasta cota nem sai da rede); o limite é
 * conferido antes do fornecedor (abuso não chega a ele).
 *
 * Registro: uma linha de log por consulta, com fornecedor, resultado e
 * duração — o horário vem do próprio log e a requisição pelo `requestId`.
 * Nenhum CEP, logradouro, bairro, cidade ou UF entra no registro.
 */
@Injectable()
export class CepService {
  private readonly logger = new Logger(CepService.name);
  private readonly consultasPorUsuario = new Map<string, number[]>();

  constructor(
    @Inject(FORNECEDOR_CEP) private readonly fornecedor: FornecedorCep,
  ) {}

  async consultar(
    cep: string,
    usuarioId: string,
    requestId: string,
  ): Promise<EnderecoSugerido> {
    if (!CEP_BRASILEIRO.test(cep)) {
      this.registrar("invalido", requestId, 0);
      throw new BadRequestException();
    }
    if (!this.dentroDoLimite(usuarioId)) {
      this.registrar("limite", requestId, 0);
      throw new HttpException(
        "Limite de consultas de CEP atingido.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const inicio = Date.now();
    const resultado = await this.fornecedor.consultar(cep);
    const duracaoMs = Date.now() - inicio;

    switch (resultado.tipo) {
      case "encontrado":
        this.registrar("encontrado", requestId, duracaoMs);
        return resultado.endereco;
      case "inexistente":
        this.registrar("inexistente", requestId, duracaoMs);
        throw new NotFoundException();
      case "indisponivel":
        this.registrar(resultado.motivo, requestId, duracaoMs);
        throw new ServiceUnavailableException();
    }
  }

  /** Janela deslizante por usuário; conta a consulta quando a admite. */
  private dentroDoLimite(usuarioId: string): boolean {
    const agora = Date.now();
    const recentes = (this.consultasPorUsuario.get(usuarioId) ?? []).filter(
      (t) => agora - t < CEP_JANELA_MS,
    );
    if (recentes.length >= CEP_LIMITE_CONSULTAS) {
      this.consultasPorUsuario.set(usuarioId, recentes);
      return false;
    }
    recentes.push(agora);
    this.consultasPorUsuario.set(usuarioId, recentes);
    return true;
  }

  private registrar(
    resultado: ResultadoConsultaCep,
    requestId: string,
    duracaoMs: number,
  ): void {
    this.logger.log({
      evento: "cep.consulta",
      fornecedor: this.fornecedor.nome,
      resultado,
      duracaoMs,
      requestId,
    });
  }
}
