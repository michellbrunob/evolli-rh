/**
 * T209 (Bloco C) — regras puras da importação de colaboradores por planilha:
 * modelo, leitura do CSV, cabeçalho fixo, limites, conferência por linha e o
 * corpo da admissão. Nenhuma mensagem repete o valor digitado (C-12).
 */
import { describe, expect, it } from "vitest";
import {
  COLUNAS_OBRIGATORIAS,
  COLUNAS_OPCIONAIS,
  LIMITE_DE_BYTES,
  LIMITE_DE_LINHAS,
  NOME_DA_LINHA_DE_EXEMPLO,
  conferirPlanilha,
  gerarModelo,
  lerSalarioDaPlanilha,
  lerPlanilha,
  montarAdmissao,
  chaveDaLinha,
  relatorioDeErros,
  verificarTamanho,
  type Referencias,
} from "./planilhaColaboradores";

const HOJE = "2026-11-16";

const REFERENCIAS: Referencias = {
  departamentos: [
    { id: "dep-adm", codigo: "ADM" },
    { id: "dep-oper", codigo: "OPER" },
  ],
  cargos: [{ id: "car-analista", codigo: "ANALISTA" }],
  unidades: [{ id: "uni-sp", codigo: "SP01" }],
};

const CABECALHO =
  "nome;tipo_vinculo;data_admissao;data_nascimento;departamento_codigo;cargo_codigo;matricula;unidade_codigo;salario";

function planilha(...linhas: string[]): string {
  return [CABECALHO, ...linhas].join("\r\n");
}

function conferir(texto: string) {
  const lida = lerPlanilha(texto);
  if ("erro" in lida) throw new Error(`arquivo recusado: ${lida.erro}`);
  return conferirPlanilha(lida, REFERENCIAS, HOJE);
}

const VALIDA = "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00";

describe("modelo", () => {
  it("cabeçalho fixo com as obrigatórias e as opcionais, BOM e uma linha de exemplo", () => {
    const modelo = gerarModelo();
    expect(modelo.startsWith("﻿")).toBe(true);
    const [cabecalho, exemplo, resto] = modelo.slice(1).split("\r\n");
    expect(cabecalho!.split(";")).toEqual([
      ...COLUNAS_OBRIGATORIAS,
      ...COLUNAS_OPCIONAIS,
    ]);
    expect(exemplo).toContain(NOME_DA_LINHA_DE_EXEMPLO);
    expect(resto).toBe("");
  });

  it("o modelo é lido sem erro de arquivo, mas a linha de exemplo nunca é importada", () => {
    const linhas = conferir(gerarModelo());
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.admissao).toBeNull();
    expect(linhas[0]!.erros).toContainEqual({
      campo: "Nome",
      motivo: "é a linha de exemplo do modelo; apague-a antes de importar",
    });
  });

  it("as colunas obrigatórias incluem a data de nascimento (decisão de 2026-11-16) e o salário (T215)", () => {
    expect(COLUNAS_OBRIGATORIAS).toEqual([
      "nome",
      "tipo_vinculo",
      "data_admissao",
      "data_nascimento",
      "departamento_codigo",
      "cargo_codigo",
      "salario",
    ]);
    expect(COLUNAS_OPCIONAIS).toEqual(["matricula", "unidade_codigo"]);
  });
});

describe("tamanho", () => {
  it("até 1 MB passa; acima, recusa o arquivo", () => {
    expect(LIMITE_DE_BYTES).toBe(1024 * 1024);
    expect(verificarTamanho(LIMITE_DE_BYTES)).toBeNull();
    expect(verificarTamanho(LIMITE_DE_BYTES + 1)).toMatch(/1 MB/);
    expect(verificarTamanho(0)).toMatch(/vazio/);
  });
});

