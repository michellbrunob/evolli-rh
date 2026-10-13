/**
 * AcaoSituacao (T158) — inativar e reativar um nó organizacional.
 *
 * Um único componente serve `Estrutura organizacional` (unidades,
 * departamentos, áreas, equipes), `Funções e cargos` e `Centros de custo`,
 * porque as seis entidades compartilham **o mesmo contrato**, conferido na
 * fonte entidade por entidade: `POST /<recurso>/:id/inativar` e
 * `POST /<recurso>/:id/reativar`, sem corpo, exigindo `manage` no recurso,
 * devolvendo a entidade atualizada com `status: "ativo" | "inativo"`.
 *
 * **Semelhança de nome não bastou para presumir isso.** Duas vizinhas ficaram
 * de fora justamente por divergirem:
 *
 *  - `tabela_horario` usa **`desativar`**, exige **`alter`** (não `manage`),
 *    guarda a situação num **booleano** e **não devolve 409** quando já está
 *    no estado pedido — é idempotente. Já tem interface própria desde a T037,
 *    e forçá-la neste molde quebraria as três diferenças de uma vez.
 *  - `empresa` tem as duas rotas, mas **não checa `assertAindaAtivo`** ao
 *    inativar e não tem nível superior a validar na reativação. Além disso
 *    não existe tela de empresa no produto; expô-la exigiria criar uma, que
 *    é capacidade nova e está fora desta tarefa.
 *
 * **Exclusão de nó organizacional não existe aqui nem no servidor.** Nenhum
 * dos controllers de `organizacao` declara `DELETE`, e este componente não
 * emite esse método em nenhum caminho.
 *
 * **O servidor continua sendo a autoridade.** O botão aparece conforme a
 * situação atual do registro, por conveniência; quem recusa é o backend, e as
 * mensagens abaixo descrevem o que ele respondeu — sem inventar causa.
 */
import { useCallback, useState } from "react";
import { Button, FormActions, Modal } from "../../components";

/** Forma mínima comum às seis entidades, conferida nos tipos de cada cliente. */
export interface RegistroComSituacao {
  id: string;
  codigo: string;
  nome: string;
  status: string;
}

export type Transicao = "inativar" | "reativar";

/**
 * Mensagem para cada recusa que o contrato prevê.
 *
 * O `409` de **inativar** cobre dois casos que o servidor **não distingue de
 * propósito** — já estar inativo, ou ainda haver dependente ativo. O texto
 * nomeia as duas possibilidades em vez de escolher uma: afirmar "existe
 * colaborador alocado" seria inventar, e seria também o vazamento por canal
 * lateral que a recusa genérica existe para evitar.
 *
 * No **reativar**, `409` só pode ser "já está ativo" (`assertAindaInativo`), e
 * `422` é sempre nível superior inativo (`assertPaisAtivosParaReativar`) — aí
 * dá para ser específico sem supor.
 */
export function mensagemDeErro(
  transicao: Transicao,
  status: number | null,
): string {
  if (status === null) {
    return "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";
  }
  if (status === 403) {
    return "Seu perfil não tem permissão para esta ação.";
  }
  if (status === 404) {
    return "Registro não encontrado. Atualize a lista e tente de novo.";
  }
  if (status === 409) {
    return transicao === "inativar"
      ? "O servidor recusou a inativação: ou a situação já mudou, ou ainda existe registro ativo vinculado a este. Atualize a lista e confira."
      : "O servidor recusou a reativação: a situação já mudou. Atualize a lista e confira.";
  }
  if (status === 422 && transicao === "reativar") {
    return "Não é possível reativar enquanto o nível superior estiver inativo. Reative o nível superior primeiro.";
  }
  return "Não foi possível concluir a operação. Tente de novo.";
}

/** `status` do erro quando ele vier de uma `ApiError`; `null` para falha de rede. */
function statusDoErro(err: unknown): number | null {
  const candidato = err as { status?: unknown } | null;
  return typeof candidato?.status === "number" ? candidato.status : null;
}

export interface AcaoSituacaoProps<T extends RegistroComSituacao> {
  registro: T;
  /** Nome do tipo em minúsculas, para o texto da confirmação: "departamento". */
  entidade: string;
  inativar: (id: string) => Promise<T>;
  reativar: (id: string) => Promise<T>;
  /** Recebe o registro atualizado e a frase de sucesso para a tela exibir. */
  onConcluido: (atualizado: T, mensagem: string) => void;
}

export function AcaoSituacao<T extends RegistroComSituacao>({
  registro,
  entidade,
  inativar,
  reativar,
  onConcluido,
}: AcaoSituacaoProps<T>) {
  const transicao: Transicao =
    registro.status === "ativo" ? "inativar" : "reativar";
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = useCallback(async () => {
    // Trava síncrona: `useState` é assíncrono, e dois cliques no mesmo quadro
    // leriam `enviando` como falso nas duas vezes.
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const atualizado =
        transicao === "inativar"
          ? await inativar(registro.id)
          : await reativar(registro.id);
      setAberto(false);
      onConcluido(
        atualizado,
        transicao === "inativar"
          ? `${registro.nome} foi inativado.`
          : `${registro.nome} foi reativado.`,
      );
    } catch (err) {
      setErro(mensagemDeErro(transicao, statusDoErro(err)));
    } finally {
      setEnviando(false);
    }
  }, [enviando, transicao, inativar, reativar, registro, onConcluido]);

  const rotulo = transicao === "inativar" ? "Inativar" : "Reativar";

  return (
    <>
      <Button
        variant="subtle"
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
        aria-label={`${rotulo} ${entidade} ${registro.nome}`}
      >
        {rotulo}
      </Button>

      {aberto ? (
        <Modal
          aberto
          titulo={`${rotulo} ${entidade}`}
          descricao={
            transicao === "inativar"
              ? `${registro.nome} (${registro.codigo}) deixa de ficar disponível para novas referências. Nada é excluído: o registro continua na lista, com a situação inativa.`
              : `${registro.nome} (${registro.codigo}) volta a ficar disponível para novas referências.`
          }
          onFechar={() => setAberto(false)}
          bloqueado={enviando}
          rodape={
            <FormActions>
              <Button
                variant="secondary"
                onClick={() => setAberto(false)}
                disabled={enviando}
              >
                Cancelar
              </Button>
              <Button onClick={() => void confirmar()} disabled={enviando}>
                {enviando ? "Aplicando…" : rotulo}
              </Button>
            </FormActions>
          }
        >
          {erro ? <p role="alert">{erro}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}
