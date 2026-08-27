import {
  CPF_SINTETICO,
  CPF_SINTETICO_ALT,
  DH_SINTETICA_VALIDA,
  montarArquivo,
  montarArquivoValido,
  montarCabecalho,
  montarMarcacao,
  montarRegistroGenerico,
  montarTrailer,
} from "./afd-fixtures";
import { parseAfdSintetico } from "./afd-parser";

describe("parseAfdSintetico — arquivo válido", () => {
  it("aceita cabeçalho + marcações tipo 3 em ordem + trailer coerente", () => {
    const resultado = parseAfdSintetico(montarArquivoValido(3));

    expect(resultado.status).toBe("processado");
    if (resultado.status !== "processado") return;
    expect(resultado.marcacoes).toHaveLength(3);
    expect(resultado.pendencias).toHaveLength(0);
    expect(resultado.resumo).toEqual({
      totalLinhas: 5,
      marcacoesAceitas: 3,
      marcacoesRejeitadas: 0,
    });
  });

  it("devolve dados mínimos e preserva o fuso da data/hora, sem converter", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({
        nsr: 7,
        dataHora: DH_SINTETICA_VALIDA,
        cpf: CPF_SINTETICO,
      }),
      montarTrailer({ tipo3: 1 }),
    ]);

    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("processado");
    if (resultado.status !== "processado") return;

    const marcacao = resultado.marcacoes[0];
    expect(marcacao).toBeDefined();
    if (!marcacao) return;
    expect(marcacao).toEqual({
      nsr: "000000007",
      momentoMarcacao: DH_SINTETICA_VALIDA, // string bruta, fuso -0300 intacto
      identificadorBruto: CPF_SINTETICO, // 12 posições, sem normalização
      posicaoLinha: 2,
    });
  });

  it("aceita arquivo sem nenhuma marcação (só cabeçalho + trailer)", () => {
    const arquivo = montarArquivo([montarCabecalho(), montarTrailer({})]);
    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("processado");
    if (resultado.status !== "processado") return;
    expect(resultado.marcacoes).toHaveLength(0);
  });

  it("reconhece tipos 2/4/5/6/7 sem gerar batida, contando-os no trailer", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarRegistroGenerico({ nsr: 1, tipo: "2" }),
      montarMarcacao({ nsr: 2 }),
      montarRegistroGenerico({ nsr: 3, tipo: "5" }),
      montarTrailer({ tipo2: 1, tipo3: 1, tipo5: 1 }),
    ]);

    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("processado");
    if (resultado.status !== "processado") return;
    expect(resultado.marcacoes).toHaveLength(1); // só o tipo 3 vira batida
    expect(resultado.pendencias).toHaveLength(0);
  });
});

