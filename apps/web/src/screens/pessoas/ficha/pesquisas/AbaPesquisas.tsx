/**
 * T216 — ficha › aba Pesquisas: um cartão "Pesquisas respondidas" com as
 * pesquisas identificadas que a pessoa respondeu (nome, modelo e data). Ao
 * abrir uma, o resultado individual da pessoa (o mesmo dos resultados da
 * pesquisa). Confidenciais e anônimas nunca aparecem: a resposta delas não
 * fica ligada à pessoa. Leitura de RH e DP (auditada no servidor).
 */
import { useEffect, useState } from "react";
import {
  pesquisasDoColaborador,
  respostaDaPesquisa,
  type PesquisaDaFicha,
  type RespostaDetalhe,
} from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import { IconeAvancar, IconePesquisas } from "../../../../ui/icones";
import { Esqueleto } from "../../../../ui/movimento";
import { IconeDoModelo } from "../../../pesquisas/componentes";
import { RespostasDaPessoa } from "../../../pesquisas/RespostasDaPessoa";
import { PaginaDaResposta } from "../../../pesquisas/ResultadoIndividual";
import {
  ROTULO_DO_MODELO,
  dataDoInstante,
} from "../../../pesquisas/textosDasPesquisas";
import "../../../pesquisas/Pesquisas.css";

export type CarregarPesquisasDaFicha = (
  colaboradorId: string,
) => Promise<PesquisaDaFicha[]>;

export type CarregarRespostaDaFicha = (
  pesquisaId: string,
  respostaId: string,
) => Promise<RespostaDetalhe>;

type Falha = "sem-acesso" | "erro";

export function AbaPesquisas({
  colaboradorId,
  primeiroNome,
  carregar = pesquisasDoColaborador,
  carregarResposta = respostaDaPesquisa,
}: {
  readonly colaboradorId: string;
  readonly primeiroNome: string;
  readonly carregar?: CarregarPesquisasDaFicha;
  readonly carregarResposta?: CarregarRespostaDaFicha;
}) {
  const [dados, setDados] = useState<PesquisaDaFicha[] | null>(null);
  const [falha, setFalha] = useState<Falha | null>(null);
  const [aberta, setAberta] = useState<PesquisaDaFicha | null>(null);

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

  if (aberta) {
    const voltar = () => setAberta(null);
    return aberta.respostaId ? (
      <PaginaDaResposta
        nomeDaPesquisa={aberta.nome}
        identificacao="identificada"
        secoes={aberta.secoes}
        respostaId={aberta.respostaId}
        carregar={(id) => carregarResposta(aberta.pesquisaId, id)}
        pesquisaIdDoPdf={aberta.pesquisaId}
        rotuloVoltar="Voltar para as pesquisas respondidas"
        onVoltar={voltar}
      />
    ) : (
      <section className="pesquisas__cartao-secao" aria-label={aberta.nome}>
        <header className="pesquisas__cartao-secao-cabeca">
          <h2 className="pesquisas__cartao-secao-titulo">{aberta.nome}</h2>
          <button
            type="button"
            className="pesquisas__acao-texto"
            onClick={voltar}
          >
            Voltar para as pesquisas respondidas
          </button>
        </header>
        <RespostasDaPessoa
          rotulo={`Respostas de ${aberta.nome}`}
          secoes={aberta.secoes}
          valores={aberta.valores}
        />
      </section>
    );
  }

  return (
    <section
      className="pesquisas__cartao-secao"
      aria-labelledby="ficha-pesquisas-titulo"
    >
      <header className="pesquisas__cartao-secao-cabeca pesquisas__ficha-cabeca">
        <span
          className="pesquisas__icone-modelo pesquisas__icone-modelo--md"
          aria-hidden="true"
        >
          <IconePesquisas tamanho={18} />
        </span>
        <div>
          <h2
            id="ficha-pesquisas-titulo"
            className="pesquisas__cartao-secao-titulo"
          >
            Pesquisas respondidas
          </h2>
          <p className="pesquisas__suave">
            {dados.length === 0
              ? "Nenhuma pesquisa respondida até agora"
              : plural(
                  dados.length,
                  "pesquisa identificada",
                  "pesquisas identificadas",
                )}
          </p>
        </div>
      </header>
      {dados.length === 0 ? (
        <div className="pesquisas__aba-vazia pesquisas__aba-vazia--sem-borda">
          <span className="pesquisas__vazio-circulo" aria-hidden="true">
            <IconePesquisas tamanho={22} />
          </span>
          <strong>Nenhuma pesquisa respondida</strong>
          <p className="pesquisas__suave">
            {`Aparecem aqui só as pesquisas identificadas que ${primeiroNome} respondeu. Respostas de pesquisas confidenciais e anônimas nunca ficam ligadas à pessoa.`}
          </p>
        </div>
      ) : (
        <ul className="pesquisas__ficha-lista">
          {dados.map((p) => (
            <li key={p.pesquisaId} className="pesquisas__ficha-item">
              <button
                type="button"
                className="pesquisas__ficha-botao"
                onClick={() => setAberta(p)}
              >
                <IconeDoModelo id={p.modelo} tamanho="sm" />
                <span className="pesquisas__pessoa-textos">
                  <span className="pesquisas__forte">{p.nome}</span>
                  <span className="pesquisas__suave">
                    {`${ROTULO_DO_MODELO[p.modelo]} · respondida em ${dataDoInstante(p.respondidaEm)}`}
                  </span>
                </span>
                <IconeAvancar tamanho={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
