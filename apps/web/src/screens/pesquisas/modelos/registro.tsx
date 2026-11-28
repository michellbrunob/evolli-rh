/**
 * T216 — as abas próprias da NR-1 e da saúde financeira nos resultados.
 * O resultado do modelo vem em `ResultadosPesquisa.modelo` (a Visão geral é
 * registrada em `modelos/resultados.tsx`); aqui ficam as abas a mais (Por
 * grupo, Plano de ação, Conformidade NR-1 e Análises), os recortes (um
 * resultado por grupo visível) e o acompanhamento da NR-1.
 */
import { useEffect, useState } from "react";
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
  type ServicoDosModelos,
} from "../../../api/modelosDePesquisaClient";
import type { AbaDosResultados } from "../rotasDePesquisas";
import type { ServicoDePesquisas } from "../servicoDePesquisas";
import {
  ConformidadeNr1,
  PlanoDeAcaoNr1,
  useAcompanhamentoNr1,
} from "./copsoq/AcompanhamentoNr1";
import { PorGrupoNr1, VisaoGeralNr1 } from "./copsoq/VisaoGeralNr1";
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
): GrupoDoModelo {
  const base: GrupoDoModelo = {
    id: g.id,
    nome: g.nome,
    respostas: g.respostas,
    visivel: g.visivel && doGrupo !== null,
    oculto: g.oculto ?? (g.visivel ? null : "minimo"),
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
    Promise.all(
      lista.map((g) =>
        g.visivel
          ? Promise.resolve(
              servico.resultadosDaPesquisa(detalhe.id, {
                campo,
                grupoId: g.id,
              }),
            ).catch(() => null)
          : Promise.resolve(null),
      ),
    ).then((resultados) => {
      if (vivo)
        setGrupos(lista.map((g, i) => grupoDoModelo(g, resultados[i]!, geral)));
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

  if (nr1 && aba === "conformidade") {
    return (
      <ConformidadeNr1
        acompanhamento={acompanhamento}
        podeEditar={podeEditar}
        onVerResultados={() => onTrocarAba?.("geral")}
        onVerPlano={() => onTrocarAba?.("plano")}
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
        />
      );
    if (aba === "analises")
      return <PorGrupoNr1 resultado={r} campo={campo} onCampo={setCampo} />;
    return (
      <VisaoGeralNr1
        resultado={r}
        acompanhamento={acompanhamento.gravado}
        detalhe={detalhe}
        {...(onTrocarAba ? { onIrPara: onTrocarAba } : {})}
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
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly servicoDosModelos?: ServicoDosModelos;
}) {
  const acompanhamento = useAcompanhamentoNr1(servicoDosModelos, detalhe.id);
  return (
    <VisaoGeralNr1
      resultado={painelDe(detalhe, geral)}
      acompanhamento={acompanhamento.gravado}
      detalhe={detalhe}
    />
  );
}
