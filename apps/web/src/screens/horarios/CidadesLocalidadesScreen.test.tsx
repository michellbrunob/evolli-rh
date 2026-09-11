import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CidadesLocalidadesScreen } from "./CidadesLocalidadesScreen";

describe("CidadesLocalidadesScreen (T087 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<CidadesLocalidadesScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Cidades e localidades",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que o catálogo é limitado à própria empresa e unidades autorizadas", () => {
    render(<CidadesLocalidadesScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(
        /o catálogo é limitado à própria empresa e às unidades autorizadas/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que é só demonstração, sem login, API, persistência, geolocalização, mapa, endereço, CEP, importação, exportação ou alteração cadastral real", () => {
    render(<CidadesLocalidadesScreen />);

    expect(screen.getByText("Somente demonstração")).toBeInTheDocument();
    expect(
      screen.getByText(
        /não há login, api, persistência, geolocalização, mapa, endereço, cep, importação, exportação ou alteração cadastral real/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que a referência não é endereço ou regra e não altera endereço, unidade, feriado, jornada, ponto, Banco de Horas, Folha, elegibilidade, permissão ou acesso", () => {
    render(<CidadesLocalidadesScreen />);

    expect(
      screen.getByText("Referência não é endereço ou regra"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /cidade\/localidade é referência técnica; não altera endereço, unidade, feriado, jornada, ponto, banco de horas, folha, elegibilidade, permissão ou acesso/i,
      ),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de dados reais bloqueados: MFA, DS-OPS-01, auditoria, retenção/base legal e validações de RH/Jurídico/Folha-DP/TI", () => {
    render(<CidadesLocalidadesScreen />);

    expect(screen.getByText("Dados reais bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/MFA/)).toBeInTheDocument();
    expect(screen.getByText("DS-OPS-01")).toBeInTheDocument();
    expect(
      screen.getByText(
        /validações aplicáveis de rh, jurídico\/privacidade, folha\/dp e ti/i,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o resumo com os cinco indicadores (rótulo curto + contagem) e a nota de que não localizam pessoa/exibem endereço/etc.", () => {
    render(<CidadesLocalidadesScreen />);

    const resumo = screen.getByText("Resumo (exemplo)").closest("section")!;
    const dentroDoResumo = within(resumo);

    expect(dentroDoResumo.getByText("Localidades")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("7 localidade(s) de referência (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Escopos técnicos")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 escopo(s) técnico(s) (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Em revisão")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("3 item(ns) em revisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("Pendentes de decisão"),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText("2 item(ns) pendente(s) de decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(dentroDoResumo.getByText("Itens históricos")).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        "2 item(ns) histórico(s) ilustrativo(s) (exemplo)",
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoResumo.getByText(
        /os indicadores não localizam pessoa, não exibem endereço, coordenada, mapa, cep ou dado real; não calculam feriado, jornada, pagamento, desconto, banco de horas, folha ou integração/i,
      ),
    ).toBeInTheDocument();
  });

  it("lista as referências com referência técnica, código, localidade, escopo, unidade, situação, responsável e trilha", () => {
    render(<CidadesLocalidadesScreen />);

    const tabela = screen.getByRole("table", {
      name: "Cidades e localidades (exemplo)",
    });
    const dentro = within(tabela);

    const linha = dentro.getByText("LOC-2026-0004").closest("tr")!;
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("LOCC-004 (exemplo)")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Localidade L-04 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Escopo E-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Unidade U-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("Aguardando decisão (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Localidades-03 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("2 eventos registrados (exemplo)"),
    ).toBeInTheDocument();
  });

  it("filtra localmente por escopo, situação e unidade/abrangência técnica", () => {
    render(<CidadesLocalidadesScreen />);

    fireEvent.change(screen.getByLabelText("Escopo"), {
      target: { value: "Escopo E-01 (exemplo)" },
    });

    const tabela = screen.getByRole("table", {
      name: "Cidades e localidades (exemplo)",
    });
    expect(within(tabela).getByText("LOC-2026-0001")).toBeInTheDocument();
    expect(within(tabela).getByText("LOC-2026-0003")).toBeInTheDocument();
    expect(within(tabela).getByText("LOC-2025-0002")).toBeInTheDocument();
    expect(within(tabela).queryByText("LOC-2026-0002")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("LOC-2026-0002")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    expect(screen.getByText("LOC-2025-0001")).toBeInTheDocument();
    expect(screen.getByText("LOC-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("LOC-2026-0001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Unidade/abrangência técnica"), {
      target: { value: "Unidade U-01 (exemplo)" },
    });
    expect(screen.getByText("LOC-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("LOC-2026-0003")).toBeInTheDocument();
    expect(screen.getByText("LOC-2025-0002")).toBeInTheDocument();
    expect(screen.queryByText("LOC-2026-0002")).not.toBeInTheDocument();
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhuma referência", () => {
    render(<CidadesLocalidadesScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "historico_ilustrativo" },
    });
    fireEvent.change(screen.getByLabelText("Unidade/abrangência técnica"), {
      target: { value: "Unidade U-02 (exemplo)" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhuma referência corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("abre o painel de detalhe ao clicar em 'Ver detalhe', somente leitura, com campos pendentes e único controle 'Fechar'", () => {
    render(<CidadesLocalidadesScreen />);

    const linha = screen.getByText("LOC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(screen.getByText("Detalhe demonstrativo")).toBeInTheDocument();
    const tituloDetalhe = screen.getByRole("heading", {
      name: "Detalhe da referência — LOC-2026-0001",
    });
    expect(tituloDetalhe).toBeInTheDocument();
    const painel = tituloDetalhe.closest("section")!;
    const dentroDoPainel = within(painel);

    expect(
      dentroDoPainel.getByText("Localidade L-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Escopo E-01 (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText("Validação RH (exemplo)"),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /registro de referência técnica de localidade \(exemplo ilustrativo, sem cidade, estado, cep ou endereço real\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      dentroDoPainel.getByText(
        /este painel não cria, edita, associa, localiza, valida, aprova, salva, importa, exporta, usa mapa, consulta endereço nem altera dados reais/i,
      ),
    ).toBeInTheDocument();

    expect(
      dentroDoPainel.getAllByRole("button").map((b) => b.textContent),
    ).toEqual(["Fechar"]);

    fireEvent.click(dentroDoPainel.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Detalhe demonstrativo")).not.toBeInTheDocument();
  });

  it("mostra 'nenhum campo pendente' quando o item de exemplo não tem pendências", () => {
    render(<CidadesLocalidadesScreen />);

    const linha = screen.getByText("LOC-2026-0002").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    expect(
      screen.getByText("Nenhum campo pendente (exemplo)."),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<CidadesLocalidadesScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Cidades e localidades (exemplo)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhuma referência de localidade cadastrada",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<CidadesLocalidadesScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar as referências de localidade",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-007014/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Cidades e localidades (exemplo)",
      }),
    ).toBeInTheDocument();
  });

  it("nenhum botão executa ação mutante, de localização ou de mapa (criar, associar, localizar, validar, aprovar, salvar, importar, exportar)", () => {
    render(<CidadesLocalidadesScreen />);

    const linha = screen.getByText("LOC-2026-0001").closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: /Ver detalhe/ }));

    const rotulos = screen
      .getAllByRole("button")
      .map((botao) => botao.textContent?.toLowerCase() ?? "");

    for (const rotulo of rotulos) {
      expect(rotulo).not.toMatch(
        /criar|associar|localizar|validar|aprovar|salvar|importar|exportar|mapa|endereço|excluir|editar/,
      );
    }
  });

  it("não contém cidade real, estado real, CEP, endereço, coordenada, mapa, CPF, e-mail, telefone, IP ou dado pessoal real", () => {
    render(<CidadesLocalidadesScreen />);

    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(document.querySelectorAll("form")).toHaveLength(0);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "cnpj",
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "sessão",
      "telefone",
      "cep:",
      "latitude",
      "longitude",
      "r$",
      "localstorage",
      "@",
      "http://",
      "https://",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("não declara conformidade com CLT, CCT, Portaria 671, LGPD ou eSocial", () => {
    render(<CidadesLocalidadesScreen />);

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "clt",
      "cct",
      "portaria 671",
      "lgpd",
      "esocial",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
