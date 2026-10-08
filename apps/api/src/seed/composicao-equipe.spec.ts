import { validarComposicaoDaEquipe } from "./demo-seed";

/**
 * A contraprova do seed precisa provar alguma coisa (T151, revisão final — R1).
 *
 * O seed monta um cenário para o gestor consultivo: alguém DENTRO da equipe
 * atribuída e alguém FORA dela. A conferência original só recusava o caso em
 * que o "de fora" estava, na verdade, dentro — e com isso três situações
 * diferentes passavam igual:
 *
 *   - o registro de contraprova não tem alocação vigente;
 *   - tem alocação, mas sem equipe nenhuma;
 *   - está mesmo em outra equipe.
 *
 * Só a terceira demonstra que a consulta filtra **por equipe**. As duas
 * primeiras demonstram apenas que não havia dado para mostrar — e um cenário
 * que passa por ausência de dado é indistinguível de um filtro quebrado.
 */
describe("validarComposicaoDaEquipe", () => {
  const ALVO = "equipe-turno-a";
  const OUTRA = "equipe-turno-b";

  const base = {
    equipeAlvo: ALVO,
    matriculaNaEquipe: "DEMO-A-0201",
    matriculaForaDaEquipe: "DEMO-A-0202",
  };

  describe("aceita o cenário correto", () => {
    it("um dentro da equipe, outro em equipe diferente", () => {
      expect(
        validarComposicaoDaEquipe({
          ...base,
          naEquipe: { equipeId: ALVO },
          foraDaEquipe: { equipeId: OUTRA },
        }),
      ).toBeNull();
    });
  });

  describe("recusa quando quem deveria estar DENTRO não está", () => {
    it("sem alocação vigente", () => {
      expect(
        validarComposicaoDaEquipe({
          ...base,
          naEquipe: null,
          foraDaEquipe: { equipeId: OUTRA },
        }),
      ).toMatch(/não tem alocação vigente/i);
    });

    it("alocado sem equipe", () => {
      expect(
        validarComposicaoDaEquipe({
          ...base,
          naEquipe: { equipeId: null },
          foraDaEquipe: { equipeId: OUTRA },
        }),
      ).toMatch(/deveria estar na equipe do gestor/i);
    });

    it("alocado em outra equipe", () => {
      expect(
        validarComposicaoDaEquipe({
          ...base,
          naEquipe: { equipeId: OUTRA },
          foraDaEquipe: { equipeId: OUTRA },
        }),
      ).toMatch(/deveria estar na equipe do gestor/i);
    });
  });

  describe("recusa a contraprova fraca — os três casos do achado R1", () => {
    it("quando o registro de contraprova NÃO tem alocação vigente", () => {
      // Passava antes: `undefined === ALVO` é falso, e a conferência seguia.
      expect(
        validarComposicaoDaEquipe({
          ...base,
          naEquipe: { equipeId: ALVO },
          foraDaEquipe: null,
        }),
      ).toMatch(/não demonstra que a consulta filtra por EQUIPE/i);
    });

    it("quando tem alocação SEM equipe", () => {
      // Também passava antes: `null === ALVO` é falso. É exatamente a
      // situação de `DEMO-A-0002` no banco de demonstração, e é o motivo de a
      // contraprova ter passado a usar um registro próprio em `TURNOB`.
      expect(
        validarComposicaoDaEquipe({
          ...base,
          naEquipe: { equipeId: ALVO },
          foraDaEquipe: { equipeId: null },
        }),
      ).toMatch(/precisa estar em OUTRA equipe/i);
    });

    it("quando pertence à própria equipe alvo", () => {
      // Único caso que a versão anterior já pegava.
      expect(
        validarComposicaoDaEquipe({
          ...base,
          naEquipe: { equipeId: ALVO },
          foraDaEquipe: { equipeId: ALVO },
        }),
      ).toMatch(/está DENTRO da equipe do gestor/i);
    });
  });

  it("a regra antiga aprovaria dois dos três — é o que este spec fecha", () => {
    // Documenta a diferença de forma executável: sob o critério antigo
    // (`fora?.equipeId === alvo`), ausência de alocação e alocação sem equipe
    // eram aceitas. Hoje as três recusam.
    const antigo = (foraDaEquipe: { equipeId: string | null } | null) =>
      foraDaEquipe?.equipeId === ALVO ? "recusa" : "aceita";

    expect(antigo(null)).toBe("aceita");
    expect(antigo({ equipeId: null })).toBe("aceita");
    expect(antigo({ equipeId: ALVO })).toBe("recusa");

    for (const fraca of [null, { equipeId: null }, { equipeId: ALVO }]) {
      expect(
        validarComposicaoDaEquipe({
          ...base,
          naEquipe: { equipeId: ALVO },
          foraDaEquipe: fraca,
        }),
      ).not.toBeNull();
    }
  });
});