describe("leitura do CSV", () => {
  it("separador ';' ou ',' detectado pelo cabeçalho", () => {
    const virgula = [
      CABECALHO.replace(/;/g, ","),
      "Ana Souza,clt,01/12/2026,15/05/1990,ADM,ANALISTA,,,1621.00",
    ].join("\n");
    const linhas = conferir(virgula);
    expect(linhas[0]!.erros).toEqual([]);
    expect(linhas[0]!.admissao?.nome).toBe("Ana Souza");
  });

  it("BOM, CRLF ou LF, aspas com separador e aspas escapadas dentro", () => {
    const texto =
      "﻿" +
      planilha(
        '"Souza; Ana ""Tia""";clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00',
      );
    const linhas = conferir(texto);
    expect(linhas[0]!.admissao?.nome).toBe('Souza; Ana "Tia"');
  });

  it("cabeçalho sem diferença de maiúsculas, acentos ou espaços nas pontas", () => {
    const texto = [
      " Nome ;TIPO_VINCULO;Data_Admissao;data_nascimento;departamento_codigo;cargo_codigo; Salário ",
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;1.621,00",
    ].join("\n");
    expect(conferir(texto)[0]!.erros).toEqual([]);
  });

  it("as colunas opcionais podem faltar no cabeçalho", () => {
    const texto = [
      COLUNAS_OBRIGATORIAS.join(";"),
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;1.621,00",
    ].join("\n");
    expect(conferir(texto)[0]!.admissao).not.toBeNull();
  });

  it("linhas totalmente vazias são ignoradas; o número é a linha do arquivo", () => {
    const linhas = conferir(
      planilha("", VALIDA, ";;;;;;;", "Bia;xx;;;;;;;1.621,00"),
    );
    expect(linhas.map((l) => l.numero)).toEqual([3, 5]);
  });

  it("arquivo sem linha de dados é recusado", () => {
    expect(lerPlanilha(CABECALHO)).toEqual({
      erro: "A planilha não tem nenhuma linha de dados abaixo do cabeçalho.",
    });
    expect(lerPlanilha("")).toEqual({ erro: "O arquivo está vazio." });
  });

  it(`mais de ${LIMITE_DE_LINHAS} linhas de dados recusa o arquivo`, () => {
    const muitas = Array.from({ length: LIMITE_DE_LINHAS + 1 }, () => VALIDA);
    expect(lerPlanilha(planilha(...muitas))).toEqual({
      erro: `A planilha tem mais de ${LIMITE_DE_LINHAS} linhas de dados. Divida em arquivos menores.`,
    });
    const exatas = Array.from({ length: LIMITE_DE_LINHAS }, () => VALIDA);
    expect("erro" in lerPlanilha(planilha(...exatas))).toBe(false);
  });

  it("aspas sem fechamento recusam o arquivo", () => {
    expect(
      lerPlanilha(planilha('"Ana;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;')),
    ).toEqual({
      erro: "O arquivo tem aspas sem fechamento e não pôde ser lido.",
    });
  });
});

describe("cabeçalho fixo", () => {
  it("coluna proibida (dado pessoal fora do modelo) recusa o arquivo inteiro", () => {
    for (const coluna of [
      "cpf",
      "pis",
      "email",
      "telefone",
      "endereco",
      "sexo",
    ]) {
      const lida = lerPlanilha(
        [`${CABECALHO};${coluna}`, `${VALIDA};x`].join("\n"),
      );
      expect(lida).toEqual({
        erro: `A planilha tem colunas que não fazem parte do modelo: ${coluna}. Use o modelo, sem colunas a mais.`,
      });
    }
  });

  it("coluna desconhecida também", () => {
    expect(
      lerPlanilha([`${CABECALHO};observacao`, `${VALIDA};x`].join("\n")),
    ).toEqual({
      erro: "A planilha tem colunas que não fazem parte do modelo: observacao. Use o modelo, sem colunas a mais.",
    });
  });

  it("coluna obrigatória ausente recusa o arquivo, dizendo qual", () => {
    const semNascimento = CABECALHO.replace(";data_nascimento", "");
    expect(
      lerPlanilha(
        [semNascimento, "Ana;clt;01/12/2026;ADM;ANALISTA;;;1.621,00"].join(
          "\n",
        ),
      ),
    ).toEqual({
      erro: "Faltam colunas obrigatórias no cabeçalho: data_nascimento.",
    });
  });

  it("coluna repetida recusa o arquivo", () => {
    expect(
      lerPlanilha([`${CABECALHO};nome`, `${VALIDA};x`].join("\n")),
    ).toEqual({
      erro: "A coluna nome aparece mais de uma vez no cabeçalho.",
    });
  });
});