describe("parseAfdSintetico — erros estruturais fatais (fail-closed)", () => {
  function esperarRejeicao(arquivo: Buffer, codigo: string): void {
    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("rejeitado");
    if (resultado.status !== "rejeitado") return;
    expect(resultado.erro.codigo).toBe(codigo);
    // Fail-closed: nunca há registros aceitos.
    expect(resultado.marcacoes).toHaveLength(0);
    expect(resultado.pendencias).toHaveLength(0);
  }

  it("arquivo vazio", () => {
    esperarRejeicao(Buffer.alloc(0), "AFD_ARQUIVO_VAZIO");
  });

  it("codificação incompatível (byte nulo / não ISO 8859-1)", () => {
    const arquivo = Buffer.from([0x30, 0x00, 0x31, 0x0d, 0x0a]);
    esperarRejeicao(arquivo, "AFD_ENCODING_INVALIDO");
  });

  it("terminação de linha inválida (sem CR+LF final) — linha truncada", () => {
    const texto = `${montarCabecalho()}`; // sem \r\n
    esperarRejeicao(
      Buffer.from(texto, "latin1"),
      "AFD_TERMINACAO_LINHA_INVALIDA",
    );
  });

  it("linha em branco no meio do arquivo", () => {
    const texto = `${montarCabecalho()}\r\n\r\n${montarTrailer({})}\r\n`;
    esperarRejeicao(Buffer.from(texto, "latin1"), "AFD_LINHA_EM_BRANCO");
  });

  it("cabeçalho ausente (primeira linha não é tipo 1)", () => {
    const arquivo = montarArquivo([
      montarMarcacao({ nsr: 1 }),
      montarTrailer({ tipo3: 1 }),
    ]);
    esperarRejeicao(arquivo, "AFD_CABECALHO_AUSENTE");
  });

  it("cabeçalho com comprimento inválido", () => {
    const arquivo = montarArquivo([
      `${montarCabecalho()}EXTRA`,
      montarTrailer({}),
    ]);
    esperarRejeicao(arquivo, "AFD_CABECALHO_INVALIDO");
  });

  it("versão de leiaute não suportada", () => {
    const arquivo = montarArquivo([
      montarCabecalho({ versao: "003" }),
      montarTrailer({}),
    ]);
    esperarRejeicao(arquivo, "AFD_VERSAO_NAO_SUPORTADA");
  });

  it("trailer ausente (última linha não é tipo 9)", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 1 }),
    ]);
    esperarRejeicao(arquivo, "AFD_TRAILER_AUSENTE");
  });

  it("trailer com comprimento/tipo inválido", () => {
    const arquivo = montarArquivo([montarCabecalho(), `${montarTrailer({})}X`]);
    esperarRejeicao(arquivo, "AFD_TRAILER_INVALIDO");
  });

  it("tipo de registro desconhecido no miolo", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      `000000001800000000000000`, // tipo "8": desconhecido
      montarTrailer({}),
    ]);
    esperarRejeicao(arquivo, "AFD_TIPO_REGISTRO_DESCONHECIDO");
  });

  it("linha curta demais para ler o tipo (truncada além do reconhecível)", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      "00000001", // 8 chars: nem o tipo (posição 10) é legível
      montarTrailer({}),
    ]);
    esperarRejeicao(arquivo, "AFD_LINHA_TAMANHO_INVALIDO");
  });

  it("NSR fora de ordem (não crescente)", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 5 }),
      montarMarcacao({ nsr: 2 }),
      montarTrailer({ tipo3: 2 }),
    ]);
    esperarRejeicao(arquivo, "AFD_NSR_FORA_DE_ORDEM");
  });

  it("NSR duplicado", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 3 }),
      montarMarcacao({ nsr: 3 }),
      montarTrailer({ tipo3: 2 }),
    ]);
    esperarRejeicao(arquivo, "AFD_NSR_DUPLICADO");
  });

  it("contagem do trailer divergente da lida", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 1 }),
      montarTrailer({ tipo3: 9 }), // declara 9, há 1
    ]);
    esperarRejeicao(arquivo, "AFD_TRAILER_CONTAGEM_DIVERGENTE");
  });

  it("NSR fora de ordem NÃO deixa vazar nenhuma marcação já lida", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 5, cpf: CPF_SINTETICO }),
      montarMarcacao({ nsr: 2, cpf: CPF_SINTETICO_ALT }),
      montarTrailer({ tipo3: 2 }),
    ]);
    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("rejeitado");
    if (resultado.status !== "rejeitado") return;
    expect(resultado.marcacoes).toHaveLength(0);
  });
});

