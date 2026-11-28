/**
 * T216 — o registro da galeria: os 12 modelos, na ordem dos cards, e os
 * modelos prontos da Personalizada. Cada frente acrescenta ou completa o seu
 * modelo em `modelos/<id>/catalogo.ts` (as perguntas em `secoes`) e, se
 * precisar, a tela de resultado em `modelos/<id>/` — o registro das telas é
 * `modelos/resultados.tsx`.
 */
import { AVALIACAO_90 } from "./avaliacao90/catalogo";
import { AVALIACAO_180 } from "./avaliacao180/catalogo";
import { CLIMA } from "./clima/catalogo";
import { RISCOS_PSICOSSOCIAIS } from "./copsoq/catalogo";
import { PERFIL_COMPORTAMENTAL } from "./disc/catalogo";
import { ENPS } from "./enps/catalogo";
import { SAUDE_FINANCEIRA } from "./isfb/catalogo";
import { ONBOARDING } from "./onboarding/catalogo";
import {
  PERSONALIZADA,
  SUBMODELOS_PERSONALIZADA,
} from "./personalizada/catalogo";
import { PULSO } from "./pulso/catalogo";
import { PULSO_CLIMA } from "./pulso_clima/catalogo";
import { TAD } from "./tad/catalogo";
import type { ModeloDaGaleria } from "./tipos";

export const MODELOS_DA_GALERIA: readonly ModeloDaGaleria[] = [
  PULSO,
  PULSO_CLIMA,
  CLIMA,
  ENPS,
  ONBOARDING,
  TAD,
  RISCOS_PSICOSSOCIAIS,
  SAUDE_FINANCEIRA,
  AVALIACAO_90,
  AVALIACAO_180,
  PERFIL_COMPORTAMENTAL,
  PERSONALIZADA,
];

export { SUBMODELOS_PERSONALIZADA };
