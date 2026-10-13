import "@testing-library/jest-dom/vitest";
import { instalarMatchMedia } from "./viewport";

// O jsdom não tem `matchMedia`, e o shell precisa dele para saber se está no
// modo gaveta (T159, R1). Instalado uma vez por ambiente; a largura começa no
// padrão do jsdom (desktop) e só muda por `definirLarguraDaJanela`.
instalarMatchMedia();