describe("parseAfdSintetico — rejeição por marcação (§7, parcial autorizada)", () => {
  it("marcação tipo 3 com data/hora inválida vira pendência", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 1, dataHora: "2026-13-15T08:00:00-0300" }), // mês 13
      montarTrailer({ tipo3: 1 }),
    ]);
    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("processado");
    if (resultado.status !== "processado") return;
    expect(resultado.marcacoes).toHaveLength(0);
    expect(resultado.pendencias).toEqual([
      {
        codigo: "AFD_MARCACAO_DATAHORA_INVALIDA",
        nsr: "000000001",
        posicaoLinha: 2,
      },
    ]);
  });

  it("marcação tipo 3 com identificador não numérico vira pendência", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 1, cpf: "12345678901 " }), // espaço → não numérico
      montarTrailer({ tipo3: 1 }),
    ]);
    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("processado");
    if (resultado.status !== "processado") return;
    expect(resultado.marcacoes).toHaveLength(0);
    expect(resultado.pendencias[0]?.codigo).toBe(
      "AFD_MARCACAO_IDENTIFICADOR_INVALIDO",
    );
  });

  it("marcação tipo 3 com comprimento inválido vira pendência", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      `000000001333`, // tipo 3, curta (12 chars): tamanho inválido de marcação
      montarTrailer({ tipo3: 1 }),
    ]);
    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("processado");
    if (resultado.status !== "processado") return;
    expect(resultado.pendencias[0]?.codigo).toBe(
      "AFD_MARCACAO_TAMANHO_INVALIDO",
    );
  });

  it("preserva o restante do lote: aceita as válidas, rejeita só a inválida", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 1, cpf: CPF_SINTETICO }),
      montarMarcacao({ nsr: 2, dataHora: "2026-02-30T08:00:00-0300" }), // 30/fev
      montarMarcacao({ nsr: 3, cpf: CPF_SINTETICO_ALT }),
      montarTrailer({ tipo3: 3 }),
    ]);
    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("processado");
    if (resultado.status !== "processado") return;
    expect(resultado.marcacoes).toHaveLength(2);
    expect(resultado.pendencias).toHaveLength(1);
    expect(resultado.pendencias[0]?.posicaoLinha).toBe(3);
    expect(resultado.resumo.marcacoesAceitas).toBe(2);
    expect(resultado.resumo.marcacoesRejeitadas).toBe(1);
  });

  it("rejeita data/hora com segundos diferentes de 00 e com T ausente", () => {
    for (const dh of [
      "2026-01-15T08:00:30-0300", // segundos != 00
      "2026-01-15X08:00:00-0300", // sem "T" literal
      "2026-01-15T24:00:00-0300", // hora 24
      "2026-01-15T08:60:00-0300", // minuto 60
      "2026-01-15T08:00:00 0300", // fuso sem sinal
    ]) {
      const arquivo = montarArquivo([
        montarCabecalho(),
        montarMarcacao({ nsr: 1, dataHora: dh }),
        montarTrailer({ tipo3: 1 }),
      ]);
      const resultado = parseAfdSintetico(arquivo);
      expect(resultado.status).toBe("processado");
      if (resultado.status !== "processado") continue;
      expect(resultado.pendencias[0]?.codigo).toBe(
        "AFD_MARCACAO_DATAHORA_INVALIDA",
      );
    }
  });
});

describe("parseAfdSintetico — não vazamento de dado pessoal em erros", () => {
  it("nenhum erro/pendência contém CPF, data/hora bruta ou conteúdo da linha", () => {
    // Arquivo que mistura pendências (por linha) e é estruturalmente válido.
    const arquivoComPendencias = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 1, cpf: CPF_SINTETICO }),
      montarMarcacao({ nsr: 2, cpf: "AAAAAAAAAAAA" }), // identificador inválido
      montarMarcacao({
        nsr: 3,
        dataHora: "2026-99-99T08:00:00-0300",
        cpf: CPF_SINTETICO_ALT,
      }),
      montarTrailer({ tipo3: 3 }),
    ]);

    const resultado = parseAfdSintetico(arquivoComPendencias);
    expect(resultado.status).toBe("processado");
    if (resultado.status !== "processado") return;

    const serializado = JSON.stringify(resultado.pendencias);
    expect(serializado).not.toContain(CPF_SINTETICO);
    expect(serializado).not.toContain(CPF_SINTETICO_ALT);
    expect(serializado).not.toContain("2026-99-99");
    expect(serializado).not.toContain(DH_SINTETICA_VALIDA);
    // Só código + nsr técnico + posição são expostos.
    for (const pendencia of resultado.pendencias) {
      expect(Object.keys(pendencia).sort()).toEqual([
        "codigo",
        "nsr",
        "posicaoLinha",
      ]);
    }
  });

  it("erro fatal não expõe conteúdo da linha nem identificadores", () => {
    const arquivo = montarArquivo([
      montarCabecalho(),
      montarMarcacao({ nsr: 5, cpf: CPF_SINTETICO }),
      montarMarcacao({ nsr: 1, cpf: CPF_SINTETICO_ALT }), // fora de ordem → fatal
      montarTrailer({ tipo3: 2 }),
    ]);
    const resultado = parseAfdSintetico(arquivo);
    expect(resultado.status).toBe("rejeitado");
    if (resultado.status !== "rejeitado") return;

    const serializado = JSON.stringify(resultado.erro);
    expect(serializado).not.toContain(CPF_SINTETICO);
    expect(serializado).not.toContain(CPF_SINTETICO_ALT);
    expect(serializado).not.toContain(DH_SINTETICA_VALIDA);
    expect(Object.keys(resultado.erro).sort()).toEqual([
      "codigo",
      "nsr",
      "posicaoLinha",
    ]);
  });
});
