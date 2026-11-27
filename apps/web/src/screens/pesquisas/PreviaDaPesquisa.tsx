/**
 * T216 — pré-visualização (`#/pesquisas/<id>/previa`, aberta em outra aba):
 * carrega a pesquisa pela sessão do RH e entrega à página pública no modo
 * prévia — a experiência real de quem responde (abertura, identificação
 * simulada, perguntas e agradecimento), com a faixa e a janela que avisam
 * que nada é gravado. Nenhuma chamada da página pública vai ao servidor.
 */
import { useEffect, useState } from "react";
import type { PesquisaPublica } from "../../api/pesquisaPublicaClient";
import type { PesquisaDetalhe } from "../../api/pesquisasClient";
import { Esqueleto } from "../../ui/movimento";
import {
  ResponderPesquisa,
  montarPreviaPublica,
} from "../publico/ResponderPesquisa";
import { CAMPOS_DE_GRUPO } from "./SepararRespostasPor";
import type { GruposDaEmpresa, ServicoDePesquisas } from "./servicoDePesquisas";

/** A pesquisa como a página pública a recebe. */
export function pesquisaPublicaDaPrevia(
  d: PesquisaDetalhe,
  empresa: string,
  grupos: GruposDaEmpresa | null,
): PesquisaPublica {
  const separar = d.identificacao === "anonima" ? (d.separarPor ?? []) : [];
  return montarPreviaPublica({
    empresa,
    nome: d.nome,
    boasVindas: d.boasVindas,
    identificacao: d.identificacao,
    modelo: d.modelo,
    secoes: d.secoes as PesquisaPublica["secoes"],
    ...(separar.length > 0
      ? {
          grupos: separar.map((campo) => ({
            campo,
            rotulo:
              CAMPOS_DE_GRUPO.find((c) => c.campo === campo)?.rotulo ?? campo,
            opcoes: grupos?.[campo] ?? [],
          })),
        }
      : {}),
  });
}

export function PreviaDaPesquisa({
  servico,
  pesquisaId,
}: {
  readonly servico: ServicoDePesquisas;
  readonly pesquisaId: string;
}) {
  const [pesquisa, setPesquisa] = useState<PesquisaPublica | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      Promise.resolve(servico.obterPesquisa(pesquisaId)),
      Promise.resolve(servico.empresaAtiva()).catch(() => null),
      Promise.resolve(servico.listarGrupos()).catch(() => null),
    ])
      .then(([d, empresa, grupos]) => {
        if (vivo)
          setPesquisa(pesquisaPublicaDaPrevia(d, empresa?.nome ?? "", grupos));
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId]);

  if (falhou)
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível carregar a pesquisa para a pré-visualização.
      </p>
    );
  if (!pesquisa)
    return <Esqueleto rotulo="Carregando a pré-visualização…" linhas={4} />;
  return (
    <div className="pesquisas__previa-tela">
      <ResponderPesquisa
        previa={pesquisa}
        aoSairDaPrevia={() => window.close()}
      />
    </div>
  );
}
