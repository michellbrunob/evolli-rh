/**
 * T216 — as abas próprias da NR-1 e da saúde financeira nos resultados.
 * O resultado do modelo vem em `ResultadosPesquisa.modelo` (a Visão geral é
 * registrada em `modelos/resultados.tsx`); aqui ficam as abas a mais (Por
 * grupo, Plano de ação, Conformidade NR-1 e Análises), os recortes (um
 * resultado por grupo visível) e o acompanhamento da NR-1.
 */
import { useEffect, useState, type ReactNode } from "react";
import { diaCivilDeHoje } from "../../../format/data";
import type {
  CampoGrupo,
  ModeloPesquisa,
  PesquisaDetalhe,
  ResultadosPesquisa,
} from "../../../api/pesquisasClient";
import {
  SERVICO_DOS_MODELOS,
  type GrupoDoModelo,
  type ResultadoDoPainel,
  type ResultadoNr1,
  type ServicoDosModelos,
} from "../../../api/modelosDePesquisaClient";
import type { AbaDosResultados } from "../rotasDePesquisas";
import type { ServicoDePesquisas } from "../servicoDePesquisas";
import {
  ConformidadeNr1,
  PlanoDeAcaoNr1,
  pedirDimensaoNoPlano,
  useAcompanhamentoLembrado,
  useAcompanhamentoNr1,
} from "./copsoq/AcompanhamentoNr1";
import {
  baixarPacoteDaConformidade,
  baixarPdfDoPlano,
} from "./copsoq/exportarNr1";
import { estrategiasSugeridas } from "./copsoq/medidasSugeridas";
import {
  PorGrupoNr1,
  VisaoGeralNr1,
  type DestinoDaVisaoGeral,
} from "./copsoq/VisaoGeralNr1";
import { AnalisesIsfb, VisaoGeralIsfb } from "./isfb/VisaoGeralIsfb";
import { PoucasRespostasDoModelo } from "./ui";

export type AbaDoModelo = AbaDosResultados;

export const ABAS_DO_MODELO: Partial<
  Record<ModeloPesquisa, readonly { valor: AbaDoModelo; rotulo: string }[]>
> = {
  copsoq: [
    { valor: "geral", rotulo: "Visão geral" },
    { valor: "analises", rotulo: "Por grupo" },
    { valor: "plano", rotulo: "Plano de ação" },
    { valor: "conformidade", rotulo: "Conformidade NR-1" },
  ],
  isfb: [
    { valor: "geral", rotulo: "Visão geral" },
    { valor: "analises", rotulo: "Análises" },
  ],
};

export const temTelasProprias = (modelo: ModeloPesquisa): boolean =>
  ABAS_DO_MODELO[modelo] !== undefined;

/**
 * O contador da aba da NR-1: as estratégias sugeridas no Plano (87 com as
 * 29 dimensões) ou "N/7" etapas na Conformidade.
 */
function ContadorNr1({
  pesquisaId,
  tipo,
  resultado,
}: {
  readonly pesquisaId: string;
  readonly tipo: "plano" | "conformidade";
  readonly resultado: ResultadoNr1 | null;
}) {
  const a = useAcompanhamentoLembrado(pesquisaId);
  if (tipo === "plano")
    return resultado ? (
      <span className="pesquisas__contagem">
        {estrategiasSugeridas(resultado)}
      </span>
    ) : null;
  if (!a) return null;
  return <span className="pesquisas__contagem">{`${a.concluidas}/7`}</span>;
}

/**
 * As abas próprias do modelo na pesquisa; na NR-1, com o contador de
 * estratégias sugeridas no Plano de ação e o andamento da Conformidade
 * ("1/7").
 */
export function abasDoModeloDaPesquisa(
  detalhe: PesquisaDetalhe,
  geral?: ResultadosPesquisa | null,
): readonly { valor: AbaDoModelo; rotulo: ReactNode }[] | undefined {
  const abas = ABAS_DO_MODELO[detalhe.modelo];
  if (!abas || detalhe.modelo !== "copsoq") return abas;
  return abas.map((a) =>
    a.valor === "plano" || a.valor === "conformidade"
      ? {
          valor: a.valor,
          rotulo: (
            <>
              {a.rotulo}{" "}
              <ContadorNr1
                pesquisaId={detalhe.id}
                tipo={a.valor}
                resultado={
                  geral?.modelo?.modelo === "copsoq" ? geral.modelo : null
                }
              />
            </>
          ),
        }
      : a,
  );
}

