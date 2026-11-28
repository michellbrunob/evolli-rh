/**
 * T216 — Perfil comportamental (DISC): o perfil individual de uma resposta
 * (identificada: com o nome; anônima: numerada). Anterior e próxima seguem
 * a lista de respostas; "Exportar PDF" abre o relatório individual.
 */
import { useEffect, useState } from "react";
import type { PesquisaDetalhe } from "../../../../api/pesquisasClient";
import { Button } from "../../../../components";
import { formatarInstante } from "../../../../format/data";
import { IconButton } from "../../../../ui";
import {
  IconeAvancar,
  IconeBaixarArquivo,
  IconeVoltar,
} from "../../../../ui/icones";
import { Esqueleto } from "../../../../ui/movimento";
import { Avatar, iniciaisDe } from "../../componentes";
import { enderecoDaRota } from "../../rotasDePesquisas";
import { PESQUISAS_TITULO_ID } from "../../tituloDasPesquisas";
import { PerfilDaPessoa } from "./PerfilDaPessoa";
import { nomeDaPessoa } from "./ResultadosDisc";
import {
  perfilComportamental,
  type CarregarPerfil,
  type ResultadoDisc,
} from "./tiposDisc";

export function ResultadoIndividualDisc({
  pesquisa,
  respostaId,
  carregar = perfilComportamental,
  onVoltar,
  onIr,
}: {
  readonly pesquisa: PesquisaDetalhe;
  readonly respostaId: string;
  readonly carregar?: CarregarPerfil;
  readonly onVoltar: () => void;
  readonly onIr?: ((respostaId: string) => void) | undefined;
}) {
  const [dados, setDados] = useState<ResultadoDisc | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(carregar(pesquisa.id))
      .then((r) => {
        if (vivo) setDados(r);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [carregar, pesquisa.id]);

  if (falhou)
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível carregar o perfil.
      </p>
    );
  if (!dados) return <Esqueleto rotulo="Carregando o perfil…" linhas={5} />;

  // A mesma ordem da lista: da mais recente para a mais antiga.
  const lista = [...dados.pessoas].reverse();
  const i = lista.findIndex((p) => p.respostaId === respostaId);
  const pessoa = lista[i];
  if (!pessoa)
    return (
      <p className="pesquisas__erro" role="alert">
        Esta resposta não tem perfil para mostrar.
      </p>
    );
  const anterior = lista[i - 1];
  const proxima = lista[i + 1];
  const nome = nomeDaPessoa(pessoa);
  return (
    <div className="pesquisas">
      <header className="pesquisas__cabecalho">
        <IconButton
          label="Voltar para os resultados"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <Avatar
          texto={pessoa.nome ? iniciaisDe(pessoa.nome) : `R${pessoa.numero}`}
        />
        <div className="pesquisas__titulos">
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            {nome}
          </h1>
          <p className="pesquisas__subtitulo">
            {`${pesquisa.nome} · respondeu em ${formatarInstante(pessoa.respondidaEm)}`}
          </p>
        </div>
        <div className="pesquisas__acoes-topo">
          <Button
            variant="secondary"
            onClick={() =>
              window.open(
                enderecoDaRota({
                  tela: "relatorioDaResposta",
                  id: pesquisa.id,
                  respostaId,
                }),
                "_blank",
                "noopener",
              )
            }
          >
            <IconeBaixarArquivo tamanho={16} />
            Exportar PDF
          </Button>
          {onIr ? (
            <span className="pesquisas__paginacao">
              <IconButton
                label="Resposta anterior"
                icon={<IconeVoltar tamanho={16} />}
                disabled={!anterior}
                onClick={() => anterior && onIr(anterior.respostaId)}
              />
              <span>{`${i + 1} de ${lista.length}`}</span>
              <IconButton
                label="Próxima resposta"
                icon={<IconeAvancar tamanho={16} />}
                disabled={!proxima}
                onClick={() => proxima && onIr(proxima.respostaId)}
              />
            </span>
          ) : null}
        </div>
      </header>
      <PerfilDaPessoa perfil={pessoa.perfil} />
    </div>
  );
}
