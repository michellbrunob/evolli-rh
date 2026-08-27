/**
 * Núcleo do parser AFD sintético (Ponto V1, perfil REP-C) — TypeScript puro.
 *
 * Interpreta e **valida estruturalmente** um AFD de REP-C conforme o contrato
 * técnico T040 (`docs/modules/etapa3-parser-afd-contrato-tecnico-v1.md`),
 * transcrito do anexo oficial do MTE (leiaute AFD versão "004", Portaria MTP
 * 671/2021). Devolve, **em memória**, apenas os dados mínimos das marcações
 * aceitas e as pendências por linha.
 *
 * Fronteiras rígidas (contrato §6) — este núcleo **NÃO**:
 * - associa a marcação a um colaborador (não casa CPF com cadastro);
 * - aplica regra trabalhista (tolerância, banco, DSR, fechamento, espelho);
 * - grava, loga, faz upload, chama banco/rede ou toca em NestJS/Prisma;
 * - implementa CRC-16, assinatura, normalização do CPF de 12 posições, política
 *   definitiva de lacuna de NSR ou chave de idempotência (todos **pendentes**
 *   no contrato — §4.4, §4.7, §4.8, §4.9 —, tratados aqui como condicionados,
 *   sem inventar regra).
 *
 * Regra de segurança de erro (contrato §5, §7, §8): nenhum código de erro ou
 * pendência carrega CPF, nome, conteúdo integral da linha, data/hora bruta ou
 * hash — apenas `posicaoLinha` e/ou `nsr` técnico.
 */

import {
  CABECALHO,
  CAMPO_NSR,
  CAMPO_TIPO,
  COMPRIMENTO,
  COMPRIMENTO_MINIMO_TIPO,
  MARCACAO,
  SENTINELA_CABECALHO,
  SENTINELA_TRAILER,
  TERMINADOR_LINHA,
  TIPO_MARCACAO,
  TIPOS_DADOS_RECONHECIDOS,
  TRAILER,
  VERSAO_AFD_SUPORTADA,
} from "./afd-layout";
import {
  AfdCodigoErro,
  ErroEstruturalAfd,
  MarcacaoAfdAceita,
  PendenciaMarcacaoAfd,
  ResultadoParseAfd,
} from "./afd-parser.types";

type Fatia = readonly [number, number];

/** Lê uma fatia fixa da linha (posições já 0-based `[inicio, fim)`). */
function ler(linha: string, [inicio, fim]: Fatia): string {
  return linha.slice(inicio, fim);
}

function rejeitar(
  codigo: AfdCodigoErro,
  posicaoLinha: number | null,
  nsr: string | null,
): ResultadoParseAfd {
  const erro: ErroEstruturalAfd = { codigo, posicaoLinha, nsr };
  return { status: "rejeitado", erro, marcacoes: [], pendencias: [] };
}

/**
 * Byte-scan de compatibilidade com texto ASCII ISO 8859-1 (contrato §4.1).
 * Rejeita BOM, byte nulo e caracteres de controle que não CR/LF/TAB — sinais
 * típicos de arquivo binário ou de outra codificação.
 */
function encodingIncompativel(conteudo: Buffer): boolean {
  if (conteudo.length >= 3) {
    const b0 = conteudo[0];
    const b1 = conteudo[1];
    const b2 = conteudo[2];
    if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) return true; // UTF-8 BOM
  }
  if (conteudo.length >= 2) {
    const b0 = conteudo[0];
    const b1 = conteudo[1];
    if ((b0 === 0xff && b1 === 0xfe) || (b0 === 0xfe && b1 === 0xff)) {
      return true; // UTF-16 BOM
    }
  }
  for (const byte of conteudo) {
    const controleProibido =
      byte <= 0x08 || byte === 0x0b || byte === 0x0c || byte === 0x7f;
    const entre0e1fNaoQuebra = byte >= 0x0e && byte <= 0x1f;
    if (controleProibido || entre0e1fNaoQuebra) {
      return true;
    }
  }
  return false;
}

const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function bissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/**
 * Valida o campo DH (contrato §4.3): `AAAA-MM-ddThh:mm:00ZZZZZ`, com `T`
 * literal, segundos fixos `00` e fuso `ZZZZZ` = sinal + HHMM. Valida forma,
 * data de calendário e faixas de hora/minuto; **não** converte nem desloca.
 */