/** Leva a uma aba; com a dimensão, o plano abre nela. */
function irParaComDimensao(
  pesquisaId: string,
  onTrocarAba: (aba: AbaDoModelo) => void,
) {
  return (aba: DestinoDaVisaoGeral, dimensaoId?: string) => {
    if (aba === "plano" && dimensaoId)
      pedirDimensaoNoPlano(pesquisaId, dimensaoId);
    onTrocarAba(aba);
  };
}

/** O primeiro recorte (anônima: o primeiro campo de "Separar respostas por"). */
export function primeiroRecorte(
  d: PesquisaDetalhe,
  geral: ResultadosPesquisa,
): CampoGrupo | null {
  const recortes = geral.recortes ?? [];
  if (d.identificacao === "anonima")
    return d.separarPor?.[0] ?? recortes[0] ?? null;
  return recortes.includes("departamento")
    ? "departamento"
    : (recortes[0] ?? null);
}

/** O resultado da empresa no formato das telas. */
export function painelDe(
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
  campo: CampoGrupo | null = null,
  grupos: GrupoDoModelo[] | null = null,
): ResultadoDoPainel {
  const m = geral.modelo ?? null;
  const nr1 = m?.modelo === "copsoq" ? m : null;
  const isfb = m?.modelo === "isfb" ? m : null;
  return {
    modelo: detalhe.modelo === "isfb" ? "isfb" : "copsoq",
    respostas: geral.respostas,
    visivel: geral.filtro.visivel && (nr1 !== null || isfb !== null),
    minimoPorGrupo: detalhe.minimoPorGrupo,
    recortes: geral.recortes ?? [],
    nr1,
    isfb,
    campo,
    grupos,
    semGrupo: 0,
  };
}

/** O resumo de um grupo a partir do resultado dele (ou oculto). */
export function grupoDoModelo(
  g: {
    id: string;
    nome: string;
    respostas: number;
    visivel: boolean;
    oculto?: "minimo" | "protege_grupo_menor" | null;
  },
  doGrupo: ResultadosPesquisa | null,
  empresa: ResultadosPesquisa,
  /** O resultado do grupo visível não carregou (erro, não sigilo). */
  falhou = false,
): GrupoDoModelo {
  const base: GrupoDoModelo = {
    id: g.id,
    nome: g.nome,
    respostas: g.respostas,
    visivel: g.visivel && doGrupo !== null,
    oculto: g.oculto ?? (g.visivel ? null : "minimo"),
    ...(falhou ? { falhou: true } : {}),
    nr1: null,
    isfb: null,
  };
  const m = doGrupo?.modelo;
  const e = empresa.modelo;
  if (m?.modelo === "copsoq") {
    const ref = e?.modelo === "copsoq" ? e : null;
    base.nr1 = {
      pressao: m.pressao,
      recursos: m.recursos,
      destaque:
        ref !== null &&
        m.pressao !== null &&
        m.recursos !== null &&
        ref.pressao !== null &&
        ref.recursos !== null &&
        m.pressao > ref.pressao &&
        m.recursos < ref.recursos,
      niveis: m.niveis,
      precisamDeAcao: m.precisamDeAcao,
      dimensoes: m.dimensoes.map((x) => ({
        id: x.id,
        escore: x.escore,
        percentualEmRisco: x.percentuais.risco,
        nivel: x.nivel,
      })),
    };
  } else if (m?.modelo === "isfb") {
    base.isfb = {
      isfb: m.isfb,
      faixa: m.faixa,
      saude: {
        baixa: m.saude.baixa.quantidade,
        no_limite: m.saude.no_limite.quantidade,
        saudavel: m.saude.saudavel.quantidade,
      },
      comTresOuMaisSinais:
        (m.sinaisAcumulados[3] ?? 0) + (m.sinaisAcumulados[4] ?? 0),
    };
  }
  return base;
}

