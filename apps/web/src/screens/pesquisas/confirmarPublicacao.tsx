/**
 * T216 — publicar quando ninguém consegue se identificar no link: a API
 * recusa com 422 `ninguem_identificavel` (todos os participantes sem CPF ou
 * data de nascimento). A tela pede uma confirmação explícita e só então
 * reenvia com `confirmarSemIdentificaveis: true`.
 */
import { useRef, useState, type ReactNode } from "react";
import type { PesquisaDetalhe } from "../../api/pesquisasClient";
import { Button, FormActions } from "../../components";
import { Dialog } from "../../ui";
import { IconeAviso } from "../../ui/icones";
import type { ServicoDePesquisas } from "./servicoDePesquisas";

function ehNinguemIdentificavel(erro: unknown): boolean {
  const e = erro as {
    status?: unknown;
    codigo?: unknown;
    erros?: readonly { campo?: unknown; motivo?: unknown }[];
  } | null;
  if (e?.status !== 422) return false;
  return (
    e.codigo === "ninguem_identificavel" ||
    (e.erros ?? []).some((x) => x.motivo === "ninguem_identificavel")
  );
}

/**
 * `publicar(id)` devolve a pesquisa publicada ou `null` (a pessoa desistiu
 * na confirmação). Outros erros sobem para quem chamou.
 */
export function usePublicarComConfirmacao(servico: ServicoDePesquisas): {
  readonly publicar: (id: string) => Promise<PesquisaDetalhe | null>;
  readonly janela: ReactNode;
} {
  const [pendente, setPendente] = useState<string | null>(null);
  const respostaRef = useRef<((confirmou: boolean) => void) | null>(null);

  async function publicar(id: string): Promise<PesquisaDetalhe | null> {
    try {
      return await servico.publicarPesquisa(id);
    } catch (erro) {
      if (!ehNinguemIdentificavel(erro)) throw erro;
    }
    const confirmou = await new Promise<boolean>((resolver) => {
      respostaRef.current = resolver;
      setPendente(id);
    });
    setPendente(null);
    if (!confirmou) return null;
    return servico.publicarPesquisa(id, { confirmarSemIdentificaveis: true });
  }

  const responder = (confirmou: boolean) => {
    respostaRef.current?.(confirmou);
    respostaRef.current = null;
  };

  const janela = (
    <Dialog
      aberto={pendente !== null}
      titulo="Ninguém consegue se identificar"
      icone={<IconeAviso tamanho={18} />}
      onFechar={() => responder(false)}
      rodape={
        <FormActions>
          <Button variant="secondary" onClick={() => responder(false)}>
            Voltar e completar o cadastro
          </Button>
          <Button onClick={() => responder(true)}>Publicar mesmo assim</Button>
        </FormActions>
      }
    >
      <p>
        Nenhuma das pessoas escolhidas tem CPF e data de nascimento na ficha,
        então ninguém vai conseguir confirmar quem é no link. Se publicar agora,
        a pesquisa fica ativa sem que alguém possa responder até o cadastro ser
        completado.
      </p>
    </Dialog>
  );

  return { publicar, janela };
}
