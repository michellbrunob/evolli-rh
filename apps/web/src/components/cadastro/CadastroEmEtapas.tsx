/**
 * T209 — padrão de todo formulário de cadastro em etapas (decisão da
 * proprietária de 2026-11-17), extraído da moldura do Novo colaborador:
 *
 * - cabeçalho da página: voltar, título, descrição e uma ação opcional;
 * - etapas à esquerda (no desktop), cada uma com número, nome e subtítulo;
 *   só as já alcançadas são botões;
 * - a etapa atual: título, descrição e o selo "Etapa N de M", com fade na
 *   troca (sem animação para quem pede menos movimento);
 * - conteúdo por seções (`SecaoDoCadastro`) e linhas (`LinhaDoCadastro`):
 *   rótulo e ajuda à esquerda, campos à direita, divisor fino entre linhas;
 * - rodapé fixo: a barra de progresso com "% concluído" e as ações.
 *
 * Quem usa decide a validação: ir adiante passa pelo `onSubmit` do
 * formulário (Enter num campo ou o botão principal).
 */
import { useId, type FormEvent, type ReactNode } from "react";
import { IconeAvancar, IconeVoltar } from "../../ui/icones";
import { Button } from "../Button";
import { PageHeader } from "../PageHeader";
import { IconButton } from "../../ui";
import "./CadastroEmEtapas.css";

export interface EtapaDoCadastro {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly descricao: ReactNode;
}

type EstadoDaEtapa = "atual" | "concluida" | "visitada" | "pendente";

const ROTULO_DO_ESTADO: Readonly<Record<EstadoDaEtapa, string>> = {
  atual: "etapa atual",
  concluida: "concluída",
  visitada: "visitada",
  pendente: "não iniciada",
};

export interface CadastroEmEtapasProps {
  /** Id do título da página (o shell foca por ele). */
  readonly tituloId: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly rotuloVoltar: string;
  readonly onVoltarDaPagina: () => void;
  readonly acaoDoCabecalho?: ReactNode;
  /** T216 — ícone ao lado do título (ex.: o do modelo da pesquisa). */
  readonly iconeDoCabecalho?: ReactNode;
  readonly etapas: readonly EtapaDoCadastro[];
  /** Índice da etapa atual. */
  readonly atual: number;
  /** Maior etapa já alcançada (as anteriores ficam navegáveis). */
  readonly alcancada: number;
  readonly onIrParaEtapa: (indice: number) => void;
  /** Avançar ou concluir (o envio do formulário). */
  readonly onSubmit: (evento: FormEvent<HTMLFormElement>) => void;
  /** Rótulo do botão principal na última etapa. */
  readonly rotuloConcluir: string;
  /** Enviando: botões travados. */
  readonly ocupado?: boolean;
  /** Mensagem geral (falha de envio), acima do rodapé. */
  readonly mensagem?: ReactNode;
  /** Título da etapa atual, quando ele depende do que foi digitado. */
  readonly tituloDaEtapa?: string;
  /**
   * Um painel por etapa, TODOS montados (só o atual visível): nada do que foi
   * digitado sai do documento. Sem `paineis`, `children` é o conteúdo da
   * etapa atual.
   */
  readonly paineis?: readonly ReactNode[];
  /** Id do título de cada etapa (para quem move o foco até ele). */
  readonly idDoTituloDaEtapa?: (indice: number) => string;
  /** Entre o cabeçalho da página e o formulário (ex.: o aviso do rascunho). */
  readonly aposCabecalho?: ReactNode;
  /** No topo da coluna do conteúdo, antes da etapa (ex.: a empresa ativa). */
  readonly antesDoConteudo?: ReactNode;
  /** Classe a mais na raiz (estilos próprios da tela). */
  readonly className?: string;
  /** Nome acessível do formulário. */
  readonly rotuloDoFormulario?: string;
  /** Id do botão principal (quem move o foco até ele). */
  readonly idBotaoPrincipal?: string;
  /** Trava só o botão principal (ex.: dados ainda carregando). */
  readonly principalDesabilitado?: boolean;
  /**
   * T216 — no lugar da barra de progresso, um resumo da etapa ao lado do
   * botão principal ("3 perguntas · 2 obrigatórias"); `null` só tira a barra.
   * Sem a prop, a barra de "% concluído" continua.
   */
  readonly resumoDoRodape?: ReactNode;
  /** T216 — o rótulo do botão de avançar ("Próximo: Participantes"). */
  readonly rotuloDoProximo?: string;
  readonly children?: ReactNode;
}