describe("conferência por linha", () => {
  it("linha válida: admissão pronta, referências por código resolvidas para id", () => {
    const [linha] = conferir(
      planilha(
        "  Ana Souza  ;CLT;01/12/2026;1990-05-15;adm;analista;ab-12;sp01;1.621,00",
      ),
    );
    expect(linha!.erros).toEqual([]);
    expect(linha!.admissao).toEqual({
      nome: "Ana Souza",
      tipo: "clt",
      dataAdmissao: "2026-12-01",
      dataNascimento: "1990-05-15",
      departamentoId: "dep-adm",
      cargoId: "car-analista",
      salarioBruto: "1621.00",
      unidadeId: "uni-sp",
      matricula: "AB-12",
    });
  });

  it.each([
    ["clt", "clt"],
    ["Estágio", "estagio"],
    ["estagio", "estagio"],
    ["Aprendiz", "aprendiz"],
    ["PJ", "pj"],
    ["Temporário", "temporario"],
    ["Outro controlado", "outro_controlado"],
    ["outro_controlado", "outro_controlado"],
  ])("tipo '%s' vira %s", (valor, tipo) => {
    const [linha] = conferir(
      planilha(
        `Ana Souza;${valor};01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00`,
      ),
    );
    expect(linha!.admissao?.tipo).toBe(tipo);
  });

  it.each([
    [
      "nome vazio",
      ";clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00",
      "Nome",
      "obrigatório",
    ],
    [
      "nome curto",
      "A;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00",
      "Nome",
      "deve ter entre 2 e 160 caracteres",
    ],
    [
      "nome longo",
      `${"a".repeat(161)};clt;01/12/2026;15/05/1990;ADM;ANALISTA;;`,
      "Nome",
      "deve ter entre 2 e 160 caracteres",
    ],
    [
      "tipo vazio",
      "Ana Souza;;01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00",
      "Tipo de vínculo",
      "obrigatório",
    ],
    [
      "tipo fora da lista",
      "Ana Souza;estatutario;01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00",
      "Tipo de vínculo",
      "não é um dos tipos aceitos (CLT, Estágio, Aprendiz, PJ, Temporário, Outro controlado)",
    ],
    [
      "admissão vazia",
      "Ana Souza;clt;;15/05/1990;ADM;ANALISTA;;;1.621,00",
      "Data de admissão",
      "obrigatória",
    ],
    [
      "admissão inválida",
      "Ana Souza;clt;31/02/2026;15/05/1990;ADM;ANALISTA;;;1.621,00",
      "Data de admissão",
      "não é uma data válida (use DD/MM/AAAA)",
    ],
    [
      "admissão antes de 1900",
      "Ana Souza;clt;31/12/1899;15/05/1990;ADM;ANALISTA;;;1.621,00",
      "Data de admissão",
      "não pode ser anterior a 01/01/1900",
    ],
    [
      "nascimento vazio",
      "Ana Souza;clt;01/12/2026;;ADM;ANALISTA;;;1.621,00",
      "Data de nascimento",
      "obrigatória",
    ],
    [
      "nascimento inválido",
      "Ana Souza;clt;01/12/2026;1990/05/15;ADM;ANALISTA;;;1.621,00",
      "Data de nascimento",
      "não é uma data válida (use DD/MM/AAAA)",
    ],
    [
      "nascimento no futuro",
      "Ana Souza;clt;01/12/2026;17/11/2026;ADM;ANALISTA;;;1.621,00",
      "Data de nascimento",
      "não pode estar no futuro",
    ],
    [
      "nascimento antes de 1900",
      "Ana Souza;clt;01/12/2026;31/12/1899;ADM;ANALISTA;;;1.621,00",
      "Data de nascimento",
      "não pode ser anterior a 01/01/1900",
    ],
    [
      "departamento vazio",
      "Ana Souza;clt;01/12/2026;15/05/1990;;ANALISTA;;;1.621,00",
      "Departamento",
      "obrigatório",
    ],
    [
      "departamento inexistente",
      "Ana Souza;clt;01/12/2026;15/05/1990;XYZ;ANALISTA;;;1.621,00",
      "Departamento",
      "não há departamento ativo com esse código na empresa",
    ],
    [
      "cargo vazio",
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;;;;1.621,00",
      "Cargo",
      "obrigatório",
    ],
    [
      "cargo inexistente",
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;GERENTE;;;1.621,00",
      "Cargo",
      "não há cargo ativo com esse código na empresa",
    ],
    [
      "unidade inexistente",
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;RJ99;1.621,00",
      "Unidade",
      "não há unidade ativa com esse código na empresa",
    ],
    [
      "matrícula fora do padrão",
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;a b;;1.621,00",
      "Matrícula",
      "use de 2 a 32 letras, números, hífen ou sublinhado",
    ],
    [
      "salário vazio",
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;",
      "Salário",
      "obrigatório",
    ],
    [
      "salário inválido",
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;mil reais",
      "Salário",
      "não é um valor em reais (use, por exemplo, 1.621,00)",
    ],
    [
      "salário zero",
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;0,00",
      "Salário",
      "não é um valor em reais (use, por exemplo, 1.621,00)",
    ],
    [
      "caractere de controle no nome",
      "Ana\u0007 Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00",
      "Nome",
      "tem caracteres não permitidos",
    ],
  ])(
    "%s: recusa a linha com campo e motivo",
    (_caso, linhaCsv, campo, motivo) => {
      const [linha] = conferir(planilha(linhaCsv));
      expect(linha!.admissao).toBeNull();
      expect(linha!.erros).toContainEqual({ campo, motivo });
    },
  );

  it("nascimento hoje é aceito (o limite é o futuro)", () => {
    const [linha] = conferir(
      planilha(`Ana Souza;clt;01/12/2026;16/11/2026;ADM;ANALISTA;;;1.621,00`),
    );
    expect(linha!.erros).toEqual([]);
  });

  it("vários erros na mesma linha aparecem todos", () => {
    const [linha] = conferir(planilha("A;xx;;;;;;;"));
    expect(linha!.erros.map((e) => e.campo)).toEqual([
      "Nome",
      "Tipo de vínculo",
      "Data de admissão",
      "Data de nascimento",
      "Departamento",
      "Cargo",
      "Salário",
    ]);
  });

  it("nenhuma mensagem repete o valor digitado", () => {
    const valores = [
      "Zuleica Teste",
      "estatutario",
      "31/02/2026",
      "17/11/2026",
      "XYZ123",
      "GERENTE9",
      "a b",
      "RJ99",
      "9,9,9",
    ];
    const [linha] = conferir(planilha(valores.join(";")));
    const texto = JSON.stringify(linha!.erros);
    for (const valor of valores.filter((v) => v !== "Zuleica Teste"))
      expect(texto).not.toContain(valor);
    expect(texto).not.toContain("Zuleica");
  });

  it("matrícula repetida no arquivo recusa a linha seguinte, citando a primeira", () => {
    const linhas = conferir(
      planilha(
        "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;M-1;;1.621,00",
        "Bia Lima;clt;01/12/2026;15/05/1991;ADM;ANALISTA;m-1;;1.621,00",
      ),
    );
    expect(linhas[0]!.erros).toEqual([]);
    expect(linhas[1]!.erros).toContainEqual({
      campo: "Matrícula",
      motivo: "repetida no arquivo (linha 2)",
    });
  });

  it("linha repetida (mesmos dados) recusa a cópia, citando a original", () => {
    const linhas = conferir(
      planilha(
        VALIDA,
        " ana souza ;CLT;01/12/2026;1990-05-15;adm;analista;;;1.621,00",
      ),
    );
    expect(linhas[0]!.erros).toEqual([]);
    expect(linhas[1]!.admissao).toBeNull();
    expect(linhas[1]!.erros).toContainEqual({
      campo: "Linha",
      motivo: "repete a linha 2",
    });
  });

  it("valor a mais além das colunas do cabeçalho recusa a linha", () => {
    const [linha] = conferir(planilha(`${VALIDA};sobra`));
    expect(linha!.erros).toContainEqual({
      campo: "Linha",
      motivo: "tem mais valores que as colunas do cabeçalho",
    });
  });
});

