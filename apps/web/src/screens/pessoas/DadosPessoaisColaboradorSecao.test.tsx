/**
 * T177 — dados pessoais e endereço na ficha do colaborador, só leitura.
 *
 * Prende o que a ficha mostra para cada resposta do servidor: os valores
 * gravados (com a data em dia civil, sem ISO cru), "Não informado" para campo
 * vazio, sem registro, bloqueado e cada recusa do servidor (sem acesso, fora
 * da empresa ativa, empresa ambígua do `master_tecnico`) — que nunca mostra
 * valor.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DadosPessoaisColaboradorSecao } from "./DadosPessoaisColaboradorSecao";
import {
  type DadosPessoaisDoColaboradorApi,
  consultarDadosPessoaisDoColaborador,
} from "../../api/dadosPessoaisClient";
import { ApiError } from "../../api/colaboradoresClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/dadosPessoaisClient");
vi.mock("../../api/colaboradoresClient");

const ID = "11111111-1111-4111-8111-111111111111";

function recusa(status: number): ApiError {
  const erro = new ApiError(status, "recusado");
  Object.assign(erro, { status, message: "recusado" });
  return erro;
}

const registrado: DadosPessoaisDoColaboradorApi = {
  colaboradorId: ID,
  empresaId: "44444444-4444-4444-4444-444444444444",
  situacao: "registrado",
  perfilPessoal: {
    dataNascimento: "1990-05-20",
    sexo: "Feminino",
    saudacao: null,
    estadoCivil: "Casada",
    nacionalidade: "Brasileira",
    naturalidade: "Ouro Preto",
    escolaridade: null,
    curso: null,
    nomePai: null,
    nomeMae: "Mãe Sintética",
    atualizadoEm: "2026-10-20T12:00:00.000Z",
  },
  endereco: {
    pais: "Brasil",
    cep: "30140-071",
    logradouro: "Rua Sintética",
    numero: "10",
    complemento: null,
    bairro: "Centro",
    cidade: "Cidade Sintética",
    estado: "MG",
    atualizadoEm: "2026-10-20T12:00:00.000Z",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Ficha — dados pessoais e endereço (T177)", () => {
  it("mostra o que o servidor gravou, com a data em dia civil", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue(
      registrado,
    );
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
    expect(await screen.findByText("Feminino")).toBeInTheDocument();
    expect(screen.getByText("20/05/1990")).toBeInTheDocument();
    expect(screen.getByText("Mãe Sintética")).toBeInTheDocument();
    expect(screen.getByText("Cidade Sintética")).toBeInTheDocument();
    expect(screen.getByText("30140-071")).toBeInTheDocument();
    expect(screen.getAllByText("Não informado").length).toBeGreaterThan(0);
    expect(consultarDadosPessoaisDoColaborador).toHaveBeenCalledWith(ID);
    expectSemIsoVisivel(document.body);
  });

  it.each([
    ["Brasil", "30140071", "30140-071"],
    ["brasil", "30140071", "30140-071"],
    ["Portugal", "1000-001", "1000-001"],
    ["Portugal", "30140071", "30140071"],
  ])(
    "T179 — com país %s, o CEP gravado %s aparece como %s",
    async (pais, cep, exibido) => {
      vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
        ...registrado,
        endereco: { ...registrado.endereco!, pais, cep },
      });
      render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
      expect(await screen.findByText(exibido)).toBeInTheDocument();
    },
  );

  it("é só leitura: nenhum campo editável", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue(
      registrado,
    );
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
    await screen.findByText("Feminino");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem registro diz isso, sem campo falso", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
      ...registrado,
      situacao: "sem_registro",
      perfilPessoal: null,
      endereco: null,
    });
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
    expect(
      await screen.findByText("Nenhum dado pessoal ou endereço registrado."),
    ).toBeInTheDocument();
  });

  it("vínculo encerrado: uso bloqueado, nenhum valor", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
      ...registrado,
      situacao: "bloqueado",
      perfilPessoal: null,
      endereco: null,
    });
    render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
    expect(
      await screen.findByText(/uso dos dados pessoais/),
    ).toBeInTheDocument();
  });

  it.each([
    [403, /não tem acesso aos dados pessoais/],
    [404, /não encontrado na empresa ativa/],
    [409, /vínculo em mais de uma empresa. Selecione a empresa ativa/],
    [401, /Seu acesso expirou/],
  ] as const)(
    "%i: a recusa vira aviso, nunca um valor",
    async (status, mensagem) => {
      vi.mocked(consultarDadosPessoaisDoColaborador).mockRejectedValue(
        recusa(status),
      );
      render(<DadosPessoaisColaboradorSecao colaboradorId={ID} />);
      expect(await screen.findByText(mensagem)).toBeInTheDocument();
      expect(screen.queryByText("Feminino")).not.toBeInTheDocument();
    },
  );
});
