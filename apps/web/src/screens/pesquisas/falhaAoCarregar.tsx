/**
 * T216 — a falha ao abrir uma tela de uma pesquisa: "Pesquisa não
 * encontrada" (endereço inválido ou pesquisa excluída: 400/404), com a volta;
 * outra falha diz o que não carregou e oferece "Tentar novamente".
 */
import { Button } from "../../components";
import { IconButton } from "../../ui";
import { IconeVoltar } from "../../ui/icones";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";

export type Falha = "erro" | "nao-encontrada";

/** 400 (id inválido) e 404 (não existe ou é de outra empresa): não encontrada. */
export function tipoDaFalha(erro: unknown): Falha {
  const status = (erro as { status?: unknown } | null)?.status;
  return status === 400 || status === 404 ? "nao-encontrada" : "erro";
}

export function FalhaAoCarregar({
  falha,
  titulo,
  mensagem,
  rotuloVoltar,
  onVoltar,
  onTentarDeNovo,
}: {
  readonly falha: Falha;
  /** O título da tela na outra falha ("Resultados"). */
  readonly titulo: string;
  /** O que não carregou ("Não foi possível carregar os resultados."). */
  readonly mensagem: string;
  readonly rotuloVoltar: string;
  readonly onVoltar: () => void;
  readonly onTentarDeNovo: () => void;
}) {
  const naoEncontrada = falha === "nao-encontrada";
  return (
    <div className="pesquisas">
      <header className="pesquisas__cabecalho">
        <IconButton
          label="Voltar"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <h1
          id={PESQUISAS_TITULO_ID}
          className="pesquisas__titulo"
          tabIndex={-1}
        >
          {naoEncontrada ? "Pesquisa não encontrada" : titulo}
        </h1>
      </header>
      <div className="pesquisas__caixa-erro" role="alert">
        <p className="pesquisas__erro">
          {naoEncontrada
            ? "O endereço não corresponde a uma pesquisa desta empresa. Ela pode ter sido excluída."
            : mensagem}
        </p>
        <div className="pesquisas__acoes">
          {naoEncontrada ? null : (
            <Button variant="secondary" onClick={onTentarDeNovo}>
              Tentar novamente
            </Button>
          )}
          <Button
            variant={naoEncontrada ? "secondary" : "subtle"}
            onClick={onVoltar}
          >
            {rotuloVoltar}
          </Button>
        </div>
      </div>
    </div>
  );
}
