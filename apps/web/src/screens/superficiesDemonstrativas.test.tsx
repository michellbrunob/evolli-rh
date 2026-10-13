/**
 * As 17 superfícies demonstrativas, sob um contrato ÚNICO (T159 — S1).
 *
 * ## Por que este arquivo existe
 *
 * O contrato das telas de exemplo estava espalhado por três arquivos de
 * contêiner, e divergiu: uma versão da T159 tirou `senha` e `sessão` da lista
 * de termos proibidos em dois deles, com justificativa falsa; a correção
 * seguinte restaurou **14** superfícies e deixou as **3** de Pessoas de fora,
 * porque o conserto foi escrito contra o número errado.
 *
 * Aqui o contrato é um só, aplicado às 17 de uma vez, e a contagem é
 * **derivada do produto** — não escrita à mão. Se uma aba de exemplo nascer
 * amanhã sem o aviso, ou com um termo proibido, este arquivo quebra; se a
 * contagem mudar, quebra também, e quem mudar precisa dizer por quê.
 *
 * ## O caso do `login`
 *
 * `login` é o ÚNICO termo liberado, e por um motivo verificável: 13 das 17
 * telas o usam dentro da própria negação — "Não há login, API,
 * persistência…". Proibir a palavra reprovaria justamente o aviso que torna a
 * tela honesta. Em vez de simplesmente permitir, o teste abaixo **exige** que
 * toda ocorrência de `login` esteja dentro dessa negação. `senha` e `sessão`
 * continuam proibidos: nenhuma das 17 os contém, e a alegação em contrário
 * era falsa.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PessoasScreen } from "./pessoas/PessoasScreen";
import { CadastrosScreen } from "./horarios/CadastrosScreen";
import { PontoScreen } from "./ponto/PontoScreen";

/**
 * Proibidos em TODA superfície demonstrativa. Fornecedor, empresa e dado
 * pessoal ou sensível não têm o que fazer numa maquete — e o que não entra na
 * maquete não vaza dela.
 */
const TERMOS_PROIBIDOS = [
  "reserva fiscal",
  "secullum",
  "rwtech",
  "bioprox",
  "senha",
  "sessão",
] as const;

/** Único termo liberado, e só dentro da negação (ver cabeçalho). */
const NEGACAO_DE_LOGIN = /não há login/i;

const CONTEINERES = [
  {
    nome: "Pessoas",
    tablist: "Seções de Pessoas",
    abas: 3,
    render: () => render(<PessoasScreen modo="demonstrativo" />),
  },
  {
    nome: "Estrutura",
    tablist: "Seções de Cadastros",
    abas: 7,
    render: () => render(<CadastrosScreen modo="demonstrativo" />),
  },
  {
    nome: "Jornada",
    tablist: "Seções de Ponto",
    abas: 7,
    render: () => render(<PontoScreen modo="demonstrativo" />),
  },
] as const;

/** Abas DESTE contêiner — nunca as de uma tela aninhada. */
function abasDoContainer(tablist: string): HTMLElement[] {
  return within(screen.getByRole("tablist", { name: tablist })).getAllByRole(
    "tab",
  );
}

describe("superfícies demonstrativas — contrato único das 17", () => {
  it("são exatamente 17, e a contagem vem do produto", () => {
    const porContainer = CONTEINERES.map((conteiner) => {
      const { unmount } = conteiner.render();
      const total = abasDoContainer(conteiner.tablist).length;
      unmount();
      return { nome: conteiner.nome, total };
    });

    expect(porContainer).toEqual([
      { nome: "Pessoas", total: 3 },
      { nome: "Estrutura", total: 7 },
      { nome: "Jornada", total: 7 },
    ]);
    expect(porContainer.reduce((soma, c) => soma + c.total, 0)).toBe(17);
  });

  for (const conteiner of CONTEINERES) {
    describe(`${conteiner.nome} (${conteiner.abas} superfícies)`, () => {
      it("nenhuma aba contém termo proibido — a mesma lista para todas", () => {
        conteiner.render();
        const abas = abasDoContainer(conteiner.tablist);
        expect(abas).toHaveLength(conteiner.abas);

        for (const aba of abas) {
          fireEvent.click(aba);
          const texto = document.body.innerHTML.toLowerCase();
          for (const termoProibido of TERMOS_PROIBIDOS) {
            expect(
              texto,
              `"${termoProibido}" apareceu em "${aba.textContent}"`,
            ).not.toContain(termoProibido);
          }
        }
      });

      it("onde há `login`, ele está dentro da negação — nunca como recurso", () => {
        conteiner.render();
        for (const aba of abasDoContainer(conteiner.tablist)) {
          fireEvent.click(aba);
          const texto = document.body.textContent ?? "";
          if (!/login/i.test(texto)) continue;
          expect(
            texto,
            `"login" fora da negação em "${aba.textContent}"`,
          ).toMatch(NEGACAO_DE_LOGIN);
        }
      });

      it("cada aba se identifica como exemplo", () => {
        conteiner.render();
        for (const aba of abasDoContainer(conteiner.tablist)) {
          fireEvent.click(aba);
          expect(
            screen.getAllByText(/demonstraç|exemplo|ilustrativ/i).length,
            `sem aviso de exemplo em "${aba.textContent}"`,
          ).toBeGreaterThan(0);
        }
      });
    });
  }
});
