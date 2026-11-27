/**
 * T216 — ficha › aba Pesquisas: "Pesquisas respondidas". Só as pesquisas
 * identificadas que a pessoa respondeu (nome, modelo e data); ao abrir uma,
 * as respostas dela. Confidenciais e anônimas nunca aparecem: a resposta
 * delas não fica ligada à pessoa. Leitura de RH e DP (auditada no servidor).
 */
import { useEffect, useState } from "react";
import {
  pesquisasDoColaborador,
  type PesquisaDaFicha,
} from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import { IconePesquisas } from "../../../../ui/icones";
import { Esqueleto } from "../../../../ui/movimento";
import { RespostasDaPessoa } from "../../../pesquisas/RespostasDaPessoa";
import {
  ROTULO_DO_MODELO,
  dataDoInstante,
} from "../../../pesquisas/textosDasPesquisas";
import "../../../pesquisas/Pesquisas.css";

export type CarregarPesquisasDaFicha = (
  colaboradorId: string,
) => Promise<PesquisaDaFicha[]>;

type Falha = "sem-acesso" | "erro";

export function AbaPesquisas({
  colaboradorId,
  primeiroNome,
  carregar = pesquisasDoColaborador,
}: {
  readonly colaboradorId: string;
  readonly primeiroNome: string;
  readonly carregar?: CarregarPesquisasDaFicha;
}) {
  const [dados, setDados] = useState<PesquisaDaFicha[] | null>(null);
  const [falha, setFalha] = useState<Falha | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setDados(null);
    setFalha(null);
    Promise.resolve(carregar(colaboradorId))
      .then((d) => {
        if (vivo) setDados(d ?? []);
      })
      .catch((erro: unknown) => {
        if (!vivo) return;
        const status = (erro as { status?: unknown } | null)?.status;
        setFalha(status === 403 ? "sem-acesso" : "erro");
      });
    return () => {
      vivo = false;
    };
  }, [carregar, colaboradorId]);

  if (falha === "sem-acesso") {
    return (
      <p className="pesquisas__nota" role="status">
        As respostas de pesquisas ficam visíveis só para o RH e o DP.
      </p>
    );
  }
  if (falha === "erro") {
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível carregar as pesquisas.
      </p>
    );
  }
  if (!dados) return <Esqueleto rotulo="Carregando pesquisas…" linhas={3} />;

  return (
    <section
      className="pesquisas__ficha"
      aria-labelledby="ficha-pesquisas-titulo"
    >
      <header className="pesquisas__ficha-cabecalho">
        <h2 id="ficha-pesquisas-titulo" className="pesquisas__ficha-titulo">
          Pesquisas respondidas
        </h2>
        {dados.length > 0 ? (
          <p className="pesquisas__suave">
            {plural(
              dados.length,
              "pesquisa identificada",
              "pesquisas identificadas",
            )}
          </p>
        ) : null}
      </header>
      {dados.length === 0 ? (
        <div className="pesquisas__aba-vazia">
          <span className="pesquisas__vazio-icone" aria-hidden="true">
            <IconePesquisas tamanho={24} />
          </span>
          <strong>Nenhuma pesquisa respondida</strong>
          <p className="pesquisas__suave">
            {`Aparecem aqui só as pesquisas identificadas que ${primeiroNome} respondeu. Respostas de pesquisas confidenciais e anônimas nunca ficam ligadas à pessoa.`}
          </p>
        </div>
      ) : (
        <ul className="pesquisas__ficha-lista">
          {dados.map((p) => {
            const abertaAgora = aberta === p.pesquisaId;
            return (
              <li key={p.pesquisaId} className="pesquisas__ficha-item">
                <button
                  type="button"
                  className="pesquisas__ficha-botao"
                  aria-expanded={abertaAgora}
                  onClick={() => setAberta(abertaAgora ? null : p.pesquisaId)}
                >
                  <span className="pesquisas__forte">{p.nome}</span>
                  <span className="pesquisas__suave">
                    {`${ROTULO_DO_MODELO[p.modelo]} · respondida em ${dataDoInstante(p.respondidaEm)}`}
                  </span>
                </button>
                {abertaAgora ? (
                  <RespostasDaPessoa
                    rotulo={`Respostas de ${p.nome}`}
                    secoes={p.secoes}
                    valores={p.valores}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
