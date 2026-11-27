/**
 * T215 — Visões salvas do quadro da escala: os filtros com um nome, para
 * abrir de novo com um clique ("Só você vê": da conta, na empresa ativa).
 *
 * - `DialogoSalvarVisao`: o nome (obrigatório, até 60) e "Salvar visão";
 *   nome repetido, teto de 30 e falha explicam sem fechar.
 * - `DialogoGerenciarVisoes`: renomear (no lugar, Esc cancela só a edição)
 *   e apagar (com confirmação na própria linha).
 *
 * Toda resposta do servidor traz a lista inteira; quem abre recebe a lista
 * nova e decide o aviso.
 */
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { ApiError } from "../../../api/colaboradoresClient";
import {
  type VisaoDoQuadroApi,
  criarVisao,
  removerVisao,
  renomearVisao,
} from "../../../api/escalaClient";
import { plural } from "../../../format/plural";
import { Button, Dialog, Input } from "../../../ui";
import type { FiltrosDoQuadro } from "./filtrosDoQuadro";
import "./VisoesDoQuadro.css";

export const MAXIMO_DO_NOME_DA_VISAO = 60;

function mensagemDoErro(e: unknown, padrao: string): string {
  const motivo =
    e instanceof ApiError
      ? e.erros?.find((x) => x.campo === "nome")?.motivo
      : undefined;
  if (motivo === "em_uso") return "Você já tem uma visão com esse nome.";
  if (motivo === "limite") {
    return "Você chegou a 30 visões. Apague uma em Gerenciar para salvar outra.";
  }
  return padrao;
}