function dataHoraValida(dh: string): boolean {
  const casamento =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2})(\d{2})$/.exec(
      dh,
    );
  if (!casamento) return false;

  const ano = Number(casamento[1]);
  const mes = Number(casamento[2]);
  const dia = Number(casamento[3]);
  const hora = Number(casamento[4]);
  const minuto = Number(casamento[5]);
  const segundo = casamento[6];
  const fusoHora = Number(casamento[8]);
  const fusoMinuto = Number(casamento[9]);

  if (segundo !== "00") return false;
  if (mes < 1 || mes > 12) return false;

  const diasBase = DIAS_NO_MES[mes - 1] ?? 0;
  const diasNoMes = mes === 2 && bissexto(ano) ? 29 : diasBase;
  if (dia < 1 || dia > diasNoMes) return false;

  if (hora > 23) return false;
  if (minuto > 59) return false;
  // "os outros quatro dígitos representam a hora e os minutos" do fuso.
  if (fusoHora > 23) return false;
  if (fusoMinuto > 59) return false;

  return true;
}

/** Campo de 12 posições do CPF: preenchido e numérico (contrato §4.6). */
function identificadorValido(campo: string): boolean {
  return /^\d{12}$/.test(campo);
}

/**
 * Interpreta e valida um AFD de REP-C **sintético**, em memória.
 *
 * @param conteudo bytes do arquivo (o chamador fornece; este núcleo não faz I/O).
 */
