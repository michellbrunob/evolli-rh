/**
 * T216 — pré-visualização (`#/pesquisas/<id>/previa`, aberta em outra aba):
 * a experiência real de quem responde — abertura, identificação e uma
 * pergunta por tela — com a pesquisa carregada pela sessão do RH. Uma faixa
 * fixa avisa que é o modo de pré-visualização e que nada é gravado; ao
 * abrir, uma janela explica isso. O "cliente" da página pública é trocado
 * por um que só devolve a pesquisa: identificar e enviar não vão ao
 * servidor.
 */
import { useEffect, useMemo, useState } from "react";
import type {
  ClientePesquisaPublica,
  PesquisaPublica,
} from "../../api/pesquisaPublicaClient";
import type { PesquisaDetalhe } from "../../api/pesquisasClient";
import { Button } from "../../components";
import { Dialog } from "../../ui";
import { Esqueleto } from "../../ui/movimento";
import { ResponderPesquisa } from "../publico/ResponderPesquisa";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import { CAMPOS_DE_GRUPO } from "./SepararRespostasPor";
import type { GruposDaEmpresa, ServicoDePesquisas } from "./servicoDePesquisas";
import { minutosEstimados } from "./tempoEstimado";

/** A pesquisa como a página pública a recebe. */
export function pesquisaPublicaDaPrevia(
  d: PesquisaDetalhe,
  empresa: string,
  grupos: GruposDaEmpresa | null,
): PesquisaPublica {
  const total = perguntasEmOrdem(d.secoes).length;
  return {
    empresa,
    nome: d.nome,
    boasVindas: d.boasVindas,
    identificacao: d.identificacao,
    totalPerguntas: total,
    minutosEstimados: minutosEstimados(total),
    secoes: d.secoes as PesquisaPublica["secoes"],
    ...(d.identificacao === "anonima" && (d.separarPor ?? []).length > 0
      ? {
          grupos: (d.separarPor ?? []).map((campo) => ({
            campo,
            rotulo:
              CAMPOS_DE_GRUPO.find((c) => c.campo === campo)?.rotulo ?? campo,
            opcoes: grupos?.[campo] ?? [],
          })),
        }
      : {}),
  };
}

/** Cliente que nunca grava: identificar e enviar só fingem dar certo. */
export function clienteDaPrevia(
  pesquisa: PesquisaPublica,
): ClientePesquisaPublica {
  return {
    abrir: () => Promise.resolve(pesquisa),
    identificar: () =>
      Promise.resolve({ passe: "previa", primeiroNome: "Pré-visualização" }),
    enviarRespostas: () => Promise.resolve(),
  };
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
  const [explicacao, setExplicacao] = useState(true);

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

  const cliente = useMemo(
    () => (pesquisa ? clienteDaPrevia(pesquisa) : null),
    [pesquisa],
  );

  return (
    <div className="pesquisas__previa-tela">
      <p className="pesquisas__previa-faixa" role="status">
        Modo pré-visualização — nada do que for respondido aqui é gravado.
      </p>
      {falhou ? (
        <p className="pesquisas__erro" role="alert">
          Não foi possível carregar a pesquisa para a pré-visualização.
        </p>
      ) : !cliente ? (
        <Esqueleto rotulo="Carregando a pré-visualização…" linhas={4} />
      ) : (
        <ResponderPesquisa token={`previa-${pesquisaId}`} cliente={cliente} />
      )}
      <Dialog
        aberto={explicacao && cliente !== null}
        titulo="Você está na pré-visualização"
        onFechar={() => setExplicacao(false)}
        rodape={<Button onClick={() => setExplicacao(false)}>Entendi</Button>}
      >
        <p>
          É exatamente o que quem responde vai ver, uma pergunta por vez. Pode
          responder à vontade: nada é gravado e a pesquisa não muda.
        </p>
      </Dialog>
    </div>
  );
}
