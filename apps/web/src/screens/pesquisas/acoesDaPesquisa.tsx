/**
 * T216 — as ações sobre uma pesquisa, iguais na lista e nos resultados:
 * o menu de status (título, ponto colorido e o que cada um faz), a janela
 * de exclusão (o que se perde, em números, e a sugestão de só finalizar) e
 * a gaveta "Duplicar pesquisa" (empresa de destino e o aviso do link novo).
 * Cada ação termina num aviso flutuante.
 */
import { useEffect, useState } from "react";
import type {
  PesquisaDetalhe,
  PesquisaResumo,
  StatusPesquisa,
} from "../../api/pesquisasClient";
import {
  Button,
  FormActions,
  PontoDoStatus,
  StatusBadge,
  classesDoStatus,
} from "../../components";
import { plural } from "../../format/plural";
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ListaDeEscolha,
  Sheet,
} from "../../ui";
import { IconeAbrir, IconeCopiar, IconeRemover } from "../../ui/icones";
import { useAvisar } from "./avisos";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import {
  ROTULO_DO_STATUS,
  TOM_DO_STATUS,
  proximosStatus,
} from "./textosDasPesquisas";

export const TEXTO_DO_STATUS: Readonly<Record<StatusPesquisa, string>> = {
  rascunho: "Ainda não publicada",
  ativa: "Recebe respostas pelo link",
  pausada: "Para de receber respostas por enquanto",
  finalizada: "Encerra e guarda as respostas",
  cancelada: "Encerra sem valer como resultado",
};

export const AVISO_DO_STATUS: Readonly<Record<StatusPesquisa, string>> = {
  rascunho: "Pesquisa em rascunho.",
  ativa: "Pesquisa ativada.",
  pausada: "Pesquisa pausada.",
  finalizada: "Pesquisa finalizada.",
  cancelada: "Pesquisa cancelada.",
};

const CONFIRMACAO: Readonly<
  Partial<
    Record<StatusPesquisa, { titulo: string; texto: string; botao: string }>
  >
> = {
  finalizada: {
    titulo: "Finalizar a pesquisa?",
    texto:
      "O link deixa de aceitar respostas e a pesquisa não volta a ficar ativa. Os resultados recebidos continuam aqui.",
    botao: "Finalizar pesquisa",
  },
  cancelada: {
    titulo: "Cancelar a pesquisa?",
    texto:
      "O link deixa de aceitar respostas e a pesquisa não volta a ficar ativa. As respostas ficam guardadas, mas a pesquisa não vale como resultado.",
    botao: "Cancelar pesquisa",
  },
};

/** A pílula do status com o menu "Mudar status". */
export function MenuDeStatus({
  pesquisa,
  servico,
  podeEditar,
  onMudou,
}: {
  readonly pesquisa: Pick<PesquisaResumo, "id" | "status">;
  readonly servico: ServicoDePesquisas;
  readonly podeEditar: boolean;
  readonly onMudou: (d: PesquisaDetalhe) => void;
}) {
  const avisar = useAvisar();
  const [confirmar, setConfirmar] = useState<StatusPesquisa | null>(null);
  const [mudando, setMudando] = useState(false);
  const proximos = podeEditar ? proximosStatus(pesquisa.status) : [];

  async function mudar(status: StatusPesquisa) {
    setMudando(true);
    try {
      const d = await servico.alterarStatusDaPesquisa(pesquisa.id, status);
      onMudou(d);
      avisar(AVISO_DO_STATUS[status]);
    } catch {
      avisar("Não foi possível mudar o status.", {
        texto: "Atualize a página e tente de novo.",
      });
    } finally {
      setMudando(false);
      setConfirmar(null);
    }
  }

  const tom = TOM_DO_STATUS[pesquisa.status];

  // Sem mudança possível: a pílula de status do sistema.
  if (proximos.length === 0) {
    return (
      <StatusBadge variant={tom}>
        {ROTULO_DO_STATUS[pesquisa.status]}
      </StatusBadge>
    );
  }
  return (
    <>
      <DropdownMenu>
        {/* O gatilho é um botão com as classes da pílula do sistema. */}
        <DropdownMenuTrigger
          className={`${classesDoStatus(tom)} pesquisas__status-gatilho`}
          aria-label={`Mudar status, hoje ${ROTULO_DO_STATUS[pesquisa.status]}`}
          disabled={mudando}
        >
          <PontoDoStatus />
          <span className="evolli-badge__label">
            {ROTULO_DO_STATUS[pesquisa.status]}
          </span>
          <IconeAbrir tamanho={12} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <p className="pesquisas__menu-titulo" aria-hidden="true">
            Mudar status
          </p>
          {proximos.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() =>
                CONFIRMACAO[s] ? setConfirmar(s) : void mudar(s)
              }
            >
              <span className="pesquisas__menu-opcao">
                <StatusBadge variant={TOM_DO_STATUS[s]}>
                  {ROTULO_DO_STATUS[s]}
                </StatusBadge>
                <span className="pesquisas__suave">{TEXTO_DO_STATUS[s]}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        aberto={confirmar !== null}
        titulo={confirmar ? (CONFIRMACAO[confirmar]?.titulo ?? "") : ""}
        onFechar={() => setConfirmar(null)}
        bloqueado={mudando}
        rodape={
          <FormActions>
            <Button variant="secondary" onClick={() => setConfirmar(null)}>
              Voltar
            </Button>
            <Button
              className="pesquisas__botao-perigo"
              disabled={mudando}
              onClick={() => confirmar && void mudar(confirmar)}
            >
              {confirmar ? CONFIRMACAO[confirmar]?.botao : ""}
            </Button>
          </FormActions>
        }
      >
        <p>{confirmar ? CONFIRMACAO[confirmar]?.texto : ""}</p>
      </Dialog>
    </>
  );
}

