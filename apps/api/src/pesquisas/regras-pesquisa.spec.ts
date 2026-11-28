import {
  cpfNormalizado,
  formatarEncerramento,
  lerEncerramento,
  identificavelPeloLink,
  MINUTOS_POR_MODELO,
  minutosDaPesquisa,
  minutosEstimados,
  motivoIndisponivel,
  mudaEncerramentoTravado,
  podeEditar,
  primeiroNome,
  statusEfetivo,
  transicaoValida,
} from "./regras-pesquisa";
import { STATUS_PESQUISA } from "./pesquisas.types";

/** T216 — status calculado, transições e auxiliares da página pública. */

describe("T216 — statusEfetivo (prazo com hora, horário de Brasília)", () => {
  const agora = new Date("2026-11-27T15:00:00-03:00");
  const antes = new Date("2026-11-27T14:59:00-03:00");
  const depois = new Date("2026-11-27T15:01:00-03:00");

  it("ativa ou pausada com o instante do prazo já passado conta como finalizada", () => {
    expect(statusEfetivo("ativa", antes, agora)).toBe("finalizada");
    expect(statusEfetivo("pausada", antes, agora)).toBe("finalizada");
  });

  it("antes do instante do prazo ainda vale; sem prazo, nunca vence", () => {
    expect(statusEfetivo("ativa", depois, agora)).toBe("ativa");
    expect(statusEfetivo("ativa", agora, agora)).toBe("ativa");
    expect(statusEfetivo("ativa", null, agora)).toBe("ativa");
  });

  it("rascunho e cancelada não mudam pelo prazo", () => {
    expect(statusEfetivo("rascunho", antes, agora)).toBe("rascunho");
    expect(statusEfetivo("cancelada", antes, agora)).toBe("cancelada");
  });
});

describe("T216 — encerramento: leitura e formato", () => {
  it("AAAA-MM-DDTHH:mm no horário de Brasília", () => {
    expect(lerEncerramento("2026-12-01T18:30")!.toISOString()).toBe(
      "2026-12-01T21:30:00.000Z",
    );
  });

  it("só a data (formato antigo) vale até 23:59 daquele dia", () => {
    expect(lerEncerramento("2026-12-01")!.toISOString()).toBe(
      "2026-12-02T02:59:00.000Z",
    );
  });

  it("recusa data ou hora que não existe e outros formatos", () => {
    for (const v of [
      "2026-02-30T10:00",
      "2026-12-01T24:00",
      "2026-12-01T10:60",
      "2026-12-01 10:00",
      "01/12/2026",
      "2026-12-01T10:00:00",
    ]) {
      expect(lerEncerramento(v)).toBeNull();
    }
  });

  it("saída em ISO com o fuso de Brasília", () => {
    expect(formatarEncerramento(new Date("2026-12-01T21:30:00.000Z"))).toBe(
      "2026-12-01T18:30:00-03:00",
    );
    // Virada do dia em UTC continua no dia de Brasília.
    expect(formatarEncerramento(new Date("2026-12-02T02:59:00.000Z"))).toBe(
      "2026-12-01T23:59:00-03:00",
    );
  });
});

describe("T216 — transições", () => {
  const validas = new Set([
    "ativa>pausada",
    "ativa>finalizada",
    "ativa>cancelada",
    "pausada>ativa",
    "pausada>finalizada",
    "pausada>cancelada",
  ]);

  it("só as do documento; rascunho → ativa só pelo Publicar", () => {
    for (const de of STATUS_PESQUISA) {
      for (const para of STATUS_PESQUISA) {
        expect(transicaoValida(de, para)).toBe(validas.has(`${de}>${para}`));
      }
    }
  });

  it("edita rascunho, ativa, pausada e finalizada; cancelada não", () => {
    expect(STATUS_PESQUISA.filter(podeEditar)).toEqual([
      "rascunho",
      "ativa",
      "pausada",
      "finalizada",
    ]);
  });

  it("finalizada não muda o encerramento (não volta a aceitar respostas)", () => {
    const antes = new Date("2026-11-20T23:59:00-03:00");
    const igual = new Date("2026-11-20T23:59:00-03:00");
    const depois = new Date("2026-12-20T23:59:00-03:00");
    expect(mudaEncerramentoTravado("finalizada", antes, igual)).toBe(false);
    expect(mudaEncerramentoTravado("finalizada", null, null)).toBe(false);
    expect(mudaEncerramentoTravado("finalizada", antes, depois)).toBe(true);
    expect(mudaEncerramentoTravado("finalizada", antes, null)).toBe(true);
    expect(mudaEncerramentoTravado("finalizada", null, depois)).toBe(true);
    // Fora da finalizada, o encerramento muda à vontade.
    expect(mudaEncerramentoTravado("ativa", antes, depois)).toBe(false);
    expect(mudaEncerramentoTravado("pausada", antes, null)).toBe(false);
  });
});

