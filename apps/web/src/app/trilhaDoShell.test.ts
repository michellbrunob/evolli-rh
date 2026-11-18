/**
 * T209 — a trilha da barra superior: seção, módulo e tela, derivados do menu
 * lateral (`menuLateral.ts`) e do mapa de destinos (`mapaNavegacao.ts`) —
 * nunca escritos à mão por tela, nunca com o mesmo nome duas vezes seguidas.
 */
import { describe, expect, it } from "vitest";
import { DESTINOS } from "./mapaNavegacao";
import { trilhaDoDestino } from "./trilhaDoShell";

const rotulos = (id: string) => trilhaDoDestino(id).map((i) => i.rotulo);

describe("trilha da barra superior", () => {
  it.each([
    ["pessoas", ["Pessoas", "Colaboradores"]],
    ["nova-admissao", ["Pessoas", "Colaboradores", "Novo colaborador"]],
    [
      "importar-colaboradores",
      ["Pessoas", "Colaboradores", "Importar planilha"],
    ],
    ["dashboard", ["Dashboard"]],
    ["configuracoes", ["Configurações", "Meu perfil"]],
    // T211 — Escala de trabalho e Organograma em Colaboradores; Liderança em
    // Pessoas; Equipe e permissões em Configurações; Ponto fora do menu.
    ["cadastros", ["Pessoas", "Colaboradores", "Organograma"]],
    ["jornadas-trabalho", ["Pessoas", "Colaboradores", "Escala de trabalho"]],
    ["ponto", ["Jornada"]],
    ["equipe", ["Pessoas", "Liderança", "Minha equipe"]],
    ["contas-acesso", ["Configurações", "Equipe e permissões"]],
    ["inicio", ["Demonstração", "Visão geral"]],
  ])("%s → %j", (id, esperado) => {
    expect(rotulos(id)).toEqual(esperado);
  });

  it("todo destino do mapa tem trilha, terminando no nome da tela, sem repetição seguida", () => {
    for (const destino of DESTINOS) {
      const trilha = rotulos(destino.id);
      expect(trilha.length).toBeGreaterThan(0);
      trilha.forEach((rotulo, i) => {
        expect(rotulo.trim()).not.toBe("");
        if (i > 0) expect(rotulo).not.toBe(trilha[i - 1]);
      });
    }
  });

  it("numa sub-página, o item do pai leva a ele; os demais são só texto", () => {
    expect(trilhaDoDestino("nova-admissao")).toEqual([
      { rotulo: "Pessoas" },
      { rotulo: "Colaboradores", destinoId: "pessoas" },
      { rotulo: "Novo colaborador" },
    ]);
    expect(trilhaDoDestino("pessoas").every((i) => !i.destinoId)).toBe(true);
  });

  it("destino desconhecido não inventa caminho", () => {
    expect(trilhaDoDestino("hub")).toEqual([]);
  });
});