/** A janela "Excluir": o que se perde e a sugestão de só finalizar. */
export function JanelaDeExclusao({
  pesquisa,
  servico,
  onFechar,
  onExcluida,
  onFinalizada,
}: {
  readonly pesquisa: PesquisaResumo | null;
  readonly servico: ServicoDePesquisas;
  readonly onFechar: () => void;
  readonly onExcluida: (nome: string) => void;
  readonly onFinalizada: (d: PesquisaDetalhe) => void;
}) {
  const avisar = useAvisar();
  const [ocupado, setOcupado] = useState(false);
  const [detalhe, setDetalhe] = useState<PesquisaDetalhe | null>(null);

  useEffect(() => {
    setDetalhe(null);
    if (!pesquisa) return;
    let vivo = true;
    Promise.resolve(servico.obterPesquisa(pesquisa.id))
      .then((d) => {
        if (vivo && d) setDetalhe(d);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [pesquisa, servico]);

  async function excluir() {
    if (!pesquisa) return;
    setOcupado(true);
    try {
      await servico.excluirPesquisa(pesquisa.id);
      avisar(`"${pesquisa.nome}" foi excluída.`);
      onExcluida(pesquisa.nome);
    } catch {
      avisar("Não foi possível excluir a pesquisa.", {
        texto: "Tente de novo.",
      });
      onFechar();
    } finally {
      setOcupado(false);
    }
  }

  async function finalizar() {
    if (!pesquisa) return;
    setOcupado(true);
    try {
      const d = await servico.alterarStatusDaPesquisa(
        pesquisa.id,
        "finalizada",
      );
      avisar(AVISO_DO_STATUS.finalizada);
      onFinalizada(d);
    } catch {
      avisar("Não foi possível finalizar a pesquisa.", {
        texto: "Tente de novo.",
      });
    } finally {
      setOcupado(false);
    }
  }

  const perguntas = detalhe ? perguntasEmOrdem(detalhe.secoes).length : null;
  const participantes =
    detalhe?.participantesTotal ?? pesquisa?.participantes ?? null;
  const podeFinalizar =
    pesquisa?.status === "ativa" || pesquisa?.status === "pausada";

  return (
    <Dialog
      aberto={pesquisa !== null}
      titulo={pesquisa ? `Excluir ${pesquisa.nome}?` : ""}
      icone={<IconeRemover tamanho={20} />}
      onFechar={onFechar}
      bloqueado={ocupado}
      rodape={
        <FormActions>
          <Button variant="secondary" disabled={ocupado} onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            className="pesquisas__botao-perigo"
            disabled={ocupado}
            onClick={() => void excluir()}
          >
            Excluir pesquisa
          </Button>
        </FormActions>
      }
    >
      {pesquisa ? (
        <div className="pesquisas__etapa">
          <p>
            A pesquisa sai da lista, o link deixa de funcionar e não é possível
            desfazer. Some junto:
          </p>
          <dl className="pesquisas__perdas" aria-label="O que se perde">
            <div>
              <dt>Respostas</dt>
              <dd>{plural(pesquisa.respostas, "resposta", "respostas")}</dd>
            </div>
            <div>
              <dt>Perguntas</dt>
              <dd>
                {perguntas === null
                  ? "—"
                  : plural(perguntas, "pergunta", "perguntas")}
              </dd>
            </div>
            <div>
              <dt>Participantes</dt>
              <dd>
                {participantes === null
                  ? "Quem tiver o link"
                  : plural(participantes, "pessoa", "pessoas")}
              </dd>
            </div>
          </dl>
          {podeFinalizar ? (
            <div className="pesquisas__nota pesquisas__sugestao">
              <span>
                Quer só parar de receber respostas? Finalize: as respostas e os
                resultados ficam guardados.
              </span>
              <Button
                variant="secondary"
                disabled={ocupado}
                onClick={() => void finalizar()}
              >
                Finalizar pesquisa
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}

/** A gaveta "Duplicar pesquisa": a cópia nasce ativa, com link novo. */
export function GavetaDeDuplicar({
  pesquisa,
  servico,
  onFechar,
  onDuplicada,
}: {
  readonly pesquisa: Pick<PesquisaResumo, "id" | "nome"> | null;
  readonly servico: ServicoDePesquisas;
  readonly onFechar: () => void;
  /** A cópia, e se ela ficou na empresa ativa (dá para abrir aqui). */
  readonly onDuplicada: (
    copia: PesquisaDetalhe,
    naEmpresaAtiva: boolean,
  ) => void;
}) {
  const avisar = useAvisar();
  const [empresas, setEmpresas] = useState<
    readonly { id: string; nome: string }[]
  >([]);
  const [ativa, setAtiva] = useState<string>("");
  const [destino, setDestino] = useState<string>("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!pesquisa) return;
    let vivo = true;
    Promise.all([
      Promise.resolve(servico.listarEmpresas()).catch(() => []),
      Promise.resolve(servico.empresaAtiva()).catch(() => null),
    ]).then(([lista, atual]) => {
      if (!vivo) return;
      setEmpresas(lista ?? []);
      const id = atual?.id ?? lista?.[0]?.id ?? "";
      setAtiva(id);
      setDestino(id);
    });
    return () => {
      vivo = false;
    };
  }, [pesquisa, servico]);

  async function confirmar() {
    if (!pesquisa) return;
    setOcupado(true);
    try {
      const copia = await servico.duplicarPesquisa(
        pesquisa.id,
        destino && destino !== ativa ? destino : undefined,
      );
      const naAtiva = !destino || destino === ativa;
      avisar("Pesquisa duplicada com sucesso!", {
        texto: naAtiva
          ? "A cópia já está ativa, com um link novo."
          : `A cópia está ativa em ${empresas.find((e) => e.id === destino)?.nome ?? "outra empresa"}.`,
      });
      onDuplicada(copia, naAtiva);
    } catch {
      avisar("Não foi possível duplicar a pesquisa.", {
        texto: "Tente de novo.",
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Sheet
      aberto={pesquisa !== null}
      titulo="Duplicar pesquisa"
      subtitulo={pesquisa?.nome ?? ""}
      icone={<IconeCopiar tamanho={18} />}
      onFechar={onFechar}
      bloqueado={ocupado}
      rodape={
        <FormActions>
          <Button variant="secondary" disabled={ocupado} onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado || !destino}
            onClick={() => void confirmar()}
          >
            Confirmar duplicação
          </Button>
        </FormActions>
      }
    >
      <div className="pesquisas__etapa">
        <p>
          A cópia leva as perguntas, a identificação e os participantes e já
          começa ativa. As respostas não vão junto.
        </p>
        {empresas.length > 1 ? (
          <div className="pesquisas__campos">
            <label htmlFor="duplicar-empresa" className="pesquisas__rotulo">
              Empresa de destino
            </label>
            <ListaDeEscolha
              id="duplicar-empresa"
              opcoes={empresas.map((e) => ({ valor: e.id, rotulo: e.nome }))}
              valor={destino}
              onMudar={setDestino}
            />
          </div>
        ) : null}
        <p className="pesquisas__nota">
          A cópia ganha um link novo. O link desta pesquisa continua o mesmo.
        </p>
      </div>
    </Sheet>
  );
}