export function parseAfdSintetico(conteudo: Buffer): ResultadoParseAfd {
  // ---- Nível arquivo: vazio, codificação, terminação de linha (§4.1) --------
  if (conteudo.length === 0) {
    return rejeitar("AFD_ARQUIVO_VAZIO", null, null);
  }
  if (encodingIncompativel(conteudo)) {
    return rejeitar("AFD_ENCODING_INVALIDO", null, null);
  }

  const texto = conteudo.toString("latin1");
  if (!texto.endsWith(TERMINADOR_LINHA)) {
    // Sem CR+LF final: arquivo truncado/corrompido.
    return rejeitar("AFD_TERMINACAO_LINHA_INVALIDA", null, null);
  }

  const partes = texto.split(TERMINADOR_LINHA);
  // A última parte após o CR+LF final é sempre "" — remove-a.
  partes.pop();
  const linhas = partes;

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i] ?? "";
    if (linha.length === 0) {
      return rejeitar("AFD_LINHA_EM_BRANCO", i + 1, null);
    }
    if (linha.includes("\r") || linha.includes("\n")) {
      // CR ou LF solto no meio: terminação divergente.
      return rejeitar("AFD_TERMINACAO_LINHA_INVALIDA", i + 1, null);
    }
  }

  // ---- Cabeçalho obrigatório na primeira linha (§4.5) -----------------------
  const cabecalho = linhas[0] ?? "";
  if (
    ler(cabecalho, CABECALHO.sentinela) !== SENTINELA_CABECALHO ||
    ler(cabecalho, CABECALHO.tipo) !== "1"
  ) {
    return rejeitar("AFD_CABECALHO_AUSENTE", 1, null);
  }
  if (cabecalho.length !== COMPRIMENTO.cabecalho) {
    return rejeitar("AFD_CABECALHO_INVALIDO", 1, null);
  }
  if (ler(cabecalho, CABECALHO.versao) !== VERSAO_AFD_SUPORTADA) {
    return rejeitar("AFD_VERSAO_NAO_SUPORTADA", 1, null);
  }

  // ---- Trailer obrigatório na última linha (§4.8) ---------------------------
  if (linhas.length < 2) {
    return rejeitar("AFD_TRAILER_AUSENTE", linhas.length, null);
  }
  const posicaoTrailer = linhas.length;
  const trailer = linhas[posicaoTrailer - 1] ?? "";
  if (ler(trailer, TRAILER.sentinela) !== SENTINELA_TRAILER) {
    return rejeitar("AFD_TRAILER_AUSENTE", posicaoTrailer, null);
  }
  if (
    trailer.length !== COMPRIMENTO.trailer ||
    ler(trailer, TRAILER.tipo) !== "9"
  ) {
    return rejeitar("AFD_TRAILER_INVALIDO", posicaoTrailer, null);
  }

  // ---- Registros de dados (tipos 2 a 7), entre cabeçalho e trailer ----------
  const marcacoes: MarcacaoAfdAceita[] = [];
  const pendencias: PendenciaMarcacaoAfd[] = [];
  const contagem: Record<string, number> = {
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
  };
  let ultimoNsr: string | null = null;

  for (let i = 1; i < posicaoTrailer - 1; i += 1) {
    const posicaoLinha = i + 1;
    const linha = linhas[i] ?? "";

    // Curta demais para ler o tipo → truncamento que impede interpretar (§4.2).
    if (linha.length < COMPRIMENTO_MINIMO_TIPO) {
      return rejeitar("AFD_LINHA_TAMANHO_INVALIDO", posicaoLinha, null);
    }

    const tipo = ler(linha, CAMPO_TIPO);
    if (!(TIPOS_DADOS_RECONHECIDOS as readonly string[]).includes(tipo)) {
      // Inclui tipos 1/9 fora de lugar e qualquer tipo desconhecido (§5).
      return rejeitar("AFD_TIPO_REGISTRO_DESCONHECIDO", posicaoLinha, null);
    }

    const nsr = ler(linha, CAMPO_NSR);
    if (!/^\d{9}$/.test(nsr)) {
      return rejeitar("AFD_NSR_INVALIDO", posicaoLinha, null);
    }
    // Ordenação por NSR (§4.4). Campo de 9 dígitos com zero à esquerda →
    // comparação lexicográfica equivale à numérica. Lacuna (salto) é
    // permitida — o anexo exige ordenação, não ausência de lacunas.
    if (ultimoNsr !== null) {
      if (nsr === ultimoNsr) {
        return rejeitar("AFD_NSR_DUPLICADO", posicaoLinha, nsr);
      }
      if (nsr < ultimoNsr) {
        return rejeitar("AFD_NSR_FORA_DE_ORDEM", posicaoLinha, nsr);
      }
    }
    ultimoNsr = nsr;

    // Contagem física do tipo (para conferência com o trailer), independente
    // de a marcação vir a ser aceita ou rejeitada por linha.
    contagem[tipo] = (contagem[tipo] ?? 0) + 1;

    // Tipos 2/4/5/6/7: reconhecidos e contados; não geram batida nem têm
    // layout interno enforçado por este núcleo (contrato §2).
    if (tipo !== TIPO_MARCACAO) {
      continue;
    }

    // ---- Marcação tipo 3: validação por linha (§7, rejeição parcial) --------
    if (linha.length !== COMPRIMENTO.marcacao) {
      pendencias.push({
        codigo: "AFD_MARCACAO_TAMANHO_INVALIDO",
        nsr,
        posicaoLinha,
      });
      continue;
    }
    if (!dataHoraValida(ler(linha, MARCACAO.dataHora))) {
      pendencias.push({
        codigo: "AFD_MARCACAO_DATAHORA_INVALIDA",
        nsr,
        posicaoLinha,
      });
      continue;
    }
    const identificador = ler(linha, MARCACAO.identificador);
    if (!identificadorValido(identificador)) {
      pendencias.push({
        codigo: "AFD_MARCACAO_IDENTIFICADOR_INVALIDO",
        nsr,
        posicaoLinha,
      });
      continue;
    }

    marcacoes.push({
      nsr,
      momentoMarcacao: ler(linha, MARCACAO.dataHora),
      identificadorBruto: identificador,
      posicaoLinha,
    });
  }

  // ---- Conferência das contagens declaradas no trailer (§4.8) --------------
  const contagemTrailer: ReadonlyArray<readonly [Fatia, string]> = [
    [TRAILER.contagemTipo2, "2"],
    [TRAILER.contagemTipo3, "3"],
    [TRAILER.contagemTipo4, "4"],
    [TRAILER.contagemTipo5, "5"],
    [TRAILER.contagemTipo6, "6"],
    [TRAILER.contagemTipo7, "7"],
  ];
  for (const [fatia, tipo] of contagemTrailer) {
    const declarado = ler(trailer, fatia);
    if (!/^\d{9}$/.test(declarado)) {
      return rejeitar("AFD_TRAILER_INVALIDO", posicaoTrailer, null);
    }
    if (Number(declarado) !== (contagem[tipo] ?? 0)) {
      return rejeitar("AFD_TRAILER_CONTAGEM_DIVERGENTE", posicaoTrailer, null);
    }
  }

  return {
    status: "processado",
    marcacoes,
    pendencias,
    resumo: {
      totalLinhas: linhas.length,
      marcacoesAceitas: marcacoes.length,
      marcacoesRejeitadas: pendencias.length,
    },
  };
}