/** Os grupos do recorte: um resultado da pesquisa por grupo visível. */
function useGrupos(
  servico: ServicoDePesquisas,
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
  campo: CampoGrupo | null,
  ativo: boolean,
): GrupoDoModelo[] | null {
  const [grupos, setGrupos] = useState<GrupoDoModelo[] | null>(null);
  useEffect(() => {
    if (!ativo || !campo) return;
    let vivo = true;
    const lista = geral.grupos?.[campo] ?? [];
    const FALHOU = "falhou" as const;
    Promise.all(
      lista.map((g) =>
        g.visivel
          ? Promise.resolve(
              servico.resultadosDaPesquisa(detalhe.id, {
                campo,
                grupoId: g.id,
              }),
            ).catch(() => FALHOU)
          : Promise.resolve(null),
      ),
    ).then((resultados) => {
      if (vivo)
        setGrupos(
          lista.map((g, i) => {
            const r = resultados[i]!;
            return r === FALHOU
              ? grupoDoModelo(g, null, geral, true)
              : grupoDoModelo(g, r, geral);
          }),
        );
    });
    return () => {
      vivo = false;
    };
  }, [servico, detalhe.id, geral, campo, ativo]);
  return grupos;
}

export function PainelDoModelo({
  detalhe,
  geral,
  servico,
  aba,
  podeEditar,
  servicoDosModelos = SERVICO_DOS_MODELOS,
  onTrocarAba,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  /** Os resultados de cada grupo (recortes). */
  readonly servico: ServicoDePesquisas;
  readonly aba: AbaDoModelo;
  readonly podeEditar: boolean;
  /** O acompanhamento da NR-1 (testes: um falso). */
  readonly servicoDosModelos?: ServicoDosModelos;
  readonly onTrocarAba?: (aba: AbaDoModelo) => void;
}) {
  const [campo, setCampo] = useState<CampoGrupo | null>(() =>
    primeiroRecorte(detalhe, geral),
  );
  const nr1 = detalhe.modelo === "copsoq";
  const grupos = useGrupos(servico, detalhe, geral, campo, aba === "analises");
  const acompanhamento = useAcompanhamentoNr1(
    servicoDosModelos,
    detalhe.id,
    nr1,
  );
  const r = painelDe(detalhe, geral, campo, grupos);

  const hoje = diaCivilDeHoje();
  if (nr1 && aba === "conformidade") {
    return (
      <ConformidadeNr1
        acompanhamento={acompanhamento}
        podeEditar={podeEditar}
        onVerResultados={() => onTrocarAba?.("geral")}
        onVerPlano={() => onTrocarAba?.("plano")}
        onBaixarTudo={async () => {
          if (!acompanhamento.gravado) return;
          await baixarPacoteDaConformidade({
            servico,
            servicoDosModelos,
            detalhe,
            geral,
            acompanhamento: acompanhamento.gravado,
            hoje,
          });
        }}
      />
    );
  }
  if (!r.visivel) {
    return (
      <PoucasRespostasDoModelo detalhe={detalhe} minimo={r.minimoPorGrupo} />
    );
  }
  if (r.nr1) {
    if (aba === "plano")
      return (
        <PlanoDeAcaoNr1
          r={r.nr1}
          acompanhamento={acompanhamento}
          podeEditar={podeEditar}
          hoje={hoje}
          onBaixarPdf={() =>
            void baixarPdfDoPlano({
              servico,
              detalhe,
              geral,
              acompanhamento: acompanhamento.gravado,
              hoje,
            })
          }
        />
      );
    if (aba === "analises")
      return <PorGrupoNr1 resultado={r} campo={campo} onCampo={setCampo} />;
    return (
      <VisaoGeralNr1
        resultado={r}
        acompanhamento={acompanhamento.gravado}
        detalhe={detalhe}
        {...(onTrocarAba
          ? { onIrPara: irParaComDimensao(detalhe.id, onTrocarAba) }
          : {})}
      />
    );
  }
  return aba === "analises" ? (
    <AnalisesIsfb resultado={r} campo={campo} onCampo={setCampo} />
  ) : (
    <VisaoGeralIsfb resultado={r} />
  );
}

/** A Visão geral da NR-1 com os números do acompanhamento (plano e etapas). */
export function VisaoGeralNr1DoRegistro({
  detalhe,
  geral,
  servicoDosModelos = SERVICO_DOS_MODELOS,
  onTrocarAba,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly servicoDosModelos?: ServicoDosModelos;
  /** Leva ao plano (na dimensão) e à conformidade. */
  readonly onTrocarAba?: (aba: AbaDoModelo) => void;
}) {
  const acompanhamento = useAcompanhamentoNr1(servicoDosModelos, detalhe.id);
  return (
    <VisaoGeralNr1
      resultado={painelDe(detalhe, geral)}
      acompanhamento={acompanhamento.gravado}
      detalhe={detalhe}
      {...(onTrocarAba
        ? { onIrPara: irParaComDimensao(detalhe.id, onTrocarAba) }
        : {})}
    />
  );
}