export function CadastroEmEtapas({
  tituloId,
  titulo,
  descricao,
  rotuloVoltar,
  onVoltarDaPagina,
  acaoDoCabecalho,
  iconeDoCabecalho,
  etapas,
  atual,
  alcancada,
  onIrParaEtapa,
  onSubmit,
  rotuloConcluir,
  ocupado = false,
  mensagem,
  tituloDaEtapa,
  paineis,
  idDoTituloDaEtapa,
  aposCabecalho,
  antesDoConteudo,
  className,
  rotuloDoFormulario,
  idBotaoPrincipal,
  principalDesabilitado = false,
  resumoDoRodape,
  rotuloDoProximo,
  children,
}: CadastroEmEtapasProps) {
  const base = useId();
  const idDoTitulo = (indice: number) =>
    idDoTituloDaEtapa ? idDoTituloDaEtapa(indice) : `${base}-etapa-${indice}`;
  const idProgresso = `${base}-progresso`;
  const ultima = atual === etapas.length - 1;

  /** Título, descrição e o selo "Etapa N de M" de uma etapa. */
  function cabecalhoDaEtapa(indice: number) {
    const etapa = etapas[indice]!;
    return (
      <header className="cadastro-etapas__etapa-cabecalho">
        <div className="cadastro-etapas__etapa-textos">
          <h2
            id={idDoTitulo(indice)}
            className="cadastro-etapas__etapa-titulo"
            tabIndex={-1}
          >
            <span className="cadastro-etapas__so-leitor">
              Etapa {indice + 1} de {etapas.length}:{" "}
            </span>
            {indice === atual && tituloDaEtapa ? tituloDaEtapa : etapa.titulo}
          </h2>
          <p className="cadastro-etapas__etapa-descricao">{etapa.descricao}</p>
        </div>
        <span className="cadastro-etapas__etapa-selo" aria-hidden="true">
          Etapa {indice + 1} de {etapas.length}
        </span>
      </header>
    );
  }
  const progresso = Math.round(((atual + 1) / etapas.length) * 100);

  return (
    <div
      className={className ? `cadastro-etapas ${className}` : "cadastro-etapas"}
    >
      <header className="cadastro-etapas__cabecalho">
        <IconButton
          label={rotuloVoltar}
          icon={<IconeVoltar tamanho={18} />}
          className="cadastro-etapas__voltar"
          onClick={onVoltarDaPagina}
        />
        {iconeDoCabecalho}
        <PageHeader
          headingLevel={1}
          titleId={tituloId}
          title={titulo}
          description={descricao}
          actions={acaoDoCabecalho}
        />
      </header>

      {aposCabecalho}

      <form
        className="cadastro-etapas__form"
        noValidate
        onSubmit={onSubmit}
        {...(rotuloDoFormulario ? { "aria-label": rotuloDoFormulario } : {})}
      >
        <div className="cadastro-etapas__corpo">
          <nav
            className="cadastro-etapas__etapas"
            aria-label="Etapas do cadastro"
          >
            <p className="cadastro-etapas__etapas-rotulo" aria-hidden="true">
              Etapas
            </p>
            <ol className="cadastro-etapas__etapas-lista">
              {etapas.map((e, indice) => {
                const estado: EstadoDaEtapa =
                  indice === atual
                    ? "atual"
                    : indice < alcancada
                      ? "concluida"
                      : indice === alcancada
                        ? "visitada"
                        : "pendente";
                const conteudo = (
                  <>
                    <span
                      className="cadastro-etapas__etapa-marcador"
                      aria-hidden="true"
                    >
                      {estado === "concluida" ? <IconeConcluida /> : indice + 1}
                    </span>
                    <span
                      className="cadastro-etapas__etapa-nome"
                      aria-hidden="true"
                    >
                      {e.titulo}
                      <span className="cadastro-etapas__etapa-sub">
                        {e.subtitulo}
                      </span>
                    </span>
                    <span className="cadastro-etapas__so-leitor">
                      {`Etapa ${indice + 1}: ${e.titulo}, ${ROTULO_DO_ESTADO[estado]}`}
                    </span>
                  </>
                );
                return (
                  <li
                    key={e.titulo}
                    className={`cadastro-etapas__etapa-item cadastro-etapas__etapa-item--${estado}`}
                  >
                    {estado === "concluida" || estado === "visitada" ? (
                      <button
                        type="button"
                        className="cadastro-etapas__etapa-passo"
                        disabled={ocupado}
                        onClick={() => onIrParaEtapa(indice)}
                      >
                        {conteudo}
                      </button>
                    ) : (
                      <span
                        className="cadastro-etapas__etapa-passo"
                        {...(estado === "atual"
                          ? { "aria-current": "step" as const }
                          : {})}
                      >
                        {conteudo}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="cadastro-etapas__conteudo">
            {antesDoConteudo}
            {paineis ? (
              paineis.map((painel, indice) => (
                <section
                  key={indice}
                  className="cadastro-etapas__etapa"
                  aria-labelledby={idDoTitulo(indice)}
                  hidden={indice !== atual}
                >
                  {cabecalhoDaEtapa(indice)}
                  {painel}
                </section>
              ))
            ) : (
              // A `key` remonta a etapa na troca: é o que dispara o fade.
              <section
                key={atual}
                className="cadastro-etapas__etapa"
                aria-labelledby={idDoTitulo(atual)}
              >
                {cabecalhoDaEtapa(atual)}
                {children}
              </section>
            )}
            {mensagem}
          </div>
        </div>

        <div className="cadastro-etapas__rodape">
          {resumoDoRodape === undefined ? (
            <div className="cadastro-etapas__progresso">
              <progress
                className="cadastro-etapas__progresso-barra"
                max={100}
                value={progresso}
                aria-labelledby={idProgresso}
              />
              <p id={idProgresso} className="cadastro-etapas__progresso-texto">
                {progresso}% concluído
              </p>
            </div>
          ) : null}
          <div
            className={
              resumoDoRodape === undefined
                ? "cadastro-etapas__rodape-acoes"
                : "cadastro-etapas__rodape-acoes cadastro-etapas__rodape-acoes--com-resumo"
            }
          >
            {atual === 0 ? (
              <Button
                type="button"
                variant="subtle"
                onClick={onVoltarDaPagina}
                disabled={ocupado}
              >
                Cancelar
              </Button>
            ) : (
              <Button
                type="button"
                variant="subtle"
                onClick={() => onIrParaEtapa(atual - 1)}
                disabled={ocupado}
              >
                Voltar
              </Button>
            )}
            {resumoDoRodape ? (
              <span className="cadastro-etapas__rodape-resumo">
                {resumoDoRodape}
              </span>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              disabled={ocupado || principalDesabilitado}
              {...(idBotaoPrincipal ? { id: idBotaoPrincipal } : {})}
              onClick={(evento) => {
                // Duplo clique em "Próxima etapa" não pode cair no "Concluir".
                if (evento.detail > 1) evento.preventDefault();
              }}
            >
              {ultima ? (
                rotuloConcluir
              ) : rotuloDoProximo ? (
                rotuloDoProximo
              ) : (
                <>
                  Próxima etapa
                  <IconeAvancar
                    className="cadastro-etapas__seta"
                    tamanho={16}
                  />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Uma seção da etapa: título e descrição, e as linhas. */
export function SecaoDoCadastro({
  titulo,
  descricao,
  id: idPedido,
  children,
}: {
  readonly titulo: string;
  readonly descricao: ReactNode;
  /** Id do título (quando a tela o referencia). */
  readonly id?: string;
  readonly children: ReactNode;
}) {
  const gerado = useId();
  const id = idPedido ?? gerado;
  return (
    <section className="cadastro-etapas__secao" aria-labelledby={id}>
      <header className="cadastro-etapas__secao-cabecalho">
        <h3 id={id} className="cadastro-etapas__secao-titulo">
          {titulo}
        </h3>
        <p className="cadastro-etapas__secao-descricao">{descricao}</p>
      </header>
      {children}
    </section>
  );
}

/**
 * Uma linha: rótulo e ajuda à esquerda, campos à direita. Com `paraId`, o
 * rótulo é o `<label>` do campo; sem ele (dois campos lado a lado), a linha é
 * um grupo nomeado pelo rótulo, e cada campo tem o próprio nome.
 */
export function LinhaDoCadastro({
  rotulo,
  ajuda,
  paraId,
  dica,
  grupo = true,
  children,
}: {
  readonly rotulo: string;
  readonly ajuda?: string;
  readonly paraId?: string;
  /** Ajuda extra ao lado do rótulo (ex.: o "?" de um campo). */
  readonly dica?: ReactNode;
  /**
   * Sem `paraId`, a linha é um grupo nomeado pelo rótulo. `false` quando o
   * único campo dela já tem nome próprio: o rótulo fica só visual.
   */
  readonly grupo?: boolean;
  readonly children: ReactNode;
}) {
  const base = useId();
  const idRotulo = `${base}-rotulo`;
  return (
    <div
      className="cadastro-etapas__linha-cadastro"
      {...(paraId || !grupo
        ? {}
        : { role: "group", "aria-labelledby": idRotulo })}
    >
      <div className="cadastro-etapas__linha-rotulo">
        <div className="cadastro-etapas__linha-cabeca">
          {paraId ? (
            <label
              id={idRotulo}
              htmlFor={paraId}
              className="cadastro-etapas__linha-titulo"
            >
              {rotulo}
            </label>
          ) : (
            <p id={idRotulo} className="cadastro-etapas__linha-titulo">
              {rotulo}
            </p>
          )}
          {dica}
        </div>
        {ajuda ? <p className="cadastro-etapas__linha-ajuda">{ajuda}</p> : null}
      </div>
      <div className="cadastro-etapas__linha-campos">{children}</div>
    </div>
  );
}

function IconeConcluida() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}