export function DialogoSalvarVisao({
  aberto,
  filtros,
  onFechar,
  onSalva,
}: {
  readonly aberto: boolean;
  readonly filtros: FiltrosDoQuadro;
  readonly onFechar: () => void;
  readonly onSalva: (visoes: VisaoDoQuadroApi[]) => void;
}) {
  const id = useId();
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) {
      setNome("");
      setErro(null);
      setEnviando(false);
    }
  }, [aberto]);

  const limpo = nome.trim();
  const salvar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!limpo || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await criarVisao({ nome: limpo, filtros });
      onSalva(r.visoes);
    } catch (falha) {
      setErro(
        mensagemDoErro(
          falha,
          "Não foi possível salvar a visão. Tente de novo.",
        ),
      );
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto={aberto}
      titulo="Salvar como visão"
      descricao="A visão guarda os filtros para abrir de novo com um clique. Só você vê."
      onFechar={onFechar}
      bloqueado={enviando}
      className="visoes-quadro"
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={`${id}-form`}
            disabled={!limpo || enviando}
          >
            {enviando ? "Aguarde…" : "Salvar visão"}
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} className="visoes-quadro__form" onSubmit={salvar}>
        <label htmlFor={`${id}-nome`}>Nome</label>
        <Input
          id={`${id}-nome`}
          value={nome}
          maxLength={MAXIMO_DO_NOME_DA_VISAO}
          placeholder="Ex.: Matriz · sem escala"
          autoComplete="off"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          onChange={(e) => setNome(e.target.value)}
        />
        {erro ? (
          <p id={`${id}-erro`} role="alert" className="visoes-quadro__erro">
            {erro}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

type Acao =
  | { readonly tipo: "renomear"; readonly id: string }
  | { readonly tipo: "apagar"; readonly id: string }
  | null;

export function DialogoGerenciarVisoes({
  aberto,
  visoes,
  onFechar,
  onMudou,
}: {
  readonly aberto: boolean;
  readonly visoes: readonly VisaoDoQuadroApi[];
  readonly onFechar: () => void;
  /** A lista nova e o texto do aviso. */
  readonly onMudou: (visoes: VisaoDoQuadroApi[], aviso: string) => void;
}) {
  const id = useId();
  const [acao, setAcao] = useState<Acao>(null);
  const listaRef = useRef<HTMLUListElement | null>(null);
  // Ao sair da edição ou da confirmação, o foco volta à linha (ou ao título).
  const [focarLinha, setFocarLinha] = useState<string | null>(null);
  useEffect(() => {
    if (focarLinha === null) return;
    const botao = listaRef.current?.querySelector<HTMLElement>(
      `[data-visao="${CSS.escape(focarLinha)}"] button`,
    );
    botao?.focus();
    setFocarLinha(null);
  }, [focarLinha, visoes]);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) {
      setAcao(null);
      setErro(null);
      setEnviando(false);
    }
  }, [aberto]);

  const cancelar = () => {
    if (acao) setFocarLinha(acao.id);
    setAcao(null);
    setErro(null);
  };

  const renomear = async (v: VisaoDoQuadroApi, e?: FormEvent) => {
    e?.preventDefault();
    const limpo = nome.trim();
    if (!limpo || enviando) return;
    if (limpo === v.nome) {
      cancelar();
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await renomearVisao(v.id, limpo);
      setAcao(null);
      setFocarLinha(v.id);
      onMudou(r.visoes, `Visão renomeada para "${limpo}".`);
    } catch (falha) {
      setErro(
        mensagemDoErro(falha, "Não foi possível renomear. Tente de novo."),
      );
    } finally {
      setEnviando(false);
    }
  };

  const apagar = async (v: VisaoDoQuadroApi) => {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await removerVisao(v.id);
      setAcao(null);
      onMudou(r.visoes, `Visão "${v.nome}" apagada.`);
    } catch {
      setErro("Não foi possível apagar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto={aberto}
      titulo="Visões salvas"
      {...(visoes.length > 0
        ? {
            subtitulo: plural(visoes.length, "visão salva", "visões salvas"),
          }
        : {})}
      onFechar={onFechar}
      bloqueado={enviando}
      className="visoes-quadro"
      rodape={
        <Button variant="secondary" onClick={onFechar} disabled={enviando}>
          Fechar
        </Button>
      }
    >
      {visoes.length === 0 ? (
        <p className="visoes-quadro__vazio">
          Nenhuma visão salva. Marque os filtros e use &quot;Salvar como
          visão&quot;.
        </p>
      ) : (
        <ul ref={listaRef} className="visoes-quadro__lista">
          {visoes.map((v) => {
            const editando = acao?.tipo === "renomear" && acao.id === v.id;
            const apagando = acao?.tipo === "apagar" && acao.id === v.id;
            const idCampo = `${id}-${v.id}`;
            return (
              <li key={v.id} className="visoes-quadro__linha" data-visao={v.id}>
                {editando ? (
                  <form
                    className="visoes-quadro__renomear"
                    data-esc-proprio
                    onSubmit={(e) => renomear(v, e)}
                  >
                    <label htmlFor={idCampo} className="sr-only">
                      {`Novo nome de ${v.nome}`}
                    </label>
                    <Input
                      id={idCampo}
                      value={nome}
                      maxLength={MAXIMO_DO_NOME_DA_VISAO}
                      autoComplete="off"
                      autoFocus
                      aria-invalid={erro ? true : undefined}
                      aria-describedby={erro ? `${idCampo}-erro` : undefined}
                      onChange={(e) => setNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelar();
                        }
                      }}
                    />
                    <div className="visoes-quadro__acoes">
                      <Button
                        variant="secondary"
                        onClick={cancelar}
                        disabled={enviando}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={!nome.trim() || enviando}
                      >
                        Salvar nome
                      </Button>
                    </div>
                    {erro ? (
                      <p
                        id={`${idCampo}-erro`}
                        role="alert"
                        className="visoes-quadro__erro"
                      >
                        {erro}
                      </p>
                    ) : null}
                  </form>
                ) : apagando ? (
                  <div
                    className="visoes-quadro__confirmar"
                    role="group"
                    aria-label={`Apagar "${v.nome}"?`}
                  >
                    <p>{`Apagar "${v.nome}"?`}</p>
                    <div className="visoes-quadro__acoes">
                      <Button
                        variant="secondary"
                        onClick={cancelar}
                        disabled={enviando}
                        autoFocus
                      >
                        Manter
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => apagar(v)}
                        disabled={enviando}
                      >
                        Apagar visão
                      </Button>
                    </div>
                    {erro ? (
                      <p role="alert" className="visoes-quadro__erro">
                        {erro}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <span className="visoes-quadro__nome">{v.nome}</span>
                    <div className="visoes-quadro__acoes">
                      <Button
                        variant="subtle"
                        aria-label={`Renomear ${v.nome}`}
                        disabled={enviando}
                        onClick={() => {
                          setErro(null);
                          setNome(v.nome);
                          setAcao({ tipo: "renomear", id: v.id });
                        }}
                      >
                        Renomear
                      </Button>
                      <Button
                        variant="subtle"
                        aria-label={`Apagar ${v.nome}`}
                        disabled={enviando}
                        onClick={() => {
                          setErro(null);
                          setAcao({ tipo: "apagar", id: v.id });
                        }}
                      >
                        Apagar
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