describe("corpo da admissão", () => {
  it("o mesmo contrato do cadastro individual: motivo de admissão inicial, só a data de nascimento no perfil, opcionais fora quando vazios", () => {
    const [completa, minima] = conferir(
      planilha(
        "Ana Souza;aprendiz;01/12/2026;15/05/2008;ADM;ANALISTA;M-1;SP01;1.621,00",
        "Bia Lima;clt;01/12/2026;15/05/1991;OPER;ANALISTA;;;1.621,00",
      ),
    );
    expect(montarAdmissao(completa!.admissao!, "emp-1")).toEqual({
      nome: "Ana Souza",
      empresaId: "emp-1",
      tipo: "aprendiz",
      dataAdmissao: "2026-12-01",
      motivoCodigo: "admissao_inicial",
      departamentoId: "dep-adm",
      cargoId: "car-analista",
      matricula: "M-1",
      unidadeOrganizacionalId: "uni-sp",
      perfilPessoal: expect.objectContaining({ dataNascimento: "2008-05-15" }),
      // T215 — o primeiro salário abre a linha do tempo salarial.
      contrato: { salarioBruto: "1621.00" },
    });
    // Nenhum outro dado pessoal: o restante do perfil vai vazio.
    const { dataNascimento, ...resto } = montarAdmissao(
      completa!.admissao!,
      "emp-1",
    ).perfilPessoal;
    expect(dataNascimento).toBe("2008-05-15");
    expect(Object.values(resto).every((valor) => valor === null)).toBe(true);
    const corpo = montarAdmissao(minima!.admissao!, "emp-1");
    expect(corpo).not.toHaveProperty("matricula");
    expect(corpo).not.toHaveProperty("unidadeOrganizacionalId");
    expect(corpo).not.toHaveProperty("endereco");
    expect(corpo).not.toHaveProperty("contatos");
  });
});

