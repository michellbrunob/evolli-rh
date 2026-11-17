/**
 * T209 — o padrão compartilhado de cadastro em etapas: etapas à esquerda,
 * cabeçalho da etapa com o selo "Etapa N de M", rodapé com progresso e ações;
 * com `paineis`, todas as etapas ficam montadas (só a atual visível), para
 * nada do que foi digitado sair do documento.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CadastroEmEtapas,
  LinhaDoCadastro,
  SecaoDoCadastro,
} from "./CadastroEmEtapas";

const ETAPAS = [
  { titulo: "Primeira", subtitulo: "Sub um", descricao: "Descrição um." },
  { titulo: "Segunda", subtitulo: "Sub dois", descricao: "Descrição dois." },
];

function montar(props: Partial<Parameters<typeof CadastroEmEtapas>[0]> = {}) {
  const onSubmit = vi.fn((e: { preventDefault: () => void }) =>
    e.preventDefault(),
  );
  const onIrParaEtapa = vi.fn();
  const onVoltarDaPagina = vi.fn();
  render(
    <CadastroEmEtapas
      tituloId="titulo-teste"
      titulo="Cadastro de teste"
      descricao="Em duas etapas."
      rotuloVoltar="Voltar para a lista"
      onVoltarDaPagina={onVoltarDaPagina}
      etapas={ETAPAS}
      atual={0}
      alcancada={0}
      onIrParaEtapa={onIrParaEtapa}
      onSubmit={onSubmit}
      rotuloConcluir="Concluir"
      {...props}
    >
      <p>Conteúdo único</p>
    </CadastroEmEtapas>,
  );
  return { onSubmit, onIrParaEtapa, onVoltarDaPagina };
}

describe("T209 — CadastroEmEtapas", () => {
  it("cabeçalho, etapas com estado em texto, selo, progresso e Cancelar na primeira", () => {
    const { onVoltarDaPagina } = montar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Cadastro de teste" }),
    ).toHaveAttribute("id", "titulo-teste");
    const etapas = screen.getByRole("navigation", {
      name: "Etapas do cadastro",
    });
    expect(etapas).toHaveTextContent("Etapa 1: Primeira, etapa atual");
    expect(etapas).toHaveTextContent("Etapa 2: Segunda, não iniciada");
    expect(screen.getByText("Etapa 1 de 2")).toBeInTheDocument();
    expect(screen.getByText("50% concluído")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onVoltarDaPagina).toHaveBeenCalledTimes(1);
  });

  it("com painéis, todos montados e só o atual visível; o título de cada um tem o id pedido", () => {
    montar({
      atual: 1,
      alcancada: 1,
      paineis: [<p key="a">Painel A</p>, <p key="b">Painel B</p>],
      idDoTituloDaEtapa: (i) => `etapa-${i}`,
    });
    const a = screen.getByText("Painel A").closest("section")!;
    const b = screen.getByText("Painel B").closest("section")!;
    expect(a).not.toBeVisible();
    expect(b).toBeVisible();
    expect(a).toHaveAttribute("aria-labelledby", "etapa-0");
    expect(document.getElementById("etapa-1")).toHaveTextContent("Segunda");
    expect(screen.queryByText("Conteúdo único")).toBeNull();
  });

  it("na última: rótulo de concluir, id e travamento do botão principal; Voltar vai à anterior", () => {
    const { onIrParaEtapa } = montar({
      atual: 1,
      alcancada: 1,
      idBotaoPrincipal: "botao-principal",
      principalDesabilitado: true,
    });
    const principal = screen.getByRole("button", { name: "Concluir" });
    expect(principal).toHaveAttribute("id", "botao-principal");
    expect(principal).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onIrParaEtapa).toHaveBeenCalledWith(0);
  });

  it("conteúdo entre o cabeçalho e o formulário, e no topo da coluna; classe extra na raiz; nome do formulário", () => {
    montar({
      aposCabecalho: <p>Faixa do rascunho</p>,
      antesDoConteudo: <p>Contexto da empresa</p>,
      className: "tela-extra",
      rotuloDoFormulario: "Formulário de teste",
    });
    const raiz = document.querySelector(".cadastro-etapas")!;
    expect(raiz).toHaveClass("tela-extra");
    const form = screen.getByRole("form", { name: "Formulário de teste" });
    expect(within(form).getByText("Contexto da empresa")).toBeInTheDocument();
    expect(within(form).queryByText("Faixa do rascunho")).toBeNull();
    expect(screen.getByText("Faixa do rascunho")).toBeInTheDocument();
  });

  it("linha com dica e com grupo desligado (o campo já tem nome próprio)", () => {
    render(
      <SecaoDoCadastro titulo="Seção" descricao="Desc." id="secao-teste">
        <LinhaDoCadastro rotulo="Com dica" dica={<span>?</span>}>
          <input aria-label="Campo A" />
        </LinhaDoCadastro>
        <LinhaDoCadastro rotulo="Sem grupo" grupo={false}>
          <input aria-label="Campo B" />
        </LinhaDoCadastro>
      </SecaoDoCadastro>,
    );
    expect(screen.getByRole("region", { name: "Seção" })).toHaveAttribute(
      "aria-labelledby",
      "secao-teste",
    );
    expect(screen.getByRole("group", { name: "Com dica" })).toHaveTextContent(
      "?",
    );
    expect(screen.queryByRole("group", { name: "Sem grupo" })).toBeNull();
  });
});
