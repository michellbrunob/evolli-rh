/**
 * T216 — o ponto de registro das telas dos modelos com metodologia própria.
 * Os resultados (`ResultadosDaPesquisa`), o resultado individual, a
 * exportação e o relatório consultam aqui o que é próprio de cada modelo:
 * as abas, o painel de cada aba, a planilha e o documento imprimível.
 */
import { useEffect, useState } from "react";
import type {
  CampoGrupo,
  ModeloPesquisa,
  PesquisaDetalhe,
} from "../../../api/pesquisasClient";
import {
  SERVICO_DOS_MODELOS,
  type IndividualDoModelo,
  type ServicoDosModelos,
} from "../../../api/modelosDePesquisaClient";
import { Esqueleto } from "../../../ui/movimento";
import {
  ConformidadeNr1,
  PlanoDeAcaoNr1,
  useAcompanhamentoNr1,
} from "./copsoq/AcompanhamentoNr1";
import { IndividualNr1Tela } from "./copsoq/IndividualNr1";
import { PorGrupoNr1, VisaoGeralNr1 } from "./copsoq/VisaoGeralNr1";
import {
  AnalisesIsfb,
  IndividualIsfb,
  VisaoGeralIsfb,
} from "./isfb/VisaoGeralIsfb";
import {
  EstadoDoCarregamento,
  PoucasRespostasDoModelo,
  useResultadoDoModelo,
} from "./ui";

/** As abas dos resultados (as genéricas mais as próprias da NR-1). */
export type AbaDoModelo =
  "geral" | "analises" | "plano" | "conformidade" | "respostas";

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

/** O primeiro recorte (anônima: o primeiro campo de "Separar respostas por"). */
export function primeiroRecorte(d: PesquisaDetalhe): CampoGrupo | null {
  return d.identificacao === "anonima"
    ? (d.separarPor?.[0] ?? null)
    : "departamento";
}

export const temTelasProprias = (modelo: ModeloPesquisa): boolean =>
  ABAS_DO_MODELO[modelo] !== undefined;

export function PainelDoModelo({
  detalhe,
  aba,
  podeEditar,
  servico = SERVICO_DOS_MODELOS,
  onTrocarAba,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly aba: AbaDoModelo;
  readonly podeEditar: boolean;
  readonly servico?: ServicoDosModelos;
  readonly onTrocarAba?: (aba: AbaDoModelo) => void;
}) {
  return detalhe.modelo === "copsoq" ? (
    <PainelNr1
      detalhe={detalhe}
      aba={aba}
      podeEditar={podeEditar}
      servico={servico}
      {...(onTrocarAba ? { onTrocarAba } : {})}
    />
  ) : (
    <PainelIsfb detalhe={detalhe} aba={aba} servico={servico} />
  );
}

function PainelNr1({
  detalhe,
  aba,
  podeEditar,
  servico,
  onTrocarAba,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly aba: AbaDoModelo;
  readonly podeEditar: boolean;
  readonly servico: ServicoDosModelos;
  readonly onTrocarAba?: (aba: AbaDoModelo) => void;
}) {
  const [campo, setCampo] = useState<CampoGrupo | null>(() =>
    primeiroRecorte(detalhe),
  );
  const comCampo = aba === "analises";
  const res = useResultadoDoModelo(
    servico,
    detalhe.id,
    comCampo ? campo : null,
  );
  const acompanhamento = useAcompanhamentoNr1(servico, detalhe.id);

  if (aba === "conformidade") {
    return (
      <ConformidadeNr1
        acompanhamento={acompanhamento}
        podeEditar={podeEditar}
        onVerResultados={() => onTrocarAba?.("geral")}
        onVerPlano={() => onTrocarAba?.("plano")}
      />
    );
  }
  if (res.fase !== "pronto") {
    return <EstadoDoCarregamento fase={res.fase} onTentar={res.tentarDeNovo} />;
  }
  const r = res.dados;
  if (!r.visivel || !r.nr1) {
    return (
      <PoucasRespostasDoModelo detalhe={detalhe} minimo={r.minimoPorGrupo} />
    );
  }
  if (aba === "plano") {
    return (
      <PlanoDeAcaoNr1
        r={r.nr1}
        acompanhamento={acompanhamento}
        podeEditar={podeEditar}
      />
    );
  }
  if (aba === "analises") {
    return <PorGrupoNr1 resultado={r} campo={campo} onCampo={setCampo} />;
  }
  return (
    <VisaoGeralNr1
      resultado={r}
      acompanhamento={acompanhamento.gravado}
      detalhe={detalhe}
      {...(onTrocarAba ? { onIrPara: onTrocarAba } : {})}
    />
  );
}

function PainelIsfb({
  detalhe,
  aba,
  servico,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly aba: AbaDoModelo;
  readonly servico: ServicoDosModelos;
}) {
  const [campo, setCampo] = useState<CampoGrupo | null>(() =>
    primeiroRecorte(detalhe),
  );
  const comCampo = aba === "analises";
  const res = useResultadoDoModelo(
    servico,
    detalhe.id,
    comCampo ? campo : null,
  );
  if (res.fase !== "pronto") {
    return <EstadoDoCarregamento fase={res.fase} onTentar={res.tentarDeNovo} />;
  }
  const r = res.dados;
  if (!r.visivel || !r.isfb) {
    return (
      <PoucasRespostasDoModelo detalhe={detalhe} minimo={r.minimoPorGrupo} />
    );
  }
  return aba === "analises" ? (
    <AnalisesIsfb resultado={r} campo={campo} onCampo={setCampo} />
  ) : (
    <VisaoGeralIsfb resultado={r} />
  );
}

/** O resultado próprio do modelo numa resposta (resultado individual). */
export function IndividualDoModeloTela({
  pesquisaId,
  respostaId,
  servico = SERVICO_DOS_MODELOS,
}: {
  readonly pesquisaId: string;
  readonly respostaId: string;
  readonly servico?: ServicoDosModelos;
}) {
  const [dados, setDados] = useState<IndividualDoModelo | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    setDados(null);
    Promise.resolve(servico.individualDoModelo(pesquisaId, respostaId))
      .then((d) => {
        if (vivo) setDados(d);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId, respostaId]);
  if (falhou)
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível calcular o resultado desta resposta.
      </p>
    );
  if (!dados) return <Esqueleto rotulo="Calculando o resultado…" linhas={3} />;
  if (dados.nr1) return <IndividualNr1Tela p={dados.nr1} />;
  if (dados.isfb) return <IndividualIsfb p={dados.isfb} />;
  return (
    <p className="pesquisas__suave">
      Esta resposta não tem as perguntas que formam a nota.
    </p>
  );
}
