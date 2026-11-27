/**
 * T215 — "Exportar" da lista de Benefícios (como a referência): a planilha
 * com os custos e descontos da competência e o relatório em PDF. Gerados no
 * navegador, sem dependência nova; só o que a lista já mostra (nada de CPF).
 */
import type {
  LinhaDeBeneficioApi,
  ListaDeBeneficiosApi,
  SituacaoBeneficio,
} from "../../api/beneficiosClient";
import { type Cor, DocumentoPdf, cortarTexto } from "../../arquivos/pdfSimples";
import {
  formatarCompetenciaPorExtenso,
  formatarMesReferencia,
} from "../../format/data";
import { formatarCentavos } from "../../format/moeda";
import { plural } from "../../format/plural";
import { corDoToken } from "../horarios/quadro/exportarEscala";
import { type AbaXlsx, montarXlsx } from "../pessoas/importacao/planilhaXlsx";
import { CATEGORIAS, maiuscula } from "./textosDosBeneficios";

export const ROTULO_DA_SITUACAO: Readonly<Record<SituacaoBeneficio, string>> = {
  ativo: "Ativo",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

export const nomeDaExportacao = (competencia: string, extensao: string) =>
  `beneficios-${competencia}.${extensao}`;

const reais = (centavos: number) => Math.round(centavos) / 100;

/** Os benefícios em ordem: ativos, pausados, encerrados. */
function emOrdem(lista: ListaDeBeneficiosApi): LinhaDeBeneficioApi[] {
  const ordem: SituacaoBeneficio[] = ["ativo", "pausado", "encerrado"];
  return [...lista.beneficios].sort(
    (a, b) => ordem.indexOf(a.situacao) - ordem.indexOf(b.situacao),
  );
}

/** A planilha: Benefícios (com o total) e Sem benefício. */
export function planilhaDaLista(lista: ListaDeBeneficiosApi): Uint8Array {
  const r = lista.resumo;
  const abas: AbaXlsx[] = [
    {
      nome: "Benefícios",
      cabecalho: true,
      larguras: [32, 20, 12, 10, 12, 18, 18],
      linhas: [
        [
          "Benefício",
          "Categoria",
          "Situação",
          "Pessoas",
          "Dependentes",
          "Custo da empresa",
          "Desconto em folha",
        ],
        ...emOrdem(lista).map((b) => [
          b.nome,
          CATEGORIAS[b.categoria].curta,
          ROTULO_DA_SITUACAO[b.situacao],
          b.pessoas,
          b.dependentes,
          reais(b.empresa),
          reais(b.desconto),
        ]),
        [
          "Total da competência",
          "",
          "",
          r.pessoas,
          "",
          reais(r.empresa),
          reais(r.desconto),
        ],
      ],
    },
    {
      nome: "Sem benefício",
      cabecalho: true,
      larguras: [36, 28],
      linhas: [
        ["Colaborador", "Cargo"],
        ...r.semBeneficio.map((p) => [p.nome, p.cargo ?? ""]),
      ],
    },
  ];
  return montarXlsx(abas);
}

const MARGEM = 40;

/** O relatório da competência em PDF (A4 em pé). */
export function pdfDaLista(lista: ListaDeBeneficiosApi): Uint8Array {
  const marca = corDoToken("--color-action", [0, 102, 204]);
  const tinta: Cor = [29, 29, 31];
  const suave: Cor = [102, 112, 133];
  const linha: Cor = [222, 224, 228];
  const fundo: Cor = [246, 247, 249];
  const branco: Cor = [255, 255, 255];
  const r = lista.resumo;
  const mes = maiuscula(formatarCompetenciaPorExtenso(lista.competencia));
  const doc = new DocumentoPdf(`Benefícios — ${mes}`);

  let pg = doc.novaPagina();
  const cabecalho = () => {
    pg.retangulo(0, 0, pg.largura, 26, { preenchimento: marca });
    pg.texto(MARGEM, 17, "Evolli", { tamanho: 11, negrito: true, cor: branco });
    pg.textoADireita(pg.largura - MARGEM, 17, "Benefícios", {
      tamanho: 8,
      negrito: true,
      cor: branco,
    });
  };
  cabecalho();
  let y = 64;
  pg.texto(MARGEM, y, "Relatório da competência", {
    tamanho: 16,
    negrito: true,
    cor: tinta,
  });
  y += 16;
  pg.texto(
    MARGEM,
    y,
    `${mes} · competência ${formatarMesReferencia(lista.competencia)} · valores previstos`,
    { tamanho: 9, cor: suave },
  );

  // Os três números.
  y += 22;
  const largura = (pg.largura - MARGEM * 2) / 3;
  const numeros: [string, string, string][] = [
    [
      "Investimento da empresa",
      `${formatarCentavos(r.empresa)}/mês`,
      plural(r.beneficiosAtivos, "benefício ativo", "benefícios ativos"),
    ],
    [
      "Descontado em folha",
      formatarCentavos(r.desconto),
      `Parte paga pelos colaboradores · ${plural(r.comDesconto, "pessoa", "pessoas")}`,
    ],
    [
      "Cobertura do time",
      `${r.ativos - r.semBeneficio.length} de ${r.ativos} ativos`,
      `${r.semBeneficio.length} sem nenhum benefício`,
    ],
  ];
  numeros.forEach(([titulo, valor, detalhe], i) => {
    const x = MARGEM + largura * i;
    pg.retangulo(x, y, largura - 8, 58, { preenchimento: fundo });
    pg.texto(x + 10, y + 16, titulo, { tamanho: 8, cor: suave });
    pg.texto(x + 10, y + 34, valor, { tamanho: 13, negrito: true, cor: tinta });
    pg.texto(x + 10, y + 49, cortarTexto(detalhe, largura - 28, 7), {
      tamanho: 7,
      cor: suave,
    });
  });

  // A tabela.
  y += 84;
  const colunas = [
    { titulo: "Benefício", x: MARGEM, direita: false },
    { titulo: "Situação", x: MARGEM + 230, direita: false },
    { titulo: "Pessoas", x: MARGEM + 340, direita: true },
    { titulo: "Custo da empresa", x: MARGEM + 430, direita: true },
    { titulo: "Desconto em folha", x: pg.largura - MARGEM, direita: true },
  ];
  const titulos = () => {
    pg.retangulo(MARGEM, y - 12, pg.largura - MARGEM * 2, 18, {
      preenchimento: fundo,
    });
    for (const c of colunas) {
      const estilo = { tamanho: 8, negrito: true, cor: suave };
      if (c.direita) pg.textoADireita(c.x - 6, y, c.titulo, estilo);
      else pg.texto(c.x + 6, y, c.titulo, estilo);
    }
    y += 20;
  };
  titulos();
  for (const b of emOrdem(lista)) {
    if (y > pg.altura - 80) {
      pg = doc.novaPagina();
      cabecalho();
      y = 60;
      titulos();
    }
    pg.texto(MARGEM + 6, y, cortarTexto(b.nome, 200, 9), {
      tamanho: 9,
      negrito: true,
      cor: tinta,
    });
    pg.texto(MARGEM + 6, y + 11, CATEGORIAS[b.categoria].curta, {
      tamanho: 7,
      cor: suave,
    });
    pg.texto(MARGEM + 236, y, ROTULO_DA_SITUACAO[b.situacao], {
      tamanho: 9,
      cor: tinta,
    });
    pg.textoADireita(
      MARGEM + 334,
      y,
      b.dependentes > 0
        ? `${b.pessoas} + ${b.dependentes} dep.`
        : String(b.pessoas),
      { tamanho: 9, cor: tinta },
    );
    pg.textoADireita(MARGEM + 424, y, formatarCentavos(b.empresa), {
      tamanho: 9,
      negrito: true,
      cor: tinta,
    });
    pg.textoADireita(pg.largura - MARGEM - 6, y, formatarCentavos(b.desconto), {
      tamanho: 9,
      cor: tinta,
    });
    pg.linha(MARGEM, y + 18, pg.largura - MARGEM, y + 18, linha);
    y += 30;
  }
  pg.retangulo(MARGEM, y - 12, pg.largura - MARGEM * 2, 30, {
    preenchimento: fundo,
  });
  pg.texto(MARGEM + 6, y, "Total da competência", {
    tamanho: 9,
    negrito: true,
    cor: tinta,
  });
  pg.texto(
    MARGEM + 6,
    y + 11,
    `${plural(r.beneficiosAtivos, "benefício ativo", "benefícios ativos")} · ${plural(r.pessoas, "pessoa", "pessoas")}`,
    { tamanho: 7, cor: suave },
  );
  pg.textoADireita(MARGEM + 424, y, formatarCentavos(r.empresa), {
    tamanho: 9,
    negrito: true,
    cor: tinta,
  });
  pg.textoADireita(pg.largura - MARGEM - 6, y, formatarCentavos(r.desconto), {
    tamanho: 9,
    negrito: true,
    cor: tinta,
  });

  for (const [i, p] of doc.paginas.entries()) {
    const base = p.altura - 24;
    p.linha(MARGEM, base - 8, p.largura - MARGEM, base - 8, linha);
    p.texto(
      MARGEM,
      base,
      "Gerado pelo Evolli · valores previstos, sem folha fechada",
      {
        tamanho: 7,
        cor: suave,
      },
    );
    p.textoADireita(
      p.largura - MARGEM,
      base,
      `${i + 1}/${doc.paginas.length}`,
      {
        tamanho: 7,
        cor: suave,
      },
    );
  }
  return doc.bytes();
}