describe("salário da planilha (T215)", () => {
  it.each([
    ["1.621,00"],
    ["1621,00"],
    ["1621.00"],
    ["1621"],
    ["R$ 1.621,00"],
    ["1.621"],
    [" 1621,0 "],
  ])("'%s' vira 1621.00", (texto) => {
    expect(lerSalarioDaPlanilha(texto)).toBe("1621.00");
  });

  it("célula numérica do .xlsx com centavos: '1621.5' vira 1621.50", () => {
    expect(lerSalarioDaPlanilha("1621.5")).toBe("1621.50");
  });

  it.each([[""], ["abc"], ["0"], ["0,00"], ["-5"], ["1,2,3"], ["12345678901"]])(
    "'%s' não é salário",
    (texto) => {
      expect(lerSalarioDaPlanilha(texto)).toBeNull();
    },
  );
});

describe("relatório de erros", () => {
  it("CSV com linha, campo e motivo — sem nenhum valor da planilha", () => {
    const linhas = conferir(
      planilha(
        "Zuleica Teste;estatutario;01/12/2026;15/05/1990;XYZ;ANALISTA;;;1.621,00",
        VALIDA,
      ),
    );
    const csv = relatorioDeErros(
      linhas.flatMap((l) => l.erros.map((e) => ({ numero: l.numero, ...e }))),
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const corpo = csv.slice(1).split("\r\n");
    expect(corpo[0]).toBe("linha;campo;motivo");
    expect(corpo).toContain(
      "2;Tipo de vínculo;não é um dos tipos aceitos (CLT, Estágio, Aprendiz, PJ, Temporário, Outro controlado)",
    );
    expect(corpo).toContain(
      "2;Departamento;não há departamento ativo com esse código na empresa",
    );
    expect(csv).not.toContain("Zuleica");
    expect(csv).not.toContain("estatutario");
    expect(csv).not.toContain("XYZ");
  });
});

describe("chave de idempotência da linha (reimportar não duplica)", () => {
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  async function chaveDe(linhaCsv: string, empresa = "emp-1") {
    const [linha] = conferir(planilha(linhaCsv));
    return chaveDaLinha(empresa, linha!.admissao!);
  }

  it("é um UUID v5 que o servidor aceita", async () => {
    expect(await chaveDe(VALIDA)).toMatch(UUID);
  });

  it("o mesmo arquivo, conferido de novo, gera as mesmas chaves", async () => {
    expect(await chaveDe(VALIDA)).toBe(await chaveDe(VALIDA));
  });

  it("depende só da identidade: nome (sem diferença de maiúsculas, acentos ou espaços), nascimento e matrícula", async () => {
    const base = await chaveDe(
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00",
    );
    // Outro cargo ou admissão: mesma pessoa, mesma chave (o servidor recusa o
    // conteúdo diferente em vez de admitir de novo).
    expect(
      await chaveDe(
        "  ANA  souza ;pj;02/12/2026;1990-05-15;ADM;ANALISTA;;;1.621,00",
      ),
    ).toBe(base);
    expect(
      await chaveDe(
        "Ana Souza;clt;01/12/2026;16/05/1990;ADM;ANALISTA;;;1.621,00",
      ),
    ).not.toBe(base);
    expect(
      await chaveDe(
        "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;M-9;;1.621,00",
      ),
    ).not.toBe(base);
    expect(
      await chaveDe(
        "Ana Sousa;clt;01/12/2026;15/05/1990;ADM;ANALISTA;;;1.621,00",
      ),
    ).not.toBe(base);
  });

  it("outra empresa, outra chave (a mesma pessoa pode ser admitida em cada empresa)", async () => {
    expect(await chaveDe(VALIDA, "emp-1")).not.toBe(
      await chaveDe(VALIDA, "emp-2"),
    );
  });

  it("não carrega dado pessoal: a chave não contém nome, data ou matrícula", async () => {
    const chave = await chaveDe(
      "Ana Souza;clt;01/12/2026;15/05/1990;ADM;ANALISTA;M-9;;1.621,00",
    );
    expect(chave).not.toMatch(/ana|souza|1990|m-9/i);
  });
});