describe("T216 — página pública", () => {
  it("motivo do aviso: finalizada à mão separada de encerrada pelo prazo", () => {
    const agora = new Date("2026-11-27T15:00:00-03:00");
    const vencido = new Date("2026-11-27T14:00:00-03:00");
    const futuro = new Date("2026-11-28T14:00:00-03:00");
    expect(motivoIndisponivel("ativa", null, agora)).toBeNull();
    expect(motivoIndisponivel("ativa", futuro, agora)).toBeNull();
    expect(motivoIndisponivel("pausada", null, agora)).toBe("pausada");
    expect(motivoIndisponivel("finalizada", null, agora)).toBe("finalizada");
    expect(motivoIndisponivel("finalizada", vencido, agora)).toBe("finalizada");
    expect(motivoIndisponivel("ativa", vencido, agora)).toBe("encerrada");
    expect(motivoIndisponivel("pausada", vencido, agora)).toBe("encerrada");
    expect(motivoIndisponivel("cancelada", vencido, agora)).toBe("cancelada");
    expect(motivoIndisponivel("rascunho", null, agora)).toBe("inexistente");
  });

  it("tempo estimado, primeiro nome e CPF", () => {
    // 0,3 minuto por pergunta, arredondado; no mínimo 3.
    expect(minutosEstimados(0)).toBe(3);
    expect(minutosEstimados(5)).toBe(3);
    expect(minutosEstimados(12)).toBe(4);
    expect(minutosEstimados(17)).toBe(5);
    expect(minutosEstimados(28)).toBe(8);
    expect(minutosEstimados(30)).toBe(9);
    expect(minutosEstimados(76)).toBe(23);
    expect(primeiroNome("  Pessoa  Sintética Um ")).toBe("Pessoa");
    expect(cpfNormalizado("123.456.789-09")).toBe("12345678909");
    expect(cpfNormalizado("1234567890")).toBeNull();
    expect(cpfNormalizado("abc")).toBeNull();
  });
});

describe("T216 — identificavelPeloLink", () => {
  const nascimento = new Date("1990-01-15T00:00:00Z");

  it("identificada e confidencial: precisa de CPF e nascimento no perfil", () => {
    for (const i of ["identificada", "confidencial"] as const) {
      expect(
        identificavelPeloLink(i, {
          cpf: "12345678909",
          dataNascimento: nascimento,
        }),
      ).toBe(true);
      expect(
        identificavelPeloLink(i, { cpf: null, dataNascimento: nascimento }),
      ).toBe(false);
      expect(
        identificavelPeloLink(i, { cpf: "12345678909", dataNascimento: null }),
      ).toBe(false);
      expect(identificavelPeloLink(i, null)).toBe(false);
    }
  });

  it("anônima: sempre (não há identificação)", () => {
    expect(identificavelPeloLink("anonima", null)).toBe(true);
    expect(
      identificavelPeloLink("anonima", { cpf: null, dataNascimento: null }),
    ).toBe(true);
  });
});

describe("T216 — tempo estimado por modelo (decisão da proprietária)", () => {
  it("o mapa único: os minutos fixos de cada modelo", () => {
    expect(MINUTOS_POR_MODELO).toEqual({
      pulso: 2,
      clima: 15,
      copsoq: 15,
      disc: 8,
      isfb: 6,
      onboarding: 5,
    });
  });

  it("modelo do mapa: o número dele, com qualquer quantidade de perguntas", () => {
    expect(minutosDaPesquisa("pulso", 5)).toBe(2);
    // O RH acrescentou ou tirou perguntas: o número continua o do mapa.
    expect(minutosDaPesquisa("pulso", 30)).toBe(2);
    expect(minutosDaPesquisa("clima", 62)).toBe(15);
    expect(minutosDaPesquisa("clima", 10)).toBe(15);
    expect(minutosDaPesquisa("copsoq", 76)).toBe(15);
    expect(minutosDaPesquisa("disc", 28)).toBe(8);
    expect(minutosDaPesquisa("isfb", 18)).toBe(6);
    expect(minutosDaPesquisa("onboarding", 3)).toBe(5);
  });

  it("os demais seguem a regra de 0,3 minuto por pergunta", () => {
    expect(minutosDaPesquisa("enps", 30)).toBe(9);
    expect(minutosDaPesquisa("pulso_clima", 34)).toBe(10);
    expect(minutosDaPesquisa("tad", 21)).toBe(6);
    expect(minutosDaPesquisa("personalizada", 5)).toBe(3);
    expect(minutosDaPesquisa("personalizada", 76)).toBe(23);
    expect(minutosDaPesquisa("avaliacao90", 12)).toBe(4);
  });
});
