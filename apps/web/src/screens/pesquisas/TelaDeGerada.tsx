/**
 * T216 — o fim dos assistentes: cartão centrado com o visto, "Pesquisa
 * criada e ativa", o link (copiar e abrir em outra aba), as próximas ações
 * e "Concluir". Também o campo do link, usado nos resultados.
 */
import { useEffect, useState } from "react";
import type { PesquisaDetalhe } from "../../api/pesquisasClient";
import { Button } from "../../components";
import {
  IconeAvancar,
  IconeEditar,
  IconeModelo,
  IconeNovaAba,
  IconeStatus,
  IconeSucesso,
} from "../../ui/icones";
import { AvisoNaoIdentificaveis } from "./AvisoNaoIdentificaveis";
import { copiarLink, enderecoDoLink } from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";

export function CampoDoLink({
  link,
  principal = false,
}: {
  readonly link: string;
  /** "Copiar link" como ação principal (tela final). */
  readonly principal?: boolean;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const endereco = enderecoDoLink(link);
  return (
    <div className="pesquisas__etapa">
      <div className="pesquisas__link">
        <input
          className="pesquisas__campo"
          readOnly
          aria-label="Link da pesquisa"
          value={endereco}
          onFocus={(e) => e.target.select()}
        />
        <Button
          variant={principal ? "primary" : "secondary"}
          onClick={async () =>
            setAviso(
              (await copiarLink(link))
                ? "Link copiado."
                : "Não foi possível copiar. Selecione o endereço e copie.",
            )
          }
        >
          Copiar link
        </Button>
        {/* Sempre em outra aba: a página pública não divide a aba com o painel. */}
        <a
          className="evolli-button evolli-button--secondary"
          href={endereco}
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconeNovaAba tamanho={16} />
          Abrir
          <span className="pesquisas__so-leitor"> (em outra aba)</span>
        </a>
      </div>
      {aviso ? (
        <p className="pesquisas__aviso" role="status">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}

export function TelaDeGerada({
  pesquisa,
  onVerResultados,
  onEditar,
  onConcluir,
  comCabecalhoDaPagina = false,
}: {
  readonly pesquisa: PesquisaDetalhe;
  /** O cabeçalho do assistente continua acima: o título vira h2. */
  readonly comCabecalhoDaPagina?: boolean;
  readonly onVerResultados: (id: string) => void;
  readonly onEditar: (pesquisa: PesquisaDetalhe) => void;
  readonly onConcluir: () => void;
}) {
  const idDoTitulo = comCabecalhoDaPagina
    ? "pesquisa-criada-titulo"
    : PESQUISAS_TITULO_ID;
  useEffect(() => {
    document.getElementById(idDoTitulo)?.focus();
  }, [idDoTitulo]);
  const Titulo = comCabecalhoDaPagina ? "h2" : "h1";
  const anonima = pesquisa.identificacao === "anonima";
  const quantos =
    pesquisa.participantes ?? pesquisa.participantesLista?.length ?? 0;
  const acoes = [
    {
      titulo: "Acompanhar respostas",
      texto: anonima ? "Veja as respostas chegando" : "Veja quem já respondeu",
      icone: <IconeStatus tamanho={18} />,
      onClick: () => onVerResultados(pesquisa.id),
    },
    {
      titulo: "Editar pesquisa",
      texto: anonima ? "Nome, perguntas e prazo" : "Perguntas e participantes",
      icone: <IconeEditar tamanho={18} />,
      onClick: () => onEditar(pesquisa),
    },
    {
      titulo: "Ver todas as pesquisas",
      texto: "Voltar para a lista",
      icone: <IconeModelo tamanho={18} />,
      onClick: onConcluir,
    },
  ];
  return (
    <section className="pesquisas__final-cartao" aria-labelledby={idDoTitulo}>
      <span className="pesquisas__final-icone" aria-hidden="true">
        <IconeSucesso tamanho={32} />
      </span>
      <Titulo id={idDoTitulo} className="pesquisas__final-titulo" tabIndex={-1}>
        Pesquisa criada e ativa
      </Titulo>
      <p className="pesquisas__suave">
        {anonima
          ? "Compartilhe o link: quem tiver o link pode responder."
          : quantos === 1
            ? "Compartilhe o link com a pessoa selecionada."
            : `Compartilhe o link com as ${quantos} pessoas selecionadas.`}
      </p>
      <div className="pesquisas__final-link">
        <p className="pesquisas__grupo-titulo">
          <span>Link da pesquisa</span>
          <span className="pesquisas__selo pesquisas__selo--sucesso">
            <span className="pesquisas__ponto" aria-hidden="true" />
            Ativa
          </span>
        </p>
        {pesquisa.link ? (
          <CampoDoLink link={pesquisa.link} principal />
        ) : (
          <p className="pesquisas__suave">
            O link ainda não chegou. Abra a pesquisa na lista para copiá-lo.
          </p>
        )}
      </div>
      <AvisoNaoIdentificaveis
        identificacao={pesquisa.identificacao}
        naoIdentificaveis={pesquisa.naoIdentificaveis}
        participantes={pesquisa.participantesLista ?? []}
        publicada
      />
      <ul className="pesquisas__proximas" aria-label="Próximas ações">
        {acoes.map((a) => (
          <li key={a.titulo}>
            <button type="button" onClick={a.onClick}>
              <span className="pesquisas__proximas-icone" aria-hidden="true">
                {a.icone}
              </span>
              <span className="pesquisas__proximas-textos">
                <strong>{a.titulo}</strong>
                <span className="pesquisas__suave">{a.texto}</span>
              </span>
              <IconeAvancar tamanho={16} />
            </button>
          </li>
        ))}
      </ul>
      <div className="pesquisas__final-acoes">
        <Button onClick={onConcluir}>Concluir</Button>
      </div>
    </section>
  );
}
